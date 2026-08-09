import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/auth/signin' },
});

export const config = {
  matcher: [
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
  ],
};
