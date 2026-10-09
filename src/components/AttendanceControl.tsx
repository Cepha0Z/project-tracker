import { Clock3, LogIn, LogOut } from 'lucide-react';
import type { AppData, User } from '../types';
import { attendanceService } from '../services/attendanceService';

type Mutate=(fn:(data:AppData)=>AppData)=>void;
const time=(value:string)=>new Date(value).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});

export function AttendanceControl({data,user,mutate}:{data:AppData;user:User;mutate:Mutate}){
  const active=attendanceService.activeFor(data,user.id);
  return <div className={`attendance-control ${active?'clocked-in':''}`}>
    {active?<><span><Clock3 size={15}/><span><strong>Clocked in</strong><small>{time(active.clockInAt)}</small></span></span><button type="button" onClick={()=>mutate(current=>attendanceService.clockOut(current,user.id))}><LogOut size={14}/> Clock out</button></>:<button type="button" className="clock-in" onClick={()=>mutate(current=>attendanceService.clockIn(current,user.id))}><LogIn size={15}/><span>Clock in</span></button>}
  </div>;
}
