#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var unpack = require('.')
var argv = require('minimist')(process.argv.slice(2))
var concat = require('simple-concat')

var usage = 'webpack-unpack [--out outdir] < file.js'

if (argv.h || argv.help) {
  console.error(usage)
  process.exit(1)
}

concat(process.stdin, function (err, contents) {
  if (err) throw err
  var modules = unpack(contents)
  if (!modules) {
    console.error('could not parse bundle')
    process.exit(1)
  }

  if (argv.out) {
    var outdir = argv.out
    modules.forEach(function (row) {
      fs.writeFileSync(path.join(outdir, row.id + '.js'), row.source)
    })

    console.log('extracted', Object.keys(modules).length, 'modules')
  } else {
    console.log('[')
    modules.forEach(function (row, index) {
      if (index > 0) console.log(',')
      console.log(JSON.stringify(row))
    })
    console.log(']')
  }
})
