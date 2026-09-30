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
  'royal-barbers.admin-services.v1':[service(1,'Haircut'),service(2,'Beard')]
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

    let apiBookings=[];
    let apiServices=JSON.parse(JSON.stringify(seed['royal-barbers.admin-services.v1']));
    let apiBarbers=JSON.parse(JSON.stringify(seed['royal-barbers.admin-barbers.v1']));
    let apiSettings={
      businessName:'Royal Barbers',businessPhone:'+92 300 1234567',whatsappNumber:'+92 300 1234567',
      email:'owner@royalbarbers.local',address:'',city:'',currency:'PKR',timezone:'Asia/Karachi',
      brandSubtitle:'LOOK GOOD · FEEL GREAT',heroEyebrow:'PREMIUM BARBERSHOP',heroHeadline:'',
      heroTagline:"More Than a Haircut. It's a Lifestyle.",bookingInterval:30,maxAdvanceDays:30,
      cancellationHours:2,lateArrivalMinutes:10,allowSameDayBooking:true,autoConfirmBookings:true,
      sendWhatsappConfirmation:true,sendSmsFallback:false,sendAppointmentReminder:true,
      reminderHoursBefore:2,notifyOwnerOnNewBooking:true,
      businessHours:['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
        .map(key=>({key,label:key[0].toUpperCase()+key.slice(1),enabled:true,open:'08:00',close:'21:00'}))
    };
    let nextBookingId=1,nextServiceId=3,nextBarberId=3;
    const apiResponse=(body,status=200)=>({
      status,
      contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'},
      body:JSON.stringify(body)
    });
    const normalizeBooking=(input,source,id)=>({
      ...input,id,code:'RB-'+String(2600+id),
      status:source==='Walk-in'?'Confirmed':(input.serviceLocation==='Home'&&input.specialService?'Pending':'Confirmed'),
      source
    });
    const requestBody=req=>{
      const raw=req.postData();
      return raw ? JSON.parse(raw) : null;
    };
    await context.route(/\/api\//,async route=>{
      const req=route.request();
      try{
        if(req.method()==='OPTIONS')return await route.fulfill(apiResponse({}));
        const pathname=new URL(req.url()).pathname;
        const body=requestBody(req);

        if(pathname==='/api/auth/login'&&req.method()==='POST'){
          if(body?.email==='owner@royalbarbers.local'&&body?.password==='RoyalBarbers@2026'){
            return await route.fulfill(apiResponse({
              success:true,
              message:'Login successful.',
              token:'qa-admin-token',
              expiresAt:'2099-12-31T23:59:59.000Z',
              user:{id:'00000000-0000-0000-0000-000000000001',fullName:'QA Administrator',email:body.email,role:'Owner'}
            }));
          }
          return await route.fulfill(apiResponse({success:false,message:'Invalid email or password.'},401));
        }
        if(pathname==='/api/auth/me'&&req.method()==='GET'){
          return await route.fulfill(apiResponse({
            id:'00000000-0000-0000-0000-000000000001',
            fullName:'QA Administrator',
            email:'qa-admin@example.test',
            role:'Owner'
          }));
        }

        if(pathname==='/api/bootstrap/legacy-catalog'&&req.method()==='POST'){
          if(Array.isArray(body?.services)&&body.services.length)apiServices=JSON.parse(JSON.stringify(body.services));
          if(Array.isArray(body?.barbers)&&body.barbers.length)apiBarbers=JSON.parse(JSON.stringify(body.barbers));
          if(body?.settings)apiSettings=JSON.parse(JSON.stringify(body.settings));
          nextServiceId=Math.max(0,...apiServices.map(x=>Number(x.id)||0))+1;
          nextBarberId=Math.max(0,...apiBarbers.map(x=>Number(x.id)||0))+1;
          return await route.fulfill(apiResponse({success:true,imported:true,message:'Legacy catalog migrated.'}));
        }

        if(pathname==='/api/services'&&req.method()==='GET')return await route.fulfill(apiResponse(apiServices));
        if(pathname==='/api/services'&&req.method()==='POST'){
          const item={...body,id:nextServiceId++};
          apiServices=[...apiServices,item];
          apiBarbers=apiBarbers.map(barber=>({
            ...barber,
            specialties:Array.from(new Set([...(barber.specialties||[]),item.name]))
          }));
          return await route.fulfill(apiResponse({success:true,message:item.name+' added successfully.',item}));
        }
        let match=pathname.match(/^\/api\/services\/(\d+)(?:\/(status))?$/);
        if(match){
          const id=Number(match[1]),action=match[2],index=apiServices.findIndex(x=>x.id===id);
          if(index<0)return await route.fulfill(apiResponse({success:false,message:'Service not found.'},404));
          if(req.method()==='DELETE'){
            const [item]=apiServices.splice(index,1);
            apiBarbers=apiBarbers.map(barber=>({...barber,specialties:barber.specialties.filter(name=>name!==item.name)}));
            return await route.fulfill(apiResponse({success:true,message:item.name+' deleted successfully.'}));
          }
          if(req.method()==='PUT'){apiServices[index]={...apiServices[index],...body,id};return await route.fulfill(apiResponse({success:true,message:'Service updated.',item:apiServices[index]}));}
          if(req.method()==='PATCH'&&action==='status'){
            apiServices[index].status=apiServices[index].status==='Active'?'Inactive':'Active';
            return await route.fulfill(apiResponse({success:true,message:'Service status updated.',item:apiServices[index]}));
          }
        }

        if(pathname==='/api/barbers'&&req.method()==='GET')return await route.fulfill(apiResponse(apiBarbers));
        if(pathname==='/api/barbers'&&req.method()==='POST'){
          const item={
            ...body,
            id:nextBarberId++,
            specialties:apiServices.map(service=>service.name),
            leaveFrom:body.leaveFrom||null,
            leaveTo:body.leaveTo||null,
            note:body.note||''
          };
          apiBarbers=[...apiBarbers,item];
          return await route.fulfill(apiResponse({success:true,message:item.name+' added successfully.',item}));
        }
        match=pathname.match(/^\/api\/barbers\/(\d+)(?:\/(availability|leave|status))?$/);
        if(match){
          const id=Number(match[1]),action=match[2],index=apiBarbers.findIndex(x=>x.id===id);
          if(index<0)return await route.fulfill(apiResponse({success:false,message:'Barber not found.'},404));
          if(req.method()==='DELETE'){
            const [item]=apiBarbers.splice(index,1);
            return await route.fulfill(apiResponse({success:true,message:item.name+' removed from the barber list.'}));
          }
          if(req.method()==='PUT'&&!action){
            apiBarbers[index]={
              ...apiBarbers[index],
              ...body,
              id,
              specialties:apiServices.map(service=>service.name)
            };
            return await route.fulfill(apiResponse({success:true,message:'Barber updated.',item:apiBarbers[index]}));
          }
          if(req.method()==='PATCH'&&action==='availability'){
            apiBarbers[index].availability=body.availability;
            if(body.availability==='Available Today'||body.availability==='Not Available Today'){
              apiBarbers[index].leaveFrom=null;apiBarbers[index].leaveTo=null;apiBarbers[index].note='';
            }
            return await route.fulfill(apiResponse({success:true,message:'Availability updated.',item:apiBarbers[index]}));
          }
          if(req.method()==='PUT'&&action==='leave'){
            Object.assign(apiBarbers[index],{availability:body.availability,leaveFrom:body.leaveFrom,leaveTo:body.leaveTo,note:body.note||''});
            return await route.fulfill(apiResponse({success:true,message:'Leave updated.',item:apiBarbers[index]}));
          }
          if(req.method()==='PATCH'&&action==='status'){
            apiBarbers[index].accountStatus=apiBarbers[index].accountStatus==='Active'?'Inactive':'Active';
            apiBarbers[index].availability=apiBarbers[index].accountStatus==='Active'?'Available Today':'Not Available Today';
            return await route.fulfill(apiResponse({success:true,message:'Barber status updated.',item:apiBarbers[index]}));
          }
        }

        if(pathname==='/api/settings'&&req.method()==='GET')return await route.fulfill(apiResponse(apiSettings));
        if(pathname==='/api/settings'&&req.method()==='PUT'){
          apiSettings=JSON.parse(JSON.stringify(body));
          return await route.fulfill(apiResponse({success:true,message:'Settings saved successfully.',item:apiSettings}));
        }
        if(pathname==='/api/settings/reset'&&req.method()==='POST'){
          return await route.fulfill(apiResponse({success:true,message:'Settings reset to defaults.',item:apiSettings}));
        }

        if(req.method()==='GET'&&pathname==='/api/bookings/busy-slots'){
          return await route.fulfill(apiResponse(
            apiBookings
              .filter(item=>item.status!=='Cancelled')
              .map(item=>({
                id:item.id,
                barber:item.barber,
                date:item.date,
                time:item.time,
                duration:item.duration,
                status:item.status
              }))
          ));
        }
        if(req.method()==='GET'&&pathname==='/api/bookings')return await route.fulfill(apiResponse(apiBookings));
        if(req.method()==='POST'&&pathname==='/api/bookings/online'){
          const items=body;
          if(!Array.isArray(items))throw new Error('Online booking payload is not an array');
          const created=items.map(item=>normalizeBooking(item,'Online',nextBookingId++));
          apiBookings=[...created.slice().reverse(),...apiBookings];
          return await route.fulfill(apiResponse({success:true,message:'Booking created successfully.',booking:created[0]}));
        }
        if(req.method()==='POST'&&pathname==='/api/bookings/walk-in'){
          const created=normalizeBooking(body,'Walk-in',nextBookingId++);
          apiBookings=[created,...apiBookings];
          return await route.fulfill(apiResponse({success:true,message:'Walk-in booked successfully.',booking:created}));
        }
        if(req.method()==='POST'&&pathname==='/api/bookings/admin'){
          const created=normalizeBooking(body,'Admin',nextBookingId++);
          apiBookings=[created,...apiBookings];
          return await route.fulfill(apiResponse({success:true,message:'Booking created successfully.',booking:created}));
        }
        match=pathname.match(/^\/api\/bookings\/(\d+)(?:\/(status|barber|schedule|special-service-price))?$/);
        if(match){
          const id=Number(match[1]),action=match[2],booking=apiBookings.find(x=>x.id===id);
          if(!booking)return await route.fulfill(apiResponse({success:false,message:'Booking not found.'},404));
          if(req.method()==='DELETE'){booking.status='Cancelled';return await route.fulfill(apiResponse({success:true,message:'Cancelled.',booking}));}
          if(action==='status')booking.status=body.status;
          if(action==='barber')booking.barber=body.barber;
          if(action==='schedule'){booking.date=body.date;booking.time=body.time;}
          if(action==='special-service-price'){const prev=booking.specialServiceAmount||0;booking.specialServiceAmount=body.amount;booking.amount=booking.amount-prev+body.amount;}
          return await route.fulfill(apiResponse({success:true,message:'Updated.',booking}));
        }

        return await route.fulfill(apiResponse({success:false,message:'Unhandled QA API route: '+req.method()+' '+pathname},404));
      }catch(error){
        return await route.fulfill(apiResponse({success:false,message:'QA API mock error: '+error.message},500));
      }
    });
    await page.clock.install({time:new Date('2026-09-28T16:30:00Z')});
    await page.addInitScript(seed=>{
      if(!localStorage.getItem('qa-auth-disabled')){
        localStorage.setItem('adminToken','qa-admin-token');
        localStorage.setItem('adminTokenExpiresAt','2099-12-31T23:59:59.000Z');
        localStorage.setItem('adminUser',JSON.stringify({
          id:'00000000-0000-0000-0000-000000000001',
          fullName:'QA Administrator',
          email:'qa-admin@example.test',
          role:'Owner'
        }));
      }
      if(localStorage.getItem('qa-seeded'))return;
      for(const [key,value] of Object.entries(seed))localStorage.setItem(key,JSON.stringify(value));
      for(const type of ['barbers','services'])localStorage.setItem('royal-barbers.admin-'+type+'.demo-cleaned.v1','1');
      localStorage.setItem('qa-seeded','1');
    },seed);
    const goto=async(route='/')=>{await page.goto('http://127.0.0.1:4173'+route);await page.locator(route==='/'?'app-booking':'app-admin-shell').waitFor();};
    const day=()=>page.locator('.calendar-days button').filter({hasText:/^28$/}).click();
    const stored=async()=>apiBookings.map(item=>({...item}));
    const details=async()=>{await page.locator('#customer-name-input').fill('QA Customer');await page.locator('#customer-phone-input').fill('3001234567');};
    const finish=async()=>{await page.locator('.confirm-btn').click();await page.locator('.success-modal').waitFor();await page.locator('.success-modal button').click();};
    await goto();await page.locator('.services-grid .service-card').filter({hasText:'Haircut'}).click();await page.locator('.barber-card').filter({hasText:'Falak Shair'}).click();await day();
    assert.ok(await page.locator('.time-slot').filter({hasText:/^5:00 PM$/}).count());
    await page.locator('.time-slot').filter({hasText:/^5:00 PM$/}).click();await details();
    await page.screenshot({path:`test-results/customer-${width}.png`,fullPage:true});await finish();
    assert.equal((await stored()).length,1);assert.equal((await stored())[0].status,'Confirmed');
    assert.equal(await page.evaluate(()=>localStorage.getItem('royal-barbers.admin-bookings.v1')),null,'Bookings must not be persisted to localStorage when API mode is active');
    assert.equal(await page.evaluate(()=>localStorage.getItem('royal-barbers.admin-services.v1')),null,'Services must be migrated out of localStorage');
    assert.equal(await page.evaluate(()=>localStorage.getItem('royal-barbers.admin-barbers.v1')),null,'Barbers must be migrated out of localStorage');scenarios++;
    // Customer's persisted booking overlaps Falak. Make Second Barber busy until 4:55 PM too,
    // so all eligible barbers are busy for more than ten minutes and the next-available fallback is exercised.
    apiBookings.push({id:900,code:'RB-WAIT',customerName:'Existing Customer',phone:'+92 300 0000000',barber:'Second Barber',service:'Haircut',duration:55,date:'2026-09-28',time:'4:00 PM',amount:600,status:'Confirmed',source:'Admin',notes:'',groupSize:1,serviceLocation:'Salon'});
    nextBookingId=Math.max(nextBookingId,901);
    await goto('/admin/bookings');await page.locator('.create-booking-btn').click();
    const form=page.locator('.create-modal'), selects=form.locator('select');
    assert.equal(await selects.count(),2,'Walk-in modal should contain only service and barber selects');
    assert.equal(await form.locator('textarea').count(),0,'Walk-in modal should not contain a notes field');
    const serviceSelect=selects.nth(0), barberSelect=selects.nth(1);
    assert.equal(await barberSelect.isDisabled(),true);
    await serviceSelect.selectOption('Haircut');assert.equal(await barberSelect.isDisabled(),false);
    const barbers=await barberSelect.locator('option').allTextContents();
    assert.ok(barbers.some(x=>x.includes('Second Barber')&&x.includes('Available in 25 min')),'Second Barber should remain bookable even when the wait is longer than ten minutes');
    await barberSelect.selectOption('Second Barber');
    await form.locator('.walkin-waiting-hint').filter({hasText:'waiting area'}).waitFor();
    await form.getByPlaceholder('Enter full name').fill('Walk-in QA');
    await page.screenshot({path:`test-results/walk-in-${width}.png`,fullPage:true});
    await form.locator('.submit-booking-btn').click();await form.waitFor({state:'hidden'});
    assert.equal((await stored()).length,3);assert.equal((await stored())[0].source,'Walk-in');assert.equal((await stored())[0].phone,'');assert.equal((await stored())[0].barber,'Second Barber');assert.equal((await stored())[0].time,'4:55 PM');assert.equal((await stored())[0].notes,'');scenarios++;
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
    assert.equal(await add.locator('.specialty-picker').count(),0,'Add Barber must not ask the admin to select specialties');
    await add.getByPlaceholder('Enter full name').fill('Modal QA Barber');
    await add.getByPlaceholder('3001234567').fill('3001234568');
    await add.locator('input[type=file]').setInputFiles({name:'qa-fixture.png',mimeType:'image/png',buffer:await photo('#2255aa')});
    await add.locator('.manual-face-confirm').waitFor();
    await add.locator('.submit-btn').click();assert.equal(await add.isVisible(),true,'Manual confirmation must still be required');
    await add.locator('.manual-face-confirm input').check();
    await page.screenshot({path:`test-results/add-barber-${width}.png`,fullPage:true});
    await add.locator('.submit-btn').click();await add.waitFor({state:'hidden'});
    assert.equal(apiBarbers.length,3);
    assert.deepEqual(
      apiBarbers.find(x=>x.name==='Modal QA Barber')?.specialties,
      apiServices.map(service=>service.name),
      'New barber should automatically receive every admin service'
    );scenarios++;

    const barberContainerSelector=width>=768?'.barbers-table tbody tr':'.mobile-barber-card';
    const modalBarber=()=>page.locator(barberContainerSelector).filter({hasText:'Modal QA Barber'});
    await modalBarber().locator('.edit-action').click();
    const edit=page.locator('.edit-modal');
    assert.equal(await edit.locator('input[type=file]').count(),1,'Edit Barber must contain Change Photo');
    assert.equal(await edit.locator('.specialty-picker').count(),0,'Edit Barber must not manually manage specialties');
    await edit.locator('input[type=file]').setInputFiles({name:'qa-replacement.png',mimeType:'image/png',buffer:await photo('#aa5522')});
    await edit.locator('.manual-face-confirm input').check();
    await page.screenshot({path:`test-results/edit-barber-${width}.png`,fullPage:true});
    await edit.locator('.submit-btn').click();await edit.waitFor({state:'hidden'});
    assert.ok(apiBarbers.find(x=>x.name==='Modal QA Barber')?.image.startsWith('data:image/'));scenarios++;

    await modalBarber().getByRole('button',{name:'Deactivate'}).click();
    await modalBarber().locator('.account-status').filter({hasText:'Inactive'}).waitFor();
    assert.equal(apiBarbers.find(x=>x.name==='Modal QA Barber')?.accountStatus,'Inactive');
    await modalBarber().getByRole('button',{name:'Activate'}).click();
    await modalBarber().locator('.account-status').filter({hasText:'Active'}).waitFor();
    assert.equal(apiBarbers.find(x=>x.name==='Modal QA Barber')?.accountStatus,'Active');scenarios++;

    await modalBarber().locator('.delete-action').click();
    const deleteDialog=page.locator('.delete-dialog');
    await deleteDialog.waitFor();
    await deleteDialog.getByRole('button',{name:'Delete Barber'}).click();
    await deleteDialog.waitFor({state:'hidden'});
    assert.equal(apiBarbers.some(x=>x.name==='Modal QA Barber'),false);scenarios++;

    // Isolated fixture: public tab starts with a short shift and no bookings.
    apiBarbers[0].workingHours='9 AM - 5 PM';
    apiBookings=[];
    await goto();await page.locator('.services-grid .service-card').filter({hasText:'Haircut'}).click();
    await page.locator('.barber-card').filter({hasText:'Falak Shair'}).click();await day();
    await page.locator('.no-times').filter({hasText:'40-minute slot fits before 5:00 PM'}).waitFor();
    await page.locator('#customer-name-input').fill('Keep my details');
    const adminTab=await context.newPage();await adminTab.goto('http://127.0.0.1:4173/admin/barbers');
    apiBarbers[0].workingHours='9 AM - 9 PM';
    await page.bringToFront();
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.locator('.time-slot').filter({hasText:/^5:00 PM$/}).waitFor();
    assert.equal(await page.locator('#customer-name-input').inputValue(),'Keep my details');

    // A booking created elsewhere must disappear from this already-open customer's slot grid
    // after the async busy-slot refresh completes.
    apiBookings.push({id:901,code:'RB-ASYNC',customerName:'Other Client',phone:'+92 300 1111111',barber:'Falak Shair',service:'Haircut',duration:40,date:'2026-09-28',time:'5:00 PM',amount:600,status:'Confirmed',source:'Admin',notes:'',groupSize:1,serviceLocation:'Salon'});
    nextBookingId=Math.max(nextBookingId,902);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.locator('.time-slot').filter({hasText:/^5:00 PM$/}).waitFor({state:'detached'});

    await page.screenshot({path:`test-results/refreshed-slots-${width}.png`,fullPage:true});
    await adminTab.close();scenarios++;
    assert.deepEqual(errors,[]);console.log(`PASS ${width}px: customer, admin, group, home and all nine admin routes`);await context.close();
  }
  console.log(`PASS ${scenarios} browser scenarios`);
})().catch(async error=>{console.error(error);if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:'test-results/failure.png',fullPage:true});fs.writeFileSync('test-results/failure.html',await activePage.content());console.error((await activePage.locator('body').innerText()).slice(-4000));}process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
