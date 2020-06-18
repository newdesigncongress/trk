
function taskCreate () {
  let panelIndex = 0
  const panelIds = ['general', 'assignees', 'instructions', 'preview']
  const panels = {}

  const dropArea = document.getElementById('file-drop')
  const addAssigneeButton = document.getElementById('assignees-add')

  init()

  function init () {
    panelIds.forEach((id, i) => {
      const container = document.getElementById(id)
      const backButton = document.getElementById(`back-${id}`)
      const nextButton = document.getElementById(`next-${id}`)

      if (i > 0) {
        container.className = 'panel hidden'
      }

      if (i === 0) {
        backButton.className = 'hidden'
      }

      if (i === panelIds.length - 1) {
        nextButton.className = 'hidden'
      }

      backButton.addEventListener('click', onBack)
      nextButton.addEventListener('click', onNext)

      panels[id] = {
        container,
        backButton,
        nextButton
      }
    })

    window.addEventListener('beforeunload', confirmBeforeLeavingPage)
    document.getElementById('submit-button').addEventListener('click', () => {
      window.removeEventListener('beforeunload', confirmBeforeLeavingPage)
    })
    document.getElementById('assignees-add').addEventListener('click', addAssignee)
    document.getElementById('warning-yes').addEventListener('click', addContentWarning)
    document.getElementById('warning-no').addEventListener('click', removeContentWarning)
    document.querySelector('input[name="limit"]').addEventListener('change', constrainTaskLimit)
    Array.from(document.querySelectorAll('input[name="type"]')).forEach(radio => radio.addEventListener('change', updateFileUpload))

    if (navigator.userAgent.indexOf('Chrome') === -1 && navigator.userAgent.indexOf('Firefox') === -1) {
      document.getElementById('browser-warning').innerText = 'Note: this prototype was tested on Chrome and Firefox. Please try one of those two browsers if you encounter any issue.'
    }

    ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, preventDefaults, false)
    })

    ;['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, highlightDropArea, false)
    })

    ;['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, unhighlightDropArea, false)
    })

    dropArea.addEventListener('drop', handleDrop, false)

    initializeAssigneeInput()

    window.handleUpload = handleUpload.bind(this)
    window.clearPreview = clearPreview.bind(this)
  }

  function updateFileUpload (e) {
    const type = Array.from(document.querySelectorAll('input[name="type"]')).find(radio => radio.checked).value

    Array.from(dropArea.querySelectorAll('span')).forEach(span => {
      span.style.display = span.className.split('-')[0] === type ? 'inline' : 'none'
    })

    const input = document.querySelector('input[type="file"]')
    input.value = null
    input.setAttribute('accept', type === 'image' ? 'image/jpg, image/png' : 'text/csv')
    if (type === 'image') {
      input.setAttribute('multiple', true)
    } else {
      input.removeAttribute('multiple')
    }

    clearPreview()
  }

  function constrainTaskLimit (e) {
    const type = Array.from(document.querySelectorAll('input[name="type"]')).find(radio => radio.checked).value
    const files = document.querySelector('input[type="file"]').files
    if (type === 'text') {
      const reader = new window.FileReader()
      reader.addEventListener('load', event => {
        const contents = event.target.result
        const lines = contents.split('\n')
        e.target.value = Math.max(Math.min(e.target.value, lines.length), 0)
      })
      reader.readAsText(files[0])
    } else {
      e.target.value = Math.max(Math.min(e.target.value, files.length), 0)
    }
  }

  function handleDrop (e) {
    let dt = e.dataTransfer
    clearPreview()

    if (Array.from(dt.files).reduce((totalSize, file) => totalSize + file.size, 0) > 10000000) {
      document.getElementById('upload-error').innerText = 'The sum of all uploaded images should be less than 100mb.'
      document.querySelector('input[type="file"]').files = null
      return null
    }

    processFiles(dt.files, 0, (validFiles) => {
      document.querySelector('input[type="file"]').files = validFiles
    })
  }

  function handleUpload (files) {
    if (Array.from(files).reduce((totalSize, file) => totalSize + file.size, 0) > 10000000) {
      document.getElementById('upload-error').innerText = 'The sum of all uploaded images should be less than 100mb.'
      document.querySelector('input[type="file"]').files = null
      return null
    }

    processFiles(files, 0, (validFiles) => {
      document.querySelector('input[type="file"]').files = validFiles
    })
  }

  function processFiles (files, id, callback) {
    const file = files[id]

    if (!file) {
      return callback(files)
    }

    if (file.type.split('/')[0] === 'text') {
      if (file.size > 20000000) {
        document.getElementById('upload-error').innerText = 'CSV file is too large (max 20mb).'
        return callback(null)
      }

      const reader = new window.FileReader()
      reader.addEventListener('load', event => {
        const contents = event.target.result
        const paragraphs = contents
          .split('\n')
          .map(paragraph => `<p>${paragraph}</p>`)
          .join('\n')

        if (paragraphs.split('\n').length > 10000) {
          document.getElementById('upload-error').innerText = 'CSV file has too many rows (10,000 max).'
          return callback(null)
        }

        const preview = document.createElement('div')
        preview.className = 'text-preview'
        preview.innerHTML = paragraphs
        document.getElementById('gallery').appendChild(preview)

        return callback(files)
      })

      reader.readAsText(file)
    } else {
      if (file.size > 8000000) {
        document.getElementById('upload-error').innerText = 'Some images are too large (8mb max)'
        return callback(null)
      }

      const reader = new window.FileReader()
      reader.readAsDataURL(file)
      reader.onloadend = () => {
        let img = document.createElement('img')
        img.addEventListener('load', () => {
          console.log(img.width, img.height)
          if (img.width > 800 || img.height > 800) {
            document.getElementById('upload-error').innerText = 'Some images are larger/taller than 800px.'
            return callback(null)
          } else {
            document.getElementById('gallery').appendChild(img)
            return processFiles(files, id + 1, callback)
          }
        })
        img.src = reader.result
      }
    }
  }

  function highlightDropArea (e) {
    dropArea.classList.add('highlight')
  }

  function unhighlightDropArea (e) {
    dropArea.classList.remove('highlight')
  }

  function preventDefaults (e) {
    e.preventDefault()
    e.stopPropagation()
  }

  function clearPreview () {
    document.getElementById('upload-error').innerText = ''
    document.getElementById('gallery').innerHTML = ''
  }

  function addContentWarning () {
    document.getElementById('warning-yes').className = 'button inline focused'
    document.getElementById('warning-no').className = 'button inline'
    document.getElementById('content-warning').className = 'section'
  }

  function removeContentWarning () {
    document.getElementById('warning-yes').className = 'button inline'
    document.getElementById('warning-no').className = 'button inline focused'
    document.getElementById('content-warning').className = 'section hidden'
    document.querySelector('#content-warning textarea').value = ''
  }

  function onBack () {
    panelIndex = Math.max(0, panelIndex - 1)
    updatePanels()
  }

  function onNext () {
    const currentPanelId = panelIds[panelIndex]
    validatePanelInput(currentPanelId, (errors) => {
      if (errors) {
        const paragraphs = errors
          .map(error => `<p>${error}</p>`)
          .join('\n')
        document.getElementById(currentPanelId).querySelector('.errors').innerHTML = paragraphs
        return
      }

      document.getElementById(currentPanelId).querySelector('.errors').innerHTML = ''

      panelIndex = Math.min(panelIds.length - 1, panelIndex + 1)
      Array.from(document.querySelectorAll('h2.project-name'))
        .forEach(title => {
          title.innerText = document.querySelector('input[name="title"]').value
        })

      if (panelIds[panelIndex] === 'preview') {
        initializePreview()
      }

      updatePanels()
    })
  }

  function validatePanelInput (id, callback) {
    const errors = []

    if (id === 'general') {
      const type = Array.from(document.querySelectorAll('input[name="type"]')).find(radio => radio.checked).value
      const files = document.querySelector('input[type="file"]').files
      const title = document.querySelector('input[name="title"]').value
      const description = document.querySelector('textarea[name="description"]').value

      if (!files.length) {
        errors.push('At least one file must be uploaded.')
      }

      if (files.length > 1 && type === 'text') {
        errors.push('Text mode only takes one *.csv file, which contains each text sample on a different row.')
      }

      if (!title || title.length > 60) {
        errors.push('Title required (60 characters max).')
      }

      if (!description || description.length > 1000) {
        errors.push('Description required (1000 characters max).')
      }

      const imagesTooLarge = Array.from(files).some(file => file.size > 8000000)
      if (imagesTooLarge) {
        errors.push('Some images are too large (max 8mb).')
      }

      const totalTooLarge = Array.from(files).reduce((total, file) => total + file.size, 0) > 100000000
      if (totalTooLarge) {
        errors.push('The sum of all uploaded images should be less than 100mb.')
      }

      if (type === 'image' && files.length > 0) {
        const checkImageSize = function (files) {
          const reader = new window.FileReader()
          reader.readAsDataURL(files[0])
          reader.onloadend = () => {
            let img = document.createElement('img')
            img.addEventListener('load', () => {
              if (img.width > 800 || img.height > 800) {
                errors.push('Some images are larger/taller than 800px.')
                return callback(errors)
              }

              if (files.length > 1) {
                checkImageSize(files.slice(1))
              } else {
                return callback(!errors.length ? null : errors)
              }
            })
            img.src = reader.result
          }
        }

        checkImageSize(Array.from(files))
      } else {
        return callback(!errors.length ? null : errors)
      }
    } else if (id === 'assignees') {
      const type = Array.from(document.querySelectorAll('input[name="type"]')).find(radio => radio.checked).value
      const emailInputs = document.querySelectorAll('#assignees #emails li input')
      const EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/
      const invalidEmails = Array.from(emailInputs).some(email => email.value && !email.value.match(EMAIL_REGEXP))
      const files = document.querySelector('input[type="file"]').files
      const limit = parseInt(document.querySelector('input[name="limit"]').value) || 0
      const taskPrice = parseFloat(document.querySelector('input[name="price"]').value) || 0.1

      if (invalidEmails) {
        errors.push('At least one email address is invalid.')
      }

      if (taskPrice <= 0 || Number.isNaN(taskPrice)) {
        errors.push('Task price is invalid.')
      }

      if (type === 'image' || !limit) {
        const taskCount = limit || files.length
        if (Number.isNaN(taskCount) || taskCount <= 0 || taskCount > files.length) {
          errors.push('Task limit is invalid.')
        }

        return callback(!errors.length ? null : errors)
      } else {
        const reader = new window.FileReader()
        reader.addEventListener('load', event => {
          const contents = event.target.result
          const taskCount = contents.split('\n').length

          if (Number.isNaN(taskCount) || taskCount <= 0 || limit > taskCount) {
            errors.push('Task limit is invalid.')
          }

          return callback(!errors.length ? null : errors)
        })
        reader.readAsText(files[0])
      }
    } else if (id === 'instructions') {
      const instructions = document.querySelector('textarea[name="instructions"]').value
      const ingredients = Array.from(document.querySelectorAll('#ingredients input')).map(ingredient => ingredient.value)

      if (instructions.length > 1000) {
        errors.push('Instructions too long (1000 characters max).')
      }

      const ingredientsTooLong = ingredients.some(ingredient => ingredient.length > 100)
      if (ingredientsTooLong) {
        errors.push('Data ingredients too long (100 characters max each).')
      }

      return callback(!errors.length ? null : errors)
    }
  }

  function updatePanels () {
    panelIds.forEach((id, i) => {
      if (i === panelIndex) {
        panels[id].container.className = 'panel'
      } else {
        panels[id].container.className = 'panel hidden'
      }
    })
  }

  function initializePreview () {
    const container = document.getElementById('preview-content')
    const title = document.querySelector('input[name="title"]').value
    const type = Array.from(document.querySelectorAll('input[name="type"]')).find(radio => radio.checked).value
    const taskPrice = parseFloat(document.querySelector('input[name="price"]').value) || '0.10'
    const warning = document.querySelector('textarea[name="warning"]').value
    const files = document.querySelector('input[type="file"]').files
    const limit = parseInt(document.querySelector('input[name="limit"]').value)

    if (type === 'image' || limit) {
      const taskCount = limit || files.length
      renderPreview(container, title, taskCount, type, taskPrice, warning)
    } else {
      const reader = new window.FileReader()
      reader.addEventListener('load', event => {
        const contents = event.target.result
        const taskCount = contents.split('\n').length
        renderPreview(container, title, taskCount, type, taskPrice, warning)
      })
      reader.readAsText(files[0])
    }
  }

  function renderPreview (container, title, taskCount, type, taskPrice, warning) {
    container.innerHTML = `
      <h2>
        ${title}
      </h2>
      
      <p>
        Hi! You got a link to be a collaborator on a project, which consists of tagging ${taskCount} ${type === 'image' ? 'images' : 'text samples'}. Each task is priced at $${taskPrice}.
      </p>

      ${!warning ? '' : `<div id="warning">
          Content Warning:
          ${warning}
        </div>`}

      <div class="button wide inactive">preview task</div>
      <div class="button wide inactive">accept project</div>
    `
  }

  function initializeAssigneeInput () {
    const assigneeContainer = document.querySelector('#assignees li')
    const emailInput = assigneeContainer.querySelector('#emails input')

    emailInput.addEventListener('input', () => {
      const value = emailInput.value
      if (value) {
        emailInput.className = ''
        addAssigneeButton.className = 'button wide'
      } else {
        emailInput.className = 'empty'
        addAssigneeButton.className = 'button wide inactive'
      }
    })
  }

  function addAssignee () {
    const assigneeContainer = document.createElement('li')
    const assigneeIndex = Array
      .from(document.querySelectorAll('#emails input'))
      .filter(input => input.getAttribute('name').indexOf('assignee_email_') > -1)
      .length

    assigneeContainer.innerHTML = `
      <input class='empty' name='assignee_email_${assigneeIndex}' type='text' placeholder='email address'/>
    `

    panels['assignees'].container.querySelector('ul').append(assigneeContainer)

    const emailInput = assigneeContainer.querySelector('input')

    emailInput.addEventListener('input', () => {
      const value = emailInput.value
      if (value) {
        emailInput.className = ''
        addAssigneeButton.className = 'button wide'
      } else {
        emailInput.className = 'empty'
        addAssigneeButton.className = 'button wide inactive'
      }
    })

    addAssigneeButton.className = 'button wide inactive'
  }

  function confirmBeforeLeavingPage (event) {
    event.preventDefault()
    event.returnValue = ''
  }
}

taskCreate()
