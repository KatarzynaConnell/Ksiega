import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const sourceUrl = 'https://www.pkd.com.pl/wyszukiwarka/lista_pkd';
const outputPath = join(process.cwd(), 'pkd-search', 'data', 'pkd-data.js');

const decodeHtml = (value) => value
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

const cleanCell = (html) => decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`Nie udało się pobrać listy: HTTP ${response.status}`);
const html = await response.text();
const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
const records = [];

for (const row of rows) {
  const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => cleanCell(match[1]));
  if (cells.length !== 6 || !cells[4].startsWith('PKD ')) continue;
  records.push({
    section: cells[0],
    division: cells[1],
    group: cells[2],
    classCode: cells[3],
    code: cells[4].replace(/^PKD\s+/, ''),
    description: cells[5]
  });
}

if (records.length < 600) throw new Error(`Wykryto tylko ${records.length} rekordów; struktura źródła mogła się zmienić.`);
const uniqueCodes = new Set(records.map((item) => item.code));
if (uniqueCodes.size !== records.length) throw new Error('Lista zawiera powtórzone symbole PKD.');

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `// Wygenerowano z ${sourceUrl}\nwindow.PKD_DATA = ${JSON.stringify(records, null, 2)};\n`, 'utf8');
console.log(`Zapisano ${records.length} kodów w ${outputPath}`);
