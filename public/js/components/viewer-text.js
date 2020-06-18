
import state from '../state.js'
import list from './list.js'
import localstorage from '../lib/localstorage.js'
import { hslToRgb } from '../lib/utils.js'

const el = {}

let baseOffset = 0
let extentOffset = 0
let originalText = null

function init () {
  originalText = state.files[state.currentIndex]
  const text = originalText.split('\\n').join('<br/><br/>')
  el.textParagraph = document.querySelector('#viewer #text p:first-child')
  el.textParagraph.innerHTML = text
  el.highlightParagraph = document.querySelector('#viewer #text p:nth-child(2)')
  el.highlightParagraph.innerHTML = text

  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('mouseup', onMouseUp)
  document.querySelector('#add-general-caption .add-button').addEventListener('click', addGeneralCaption)
  document.querySelector('#add-general-caption').addEventListener('keyup', (event) => {
    if (event.key.toLowerCase() === 'enter' || event.code.toLowerCase() === 'enter') {
      addGeneralCaption()
    }
  })

  window.addEventListener('keydown', (e) => {
    baseOffset = 0
    extentOffset = 0
    clear()
    drawAllCaptions()
    list.render()
  })

  clear()
  drawAllCaptions()
  list.render()
}

function addGeneralCaption () {
  const input = document.querySelector('#add-general-caption input')
  const name = input.value
  if (name) {
    const newCaption = {
      id: state.captions[state.currentIndex].reduce((max, caption) => Math.max(max, caption.id), 0) + 1,
      name,
      general: true
    }

    if (!state.captions[state.currentIndex]) state.captions[state.currentIndex] = []

    state.captions[state.currentIndex].push(newCaption)
    localstorage.set('captions', state.captions)
    input.value = null
    clear()
    drawAllCaptions()
    list.render()
  }
}

function onSelectionChange () {
  const selection = document.getSelection()

  if (!el.textParagraph.contains(selection.baseNode || selection.anchorNode) || !el.textParagraph.contains(selection.extentNode || selection.focusNode)) {
    baseOffset = 0
    extentOffset = 0
    return
  }

  const characterCounts = originalText
    .split('\\n')
    .map((chunk, i) => chunk.length + 2)

  const nodeIndices = [
    Array.prototype.indexOf.call(el.textParagraph.childNodes, selection.baseNode || selection.anchorNode) / 3,
    Array.prototype.indexOf.call(el.textParagraph.childNodes, selection.extentNode || selection.focusNode) / 3
  ]

  const nodeOffsets = [
    selection.baseOffset || selection.anchorOffset,
    selection.extentOffset || selection.focusOffset
  ]

  if (nodeIndices[0] > nodeIndices[1] || (nodeIndices[0] === nodeIndices[1] && nodeOffsets[0] > nodeOffsets[1])) {
    nodeIndices.reverse()
    nodeOffsets.reverse()
  }

  baseOffset = characterCounts.filter((count, i) => i < nodeIndices[0]).reduce((total, count) => total + count, 0) + nodeOffsets[0]
  extentOffset = characterCounts.filter((count, i) => i < nodeIndices[1]).reduce((total, count) => total + count, 0) + nodeOffsets[1]

  if (baseOffset === extentOffset) {
    el.highlightParagraph.innerHTML = originalText.split('\\n').join('<br/><br/>')
  } else {
    const id = state.captions[state.currentIndex].reduce((max, caption) => Math.max(max, caption.id), 0) + 1
    const hue = (id * 0.05 + (id % 2 ? 0.4 : 0)) % 1
    const color = hslToRgb(hue, 1, 0.5)

    el.highlightParagraph.innerHTML = `
      ${originalText.slice(0, baseOffset)}
      <span style='background-color: ${color};'>${originalText.slice(baseOffset, extentOffset)}</span>${originalText.slice(extentOffset)}
      `.split('\\n').join('<br/><br/>')
  }
}

function onMouseUp (event) {
  window.requestAnimationFrame(() => {
    if (document.getElementById('viewer').parentNode.contains(event.target) && baseOffset !== extentOffset) {
      const name = window.prompt(baseOffset + ' ' + extentOffset + ' name?')

      if (!name) {
        baseOffset = 0
        extentOffset = 0
        el.highlightParagraph.innerHTML = ''
        return
      }

      const newCaption = {
        id: state.captions[state.currentIndex].reduce((max, caption) => Math.max(max, caption.id), 0) + 1,
        name,
        startIndex: baseOffset,
        endIndex: extentOffset
      }

      if (!state.captions[state.currentIndex]) state.captions[state.currentIndex] = []

      state.captions[state.currentIndex].push(newCaption)
      localstorage.set('captions', state.captions)

      clear()
      drawAllCaptions()
      list.render()
    } else {
      baseOffset = 0
      extentOffset = 0
      clear()
      drawAllCaptions()
      list.render()
    }
  })
}

function clear () {
  el.highlightParagraph.innerHTML = ''

  Array.from(document.querySelectorAll('#viewer #text p'))
    .slice(2)
    .forEach(paragraph => paragraph.parentNode.removeChild(paragraph))

  Array.from(document.querySelectorAll('#viewer #labels div'))
    .forEach(label => label.parentNode.removeChild(label))
}

function drawAllCaptions () {
  const viewer = document.querySelector('#viewer #text')
  const labels = document.querySelector('#viewer #labels')

  const captions = state.captions[state.currentIndex]
  const originalText = state.files[state.currentIndex]

  if (!captions || captions.filter(caption => !caption.general).length < 1) return

  const paragraphHighlights = captions
    .filter(caption => !caption.general)
    .map(caption => {
      const paragraph = document.createElement('p')
      const hue = (caption.id * 0.05 + (caption.id % 2 ? 0.4 : 0)) % 1
      const color = hslToRgb(hue, 1, 0.5)

      paragraph.innerHTML = `
        ${originalText.slice(0, caption.startIndex)}
        <span style='background-color: ${color}'>${originalText.slice(caption.startIndex, caption.endIndex)}</span>
      `.split('\\n').join('<br/><br/>')

      viewer.appendChild(paragraph)

      const highlightBBox = paragraph.querySelector('span').getClientRects()[0]
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop

      return {
        id: caption.id,
        name: caption.name,
        x: highlightBBox.x,
        y: highlightBBox.y + scrollTop
      }
    })

  paragraphHighlights.forEach(caption => {
    const hue = (caption.id * 0.05 + (caption.id % 2 ? 0.4 : 0)) % 1
    const color = hslToRgb(hue, 1, 0.5)

    const label = document.createElement('div')
    label.innerText = caption.name
    label.className = 'label'
    label.style.position = 'absolute'
    label.style.left = caption.x
    label.style.top = caption.y
    label.style.backgroundColor = color
    label.style.transform = 'translate(0, -100%)'
    labels.appendChild(label)
  })
}

function updateData () {
  originalText = state.files[state.currentIndex]
  const text = originalText.split('\\n').join('<br/><br/>')
  el.textParagraph.innerHTML = text
  el.highlightParagraph.innerHTML = text
}

export default { drawAllCaptions, init, clear, updateData }
