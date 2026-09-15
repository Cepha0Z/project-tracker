import type { AppData } from '../types';

export const seedData: AppData = {
  users: [
    { id: 'kiran', name: 'Kiran Rao', initials: 'KR', title: 'Principal', access: 'admin', tone: '#20372f', loginEnabled:true },
    { id: 'manoj', name: 'Manoj Shah', initials: 'MS', title: 'Principal', access: 'admin', tone: '#46566b', loginEnabled:true },
    { id: 'sudiksha', name: 'Sudiksha Menon', initials: 'SM', title: 'Intermediate Architect', access: 'employee', tone: '#855d43', reportsToId:'kiran', loginEnabled:true },
    { id: 'rahul', name: 'Rahul Desai', initials: 'RD', title: 'Intermediate Architect', access: 'employee', tone: '#71654b', reportsToId:'sudiksha', loginEnabled:true },
    { id: 'siddharth', name: 'Siddharth Jain', initials: 'SJ', title: 'Junior Architect', access: 'employee', tone: '#5f6b61', reportsToId:'sudiksha', loginEnabled:true },
  ],
  projects: [
    {
      id: 'villa-60', name: 'Villa 60', location: 'Bangalore', code: 'V60', description: 'A warm, contemporary residential villa designed around a shaded internal courtyard.', focus: 'Documentation and consultant coordination', principalId: 'kiran', leadId: 'sudiksha', teamIds: ['sudiksha', 'rahul', 'siddharth'], currentStage: 'Documentation', deadline: '2026-09-30', deadlineLabel: '30 Sep', health: 'Needs Attention',
      stages: [{name:'Brief',state:'done'},{name:'Concept Design',state:'done'},{name:'Design Development',state:'done'},{name:'Documentation',state:'current'},{name:'Production',state:'next'},{name:'Procurement',state:'next'},{name:'Site Stage',state:'next'}],
      cycle: { label: '14–18 Sep', direction: 'Complete the ground and first floor documentation package and prepare coordinated drawings for internal review.', deadline: 'Friday, 18 September' },
      notes: ['Client has approved the revised stair position.', 'Services coordination must be closed before the Friday review.'],
    },
    {
      id: 'kgf', name: 'KGF House', code: 'KGF', description: 'A family home on a sloping site with a restrained stone and lime-plaster palette.', focus: 'Design development and client sign-off', principalId: 'manoj', leadId: 'rahul', teamIds: ['rahul', 'siddharth'], currentStage: 'Design Development', deadline: '2026-10-12', deadlineLabel: '12 Oct', health: 'On Track',
      stages: [{name:'Brief',state:'done'},{name:'Concept Design',state:'done'},{name:'Design Development',state:'current'},{name:'Documentation',state:'next'},{name:'Production',state:'next'},{name:'Site Stage',state:'next'}],
      cycle: { label: '14–18 Sep', direction: 'Resolve the arrival sequence and prepare the updated client presentation.', deadline: 'Friday, 18 September' },
      notes: ['Client review confirmed for Monday morning.'],
    },
    {
      id: 'casa', name: 'Casa Residence', code: 'CASA', description: 'Interior refurbishment of a city apartment for a young family.', focus: 'Concept options and material direction', principalId: 'kiran', leadId: 'sudiksha', teamIds: ['sudiksha', 'rahul'], currentStage: 'Concept Design', deadline: '2026-10-28', deadlineLabel: '28 Oct', health: 'On Track',
      stages: [{name:'Brief',state:'done'},{name:'Concept Design',state:'current'},{name:'Design Development',state:'next'},{name:'Documentation',state:'next'},{name:'Procurement',state:'next'},{name:'Site Stage',state:'next'}],
      cycle: { label: '14–18 Sep', direction: 'Develop two material directions and close the living–dining planning options.', deadline: 'Friday, 18 September' },
      notes: ['Existing apartment survey received.'],
    },
  ],
  workItems: [
    { id:'w1',projectId:'villa-60',name:'Ground Floor Plan',assigneeId:'rahul',stage:'Documentation',dueDate:'2026-09-15',dueLabel:'Tue',status:'Completed',progress:100,hours:5.5,archived:true },
    { id:'w2',projectId:'villa-60',name:'First Floor Plan',assigneeId:'rahul',stage:'Documentation',dueDate:'2026-09-15',dueLabel:'Tue',status:'Completed',progress:100,hours:4,archived:true },
    { id:'w3',projectId:'villa-60',name:'Furniture Layout',assigneeId:'sudiksha',stage:'Documentation',dueDate:'2026-09-16',dueLabel:'Wed',status:'Completed',progress:100,hours:3.5,archived:true },
    { id:'w4',projectId:'villa-60',name:'Bedroom Layouts',assigneeId:'sudiksha',stage:'Documentation',dueDate:'2026-09-16',dueLabel:'Wed',status:'Completed',progress:100,hours:4.25,archived:true },
    { id:'w5',projectId:'villa-60',name:'Kitchen Layout (legacy)',assigneeId:'rahul',stage:'Documentation',dueDate:'2026-09-17',dueLabel:'Thu',status:'In Progress',progress:70,hours:6.5,notes:'Coordinate island clearance with dining layout.',archived:true },
    { id:'w6',projectId:'villa-60',name:'Reflected Ceiling Plan (legacy)',assigneeId:'siddharth',stage:'Documentation',dueDate:'2026-09-18',dueLabel:'Fri',status:'In Progress',progress:45,hours:4.75,archived:true },
    { id:'w7',projectId:'villa-60',name:'Electrical Layout (legacy)',assigneeId:'siddharth',stage:'Documentation',dueDate:'2026-09-18',dueLabel:'Fri',status:'Blocked',progress:35,hours:3.25,blockedReason:'Kitchen and lighting circuit requirements are unclear.',archived:true },
    { id:'w8',projectId:'villa-60',name:'Door Schedule (legacy)',assigneeId:'siddharth',stage:'Documentation',dueDate:'2026-09-18',dueLabel:'Fri',status:'Not Started',progress:0,hours:0,archived:true },
    { id:'w9',projectId:'kgf',name:'Arrival Sequence Study',assigneeId:'rahul',stage:'Design Development',dueDate:'2026-09-16',dueLabel:'Wed',status:'Completed',progress:100,hours:6 },
    { id:'w10',projectId:'kgf',name:'Landscape Edge Plan',assigneeId:'siddharth',stage:'Design Development',dueDate:'2026-09-17',dueLabel:'Thu',status:'In Review',progress:85,hours:5.25 },
    { id:'w11',projectId:'kgf',name:'Client Presentation',assigneeId:'rahul',stage:'Design Development',dueDate:'2026-09-18',dueLabel:'Fri',status:'In Progress',progress:60,hours:4.5 },
    { id:'w12',projectId:'kgf',name:'Material Palette',assigneeId:'siddharth',stage:'Design Development',dueDate:'2026-09-18',dueLabel:'Fri',status:'In Progress',progress:50,hours:3 },
    { id:'w13',projectId:'casa',name:'Living–Dining Option A',assigneeId:'sudiksha',stage:'Concept Design',dueDate:'2026-09-16',dueLabel:'Wed',status:'Completed',progress:100,hours:4.5 },
    { id:'w14',projectId:'casa',name:'Living–Dining Option B',assigneeId:'rahul',stage:'Concept Design',dueDate:'2026-09-17',dueLabel:'Thu',status:'In Progress',progress:55,hours:3.75 },
    { id:'w15',projectId:'casa',name:'Material Direction — Warm',assigneeId:'sudiksha',stage:'Concept Design',dueDate:'2026-09-18',dueLabel:'Fri',status:'In Progress',progress:40,hours:2.5 },
    { id:'w16',projectId:'casa',name:'Material Direction — Neutral',assigneeId:'rahul',stage:'Concept Design',dueDate:'2026-09-18',dueLabel:'Fri',status:'Not Started',progress:0,hours:0 },
    {id:'v60-d01',projectId:'villa-60',stage:'Design Development',stageId:'Design Development',cycleId:'villa-60-cycle-0',name:'Interior Space Plan',scopeNotes:'Space plan with furniture.',assigneeId:'siddharth',assigneeIds:['siddharth'],dueDate:'2026-08-27',dueLabel:'27 Aug',status:'Completed',progress:100,hours:8,required:true,subItems:[],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-08-27T18:00:00',templateKey:'residential-villa/interior-space-plan'},
    {id:'v60-d02',projectId:'villa-60',stage:'Design Development',stageId:'Design Development',cycleId:'villa-60-cycle-0',name:'SketchUp Model',scopeNotes:'Demolition drawing base and primary massing model.',assigneeId:'siddharth',assigneeIds:['siddharth'],dueDate:'2026-08-28',dueLabel:'28 Aug',status:'Completed',progress:100,hours:12,required:true,subItems:[],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-02T18:00:00',templateKey:'residential-villa/sketchup-model'},
    {id:'v60-d03',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-0',name:'BOQ',scopeNotes:'Furniture and miscellaneous items.',assigneeId:'sudiksha',assigneeIds:['sudiksha'],dueDate:'2026-08-31',dueLabel:'31 Aug',status:'In Review',progress:90,hours:7,required:true,subItems:[],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-14T17:00:00',templateKey:'residential-villa/boq'},
    {id:'v60-d04',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-0',name:'Civil Drawing',scopeNotes:'Demolition drawings and proposed civil layout.',assigneeId:'siddharth',assigneeIds:['siddharth','rahul'],dueDate:'2026-08-31',dueLabel:'31 Aug',status:'Completed',progress:100,hours:14,required:true,subItems:[{id:'v60-d04-s1',title:'Demolition drawings',assigneeIds:['siddharth','rahul'],completed:true},{id:'v60-d04-s2',title:'Proposed civil layout',assigneeIds:['siddharth','rahul'],completed:true}],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-05T18:00:00',templateKey:'residential-villa/civil-drawing'},
    {id:'v60-d05',projectId:'villa-60',stage:'Production',stageId:'Production',cycleId:'villa-60-cycle-0',name:'Fabrication Details',scopeNotes:'Service door; deck-area pergola; terrace staircase; terrace overhang.',assigneeId:'sudiksha',assigneeIds:['sudiksha'],dueDate:'2026-09-02',dueLabel:'2 Sep',status:'In Progress',progress:65,hours:9,required:true,subItems:[{id:'v60-d05-s1',title:'Service door',assigneeIds:['sudiksha'],completed:true},{id:'v60-d05-s2',title:'Deck-area pergola',assigneeIds:['sudiksha'],completed:false},{id:'v60-d05-s3',title:'Terrace staircase and overhang',assigneeIds:['sudiksha'],completed:false}],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-14T18:00:00',templateKey:'residential-villa/fabrication-details'},
    {id:'v60-d06',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-0',name:'Solar Electrical & Water Supply',scopeNotes:'Proposed solar panel layout and associated electrical and water-supply requirements.',assigneeId:'sudiksha',assigneeIds:['sudiksha'],dueDate:'2026-09-02',dueLabel:'2 Sep',status:'In Progress',progress:70,hours:6,required:true,subItems:[],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-13T16:00:00',templateKey:'residential-villa/solar-services'},
    {id:'v60-d07',projectId:'villa-60',stage:'Design Development',stageId:'Design Development',cycleId:'villa-60-cycle-0',name:'Detailed SketchUp Model',scopeNotes:'Detailed model for all floors, coordinated for design review.',assigneeId:'rahul',assigneeIds:['rahul','siddharth'],dueDate:'2026-09-04',dueLabel:'4 Sep',status:'Completed',progress:100,hours:22,required:true,subItems:[{id:'v60-d07-s1',title:'Ground and First Floors',assigneeIds:['rahul'],completed:true},{id:'v60-d07-s2',title:'Second and Terrace Floors',assigneeIds:['siddharth'],completed:true}],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-08T18:00:00',templateKey:'residential-villa/detailed-model'},
    {id:'v60-d08',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-1',name:'Plumbing Drawings',scopeNotes:'All bathrooms, kitchen, pantry and utility/service areas; water supply; hot/cold water; waste and drainage points; sanitary fixture locations.',assigneeId:'siddharth',assigneeIds:['siddharth'],dueDate:'2026-09-17',dueLabel:'17 Sep',status:'In Progress',progress:45,hours:5,required:true,subItems:[],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-14T17:00:00',templateKey:'residential-villa/plumbing'},
    {id:'v60-d09',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-1',name:'Electrical & Lighting - Wall',scopeNotes:'Wall electrical and lighting requirements for bathrooms, kitchen, pantry and utility/service areas, coordinated with fixture locations.',assigneeId:'siddharth',assigneeIds:['siddharth'],dueDate:'2026-09-18',dueLabel:'18 Sep',status:'Blocked',progress:40,hours:4,blockedReason:'Need clarification regarding electrical coordination.',required:true,subItems:[],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-14T18:00:00',templateKey:'residential-villa/electrical-wall'},
    {id:'v60-d10',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-0',name:'Flooring & Tiling Drawings',scopeNotes:'All proposed tiling-area layouts; bathroom floor and wall tiling; kitchen and pantry dado/tiling.',assigneeId:'siddharth',assigneeIds:['siddharth','rahul','sudiksha'],dueDate:'2026-09-08',dueLabel:'8 Sep',status:'In Review',progress:85,hours:15,required:true,subItems:[{id:'v60-d10-s1',title:'Proposed tiling-area layouts',assigneeIds:['siddharth'],completed:true},{id:'v60-d10-s2',title:'Bathroom floor and wall tiling',assigneeIds:['rahul'],completed:true},{id:'v60-d10-s3',title:'Kitchen and pantry dado/tiling review',assigneeIds:['sudiksha'],completed:false}],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-14T16:00:00',templateKey:'residential-villa/flooring-tiling'},
    {id:'v60-d11',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-1',name:'Millwork / Joinery',scopeNotes:'Complete kitchen and pantry drawings; wardrobes; TV units; consoles; storage units; bed-back panels and other fixed furniture. Include plans, elevations and sections with material/hardware details.',assigneeId:'rahul',assigneeIds:['rahul','siddharth','sudiksha'],dueDate:'2026-09-18',dueLabel:'18 Sep',status:'In Progress',progress:20,hours:6,required:true,subItems:[{id:'v60-d11-s1',title:'Ground and First Floors',assigneeIds:['rahul'],completed:false},{id:'v60-d11-s2',title:'Second and Terrace Floors',assigneeIds:['siddharth'],completed:false},{id:'v60-d11-s3',title:'Review and coordination',assigneeIds:['sudiksha'],completed:false}],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-14T17:30:00',templateKey:'residential-villa/millwork'},
    {id:'v60-d12',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-1',name:'HVAC / AC',scopeNotes:'AC indoor/outdoor unit locations; drain and piping points; coordination with ceiling and electrical drawings.',assigneeId:'sudiksha',assigneeIds:['sudiksha'],dueDate:'2026-09-18',dueLabel:'18 Sep',status:'In Progress',progress:50,hours:4,required:true,subItems:[],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-14T15:30:00',templateKey:'residential-villa/hvac'},
    {id:'v60-d13',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-1',name:'Electrical & Lighting - Ceiling',scopeNotes:'Ceiling light plans for all areas.',assigneeId:'rahul',assigneeIds:['rahul'],dueDate:'2026-09-18',dueLabel:'18 Sep',status:'In Progress',progress:35,hours:3,required:true,subItems:[],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-14T18:10:00',templateKey:'residential-villa/electrical-ceiling'},
    {id:'v60-d14',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-1',name:'False Ceiling / RCP',scopeNotes:'Complete reflected ceiling plan including ceiling levels and profiles, light positions, AC grilles/diffusers, curtain pockets, coves and access panels.',assigneeId:'rahul',assigneeIds:['rahul'],dueDate:'2026-09-19',dueLabel:'19 Sep',status:'In Progress',progress:10,hours:2,required:true,subItems:[{id:'v60-d14-s1',title:'Ceiling levels and profiles',assigneeIds:['rahul'],completed:false},{id:'v60-d14-s2',title:'Light positions',assigneeIds:['rahul'],completed:false},{id:'v60-d14-s3',title:'AC grilles and diffusers',assigneeIds:['rahul'],completed:false},{id:'v60-d14-s4',title:'Curtain pockets, coves and access panels',assigneeIds:['rahul'],completed:false}],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-14T18:20:00',templateKey:'residential-villa/false-ceiling'},
    {id:'v60-d15',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-1',name:'Schedules',scopeNotes:'Material and finish schedule; door/hardware schedule; sanitary and fixture schedule wherever required.',assigneeId:'siddharth',assigneeIds:['siddharth'],dueDate:'2026-09-19',dueLabel:'19 Sep',status:'Not Started',progress:0,hours:0,required:true,subItems:[],createdBy:'sudiksha',createdAt:'2026-08-24T09:00:00',updatedAt:'2026-09-14T09:00:00',templateKey:'residential-villa/schedules'},
    {id:'v60-d16',projectId:'villa-60',stage:'Documentation',stageId:'Documentation',cycleId:'villa-60-cycle-1',name:'Kitchen Layout & Coordination',scopeNotes:'Complete kitchen base layout, island dimensions, appliance positions and coordination with millwork, plumbing and electrical drawings.',assigneeId:'rahul',assigneeIds:['rahul','sudiksha'],dueDate:'2026-09-18',dueLabel:'18 Sep',status:'In Progress',progress:40,hours:4,required:true,subItems:[{id:'v60-d16-s1',title:'Base layout and island',assigneeIds:['rahul'],completed:true},{id:'v60-d16-s2',title:'Services coordination and review',assigneeIds:['sudiksha'],completed:false}],createdBy:'sudiksha',createdAt:'2026-09-14T09:00:00',updatedAt:'2026-09-14T17:42:00',templateKey:'residential-villa/kitchen'},
  ],
  updates: [
    { id:'u1',projectId:'villa-60',workItemId:'v60-d16',userId:'rahul',text:'Completed kitchen counter layout and started island details. Checking the aisle width against the dining plan.',progress:40,minutes:150,status:'In Progress',createdAt:'2026-09-14T17:42:00' },
    { id:'u2',projectId:'villa-60',workItemId:'v60-d09',userId:'siddharth',text:'Set out the general wall electrical layout. Unable to close kitchen circuits without appliance inputs.',progress:35,minutes:110,status:'Blocked',blocker:'Need confirmation of kitchen appliance loads and lighting controls.',createdAt:'2026-09-14T18:01:00' },
    { id:'u3',projectId:'kgf',workItemId:'w10',userId:'siddharth',text:'Updated the landscape edge after the arrival study and issued it to Rahul for review.',progress:85,minutes:135,status:'In Review',createdAt:'2026-09-14T17:18:00' },
    { id:'u4',projectId:'casa',workItemId:'w14',userId:'rahul',text:'Developed the second furniture layout and tested a compact dining arrangement.',progress:55,minutes:105,status:'In Progress',createdAt:'2026-09-14T16:56:00' },
  ],
  helpRequests: [
    { id:'h1',projectId:'villa-60',workItemId:'v60-d09',raisedBy:'siddharth',assignedTo:'kiran',level:'principal',kind:'blocked',subject:'Electrical coordination needs direction',reason:'Kitchen power and lighting controls cannot be coordinated with the information available.',tried:'Reviewed the latest kitchen layout and consultant markups with Siddharth.',decisionNeeded:'Confirm whether to proceed with the assumed appliance schedule or wait for the kitchen consultant.',escalatedBy:'sudiksha',escalatedAt:'2026-09-14T15:10:00',priority:'Important',status:'Escalated',createdAt:'2026-09-14T14:25:00' },
    { id:'h2',projectId:'kgf',workItemId:'w12',raisedBy:'siddharth',assignedTo:'rahul',level:'lead',subject:'Stone finish sample is unavailable',reason:'The specified local grey stone is not available in the required finish.',priority:'Normal',status:'Open',createdAt:'2026-09-14T14:40:00' },
  ],
  activities: [
    {id:'a1',projectId:'villa-60',actorId:'siddharth',text:'updated Electrical Layout and marked it blocked',createdAt:'2026-09-14T18:01:00'},
    {id:'a2',projectId:'villa-60',actorId:'rahul',text:'updated Kitchen Layout to 70%',createdAt:'2026-09-14T17:42:00'},
    {id:'a3',projectId:'villa-60',actorId:'sudiksha',text:'escalated Electrical Layout to Kiran',createdAt:'2026-09-14T15:10:00'},
    {id:'a4',projectId:'villa-60',actorId:'kiran',text:'added direction for this cycle',createdAt:'2026-09-14T11:30:00'},
    {id:'a5',projectId:'kgf',actorId:'siddharth',text:'submitted Landscape Edge Plan for review',createdAt:'2026-09-14T17:18:00'},
  ],
  cycles: [
    {id:'villa-60-cycle-1',projectId:'villa-60',startDate:'2026-09-14',endDate:'2026-09-19',direction:'Complete the required documentation deliverables this cycle.',status:'Active',summary:'',nextPlan:'',createdBy:'kiran',createdAt:'2026-09-14T09:00:00',number:4,deliverableIds:['v60-d08','v60-d09','v60-d11','v60-d12','v60-d13','v60-d14','v60-d15','v60-d16']},
    {id:'villa-60-cycle-0',projectId:'villa-60',startDate:'2026-09-07',endDate:'2026-09-11',direction:'Close design development and prepare the documentation register.',status:'Closed',summary:'Design development was closed and the documentation package was set up.',nextPlan:'Begin coordinated documentation.',createdBy:'kiran',createdAt:'2026-09-07T09:00:00',closedAt:'2026-09-11T18:00:00'},
    {id:'kgf-cycle-1',projectId:'kgf',startDate:'2026-09-14',endDate:'2026-09-18',direction:'Resolve the arrival sequence and prepare the updated client presentation.',status:'Active',summary:'',nextPlan:'',createdBy:'manoj',createdAt:'2026-09-14T09:00:00'},
    {id:'casa-cycle-1',projectId:'casa',startDate:'2026-09-14',endDate:'2026-09-18',direction:'Develop two material directions and close the living–dining planning options.',status:'Active',summary:'',nextPlan:'',createdBy:'kiran',createdAt:'2026-09-14T09:00:00'},
  ],
  timeEntries: [
    {id:'t1',projectId:'villa-60',workItemId:'v60-d16',userId:'rahul',cycleId:'villa-60-cycle-1',date:'2026-09-14T17:42:00',minutes:150,updateId:'u1'},
    {id:'t2',projectId:'villa-60',workItemId:'v60-d09',userId:'siddharth',cycleId:'villa-60-cycle-1',date:'2026-09-14T18:01:00',minutes:110,updateId:'u2'},
    {id:'t3',projectId:'kgf',workItemId:'w10',userId:'siddharth',cycleId:'kgf-cycle-1',date:'2026-09-14T17:18:00',minutes:135,updateId:'u3'},
    {id:'t4',projectId:'casa',workItemId:'w14',userId:'rahul',cycleId:'casa-cycle-1',date:'2026-09-14T16:56:00',minutes:105,updateId:'u4'},
  ],
  dailyReports: [],
  schemaVersion: 6,
};

// Phase 4 intentionally uses one real project as the complete test environment.
seedData.projects=seedData.projects.filter(p=>p.id==='villa-60');
seedData.cycles=seedData.cycles.filter(c=>c.projectId==='villa-60');
seedData.workItems=seedData.workItems.filter(w=>w.projectId==='villa-60');
seedData.updates=seedData.updates.filter(u=>u.projectId==='villa-60');
seedData.helpRequests=seedData.helpRequests.filter(h=>h.projectId==='villa-60');
seedData.activities=seedData.activities.filter(a=>a.projectId==='villa-60');
seedData.timeEntries=seedData.timeEntries.filter(t=>t.projectId==='villa-60');
const pdfRegister:{[id:string]:{dueDate:string;dueLabel:string;status:'Completed'|'In Progress'|'Not Started';progress:number;assigneeIds:string[]}}={
  'v60-d01':{dueDate:'2026-08-27',dueLabel:'27 Aug',status:'Completed',progress:100,assigneeIds:['siddharth']},
  'v60-d02':{dueDate:'2026-08-28',dueLabel:'28 Aug',status:'In Progress',progress:0,assigneeIds:['siddharth']},
  'v60-d03':{dueDate:'2026-08-31',dueLabel:'31 Aug',status:'Not Started',progress:0,assigneeIds:['sudiksha']},
  'v60-d04':{dueDate:'2026-08-31',dueLabel:'31 Aug',status:'Not Started',progress:0,assigneeIds:['siddharth','rahul']},
  'v60-d05':{dueDate:'2026-09-02',dueLabel:'2 Sep',status:'Not Started',progress:0,assigneeIds:['sudiksha']},
  'v60-d06':{dueDate:'2026-09-02',dueLabel:'2 Sep',status:'Not Started',progress:0,assigneeIds:['sudiksha']},
  'v60-d07':{dueDate:'2026-09-04',dueLabel:'4 Sep',status:'Not Started',progress:0,assigneeIds:['rahul','siddharth']},
  'v60-d08':{dueDate:'2026-09-05',dueLabel:'5 Sep',status:'Not Started',progress:0,assigneeIds:['siddharth']},
  'v60-d09':{dueDate:'2026-09-05',dueLabel:'5 Sep',status:'Not Started',progress:0,assigneeIds:['rahul']},
  'v60-d10':{dueDate:'2026-09-08',dueLabel:'8 Sep',status:'Not Started',progress:0,assigneeIds:['siddharth','rahul','sudiksha']},
  'v60-d11':{dueDate:'2026-09-14',dueLabel:'14 Sep',status:'Not Started',progress:0,assigneeIds:['rahul','siddharth','sudiksha']},
  'v60-d12':{dueDate:'2026-09-15',dueLabel:'15 Sep',status:'Not Started',progress:0,assigneeIds:['sudiksha']},
  'v60-d13':{dueDate:'2026-09-15',dueLabel:'15 Sep',status:'Not Started',progress:0,assigneeIds:['rahul']},
  'v60-d14':{dueDate:'2026-09-16',dueLabel:'16 Sep',status:'Not Started',progress:0,assigneeIds:['rahul']},
  'v60-d15':{dueDate:'2026-09-16',dueLabel:'16 Sep',status:'Not Started',progress:0,assigneeIds:['siddharth']},
};
seedData.workItems=seedData.workItems.filter(w=>w.id!=='v60-d16').map(w=>{const source=pdfRegister[w.id];return source?{...w,...source,assigneeId:source.assigneeIds[0],activeElapsedMinutes:w.id==='v60-d01'?w.hours*60:0,startedAt:undefined,completedAt:w.id==='v60-d01'?w.updatedAt:undefined,blockedReason:undefined}:w});
const activeVillaCycle=seedData.cycles.find(c=>c.id==='villa-60-cycle-1');
if(activeVillaCycle)activeVillaCycle.deliverableIds=['v60-d03','v60-d04','v60-d06','v60-d08','v60-d09','v60-d10','v60-d11','v60-d12','v60-d13','v60-d14','v60-d15'];
seedData.updates=[];
seedData.helpRequests=[];
seedData.activities=[];
seedData.timeEntries=[];
seedData.dailyReports=[];
