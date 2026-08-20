import { z } from 'zod'

const querySchema = z.object({
  profileId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'missing transaction id' })
  }

  const parsedQuery = querySchema.safeParse(getQuery(event))
  if (!parsedQuery.success) {
    throw createError({ statusCode: 400, statusMessage: parsedQuery.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId } = parsedQuery.data

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
    throw createError({ statusCode: 403, statusMessage: 'transfer transactions cannot be deleted' })
  }

  // transaction_allocations cascade via FK
  const { error: deleteError } = await supabase.from('transactions').delete().eq('id', id)
  if (deleteError) {
    throw createError({ statusCode: 500, statusMessage: deleteError.message })
  }

  return { deleted: true }
})
