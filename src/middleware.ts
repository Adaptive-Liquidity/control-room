import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const onSetup = pathname.startsWith('/setup');

    if (token?.needsSetup && !onSetup) {
      return NextResponse.redirect(new URL('/setup', req.url));
    }
    if (token && !token.needsSetup && onSetup && token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: '/auth/signin' },
  }
);

export const config = {
  matcher: [
    '/setup',
    '/setup/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/agents',
    '/agents/:path*',
    '/queue',
    '/queue/:path*',
    '/studio',
    '/studio/:path*',
    '/calendar',
    '/calendar/:path*',
    '/attribution',
    '/attribution/:path*',
    '/analytics',
    '/analytics/:path*',
    '/ablab',
    '/ablab/:path*',
    '/campaigns',
    '/campaigns/:path*',
    '/team',
    '/team/:path*',
    '/settings',
    '/settings/:path*',
    '/library',
    '/library/:path*',
    '/audit',
    '/audit/:path*',
  ],
};
