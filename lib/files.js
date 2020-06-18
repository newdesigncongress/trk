const fs = require('fs')
const path = require('path')
const async = require('async')

function move (files, targetDirectory) {
  return new Promise(function (resolve, reject) {
    const dir = path.join(__dirname, targetDirectory)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }

    async.eachSeries(
      files,
      (file, callback) => {
        const oldPath = path.join(__dirname, `../uploads/${file.filename}`)
        const newPath = path.join(__dirname, targetDirectory, file.originalname)
        fs.rename(oldPath, newPath, callback)
      },
      (error) => {
        if (error) {
          return reject(error)
        } else {
          return resolve()
        }
      }
    )
  })
}

function clear (files, callback) {
  const errors = []
  async.eachSeries(
    files,
    (file, callback) => {
      fs.unlink(path.join(__dirname, '..', file.path), (error) => {
        if (error) {
          errors.push(error)
        }
        callback()
      })
    },
    (error) => {
      if (errors.length > 0) {
        console.error(error)
      }
      callback()
    }
  )
}

module.exports = { move, clear }
