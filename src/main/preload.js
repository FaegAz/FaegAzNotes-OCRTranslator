/**
 * preload.js — Güvenli IPC köprüsü
 *
 * contextBridge ile renderer'a (HTML/JS) sadece belirli fonksiyonları açıyoruz.
 * Bu sayede renderer tarafı doğrudan Node.js API'lerine erişemez (güvenlik).
 *
 * Kullanım: renderer tarafında window.api.xxx() şeklinde çağrılır.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Pencere kontrolleri
  hideWindow: () => ipcRenderer.send('hide-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  openFloatingPanel: () => ipcRenderer.send('open-floating-panel'),

  // Not işlemleri
  addNote: (content, title) => ipcRenderer.invoke('add-note', content, title),
  updateNoteTitle: (id, title) => ipcRenderer.invoke('update-note-title', id, title),
  addWord: (original, translated) => ipcRenderer.invoke('add-word', original, translated),
  getNotes: () => ipcRenderer.invoke('get-notes'),
  deleteNote: (id) => ipcRenderer.invoke('delete-note', id),
  searchNotes: (query) => ipcRenderer.invoke('search-notes', query),

  // Görev işlemleri
  addTodo: (text) => ipcRenderer.invoke('add-todo', text),
  getTodos: () => ipcRenderer.invoke('get-todos'),
  toggleTodo: (id) => ipcRenderer.invoke('toggle-todo', id),
  deleteTodo: (id) => ipcRenderer.invoke('delete-todo', id),

  // Takvim işlemleri
  getCalendarEvents: (year, month) => ipcRenderer.invoke('get-calendar-events', year, month),
  addCalendarEvent: (date, text) => ipcRenderer.invoke('add-calendar-event', date, text),
  deleteCalendarEvent: (id) => ipcRenderer.invoke('delete-calendar-event', id),

  // OCR + Çeviri
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  ocrAndTranslate: (imageBase64, region) => ipcRenderer.invoke('ocr-and-translate', imageBase64, region),
  startScreenCapture: (mode) => ipcRenderer.invoke('start-screen-capture', mode),
  onScreenImage: (callback) => ipcRenderer.on('screen-image', (_e, data) => callback(data)),
  sendRegionSelected: (region) => ipcRenderer.send('screen-region-selected', region),

  // Alışkanlık işlemleri
  createHabit: (title, totalDays) => ipcRenderer.invoke('create-habit', title, totalDays),
  getHabits: () => ipcRenderer.invoke('get-habits'),
  toggleHabitDay: (habitId, day) => ipcRenderer.invoke('toggle-habit-day', habitId, day),
  deleteHabit: (id) => ipcRenderer.invoke('delete-habit', id),

  // Veri değişikliği bildirimi (kelime/not eklendi)
  onDataChanged: (callback) => ipcRenderer.on('data-changed', (_e, mode) => callback(mode)),
});
