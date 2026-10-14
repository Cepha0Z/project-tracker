import { useEffect, useState } from 'react';
import { Download, Edit3, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { AppData, AttendanceEntry, User } from '../types';
import { attendanceService } from '../services/attendanceService';
import { connectedPeople } from '../domain/people';
import { attendanceDate, attendanceDays, attendanceTime, hoursLabel, monthBounds } from '../domain/attendanceReport';
import { downloadAttendance } from '../services/attendanceExport';
import './attendance.css';

// Refresh at studio midnight and when a sleeping/background tab returns.
export function useAttendanceToday(){
  const [today,setToday]=useState(attendanceDate);
  useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const refresh=()=>{const next=attendanceDate();setToday(next);clearTimeout(timer);const midnight=Date.parse(`${next}T00:00:00+05:30`)+86400000;timer=setTimeout(refresh,Math.max(100,midnight-Date.now()+50));};refresh();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{clearTimeout(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);}},[]);
  return today;
}
export function AttendancePage({data,user}:{data:AppData;user:User}){
  if(user.access!=='admin')return null;
  return <AdminAttendance data={data} user={user}/>;
}
function AdminAttendance({data,user}:{data:AppData;user:User}){
  const today=useAttendanceToday(),[selected,setSelected]=useState(''),[exporting,setExporting]=useState(false),[editing,setEditing]=useState<AttendanceEntry|null>(null),[error,setError]=useState('');
  const [observedDay,setObservedDay]=useState(today);
  // Only reset the selected date. Never mutate repository records on rollover.
  useEffect(()=>{if(today!==observedDay){setSelected('');setObservedDay(today)}},[today,observedDay]);
  const date=today!==observedDay?today:selected||today;
  const employees=connectedPeople(data).filter(person=>person.access==='employee');
  const rows=attendanceDays(employees,data.attendanceEntries,date,date);
  return <div className="page simple-page attendance-page"><div className="simple-title row"><div><p>ADMIN</p><h1>Attendance</h1><span>Daily employee attendance · India time</span></div><button className="secondary" onClick={()=>setExporting(true)}><Download size={16}/> Download Excel</button></div>
    <section className="attendance-filters attendance-daily-filters"><label>DATE<input aria-label="Attendance date" type="date" value={date} onChange={event=>{if(event.target.value)setSelected(event.target.value)}}/></label><button className="secondary" onClick={()=>setSelected('')}>Today</button><span>{rows.filter(row=>row.complete).length} of {employees.length} complete<small>{hoursLabel(rows.reduce((sum,row)=>sum+row.hours,0))} recorded</small></span></section>
    <p className="attendance-explanation">Hours sum completed shifts. Missing check-outs stay incomplete. No scheduled hours are assumed.</p>
    <section className="attendance-register attendance-daily-register"><table><thead><tr><th>Employee</th><th>Check-in</th><th>Check-out</th><th>Total hours</th><th>Daily status</th><th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.user.id} className={!row.complete?'attendance-incomplete':row.hours>=9?'attendance-nine':'attendance-under'}><th scope="row">{row.user.name}</th><td>{row.checkIn?attendanceTime(row.checkIn):'Missing'}</td><td>{row.checkOut?attendanceTime(row.checkOut):'Missing'}</td><td>{row.entries.length?hoursLabel(row.hours):'—'}</td><td>{row.status}{row.entries.length>1&&<small>{row.entries.length} shifts · hours exclude gaps</small>}</td><td>{row.entries.length>0&&<details className="attendance-shifts"><summary>Edit shifts</summary>{row.entries.map(entry=><button key={entry.id} onClick={()=>{setEditing(entry);setError('')}}><Edit3 size={13}/>{attendanceTime(entry.clockInAt)} – {entry.clockOutAt?attendanceTime(entry.clockOutAt):'Missing'}</button>)}</details>}</td></tr>)}</tbody></table>{!employees.length&&<p className="attendance-empty">No linked employees.</p>}</section>
    {exporting&&createPortal(<AttendanceExport data={data} user={user} close={()=>setExporting(false)}/>,document.body)}
    {editing&&createPortal(<AttendanceEdit key={editing.id} entry={editing} person={employees.find(person=>person.id===editing.userId)} error={error} close={()=>setEditing(null)} save={async(start,end)=>{setError('');try{await attendanceService.correct(editing.id,start,end);setEditing(null)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to correct attendance.')}}}/>,document.body)}
  </div>;
}
function AttendanceExport({data,user,close}:{data:AppData;user:User;close:()=>void}){
  const month=attendanceDate().slice(0,7),[employee,setEmployee]=useState(''),[period,setPeriod]=useState('month'),[fromMonth,setFromMonth]=useState(month),[toMonth,setToMonth]=useState(month),[start,setStart]=useState(`${month}-01`),[end,setEnd]=useState(attendanceDate()),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const employees=connectedPeople(data).filter(person=>person.access==='employee');
  async function submit(){setBusy(true);setError('');try{const range=period==='custom'?{start,end}:monthBounds(fromMonth,period==='month'?fromMonth:toMonth);await downloadAttendance(data,user,employee,range.start,range.end);close()}catch(reason){setError(reason instanceof Error?reason.message:'Unable to download attendance.')}finally{setBusy(false)}}
  return <div className="simple-modal-backdrop"><form role="dialog" aria-modal="true" aria-labelledby="attendance-export-title" className="simple-modal attendance-export-modal" onSubmit={event=>{event.preventDefault();void submit()}}><button type="button" className="simple-modal-close" aria-label="Close export" disabled={busy} onClick={close}><X/></button><p className="modal-kicker">EXCEL REPORT</p><h2 id="attendance-export-title">Download attendance</h2><label>Employee<select value={employee} onChange={event=>setEmployee(event.target.value)}><option value="">All Employees</option>{employees.map(person=><option value={person.id} key={person.id}>{person.name}</option>)}</select></label><label>Reporting period<select value={period} onChange={event=>setPeriod(event.target.value)}><option value="month">Single month</option><option value="months">Multiple months / full year</option><option value="custom">Custom date range</option></select></label>{period==='custom'?<div className="simple-form-row"><label>From<input required type="date" value={start} onChange={event=>setStart(event.target.value)}/></label><label>To<input required type="date" min={start} value={end} onChange={event=>setEnd(event.target.value)}/></label></div>:<div className="simple-form-row"><label>{period==='month'?'Month':'First month'}<input required type="month" value={fromMonth} onChange={event=>setFromMonth(event.target.value)}/></label>{period==='months'&&<label>Last month<input required type="month" min={fromMonth} value={toMonth} onChange={event=>setToMonth(event.target.value)}/></label>}</div>}<p>Includes every calendar day, missing attendance, and a summary for each employee. Times are shown in India time.</p>{error&&<p role="alert" className="simple-error">{error}</p>}<button className="primary wide" disabled={busy||!employees.length}>{busy?'Preparing Excel…':'Download Excel'}</button></form></div>;
}
const localInput=(value?:string)=>{if(!value)return '';const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)};
function AttendanceEdit({entry,person,error,close,save}:{entry:AttendanceEntry;person?:User;error:string;close:()=>void;save:(clockInAt:string,clockOutAt:string)=>Promise<void>}){
  const [clockInAt,setClockInAt]=useState(localInput(entry.clockInAt)),[clockOutAt,setClockOutAt]=useState(localInput(entry.clockOutAt)),[busy,setBusy]=useState(false);
  return <div className="simple-modal-backdrop"><form role="dialog" aria-modal="true" aria-label="Correct attendance" className="simple-modal attendance-edit-modal" onSubmit={async event=>{event.preventDefault();setBusy(true);try{await save(new Date(clockInAt).toISOString(),new Date(clockOutAt).toISOString())}finally{setBusy(false)}}}><button type="button" className="simple-modal-close" aria-label="Close correction" disabled={busy} onClick={close}><X/></button><p className="modal-kicker">CORRECT ATTENDANCE</p><h2>{person?.name||'Employee'}</h2><p>Correct a missed or accidental clock action. Editing times use your device timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p><label>Clock in<input required type="datetime-local" value={clockInAt} onChange={event=>setClockInAt(event.target.value)}/></label><label>Clock out<input required type="datetime-local" min={clockInAt} value={clockOutAt} onChange={event=>setClockOutAt(event.target.value)}/></label>{error&&<p className="simple-error">{error}</p>}<button className="primary wide" disabled={busy||!clockInAt||!clockOutAt}>{busy?'Saving…':'Save corrected time'}</button></form></div>;
}
