import assert from 'node:assert/strict';
import { seedData } from '../src/data/seed';
import { connectedPeople } from '../src/domain/people';
import { employeeActiveWork, projectHealth } from '../src/domain/selectors';
import { helpRequestService } from '../src/services/helpRequestService';
import { projectService } from '../src/services/projectService';
import { workItemService } from '../src/services/workItemService';
import { updateService } from '../src/services/updateService';
import type { AppData, WorkItem } from '../src/types';

function fixture():AppData {
  const data=structuredClone(seedData);
  data.users=data.users.map(user=>['manoj','sudiksha','rahul'].includes(user.id)?{...user,authUid:`firebase-${user.id}`,active:true}:user);
  data.projects=[{...data.projects[0],principalId:'manoj',teamIds:['sudiksha','rahul']}];
  data.workItems=[{
    id:'assigned-work',projectId:'villa-60',name:'Kitchen Layout',assigneeId:'rahul',assigneeIds:['rahul'],
    stage:'Documentation',stageId:'Documentation',cycleId:'old-cycle',dueDate:'2026-09-15',dueLabel:'15 Sep',
    status:'In Progress',progress:40,hours:0,archived:false,
  } as WorkItem];
  data.helpRequests=[];data.activities=[];data.updates=[];data.cycles=[];data.timeEntries=[];data.dailyReports=[];
  return data;
}

const base=fixture();
assert.deepEqual(connectedPeople(base).map(user=>user.id),['manoj','sudiksha','rahul']);
assert.equal(employeeActiveWork(base,'rahul').length,1,'unfinished overdue work remains active in an old cycle');
assert.equal(projectHealth(base,base.projects[0],'2026-09-16'),'Delayed');
assert.equal(projectService.removeTeamMember(base,'sudiksha','villa-60','rahul'),base,'cannot remove someone with active assigned work');
assert.equal(projectService.addTeamMember(base,'sudiksha','villa-60','siddharth'),base,'unlinked prototype users cannot be added');
assert.equal(helpRequestService.create(base,'siddharth',{workItemId:'assigned-work',reason:'Not mine',blocked:false}),base,'unassigned employee cannot raise help');
const finished=workItemService.setProgress(base,'rahul','assigned-work',100);
assert.equal(finished.workItems[0].status,'Completed');
assert.equal(projectService.removeTeamMember(finished,'sudiksha','villa-60','rahul').projects[0].teamIds.includes('rahul'),false,'completed history does not trap someone on a team');

const created=projectService.create(base,'manoj',{name:'Another Residence',leadId:'sudiksha',principalId:'manoj',teamIds:['rahul']});
assert.deepEqual(created.projects.at(-1)?.teamIds,['rahul','sudiksha','manoj']);
assert.equal(projectService.create(base,'manoj',{name:'Invalid',leadId:'sudiksha',principalId:'manoj',teamIds:['siddharth']}),base);

const normal=helpRequestService.create(base,'rahul',{workItemId:'assigned-work',reason:'Confirm island dimensions',blocked:false});
assert.equal(normal.helpRequests.length,1);
assert.equal(normal.workItems[0].status,'In Progress');
assert.notEqual(workItemService.setProgress(normal,'rahul','assigned-work',50),normal,'non-blocking help allows progress');
assert.equal(helpRequestService.create(normal,'rahul',{workItemId:'assigned-work',reason:'Duplicate',blocked:false}),normal);

const escalated=helpRequestService.escalate(normal,'rahul',normal.helpRequests[0].id,{note:'Please decide today'});
assert.equal(escalated.helpRequests.length,1,'escalation reuses the request');
assert.equal(escalated.helpRequests[0].status,'Escalated');
assert.equal(escalated.helpRequests[0].escalationNote,'Please decide today');
assert.equal(helpRequestService.escalate(normal,'siddharth',normal.helpRequests[0].id,{}),normal,'unassigned person cannot escalate');

const blocked=helpRequestService.create(base,'rahul',{workItemId:'assigned-work',reason:'Cannot continue',blocked:true});
assert.equal(blocked.workItems[0].status,'Blocked');
assert.equal(projectHealth(blocked,blocked.projects[0],'2026-09-16'),'Blocked');
assert.equal(workItemService.setProgress(blocked,'rahul','assigned-work',80),blocked,'blocked progress is frozen');
assert.equal(updateService.createReport(blocked,'rahul',{summary:'No work',entries:[{workItemId:'assigned-work',progress:80,status:'Blocked',note:'No work'}]}),blocked,'blocked daily progress is frozen');
const resolved=helpRequestService.resolve(blocked,'manoj',blocked.helpRequests[0].id,'Use option B and maintain 600mm clearance.');
assert.equal(resolved.helpRequests[0].status,'Resolved');
assert.equal(resolved.helpRequests[0].resolvedBy,'manoj');
assert.equal(resolved.helpRequests[0].resolutionNote,'Use option B and maintain 600mm clearance.');
assert.equal(resolved.workItems[0].status,'In Progress');
assert.equal(resolved.workItems[0].progress,40);
assert.equal(projectHealth(resolved,resolved.projects[0],'2026-09-16'),'Delayed','overdue and blocked remain distinct');
assert.notEqual(workItemService.setProgress(resolved,'rahul','assigned-work',80),resolved);
assert.equal(helpRequestService.resolve(blocked,'sudiksha',blocked.helpRequests[0].id,'Unblock'),blocked,'lead cannot impersonate principal resolution');
console.log('Workflow service tests passed.');
