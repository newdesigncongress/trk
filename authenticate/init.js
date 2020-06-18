const LocalStrategy = require('passport-local').Strategy
const db = require('../lib/db')
const pass = require('pwd')

module.exports = passport => {
  passport.serializeUser((user, done) => {
    done(null, user)
  })

  passport.deserializeUser((id, done) => {
    db.get(`user!${id}:username`, (err, user) => {
      done(err, user)
    })
  })

  passport.use(
    'local',
    new LocalStrategy(
      { passReqToCallback: true },
      (req, username, password, done) => {
        username = req.body.username
        password = req.body.password

        db.get(
          `user!${username}:username`,
          (err, value) => {
            if (err) {
              if (err.notFound) {
                console.log('User not found:', username)
                return done(null, false)
              }

              console.log('IO error', err)
              return done(null, false)
            }

            const uname = value

            db.get(
              `user!${username}:pwdhash`,
              (err, value) => {
                if (err) {
                  if (err.notFound) {
                    console.log('Password hash not found for user:', uname)
                    return done(null, false)
                  }

                  console.log('IO error', err)
                  return done(null, false)
                }

                const pwdhash = value

                db.get(
                  `user!${username}:pwdsalt`,
                  (err, value) => {
                    if (err) {
                      if (err.notFound) {
                        console.log('Password salt not found for user:', uname)
                        return done(null, false)
                      }

                      console.log('IO Error', err)
                      return done(null, false)
                    }

                    const pwdsalt = value

                    pass.hash(
                      password,
                      pwdsalt,
                      (err, hash) => {
                        if (err) {
                          throw err
                        }

                        if (pwdhash === hash) {
                          req.session.username = uname
                          return done(null, uname)
                        } else {
                          console.log('Password failed attempt for', uname)
                          return done(null, false)
                        }
                      }
                    )
                  }
                )
              }
            )
          }
        )
      }
    )
  )
}
