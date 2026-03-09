import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Pass OAuth data to token on initial sign in
      if (account && profile) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        token.oauthEmail = profile.email;
        token.oauthName = profile.name || (profile as Record<string, unknown>).login as string;
        token.oauthAvatarUrl = profile.image || (profile as Record<string, unknown>).avatar_url as string;
      }
      return token;
    },
    async session({ session, token }) {
      // Pass OAuth data to session
      if (token.provider) {
        session.provider = token.provider as string;
        session.providerAccountId = token.providerAccountId as string;
        session.oauthEmail = token.oauthEmail as string;
        session.oauthName = token.oauthName as string;
        session.oauthAvatarUrl = token.oauthAvatarUrl as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
});

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    provider?: string;
    providerAccountId?: string;
    oauthEmail?: string;
    oauthName?: string;
    oauthAvatarUrl?: string;
  }
}
