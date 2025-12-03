'use server'

import { signIn, signOut } from '@/auth'
import { signInFormSchema } from '../validator'
import { signUpFormSchema } from '../validator'
import db from '@/db/drizzle'
import { users } from '@/db/schema'
import { hashSync } from 'bcryptjs'

function formatError(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export async function signInWithCredentials(
  prevState: unknown,
  formData: FormData
) {
  try {
    const user = signInFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    })

    await signIn('credentials', user)

    return { success: true, message: 'Sign in successfully' }
  } catch (error) {
    return { success: false, message: 'Invalid email or password' }
  }
}

export const SignOut = async () => {
  await signOut()
}

export async function signUp(prevState: unknown, formData: FormData) {
  try {
    const user = signUpFormSchema.parse({
      name: formData.get('name'),
      email: formData.get('email'),
      confirmPassword: formData.get('confirmPassword'),
      password: formData.get('password'),
    })

    const values = {
      id: crypto.randomUUID(),
      name: user.name,
      email: user.email,
      password: hashSync(user.password, 10),
    }

    await db.insert(users).values(values)

    await signIn('credentials', {
      email: user.email,
      password: user.password,
    })

    return { success: true, message: 'User created successfully' }
  } catch (error) {
    return {
      success: false,
      message: formatError(error).includes(
        'duplicate key value violates unique constraint "user_email_idx"'
      )
        ? 'Email is already exist'
        : formatError(error),
    }
  }
}
