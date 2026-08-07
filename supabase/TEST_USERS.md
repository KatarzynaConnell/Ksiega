# Testowi użytkownicy Supabase Auth

Importer `seed-users.mjs` tworzy 20 potwierdzonych kont testowych przez Supabase Auth Admin API. Nie zapisuje haseł w śledzonych plikach. Po utworzeniu kont dane logowania trafiają do lokalnego `supabase/.generated/test-users.json`, który jest ignorowany przez Git.

## Spójność

- Przed wysłaniem danych importer sprawdza podstawową składnię każdego adresu e-mail.
- E-maile są porównywane po zamianie na małe litery, co zapobiega duplikatom różniącym się tylko wielkością znaków.
- Każde hasło ma co najmniej 12 znaków i jest generowane przy użyciu kryptograficznego `randomBytes`.
- Identyfikatory nie są wymyślane lokalnie. Supabase Auth generuje UUID, a importer weryfikuje jego format przed zapisaniem danych logowania.
- `email_confirm: true` umożliwia natychmiastowe logowanie bez wysyłania wiadomości na fikcyjne domeny.
- Metadane `fixture_number` i `test_case` pozwalają deterministycznie sortować oraz rozpoznawać przypadki testowe niezależnie od UUID.

## Przypadki brzegowe

Zestaw zawiera alias `+`, myślnik w części lokalnej, jednoliterowy login, subdomenę, wielkie litery oraz długą część lokalną. Hasła brzegowe sprawdzają polskie znaki, spacje, emoji, apostrof, cudzysłów, ukośnik odwrotny i dużą długość.

Nie dodano celowo niepoprawnych adresów, ponieważ Supabase Auth powinien je odrzucić i nie byłyby rekordami użytkowników. Niepoprawne dane należy testować osobno na poziomie formularza, oczekując błędu walidacji.

## Uruchomienie

1. W `.env` ustaw lokalnie `SUPABASE_SERVICE_ROLE_KEY`. Nie wklejaj go do czatu i nigdy nie udostępniaj frontendowi.
2. Uruchom `npm.cmd run seed:users`.
3. Otwórz lokalny `supabase/.generated/test-users.json`, aby zobaczyć dane logowania.

Skrypt jest częściowo idempotentny: konta zapisane w lokalnym pliku są pomijane. Jeżeli konto istnieje w Supabase, lecz odpowiadający mu lokalny wpis z hasłem zniknął, importer nie resetuje hasła i zgłasza konflikt.
