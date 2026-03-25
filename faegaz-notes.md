# FaegAz Notes — Proje Dokümantasyonu

## Nedir?
Windows masaüstü overlay uygulaması. `Alt+Shift+1` kısayoluyla herhangi bir ekranda (oyun, tarayıcı, fark etmez) açılır. Her zaman en üstte (always-on-top) durur, serbest taşınabilir penceredir.

---

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Masaüstü çerçevesi | Electron |
| Arayüz | HTML + CSS + Vanilla JS |
| Çeviri / OCR | Argos Translate (offline, Python) + Tesseract.js (offline) |
| Veritabanı | better-sqlite3 |
| Ekran görüntüsü | screenshot-desktop |

---

## Klasör Yapısı

```
faegaz-notes/
├── src/
│   ├── main/
│   │   ├── index.js          # Electron ana süreç — pencere, kısayollar, IPC
│   │   └── preload.js        # Güvenli IPC köprüsü (contextBridge)
│   ├── renderer/
│   │   ├── index.html        # Ana arayüz
│   │   └── app.js            # UI mantığı
│   └── modules/
│       ├── translator.js     # Çeviri motoru (değiştirilebilir yapı)
│       ├── ocr.js            # Tesseract OCR
│       └── storage.js        # SQLite not/görev saklama
├── package.json
└── README.md
```

---

## UI Tasarım Kararları

### Genel Estetik
- **Tema:** Koyu (dark), arka plan `#080810`
- **Stil:** Glassmorphism — yarı saydam cam yüzeyler, backdrop-filter blur
- **His:** Minimal ve sade. Gereksiz hiçbir element yok.
- **Vurgu:** Mor → sarı neon gradyan (`#a855f7` → `#eab308`)
- **Animasyonlar:** Sadece aç/kapat için hafif fade. Başka animasyon yok.

### Renkler

```css
:root {
  --bg-base: rgba(12, 10, 20, 0.82);
  --bg-surface: rgba(168, 85, 247, 0.06);
  --bg-plain: rgba(255, 255, 255, 0.03);
  --bg-hover: rgba(255, 255, 255, 0.06);
  --bg-input: rgba(255, 255, 255, 0.04);

  --glass-border: rgba(168, 85, 247, 0.18);
  --backdrop: blur(28px) saturate(180%);

  --accent-purple: #a855f7;
  --accent-yellow: #eab308;
  --accent-purple-dim: rgba(168, 85, 247, 0.15);
  --accent-yellow-dim: rgba(234, 179, 8, 0.07);

  --gradient: linear-gradient(90deg, #c084fc, #a855f7, #eab308);

  --text-primary: rgba(255, 255, 255, 0.90);
  --text-secondary: rgba(255, 255, 255, 0.62);
  --text-hint: rgba(255, 255, 255, 0.18);
  --text-disabled: rgba(255, 255, 255, 0.16);

  --radius: 12px;
  --radius-sm: 9px;
  --radius-xs: 8px;
}
```

### Tipografi
- **Font:** `'Inter'` — Google Fonts
- **Boyutlar:** 12.5px başlık, 11.5px içerik, 10px meta/hint
- **Ağırlık:** 300 light, 400 normal, 500 medium, 600 sadece uygulama adı
- **Uygulama adı:** `var(--gradient)` ile `background-clip: text` gradyan efekti

### Pencere
- Boyut: **272 × 480px** varsayılan
- Yeniden boyutlandırılabilir: evet
- `frame: false` — özel başlık çubuğu
- `transparent: true`
- `alwaysOnTop: true`
- `backgroundColor: '#00000000'`

### Glassmorphism Uygulaması

```css
.window {
  background: var(--bg-base);
  backdrop-filter: var(--backdrop);
  -webkit-backdrop-filter: var(--backdrop);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.08) inset;
}
```

> **Not:** Electron'da `transparent: true` ve `backgroundColor: '#00000000'`
> ayarı yapılmazsa backdrop-filter çalışmaz.

---

## Komponentler

### 1. Başlık Çubuğu
- Sol: mor→sarı gradyan nokta + **"FaegAz Notes"** (gradyan metin)
- Sağ: `Alt+Shift+1` badge (mor tonlu) + kapat butonu
- `-webkit-app-region: drag` ile sürüklenebilir
- Butonlar `-webkit-app-region: no-drag`

### 2. Tab Bar
- 2 sekme: **Notlar / Görevler**
- Aktif sekme: gradyan alt çizgi (`linear-gradient(90deg, #a855f7, #eab308)`)
- Pasif sekme: `--text-hint` rengi

### 3. Notlar Paneli
- **Normal not kartı:** `--bg-plain` arka plan, mor sol kenar
- **Kelime kartı:** `--accent-yellow-dim` arka plan, sarı sol kenar
  - Üst satır: İngilizce kelime (italik, sarı ton)
  - Alt satır: Türkçe karşılık (beyaz, medium)
  - Sağ: "çeviri" badge
- Çift tıklama: notu sil
- Notların altında ince gradyan ayırıcı çizgi

### 4. Input Alanı (Notlar sekmesi altı)
İki elemanlı dikey grup:
```
[ Not ekle...input alanı    ] [ + ]
[ ⬚  Ekrandan kelime seç       tıkla ]
```
- Üst satır: textarea + "+" ekle butonu
- Alt satır: **"Ekrandan kelime seç"** butonu
  - Sol: küçük kare ikon (mor kenarlık)
  - Orta: buton etiketi
  - Sağ: "tıkla" hint metni
  - Tıklanınca ekran seçim moduna girer

### 5. Görevler Paneli
- Her satır: yuvarlak checkbox + metin
- Tamamlanan checkbox: mor dolgu + ✓
- Tamamlanan metin: üstü çizili, `--text-hint`
- Hover'da sil butonu belirir (sağdan kayar)

### 6. Ekrandan Kelime Seç (OCR Modu)
- **"Ekrandan kelime seç"** butonuna basınca tetiklenir
- Tam ekran yarı saydam karartma açılır
- Kullanıcı mouse ile kelime/bölge seçer
- Bırakınca: OCR → Argos Translate → kelime kartı olarak notlara eklenir
- ESC ile iptal

---

## Kısayollar

| Kısayol | İşlev |
|---|---|
| `Alt+Shift+1` | Paneli aç / kapat |
| `Enter` | Not / görev kaydet |
| `ESC` | Ekran seçimini iptal et |

---

## Not Veri Yapısı

```js
// Normal not
{ id, type: 'note', content: 'Iron plate = 30/dk', created_at }

// Kelime kartı (OCR'dan gelen)
{ id, type: 'word', original: 'resilient', translated: 'dayanıklı, esnek', created_at }
```

SQLite'da tek `notes` tablosunda `type` kolonuyla ayrışır.

---

## Çeviri Modülü — Değiştirilebilir Yapı

`src/modules/translator.js` dosyasının en üstündeki tek satırı değiştirerek motor değişir:

```js
const ENGINE = 'argos'           // varsayılan — offline
// const ENGINE = 'libretranslate'  // online, ücretsiz
// const ENGINE = 'deepl'           // online, daha kaliteli
```

---

## IPC Kanalları (main ↔ renderer)

| Kanal | Yön | İşlev |
|---|---|---|
| `hide-window` | renderer → main | Pencereyi gizle |
| `capture-screen` | renderer → main | Tam ekran görüntüsü al (base64) |
| `ocr-and-translate` | renderer → main | Bölgeden OCR + çeviri yap |
| `add-note` | renderer → main | Not ekle |
| `add-word` | renderer → main | Kelime kartı ekle |
| `get-notes` | renderer → main | Tüm notları getir |
| `delete-note` | renderer → main | Not sil |
| `add-todo` | renderer → main | Görev ekle |
| `get-todos` | renderer → main | Görevleri getir |
| `toggle-todo` | renderer → main | Görevi tamamla/geri al |
| `delete-todo` | renderer → main | Görev sil |

---

## Ana Pencere

### Genel
- Boyut: **780 × 540px** varsayılan, yeniden boyutlandırılabilir
- Normal pencere çerçevesi (frame: true)
- Kapatınca sistem tepsisine küçülür, uygulama arka planda çalışmaya devam eder
- Tray ikonuna çift tıklayınca tekrar açılır

### Layout — İki Sütun

```
[ Sidebar 200px ] [ Ana içerik — flex:1 ]
```

### Sidebar

**Üst — Başlık & Arama**
- Uygulama adı: gradyan nokta + "FaegAz Notes" (mor→sarı gradyan metin)
- Arama kutusu: `rgba(255,255,255,0.04)` arka plan, arama ikonu + placeholder

**Orta — Navigasyon**
- 3 nav item: Notlar / Görevler / Kelimeler
- Her item: küçük renkli ikon + etiket + sağda adet badge
  - Notlar ikonu: mor (`rgba(168,85,247,0.15)`)
  - Kelimeler ikonu: sarı (`rgba(234,179,8,0.12)`)
  - Görevler ikonu: gri
- Aktif item: `rgba(168,85,247,0.12)` arka plan, mor kenarlık

**Alt — Floating Panel Butonu**
- Tam genişlik buton
- Sol: gradyan nokta + "Floating Panel" yazısı
- Sağ: `Alt+Shift+1` badge
- Tıklayınca floating panel'i açar

### Ana İçerik Alanı

**Topbar**
- Sol: sayfa başlığı (aktif sekmeye göre "Notlar" / "Görevler" / "Kelimeler")
- Sağ: "Sırala" ghost buton + "+ Yeni Not" accent buton

**Not Listesi**
- Section label: "Son eklenenler" (10px, uppercase, hint rengi)
- Not kartı:
  - `rgba(255,255,255,0.03)` arka plan, sol kenar `rgba(168,85,247,0.4)` 2px
  - Üst satır: not başlığı (sol) + tarih (sağ, hint rengi)
  - Alt satır: önizleme metni (2 satır, ikincil renk)
  - Aktif kart: `rgba(168,85,247,0.07)` arka plan, mor kenarlık

**Kelime Listesi**
- Section label: "Son kaydedilen kelimeler"
- Kelime kartı:
  - `rgba(234,179,8,0.05)` arka plan, sarı sol kenar
  - Sıra: İngilizce (italik, sarı ton) → ok → Türkçe (beyaz, medium) → "çeviri" badge (sağda)

**Görev Listesi**
- Tek bir kart içinde satırlar
- Her satır: yuvarlak checkbox + metin
- Tamamlanan: mor checkbox + üstü çizili metin

### Sistem Tepsisi (Tray)
- Uygulama kapanmaz, tray'e küçülür
- Tray menüsü: "Aç", "Floating Panel", "Çıkış"
- Çift tıklama: ana pencereyi öne getirir

---

## Kurulum

```bash
# 1. Bağımlılıkları kur
npm install

# 2. Argos dil paketini kur (Python gerekli)
pip install argostranslate
python setup-argos.py

# 3. Geliştirme modunda başlat
npm start

# 4. EXE çıktısı al
npm run build
```

---

## Notlar

- Veriler `app.getPath('userData')` altında `faegaz.db` dosyasında saklanır
- Argos dil paketleri (~200MB) ilk kurulumda bir kere indirilir, sonra tamamen offline çalışır
- Başka bilgisayara taşımak için: `npm run build` → çıkan `.exe` dosyasını kopyala
- Electron `contextIsolation: true` + `nodeIntegration: false` — güvenli yapı
