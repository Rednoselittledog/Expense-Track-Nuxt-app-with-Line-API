import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function useSupabase() {
  if (!client) {
    const config = useRuntimeConfig()
    client = createClient(config.public.supabaseUrl, config.public.supabaseKey)
  }
  return client
}
