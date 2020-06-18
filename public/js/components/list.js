
import state from '../state.js'
import localstorage from '../lib/localstorage.js'
import viewerImages from './viewer.js'
import viewerText from './viewer-text.js'
import { hslToRgb } from '../lib/utils.js'

const el = {
  list: document.querySelector('#list')
}

function render () {
  const captions = state.captions[state.currentIndex]

  const captionList = (captions || []).map(caption => {
    const hue = (caption.id * 0.05 + (caption.id % 2 ? 0.4 : 0)) % 1
    const color = hslToRgb(hue, 1, 0.5)

    const style = caption.general ? `border: 1px solid black` : `background-color:${color}`

    return `
      <li class='caption'>
        <div class='name' style="${style}">
          ${caption.name}
        </div>
        <div class='close-button'>
          ✕
        </div>
      </li>
    `
  }).join('')

  el.list.innerHTML = !captionList ? 'No captions yet' : `${captionList}`

  const buttons = el.list.querySelectorAll('.close-button')
  buttons.forEach(function (button, index) {
    button.onclick = function () { deleteItem(index) }
  })
}

function deleteItem (index) {
  // remove caption from both state and DOM
  const captions = state.captions[state.currentIndex]
  captions.splice(index, 1)

  // redraw viewer
  const viewer = dataType === 'image' ? viewerImages : viewerText
  viewer.clear()
  viewer.drawAllCaptions()

  // re-render captions list
  render()

  // update localstorage
  localstorage.set('captions', state.captions)
}

export default { render }
