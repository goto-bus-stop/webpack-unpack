var path = require('path')

module.exports = {
  context: __dirname,
  entry: ['./one.js', './two.js'],
  output: {
    path: path.join(__dirname, 'out'),
    filename: 'bundle.js'
  },
  mode: 'production'
}
