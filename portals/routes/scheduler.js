// Portal C: Repair Network Scheduler (/scheduler)
const express = require('express');
const { state, REPAIR_TYPES, DEVICE_MODELS, WHAT_TO_BRING } = require('../data/seed');
const { PORTALS, requireLogin, loginHandler, logoutHandler, logActivity, todayParts, fmtTime12, fmtDateLong, normModel } = require('../lib');

const router = express.Router();
const portal = PORTALS.scheduler;
router.use((req, res, next) => { res.locals.portal = portal; next(); });

router.get('/', (req, res) => res.redirect('/scheduler/search'));
router.get('/login', (req, res) => res.render('login', { portal, username: '', pageTitle: 'Sign In', nextUrl: typeof req.query.next === 'string' ? req.query.next : '' }));
router.post('/login', loginHandler('scheduler'));
router.get('/logout', logoutHandler('scheduler'));

router.use(requireLogin('scheduler'));
router.use((req, res, next) => { res.locals.user = req.user; next(); });

function resolveModel(input) {
  const n = normModel(input);
  if (!n) return null;
  return DEVICE_MODELS.find(m => normModel(m) === n) || null;
}

// Slots are fixed clock times "today" in the demo timezone. If every slot for a
// store is already in the past (late-day rehearsal), roll that store to tomorrow
// so the demo never shows an empty schedule. DEMO_FREEZE_TIME=1 disables rolling.
function availableSlots(store) {
  const t = todayParts();
  const freeze = process.env.DEMO_FREEZE_TIME === '1';
  const remaining = store.slots.filter(hhmm => {
    const [h, m] = hhmm.split(':').map(Number);
    return freeze || (h * 60 + m) > t.minutesNow + 30; // need >= 30 min lead time
  });
  let dateKey = `${t.y}-${t.m}-${t.d}`, dayLabel = 'Today', list = remaining;
  if (!remaining.length) {
    const d = new Date(Date.UTC(Number(t.y), Number(t.m) - 1, Number(t.d) + 1));
    dateKey = d.toISOString().slice(0, 10); dayLabel = 'Tomorrow'; list = store.slots;
  }
  const [y, m, d] = dateKey.split('-');
  return list.map(hhmm => ({ value: `${dateKey}T${hhmm}`, label: `${dayLabel}, ${fmtDateLong(y, m, d)} at ${fmtTime12(hhmm)}`, time12: fmtTime12(hhmm), dayLabel, dateKey }));
}

function partsInStock(store, model, repairType) {
  if (repairType === 'Screen Repair' || repairType === 'Back Glass') return store.screenParts.includes(model);
  if (repairType === 'Diagnostic') return true;
  return store.screenParts.length >= 5; // larger stores stock batteries/ports
}

router.get('/search', (req, res) => {
  res.render('scheduler/search', { pageTitle: 'Find Repair Location', REPAIR_TYPES, DEVICE_MODELS, form: { zip: '', device_model: '', repair_type: 'Screen Repair' }, error: null });
});

router.post('/search', (req, res) => {
  const form = { zip: String(req.body.zip || '').trim(), device_model: String(req.body.device_model || '').trim(), repair_type: String(req.body.repair_type || '') };
  const renderErr = (error) => res.status(400).render('scheduler/search', { pageTitle: 'Find Repair Location', REPAIR_TYPES, DEVICE_MODELS, form, error });
  if (!/^\d{5}$/.test(form.zip)) return renderErr('Enter a 5-digit ZIP code. (Error code VAL-200)');
  const model = resolveModel(form.device_model);
  if (!model) return renderErr(`Device model "${form.device_model}" is not in the parts catalog. Supported: ${DEVICE_MODELS.join(', ')}. (Error code VAL-201)`);
  if (!REPAIR_TYPES.includes(form.repair_type)) return renderErr('Select a repair type. (Error code VAL-202)');
  res.redirect(`/scheduler/results?zip=${form.zip}&device_model=${encodeURIComponent(model)}&repair_type=${encodeURIComponent(form.repair_type)}`);
});

router.get('/results', (req, res) => {
  const zip = String(req.query.zip || ''), repair_type = String(req.query.repair_type || '');
  const model = resolveModel(req.query.device_model);
  if (!model || !/^\d{5}$/.test(zip) || !REPAIR_TYPES.includes(repair_type)) return res.redirect('/scheduler/search');
  const rows = state.stores
    .map(s => ({ store: s, parts: partsInStock(s, model, repair_type), slots: availableSlots(s) }))
    .sort((a, b) => a.store.distanceMi - b.store.distanceMi);
  logActivity('scheduler', req.user, 'STORE_SEARCH', `ZIP ${zip}, ${model}, ${repair_type} -> ${rows.filter(r => r.parts).length} of ${rows.length} stores with parts`, req);
  res.render('scheduler/results', { pageTitle: 'Available Locations', zip, model, repair_type, rows });
});

router.get('/book', (req, res) => {
  const store = state.stores.find(s => s.id === req.query.store);
  const model = resolveModel(req.query.device_model);
  const repair_type = String(req.query.repair_type || '');
  if (!store || !model) return res.redirect('/scheduler/search');
  const slots = availableSlots(store);
  res.render('scheduler/book', { pageTitle: 'Book Appointment', store, model, repair_type, zip: String(req.query.zip || ''), slots, form: { slot: slots[0] ? slots[0].value : '', claim_number: '', customer_name: '' }, error: null });
});

router.post('/book', (req, res) => {
  const store = state.stores.find(s => s.id === req.body.store_id);
  const model = resolveModel(req.body.device_model);
  const repair_type = String(req.body.repair_type || '');
  if (!store || !model) return res.redirect('/scheduler/search');
  const slots = availableSlots(store);
  const form = { slot: String(req.body.slot || ''), claim_number: String(req.body.claim_number || '').trim().toUpperCase(), customer_name: String(req.body.customer_name || '').trim() };
  const renderErr = (error) => res.status(400).render('scheduler/book', { pageTitle: 'Book Appointment', store, model, repair_type, zip: String(req.body.zip || ''), slots, form, error });
  const slot = slots.find(s => s.value === form.slot);
  if (!slot) return renderErr('Select an available time slot. (Error code VAL-210)');
  if (!/^CLM-\d{4}-\d{7}$/.test(form.claim_number)) return renderErr('Claim # is required in the format CLM-YYYY-NNNNNNN. (Error code VAL-211)');
  if (form.customer_name.length < 2) return renderErr('Customer name is required. (Error code VAL-212)');
  if (!partsInStock(store, model, repair_type)) return renderErr(`${store.name} does not have ${model} parts in stock for ${repair_type}. Choose another location. (Error code INV-300)`);

  state.bookingSeq += 1;
  const booking = {
    ref: `RB-${state.bookingSeq.toString(36).toUpperCase()}`,
    storeId: store.id, storeName: store.name, address: store.address, phone: store.phone,
    model, repairType: repair_type, slotValue: slot.value, slotLabel: slot.label, time12: slot.time12, dayLabel: slot.dayLabel,
    claimNumber: form.claim_number, customerName: form.customer_name, bookedAt: new Date(), bookedBy: req.user,
  };
  state.bookings.push(booking);
  // Consume the slot so a second run books the next one. /admin/reset restores it.
  const hhmm = slot.value.split('T')[1];
  store.slots = store.slots.filter(s => s !== hhmm);

  logActivity('scheduler', req.user, 'APPOINTMENT_BOOKED', `${booking.ref} at ${store.name} ${slot.label} for ${form.customer_name} (${form.claim_number})`, req);
  res.redirect(`/scheduler/confirmation/${booking.ref}`);
});

router.get('/confirmation/:ref', (req, res) => {
  const booking = state.bookings.find(b => b.ref === req.params.ref);
  if (!booking) return res.status(404).render('error', { code: 404, message: 'Booking not found.' });
  res.render('scheduler/confirmation', { pageTitle: `Booking ${booking.ref}`, booking, WHAT_TO_BRING });
});

module.exports = router;
