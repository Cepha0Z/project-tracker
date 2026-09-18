import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Plus, X } from 'lucide-react';
import type { AppData, Meeting, User } from '../types';
import { connectedPeople } from '../domain/people';
import { localDateKey } from '../domain/selectors';
import { permissions } from '../permissions/permissions';
import { meetingService } from '../services/meetingService';
import { Empty } from './ui';
import './meetings.css';

type Mutate = (fn: (data: AppData) => AppData) => void;

const displayDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric',
});

function attendeeNames(data: AppData, meeting: Meeting) {
  return meeting.attendeeIds.map(id => data.users.find(person => person.id === id)?.name || 'Former team member').join(', ') || '—';
}

function meetingProject(data: AppData, meeting: Meeting) {
  return meeting.projectId === null ? 'General / No Project'
    : data.projects.find(project => project.id === meeting.projectId)?.name || 'Project unavailable';
}

export function MeetingsPage({data, user, mutate}: {data: AppData; user: User; mutate: Mutate}) {
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const meetings = meetingService.visible(data, user.id);
  const selected = meetings.find(meeting => meeting.id === selectedId);
  return <div className="page simple-page meetings-page">
    <div className="simple-title row"><div><p>STUDIO RECORDS</p><h1>Meetings</h1><span>Discussions and decisions, recorded in one place.</span></div><button className="primary" onClick={() => setCreating(true)}><Plus size={17}/> New Meeting</button></div>
    <section className="meetings-list" aria-label="Recorded meetings">
      <div className="meetings-list-head"><span>DATE</span><span>MEETING</span><span>PROJECT</span><span>ATTENDEES</span></div>
      {meetings.map(meeting => <button type="button" className="meeting-row" key={meeting.id} onClick={() => setSelectedId(meeting.id)}>
        <time dateTime={meeting.date}>{displayDate(meeting.date)}</time><strong>{meeting.title}</strong><span>{meetingProject(data, meeting)}</span><span>{attendeeNames(data, meeting)}</span><ArrowRight size={16}/>
      </button>)}
      {!meetings.length && <Empty>No meetings recorded yet.</Empty>}
    </section>
    {creating && <NewMeeting data={data} user={user} mutate={mutate} close={() => setCreating(false)}/>}
    {selected && <MeetingDetails data={data} meeting={selected} close={() => setSelectedId(null)}/>}
  </div>;
}

function NewMeeting({data, user, mutate, close}: {data: AppData; user: User; mutate: Mutate; close: () => void}) {
  const [date, setDate] = useState(localDateKey());
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const projects = data.projects.filter(project => permissions.canViewProject(user, project));
  const people = connectedPeople(data);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!date || !title.trim()) { setError('Add a date and meeting title.'); return; }
    const input = {date, title, projectId: projectId || null, attendeeIds, notes};
    if (meetingService.create(data, user.id, input) === data) { setError('Check the meeting details and try again.'); return; }
    mutate(current => meetingService.create(current, user.id, input));
    close();
  }
  return createPortal(<div className="simple-modal-backdrop" onMouseDown={close}><form className="simple-modal meeting-modal" onSubmit={submit} onMouseDown={event => event.stopPropagation()}>
    <button type="button" className="simple-modal-close" onClick={close} aria-label="Close"><X/></button>
    <p className="modal-kicker">NEW MEETING</p><h2>Record a meeting</h2>
    <label>Date<input type="date" required value={date} onChange={event => setDate(event.target.value)}/></label>
    <label>Meeting title / subject<input autoFocus required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="What was the meeting about?"/></label>
    <label>Project<select value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">General / No Project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
    <fieldset className="meeting-attendees"><legend>Attendees</legend><div>{people.map(person => <label key={person.id}><input type="checkbox" checked={attendeeIds.includes(person.id)} onChange={() => setAttendeeIds(current => current.includes(person.id) ? current.filter(id => id !== person.id) : [...current, person.id])}/>{person.name}</label>)}</div>{!people.length && <small>No Firebase-linked people are available.</small>}</fieldset>
    <label>Notes<textarea value={notes} maxLength={20000} onChange={event => setNotes(event.target.value)} placeholder="What was discussed or decided?"/></label>
    {error && <p className="simple-error" role="alert">{error}</p>}
    <button className="primary wide" type="submit">Save meeting</button>
  </form></div>, document.body);
}

function MeetingDetails({data, meeting, close}: {data: AppData; meeting: Meeting; close: () => void}) {
  return createPortal(<div className="simple-modal-backdrop" onMouseDown={close}><div className="simple-modal meeting-modal meeting-details" role="dialog" aria-modal="true" aria-label={meeting.title} onMouseDown={event => event.stopPropagation()}>
    <button type="button" className="simple-modal-close" onClick={close} aria-label="Close"><X/></button>
    <p className="modal-kicker">MEETING RECORD</p><h2>{meeting.title}</h2>
    <dl><div><dt>Date</dt><dd>{displayDate(meeting.date)}</dd></div><div><dt>Project</dt><dd>{meetingProject(data, meeting)}</dd></div><div><dt>Attendees</dt><dd>{attendeeNames(data, meeting)}</dd></div></dl>
    <section><h3>Notes</h3><p>{meeting.notes || 'No notes recorded.'}</p></section>
  </div></div>, document.body);
}
