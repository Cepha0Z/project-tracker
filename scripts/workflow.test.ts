import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { seedData } from '../src/data/seed';
import { connectedPeople, displayActivityText, displayNameFromEmail, jobRole, presentUser } from '../src/domain/people';
import { currentProjectStage, employeeActiveWork, projectCardOrder, projectCardState, projectHealth } from '../src/domain/selectors';
import { notificationChanges } from '../src/services/notificationEvents';
import { helpRequestService } from '../src/services/helpRequestService';
import { MAX_PROJECT_DELETION_OPERATIONS, projectDeletionImpact, projectService } from '../src/services/projectService';
import { workItemService } from '../src/services/workItemService';
import { updateService } from '../src/services/updateService';
import { permissions } from '../src/permissions/permissions';
import { OverviewProjectGroups, SimplePeople, SimpleProject } from '../src/components/phase4';
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
assert.equal(displayNameFromEmail({email:'cephajj@nebulousdesign.com',name:'CephaJJ'}),'CephaJJ');
assert.equal(jobRole(base.users[0]),'Principal Architect');
assert.equal(jobRole(base.users[2]),'Intermediate Architect');
assert.equal(jobRole({...base.users[2],name:'CephaJJ',title:'Junior Architect'}),'Junior Architect');
presentUser({...base.users[0],name:'Kiran Rao'});
assert.equal(displayActivityText('Sent direction to Kiran Rao'),'Sent direction to Kiran');
assert.equal(employeeActiveWork(base,'rahul').length,1,'unfinished overdue work remains active in an old cycle');
assert.equal(projectHealth(base,base.projects[0],'2026-09-16'),'Delayed');
assert.equal(projectCardState(base,base.projects[0],'2026-09-16'),'yellow');
const stageFixture={...base,projects:[{...base.projects[0],stages:base.projects[0].stages.map(stage=>({...stage,state:'next' as const}))}],workItems:[{...base.workItems[0],stage:'Brief',stageId:'Brief',dueDate:'2026-10-01'},{...base.workItems[0],id:'concept',stage:'Concept Design',stageId:'Concept Design',dueDate:'2026-10-01'}]};
assert.equal(currentProjectStage(stageFixture,stageFixture.projects[0]),'Brief','later work does not displace incomplete Brief');
const briefDone={...stageFixture,workItems:[{...stageFixture.workItems[0],status:'Completed' as const,progress:100},stageFixture.workItems[1]]};
assert.equal(currentProjectStage(briefDone,briefDone.projects[0]),'Concept Design');
const conceptDoneEarly={...stageFixture,workItems:[stageFixture.workItems[0],{...stageFixture.workItems[1],status:'Completed' as const,progress:100}]};
assert.equal(currentProjectStage(conceptDoneEarly,conceptDoneEarly.projects[0]),'Brief');
const allStagesDone={...base,workItems:[],projects:[{...base.projects[0],stages:base.projects[0].stages.map(stage=>({...stage,state:'done' as const}))}]};
assert.equal(currentProjectStage(allStagesDone,allStagesDone.projects[0]),null);
assert.equal(projectCardState(allStagesDone,allStagesDone.projects[0]),'black');
const green={...stageFixture,workItems:stageFixture.workItems.map(item=>({...item,dueDate:'2026-10-01'}))};
assert.equal(projectCardState(green,green.projects[0],'2026-09-16'),'green');
const peopleHtml=renderToStaticMarkup(createElement(SimplePeople,{data:base,user:base.users[0],mutate:()=>{}}));
assert.ok(peopleHtml.includes('JOB ROLE')&&!peopleHtml.includes('REPORTS TO'),'People shows only Name and Job Role');
assert.ok(peopleHtml.includes('Principal Architect')&&peopleHtml.includes('Intermediate Architect'));
const focusedHtml=renderToStaticMarkup(createElement(SimpleProject,{data:stageFixture,user:base.users[0],projectId:'villa-60',back:()=>{},mutate:()=>{}}));
assert.ok(focusedHtml.includes('● CURRENT')&&focusedHtml.includes('CURRENT STAGE</small><strong>Brief'),'Brief is visibly current');
assert.ok(!focusedHtml.includes('>Procurement<'),'future sections stay hidden by default');
const completeHtml=renderToStaticMarkup(createElement(SimpleProject,{data:allStagesDone,user:base.users[0],projectId:'villa-60',back:()=>{},mutate:()=>{}}));
assert.ok(completeHtml.includes('Completed ✓')&&!completeHtml.includes('● CURRENT'),'fully completed project has no current indicator');
const overviewHtml=renderToStaticMarkup(createElement(OverviewProjectGroups,{data:base,projects:base.projects,work:base.workItems,openWorkItem:()=>{}}));
assert.ok(overviewHtml.includes('overview-yellow')&&overviewHtml.includes('item-yellow'),'delayed project and unfinished overdue work carry yellow card classes');
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
assert.equal(projectHealth(normal,normal.projects[0],'2026-09-16'),'Need Attention','unresolved help requires admin attention without blocking work');
const laterHelp={...stageFixture,helpRequests:[{...normal.helpRequests[0],workItemId:'concept'}]};
assert.equal(currentProjectStage(laterHelp,laterHelp.projects[0]),'Brief');
assert.equal(projectCardState(laterHelp,laterHelp.projects[0]),'red','future section help colors project red');
const helpHtml=renderToStaticMarkup(createElement(OverviewProjectGroups,{data:laterHelp,projects:laterHelp.projects,work:laterHelp.workItems,openWorkItem:()=>{}}));
assert.ok(helpHtml.includes('overview-red')&&helpHtml.includes('item-red'),'unresolved help colors the project and its work row red');
const laterHtml=renderToStaticMarkup(createElement(SimpleProject,{data:laterHelp,user:base.users[0],projectId:'villa-60',back:()=>{},mutate:()=>{}}));
assert.ok(laterHtml.includes('later item needs help')&&laterHtml.includes('CURRENT STAGE</small><strong>Brief'),'later help is summarized without opening the future section');
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
assert.ok(Number.isFinite(Date.parse(resolved.helpRequests[0].resolvedAt||'')),'resolution records when it happened');
assert.equal(resolved.helpRequests[0].resolutionNote,'Use option B and maintain 600mm clearance.');
assert.equal(resolved.helpRequests[0].reason,normal.helpRequests[0].reason,'the original request remains in history');
assert.equal(resolved.helpRequests[0].createdAt,normal.helpRequests[0].createdAt);
assert.equal(resolved.workItems[0].status,'In Progress');
assert.equal(resolved.workItems[0].progress,40);
assert.equal(projectCardState(resolved,resolved.projects[0],'2026-09-16'),'yellow','resolved help reveals overdue state');
const archivedOnly={...base,workItems:base.workItems.map(item=>({...item,archived:true}))};
assert.equal(projectCardState(archivedOnly,archivedOnly.projects[0]),'green','archiving is not delay');
assert.deepEqual([allStagesDone,green,base,normal].map(current=>projectCardState(current,current.projects[0],'2026-09-16')).sort((a,b)=>projectCardOrder[a]-projectCardOrder[b]),['red','yellow','green','black']);
assert.equal(projectHealth(resolved,resolved.projects[0],'2026-09-16'),'Delayed','overdue and help remain distinct');
assert.notEqual(workItemService.setProgress(resolved,'rahul','assigned-work',80),resolved);
const requesterClosed=helpRequestService.resolve(normal,'rahul',normal.helpRequests[0].id,'');
assert.equal(requesterClosed.helpRequests[0].status,'Resolved','requester can close without a written note');
assert.equal(requesterClosed.helpRequests[0].resolvedBy,'rahul');
assert.deepEqual(notificationChanges(normal,requesterClosed),[],'self-closing a request must not invoke the admin-only resolution push endpoint');
assert.equal(projectCardState(requesterClosed,requesterClosed.projects[0],'2026-09-16'),'yellow','requester closure clears red attention');
assert.equal(requesterClosed.workItems[0].progress,40,'closing help does not change work progress');
assert.notEqual(workItemService.setProgress(requesterClosed,'rahul','assigned-work',60),requesterClosed,'work remains usable');
assert.equal(helpRequestService.resolve(requesterClosed,'rahul',normal.helpRequests[0].id,'Again'),requesterClosed,'resolved requests cannot be resolved twice');
assert.equal(helpRequestService.resolve(normal,'sudiksha',normal.helpRequests[0].id,'Handled').helpRequests[0].resolvedBy,'sudiksha','project lead can close a request');
assert.equal(helpRequestService.resolve(normal,'siddharth',normal.helpRequests[0].id,'No access'),normal,'unrelated staff cannot close it');
const teamVisible={...normal,projects:[{...normal.projects[0],teamIds:[...normal.projects[0].teamIds,'siddharth']}]};
assert.equal(helpRequestService.resolve(teamVisible,'siddharth',normal.helpRequests[0].id,'Handled').helpRequests[0].resolvedBy,'siddharth','authorized project team member can close it');
assert.equal(helpRequestService.resolve(escalated,'rahul',normal.helpRequests[0].id,'Handled').helpRequests[0].status,'Resolved','requester can close an escalation');
const previouslyAnswered={...normal,helpRequests:[{...normal.helpRequests[0],status:'Responded' as const,response:'Earlier direction'}]};
const answeredClosed=helpRequestService.resolve(previouslyAnswered,'rahul',normal.helpRequests[0].id,'Resolved verbally');
assert.equal(answeredClosed.helpRequests[0].response,'Earlier direction','earlier response stays in history');
assert.equal(answeredClosed.helpRequests[0].resolutionNote,'Resolved verbally');
const noteFreeReport=updateService.createReport(normal,'rahul',{summary:'',entries:[{workItemId:'assigned-work',progress:80,status:'In Progress',note:''}]});
assert.equal(noteFreeReport.updates[0].text,'','daily report note may remain blank');
assert.equal(noteFreeReport.updates[0].previousProgress,normal.workItems[0].progress,'note-free report preserves the progress history');
assert.deepEqual(notificationChanges(normal,noteFreeReport),[{id:noteFreeReport.dailyReports[0].id,event:'daily_report_submitted'}],'note-free submission still notifies admins');
const blockedHelp={...normal,workItems:[{...normal.workItems[0],status:'Blocked' as const,blockedReason:'Waiting for input'}],helpRequests:[{...normal.helpRequests[0],kind:'blocked' as const}]};
const blockedClosed=helpRequestService.resolve(blockedHelp,'rahul',normal.helpRequests[0].id,'Clarified');
assert.equal(blockedClosed.workItems[0].status,'In Progress','closing a blocked request reopens work');
assert.equal(blockedClosed.workItems[0].progress,40);
assert.equal(blockedClosed.workItems[0].unblockedByHelpId,normal.helpRequests[0].id,'unblock records the linked request');
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

const deletionBase=fixture();
const otherProject={...deletionBase.projects[0],id:'other-project',name:'Other Project'};
const otherItem={...deletionBase.workItems[0],id:'other-work',projectId:'other-project'};
const deletionData:AppData={...deletionBase,
  projects:[...deletionBase.projects,otherProject],workItems:[...deletionBase.workItems,otherItem],
  updates:[
    {id:'update-v',projectId:'villa-60',workItemId:'assigned-work',userId:'rahul',text:'Villa',progress:40,minutes:0,status:'In Progress',createdAt:'2026-09-16T09:00:00Z'},
    {id:'update-o',projectId:'other-project',workItemId:'other-work',userId:'rahul',text:'Other',progress:40,minutes:0,status:'In Progress',createdAt:'2026-09-16T09:00:00Z'},
  ],
  helpRequests:normal.helpRequests,
  activities:[{id:'activity-v',projectId:'villa-60',actorId:'rahul',text:'Villa',createdAt:'2026-09-16T09:00:00Z'},
    {id:'activity-o',projectId:'other-project',actorId:'rahul',text:'Other',createdAt:'2026-09-16T09:00:00Z'}],
  cycles:structuredClone(seedData.cycles.filter(cycle=>cycle.projectId==='villa-60').slice(0,1)),
  timeEntries:[{id:'time-v',projectId:'villa-60',workItemId:'assigned-work',userId:'rahul',date:'2026-09-16',minutes:30},
    {id:'time-o',projectId:'other-project',workItemId:'other-work',userId:'rahul',date:'2026-09-16',minutes:20}],
  dailyReports:[
    {id:'report-mixed',userId:'rahul',date:'2026-09-16',summary:'Both',createdAt:'2026-09-16T09:00:00Z',updateIds:['update-v','update-o'],items:[
      {workItemId:'assigned-work',previousProgress:20,newProgress:40,progressDelta:20,status:'In Progress'},
      {workItemId:'other-work',previousProgress:20,newProgress:40,progressDelta:20,status:'In Progress'}]},
    {id:'report-v',userId:'rahul',date:'2026-09-16',summary:'Villa',createdAt:'2026-09-16T09:00:00Z',updateIds:['update-v']},
  ],
};
assert.equal(permissions.canDeleteProject(deletionData.users.find(user=>user.id==='manoj')!),true);
assert.equal(permissions.canDeleteProject(deletionData.users.find(user=>user.id==='sudiksha')!),false);
assert.equal(projectService.deleteProject(deletionData,'sudiksha','villa-60'),deletionData,'a project lead cannot delete a project');
assert.equal(projectService.deleteProject(deletionData,'rahul','other-project'),deletionData,'an employee cannot delete a project');
assert.equal(projectDeletionImpact(deletionData,'villa-60').reportsUpdated,1);
assert.equal(projectDeletionImpact(deletionData,'villa-60').reportsDeleted,1);
const removed=projectService.deleteProject(deletionData,'manoj','villa-60');
assert.deepEqual(removed.projects.map(project=>project.id),['other-project']);
for(const group of ['workItems','updates','helpRequests','activities','cycles','timeEntries'] as const)
  assert.ok(removed[group].every(entity=>entity.projectId!=='villa-60'),`${group} has no orphaned project records`);
assert.deepEqual(removed.dailyReports?.map(report=>report.id),['report-mixed']);
assert.deepEqual(removed.dailyReports?.[0].updateIds,['update-o'],'a mixed report retains unrelated history');
assert.deepEqual(removed.dailyReports?.[0].items?.map(item=>item.workItemId),['other-work']);
assert.equal(removed.workItems[0].id,'other-work');
const oversized={...deletionData,activities:[...deletionData.activities,...Array.from({length:MAX_PROJECT_DELETION_OPERATIONS},(_,index)=>({id:`extra-${index}`,projectId:'villa-60',actorId:'rahul',text:'History',createdAt:'2026-09-16T09:00:00Z'}))]};
assert.equal(projectService.deleteProject(oversized,'manoj','villa-60'),oversized,'oversized projects require assisted deletion rather than a partial batch');
console.log('Workflow service tests passed.');
