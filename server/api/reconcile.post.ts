import { z } from 'zod'
import type { Fund } from '../utils/fundBalance'

const requestSchema = z.object({
  profileId: z.string().min(1),
  // which day the adjustment lands on — defaults to today. Closing a cycle after it has ended
  // needs the entry inside that cycle, not in the one that has since started.
  occurred_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  targets: z
    .array(
      z.object({
        fund: z.enum(['daily', 'fixed', 'savings']),
        actual: z.coerce.number().min(0)
      })
    )
    .min(1)
    .max(3)
    .refine((t) => new Set(t.map((x) => x.fund)).size === t.length, { message: 'duplicate fund' })
    .optional(),
  // adjust against one counted figure for everything instead of fund by fund — the funds are
  // labels on a single pot of money, so the total is the only number that can actually be counted
  total: z
    .object({
      actual: z.coerce.number(),
      fund: z.enum(['daily', 'fixed', 'savings']).default('daily')
    })
    .optional()
})

const FUND_LABEL: Record<Fund, string> = { daily: 'รายวัน', fixed: 'ประจำ', savings: 'เงินเก็บ' }
const MIN_DELTA = 0.01

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Brings a fund's recorded balance in line with the cash actually on hand. The gap is real
// money — forgotten entries, or last cycle's leftover that never carried over — so it's written
// as an ordinary transaction rather than a transfer: a shortfall was genuinely spent and should
// count against pacing, and a surplus was genuinely income.
export default defineEventHandler(async (event) => {
  const parsedBody = requestSchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: parsedBody.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId, targets, total, occurred_on } = parsedBody.data
  if (!targets === !total) {
    throw createError({ statusCode: 400, statusMessage: 'send either targets or total' })
  }

  const supabase = useSupabase()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('cycle_start_day')
    .eq('id', profileId)
    .single()
  if (profileError || !profile) {
    throw createError({ statusCode: 404, statusMessage: 'profile not found' })
  }

  const today = todayInTimezone()
  const asOf = occurred_on ?? today
  if (asOf > today) {
    throw createError({ statusCode: 400, statusMessage: 'cannot reconcile a future date' })
  }
  const cycle = getCycleRange(profile.cycle_start_day, asOf)

  const adjustments: { fund: Fund; from: number; to: number; delta: number }[] = []

  // every balance is recomputed here rather than trusted from the client, so the figures written
  // into the description are the ones the server actually reconciled against
  const work: { fund: Fund; current: number; actual: number; label: string }[] = []
  if (total) {
    work.push({
      fund: total.fund,
      current: await totalBalance(supabase, profileId),
      actual: total.actual,
      label: 'ยอดรวม'
    })
  } else {
    for (const target of targets!) {
      work.push({
        fund: target.fund,
        current: await fundBalance(supabase, profileId, target.fund, cycle),
        actual: target.actual,
        label: FUND_LABEL[target.fund]
      })
    }
  }

  for (const target of work) {
    const current = target.current
    const delta = Math.round((target.actual - current) * 100) / 100
    if (Math.abs(delta) < MIN_DELTA) continue

    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .insert({
        profile_id: profileId,
        category_id: null,
        type: delta > 0 ? 'income' : 'expense',
        amount: Math.abs(delta),
        description: `ปรับ${target.label} ${money(current)} → ${money(target.actual)}`,
        occurred_on: asOf,
        source: 'web'
      })
      .select('id')
      .single()
    if (txError || !tx) {
      throw createError({ statusCode: 500, statusMessage: txError?.message ?? 'failed to save adjustment' })
    }

    const { error: allocError } = await supabase
      .from('transaction_allocations')
      .insert({ transaction_id: tx.id, fund: target.fund, amount: Math.abs(delta) })
    if (allocError) {
      // an allocation-less transaction still counts in the total balance but in no fund, so the
      // total and the three cards would disagree by this amount for good — take the row back out
      await supabase.from('transactions').delete().eq('id', tx.id)
      throw createError({ statusCode: 500, statusMessage: allocError.message })
    }

    adjustments.push({ fund: target.fund, from: current, to: target.actual, delta })
  }

  return { adjustments }
})
