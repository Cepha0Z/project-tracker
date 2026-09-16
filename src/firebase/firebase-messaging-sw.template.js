/* Generated into dist/firebase-messaging-sw.js by scripts/build-messaging-worker.mjs. */
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||'/';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    const absolute=new URL(target,self.location.origin).href;
    for(const client of windows){
      if(new URL(client.url).origin===self.location.origin){client.navigate(absolute);return client.focus()}
    }
    return self.clients.openWindow(absolute);
  }));
});

importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp(__FIREBASE_CONFIG__);
const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  // Notification payloads are displayed by the browser/FCM. Only data-only
  // messages need the service worker to create a notification explicitly.
  if(payload.notification)return;
  const data=payload.data||{};
  self.registration.showNotification(data.title||'Studio Projects',{
    body:data.body||'A project needs your attention.',
    icon:data.icon||'/project-tracker-icon-192.png',
    badge:data.badge||'/project-tracker-icon-192.png',
    tag:data.tag||'studio-projects',
    data:{url:data.url||'/'},
  });
});
