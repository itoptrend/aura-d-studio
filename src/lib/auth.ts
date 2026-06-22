import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login'
  },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.appUser.findUnique({
          where: { email: credentials.email },
          include: { memberships: true }
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        const teamId = user.memberships[0]?.teamId;
        if (!teamId) return null; // every user should have at least one team from signup

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          teamId
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.teamId = user.teamId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.teamId = token.teamId;
      }
      return session;
    }
  }
};
