import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const port = Number(process.env.PORT) || 3005;
const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const aiPromptPath = join(process.cwd(), 'prompts', 'rozwin-wpis.txt');
const logGroqContent = process.env.GROQ_LOG_CONTENT === 'true';

function logGroq(event, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'groq',
    event,
    ...details
  }));
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function authenticate(request, response) {
  if (!supabaseUrl || !supabasePublishableKey) {
    sendJson(response, 503, { error: 'Brak konfiguracji logowania Supabase.' });
    return null;
  }

  const authorization = request.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    sendJson(response, 401, { error: 'Zaloguj się, aby kontynuować.' });
    return null;
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabasePublishableKey, Authorization: authorization },
      signal: AbortSignal.timeout(8_000)
    });
    if (!authResponse.ok) {
      sendJson(response, 401, { error: 'Sesja wygasła. Zaloguj się ponownie.' });
      return null;
    }
    return authResponse.json();
  } catch {
    sendJson(response, 503, { error: 'Nie udało się zweryfikować sesji.' });
    return null;
  }
}

async function querySupabase(path, authorization, options = {}) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabasePublishableKey,
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...options.headers
    },
    signal: AbortSignal.timeout(8_000)
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error('Zbyt duże żądanie'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  const { method, url } = request;

  if (method === 'GET' && url === '/') {
    try {
      const html = await readFile(join(process.cwd(), 'index.html'));
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
    } catch {
      response.writeHead(500);
      response.end('Nie udało się wczytać strony.');
    }
    return;
  }

  if (method === 'GET' && url === '/config') {
    if (!supabaseUrl || !supabasePublishableKey) {
      sendJson(response, 503, { error: 'Brak konfiguracji logowania Supabase.' });
      return;
    }
    sendJson(response, 200, { supabaseUrl, supabasePublishableKey });
    return;
  }
  if (method === 'GET' && url === '/wpisy') {
    if (!await authenticate(request, response)) return;
    try {
      const supabaseResponse = await querySupabase(
        'wpisy?select=id,tekst,data_dodania&order=id.desc',
        request.headers.authorization
      );
      if (!supabaseResponse.ok) throw new Error(`Supabase HTTP ${supabaseResponse.status}`);
      sendJson(response, 200, await supabaseResponse.json());
    } catch {
      sendJson(response, 503, { error: 'Nie uda?o si? pobra? wpis?w.' });
    }
    return;
  }

  if (method === 'POST' && url === '/podpowiedz') {
    if (!await authenticate(request, response)) return;
    if (!process.env.GROQ_API_KEY) {
      sendJson(response, 503, {
        error: 'Brak konfiguracji AI. Dodaj GROQ_API_KEY do pliku .env i uruchom serwer ponownie.'
      });
      return;
    }

    try {
      const { temat = '' } = JSON.parse(await readBody(request));
      if (typeof temat !== 'string' || !temat.trim() || temat.length > 500) {
        sendJson(response, 400, { error: 'Najpierw wpisz tekst, który AI ma rozwinąć.' });
        return;
      }

      const promptTemplate = await readFile(aiPromptPath, 'utf8');
      const prompt = promptTemplate.replace('{{USER_TEXT}}', temat.trim());
      const requestId = crypto.randomUUID();
      const startedAt = Date.now();

      logGroq('request.started', {
        requestId,
        model: groqModel,
        inputCharacters: temat.trim().length,
        ...(logGroqContent ? { prompt } : {})
      });

      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_completion_tokens: 100
        }),
        signal: AbortSignal.timeout(15_000)
      });

      const groqData = await groqResponse.json();
      if (!groqResponse.ok) {
        logGroq('request.failed', {
          requestId,
          model: groqModel,
          status: groqResponse.status,
          durationMs: Date.now() - startedAt,
          error: groqData?.error?.message || 'Unknown Groq error'
        });
        sendJson(response, 502, { error: 'Groq nie mógł teraz utworzyć podpowiedzi. Spróbuj ponownie.' });
        return;
      }

      const podpowiedz = groqData?.choices?.[0]?.message?.content?.trim();
      if (!podpowiedz) throw new Error('Pusta odpowiedź Groq');
      logGroq('request.completed', {
        requestId,
        model: groqData.model || groqModel,
        status: groqResponse.status,
        durationMs: Date.now() - startedAt,
        usage: groqData.usage ? {
          promptTokens: groqData.usage.prompt_tokens,
          completionTokens: groqData.usage.completion_tokens,
          totalTokens: groqData.usage.total_tokens
        } : undefined,
        outputCharacters: podpowiedz.length,
        ...(logGroqContent ? { response: podpowiedz } : {})
      });
      sendJson(response, 200, { podpowiedz });
    } catch (error) {
      logGroq('request.error', {
        errorName: error.name,
        error: error.message
      });
      const timeout = error.name === 'TimeoutError';
      sendJson(response, 502, {
        error: timeout
          ? 'Groq nie odpowiedział na czas. Spróbuj ponownie.'
          : 'Nie udało się połączyć z Groq.'
      });
    }
    return;
  }

  if (method === 'POST' && url === '/wpisy') {
    if (!await authenticate(request, response)) return;
    try {
      const { tekst } = JSON.parse(await readBody(request));
      if (typeof tekst !== 'string' || !tekst.trim()) {
        sendJson(response, 400, { error: 'Treść wpisu jest wymagana.' });
        return;
      }

      const supabaseResponse = await querySupabase('wpisy', request.headers.authorization, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ tekst: tekst.trim() })
      });
      if (!supabaseResponse.ok) throw new Error(`Supabase HTTP ${supabaseResponse.status}`);
      const [wpis] = await supabaseResponse.json();
      sendJson(response, 201, wpis);
    } catch (error) {
      const invalidJson = error instanceof SyntaxError;
      sendJson(response, invalidJson ? 400 : 503, {
        error: invalidJson ? 'Nieprawid?owe dane.' : 'Nie uda?o si? zapisa? wpisu.'
      });
    }
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Nie znaleziono strony.');
});

server.listen(port, () => {
  console.log(`Księga gości działa pod adresem http://localhost:${port}`);
});
