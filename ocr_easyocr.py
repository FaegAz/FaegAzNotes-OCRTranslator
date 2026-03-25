"""
EasyOCR daemon — FaegAz Notes için OCR motoru.

Kurulum:
  pip install easyocr argostranslate

Kullanım (otomatik, ocr.js tarafından spawn edilir):
  python ocr_easyocr.py

Protokol (JSON Lines, stdin/stdout):
  İstek  (stdin):  {"image": "<base64 PNG>"}
  Yanıt (stdout): {"text": "..."}  veya  {"error": "..."}
"""
import sys
import os
import json
import base64
import io

import numpy as np
from PIL import Image
import easyocr
import argostranslate.translate

# ── Çeviri ──
_translation = None

def get_translation():
    global _translation
    if _translation is None:
        installed = argostranslate.translate.get_installed_languages()
        from_lang = next((l for l in installed if l.code == 'en'), None)
        to_lang = next((l for l in installed if l.code == 'tr'), None)
        if from_lang and to_lang:
            _translation = from_lang.get_translation(to_lang)
    return _translation

def translate_online(text):
    """Argos yüklü değilse MyMemory API'ye düş (internet gerekli)."""
    try:
        import urllib.request, urllib.parse
        url = ('https://api.mymemory.translated.net/get?q='
               + urllib.parse.quote(text) + '&langpair=en|tr')
        with urllib.request.urlopen(url, timeout=6) as resp:
            data = json.loads(resp.read().decode())
            result = data.get('responseData', {}).get('translatedText', '')
            return result if result else text
    except Exception:
        return text

def translate(text):
    try:
        t = get_translation()
        if not t:
            sys.stderr.write('[Argos] Dil paketi bulunamadı, online çeviri kullanılıyor.\n')
            sys.stderr.flush()
            return translate_online(text)
        result = t.translate(text)
        input_words = len(text.split())
        words = result.split()
        if not words:
            return text
        # Çıktı girdi uzunluğunun 2 katından fazlaysa tekrar var demektir
        # → sadece ilk [input_words] kelimeyi al
        if len(words) > input_words * 2:
            return ' '.join(words[:max(1, input_words)])
        # Tüm kelimeler aynıysa tek kelime döndür
        if len(set(words)) == 1:
            return words[0]
        # Ardışık tekrarları kaldır
        deduped = [words[0]]
        for w in words[1:]:
            if w != deduped[-1]:
                deduped.append(w)
        return ' '.join(deduped)
    except Exception:
        return translate_online(text)

# ── Modelleri yükle ──
reader = easyocr.Reader(['en'], gpu=False, verbose=False)
sys.stderr.write('[EasyOCR] Model yüklendi, hazır.\n')
sys.stderr.flush()

# Argostranslate çeviri modelini başlangıçta yükle (ilk istekte gecikme olmasın)
get_translation()

# ── Ana döngü ──
for raw in sys.stdin:
    raw = raw.strip()
    if not raw:
        continue
    try:
        data = json.loads(raw)
        img_bytes = base64.b64decode(data['image'])
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        img_array = np.array(img)

        result = reader.readtext(img_array, decoder='greedy', beamWidth=1, detail=0)

        # Tekrar eden tespitleri kaldır
        seen = set()
        texts = []
        for item in result:
            t = item.strip()
            if t and t not in seen:
                seen.add(t)
                texts.append(t)
        text = ' '.join(texts)
        translated = translate(text) if text else ''
        print(json.dumps({'text': text, 'translated': translated}), flush=True)
    except Exception as exc:
        print(json.dumps({'error': str(exc)}), flush=True)
