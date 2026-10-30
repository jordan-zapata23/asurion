// Back-office audit view + demo reset. Intentionally unauthenticated (fake data).
const express = require('express');
const { state, reset } = require('../data/seed');

const router = express.Router();
router.use((req, res, next) => { res.locals.portal = { key: 'admin', name: 'Back Office Administration', short: 'BOA', version: 'v1.9.3', theme: 'gray', home: '/admin/activity' }; next(); });

router.get('/', (req, res) => res.redirect('/admin/activity'));
router.get('/activity', (req, res) => {
  const filter = typeof req.query.portal === 'string' ? req.query.portal : '';
  const rows = filter ? state.activity.filter(a => a.portalKey === filter) : state.activity;
  res.render('admin/activity', { pageTitle: 'Service Account Activity', rows: rows.slice(0, 300), filter, flash: req.query.reset === '1' ? 'Demo data reset to seed state. All claims, bookings, and activity cleared.' : null });
});
router.post('/reset', (req, res) => { reset(); res.redirect('/admin/activity?reset=1'); });

module.exports = router;
