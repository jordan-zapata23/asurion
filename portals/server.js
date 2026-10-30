// ProtectCo mock legacy portals. Fake data only. See ../README.md.
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { state, reset } = require('./data/seed');
const lib = require('./lib');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', true);
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.locals.lib = lib;
  res.locals.state = state;
  res.locals.user = null;
  res.locals.error = null;
  res.locals.pageTitle = '';
  next();
});

app.get('/healthz', (req, res) => res.json({ ok: true, uptimeSec: Math.round(process.uptime()), claims: state.claims.length, bookings: state.bookings.length }));

app.get('/', (req, res) => res.render('index', { portals: lib.PORTALS }));

app.use('/enrollment', require('./routes/enrollment'));
app.use('/claims', require('./routes/claims'));
app.use('/scheduler', require('./routes/scheduler'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).render('error', { code: 404, message: 'The page you requested could not be found.' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('error', { code: 500, message: 'An unexpected error occurred. Reference: ' + Date.now().toString(36).toUpperCase() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ProtectCo legacy portals listening on http://localhost:${PORT}`);
  console.log(`  Enrollment: /enrollment  (${lib.PORTALS.enrollment.user})`);
  console.log(`  Claims:     /claims      (${lib.PORTALS.claims.user})`);
  console.log(`  Scheduler:  /scheduler   (${lib.PORTALS.scheduler.user})`);
  console.log(`  Audit log:  /admin/activity`);
});
