export type AccessRole = 'admin' | 'employee';
export type WorkStatus = 'Not Started' | 'In Progress' | 'In Review' | 'Changes Required' | 'Completed' | 'Blocked';
export type HelpStatus = 'Open' | 'Responded' | 'Escalated' | 'Seen' | 'Decision Given' | 'Resolved';
export type Priority = 'Normal' | 'Important' | 'Urgent';
export type DecisionOutcome = 'Approved' | 'Changes Required' | 'Continue Discussion';

export interface User {
  id: string;
  name: string;
  initials: string;
  title: string;
  access: AccessRole;
  tone: string;
  reportsToId?: string;
  loginEnabled?: boolean;
  email?: string;
  authUid?: string;
  active?: boolean;
}

export interface Stage { name: string; state: 'done' | 'current' | 'next' }

export interface WorkItem {
  id: string;
  projectId: string;
  name: string;
  assigneeId: string;
  stage: string;
  dueDate: string;
  dueLabel: string;
  status: WorkStatus;
  progress: number;
  notes?: string;
  blockedReason?: string;
  unblockedByHelpId?: string;
  hours: number;
  cycleId?: string;
  archived?: boolean;
  carriedFromCycleId?: string;
  previousProgress?: number;
  stageId?: string;
  assigneeIds?: string[];
  scopeNotes?: string;
  subItems?: DeliverableSubItem[];
  required?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  templateKey?: string;
  startedAt?: string;
  completedAt?: string;
  activeElapsedMinutes?: number;
}

export interface DeliverableSubItem {
  id: string;
  title: string;
  assigneeIds: string[];
  completed: boolean;
}

export interface DailyUpdate {
  id: string;
  projectId: string;
  workItemId: string;
  userId: string;
  text: string;
  progress: number;
  minutes: number;
  status: WorkStatus;
  blocker?: string;
  createdAt: string;
  cycleId?: string;
  reportId?: string;
  previousProgress?: number;
  progressDelta?: number;
}

export interface HelpRequest {
  id: string;
  projectId: string;
  workItemId: string;
  raisedBy: string;
  assignedTo: string;
  level: 'lead' | 'principal';
  subject: string;
  reason: string;
  tried?: string;
  decisionNeeded?: string;
  priority: Priority;
  status: HelpStatus;
  createdAt: string;
  kind?: 'question' | 'blocked';
  escalatedBy?: string;
  escalatedAt?: string;
  escalationNote?: string;
  response?: string;
  respondedBy?: string;
  respondedAt?: string;
  principalDecision?: string;
  decisionOutcome?: DecisionOutcome;
  decidedBy?: string;
  decidedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface Activity {
  id: string;
  projectId: string;
  actorId: string;
  text: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  location?: string;
  code: string;
  description: string;
  focus: string;
  principalId: string;
  principalIds?: string[];
  leadId: string;
  teamIds: string[];
  currentStage: string;
  stages: Stage[];
  deadline: string;
  deadlineLabel: string;
  health: 'On Track' | 'Needs Attention' | 'At Risk';
  cycle: { label: string; direction: string; deadline: string };
  notes: string[];
  activeCycleId?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface Cycle {
  id: string;
  projectId: string;
  startDate: string;
  endDate: string;
  direction: string;
  status: 'Planned' | 'Active' | 'Closed';
  summary: string;
  nextPlan: string;
  createdBy: string;
  createdAt: string;
  closedAt?: string;
  deliverableIds?: string[];
  number?: number;
}

export interface DailyReport {
  id: string;
  userId: string;
  date: string;
  summary: string;
  customWork?: string;
  createdAt: string;
  updateIds: string[];
  items?: {workItemId:string;previousProgress:number;newProgress:number;progressDelta:number;status:WorkStatus}[];
}

export interface TimeEntry {
  id: string;
  projectId: string;
  workItemId: string;
  userId: string;
  cycleId?: string;
  date: string;
  minutes: number;
  updateId?: string;
}

export interface AppData {
  users: User[];
  projects: Project[];
  workItems: WorkItem[];
  updates: DailyUpdate[];
  helpRequests: HelpRequest[];
  activities: Activity[];
  cycles: Cycle[];
  timeEntries: TimeEntry[];
  dailyReports?: DailyReport[];
  schemaVersion?: number;
}
