import { getInstallations, getId } from 'firebase/installations';
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User } from '../types';
import { firebaseApp, firebaseAuth, firestoreDb } from '../firebase/config';

const VAPID_PUBLIC_KEY='BMMIIMECa4Nkm0cg7JbvQi69t9va9efxSN1qhGwes0iWX8PDJIQz_F8TLV8lVjX374hvflLI-LmFLuEiWsQa5d8';

export type NotificationRegistrationState='checking'|'available'|'enabled'|'denied'|'unavailable';
export type ForegroundNotification={title:string;body:string;url:string};

const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
const platform=()=>ios()?'iOS':/Android/.test(navigator.userAgent)?'Android':'Desktop';
const browser=()=>/CriOS|Chrome/.test(navigator.userAgent)?'Chrome':/FxiOS|Firefox/.test(navigator.userAgent)?'Firefox':/Safari/.test(navigator.userAgent)?'Safari':'Browser';

function iosWebPushVersion(){
  const match=navigator.userAgent.match(/(?:CPU (?:iPhone )?OS|iPhone OS) (\d+)[._](\d+)/);
  if(!match)return navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const major=Number(match[1]),minor=Number(match[2]);
  return major>16||(major===16&&minor>=4);
}

function webPushApisAvailable(){
  return Boolean(firebaseApp&&firebaseAuth&&firestoreDb&&window.isSecureContext&&'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window&&'fetch' in window);
}

async function supported(){
  if(!webPushApisAvailable())return false;
  // iOS/iPadOS Web Push is available only to installed Home Screen apps from 16.4.
  // Do not use Firebase's broader asynchronous preflight as the render gate here:
  // its IndexedDB probe can return a false negative before the user's permission gesture.
  if(ios())return standalone()&&iosWebPushVersion();
  return isSupported();
}

async function firebaseMessagingSupported(){
  return webPushApisAvailable()&&await isSupported();
}

async function registerDevice(user:User){
  if(!firebaseApp||!firebaseAuth?.currentUser||!firestoreDb)throw new Error('Firebase is not ready.');
  const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/',updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  if(!await firebaseMessagingSupported())throw new Error('Firebase Messaging could not initialize on this device.');
  const messaging=getMessaging(firebaseApp);
  const token=await getToken(messaging,{vapidKey:VAPID_PUBLIC_KEY,serviceWorkerRegistration:registration});
  if(!token)throw new Error('This browser did not return a notification registration.');
  const installationId=await getId(getInstallations(firebaseApp));
  const reference=doc(firestoreDb,'notificationDevices',`${firebaseAuth.currentUser.uid}_${installationId}`);
  const existing=await getDoc(reference);
  await setDoc(reference,{
    userId:user.id,
    authUid:firebaseAuth.currentUser.uid,
    installationId,
    token,
    platform:platform(),
    browser:browser(),
    enabled:true,
    lastSeenAt:serverTimestamp(),
    ...(existing.exists()?{}:{createdAt:serverTimestamp()}),
  },{merge:true});
}

async function deviceReference(){
  if(!firebaseApp||!firebaseAuth?.currentUser||!firestoreDb)return null;
  const installationId=await getId(getInstallations(firebaseApp));
  return doc(firestoreDb,'notificationDevices',`${firebaseAuth.currentUser.uid}_${installationId}`);
}

export const notificationService={
  async state():Promise<NotificationRegistrationState>{
    if(!await supported())return 'unavailable';
    if(Notification.permission==='denied')return 'denied';
    return Notification.permission==='granted'?'enabled':'available';
  },
  async enable(user:User):Promise<NotificationRegistrationState>{
    if(ios()&&!standalone())throw new Error('On iPhone, add Studio Projects to your Home Screen and enable notifications from the installed app.');
    if(!await supported())throw new Error('Push notifications are not supported in this browser.');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')return permission==='denied'?'denied':'available';
    await registerDevice(user);
    return 'enabled';
  },
  async refresh(user:User){
    if(await supported()&&Notification.permission==='granted')await registerDevice(user);
  },
  async disable(){
    if(!firebaseApp)return;
    const reference=await deviceReference();
    if(reference)await deleteDoc(reference).catch(()=>undefined);
    if(await supported())await deleteToken(getMessaging(firebaseApp)).catch(()=>undefined);
  },
  async subscribeForeground(listener:(notification:ForegroundNotification)=>void){
    if(!firebaseApp||!await firebaseMessagingSupported())return ()=>undefined;
    return onMessage(getMessaging(firebaseApp),(payload:MessagePayload)=>listener({
      title:payload.data?.title||payload.notification?.title||'Studio Projects',
      body:payload.data?.body||payload.notification?.body||'A project needs your attention.',
      url:payload.data?.url||'/',
    }));
  },
};
