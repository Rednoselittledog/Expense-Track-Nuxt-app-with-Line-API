import { z } from 'zod'
import { transactionDraftSchema } from '../../utils/types'

const requestSchema = z.object({
  profileId: z.string().min(1),
  item: transactionDraftSchema
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'missing transaction id' })
  }

  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId, item } = parsedBody.data

  const supabase = useSupabase()

  const { data: existing, error: fetchError } = await supabase
    .from('transactions')
    .select('id, is_transfer')
    .eq('id', id)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (fetchError) {
    throw createError({ statusCode: 500, statusMessage: fetchError.message })
  }
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'transaction not found' })
  }
  if (existing.is_transfer) {
    throw createError({ statusCode: 403, statusMessage: 'transfer transactions cannot be edited' })
  }

  let categoryId: string | null = null
  let createdCategory: string | null = null
  if (item.category) {
    const resolved = await resolveCategoryId(supabase, profileId, item.category.major, item.category.sub)
    categoryId = resolved.id
    createdCategory = resolved.createdName
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update({
      category_id: categoryId,
      type: item.type,
      amount: item.amount,
      description: item.description || item.category?.sub || (item.type === 'income' ? 'เงินเข้า' : 'รายจ่าย'),
      occurred_on: item.occurred_on
    })
    .eq('id', id)

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }

  const { error: deleteAllocError } = await supabase.from('transaction_allocations').delete().eq('transaction_id', id)
  if (deleteAllocError) {
    throw createError({ statusCode: 500, statusMessage: deleteAllocError.message })
  }

  const { error: insertAllocError } = await supabase.from('transaction_allocations').insert(
    item.allocations.map((a) => ({
      transaction_id: id,
      fund: a.fund,
      amount: a.amount
    }))
  )
  if (insertAllocError) {
    throw createError({ statusCode: 500, statusMessage: insertAllocError.message })
  }

  return { updated: true, createdCategories: createdCategory ? [createdCategory] : [] }
})
