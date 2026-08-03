import { z } from 'zod'

const querySchema = z.object({
  profileId: z.string().min(1),
  view: z.enum(['daily', 'fixed', 'savings', 'category']),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fund: z.enum(['daily', 'fixed', 'savings']).optional()
})

interface TransactionWithAllocations {
  type: 'expense' | 'income'
  is_transfer: boolean
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

  if (view === 'daily') {
    const cycle = getCycleRange(profile.cycle_start_day, today)

    const { data: rate } = await supabase
      .from('budget_rates')
      .select('monthly_amount')
      .eq('profile_id', profileId)
      .eq('fund', 'daily')
      .lte('effective_from', today)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()
    const monthlyAmount = rate?.monthly_amount ?? 0

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
    let realSpending = 0 // excludes transfers — used for the pacing figures below
    for (const tx of (transactions ?? []) as TransactionWithAllocations[]) {
      for (const alloc of tx.transaction_allocations) {
        if (alloc.fund !== 'daily') continue
        if (tx.type === 'income') {
          income += alloc.amount
        } else {
          expense += alloc.amount
          if (!tx.is_transfer) realSpending += alloc.amount
        }
      }
    }

    const accumulatedRemaining = monthlyAmount + income - expense
    const dailyRate = cycle.totalDays > 0 ? monthlyAmount / cycle.totalDays : 0
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
    const cycle = getCycleRange(profile.cycle_start_day, today)

    const { data: rate } = await supabase
      .from('budget_rates')
      .select('monthly_amount')
      .eq('profile_id', profileId)
      .eq('fund', 'fixed')
      .lte('effective_from', today)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()
    const budgeted = rate?.monthly_amount ?? 0

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('type, is_transfer, occurred_on, transaction_allocations(fund, amount)')
      .eq('profile_id', profileId)
      .gte('occurred_on', cycle.start)
      .lte('occurred_on', cycle.end)
    if (txError) {
      throw createError({ statusCode: 500, statusMessage: txError.message })
    }

    let spent = 0
    for (const tx of (transactions ?? []) as TransactionWithAllocations[]) {
      if (tx.type !== 'expense' || tx.is_transfer) continue
      for (const alloc of tx.transaction_allocations) {
        if (alloc.fund === 'fixed') spent += alloc.amount
      }
    }

    return { budgeted, spent, remaining: budgeted - spent, cycle }
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
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('type, occurred_on, transaction_allocations(fund, amount)')
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
        if (!lastTopUp || tx.occurred_on > lastTopUp.occurred_on) {
          lastTopUp = { amount: alloc.amount, occurred_on: tx.occurred_on }
        }
      } else {
        expense += alloc.amount
      }
    }
  }

  return {
    balance: income - expense,
    lastTopUp
  }
})
