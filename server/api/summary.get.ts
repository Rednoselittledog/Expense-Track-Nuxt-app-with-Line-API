import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CycleRange } from '../utils/cycle'
import { planCycleTopUp, type ExistingTopUp } from '../utils/topUpPlan'
import type { Fund } from '../utils/fundBalance'

const TOPUP_DESCRIPTION = 'เติมเงินต้นเดือน'

// Reads the system-generated top-ups for one fund in one cycle, oldest first. The ordering is
// total (created_at, then id) so two concurrent loads agree on which row is "the" top-up and
// which are duplicates to drop. `amount` comes from the allocation, not the transaction: the
// allocation is what every fund view actually sums, so a half-applied update (transaction
// written, allocation not) still looks stale here and gets re-applied instead of sticking.
async function loadCycleTopUps(
  supabase: SupabaseClient,
  profileId: string,
  fund: Fund,
  cycle: CycleRange
): Promise<ExistingTopUp[]> {
  const { data: rows, error } = await supabase
    .from('transactions')
    .select('id, transaction_allocations!inner(id, fund, amount)')
    .eq('profile_id', profileId)
    .eq('source', 'system')
    .gte('occurred_on', cycle.start)
    .lte('occurred_on', cycle.end)
    .eq('transaction_allocations.fund', fund)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  // never swallowed: a failed read looks exactly like "no top-up yet", which inserts a second one
  // and doubles the cycle's pot
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const existing: ExistingTopUp[] = []
  const typedRows = (rows ?? []) as unknown as {
    id: string
    transaction_allocations: { id: string; fund: Fund; amount: number }[]
  }[]
  for (const row of typedRows) {
    const allocation = row.transaction_allocations.find((a) => a.fund === fund)
    if (allocation) {
      existing.push({ id: row.id, amount: Number(allocation.amount), allocationId: allocation.id })
    }
  }
  return existing
}

// Records the cycle's budgeted amount as a real income transaction, so the pot that the rest of
// this file derives from transactions stays in line with budget_rates. Identified by
// source='system' — the old key (description + exact cycle-start date) let a rename orphan it and
// a cycle_start_day change duplicate it — and re-synced on every read, so changing the budget
// "effective now" actually moves the current cycle's money instead of being silently ignored.
// Every write is checked: a swallowed error here reports a budget change that never reached the
// ledger, and the user then watches a figure that refuses to move however often they save.
async function syncCycleTopUp(
  supabase: SupabaseClient,
  profileId: string,
  fund: Fund,
  cycle: CycleRange,
  monthlyAmount: number
) {
  const plan = planCycleTopUp(await loadCycleTopUps(supabase, profileId, fund, cycle), monthlyAmount)

  if (plan.deleteIds.length) {
    // allocations cascade via FK
    const { error } = await supabase.from('transactions').delete().in('id', plan.deleteIds)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }
  }

  if (plan.update) {
    const { error: allocError } = await supabase
      .from('transaction_allocations')
      .update({ amount: plan.update.amount })
      .eq('id', plan.update.allocationId)
    if (allocError) {
      throw createError({ statusCode: 500, statusMessage: allocError.message })
    }
    const { error: txError } = await supabase
      .from('transactions')
      .update({ amount: plan.update.amount })
      .eq('id', plan.update.id)
    if (txError) {
      throw createError({ statusCode: 500, statusMessage: txError.message })
    }
  }

  if (plan.insert !== null) {
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .insert({
        profile_id: profileId,
        category_id: null,
        type: 'income',
        amount: plan.insert,
        description: TOPUP_DESCRIPTION,
        occurred_on: cycle.start,
        source: 'system'
      })
      .select('id')
      .single()
    if (txError || !tx) {
      throw createError({ statusCode: 500, statusMessage: txError?.message ?? 'failed to record top-up' })
    }

    const { error: allocError } = await supabase
      .from('transaction_allocations')
      .insert({ transaction_id: tx.id, fund, amount: plan.insert })
    if (allocError) {
      // the transaction alone would count in the total balance but in no fund, so take it back out
      await supabase.from('transactions').delete().eq('id', tx.id)
      throw createError({ statusCode: 500, statusMessage: allocError.message })
    }

    // The dashboard fires four summary requests at once and each syncs the funds it needs, so on
    // the first load of a cycle two of them can both see "no top-up yet" and both insert — double
    // money for as long as the pot is read. Re-reading collapses that inside this request instead
    // of leaving it to the next one, and every racer keeps the same row thanks to the total order.
    // ponytail: still not a lock — if neither racer's insert is visible to the other, the next
    // read's planCycleTopUp is what cleans up. A unique index can't replace this: the fund lives
    // in transaction_allocations, so the three funds share profile/date/description on purpose.
    const extras = (await loadCycleTopUps(supabase, profileId, fund, cycle)).slice(1).map((e) => e.id)
    if (extras.length) {
      const { error } = await supabase.from('transactions').delete().in('id', extras)
      if (error) {
        throw createError({ statusCode: 500, statusMessage: error.message })
      }
    }
  }
}

const querySchema = z.object({
  profileId: z.string().min(1),
  view: z.enum(['daily', 'fixed', 'savings', 'category', 'close', 'balance']),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fund: z.enum(['daily', 'fixed', 'savings']).optional()
})

interface TransactionWithAllocations {
  type: 'expense' | 'income'
  is_transfer: boolean
  source?: 'web' | 'line' | 'system'
  occurred_on: string
  transaction_allocations: { fund: 'daily' | 'fixed' | 'savings'; amount: number }[]
}

function currentMonthRange() {
  const today = todayInTimezone()
  const [y, m] = today.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

export default defineEventHandler(async (event) => {
  const parsedQuery = querySchema.safeParse(getQuery(event))
  if (!parsedQuery.success) {
    throw createError({ statusCode: 400, statusMessage: parsedQuery.error.issues[0]?.message ?? 'invalid request' })
  }
  const { profileId, view, from, to, fund } = parsedQuery.data

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
  const cycle = getCycleRange(profile.cycle_start_day, today)

  async function latestRate(fund: 'daily' | 'fixed' | 'savings') {
    const { data } = await supabase
      .from('budget_rates')
      .select('monthly_amount')
      .eq('profile_id', profileId)
      .eq('fund', fund)
      .lte('effective_from', today)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return Number(data?.monthly_amount ?? 0)
  }

  if (view === 'balance') {
    // sync all three first: this view only sums transactions, so without it the figure reflects
    // whatever top-up amount happened to be on the books when some other view last synced —
    // changing the budget "effective now" would move the cards but not this number
    for (const fund of ['daily', 'fixed', 'savings'] as const) {
      await syncCycleTopUp(supabase, profileId, fund, cycle, await latestRate(fund))
    }
    return { total: await totalBalance(supabase, profileId) }
  }

  // Is the cycle that just ended still holding money? daily/fixed reset on the cycle boundary, so
  // anything left in them at that point drops out of every other view while still existing in real
  // life — it has to be swept into savings to stay on the books. No "closed" flag is stored: a
  // cycle whose daily+fixed land on zero is closed by definition, which also covers the case of
  // spending the budget exactly, and can't drift out of sync with the transactions themselves.
  // ponytail: only looks one cycle back — skipping two whole cycles needs the dialog's own date
  if (view === 'close') {
    const dayBefore = new Date(`${cycle.start}T00:00:00`)
    dayBefore.setDate(dayBefore.getDate() - 1)
    const previous = getCycleRange(profile.cycle_start_day, toISODate(dayBefore))

    const [daily, fixed, savings] = await Promise.all([
      fundBalance(supabase, profileId, 'daily', previous),
      fundBalance(supabase, profileId, 'fixed', previous),
      fundBalance(supabase, profileId, 'savings', previous)
    ])

    return {
      cycle: previous,
      daily,
      fixed,
      savings,
      stranded: daily + fixed,
      needsClose: Math.abs(daily) + Math.abs(fixed) >= 0.01
    }
  }

  if (view === 'daily') {
    const monthlyAmount = await latestRate('daily')
    await syncCycleTopUp(supabase, profileId, 'daily', cycle, monthlyAmount)

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('type, is_transfer, occurred_on, transaction_allocations(fund, amount)')
      .eq('profile_id', profileId)
      .gte('occurred_on', cycle.start)
      .lte('occurred_on', cycle.end)
    if (txError) {
      throw createError({ statusCode: 500, statusMessage: txError.message })
    }

    let income = 0
    let expense = 0
    let transferOut = 0 // money moved out of `daily` — shrinks the pot, unlike real spending
    let realSpending = 0 // excludes transfers — used for the pacing figures below
    for (const tx of (transactions ?? []) as TransactionWithAllocations[]) {
      for (const alloc of tx.transaction_allocations) {
        if (alloc.fund !== 'daily') continue
        if (tx.type === 'income') {
          income += alloc.amount
        } else {
          expense += alloc.amount
          if (tx.is_transfer) transferOut += alloc.amount
          else realSpending += alloc.amount
        }
      }
    }

    // `income` already includes this cycle's top-up transaction (see ensureCycleTopUp above).
    // `netInflow` is the pot available this cycle: top-up + any extra income, minus money
    // transferred out — extra income raises the daily allowance for the rest of the cycle,
    // and transferring money out now shrinks it too — confirmed with the user
    const netInflow = income - transferOut
    const accumulatedRemaining = income - expense
    const dailyRate = cycle.totalDays > 0 ? netInflow / cycle.totalDays : 0
    const dailyRemaining = dailyRate * cycle.elapsedDays - realSpending

    return {
      accumulatedRemaining,
      accumulatedSpending: realSpending,
      dailyRemaining,
      dailyRate,
      monthlyAmount,
      cycle
    }
  }

  if (view === 'fixed') {
    const monthlyAmount = await latestRate('fixed')
    await syncCycleTopUp(supabase, profileId, 'fixed', cycle, monthlyAmount)

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('type, is_transfer, occurred_on, transaction_allocations(fund, amount)')
      .eq('profile_id', profileId)
      .gte('occurred_on', cycle.start)
      .lte('occurred_on', cycle.end)
    if (txError) {
      throw createError({ statusCode: 500, statusMessage: txError.message })
    }

    let income = 0
    let transferOut = 0 // money moved out of `fixed` — shrinks the pot, unlike real spending
    let spent = 0 // excludes transfers — the "used" figure shown against the pot
    for (const tx of (transactions ?? []) as TransactionWithAllocations[]) {
      for (const alloc of tx.transaction_allocations) {
        if (alloc.fund !== 'fixed') continue
        if (tx.type === 'income') {
          income += alloc.amount
        } else if (tx.is_transfer) {
          transferOut += alloc.amount
        } else {
          spent += alloc.amount
        }
      }
    }

    // the pot for this cycle is the top-up plus any transfers in, minus transfers out — not just
    // the flat rate — so `budgeted`/`remaining` (and the "X of Y" progress bar) move with transfers.
    // `monthlyAmount` is the configured rate, reported separately so Settings edits the rate
    // rather than whatever the pot happens to be after transfers
    const pot = income - transferOut
    return { budgeted: pot, spent, remaining: pot - spent, monthlyAmount, cycle }
  }

  if (view === 'category') {
    const range = from && to ? { from, to } : currentMonthRange()

    const { data: allCategories, error: catError } = await supabase
      .from('categories')
      .select('id, parent_id, name')
      .eq('profile_id', profileId)
    if (catError) {
      throw createError({ statusCode: 500, statusMessage: catError.message })
    }
    const categoryMap = new Map((allCategories ?? []).map((c) => [c.id, c]))

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('category_id, transaction_allocations(fund, amount)')
      .eq('profile_id', profileId)
      .eq('type', 'expense')
      .eq('is_transfer', false)
      .gte('occurred_on', range.from)
      .lte('occurred_on', range.to)
    if (txError) {
      throw createError({ statusCode: 500, statusMessage: txError.message })
    }

    const majorTotals = new Map<string, { major: string; total: number; subs: Map<string, { id: string | null; total: number }> }>()
    let grandTotal = 0

    for (const tx of (transactions ?? []) as { category_id: string | null; transaction_allocations: { fund: 'daily' | 'fixed' | 'savings'; amount: number }[] }[]) {
      const amount = tx.transaction_allocations
        .filter((a) => !fund || a.fund === fund)
        .reduce((sum, a) => sum + a.amount, 0)
      if (amount <= 0) continue

      grandTotal += amount
      const sub = tx.category_id ? categoryMap.get(tx.category_id) : null
      const major = sub?.parent_id ? categoryMap.get(sub.parent_id) : null

      const majorName = major?.name ?? 'ไม่ระบุหมวดหมู่'
      const subName = sub?.name ?? 'ไม่ระบุหมวดหมู่'

      if (!majorTotals.has(majorName)) {
        majorTotals.set(majorName, { major: majorName, total: 0, subs: new Map() })
      }
      const entry = majorTotals.get(majorName)!
      entry.total += amount
      const subEntry = entry.subs.get(subName) ?? { id: sub?.id ?? null, total: 0 }
      subEntry.total += amount
      entry.subs.set(subName, subEntry)
    }

    const majors = [...majorTotals.values()]
      .map((m) => ({
        major: m.major,
        total: m.total,
        percent: grandTotal > 0 ? Math.round((m.total / grandTotal) * 100) : 0,
        subs: [...m.subs.entries()].map(([subName, s]) => ({ sub: subName, id: s.id, total: s.total }))
      }))
      .sort((a, b) => b.total - a.total)

    return { range, grandTotal, majors }
  }

  // view === 'savings'
  // savings gets the same per-cycle top-up as daily/fixed, but its balance stays all-time:
  // this is the one fund that accumulates instead of resetting each cycle
  const monthlyAmount = await latestRate('savings')
  await syncCycleTopUp(supabase, profileId, 'savings', cycle, monthlyAmount)

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('type, source, occurred_on, transaction_allocations(fund, amount)')
    .eq('profile_id', profileId)
  if (txError) {
    throw createError({ statusCode: 500, statusMessage: txError.message })
  }

  let income = 0
  let expense = 0
  let lastTopUp: { amount: number; occurred_on: string } | null = null
  for (const tx of (transactions ?? []) as TransactionWithAllocations[]) {
    for (const alloc of tx.transaction_allocations) {
      if (alloc.fund !== 'savings') continue
      if (tx.type === 'income') {
        income += alloc.amount
        // only the automatic top-up counts as a top-up — a cycle-close sweep or a reconcile
        // surplus is also income into savings, and reporting either as "last top-up" would tell
        // the user the budget paid in money it never paid
        if (tx.source === 'system' && (!lastTopUp || tx.occurred_on > lastTopUp.occurred_on)) {
          lastTopUp = { amount: alloc.amount, occurred_on: tx.occurred_on }
        }
      } else {
        expense += alloc.amount
      }
    }
  }

  return {
    balance: income - expense,
    lastTopUp,
    monthlyAmount
  }
})
