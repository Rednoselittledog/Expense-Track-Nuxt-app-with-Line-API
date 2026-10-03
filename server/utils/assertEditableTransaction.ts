import type { SupabaseClient } from '@supabase/supabase-js'

// Single gate for "may the user hand-edit this row", shared by PATCH and DELETE so the two can't
// drift on what's protected. Transfers are paired rows that only make sense together, and the
// current cycle's source='system' row is owned by syncCycleTopUp — editing it would be silently
// reverted on the next summary load, so it's refused here instead of appearing to work.
export async function assertEditableTransaction(supabase: SupabaseClient, id: string, profileId: string) {
  const { data: existing, error } = await supabase
    .from('transactions')
    .select('id, is_transfer, source, occurred_on')
    .eq('id', id)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'transaction not found' })
  }
  if (existing.is_transfer) {
    throw createError({ statusCode: 403, statusMessage: 'transfer transactions cannot be edited' })
  }
  if (existing.source === 'system') {
    // only the cycle sync owns is off limits. An older top-up is managed by nobody —
    // syncCycleTopUp never looks outside the current cycle — so keeping it locked would leave a
    // wrong historical figure in the balance with no way at all to correct it.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('cycle_start_day')
      .eq('id', profileId)
      .single()
    if (profileError || !profile) {
      throw createError({ statusCode: 404, statusMessage: 'profile not found' })
    }
    const cycle = getCycleRange(profile.cycle_start_day, todayInTimezone())
    if (isWithinCycle(existing.occurred_on, cycle)) {
      throw createError({ statusCode: 403, statusMessage: 'auto top-up is managed by the budget setting' })
    }
  }
}
