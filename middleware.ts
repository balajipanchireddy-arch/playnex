import { NextResponse, type NextRequest } from 'next/server';
const PROTECTED = ['/dashboard', '/player', '/staff', '/academy', '/store', '/admin'];
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
  const hasCookie = req.cookies.get('playnex_session')?.value;
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/dashboard/:path*','/player/:path*','/staff/:path*','/academy/:path*','/store/:path*','/admin/:path*'] };
