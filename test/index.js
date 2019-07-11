var test = require('tape')
var unpack = require('../')
var webpack = require('webpack')
var path = require('path')

function buildFixture (name, cb) {
  var config = path.join(__dirname, 'fixtures', name, 'webpack.config.js')
  webpack(require(config)).run(function (err, stats) {
    if (err) return cb(err)
    cb(null, stats.compilation.assets['bundle.js'].source(), stats.compilation.assets)
  })
}

test('commonjs modules', function (t) {
  t.plan(4)
  buildFixture('commonjs', function (err, bundle) {
    t.ifError(err)
    var modules = unpack(bundle)
    t.ok(modules)
    t.equal(modules.length, 4)
    t.ok(/^exports\.test=/.test(modules[3].source))
  })
})

test('provide only an ast', function (t) {
  t.plan(4)
  buildFixture('commonjs', function (err, bundle) {
    t.ifError(err)
    var ast = require('acorn').parse(bundle)
    var modules = unpack(ast)
    t.ok(modules)
    t.equal(modules.length, 4)
    // with a ( because it's a sequenceexpression
    t.ok(/^\(?exports\.test = /.test(modules[3].source))
  })
})

test('es modules', function (t) {
  t.plan(6)
  buildFixture('esmodules', function (err, bundle) {
    t.ifError(err)
    var modules = unpack(bundle)
    t.ok(modules)
    t.equal(modules.length, 3) // just 3 because of ModuleConcatenation
    t.ok(/whatever/.test(modules[2].source))
    t.ok(/require\.r/.test(modules[2].source))
    t.ok(/require\.n/.test(modules[2].source))
  })
})

test('entry points', function (t) {
  t.plan(5)
  buildFixture('entrypoints', function (err, bundle) {
    t.ifError(err)
    var modules = unpack(bundle)
    t.ok(modules)
    t.equal(modules.length, 3) // created a multi entry point proxy module
    var entry = modules.filter(function (m) { return m.entry })[0]
    t.ok(/require\(1\)/.test(entry.source))
    t.ok(/require\(2\)/.test(entry.source))
  })
})

test('split bundles', function (t) {
  t.plan(8)
  buildFixture('split', function (err, bundle, assets) {
    t.ifError(err)
    var modules = unpack(bundle)
    var splitModules = unpack(assets['1.bundle.js'].source())
    t.ok(modules)
    t.ok(splitModules)
    t.equal(modules.length, 1)
    t.equal(splitModules.length, 1)
    var entry = modules.filter(function (m) { return m.entry })[0]
    var splitEntry = splitModules[0]
    t.ok(/require\.e/.test(entry.source))
    t.ok(/require\.t/.test(entry.source))
    t.ok(/console\.log/.test(splitEntry.source))
  })
})
