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

  await assertEditableTransaction(supabase, id, profileId)

  // transaction_allocations cascade via FK
  const { error: deleteError } = await supabase.from('transactions').delete().eq('id', id)
  if (deleteError) {
    throw createError({ statusCode: 500, statusMessage: deleteError.message })
  }

  return { deleted: true }
})
