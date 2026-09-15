import type { AppData, User } from '../types';
import { makeId } from './shared';

export const userService={
  create(data:AppData,actorId:string,input:{name:string;email?:string;title:string;reportsToId?:string;access?:User['access']}):AppData{
    const actor=data.users.find(u=>u.id===actorId);if(!actor||actor.access!=='admin'||!input.name.trim()||!input.title.trim())return data;
    const initials=input.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join('');
    const user:User={id:makeId('person'),name:input.name.trim(),email:input.email?.trim(),initials,title:input.title.trim(),access:input.access||'employee',reportsToId:input.reportsToId||undefined,active:true,loginEnabled:true,tone:'#64756d'};
    return {...data,users:[...data.users,user],projects:data.projects.map(project=>user.access==='employee'?{...project,teamIds:[...project.teamIds,user.id]}:project)};
  }
};
