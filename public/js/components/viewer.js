
import state from '../state.js'
import localstorage from '../lib/localstorage.js'
import { map, hslToRgb } from '../lib/utils.js'
import list from './list.js'

const el = {}
let ctx = null

function init () {
  el.canvas = document.querySelector('#viewer canvas')
  el.image = document.querySelector('#viewer img')
  ctx = el.canvas.getContext('2d')

  const img = new window.Image()
  img.addEventListener('load', () => {
    state.currentImageDimensions = [img.width, img.height]
    el.image.addEventListener('load', () => {
      const {
        width,
        height
      } = el.image.getBoundingClientRect()

      scale(el.canvas, ctx, Math.ceil(width), Math.ceil(height))
      drawAllCaptions()
      list.render()
    })
    el.image.src = `/images/${task_id}/${state.files[state.currentIndex]}`
  })
  img.src = `/images/${task_id}/${state.files[state.currentIndex]}`

  window.addEventListener('keydown', (e) => {
    if (state.mouseIsDown && (e.key.toLowerCase() === 'escape' || e.code.toLowerCase() === 'escape')) {
      resetStateFlags()
      clear()
      drawAllCaptions()
    }
  })

  el.canvas.addEventListener('mousedown', function (e) {
    dragStart({
      x: parseInt(e.layerX - el.canvas.offsetLeft),
      y: parseInt(e.layerY - el.canvas.offsetTop)
    })
  })

  el.canvas.addEventListener('mousemove', function (e) {
    // if user didn't click on <canvas> before moving mouse, exit function
    if (!state.mouseIsDown) return

    drag({
      x: parseInt(e.layerX - el.canvas.offsetLeft),
      y: parseInt(e.layerY - el.canvas.offsetTop)
    })
  })

  el.canvas.addEventListener('mouseup', function () {
    // if user didn't move mouse while clicking on <canvas>, exit function
    if (!state.mouseHasMovedSinceMouseDown) return
    dragEnd()
  })
}

// clear <canvas>
function clear () {
  ctx.clearRect(0, 0, el.canvas.clientWidth, el.canvas.clientHeight)
}

// draw one caption on <canvas>
function drawCaption (caption) {
  const hue = (caption.id * 0.05 + (caption.id % 2 ? 0.4 : 0)) % 1
  ctx.strokeStyle = hslToRgb(hue, 1, 0.5)
  ctx.lineWidth = 3
  ctx.strokeRect(
    caption.x,
    caption.y,
    caption.width,
    caption.height
  )
}

// draw all captions from `state.captions` on <canvas>
function drawAllCaptions () {
  const captions = state.captions[state.currentIndex]
  if (!captions || captions.length < 1) return

  captions.forEach(caption => {
    const hue = (caption.id * 0.05 + (caption.id % 2 ? 0.4 : 0)) % 1

    const [
      originalWidth,
      originalHeight
    ] = state.currentImageDimensions

    const {
      width,
      height
    } = el.image.getBoundingClientRect()

    // map dimensions relative to original image size
    const x = map(caption.x, 0, originalWidth, 0, width)
    const y = map(caption.y, 0, originalHeight, 0, height)
    const w = map(caption.width, 0, originalWidth, 0, width)
    const h = map(caption.height, 0, originalHeight, 0, height)

    ctx.strokeStyle = hslToRgb(hue, 1, 0.5)
    ctx.lineWidth = 3
    ctx.strokeRect(
      x,
      y,
      w,
      h
    )

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.fillRect(
      x,
      y,
      w,
      h
    )

    ctx.fillStyle = hslToRgb(hue, 1, 0.5)
    ctx.fillRect(
      x - 2,
      y - 20,
      15 + (caption.name.length * 7),
      20
    )

    ctx.fillStyle = 'black'
    ctx.font = '12px Monaco'
    ctx.fillText(caption.name, x + 5, y - 6)
  })
}

function scale (canvas, ctx, width, height) {
  // assume the device pixel ratio is 1 if the browser doesn't specify it
  const devicePixelRatio = window.devicePixelRatio || 1

  // determine the 'backing store ratio' of the canvas ctx
  const backingStoreRatio = (
    ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio || 1
  )

  // determine the actual ratio we want to draw at
  const ratio = devicePixelRatio / backingStoreRatio

  if (devicePixelRatio !== backingStoreRatio) {
    // set the 'real' canvas size to the higher width/height
    canvas.width = width * ratio
    canvas.height = height * ratio

    // then scale it back down with CSS
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
  } else {
    // this is a normal 1:1 device; just scale it simply
    canvas.width = width
    canvas.height = height
    canvas.style.width = ''
    canvas.style.height = ''
  }

  // scale the drawing ctx so everything will work at the higher ratio
  ctx.scale(ratio, ratio)
}

function updateData () {
  const img = new window.Image()
  img.addEventListener('load', () => {
    state.currentImageDimensions = [img.width, img.height]
    el.image.src = `/images/${task_id}/${state.files[state.currentIndex]}`
  })
  img.src = `/images/${task_id}/${state.files[state.currentIndex]}`
}

function dragStart (coordinates) {
  // set state flags
  state.mouseIsDown = true
  state.mouseDownStartPosition = coordinates
}

function drag (coordinates) {
  // set state flag
  if (!state.mouseHasMovedSinceMouseDown) {
    state.mouseHasMovedSinceMouseDown = true
  }

  // set current mouse position in state
  state.mouseCurrentPosition = coordinates

  // clear viewer
  clear()

  // draw existing caption boxes
  drawAllCaptions()

  // draw in-progress caption box
  drawCaption({
    id: state.captions[state.currentIndex].reduce((max, caption) => Math.max(max, caption.id), 0) + 1,
    x: state.mouseDownStartPosition.x,
    y: state.mouseDownStartPosition.y,
    width: state.mouseCurrentPosition.x - state.mouseDownStartPosition.x,
    height: state.mouseCurrentPosition.y - state.mouseDownStartPosition.y
  })
}

function dragEnd () {
  // ask user for name of caption
  const name = window.prompt('name?')

  // if prompt is cancelled or no name is supplied, roll it back
  if (!name || name.length < 1) {
    clear()
    drawAllCaptions()

    return resetStateFlags()
  }

  const [
    originalWidth,
    originalHeight
  ] = state.currentImageDimensions

  const {
    width,
    height
  } = el.image.getBoundingClientRect()

  // construct new caption, then push to state
  // dimensions are mapped relative to original image size
  let newCaption = {
    name: name,
    x: map(state.mouseDownStartPosition.x, 0, width, 0, originalWidth),
    y: map(state.mouseDownStartPosition.y, 0, height, 0, originalHeight),
    width: map(state.mouseCurrentPosition.x - state.mouseDownStartPosition.x, 0, width, 0, originalWidth),
    height: map(state.mouseCurrentPosition.y - state.mouseDownStartPosition.y, 0, height, 0, originalHeight),
    id: state.captions[state.currentIndex].reduce((max, caption) => Math.max(max, caption.id), 0) + 1
  }

  // adjust coordinates if width is a negative number
  if (Math.sign(newCaption.width) === -1) {
    newCaption.width = Math.abs(newCaption.width)
    newCaption.x -= newCaption.width
  }

  if (!state.captions[state.currentIndex]) state.captions[state.currentIndex] = []

  state.captions[state.currentIndex].push(newCaption)
  localstorage.set('captions', state.captions)

  clear()
  drawAllCaptions()
  list.render()
  return resetStateFlags()
}

function resetStateFlags () {
  state.mouseIsDown = false
  state.mouseDownStartPosition = null
  state.mouseCurrentPosition = null
  state.mouseHasMovedSinceMouseDown = false
}

export default { clear, drawCaption, drawAllCaptions, init, updateData }
