import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin env vars missing. Check Vercel Environment Variables.');
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// We use Proxies here so Vercel doesn't try to connect during the build process.
// It will only connect when an actual API request is made.
export const adminDb = new Proxy({} as any, {
  get: (target, prop) => {
    const db = getFirestore(getAdminApp());
    return (db as any)[prop];
  }
});

export const adminAuth = new Proxy({} as any, {
  get: (target, prop) => {
    const auth = getAuth(getAdminApp());
    return (auth as any)[prop];
  }
});
