import type { AppData, Project, WorkItem } from '../types';

export type ProjectHealth = 'Needs Attention' | 'Blocked' | 'Delayed' | 'On Track' | 'Completed';
export type ProjectCardState = 'red' | 'yellow' | 'normal';

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function workItemAssigneeIds(item: WorkItem) {
  return item.assigneeIds?.length ? item.assigneeIds : [item.assigneeId];
}

export function projectWorkItems(data: AppData, projectId: string) {
  return data.workItems.filter(item => item.projectId === projectId && !item.archived);
}

export function employeeWorkItems(data: AppData, userId: string) {
  return data.workItems.filter(item => !item.archived && workItemAssigneeIds(item).includes(userId));
}

export function employeeActiveWork(data: AppData, userId: string) {
  return employeeWorkItems(data, userId).filter(item => item.status !== 'Completed');
}

export function isWorkItemOverdue(item: WorkItem, date = localDateKey()) {
  return item.status !== 'Completed' && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) && item.dueDate < date;
}

export function projectHealth(data: AppData, project: Project, date = localDateKey()): ProjectHealth {
  const required = projectWorkItems(data, project.id).filter(item => item.required !== false);
  const unresolvedHelp = data.helpRequests.some(request =>
    request.projectId === project.id && request.status !== 'Resolved',
  );
  const unresolvedBlocker = data.helpRequests.some(request =>
    request.projectId === project.id && request.kind === 'blocked' && request.status !== 'Resolved',
  );
  if (unresolvedBlocker || required.some(item => item.status === 'Blocked')) return 'Blocked';
  if (unresolvedHelp) return 'Needs Attention';
  if (required.length > 0 && required.every(item => item.status === 'Completed')) return 'Completed';
  if (required.some(item => isWorkItemOverdue(item, date))) return 'Delayed';
  return 'On Track';
}

export function projectAttention(data: AppData, project: Project, date = localDateKey()) {
  const required = projectWorkItems(data, project.id).filter(item => item.required !== false);
  const overdue = required.filter(item => isWorkItemOverdue(item, date));
  const blocked = required.filter(item => item.status === 'Blocked');
  const escalations = data.helpRequests.filter(request =>
    request.projectId === project.id && request.status !== 'Resolved',
  );
  return { overdue, blocked, escalations };
}

export function projectCardState(data: AppData, project: Project): ProjectCardState {
  if (data.helpRequests.some(request => request.projectId === project.id && request.status !== 'Resolved')
    || projectHealth(data, project) === 'Blocked') return 'red';
  const all = data.workItems.filter(item => item.projectId === project.id);
  if (all.length > 0 && all.every(item => item.archived)) return 'yellow';
  return 'normal';
}

export const projectCardOrder: Record<ProjectCardState, number> = { red: 0, yellow: 1, normal: 2 };
