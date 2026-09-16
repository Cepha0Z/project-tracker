import assert from 'node:assert/strict';
import { adminUserIds, sendToUsers } from '../cf-test-worker.js';

const originalFetch=globalThis.fetch;
const doc=(collection,id,fields)=>({name:`projects/test/databases/(default)/documents/${collection}/${id}`,fields:Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,typeof value==='boolean'?{booleanValue:value}:{stringValue:String(value)}]))});
const profiles=[
  doc('authProfiles','uid-manoj',{userId:'manoj',access:'admin',active:true}),
  doc('authProfiles','uid-kiran',{userId:'kiran',access:'admin',active:true}),
  doc('authProfiles','uid-sudiksha',{userId:'sudiksha',access:'employee',active:true}),
];
const users={
  manoj:doc('users','manoj',{authUid:'uid-manoj',access:'admin',active:true,loginEnabled:true}),
  kiran:doc('users','kiran',{authUid:'uid-kiran',access:'admin',active:true,loginEnabled:true}),
  sudiksha:doc('users','sudiksha',{authUid:'uid-sudiksha',access:'employee',active:true,loginEnabled:true}),
};
const device=doc('notificationDevices','device-1',{userId:'manoj',enabled:true,token:'fake-token'});
let sends=0;
let invalidToken=false,disabled=0;
globalThis.fetch=async(input,options={})=>{
  const url=String(input);
  if(url.endsWith(':runQuery')){
    const query=JSON.parse(options.body);
    const collection=query.structuredQuery.from[0].collectionId;
    const value=query.structuredQuery.where.fieldFilter.value.stringValue;
    if(collection==='authProfiles')return Response.json(profiles.filter(profile=>profile.fields.access.stringValue===value).map(document=>({document})));
    if(collection==='notificationDevices')return Response.json(value==='manoj'?[{document:device}]:[]);
  }
  if(url.includes('/documents/users/'))return users[url.split('/').at(-1)]?Response.json(users[url.split('/').at(-1)]):new Response(null,{status:404});
  if(url.includes('/messages:send')){sends++;return invalidToken?Response.json({error:{details:[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED'}]}},{status:404}):Response.json({name:'mock-fcm-message'});}
  if(url.includes('/notificationDevices/device-1')&&options.method==='PATCH'){disabled++;return Response.json(device);}
  throw new Error(`Unexpected test request: ${url}`);
};
try{
  const recipients=await adminUserIds({FIREBASE_PROJECT_ID:'test'},'fake-access-token');
  assert.deepEqual(recipients,['manoj','kiran'],'admin lookup excludes project leads');
  const delivered=await sendToUsers({FIREBASE_PROJECT_ID:'test'},'fake-access-token',recipients,{title:'Test',body:'Test',url:'https://example.com',tag:'test'});
  assert.deepEqual(delivered,{recipientCount:2,registeredRecipients:1,attempted:1,delivered:1,failed:0});
  assert.equal(sends,1,'only registered admin devices receive FCM sends');
  invalidToken=true;
  const stale=await sendToUsers({FIREBASE_PROJECT_ID:'test'},'fake-access-token',recipients,{title:'Test',body:'Test',url:'https://example.com',tag:'test'});
  assert.equal(stale.failed,1,'FCM rejection is counted');
  assert.equal(disabled,1,'stale registered tokens are disabled');
  console.log('Notification Worker tests passed.');
}finally{globalThis.fetch=originalFetch;}
