
const wrapper = document.querySelector('#wrapper')
const menuButton = document.querySelector('#menu-button')
const nav = document.getElementById('nav')

menuButton.addEventListener('click', toggleNavigation)
document.addEventListener('click', closeNavigation)

function toggleNavigation (event) {
  const navigationOpen = document.getElementById('wrapper').className === 'navigation-open'
  if (!navigationOpen) {
    wrapper.className = 'navigation-open'
  } else {
    wrapper.className = ''
  }

  event.stopPropagation()
}

function closeNavigation (event) {
  const navigationOpen = document.getElementById('wrapper').className === 'navigation-open'
  if (navigationOpen && !nav.contains(event.target)) {
    wrapper.className = ''
  }
}
