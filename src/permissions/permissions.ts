import type { HelpRequest, Project, User, WorkItem } from '../types';

export const permissions = {
  isPrincipal: (user:User) => user.access==='admin',
  // Studio policy: every active staff member may start a project. The creator
  // is added to its team and recorded as createdBy by projectService.
  canCreateProject: (_user:User) => true,
  isProjectLead: (user:User, project:Project) => project.leadId===user.id,
  canViewProject: (user:User, project:Project) => user.access==='admin'||project.teamIds.includes(user.id),
  canManageProject: (user:User, project:Project) => user.access==='admin'||project.leadId===user.id,
  canGiveDirection: (user:User, project:Project) => user.access==='admin'&&project.principalId===user.id,
  canManageTeam: (user:User, project:Project) => project.leadId===user.id||user.access==='admin',
  canAssignWork: (user:User, project:Project) => project.leadId===user.id||user.access==='admin',
  canManageWorkItem: (user:User, project:Project) => project.leadId===user.id||user.access==='admin',
  canUpdateOwnWork: (user:User, item:WorkItem) => (item.assigneeIds||[item.assigneeId]).includes(user.id),
  canEscalateToPrincipal: (user:User, project:Project, request:HelpRequest) => project.leadId===user.id&&request.level==='lead',
  canRespondAsLead: (user:User, project:Project, request:HelpRequest) => project.leadId===user.id&&request.level==='lead',
  canDecidePrincipalRequest: (user:User, project:Project, request:HelpRequest) => user.id===project.principalId&&request.level==='principal'&&['Escalated','Seen'].includes(request.status),
  canResolveRequest: (user:User, project:Project, _request:HelpRequest) => user.access==='admin'||project.leadId===user.id,
};
