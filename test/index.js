var test = require('tape')
var unpack = require('../')
var webpack = require('webpack')
var path = require('path')
var fs = require('fs')

function buildFixture (name, cb) {
  var config = path.join(__dirname, 'fixtures', name, 'webpack.config.js')
  var bundle = path.join(__dirname, 'fixtures', name, 'out/bundle.js')
  webpack(require(config)).run(function (err, stats) {
    if (err) return cb(err)
    fs.readFile(bundle, 'utf8', function (err, contents) {
      if (err) return cb(err)
      cb(null, contents)
    })
  })
}

test('commonjs modules', function (t) {
  t.plan(4)
  buildFixture('commonjs', function (err, bundle) {
    t.ifError(err)
    var modules = unpack(bundle)
    t.ok(modules)
    t.equal(modules.length, 4)
    t.ok(/^exports\.test=/.test(modules[0].source))
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
    t.ok(/^\(?exports\.test = /.test(modules[0].source))
  })
})
