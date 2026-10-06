import type { AppData, Meeting, MeetingGroup } from '../types';
import { connectedPeople } from '../domain/people';
import { permissions } from '../permissions/permissions';
import { makeId, now } from './shared';

export interface MeetingInput {
  date: string;
  title: string;
  projectId: string | null;
  attendeeIds: string[];
  notes: string;
  type?: Meeting['type'];
  groupId?: string;
}

const meetingTypes = new Set<Meeting['type']>(['Client','Internal','Vendor','Other']);
const validGroup = (data:AppData,projectId:string|null,groupId?:string) => !groupId || (projectId===null && data.meetingGroups.some(group=>group.id===groupId));

export const meetingService = {
  visible(data: AppData, userId: string): Meeting[] {
    const user = data.users.find(person => person.id === userId);
    if (!user) return [];
    return (data.meetings || []).filter(meeting => {
      if (meeting.projectId === null) return true;
      const project = data.projects.find(entry => entry.id === meeting.projectId);
      return Boolean(project && !project.archived && permissions.canViewProject(user, project));
    }).sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt));
  },
  create(data: AppData, actorId: string, input: MeetingInput): AppData {
    const actor = connectedPeople(data).find(person => person.id === actorId);
    const title = input.title.trim();
    const notes = input.notes.trim();
    const attendees = [...new Set(input.attendeeIds)];
    const linkedIds = new Set(connectedPeople(data).map(person => person.id));
    const project = input.projectId === null ? null : data.projects.find(entry => entry.id === input.projectId);
    const parsedDate = Date.parse(`${input.date}T00:00:00Z`);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(input.date)
      && Number.isFinite(parsedDate) && new Date(parsedDate).toISOString().slice(0, 10) === input.date;
    const type=input.type||'Other';
    if (!actor || !validDate || !title || title.length > 160 || notes.length > 20000 || !meetingTypes.has(type) || !validGroup(data,input.projectId,input.groupId)
      || (input.projectId !== null && (!project || project.archived || !permissions.canViewProject(actor, project)))
      || attendees.length > 100 || attendees.some(id => !linkedIds.has(id))) return data;
    const meeting: Meeting = {
      id: makeId('meeting'), date: input.date, title, projectId: input.projectId,
      attendeeIds: attendees, notes, type, groupId:input.groupId, createdBy: actorId, createdAt: now(),
    };
    return {...data, meetings: [meeting, ...(data.meetings || [])]};
  },
  update(data: AppData, actorId: string, meetingId: string, input: MeetingInput): AppData {
    const actor=connectedPeople(data).find(person=>person.id===actorId),meeting=(data.meetings||[]).find(entry=>entry.id===meetingId);
    if(!actor||!meeting||(meeting.createdBy!==actorId&&actor.access!=='admin'))return data;
    const title=input.title.trim(),notes=input.notes.trim(),attendees=[...new Set(input.attendeeIds)];
    const linkedIds=new Set(connectedPeople(data).map(person=>person.id));
    const project=input.projectId===null?null:data.projects.find(entry=>entry.id===input.projectId);
    const parsedDate=Date.parse(`${input.date}T00:00:00Z`),validDate=/^\d{4}-\d{2}-\d{2}$/.test(input.date)&&Number.isFinite(parsedDate)&&new Date(parsedDate).toISOString().slice(0,10)===input.date;
    const type=input.type||meeting.type||'Other';
    if(!validDate||!title||title.length>160||notes.length>20000||!meetingTypes.has(type)||!validGroup(data,input.projectId,input.groupId)||(input.projectId!==null&&(!project||project.archived||!permissions.canViewProject(actor,project)))||attendees.length>100||attendees.some(id=>!linkedIds.has(id)))return data;
    return {...data,meetings:(data.meetings||[]).map(entry=>entry.id===meetingId?{...entry,date:input.date,title,projectId:input.projectId,attendeeIds:attendees,notes,type,groupId:input.groupId}:entry)};
  },
  delete(data: AppData, actorId: string, meetingId: string): AppData {
    const actor=data.users.find(person=>person.id===actorId),meeting=(data.meetings||[]).find(entry=>entry.id===meetingId);
    if(!actor||!meeting||(meeting.createdBy!==actorId&&actor.access!=='admin'))return data;
    return {...data,meetings:(data.meetings||[]).filter(entry=>entry.id!==meetingId)};
  },
  createGroup(data:AppData,actorId:string,name:string):AppData {
    const actor=connectedPeople(data).find(person=>person.id===actorId),clean=name.trim();
    if(!actor||!clean||clean.length>80||data.meetingGroups.some(group=>group.name.toLocaleLowerCase()===clean.toLocaleLowerCase()))return data;
    const group:MeetingGroup={id:makeId('meeting-group'),name:clean,createdBy:actorId,createdAt:now()};
    return {...data,meetingGroups:[...data.meetingGroups,group]};
  },
  renameGroup(data:AppData,actorId:string,groupId:string,name:string):AppData {
    const actor=data.users.find(person=>person.id===actorId),clean=name.trim();
    if(actor?.access!=='admin'||!clean||clean.length>80||data.meetingGroups.some(group=>group.id!==groupId&&group.name.toLocaleLowerCase()===clean.toLocaleLowerCase()))return data;
    if(!data.meetingGroups.some(group=>group.id===groupId))return data;
    return {...data,meetingGroups:data.meetingGroups.map(group=>group.id===groupId?{...group,name:clean}:group)};
  },
  deleteGroup(data:AppData,actorId:string,groupId:string):AppData {
    const actor=data.users.find(person=>person.id===actorId);
    if(actor?.access!=='admin'||!data.meetingGroups.some(group=>group.id===groupId))return data;
    return {...data,meetingGroups:data.meetingGroups.filter(group=>group.id!==groupId),meetings:(data.meetings||[]).map(meeting=>meeting.groupId===groupId?{...meeting,groupId:undefined}:meeting)};
  },
};
