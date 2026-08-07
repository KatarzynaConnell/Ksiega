# Dane testowe księgi gości

Plik `seed.sql` dodaje dokładnie 100 rekordów do `public.wpisy`: 80 typowych i 20 przypadków brzegowych.

## Spójność strukturalna

- `id` nie jest wpisywany ręcznie. Unikalność pozostaje odpowiedzialnością mechanizmu `identity`/sekwencji skonfigurowanego w tabeli.
- `data_dodania` zawsze otrzymuje jawny literał `timestamptz` z przesunięciem `+00`. Rekordy typowe mają deterministyczne, unikalne czasy.
- `tekst` zawsze jest wartością typu `text` i nie jest `NULL`.
- Najdłuższy rekord jest programowo ograniczony do 499 znaków, czyli mieści się w limicie interfejsu wynoszącym 500 znaków.
- Seed jest wykonywany w transakcji. Błąd powoduje wycofanie całego zestawu zamiast pozostawienia części danych.

Tabela `wpisy` nie zawiera kolumn z imieniem ani e-mailem. Nazwy występują wyłącznie jako realistyczna część treści. Tożsamości oraz unikalność adresów e-mail należą do `auth.users` i są wymuszane przez Supabase Auth, dlatego seed celowo nie modyfikuje schematu `auth`.

## Przypadki brzegowe

Zestaw obejmuje Unicode, emoji, tekst RTL i CJK, apostrofy, znaki HTML, adres z aliasem `+`, URL z parametrami, tekst bliski limitowi długości, pojedynczy znak, nową linię, tabulatory, zewnętrzne spacje, dwa identyczne znaczniki czasu oraz daty historyczną i przyszłą.

Łańcuch przypominający `<script>` jest bezpiecznym testem prezentacji. Interfejs powinien wyświetlić go przez `textContent`, a nie interpretować jako HTML.

## Sortowanie

Dwa rekordy celowo współdzielą `data_dodania`. Stabilne zapytanie powinno używać dwóch kluczy:

```sql
order by data_dodania desc, id desc
```

Obecny endpoint sortuje tylko po `id desc`. Przypadki z datą historyczną, przyszłą i identycznymi czasami ujawnią, czy jest to oczekiwane zachowanie produktu.

## Uruchomienie

Uruchom `seed.sql` wyłącznie w testowym projekcie Supabase, najlepiej przez SQL Editor. Przed ponownym wykonaniem pamiętaj, że skrypt dodaje kolejnych 100 rekordów; nie jest przeznaczony do wielokrotnego uruchamiania bez uprzedniego wyczyszczenia danych testowych.
