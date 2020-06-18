const level = require('level')
const db = level('./databases/db', {valueEncoding: 'json'})

module.exports = db
