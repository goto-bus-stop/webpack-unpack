var assert = require('assert')
var acorn = require('acorn')
var astring = require('astring')
var scan = require('scope-analyzer')
var multisplice = require('multisplice')

module.exports = function unpack (source, opts) {
  var ast = typeof source === 'object' && typeof source.type === 'string'
    ? source
    : acorn.parse(source, { ecmaVersion: 2019 })

  if (opts && opts.source) {
    source = opts.source
  }

  if (source && Buffer.isBuffer(source)) {
    source = source.toString()
  }

  // nullify source if a parsed ast was given in the first parameter
  if (ast === source) {
    source = null
  }

  assert(!source || typeof source === 'string', 'webpack-unpack: source must be a string or Buffer')

  // !(prelude)(factories)
  if (ast.body[0].type !== 'ExpressionStatement' ||
      ast.body[0].expression.type !== 'UnaryExpression' ||
      ast.body[0].expression.argument.type !== 'CallExpression') {
    return
  }

  // prelude = (function(t){})
  var outer = ast.body[0].expression.argument
  if (outer.callee.type !== 'FunctionExpression' || outer.callee.params.length !== 1) {
    return
  }
  var prelude = outer.callee.body

  // Find the entry point require call.
  var entryNode = find(prelude.body.slice().reverse(), function (node) {
    if (node.type !== 'ExpressionStatement' || node.expression.type !== 'SequenceExpression') return false
    var exprs = node.expression.expressions
    return exprs[exprs.length - 1].type === 'CallExpression' &&
      exprs[exprs.length - 1].arguments.length === 1 &&
      exprs[exprs.length - 1].arguments[0].type === 'AssignmentExpression'
  })
  if (entryNode) {
    var exprs = entryNode.expression.expressions
    entryNode = exprs[exprs.length - 1].arguments[0].right
  }
  var entryId = entryNode ? entryNode.value : null

  // factories = [function(){}]
  if (outer.arguments.length !== 1 || outer.arguments[0].type !== 'ArrayExpression') {
    return
  }
  var factories = outer.arguments[0].elements
  if (!factories.every(isFunctionOrEmpty)) {
    return
  }

  var modules = []
  for (var i = 0; i < factories.length; i++) {
    var factory = factories[i]
    if (factory === null) return

    scan.crawl(factory)
    // If source is available, rewrite the require,exports,module var names in place
    // Else, generate a string afterwards.
    var range = getModuleRange(factory.body)
    var moduleSource = rewriteMagicIdentifiers(
      factory,
      source ? source.slice(range.start, range.end) : null,
      range.start
    )
    if (!moduleSource) {
      moduleSource = astring.generate({
        type: 'Program',
        body: factory.body.body
      })
    }

    var deps = getDependencies(factory)

    modules.push({
      id: i,
      source: moduleSource,
      deps: deps,
      entry: i === entryId
    })
  }

  return modules
}

function isFunctionOrEmpty (node) {
  return node === null || node.type === 'FunctionExpression'
}

function getModuleRange (body) {
  if (body.body.length === 0) {
    // exclude {} braces
    return { start: body.start + 1, end: body.end - 1 }
  }
  return {
    start: body.body[0].start,
    end: body.body[body.body.length - 1].end
  }
}

var rewriteProps = {
  d: 'defineExport',
  r: 'markEsModule',
  n: 'getDefaultExport',
  o: 'hasOwn',
  p: 'publicPath'
}

function rewriteMagicIdentifiers (moduleWrapper, source, offset) {
  var magicBindings = moduleWrapper.params.map(scan.getBinding)
  var magicNames = ['module', 'exports', 'require']
  var edit = source ? multisplice(source) : null

  magicBindings.forEach(function (binding, i) {
    var name = magicNames[i]
    binding.getReferences().forEach(function (ref) {
      if (ref === binding.definition) return

      ref.name = name
      if (edit) edit.splice(ref.start - offset, ref.end - offset, name)

      if (name === 'require' && ref.parent.type === 'MemberExpression') {
        var prop = ref.parent.property
        if (!rewriteProps[prop.name]) return
        prop.name = rewriteProps[prop.name]
        if (edit) edit.splice(prop.start - offset, prop.end - offset, prop.name)
      }
    })
  })

  return edit ? edit.toString() : null
}

function getDependencies (moduleWrapper) {
  var deps = {}
  if (moduleWrapper.params.length < 3) return deps

  var req = scan.getBinding(moduleWrapper.params[2])
  req.getReferences().forEach(function (ref) {
    if (ref.parent.type === 'CallExpression' && ref.parent.callee === ref && ref.parent.arguments[0].type === 'Literal') {
      deps[ref.parent.arguments[0].value] = ref.parent.arguments[0].value
    }
  })

  return deps
}

function find (arr, fn) {
  for (var i = 0; i < arr.length; i++) {
    if (fn(arr[i])) return arr[i]
  }
}
