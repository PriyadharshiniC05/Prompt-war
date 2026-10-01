// Round scoring: each round is evaluated independently on 3 common criteria.
// Each criterion is 0-100, the round score is their average (0-100), and each
// of the four rounds contributes 25% to the final score.
const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
const cnt = (s, re) => (s.match(re) || []).length;

function scoreRound({ html, prompt }) {
  html = String(html || '');
  prompt = String(prompt || '');
  const h = html.toLowerCase();
  const p = prompt.toLowerCase();

  const functionality = clamp(
    15 +
    (h.includes('<script') ? 20 : 0) +
    Math.min(30, cnt(h, /addeventlistener|onclick|onsubmit|oninput|onclick=/g) * 6) +
    Math.min(25, cnt(h, /<(button|form|input|select|textarea|a)\b/g) * 4) +
    (h.includes('preventdefault') ? 5 : 0) +
    (h.includes('localstorage') || h.includes('sessionstorage') ? 5 : 0)
  );

  const uiux = clamp(
    15 +
    (h.includes('<style') ? 15 : 0) +
    Math.min(20, cnt(h, /border-radius|box-shadow|gradient/g) * 3) +
    Math.min(25, cnt(h, /<(header|nav|main|section|article|footer)\b/g) * 5) +
    Math.min(25, cnt(h, /transition|:hover|:focus|animation/g) * 4)
  );

  const promptQuality = clamp(
    Math.min(45, prompt.length / 5) +
    Math.min(30, cnt(p, /responsive|section|layout|navigation|font|animation|form|filter|search|accessib|button|function|mobile|desktop/g) * 5) +
    (/you are (a|an)|create|build|design/.test(p) ? 15 : 0) +
    (prompt.length >= 80 ? 10 : 0)
  );

  const total = clamp((functionality + uiux + promptQuality) / 3);
  return { functionality, uiux, promptQuality, total };
}

function scoreAllRounds({ websites, roundPrompts }) {
  const rounds = {};
  let final = 0;
  for (let i = 1; i <= 4; i++) {
    const result = scoreRound({ html: websites?.[i] || '', prompt: roundPrompts?.[i] || '' });
    rounds[i] = { ...result, contribution: Math.round(result.total * 0.25 * 100) / 100 };
    final += result.total * 0.25;
  }
  return { total: Math.round(final * 100) / 100, rounds };
}

module.exports = { scoreRound, scoreAllRounds };
