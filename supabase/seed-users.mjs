import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputPath = join(process.cwd(), 'supabase', '.generated', 'test-users.json');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w pliku .env.');
  process.exit(1);
}

const definitions = [
  ['Anna Kowalska', 'anna.kowalska@example.com', 'standard'],
  ['Michał Nowak', 'michal.nowak@example.com', 'standard'],
  ['Katarzyna Wiśniewska', 'katarzyna.wisniewska@example.com', 'standard'],
  ['Piotr Wójcik', 'piotr.wojcik@example.com', 'standard'],
  ['Agnieszka Kamińska', 'agnieszka.kaminska@example.com', 'standard'],
  ['Tomasz Lewandowski', 'tomasz.lewandowski@example.com', 'standard'],
  ['Monika Zielińska', 'monika.zielinska@example.com', 'standard'],
  ['Paweł Szymański', 'pawel.szymanski@example.com', 'standard'],
  ['Joanna Woźniak', 'joanna.wozniak@example.com', 'standard'],
  ['Marcin Dąbrowski', 'marcin.dabrowski@example.com', 'standard'],
  ['Natalia Kozłowska', 'natalia.kozlowska@example.com', 'standard'],
  ['Jakub Jankowski', 'jakub.jankowski@example.com', 'standard'],
  ['Aleksandra Mazur', 'aleksandra.mazur@example.com', 'standard'],
  ['Łukasz Krawczyk', 'lukasz.krawczyk@example.com', 'unicode-password'],
  ['Ola Nowak', 'ola.nowak+mobile@example.com', 'plus-alias'],
  ['Jan Kowalski', 'jan-kowalski@example.com', 'hyphen-local'],
  ['A. Testowa', 'a@example.com', 'short-local'],
  ['Ewa Subdomena', 'test.user@subdomain.example.com', 'subdomain'],
  ['Upper Case', 'UPPER.case@example.com', 'uppercase-email'],
  ['Bardzo Długi Login', 'very.long.local.part.for.guestbook.testing@example.com', 'long-email']
].map(([fullName, email, testCase], index) => ({
  fixtureNumber: index + 1,
  fullName,
  email,
  testCase
}));

function passwordFor(user) {
  const token = randomBytes(12).toString('base64url');
  if (user.testCase === 'unicode-password') return `Zażółć!${token}Aa1`;
  if (user.testCase === 'plus-alias') return `T3st hasło ${token}!`;
  if (user.testCase === 'hyphen-local') return `T3st🔐${token}!Aa1`;
  if (user.testCase === 'short-local') return `T3st'"\\${token}!Aa1`;
  if (user.testCase === 'long-email') return `T3st!Aa1${randomBytes(48).toString('base64url')}`;
  return `T3st!${token}Aa1`;
}

function validateDefinitions(users) {
  const emails = new Set();
  for (const user of users) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
      throw new Error(`Nieprawidłowy e-mail fixture #${user.fixtureNumber}: ${user.email}`);
    }
    const normalized = user.email.toLowerCase();
    if (emails.has(normalized)) throw new Error(`Powtórzony e-mail: ${user.email}`);
    emails.add(normalized);
  }
}

async function adminFetch(path, options = {}) {
  return fetch(`${supabaseUrl}/auth/v1/admin/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    signal: AbortSignal.timeout(15_000)
  });
}

async function readSavedCredentials() {
  try {
    return JSON.parse(await readFile(outputPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveCredentials(credentials) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
}

validateDefinitions(definitions);

const listResponse = await adminFetch('users?page=1&per_page=1000');
if (!listResponse.ok) {
  console.error(`Nie udało się pobrać użytkowników: HTTP ${listResponse.status}.`);
  process.exit(1);
}

const existingUsers = (await listResponse.json()).users ?? [];
const existingEmails = new Set(existingUsers.map((user) => user.email?.toLowerCase()));
const credentials = await readSavedCredentials();
const savedEmails = new Set(credentials.map((user) => user.email.toLowerCase()));

for (const definition of definitions) {
  const normalizedEmail = definition.email.toLowerCase();

  if (savedEmails.has(normalizedEmail)) {
    console.log(`Pominięto zapisane konto: ${definition.email}`);
    continue;
  }
  if (existingEmails.has(normalizedEmail)) {
    console.error(`Konto już istnieje, ale brak lokalnego hasła: ${definition.email}`);
    process.exitCode = 1;
    continue;
  }

  const password = passwordFor(definition);
  if (password.length < 12) throw new Error(`Hasło jest zbyt krótkie: ${definition.email}`);

  const response = await adminFetch('users', {
    method: 'POST',
    body: JSON.stringify({
      email: definition.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: definition.fullName,
        fixture_number: definition.fixtureNumber,
        test_case: definition.testCase
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(`Błąd ${definition.email}: ${data.message || `HTTP ${response.status}`}`);
    process.exitCode = 1;
    continue;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)) {
    throw new Error(`Supabase zwrócił nieprawidłowy UUID dla ${definition.email}.`);
  }

  credentials.push({
    id: data.id,
    email: definition.email,
    password,
    fullName: definition.fullName,
    testCase: definition.testCase
  });
  savedEmails.add(normalizedEmail);
  await saveCredentials(credentials);
  console.log(`Utworzono ${credentials.length}/20: ${definition.email}`);
}

console.log(`Dane logowania zapisano lokalnie: ${outputPath}`);
console.log('Plik jest ignorowany przez Git. Nie publikuj go ani nie używaj tych kont w produkcji.');
