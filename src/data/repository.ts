import type { AppData } from '../types';
import { firebaseRepository } from './firebaseRepository';

export interface AppRepository {
  load(): AppData;
  subscribe(onData:(data:AppData)=>void,onError:(error:Error)=>void):()=>void;
  save(data: AppData, previous:AppData): Promise<void>;
  importLocal(currentCloud:AppData):Promise<void>;
}

export const repository: AppRepository = firebaseRepository;
