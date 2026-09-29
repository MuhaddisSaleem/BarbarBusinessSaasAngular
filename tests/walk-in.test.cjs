const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, DAY, NEXT } = require('./harness.cjs');
function setup() {
  const f=fixture(), barber=f.barber(), service=f.service();
  const request=(patch={})=>({customerName:'Walk-in Guest',phone:'',serviceIds:[service.id],barber:barber.name,date:DAY,time:'4:30 PM',notes:'',...patch});
  return {...f,staff:barber,offering:service,request};
}
test('walk-ins can start now, use catalog prices, and reserve their full duration',()=>{
  const f=setup(), result=f.bookings.addWalkInBooking(f.request());
  assert.equal(result.success,true);assert.equal(result.booking.source,'Walk-in');assert.equal(result.booking.status,'Confirmed');
  assert.equal(result.booking.serviceLocation,'Salon');assert.equal(result.booking.amount,600);assert.equal(result.booking.duration,40);
  f.select(f.staff,f.offering);assert.equal(f.customer.availableTimes.includes('5:00 PM'),false);
});
test('multiple services total durations and discounted salon prices',()=>{
  const f=setup(), second=f.service({name:'Beard',duration:20,originalPrice:400,discountPrice:300});
  const r=f.bookings.addWalkInBooking(f.request({serviceIds:[f.offering.id,second.id]}));
  assert.equal(r.success,true);assert.equal(r.booking.amount,900);assert.equal(r.booking.duration,60);assert.equal(r.booking.service,'Haircut, Beard');
});
test('next available can use a real gap without rounding to the online booking grid',()=>{
  const f=setup();f.booking({time:'4:00 PM',duration:55});
  const slot=f.bookings.getWalkInSlots([f.offering.id])[0];
  assert.equal(slot.time,'4:55 PM');assert.equal(slot.endTime,'5:35 PM');
  assert.equal(f.bookings.addWalkInBooking(f.request({time:slot.time})).success,true);
});
test('overlapping and back-to-back appointments are skipped until the entire service fits',()=>{
  const f=setup();f.booking({time:'5:00 PM',duration:40});f.booking({time:'6:00 PM',duration:40});
  assert.equal(f.bookings.getWalkInSlots([f.offering.id])[0].time,'6:40 PM');
  assert.equal(f.bookings.addWalkInBooking(f.request()).success,false);
});
test('earliest eligible barber is listed first, even when another barber is busy',()=>{
  const f=setup(), other=f.barber({name:'Second Barber'});f.booking();
  const slots=f.bookings.getWalkInSlots([f.offering.id]);assert.equal(slots[0].barber,other.name);assert.equal(slots[0].time,'4:30 PM');
});
test('walk-in-only same-day exception preserves online and regular admin rules',()=>{
  const f=setup();f.settings.settings.allowSameDayBooking=false;
  assert.ok(f.bookings.getWalkInSlots([f.offering.id]).length);
  assert.equal(f.bookings.addBooking({customerName:'Normal',phone:'+92 300 1234567',service:'Haircut',duration:40,amount:600,barber:f.staff.name,date:DAY,time:'6:00 PM'}).success,false);
  f.select(f.staff,f.offering);assert.equal(f.customer.availableTimes.length,0);
  assert.equal(f.bookings.addWalkInBooking(f.request()).success,true);
});
for(const patch of [{accountStatus:'Inactive'},{availability:'On Leave',leaveFrom:DAY,leaveTo:NEXT},{specialties:['Other']},{workingHours:'invalid'},{workingHours:'9 AM - 4 PM'}]) {
  test('walk-ins respect barber constraint '+JSON.stringify(patch),()=>{
    const f=setup();Object.assign(f.staff,patch);assert.equal(f.bookings.getWalkInSlots([f.offering.id]).length,0);assert.equal(f.bookings.addWalkInBooking(f.request()).success,false);
  });
}
test('closed days and insufficient time before closing block walk-ins',()=>{
  const f=setup();f.settings.settings.businessHours[0].close='17:00';assert.equal(f.bookings.getWalkInSlots([f.offering.id]).length,0);assert.equal(f.bookings.addWalkInBooking(f.request()).success,false);
  f.settings.settings.businessHours[0].enabled=false;assert.equal(f.bookings.getWalkInSlots([f.offering.id]).length,0);
});
test('past, tomorrow and malformed times are rejected',()=>{
  const f=setup();for(const patch of [{date:NEXT},{date:'2026-09-27'},{time:'4:29 PM'},{time:'13:00 PM'},{time:'invalid'}]) assert.equal(f.bookings.addWalkInBooking(f.request(patch)).success,false);
});
test('inactive, missing, duplicate and invalid-duration services cannot be booked',()=>{
  const f=setup();for(const serviceIds of [[],[999],[f.offering.id,f.offering.id]])assert.equal(f.bookings.addWalkInBooking(f.request({serviceIds})).success,false);
  f.offering.status='Inactive';assert.equal(f.bookings.addWalkInBooking(f.request()).success,false);
  f.offering.status='Active';f.offering.duration=NaN;assert.equal(f.bookings.addWalkInBooking(f.request()).success,false);
});
for(const phone of ['', '3001234567','03001234567','+92 300 1234567','00923001234567'])test('optional mobile accepts '+(phone||'blank'),()=>{
  const f=setup(),r=f.bookings.addWalkInBooking(f.request({phone}));assert.equal(r.success,true);assert.equal(r.booking.phone,phone?'+92 300 1234567':'');
});
test('invalid mobile and blank name are rejected without creating records',()=>{
  const f=setup();for(const patch of [{phone:'123'},{phone:'abc'},{phone:'300123456789'},{customerName:'   '}])assert.equal(f.bookings.addWalkInBooking(f.request(patch)).success,false);assert.equal(f.bookings.all.length,0);
});
test('last-minute conflicts and duplicate submissions cannot double book',()=>{
  const f=setup();const slot=f.bookings.getWalkInSlots([f.offering.id])[0];f.booking({time:slot.time});assert.equal(f.bookings.addWalkInBooking(f.request()).success,false);
  f.bookings.cancel(f.bookings.all[0].id);assert.equal(f.bookings.addWalkInBooking(f.request()).success,true);assert.equal(f.bookings.addWalkInBooking(f.request()).success,false);
});
test('failed persistence is atomic and sends no notification',()=>{
  const f=setup();f.fail('royal-barbers.admin-bookings.v1');assert.equal(f.bookings.addWalkInBooking(f.request()).success,false);assert.equal(f.bookings.all.length,0);assert.equal(f.notifications.length,0);
});
test('walk-in source survives reload and normal completion/cancellation still work',()=>{
  const f=setup();const r=f.bookings.addWalkInBooking(f.request());f.bookings.refreshFromStorage();assert.equal(f.bookings.all[0].source,'Walk-in');
  assert.equal(f.bookings.updateStatus(r.booking.id,'Completed').success,true);assert.equal(f.bookings.reschedule(r.booking.id,NEXT,'5:00 PM').success,false);
});
test('unnumbered walk-ins stay separate customers; numbered visits still join their customer',()=>{
  const f=setup();const a=f.bookings.addWalkInBooking(f.request()).booking;const b=f.bookings.addWalkInBooking(f.request({time:'5:10 PM'})).booking;
  const customers=f.make('admin/customers/admin-customer.service.ts','AdminCustomerService',f.bookings);
  assert.equal(customers.all.length,2);assert.notEqual(customers.all[0].id,customers.all[1].id);
  assert.equal(customers.bookingsForCustomer(customers.getById('walk-in-'+a.id)).length,1);
  f.bookings.updateStatus(b.id,'Completed');assert.equal(customers.getById('walk-in-'+b.id).totalSpend,600);
  f.booking({phone:'+92 300 1234567',time:'6:00 PM'});f.bookings.addWalkInBooking(f.request({time:'7:00 PM',phone:'03001234567'}));
  assert.equal(customers.getById('923001234567').bookingCount,2);
});
