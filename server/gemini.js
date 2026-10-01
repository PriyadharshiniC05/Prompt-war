// Gemini call with timeout + limited retries. Returns {ok, html} or {ok:false, message}. Never throws.
const SYS = `You are an expert front-end engineer competing in a four-round website-building competition. Return ONE complete, self-contained HTML document with inline CSS in <style> and inline JavaScript in <script>. No external files, external stylesheets, external scripts, or image URLs. The website must work inside a sandboxed iframe. Navigation MUST use same-page section IDs and hash links; never create links to nonexistent .html pages. Buttons, forms, filters, menus, modals and other requested features must have real client-side behavior. For enhancement rounds, preserve the existing website's original problem, content, visual identity and working features, then extend and improve it; DO NOT replace it with a new problem or unrelated design. Make the requested functionality actually usable. Use responsive design, accessible labels/focus states, and clear success/error feedback. Output ONLY raw HTML.`;
const FAIL = 'AI generation is temporarily unavailable.';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function clean(t) {
  t = String(t || '').trim().replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim();
  const i = t.search(/<!doctype|<html/i);
  if (i > 0) t = t.slice(i);
  return /<\w+/.test(t) && t.length > 40 ? t : '';
}

async function generate(prompt, { round, previous, task, problem }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_key_here') {
    if (process.env.MOCK_AI === '1') {
      await sleep(200);
      return { ok: true, html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;background:linear-gradient(135deg,#0b1020,#3b1d6e);color:#fff;margin:0}header,section,footer{padding:2rem}.card{border-radius:12px;box-shadow:0 2px 8px #0006;transition:.2s}@media(max-width:600px){body{font-size:14px}}</style></head><body><nav><header><h1>Round ${round} (mock)</h1></header></nav><section><div class="card"><p>${esc(prompt).slice(0, 200)}</p></div><button id="b">Click</button></section><footer>mock</footer><script>document.getElementById('b').addEventListener('click',()=>alert('hi'))</script></body></html>` };
    }
    console.error('GEMINI_API_KEY is not set');
    return { ok: false, message: 'Gemini API key is not configured on the server.' };
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let text = `ROUND ${round}
ASSIGNED PROBLEM: ${problem?.title || ''} — ${problem?.problem || ''}
ROUND REQUIREMENT:
${task || ''}

PARTICIPANT PROMPT:
${prompt}`;
  if (previous) text += `\n\nTHIS IS AN ENHANCEMENT ROUND. Here is the participant's current website. Preserve its original problem, content and identity. Extend it according to the round requirement and participant prompt. Return the FULL updated document, not a partial patch:\n${String(previous).slice(0, 60000)}`;
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 16384 } });

  for (let attempt = 1; attempt <= 3; attempt++) {
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 60000);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body, signal: ac.signal });
      clearTimeout(timer);
      if (r.ok) {
        const j = await r.json().catch(() => null);
        const parts = j?.candidates?.[0]?.content?.parts || [];
        const html = clean(parts.map(p => p.text || '').join(''));
        if (html) return { ok: true, html };
        console.error('Gemini: empty/invalid response');
      } else {
        const detail = (await r.text().catch(() => '')).slice(0, 500);
        console.error('Gemini HTTP', r.status, detail);
        if (r.status === 429) return { ok: false, message: 'Gemini rate limit reached (HTTP 429). Wait and try again.' };
        if (r.status === 400) return { ok: false, message: 'Gemini rejected the request (HTTP 400). Check GEMINI_MODEL and request settings.' };
        if (r.status === 401 || r.status === 403) return { ok: false, message: 'Gemini API key was rejected (HTTP ' + r.status + '). Check GEMINI_API_KEY.' };
        if (r.status === 404) return { ok: false, message: 'Gemini model was not found (HTTP 404). Check GEMINI_MODEL.' };
        if ([400, 401, 403, 404].includes(r.status)) return { ok: false, message: FAIL };
      }
    } catch (e) {
      clearTimeout(timer);
      console.error('Gemini network/timeout:', e.name);
    }
    if (attempt < 3) await sleep(1000 * attempt);
  }
  return { ok: false, message: FAIL };
}
module.exports = { generate };
