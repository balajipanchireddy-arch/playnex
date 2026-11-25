import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';
export const SESSION_COOKIE = 'playnex_session';
const MAX_AGE = Number(process.env.SESSION_COOKIE_MAX_AGE ?? 432000000);
export async function verifySession() {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return decoded;
  } catch { return null; }
}
export async function setSessionCookie(idToken: string) {
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: MAX_AGE });
  cookies().set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: MAX_AGE / 1000, path: '/',
  });
}
export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}
