-- Zestaw 100 deterministycznych rekordów testowych dla public.wpisy.
-- Skrypt nie ustawia id: unikalność zapewnia identity/sequence tabeli.
-- Można go uruchomić w Supabase SQL Editor na środowisku testowym.

begin;

-- 80 realistycznych wpisów. Każdy ma poprawny tekst i unikalny timestamptz.
with dane as (
  select
    array[
      'Anna Kowalska', 'Michał Nowak', 'Katarzyna Wiśniewska', 'Piotr Wójcik',
      'Agnieszka Kamińska', 'Tomasz Lewandowski', 'Monika Zielińska', 'Paweł Szymański',
      'Joanna Woźniak', 'Marcin Dąbrowski', 'Natalia Kozłowska', 'Jakub Jankowski',
      'Aleksandra Mazur', 'Łukasz Krawczyk', 'Zofia Piotrowska', 'Adam Grabowski'
    ]::text[] as osoby,
    array[
      '%s: Dziękuję za niezwykle ciepłe przyjęcie i pięknie spędzony czas.',
      '%s: To miejsce ma wyjątkową atmosferę. Z przyjemnością tutaj wrócę!',
      '%s: Wspaniałe wspomnienia, serdeczni ludzie i mnóstwo powodów do uśmiechu.',
      '%s: Bardzo dziękuję za gościnność. Ten dzień na długo zostanie w mojej pamięci.',
      '%s: Było naprawdę cudownie — wszystko przygotowane z sercem i dbałością o szczegóły.'
    ]::text[] as szablony
), wygenerowane as (
  select
    format(
      dane.szablony[((g - 1) % array_length(dane.szablony, 1)) + 1],
      dane.osoby[((g - 1) % array_length(dane.osoby, 1)) + 1]
    ) as tekst,
    timestamptz '2026-08-01 18:00:00+00' - make_interval(mins => g) as data_dodania
  from generate_series(1, 80) as seria(g)
  cross join dane
)
insert into public.wpisy (tekst, data_dodania)
select tekst, data_dodania
from wygenerowane;

-- 20 kontrolowanych przypadków brzegowych. Wszystkie zachowują typy kolumn.
insert into public.wpisy (tekst, data_dodania) values
  ('Krótko i na temat: super!',                                      '2026-08-02 08:00:00+00'),
  ('👍 Świetne miejsce! 🎉✨',                                       '2026-08-02 08:01:00+00'),
  ('Zażółć gęślą jaźń — poprawne polskie znaki: ąćęłńóśźż.',         '2026-08-02 08:02:00+00'),
  ('„Cytat”, apostrof: O''Connor, ukośnik \\ i średnik; bez problemu.', '2026-08-02 08:03:00+00'),
  ('<script>alert("test")</script> powinno zostać pokazane jako tekst.', '2026-08-02 08:04:00+00'),
  ('Znaki HTML: < > & oraz encje: &amp; &lt; &gt;.',                 '2026-08-02 08:05:00+00'),
  ('Adres testowy: anna.kowalska+ksiega@example.com',               '2026-08-02 08:06:00+00'),
  ('Link z parametrami: https://example.com/wizyta?from=księga&ok=true', '2026-08-02 08:07:00+00'),
  (left(repeat('Bardzo dziękuję za wspaniałe spotkanie. ', 20), 499), '2026-08-02 08:08:00+00'),
  ('A',                                                             '2026-08-02 08:09:00+00'),
  (E'Wpis w dwóch liniach.\nDruga linia powinna pozostać czytelna.', '2026-08-02 08:10:00+00'),
  (E'Tabulator\tmiędzy\tsłowami.',                                 '2026-08-02 08:11:00+00'),
  ('  Spacje na początku i na końcu powinny ujawnić zasady trimowania.  ', '2026-08-02 08:12:00+00'),
  ('العربية: شكراً على الاستضافة الجميلة.',                         '2026-08-02 08:13:00+00'),
  ('日本語テスト：素敵な時間をありがとうございました。',               '2026-08-02 08:14:00+00'),
  ('Łączenie Unicode: café oraz naïve — wygląd może zależeć od normalizacji.', '2026-08-02 08:15:00+00'),
  ('Pierwszy wpis z identycznym znacznikiem czasu.',                 '2026-08-02 08:16:00+00'),
  ('Drugi wpis z identycznym znacznikiem czasu.',                    '2026-08-02 08:16:00+00'),
  ('Data historyczna sprawdza dolną granicę sortowania.',            '2000-01-01 00:00:00+00'),
  ('Data przyszła sprawdza zachowanie sortowania chronologicznego.', '2035-12-31 23:59:59+00');

-- Walidacja liczby i podstawowej spójności dodanego zestawu.
do $$
declare
  liczba integer;
begin
  select count(*) into liczba
  from public.wpisy
  where data_dodania between '2000-01-01 00:00:00+00' and '2035-12-31 23:59:59+00';

  if liczba < 100 then
    raise exception 'Po seedowaniu oczekiwano co najmniej 100 rekordów, znaleziono %', liczba;
  end if;
end $$;

commit;

-- Szybka kontrola po wykonaniu:
-- select id, tekst, data_dodania
-- from public.wpisy
-- order by data_dodania desc, id desc
-- limit 25;
