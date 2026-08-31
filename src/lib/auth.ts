// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { evaluateSetupGate } from '@/lib/setup/setup-gate';

async function computeNeedsSetup(userId: string): Promise<{
  needsSetup: boolean;
  lastActiveProjectId: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActiveProjectId: true },
  });
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          company: true,
          activeContextVersion: true,
        },
      },
    },
  });
  const gate = evaluateSetupGate({
    memberships: memberships.map((m) => ({
      projectId: m.projectId,
      companyId: m.project.companyId,
      hasPublishedCompanyPack: Boolean(m.project.company.activeContextVersionId),
      hasPublishedProjectPack: Boolean(m.project.activeContextVersionId),
    })),
  });
  return {
    needsSetup: !gate.ready,
    lastActiveProjectId: user?.lastActiveProjectId ?? null,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.isActive || !user.password) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastActiveProjectId: user.lastActiveProjectId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      const now = Math.floor(Date.now() / 1000);
      const shouldRefresh =
        Boolean(user) ||
        trigger === 'update' ||
        !token.claimsRefreshedAt ||
        now - token.claimsRefreshedAt > 300;

      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.lastActiveProjectId = user.lastActiveProjectId ?? null;
      }

      if (shouldRefresh && token.id) {
        try {
          const claims = await computeNeedsSetup(token.id as string);
          token.needsSetup = claims.needsSetup;
          token.lastActiveProjectId = claims.lastActiveProjectId;
          token.claimsRefreshedAt = now;
        } catch {
          // DB unavailable during edge cases — keep prior claims
          token.claimsRefreshedAt = now;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.needsSetup = Boolean(token.needsSetup);
        session.user.lastActiveProjectId = token.lastActiveProjectId ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
