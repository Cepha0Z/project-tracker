import type { Activity, AppData } from '../types';

export const makeId = (prefix:string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
export const now = () => new Date().toISOString();
export const withActivity = (data:AppData, projectId:string, actorId:string, text:string, createdAt=now()):AppData => {
  const activity:Activity={id:makeId('activity'),projectId,actorId,text,createdAt};
  return {...data,activities:[activity,...data.activities]};
};
