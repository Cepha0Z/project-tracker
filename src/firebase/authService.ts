import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from '../types';
import { firebaseAuth, firebaseConfigured, firestoreDb } from './config';
import { presentUser } from '../domain/people';

type SessionListener = (profile: User | null) => void;

function friendlyAuthError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Incorrect email or password.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait and try again.';
  if (code.includes('network-request-failed')) return 'Unable to reach Firebase. Check your connection.';
  return error instanceof Error ? error.message : 'Unable to sign in.';
}

export const authService = {
  configured: firebaseConfigured,
  subscribe(listener: SessionListener, onError: (message: string) => void) {
    if (!firebaseAuth || !firestoreDb) { listener(null); return () => undefined; }
    return onAuthStateChanged(firebaseAuth, async authUser => {
      if (!authUser) { listener(null); return; }
      try {
        const mapping = await getDoc(doc(firestoreDb!, 'authProfiles', authUser.uid));
        if (!mapping.exists() || mapping.data().active === false) {
          await signOut(firebaseAuth!);
          onError('This account does not have an active Studio Projects profile.');
          listener(null);
          return;
        }
        const userId = String(mapping.data().userId);
        const profile = await getDoc(doc(firestoreDb!, 'users', userId));
        if (!profile.exists()) throw new Error('The user profile is missing from Firestore.');
        listener(presentUser({ ...(profile.data() as User), id: userId, access:mapping.data().access, authUid: authUser.uid, email: authUser.email || String(profile.data().email || '') }));
      } catch (error) { onError(friendlyAuthError(error)); listener(null); }
    }, error => onError(friendlyAuthError(error)));
  },
  async signIn(email: string, password: string) {
    if (!firebaseAuth) throw new Error('Firebase environment variables are not configured.');
    try { await signInWithEmailAndPassword(firebaseAuth, email.trim(), password); }
    catch (error) { throw new Error(friendlyAuthError(error)); }
  },
  async signOut() { if (firebaseAuth) await signOut(firebaseAuth); },
};
