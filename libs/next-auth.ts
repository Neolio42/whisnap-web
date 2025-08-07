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
    signIn: async ({ user, account, profile }) => {
      if (!user?.email) return false;

      // Admin always allowed (that's you!)
      const ADMIN_EMAIL = 'nedeliss@gmail.com';
      if (user.email === ADMIN_EMAIL) {
        return true;
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (existingUser) {
        // Existing user - auto-link accounts with same email
        if (account?.provider) {
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
          });
          
          if (!existingAccount) {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state,
              },
            });
          }
        }
        return true;
      }

      // New user - check for valid invitation
      const invitation = await prisma.invitation.findFirst({
        where: {
          email: user.email,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!invitation) {
        // No valid invitation - save email as lead and reject signin
        try {
          await prisma.lead.upsert({
            where: { email: user.email },
            update: { updatedAt: new Date() },
            create: { email: user.email },
          });
        } catch (error) {
          console.error('Failed to save lead email:', error);
        }
        // Return false to reject signin - NextAuth will redirect to error page
        return false;
      }

      // Valid invitation - mark as used
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          used: true,
          usedBy: user.id || 'pending', // Will be updated after user creation
        },
      });

      return true;
    },
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
    maxAge: 60 * 60, // 1 hour for better UX
  },
  pages: {
    error: '/auth/invitation-required', // Custom error page for rejected signins
  },
  theme: {
    brandColor: config.colors.main,
    // Add you own logo below. Recommended size is rectangle (i.e. 200x50px) and show your logo + name.
    // It will be used in the login flow to display your logo. If you don't add it, it will look faded.
    // logo: `https://${config.domainName}/logoAndName.png`,
  },
};

export default NextAuth(authOptions);
