import { z } from 'zod'

const querySchema = z.object({
  profileId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categoryId: z.string().min(1).optional()
})

export default defineEventHandler(async (event) => {
  const parsedQuery = querySchema.safeParse(getQuery(event))
  if (!parsedQuery.success) {
    throw createError({ statusCode: 400, statusMessage: parsedQuery.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId, from, to, categoryId } = parsedQuery.data

  const supabase = useSupabase()

  let query = supabase
    .from('transactions')
    .select(
      'id, type, is_transfer, amount, description, occurred_on, category_id, source, categories(name, parent_id), transaction_allocations(fund, amount)'
    )
    .eq('profile_id', profileId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (from) query = query.gte('occurred_on', from)
  if (to) query = query.lte('occurred_on', to)
  if (categoryId) query = query.eq('category_id', categoryId)

  const { data, error } = await query
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  // `editable` is stamped here rather than inferred in the UI, so the buttons the user sees and
  // the rule assertEditableTransaction enforces can't drift apart
  const { data: profile } = await supabase
    .from('profiles')
    .select('cycle_start_day')
    .eq('id', profileId)
    .single()
  const cycle = getCycleRange(profile?.cycle_start_day ?? 1, todayInTimezone())
  const transactions = (data ?? []).map((tx) => ({
    ...tx,
    editable: !tx.is_transfer && !(tx.source === 'system' && isWithinCycle(tx.occurred_on, cycle))
  }))

  return { transactions }
})
