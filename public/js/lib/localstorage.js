export default {get, set}

function get (key) {
  return JSON.parse(window.localStorage.getItem(`${user_id}-${task_id}-${assignment_id}-${key}`))
}

function set (key, data) {
  try {
    window.localStorage.setItem(`${user_id}-${task_id}-${assignment_id}-${key}`, JSON.stringify(data))
  } catch (err) {}
}
