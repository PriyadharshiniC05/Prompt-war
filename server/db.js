// Persistent JSON store: participants (accounts) / sessions (event runs) / submissions (history)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
let db;
const hash = (pw, salt = crypto.randomBytes(8).toString('hex')) =>
  salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
const verify = (pw, stored) => {
  const [s, h] = String(stored).split(':');
  const a = Buffer.from(h || '', 'hex'), b = crypto.scryptSync(pw, s || '', 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
function save() {
  const t = FILE + '.tmp';
  fs.writeFileSync(t, JSON.stringify(db));
  fs.renameSync(t, FILE);
}
// Participant credentials use username=password (for example pa001/pa001). Newly created accounts are written to credentials.csv
// next to the database so the host can print / hand them out.
const PW_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const randomPassword = () => Array.from({ length: 7 }, () => PW_CHARS[crypto.randomInt(PW_CHARS.length)]).join('');
const COUNT = Math.max(1, Number(process.env.PARTICIPANT_COUNT) || 70);

function load() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  let fresh = false;
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { db = { participants: [], sessions: [], submissions: [] }; fresh = true; }
  const created = [];
  for (let i = 1; i <= COUNT; i++) {
    const n = String(i).padStart(3, '0'), u = 'pa' + n;
    const existing = db.participants.find(p => p.username === u);
    if (existing) {
      // Keep the event credentials intentionally simple: username and password are identical.
      existing.password = hash(u);
      existing.active = existing.active === undefined ? 1 : existing.active;
      created.push(`${u},${u}`);
      continue;
    }
    db.participants.push({ id: i, username: u, password: hash(u), active: 1 });
    created.push(`${u},${u}`);
  }
  save();
  if (created.length) {
    const csv = path.join(path.dirname(FILE), 'credentials.csv');
    fs.writeFileSync(csv, 'username,password\n' + created.join('\n') + '\n');
    console.log(`Participant credentials saved to ${csv}`);
  }
}
module.exports = { load, save, verify, get: () => db };
