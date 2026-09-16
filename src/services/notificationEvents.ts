import type { AppData } from '../types';

export type NotificationEvent='help_escalated'|'help_resolved'|'daily_report_submitted';
export type NotificationChange={id:string;event:NotificationEvent};

export function notificationChanges(before:AppData,after:AppData):NotificationChange[]{
  const previousRequests=new Map(before.helpRequests.map(request=>[request.id,request]));
  const previousReports=new Set((before.dailyReports||[]).map(report=>report.id));
  return [
    ...after.helpRequests.filter(request=>previousRequests.has(request.id)&&previousRequests.get(request.id)?.status!=='Escalated'&&request.status==='Escalated').map(request=>({id:request.id,event:'help_escalated' as const})),
    // The Worker sends resolution messages only when an admin supplied the response.
    // Self/lead closures remain historical Firestore events, without a rejected push call.
    ...after.helpRequests.filter(request=>previousRequests.has(request.id)&&previousRequests.get(request.id)?.status!=='Resolved'&&request.status==='Resolved'&&after.users.some(user=>user.id===request.resolvedBy&&user.access==='admin')).map(request=>({id:request.id,event:'help_resolved' as const})),
    ...(after.dailyReports||[]).filter(report=>!previousReports.has(report.id)).map(report=>({id:report.id,event:'daily_report_submitted' as const})),
  ];
}
