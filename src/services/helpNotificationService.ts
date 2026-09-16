import type { AppData } from '../types';
import { firebaseAuth } from '../firebase/config';
import { notificationChanges, type NotificationEvent } from './notificationEvents';

const ENDPOINT='https://morning-night-85ab.cephajj1.workers.dev/notifications/help';

async function dispatch(id:string,event:NotificationEvent){
  const authUser=firebaseAuth?.currentUser;
  if(!authUser)throw new Error('Saved, but sending the notification requires a signed-in session.');
  const idToken=await authUser.getIdToken();
  const response=await fetch(ENDPOINT,{
    method:'POST',
    headers:{Authorization:`Bearer ${idToken}`,'Content-Type':'application/json'},
    body:JSON.stringify(event==='daily_report_submitted'?{reportId:id,event}:{requestId:id,event}),
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.success!==true)throw new Error(`Notification delivery failed (${response.status}): ${result.error||'Please try again.'}`);
  if(event==='daily_report_submitted'&&!result.duplicate){
    if(result.attempted===0)throw new Error('Report saved, but no admin notification devices are registered.');
    if(result.failed>0)throw new Error(`Report saved, but ${result.failed} device notification(s) failed.`);
    if(typeof result.recipientCount==='number'&&result.registeredRecipients<result.recipientCount)
      throw new Error('Report saved, but one or more admins have not enabled notifications.');
  }
}

export const helpNotificationService={
  async dispatchChanges(before:AppData,after:AppData){
    const outcomes=await Promise.allSettled(notificationChanges(before,after).map(change=>dispatch(change.id,change.event)));
    const failed=outcomes.find(result=>result.status==='rejected');
    if(failed?.status==='rejected')throw failed.reason;
  },
};
