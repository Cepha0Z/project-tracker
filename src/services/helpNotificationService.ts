import type { AppData, DailyReport, HelpRequest } from '../types';
import { firebaseAuth } from '../firebase/config';

const ENDPOINT='https://morning-night-85ab.cephajj1.workers.dev/notifications/help';

type HelpNotificationEvent='help_escalated'|'help_resolved'|'daily_report_submitted';

function escalatedRequests(before:AppData,after:AppData){
  const previous=new Map(before.helpRequests.map(request=>[request.id,request]));
  return after.helpRequests.filter(request=>{
    const old=previous.get(request.id);
    return Boolean(
      old&&old.status!=='Escalated'&&request.status==='Escalated',
    );
  });
}

function resolvedRequests(before:AppData,after:AppData){
  const previous=new Map(before.helpRequests.map(request=>[request.id,request]));
  return after.helpRequests.filter(request=>previous.has(request.id)&&previous.get(request.id)?.status!=='Resolved'&&request.status==='Resolved');
}

async function dispatch(id:string,event:HelpNotificationEvent){
  const authUser=firebaseAuth?.currentUser;
  if(!authUser)return;
  const idToken=await authUser.getIdToken();
  const response=await fetch(ENDPOINT,{
    method:'POST',
    headers:{Authorization:`Bearer ${idToken}`,'Content-Type':'application/json'},
    body:JSON.stringify(event==='daily_report_submitted'?{reportId:id,event}:{requestId:id,event}),
  });
  if(!response.ok)throw new Error(`Notification delivery failed (${response.status}).`);
}

export const helpNotificationService={
  async dispatchChanges(before:AppData,after:AppData){
    const events:[HelpRequest,HelpNotificationEvent][]=[
      ...escalatedRequests(before,after).map(request=>[request,'help_escalated'] as [HelpRequest,HelpNotificationEvent]),
      ...resolvedRequests(before,after).map(request=>[request,'help_resolved'] as [HelpRequest,HelpNotificationEvent]),
    ];
    const previousReports=new Set((before.dailyReports||[]).map(report=>report.id));
    const reports:DailyReport[]=(after.dailyReports||[]).filter(report=>!previousReports.has(report.id));
    await Promise.allSettled([
      ...events.map(([request,event])=>dispatch(request.id,event)),
      ...reports.map(report=>dispatch(report.id,'daily_report_submitted')),
    ]);
  },
};
