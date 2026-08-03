import type { SupabaseClient } from '@supabase/supabase-js'

export interface ResolvedCategory {
  id: string
  createdName: string | null
}

export async function resolveCategoryId(
  supabase: SupabaseClient,
  profileId: string,
  major: string,
  sub: string
): Promise<ResolvedCategory> {
  const { data: majorRow } = await supabase
    .from('categories')
    .select('id')
    .eq('profile_id', profileId)
    .is('parent_id', null)
    .eq('name', major)
    .maybeSingle()

  if (!majorRow) {
    throw createError({ statusCode: 400, statusMessage: `unknown major category: ${major}` })
  }

  const { data: subRow } = await supabase
    .from('categories')
    .select('id')
    .eq('profile_id', profileId)
    .eq('parent_id', majorRow.id)
    .eq('name', sub)
    .maybeSingle()

  if (subRow) return { id: subRow.id, createdName: null }

  const { data: newSub, error } = await supabase
    .from('categories')
    .insert({ profile_id: profileId, parent_id: majorRow.id, name: sub })
    .select('id')
    .single()

  if (error || !newSub) {
    throw createError({ statusCode: 500, statusMessage: error?.message ?? 'failed to create category' })
  }

  return { id: newSub.id, createdName: sub }
}
