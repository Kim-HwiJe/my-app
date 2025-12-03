import * as z from 'zod'
import { products } from '@/db/schema'
import { cartItemSchema } from '@/lib/validator'
import { InferSelectModel } from 'drizzle-orm'

// PRODUCTS
export type Product = InferSelectModel<typeof products>

// CART ITEM
export type CartItem = z.infer<typeof cartItemSchema>
