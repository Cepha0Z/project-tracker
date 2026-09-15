import type { AppData, Project } from '../types';
import { makeId, now, withActivity } from './shared';
import { permissions } from '../permissions/permissions';

export const projectService = {
  create(data:AppData, actorId:string, input:{name:string;location?:string;principalId:string;leadId:string;description?:string;deadline?:string}):AppData {
    const actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canCreateProject(actor)) return data;
    const id=makeId('project');
    const teamIds=[...new Set([input.leadId,actorId])];
    const project:Project={id,name:input.name.trim(),location:input.location?.trim()||'',code:input.name.trim().split(/\s+/).map(x=>x[0]).join('').slice(0,4).toUpperCase(),description:input.description||'',focus:'Brief and project planning',principalId:input.principalId,leadId:input.leadId,teamIds,currentStage:'Brief',deadline:input.deadline||'',deadlineLabel:'—',health:'On Track',stages:['Brief','Concept Design','Design Development','Documentation','Production','Procurement','Site Stage'].map((name,i)=>({name,state:i===0?'current':'next'})),cycle:{label:'Not planned',direction:'Awaiting project planning.',deadline:'Not set'},notes:[]};
    return withActivity({...data,projects:[...data.projects,project]},id,actorId,`created project ${project.name}`);
  },
  update(data:AppData, actorId:string, projectId:string, changes:Partial<Project>):AppData {
    const before=data.projects.find(p=>p.id===projectId)!; const updated={...before,...changes};
    const actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canManageProject(actor,before)) return data;
    const next={...data,projects:data.projects.map(p=>p.id===projectId?updated:p)};
    return withActivity(next,projectId,actorId,`updated project information`);
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
    const member=data.users.find(u=>u.id===userId)!; const next={...data,projects:data.projects.map(p=>p.id===projectId?{...p,teamIds:[...p.teamIds,userId]}:p)};
    return withActivity(next,projectId,actorId,`added ${member.name} to the project team`);
  },
  removeTeamMember(data:AppData, actorId:string, projectId:string, userId:string):AppData {
    const project=data.projects.find(p=>p.id===projectId)!; const actor=data.users.find(u=>u.id===actorId); if(!actor||!permissions.canManageTeam(actor,project)||project.leadId===userId||data.workItems.some(w=>w.projectId===projectId&&w.assigneeId===userId&&!w.archived)) return data;
    const member=data.users.find(u=>u.id===userId)!; const next={...data,projects:data.projects.map(p=>p.id===projectId?{...p,teamIds:p.teamIds.filter(id=>id!==userId)}:p)};
    return withActivity(next,projectId,actorId,`removed ${member.name} from the project team`);
  },
};
