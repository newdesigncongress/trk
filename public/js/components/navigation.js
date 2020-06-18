
import state from '../state.js'
import viewerImages from './viewer.js'
import viewerText from './viewer-text.js'
import list from './list.js'

const viewer = dataType === 'image' ? viewerImages : viewerText

const el = {
  previous: document.querySelector('#navigation #previous'),
  next: document.querySelector('#navigation #next'),
  submit: document.querySelector('#submit'),
  progress: document.querySelector('.progress-bar')
}

update(true)

function init () {
  el.previous.addEventListener('click', previousImage)
  el.next.addEventListener('click', nextImage)

  el.submit.addEventListener('click', function () {
    window.location.replace(window.location.pathname += '/submit')
  })

  update()
}

function nextImage () {
  state.currentIndex = (state.currentIndex + 1) % state.files.length
  update()
}

function previousImage () {
  state.currentIndex --
  if (state.currentIndex < 0) {
    state.currentIndex = state.files.length - 1
  }
  update()
}

function update (onlySelf) {
  const startIndex = startOffset % (state.files.length || 1)
  const endIndex = (startOffset + taskCount) % (state.files.length || 1)
  let progress = 0

  if (!taskCount) {
    progress = (state.currentIndex + 1) / (state.files.length || 1)
  } else if (state.currentIndex >= startIndex) {
    progress = (state.currentIndex - startIndex + 1) / taskCount
  } else {
    progress = ((state.files.length || 1) - (startIndex - 1) + state.currentIndex) / taskCount
  }

  el.previous.className = 'button inline'
  el.next.className = 'button inline'
  el.previous.className = state.currentIndex !== startIndex ?  'button inline' : 'button inline inactive'
  el.next.className = progress < 1 ?  'button inline' : 'button inline inactive'

  el.progress.querySelector('.gauge').style.width = `${Math.round(progress * 100)}%`
  el.progress.querySelector('.percentage').innerText = `${Math.round(progress * 100)}%`
  el.submit.className = progress < 1 ? 'button wide inactive' : 'button wide'

  const xhr = new window.XMLHttpRequest()
  xhr.open('GET', `${assignment_id}/progress?progress=${progress}`)
  xhr.send()

  if (onlySelf) {
    return
  }

  list.render()
  viewer.clear()
  viewer.updateData()
  viewer.drawAllCaptions()
}

export default { init }
