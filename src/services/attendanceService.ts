import type { AppData, AttendanceEntry } from '../types';

const entriesFor=(data:AppData,userId:string)=>data.attendanceEntries
  .filter(entry=>entry.userId===userId)
  .sort((left,right)=>right.clockInAt.localeCompare(left.clockInAt));

export const attendanceService={
  entriesFor,
  activeFor(data:AppData,userId:string){return entriesFor(data,userId).find(entry=>!entry.clockOutAt)},
  clockIn(data:AppData,userId:string,now=new Date()):AppData{
    if(attendanceService.activeFor(data,userId))return data;
    const clockInAt=now.toISOString();
    const entry:AttendanceEntry={id:`attendance-${userId}-${now.getTime()}`,userId,clockInAt};
    return {...data,attendanceEntries:[entry,...data.attendanceEntries]};
  },
  clockOut(data:AppData,userId:string,now=new Date()):AppData{
    const active=attendanceService.activeFor(data,userId);
    if(!active)return data;
    const clockOutAt=now.toISOString();
    return {...data,attendanceEntries:data.attendanceEntries.map(entry=>entry.id===active.id?{...entry,clockOutAt}:entry)};
  },
};
