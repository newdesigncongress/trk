// import route functinos
const assignments = require('./assignments')
const tasks = require('./tasks')
const users = require('./users')

// export module
module.exports = routes

function routes (app) {
  assignments(app)
  tasks(app)
  users(app)

  // home route
  app.get('/', function (req, res) {
    return res.render('calculator', { pageTitle: 'TRK - Wage Calculator' })
  })

  app.get('/calculator', function (req, res) {
    res.render('calculator', { pageTitle: 'TRK - Wage Calculator' })
  })

  app.get('/essay', function (req, res) {
    res.render('essay', { pageTitle: 'TRK - Essay' })
  })

  app.get('/about', function (req, res) {
    res.render('about', { pageTitle: 'TRK - About' })
  })

  app.get('/data-protection', function (req, res) {
    res.render('data-protection', { pageTitle: 'TRK - Data Protection' })
  })

  // 404 not found route
  app.all('*', function (req, res) {
    return res.render('404', { pageTitle: 'TRK - Page Not Found' })
  })
}
