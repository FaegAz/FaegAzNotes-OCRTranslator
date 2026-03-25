"""
Argos Translate — İngilizce→Türkçe dil paketini kur.

Bu script ilk seferde ~200MB dil paketi indirir.
Sonraki çalıştırmalarda zaten kuruluysa tekrar indirmez.

Kullanım:
  pip install argostranslate
  python setup-argos.py
"""
import argostranslate.package
import argostranslate.translate

def main():
    print("Argos Translate dil paketleri güncelleniyor...")
    argostranslate.package.update_package_index()

    available = argostranslate.package.get_available_packages()
    # İngilizce → Türkçe paketini bul
    en_tr = next(
        (p for p in available if p.from_code == "en" and p.to_code == "tr"),
        None
    )

    if en_tr is None:
        print("HATA: en→tr dil paketi bulunamadı!")
        return

    # Zaten kuruluysa atla
    installed = argostranslate.package.get_installed_packages()
    already = any(p.from_code == "en" and p.to_code == "tr" for p in installed)

    if already:
        print("✓ İngilizce→Türkçe paketi zaten kurulu.")
    else:
        print("İndiriliyor... (bu birkaç dakika sürebilir)")
        argostranslate.package.install_from_path(en_tr.download())
        print("✓ İngilizce→Türkçe paketi başarıyla kuruldu!")

    # Test
    result = argostranslate.translate.translate("Hello, how are you?", "en", "tr")
    print(f"Test: 'Hello, how are you?' → '{result}'")

if __name__ == "__main__":
    main()
