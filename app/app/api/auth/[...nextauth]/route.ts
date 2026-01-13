import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

const handler = NextAuth({
    session: { strategy: "jwt" },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });
                if (!user) return null;

                const ok = await bcrypt.compare(credentials.password, user.password);
                if (!ok) return null;

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
            if (user && "role" in user) token.role = (user as { role?: string }).role;
            return token;
        },
        async session({ session, token }) {
            (session as { role?: unknown }).role = token.role;
            return session;
        },
    },
    pages: {
        signIn: "/signin",
    },
});

export { handler as GET, handler as POST };
