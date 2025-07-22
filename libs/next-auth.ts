import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import config from "@/config";
import prisma from "./prisma";

interface NextAuthOptionsExtended extends NextAuthOptions {
  adapter: any;
}

export const authOptions: NextAuthOptionsExtended = {
  // Set any random key in .env.local
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      // Follow the "Login with Google" tutorial to get your credentials
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      async profile(profile) {
        return {
          id: profile.sub,
          name: profile.given_name ? profile.given_name : profile.name,
          email: profile.email,
          image: profile.picture,
          createdAt: new Date(),
        };
      },
    }),
    // Follow the "Login with Email" tutorial to set up your email server
    // Requires a PostgreSQL database. Set DATABASE_URL env variable.
    ...(process.env.DATABASE_URL
      ? [
          EmailProvider({
            server: process.env.EMAIL_SERVER,
            from: config.mailgun.fromNoReply,
          }),
        ]
      : []),
  ],
  // New users will be saved in Database (PostgreSQL). Each user (model) has some fields like name, email, image, etc..
  // Requires a PostgreSQL database. Set DATABASE_URL env variable.
  // Learn more about the model type: https://next-auth.js.org/v3/adapters/models
  ...(process.env.DATABASE_URL && { adapter: PrismaAdapter(prisma) }),

  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    jwt: async ({ token, user, account }) => {
      // Add user info to JWT for Express API
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.plan = (user as any).plan || 'free';
        token.aud = 'whisnap-api'; // Audience for Express API
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  jwt: {
    // Use RS256 for Express API validation
    signingKey: process.env.NEXTAUTH_SECRET,
    maxAge: 5 * 60, // 5 minutes for security
  },
  theme: {
    brandColor: config.colors.main,
    // Add you own logo below. Recommended size is rectangle (i.e. 200x50px) and show your logo + name.
    // It will be used in the login flow to display your logo. If you don't add it, it will look faded.
    logo: `https://${config.domainName}/logoAndName.png`,
  },
};

export default NextAuth(authOptions);
