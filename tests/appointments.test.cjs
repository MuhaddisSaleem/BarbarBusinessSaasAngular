const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercise real service/component methods with deterministic clock and browser storage.
// Angular decorators/imports are omitted; the production Angular build checks templates/DI.
function load(file, name, globals = {}) {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/@Injectable\([^\n]*\)\r?\n/g, '')
    .replace(/@Component\([\s\S]*?\}\)\r?\n/, '')
    .replace(/@HostListener\([^\n]*\)\r?\n/g, '');
  let code;
  try {
    const ts = require('typescript');
    code = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      useDefineForClassFields: false
    }}).outputText;
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    code = require('node:module').stripTypeScriptTypes(source.replace(/^export /gm, ''), { mode: 'transform' });
  }
  return vm.runInNewContext(code + '\n' + name, { exports: {}, Date: Clock, ...globals });
}
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [2030, 0, 7, 12, 0, 0])); }
  static now() { return new Clock().getTime(); }
}
const today = '2030-01-07';
const tomorrow = '2030-01-08';
const base = { customerName: 'Customer', phone: '+92 300 1234567', service: 'Haircut', duration: 30, barber: 'Ali', date: today, time: '1:00 PM', amount: 500, groupSize: 1 };
function fixture() {
  const storage = new Map();
  let fail = false;
  const window = { localStorage: { getItem: key => storage.get(key) || null, setItem(key, value) { if (fail) throw Error('quota'); storage.set(key, value); } }, setTimeout: () => 0 };
  const notifications = [];
  const settings = {
    current: { businessName: 'Royal Barbers', allowSameDayBooking: true, autoConfirmBookings: true },
    maxAdvanceDays: 30, bookingInterval: 30, lateArrivalMinutes: 15,
    isBookingDateAllowed: date => date >= new Clock(2030, 0, 7) && (settings.current.allowSameDayBooking || date.toDateString() !== new Clock().toDateString()),
    hoursForDate: () => ({ start: 540, end: 1080 }),
    isPastLateArrivalGrace: (date, time) => date === today && time === '11:00 AM',
    canCustomerCancel: () => true
  };
  const barbers = { active: [{ id: 1, name: 'Ali', rating: 5 }, { id: 2, name: 'Bilal', rating: 4 }], isAvailableOnDate: () => true, isWorkingAt: () => true, supportsServices: () => true };
  const services = { active: [{ name: 'Haircut', duration: 30 }], effectivePrice: () => 500 };
  const Service = load('src/app/admin/bookings/admin-booking.service.ts', 'AdminBookingService', { window });
  const service = new Service(barbers, services, settings, { add: item => notifications.push(item) });
  const seed = (changes = {}) => { const item = { ...base, id: service.all.length + 1, code: 'RB-test', status: 'Confirmed', source: 'Admin', ...changes }; service.all.push(item); return item; };
  const Component = load('src/app/admin/bookings/admin-bookings.component.ts', 'AdminBookingsComponent', { window, BOOKING_STATUSES: ['Pending','Confirmed','In Progress','Completed','Cancelled','No Show'] });
  const component = new Component(service, { snapshot: { queryParamMap: new Map() } }, settings);
  return { service, settings, barbers, seed, storage, window, notifications, component, Service, services, failSave: value => fail = value };
}

test('appointment lifecycle rejects invalid/reopened transitions and future completion', () => {
  const f = fixture(), b = f.seed({ status: 'Pending', time: '11:00 AM' });
  assert.equal(f.service.updateStatus(b.id, 'Completed').success, false);
  assert.equal(f.service.updateStatus(b.id, 'Confirmed').success, true);
  assert.equal(f.service.updateStatus(b.id, 'In Progress').success, true);
  assert.equal(f.service.reschedule(b.id, tomorrow, '1:00 PM').success, false);
  assert.equal(f.service.updateStatus(b.id, 'Completed').success, true);
  assert.equal(f.service.updateStatus(b.id, 'Confirmed').success, false);
  const future = f.seed({ date: tomorrow });
  assert.equal(f.service.updateStatus(future.id, 'Completed').success, false);
});
test('no-show requires grace period, frees the slot, survives reload and cannot reopen', () => {
  const f = fixture(), early = f.seed();
  assert.equal(f.service.updateStatus(early.id, 'No Show').success, false);
  const late = f.seed({ time: '11:00 AM' });
  assert.equal(f.service.updateStatus(late.id, 'No Show').success, true);
  assert.equal(f.service.isBarberSlotAvailable('Ali', today, '11:00 AM', 30), true);
  assert.equal(f.service.updateStatus(late.id, 'Confirmed').success, false);
  const reloaded = new f.Service(f.barbers, f.services, f.settings, { add() {} });
  assert.equal(reloaded.getById(late.id).status, 'No Show');
});
test('rescheduling validates final barber/date/time atomically and rolls back failed storage', () => {
  const f = fixture(), b = f.seed();
  f.seed({ barber: 'Bilal', time: '1:00 PM' });
  assert.equal(f.service.reschedule(b.id, today, '2:00 PM', 'Bilal').success, true);
  assert.equal(b.barber, 'Bilal');
  assert.equal(b.time, '2:00 PM');
  assert.equal(f.service.reschedule(b.id, today, '1:15 PM', 'Bilal').success, false);
  f.failSave(true);
  assert.equal(f.service.reschedule(b.id, tomorrow, '3:00 PM', 'Ali').success, false);
  assert.deepEqual([b.barber, b.date, b.time], ['Bilal', today, '2:00 PM']);
});
test('adjacent slots are accepted, overlaps and barber skill/shift/day conflicts rejected', () => {
  const f = fixture(); f.seed();
  assert.equal(f.service.addBooking({ ...base, time: '1:15 PM' }).success, false);
  assert.equal(f.service.addBooking({ ...base, time: '1:30 PM' }).success, true);
  f.barbers.supportsServices = () => false;
  assert.equal(f.service.addBooking({ ...base, time: '3:00 PM' }).success, false);
  f.barbers.supportsServices = () => true; f.barbers.isWorkingAt = () => false;
  assert.equal(f.service.addBooking({ ...base, time: '3:00 PM' }).success, false);
  f.barbers.isWorkingAt = () => true; f.barbers.isAvailableOnDate = () => false;
  assert.equal(f.service.addBooking({ ...base, time: '3:00 PM' }).success, false);
});
test('walk-in starts now with same-day online booking disabled but respects conflicts and hours', () => {
  const f = fixture(); f.settings.current.allowSameDayBooking = false;
  assert.equal(f.service.addBooking({ ...base, time: '12:00 PM' }, true).success, true);
  assert.equal(f.service.all[0].source, 'Walk-in');
  assert.equal(f.service.addBooking({ ...base, time: '12:00 PM' }, true).success, false);
  assert.equal(f.service.addBooking({ ...base, time: '11:59 AM' }, true).success, false);
  assert.equal(f.service.addBooking({ ...base, date: tomorrow }, true).success, false);
  assert.equal(f.service.addBooking(base).success, false);
  assert.equal(f.service.addBooking({ ...base, time: '6:00 PM' }, true).success, false);
});
test('invalid dates/times and stale service prices cannot be saved', () => {
  const f = fixture();
  for (const patch of [{ date: '2030-02-31' }, { time: '13:00 PM' }, { time: '1:60 PM' }, { duration: 0 }, { amount: 1 }]) {
    assert.equal(f.service.addBooking({ ...base, ...patch }).success, false);
  }
});
test('failed status/create saves roll back and do not notify', () => {
  const f = fixture(), b = f.seed({ status: 'Pending' });
  f.failSave(true);
  assert.equal(f.service.updateStatus(b.id, 'Confirmed').success, false);
  assert.equal(b.status, 'Pending');
  assert.equal(f.service.addBooking({ ...base, time: '3:00 PM' }).success, false);
  assert.equal(f.service.all.length, 1);
  assert.equal(f.notifications.length, 0);
});
test('custom home service price must be set before confirmation and closed bookings cannot be repriced', () => {
  const f = fixture(), b = f.seed({ status: 'Pending', serviceLocation: 'Home', specialService: 'Custom treatment' });
  assert.equal(f.service.updateStatus(b.id, 'Confirmed').success, false);
  assert.equal(f.service.updateSpecialServiceAmount(b.id, 200).success, true);
  assert.equal(f.service.updateStatus(b.id, 'Confirmed').success, true);
  assert.equal(f.service.cancel(b.id).success, true);
  assert.equal(f.service.updateSpecialServiceAmount(b.id, 300).success, false);
});
test('group booking conflicts are rejected without partial inserts', () => {
  const f = fixture();
  assert.equal(f.service.addOnlineBookings([base, { ...base, time: '1:15 PM' }]).success, false);
  assert.equal(f.service.all.length, 0);
});
test('filters/pagination and walk-in form defaults use the shared appointments', () => {
  const f = fixture(), c = f.component;
  for (let i = 0; i < 12; i++) f.seed({ customerName: 'Customer ' + i });
  f.seed({ status: 'No Show', customerName: 'Absent customer' });
  assert.equal(c.bookings.length, 13);
  assert.equal(c.pagedBookings.length, 10);
  c.changePage(1); assert.equal(c.pagedBookings.length, 3);
  c.selectedStatus = 'No Show'; assert.equal(c.bookings.length, 1);
  assert.equal(c.currentPage, 1);
  c.resetFilters(); c.searchTerm = 'customer 11'; assert.equal(c.bookings.length, 1);
  c.resetFilters(); c.selectedBarber = 'Bilal'; assert.equal(c.bookings.length, 0);
  f.settings.current.allowSameDayBooking = false;
  c.openCreateModal(); assert.equal(c.newBooking.date, tomorrow);
  c.openCreateModal(true); assert.equal(c.newBooking.date, today);
  c.newBooking.service = 'Haircut'; c.newBooking.barber = 'Ali';
  assert.equal(c.createTimeSlots.includes('12:00 PM'), true);
});
