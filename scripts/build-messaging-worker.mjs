import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const root=resolve(import.meta.dirname,'..');
const loaded=loadEnv('production',root,'');
const value=name=>process.env[name]||loaded[name];
const config={
  apiKey:value('VITE_FIREBASE_API_KEY'),
  authDomain:value('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId:value('VITE_FIREBASE_PROJECT_ID'),
  storageBucket:value('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId:value('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId:value('VITE_FIREBASE_APP_ID'),
};
const missing=Object.entries(config).filter(([,entry])=>!entry).map(([name])=>name);
if(missing.length)throw new Error(`Cannot build Firebase messaging worker; missing: ${missing.join(', ')}`);
const template=await readFile(resolve(root,'src/firebase/firebase-messaging-sw.template.js'),'utf8');
await writeFile(resolve(root,'dist/firebase-messaging-sw.js'),template.replace('__FIREBASE_CONFIG__',JSON.stringify(config)),'utf8');
console.log('Generated dist/firebase-messaging-sw.js with Firebase web configuration.');
