const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen } = require('electron');
const path = require('path');
const storage = require('../modules/storage');
const ocr = require('../modules/ocr');
const translator = require('../modules/translator');

let mainWindow = null;
let floatingPanel = null;
let tray = null;
let selectWinPreloaded = null;

function preloadSelectWin() {
  if (selectWinPreloaded && !selectWinPreloaded.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size;
  selectWinPreloaded = new BrowserWindow({
    width, height, x: 0, y: 0,
    frame: false, transparent: true, alwaysOnTop: true,
    fullscreen: true, skipTaskbar: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  selectWinPreloaded.loadFile(path.join(__dirname, '../renderer/screen-select.html'));
  selectWinPreloaded.once('closed', () => { selectWinPreloaded = null; });
}

// ── Ana Pencere (780×540) ──
function createMainWindow() {
  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, '../../logo-square.png'),
    width: 780,
    height: 540,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#080810',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/main.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Kapatınca tray'e küçül, floating panel'i de gizle
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (floatingPanel && !floatingPanel.isDestroyed()) floatingPanel.hide();
    }
  });
}

// ── Floating Panel (272×480, always-on-top, transparent) ──
function createFloatingPanel() {
  if (floatingPanel && !floatingPanel.isDestroyed()) {
    floatingPanel.isVisible() ? floatingPanel.hide() : floatingPanel.show();
    return;
  }

  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  floatingPanel = new BrowserWindow({
    icon: path.join(__dirname, '../../logo-square.png'),
    width: 272,
    height: 480,
    x: screenW - 290,
    y: Math.round(screenH / 2 - 240),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  floatingPanel.loadFile(path.join(__dirname, '../renderer/index.html'));

  floatingPanel.on('closed', () => {
    floatingPanel = null;
  });

  // Seçim penceresini arka planda yükle — scan anında hazır olsun
  preloadSelectWin();
}

// ── Sistem Tepsisi (Tray) ──
function createTray() {
  // Tray ikonu — basit bir 16x16 veri URI kullanıyoruz
  // Gerçek projede build/icon.ico kullanılır
  const iconPath = path.join(__dirname, '../../logo-square.png');
  const { nativeImage } = require('electron');

  // Eğer ikon dosyası yoksa boş bir ikon oluştur
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) throw new Error('empty');
  } catch {
    // 16x16 basit mor ikon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('FaegAz Notes');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Aç', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: 'Floating Panel', click: () => createFloatingPanel() },
    { type: 'separator' },
    { label: 'Çıkış', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ── IPC Kanalları ──
function setupIPC() {
  // Pencere kontrolleri
  ipcMain.on('hide-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.hide();
  });

  ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.isMaximized() ? win.unmaximize() : win.maximize();
    }
  });

  ipcMain.on('open-floating-panel', () => createFloatingPanel());

  // Not işlemleri
  ipcMain.handle('add-note', (_e, content, title) => storage.addNote(content, title));
  ipcMain.handle('update-note-title', (_e, id, title) => storage.updateNoteTitle(id, title));
  ipcMain.handle('add-word', (_e, original, translated) => storage.addWord(original, translated));
  ipcMain.handle('get-notes', () => storage.getNotes());
  ipcMain.handle('delete-note', (_e, id) => storage.deleteNote(id));
  ipcMain.handle('search-notes', (_e, query) => storage.searchNotes(query));

  // Görev işlemleri
  ipcMain.handle('add-todo', (_e, text) => storage.addTodo(text));
  ipcMain.handle('get-todos', () => storage.getTodos());
  ipcMain.handle('toggle-todo', (_e, id) => storage.toggleTodo(id));
  ipcMain.handle('delete-todo', (_e, id) => storage.deleteTodo(id));

  // Alışkanlık
  ipcMain.handle('create-habit', (_e, title, totalDays) => storage.createHabit(title, totalDays));
  ipcMain.handle('get-habits', () => storage.getHabits());
  ipcMain.handle('toggle-habit-day', (_e, habitId, day) => storage.toggleHabitDay(habitId, day));
  ipcMain.handle('delete-habit', (_e, id) => storage.deleteHabit(id));

  // Takvim
  ipcMain.handle('add-calendar-event', (_e, date, text) => storage.addCalendarEvent(date, text));
  ipcMain.handle('get-calendar-events', (_e, year, month) => storage.getCalendarEvents(year, month));
  ipcMain.handle('delete-calendar-event', (_e, id) => storage.deleteCalendarEvent(id));

  // OCR + Çeviri
  ipcMain.handle('capture-screen', async () => {
    const screenshot = require('screenshot-desktop');
    const img = await screenshot({ format: 'png' });
    return img.toString('base64');
  });

  ipcMain.handle('ocr-and-translate', async (_e, imageBase64, region) => {
    const { text, translated } = await ocr.recognize(imageBase64, region);
    if (!text || !text.trim()) return { error: 'Metin bulunamadı' };
    return { original: text.trim(), translated };
  });

  // Tam ekran OCR seçimi — floating panel'den tetiklenir
  ipcMain.handle('start-screen-capture', async (_e, mode = 'word') => {
    const screenshot = require('screenshot-desktop');

    // 1. Floating panel'i gizle
    if (floatingPanel && !floatingPanel.isDestroyed()) {
      floatingPanel.hide();
    }
    await new Promise((r) => setTimeout(r, 150));

    // 2. Ekran görüntüsü al
    let base64;
    try {
      const img = await screenshot({ format: 'png' });
      base64 = img.toString('base64');
      console.log('[OCR] Ekran yakalandı, boyut:', img.length, 'byte');
    } catch (err) {
      console.error('[OCR] Ekran yakalama hatası:', err);
      if (floatingPanel && !floatingPanel.isDestroyed()) floatingPanel.show();
      return { error: 'Ekran yakalanamadı' };
    }

    // 3. Seçim penceresi — ön yüklüyse direkt kullan, yoksa yeni oluştur
    return new Promise(async (resolve) => {
      let resolved = false;
      const done = (result) => {
        if (resolved) return;
        resolved = true;
        if (floatingPanel && !floatingPanel.isDestroyed()) floatingPanel.show();
        // Bir sonraki scan için arka planda yeni pencere hazırla
        preloadSelectWin();
        resolve(result);
      };

      let selectWin;
      if (selectWinPreloaded && !selectWinPreloaded.isDestroyed()) {
        selectWin = selectWinPreloaded;
        selectWinPreloaded = null;
      } else {
        const display = screen.getPrimaryDisplay();
        const { width, height } = display.size;
        selectWin = new BrowserWindow({
          width, height, x: 0, y: 0,
          frame: false, transparent: true, alwaysOnTop: true,
          fullscreen: true, skipTaskbar: true, show: false,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
          },
        });
        selectWin.loadFile(path.join(__dirname, '../renderer/screen-select.html'));
        await new Promise((r) => selectWin.webContents.once('did-finish-load', r));
      }

      // Ekran görüntüsünü gönder ve pencereyi göster
      if (!selectWin.isDestroyed()) {
        selectWin.webContents.send('screen-image', base64);
        selectWin.show();
      }

      // Seçim veya iptal
      const handler = async (_e, region) => {
        console.log('[OCR] Bölge alındı:', region);

        if (!selectWin.isDestroyed()) selectWin.close();

        if (!region) {
          done(null);
          return;
        }

        try {
          console.log('[OCR] OCR başlıyor...');
          const { text, translated } = await ocr.recognize(base64, region);

          if (!text || !text.trim()) {
            done({ error: 'Metin bulunamadı' });
            return;
          }

          if (mode === 'note') {
            storage.addNote(text.trim(), '');
          } else {
            storage.addWord(text.trim(), translated);
          }

          // Her iki pencereye bildir — listeler yeniden yüklensin
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('data-changed', mode);
          }
          if (floatingPanel && !floatingPanel.isDestroyed()) {
            floatingPanel.webContents.send('data-changed', mode);
          }

          done({ original: text.trim(), translated });
        } catch (err) {
          console.error('[OCR] Hata:', err);
          done({ error: err.message });
        }
      };

      ipcMain.once('screen-region-selected', handler);

      // Pencere kapanırsa (ESC ile screen-select kapattığında)
      selectWin.once('closed', () => {
        ipcMain.removeListener('screen-region-selected', handler);
        done(null);
      });
    });
  });
}

// ── Uygulama Başlatma ──
app.whenReady().then(async () => {
  await storage.init();
  createMainWindow();
  createTray();
  setupIPC();

  // Alt+Shift+1 → Floating Panel aç/kapat
  globalShortcut.register('Alt+Shift+1', () => createFloatingPanel());
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  storage.close();
});

app.on('window-all-closed', () => {
  // Windows'ta tüm pencereler kapansa bile uygulamayı kapatma (tray'de kalacak)
});

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
});
