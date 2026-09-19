import type { AppData, User } from '../types';

const originalDisplayNames=new Map<string,string>();

export function displayNameFromEmail(person:Pick<User,'email'|'name'>) {
  const localPart=person.email?.split('@')[0]?.trim();
  const first=(localPart||person.name.split(/\s+/)[0]||'User').replace(/[._-]+/g,' ').split(/\s+/)[0];
  if(person.name.trim()&&!/\s/.test(person.name.trim())&&person.name.toLowerCase()===first.toLowerCase())return person.name.trim();
  return first.charAt(0).toUpperCase()+first.slice(1).toLowerCase();
}

export function jobRole(person:User) {
  return person.access==='admin'?'Principal Architect':person.title;
}

export function enabledAccountFlag(value:boolean|'true'|'false'|undefined) {
  return value === undefined || value === true || value === 'true';
}

export function isConnectedPerson(person:User) {
  return Boolean(person.authUid) && enabledAccountFlag(person.active) && enabledAccountFlag(person.loginEnabled);
}

export function presentUser(person:User):User {
  const name=displayNameFromEmail(person);
  if(person.name!==name)originalDisplayNames.set(person.name,name);
  return {...person,name,initials:name.slice(0,1).toUpperCase(),loginEnabled:enabledAccountFlag(person.loginEnabled)};
}

export function displayActivityText(value:string) {
  let text=value;
  for(const [original,display] of originalDisplayNames)text=text.replaceAll(original,display);
  return text;
}

// Firebase Auth UID is linked to the stable user ID through authProfiles.
// Unlinked prototype people must never appear as assignable staff.
export const connectedPeople = (data:AppData) => data.users.filter(person =>
  isConnectedPerson(person),
);
