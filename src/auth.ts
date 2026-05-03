import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

// --- TYPE AUGMENTATION ---
declare module "next-auth" {
  interface User {
    role?: string;
    schoolId?: string | null;
    school?: {
      slug: string;
    } | null;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      schoolId: string | null;
      schoolSlug: string | null;
    } 
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    schoolId?: string | null;
    schoolSlug?: string | null;
  }
}

// v4 Configuration Object
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsedCredentials = z
            .object({ email: z.string().email(), password: z.string().min(6) })
            .safeParse(credentials);

          if (parsedCredentials.success) {
            const { email, password } = parsedCredentials.data;
            
            const user = await prisma.user.findUnique({
              where: { email },
              include: { 
                school: {
                  select: { slug: true }
                }
              }
            });

            if (!user) {
              return null;
            }

            // 1. Try bcrypt comparison
            let passwordsMatch = await bcrypt.compare(password, user.password);

            // 2. Fallback: Plain text
            if (!passwordsMatch) {
                passwordsMatch = password === user.password;
            }

            if (passwordsMatch) {
              return {
                id: user.id,
                email: user.email,
                name: user.fullName,
                role: user.role,
                schoolId: user.schoolId,
                school: user.school,
              };
            }
          }
          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.schoolId = user.schoolId;
        token.schoolSlug = user.school?.slug;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        session.user.role = (token.role as string) || "STAFF";
        session.user.schoolId = (token.schoolId as string) || null;
        session.user.schoolSlug = (token.schoolSlug as string) || null;
      }
      return session;
    },
  },
};