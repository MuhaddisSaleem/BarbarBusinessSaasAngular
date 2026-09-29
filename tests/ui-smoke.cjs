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
const barber=(id,name,specialties,rating)=>({id,name,specialties,rating,phone:'+92 '+(id===1?'300':'301')+' 1234567',accountStatus:'Active',availability:'Available Today',workingHours:'9 AM - 9 PM',experience:'5 years',image:'assets/images/barber-placeholder.svg'});
const service=(id,name)=>({id,name,duration:40,originalPrice:600,discountPrice:null,homeServiceEnabled:true,homeOriginalPrice:900,homeDiscountPrice:null,status:'Active',image:'assets/images/service-placeholder.svg'});
const seed={
  'royal-barbers.admin-barbers.v1':[barber(1,'Falak Shair',['Haircut','Beard'],5),barber(2,'Second Barber',['Haircut'],4)],
  'royal-barbers.admin-services.v1':[service(1,'Haircut'),service(2,'Beard')],
  'royal-barbers.admin-bookings.v1':[]
};
let browser, activePage;
(async()=>{
  await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});fs.mkdirSync('test-results',{recursive:true});
  let scenarios=0;
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'UTC'});
    const page=await context.newPage();activePage=page;page.setDefaultTimeout(15000);
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
    // Customer's persisted booking overlaps Falak. Make Second Barber busy until 4:40 PM too,
    // so all eligible barbers are busy and the ten-minute waiting fallback is exercised.
    await page.evaluate(()=>{
      const bookings=JSON.parse(localStorage.getItem('royal-barbers.admin-bookings.v1'));
      bookings.push({id:900,code:'RB-WAIT',customerName:'Existing Customer',phone:'+92 300 0000000',barber:'Second Barber',service:'Haircut',duration:40,date:'2026-09-28',time:'4:00 PM',amount:600,status:'Confirmed',source:'Admin',notes:'',groupSize:1,serviceLocation:'Salon'});
      localStorage.setItem('royal-barbers.admin-bookings.v1',JSON.stringify(bookings));
    });
    await goto('/admin/bookings');await page.locator('.create-booking-btn').click();
    const form=page.locator('.create-modal'), selects=form.locator('select');
    assert.equal(await selects.count(),2,'Walk-in modal should contain only service and barber selects');
    assert.equal(await form.locator('textarea').count(),0,'Walk-in modal should not contain a notes field');
    const serviceSelect=selects.nth(0), barberSelect=selects.nth(1);
    assert.equal(await barberSelect.isDisabled(),true);
    await serviceSelect.selectOption('Haircut');assert.equal(await barberSelect.isDisabled(),false);
    const barbers=await barberSelect.locator('option').allTextContents();
    assert.equal(barbers.some(x=>x.includes('Falak Shair')),false,'Falak is not free within the ten-minute window');
    assert.ok(barbers.some(x=>x.includes('Second Barber')&&x.includes('Available in 10 min')),'Second Barber should be suggested after a ten-minute wait');
    await barberSelect.selectOption('Second Barber');
    await form.locator('.walkin-waiting-hint').filter({hasText:'waiting area'}).waitFor();
    await form.getByPlaceholder('Enter full name').fill('Walk-in QA');
    await page.screenshot({path:`test-results/walk-in-${width}.png`,fullPage:true});
    await form.locator('.submit-booking-btn').click();await form.waitFor({state:'hidden'});
    assert.equal((await stored()).length,3);assert.equal((await stored())[0].source,'Walk-in');assert.equal((await stored())[0].phone,'');assert.equal((await stored())[0].barber,'Second Barber');assert.equal((await stored())[0].time,'4:40 PM');assert.equal((await stored())[0].notes,'');scenarios++;
    // Specialist matching must select two different barbers for parallel Any Barber bookings.
    await goto();await page.locator('.booking-for-toggle button').nth(1).click();await page.locator('.services-grid .service-card').filter({hasText:'Haircut'}).click();await page.locator('.any-barber').click();await page.locator('.participant-tab').nth(1).click();await page.locator('.services-grid .service-card').filter({hasText:'Beard'}).click();await page.locator('.any-barber').click();await day();await page.locator('.time-slot').filter({hasText:/^7:00 PM$/}).click();await details();await finish();
    const group=(await stored()).slice(0,2);assert.equal(new Set(group.map(x=>x.barber)).size,2);assert.ok(group.every(x=>x.time==='7:00 PM'));scenarios++;
    await page.locator('.home-service-selector').click();await page.getByPlaceholder('Example: Groom styling for an event, special beard treatment, etc.').fill('Event styling');await day();await page.locator('.time-slot').filter({hasText:/^8:00 PM$/}).click();await details();await page.locator('#home-service-address').fill('QA test address');await finish();assert.equal((await stored())[0].status,'Pending');assert.equal((await stored())[0].specialService,'Event styling');scenarios++;
    for(const route of ['/admin','/admin/bookings','/admin/calendar','/admin/barbers','/admin/services','/admin/customers','/admin/reports','/admin/settings','/admin/notifications']){
      await goto(route);await page.screenshot({path:`test-results/${route.replaceAll('/','-')}-${width}.png`,fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Horizontal overflow at '+route+' '+width);scenarios++;
    }
    // Exercise the actual Add/Edit modals, including the unsupported face-detector fallback.
    await goto('/admin/barbers');
    await page.evaluate(() => Object.defineProperty(window, 'FaceDetector', {value:undefined, configurable:true}));
    const photo = async color => Buffer.from(await page.evaluate(color => {
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
      const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,64,64);
      return canvas.toDataURL('image/png').split(',')[1];
    },color),'base64');
    await page.locator('.add-barber-btn').click();
    const add=page.locator('.add-modal');
    assert.equal(await add.locator('input[type=file]').count(),1,'Add Barber must contain only its own photo field');
    await add.getByPlaceholder('Enter full name').fill('Modal QA Barber');
    await add.getByPlaceholder('3001234567').fill('3001234568');
    await add.locator('.specialty-option').filter({hasText:'Haircut'}).click();
    await add.locator('input[type=file]').setInputFiles({name:'qa-fixture.png',mimeType:'image/png',buffer:await photo('#2255aa')});
    await add.locator('.manual-face-confirm').waitFor();
    await add.locator('.submit-btn').click();assert.equal(await add.isVisible(),true,'Manual confirmation must still be required');
    await add.locator('.manual-face-confirm input').check();
    await page.screenshot({path:`test-results/add-barber-${width}.png`,fullPage:true});
    await add.locator('.submit-btn').click();await add.waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('royal-barbers.admin-barbers.v1')).length),3);scenarios++;
    await page.locator('.edit-action:visible').first().click();
    const edit=page.locator('.edit-modal');
    assert.equal(await edit.locator('input[type=file]').count(),1,'Edit Barber must contain Change Photo');
    await edit.locator('input[type=file]').setInputFiles({name:'qa-replacement.png',mimeType:'image/png',buffer:await photo('#aa5522')});
    await edit.locator('.manual-face-confirm input').check();
    await page.screenshot({path:`test-results/edit-barber-${width}.png`,fullPage:true});
    await edit.locator('.submit-btn').click();await edit.waitFor({state:'hidden'});
    assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('royal-barbers.admin-barbers.v1'))[0].image.startsWith('data:image/')));scenarios++;
    // Isolated fixture: public tab starts with a short shift and no bookings.
    await page.evaluate(()=>{
      const barbers=JSON.parse(localStorage.getItem('royal-barbers.admin-barbers.v1'));
      barbers[0].workingHours='9 AM - 5 PM';localStorage.setItem('royal-barbers.admin-barbers.v1',JSON.stringify(barbers));
      localStorage.setItem('royal-barbers.admin-bookings.v1','[]');
    });
    await goto();await page.locator('.services-grid .service-card').filter({hasText:'Haircut'}).click();
    await page.locator('.barber-card').filter({hasText:'Falak Shair'}).click();await day();
    await page.locator('.no-times').filter({hasText:'40-minute slot fits before 5:00 PM'}).waitFor();
    await page.locator('#customer-name-input').fill('Keep my details');
    const adminTab=await context.newPage();await adminTab.goto('http://127.0.0.1:4173/admin/barbers');
    await adminTab.evaluate(()=>{
      const barbers=JSON.parse(localStorage.getItem('royal-barbers.admin-barbers.v1'));
      barbers[0].workingHours='9 AM - 9 PM';localStorage.setItem('royal-barbers.admin-barbers.v1',JSON.stringify(barbers));
    });
    await page.locator('.time-slot').filter({hasText:/^5:00 PM$/}).waitFor();
    assert.equal(await page.locator('#customer-name-input').inputValue(),'Keep my details');
    await page.screenshot({path:`test-results/refreshed-slots-${width}.png`,fullPage:true});
    await adminTab.close();scenarios++;
    assert.deepEqual(errors,[]);console.log(`PASS ${width}px: customer, admin, group, home and all nine admin routes`);await context.close();
  }
  console.log(`PASS ${scenarios} browser scenarios`);
})().catch(async error=>{console.error(error);if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:'test-results/failure.png',fullPage:true});fs.writeFileSync('test-results/failure.html',await activePage.content());console.error((await activePage.locator('body').innerText()).slice(-4000));}process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
