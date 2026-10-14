import { Clock3, LogIn, LogOut } from 'lucide-react';
import { useState } from 'react';
import type { AppData, User } from '../types';
import { attendanceService } from '../services/attendanceService';

const time=(value:string)=>new Date(value).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});

export function AttendanceControl({data,user}:{data:AppData;user:User}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const active=attendanceService.activeFor(data,user.id);
  const hasClosedToday=data.attendanceEntries.some(entry=>entry.userId===user.id&&entry.clockOutAt&&new Date(entry.clockInAt).toDateString()===new Date().toDateString());
  async function act(action:'in'|'out'){setBusy(true);setError('');try{if(action==='in')await attendanceService.clockIn(data,user.id);else await attendanceService.clockOut(data,user.id)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to save attendance.')}finally{setBusy(false)}}
  return <div className={`attendance-control dashboard-attendance ${active?'clocked-in':''}`}>
    {active?<><span><Clock3 size={16}/><span><strong>Clocked in</strong><small>{time(active.clockInAt)}</small></span></span><button type="button" disabled={busy} onClick={()=>void act('out')}><LogOut size={15}/> {busy?'Saving…':'Clock out'}</button></>:<button type="button" className="clock-in" disabled={busy} onClick={()=>void act('in')}><LogIn size={16}/><span>{busy?'Saving…':hasClosedToday?'Clock in again':'Clock in'}</span></button>}
    {error&&<small className="attendance-error">{error}</small>}
  </div>;
}
