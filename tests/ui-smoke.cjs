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
const barber=(id,name,specialties,rating)=>({id,name,specialties,rating,phone:'+92 300 1234567',accountStatus:'Active',availability:'Available Today',workingHours:'9 AM - 9 PM',experience:'5 years',image:'assets/images/barber-placeholder.svg'});
const service=(id,name)=>({id,name,duration:40,originalPrice:600,discountPrice:null,homeServiceEnabled:true,homeOriginalPrice:900,homeDiscountPrice:null,status:'Active',image:'assets/images/service-placeholder.svg'});
const seed={
  'royal-barbers.admin-barbers.v1':[barber(1,'Falak Shair',['Haircut','Beard'],5),barber(2,'Second Barber',['Haircut'],4)],
  'royal-barbers.admin-services.v1':[service(1,'Haircut'),service(2,'Beard')],
  'royal-barbers.admin-bookings.v1':[]
};
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});fs.mkdirSync('test-results',{recursive:true});
  let scenarios=0;
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'UTC'});
    const page=await context.newPage();page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install({time:new Date('2026-09-28T16:30:00Z')});
    await page.addInitScript(seed=>{
      if(localStorage.getItem('qa-seeded'))return;
      for(const [key,value] of Object.entries(seed))localStorage.setItem(key,JSON.stringify(value));
      for(const type of ['barbers','services','bookings'])localStorage.setItem('royal-barbers.admin-'+type+'.demo-cleaned.v1','1');
      localStorage.setItem('qa-seeded','1');
    },seed);
    const goto=async(route='/')=>{await page.goto('http://127.0.0.1:4173'+route);await page.locator(route==='/'?'app-booking':'app-admin-shell').waitFor();};
    const day=()=>page.locator('.calendar-days button').filter({hasText:/^28$/}).click();
    const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('royal-barbers.admin-bookings.v1')));
    const details=async()=>{await page.locator('#customer-name-input').fill('QA Customer');await page.locator('#customer-phone-input').fill('3001234567');};
    const finish=async()=>{await page.locator('.confirm-btn').click();await page.locator('.success-modal').waitFor();await page.locator('.success-modal button').click();};
    await goto();await page.locator('.services-grid .service-card').filter({hasText:'Haircut'}).click();await page.locator('.barber-card').filter({hasText:'Falak Shair'}).click();await day();
    assert.ok(await page.locator('.time-slot').filter({hasText:/^5:00 PM$/}).count());
    await page.locator('.time-slot').filter({hasText:/^5:00 PM$/}).click();await details();
    await page.screenshot({path:`test-results/customer-${width}.png`,fullPage:true});await finish();
    assert.equal((await stored()).length,1);assert.equal((await stored())[0].status,'Confirmed');scenarios++;
    // Customer's persisted booking is visible to admin and its overlap cannot be selected.
    await goto('/admin/bookings');await page.getByRole('button',{name:'New Booking',exact:true}).click();
    const form=page.locator('.create-modal'), selects=form.locator('select');assert.equal(await selects.nth(2).isDisabled(),true);
    await selects.nth(0).selectOption('Haircut');await selects.nth(1).selectOption('Falak Shair');
    const slots=await selects.nth(2).locator('option').allTextContents();assert.equal(slots.includes('5:00 PM'),false);assert.equal(slots.includes('5:30 PM'),false);assert.ok(slots.includes('6:00 PM'));
    await form.getByPlaceholder('Enter full name').fill('Admin QA');await form.getByPlaceholder('3001234567').fill('3001234567');await selects.nth(2).selectOption({label:'6:00 PM'});await form.locator('.submit-booking-btn').click();await form.waitFor({state:'hidden'});assert.equal((await stored()).length,2);scenarios++;
    // Specialist matching must select two different barbers for parallel Any Barber bookings.
    await goto();await page.locator('.booking-for-toggle button').nth(1).click();await page.locator('.services-grid .service-card').filter({hasText:'Haircut'}).click();await page.locator('.any-barber').click();await page.locator('.participant-tab').nth(1).click();await page.locator('.services-grid .service-card').filter({hasText:'Beard'}).click();await page.locator('.any-barber').click();await day();await page.locator('.time-slot').filter({hasText:/^7:00 PM$/}).click();await details();await finish();
    const group=(await stored()).slice(0,2);assert.equal(new Set(group.map(x=>x.barber)).size,2);assert.ok(group.every(x=>x.time==='7:00 PM'));scenarios++;
    await page.locator('.home-service-selector').click();await page.getByPlaceholder('Example: Groom styling for an event, special beard treatment, etc.').fill('Event styling');await day();await page.locator('.time-slot').filter({hasText:/^8:00 PM$/}).click();await details();await page.locator('#home-service-address').fill('QA test address');await finish();assert.equal((await stored())[0].status,'Pending');assert.equal((await stored())[0].specialService,'Event styling');scenarios++;
    for(const route of ['/admin','/admin/bookings','/admin/calendar','/admin/barbers','/admin/services','/admin/customers','/admin/reports','/admin/settings','/admin/notifications']){
      await goto(route);await page.screenshot({path:`test-results/${route.replaceAll('/','-')}-${width}.png`,fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Horizontal overflow at '+route+' '+width);scenarios++;
    }
    assert.deepEqual(errors,[]);console.log(`PASS ${width}px: customer, admin, group, home and all nine admin routes`);await context.close();
  }
  console.log(`PASS ${scenarios} browser scenarios`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
