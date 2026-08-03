import { z } from 'zod'
import { transactionDraftSchema } from '../../utils/types'

const requestSchema = z.object({
  profileId: z.string().min(1),
  items: z.array(transactionDraftSchema).min(1)
})

export default defineEventHandler(async (event) => {
  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const body = parsedBody.data

  const supabase = useSupabase()
  const insertedIds: string[] = []
  const createdCategories = new Set<string>()

  for (const item of body.items) {
    let categoryId: string | null = null
    if (item.category) {
      const resolved = await resolveCategoryId(supabase, body.profileId, item.category.major, item.category.sub)
      categoryId = resolved.id
      if (resolved.createdName) createdCategories.add(resolved.createdName)
    }

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        profile_id: body.profileId,
        category_id: categoryId,
        type: item.type,
        amount: item.amount,
        description: item.description || item.category?.sub || (item.type === 'income' ? 'เงินเข้า' : 'รายจ่าย'),
        occurred_on: item.occurred_on,
        source: 'web'
      })
      .select('id')
      .single()

    if (txError || !transaction) {
      throw createError({ statusCode: 500, statusMessage: txError?.message ?? 'failed to save transaction' })
    }

    const { error: allocError } = await supabase.from('transaction_allocations').insert(
      item.allocations.map((a) => ({
        transaction_id: transaction.id,
        fund: a.fund,
        amount: a.amount
      }))
    )

    if (allocError) {
      throw createError({ statusCode: 500, statusMessage: allocError.message })
    }

    insertedIds.push(transaction.id)
  }

  return { insertedIds, createdCategories: [...createdCategories] }
})
