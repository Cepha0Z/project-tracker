import type { AppData, Meeting } from '../types';
import { connectedPeople } from '../domain/people';
import { permissions } from '../permissions/permissions';
import { makeId, now } from './shared';

export interface MeetingInput {
  date: string;
  title: string;
  projectId: string | null;
  attendeeIds: string[];
  notes: string;
}

export const meetingService = {
  visible(data: AppData, userId: string): Meeting[] {
    const user = data.users.find(person => person.id === userId);
    if (!user) return [];
    return (data.meetings || []).filter(meeting => {
      if (user.access === 'admin' || meeting.projectId === null) return true;
      const project = data.projects.find(entry => entry.id === meeting.projectId);
      return Boolean(project && permissions.canViewProject(user, project));
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
    if (!actor || !validDate || !title || title.length > 160 || notes.length > 20000
      || (input.projectId !== null && (!project || !permissions.canViewProject(actor, project)))
      || attendees.length > 100 || attendees.some(id => !linkedIds.has(id))) return data;
    const meeting: Meeting = {
      id: makeId('meeting'), date: input.date, title, projectId: input.projectId,
      attendeeIds: attendees, notes, createdBy: actorId, createdAt: now(),
    };
    return {...data, meetings: [meeting, ...(data.meetings || [])]};
  },
};
