import type { SupabaseClient } from '@supabase/supabase-js'
import type { CycleRange } from './cycle'

export type Fund = 'daily' | 'fixed' | 'savings'

// Every baht on the books, ignoring cycles and funds entirely — this is real money, and real
// money doesn't reset on the 1st. Leftover that drops out of the daily/fixed cards at a cycle
// boundary is still counted here, which is the whole point of the figure.
// Reads transactions.amount rather than joining allocations: the two are kept equal on every
// write path (zod enforces it on create/patch; transfers, reconcile and the top-up write both
// sides together), and transfer pairs cancel out since each is one income and one expense.
export async function totalBalance(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('profile_id', profileId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  let balance = 0
  for (const tx of (data ?? []) as { type: 'expense' | 'income'; amount: number }[]) {
    balance += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)
  }
  return Math.round(balance * 100) / 100
}

// What should physically be left in one fund as of the end of `cycle`: everything paid in minus
// everything paid out, transfers included (moving your own money really does change what's in the
// pot). daily/fixed reset every cycle, so they're windowed to it; savings accumulates for life, so
// it only takes the upper bound — without that, reconciling a cycle that has already ended would
// count savings activity from after it and report a bogus difference.
export async function fundBalance(
  supabase: SupabaseClient,
  profileId: string,
  fund: Fund,
  cycle: CycleRange
) {
  let query = supabase
    .from('transactions')
    .select('type, transaction_allocations(fund, amount)')
    .eq('profile_id', profileId)
    .lte('occurred_on', cycle.end)

  if (fund !== 'savings') {
    query = query.gte('occurred_on', cycle.start)
  }

  const { data, error } = await query
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  let balance = 0
  for (const tx of (data ?? []) as { type: 'expense' | 'income'; transaction_allocations: { fund: Fund; amount: number }[] }[]) {
    for (const alloc of tx.transaction_allocations) {
      if (alloc.fund !== fund) continue
      balance += tx.type === 'income' ? Number(alloc.amount) : -Number(alloc.amount)
    }
  }
  return balance
}
