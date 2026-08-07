import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "unset",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "unset",
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      // Single-user app: only the allowlisted Google account may sign in
      const allowed = process.env.ALLOWED_EMAIL;
      return !!allowed && profile?.email === allowed;
    },
  },
  pages: { signIn: "/signin" },
});
