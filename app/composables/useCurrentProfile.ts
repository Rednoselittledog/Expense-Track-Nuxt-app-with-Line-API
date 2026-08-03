export function useCurrentProfile() {
  const supabase = useSupabase()
  return useAsyncData('current-profile', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, locale, cycle_start_day')
      .limit(1)
      .single()
    if (error) throw error
    return data
  })
}
