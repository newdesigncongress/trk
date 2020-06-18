// import modules
import state from './state.js'
import localstorage from './lib/localstorage.js'

import viewerImages from './components/viewer.js'
import viewerText from './components/viewer-text.js'
// import list from './components/list.js'
import navigation from './components/navigation.js'

const viewer = dataType === 'image' ? viewerImages : viewerText

if (dataType === 'image') {
  init(files)
} else {
  const xhr = new window.XMLHttpRequest()

  xhr.addEventListener('load', () => {
    init(xhr.responseText.split('\n'))
  })

  xhr.open('GET', `/text/${task_id}/${files[0]}`)
  xhr.send()
}

function init (files) {
  state.currentIndex = startOffset % files.length
  state.files = files
  state.files.forEach((file, i) => {
    state.captions[i] = []
  })

  // if captions exist in localstorage, load 'em up!
  const captions = localstorage.get('captions')
  if (captions) {
    state.captions = captions
  }

  viewer.init()
  navigation.init()

  if (navigator.userAgent.indexOf('Chrome') === -1 && navigator.userAgent.indexOf('Firefox') === -1) {
    document.getElementById('browser-warning').innerText = 'Note: this prototype was tested on Chrome and Firefox. Please try one of those two browsers if you encounter any issue.'
  }
}
