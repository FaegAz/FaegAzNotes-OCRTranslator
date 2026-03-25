/**
 * ocr.js — PaddleOCR ile OCR
 *
 * Sharp ile kırpıp işlenmiş görüntüyü, kalıcı bir Python
 * daemon'a (ocr_easyocr.py) JSON Lines protokolüyle gönderir.
 * Daemon model yüklemeyi sadece bir kez yapar → hızlı yanıt.
 */
const { spawn } = require('child_process');
const path = require('path');

let pyProc = null;
let pendingResolvers = [];
let lineBuffer = '';

function getPyProc() {
  if (pyProc && !pyProc.killed) return pyProc;

  const scriptPath = path.join(__dirname, '../../ocr_easyocr.py');

  // Windows'ta "python", diğerlerinde "python3" dene
  const cmd = process.platform === 'win32' ? 'python' : 'python3';
  pyProc = spawn(cmd, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

  pyProc.stderr.on('data', (d) => {
    console.log('[EasyOCR stderr]', d.toString().trim());
  });

  pyProc.stdout.on('data', (data) => {
    lineBuffer += data.toString();
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop(); // son tamamlanmamış satırı sakla

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const resolver = pendingResolvers.shift();
      if (!resolver) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.error) resolver.reject(new Error(parsed.error));
        else resolver.resolve({ text: parsed.text || '', translated: parsed.translated || '' });
      } catch (e) {
        resolver.reject(new Error('JSON parse hatası: ' + trimmed));
      }
    }
  });

  pyProc.on('exit', (code) => {
    console.warn('[EasyOCR] Daemon kapandı, kod:', code);
    pyProc = null;
    // Bekleyen istekleri hatayla sonlandır
    for (const r of pendingResolvers) r.reject(new Error('EasyOCR daemon kapandı'));
    pendingResolvers = [];
  });

  return pyProc;
}

/**
 * Sharp ile kırp → 3x büyüt → gri ton → netleştir
 */
async function preprocessWithSharp(buffer, region) {
  try {
    const sharp = require('sharp');
    const processed = await sharp(buffer)
      .extract({
        left: Math.max(0, region.x),
        top: Math.max(0, region.y),
        width: Math.max(1, region.w),
        height: Math.max(1, region.h),
      })
      .greyscale()
      .normalise()
      .png()
      .toBuffer();
    console.log('[OCR] Sharp: kırpıldı', region.w, 'x', region.h);
    return processed;
  } catch (err) {
    console.warn('[OCR] Sharp başarısız, orijinal görüntü kullanılacak:', err.message);
    return null;
  }
}

/**
 * Ekran görüntüsünden metin çıkar
 */
async function recognize(imageBase64, region) {
  const buffer = Buffer.from(imageBase64, 'base64');

  let imageToOcr = buffer;

  if (region) {
    console.log('[OCR] Seçilen bölge:', JSON.stringify(region));
    const processed = await preprocessWithSharp(buffer, region);
    if (processed) imageToOcr = processed;
  }

  const proc = getPyProc();
  const base64Image = imageToOcr.toString('base64');

  const result = await new Promise((resolve, reject) => {
    pendingResolvers.push({ resolve, reject });
    proc.stdin.write(JSON.stringify({ image: base64Image }) + '\n');
  });

  const text = result.text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const translated = result.translated.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  console.log('[OCR] Tanınan metin:', JSON.stringify(text));
  console.log('[OCR] Çeviri:', JSON.stringify(translated));
  return { text, translated };
}

module.exports = { recognize };
