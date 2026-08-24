import type { SupabaseClient } from '@supabase/supabase-js'

const MONTHS_BACK = 2
const MAX_UNIQUE = 50

export async function refreshVocabulary(supabase: SupabaseClient, profileId: string) {
  const since = new Date()
  since.setMonth(since.getMonth() - MONTHS_BACK)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('transactions')
    .select('description')
    .eq('profile_id', profileId)
    .eq('is_transfer', false)
    .gte('occurred_on', sinceDate)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const unique = [...new Set((data ?? []).map((row) => row.description.trim()).filter(Boolean))].slice(0, MAX_UNIQUE)
  const description_vocabulary = unique.join(', ')

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ description_vocabulary, description_vocabulary_updated_at: new Date().toISOString() })
    .eq('id', profileId)

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }

  return description_vocabulary
}
