'use server'

import { cookies } from 'next/headers'
import { auth } from '@/auth'
import db from '@/db/drizzle'
import { carts, products } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cartItemSchema } from '@/lib/validator'
import { formatError, round2 } from '@/lib/utils'

// GET CART
export async function getMyCart() {
  const cookieStore = await cookies()
  const sessionCartId = cookieStore.get('sessionCartId')?.value
  if (!sessionCartId) return undefined

  const session = await auth()
  const userId = session?.user.id

  return db.query.carts.findFirst({
    where: userId
      ? eq(carts.userId, userId)
      : eq(carts.sessionCartId, sessionCartId),
  })
}

// PRICE HELPER
const calcPrice = (items: z.infer<typeof cartItemSchema>[]) => {
  const itemsPrice = round2(
    items.reduce((acc: number, item: any) => acc + item.price * item.qty, 0)
  )
  const shippingPrice = round2(itemsPrice > 100 ? 0 : 10)
  const taxPrice = round2(itemsPrice * 0.15)
  const totalPrice = round2(itemsPrice + shippingPrice + taxPrice)

  return {
    itemsPrice: itemsPrice.toFixed(2),
    shippingPrice: shippingPrice.toFixed(2),
    taxPrice: taxPrice.toFixed(2),
    totalPrice: totalPrice.toFixed(2),
  }
}

// ADD ITEM
export const addItemToCart = async (data: z.infer<typeof cartItemSchema>) => {
  try {
    const cookieStore = await cookies()
    const sessionCartId = cookieStore.get('sessionCartId')?.value
    if (!sessionCartId) throw new Error('Cart Session not found')

    const session = await auth()
    const userId = session?.user.id as string | undefined
    const cart = await getMyCart()
    const item = cartItemSchema.parse(data)

    const product = await db.query.products.findFirst({
      where: eq(products.id, item.productId),
    })
    if (!product) throw new Error('Product not found')

    if (!cart) {
      if (product.stock < 1) throw new Error('Not enough stock')

      await db.insert(carts).values({
        userId,
        items: [item],
        sessionCartId,
        ...calcPrice([item]),
      })

      revalidatePath(`/product/${product.slug}`)
      return { success: true, message: 'Item added' }
    }

    const existItem = cart.items.find(
      (x: any) => x.productId === item.productId
    )

    if (existItem) {
      if (product.stock < existItem.qty + 1) throw new Error('Not enough stock')
      existItem.qty++
    } else {
      if (product.stock < 1) throw new Error('Not enough stock')
      cart.items.push(item)
    }

    await db
      .update(carts)
      .set({
        items: cart.items,
        ...calcPrice(cart.items),
      })
      .where(eq(carts.id, cart.id))

    revalidatePath(`/product/${product.slug}`)
    return {
      success: true,
      message: `${product.name} ${existItem ? 'updated' : 'added'}`,
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// REMOVE ITEM
export const removeItemFromCart = async (productId: string) => {
  try {
    const cookieStore = await cookies()
    const sessionCartId = cookieStore.get('sessionCartId')?.value
    if (!sessionCartId) throw new Error('Cart Session not found')

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    })
    if (!product) throw new Error('Product not found')

    const cart: any = await getMyCart()
    if (!cart) throw new Error('Cart not found')

    const existItem = cart.items.find((x: any) => x.productId === productId)
    if (!existItem) throw new Error('Item not found')

    if (existItem.qty <= 1) {
      cart.items = cart.items.filter((x: any) => x.productId !== productId)
    } else {
      existItem.qty--
    }

    await db
      .update(carts)
      .set({
        items: cart.items,
        ...calcPrice(cart.items),
      })
      .where(eq(carts.id, cart.id))

    revalidatePath(`/product/${product.slug}`)
    return { success: true, message: 'Updated cart' }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}
