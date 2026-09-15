import type { ReactNode } from 'react';
import { AlertTriangle, Check, Clock3 } from 'lucide-react';
import type { User, WorkStatus } from '../types';

export function Avatar({ user, size = 'md' }: { user?: User; size?: 'sm'|'md'|'lg' }) {
  return <span className={`avatar avatar-${size}`} style={{background:user?.tone}}>{user?.initials ?? '?'}</span>;
}

export function StatusPill({ status }: { status: WorkStatus }) {
  const icon = status === 'Completed' ? <Check size={12}/> : status === 'Blocked' ? <AlertTriangle size={12}/> : status === 'In Progress' ? <Clock3 size={12}/> : null;
  return <span className={`status status-${status.toLowerCase().replaceAll(' ','-')}`}>{icon}{status}</span>;
}

export function Progress({ value, compact = false }: { value: number; compact?: boolean }) {
  return <div className={`progress-wrap ${compact?'compact':''}`}><div className="progress-track"><span style={{width:`${value}%`}} /></div>{!compact && <strong>{value}%</strong>}</div>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function Modal({ title, subtitle, onClose, children }: { title:string; subtitle?:string; onClose:()=>void; children:ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">Studio Projects</p><h2>{title}</h2>{subtitle && <p className="modal-subtitle">{subtitle}</p>}{children}</div></div>;
}

export function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});
}

export function minutesLabel(minutes:number) {
  const h=Math.floor(minutes/60), m=minutes%60;
  return [h?`${h}h`:'',m?`${m}m`:''].filter(Boolean).join(' ') || '0m';
}
