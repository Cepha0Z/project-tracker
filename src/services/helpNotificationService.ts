import type { AppData, HelpRequest } from '../types';
import { firebaseAuth } from '../firebase/config';

const ENDPOINT='https://morning-night-85ab.cephajj1.workers.dev/notifications/help';

type HelpNotificationEvent='help_created'|'help_escalated';

function createdRequests(before:AppData,after:AppData){
  const existing=new Set(before.helpRequests.map(request=>request.id));
  return after.helpRequests.filter(request=>
    !existing.has(request.id)&&request.level==='lead'&&request.status==='Open',
  );
}

function escalatedRequests(before:AppData,after:AppData){
  const previous=new Map(before.helpRequests.map(request=>[request.id,request]));
  return after.helpRequests.filter(request=>{
    const old=previous.get(request.id);
    return Boolean(
      old&&old.level!=='principal'&&request.level==='principal'&&request.status==='Escalated',
    );
  });
}

async function dispatch(request:HelpRequest,event:HelpNotificationEvent){
  const authUser=firebaseAuth?.currentUser;
  if(!authUser)return;
  const idToken=await authUser.getIdToken();
  const response=await fetch(ENDPOINT,{
    method:'POST',
    headers:{Authorization:`Bearer ${idToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({requestId:request.id,event}),
  });
  if(!response.ok)throw new Error(`Notification delivery failed (${response.status}).`);
}

export const helpNotificationService={
  async dispatchChanges(before:AppData,after:AppData){
    const events:[HelpRequest,HelpNotificationEvent][]=[
      ...createdRequests(before,after).map(request=>[request,'help_created'] as [HelpRequest,HelpNotificationEvent]),
      ...escalatedRequests(before,after).map(request=>[request,'help_escalated'] as [HelpRequest,HelpNotificationEvent]),
    ];
    await Promise.allSettled(events.map(([request,event])=>dispatch(request,event)));
  },
};
