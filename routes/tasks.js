
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const shortid = require('shortid')
const sgMail = require('@sendgrid/mail')
const eachSeries = require('async/eachSeries')
const imageSize = require('image-size')
const { check, validationResult } = require('express-validator')

const db = require('../lib/db')
const files = require('../lib/files')
const protectedRoute = require('../authenticate/protected-route')

try {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
} catch (error) {
  console.error(error)
}

// initialize multipart middleware, set upload destination
const upload = multer({
  dest: 'uploads/',
  limits: {
    files: 1000,
    fileSize: 100000000,
    fields: 40
  }
})

function tasks (app) {
  let sanitizationChain = []

  app.get('/tasks', protectedRoute, (req, res) => {
    res.redirect(`/users/${req.user}/tasks`)
  })

  app.get('/users/:user_id', protectedRoute, (req, res) => {
    res.redirect(`/users/${req.user}/tasks`)
  })

  app.get('/users/:user_id/tasks/create', protectedRoute, (req, res) => {
    if (req.params.user_id !== req.user) {
      return res.redirect(`/users/${req.user}/tasks`)
    }

    res.render('task-create', { pageTitle: 'TRK - Project Creation' })
  })

  app.post(
    '/users/:user_id/tasks',
    protectedRoute,
    (req, res, next) => {
      // build sanitization chain dynamically
      sanitizationChain = Object
        .keys(req.body)
        .filter(key => key.indexOf('assignee_email_') > -1)
        .map(key => check(key).isEmail().trim().escape())
      next()
    },
    sanitizationChain.concat([
      check('title').trim().escape(),
      check('type').trim().escape(),
      check('description').trim().escape(),
      check('limit').trim().escape(),
      check('price').trim().escape(),
      check('instructions').trim().escape(),
      check('ingredient_creator').trim().escape(),
      check('ingredient_affiliation').trim().escape(),
      check('ingredient_location').trim().escape(),
      check('ingredient_language').trim().escape(),
      check('ingredient_summary').trim().escape()
    ]),
    upload.array('file', 1000),
    async function (req, res) {
      if (req.params.user_id !== req.user) {
        return files.clear(req.files, () => {
          res.redirect(`/users/${req.user}/tasks`)
        })
      }

      // Validate inputs

      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return files.clear(req.files, () => {
          console.log(errors.errors)
          req.flash('data', req.body)
          req.flash('error', 'One or several inputs are invalid.')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      if (!req.body.title || req.body.title.length > 60) {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', 'Title required (60 characters max).')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      if (req.body.type !== 'image' && req.body.type !== 'text') {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', 'Invalid data type')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      if (!req.body.description || req.body.description.length > 1000) {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', 'Description required (1000 characters max).')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      if (req.files.length < 1) {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', 'At least one file must be uploaded.')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      if (files.length > 1 && req.body.type === 'text') {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', 'Text mode only takes one *.csv file, which contains each text sample on a different row.')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      const invalidFileTypes = req.files.some(file => file.mimetype.split('/')[0] !== req.body.type)
      if (invalidFileTypes) {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', "File type (image/text) doesn't match data type")
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      const filesTooLarge = req.files.some(file => file.size > 8000000)
      if (filesTooLarge) {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', 'Some images are too large (max 8mb).')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      if (req.body.type === 'image') {
        const imagesTooWide = req.files.some(image => {
          const {
            width,
            height
          } = imageSize(image.path)
          return width > 800 || height > 800
        })

        if (imagesTooWide) {
          return files.clear(req.files, () => {
            req.flash('data', req.body)
            req.flash('error', 'Some images are larger/taller than 800px.')
            return res.redirect(`/users/${req.user}/tasks/create`)
          })
        }
      }

      let maxTaskCount = req.files.length
      if (req.body.type === 'text') {
        const textContent = fs.readFileSync(path.join(__dirname, `../uploads/${req.files[0].filename}`), 'utf8')
        maxTaskCount = textContent.split('\n').length
      }

      if (req.body.limit && (Number.isNaN(parseInt(req.body.limit)) || parseInt(req.body.limit) > maxTaskCount || parseInt(req.body.limit) < 0)) {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', 'Task limit is invalid.')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      if (req.body.price && (Number.isNaN(parseInt(req.body.price)) || parseInt(req.body.price) < 0)) {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', 'Price per task is invalid.')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      if (!req.body.instructions.length > 1000) {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', 'Instructions too long (1000 characters max).')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      const ingredientsTooLong = Object.keys(req.body)
        .filter(key => key.indexOf('ingredient_') > -1)
        .some(key => req.body[key] > 100)

      if (ingredientsTooLong) {
        return files.clear(req.files, () => {
          req.flash('data', req.body)
          req.flash('error', 'Data ingredients too long (100 characters max each).')
          return res.redirect(`/users/${req.user}/tasks/create`)
        })
      }

      // Generate new task

      const newTask = {}
      const newTaskDate = new Date()
      const listOfFiles = req.files.map(file => file.originalname)
      let newTaskId = shortid.generate().toLowerCase()

      try {
        const task = await db.get(`user!${req.user}!task!${newTaskId}`)
        if (task) newTaskId = shortid.generate().toLowerCase()
      } catch (err) {}

      try {
        await files.move(req.files, path.join(req.body.type === 'image' ? '../images/' : '../text/', newTaskId))

        newTask.id = newTaskId
        newTask.date_created = newTaskDate
        newTask.date_updated = newTaskDate
        newTask.title = req.body.title
        newTask.description = req.body.description
        newTask.limit = req.body.limit
        newTask.price = req.body.price
        newTask.type = req.body.type
        newTask.files = listOfFiles
        newTask.instructions = req.body.instructions
        newTask.requires_warning = !!req.body.warning
        newTask.warning = req.body.warning
        newTask.ask_name = req.body.ask_name === 'on'
        newTask.ask_location = req.body.ask_location === 'on'
        newTask.ask_age = req.body.ask_age === 'on'
        newTask.ask_expertise = req.body.ask_expertise === 'on'
        newTask.ingredient_creator = req.body.ingredient_creator
        newTask.ingredient_affiliation = req.body.ingredient_affiliation
        newTask.ingredient_location = req.body.ingredient_location
        newTask.ingredient_language = req.body.ingredient_language
        newTask.ingredient_summary = req.body.ingredient_summary

        await db.put(`user!${req.user}!task!${newTaskId}`, newTask)
      } catch (err) {
        console.log(err)
        req.flash('error', 'Internal server error')
        req.flash('data', req.body)

        return res.redirect(`/users/${req.id}/tasks/create`)
      }

      const listOfAssignees = Object
        .keys(req.body)
        .filter(key => key.indexOf('assignee_email_') > -1)
        .map(id => req.body[id])
        .filter(email => {
          const EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/
          return !!email.match(EMAIL_REGEXP)
        })

      let ownEmailAddress = null
      try {
        ownEmailAddress = await db.get(`user!${req.user}:email`)
      } catch (err) {}

      eachSeries(
        listOfAssignees,
        async (email, callback) => {
          let newAssignmentId = shortid.generate().toLowerCase()
          let newAssignmentKey = `user!${req.user}!task!${newTaskId}!assignment!${newAssignmentId}`

          try {
            const existingAssignment = await db.get(newAssignmentKey)
            if (existingAssignment) {
              newAssignmentId = shortid.generate().toLowerCase()
              newAssignmentKey = `user!${req.user}task!${newTaskId}!assignment!${newAssignmentId}`
            }
          } catch (err) {}

          const newAssignmentDate = new Date()
          const startOffset = Math.ceil(Math.random() * 10000)

          const newAssignment = {
            captions: {},
            completed: false,
            date_created: newAssignmentDate,
            date_updated: newAssignmentDate,
            id: newAssignmentId,
            task_id: newTaskId,
            start_offset: startOffset,
            email: email,
            user: null
          }

          try {
            if (email === ownEmailAddress) {
              newAssignment.accepted = true
              newAssignment.user = req.user

              const userAssignment = {
                user_id: req.user,
                task_id: newTaskId,
                assignment_id: newAssignmentId,
                title: newTask.title
              }

              await db.put(`user!${req.user}!assignment!${newAssignmentId}`, userAssignment)
            } else {
              const host = process.env.development ? 'http://localhost:80' : 'https://trk.network'
              const message = {
                to: email,
                from: 'assignment@trmturk.com',
                subject: 'You are invited to collaborate to a mechanical turk project',
                template_id: 'd-fffadd0bcf184f2196a5c50ac011c707',
                dynamic_template_data: {
                  inviteLink: `${host}/users/${req.user}/tasks/${newTaskId}/assignments/${newAssignmentId}`
                }
              }

              try {
                await sgMail.send(message)
              } catch (error) {
                console.error(error)
              }
            }

            await db.put(newAssignmentKey, newAssignment)
          } catch (err) {
            return callback(err)
          }
        },
        (err) => {
          if (err) {
            req.flash('error', 'Unable to invite all collaborators, please try again.')
            return res.redirect(`/users/${req.user}/tasks/create`)
          }

          req.flash('message', 'Your project was successfully created')
          return res.redirect(`/users/${req.user}/tasks/${newTaskId}`)
        }
      )
    }
  )

  app.get('/users/:user_id/tasks', protectedRoute, async function (req, res) {
    if (req.params.user_id !== req.user) {
      return res.redirect(`/users/${req.user}/tasks`)
    }

    // TODO clean up

    const tasks = []
    const assignments = []

    const taskReadStream = db.createReadStream({
      keys: false,
      gte: `user!${req.user}!task!`,
      lte: `user!${req.user}!task~`
    })

    taskReadStream.on('data', function (task) {
      // ensures assignments aren't included (refactor to sublevel or better keys?)
      if (!task.task_id) return tasks.push(task)
    })

    taskReadStream.on('error', function (error) {
      throw error
    })

    taskReadStream.on('end', function () {
      const assignmentReadStream = db.createReadStream({
        keys: false,
        gte: `user!${req.user}!assignment!`,
        lte: `user!${req.user}!assignment~`
      })

      assignmentReadStream.on('data', function (assignment) {
        assignments.push(assignment)
      })

      assignmentReadStream.on('error', function (error) {
        throw error
      })

      assignmentReadStream.on('end', function () {
        return res.render('tasks', { tasks, assignments, pageTitle: 'TRK - Projects' })
      })
    })
  })

  app.get('/users/:user_id/tasks/:id', protectedRoute, async function (req, res) {
    if (req.params.user_id !== req.user) {
      return res.redirect(`/users/${req.user}/tasks`)
    }

    try {
      const taskId = req.params.id
      const task = await db.get(`user!${req.user}!task!${taskId}`)

      let taskCount = task.limit || task.files.length
      if (task.type === 'text') {
        const textContent = fs.readFileSync(path.join(__dirname, '../text', taskId, task.files[0]), 'utf8')
        taskCount = task.limit || textContent.split('\n').length
      }

      let assignments = []
      const rs = db.createReadStream({
        keys: false,
        gte: `user!${req.user}!task!${taskId}!assignment!`,
        lte: `user!${req.user}!task!${taskId}!assignment~`
      })

      rs.on('data', function (assignment) {
        return assignments.push(assignment)
      })

      rs.on('error', function () {
        return res.status(500).json({ message: 'Internal error' })
      })

      rs.on('end', function () {
        let progress = assignments.reduce((total, assignment) => total + (parseFloat(assignment.progress) || 0), 0) / assignments.length
        if (Number.isNaN(progress)) {
          progress = 0
        }

        const params = {
          assignments,
          task,
          taskCount,
          progress,
          username: req.user,
          pageTitle: `TRK - Project '${task.title}'`
        }

        return res.render('task', params)
      })
    } catch (err) {
      if (err.notFound) {
        req.flash('error', 'Task not found')
        return res.redirect(`/users/${req.user}/tasks`)
      } else {
        req.flash('error', 'Internal server error')
        return res.redirect(`/users/${req.user}/tasks`)
      }
    }
  })

  app.get('/users/:user_id/tasks/:id/data', protectedRoute, async function (req, res) {
    if (req.params.user_id !== req.user) {
      return res.redirect(`/users/${req.user}/tasks`)
    }

    const taskId = req.params.id

    try {
      const task = await db.get(`user!${req.user}!task!${taskId}`)

      let assignments = []
      const rs = db.createReadStream({
        keys: false,
        gte: `user!${req.user}!task!${taskId}!assignment!`,
        lte: `user!${req.user}!task!${taskId}!assignment~`
      })

      rs.on('data', function (assignment) {
        return assignments.push(assignment)
      })

      rs.on('error', function () {
        return res.status(500).json({ message: 'Internal error' })
      })

      rs.on('end', function () {
        const inputData = task.type === 'image' ? task.files
          : fs.readFileSync(path.join(__dirname, '../text', taskId, task.files[0]), 'utf8').split('\n')

        const assignmentData = assignments
          .filter(assignment => assignment.completed)
          .map(assignment => {
            const captions = assignment.captions.map((fileCaptions, i) => {
              const tags = fileCaptions.map(tag => {
                if (tag.width < 0) {
                  tag.x += tag.width
                  tag.width = -tag.width
                }

                if (tag.height < 0) {
                  tag.y += tag.height
                  tag.height = -tag.height
                }

                return tag
              })

              return {
                inputDataId: task.type === 'image' ? task.files[i] : i,
                captions: tags
              }
            })

            return {
              id: assignment.id,
              email: assignment.email,
              date_created: assignment.date_created,
              metadata: {
                name: assignment.assigneeName,
                age: assignment.assigneeAge,
                location: assignment.assigneeLocation,
                expertise: assignment.assigneeExpertise
              },
              captions
            }
          })

        const metadata = {
          creator: task.ingredient_creator,
          affiliation: task.ingredient_affiliation,
          location: task.ingredient_location,
          language: task.ingredient_language,
          summary: task.ingredient_summary
        }

        return res.json({
          inputData,
          assignmentData,
          metadata
        })
      })
    } catch (err) {
      res.json({ error: 'internal server error' })
    }
  })

  app.get('/users/:user_id/tasks/:id/delete', protectedRoute, async function (req, res) {
    if (req.params.user_id !== req.user) {
      return res.redirect(`/users/${req.user}/tasks`)
    }

    // TODO clean up
    const taskId = req.params.id
    try {
      const task = await db.get(`user!${req.user}!task!${taskId}`)
      const assignments = []

      const assignmentReadStream = db.createReadStream({
        keys: false,
        gte: `user!${req.user}!task!${taskId}!assignment!`,
        lte: `user!${req.user}!task!${taskId}!assignment~`
      })

      assignmentReadStream.on('data', function (assignment) {
        if (assignment.user) {
          assignments.push(assignment)
        }
      })

      assignmentReadStream.on('error', function (error) {
        throw error
      })

      assignmentReadStream.on('end', function () {
        eachSeries(
          assignments,
          (assignment, callback) => {
            db.del(`user!${assignment.user}!assignment!${assignment.id}`, callback)
          },
          async (error) => {
            if (error) {
              throw error
            }

            try {
              await db.del(`user!${req.user}!task!${taskId}`)
              req.flash('message', `Project '${task.title}' deleted`)
              return res.redirect(`/users/${req.user}/tasks`)
            } catch (err) {
              throw err
            }
          }
        )
      })
    } catch (err) {
      if (err.notFound) {
        req.flash('error', 'Task not found')
        return res.redirect(`/users/${req.user}/tasks/${taskId}`)
      } else {
        req.flash('error', 'Internal server error')
        return res.redirect(`/users/${req.user}/tasks/${taskId}`)
      }
    }
  })
}

module.exports = tasks
