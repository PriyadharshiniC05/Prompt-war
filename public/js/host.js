const tok = sessionStorage.getItem('apw_token');
if (!tok) location.href = '/';
const $ = id => document.getElementById(id);
const H = { Authorization: 'Bearer ' + tok };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = ms => { ms = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(ms / 60)).padStart(2, '0') + ':' + String(ms % 60).padStart(2, '0'); };
async function load() {
  try {
    const r = await fetch('/api/host/overview', { headers: H });
    if (r.status === 401) { sessionStorage.removeItem('apw_token'); return location.href = '/'; }
    const j = await r.json(); if (!j.success) return;
    $('sA').textContent = j.stats.active; $('sS').textContent = j.stats.submissions; $('sV').textContent = j.stats.average; $('sC').textContent = j.stats.completed; $('sE').textContent = j.stats.eliminated;
    $('rows').innerHTML = j.rows.map(x => {
      const cls = x.status === 'Done' ? 'd' : (x.status === 'Timed Out' || x.status === 'Eliminated') ? 't' : 'p';
      const time = x.status === 'In Progress' ? clock(x.expires_at - j.now) + ' left' : new Date(x.started_at).toLocaleTimeString();
      const reinstate = x.status === 'Eliminated' ? ` <button class="btn ghost sm" data-e="${esc(x.username)}">REINSTATE</button>` : '';
      const act = x.submission_id ? `<button class="btn ghost sm" data-v="${esc(x.submission_id)}">VIEW</button>${reinstate}` : x.live ? `<button class="btn ghost sm" data-r="${esc(x.username)}">RELEASE</button>` : '';
      return `<tr><td>${esc(x.username)}</td><td>${esc(x.submission_id || '—')}</td><td>${x.score ?? '—'}</td><td>${x.round}</td><td><span class="pill ${cls}">${esc(x.status)}</span></td><td>${x.warnings || 0}</td><td>${esc(time)}</td><td>${act}</td></tr>`;
    }).join('') || '<tr><td colspan="8" class="muted">No sessions yet.</td></tr>';
  } catch { /* keep polling */ }
}
$('rows').onclick = async e => {
  const v = e.target.dataset.v, u = e.target.dataset.r, el = e.target.dataset.e;
  if (el && confirm(`Reinstate ${el}? They will be able to log in again.`)) { await fetch('/api/host/reinstate/' + encodeURIComponent(el), { method: 'POST', headers: H }); load(); }
  if (u && confirm(`Force-release ${u}?`)) { await fetch('/api/host/release/' + encodeURIComponent(u), { method: 'POST', headers: H }); load(); }
  if (v) {
    const j = await (await fetch('/api/host/submission/' + encodeURIComponent(v), { headers: H })).json();
    if (!j.success) return;
    const s = j.submission;
    $('vt').textContent = `${s.submission_id} · ${s.eliminated ? 'ELIMINATED' : s.score}`;
    $('vb').textContent = Object.entries(s.breakdown || {}).map(([k, n]) => `${k}: ${n}`).join('  |  ');
    $('vf').srcdoc = window.preparePreviewHtml(s.html || ''); $('view').hidden = false;
  }
};
$('vx').onclick = () => { $('view').hidden = true; $('vf').srcdoc = ''; };
$('out').onclick = () => { sessionStorage.removeItem('apw_token'); location.href = '/'; };
load(); setInterval(load, 3000);
