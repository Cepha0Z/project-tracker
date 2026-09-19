import type { AppData, DecisionOutcome } from '../types';
import { makeId, now, withActivity } from './shared';
import { permissions } from '../permissions/permissions';
import { isConnectedPerson } from '../domain/people';

export const helpRequestService = {
  create(data:AppData,actorId:string,input:{workItemId:string;reason:string}):AppData {
    const item=data.workItems.find(workItem=>workItem.id===input.workItemId);
    if(!item)return data;
    const project=data.projects.find(candidate=>candidate.id===item.projectId);
    const actor=data.users.find(user=>user.id===actorId);
    if(!project||!actor||!isConnectedPerson(actor)||actor.access!=='employee'||item.archived||item.status==='Completed'||!project.teamIds.includes(actorId)||!permissions.canUpdateOwnWork(actor,item))return data;
    if(data.helpRequests.some(request=>request.workItemId===item.id&&request.status!=='Resolved'))return data;
    const admins=data.users.filter(user=>isConnectedPerson(user)&&user.access==='admin');
    if(!admins.length)return data;

    const stamp=now();
    const request={
      id:makeId('help'),
      projectId:item.projectId,
      workItemId:item.id,
      raisedBy:actorId,
      assignedTo:admins.find(user=>user.id===project.principalId)?.id||admins[0].id,
      level:'principal' as const,
      subject:`Help request · ${item.name}`,
      reason:input.reason.trim()||'Help requested.',
      priority:'Normal' as const,
      status:'Open' as const,
      createdAt:stamp,
      kind:'question' as const,
    };
    return withActivity({...data,helpRequests:[request,...data.helpRequests]},item.projectId,actorId,`asked for help on ${item.name}`);
  },

  respond(data:AppData,actorId:string,requestId:string,response:string):AppData {
    const request=data.helpRequests.find(candidate=>candidate.id===requestId);
    if(!request)return data;
    const project=data.projects.find(candidate=>candidate.id===request.projectId);
    const actor=data.users.find(user=>user.id===actorId);
    if(!project||!actor||!permissions.canRespondAsLead(actor,project,request))return data;
    const next={...data,helpRequests:data.helpRequests.map(candidate=>candidate.id===requestId?{
      ...candidate,
      response:response.trim(),
      respondedBy:actorId,
      respondedAt:now(),
      status:'Responded' as const,
    }:candidate)};
    return withActivity(next,request.projectId,actorId,`responded to ${request.subject}`);
  },

  escalate(data:AppData,actorId:string,requestId:string,input:{note?:string}):AppData {
    const request=data.helpRequests.find(candidate=>candidate.id===requestId);
    if(!request)return data;
    const project=data.projects.find(candidate=>candidate.id===request.projectId);
    const actor=data.users.find(user=>user.id===actorId);
    const item=data.workItems.find(candidate=>candidate.id===request.workItemId);
    if(!project||!actor||!permissions.canEscalateToPrincipal(actor,project,request,item))return data;
    const admins=data.users.filter(user=>isConnectedPerson(user)&&user.access==='admin');
    if(!admins.length)return data;
    const stamp=now();
    const next={...data,helpRequests:data.helpRequests.map(candidate=>candidate.id===requestId?{
      ...candidate,
      level:'principal' as const,
      assignedTo:candidate.level==='lead'?(admins.find(user=>user.id===project.principalId)?.id||admins[0].id):candidate.assignedTo,
      ...(input.note?.trim()?{escalationNote:input.note.trim()}:{}),
      status:'Escalated' as const,
      escalatedBy:actorId,
      escalatedAt:stamp,
    }:candidate)};
    return withActivity(next,request.projectId,actorId,`escalated ${request.subject} to admins`);
  },

  markSeen(data:AppData,actorId:string,requestId:string):AppData {
    const request=data.helpRequests.find(candidate=>candidate.id===requestId);
    if(!request)return data;
    const project=data.projects.find(candidate=>candidate.id===request.projectId);
    const actor=data.users.find(user=>user.id===actorId);
    if(!project||!actor||!permissions.canDecidePrincipalRequest(actor,project,request))return data;
    const next={...data,helpRequests:data.helpRequests.map(candidate=>candidate.id===requestId&&candidate.status==='Escalated'?{
      ...candidate,status:'Seen' as const,
    }:candidate)};
    return withActivity(next,request.projectId,actorId,`acknowledged ${request.subject}`);
  },

  decide(data:AppData,actorId:string,requestId:string,response:string,outcome:DecisionOutcome):AppData {
    const request=data.helpRequests.find(candidate=>candidate.id===requestId);
    if(!request)return data;
    const project=data.projects.find(candidate=>candidate.id===request.projectId);
    const actor=data.users.find(user=>user.id===actorId);
    if(!project||!actor||!permissions.canDecidePrincipalRequest(actor,project,request))return data;
    const stamp=now();
    const next={...data,helpRequests:data.helpRequests.map(candidate=>candidate.id===requestId?{
      ...candidate,
      principalDecision:response.trim(),
      decisionOutcome:outcome,
      decidedBy:actorId,
      decidedAt:stamp,
      status:'Decision Given' as const,
      assignedTo:candidate.escalatedBy||candidate.assignedTo,
    }:candidate)};
    return withActivity(next,request.projectId,actorId,`gave a decision on ${request.subject}: ${outcome}`);
  },

  resolve(data:AppData,actorId:string,requestId:string,note:string):AppData {
    const request=data.helpRequests.find(candidate=>candidate.id===requestId);
    if(!request)return data;
    const project=data.projects.find(candidate=>candidate.id===request.projectId);
    const actor=data.users.find(user=>user.id===actorId);
    if(!project||!actor||!permissions.canResolveRequest(actor,project,request))return data;
    const stamp=now();
    const resolutionNote=note.trim()||'Closed without a written note.';
    const next={
      ...data,
      helpRequests:data.helpRequests.map(candidate=>candidate.id===requestId?{
        ...candidate,
        status:'Resolved' as const,
        response:candidate.response??resolutionNote,
        resolutionNote,
        resolvedBy:actorId,
        resolvedAt:stamp,
      }:candidate),
      workItems:data.workItems.map(workItem=>request.kind==='blocked'&&workItem.id===request.workItemId&&workItem.status==='Blocked'?{
        ...workItem,
        status:'In Progress' as const,
        blockedReason:undefined,
        startedAt:stamp,
        updatedAt:stamp,
        unblockedByHelpId:request.id,
      }:workItem),
    };
    return withActivity(next,request.projectId,actorId,`resolved ${request.subject}`);
  },
};
