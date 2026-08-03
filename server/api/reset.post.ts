import { z } from 'zod'

const requestSchema = z.object({
  profileId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId } = parsedBody.data

  const supabase = useSupabase()

  // deletes all transactions for the profile (transaction_allocations cascade via FK);
  // categories, budget_rates, and the profile itself are left untouched
  const { data, error } = await supabase.from('transactions').delete().eq('profile_id', profileId).select('id')
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { deletedCount: data?.length ?? 0 }
})
