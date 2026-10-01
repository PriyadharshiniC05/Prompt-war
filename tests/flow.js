const base = process.env.TEST_BASE || `http://localhost:${process.env.PORT || 3111}`;
let token = '';
let passed = 0, failed = 0;
const ok = (v, m) => { if (v) { passed++; console.log('✓', m); } else { failed++; console.error('✗', m); } };
async function call(method, path, body) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}
(async () => {
  let r = await call('POST', '/api/login', { role: 'participant', username: 'pa001', password: 'pa001' });
  ok(r.success && r.token, 'participant login uses username=password'); token = r.token;
  let st = (await call('GET', '/api/state')).state;
  ok(st.round === 1 && st.prompt_min === 1, 'Round 1 starts and prompt minimum is removed');

  const valid = st => { const q = st.prompt_rules; return [q.problem, q.enhancement, (q.features || []).join(', '), 'Colour palette: cream background with brown accents'].filter(Boolean).join(' '); };
  r = await call('POST', '/api/generate', { round: 1, prompt: 'x' });
  ok(!r.success && r.code === 'PROMPT_RULES' && r.missing.length >= 3, 'A prompt without the problem statement / features / colours is rejected');
  r = await call('POST', '/api/generate', { round: 1, prompt: valid(st).replace(st.prompt_rules.features[0], 'zzz') });
  ok(r.code === 'PROMPT_RULES', 'A missing required feature is rejected');
  r = await call('POST', '/api/generate', { round: 1, prompt: valid(st).replace(/colou?r/gi, 'x').replace(/cream|brown/gi, 'x') });
  ok(r.code === 'PROMPT_RULES', 'A prompt with no colour explanation is rejected');
  st = (await call('GET', '/api/state')).state; ok(st.attempts_left === 5, 'Rejected prompts do not use an attempt');
  const p1 = valid(st);
  r = await call('POST', '/api/generate', { round: 1, prompt: p1.toUpperCase() });
  ok(r.success, 'Exact statement typed in different case/spacing is accepted');
  st = (await call('GET', '/api/state')).state;
  ok(st.history[0].html, 'Round 1 website is stored');

  r = await call('POST', '/api/round/next', {}); ok(r.success && r.state.round === 2, 'Round 2 starts after Round 1 website is generated');
  r = await call('POST', '/api/prompt/save', { round: 2, prompt: 'enhance' }); ok(r.success, 'Round 2 prompt is saved independently');
  r = await call('POST', '/api/generate', { round: 2, prompt: 'enhance' }); ok(r.code === 'PROMPT_RULES', 'Round 2 needs statement + enhancement + colours');
  st = (await call('GET', '/api/state')).state; r = await call('POST', '/api/generate', { round: 2, prompt: valid(st) }); ok(r.success, 'Round 2 generates from the previous website');

  r = await call('POST', '/api/round/next', {}); ok(r.success && r.state.round === 3, 'Round 3 starts; the quiz gate appears inside Round 3');
  st = r.state; ok(st.has_site === false && st.history[1].completed, 'has_site is per-round (Next enables only after generating)');
  r = await call('POST', '/api/generate', { round: 3, prompt: 'try early' }); ok(r.code === 'QUIZ_REQUIRED', 'Round 3 generation is locked behind the quiz');
  r = await call('POST', '/api/quiz/start', { round: 3 }); ok(r.success && r.state.quiz.status === 'running' && r.state.quiz.questions.length === 5, 'Round 3 quiz starts with 5 questions');
  const dbm = require('../server/db'); dbm.load(); const db = dbm.get();
  const s = db.sessions.find(x => x.token === token);
  const answers = s.quiz[3].attempts.at(-1).qs.map(q => q.ans);
  r = await call('POST', '/api/quiz/submit', { round: 3, answers });
  ok(r.success && r.state.quiz.status === 'passed' && r.state.quiz.reward, 'Solved Round 3 quiz unlocks the reward prompt');
  ok(r.state.history[2].prompt === r.state.reward_prompt && r.state.reward_prompt.includes(r.state.problem_statement.title), 'Reward prompt is stored for Round 3');

  st = (await call('GET', '/api/state')).state; r = await call('POST', '/api/generate', { round: 3, prompt: st.history[2].prompt }); ok(r.success, 'Round 3 reward prompt generates the Round 3 website');
  r = await call('POST', '/api/round/next', {}); ok(r.success && r.state.round === 4, 'Round 4 starts after Round 3 website is generated');

  st = (await call('GET', '/api/state')).state;
  ok(st.history[0].html && st.history[1].html && st.history[2].html, 'Saved round previews remain available');
  r = await call('GET', '/api/round/view/1'); ok(r.success && r.round.html && r.round.prompt === p1.toUpperCase(), 'Completed Round 1 can be opened from saved history');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
