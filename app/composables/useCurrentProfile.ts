export function useCurrentProfile() {
  const supabase = useSupabase()
  return useAsyncData('current-profile', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, locale, cycle_start_day, description_vocabulary, description_vocabulary_updated_at')
      .limit(1)
      .single()
    if (error) throw error
    return data
  })
}
