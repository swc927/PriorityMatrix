// Priority Matrix by SWC
// Vanilla JavaScript. No dependencies.
// Features: CRUD tasks, drag and drop across quadrants, due filters, search, hide done, localStorage persistence, export or import.

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const STORAGE_KEY = "swc-priority-matrix-v1";

let state = {
  tasks: [],
  filters: {
    query: "",
    due: "all",
    hideDone: false
  }
};

// Utilities
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0,10);
const isThisWeek = dateStr => {
  if(!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const start = new Date(now);
  const mondayOffset = (now.getDay() + 6) % 7; // 0 if Monday, 6 if Sunday
  start.setHours(0,0,0,0);
  start.setDate(now.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
};
const isToday = dateStr => dateStr === todayISO();
const isOverdue = dateStr => dateStr && new Date(dateStr) < new Date(todayISO());

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && Array.isArray(parsed.tasks)){
        state = { ...state, ...parsed };
      }
    }
  }catch(e){
    console.warn("Failed to load", e);
  }
}

function createTask({title, notes="", dueDate="", quadrant="now", done=false}){
  const task = {
    id: uid(),
    title, notes, dueDate, quadrant, done,
    createdAt: new Date().toISOString()
  };
  state.tasks.push(task);
  save();
  return task;
}

function updateTask(id, patch){
  const i = state.tasks.findIndex(t => t.id === id);
  if(i >= 0){
    state.tasks[i] = { ...state.tasks[i], ...patch };
    save();
  }
}

function deleteTask(id){
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
}

function filteredTasks(){
  const q = state.filters.query.trim().toLowerCase();
  const due = state.filters.due;
  const hideDone = state.filters.hideDone;

  return state.tasks.filter(t => {
    const matchesQuery = !q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q);
    let matchesDue = true;
    if(due === "today") matchesDue = isToday(t.dueDate);
    if(due === "week") matchesDue = isThisWeek(t.dueDate);
    if(due === "overdue") matchesDue = isOverdue(t.dueDate);
    const matchesHide = !hideDone || !t.done;
    return matchesQuery && matchesDue && matchesHide;
  });
}

// Rendering
function render(){
  // Clear all dropzones
  $$(".dropzone").forEach(z => z.innerHTML = "");
  const tasks = filteredTasks();
  for(const t of tasks){
    const el = taskElement(t);
    const zone = $(`.dropzone[data-quadrant="${t.quadrant}"]`);
    zone?.appendChild(el);
  }
}

function taskElement(task){
  const tpl = $("#taskTemplate");
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = task.id;

  const title = node.querySelector(".task-title");
  title.textContent = task.title;

  const notes = node.querySelector(".task-notes");
  notes.textContent = task.notes || "";

  // Meta badges
  const due = node.querySelector(".badge.due");
  if(task.dueDate){
    due.textContent = `Due ${task.dueDate}`;
    due.classList.add(isOverdue(task.dueDate) ? "overdue" : isToday(task.dueDate) || isThisWeek(task.dueDate) ? "soon" : "future");
  }else{
    due.textContent = "No due date";
  }
  const created = node.querySelector(".badge.created");
  created.textContent = new Date(task.createdAt).toLocaleString();

  // Done tick
  const done = node.querySelector(".task-done");
  done.checked = !!task.done;
  done.addEventListener("change", () => {
    updateTask(task.id, { done: done.checked });
    render();
  });

  // Drag or drop
  node.addEventListener("dragstart", ev => {
    node.classList.add("dragging");
    ev.dataTransfer.setData("text/task-id", task.id);
  });
  node.addEventListener("dragend", () => node.classList.remove("dragging"));

  // Actions
  node.querySelector(".icon-btn.edit").addEventListener("click", () => openEdit(task.id));
  node.querySelector(".icon-btn.delete").addEventListener("click", () => {
    if(confirm("Delete this task")){ deleteTask(task.id); render(); }
  });

  return node;
}

// Drag and drop behaviour
$$(".dropzone").forEach(zone => {
  zone.addEventListener("dragover", ev => {
    ev.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", ev => {
    ev.preventDefault();
    zone.classList.remove("dragover");
    const id = ev.dataTransfer.getData("text/task-id");
    const quadrant = zone.dataset.quadrant;
    updateTask(id, { quadrant });
    render();
  });
});

// Dialog handling
const dialog = $("#taskDialog");
const form = $("#taskForm");
const newBtn = $("#newTaskBtn");
const saveBtn = $("#saveTaskBtn");

function openNew(defaultQuadrant="now"){
  form.reset();
  form.elements.title.value = "";
  form.elements.notes.value = "";
  form.elements.dueDate.value = "";
  form.elements.quadrant.value = defaultQuadrant;
  form.elements.id.value = "";
  $("#dialogTitle").textContent = "Add task";
  dialog.showModal();
  form.elements.title.focus();
}

function openEdit(id){
  const t = state.tasks.find(x => x.id === id);
  if(!t) return;
  form.reset();
  form.elements.title.value = t.title;
  form.elements.notes.value = t.notes || "";
  form.elements.dueDate.value = t.dueDate || "";
  form.elements.quadrant.value = t.quadrant;
  form.elements.id.value = t.id;
  $("#dialogTitle").textContent = "Edit task";
  dialog.showModal();
  form.elements.title.focus();
}

newBtn.addEventListener("click", () => openNew());
form.addEventListener("submit", ev => {
  ev.preventDefault();
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  if(!data.title.trim()) return;
  if(data.id){
    updateTask(data.id, {
      title: data.title.trim(),
      notes: data.notes.trim(),
      dueDate: data.dueDate,
      quadrant: data.quadrant
    });
  }else{
    createTask({
      title: data.title.trim(),
      notes: data.notes.trim(),
      dueDate: data.dueDate,
      quadrant: data.quadrant
    });
  }
  dialog.close();
  render();
});
dialog.addEventListener("click", ev => {
  const rect = dialog.getBoundingClientRect();
  if(ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom){
    dialog.close();
  }
});

// Search or filters
$("#searchInput").addEventListener("input", ev => {
  state.filters.query = ev.target.value;
  render();
});
$("#dueFilter").addEventListener("change", ev => {
  state.filters.due = ev.target.value;
  render();
});
$("#hideDone").addEventListener("change", ev => {
  state.filters.hideDone = ev.target.checked;
  render();
});

// Export and import
$("#exportBtn").addEventListener("click", () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `priority-matrix-swc-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#importBtn").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", async ev => {
  const file = ev.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const obj = JSON.parse(text);
    if(!obj || !Array.isArray(obj.tasks)) throw new Error("Invalid file");
    state = { ...state, ...obj };
    save();
    render();
  }catch(err){
    alert("Import failed");
    console.error(err);
  }finally{
    ev.target.value = "";
  }
});

// Shortcuts
window.addEventListener("keydown", ev => {
  if(ev.key.toLowerCase() === "n" && !dialog.open){
    ev.preventDefault();
    openNew();
  }
  if(ev.key === "/"){
    ev.preventDefault();
    $("#searchInput").focus();
  }
});

// Boot
load();
// Seed example tasks if empty
if(state.tasks.length === 0){
  createTask({ title: "Prepare weekly report", notes: "Outline metrics and highlights", dueDate: todayISO(), quadrant: "now" });
  createTask({ title: "Plan team offsite", notes: "Shortlist venues, draft agenda", dueDate: "", quadrant: "schedule" });
  createTask({ title: "Share press release to partners", notes: "Forward to distribution list", dueDate: todayISO(), quadrant: "delegate" });
  createTask({ title: "Unnecessary recurring sync", notes: "Consider removing", dueDate: "", quadrant: "drop" });
}
render();
