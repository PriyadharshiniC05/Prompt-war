require('dotenv').config();
const express = require('express'), path = require('path'), crypto = require('crypto');
const db = require('./db'), { scoreAllRounds } = require('./scoring'), { generate } = require('./gemini');
const { PROBLEMS } = require('./problems'), quiz = require('./quiz'), { rewardPrompt } = require('./rewards');
db.load();
const PromptCheck = require('../public/js/promptcheck.js');
const D = () => db.get();

const EVENT_MS = (Number(process.env.EVENT_MINUTES) || 45) * 60000;
const RELEASE_MS = (Number(process.env.RELEASE_SECONDS) || 60) * 1000;
const MAX = 5;
const PROMPT_MIN = Math.max(1, Number(process.env.PROMPT_MIN) || 1); // prompt must contain at least one non-space character
const PROMPT_MAX = Number(process.env.PROMPT_MAX) || 2000;
const MAX_WARNINGS = 2;                                          // 1st & 2nd violation = warning, 3rd = auto-submit + elimination
const ROUNDS={1:{name:'PROBLEM STATEMENT',min:8},2:{name:'EASY ENHANCEMENT',min:8},3:{name:'MEDIUM ENHANCEMENT',min:10},4:{name:'HARD ENHANCEMENT',min:12}};
const ENHANCEMENTS={
  2:['Improve the visual design, spacing and typography. Add polished hover/focus states and make the existing navigation and primary buttons work smoothly.','Add one useful interaction related to the original website, such as filtering, tabs, an FAQ accordion or a mobile menu, while preserving all Round 1 content.','Improve the responsive experience across mobile, tablet and desktop. Strengthen visual hierarchy, cards and interaction states without changing the original concept.'],
  3:['Add a meaningful user interaction such as search/filtering, a cart or selection flow, a booking form, or dynamic content. Keep all original requirements intact.','Add richer client-side functionality with validation, dynamic UI updates and at least one stateful interaction. Do not turn the project into a different website.','Add an interactive workflow appropriate to the original website, such as filtering, tabs, a planner, reservation flow or configurable selection. Preserve the design language.'],
  4:['Turn the existing website into a production-style experience. Add an end-to-end client-side interaction flow, validation, feedback states, responsive behavior and refined UI/UX while keeping the original problem.','Add advanced functionality appropriate to the original website: dynamic state, multiple interaction states, validation, responsive navigation and a clear success/completion flow. Do not replace the original concept.','Take the existing project to a high-fidelity final version with advanced interactions, accessibility, responsive behavior, error/success states and polished visual details. All earlier features must continue working.']
};
const assignmentFor=id=>PROBLEMS[(Number(id||1)-1)%PROBLEMS.length];
const enhancementFor=(id,round)=>ENHANCEMENTS[round][(Number(id||1)-1+round)%ENHANCEMENTS[round].length];
const taskFor=s=>{const b=s.problem_statement;if(s.round===1)return `PROBLEM STATEMENT: ${b.problem}\n\nREQUIRED FEATURES:\n• ${b.features.join('\n• ')}`;return `CONTINUE THE SAME WEBSITE — DO NOT START A NEW PROBLEM.\n\nORIGINAL PROBLEM: ${b.problem}\n\nROUND ${s.round} ENHANCEMENT: ${s.enhancements[s.round]}\n\nKeep every working feature from earlier rounds and add/improve the requested functionality.`};

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
const page = f => (q, r) => r.sendFile(path.join(__dirname, '..', 'public', f));
app.get('/participant', page('participant.html'));
app.get('/host', page('host.html'));
// Friendly route used after participant login.
app.get('/instructions', page('instructions.html'));
app.get('/instructions.html', page('instructions.html'));

const hostTokens = new Set(), busy = new Set();
const rand = () => crypto.randomBytes(24).toString('hex');
const digest = s => crypto.createHash('sha256').update(String(s)).digest();
const safeEq = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));
const fail = (res, code, message, extra = {}) => res.status(code).json({ success: false, message, ...extra });

function sweep() {
  const n = Date.now(); let ch = false;
  for (const s of D().sessions) {
    if (s.status === 'active' && n >= s.expires_at) { s.status = 'expired'; ch = true; }
    if (s.status === 'submitted' && n >= s.release_at) { s.status = 'released'; ch = true; }
  }
  if (ch) db.save();
}
setInterval(() => { try { sweep(); } catch (e) { console.error(e); } }, 1000);
const inUse = u => D().sessions.some(s => s.username === u && (s.status === 'active' || s.status === 'submitted'));

function auth(req, res, next) {
  sweep();
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const s = t && D().sessions.find(x => x.token === t);
  if (!s) return fail(res, 401, 'Session not found. Please log in again.', { code: 'NO_SESSION' });
  s.websites ||= {}; s.round_prompts ||= {};
  req.s = s; next();
}
function hostAuth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!hostTokens.has(t)) return fail(res, 401, 'Host login required.', { code: 'NO_SESSION' });
  next();
}

function quizView(s, round) {
  const Q = (s.quiz ||= {})[round] || (s.quiz[round] = { attempts: [], passed: false });
  const last = Q.attempts[Q.attempts.length - 1];
  if (last && last.status === 'running' && Date.now() > last.started_at + quiz.LIMIT_MS + quiz.GRACE_MS) {
    Object.assign(last, { status: 'done', score: 0, passed: false, timed_out: true }); db.save();
  }
  const v = { round, attempts_used: Q.attempts.length, attempts_max: quiz.MAX_ATTEMPTS, limit_ms: quiz.LIMIT_MS, pass_mark: quiz.PASS, total: quiz.PER };
  if (last && last.status === 'done') { v.last_score = last.score; v.last_timed_out = !!last.timed_out; }
  if (Q.passed) return { ...v, status: 'passed', reward: rewardPrompt(s.problem_statement, 3, s.enhancements[3]) };
  if (last && last.status === 'running') return { ...v, status: 'running', started_at: last.started_at, questions: last.qs.map(({ q, opts }) => ({ q, opts })) };
  if (Q.attempts.length >= quiz.MAX_ATTEMPTS) return { ...v, status: 'failed' };
  return { ...v, status: Q.attempts.length ? 'retry' : 'idle' };
}

// quiz is finished once passed, or once both attempts are used (so nobody is ever locked out of Round 3)
const quizDone = s => ['passed', 'failed'].includes(quizView(s, 3).status);

// What the participant's prompt must contain this round (Round 1: statement + features; Rounds 2-4: statement + enhancement).
function rulesFor(s, round = s.round) {
  const b = s.problem_statement, r = { problem: b.problem };
  if (round === 1) r.features = b.features; else r.enhancement = s.enhancements[round];
  if (round === 3 && s.quiz?.[3]?.passed) r.reward = rewardPrompt(b, 3, s.enhancements[3]);
  return r;
}

function historyFor(s) {
  return [1,2,3,4].map(round => ({
    round,
    name: ROUNDS[round].name,
    task: taskFor({ ...s, round }),
    prompt: s.round_prompts?.[round] || '',
    html: s.websites?.[round] || '',
    completed: !!s.websites?.[round]
  }));
}

function state(s) {
  const R=ROUNDS[s.round];
  const quizRound = (s.round === 2 || s.round === 3) ? 3 : s.round;
  return {
    prompt_rules:(({ problem, enhancement, features, reward }) => ({ problem, enhancement, features, reward }))(rulesFor(s)),
    now:Date.now(), username:s.username.toUpperCase(), status:s.status, started_at:s.started_at, expires_at:s.expires_at,
    max:MAX, attempts_left:MAX-s.attempts_used, round:s.round, round_name:R.name, round_minutes:R.min, round_started_at:s.round_started_at,
    problem_statement:s.problem_statement, task:taskFor(s),
    html:s.websites[s.round]||'', has_site:!!s.websites[s.round], latest_html:s.latest_html || '',
    submission_id:s.submission_id, score:s.score, breakdown:s.breakdown||null, release_at:s.release_at,
    prompt_min:PROMPT_MIN, prompt_max:PROMPT_MAX, max_warnings:MAX_WARNINGS, warnings:(s.violations||[]).length, proctor_started:!!s.proctor_started,
    eliminated:s.status==='eliminated', quiz_round:quizRound, quiz:quizView(s, quizRound), history:historyFor(s),
    reward_prompt: (s.quiz?.[3]?.passed) ? rewardPrompt(s.problem_statement, 3, s.enhancements[3]) : ''
  };
}

app.post('/api/login', (req, res) => {
  sweep();
  const { role, username, password } = req.body || {};
  if (role === 'host') {
    if (safeEq(username, process.env.HOST_USERNAME || 'host') && safeEq(password, process.env.HOST_PASSWORD || 'change_me')) {
      const t = rand(); hostTokens.add(t); return res.json({ success: true, role: 'host', token: t });
    }
    return fail(res, 401, 'Invalid host credentials.');
  }
  const u = String(username || '').trim().toLowerCase();
  const p = D().participants.find(x => x.username === u && x.active);
  if (!p || !db.verify(String(password || ''), p.password)) return fail(res, 401, 'Invalid username or password.');
  if (p.eliminated) return fail(res, 403, `${u} has been eliminated from the event.`);
  if (inUse(u)) return fail(res, 409, `${u} is currently in use.`);
  const n = Date.now();
  const s = {
    id: D().sessions.length + 1, participant_id: p.id, username: u, token: rand(), started_at: n, expires_at: n + EVENT_MS, status: 'active',
    attempts_used: 0, round: 1, round_started_at: n, problem_statement: assignmentFor(p.id), enhancements: { 2: enhancementFor(p.id, 2), 3: enhancementFor(p.id, 3), 4: enhancementFor(p.id, 4) }, prompts: [], round_prompts: {}, websites: {}, quiz: {}, quiz_used: [], violations: [], proctor_started: false, latest_html: '', submission_id: null, score: null, breakdown: null, release_at: null,
  };
  D().sessions.push(s); db.save();
  res.json({ success: true, role: 'participant', token: s.token });
});

app.get('/api/state', auth, (req, res) => res.json({ success: true, state: state(req.s) }));

const active = (req, res, next) => req.s.status === 'active' ? next()
  : fail(res, 403, req.s.status === 'expired' ? 'EVENT TIME COMPLETED' : req.s.status === 'eliminated' ? 'You have been eliminated.' : 'Session is not active.', { code: req.s.status });

app.post('/api/round/next', auth, active, (req, res) => {
  const s = req.s;
  if (s.round >= 4) return fail(res, 400, 'Already in the final round.');
  if (!s.websites[s.round]) return fail(res, 400, 'Generate and review your website before moving to the next round.');
  s.round++; s.round_started_at = Date.now();
  // Round 3 starts first; the quiz now appears immediately on the Round 3 screen.
  // The solved reward prompt is unlocked only after the participant passes it.
  if (s.round === 3) {
    s.round_prompts[3] = '';
    s.reward_prompt = '';
  }
  db.save();
  res.json({ success: true, state: state(s) });
});

app.post('/api/prompt/save', auth, active, (req, res) => {
  const s = req.s, round = Number(req.body?.round);
  if (![1,2,3,4].includes(round) || round !== s.round) return fail(res, 400, 'Round mismatch. Refresh the page.');
  if (round === 3 && !quizDone(s)) return fail(res, 403, 'Pass the Round 3 quiz before entering the Round 3 prompt.', { code: 'QUIZ_REQUIRED' });
  const prompt = String(req.body?.prompt || '').trim();
  if (prompt.length > PROMPT_MAX) return fail(res, 400, `Prompt cannot exceed ${PROMPT_MAX} characters.`);
  s.round_prompts[round] = prompt; db.save();
  res.json({ success: true, saved: true });
});

app.get('/api/round/view/:round', auth, active, (req, res) => {
  const round = Number(req.params.round);
  if (![1,2,3,4].includes(round)) return fail(res, 400, 'Invalid round.');
  const item = historyFor(req.s).find(x => x.round === round);
  if (!item) return fail(res, 404, 'Round not found.');
  res.json({ success: true, round: item });
});

app.post('/api/generate', auth, active, async (req, res) => {
  const s = req.s;
  try {
    const prompt = String(req.body?.prompt || '').trim(), round = Number(req.body?.round);
    if (prompt.length < PROMPT_MIN || prompt.length > PROMPT_MAX) return fail(res, 400, `Prompt must contain 1 to ${PROMPT_MAX} characters (yours: ${prompt.length}).`);
    if (round !== s.round) return fail(res, 400, 'Round mismatch. Refresh the page.');
    if (round === 3 && !quizDone(s)) return fail(res, 403, 'Pass the Round 3 quiz before generating the Round 3 website.', { code: 'QUIZ_REQUIRED' });
    const chk = PromptCheck.check(prompt, rulesFor(s, round));
    if (!chk.ok) return fail(res, 422, PromptCheck.message(chk.missing), { code: 'PROMPT_RULES', missing: chk.missing });   // attempt NOT consumed
    if (s.attempts_used >= MAX) return fail(res, 403, 'PROMPT LIMIT REACHED', { code: 'LIMIT' });
    if (busy.has(s.id)) return fail(res, 429, 'A generation is already in progress.');
    busy.add(s.id);
    try {
      const previous = round > 1 ? (s.websites[round - 1] || s.latest_html) : '';
      const r = await generate(prompt, { round, previous, task: taskFor(s), problem: s.problem_statement });
      if (!r.ok) return fail(res, 502, r.message);                 // API failure: attempt NOT consumed
      sweep();
      if (s.status !== 'active') return fail(res, 403, 'EVENT TIME COMPLETED', { code: s.status });
      s.attempts_used++; s.prompts.push(prompt); s.round_prompts[round] = prompt; s.websites[round] = r.html; s.latest_html = r.html; db.save();
      res.json({ success: true, html: r.html, attempts_left: MAX - s.attempts_used });
    } finally { busy.delete(s.id); }
  } catch (e) {
    console.error('generate error', e);
    fail(res, 500, 'AI generation is temporarily unavailable.');
  }
});

function finalize(s, { eliminated = false, reason = '' } = {}) {
  const d = new Date(), ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `SUB-${ymd}-${s.username.toUpperCase()}-`;
  const submissionId = prefix + String(D().submissions.filter(x => x.submission_id.startsWith(prefix)).length + 1).padStart(3, '0');
  const result = scoreAllRounds({ websites: s.websites, roundPrompts: s.round_prompts });
  D().submissions.push({ id: D().submissions.length + 1, submission_id: submissionId, participant_username: s.username, session_id: s.id, score: result.total, breakdown: result.rounds, submitted_at: Date.now(), prompts: s.prompts, eliminated, eliminated_reason: reason, violations: s.violations || [], website_data: { final: s.latest_html, rounds: s.websites } });
  Object.assign(s, { status: eliminated ? 'eliminated' : 'submitted', submission_id: submissionId, score: result.total, breakdown: result.rounds, release_at: eliminated ? null : Date.now() + RELEASE_MS });
  if (eliminated) { const p = D().participants.find(x => x.username === s.username); if (p) p.eliminated = true; }
  db.save();
}

app.post('/api/submit', auth, active, (req, res) => {
  const s = req.s;
  try {
    if ([1, 2, 3, 4].some(n => !s.websites[n])) return fail(res, 400, 'Complete and generate a website for all four rounds before submitting.');
    if (busy.has(s.id)) return fail(res, 409, 'Wait for the current generation to finish.');
    finalize(s);
    res.json({ success: true, state: state(s) });
  } catch (e) { console.error('submit error', e); fail(res, 500, 'Submission failed. Please try again.'); }
});

// ---- Secure event mode: fullscreen / tab-switch violations -------------------------------------------------
app.post('/api/proctor/begin', auth, active, (req, res) => {
  req.s.proctor_started = true; db.save();
  res.json({ success: true, state: state(req.s) });
});
app.post('/api/violation', auth, active, (req, res) => {
  const s = req.s;
  if (!s.proctor_started) return res.json({ success: true, state: state(s) });
  s.violations ||= [];
  const n = Date.now(), last = s.violations[s.violations.length - 1];
  if (last && n - last.at < 1500) return res.json({ success: true, duplicate: true, state: state(s) });   // one action can fire several browser events
  s.violations.push({ type: String(req.body?.type || 'unknown').slice(0, 30), at: n });
  if (s.violations.length > MAX_WARNINGS) finalize(s, { eliminated: true, reason: 'Left fullscreen / switched tab too many times' });
  else db.save();
  res.json({ success: true, state: state(s) });
});

// ---- Round 3 gate quiz: 2 attempts, 5 questions, pass unlocks the solved Round 3 prompt ----
app.post('/api/quiz/start', auth, active, (req, res) => {
  const s = req.s, round = Number(req.body?.round);
  if (round !== 3 || s.round !== 3) return fail(res, 400, 'The Round 3 quiz starts at the beginning of Round 3.');
  const v = quizView(s, 3);
  if (v.status === 'idle' || v.status === 'retry') {
    s.quiz_used ||= [];
    const qs = quiz.pickQuestions(s.quiz_used);
    s.quiz_used.push(...qs.map(q => q.id));
    s.quiz[3].attempts.push({ qs, started_at: Date.now(), status: 'running' });
    db.save();
  }
  res.json({ success: true, state: state(s) });
});
app.post('/api/quiz/submit', auth, active, (req, res) => {
  const s = req.s, round = Number(req.body?.round);
  if (round !== 3 || s.round !== 3) return fail(res, 400, 'The Round 3 quiz must be completed before Round 3 generation.');
  const v = quizView(s, 3);
  if (v.status !== 'running') return res.json({ success: true, state: state(s) });
  const Q = s.quiz[3], last = Q.attempts[Q.attempts.length - 1];
  last.score = quiz.grade(last.qs, req.body?.answers);
  last.passed = last.score >= quiz.PASS; last.status = 'done'; last.submitted_at = Date.now();
  if (last.passed) {
    Q.passed = true;
    const reward = rewardPrompt(s.problem_statement, 3, s.enhancements[3]);
    s.round_prompts[3] = reward;
    s.reward_prompt = reward;
  }
  db.save();
  res.json({ success: true, state: state(s) });
});

app.get('/api/download', auth, (req, res) => {
  if (!req.s.latest_html) return fail(res, 404, 'No generated website available.');
  const filename = `ai-prompt-war-${String(req.s.username).replace(/[^a-z0-9_-]/gi, '_')}-website.html`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(req.s.latest_html);
});

app.get('/api/host/overview', hostAuth, (req, res) => {
  sweep();
  const subs = D().submissions, ss = D().sessions;
  res.json({
    success: true, now: Date.now(),
    stats: { active: ss.filter(s => s.status === 'active' || s.status === 'submitted').length, submissions: subs.length, eliminated: ss.filter(s => s.status === 'eliminated').length, average: (() => { const ok = subs.filter(x => !x.eliminated); return ok.length ? Math.round(ok.reduce((a, b) => a + b.score, 0) / ok.length) : 0; })(), completed: ss.filter(s => s.status !== 'active').length },
    rows: ss.slice().reverse().map(s => ({ username: s.username, submission_id: s.submission_id, score: s.score, round: s.round, status: s.status === 'active' ? 'In Progress' : s.status === 'expired' ? 'Timed Out' : s.status === 'eliminated' ? 'Eliminated' : 'Done', warnings: (s.violations || []).length, started_at: s.started_at, expires_at: s.expires_at, live: s.status === 'active' || s.status === 'submitted' })),
  });
});
app.get('/api/host/submission/:id', hostAuth, (req, res) => {
  const x = D().submissions.find(s => s.submission_id === req.params.id);
  if (!x) return fail(res, 404, 'Submission not found.');
  res.json({ success: true, submission: { submission_id: x.submission_id, username: x.participant_username, score: x.score, eliminated: !!x.eliminated, violations: x.violations || [], breakdown: x.breakdown, prompts: x.prompts, html: x.website_data.final } });
});
app.post('/api/host/reinstate/:username', hostAuth, (req, res) => {
  const p = D().participants.find(x => x.username === req.params.username);
  if (!p) return fail(res, 404, 'Participant not found.');
  p.eliminated = false; db.save(); res.json({ success: true });
});
app.post('/api/host/release/:username', hostAuth, (req, res) => {
  let n = 0;
  for (const s of D().sessions) if (s.username === req.params.username && (s.status === 'active' || s.status === 'submitted')) { s.status = 'released'; n++; }
  db.save(); res.json({ success: true, released: n });
});

app.use('/api', (q, r) => fail(r, 404, 'Not found.'));
app.use((err, req, res, next) => fail(res, err.status || 500, err.type === 'entity.parse.failed' ? 'Invalid request.' : 'Server error.'));
process.on('unhandledRejection', e => console.error('unhandledRejection', e));
process.on('uncaughtException', e => console.error('uncaughtException', e));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI PROMPT WAR running at http://localhost:${PORT}`))
  .on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Stop the other server (STOP.BAT) or set a different PORT in .env.` : e); process.exit(1); });
