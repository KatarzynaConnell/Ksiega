# Wyszukiwarka kodów PKD 2025

Statyczna strona bez backendu i zależności uruchomieniowych. Otwórz `index.html` bezpośrednio w przeglądarce albo opublikuj cały katalog na dowolnym hostingu statycznym.

Wyszukiwarka korzysta z 728 podklas oficjalnej klasyfikacji GUS PKD 2025. Dane są zapisane w `data/pkd-data.js`, dlatego podczas używania strony nic nie jest wysyłane do sieci.

## Aktualizacja danych

Generator pobiera oficjalny PDF GUS, odczytuje tabelę podklas oraz sprawdza liczbę rekordów, format kodów, kompletność sekcji i unikalność kodów.

```powershell
python -m pip install pdfplumber
python scripts\build-data.py
```

Źródła:

- [GUS — PKD 2025](https://bip.stat.gov.pl/dzialalnosc-statystyki-publicznej/rejestr-regon/pkd-2025/)
- [Oficjalna klasyfikacja PKD 2025 (PDF)](https://klasyfikacje.stat.gov.pl/static/pkd_25/pdf/KlasyfikacjaPKD2025.pdf)

Przed zastosowaniem kodu w sprawie formalnej warto sprawdzić jego szczegółowe objaśnienia i wyłączenia w oficjalnej klasyfikacji.
