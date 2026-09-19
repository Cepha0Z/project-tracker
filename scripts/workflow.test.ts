import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { seedData } from '../src/data/seed';
import { connectedPeople, displayActivityText, displayNameFromEmail, enabledAccountFlag, jobRole, presentUser } from '../src/domain/people';
import { PROJECT_STAGE_ORDER, currentProjectStage, employeeActiveWork, projectCardOrder, projectCardState, projectHealth, workItemDaysBehind } from '../src/domain/selectors';
import { notificationChanges } from '../src/services/notificationEvents';
import { helpRequestService } from '../src/services/helpRequestService';
import { MAX_PROJECT_DELETION_OPERATIONS, projectDeletionImpact, projectService } from '../src/services/projectService';
import { workItemService } from '../src/services/workItemService';
import { updateService } from '../src/services/updateService';
import { meetingService } from '../src/services/meetingService';
import { permissions } from '../src/permissions/permissions';
import { EmployeeWorkspace, NewProject, OverviewProjectGroups, ReportModal, SimplePeople, SimpleProject, SimpleReports } from '../src/components/phase4';
import { MeetingsPage } from '../src/components/MeetingsPage';
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
assert.equal(enabledAccountFlag(true),true);
assert.equal(enabledAccountFlag('true'),true);
assert.equal(enabledAccountFlag(false),false);
assert.equal(enabledAccountFlag('false'),false);
assert.equal(presentUser({id:'normalized',name:'Normalized',initials:'N',title:'Architect',access:'employee',tone:'#000',loginEnabled:'true'}).loginEnabled,true);
const jeevan={id:'jeevan',name:'Jeevan',initials:'J',title:'Architect',access:'employee' as const,tone:'#53675c',authUid:'firebase-jeevan',active:true,loginEnabled:true};
const mixedAccountFlags={...base,users:[...base.users.map(person=>person.id==='rahul'?{...person,loginEnabled:'true' as const}:person),jeevan]};
assert.ok(connectedPeople(mixedAccountFlags).some(person=>person.id==='jeevan'),'Boolean true accounts are included alongside string true accounts');
const teamPickerHtml=renderToStaticMarkup(createElement(NewProject,{data:mixedAccountFlags,user:base.users.find(person=>person.id==='manoj')!,mutate:()=>{},close:()=>{}}));
assert.ok(teamPickerHtml.includes('Jeevan'),'Jeevan appears in the project team-member picker');
const jeevanOnTeam=projectService.addTeamMember(mixedAccountFlags,'sudiksha','villa-60','jeevan');
assert.ok(jeevanOnTeam.projects[0].teamIds.includes('jeevan'),'Jeevan can be added to a project team');
const jeevanProjectHtml=renderToStaticMarkup(createElement(SimpleProject,{data:jeevanOnTeam,user:jeevan,projectId:'villa-60',initialWorkItemId:'assigned-work',openDetailOnEntry:false,back:()=>{},mutate:()=>{}}));
assert.ok(jeevanProjectHtml.includes('Assign to myself'),'Jeevan sees Assign to myself for available project work');
const jeevanClaimed=workItemService.claim(jeevanOnTeam,'jeevan','assigned-work');
assert.ok(jeevanClaimed.workItems[0].assigneeIds?.includes('jeevan'),'Jeevan can assign project work to himself');
const jeevanClaimedHtml=renderToStaticMarkup(createElement(SimpleProject,{data:jeevanClaimed,user:jeevan,projectId:'villa-60',initialWorkItemId:'assigned-work',openDetailOnEntry:false,back:()=>{},mutate:()=>{}}));
assert.ok(jeevanClaimedHtml.includes('Need help'),'Jeevan sees Need Help after self-assignment');
const jeevanHelp=helpRequestService.create(jeevanClaimed,'jeevan',{workItemId:'assigned-work',reason:'Need guidance'});
assert.equal(jeevanHelp.helpRequests[0]?.raisedBy,'jeevan','Jeevan can request help after self-assignment');
const generalMeeting=meetingService.create(base,'rahul',{date:'2026-09-18',title:' Studio coordination ',projectId:null,attendeeIds:['rahul','sudiksha','rahul'],notes:'Discussed staffing.'});
assert.equal(generalMeeting.meetings?.[0].title,'Studio coordination');
assert.deepEqual(generalMeeting.meetings?.[0].attendeeIds,['rahul','sudiksha']);
const projectMeeting=meetingService.create(generalMeeting,'rahul',{date:'2026-09-17',title:'Kitchen review',projectId:'villa-60',attendeeIds:['rahul'],notes:'Agreed revised layout.'});
assert.equal(projectMeeting.meetings?.length,2);
assert.equal(meetingService.create(base,'siddharth',{date:'2026-09-18',title:'Not a project member',projectId:'villa-60',attendeeIds:[],notes:''}),base);
assert.equal(meetingService.create(base,'rahul',{date:'2026-09-18',title:'Unlinked attendee',projectId:null,attendeeIds:['siddharth'],notes:''}),base);
assert.equal(meetingService.create(base,'rahul',{date:'2026-09-18',title:'  ',projectId:null,attendeeIds:[],notes:''}),base);
assert.equal(meetingService.create(base,'rahul',{date:'2026-02-31',title:'Invalid date',projectId:null,attendeeIds:[],notes:''}),base);
const outsider=base.users.find(person=>person.id==='siddharth')!;
assert.deepEqual(meetingService.visible(projectMeeting,outsider.id).map(meeting=>meeting.title),['Studio coordination'],'general meetings are studio-wide, but project meetings require access');
assert.deepEqual(meetingService.visible(projectMeeting,'rahul').map(meeting=>meeting.title),['Studio coordination','Kitchen review']);
assert.equal(meetingService.visible(projectMeeting,'manoj').length,2,'admins see all meetings');
const meetingListHtml=renderToStaticMarkup(createElement(MeetingsPage,{data:projectMeeting,user:base.users.find(person=>person.id==='rahul')!,mutate:()=>{}}));
assert.ok(meetingListHtml.includes('New Meeting')&&meetingListHtml.includes('Kitchen review')&&meetingListHtml.includes('General / No Project')&&meetingListHtml.includes('Sudiksha'));
const outsiderMeetingsHtml=renderToStaticMarkup(createElement(MeetingsPage,{data:projectMeeting,user:outsider,mutate:()=>{}}));
assert.ok(!outsiderMeetingsHtml.includes('Kitchen review'));
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
assert.ok(!overviewHtml.includes('type="range"')&&!overviewHtml.includes('Start work')&&!overviewHtml.includes('Need help')&&!overviewHtml.includes('>Resolve<')&&!overviewHtml.includes('>Escalate<'),'Home project rows contain no work controls');
assert.ok(overviewHtml.includes('aria-expanded="true"'),'Home project groups are expanded initially');
const employeeOverviewData={...base,projects:[...base.projects,{...base.projects[0],id:'test-2',name:'Test 2',teamIds:['sudiksha']}],workItems:[...base.workItems,{...base.workItems[0],id:'unrelated-work',projectId:'test-2',name:'Unrelated deliverable',assigneeId:'sudiksha',assigneeIds:['sudiksha'],status:'Blocked' as const}]};
const employeeHomeHtml=renderToStaticMarkup(createElement(EmployeeWorkspace,{data:employeeOverviewData,user:base.users.find(user=>user.id==='rahul')!,openWorkItem:()=>{},mutate:()=>{}}));
const myWorkHtml=employeeHomeHtml.slice(employeeHomeHtml.indexOf('employee-home-section employee-my-work'),employeeHomeHtml.indexOf('employee-home-section employee-all-projects'));
const allProjectsHtml=employeeHomeHtml.slice(employeeHomeHtml.indexOf('employee-home-section employee-all-projects'));
assert.ok(myWorkHtml.includes('Villa 60')&&!myWorkHtml.includes('Test 2')&&!myWorkHtml.includes('Unrelated deliverable'),'My Work includes only projects and items assigned to the employee, even when another project is red');
assert.ok(allProjectsHtml.includes('Villa 60')&&allProjectsHtml.includes('Test 2')&&allProjectsHtml.includes('Unrelated deliverable'),'All Projects includes the same company projects regardless of assignment');
assert.ok(!myWorkHtml.includes('type="range"')&&!allProjectsHtml.includes('type="range"')&&!myWorkHtml.includes('Start work')&&!allProjectsHtml.includes('Start work')&&!myWorkHtml.includes('Need help')&&!allProjectsHtml.includes('Need help'),'both Employee Home project sections remain read-only');
const myWorkPageHtml=renderToStaticMarkup(createElement(EmployeeWorkspace,{data:employeeOverviewData,user:base.users.find(user=>user.id==='rahul')!,openWorkItem:()=>{},mutate:()=>{},showAll:true}));
assert.ok(!myWorkPageHtml.includes('All Projects')&&!myWorkPageHtml.includes('Test 2'),'the existing My Work navigation stays assignment-only');
const noAssignmentHtml=renderToStaticMarkup(createElement(EmployeeWorkspace,{data:employeeOverviewData,user:base.users.find(user=>user.id==='siddharth')!,openWorkItem:()=>{},mutate:()=>{}}));
assert.ok(noAssignmentHtml.includes('No work assigned.')&&noAssignmentHtml.slice(noAssignmentHtml.indexOf('employee-home-section employee-all-projects')).includes('Test 2'),'an employee with no assignments still sees company projects only in All Projects');
const overviewProjectOnly=renderToStaticMarkup(createElement(SimpleProject,{data:base,user:base.users[0],projectId:'villa-60',initialWorkItemId:'assigned-work',openDetailOnEntry:false,back:()=>{},mutate:()=>{}}));
assert.ok(overviewProjectOnly.includes('DOCUMENTATION')&&!overviewProjectOnly.includes('work-detail-simple'),'normal Home navigation selects the project section without opening editable detail');
const explicitDetail=renderToStaticMarkup(createElement(SimpleProject,{data:base,user:base.users[0],projectId:'villa-60',initialWorkItemId:'assigned-work',openDetailOnEntry:true,back:()=>{},mutate:()=>{}}));
assert.ok(explicitDetail.includes('work-detail-simple'),'explicit work-item navigation retains the detail view');
const optionalOverdue={...base,workItems:base.workItems.map(item=>({...item,required:false}))};
assert.equal(projectCardState(optionalOverdue,optionalOverdue.projects[0],'2026-09-16'),'yellow','any unfinished overdue deliverable colors its project yellow');
assert.equal(projectService.removeTeamMember(base,'sudiksha','villa-60','rahul'),base,'cannot remove someone with active assigned work');
assert.equal(projectService.addTeamMember(base,'sudiksha','villa-60','siddharth'),base,'unlinked prototype users cannot be added');
assert.equal(helpRequestService.create(base,'siddharth',{workItemId:'assigned-work',reason:'Not mine'}),base,'unassigned employee cannot raise help');
const finished=workItemService.setProgress(base,'rahul','assigned-work',100);
assert.equal(finished.workItems[0].status,'Completed');
assert.equal(projectService.removeTeamMember(finished,'sudiksha','villa-60','rahul').projects[0].teamIds.includes('rahul'),false,'completed history does not trap someone on a team');

const created=projectService.create(base,'manoj',{name:'Another Residence',leadId:'sudiksha',principalId:'manoj',teamIds:['rahul']});
assert.deepEqual(created.projects.at(-1)?.teamIds,['rahul','sudiksha','manoj']);
const newProject=created.projects.at(-1)!;
assert.deepEqual(newProject.stages.map(section=>section.name),PROJECT_STAGE_ORDER,'new projects persist all seven sections in order');
assert.deepEqual(newProject.stages.map(section=>section.state),['current','next','next','next','next','next','next']);
assert.equal(currentProjectStage(created,newProject),'Brief');
const newProjectHtml=renderToStaticMarkup(createElement(SimpleProject,{data:created,user:base.users.find(person=>person.id==='manoj')!,projectId:newProject.id,back:()=>{},mutate:()=>{}}));
assert.ok(newProjectHtml.includes('aria-expanded="false">Later sections'),'new projects can reveal future sections before later work exists');
assert.ok(newProjectHtml.includes('● CURRENT')&&!newProjectHtml.includes('>Procurement<'),'the current section remains Brief until completed');
const futureWork=workItemService.create(created,'sudiksha',{projectId:newProject.id,name:'Production drawing',assigneeId:'rahul',stage:'Production',dueDate:'2026-10-01',notes:''});
assert.equal(futureWork.workItems.at(-1)?.stageId,'Production','new deliverables retain the chosen section');
assert.equal(currentProjectStage(futureWork,newProject),'Brief','future deliverables do not advance the current section');
const memberWork=workItemService.create(created,'rahul',{projectId:newProject.id,name:'Member contribution',assigneeId:'rahul',stage:'Concept Design',dueDate:'2026-10-02',notes:''});
assert.equal(memberWork.workItems.at(-1)?.createdBy,'rahul','a project member can add a deliverable');
assert.equal(workItemService.create(created,'siddharth',{projectId:newProject.id,name:'Unauthorized',assigneeId:'rahul',stage:'Brief',dueDate:'2026-10-01',notes:''}),created,'a nonmember cannot create project work');
assert.equal(workItemService.create(created,'rahul',{projectId:newProject.id,name:'Invalid stage',assigneeId:'rahul',stage:'Unknown',dueDate:'2026-10-01',notes:''}),created);
const customSection=projectService.addSection(created,'rahul',newProject.id,'Interior Design');
assert.deepEqual(customSection.projects.at(-1)?.stages.map(section=>section.name),[...PROJECT_STAGE_ORDER,'Interior Design']);
assert.equal(projectService.addSection(created,'siddharth',newProject.id,'Unauthorized'),created);
assert.deepEqual(projectService.create(customSection,'manoj',{name:'Other Residence',leadId:'sudiksha',principalId:'manoj',teamIds:['rahul']}).projects.at(-1)?.stages.map(section=>section.name),PROJECT_STAGE_ORDER,'custom sections do not change the seven-section template');
const renamed=projectService.renameSection(memberWork,'rahul',newProject.id,'Concept Design','Early Design');
assert.equal(renamed.workItems.at(-1)?.stageId,'Early Design','rename preserves linked deliverables');
assert.equal(renamed.workItems.at(-1)?.stage,'Early Design');
assert.equal(renamed.projects.at(-1)?.stages[1].name,'Early Design');
assert.equal(currentProjectStage(renamed,renamed.projects.at(-1)!),'Brief','later work does not advance the current stage');
assert.equal(projectService.deleteSection(renamed,'rahul',newProject.id,'Early Design'),renamed,'populated sections cannot be deleted');
const moved=workItemService.moveToSection(renamed,'rahul',renamed.workItems.at(-1)!.id,'Brief');
assert.equal(moved.workItems.at(-1)?.stageId,'Brief');
assert.equal(projectService.deleteSection(moved,'rahul',newProject.id,'Early Design').projects.at(-1)?.stages.some(section=>section.name==='Early Design'),false,'moving work allows safe section deletion');
assert.equal(workItemService.moveToSection(renamed,'siddharth',renamed.workItems.at(-1)!.id,'Brief'),renamed);
const archivedRenamed={...renamed,workItems:renamed.workItems.map(item=>item.projectId===newProject.id?{...item,archived:true}:item)};
assert.equal(projectService.deleteSection(archivedRenamed,'rahul',newProject.id,'Early Design'),archivedRenamed,'archived deliverables also prevent orphaning');
const deletedSection=projectService.deleteSection(customSection,'rahul',newProject.id,'Interior Design');
assert.deepEqual(deletedSection.projects.at(-1)?.stages.map(section=>section.name),PROJECT_STAGE_ORDER,'an empty custom section can be removed');
assert.equal(projectService.deleteSection(customSection,'siddharth',newProject.id,'Interior Design'),customSection,'nonmembers cannot edit sections');
const sectionHtml=renderToStaticMarkup(createElement(SimpleProject,{data:customSection,user:base.users.find(person=>person.id==='rahul')!,projectId:newProject.id,back:()=>{},mutate:()=>{}}));
assert.ok(sectionHtml.includes('Edit project sections')&&sectionHtml.includes('Add deliverable'),'members see section editing and deliverable creation');
assert.equal(workItemDaysBehind({...base.workItems[0],dueDate:'2026-09-14'},'2026-09-17'),3);
assert.equal(workItemDaysBehind({...base.workItems[0],dueDate:'2026-08-31'},'2026-09-02'),2,'date-only arithmetic survives month boundaries');
assert.equal(workItemDaysBehind({...base.workItems[0],dueDate:'2026-09-17'},'2026-09-17'),0);
assert.equal(workItemDaysBehind({...base.workItems[0],dueDate:'2026-09-14',status:'Completed'},'2026-09-17'),0);
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
const projectHelpHtml=renderToStaticMarkup(createElement(SimpleProject,{data:normal,user:base.users[0],projectId:'villa-60',back:()=>{},mutate:()=>{}}));
assert.ok(projectHelpHtml.includes('resolve-help-direct')&&projectHelpHtml.includes('Open details'),'admin project card offers direct help resolution without removing access to work details');
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
const customOnly=updateService.createReport(base,'rahul',{summary:'',customWork:'Visited the site for measurements.',entries:[]});
assert.equal(customOnly.dailyReports?.at(0)?.customWork,'Visited the site for measurements.');
assert.equal(customOnly.dailyReports?.at(0)?.updateIds.length,0);
assert.equal(customOnly.updates.length,0,'custom work does not create a fake deliverable update');
assert.deepEqual(notificationChanges(base,customOnly),[{id:customOnly.dailyReports![0].id,event:'daily_report_submitted'}]);
const both=updateService.createReport(base,'rahul',{summary:'Kitchen work',customWork:'Contractor coordination',entries:[{workItemId:'assigned-work',progress:60,status:'In Progress',note:'Dimensions'}]});
assert.equal(both.dailyReports?.at(0)?.customWork,'Contractor coordination');
assert.equal(both.dailyReports?.at(0)?.updateIds.length,1);
assert.equal(both.workItems[0].progress,60);
assert.equal(updateService.createReport(base,'rahul',{summary:'',customWork:'  ',entries:[]}),base,'empty reports are rejected');
const customHistory=renderToStaticMarkup(createElement(SimpleReports,{data:customOnly,user:base.users.find(person=>person.id==='manoj')!,focusReportId:customOnly.dailyReports![0].id}));
assert.ok(customHistory.includes('Other work')&&customHistory.includes('Visited the site for measurements.'));
const ownHistory=renderToStaticMarkup(createElement(SimpleReports,{data:customOnly,user:base.users.find(person=>person.id==='rahul')!,focusReportId:customOnly.dailyReports![0].id}));
assert.ok(ownHistory.includes('Visited the site for measurements.'),'the author can see custom-work history');
const emptyReportForm=renderToStaticMarkup(createElement(ReportModal,{data:{...base,workItems:[]},user:base.users.find(person=>person.id==='rahul')!,mutate:()=>{},close:()=>{}}));
assert.ok(emptyReportForm.includes('Other work today')&&emptyReportForm.includes('Submit report')&&!emptyReportForm.includes('disabled=""'), 'custom-only reporting remains available without assigned deliverables');
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
  meetings:[{id:'meeting-v',date:'2026-09-18',title:'Villa review',projectId:'villa-60',attendeeIds:['rahul'],notes:'Details',createdBy:'rahul',createdAt:'2026-09-18T09:00:00Z'},
    {id:'meeting-o',date:'2026-09-18',title:'Other review',projectId:'other-project',attendeeIds:['rahul'],notes:'Details',createdBy:'rahul',createdAt:'2026-09-18T09:00:00Z'}],
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
assert.equal(projectDeletionImpact(deletionData,'villa-60').meetings,1);
const removed=projectService.deleteProject(deletionData,'manoj','villa-60');
assert.deepEqual(removed.projects.map(project=>project.id),['other-project']);
assert.deepEqual(removed.meetings?.map(meeting=>meeting.id),['meeting-o'],'project deletion accounts for its meeting records');
for(const group of ['workItems','updates','helpRequests','activities','cycles','timeEntries'] as const)
  assert.ok(removed[group].every(entity=>entity.projectId!=='villa-60'),`${group} has no orphaned project records`);
assert.deepEqual(removed.dailyReports?.map(report=>report.id),['report-mixed']);
assert.deepEqual(removed.dailyReports?.[0].updateIds,['update-o'],'a mixed report retains unrelated history');
assert.deepEqual(removed.dailyReports?.[0].items?.map(item=>item.workItemId),['other-work']);
assert.equal(removed.workItems[0].id,'other-work');
const customWithProjectHistory={...deletionData,dailyReports:[{...deletionData.dailyReports![1],customWork:'Visited another site.'}]};
const customAfterRemoval=projectService.deleteProject(customWithProjectHistory,'manoj','villa-60');
assert.equal(customAfterRemoval.dailyReports?.[0]?.customWork,'Visited another site.','project deletion preserves unrelated custom-work history');
assert.deepEqual(customAfterRemoval.dailyReports?.[0]?.updateIds,[]);
const oversized={...deletionData,activities:[...deletionData.activities,...Array.from({length:MAX_PROJECT_DELETION_OPERATIONS},(_,index)=>({id:`extra-${index}`,projectId:'villa-60',actorId:'rahul',text:'History',createdAt:'2026-09-16T09:00:00Z'}))]};
assert.equal(projectService.deleteProject(oversized,'manoj','villa-60'),oversized,'oversized projects require assisted deletion rather than a partial batch');
console.log('Workflow service tests passed.');
