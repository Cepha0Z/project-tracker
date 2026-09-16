import {
  Timestamp,
  collection,
  deleteField,
  doc,
  onSnapshot,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AppData } from '../types';
import { firestoreDb } from '../firebase/config';
import { localStore } from './storage';
import { presentUser } from '../domain/people';

const collections = {
  users: 'users',
  projects: 'projects',
  workItems: 'workItems',
  updates: 'dailyUpdates',
  helpRequests: 'helpRequests',
  activities: 'activity',
  cycles: 'cycles',
  timeEntries: 'timeEntries',
  dailyReports: 'dailyReports',
} as const;

type EntityKey = keyof typeof collections;
type Entity = AppData[EntityKey] extends Array<infer T> ? T : never;
const instantFields = new Set(['createdAt','updatedAt','startedAt','completedAt','closedAt','escalatedAt','respondedAt','decidedAt','resolvedAt']);

const emptyData = (): AppData => ({
  users: [], projects: [], workItems: [], updates: [], helpRequests: [], activities: [],
  cycles: [], timeEntries: [], dailyReports: [], schemaVersion: 6,
});

function encode(value: unknown, key = ''): unknown {
  if (value === undefined) return undefined;
  if (typeof value === 'string' && instantFields.has(key)) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? value : Timestamp.fromMillis(parsed);
  }
  if (Array.isArray(value)) return value.map(entry => encode(entry)).filter(entry => entry !== undefined);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).flatMap(([childKey, child]) => {
    const encoded = encode(child, childKey);
    return encoded === undefined ? [] : [[childKey, encoded]];
  }));
  return value;
}

function decode(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decode(child)]));
  return value;
}

const same = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (same(before[key], after[key])) continue;
    patch[key] = after[key] === undefined ? deleteField() : encode(after[key], key);
  }
  return patch;
}

async function persist(data: AppData, previous: AppData) {
  if (!firestoreDb) throw new Error('Firebase is not configured.');
  const batch = writeBatch(firestoreDb);
  let operations = 0;
  for (const [key, collectionName] of Object.entries(collections) as [EntityKey,string][]) {
    const before = new Map((previous[key] as Entity[]).map(entity => [(entity as {id:string}).id, entity]));
    const after = new Map((data[key] as Entity[]).map(entity => [(entity as {id:string}).id, entity]));
    for (const [id, entity] of after) {
      const reference = doc(firestoreDb, collectionName, id);
      const old = before.get(id);
      if (!old) { batch.set(reference, encode(entity) as DocumentData); operations++; continue; }
      const fields = changedFields(old as Record<string,unknown>, entity as Record<string,unknown>);
      if (Object.keys(fields).length) { batch.update(reference, fields); operations++; }
    }
    for (const id of before.keys()) if (!after.has(id)) { batch.delete(doc(firestoreDb, collectionName, id)); operations++; }
  }
  if (operations) await batch.commit();
}

let writeQueue = Promise.resolve();

export const firebaseRepository = {
  load: emptyData,
  subscribe(onData: (data: AppData) => void, onError: (error: Error) => void): Unsubscribe {
    if (!firestoreDb) { onError(new Error('Firebase is not configured.')); return () => undefined; }
    const current = emptyData();
    const ready = new Set<EntityKey>();
    const stops = (Object.entries(collections) as [EntityKey,string][]).map(([key, collectionName]) => onSnapshot(
      collection(firestoreDb!, collectionName),
      snapshot => {
        (current[key] as Entity[]) = snapshot.docs.map(snapshotDoc => {
          const value = decode(snapshotDoc.data()) as Record<string,unknown>;
          const entity={...value,id:String(value.id || snapshotDoc.id)} as Entity;
          return key==='users'?presentUser(entity as AppData['users'][number]) as Entity:entity;
        });
        ready.add(key);
        if (ready.size === Object.keys(collections).length) onData(structuredClone(current));
      },
      error => onError(error),
    ));
    return () => stops.forEach(stop => stop());
  },
  save(data: AppData, previous: AppData) {
    // One rejected batch must not permanently prevent later independent writes.
    writeQueue = writeQueue.catch(() => undefined).then(() => persist(data, previous));
    return writeQueue;
  },
  importLocal(currentCloud: AppData) {
    const legacy = localStore.load();
    const legacyUserIds = new Set(legacy.users.map(user => user.id));
    const merged: AppData = {...legacy,users:[...legacy.users.map(user => {
      const cloud = currentCloud.users.find(candidate => candidate.id === user.id);
      return cloud ? {...user,email:cloud.email,authUid:cloud.authUid,active:cloud.active,loginEnabled:cloud.loginEnabled} : user;
    }), ...currentCloud.users.filter(user => !legacyUserIds.has(user.id))]};
    return persist(merged, currentCloud);
  },
};
