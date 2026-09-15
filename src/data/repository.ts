import type { AppData } from '../types';
import { localStore } from './storage';

export interface AppRepository {
  load(): AppData;
  save(data: AppData): void;
  reset(): AppData;
}

export const repository: AppRepository = localStore;
