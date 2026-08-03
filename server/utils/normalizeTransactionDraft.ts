import { z } from 'zod'
import type { CategoryContext, TransactionDraft } from './types'

const FALLBACK_CATEGORY = 'อื่นๆ'

function buildLenientItemSchema(categories: CategoryContext[]) {
  const majorNames = new Set(categories.map((c) => c.major))

  return z
    .object({
      type: z.enum(['expense', 'income']).catch('expense'),
      amount: z.coerce.number().positive(),
      description: z.coerce.string().trim().catch(''),
      occurred_on: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .catch(() => todayInTimezone()),
      category: z
        .object({
          major: z
            .string()
            .trim()
            .refine((v) => majorNames.has(v))
            .catch(FALLBACK_CATEGORY),
          sub: z.string().trim().min(1).catch(FALLBACK_CATEGORY)
        })
        .nullable()
        .optional()
        .catch(null),
      allocations: z
        .array(
          z.object({
            fund: z.enum(['daily', 'fixed', 'savings']).catch('daily'),
            amount: z.coerce.number().positive()
          })
        )
        .catch([])
    })
    .transform((item) => {
      const allocationSum = item.allocations.reduce((sum, a) => sum + a.amount, 0)
      const allocations =
        item.allocations.length > 0 && Math.abs(allocationSum - item.amount) < 0.01
          ? item.allocations
          : [{ fund: 'daily' as const, amount: item.amount }]

      const category =
        item.type === 'expense' ? (item.category ?? { major: FALLBACK_CATEGORY, sub: FALLBACK_CATEGORY }) : (item.category ?? null)

      return { ...item, allocations, category }
    })
}

export function normalizeDraftItems(raw: unknown, categories: CategoryContext[]): TransactionDraft[] {
  const wrapperResult = z.object({ items: z.array(z.unknown()) }).safeParse(raw)
  if (!wrapperResult.success) return []

  const itemSchema = buildLenientItemSchema(categories)

  return wrapperResult.data.items
    .map((item) => itemSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data)
}
