import type { AppData, DailyUpdate, WorkStatus } from '../types';
import { makeId, now, withActivity } from './shared';
import { permissions } from '../permissions/permissions';
import { workItemService } from './workItemService';
import { localDateKey } from '../domain/selectors';

export const updateService = {
  addNote(data:AppData, actorId:string, workItemId:string, text:string):AppData {
    const item=data.workItems.find(work=>work.id===workItemId),project=data.projects.find(candidate=>candidate.id===item?.projectId),actor=data.users.find(person=>person.id===actorId),note=text.trim();
    if(!item||!project||!actor||item.archived||!note||!(permissions.canManageWorkItem(actor,project)||permissions.canUpdateOwnWork(actor,item)))return data;
    const createdAt=now();
    const update:DailyUpdate={id:makeId('update'),projectId:item.projectId,workItemId:item.id,userId:actorId,text:note,progress:item.progress,previousProgress:item.progress,progressDelta:0,minutes:0,status:item.status,createdAt,cycleId:item.cycleId,kind:'note'};
    return withActivity({...data,updates:[update,...data.updates]},item.projectId,actorId,`added an update to ${item.name}`,createdAt);
  },
  reopenForChanges(data:AppData, actorId:string, workItemId:string, input:{changes:string;dueDate:string}):AppData {
    const item=data.workItems.find(work=>work.id===workItemId),project=data.projects.find(candidate=>candidate.id===item?.projectId),actor=data.users.find(person=>person.id===actorId),changes=input.changes.trim();
    if(!item||!project||!actor||item.archived||item.status!=='Completed'||!changes||!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)||!(permissions.canManageWorkItem(actor,project)||permissions.canUpdateOwnWork(actor,item)))return data;
    const createdAt=now();
    const reopened=workItemService.update(data,actorId,item.id,{status:'In Progress',progress:0,dueDate:input.dueDate});
    if(reopened===data)return data;
    const update:DailyUpdate={id:makeId('update'),projectId:item.projectId,workItemId:item.id,userId:actorId,text:changes,progress:0,previousProgress:item.progress,progressDelta:-item.progress,minutes:0,status:'In Progress',createdAt,cycleId:item.cycleId,kind:'reopen',newDueDate:input.dueDate};
    return withActivity({...reopened,updates:[update,...reopened.updates]},item.projectId,actorId,`reopened ${item.name} for changes`,createdAt);
  },
  createReport(data:AppData, actorId:string, input:{summary:string;customWork?:string;entries:{workItemId:string;progress:number;minutes?:number;status:WorkStatus;note?:string;blocker?:string}[]}):AppData {
    const actor=data.users.find(u=>u.id===actorId),customWork=input.customWork?.trim()||''; if(!actor||(!input.entries.length&&!customWork))return data;
    const reportId=makeId('report'),createdAt=now(); let next=data; const updateIds:string[]=[]; const projectIds=new Set<string>();const reportItems:NonNullable<NonNullable<AppData['dailyReports']>[number]['items']>=[];
    for(const entry of input.entries){
      const item=next.workItems.find(w=>w.id===entry.workItemId); if(!item||item.status==='Blocked'||!permissions.canUpdateOwnWork(actor,item))continue;
      const project=next.projects.find(p=>p.id===item.projectId),cycle=next.cycles.find(c=>c.id===project?.activeCycleId&&c.deliverableIds?.includes(item.id)); const updateId=makeId('update'); updateIds.push(updateId);projectIds.add(item.projectId);
      const previousProgress=item.progress,progress=entry.status==='Completed'?100:entry.progress,progressDelta=progress-previousProgress;
      reportItems.push({workItemId:item.id,previousProgress,newProgress:progress,progressDelta,status:entry.status});
      const update:DailyUpdate={id:updateId,reportId,projectId:item.projectId,workItemId:item.id,userId:actorId,text:entry.note?.trim()||'',progress,previousProgress,progressDelta,minutes:0,status:entry.status,blocker:entry.blocker,createdAt,cycleId:item.cycleId||cycle?.id};
      next=workItemService.update(next,actorId,item.id,{progress,status:entry.status,blockedReason:entry.blocker});
      next={...next,updates:[update,...next.updates]};
    }
    if(!updateIds.length&&!customWork)return data;
    next={...next,dailyReports:[{id:reportId,userId:actorId,date:localDateKey(new Date(createdAt)),summary:input.summary,customWork,createdAt,updateIds,items:reportItems},...(next.dailyReports||[])]};
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
