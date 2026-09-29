const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve('dist/barberflow-booking/browser');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const server = http.createServer((req,res)=>{
  let file=path.join(root,decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
const barber=(id,name,specialties)=>({id,name,specialties,rating:5,phone:'+92 300 1234567',accountStatus:'Active',availability:'Available Today',workingHours:'9 AM - 9 PM',experience:'5 years',image:'assets/images/barber-placeholder.svg'});
const service=(id,name,duration,originalPrice,discountPrice=null)=>({id,name,duration,originalPrice,discountPrice,homeServiceEnabled:true,homeOriginalPrice:900,homeDiscountPrice:null,status:'Active',image:'assets/images/service-placeholder.svg'});
const existing={id:1,code:'BK-2601',customerName:'Existing Online',phone:'+92 300 1234567',service:'Haircut',duration:40,amount:600,barber:'Falak Shair',date:'2026-09-28',time:'5:00 PM',status:'Confirmed',source:'Online',serviceLocation:'Salon',notes:'',groupSize:1};
const seed={
  'royal-barbers.admin-barbers.v1':[barber(1,'Falak Shair',['Haircut','Beard']),barber(2,'Second Barber',['Beard'])],
  'royal-barbers.admin-services.v1':[service(1,'Haircut',40,600),service(2,'Beard',20,400,300)],
  'royal-barbers.admin-bookings.v1':[existing],
  'royal-barbers.admin-settings.v1':{allowSameDayBooking:false,autoConfirmBookings:false}
};
let browser,activePage;
(async()=>{
  await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});fs.mkdirSync('test-results',{recursive:true});
  let scenarios=0;
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'Asia/Karachi'});
    const page=await context.newPage();activePage=page;page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install({time:new Date('2026-09-28T11:30:00Z')});
    await page.clock.setFixedTime(new Date('2026-09-28T11:30:00Z'));
    await page.addInitScript(seed=>{
      if(localStorage.getItem('walk-in-qa-seeded'))return;
      for(const [key,value] of Object.entries(seed))localStorage.setItem(key,JSON.stringify(value));
      for(const type of ['barbers','services','bookings'])localStorage.setItem('royal-barbers.admin-'+type+'.demo-cleaned.v1','1');
      localStorage.setItem('walk-in-qa-seeded','1');
    },seed);
    await page.goto('http://127.0.0.1:4173/admin/bookings');
    await page.locator('app-admin-shell').waitFor();
    const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('royal-barbers.admin-bookings.v1')));
    const open=async()=>{await page.locator('.walk-in-btn').click();await page.locator('.walk-in-modal').waitFor();};
    const modal=page.locator('.walk-in-modal');
    const pick=async name=>modal.locator('.service-option').filter({hasText:name}).locator('input').check();
    const save=()=>modal.locator('.submit-walk-in');
    const closeDrawer=()=>page.getByRole('button',{name:'Close details',exact:true}).click();
    await open();
    assert.equal(await save().isDisabled(),true);
    await modal.locator('[name=walkInName]').fill('Walk-in Guest');
    await pick('Haircut');await pick('Beard');
    assert.equal(await modal.locator('.walk-in-slot').count(),1);
    assert.match(await modal.locator('.walk-in-slot').innerText(),/5:40 PM/);
    assert.match(await modal.locator('.walk-in-summary').innerText(),/60 minutes.*Rs\. 900/s);
    await page.screenshot({path:`test-results/walk-in-form-${width}.png`,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    await save().click();await modal.waitFor({state:'hidden'});
    await page.locator('.booking-drawer.open').waitFor();
    const first=(await stored())[0];
    assert.equal(first.customerName,'Walk-in Guest');assert.equal(first.phone,'');
    assert.equal(first.source,'Walk-in');assert.equal(first.status,'Confirmed');
    assert.equal(first.service,'Haircut, Beard');assert.equal(first.duration,60);assert.equal(first.amount,900);
    assert.equal(first.date,'2026-09-28');assert.equal(first.time,'5:40 PM');assert.equal(first.serviceLocation,'Salon');
    const retained=(await stored()).find(x=>x.id===1);
    for(const [key,value] of Object.entries(existing))assert.deepEqual(retained[key],value);
    await page.screenshot({path:`test-results/walk-in-saved-${width}.png`,fullPage:true});
    await closeDrawer();scenarios++;
    // A guest without a phone has a separate history and no unusable contact links.
    await page.goto('http://127.0.0.1:4173/admin/customers');
    const guest=page.locator(width===390?'.customer-mobile-card':'.customers-table tbody tr').filter({hasText:'Walk-in Guest'});
    await guest.click();await page.locator('.customer-drawer.open').waitFor();
    assert.equal(await page.locator('.customer-drawer .contact-actions').count(),0);
    assert.equal(await page.locator('.customer-drawer .history-item').count(),1);
    await page.locator('.all-bookings-btn').click();await page.locator('.booking-drawer.open').waitFor();
    assert.match(await page.locator('.booking-drawer .customer-panel').innerText(),/Walk-in Guest/);
    assert.equal(new URL(page.url()).searchParams.get('booking'),String(first.id));
    await closeDrawer();scenarios++;
    // Optional phone validation keeps the entered details, then accepts a real local format.
    await open();await modal.locator('[name=walkInName]').fill('Returning Walk-in');
    await pick('Beard');await modal.locator('[name=walkInPhone]').fill('123');await save().click();
    await modal.getByRole('alert').filter({hasText:'valid Pakistan mobile'}).waitFor();
    assert.equal((await stored()).length,2);assert.equal(await modal.locator('[name=walkInName]').inputValue(),'Returning Walk-in');
    await modal.locator('[name=walkInPhone]').fill('0300 1234567');
    await modal.locator('.walk-in-slot').filter({hasText:'Second Barber'}).click();await save().click();
    await modal.waitFor({state:'hidden'});await page.locator('.booking-drawer.open').waitFor();
    assert.equal((await stored())[0].phone,'+92 300 1234567');assert.equal((await stored())[0].time,'4:30 PM');
    await closeDrawer();await page.reload();await page.locator('.walk-in-btn').waitFor();
    assert.equal((await stored()).filter(x=>x.source==='Walk-in').length,2);scenarios++;
    // Existing ordinary booking still starts tomorrow when online same-day booking is disabled.
    assert.equal(await page.locator('.create-booking-btn').count(),1);
    await page.locator('.create-booking-btn').click();
    assert.equal(await page.locator('.create-modal input[type=date]').getAttribute('min'),'2026-09-29');
    await page.locator('.create-modal .icon-btn').click();scenarios++;
    // A second admin tab reserves the reviewed slot; the open modal must require a new selection.
    await open();await modal.locator('[name=walkInName]').fill('Conflict Guest');await pick('Haircut');
    assert.match(await modal.locator('.walk-in-slot.selected').innerText(),/6:40 PM/);
    const other=await context.newPage();await other.goto('http://127.0.0.1:4173/admin/bookings');
    await other.evaluate(existing=>{
      const key='royal-barbers.admin-bookings.v1';const bookings=JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key,JSON.stringify([{...existing,id:99,code:'BK-2699',time:'6:40 PM',customerName:'Other Desk'},...bookings]));
    },existing);
    await modal.getByRole('alert').filter({hasText:'Availability refreshed'}).waitFor();
    assert.equal(await save().isDisabled(),true);assert.equal(await modal.locator('[name=walkInName]').inputValue(),'Conflict Guest');
    assert.match(await modal.locator('.walk-in-slot').innerText(),/7:20 PM/);
    await modal.locator('.walk-in-slot').click();await save().click();await modal.waitFor({state:'hidden'});
    assert.equal((await stored())[0].time,'7:20 PM');await closeDrawer();await other.close();scenarios++;
    // Closed salon exposes a useful empty state and cannot create a booking.
    await page.evaluate(()=>{
      const key='royal-barbers.admin-settings.v1';const settings=JSON.parse(localStorage.getItem(key));
      settings.businessHours=[{key:'monday',label:'Monday',enabled:false,open:'08:00',close:'21:00'}];
      localStorage.setItem(key,JSON.stringify(settings));
    });
    await open();await modal.locator('[name=walkInName]').fill('Closed Guest');await pick('Haircut');
    await modal.getByText('No eligible barber has enough free time today',{exact:false}).waitFor();
    assert.equal(await save().isDisabled(),true);assert.equal(await modal.locator('.walk-in-slot').count(),0);
    await page.screenshot({path:`test-results/walk-in-empty-${width}.png`,fullPage:true});
    await modal.getByRole('button',{name:'Close walk-in booking'}).click();scenarios++;
    assert.deepEqual(errors,[]);console.log(`PASS walk-in ${width}px: multi-service, guest history, optional phone, regular booking policy, cross-tab conflict, closed salon`);
    await context.close();
  }
  console.log(`PASS ${scenarios} walk-in browser scenarios`);
})().catch(async error=>{console.error(error);if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:'test-results/walk-in-failure.png',fullPage:true});fs.writeFileSync('test-results/walk-in-failure.html',await activePage.content());console.error((await activePage.locator('body').innerText()).slice(-5000));}process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
