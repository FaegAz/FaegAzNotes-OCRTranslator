# FaegAz Notes

Windows için modern, minimalist bir masaüstü not uygulaması. Glassmorphism tasarım, floating panel ve OCR desteği ile gelir.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Özellikler

- 📝 **Notlar** — Hızlı not alma, inline düzenleme
- ✅ **Görevler** — Yapılacaklar listesi, tamamlama takibi
- 🔤 **Kelimeler** — İngilizce → Türkçe kelime kartları, otomatik çeviri
- 📅 **Takvim** — Aylık görünüm, gün bazında etkinlik ekleme
- ☑ **Alışkanlık Takibi** — Günlük alışkanlık çizelgesi
- 🔲 **Floating Panel** — `Alt+Shift+1` kısayoluyla her yerden erişilebilen şeffaf panel
- 📷 **OCR** — Ekrandan kelime seç → otomatik tanı ve çeviri *(Python gerektirir)*
- 🎨 **Glassmorphism UI** — Özel pencere kontrolleri, animasyonlu sidebar

---

## Kurulum ve Çalıştırma

### Hazır EXE (Önerilen)

1. Repoyu klonla veya ZIP olarak indir
2. `dist/win-unpacked/` klasörüne git
3. `FaegAz Notes.exe` dosyasını çalıştır

> ⚠️ Windows "Bilinmeyen Yayıncı" uyarısı verirse **"Yine de çalıştır"** seçeneğini seç.

---

### Kaynak koddan çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Uygulamayı başlat
npm start
```

**Gereksinimler:** [Node.js 18+](https://nodejs.org)

---

## OCR Özelliği (Opsiyonel)

Ekrandan kelime seçme özelliği için Python ve gerekli paketlerin kurulu olması gerekir:

```bash
pip install easyocr pillow numpy
```

Çeviri için Argos Translate (offline) veya internet bağlantısı (MyMemory API) kullanılır.

> OCR kullanmıyorsan bu adımı atlayabilirsin, diğer tüm özellikler tam çalışır.

---

## Teknolojiler

| | |
|---|---|
| Çerçeve | Electron 33 |
| Veritabanı | SQLite (sql.js) |
| OCR | EasyOCR (Python) |
| Çeviri | MyMemory API / Argos Translate |
| UI | Vanilla HTML/CSS/JS |

---

## Lisans

MIT — Türker Yağız Odabaş
