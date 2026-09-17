import type { AppData, DailyReport, Project } from '../types';
import { makeId, now, withActivity } from './shared';
import { permissions } from '../permissions/permissions';
import { PROJECT_STAGE_ORDER, currentProjectStage } from '../domain/selectors';

// Keep the project and its related records in a single atomic Firestore batch.
export const MAX_PROJECT_DELETION_OPERATIONS = 400;

function reportsAfterProjectRemoval(data:AppData, projectId:string) {
  const removedUpdates=new Set(data.updates.filter(update=>update.projectId===projectId).map(update=>update.id));
  const removedItems=new Set(data.workItems.filter(item=>item.projectId===projectId).map(item=>item.id));
  let deleted=0, updated=0;
  const reports=(data.dailyReports||[]).flatMap((report:DailyReport)=>{
    const updateIds=report.updateIds.filter(id=>!removedUpdates.has(id));
    const items=report.items?.filter(item=>!removedItems.has(item.workItemId));
    if(updateIds.length===report.updateIds.length&&items?.length===report.items?.length)return [report];
    if(!updateIds.length&&!report.customWork?.trim()){deleted++;return []}
    updated++;
    return [{...report,updateIds,items}];
  });
  return {reports,deleted,updated};
}

export function projectDeletionImpact(data:AppData,projectId:string){
  const reports=reportsAfterProjectRemoval(data,projectId);
  const workItems=data.workItems.filter(item=>item.projectId===projectId).length;
  const updates=data.updates.filter(update=>update.projectId===projectId).length;
  const helpRequests=data.helpRequests.filter(request=>request.projectId===projectId).length;
  const activities=data.activities.filter(activity=>activity.projectId===projectId).length;
  const cycles=data.cycles.filter(cycle=>cycle.projectId===projectId).length;
  const timeEntries=data.timeEntries.filter(entry=>entry.projectId===projectId).length;
  return {workItems,updates,helpRequests,activities,cycles,timeEntries,reportsDeleted:reports.deleted,reportsUpdated:reports.updated,
    operations:1+workItems+updates+helpRequests+activities+cycles+timeEntries+reports.deleted+reports.updated};
}

export const projectService = {
  deleteProject(data:AppData, actorId:string, projectId:string):AppData {
    const actor=data.users.find(user=>user.id===actorId);
    if(!actor||!permissions.canDeleteProject(actor)||!data.projects.some(project=>project.id===projectId)
      ||projectDeletionImpact(data,projectId).operations>MAX_PROJECT_DELETION_OPERATIONS)return data;
    return {
      ...data,
      projects:data.projects.filter(project=>project.id!==projectId),
      workItems:data.workItems.filter(item=>item.projectId!==projectId),
      updates:data.updates.filter(update=>update.projectId!==projectId),
      helpRequests:data.helpRequests.filter(request=>request.projectId!==projectId),
      activities:data.activities.filter(activity=>activity.projectId!==projectId),
      cycles:data.cycles.filter(cycle=>cycle.projectId!==projectId),
      timeEntries:data.timeEntries.filter(entry=>entry.projectId!==projectId),
      dailyReports:reportsAfterProjectRemoval(data,projectId).reports,
    };
  },
  create(data:AppData, actorId:string, input:{name:string;location?:string;principalId:string;leadId:string;teamIds?:string[];description?:string;deadline?:string}):AppData {
    const actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canCreateProject(actor)) return data;
    const selected=[...new Set([...(input.teamIds||[]),input.leadId,actorId])];
    if(![input.principalId,input.leadId,...selected].every(id=>data.users.some(u=>u.id===id&&u.authUid&&u.active!==false&&u.loginEnabled!==false)))return data;
    const id=makeId('project');
    const teamIds=selected;
    const project:Project={id,name:input.name.trim(),location:input.location?.trim()||'',code:input.name.trim().split(/\s+/).map(x=>x[0]).join('').slice(0,4).toUpperCase(),description:input.description||'',focus:'Brief and project planning',principalId:input.principalId,leadId:input.leadId,teamIds,currentStage:'Brief',deadline:input.deadline||'',deadlineLabel:'—',health:'On Track',stages:PROJECT_STAGE_ORDER.map((name,i)=>({name,state:i===0?'current':'next'})),cycle:{label:'Not planned',direction:'Awaiting project planning.',deadline:'Not set'},notes:[],createdBy:actorId,createdAt:now()};
    return withActivity({...data,projects:[...data.projects,project]},id,actorId,`created project ${project.name}`);
  },
  update(data:AppData, actorId:string, projectId:string, changes:Partial<Project>):AppData {
    const before=data.projects.find(p=>p.id===projectId)!; const updated={...before,...changes};
    const actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canManageProject(actor,before)) return data;
    const next={...data,projects:data.projects.map(p=>p.id===projectId?updated:p)};
    return withActivity(next,projectId,actorId,`updated project information`);
  },
  addSection(data:AppData, actorId:string, projectId:string, name:string):AppData {
    const project=data.projects.find(p=>p.id===projectId),actor=data.users.find(u=>u.id===actorId),label=name.trim();
    if(!project||!actor||!permissions.canEditSections(actor,project)||!label||label.length>80||project.stages.length>=50||project.stages.some(stage=>stage.name.toLowerCase()===label.toLowerCase()))return data;
    const updated={...project,stages:[...project.stages,{name:label,state:'next' as const}]};
    updated.currentStage=currentProjectStage(data,updated)||updated.currentStage;
    return withActivity({...data,projects:data.projects.map(p=>p.id===projectId?updated:p)},projectId,actorId,`added section ${label}`);
  },
  renameSection(data:AppData, actorId:string, projectId:string, oldName:string, name:string):AppData {
    const project=data.projects.find(p=>p.id===projectId),actor=data.users.find(u=>u.id===actorId),label=name.trim();
    if(!project||!actor||!permissions.canEditSections(actor,project)||!label||label.length>80||!project.stages.some(stage=>stage.name===oldName)||project.stages.some(stage=>stage.name.toLowerCase()===label.toLowerCase()&&stage.name!==oldName))return data;
    if(label===oldName)return data;
    const updated={...project,stages:project.stages.map(stage=>stage.name===oldName?{...stage,name:label}:stage),currentStage:project.currentStage===oldName?label:project.currentStage};
    const next={...data,projects:data.projects.map(p=>p.id===projectId?updated:p),workItems:data.workItems.map(item=>item.projectId===projectId&&(item.stageId||item.stage)===oldName?{...item,stage:label,stageId:label}:item)};
    return withActivity(next,projectId,actorId,`renamed section ${oldName} to ${label}`);
  },
  deleteSection(data:AppData, actorId:string, projectId:string, name:string):AppData {
    const project=data.projects.find(p=>p.id===projectId),actor=data.users.find(u=>u.id===actorId);
    if(!project||!actor||!permissions.canEditSections(actor,project)||project.stages.length<=1||!project.stages.some(stage=>stage.name===name)||data.workItems.some(item=>item.projectId===projectId&&(item.stageId||item.stage)===name))return data;
    const updated={...project,stages:project.stages.filter(stage=>stage.name!==name)};
    updated.currentStage=currentProjectStage(data,updated)||updated.stages.at(-1)!.name;
    return withActivity({...data,projects:data.projects.map(p=>p.id===projectId?updated:p)},projectId,actorId,`deleted empty section ${name}`);
  },
  setStage(data:AppData, actorId:string, projectId:string, stageName:string):AppData {
    const project=data.projects.find(p=>p.id===projectId)!; const old=project.currentStage; const idx=project.stages.findIndex(s=>s.name===stageName);
    const actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canManageProject(actor,project)||idx<0) return data;
    const stages=project.stages.map((s,i)=>({...s,state:i<idx?'done':i===idx?'current':'next'} as const));
    const next={...data,projects:data.projects.map(p=>p.id===projectId?{...p,currentStage:stageName,stages}:p)};
    return withActivity(next,projectId,actorId,`moved ${project.name} from ${old} to ${stageName}`);
  },
  addTeamMember(data:AppData, actorId:string, projectId:string, userId:string):AppData {
    const project=data.projects.find(p=>p.id===projectId)!; if(project.teamIds.includes(userId)) return data;
    const actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canManageTeam(actor,project)) return data;
    const member=data.users.find(u=>u.id===userId); if(!member?.authUid||member.active===false||member.loginEnabled===false)return data; const next={...data,projects:data.projects.map(p=>p.id===projectId?{...p,teamIds:[...p.teamIds,userId]}:p)};
    return withActivity(next,projectId,actorId,`added ${member.name} to the project team`);
  },
  removeTeamMember(data:AppData, actorId:string, projectId:string, userId:string):AppData {
    const project=data.projects.find(p=>p.id===projectId)!; const actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canManageTeam(actor,project)||project.leadId===userId||data.workItems.some(w=>w.projectId===projectId&&!w.archived&&w.status!=='Completed'&&(w.assigneeIds?.length?w.assigneeIds:[w.assigneeId]).includes(userId))) return data;
    const member=data.users.find(u=>u.id===userId); if(!member||!project.teamIds.includes(userId))return data; const next={...data,projects:data.projects.map(p=>p.id===projectId?{...p,teamIds:p.teamIds.filter(id=>id!==userId)}:p)};
    return withActivity(next,projectId,actorId,`removed ${member.name} from the project team`);
  },
};
