import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { isDirectPrincipalEscalation, isPrincipalEscalation, leadRecipients, principalRecipients } from './notificationRouting.js';

initializeApp();
setGlobalOptions({region:'asia-south1',maxInstances:10});

const db=getFirestore();
const APP_URL='https://nebulous-project--tracker.web.app';
const invalidTokenCodes=new Set(['messaging/invalid-registration-token','messaging/registration-token-not-registered']);

type HelpRequest={projectId:string;workItemId:string;raisedBy:string;level:'lead'|'principal';status:string;escalatedBy?:string};
type Project={name:string;leadId:string;principalId?:string;principalIds?:string[]};
type WorkItem={name:string};
type Person={name:string};

async function sendToUsers(userIds:string[],content:{title:string;body:string;url:string;tag:string}){
  const recipients=[...new Set(userIds.filter(Boolean))];
  if(!recipients.length)return;
  const snapshots=await Promise.all(recipients.map(userId=>db.collection('notificationDevices').where('userId','==',userId).get()));
  const devices=snapshots.flatMap(snapshot=>snapshot.docs).filter(device=>device.data().enabled===true&&typeof device.data().token==='string');
  const unique=[...new Map(devices.map(device=>[String(device.data().token),device])).entries()];
  for(let offset=0;offset<unique.length;offset+=500){
    const chunk=unique.slice(offset,offset+500),tokens=chunk.map(([token])=>token);
    const message:MulticastMessage={tokens,data:{title:content.title,body:content.body,url:content.url,tag:content.tag,icon:'/project-tracker-icon-192.png',badge:'/project-tracker-icon-192.png'},webpush:{headers:{Urgency:'high'}}};
    const result=await getMessaging().sendEachForMulticast(message);
    const updates=db.batch();let dirty=false;
    result.responses.forEach((response,index)=>{if(!response.success&&invalidTokenCodes.has(response.error?.code||'')){updates.update(chunk[index][1].ref,{enabled:false,disabledAt:FieldValue.serverTimestamp()});dirty=true}});
    if(dirty)await updates.commit();
  }
}

async function context(request:HelpRequest){
  const [projectSnapshot,itemSnapshot,requesterSnapshot]=await Promise.all([
    db.doc(`projects/${request.projectId}`).get(),
    db.doc(`workItems/${request.workItemId}`).get(),
    db.doc(`users/${request.raisedBy}`).get(),
  ]);
  if(!projectSnapshot.exists||!itemSnapshot.exists)return null;
  return {project:projectSnapshot.data() as Project,item:itemSnapshot.data() as WorkItem,requester:requesterSnapshot.data() as Person|undefined};
}

async function sendPrincipalEscalation(request:HelpRequest,requestId:string){
  const details=await context(request);if(!details)return;
  const escalator=request.escalatedBy?await db.doc(`users/${request.escalatedBy}`).get():undefined;
  const lead=(escalator?.data() as Person|undefined)?.name||'The Project Lead';
  await sendToUsers(principalRecipients(details.project),{
    title:`Escalated · ${details.project.name}`,
    body:`${lead} escalated ${details.requester?.name||'a team member'}'s ${details.item.name} issue.`,
    url:`${APP_URL}/?project=${encodeURIComponent(request.projectId)}&workItem=${encodeURIComponent(request.workItemId)}`,
    tag:`escalation-${requestId}`,
  });
}

export const notifyOnHelpCreated=onDocumentCreated('helpRequests/{requestId}',async event=>{
  const request=event.data?.data() as HelpRequest|undefined;
  if(!request)return;
  if(isDirectPrincipalEscalation(request)){await sendPrincipalEscalation(request,event.params.requestId);return}
  const details=await context(request);if(!details)return;
  const recipients=leadRecipients(request,details.project);if(!recipients.length)return;
  await sendToUsers(recipients,{
    title:`Help needed · ${details.project.name}`,
    body:`${details.requester?.name||'A team member'} needs help with ${details.item.name}.`,
    url:`${APP_URL}/?project=${encodeURIComponent(request.projectId)}&workItem=${encodeURIComponent(request.workItemId)}`,
    tag:`help-${event.params.requestId}`,
  });
});

export const notifyPrincipalsOfEscalation=onDocumentUpdated('helpRequests/{requestId}',async event=>{
  const before=event.data?.before.data() as HelpRequest|undefined,after=event.data?.after.data() as HelpRequest|undefined;
  if(!before||!after||!isPrincipalEscalation(before,after))return;
  await sendPrincipalEscalation(after,event.params.requestId);
});
