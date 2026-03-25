/**
 * app.js — Floating Panel UI mantığı
 *
 * Bu dosya renderer sürecinde çalışır.
 * window.api üzerinden (preload.js'den gelen) IPC fonksiyonlarını kullanır.
 */

// ── DOM Elementleri ──
const btnClose = document.getElementById('btn-close');
const tabs = document.querySelectorAll('.tab');
const panelNotes = document.getElementById('panel-notes');
const panelTodos = document.getElementById('panel-todos');
const panelWords = document.getElementById('panel-words');
const panelHabits = document.getElementById('panel-habits');
const panelCalendar = document.getElementById('panel-calendar');
const notesList = document.getElementById('notes-list');
const todosList = document.getElementById('todos-list');
const wordsList = document.getElementById('words-list');
const habitsList = document.getElementById('habits-list');
const noteInput = document.getElementById('note-input');
const todoInput = document.getElementById('todo-input');
const habitInput = document.getElementById('habit-input');
const calInput = document.getElementById('cal-input');
const btnScan = document.getElementById('btn-scan');
const btnScanWords = document.getElementById('btn-scan-words');
const wordOrigInput = document.getElementById('word-orig-input');
const wordTrInput = document.getElementById('word-tr-input');
const btnAddWord = document.getElementById('btn-add-word');

let autoMathEnabled = true;

// ── Pencere Kapat ──
btnClose.addEventListener('click', () => window.api.hideWindow());

// ── Tab Geçişi ──
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    const target = tab.dataset.tab;
    panelNotes.classList.toggle('active', target === 'notes');
    panelTodos.classList.toggle('active', target === 'todos');
    panelWords.classList.toggle('active', target === 'words');
    panelHabits.classList.toggle('active', target === 'habits');
    panelCalendar.classList.toggle('active', target === 'calendar');

    if (target === 'notes') loadNotes();
    if (target === 'todos') loadTodos();
    if (target === 'words') loadWords();
    if (target === 'habits') loadHabits();
    if (target === 'calendar') loadCalendar();
  });
});

// ── Zaman Formatlama ──
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'şimdi';
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
  if (diff < 172800) return 'dün';
  return `${Math.floor(diff / 86400)} gün önce`;
}

// ── Notları Yükle & Render ──
async function loadNotes() {
  const all = await window.api.getNotes();
  const notes = all.filter((n) => n.type === 'note');

  if (!notes.length) {
    notesList.innerHTML = '<div class="empty-state">Henüz not yok</div>';
    return;
  }

  notesList.innerHTML = notes.map((n) => `
    <div class="note" data-id="${n.id}">
      <div class="note-text">${escapeHtml(n.content)}</div>
      <div class="note-meta">${timeAgo(n.created_at)}</div>
      <button class="todo-delete note-delete-btn" data-delete="${n.id}">✕</button>
    </div>`).join('');

  notesList.querySelectorAll('.note-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.deleteNote(Number(btn.dataset.delete));
      loadNotes();
    });
  });
}

// ── Kelimeleri Yükle & Render ──
async function loadWords() {
  const all = await window.api.getNotes();
  const words = all.filter((n) => n.type === 'word');

  if (!words.length) {
    wordsList.innerHTML = '<div class="empty-state">Henüz kelime yok</div>';
    return;
  }

  wordsList.innerHTML = words.map((w) => `
    <div class="note-word" data-id="${w.id}">
      <span class="word-inline">${escapeHtml(w.original)} <span class="word-arrow">→</span> ${escapeHtml(w.translated)}</span>
      <button class="todo-delete word-delete-btn" data-delete="${w.id}">✕</button>
    </div>`).join('');

  wordsList.querySelectorAll('.word-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.deleteNote(Number(btn.dataset.delete));
      loadWords();
    });
  });
}

// ── Görevleri Yükle & Render ──
async function loadTodos() {
  const todos = await window.api.getTodos();

  if (!todos.length) {
    todosList.innerHTML = '<div class="empty-state">Henüz görev yok</div>';
    return;
  }

  todosList.innerHTML = todos.map((t) => `
    <div class="todo-item" data-id="${t.id}">
      <div class="check ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</div>
      <div class="todo-text ${t.done ? 'done' : ''}">${escapeHtml(t.text)}</div>
      <button class="todo-delete" data-delete="${t.id}">✕</button>
    </div>
  `).join('');

  // Tıklama → toggle
  todosList.querySelectorAll('.todo-item').forEach((el) => {
    el.addEventListener('click', async (e) => {
      if (e.target.closest('.todo-delete')) return;
      await window.api.toggleTodo(Number(el.dataset.id));
      loadTodos();
    });
  });

  // Sil butonu
  todosList.querySelectorAll('.todo-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.deleteTodo(Number(btn.dataset.delete));
      loadTodos();
    });
  });
}

// ── Not Ekle ──
async function addNote() {
  const text = noteInput.value.trim();
  if (!text) return;
  await window.api.addNote(text);
  noteInput.value = '';
  noteInput.style.height = 'auto';
  loadNotes();
}

noteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
});

// ── Otomatik yükseklik + matematik ──
noteInput.addEventListener('input', () => {
  noteInput.style.height = 'auto';
  noteInput.style.height = noteInput.scrollHeight + 'px';

  if (!autoMathEnabled) return;

  const val = noteInput.value;
  const cursorPos = noteInput.selectionStart;
  const textUpToCursor = val.substring(0, cursorPos);
  const lines = textUpToCursor.split('\n');
  const currentLine = lines[lines.length - 1];

  const mathMatch = currentLine.match(/^([\d+\-*/().\s%]+)=$/);
  if (!mathMatch) return;
  try {
    const expr = mathMatch[1].trim();
    if (!expr) return;
    const result = Function('"use strict"; return (' + expr + ')')();
    if (!isFinite(result)) return;
    const res = String(Number(result.toFixed(10)));
    noteInput.value = val.substring(0, cursorPos) + res + val.substring(cursorPos);
    noteInput.style.height = 'auto';
    noteInput.style.height = noteInput.scrollHeight + 'px';
    noteInput.setSelectionRange(cursorPos, cursorPos + res.length);
  } catch (_) { }
});

// ── Görev Ekle ──
async function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  await window.api.addTodo(text);
  todoInput.value = '';
  loadTodos();
}

todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    addTodo();
  }
});

// ── Kelime Ekle (manuel) ──
async function addWord() {
  const orig = wordOrigInput.value.trim();
  const tr = wordTrInput.value.trim();
  if (!orig) return;
  await window.api.addWord(orig, tr || '—');
  wordOrigInput.value = '';
  wordTrInput.value = '';
  wordOrigInput.focus();
  loadWords();
}

btnAddWord.addEventListener('click', addWord);
[wordOrigInput, wordTrInput].forEach(inp => {
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addWord(); });
});

// ── Alışkanlıkları Yükle & Render ──
async function loadHabits() {
  const habits = await window.api.getHabits();

  if (!habits.length) {
    habitsList.innerHTML = '<div class="empty-state">Henüz alışkanlık yok</div>';
    return;
  }

  habitsList.innerHTML = habits.map((h) => {
    const checked = h.checked_days.length;
    return `
      <div class="habit-card" data-id="${h.id}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
          <span style="font-size:12px; font-weight:600; color:rgba(255,255,255,0.85);">${escapeHtml(h.title)}</span>
          <div style="display:flex; gap: 8px; align-items:center;">
            <span style="font-size:10px; color:#14b8a6; background:rgba(20,184,166,0.1); padding:2px 6px; border-radius:4px;">${checked} / ${h.total_days}</span>
            <button class="todo-delete habit-delete-btn" data-delete="${h.id}">✕</button>
          </div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">
          ${Array.from({ length: h.total_days }, (_, i) => i + 1).map((day) => `
            <div class="habit-day-mini ${h.checked_days.includes(day) ? 'checked' : ''}"
                 data-habit="${h.id}" data-day="${day}" title="Gün ${day}">${day}</div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  habitsList.querySelectorAll('.habit-day-mini').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.toggleHabitDay(Number(el.dataset.habit), Number(el.dataset.day));
      loadHabits();
    });
  });

  habitsList.querySelectorAll('.habit-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.deleteHabit(Number(btn.dataset.delete));
      loadHabits();
    });
  });
}

// ── Alışkanlık Ekle (Hızlı - Varsayılan 30 Gün) ──
async function addHabit() {
  const title = habitInput.value.trim();
  if (!title) return;
  await window.api.createHabit(title, 30);
  habitInput.value = '';
  loadHabits();
}

habitInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addHabit(); }
});

// ── Takvim (Mini) ──
let miniCalDate = new Date();
let selectedCalDate = new Date().toISOString().split('T')[0];

async function loadCalendar() {
  const events = await window.api.getCalendarEvents();

  const year = miniCalDate.getFullYear();
  const month = miniCalDate.getMonth();
  const todayStr = new Date().toISOString().split('T')[0];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  document.getElementById('cal-mini-header').innerHTML = `
    <span style="cursor:pointer;" onclick="miniCalDate.setMonth(miniCalDate.getMonth()-1);loadCalendar();">&lt;</span>
    <span>${new Date(year, month).toLocaleString('tr-TR', { month: 'short', year: 'numeric' })}</span>
    <span style="cursor:pointer;" onclick="miniCalDate.setMonth(miniCalDate.getMonth()+1);loadCalendar();">&gt;</span>
  `;

  let gridHtml = '';
  ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'].forEach(d => gridHtml += `<div style="text-align:center;font-size:9px;color:rgba(255,255,255,0.4);">${d}</div>`);
  for (let i = 0; i < offset; i++) gridHtml += `<div></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hasEvent = events.some(e => e.date === dStr);
    const isToday = dStr === todayStr;
    const isSelected = dStr === selectedCalDate;

    gridHtml += `
      <div class="cal-day-mini ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dStr}">
        ${d}
        ${hasEvent ? '<div class="cal-dot"></div>' : ''}
      </div>
    `;
  }
  document.getElementById('cal-mini-grid').innerHTML = gridHtml;

  // Gün Seçimi
  document.querySelectorAll('.cal-day-mini[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      selectedCalDate = el.dataset.date;
      loadCalendar();
    });
  });

  // Seçili Günün Etkinlikleri
  const dayEvents = events.filter(e => e.date === selectedCalDate);
  const eventsCont = document.getElementById('cal-mini-events');

  if (!dayEvents.length) {
    eventsCont.innerHTML = `<div class="empty-state" style="padding:10px;">Etkinlik yok</div>`;
  } else {
    eventsCont.innerHTML = dayEvents.map(e => `
      <div class="todo-item" style="padding:6px; background:rgba(59, 130, 246, 0.05); border-radius:6px; border-bottom:none;">
        <div class="todo-text" style="color:#93c5fd;">${escapeHtml(e.text)}</div>
        <button class="todo-delete cal-del-btn" data-del="${e.id}" style="color:#ef4444;">✕</button>
      </div>
    `).join('');
  }

  eventsCont.querySelectorAll('.cal-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await window.api.deleteCalendarEvent(Number(btn.dataset.del));
      loadCalendar();
    });
  });
}

calInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = calInput.value.trim();
    if (!text) return;
    await window.api.addCalendarEvent(selectedCalDate, text);
    calInput.value = '';
    loadCalendar();
  }
});

// ── Ekrandan Kelime Seç (OCR) ──
btnScan.addEventListener('click', async () => {
  try { await window.api.startScreenCapture('note'); }
  catch (err) { console.error('OCR hatası:', err); }
});

btnScanWords.addEventListener('click', async () => {
  try { await window.api.startScreenCapture('word'); }
  catch (err) { console.error('OCR hatası:', err); }
});

// Ana process'ten gelen veri değişikliği bildirimi
window.api.onDataChanged((mode) => {
  const target = mode === 'note' ? 'notes' : 'words';
  const tab = document.querySelector(`.tab[data-tab="${target}"]`);
  if (tab) tab.click();
});

// ── XSS Koruması ──
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Başlangıç ──
loadNotes();
