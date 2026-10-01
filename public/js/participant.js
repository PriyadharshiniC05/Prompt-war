const tok = sessionStorage.getItem('apw_token');
if (!tok) location.href = '/';
const $ = id => document.getElementById(id);
let S = null, off = 0, genBusy = false, shown = null, expiredRefetched = false, selectedRound = null, promptDirty = false, saveTimer = null;
let holdWarn = false, proctoring = false, violating = false, warnPending = false, violationType = '', reloadChecked = false;
const qz = { key: null, sent: false, ack: false };
let stateVer = 0, lastPreviewHtml = '';
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const api = async (url, method = 'GET', body) => {
  if (method !== 'GET') stateVer++;           // any write invalidates in-flight state polls
  try {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({ success: false, message: 'Invalid server response.' }));
    return { status: r.status, ...j };
  } catch { return { success: false, message: 'Network error. Check your connection.' }; }
  finally { if (method !== 'GET') stateVer++; }
};
const fmt = ms => { ms = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(ms / 60)).padStart(2, '0') + ':' + String(ms % 60).padStart(2, '0'); };
const now = () => Date.now() + off;
const leave = u => { sessionStorage.removeItem('apw_token'); if (u) sessionStorage.setItem('apw_user', u); location.href = '/'; };
const setState = st => { const wasRound = S?.round; S = st; off = st.now - Date.now(); if (selectedRound === null || (wasRound !== st.round && selectedRound === wasRound)) selectedRound = st.round; render(); };

async function refresh(force) {
  const v = stateVer;
  const r = await api('/api/state');
  if (r.status === 401) return leave();
  if (r.success && (force || v === stateVer)) setState(r.state);   // drop stale polls that raced with an action
}
function msg(t, cls = '') { $('msg').className = 'msg ' + cls; $('msg').textContent = t; }


function currentHistory() {
  return (S?.history || []).find(x => x.round === selectedRound) || { round: selectedRound, task: S?.task || '', prompt: '', html: '' };
}
function isHistoryView() { return !!S && selectedRound !== S.round; }
function loadPromptForRound(round, value) {
  $('prompt').value = value || '';
  promptDirty = false;
  updateCounter();
}
// The iframe must be VISIBLE (real size) before its document loads. Loading into a display:none iframe
// gives the page a 0x0 viewport, so its media queries / JS layout run in the wrong state until a manual refresh.
function showPreview(html) {
  html = html || '';
  $('pv').hidden = !html;
  $('emptyPreview').hidden = !!html;
  const key = `${selectedRound}:${html}`;
  if (shown === key) return;
  shown = key; lastPreviewHtml = html;
  const f = $('preview');
  if (!html) { f.srcdoc = ''; return; }
  void f.offsetHeight;                                   // force layout so the iframe has its real size
  f.srcdoc = window.preparePreviewHtml(html);
}
function render() {
  if (!S) return;
  if (S.status === 'released') return leave(S.username.toLowerCase());
  $('who').textContent = S.username;
  $('expired').hidden = S.status !== 'expired';
  $('done').hidden = S.status !== 'submitted';
  if (S.status === 'submitted') {
    $('subId').textContent = S.submission_id; $('subScore').textContent = Math.round(Number(S.score || 0));
    const rounds = S.breakdown || {};
    $('scoreGrid').innerHTML = [1,2,3,4].map(i => { const r = rounds[i] || {}; return `<div class="score-round"><small>ROUND ${i} · 25%</small><b>${Math.round(Number(r.total || 0))}/100</b><div class="mini">Prompt ${Math.round(Number(r.promptQuality || 0))} · UI/UX ${Math.round(Number(r.uiux || 0))} · Functionality ${Math.round(Number(r.functionality || 0))}</div></div>`; }).join('');
  }
  if (S.status !== 'active') stopProctoring();
  $('elim').hidden = S.status !== 'eliminated';
  if (S.status === 'eliminated') $('elimId').textContent = S.submission_id || '—';
  $('gate').hidden = !(S.status === 'active' && !proctoring);
  renderWarn();
  $('warnCount').textContent = `${S.warnings} / ${S.max_warnings}`;
  $('warnStat').classList.toggle('hot', S.warnings > 0);
  $('att').textContent = `${S.attempts_left} / ${S.max}`;
  $('rnd').textContent = 'ROUND ' + S.round;
  $('rLabel').textContent = 'ROUND ' + selectedRound;
  const hist = currentHistory();
  $('rName').textContent = hist.name || (selectedRound === S.round ? S.round_name : 'ROUND ' + selectedRound);
  [...$('steps').children].forEach((li, i) => {
    const round = i + 1;
    li.className = round < S.round ? 'done' : round === S.round ? 'cur' : 'future';
    if (round === selectedRound) li.classList.add('viewing');
    li.setAttribute('aria-current', round === selectedRound ? 'page' : 'false');
  });
  $('assignmentKicker').textContent = selectedRound === 1 ? 'PROBLEM STATEMENT + FEATURES' : `ROUND ${selectedRound} ENHANCEMENT`;
  $('task').textContent = hist.task || S.task;
  const features = S.problem_statement?.features || [];
  $('featureList').innerHTML = selectedRound === 1
    ? features.map(x => `<span class="feature-chip">✓ ${x}</span>`).join('')
    : `<span class="feature-chip">↗ Enhance the existing website</span><span class="feature-chip">✓ Preserve previous functionality</span><span class="feature-chip">✓ Add working interactions</span>`;
  $('remain').textContent = S.attempts_left;

  const viewingHistory = isHistoryView();
  $('prompt').readOnly = viewingHistory;
  $('prompt').classList.toggle('history-readonly', viewingHistory);
  if (viewingHistory) loadPromptForRound(selectedRound, hist.prompt);
  else if (!promptDirty && $('prompt').dataset.round !== String(S.round)) {
    loadPromptForRound(S.round, hist.prompt || '');
    $('prompt').dataset.round = String(S.round);
  }
  $('prompt').dataset.round = String(selectedRound);

  $('gen').hidden = viewingHistory;
  $('remain').parentElement.hidden = viewingHistory;
  $('next').hidden = viewingHistory || S.round >= 4;
  $('submitBtn').hidden = viewingHistory;
  $('next').textContent = S.round === 2 ? 'START ROUND 3' : 'NEXT ROUND';
  $('next').disabled = viewingHistory || genBusy || !S.has_site;
  const allDone = [1, 2, 3, 4].every(n => (S.history || []).find(x => x.round === n)?.completed);
  $('submitBtn').disabled = genBusy || S.round < 4 || !allDone;
  $('msg').textContent = viewingHistory ? `Viewing saved ROUND ${selectedRound}.` : $('msg').textContent;

  const g = $('gen');
  updateCounter();
  renderQuiz();
  const quizBlocked = S.round === 3 && !['passed', 'failed'].includes(S.quiz?.status);
  g.disabled = viewingHistory || quizBlocked || genBusy || S.attempts_left <= 0 || S.status !== 'active' || promptLen() < S.prompt_min;
  if (genBusy) g.innerHTML = 'GENERATING WEBSITE <span class="dots"><i></i><i></i><i></i></span>';
  else g.textContent = S.attempts_left <= 0 ? 'PROMPT LIMIT REACHED' : 'GENERATE WEBSITE';

  let previewHtml = hist.html || (selectedRound === S.round ? S.html : '');
  if (!previewHtml && selectedRound === S.round && selectedRound > 1) {
    const prev = (S.history || []).find(x => x.round === selectedRound - 1);
    previewHtml = prev?.html || '';
  }
  showPreview(previewHtml);
  $('previewStatus').textContent = previewHtml ? (viewingHistory ? `ROUND ${selectedRound} SAVED PREVIEW` : (hist.html ? 'LIVE PREVIEW' : `ROUND ${selectedRound - 1} PREVIEW`)) : 'WAITING FOR GENERATION';
  $('previewStatus').style.color = previewHtml ? 'var(--ok)' : 'var(--mut)';
  $('refreshPreview').disabled = !previewHtml || genBusy;
  $('historyBanner')?.remove();
  if (viewingHistory) {
    const b = document.createElement('div'); b.id = 'historyBanner'; b.className = 'history-banner'; b.textContent = `VIEWING SAVED ROUND ${selectedRound} — click the current round tab to continue editing.`;
    $('challenge').prepend(b);
  }
  if (S.round === 2 && !viewingHistory) renderQuiz();
}

async function savePrompt() {
  if (!S || isHistoryView() || S.status !== 'active') return;
  const prompt = $('prompt').value.trim();
  await api('/api/prompt/save', 'POST', { round: S.round, prompt });
  promptDirty = false;
}
function schedulePromptSave() {
  promptDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(savePrompt, 350);
}

$('gen').onclick = async () => {
  if (genBusy || !S) return;
  const prompt = $('prompt').value.trim();
  if (!prompt) return msg('Enter a prompt before generating.', 'err');
  const chk = window.PromptCheck.check(prompt, S.prompt_rules);
  if (!chk.ok) return msg(window.PromptCheck.message(chk.missing), 'err');
  if (prompt.length > S.prompt_max) return msg(`Prompt too long: ${prompt.length} / ${S.prompt_max} maximum characters.`, 'err');
  genBusy = true; msg(''); render();
  const r = await api('/api/generate', 'POST', { prompt, round: S.round });
  genBusy = false;
  if (r.success) { S.attempts_left = r.attempts_left; S.html = r.html; S.has_site = true; const h = (S.history || []).find(x => x.round === S.round); if (h) { h.prompt = prompt; h.html = r.html; h.completed = true; } promptDirty = false; await refresh(true); msg('WEBSITE GENERATED', 'ok'); }
  else if (r.code === 'expired') { await refresh(); }
  else if (r.code === 'LIMIT') { S.attempts_left = 0; msg('PROMPT LIMIT REACHED', 'err'); }
  else msg(r.message || (r.status === 502 || r.status === 500 || !r.status ? 'AI GENERATION FAILED\n\nPlease check the server console and Gemini configuration.' : 'Generation failed.'), 'err');
  render();
};
$('next').onclick = async () => {
  if (!S || S.round >= 4 || isHistoryView()) return;
  await savePrompt(); msg('');
  const r = await api('/api/round/next', 'POST');
  if (r.success) {
    selectedRound = r.state.round; promptDirty = false; qz.key = null; shown = null; setState(r.state);
    if (r.state.round === 3 && r.state.quiz?.status !== 'passed') {
      openQuizGate();
      await qzStart();
    }
  } else if (r.code === 'QUIZ_REQUIRED') { openQuizGate(); }
  else msg(r.message, 'err');
};
$('submitBtn').onclick = () => { $('cErr').textContent = ''; $('confirm').hidden = false; };
$('cNo').onclick = () => $('confirm').hidden = true;
$('cYes').onclick = async () => {
  $('cYes').disabled = true;
  const r = await api('/api/submit', 'POST');
  $('cYes').disabled = false;
  if (r.success) { $('confirm').hidden = true; setState(r.state); } else $('cErr').textContent = r.message || 'Submission failed.';
};
$('refreshPreview').onclick = () => {
  if (!lastPreviewHtml) return;
  const html = lastPreviewHtml, f = $('preview');
  f.srcdoc = '';
  requestAnimationFrame(() => { f.srcdoc = window.preparePreviewHtml(html); });
  msg('PREVIEW REFRESHED', 'ok');
};
$('downloadBtn').onclick = async () => {
  const btn = $('downloadBtn'); btn.disabled = true; btn.textContent = 'PREPARING DOWNLOAD...';
  try {
    const r = await fetch('/api/download', { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) throw new Error((await r.text().catch(() => '')) || 'Download failed.');
    const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `ai-prompt-war-${String(S.username || 'participant').toLowerCase()}-website.html`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); btn.textContent = 'DOWNLOADED ✓';
  } catch (e) { btn.textContent = 'DOWNLOAD FAILED'; msg(e.message || 'Download failed.', 'err'); }
  setTimeout(() => { btn.disabled = false; btn.textContent = 'DOWNLOAD WEBSITE'; }, 1800);
};
$('back').onclick = () => leave(S ? S.username.toLowerCase() : '');

setInterval(() => {
  if (!S) return;
  tickQuiz();
  if (S.status === 'active') {
    const left = S.expires_at - now(); $('evTime').textContent = fmt(left);
    $('rTime').textContent = fmt(S.round_minutes * 60000 - (now() - S.round_started_at));
    if (left <= 0 && !expiredRefetched) { expiredRefetched = true; refresh(); }
  } else if (S.status === 'submitted') {
    const left = S.release_at - now(); $('cd').textContent = fmt(left);
    if (left <= 0 && !expiredRefetched) { expiredRefetched = true; refresh(); }
  }
}, 250);

/* ---------- prompt length counter ---------- */
const promptLen = () => $('prompt').value.trim().length;
function updateCounter() {
  const max = S?.prompt_max || 2000, n = promptLen();
  $('prompt').maxLength = max;
  $('cc').textContent = n; $('cmax').textContent = max;
  $('cmin').textContent = `MAX ${max}`;
  $('cbar').style.width = Math.min(100, (n / max) * 100) + '%';
  const c = $('counter'); c.classList.toggle('good', n > 0 && n < max * 0.9); c.classList.toggle('high', n >= max * 0.9);
  $('chint').textContent = n >= max ? 'Maximum length reached' : '';
  renderRules();
  if (S) $('gen').disabled = isHistoryView() || genBusy || S.attempts_left <= 0 || S.status !== 'active' || n < 1;
}
function renderRules() {
  const box = $('rulesCheck'); if (!box) return;
  if (!S || isHistoryView() || !S.prompt_rules || quizIsGate()) { box.hidden = true; return; }
  const c = window.PromptCheck.check($('prompt').value, S.prompt_rules);
  box.hidden = false;
  box.innerHTML = '<span class="rc-title">PROMPT MUST INCLUDE</span>' + c.items.map(i => `<span class="rc-chip ${i.ok ? 'ok' : 'no'}">${i.ok ? '✓' : '✗'} ${esc(i.label)}</span>`).join('');
}
$('prompt').addEventListener('input', updateCounter);
// participants must TYPE their prompt: pasting / dropping text into it is blocked
['paste', 'drop'].forEach(ev => $('prompt').addEventListener(ev, e => { e.preventDefault(); if (!isHistoryView()) msg('Pasting is disabled — type your prompt yourself.', 'err'); }));

/* ---------- Round 3 gate quiz ---------- */
function quizIsGate() {
  if (!S || S.round !== 3 || selectedRound !== S.round || S.status !== 'active') return false;
  const st = S.quiz?.status;
  if (st === 'passed' || st === 'failed') return !(qz.ack || S.has_site);   // show the result screen until the player continues
  return true;
}
function openQuizGate() { $('quizCard').hidden = false; $('quizCard').classList.add('quiz-gate'); }
function closeQuizGate() { $('quizCard').classList.remove('quiz-gate'); $('quizCard').hidden = true; }
function qzLeft() { const Q = S?.quiz; return Q && Q.status === 'running' ? Q.started_at + Q.limit_ms - now() : 0; }
function qzCollect() { return (S.quiz.questions || []).map((_, i) => { const c = document.querySelector(`input[name="q${i}"]:checked`); return c ? Number(c.value) : null; }); }
function qzCount() { const n = qzCollect().filter(v => v !== null).length; $('qzAnswered').textContent = `${n} / ${S.quiz.total} answered`; }
function renderQuiz() {
  const Q = S.quiz || { status: 'idle' }, st = Q.status, used = Q.attempts_used || 0, max = Q.attempts_max || 2;
  const secs = Math.round((Q.limit_ms || 60000) / 1000);
  const show = quizIsGate();
  $('quizCard').hidden = !show;
  $('qzAttempts').textContent = st === 'passed' ? 'PASSED' : `${Math.max(0, max - used)} OF ${max} ATTEMPTS LEFT`;
  $('qzIdle').hidden = st !== 'idle'; $('qzPlay').hidden = st !== 'running'; $('qzResult').hidden = st !== 'retry'; $('qzWon').hidden = st !== 'passed'; $('qzLost').hidden = st !== 'failed';
  $('qzStart').disabled = $('qzRetry').disabled = !show || S.status !== 'active';
  $('qzTitle').textContent = st === 'passed' ? 'Quiz passed — Round 3 reward unlocked!' : st === 'failed' ? 'No attempts left' : st === 'running' ? `Attempt ${used} of ${max} — answer all ${Q.total} questions` : 'Pass this quiz before Round 3 starts';
  if (st === 'idle') { $('qzIntro').textContent = `${Q.total} questions · ${secs} seconds · get ${Q.pass_mark} right to pass.`; $('qzTimer').textContent = fmt(Q.limit_ms || 60000); $('qzTimer').classList.remove('hot'); }
  if (st === 'retry') { $('qzResMsg').textContent = `${Q.last_timed_out ? 'Time ran out. ' : ''}Attempt ${used}: ${Q.last_score} / ${Q.total} — you need ${Q.pass_mark}.`; $('qzTimer').textContent = '—'; $('qzTimer').classList.remove('hot'); }
  if (st === 'passed') { $('qzTimer').textContent = '✓'; $('qzTimer').classList.remove('hot'); $('qzWonMsg').textContent = `Score ${Q.last_score} / ${Q.total}. Your solved Round 3 challenge prompt is ready and will be placed into Round 3 automatically.`; if ($('reward').value !== Q.reward) $('reward').value = Q.reward || ''; $('continueRound3').textContent = 'CONTINUE TO ROUND 3'; }
  if (st === 'failed') { $('qzTimer').textContent = '✗'; $('qzTimer').classList.add('hot'); $('qzLostMsg').textContent = `${Q.last_timed_out ? 'Time ran out. ' : ''}Attempt ${used}: ${Q.last_score} / ${Q.total} — you did not unlock the Round 3 reward. You can still write your own prompt.`; }
  if (st === 'running') {
    const key = '3:' + Q.started_at;
    if (qz.key !== key) {
      qz.key = key; qz.sent = false;
      $('qzList').innerHTML = Q.questions.map((q, i) => `<fieldset class="qz-q"><legend>${i + 1}. ${esc(q.q)}</legend>` + q.opts.map((o, j) => `<label class="qz-opt"><input type="radio" name="q${i}" value="${j}"><span>${esc(o)}</span></label>`).join('') + '</fieldset>').join('');
      qzCount();
    }
    $('qzSubmit').disabled = qz.sent;
  }
  if (!show) closeQuizGate(); else openQuizGate();
}
function tickQuiz() { const Q = S?.quiz; if (!Q || Q.status !== 'running' || !quizIsGate()) return; const left = qzLeft(); $('qzTimer').textContent = fmt(left); $('qzTimer').classList.toggle('hot', left <= 10000); if (left <= 0 && !qz.sent) submitQuiz(); }
async function submitQuiz() { if (qz.sent || !S?.quiz || S.quiz.status !== 'running') return; qz.sent = true; $('qzSubmit').disabled = true; const r = await api('/api/quiz/submit', 'POST', { round: 3, answers: qzCollect() }); if (r.success) setState(r.state); else { qz.sent = false; msg(r.message || 'Could not submit the quiz.', 'err'); await refresh(); } }
const qzStart = async () => { $('qzStart').disabled = $('qzRetry').disabled = true; const r = await api('/api/quiz/start', 'POST', { round: 3 }); if (r.success) { openQuizGate(); setState(r.state); } else { msg(r.message || 'Could not start the quiz.', 'err'); $('qzStart').disabled = $('qzRetry').disabled = false; } };
$('qzStart').onclick = qzStart; $('qzRetry').onclick = qzStart; $('qzList').addEventListener('change', qzCount); $('qzSubmit').onclick = submitQuiz;
$('copyReward').onclick = async () => { const t = $('reward').value, btn = $('copyReward'); let ok = false; try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); ok = true; } } catch {} if (!ok) { $('reward').focus(); $('reward').select(); try { ok = document.execCommand('copy'); } catch {} } btn.textContent = ok ? 'COPIED ✓' : 'PRESS CTRL+C'; setTimeout(() => btn.textContent = 'COPY PROMPT', 1800); };
$('continueRound3').onclick = async () => {
  if (!S?.quiz || S.quiz.status !== 'passed' || S.round !== 3) return;
  const reward = S.reward_prompt || S.quiz.reward || '';
  qz.ack = true; selectedRound = 3; promptDirty = false;
  $('prompt').value = reward; $('prompt').dataset.round = '3';
  closeQuizGate(); setState(S);
};
$('continueFailed').onclick = () => {
  if (!S || S.round !== 3) return;
  qz.ack = true; selectedRound = 3; promptDirty = false;
  closeQuizGate(); setState(S); $('prompt').focus();
};

/* ---------- saved round navigation ---------- */
[...$('steps').children].forEach((li, i) => li.addEventListener('click', async () => {
  const round = i + 1;
  if (!S || round > S.round) return;
  if (round === S.round) { await savePrompt(); selectedRound = round; promptDirty = false; setState(S); return; }
  await savePrompt();
  const item = (S.history || []).find(x => x.round === round);
  if (!item?.completed) return msg(`ROUND ${round} has not been generated yet.`, 'err');
  selectedRound = round; promptDirty = false; shown = null; render();
}));
$('prompt').addEventListener('input', () => { if (!isHistoryView()) schedulePromptSave(); });
$('prompt').addEventListener('blur', savePrompt);

/* ---------- secure event mode (fullscreen lock, tab-switch detection, 2 warnings, 3rd = eliminated) ---------- */
const VLABEL = { exit_fullscreen: 'You exited fullscreen.', tab_switch: 'You switched to another tab or window.', window_blur: 'You left the event window.', reload: 'The page was reloaded or reopened.', copy_problem: 'You tried to copy the challenge problem statement, which is not allowed.' };
async function enterFullscreen() {
  const el = document.documentElement;
  try { await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen()); } catch {}
  try { if (navigator.keyboard?.lock) await navigator.keyboard.lock(['Escape']); } catch {}   // Chromium: Esc must be held to exit
  await new Promise(r => setTimeout(r, 150));
  return !!fsEl();
}
function stopProctoring() {
  proctoring = false; violating = false;
  try { navigator.keyboard?.unlock?.(); } catch {}
  if (fsEl()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {} }
}
function isCompliant() {
  if (!fsEl() || document.visibilityState !== 'visible') return false;
  return document.hasFocus() || document.activeElement === $('preview');   // clicking inside the preview iframe is fine
}
function renderWarn() {
  const show = violating && S && S.status === 'active';
  $('warn').hidden = !show; if (!show) return;
  const modal = $('warn').firstElementChild, w = S.warnings, left = S.max_warnings - w;
  modal.classList.toggle('final', w >= S.max_warnings);
  if (warnPending) { $('warnTitle').textContent = 'VIOLATION DETECTED'; $('warnText').textContent = 'Recording…'; return; }
  $('warnTitle').textContent = w >= S.max_warnings ? `FINAL WARNING (${w} OF ${S.max_warnings})` : `WARNING ${w} OF ${S.max_warnings}`;
  $('warnText').textContent = `${VLABEL[violationType] || 'You left the secure event screen.'} ` +
    (w >= S.max_warnings ? 'The next violation will automatically submit your work and ELIMINATE you.' : `${left} warning${left === 1 ? '' : 's'} left. After that, your work is auto-submitted and you are eliminated.`);
}
async function report(type) {
  violationType = type; warnPending = true; renderWarn();
  const r = await api('/api/violation', 'POST', { type });
  warnPending = false;
  if (r.state) setState(r.state); else renderWarn();
}
function check() {
  if (!proctoring || !S || S.status !== 'active') return;
  if (isCompliant()) { if (violating && !holdWarn) { violating = false; renderWarn(); } return; }
  if (violating) return;                        // already flagged; wait for the participant to return
  violating = true;
  report(!fsEl() ? 'exit_fullscreen' : document.visibilityState !== 'visible' ? 'tab_switch' : 'window_blur');
}
document.addEventListener('fullscreenchange', check);
document.addEventListener('webkitfullscreenchange', check);
document.addEventListener('visibilitychange', check);
window.addEventListener('blur', () => setTimeout(check, 250));   // delay: focus moving into the preview iframe is allowed
window.addEventListener('focus', check);
/* ---------- the challenge problem statement must not be copied: copying it is a violation ---------- */
function touchesProblem() {
  const box = document.querySelector('.assignment'); if (!box) return false;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) return false;   // copying your own prompt / reward box is fine
  const sel = window.getSelection ? window.getSelection() : null;
  if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
  try { return sel.containsNode(box, true) || box.contains(sel.anchorNode) || box.contains(sel.focusNode); } catch { return false; }
}
function blockProblemCopy(e) {
  if (!touchesProblem()) return;
  e.preventDefault();
  if (e.clipboardData) { try { e.clipboardData.setData('text/plain', ''); } catch {} }
  if (proctoring && S && S.status === 'active' && !violating) { violating = true; holdWarn = true; report('copy_problem'); }
}
document.addEventListener('copy', blockProblemCopy, true);
document.addEventListener('cut', blockProblemCopy, true);
document.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('.assignment')) e.preventDefault(); }, true);
document.addEventListener('contextmenu', e => { if (proctoring) e.preventDefault(); });
window.addEventListener('beforeunload', e => { if (proctoring && S?.status === 'active') { e.preventDefault(); e.returnValue = ''; } });

$('gateBtn').onclick = async () => {
  $('gateNote').textContent = '';
  if (!(await enterFullscreen())) { $('gateNote').textContent = 'The browser blocked fullscreen. Use a desktop browser (Chrome / Edge / Firefox) and click the button again.'; return; }
  const r = await api('/api/proctor/begin', 'POST');
  if (!r.success) { $('gateNote').textContent = r.message || 'Could not start. Try again.'; return; }
  proctoring = true; violating = false; setState(r.state);
};
$('warnBtn').onclick = async () => { holdWarn = false; await enterFullscreen(); check(); if (violating && isCompliant()) { violating = false; renderWarn(); } };
$('elimBack').onclick = () => leave(S ? S.username.toLowerCase() : '');

// A reload/reopen after the event began counts as a violation (fullscreen is always lost on reload).
async function afterFirstState() {
  if (reloadChecked || !S) return; reloadChecked = true;
  if (S.status === 'active' && S.proctor_started) {
    $('gateNote').textContent = 'The page was reloaded — this counted as a violation.';
    violationType = 'reload'; const r = await api('/api/violation', 'POST', { type: 'reload' }); if (r.state) setState(r.state);
  }
}
setInterval(() => { if (!genBusy) refresh(); }, 5000);
refresh().then(afterFirstState);
