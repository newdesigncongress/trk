// import modules
const db = require('../lib/db')
const passport = require('passport')
const protectedRoute = require('../authenticate/protected-route')
const pass = require('pwd')
const { check, validationResult } = require('express-validator')
const axios = require('axios')

// export module
module.exports = users

function users (app) {
  app.get('/signin', function (req, res) {
    return res.render('signin', { pageTitle: 'TRK - Sign In' })
  })

  app.post(
    '/signin',
    [
      check('username').trim().escape(),
      check('password').trim().escape()
    ],
    (req, res, next) => {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        req.flash('data', req.body)
        req.flash('error', 'One or several inputs are invalid.')
        return res.redirect(`/signin`)
      }

      passport.authenticate('local', (err, user, info) => {
        if (err) {
          req.flash('error', err)
          return res.redirect('/signin')
        }

        if (!user) {
          req.flash('error', 'Wrong username or password')
          return res.redirect('/signin')
        }

        req.logIn(user, (err) => {
          if (err) {
            return next(err)
          }

          res.redirect(req.session.returnTo || `/users/${req.user}/tasks`)
          delete req.session.returnTo
        })
      })(req, res, next)
    }
  )

  app.post(
    '/signup',
    [
      check('username').trim().escape(),
      check('name').trim().escape(),
      check('email').isEmail().trim().escape(),
      check('password').trim().escape(),
      check('verificaion').trim().escape(),
      check('g-recaptcha-response').trim().escape()
    ],
    (req, res, next) => {
      var username = req.body.username
      var name = req.body.name
      var email = req.body.email
      var password = req.body.password
      var verification = req.body.verification
      var recaptchaResponse = req.body['g-recaptcha-response']

      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        req.flash('data', req.body)
        req.flash('error', 'One or several inputs are invalid.')
        return res.redirect(`/signin#signup`)
      }

      if (!recaptchaResponse) {
        req.flash('error', "Please verify you're human.")
        return res.redirect('/signin#signup')
      }

      axios
        .post(
          `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaResponse}`,
          {},
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
            }
          }
        )
        .then((recaptchaResponse) => {
          if (!recaptchaResponse.data.success) {
            req.flash('error', 'Internal server error, please try again')
            return res.redirect('/signin#signup')
          }

          let error = null
          const EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/

          // check for valid inputs
          if (!username || !email || !password || !verification) {
            error = 'All fields are required'
          } else if (username !== encodeURIComponent(username)) {
            error = 'Username may not contain any non-url-safe characters'
          } else if (!email.match(EMAIL_REGEXP)) {
            error = 'Email is invalid'
          } else if (password !== verification) {
            error = 'Passwords don\'t match'
          }

          if (error) {
            req.flash('error', error)
            return res.redirect('/signin#signup')
          }

          // check if username is already taken
          db.get(
            `user!${username}:username`,
            (err, value) => {
              if (!err || value) {
                req.flash('error', 'Username already exists')
                return res.redirect('/signin#signup')
              }

              // create salt and hash password
              pass.hash(password, function (err, salt, hash) {
                if (err) console.log(err)

                var user = {
                  username: username,
                  email: email,
                  salt: salt,
                  hash: hash,
                  createdAt: Date.now(),
                  name: name,
                  assignments: []
                }

                var createUser = [
                  { type: 'put', key: `user!${user.username}:username`, value: user.username },
                  { type: 'put', key: `user!${user.username}:name`, value: user.name },
                  { type: 'put', key: `user!${user.username}:email`, value: user.email },
                  { type: 'put', key: `user!${user.username}:pwdsalt`, value: user.salt },
                  { type: 'put', key: `user!${user.username}:pwdhash`, value: user.hash },
                  { type: 'put', key: `user!${user.username}:createdAt`, value: user.createdAt }
                ]

                db.batch(createUser, function (err) {
                  if (err) {
                    req.flash('error', err)
                    return res.redirect('/signin#signup')
                  }

                  req.body.username = username
                  req.body.password = password
                  return next()
                })
              })
            }
          )
        })
        .catch((error) => {
          if (error) {}
          req.flash('error', 'Internal server error, please try again')
          return res.redirect('/signin#signup')
        })
    },
    (req, res, next) => {
      passport.authenticate('local', (err, user, info) => {
        if (err) {
          req.flash('error', err)
          return res.redirect('/signin')
        }

        if (!user) {
          req.flash('error', 'Wrong username or password')
          return res.redirect('/signin')
        }

        req.logIn(user, (err) => {
          if (err) {
            return next(err)
          }

          res.redirect(req.session.returnTo || `/users/${req.user}/tasks`)
          delete req.session.returnTo
        })
      })(req, res, next)
    }
  )

  app.get('/signout', protectedRoute, (req, res) => {
    req.session.destroy()
    res.redirect('/')
  })
}
