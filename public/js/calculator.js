
let focusedHandle = null
let mouseDownHandleX = 0
let mouseDownCursorX = 0
let interactionStarted = false

const calculatorPanel = document.getElementById('calculator-panel')
const methodologyPanel = document.getElementById('methodology-panel')
const processPanel = document.getElementById('process-panel')
const sliders = Array.from(document.querySelectorAll('.slider'))
const handles = Array.from(document.querySelectorAll('.handle'))
const results = document.getElementById('results')

const ranges = {
  total: {
    origin: 0.3365,
    min: 1,
    max: 100000,
    transform: (a) => Math.round(a),
    format: (a) => {
      if (a < 1000) return `${a}`
      else if (a < 10000) return `${Math.round(a / 100) / 10}k`
      else return `${Math.round(a / 1000)}k`
    }
  },
  rate: {
    origin: 0.2,
    min: 0,
    max: 10,
    transform: (a) => Math.round(a * 100) / 100,
    format: (a) => a
  },
  time: {
    origin: 0.15,
    min: 0,
    max: 3600,
    transform: (a) => Math.round(a),
    format: (a) => {
      if (a < 60) return `${Math.round(a)}sec`
      else if (a < 3600) return `${Math.round(a / 60)}min`
      return `${Math.round(a / 3600)}hour`
    }
  }
}

function init () {
  handles.forEach(handle => {
    const id = handle.parentNode.parentNode.id.split('-')[1]
    handle.style.left = `${ranges[id].origin * 100}%`

    handle.addEventListener('mousedown', (event) => {
      interactionStarted = true
      focusedHandle = handle
      const width = handle.parentNode.getBoundingClientRect().width
      mouseDownHandleX = map(handle.offsetLeft, 0, width, 0, 1)
      mouseDownCursorX = event.screenX
    })
  })

  updateLabels()
  updatePanel()

  window.addEventListener('hashchange', updatePanel)

  document.addEventListener('mouseup', (event) => {
    focusedHandle = null

    window.requestAnimationFrame(() => {
      const inputs = sliders.map(slider => {
        const id = slider.parentNode.id.split('-')[1]
        const handle = slider.querySelector('.handle')
        const width = slider.getBoundingClientRect().width
        const handleX = map(handle.offsetLeft, 0, width, 0, 1)
        const alpha = map(expoIn(handleX), 0, 1, ranges[id].min, ranges[id].max)
        return ranges[id].transform(alpha)
      })

      if (interactionStarted) {
        updateResults(...inputs)
      }
    })
  })

  sliders.forEach(slider => {
    slider.addEventListener('click', (event) => {
      interactionStarted = true
      if (event.target === slider) {
        const handle = slider.querySelector('.handle')
        const width = slider.getBoundingClientRect().width
        const handleX = map(event.offsetX, 0, width, 0, 1)
        handle.style.left = `${handleX * 100}%`
        handle.style.transition = 'left 0.15s'
        updateLabels(slider, handleX * width)
        window.setTimeout(() => {
          handle.style.transition = null
        }, 150)
      }
    })
  })

  document.addEventListener('mousemove', (event) => {
    if (focusedHandle) {
      const width = focusedHandle.parentNode.getBoundingClientRect().width
      const offsetX = map(event.screenX - mouseDownCursorX, -width / 2, width / 2, -0.5, 0.5)
      const handleX = constrain(mouseDownHandleX + offsetX, 0, 1)
      focusedHandle.style.left = `${handleX * 100}%`
      updateLabels()
    }
  })
}

function updatePanel () {
  switch (window.location.hash) {
    case '#process':
      calculatorPanel.className = 'panel-hidden'
      methodologyPanel.className = 'panel-hidden'
      processPanel.className = ''
      document.title = 'TRK - Process'
      break
    case '#methodology':
      calculatorPanel.className = 'panel-hidden'
      methodologyPanel.className = ''
      processPanel.className = 'panel-hidden'
      document.title = 'TRK - Methodology'
      break
    case '#calculator':
      calculatorPanel.className = ''
      methodologyPanel.className = 'panel-hidden'
      processPanel.className = 'panel-hidden'
      document.title = 'TRK - Wage Calculator'
      break
    default:
      calculatorPanel.className = ''
      methodologyPanel.className = 'panel-hidden'
      processPanel.className = 'panel-hidden'
      document.title = 'TRK - Wage Calculator'
      break
  }

  const wrapper = document.getElementById('wrapper')
  if (wrapper.className === 'navigation-open') {
    wrapper.className = ''
  }
}

function updateLabels (focusedSlider, value) {
  sliders
    .filter(slider => !focusedSlider || slider === focusedSlider)
    .forEach(slider => {
      const id = slider.parentNode.id.split('-')[1]
      const label = slider.parentNode.querySelector('.label span')
      const handle = slider.querySelector('.handle')
      const width = slider.getBoundingClientRect().width
      const handleX = map(value || handle.offsetLeft, 0, width, 0, 1)
      const alpha = map(expoIn(handleX), 0, 1, ranges[id].min, ranges[id].max)
      label.innerText = ranges[id].format(ranges[id].transform(alpha))
    })
}

function updateResults (total, rate, time) {
  results.style.opacity = 1

  total = ranges.total.format(ranges.total.transform(total))
  total = parseFloat(total) * (total.indexOf('k') > -1 ? 1000 : 1)
  const taskPerHour = 3600 / time
  const hourlyRate = taskPerHour * rate
  const dailyRate = hourlyRate * 6.5
  const washingtonMinimumWage = 12 * 6.5
  const washingtonLivingWage = 127.4
  const totalTime = time * total
  const totalPrice = Math.round(total * rate * 100) / 100

  let totalTimeString = totalTime
  if (totalTimeString >= 3600) totalTimeString = `${Math.round(totalTimeString / 360) / 10} hours`
  else if (totalTimeString >= 60) totalTimeString = `${Math.round(totalTimeString / 60)} minutes`
  else totalTimeString = `${totalTimeString} seconds`

  if (time < 20) {
    results.querySelector('h2').innerText = 'This is an impossible task'
    results.querySelector('#duration').innerText = `It takes much longer to label images, and sign up to work. This setup calculates that someone can label ${Math.round(taskPerHour)} images in an hour and work ${totalTimeString} to fulfill all of these tasks, for a total of ${totalPrice} dollars. Set the tasks longer for an accurate breakdown of work.`
    results.querySelector('#wage').innerText = `Priced at ${rate} per task has someone making only $${Math.round(dailyRate * 10) / 10} per day. This is below the minimum wage in Washington.`
    results.className = 'unsafe'
  } else {
    if (dailyRate < washingtonMinimumWage) {
      results.querySelector('h2').innerText = 'This is priced below minimum wage'
      results.querySelector('#duration').innerText = `This setup calculates that someone can label ${Math.round(taskPerHour)} images in an hour and work ${totalTimeString} to fulfill all of these tasks, for a total of ${totalPrice} dollars.`
      results.querySelector('#wage').innerText = `Priced at ${rate} per task has someone making only $${Math.round(dailyRate * 10) / 10} per day. This is below the minimum wage in Washington.`
      results.className = 'unsafe'
    } else if (dailyRate < washingtonLivingWage) {
      results.querySelector('h2').innerText = 'This is priced below a living wage'
      results.querySelector('#duration').innerText = `This setup calculates that someone can label ${Math.round(taskPerHour)} images in an hour and work ${totalTimeString} to fulfill all of these tasks, for a total of ${totalPrice} dollars.`
      results.querySelector('#wage').innerText = `Priced at ${rate} per task has someone making only $${Math.round(dailyRate * 10) / 10} per day. This is below a living wage in Washington.`
      results.className = 'unsafe'
    } else {
      results.querySelector('h2').innerText = 'This is priced above a living wage'
      results.querySelector('#duration').innerText = `This setup calculates that someone can label ${Math.round(taskPerHour)} images in an hour and work ${totalTimeString} to fulfill all of these tasks, for a total of ${totalPrice} dollars.`
      results.querySelector('#wage').innerText = `Priced at ${rate} per task has someone making $${Math.round(dailyRate * 10) / 10} per day. This is above a living wage in Washington.`
      results.className = 'safe'
    }
  }
}

function map (n, start1, stop1, start2, stop2) {
  return (n - start1) / (stop1 - start1) * (stop2 - start2) + start2
}

function constrain (f, min, max) {
  return Math.max(Math.min(f, max), min)
}

function expoIn (t) {
  return t === 0.0 ? t : Math.pow(2.0, 10.0 * (t - 1.0))
}

init()
