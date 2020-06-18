
const signupPanel = document.getElementById('signup-panel')
const signinPanel = document.getElementById('signin-panel')

updatePanel()
window.addEventListener('hashchange', updatePanel)

function updatePanel () {
  switch (window.location.hash) {
    case '#signin':
      signupPanel.className = 'hidden'
      signinPanel.className = ''
      document.title = 'TRK - Sign In'
      break
    case '#signup':
      signupPanel.className = ''
      signinPanel.className = 'hidden'
      document.title = 'TRK - Sign Up'
      break
    default:
      signupPanel.className = 'hidden'
      signinPanel.className = ''
      document.title = 'TRK - Sign In'
      break
  }

  const wrapper = document.getElementById('wrapper')
  if (wrapper.className === 'navigation-open') {
    wrapper.className = ''
  }
}
