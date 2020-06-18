// import dependencies
const express = require('express')
var fs = require('fs')
var path = require('path')
var http = require('http')
var https = require('https')
const bodyParser = require('body-parser')
const session = require('express-session')
const passport = require('passport')
require('./authenticate/init.js')(passport)
const LevelSessionStore = require('level-session-store')(session)
const flash = require('connect-flash')

const routes = require('./routes')

// initialize express
const app = express()
// server static assets
app.use(express.static('public', { dotfiles: 'allow' }))
app.use('/images', express.static('images'))
app.use('/text', express.static('text'))
app.use('/fonts', express.static('fonts'))
app.use('/img', express.static('img'))

// setup pug templating
app.set('view engine', 'pug')
app.set('views', './views')

// setup form body parser
app.use(bodyParser.urlencoded({ extended: false }))

// setup session
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET,
  store: new LevelSessionStore('./databases/sessions')
}))

// setup passport
app.use(passport.initialize())
app.use(passport.session())

// setup flash middleware
app.use(flash())
app.use(function (req, res, next) {
  res.locals.isLoggedIn = !!req.session.username
  res.locals.username = req.user

  res.locals.flash = {
    error: req.flash('error')[0],
    message: req.flash('message')[0],
    data: req.flash('data')[0]
  }

  next()
})

// initialize routes
routes(app)

// start server
const HTTPPort = 80
const httpServer = http.createServer(app)
httpServer.listen(80, () => {
  console.log(`---- Listening on port ${HTTPPort} ----\n`)
})

if (!process.env.development) {
  const HTTPSPort = 443

  const options = {
    cert: fs.readFileSync(path.join(__dirname, '../letsencrypt/fullchain.pem')),
    key: fs.readFileSync(path.join(__dirname, '../letsencrypt/privkey.pem'))
  }

  https
    .createServer(options, app)
    .listen(HTTPSPort, function () {
      console.log(`---- Listening on port ${HTTPSPort} ----\n`)
    })
}
