let role = 'participant';
const $ = id => document.getElementById(id);
const pre = sessionStorage.getItem('apw_user');
if (pre) { $('u').value = pre; sessionStorage.removeItem('apw_user'); $('p').value = pre; $('p').focus(); }
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  role = t.dataset.role;
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
  $('lu').textContent = role === 'host' ? 'HOST USERNAME' : 'USERNAME';
  $('u').placeholder = role === 'host' ? 'host' : 'pa001';
  $('go').textContent = role === 'host' ? 'HOST LIVE MONITOR' : 'ENTER EVENT';
  $('err').textContent = '';
});
$('f').onsubmit = async e => {
  e.preventDefault(); $('err').textContent = ''; $('go').disabled = true;
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, username: $('u').value, password: $('p').value }) });
    const j = await r.json();
    if (j.success) { sessionStorage.setItem('apw_token', j.token); location.href = role === 'host' ? '/host' : '/instructions'; return; }
    $('err').textContent = j.message || 'Login failed.';
  } catch { $('err').textContent = 'Cannot reach the server.'; }
  $('go').disabled = false;
};
