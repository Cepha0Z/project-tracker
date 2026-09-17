import type { AppData, Project, WorkItem } from '../types';

export type ProjectHealth = 'Need Attention' | 'Delayed' | 'On Track' | 'Completed';
export type ProjectCardState = 'red' | 'yellow' | 'green' | 'black';
export const PROJECT_STAGE_ORDER = ['Brief', 'Concept Design', 'Design Development', 'Documentation', 'Production', 'Procurement', 'Site Stage'] as const;
export const projectStageNames = (project: Project) => project.stages.map(stage => stage.name);

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

export function workItemDaysBehind(item: WorkItem, date = localDateKey()) {
  if (!isWorkItemOverdue(item, date) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 0;
  const utcDay = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utcDay(date) - utcDay(item.dueDate)) / 86400000);
}

export function projectStageComplete(data: AppData, project: Project, stageName: string) {
  const required = projectWorkItems(data, project.id).filter(item =>
    (item.stageId || item.stage) === stageName && item.required !== false,
  );
  // A stage with no required work can only be complete if it was explicitly closed.
  return required.length ? required.every(item => item.status === 'Completed')
    : project.stages.some(stage => stage.name === stageName && stage.state === 'done');
}

export function currentProjectStage(data: AppData, project: Project) {
  return projectStageNames(project).find(stage => !projectStageComplete(data, project, stage)) ?? null;
}

export function projectHealth(data: AppData, project: Project, date = localDateKey()): ProjectHealth {
  const items = projectWorkItems(data, project.id);
  const unresolvedHelp = data.helpRequests.some(request =>
    request.projectId === project.id && request.status !== 'Resolved',
  );
  if (unresolvedHelp || items.some(item => item.status === 'Blocked')) return 'Need Attention';
  if (items.some(item => isWorkItemOverdue(item, date))) return 'Delayed';
  if (currentProjectStage(data, project) === null) return 'Completed';
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

export function projectCardState(data: AppData, project: Project, date = localDateKey()): ProjectCardState {
  const health = projectHealth(data, project, date);
  return health === 'Need Attention' ? 'red' : health === 'Delayed' ? 'yellow'
    : health === 'Completed' ? 'black' : 'green';
}

export const projectCardOrder: Record<ProjectCardState, number> = { red: 0, yellow: 1, green: 2, black: 3 };
