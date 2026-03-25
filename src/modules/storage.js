/**
 * storage.js — SQLite veritabanı modülü (sql.js ile)
 *
 * sql.js = saf JavaScript SQLite. C++ derleme gerektirmez.
 * Veri dosyası: %APPDATA%/faegaz-notes/faegaz.db
 *
 * Fark: sql.js bellek içi çalışır, her değişiklikte dosyaya yazarız.
 */
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;
let dbPath = '';

async function init() {
  const initSqlJs = require('sql.js');

  // sql.js wasm dosyasının yolunu belirle
  const SQL = await initSqlJs();

  dbPath = path.join(app.getPath('userData'), 'faegaz.db');

  // Varolan veritabanını yükle, yoksa yeni oluştur
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT    NOT NULL DEFAULT 'note',
      title      TEXT    DEFAULT '',
      content    TEXT,
      original   TEXT,
      translated TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );
  `);

  // title kolonu yoksa ekle (mevcut veritabanı uyumu)
  try {
    db.run("ALTER TABLE notes ADD COLUMN title TEXT DEFAULT ''");
  } catch { /* kolon zaten var */ }

  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      text       TEXT    NOT NULL,
      done       INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS habits (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL,
      total_days INTEGER NOT NULL DEFAULT 30,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS habit_checks (
      habit_id   INTEGER NOT NULL,
      day        INTEGER NOT NULL,
      UNIQUE(habit_id, day)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT    NOT NULL,
      text       TEXT    NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );
  `);

  save();
}

/** Veritabanını diske yaz */
function save() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/** SELECT sorgusu → obje dizisi döndürür */
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/** INSERT/UPDATE/DELETE → çalıştır ve kaydet */
function run(sql, params = []) {
  db.run(sql, params);
  save();
}

// ── Not İşlemleri ──

function addNote(content, title = '') {
  run('INSERT INTO notes (type, content, title) VALUES (?, ?, ?)', ['note', content, title]);
  return db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
}

function updateNoteTitle(id, title) {
  run('UPDATE notes SET title = ? WHERE id = ?', [title, id]);
}

function addWord(original, translated) {
  run('INSERT INTO notes (type, original, translated) VALUES (?, ?, ?)', ['word', original, translated]);
  return db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
}

function getNotes() {
  return query('SELECT * FROM notes ORDER BY created_at DESC');
}

function searchNotes(q) {
  const like = `%${q}%`;
  return query(
    'SELECT * FROM notes WHERE content LIKE ? OR original LIKE ? OR translated LIKE ? ORDER BY created_at DESC',
    [like, like, like]
  );
}

function deleteNote(id) {
  run('DELETE FROM notes WHERE id = ?', [id]);
}

// ── Görev İşlemleri ──

function addTodo(text) {
  run('INSERT INTO todos (text) VALUES (?)', [text]);
  return db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
}

function getTodos() {
  return query('SELECT * FROM todos ORDER BY created_at DESC');
}

function toggleTodo(id) {
  run('UPDATE todos SET done = CASE WHEN done = 0 THEN 1 ELSE 0 END WHERE id = ?', [id]);
}

function deleteTodo(id) {
  run('DELETE FROM todos WHERE id = ?', [id]);
}

// ── Alışkanlık İşlemleri ──

function createHabit(title, totalDays = 30) {
  run('INSERT INTO habits (title, total_days) VALUES (?, ?)', [title, totalDays]);
  return db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
}

function getHabits() {
  const habits = query('SELECT * FROM habits ORDER BY created_at DESC');
  return habits.map((h) => {
    const checks = query('SELECT day FROM habit_checks WHERE habit_id = ?', [h.id]);
    return { ...h, checked_days: checks.map((c) => c.day) };
  });
}

function toggleHabitDay(habitId, day) {
  const existing = query('SELECT 1 FROM habit_checks WHERE habit_id = ? AND day = ?', [habitId, day]);
  if (existing.length > 0) {
    run('DELETE FROM habit_checks WHERE habit_id = ? AND day = ?', [habitId, day]);
  } else {
    run('INSERT INTO habit_checks (habit_id, day) VALUES (?, ?)', [habitId, day]);
  }
}

function deleteHabit(id) {
  run('DELETE FROM habit_checks WHERE habit_id = ?', [id]);
  run('DELETE FROM habits WHERE id = ?', [id]);
}

// ── Takvim İşlemleri ──

function addCalendarEvent(date, text) {
  run('INSERT INTO calendar_events (date, text) VALUES (?, ?)', [date, text]);
  return db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
}

function getCalendarEvents(year, month) {
  if (year !== undefined && month !== undefined) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const rows = query('SELECT * FROM calendar_events WHERE date LIKE ? ORDER BY date ASC', [`${prefix}%`]);
    // Group by date key
    const map = {};
    rows.forEach(r => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r.text);
    });
    return map;
  }
  return query('SELECT * FROM calendar_events ORDER BY date ASC');
}

function deleteCalendarEvent(id) {
  run('DELETE FROM calendar_events WHERE id = ?', [id]);
}

function close() {
  if (db) {
    save();
    db.close();
  }
}

module.exports = { init, addNote, updateNoteTitle, addWord, getNotes, searchNotes, deleteNote, addTodo, getTodos, toggleTodo, deleteTodo, createHabit, getHabits, toggleHabitDay, deleteHabit, addCalendarEvent, getCalendarEvents, deleteCalendarEvent, close };
