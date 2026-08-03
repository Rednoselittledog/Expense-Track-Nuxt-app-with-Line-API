import { z } from 'zod'

const requestSchema = z.object({
  profileId: z.string().min(1),
  fund: z.enum(['daily', 'fixed']).default('daily'),
  monthly_amount: z.coerce.number().min(0),
  effective: z.enum(['now', 'next_cycle']).default('now')
})

export default defineEventHandler(async (event) => {
  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const body = parsedBody.data
  const supabase = useSupabase()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('cycle_start_day')
    .eq('id', body.profileId)
    .single()
  if (profileError || !profile) {
    throw createError({ statusCode: 404, statusMessage: 'profile not found' })
  }

  const today = todayInTimezone()
  let effectiveFrom = today

  if (body.effective === 'next_cycle') {
    const cycle = getCycleRange(profile.cycle_start_day, today)
    const nextStart = new Date(`${cycle.end}T00:00:00`)
    nextStart.setDate(nextStart.getDate() + 1)
    effectiveFrom = nextStart.toISOString().slice(0, 10)
  }

  const { data, error } = await supabase
    .from('budget_rates')
    .insert({
      profile_id: body.profileId,
      fund: body.fund,
      monthly_amount: body.monthly_amount,
      effective_from: effectiveFrom
    })
    .select('id')
    .single()
  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message ?? 'failed to save budget rate' })
  }

  return { id: data.id, effectiveFrom }
})
