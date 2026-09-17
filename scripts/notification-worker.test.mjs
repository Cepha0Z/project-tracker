import assert from 'node:assert/strict';
import { adminUserIds, dailyReportUrl, indiaDateKey, sendDailyReportNotification, sendMissingReportReminders, sendToUsers } from '../cf-test-worker.js';

const originalFetch=globalThis.fetch;
const doc=(collection,id,fields)=>({name:`projects/test/databases/(default)/documents/${collection}/${id}`,fields:Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,typeof value==='boolean'?{booleanValue:value}:{stringValue:String(value)}]))});
const profiles=[
  doc('authProfiles','uid-manoj',{userId:'manoj',access:'admin',active:true}),
  doc('authProfiles','uid-kiran',{userId:'kiran',access:'admin',active:true}),
  doc('authProfiles','uid-sudiksha',{userId:'sudiksha',access:'employee',active:true}),
  doc('authProfiles','uid-cepha',{userId:'cepha',access:'employee',active:true}),
];
const users={
  manoj:doc('users','manoj',{authUid:'uid-manoj',access:'admin',active:true,loginEnabled:true}),
  kiran:doc('users','kiran',{authUid:'uid-kiran',access:'admin',active:true,loginEnabled:true}),
  sudiksha:doc('users','sudiksha',{authUid:'uid-sudiksha',access:'employee',active:true,loginEnabled:true}),
  cepha:doc('users','cepha',{authUid:'uid-cepha',access:'employee',active:true,loginEnabled:true}),
};
const device=doc('notificationDevices','device-1',{userId:'manoj',enabled:true,token:'fake-token'});
const employeeDevice=doc('notificationDevices','device-2',{userId:'sudiksha',enabled:true,token:'employee-token'});
let sends=0;
let invalidToken=false,disabled=0;
let reports=[],lastPush=null;
const markers=new Map();
globalThis.fetch=async(input,options={})=>{
  const url=String(input);
  if(url.endsWith(':runQuery')){
    const query=JSON.parse(options.body);
    const collection=query.structuredQuery.from[0].collectionId;
    const value=query.structuredQuery.where.fieldFilter.value.stringValue;
    if(collection==='authProfiles')return Response.json(profiles.filter(profile=>profile.fields.access.stringValue===value).map(document=>({document})));
    if(collection==='notificationDevices')return Response.json(value==='manoj'?[{document:device}]:value==='sudiksha'?[{document:employeeDevice}]:[]);
    if(collection==='dailyReports')return Response.json(reports.filter(report=>report.fields.date.stringValue===value).map(document=>({document})));
  }
  if(url.includes('/notificationDeliveries?documentId=')&&options.method==='POST'){
    const id=new URL(url).searchParams.get('documentId');
    if(markers.has(id))return new Response(null,{status:409});
    markers.set(id,JSON.parse(options.body));return Response.json({name:id});
  }
  if(url.includes('/notificationDeliveries/')&&options.method==='PATCH'){
    const id=url.split('/notificationDeliveries/')[1].split('?')[0];
    markers.set(id,{...markers.get(id),...JSON.parse(options.body)});return Response.json({name:id});
  }
  if(url.includes('/documents/users/'))return users[url.split('/').at(-1)]?Response.json(users[url.split('/').at(-1)]):new Response(null,{status:404});
  if(url.includes('/messages:send')){sends++;lastPush=JSON.parse(options.body).message;return invalidToken?Response.json({error:{details:[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED'}]}},{status:404}):Response.json({name:'mock-fcm-message'});}
  if(url.includes('/notificationDevices/device-1')&&options.method==='PATCH'){disabled++;return Response.json(device);}
  if(url.includes('/documents/dailyReports/')){const report=reports.find(entry=>entry.name.endsWith(`/${url.split('/').at(-1)}`));return report?Response.json(report):new Response(null,{status:404});}
  throw new Error(`Unexpected test request: ${url}`);
};
try{
  assert.equal(dailyReportUrl('report 1','update/1'),'https://nebulous-project--tracker.web.app/?report=report%201&update=update%2F1','daily push opens its exact Reports entry');
  assert.equal(dailyReportUrl('custom report'),'https://nebulous-project--tracker.web.app/?report=custom%20report','custom-only report push opens Reports without a fake update');
  const recipients=await adminUserIds({FIREBASE_PROJECT_ID:'test'},'fake-access-token');
  assert.deepEqual(recipients,['manoj','kiran'],'admin lookup excludes project leads');
  const delivered=await sendToUsers({FIREBASE_PROJECT_ID:'test'},'fake-access-token',recipients,{title:'Test',body:'Test',url:'https://example.com',tag:'test'});
  assert.deepEqual(delivered,{recipientCount:2,registeredRecipients:1,attempted:1,delivered:1,failed:0});
  assert.equal(sends,1,'only registered admin devices receive FCM sends');
  invalidToken=true;
  const stale=await sendToUsers({FIREBASE_PROJECT_ID:'test'},'fake-access-token',recipients,{title:'Test',body:'Test',url:'https://example.com',tag:'test'});
  assert.equal(stale.failed,1,'FCM rejection is counted');
  assert.equal(disabled,1,'stale registered tokens are disabled');
  invalidToken=false;
  const clock=Date.parse('2026-09-17T13:30:00Z');
  assert.equal(indiaDateKey(clock),'2026-09-17','13:30 UTC is the 7 PM India date');
  reports=[doc('dailyReports','submitted',{userId:'cepha',date:'2026-09-17'})];
  const before=sends;
  const reminder=await sendMissingReportReminders({FIREBASE_PROJECT_ID:'test'},'fake-access-token',clock);
  assert.deepEqual(reminder,{date:'2026-09-17',eligible:2,submitted:1,pending:1,sent:1,noDevices:0,duplicates:0,failed:0});
  assert.equal(sends,before+1,'only the employee without a report gets a push');
  assert.equal(lastPush.token,'employee-token');
  assert.equal(lastPush.notification.body,"Please submit today's report.");
  const retried=await sendMissingReportReminders({FIREBASE_PROJECT_ID:'test'},'fake-access-token',clock);
  assert.equal(retried.duplicates,1,'same-day retry sends no duplicate');
  assert.equal(sends,before+1);
  reports=[];
  const nextDay=await sendMissingReportReminders({FIREBASE_PROJECT_ID:'test'},'fake-access-token',Date.parse('2026-09-18T13:30:00Z'));
  assert.equal(nextDay.noDevices,1,'an employee without a device does not fail the job');
  assert.equal(nextDay.sent,1,'a new India day starts a new reminder eligibility period');
  assert.equal(sends,before+2,'admins never receive reminder pushes');
  reports=[{...doc('dailyReports','custom-report',{userId:'cepha',date:'2026-09-17',customWork:'Visited the site for measurements.'}),fields:{userId:{stringValue:'cepha'},date:{stringValue:'2026-09-17'},customWork:{stringValue:'Visited the site for measurements.'},updateIds:{arrayValue:{values:[]}}}}];
  const denied=await sendDailyReportNotification(new Request('https://example.com/notify'),{FIREBASE_PROJECT_ID:'test'},'fake-access-token',{userId:'sudiksha',access:'employee'},'custom-report');
  assert.equal(denied.status,403,'another employee cannot trigger a custom-report push');
  const customResponse=await sendDailyReportNotification(new Request('https://example.com/notify'),{FIREBASE_PROJECT_ID:'test'},'fake-access-token',{userId:'cepha',access:'employee'},'custom-report');
  assert.equal(customResponse.status,200,'a custom-only daily report is a valid notification event');
  assert.equal(lastPush.webpush.fcm_options.link,dailyReportUrl('custom-report'));
  assert.ok(lastPush.notification.body.includes('Visited the site for measurements.'));
  console.log('Notification Worker tests passed.');
}finally{globalThis.fetch=originalFetch;}
