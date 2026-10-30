// Shared helpers: per-portal cookie sessions, audit logging, formatting.
const crypto = require('crypto');
const { state } = require('./data/seed');

const COOKIE_SECRET = process.env.COOKIE_SECRET || 'demo-only-not-a-real-secret';
const SESSION_TTL_MS = 30 * 60 * 1000;
const TZ = process.env.DEMO_TZ || 'America/Chicago';

// Service-account credentials. Override with env vars in production.
const PORTALS = {
  enrollment: {
    key: 'enrollment', name: 'Carrier Enrollment Portal', short: 'CEP', version: 'v3.8.2', theme: 'blue',
    user: process.env.ENROLLMENT_USER || 'decagon.svc', pass: process.env.ENROLLMENT_PASS || 'Enr0ll-2026!',
    home: '/enrollment/search',
  },
  claims: {
    key: 'claims', name: 'Claims Adjudication Console', short: 'CAC', version: 'v5.1.0', theme: 'green',
    user: process.env.CLAIMS_USER || 'decagon.svc', pass: process.env.CLAIMS_PASS || 'Cl@ims-2026!',
    home: '/claims/dashboard',
  },
  scheduler: {
    key: 'scheduler', name: 'Repair Network Scheduler', short: 'RNS', version: 'v2.14.7', theme: 'maroon',
    user: process.env.SCHEDULER_USER || 'decagon.svc', pass: process.env.SCHEDULER_PASS || 'Sch3d-2026!',
    home: '/scheduler/search',
  },
};

function sign(value) {
  return crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('base64url');
}
function makeSession(portalKey, username) {
  const payload = `${portalKey}|${username}|${Date.now() + SESSION_TTL_MS}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}
function readSession(portalKey, raw) {
  if (!raw || typeof raw !== 'string') return null;
  const [b64, sig] = raw.split('.');
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, 'base64url').toString();
  if (sign(payload) !== sig) return null;
  const [pk, username, exp] = payload.split('|');
  if (pk !== portalKey || Number(exp) < Date.now()) return null;
  return { username };
}

// Middleware factory: require login for a portal.
function requireLogin(portalKey) {
  return (req, res, next) => {
    const sess = readSession(portalKey, req.cookies[`sess_${portalKey}`]);
    if (!sess) {
      return res.redirect(`/${portalKey}/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    req.user = sess.username;
    next();
  };
}

function loginHandler(portalKey) {
  const p = PORTALS[portalKey];
  return (req, res) => {
    const { username = '', password = '' } = req.body || {};
    if (username.trim() === p.user && password === p.pass) {
      res.cookie(`sess_${portalKey}`, makeSession(portalKey, username.trim()), { httpOnly: true, sameSite: 'lax', maxAge: SESSION_TTL_MS });
      logActivity(portalKey, username.trim(), 'LOGIN', 'Service account signed in', req);
      const next = typeof req.query.next === 'string' && req.query.next.startsWith(`/${portalKey}/`) ? req.query.next : p.home;
      return res.redirect(next);
    }
    logActivity(portalKey, username.trim() || '(blank)', 'LOGIN_FAILED', 'Invalid credentials', req);
    res.status(401).render('login', { portal: p, error: 'Invalid username or password. (Error code AUTH-401)', username, pageTitle: 'Sign In' });
  };
}

function logoutHandler(portalKey) {
  return (req, res) => {
    const sess = readSession(portalKey, req.cookies[`sess_${portalKey}`]);
    if (sess) logActivity(portalKey, sess.username, 'LOGOUT', 'Signed out', req);
    res.clearCookie(`sess_${portalKey}`);
    res.redirect(`/${portalKey}/login`);
  };
}

function logActivity(portalKey, account, action, detail, req) {
  state.activity.unshift({
    ts: new Date(),
    portal: PORTALS[portalKey] ? PORTALS[portalKey].name : portalKey,
    portalKey,
    account,
    action,
    detail,
    ip: req ? (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim() : '',
    ua: req ? (req.headers['user-agent'] || '').slice(0, 80) : '',
  });
  if (state.activity.length > 2000) state.activity.length = 2000;
}

// ---- formatting ----------------------------------------------------------
function digits(s) { return String(s || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1'); }
function fmtPhone(d) { d = digits(d); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d; }
function money(n) { return n == null ? '—' : `$${Number(n).toFixed(2)}`; }
function fmtTs(d) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
}
function todayParts() {
  const now = new Date();
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const parts = Object.fromEntries(f.formatToParts(now).map(p => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  return { y: parts.year, m: parts.month, d: parts.day, minutesNow: hour * 60 + Number(parts.minute) };
}
function fmtTime12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
function fmtDateLong(y, m, d) {
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(dt);
}
function normModel(s) {
  return String(s || '').toLowerCase().replace(/\b(apple|samsung|google)\b/g, '').replace(/[^a-z0-9]/g, '');
}

module.exports = { PORTALS, requireLogin, loginHandler, logoutHandler, logActivity, digits, fmtPhone, money, fmtTs, todayParts, fmtTime12, fmtDateLong, normModel, TZ };
