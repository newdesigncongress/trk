
function task () {
  const assigneeList = document.querySelector('#assignees ul')
  const addAssigneeButton = document.getElementById('assignees-add')
  const assigneeSaveButton = document.getElementById('assignees-submit')
  const exportDataButton = document.getElementById('export-data')

  init()

  function init () {
    assigneeSaveButton.className = 'button wide inactive'
    addAssigneeButton.addEventListener('click', addAssignee)
    exportDataButton.addEventListener('click', exportData)
    initializeAssigneeInput()
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

      assigneeSaveButton.className = Array
        .from(document.querySelectorAll('#assignees ul li input'))
        .some(input => input.value) ? 'button wide' : 'button wide inactive'
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

    assigneeList.append(assigneeContainer)

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

      assigneeSaveButton.className = Array
        .from(document.querySelectorAll('#assignees ul li input'))
        .some(input => input.value) ? 'button wide' : 'button wide inactive'
    })

    addAssigneeButton.className = 'button wide inactive'
  }

  function exportData () {
    const xhr = new window.XMLHttpRequest()

    xhr.addEventListener('load', () => {
      const d = Date.now()
      download(`${taskId}-data-${d}.json`, xhr.responseText)
    })

    xhr.open('GET', `${taskId}/data`)
    xhr.send()
  }

  function download (filename, text) {
    var element = document.createElement('a')
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
    element.setAttribute('download', filename)

    element.style.display = 'none'
    document.body.appendChild(element)

    element.click()

    document.body.removeChild(element)
  }
}

task()
