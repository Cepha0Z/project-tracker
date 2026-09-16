import assert from 'node:assert/strict';
import { seedData } from '../src/data/seed';
import { connectedPeople, displayActivityText, displayNameFromEmail, presentUser } from '../src/domain/people';
import { employeeActiveWork, projectCardOrder, projectCardState, projectHealth } from '../src/domain/selectors';
import { notificationChanges } from '../src/services/notificationEvents';
import { helpRequestService } from '../src/services/helpRequestService';
import { projectService } from '../src/services/projectService';
import { workItemService } from '../src/services/workItemService';
import { updateService } from '../src/services/updateService';
import type { AppData, WorkItem } from '../src/types';

function fixture():AppData {
  const data=structuredClone(seedData);
  data.users=data.users.map(user=>['kiran','manoj','sudiksha','rahul'].includes(user.id)?{...user,authUid:`firebase-${user.id}`,email:`${user.id}@nebulousdesign.com`,active:true}:user);
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
assert.deepEqual(connectedPeople(base).map(user=>user.id),['kiran','manoj','sudiksha','rahul']);
assert.equal(displayNameFromEmail({email:'kiran@nebulous.com',name:'Wrong Surname'}),'Kiran');
presentUser({...base.users[0],name:'Kiran Rao'});
assert.equal(displayActivityText('Sent direction to Kiran Rao'),'Sent direction to Kiran');
assert.equal(employeeActiveWork(base,'rahul').length,1,'unfinished overdue work remains active in an old cycle');
assert.equal(projectHealth(base,base.projects[0],'2026-09-16'),'Delayed');
assert.equal(projectService.removeTeamMember(base,'sudiksha','villa-60','rahul'),base,'cannot remove someone with active assigned work');
assert.equal(projectService.addTeamMember(base,'sudiksha','villa-60','siddharth'),base,'unlinked prototype users cannot be added');
assert.equal(helpRequestService.create(base,'siddharth',{workItemId:'assigned-work',reason:'Not mine'}),base,'unassigned employee cannot raise help');
const finished=workItemService.setProgress(base,'rahul','assigned-work',100);
assert.equal(finished.workItems[0].status,'Completed');
assert.equal(projectService.removeTeamMember(finished,'sudiksha','villa-60','rahul').projects[0].teamIds.includes('rahul'),false,'completed history does not trap someone on a team');

const created=projectService.create(base,'manoj',{name:'Another Residence',leadId:'sudiksha',principalId:'manoj',teamIds:['rahul']});
assert.deepEqual(created.projects.at(-1)?.teamIds,['rahul','sudiksha','manoj']);
assert.equal(projectService.create(base,'manoj',{name:'Invalid',leadId:'sudiksha',principalId:'manoj',teamIds:['siddharth']}),base);

const normal=helpRequestService.create(base,'rahul',{workItemId:'assigned-work',reason:'Confirm island dimensions'});
assert.equal(normal.helpRequests.length,1);
assert.equal(normal.helpRequests[0].level,'principal');
assert.equal(normal.helpRequests[0].assignedTo,'manoj');
assert.equal(normal.workItems[0].status,'In Progress');
assert.equal(projectCardState(normal,normal.projects[0]),'red','unresolved help colors the whole admin card red');
assert.equal(projectHealth(normal,normal.projects[0],'2026-09-16'),'Needs Attention','unresolved help requires admin attention without blocking work');
assert.notEqual(workItemService.setProgress(normal,'rahul','assigned-work',50),normal,'non-blocking help allows progress');
assert.equal(helpRequestService.create(normal,'rahul',{workItemId:'assigned-work',reason:'Duplicate'}),normal);

const escalated=helpRequestService.escalate(normal,'rahul',normal.helpRequests[0].id,{note:'Please decide today'});
assert.equal(escalated.helpRequests.length,1,'escalation reuses the request');
assert.equal(escalated.helpRequests[0].status,'Escalated');
assert.equal(projectCardState(escalated,escalated.projects[0]),'red','escalated help stays at the top of the admin dashboard');
assert.equal(escalated.helpRequests[0].assignedTo,'manoj','escalation retains the admin recipient');
assert.equal(escalated.helpRequests[0].escalationNote,'Please decide today');
assert.equal(helpRequestService.escalate(normal,'siddharth',normal.helpRequests[0].id,{}),normal,'unassigned person cannot escalate');

const report=updateService.createReport(normal,'rahul',{summary:'Kitchen work',entries:[{workItemId:'assigned-work',progress:80,status:'In Progress',note:'Checked island dimensions'}]});
assert.equal(report.dailyReports.length,1,'daily report remains historical');
assert.equal(report.workItems[0].progress,80,'daily report updates canonical progress');
assert.deepEqual(notificationChanges(normal,report),[{id:report.dailyReports[0].id,event:'daily_report_submitted'}],'only daily-report submission triggers admin notification');
assert.deepEqual(notificationChanges(normal,workItemService.setProgress(normal,'rahul','assigned-work',65)),[],'ordinary progress never triggers admin notification');
assert.deepEqual(notificationChanges(normal,escalated),[{id:normal.helpRequests[0].id,event:'help_escalated'}]);
const resolved=helpRequestService.resolve(normal,'manoj',normal.helpRequests[0].id,'Use option B and maintain 600mm clearance.');
assert.equal(resolved.helpRequests[0].status,'Resolved');
assert.equal(resolved.helpRequests[0].resolvedBy,'manoj');
assert.equal(resolved.helpRequests[0].resolutionNote,'Use option B and maintain 600mm clearance.');
assert.equal(resolved.workItems[0].status,'In Progress');
assert.equal(resolved.workItems[0].progress,40);
assert.equal(projectCardState(resolved,resolved.projects[0]),'normal','resolved help clears red attention');
const archivedOnly={...base,workItems:base.workItems.map(item=>({...item,archived:true}))};
assert.equal(projectCardState(archivedOnly,archivedOnly.projects[0]),'yellow','entirely archived project is yellow');
assert.deepEqual([normal,archivedOnly,base].map(current=>projectCardState(current,current.projects[0])).sort((a,b)=>projectCardOrder[a]-projectCardOrder[b]),['red','yellow','normal']);
assert.equal(projectHealth(resolved,resolved.projects[0],'2026-09-16'),'Delayed','overdue and help remain distinct');
assert.notEqual(workItemService.setProgress(resolved,'rahul','assigned-work',80),resolved);
assert.equal(helpRequestService.resolve(normal,'sudiksha',normal.helpRequests[0].id,'Unblock'),normal,'lead cannot impersonate admin resolution');
assert.equal(helpRequestService.resolve(normal,'kiran',normal.helpRequests[0].id,'Proceed').helpRequests[0].resolvedBy,'kiran','any linked admin can resolve');
const claimBase=fixture();
const unassigned={...claimBase,workItems:[{...claimBase.workItems[0],assigneeId:'sudiksha',assigneeIds:['sudiksha']}]};
assert.equal(updateService.createReport(unassigned,'rahul',{summary:'Not mine yet',entries:[{workItemId:'assigned-work',progress:50,status:'In Progress',note:'Worked'}]}),unassigned);
const claimed=workItemService.claim(unassigned,'rahul','assigned-work');
assert.deepEqual(claimed.workItems[0].assigneeIds,['sudiksha','rahul'],'self-claim is additive');
assert.equal(claimed.workItems[0].assigneeId,'sudiksha','original primary assignee is preserved');
assert.equal(claimed.workItems[0].cycleId,'old-cycle');
assert.equal(claimed.workItems[0].dueDate,'2026-09-15');
assert.equal(claimed.workItems[0].progress,40);
assert.notEqual(updateService.createReport(claimed,'rahul',{summary:'Claimed work',entries:[{workItemId:'assigned-work',progress:50,status:'In Progress',note:'Worked'}]}),claimed);
console.log('Workflow service tests passed.');
