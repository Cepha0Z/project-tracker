import { useEffect, useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import type { User } from '../types';
import { notificationService, type NotificationRegistrationState } from '../services/notificationService';

export function NotificationControl({user}:{user:User}){
  const [state,setState]=useState<NotificationRegistrationState>('checking');
  const [message,setMessage]=useState('');
  useEffect(()=>{let active=true;notificationService.state().then(async value=>{if(value==='enabled'){try{await notificationService.refresh(user)}catch{value='available';if(active)setMessage('Tap to register this device again.')}}if(active)setState(value)});return()=>{active=false}},[user.id]);
  async function enable(){setState('checking');setMessage('');try{setState(await notificationService.enable(user))}catch(error){setState('available');setMessage(error instanceof Error?error.message:'Unable to enable notifications.')}}
  if(state==='unavailable')return null;
  return <div className="notification-control"><button disabled={state==='checking'||state==='enabled'||state==='denied'} onClick={enable}>{state==='enabled'?<Check size={15}/>:state==='denied'?<BellOff size={15}/>:<Bell size={15}/>}<span>{state==='checking'?'Checking notifications…':state==='enabled'?'Notifications enabled':state==='denied'?'Notifications blocked':'Enable notifications'}</span></button>{message&&<small>{message}</small>}</div>;
}
