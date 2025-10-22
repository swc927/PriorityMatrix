/* Priority Matrix by SWC */
(() => {
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

  const lists = {
    do: qs("#list-do"),
    schedule: qs("#list-schedule"),
    delegate: qs("#list-delegate"),
    drop: qs("#list-drop"),
  };

  const counts = {
    do: qs("#count-do"),
    schedule: qs("#count-schedule"),
    delegate: qs("#count-delegate"),
    drop: qs("#count-drop"),
  };

  const newTaskBtn = qs("#newTaskBtn");
  const exportBtn = qs("#exportBtn");
  const importInput = qs("#importInput");
  const printBtn = qs("#printBtn");
  const clearBtn = qs("#clearBtn");
  const dialog = qs("#taskDialog");
  const titleInput = qs("#taskTitle");
  const notesInput = qs("#taskNotes");
  const dueInput = qs("#taskDue");
  const quadSelect = qs("#taskQuad");
  const dialogTitle = qs("#dialogTitle");
  const saveTaskBtn = qs("#saveTaskBtn");

  const template = qs("#taskItemTemplate");

  let editId = null;

  const STORAGE_KEY = "pmatrix-v1";

  function uid() {
    return (
      Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
    );
  }

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw
        ? JSON.parse(raw)
        : { do: [], schedule: [], delegate: [], drop: [] };
    } catch {
      return { do: [], schedule: [], delegate: [], drop: [] };
    }
  }

  function write(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getState() {
    const state = { do: [], schedule: [], delegate: [], drop: [] };
    for (const key of Object.keys(lists)) {
      const ul = lists[key];
      qsa("li.task", ul).forEach((li) => {
        state[key].push({
          id: li.dataset.id,
          title: li.querySelector(".title").textContent,
          notes: li.dataset.notes || "",
          due: li.dataset.due || "",
          done: li.querySelector(".tick").checked,
        });
      });
    }
    return state;
  }

  function setCounts() {
    for (const key of Object.keys(lists)) {
      counts[key].textContent = qsa("li.task", lists[key]).length;
    }
  }

  function formatDue(due) {
    if (!due) return "";
    const d = new Date(due + "T00:00:00");
    const today = new Date();
    const diff = Math.floor((d - today) / 86400000);
    if (diff < 0)
      return `Overdue by ${Math.abs(diff)} day${
        Math.abs(diff) === 1 ? "" : "s"
      }`;
    if (diff === 0) return "Due today";
    if (diff === 1) return "Due tomorrow";
    return `Due in ${diff} days`;
  }

  function createTaskItem(task) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    node.dataset.notes = task.notes || "";
    node.dataset.due = task.due || "";

    node.querySelector(".title").textContent = task.title;
    node.querySelector(".meta").textContent = [formatDue(task.due), task.notes]
      .filter(Boolean)
      .join(" • ");
    const tick = node.querySelector(".tick");
    tick.checked = !!task.done;
    if (tick.checked) node.classList.add("done");

    tick.addEventListener("change", () => {
      node.classList.toggle("done", tick.checked);
      persist();
    });

    node.addEventListener("dblclick", () => openEditDialog(task, node));

    node
      .querySelector(".edit")
      .addEventListener("click", () => openEditDialog(task, node));
    node.querySelector(".delete").addEventListener("click", () => {
      node.remove();
      persist();
    });

    enableDrag(node);

    return node;
  }

  function openNewDialog(initialQuad = "do") {
    editId = null;
    dialogTitle.textContent = "New task";
    titleInput.value = "";
    notesInput.value = "";
    dueInput.value = "";
    quadSelect.value = initialQuad;
    dialog.showModal();
    setTimeout(() => titleInput.focus(), 0);
  }

  function openEditDialog(task, node) {
    editId = task.id;
    dialogTitle.textContent = "Edit task";
    titleInput.value = task.title;
    notesInput.value = task.notes || "";
    dueInput.value = task.due || "";
    quadSelect.value = node.closest(".quadrant").dataset.quad;
    dialog.showModal();
  }

  function saveFromDialog() {
    const title = titleInput.value.trim();
    const notes = notesInput.value.trim();
    const due = dueInput.value;
    const quad = quadSelect.value;

    if (!title) {
      dialog.close();
      return;
    }

    if (editId) {
      // Update existing
      const node = qsa("li.task").find((li) => li.dataset.id === editId);
      if (node) {
        node.querySelector(".title").textContent = title;
        node.dataset.notes = notes;
        node.dataset.due = due;
        node.querySelector(".meta").textContent = [formatDue(due), notes]
          .filter(Boolean)
          .join(" • ");
        if (node.closest(".quadrant").dataset.quad !== quad) {
          lists[quad].appendChild(node);
        }
      }
    } else {
      // New
      const task = { id: uid(), title, notes, due, done: false };
      lists[quad].appendChild(createTaskItem(task));
    }

    persist();
    dialog.close();
  }

  function enableDrag(li) {
    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      e.dataTransfer.setData("text/plain", li.dataset.id);
      e.dataTransfer.effectAllowed = "move";
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));
  }

  function setupDropZones() {
    qsa(".task-list").forEach((ul) => {
      ul.addEventListener("dragover", (e) => {
        e.preventDefault();
        ul.classList.add("over");
      });
      ul.addEventListener("dragleave", () => ul.classList.remove("over"));
      ul.addEventListener("drop", (e) => {
        e.preventDefault();
        ul.classList.remove("over");
        const id = e.dataTransfer.getData("text/plain");
        const li = qsa("li.task").find((n) => n.dataset.id === id);
        if (li && ul !== li.parentElement) {
          ul.appendChild(li);
          persist();
        }
      });
    });
  }

  function persist() {
    const state = getState();
    write(state);
    setCounts();
  }

  function load() {
    const state = read();
    for (const [key, arr] of Object.entries(state)) {
      for (const task of arr) {
        lists[key].appendChild(createTaskItem(task));
      }
    }
    setCounts();
  }

  function exportJSON() {
    const data = getState();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `priority-matrix-by-swc-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(fr.result);
        // Clear
        qsa(".task-list").forEach((ul) => (ul.innerHTML = ""));
        // Restore
        for (const [key, arr] of Object.entries(data)) {
          for (const task of arr) lists[key].appendChild(createTaskItem(task));
        }
        persist();
      } catch {
        alert("Could not import file");
      }
    };
    fr.readAsText(file);
  }

  function clearAll() {
    if (!confirm("Clear all tasks")) return;
    localStorage.removeItem(STORAGE_KEY);
    qsa(".task-list").forEach((ul) => (ul.innerHTML = ""));
    setCounts();
  }

  // keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "n") openNewDialog("do");
    if (e.key === "1") openNewDialog("do");
    if (e.key === "2") openNewDialog("schedule");
    if (e.key === "3") openNewDialog("delegate");
    if (e.key === "4") openNewDialog("drop");
    if (e.key.toLowerCase() === "e") exportJSON();
    if (e.key.toLowerCase() === "p") window.print();
  });

  // wire up UI
  newTaskBtn.addEventListener("click", () => openNewDialog("do"));
  exportBtn.addEventListener("click", exportJSON);
  importInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importJSON(file);
    importInput.value = "";
  });
  printBtn.addEventListener("click", () => window.print());
  clearBtn.addEventListener("click", clearAll);
  saveTaskBtn.addEventListener("click", (e) => {
    e.preventDefault();
    saveFromDialog();
  });

  load();
  setupDropZones();
})();
