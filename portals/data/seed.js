// Seed data + mutable in-memory state for the three mock portals.
// Everything here is fictional. No real subscribers, carriers' systems, or stores.

const PLANS = {
  'Total Mobile Protection': {
    carrier: 'Verizon',
    claimLimit: 3,
    deductibles: { 'Cracked Screen': 29, 'Physical Damage': 99, 'Liquid Damage': 99, 'Loss': 249, 'Theft': 249, 'Malfunction': 0 },
  },
  'Wireless Phone Protection': {
    carrier: 'Verizon',
    claimLimit: 2,
    deductibles: { 'Cracked Screen': 29, 'Physical Damage': 99, 'Liquid Damage': 99, 'Loss': 249, 'Theft': 249, 'Malfunction': 0 },
  },
  'Protect Advantage for 1': {
    carrier: 'AT&T',
    claimLimit: 3,
    deductibles: { 'Cracked Screen': 29, 'Physical Damage': 99, 'Liquid Damage': 99, 'Loss': 225, 'Theft': 225, 'Malfunction': 0 },
  },
  'Protection 360': {
    carrier: 'T-Mobile',
    claimLimit: 5,
    deductibles: { 'Cracked Screen': 29, 'Physical Damage': 99, 'Liquid Damage': 99, 'Loss': 249, 'Theft': 249, 'Malfunction': 0 },
  },
};

const LOSS_TYPES = ['Cracked Screen', 'Physical Damage', 'Liquid Damage', 'Loss', 'Theft', 'Malfunction'];
const REPAIR_TYPES = ['Screen Repair', 'Battery Replacement', 'Back Glass', 'Charging Port', 'Diagnostic'];

// Models the scheduler knows how to source parts for.
const DEVICE_MODELS = [
  'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13',
  'Galaxy S24 Ultra', 'Galaxy S24', 'Galaxy S23', 'Galaxy A54',
  'Pixel 8 Pro', 'Pixel 8', 'Pixel 7a',
];

// Mobile numbers are stored as 10 digits. All are in the fictional 555-01xx range.
const SUBSCRIBERS_SEED = [
  { // HAPPY PATH: enrolled, no claims, iPhone 15 Pro cracked screen -> auto approve
    id: 'SUB-1004471', mobile: '6155550101', name: 'Maria Alvarez', pinLast4: '4471',
    carrier: 'Verizon', plan: 'Total Mobile Protection', status: 'Active', enrolledSince: '2024-03-14',
    device: { make: 'Apple', model: 'iPhone 15 Pro', imei: '356789104512345', color: 'Blue Titanium', storage: '256GB' },
    address: '1200 Broadway, Apt 4B, Nashville, TN 37203',
    claims: [],
  },
  { // EDGE: at claim limit (plan allows 2, has 2 in last 12 months)
    id: 'SUB-1004472', mobile: '6155550102', name: 'Derek Okafor', pinLast4: '8820',
    carrier: 'Verizon', plan: 'Wireless Phone Protection', status: 'Active', enrolledSince: '2022-11-02',
    device: { make: 'Apple', model: 'iPhone 14', imei: '356789104598711', color: 'Midnight', storage: '128GB' },
    address: '310 Rep. John Lewis Way, Nashville, TN 37219',
    claims: [
      { claimNumber: 'CLM-2026-0041188', date: '2026-02-11', lossType: 'Cracked Screen', status: 'Closed - Repaired', deductible: 29 },
      { claimNumber: 'CLM-2026-0045902', date: '2026-07-29', lossType: 'Physical Damage', status: 'Closed - Replaced', deductible: 99 },
    ],
  },
  { // EDGE: not enrolled
    id: 'SUB-1004473', mobile: '6155550103', name: 'Priya Nair', pinLast4: '2210',
    carrier: 'Verizon', plan: null, status: 'Not Enrolled', enrolledSince: null,
    device: { make: 'Samsung', model: 'Galaxy S24', imei: '358240091122334', color: 'Onyx Black', storage: '256GB' },
    address: '2100 West End Ave, Nashville, TN 37203',
    claims: [],
    notes: 'Declined device protection at activation (2025-09-18). Eligible to enroll within 30 days of activation or during open enrollment.',
  },
  { // EDGE: device mismatch (enrolled device is a Galaxy S23; customer will describe an iPhone)
    id: 'SUB-1004474', mobile: '6155550104', name: 'Tom Brenner', pinLast4: '9034',
    carrier: 'Verizon', plan: 'Total Mobile Protection', status: 'Active', enrolledSince: '2023-05-21',
    device: { make: 'Samsung', model: 'Galaxy S23', imei: '358240091177889', color: 'Phantom Black', storage: '128GB' },
    address: '4015 Hillsboro Pike, Nashville, TN 37215',
    claims: [],
  },
  {
    id: 'SUB-2007731', mobile: '6155550105', name: 'Angela Whitfield', pinLast4: '1150',
    carrier: 'AT&T', plan: 'Protect Advantage for 1', status: 'Active', enrolledSince: '2024-09-09',
    device: { make: 'Apple', model: 'iPhone 14 Pro', imei: '356789104533001', color: 'Deep Purple', storage: '256GB' },
    address: '88 Music Square E, Nashville, TN 37203',
    claims: [
      { claimNumber: 'CLM-2026-0043377', date: '2026-04-03', lossType: 'Cracked Screen', status: 'Closed - Repaired', deductible: 29 },
    ],
  },
  {
    id: 'SUB-2007732', mobile: '6155550106', name: 'Luis Herrera', pinLast4: '7708',
    carrier: 'AT&T', plan: 'Protect Advantage for 1', status: 'Active', enrolledSince: '2025-01-30',
    device: { make: 'Google', model: 'Pixel 8 Pro', imei: '357512093311220', color: 'Bay', storage: '128GB' },
    address: '501 Commerce St, Nashville, TN 37203',
    claims: [],
  },
  {
    id: 'SUB-3001920', mobile: '6155550107', name: 'Keisha Thompson', pinLast4: '3391',
    carrier: 'T-Mobile', plan: 'Protection 360', status: 'Active', enrolledSince: '2023-12-12',
    device: { make: 'Samsung', model: 'Galaxy S24 Ultra', imei: '358240091199005', color: 'Titanium Gray', storage: '512GB' },
    address: '1 Titans Way, Nashville, TN 37213',
    claims: [
      { claimNumber: 'CLM-2025-0039120', date: '2025-11-20', lossType: 'Liquid Damage', status: 'Closed - Replaced', deductible: 99 },
    ],
  },
  {
    id: 'SUB-3001921', mobile: '6155550108', name: 'Samuel Park', pinLast4: '6627',
    carrier: 'T-Mobile', plan: 'Protection 360', status: 'Active', enrolledSince: '2024-06-18',
    device: { make: 'Apple', model: 'iPhone 13', imei: '356789104511098', color: 'Starlight', storage: '128GB' },
    address: '2525 West End Ave, Nashville, TN 37203',
    claims: [],
  },
  { // EDGE: lapsed enrollment (non-payment)
    id: 'SUB-1004475', mobile: '6155550109', name: 'Renee Castillo', pinLast4: '5519',
    carrier: 'Verizon', plan: 'Total Mobile Protection', status: 'Lapsed - Non-Payment', enrolledSince: '2023-02-01',
    device: { make: 'Apple', model: 'iPhone 15', imei: '356789104577210', color: 'Pink', storage: '128GB' },
    address: '700 Church St, Nashville, TN 37203',
    claims: [],
    notes: 'Protection feature removed 2026-08-15 after 60 days past due. Reinstatement requires account to be current.',
  },
  {
    id: 'SUB-1004476', mobile: '6155550110', name: 'Omar Haddad', pinLast4: '0042',
    carrier: 'Verizon', plan: 'Total Mobile Protection', status: 'Active', enrolledSince: '2025-03-03',
    device: { make: 'Google', model: 'Pixel 7a', imei: '357512093355667', color: 'Sea', storage: '128GB' },
    address: '1515 Demonbreun St, Nashville, TN 37203',
    claims: [],
  },
];

// Eight repair stores around demo ZIP 37203 (Nashville). `screenParts` lists the
// models each store has screen assemblies for today. Stores WITHOUT parts for the
// hero device (iPhone 15 Pro) are intentional so the agent visibly skips them.
const STORES_SEED = [
  { id: 'ST-0412', name: 'uBreakiFix by Asurion - Midtown', address: '1808 West End Ave, Nashville, TN 37203', phone: '(615) 555-0412', distanceMi: 0.8,
    screenParts: ['iPhone 15', 'iPhone 14 Pro', 'iPhone 14', 'Galaxy S24', 'Galaxy S23', 'Pixel 8'],   // NO iPhone 15 Pro -> skipped
    slots: ['11:45', '13:15', '16:30'] },
  { id: 'ST-0207', name: 'uBreakiFix by Asurion - The Gulch', address: '601 12th Ave S, Nashville, TN 37203', phone: '(615) 555-0207', distanceMi: 1.1,
    screenParts: ['iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13', 'Galaxy S24 Ultra', 'Galaxy S24', 'Galaxy S23', 'Pixel 8 Pro', 'Pixel 8'],
    slots: ['14:30', '15:15', '16:45'] },                                                                  // <- hero books 2:30 PM here
  { id: 'ST-0318', name: 'Phone Medic - Downtown', address: '222 2nd Ave N, Nashville, TN 37201', phone: '(615) 555-0318', distanceMi: 1.6,
    screenParts: ['Galaxy S24 Ultra', 'Galaxy S24', 'Galaxy S23', 'Galaxy A54', 'Pixel 8 Pro', 'Pixel 7a'],     // NO iPhone 15 Pro -> skipped
    slots: ['12:00', '14:00'] },
  { id: 'ST-0155', name: 'uBreakiFix by Asurion - Green Hills', address: '2126 Abbott Martin Rd, Nashville, TN 37215', phone: '(615) 555-0155', distanceMi: 4.2,
    screenParts: ['iPhone 15 Pro', 'iPhone 15', 'iPhone 14', 'iPhone 13', 'Galaxy S24', 'Pixel 8'],
    slots: ['15:45', '17:00'] },
  { id: 'ST-0523', name: 'TechFix Express - East Nashville', address: '1006 Fatherland St, Nashville, TN 37206', phone: '(615) 555-0523', distanceMi: 3.4,
    screenParts: ['iPhone 14', 'iPhone 13', 'Galaxy A54'],                                                 // NO iPhone 15 Pro -> skipped
    slots: ['13:30', '15:00', '16:15'] },
  { id: 'ST-0099', name: 'uBreakiFix by Asurion - Bellevue', address: '7620 Hwy 70 S, Nashville, TN 37221', phone: '(615) 555-0099', distanceMi: 11.3,
    screenParts: ['iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro', 'Galaxy S24 Ultra', 'Pixel 8 Pro'],
    slots: ['12:30', '14:15', '16:00', '17:30'] },
  { id: 'ST-0471', name: 'Mobile Rescue - Berry Hill', address: '2817 Bransford Ave, Nashville, TN 37204', phone: '(615) 555-0471', distanceMi: 3.9,
    screenParts: ['iPhone 15 Pro', 'Galaxy S23', 'Pixel 7a'],
    slots: ['17:15'] },
  { id: 'ST-0604', name: 'uBreakiFix by Asurion - Madison', address: '1929 Gallatin Pike N, Madison, TN 37115', phone: '(615) 555-0604', distanceMi: 8.7,
    screenParts: ['iPhone 15', 'iPhone 14', 'Galaxy S24', 'Galaxy S23'],                                   // NO iPhone 15 Pro -> skipped
    slots: ['13:00', '14:45'] },
];

const WHAT_TO_BRING = [
  'The damaged device, powered on if possible',
  'A government-issued photo ID matching the account holder',
  'Your claim number',
  'Device passcode removed, or be ready to enter it for the technician',
  'Find My iPhone / Find My Device turned OFF (Activation Lock must be disabled)',
  'Back up your data first. Repairs can require a data wipe',
];

// ---------------------------------------------------------------------------
// Mutable state (reset-able from /admin/reset)
// ---------------------------------------------------------------------------
const CLAIM_SEQ_START = 48212; // next claim issued = CLM-2026-0048213 (matches the brief)
const BOOKING_SEQ_START = 180341;

const state = {
  subscribers: [],
  stores: [],
  claims: [],       // claims filed through the console this session
  bookings: [],     // bookings made this session
  claimSeq: CLAIM_SEQ_START,
  bookingSeq: BOOKING_SEQ_START,
  activity: [],     // audit log
  startedAt: null,
  lastResetAt: null,
};

function deepClone(x) { return JSON.parse(JSON.stringify(x)); }

function reset() {
  state.subscribers = deepClone(SUBSCRIBERS_SEED);
  state.stores = deepClone(STORES_SEED);
  state.claims = [];
  state.bookings = [];
  state.claimSeq = CLAIM_SEQ_START;
  state.bookingSeq = BOOKING_SEQ_START;
  state.activity = [];
  state.lastResetAt = new Date();
  if (!state.startedAt) state.startedAt = state.lastResetAt;
}
reset();

module.exports = { PLANS, LOSS_TYPES, REPAIR_TYPES, DEVICE_MODELS, WHAT_TO_BRING, state, reset };
