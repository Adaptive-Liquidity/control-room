import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      email: string;
      name?: string | null;
      needsSetup?: boolean;
      lastActiveProjectId?: string | null;
    };
  }

  interface User {
    role: string;
    lastActiveProjectId?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
    id: string;
    needsSetup?: boolean;
    lastActiveProjectId?: string | null;
    claimsRefreshedAt?: number;
  }
}
