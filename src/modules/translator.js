/**
 * translator.js — Çeviri motoru (değiştirilebilir yapı)
 *
 * En üstteki ENGINE değişkenini değiştirerek farklı motorlara geçebilirsin:
 *   'argos'          → Offline, Python gerekli (varsayılan)
 *   'libretranslate'  → Online, ücretsiz
 *   'mymemory'        → Online, ücretsiz, API key gerektirmez
 */
// const ENGINE = 'argos';
// const ENGINE = 'libretranslate';
const ENGINE = 'mymemory';

/**
 * İngilizce → Türkçe çeviri
 * @param {string} text — çevrilecek metin
 * @returns {string} — Türkçe karşılık
 */
async function translate(text) {
  switch (ENGINE) {
    case 'argos':
      return translateArgos(text);
    case 'libretranslate':
      return translateLibre(text);
    case 'mymemory':
      return translateMyMemory(text);
    default:
      return text;
  }
}

// ── Argos Translate (offline, Python) ──
async function translateArgos(text) {
  const { execFile } = require('child_process');
  return new Promise((resolve, reject) => {
    // Python script ile Argos Translate çağırıyoruz
    execFile('python', [
      '-c',
      `
import argostranslate.translate
import sys
result = argostranslate.translate.translate("${text.replace(/"/g, '\\"')}", "en", "tr")
print(result)
      `.trim(),
    ], { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Argos çeviri hatası:', stderr);
        resolve(text); // Hata durumunda orijinal metni döndür
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// ── LibreTranslate (online, ücretsiz) ──
async function translateLibre(text) {
  const response = await fetch('https://libretranslate.com/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'en', target: 'tr' }),
  });
  const data = await response.json();
  return data.translatedText || text;
}

// ── MyMemory (online, ücretsiz, API key gerektirmez) ──
async function translateMyMemory(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|tr`;
  const response = await fetch(url);
  const data = await response.json();
  return data.responseData?.translatedText || text;
}

module.exports = { translate };
