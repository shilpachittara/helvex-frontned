import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { linkGoogleAccount, loginWithCredentials } from "./lib/auth-api";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      cantonPartyId: string | null;
      kycStatus: string;
    };
  }

  interface User {
    cantonPartyId?: string | null;
    kycStatus?: string;
  }
}

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

const config = {
  // trustHost is required for self-hosted (non-Vercel) deploys. The host-header
  // injection risk it implies is neutralized by pinning AUTH_URL/NEXTAUTH_URL in
  // production (enforced at boot by assertFrontendProductionConfig): when set,
  // NextAuth derives callback/redirect URLs from that origin, not the Host header.
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await loginWithCredentials(String(email), String(password));
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          cantonPartyId: user.cantonPartyId,
          kycStatus: user.kycStatus,
        };
      },
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && account.providerAccountId && user.email) {
        // Only link when Google positively asserts the email is verified.
        // Linking is by email, so accepting an unverified (or absent-flag)
        // Google email would let an attacker who controls such an address take
        // over an existing account. Require an explicit `true`.
        if (!profile?.email_verified) return false;
        const linked = await linkGoogleAccount({
          email: user.email,
          googleId: account.providerAccountId,
          displayName: user.name ?? null,
        });
        if (!linked) return false;
        user.id = linked.id;
        user.cantonPartyId = linked.cantonPartyId;
        user.kycStatus = linked.kycStatus;
        return true;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.cantonPartyId = user.cantonPartyId ?? null;
        token.kycStatus = user.kycStatus ?? "PENDING";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.cantonPartyId = (token.cantonPartyId as string | null | undefined) ?? null;
        session.user.kycStatus = (token.kycStatus as string | undefined) ?? "PENDING";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);
