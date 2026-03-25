/**
 * main-app.js — Ana Pencere UI mantığı
 *
 * Sidebar navigasyonu, sayfa geçişleri, not/görev/kelime listeleri,
 * arama, sıralama ve modal yönetimi.
 */

// ── DOM ──
const navItems = document.querySelectorAll('.nav-item');
const content = document.getElementById('content');
const pageTitle = document.getElementById('page-title');
const btnFloating = document.getElementById('btn-floating');
const searchInput = document.getElementById('search-input');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalTitleInput = document.getElementById('modal-title-input');
const modalInput = document.getElementById('modal-input');
const modalCancel = document.getElementById('modal-cancel');
const modalSave = document.getElementById('modal-save');

let currentPage = 'notes';
let sortOrder = 'desc'; // desc = yeniden eskiye
let autoMathEnabled = true;

// ── Navigasyon ──
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    navItems.forEach((i) => i.classList.remove('active'));
    item.classList.add('active');
    currentPage = item.dataset.page;
    loadPage();
  });
});

function loadPage() {
  const titles = { notes: 'Notlar', todos: 'Görevler', words: 'Kelimeler' };
  if (pageTitle) pageTitle.textContent = titles[currentPage];
  btnAutoMath.style.display = currentPage === 'notes' ? '' : 'none';
  if (pageTitle) pageTitle.textContent = { notes: 'Notlar', todos: 'Görevler', words: 'Kelimeler', habits: 'Alışkanlıklar' }[currentPage] || '';

  switch (currentPage) {
    case 'notes': return renderNotes();
    case 'todos': return renderTodos();
    case 'words': return renderWords();
    case 'habits': return renderHabits();
    case 'calendar': return renderCalendar();
  }
}

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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Notlar ──
async function renderNotes() {
  const query = searchInput.value.trim();
  const allNotes = query
    ? await window.api.searchNotes(query)
    : await window.api.getNotes();

  const notes = allNotes.filter((n) => n.type === 'note');

  if (sortOrder === 'asc') notes.reverse();

  const noteTitle = (n) => n.title || n.content.split('\n')[0].substring(0, 40);

  content.innerHTML = `
    <div class="section-row">
      <span class="section-label" style="padding:0;">Son eklenenler</span>
      <button class="section-add-btn" id="btn-inline-add" title="Yeni not ekle">+</button>
    </div>
    ${!notes.length ? '<div class="empty-state">Henüz not eklenmemiş</div>' : notes.map((n) => `
      <div class="note-card" data-id="${n.id}">
        <div class="card-top">
          <span class="card-title" data-title-id="${n.id}" title="Başlığı düzenlemek için tıkla">${escapeHtml(noteTitle(n))}</span>
          <span style="display:flex;align-items:center;gap:4px;">
            <span class="card-date">${timeAgo(n.created_at)}</span>
            <button class="card-delete" data-del="${n.id}">✕</button>
          </span>
        </div>
        <div class="card-preview">${escapeHtml(n.content)}</div>
      </div>
    `).join('')}
  `;

  // Inline yeni not aç
  document.getElementById('btn-inline-add').addEventListener('click', () => openInlineNew());

  function openInlineNew() {
    const existing = document.getElementById('inline-new-card');
    if (existing) { existing.querySelector('.inline-new-body').focus(); return; }

    const card = document.createElement('div');
    card.className = 'inline-new-card';
    card.id = 'inline-new-card';
    card.innerHTML = `
      <input class="inline-new-title" placeholder="Başlık (opsiyonel)" />
      <textarea class="inline-new-body" placeholder="Notunu yaz..."></textarea>
      <div class="inline-new-actions">
        <button class="btn-ghost" id="inline-cancel">İptal</button>
        <button class="btn-accent" id="inline-save">Kaydet</button>
      </div>
    `;

    // section-row'dan hemen sonra ekle
    const sectionRow = content.querySelector('.section-row');
    sectionRow.insertAdjacentElement('afterend', card);

    const titleEl = card.querySelector('.inline-new-title');
    const bodyEl = card.querySelector('.inline-new-body');
    bodyEl.focus();

    // Otomatik yükseklik + matematik hesaplama
    bodyEl.addEventListener('input', (e) => {
      bodyEl.style.height = 'auto';
      bodyEl.style.height = bodyEl.scrollHeight + 'px';

      if (!autoMathEnabled) return;
      // Silme/backspace sırasında math tetiklenmesin
      if (e.inputType && e.inputType.startsWith('delete')) return;

      // Sadece mevcut satırı kontrol et (önceki satırlar etkilenmesin)
      const val = bodyEl.value;
      const cursorPos = bodyEl.selectionStart;
      const textUpToCursor = val.substring(0, cursorPos);
      const lines = textUpToCursor.split('\n');
      const currentLine = lines[lines.length - 1];

      // Son boşluktan sonraki segmenti al → birden fazla işlem desteği
      const lastSpaceIdx = currentLine.lastIndexOf(' ');
      const lastSegment = lastSpaceIdx >= 0 ? currentLine.substring(lastSpaceIdx + 1) : currentLine;
      const mathMatch = lastSegment.match(/^([\d+\-*/().%]+)=$/);
      if (!mathMatch) return;
      try {
        const expr = mathMatch[1].trim();
        if (!expr) return;
        const result = Function('"use strict"; return (' + expr + ')')();
        if (!isFinite(result)) return;
        const res = String(Number(result.toFixed(10)));
        const insertAt = cursorPos;
        bodyEl.value = val.substring(0, insertAt) + res + val.substring(insertAt);
        bodyEl.style.height = 'auto';
        bodyEl.style.height = bodyEl.scrollHeight + 'px';
        // İmleci sonuca seçmeden sonuna taşı (mavi highlight bug'ı düzeltildi)
        const newPos = insertAt + res.length;
        bodyEl.setSelectionRange(newPos, newPos);
      } catch (_) { }
    });

    const save = async () => {
      const text = bodyEl.value.trim();
      if (!text) { card.remove(); return; }
      await window.api.addNote(text, titleEl.value.trim());
      renderNotes();
    };

    document.getElementById('inline-save').addEventListener('click', save);
    document.getElementById('inline-cancel').addEventListener('click', () => { card.remove(); });
    bodyEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) save(); if (e.key === 'Escape') card.remove(); });
  }

  // Başlık düzenleme — tıklayınca inline edit
  content.querySelectorAll('.card-title[data-title-id]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(el.dataset.titleId);
      const current = el.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = current;
      input.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(168,85,247,0.3);border-radius:4px;padding:2px 6px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.9);font-family:inherit;outline:none;width:100%;';
      el.replaceWith(input);
      input.focus();
      input.select();

      const save = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== current) {
          await window.api.updateNoteTitle(id, newTitle);
        }
        renderNotes();
      };
      input.addEventListener('blur', save);
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); if (ev.key === 'Escape') renderNotes(); });
    });
  });

  // Silme onayı
  content.querySelectorAll('.card-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Bu notu silmek istediğine emin misin?')) return;
      await window.api.deleteNote(Number(btn.dataset.del));
      renderNotes();
    });
  });
}

// ── Kelimeler ──
async function renderWords() {
  const query = searchInput.value.trim();
  const allNotes = query
    ? await window.api.searchNotes(query)
    : await window.api.getNotes();

  const words = allNotes.filter((n) => n.type === 'word');

  if (sortOrder === 'asc') words.reverse();

  if (!words.length) {
    content.innerHTML = `
      <div class="section-row">
        <span class="section-label" style="padding:0;">Son kaydedilen kelimeler</span>
        <button class="section-add-btn" id="btn-inline-add-word" title="Yeni kelime ekle">+</button>
      </div>
      <div class="empty-state">Henüz kelime kaydedilmemiş</div>
    `;
  } else {
    content.innerHTML = `
      <div class="section-row">
        <span class="section-label" style="padding:0;">Son kaydedilen kelimeler</span>
        <button class="section-add-btn" id="btn-inline-add-word" title="Yeni kelime ekle">+</button>
      </div>
      ${words.map((w) => `
        <div class="word-card" data-id="${w.id}">
          <span class="word-en">${escapeHtml(w.original)}</span>
          <span class="word-arrow">→</span>
          <span class="word-tr">${escapeHtml(w.translated)}</span>
          <span class="word-tag">çeviri</span>
          <button class="card-delete" data-del="${w.id}" style="margin-left:4px;">✕</button>
        </div>
      `).join('')}
    `;
  }

  content.querySelectorAll('.card-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.deleteNote(Number(btn.dataset.del));
      renderWords();
    });
  });

  const btnAddWord = document.getElementById('btn-inline-add-word');
  if (btnAddWord) btnAddWord.addEventListener('click', () => openInlineWord());
}

function openInlineWord() {
  const existing = document.getElementById('inline-word-card');
  if (existing) { existing.querySelector('.inline-compact-input').focus(); return; }

  const card = document.createElement('div');
  card.className = 'inline-new-card yellow';
  card.id = 'inline-word-card';
  card.style.cssText = 'padding:10px 12px;';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <input class="inline-compact-input" id="inline-word-orig" placeholder="Orijinal kelime" />
      <span style="color:rgba(234,179,8,0.6);font-size:13px;flex-shrink:0;">→</span>
      <input class="inline-compact-input" id="inline-word-tr" placeholder="Çeviri" />
      <button class="btn-ghost" id="inline-word-cancel" style="padding:5px 10px;font-size:11px;">İptal</button>
      <button class="btn-accent" id="inline-word-save" style="padding:5px 10px;font-size:11px;">Kaydet</button>
    </div>
  `;

  content.querySelector('.section-row').insertAdjacentElement('afterend', card);
  const origInput = document.getElementById('inline-word-orig');
  const trInput = document.getElementById('inline-word-tr');
  origInput.focus();

  const save = async () => {
    const orig = origInput.value.trim();
    const tr = trInput.value.trim();
    if (!orig) { card.remove(); return; }
    await window.api.addWord(orig, tr || '—');
    renderWords();
  };

  document.getElementById('inline-word-save').addEventListener('click', save);
  document.getElementById('inline-word-cancel').addEventListener('click', () => card.remove());
  [origInput, trInput].forEach(inp => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') card.remove(); });
  });
}

// ── Görevler ──
async function renderTodos() {
  const todos = await window.api.getTodos();

  if (!todos.length) {
    content.innerHTML = `
      <div class="section-row">
        <span class="section-label" style="padding:0;">Görevler</span>
        <button class="section-add-btn" id="btn-inline-add-todo" title="Yeni görev ekle">+</button>
      </div>
      <div class="empty-state">Henüz görev eklenmemiş</div>
    `;
  } else {
    content.innerHTML = `
      <div class="section-row">
        <span class="section-label" style="padding:0;">Görevler</span>
        <button class="section-add-btn" id="btn-inline-add-todo" title="Yeni görev ekle">+</button>
      </div>
      <div class="todo-card">
        ${todos.map((t) => `
          <div class="todo-row" data-id="${t.id}">
            <div class="tcheck ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</div>
            <div class="ttext ${t.done ? 'done' : ''}">${escapeHtml(t.text)}</div>
            <button class="todo-delete" data-del="${t.id}">✕</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  content.querySelectorAll('.todo-row').forEach((row) => {
    row.addEventListener('click', async (e) => {
      if (e.target.closest('.todo-delete')) return;
      await window.api.toggleTodo(Number(row.dataset.id));
      renderTodos();
    });
  });

  content.querySelectorAll('.todo-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.deleteTodo(Number(btn.dataset.del));
      renderTodos();
    });
  });

  const btnAddTodo = document.getElementById('btn-inline-add-todo');
  if (btnAddTodo) btnAddTodo.addEventListener('click', () => openInlineTodo());
}

function openInlineTodo() {
  const existing = document.getElementById('inline-todo-card');
  if (existing) { existing.querySelector('.inline-compact-input').focus(); return; }

  const card = document.createElement('div');
  card.className = 'inline-new-card pink';
  card.id = 'inline-todo-card';
  card.style.cssText = 'padding:10px 12px;';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <input class="inline-compact-input" id="inline-todo-input" placeholder="Görev yaz..." />
      <button class="btn-ghost" id="inline-todo-cancel" style="padding:5px 10px;font-size:11px;">İptal</button>
      <button class="btn-accent" id="inline-todo-save" style="padding:5px 10px;font-size:11px;">Kaydet</button>
    </div>
  `;

  content.querySelector('.section-row').insertAdjacentElement('afterend', card);
  const input = document.getElementById('inline-todo-input');
  input.focus();

  const save = async () => {
    const text = input.value.trim();
    if (!text) { card.remove(); return; }
    await window.api.addTodo(text);
    renderTodos();
  };

  document.getElementById('inline-todo-save').addEventListener('click', save);
  document.getElementById('inline-todo-cancel').addEventListener('click', () => card.remove());
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') card.remove(); });
}

// ── Alışkanlıklar ──
async function renderHabits() {
  const habits = await window.api.getHabits();

  content.innerHTML = `
    <div class="section-row">
      <span class="section-label" style="padding:0;">Alışkanlık Takibi</span>
      <button class="section-add-btn" id="btn-add-habit" title="Yeni alışkanlık ekle">+</button>
    </div>
    ${!habits.length ? '<div class="empty-state">Henüz alışkanlık eklenmemiş</div>' : habits.map((h) => {
    const checked = h.checked_days.length;
    return `
        <div class="habit-card" data-id="${h.id}">
          <div class="habit-header">
            <span class="habit-title">${escapeHtml(h.title)}</span>
            <span class="habit-progress">${checked} / ${h.total_days} gün</span>
            <button class="card-delete" data-del="${h.id}">✕</button>
          </div>
          <div class="habit-grid">
            ${Array.from({ length: h.total_days }, (_, i) => i + 1).map((day) => `
              <div class="habit-day ${h.checked_days.includes(day) ? 'checked' : ''}"
                   data-habit="${h.id}" data-day="${day}" title="Gün ${day}">${day}</div>
            `).join('')}
          </div>
        </div>
      `;
  }).join('')}
  `;

  document.getElementById('btn-add-habit').addEventListener('click', openInlineHabit);

  content.querySelectorAll('.habit-day').forEach((el) => {
    el.addEventListener('click', async () => {
      await window.api.toggleHabitDay(Number(el.dataset.habit), Number(el.dataset.day));
      renderHabits();
    });
  });

  content.querySelectorAll('.card-delete[data-del]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Bu alışkanlığı silmek istiyor musun?')) return;
      await window.api.deleteHabit(Number(btn.dataset.del));
      renderHabits();
    });
  });
}

function openInlineHabit() {
  const existing = document.getElementById('inline-habit-card');
  if (existing) { existing.querySelector('.inline-new-title').focus(); return; }

  const card = document.createElement('div');
  card.className = 'inline-new-card teal';
  card.id = 'inline-habit-card';
  card.style.cssText = 'padding:12px 14px;';
  card.innerHTML = `
    <input type="text" class="inline-new-title" id="inline-habit-title" placeholder="Alışkanlık adı (ör: Şeker yemedi)" autocomplete="off" />
    <div style="display:flex;align-items:center;gap:12px;margin-top:12px;padding: 0 2px;">
      <span style="font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap;">Hedef Gün:</span>
      <input type="range" class="range-slider" id="inline-habit-range" min="1" max="365" value="30" style="flex:1;">
      <input type="number" id="inline-habit-days" value="30" min="1" max="365"
        style="width:50px;background:rgba(255,255,255,0.04);border:1px solid rgba(20,184,166,0.2);
               border-radius:6px;padding:4px;font-size:12px;color:rgba(255,255,255,0.9);
               font-family:inherit;outline:none;text-align:center;" />
    </div>
    <div class="inline-new-actions" style="margin-top:14px;">
      <button class="btn-ghost" id="inline-habit-cancel">İptal</button>
      <button class="btn-accent" id="inline-habit-save">Oluştur</button>
    </div>
  `;

  content.querySelector('.section-row').insertAdjacentElement('afterend', card);
  const titleInput = document.getElementById('inline-habit-title');

  // Tarayıcı render senkronizasyonu için küçük bir gecikme ile odaklanma (focus bug fix)
  setTimeout(() => { if (titleInput) titleInput.focus(); }, 10);

  const rangeInput = document.getElementById('inline-habit-range');
  const numInput = document.getElementById('inline-habit-days');

  rangeInput.addEventListener('input', (e) => {
    numInput.value = e.target.value;
  });

  numInput.addEventListener('input', (e) => {
    let val = parseInt(e.target.value) || 1;
    if (val < 1) val = 1;
    if (val > 365) val = 365;
    rangeInput.value = val;
  });

  const save = async () => {
    const title = titleInput.value.trim();
    const days = parseInt(numInput.value) || 30;
    if (!title) { card.remove(); return; }
    await window.api.createHabit(title, days);
    renderHabits();
  };

  document.getElementById('inline-habit-save').addEventListener('click', save);
  document.getElementById('inline-habit-cancel').addEventListener('click', () => card.remove());
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') card.remove();
  });
}

// ── Takvim ──
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();

async function renderCalendar() {
  const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  const year = calViewYear;
  const month = calViewMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  let events = {};
  try { events = await window.api.getCalendarEvents(year, month); } catch (_) {}

  let cells = '';
  // Boş hücreler (ay başı)
  for (let i = 0; i < firstDay; i++) {
    cells += `<div class="calendar-day empty"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = events[key] || [];
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    cells += `
      <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${key}">
        <div class="cal-day-num" style="font-size:11px;font-weight:600;color:${isToday ? '#3b82f6' : 'rgba(255,255,255,0.55)'}">${d}</div>
        ${dayEvents.map(ev => `<div class="cal-event">${escapeHtml(ev)}</div>`).join('')}
      </div>`;
  }

  content.innerHTML = `
    <div class="section-row" style="margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <button class="section-add-btn" id="cal-prev" style="font-size:16px;padding:0 6px;">&lsaquo;</button>
        <span class="section-label" style="padding:0;font-size:13px;color:rgba(255,255,255,0.75);">${MONTHS[month]} ${year}</span>
        <button class="section-add-btn" id="cal-next" style="font-size:16px;padding:0 6px;">&rsaquo;</button>
      </div>
      <button class="btn-ghost" id="cal-today" style="font-size:10px;padding:4px 10px;">Bugün</button>
    </div>
    <div class="calendar-grid">
      ${DAYS.map(d => `<div class="calendar-header-day">${d}</div>`).join('')}
      ${cells}
    </div>
  `;

  document.getElementById('cal-prev').addEventListener('click', () => {
    calViewMonth--; if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calViewMonth++; if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
    renderCalendar();
  });
  document.getElementById('cal-today').addEventListener('click', () => {
    calViewYear = new Date().getFullYear();
    calViewMonth = new Date().getMonth();
    renderCalendar();
  });

  content.querySelectorAll('.calendar-day:not(.empty)').forEach((el) => {
    el.addEventListener('click', async () => {
      const dateStr = el.dataset.date;
      const text = await openInlineCalEvent(dateStr);
      if (text) {
        await window.api.addCalendarEvent(dateStr, text);
        renderCalendar();
      }
    });
  });
}

// Olay Ekleme Inline Kart (Takvim İçin Yardımcı)
function openInlineCalEvent(dateStr) {
  return new Promise((resolve) => {
    const existing = document.getElementById('inline-cal-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.className = 'inline-new-card blue';
    card.id = 'inline-cal-card';
    card.style.cssText = 'padding:10px 12px; margin-top:10px;';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;color:#3b82f6;font-weight:600;">${dateStr}</span>
        <input class="inline-compact-input" id="inline-cal-input" placeholder="Etkinlik/Olay yaz..." />
        <button class="btn-ghost" id="inline-cal-cancel" style="padding:5px 10px;font-size:11px;">İptal</button>
        <button class="btn-accent" id="inline-cal-save" style="padding:5px 10px;font-size:11px;">Kaydet</button>
      </div>
    `;
    content.querySelector('.section-row').insertAdjacentElement('afterend', card);
    const input = document.getElementById('inline-cal-input');
    input.focus();

    const close = (val) => { card.remove(); resolve(val); };

    document.getElementById('inline-cal-save').addEventListener('click', () => close(input.value.trim()));
    document.getElementById('inline-cal-cancel').addEventListener('click', () => close(null));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value.trim()); if (e.key === 'Escape') close(null); });
  });
}

// Yukarıdaki renderCalendar içerisindeki kısmı openInlineCalEvent olarak düzeltiyoruz
// ── AutoMath Toggle ──
const btnAutoMath = document.getElementById('btn-automath');
btnAutoMath.addEventListener('click', () => {
  autoMathEnabled = !autoMathEnabled;
  btnAutoMath.style.opacity = autoMathEnabled ? '1' : '0.3';
});


// ── Yeni Not/Görev Modal ──
function openModal(type) {
  const labels = { notes: 'Yeni Not', todos: 'Yeni Görev', words: 'Yeni Kelime' };
  const placeholders = { notes: 'Not yaz...', todos: 'Görev yaz...', words: 'İngilizce kelime → Türkçe karşılık' };
  modalTitle.textContent = labels[type];
  modalInput.placeholder = placeholders[type];
  modalInput.value = '';
  modalTitleInput.value = '';
  // Başlık alanını sadece notlarda göster
  modalTitleInput.style.display = type === 'notes' ? 'block' : 'none';
  modal.classList.add('active');
  if (type === 'notes') modalTitleInput.focus();
  else modalInput.focus();
}

modalCancel.addEventListener('click', () => modal.classList.remove('active'));

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.remove('active');
});

modalSave.addEventListener('click', saveFromModal);
modalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) saveFromModal();
});

async function saveFromModal() {
  const text = modalInput.value.trim();
  if (!text) return;

  if (currentPage === 'notes') {
    const title = modalTitleInput.value.trim();
    await window.api.addNote(text, title);
  } else if (currentPage === 'todos') {
    await window.api.addTodo(text);
  } else if (currentPage === 'words') {
    // Format: "kelime → çeviri" veya "kelime = çeviri"
    const separators = ['→', '->', '=', ':'];
    let original = text, translated = '';
    for (const sep of separators) {
      if (text.includes(sep)) {
        const parts = text.split(sep);
        original = parts[0].trim();
        translated = parts.slice(1).join(sep).trim();
        break;
      }
    }
    await window.api.addWord(original, translated || '—');
  }

  modal.classList.remove('active');
  loadPage();
}

// ── Arama ──
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadPage(), 300);
});

// ── Floating Panel Butonu ──
btnFloating.addEventListener('click', () => window.api.openFloatingPanel());
document.querySelector('.shortcut-pill')?.addEventListener('click', () => window.api.openFloatingPanel());

// ── Dış veri değişikliği (OCR ile kelime eklendi vb.) ──
window.api.onDataChanged(() => loadPage());

// ── Pencere Kontrolleri ──
document.getElementById('btn-min').addEventListener('click', () => window.api.minimizeWindow());
document.getElementById('btn-max').addEventListener('click', () => window.api.maximizeWindow());
document.getElementById('btn-close-win').addEventListener('click', () => window.api.hideWindow());

// ── Başlangıç ──
loadPage();
