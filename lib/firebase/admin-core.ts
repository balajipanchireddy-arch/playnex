import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

export function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin env vars missing. Check .env.local or Vercel Environment Variables.');
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    ...(storageBucket ? { storageBucket } : {}),
  });
}

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get: (_target, prop) => {
    const db = getFirestore(getAdminApp());
    const val = (db as any)[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  },
});

export const adminAuth: Auth = new Proxy({} as Auth, {
  get: (_target, prop) => {
    const auth = getAuth(getAdminApp());
    const val = (auth as any)[prop];
    return typeof val === 'function' ? val.bind(auth) : val;
  },
});

export const adminStorage: Storage = new Proxy({} as Storage, {
  get: (_target, prop) => {
    const st = getStorage(getAdminApp());
    const val = (st as any)[prop];
    return typeof val === 'function' ? val.bind(st) : val;
  },
});
