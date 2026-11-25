import { NextResponse } from 'next/server';
export const ok = <T,>(data: T, status = 200) => NextResponse.json({ ok: true, data }, { status });
export const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ ok: false, error: { code, message } }, { status });
