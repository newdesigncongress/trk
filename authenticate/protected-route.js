
function protectedRoute (req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  req.session.returnTo = req.originalUrl;
  res.redirect('/signin')
}

module.exports = protectedRoute
