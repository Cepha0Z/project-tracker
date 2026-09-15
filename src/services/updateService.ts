import type { AppData, DailyUpdate, WorkStatus } from '../types';
import { makeId, now, withActivity } from './shared';
import { permissions } from '../permissions/permissions';
import { workItemService } from './workItemService';

export const updateService = {
  createReport(data:AppData, actorId:string, input:{summary:string;entries:{workItemId:string;progress:number;minutes?:number;status:WorkStatus;note?:string;blocker?:string}[]}):AppData {
    const actor=data.users.find(u=>u.id===actorId); if(!actor||!input.entries.length)return data;
    const reportId=makeId('report'),createdAt=now(); let next=data; const updateIds:string[]=[]; const projectIds=new Set<string>();
    for(const entry of input.entries){
      const item=next.workItems.find(w=>w.id===entry.workItemId); if(!item||!permissions.canUpdateOwnWork(actor,item))continue;
      const project=next.projects.find(p=>p.id===item.projectId),cycle=next.cycles.find(c=>c.id===project?.activeCycleId&&c.deliverableIds?.includes(item.id)); const updateId=makeId('update'); updateIds.push(updateId);projectIds.add(item.projectId);
      const previousProgress=item.progress,progress=entry.status==='Completed'?100:entry.progress,progressDelta=progress-previousProgress;
      const update:DailyUpdate={id:updateId,reportId,projectId:item.projectId,workItemId:item.id,userId:actorId,text:entry.note||input.summary,progress,previousProgress,progressDelta,minutes:0,status:entry.status,blocker:entry.blocker,createdAt,cycleId:cycle?.id};
      next=workItemService.update(next,actorId,item.id,{progress,status:entry.status,blockedReason:entry.blocker});
      next={...next,updates:[update,...next.updates]};
    }
    if(!updateIds.length)return data;
    next={...next,dailyReports:[{id:reportId,userId:actorId,date:createdAt.slice(0,10),summary:input.summary,createdAt,updateIds,items:input.entries.map(entry=>{const item=data.workItems.find(w=>w.id===entry.workItemId)!;const newProgress=entry.status==='Completed'?100:entry.progress;return {workItemId:entry.workItemId,previousProgress:item.progress,newProgress,progressDelta:newProgress-item.progress,status:entry.status}})},...(next.dailyReports||[])]};
    for(const projectId of projectIds)next=withActivity(next,projectId,actorId,`submitted today's report covering ${input.entries.filter(e=>next.workItems.find(w=>w.id===e.workItemId)?.projectId===projectId).length} deliverable(s)`,createdAt);
    return next;
  },
  create(data:AppData, actorId:string, input:{workItemId:string;text:string;progress:number;minutes:number;status:WorkStatus;blocker?:string}):AppData {
    const item=data.workItems.find(w=>w.id===input.workItemId)!,actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canUpdateOwnWork(actor,item)) return data; const createdAt=now(); const updateId=makeId('update'); const project=data.projects.find(p=>p.id===item.projectId),cycle=data.cycles.find(c=>c.id===project?.activeCycleId&&c.deliverableIds?.includes(item.id));
    const update:DailyUpdate={id:updateId,projectId:item.projectId,workItemId:item.id,userId:actorId,text:input.text,progress:input.status==='Completed'?100:input.progress,minutes:input.minutes,status:input.status,blocker:input.blocker,createdAt,cycleId:cycle?.id};
    const time={id:makeId('time'),projectId:item.projectId,workItemId:item.id,userId:actorId,cycleId:cycle?.id,date:createdAt,minutes:input.minutes,updateId};
    const next={...data,workItems:data.workItems.map(w=>w.id===item.id?{...w,progress:update.progress,status:input.status,blockedReason:input.status==='Blocked'?input.blocker:undefined}:w),updates:[update,...data.updates],timeEntries:[time,...data.timeEntries]};
    return withActivity(next,item.projectId,actorId,`updated ${item.name} to ${update.progress}%`);
  },
  edit(data:AppData, actorId:string, updateId:string, text:string):AppData { const update=data.updates.find(u=>u.id===updateId)!; if(update.userId!==actorId)return data; return withActivity({...data,updates:data.updates.map(u=>u.id===updateId?{...u,text}:u)},update.projectId,actorId,`edited a daily update`); },
};
