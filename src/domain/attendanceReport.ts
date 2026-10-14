import type { AttendanceEntry, User } from '../types';

// Use one studio calendar regardless of the admin's device timezone.
export const ATTENDANCE_ZONE='Asia/Kolkata';
export function attendanceDate(value:Date|string=new Date()):string {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:ATTENDANCE_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  return ['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-');
}
export const attendanceTime=(value:string)=>new Date(value).toLocaleTimeString('en-IN',{timeZone:ATTENDANCE_ZONE,hour:'2-digit',minute:'2-digit'});
export const hoursLabel=(hours:number)=>`${Math.floor(hours)}h ${String(Math.floor(hours*60+1e-7)%60).padStart(2,'0')}m`;
export function calendarDays(start:string,end:string):string[]{
  const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(!valid(start)||!valid(end)||start>end)throw new Error('Choose a valid date range with the end on or after the start.');
  const days=[];for(let value=Date.parse(start);value<=Date.parse(end);value+=86400000)days.push(new Date(value).toISOString().slice(0,10));
  return days;
}
export function monthBounds(start:string,end=start){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(start)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(end)||start>end)throw new Error('Choose valid months in chronological order.');
  return {start:`${start}-01`,end:new Date(Date.UTC(Number(end.slice(0,4)),Number(end.slice(5)),0)).toISOString().slice(0,10)};
}
export interface AttendanceDay {
  date:string; user:User; entries:AttendanceEntry[]; checkIn?:string; checkOut?:string;
  hours:number; complete:boolean; status:string;
}
export function attendanceDays(employees:User[],entries:AttendanceEntry[],start:string,end:string):AttendanceDay[]{
  const groups=new Map<string,AttendanceEntry[]>();
  for(const entry of entries){if(!Number.isFinite(Date.parse(entry.clockInAt)))continue;const key=`${entry.userId}/${attendanceDate(entry.clockInAt)}`;groups.set(key,[...(groups.get(key)||[]),entry]);}
  return calendarDays(start,end).flatMap(date=>employees.map(user=>{
    const shifts=(groups.get(`${user.id}/${date}`)||[]).slice().sort((a,b)=>a.clockInAt.localeCompare(b.clockInAt));
    const valid=shifts.filter(entry=>entry.clockOutAt&&Number.isFinite(Date.parse(entry.clockOutAt))&&Date.parse(entry.clockOutAt)>=Date.parse(entry.clockInAt));
    const complete=shifts.length>0&&valid.length===shifts.length;
    const hours=valid.reduce((sum,entry)=>sum+(Date.parse(entry.clockOutAt!)-Date.parse(entry.clockInAt))/3600000,0);
    return {date,user,entries:shifts,checkIn:shifts[0]?.clockInAt,checkOut:complete?valid.reduce((latest,entry)=>entry.clockOutAt!>latest?entry.clockOutAt!:latest,''):undefined,hours,complete,status:!shifts.length?'Missing check-in / check-out':!complete?'Incomplete check-out':hours>=9?'Complete · 9+ hours':'Complete · Less than 9 hours'};
  }));
}
export function attendanceSummary(rows:AttendanceDay[]){
  const complete=rows.filter(row=>row.complete),total=rows.reduce((sum,row)=>sum+row.hours,0);
  return {days:rows.length,complete:complete.length,ninePlus:complete.filter(row=>row.hours>=9).length,underNine:complete.filter(row=>row.hours<9).length,incomplete:rows.length-complete.length,total,average:complete.length?complete.reduce((sum,row)=>sum+row.hours,0)/complete.length:0};
}
