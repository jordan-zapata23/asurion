// Portal A: Carrier Enrollment Portal (/enrollment)
const express = require('express');
const { state, PLANS } = require('../data/seed');
const { PORTALS, requireLogin, loginHandler, logoutHandler, logActivity, digits } = require('../lib');

const router = express.Router();
const portal = PORTALS.enrollment;
router.use((req, res, next) => { res.locals.portal = portal; next(); });

router.get('/', (req, res) => res.redirect('/enrollment/search'));
router.get('/login', (req, res) => res.render('login', { portal, username: '', pageTitle: 'Sign In', nextUrl: typeof req.query.next === 'string' ? req.query.next : '' }));
router.post('/login', loginHandler('enrollment'));
router.get('/logout', logoutHandler('enrollment'));

router.use(requireLogin('enrollment'));
router.use((req, res, next) => { res.locals.user = req.user; next(); });

router.get('/search', (req, res) => {
  res.render('enrollment/search', { pageTitle: 'Subscriber Search', mobile_number: '', error: null });
});

router.post('/search', (req, res) => {
  const raw = req.body.mobile_number || '';
  const d = digits(raw);
  const sub = state.subscribers.find(s => s.mobile === d);
  logActivity('enrollment', req.user, 'SUBSCRIBER_SEARCH', `Searched mobile ${raw} -> ${sub ? sub.id : 'no match'}`, req);
  if (!sub) {
    return res.status(404).render('enrollment/search', { pageTitle: 'Subscriber Search', mobile_number: raw, error: `No subscriber found for mobile number "${raw}". Verify the 10-digit number and try again. (Error code SUB-404)` });
  }
  res.redirect(`/enrollment/subscriber/${sub.id}`);
});

router.get('/subscriber/:id', (req, res) => {
  const sub = state.subscribers.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).render('error', { code: 404, message: 'Subscriber record not found.' });
  const plan = sub.plan ? PLANS[sub.plan] : null;
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 12);
  const claims12 = sub.claims.filter(c => new Date(c.date) >= cutoff);
  logActivity('enrollment', req.user, 'SUBSCRIBER_VIEW', `Viewed ${sub.id} (${sub.name})`, req);
  res.render('enrollment/subscriber', { pageTitle: `Subscriber ${sub.id}`, sub, plan, claims12 });
});

module.exports = router;
