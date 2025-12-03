import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { compareSync } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { NextAuthConfig } from 'next-auth'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import db from './db/drizzle'
import { users, carts } from './db/schema'

// 🔥 Session / JWT 타입만 확장 (AdapterUser는 건드리지 않음)
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role?: string
    }
  }
}

export const config = {
  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
  },
  session: {
    strategy: 'jwt',
  },
  adapter: DrizzleAdapter(db),
  providers: [
    CredentialsProvider({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null

        const foundUser = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        })
        if (!foundUser || !foundUser.password) return null

        const isMatch = compareSync(
          credentials.password as string,
          foundUser.password
        )
        if (!isMatch) return null

        // 🔥 여기서 role 포함해서 직접 객체 만들어서 반환
        return {
          id: foundUser.id,
          name: foundUser.name,
          email: foundUser.email,
          role: foundUser.role ?? 'user',
        }
      },
    }),
  ],
  callbacks: {
    // user 타입 꼬이는 거 싫으니까 any로 받아서 씀
    async jwt({ token, user }: any) {
      if (user) {
        token.sub = user.id
        token.name = user.name
        token.email = user.email
        token.role = user.role ?? 'user'

        const cookieStore = await cookies()
        const sessionCartId = cookieStore.get('sessionCartId')?.value

        if (sessionCartId) {
          const sessionCart = await db.query.carts.findFirst({
            where: eq(carts.sessionCartId, sessionCartId),
          })

          if (sessionCart && !sessionCart.userId) {
            await db
              .update(carts)
              .set({ userId: user.id })
              .where(eq(carts.id, sessionCart.id))
          }
        }
      }
      return token
    },

    async session({ session, token }: any) {
      session.user.id = token.sub as string
      session.user.name = token.name as string
      session.user.email = token.email as string
      session.user.role = (token.role as string) ?? 'user'
      return session
    },

    async authorized({ request, auth }: any) {
      const cookieStore = await cookies()

      const protectedPaths = [
        /\/shipping-address/,
        /\/payment-method/,
        /\/place-order/,
        /\/profile/,
        /\/user\/(.*)/,
        /\/order\/(.*)/,
        /\/admin/,
      ]

      const { pathname } = request.nextUrl

      if (!auth && protectedPaths.some((p) => p.test(pathname))) {
        return false
      }

      if (!cookieStore.get('sessionCartId')) {
        const sessionCartId = crypto.randomUUID()
        const response = NextResponse.next()
        response.cookies.set('sessionCartId', sessionCartId)
        return response
      }

      return true
    },
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)
