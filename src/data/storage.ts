import { seedData } from './seed';
import type { AppData } from '../types';

const STORAGE_KEY = 'studio-project-tracker-v1';

export const localStore = {
  load(): AppData {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return migrate(value ? JSON.parse(value) : structuredClone(seedData));
    } catch { return structuredClone(seedData); }
  },
  save(data: AppData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); },
  reset(): AppData {
    localStorage.removeItem(STORAGE_KEY);
    return structuredClone(seedData);
  },
};

function migrate(input: Partial<AppData>): AppData {
  const data = {...structuredClone(seedData), ...input} as AppData;
  data.dailyReports ||= [];
  data.meetings ||= [];
  data.cycles ||= [];
  data.timeEntries ||= [];
  for (const project of data.projects) {
    let cycle = data.cycles.find(c=>c.id===project.activeCycleId) || data.cycles.find(c=>c.projectId===project.id&&c.status==='Active');
    if (!cycle) {
      cycle = {id:`${project.id}-cycle-1`,projectId:project.id,startDate:'2026-09-14',endDate:'2026-09-18',direction:project.cycle.direction,status:'Active',summary:'',nextPlan:'',createdBy:project.principalId,createdAt:'2026-09-14T09:00:00'};
      data.cycles.push(cycle);
    }
    project.activeCycleId=cycle.id;
    data.workItems.filter(w=>w.projectId===project.id&&!w.cycleId).forEach(w=>w.cycleId=cycle!.id);
    data.workItems.filter(w=>w.projectId===project.id).forEach(w=>{
      w.stageId ||= w.stage;
      w.assigneeIds ||= [w.assigneeId];
      w.scopeNotes ||= w.notes||'';
      w.subItems ||= [];
      w.required ??= true;
      w.createdBy ||= project.leadId;
      w.createdAt ||= '2026-08-24T09:00:00';
      w.updatedAt ||= w.createdAt;
      w.activeElapsedMinutes ??= Math.round((w.hours||0)*60);
      if(w.status==='In Progress'&&!w.startedAt)w.startedAt=w.updatedAt;
      if(w.status==='Completed'&&!w.completedAt)w.completedAt=w.updatedAt;
    });
    const projectCycles=data.cycles.filter(c=>c.projectId===project.id).sort((a,b)=>a.startDate.localeCompare(b.startDate));
    projectCycles.forEach((entry,index)=>{
      entry.deliverableIds ||= data.workItems.filter(w=>w.projectId===project.id&&w.cycleId===entry.id&&!w.archived).map(w=>w.id);
      entry.number ||= index+1;
    });
    data.updates.filter(u=>u.projectId===project.id&&!u.cycleId).forEach(u=>u.cycleId=cycle!.id);
    data.helpRequests.filter(h=>h.projectId===project.id).forEach(h=>{
      h.kind ||= data.workItems.find(w=>w.id===h.workItemId)?.status==='Blocked'?'blocked':'question';
      if(h.level==='principal'){
        h.assignedTo=project.principalId;
        h.escalatedBy ||= project.leadId;
        h.escalatedAt ||= h.createdAt;
      }
    });
  }
  if (!data.timeEntries.length) data.timeEntries=data.updates.filter(u=>u.minutes>0).map(u=>({id:`time-${u.id}`,projectId:u.projectId,workItemId:u.workItemId,userId:u.userId,cycleId:u.cycleId,date:u.createdAt,minutes:u.minutes,updateId:u.id}));
  if((data.schemaVersion||0)<3){
    const knownOld=new Set(['w1','w2','w3','w4','w5','w6','w7','w8']);
    data.workItems.forEach(w=>{if(knownOld.has(w.id))w.archived=true});
    const register=structuredClone(seedData.workItems.filter(w=>w.projectId==='villa-60'&&w.id.startsWith('v60-')));
    const existing=new Set(data.workItems.map(w=>w.id));
    data.workItems.push(...register.filter(w=>!existing.has(w.id)));
    const active=data.cycles.find(c=>c.id==='villa-60-cycle-1');
    if(active)active.deliverableIds=register.filter(w=>['v60-d08','v60-d09','v60-d11','v60-d12','v60-d13','v60-d14','v60-d15','v60-d16'].includes(w.id)).map(w=>w.id);
    const remap:Record<string,string>={w5:'v60-d16',w6:'v60-d14',w7:'v60-d09',w8:'v60-d15'};
    data.updates.forEach(u=>{u.workItemId=remap[u.workItemId]||u.workItemId});
    data.timeEntries.forEach(t=>{t.workItemId=remap[t.workItemId]||t.workItemId});
    data.helpRequests.forEach(h=>{h.workItemId=remap[h.workItemId]||h.workItemId});
    data.schemaVersion=3;
  }
  if((data.schemaVersion||0)<4){
    data.projects=data.projects.filter(p=>p.id==='villa-60');
    data.cycles=data.cycles.filter(c=>c.projectId==='villa-60');
    const sourceCycle=seedData.cycles.find(c=>c.id==='villa-60-cycle-1'),villaCycle=data.cycles.find(c=>c.id==='villa-60-cycle-1');
    if(sourceCycle&&villaCycle)villaCycle.deliverableIds=[...(sourceCycle.deliverableIds||[])];
    const realRegister=structuredClone(seedData.workItems.filter(w=>w.id.startsWith('v60-d')));
    data.workItems=[...realRegister,...data.workItems.filter(w=>w.projectId==='villa-60'&&!w.id.startsWith('v60-d')&&!w.id.match(/^w[1-8]$/))];
    data.updates=data.updates.filter(u=>u.projectId==='villa-60'&&!['u1','u2'].includes(u.id));
    data.timeEntries=data.timeEntries.filter(t=>t.projectId==='villa-60'&&!['t1','t2'].includes(t.id));
    data.helpRequests=data.helpRequests.filter(h=>h.projectId==='villa-60'&&h.id!=='h1');
    data.activities=data.activities.filter(a=>a.projectId==='villa-60'&&!['a1','a2','a3','a4'].includes(a.id));
    data.dailyReports=(data.dailyReports||[]).filter(r=>r.updateIds.some(id=>data.updates.some(u=>u.id===id)));
    const reportsTo:Record<string,string|undefined>={kiran:undefined,manoj:undefined,sudiksha:'kiran',rahul:'sudiksha',siddharth:'sudiksha'};
    data.users=data.users.map(u=>({...u,reportsToId:u.reportsToId??reportsTo[u.id],loginEnabled:u.loginEnabled??true}));
    data.schemaVersion=4;
  }
  if((data.schemaVersion||0)<5){
    data.workItems=data.workItems.map(w=>w.id==='v60-d02'&&w.progress===0?{...w,startedAt:undefined,activeElapsedMinutes:0}:w);
    data.schemaVersion=5;
  }
  if((data.schemaVersion||0)<6){
    const sourceItems=new Map(seedData.workItems.map(item=>[item.id,item]));
    data.projects=data.projects.map(project=>({...project,location:project.location||(project.id==='villa-60'?'Bangalore':'')}));
    data.workItems=data.workItems.map(item=>{
      const source=sourceItems.get(item.id);
      const repaired=source?{
        ...item,
        name:item.name||source.name,
        dueDate:/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate||'')?item.dueDate:source.dueDate,
        dueLabel:item.dueLabel||source.dueLabel,
        scopeNotes:item.scopeNotes??source.scopeNotes,
        notes:item.notes??source.notes,
        assigneeId:item.assigneeId||source.assigneeId,
        assigneeIds:item.assigneeIds?.length?item.assigneeIds:source.assigneeIds,
        stage:item.stage||source.stage,
        stageId:item.stageId||source.stageId,
      }:item;
      return repaired;
    });
    data.schemaVersion=6;
  }
  return data;
}
