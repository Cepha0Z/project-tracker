export type HelpRequestRouting={level?:string;status?:string};
export type ProjectRouting={leadId?:string;principalId?:string;principalIds?:string[]};

export function leadRecipients(request:HelpRequestRouting,project:ProjectRouting){
  return request.level==='lead'&&project.leadId?[project.leadId]:[];
}

export function isPrincipalEscalation(before:HelpRequestRouting,after:HelpRequestRouting){
  return before.level!=='principal'&&after.level==='principal'&&after.status==='Escalated';
}

export function isDirectPrincipalEscalation(request:HelpRequestRouting){
  return request.level==='principal'&&request.status==='Escalated';
}

export function principalRecipients(project:ProjectRouting){
  return [...new Set([project.principalId||'',...(project.principalIds||[])].filter(Boolean))];
}
