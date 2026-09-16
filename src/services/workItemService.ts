import type { AppData, WorkItem, WorkStatus } from '../types';
import { makeId, withActivity } from './shared';
import { permissions } from '../permissions/permissions';
import { workItemAssigneeIds } from '../domain/selectors';

type WorkInput=Pick<WorkItem,'projectId'|'name'|'assigneeId'|'stage'|'dueDate'|'notes'> & {cycleId?:string;assigneeIds?:string[];scopeNotes?:string;subItems?:WorkItem['subItems'];required?:boolean};
const dueLabel=(date:string)=>new Date(`${date}T00:00:00`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
const transition=(item:WorkItem,status:WorkStatus,progress:number,stamp:string):Partial<WorkItem>=>{
  let activeElapsedMinutes=item.activeElapsedMinutes||0,startedAt=item.startedAt,completedAt=item.completedAt;
  if(item.status==='In Progress'&&status!=='In Progress'&&item.startedAt){activeElapsedMinutes+=Math.max(0,Math.round((Date.parse(stamp)-Date.parse(item.startedAt))/60000));startedAt=undefined;}
  if(item.status!=='In Progress'&&status==='In Progress')startedAt=stamp;
  if(status==='In Progress'&&!startedAt)startedAt=stamp;
  if(status==='Completed'){completedAt=stamp;startedAt=undefined;progress=100}else if(item.status==='Completed')completedAt=undefined;
  return {status,progress,startedAt,completedAt,activeElapsedMinutes,blockedReason:status==='Blocked'?item.blockedReason:undefined,updatedAt:stamp};
};
export const workItemService = {
  create(data:AppData, actorId:string, input:WorkInput):AppData { const project=data.projects.find(p=>p.id===input.projectId)!,actor=data.users.find(u=>u.id===actorId),assignees=input.assigneeIds?.length?input.assigneeIds:[input.assigneeId]; if(!actor||!permissions.canAssignWork(actor,project)||assignees.some(id=>!project.teamIds.includes(id)||!data.users.some(person=>person.id===id&&person.authUid&&person.active!==false))) return data; const stamp=new Date().toISOString(); const item:WorkItem={...input,id:makeId('deliverable'),assigneeId:assignees[0],assigneeIds:assignees,stageId:input.stage,scopeNotes:input.scopeNotes||input.notes||'',subItems:input.subItems||[],required:input.required??true,createdBy:actorId,createdAt:stamp,updatedAt:stamp,dueLabel:dueLabel(input.dueDate),status:'Not Started',progress:0,hours:0,activeElapsedMinutes:0,archived:false}; const next={...data,workItems:[...data.workItems,item],cycles:data.cycles.map(c=>c.id===input.cycleId?{...c,deliverableIds:[...(c.deliverableIds||[]),item.id]}:c)}; return withActivity(next,input.projectId,actorId,`created deliverable ${item.name}`); },
  update(data:AppData, actorId:string, itemId:string, changes:Partial<WorkItem>):AppData {
    const item=data.workItems.find(w=>w.id===itemId),project=data.projects.find(p=>p.id===item?.projectId),actor=data.users.find(u=>u.id===actorId);
    if(!item||!project||!actor||item.status==='Blocked'||!(permissions.canManageWorkItem(actor,project)||permissions.canUpdateOwnWork(actor,item))) return data;
    const managing=permissions.canManageWorkItem(actor,project);
    const employeeKeys:(keyof WorkItem)[]=['name','dueDate','scopeNotes','notes','status','progress','blockedReason'];
    const allowed=managing?{...changes}:Object.fromEntries(employeeKeys.filter(key=>changes[key]!==undefined).map(key=>[key,changes[key]])) as Partial<WorkItem>;
    if(allowed.assigneeIds?.some(id=>!project.teamIds.includes(id)||!data.users.some(person=>person.id===id&&person.authUid&&person.active!==false)))return data;
    const stamp=new Date().toISOString(),status=allowed.progress===100?'Completed':allowed.status||(item.status==='Not Started'&&(allowed.progress||0)>0?'In Progress':item.status),progress=status==='Completed'?100:allowed.progress??(item.status==='Completed'&&status==='In Progress'?item.previousProgress??75:item.progress);
    const timing=transition(item,status,progress,stamp);
    const normalized={...allowed,...timing,...(allowed.stage?{stageId:allowed.stage}:{}),...(allowed.assigneeIds?.length?{assigneeId:allowed.assigneeIds[0]}:{}),...(allowed.dueDate?{dueLabel:dueLabel(allowed.dueDate)}:{})};
    let text=`updated ${item.name}`;if(allowed.dueDate&&allowed.dueDate!==item.dueDate)text=`changed ${item.name} deadline from ${dueLabel(item.dueDate)} to ${dueLabel(allowed.dueDate)}`;else if(progress!==item.progress)text=`changed ${item.name} from ${item.progress}% to ${progress}%`;
    const next={...data,workItems:data.workItems.map(w=>w.id===itemId?{...w,...normalized}:w)};
    return withActivity(next,item.projectId,actorId,text);
  },
  setStatus(data:AppData, actorId:string, itemId:string, status:WorkStatus, progress?:number, reason?:string):AppData { const item=data.workItems.find(w=>w.id===itemId)!,project=data.projects.find(p=>p.id===item.projectId)!,actor=data.users.find(u=>u.id===actorId); if(!actor||item.status==='Blocked'||!(permissions.canManageWorkItem(actor,project)||permissions.canUpdateOwnWork(actor,item))) return data; const stamp=new Date().toISOString(),nextProgress=status==='Completed'?100:status==='In Progress'&&item.status==='Completed'?(progress??item.previousProgress??75):(progress??item.progress),timing=transition(item,status,nextProgress,stamp); const next={...data,workItems:data.workItems.map(w=>w.id===itemId?{...w,...timing,previousProgress:status==='Completed'?item.progress:w.previousProgress,blockedReason:status==='Blocked'?reason:undefined}:w)}; const verb=status==='Completed'?'completed':item.status==='Completed'?'reopened':status==='Blocked'?'blocked':item.status==='Not Started'&&status==='In Progress'?'started':'changed the status of'; return withActivity(next,item.projectId,actorId,`${verb} ${item.name}`); },
  setProgress(data:AppData,actorId:string,itemId:string,progress:number):AppData {
    const item=data.workItems.find(w=>w.id===itemId),project=data.projects.find(p=>p.id===item?.projectId),actor=data.users.find(u=>u.id===actorId);
    if(!item||!project||!actor||item.status==='Blocked'||!(permissions.canManageWorkItem(actor,project)||permissions.canUpdateOwnWork(actor,item)))return data;
    const value=Math.max(0,Math.min(100,Math.round(progress/5)*5));
    if(value===item.progress)return data;
    const status:WorkStatus=value===100?'Completed':value>0||item.status==='Completed'?'In Progress':'Not Started';
    const stamp=new Date().toISOString(),timing=transition(item,status,value,stamp);
    let next:AppData={...data,workItems:data.workItems.map(w=>w.id===itemId?{...w,...timing,previousProgress:item.progress}:w)};
    if(item.status!=='Completed'&&status==='Completed')next=withActivity(next,item.projectId,actorId,`completed ${item.name}`,stamp);
    if(item.status==='Completed'&&status==='In Progress')next=withActivity(next,item.projectId,actorId,`reopened ${item.name}`,stamp);
    return withActivity(next,item.projectId,actorId,`changed ${item.name} progress from ${item.progress}% to ${value}%`,stamp);
  },
  assign(data:AppData, actorId:string, itemId:string, assigneeIds:string[]):AppData { const item=data.workItems.find(w=>w.id===itemId)!,project=data.projects.find(p=>p.id===item.projectId)!,actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canAssignWork(actor,project)||!assigneeIds.length||assigneeIds.some(id=>!project.teamIds.includes(id)||!data.users.some(person=>person.id===id&&person.authUid&&person.active!==false))) return data; const names=assigneeIds.map(id=>data.users.find(u=>u.id===id)?.name).join(', '); return withActivity({...data,workItems:data.workItems.map(w=>w.id===itemId?{...w,assigneeId:assigneeIds[0],assigneeIds,updatedAt:new Date().toISOString()}:w)},item.projectId,actorId,`assigned ${item.name} to ${names}`); },
  claim(data:AppData, actorId:string, itemId:string):AppData {
    const item=data.workItems.find(work=>work.id===itemId),actor=data.users.find(person=>person.id===actorId);
    const project=data.projects.find(candidate=>candidate.id===item?.projectId);
    if(!item||!actor||!project||actor.access!=='employee'||!actor.authUid||item.archived||item.status==='Completed'||!permissions.canViewProject(actor,project)||!project.teamIds.includes(actorId))return data;
    const assigneeIds=workItemAssigneeIds(item);
    if(assigneeIds.includes(actorId))return data;
    const next={...data,workItems:data.workItems.map(work=>work.id===itemId?{...work,assigneeIds:[...assigneeIds,actorId],updatedAt:new Date().toISOString()}:work)};
    return withActivity(next,item.projectId,actorId,`assigned ${item.name} to themselves`);
  },
  archive(data:AppData, actorId:string, itemId:string):AppData { const item=data.workItems.find(w=>w.id===itemId)!,project=data.projects.find(p=>p.id===item.projectId)!,actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canManageWorkItem(actor,project)) return data; return withActivity({...data,workItems:data.workItems.map(w=>w.id===itemId?{...w,archived:true}:w)},item.projectId,actorId,`archived ${item.name}`); },
};
