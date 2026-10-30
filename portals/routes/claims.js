// Portal B: Claims Adjudication Console (/claims)
const express = require('express');
const { state, PLANS, LOSS_TYPES } = require('../data/seed');
const { PORTALS, requireLogin, loginHandler, logoutHandler, logActivity, digits, todayParts } = require('../lib');

const router = express.Router();
const portal = PORTALS.claims;
router.use((req, res, next) => { res.locals.portal = portal; next(); });

router.get('/', (req, res) => res.redirect('/claims/dashboard'));
router.get('/login', (req, res) => res.render('login', { portal, username: '', pageTitle: 'Sign In', nextUrl: typeof req.query.next === 'string' ? req.query.next : '' }));
router.post('/login', loginHandler('claims'));
router.get('/logout', logoutHandler('claims'));

router.use(requireLogin('claims'));
router.use((req, res, next) => { res.locals.user = req.user; next(); });

function claims12mo(sub) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 12);
  return sub.claims.filter(c => new Date(c.date) >= cutoff);
}

router.get('/dashboard', (req, res) => {
  res.render('claims/dashboard', { pageTitle: 'Work Queue', recent: state.claims.slice(-15).reverse() });
});

// Step 1: subscriber lookup
router.get('/new', (req, res) => {
  res.render('claims/new-step1', { pageTitle: 'New Claim - Step 1 of 2', mobile_number: '', error: null });
});
router.post('/new', (req, res) => {
  const raw = req.body.mobile_number || '';
  const sub = state.subscribers.find(s => s.mobile === digits(raw));
  logActivity('claims', req.user, 'CLAIM_LOOKUP', `Subscriber lookup ${raw} -> ${sub ? sub.id : 'no match'}`, req);
  if (!sub) {
    return res.status(404).render('claims/new-step1', { pageTitle: 'New Claim - Step 1 of 2', mobile_number: raw, error: `No subscriber found for "${raw}". (Error code SUB-404)` });
  }
  res.redirect(`/claims/new/details?sub=${encodeURIComponent(sub.id)}`);
});

// Step 2: loss details
router.get('/new/details', (req, res) => {
  const sub = state.subscribers.find(s => s.id === req.query.sub);
  if (!sub) return res.redirect('/claims/new');
  const t = todayParts();
  res.render('claims/new-step2', {
    pageTitle: 'New Claim - Step 2 of 2', sub, plan: sub.plan ? PLANS[sub.plan] : null, claims12: claims12mo(sub),
    LOSS_TYPES, today: `${t.y}-${t.m}-${t.d}`, form: { loss_type: '', incident_date: `${t.y}-${t.m}-${t.d}`, description: '', imei: '' }, error: null,
  });
});

router.post('/new/submit', (req, res) => {
  const sub = state.subscribers.find(s => s.id === req.body.subscriber_id);
  if (!sub) return res.redirect('/claims/new');
  const form = {
    loss_type: String(req.body.loss_type || ''),
    incident_date: String(req.body.incident_date || ''),
    description: String(req.body.description || '').slice(0, 500),
    imei: digits(req.body.imei),
  };
  const plan = sub.plan ? PLANS[sub.plan] : null;
  const c12 = claims12mo(sub);
  const t = todayParts();
  const renderErr = (error) => res.status(400).render('claims/new-step2', { pageTitle: 'New Claim - Step 2 of 2', sub, plan, claims12: c12, LOSS_TYPES, today: `${t.y}-${t.m}-${t.d}`, form, error });

  if (!LOSS_TYPES.includes(form.loss_type)) return renderErr('Select a valid Loss Type. (Error code VAL-100)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.incident_date)) return renderErr('Date of Incident is required (YYYY-MM-DD). (Error code VAL-101)');
  if (form.imei.length < 14 || form.imei.length > 16) return renderErr('IMEI must be 14-16 digits. (Error code VAL-102)');
  if (form.description.trim().length < 5) return renderErr('Description of loss is required. (Error code VAL-103)');

  // ---- Adjudication rules -------------------------------------------------
  const reasons = [];
  if (sub.status !== 'Active') reasons.push(`Subscriber enrollment status is "${sub.status}"`);
  if (plan && c12.length >= plan.claimLimit) reasons.push(`Claim limit reached (${c12.length} of ${plan.claimLimit} in rolling 12 months)`);
  if (form.imei !== sub.device.imei) reasons.push(`IMEI ${form.imei} does not match enrolled device IMEI ${sub.device.imei}`);
  if (form.loss_type !== 'Cracked Screen') reasons.push(`Loss type "${form.loss_type}" requires adjuster review`);

  const approved = reasons.length === 0;
  const deductible = plan ? plan.deductibles[form.loss_type] : null;

  state.claimSeq += 1;
  const claim = {
    claimNumber: `CLM-2026-${String(state.claimSeq).padStart(7, '0')}`,
    subscriberId: sub.id, subscriberName: sub.name, mobile: sub.mobile, carrier: sub.carrier, plan: sub.plan,
    lossType: form.loss_type, incidentDate: form.incident_date, description: form.description, imei: form.imei,
    status: approved ? 'Approved' : 'Pending Review',
    reason: approved ? 'Auto-adjudicated: enrolled, within claim limit, IMEI verified, loss type eligible for in-store repair.' : reasons.join('; '),
    deductibleDue: deductible,
    fulfillment: approved ? 'Walk-in Screen Repair (authorized repair network)' : 'TBD - pending adjuster review',
    filedAt: new Date(), filedBy: req.user,
  };
  state.claims.push(claim);
  // Reflect the new claim in the enrollment portal's history so re-runs see it.
  sub.claims.push({ claimNumber: claim.claimNumber, date: `${t.y}-${t.m}-${t.d}`, lossType: claim.lossType, status: approved ? 'Open - Approved' : 'Open - Pending Review', deductible: deductible });

  logActivity('claims', req.user, 'CLAIM_FILED', `${claim.claimNumber} for ${sub.id} (${sub.name}), ${claim.lossType}, ${claim.status}`, req);
  res.redirect(`/claims/confirmation/${claim.claimNumber}`);
});

router.get('/confirmation/:claimNumber', (req, res) => {
  const claim = state.claims.find(c => c.claimNumber === req.params.claimNumber);
  if (!claim) return res.status(404).render('error', { code: 404, message: 'Claim not found.' });
  res.render('claims/confirmation', { pageTitle: `Claim ${claim.claimNumber}`, claim });
});

module.exports = router;
