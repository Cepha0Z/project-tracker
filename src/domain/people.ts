import type { AppData } from '../types';

// Firebase Auth UID is linked to the stable user ID through authProfiles.
// Unlinked prototype people must never appear as assignable staff.
export const connectedPeople = (data:AppData) => data.users.filter(person =>
  Boolean(person.authUid) && person.active !== false && person.loginEnabled !== false,
);
