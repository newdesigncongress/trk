
const path = require('path')
const fs = require('fs')
const shortid = require('shortid')
const eachSeries = require('async/eachSeries')
const protectedRoute = require('../authenticate/protected-route')
const sgMail = require('@sendgrid/mail')
const { check, validationResult } = require('express-validator')

const db = require('../lib/db')

try {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
} catch (error) {
  console.error(error)
}

function assignments (app) {
  let sanitizationChain = []

  app.post(
    '/users/:user_id/tasks/:task_id/assignments/create',
    protectedRoute,
    (req, res, next) => {
      // build sanitization chain dynamically
      sanitizationChain = Object
        .keys(req.body)
        .filter(key => key.indexOf('assignee_email_') > -1)
        .map(key => check(key).isEmail().trim().escape())
      next()
    },
    sanitizationChain,
    async function (req, res) {
      const { user_id, task_id } = req.params

      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        req.flash('data', req.body)
        req.flash('error', 'One or several inputs are invalid.')
        return res.redirect(`/users/${req.user}/tasks`)
      }

      if (req.params.user_id !== req.user) {
        return res.redirect(`/users/${req.user}/tasks`)
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
        (email, callback) => {
          let newAssignmentId = shortid.generate().toLowerCase()
          let newAssignmentKey = `user!${req.user}!task!${task_id}!assignment!${newAssignmentId}`

          db.get(newAssignmentKey, (error) => {
            if (!error) {
              newAssignmentId = shortid.generate().toLowerCase()
              newAssignmentKey = `user!${req.user}!task!${task_id}!assignment!${newAssignmentId}`
            }

            const newAssignmentDate = new Date()
            const startOffset = Math.ceil(Math.random() * 10000)
            const newAssignment = {
              captions: {},
              accepted: false,
              completed: false,
              date_created: newAssignmentDate,
              date_updated: newAssignmentDate,
              id: newAssignmentId,
              task_id: task_id,
              start_offset: startOffset,
              email: email,
              user: null
            }

            if (email === ownEmailAddress) {
              newAssignment.accepted = true
              newAssignment.user = req.user

              return db.get(`user!${user_id}!task!${task_id}`, (error, task) => {
                if (error) {
                  return callback(error)
                }

                const userAssignment = {
                  user_id: user_id,
                  task_id: task_id,
                  assignment_id: newAssignmentId,
                  title: task.title
                }

                return db.put(`user!${req.user}!assignment!${newAssignmentId}`, userAssignment, (error) => {
                  if (error) {
                    return callback(error)
                  }

                  db.put(newAssignmentKey, newAssignment, callback)
                })
              })
            } else {
              const host = process.env.development ? 'http://localhost:80' : 'https://trk.network'

              const message = {
                to: email,
                from: 'assignment@trmturk.com',
                subject: 'You are invited to collaborate to a mechanical turk project',
                template_id: 'd-fffadd0bcf184f2196a5c50ac011c707',
                dynamic_template_data: {
                  inviteLink: `${host}/users/${req.user}/tasks/${task_id}/assignments/${newAssignmentId}`
                }
              }

              try {
                sgMail.send(message, error => {
                  if (error) {
                    throw error
                  }

                  db.put(newAssignmentKey, newAssignment, callback)
                })
              } catch (error) {
                db.put(newAssignmentKey, newAssignment, callback)
              }
            }
          })
        },
        (err) => {
          if (err) {
            console.error(err)
            req.flash('error', 'Unable to invite all collaborators, please try again.')
          }

          return res.redirect(`/users/${req.user}/tasks/${task_id}`)
        }
      )
    }
  )

  app.get('/users/:user_id/tasks/:task_id/assignments/:assignment_id', protectedRoute, async function (req, res) {
    const { user_id, assignment_id, task_id } = req.params

    try {
      const task = await db.get(`user!${user_id}!task!${task_id}`)
      const assignmentKey = `user!${user_id}!task!${task_id}!assignment!${assignment_id}`
      const assignment = await db.get(assignmentKey)

      let taskCount = task.limit || task.files.length
      let textPreview = null

      if (task.type === 'text') {
        const textContent = fs.readFileSync(path.join(__dirname, '../text', task_id, task.files[0]), 'utf8')
        taskCount = task.limit || textContent.split('\n').length
        textPreview = textContent.split('\n')[0]
      }

      if (!assignment.accepted) {
        const params = {
          previewFile: task.files[0],
          task_id,
          assignment_id,
          type: task.type,
          warning: task.warning,
          taskCount: taskCount,
          textPreview: textPreview,
          taskPrice: task.price || 0.1,
          pageTitle: 'TRK - Project Preview'
        }

        return res.render('preview', params)
      }

      if (assignment.user !== req.user) {
        req.flash('error', 'Task not found')
        return res.redirect(`/users/${user_id}/tasks`)
      }

      const params = {
        files: task.files,
        user_id: user_id,
        task_id,
        assignment_id,
        type: task.type,
        warning: task.warning,
        title: task.title,
        instructions: task.instructions,
        start_offset: assignment.start_offset,
        taskCount: taskCount,
        pageTitle: 'TRK - Training Tool'
      }

      return res.render('caption', params)
    } catch (err) {
      console.log(err)
      if (err.notFound) {
        req.flash('error', 'Task not found')
        return res.redirect(`/404`)
      } else {
        req.flash('error', 'Internal server error')
        return res.redirect(`/404`)
      }
    }
  })

  app.get('/users/:user_id/tasks/:task_id/assignments/:assignment_id/accept', protectedRoute, async function (req, res) {
    const { user_id, assignment_id, task_id } = req.params

    try {
      const task = await db.get(`user!${user_id}!task!${task_id}`)

      const assignmentKey = `user!${user_id}!task!${task_id}!assignment!${assignment_id}`
      const assignment = await db.get(assignmentKey)
      assignment.accepted = true
      assignment.user = req.user
      await db.put(assignmentKey, assignment)

      const userAssignment = {
        user_id: user_id,
        task_id: task_id,
        assignment_id: assignment_id,
        title: task.title
      }
      await db.put(`user!${req.user}!assignment!${assignment_id}`, userAssignment)

      return res.redirect(`/users/${user_id}/tasks/${task_id}/assignments/${assignment_id}`)
    } catch (err) {
      console.log(err)
      req.flash('error', 'Internal server error')
      return res.redirect(`/users/${user_id}/tasks/${task_id}/assignments/${assignment_id}`)
    }
  })

  app.get('/users/:user_id/tasks/:task_id/assignments/:assignment_id/progress', async function (req, res) {
    if (!req.isAuthenticated()) {
      return res.json({
        status: 'failure',
        error: 'user needs to sign in' 
      })
    }

    const { user_id, assignment_id, task_id } = req.params

    try {
      const assignmentKey = `user!${user_id}!task!${task_id}!assignment!${assignment_id}`
      const assignment = await db.get(assignmentKey)
      const progress = parseFloat(req.query.progress)
      if (Number.isNaN(progress)) {
        throw new Error('Invalid input')
      }

      assignment.progress = progress
      await db.put(assignmentKey, assignment)

      return res.json({status: 'success'})
    } catch (err) {
      console.log(err)
      return res.json({status: 'failure', error: err})
    }
  })

  app.get('/users/:user_id/tasks/:task_id/assignments/:assignment_id/submit', protectedRoute, async function (req, res) {
    const { user_id, assignment_id, task_id } = req.params

    try {
      const task = await db.get(`user!${user_id}!task!${task_id}`)

      const params = {
        user_id: user_id,
        task_id: task_id,
        assignment_id: assignment_id,
        title: task.title,
        ask_name: task.ask_name,
        ask_location: task.ask_location,
        ask_age: task.ask_age,
        ask_expertise: task.ask_expertise,
        actionUrl: `/users/${user_id}/tasks/${task_id}/assignments/${assignment_id}/submit`,
        pageTitle: 'TRK - Submit Captions'
      }

      res.render('submit', params)
    } catch (err) {
      console.log(err)
      req.flash('error', 'Internal server error')
      return res.redirect(`/users/${user_id}/tasks/${task_id}/assignments/${assignment_id}`)
    }
  })

  app.post(
    '/users/:user_id/tasks/:task_id/assignments/:assignment_id/submit',
    protectedRoute,
    [
      check('name').trim().escape(),
      check('location').trim().escape(),
      check('age').trim().escape(),
      check('expertise').trim().escape(),
      check('captions').trim()
    ],
    async function (req, res) {
      const { user_id, assignment_id, task_id } = req.params

      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        req.flash('data', req.body)
        req.flash('error', 'One or several inputs are invalid.')
        return res.redirect(`/users/${user_id}/tasks/${task_id}/assignments/${assignment_id}/submit`)
      }

      try {
        const assignmentKey = `user!${user_id}!task!${task_id}!assignment!${assignment_id}`
        const assignment = await db.get(assignmentKey)
        const captions = JSON.parse(req.body.captions)

        if (!Array.isArray(captions)) {
          throw new Error('Captions are not an array')
        }

        // TODO validate captions
        // const invalidCaptions = captions
        //   .some(caption => {
        //     return Number.isNaN(parseFloat(caption.x)) ||
        //       Number.isNaN(parseFloat(caption.y)) ||
        //       Number.isNaN(parseFloat(caption.width)) ||
        //       Number.isNaN(parseFloat(caption.height)) ||
        //       typeof caption.name !== 'string' ||
        //       (typeof caption.id !== 'string' && typeof caption.id !== 'number') ||
        //       Object.keys(caption).length !== 6
        //   })

        // if (invalidCaptions) {
        //   throw new Error('One or more options are invalid')
        // }

        assignment.captions = JSON.parse(req.body.captions)
        assignment.completed = true

        if (req.body.name) assignment.assigneeName = req.body.name
        if (req.body.location) assignment.assigneeLocation = req.body.location
        if (req.body.age) assignment.assigneeAge = req.body.age
        if (req.body.expertise) assignment.assigneeExpertise = req.body.expertise

        await db.put(assignmentKey, assignment)
      } catch (err) {
        console.log('err', err)
        req.flash('error', 'Internal server error. Please try again.')
        return res.redirect(`/users/${user_id}/tasks/${task_id}/assignments/${assignment_id}/submit`)
      }

      res.redirect('/thank-you')
    }
  )

  app.get('/thank-you', async function (req, res) {
    res.render('thank-you', { pageTitle: 'TRK - Thank you' })
  })
}

module.exports = assignments
