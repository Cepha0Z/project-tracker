const test=require('node:test');
const assert=require('node:assert/strict');
const {isDirectPrincipalEscalation,isPrincipalEscalation,leadRecipients,principalRecipients}=require('../lib/notificationRouting.js');

test('a normal help request routes only to the project lead',()=>{
  const project={leadId:'lead-1',principalId:'principal-1'};
  assert.deepEqual(leadRecipients({level:'lead',status:'Open'},project),['lead-1']);
  assert.equal(isPrincipalEscalation({level:'lead',status:'Open'},{level:'lead',status:'Open'}),false);
});

test('an escalation transition routes to every unique project principal',()=>{
  const project={leadId:'lead-1',principalId:'principal-1',principalIds:['principal-1','principal-2']};
  assert.equal(isPrincipalEscalation({level:'lead',status:'Open'},{level:'principal',status:'Escalated'}),true);
  assert.deepEqual(principalRecipients(project),['principal-1','principal-2']);
});

test('a project lead can create a direct principal escalation',()=>{
  assert.equal(isDirectPrincipalEscalation({level:'principal',status:'Escalated'}),true);
  assert.equal(isDirectPrincipalEscalation({level:'principal',status:'Open'}),false);
});

test('resolution and repeated writes do not trigger principal notification',()=>{
  assert.equal(isPrincipalEscalation({level:'lead',status:'Open'},{level:'lead',status:'Resolved'}),false);
  assert.equal(isPrincipalEscalation({level:'principal',status:'Escalated'},{level:'principal',status:'Escalated'}),false);
});
