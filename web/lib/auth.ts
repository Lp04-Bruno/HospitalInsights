import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";

import { assertLoginAllowed, clearLoginRateLimit } from "@/lib/loginRateLimit";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();

        const allowed = await assertLoginAllowed(email, req).catch((err) => {
          console.error("[auth] Login rate limit check failed:", err);
          return false;
        });
        if (!allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user) return null;

        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;

        await clearLoginRateLimit(email, req).catch((err) => {
          console.warn("[auth] Login rate limit reset failed:", err);
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        } satisfies { id: string; email: string; name?: string; role: string };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && "role" in user) {
        const u = user as { id?: string; email?: string; role?: string };
        if (u.id) token.sub = u.id;
        if (u.role) token.role = u.role;
        if (u.email) token.email = u.email;
        return token;
      }

      if (typeof token.email === "string" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true },
        });

        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
