import type { AppData, AttendanceEntry } from '../types';
import { collection, doc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { firestoreDb } from '../firebase/config';

const entriesFor=(data:AppData,userId:string)=>data.attendanceEntries
  .filter(entry=>entry.userId===userId)
  .sort((left,right)=>right.clockInAt.localeCompare(left.clockInAt));

export const attendanceService={
  entriesFor,
  activeFor(data:AppData,userId:string){return entriesFor(data,userId).find(entry=>!entry.clockOutAt)},
  clockInState(data:AppData,userId:string,now=new Date()):AppData{
    if(attendanceService.activeFor(data,userId))return data;
    const clockInAt=now.toISOString();
    const entry:AttendanceEntry={id:`attendance-${userId}-${now.getTime()}`,userId,clockInAt};
    return {...data,attendanceEntries:[entry,...data.attendanceEntries]};
  },
  clockOutState(data:AppData,userId:string,now=new Date()):AppData{
    const active=attendanceService.activeFor(data,userId);
    if(!active)return data;
    const clockOutAt=now.toISOString();
    return {...data,attendanceEntries:data.attendanceEntries.map(entry=>entry.id===active.id?{...entry,clockOutAt}:entry)};
  },
  async clockIn(data:AppData,userId:string){
    if(attendanceService.activeFor(data,userId))return;
    if(!firestoreDb)throw new Error('Firebase is not configured.');
    const reference=doc(collection(firestoreDb,'attendanceEntries'));
    await setDoc(reference,{id:reference.id,userId,clockInAt:serverTimestamp()});
  },
  async clockOut(data:AppData,userId:string){
    const active=attendanceService.activeFor(data,userId);
    if(!active)return;
    if(!firestoreDb)throw new Error('Firebase is not configured.');
    await updateDoc(doc(firestoreDb,'attendanceEntries',active.id),{clockOutAt:serverTimestamp()});
  },
  async correct(entryId:string,clockInAt:string,clockOutAt:string){
    if(!firestoreDb)throw new Error('Firebase is not configured.');
    const start=new Date(clockInAt),end=new Date(clockOutAt);
    if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)throw new Error('Clock-out must be after clock-in.');
    await updateDoc(doc(firestoreDb,'attendanceEntries',entryId),{clockInAt:Timestamp.fromDate(start),clockOutAt:Timestamp.fromDate(end)});
  },
};
