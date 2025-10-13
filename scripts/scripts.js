/* Task Tracker - script.js
   Author: Rachel Ukpabi
   Course: CSE 310 - Applied Programming
   Features: add/edit/delete/complete/sort tasks + optional localStorage persistence
*/

// ------- Data model & persistence -------
/**
 * @typedef {Object} Task
 * @property {string} id - unique ID
 * @property {string} title - task title
 * @property {string|null} due - due date in YYYY-MM-DD or null
 * @property {string} priority - 'low'|'medium'|'high'
 * @property {boolean} completed - true if completed
 * @property {number} createdAt - epoch ms when created
 */

/** Key used in localStorage */
const STORAGE_KEY = 'taskTracker.tasks.v1';

/** In-memory array of Task objects */
let tasks = [];

/** Currently edited task id (null if adding new) */
let editId = null;

/**
 * Load tasks from localStorage if present. If none, use empty array.
 * This enables simple persistence across page reloads.
 */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error('Failed to load tasks:', err);
    return [];
  }
}

/**
 * Save current tasks array to localStorage.
 */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save tasks:', err);
  }
}

/**
 * Generate a compact unique ID for tasks
 * @returns {string}
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ------- DOM helpers & rendering -------
const el = selector => document.querySelector(selector);
const els = selector => Array.from(document.querySelectorAll(selector));

const taskListEl = el('#task-list');
const emptyMsgEl = el('#empty-msg');
const form = el('#task-form');
const nameInput = el('#task-name');
const dueInput = el('#task-due');
const prioritySelect = el('#task-priority');
const addBtn = el('#add-btn');
const updateBtn = el('#update-btn');
const cancelEditBtn = el('#cancel-edit-btn');
const sortSelect = el('#sort-select');
const clearCompletedBtn = el('#clear-completed-btn');
const exportBtn = el('#export-btn');
const clearStorageBtn = el('#clear-storage-btn');

/**
 * Create a DOM element with attributes and children
 */
function createEl(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (let k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  children.forEach(c => {
    if (typeof c === 'string') n.appendChild(document.createTextNode(c));
    else n.appendChild(c);
  });
  return n;
}

/**
 * Render the list of tasks to the page, based on current sort selection.
 */
function renderTasks() {
  // clear
  taskListEl.innerHTML = '';

  if (!tasks.length) {
    emptyMsgEl.style.display = 'block';
    return;
  } else {
    emptyMsgEl.style.display = 'none';
  }

  // determine sort
  const sortBy = sortSelect.value;
  const list = Array.from(tasks);

  if (sortBy === 'priority') {
    const priOrder = { high: 0, medium: 1, low: 2 };
    list.sort((a, b) => priOrder[a.priority] - priOrder[b.priority] || a.createdAt - b.createdAt);
  } else if (sortBy === 'due') {
    list.sort((a, b) => {
      if (!a.due && !b.due) return a.createdAt - b.createdAt;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });
  } else {
    list.sort((a, b) => a.createdAt - b.createdAt);
  }

  list.forEach(t => {
    const li = createEl('li', { class: 'task-card' });

    const left = createEl('div', { class: 'task-left' });

    const checkbox = createEl('div', { class: 'checkbox' });
    if (t.completed) checkbox.classList.add('checked');

    checkbox.addEventListener('click', () => {
      toggleComplete(t.id);
    });

    const meta = createEl('div', { class: 'task-meta' });
    const title = createEl('div', { class: 'task-title', text: t.title });
    const subParts = [];
    if (t.due) subParts.push(`Due: ${t.due}`);
    subParts.push(`Priority: ${capitalize(t.priority)}`);
    const subtitle = createEl('div', { class: 'task-sub', text: subParts.join(' • ') });

    meta.appendChild(title);
    meta.appendChild(subtitle);

    left.appendChild(checkbox);
    left.appendChild(meta);

    const controls = createEl('div', { class: 'controls' });

    const editBtn = createEl('button', { class: 'icon-btn', text: 'Edit' });
    editBtn.addEventListener('click', () => startEditTask(t.id));

    const delBtn = createEl('button', { class: 'icon-btn', text: 'Delete' });
    delBtn.addEventListener('click', () => deleteTask(t.id));

    controls.appendChild(editBtn);
    controls.appendChild(delBtn);

    if (t.completed) {
      title.style.textDecoration = 'line-through';
      title.style.opacity = '0.7';
    }

    li.appendChild(left);
    li.appendChild(controls);

    taskListEl.appendChild(li);
  });
}

// ------- Core operations -------
/**
 * Capitalize a string
 */
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/**
 * Add a new task to the list
 * @param {string} title
 * @param {string|null} due
 * @param {string} priority
 */
function addTask(title, due, priority) {
  const t = {
    id: uid(),
    title: title.trim(),
    due: due || null,
    priority,
    completed: false,
    createdAt: Date.now()
  };
  tasks.push(t);
  saveTasks();
  renderTasks();
}

/**
 * Start editing an existing task: populate form fields and toggle UI.
 * @param {string} id
 */
function startEditTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return alert('Task not found');
  editId = id;
  nameInput.value = t.title;
  dueInput.value = t.due || '';
  prioritySelect.value = t.priority;
  addBtn.hidden = true;
  updateBtn.hidden = false;
  cancelEditBtn.hidden = false;
}

/**
 * Cancel the edit operation and reset the form.
 */
function cancelEdit() {
  editId = null;
  form.reset();
  addBtn.hidden = false;
  updateBtn.hidden = true;
  cancelEditBtn.hidden = true;
}

/**
 * Update an existing task using form values.
 */
function updateTaskFromForm() {
  if (!editId) return;
  const t = tasks.find(x => x.id === editId);
  if (!t) return alert('Task not found');
  t.title = nameInput.value.trim();
  t.due = dueInput.value || null;
  t.priority = prioritySelect.value;
  saveTasks();
  cancelEdit();
  renderTasks();
}

/**
 * Delete a task by id after confirmation.
 * @param {string} id
 */
function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  tasks = tasks.filter(x => x.id !== id);
  saveTasks();
  renderTasks();
}

/**
 * Toggle completion state for a task.
 * @param {string} id
 */
function toggleComplete(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  saveTasks();
  renderTasks();
}

/**
 * Remove all completed tasks from the list.
 */
function clearCompleted() {
  if (!confirm('Remove all completed tasks?')) return;
  tasks = tasks.filter(x => !x.completed);
  saveTasks();
  renderTasks();
}

/**
 * Export tasks to the console in JSON form (for debugging or grading).
 */
function exportToConsole() {
  console.log('Exported tasks:', JSON.stringify(tasks, null, 2));
  alert('Tasks exported to console.');
}

/**
 * Remove all tasks & storage (dangerous)
 */
function clearAllStorage() {
  if (!confirm('Clear ALL tasks and storage?')) return;
  tasks = [];
  saveTasks();
  renderTasks();
}

// ------- Events & initialization -------
form.addEventListener('submit', e => {
  e.preventDefault();
  const title = nameInput.value;
  const due = dueInput.value || null;
  const priority = prioritySelect.value;
  if (!title.trim()) return alert('Please enter a task name.');
  if (editId) {
    updateTaskFromForm();
  } else {
    addTask(title, due, priority);
    form.reset();
  }
});

updateBtn.addEventListener('click', () => {
  updateTaskFromForm();
});

cancelEditBtn.addEventListener('click', cancelEdit);

function renderTasks() {
  taskListEl.innerHTML = '';

  if (!tasks.length) {
    emptyMsgEl.style.display = 'block';
    return;
  } else {
    emptyMsgEl.style.display = 'none';
  }

  // find which sort button is active
  const activeSortBtn = document.querySelector('.sort-btn.active');
  const sortBy = activeSortBtn ? activeSortBtn.dataset.sort : 'created';
  const list = Array.from(tasks);

  if (sortBy === 'priority') {
    const priOrder = { high: 0, medium: 1, low: 2 };
    list.sort((a, b) => priOrder[a.priority] - priOrder[b.priority] || a.createdAt - b.createdAt);
  } else if (sortBy === 'due') {
    list.sort((a, b) => {
      if (!a.due && !b.due) return a.createdAt - b.createdAt;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });
  } else {
    list.sort((a, b) => a.createdAt - b.createdAt);
  }

  list.forEach(t => {
    const li = createEl('li', { class: 'task-card' });
    const left = createEl('div', { class: 'task-left' });

    const checkbox = createEl('div', { class: 'checkbox' });
    if (t.completed) checkbox.classList.add('checked');
    checkbox.addEventListener('click', () => toggleComplete(t.id));

    const meta = createEl('div', { class: 'task-meta' });
    const title = createEl('div', { class: 'task-title', text: t.title });
    const subParts = [];
    if (t.due) subParts.push(`Due: ${t.due}`);
    subParts.push(`Priority: ${capitalize(t.priority)}`);
    const subtitle = createEl('div', { class: 'task-sub', text: subParts.join(' • ') });

    meta.appendChild(title);
    meta.appendChild(subtitle);
    left.appendChild(checkbox);
    left.appendChild(meta);

    const controls = createEl('div', { class: 'controls' });
    const editBtn = createEl('button', { class: 'icon-btn', text: 'Edit' });
    editBtn.addEventListener('click', () => startEditTask(t.id));
    const delBtn = createEl('button', { class: 'icon-btn', text: 'Delete' });
    delBtn.addEventListener('click', () => deleteTask(t.id));
    controls.appendChild(editBtn);
    controls.appendChild(delBtn);

    if (t.completed) {
      title.style.textDecoration = 'line-through';
      title.style.opacity = '0.7';
    }

    li.appendChild(left);
    li.appendChild(controls);
    taskListEl.appendChild(li);
  });
}

// attach listeners for the new sort buttons
els('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    els('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTasks();
  });
});


clearCompletedBtn.addEventListener('click', clearCompleted);
exportBtn.addEventListener('click', exportToConsole);
clearStorageBtn.addEventListener('click', clearAllStorage);

// Initialize
(function init() {
  tasks = loadTasks();
  renderTasks();
  // dev: seed sample if empty (comment out to keep pristine)
  // if (tasks.length === 0) seedSample();
})();

/**
 * Optional: seed sample tasks for initial testing (commented out by default)
 */
function seedSample() {
  addTask('Finish lab report', '2025-10-20', 'high');
  addTask('Grocery shopping', null, 'low');
  addTask('Prepare presentation', '2025-10-18', 'medium');
}



// ------- Theme Toggle Feature -------
const themeToggleBtn = document.getElementById('theme-toggle');

function setTheme(isLight) {
  if (isLight) {
    document.body.classList.add('light');
    themeToggleBtn.textContent = '🌞 Light Mode';
    localStorage.setItem('taskTracker.theme', 'light');
  } else {
    document.body.classList.remove('light');
    themeToggleBtn.textContent = '🌙 Dark Mode';
    localStorage.setItem('taskTracker.theme', 'dark');
  }
}

// Load saved theme preference
(function initTheme() {
  const savedTheme = localStorage.getItem('taskTracker.theme');
  setTheme(savedTheme === 'light');
})();

// Toggle on click
themeToggleBtn.addEventListener('click', () => {
  const isLight = !document.body.classList.contains('light');
  setTheme(isLight);
});

