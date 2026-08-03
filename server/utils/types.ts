import { z } from 'zod'

export const transactionAllocationSchema = z.object({
  fund: z.enum(['daily', 'fixed', 'savings']),
  amount: z.number().positive()
})

export const transactionDraftSchema = z
  .object({
    type: z.enum(['expense', 'income']).default('expense'),
    amount: z.number().positive(),
    description: z.string(),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: z
      .object({
        major: z.string(),
        sub: z.string()
      })
      .nullable()
      .optional(),
    allocations: z.array(transactionAllocationSchema).min(1)
  })
  .refine(
    (data) => Math.abs(data.allocations.reduce((sum, a) => sum + a.amount, 0) - data.amount) < 0.01,
    { message: 'allocations must sum to amount', path: ['allocations'] }
  )
  .refine((data) => data.type === 'income' || data.category != null, {
    message: 'category is required for expense items',
    path: ['category']
  })

export type TransactionAllocationDraft = z.infer<typeof transactionAllocationSchema>
export type TransactionDraft = z.infer<typeof transactionDraftSchema>

export interface CategoryContext {
  major: string
  subs: string[]
}
