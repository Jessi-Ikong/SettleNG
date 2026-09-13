import { supabase } from './supabaseClient.js'

export async function findOrCreateNeighborhood(wardId, name, createdBy) {
  const trimmed = name.trim()

  const { data: existing, error: findError } = await supabase
    .from('neighborhoods')
    .select('id')
    .eq('ward_id', wardId)
    .ilike('name', trimmed)
    .maybeSingle()

  if (findError) {
    throw new Error(`Failed to look up neighborhood: ${findError.message}`)
  }

  if (existing) return existing.id

  const { data: created, error: createError } = await supabase
    .from('neighborhoods')
    .insert({ ward_id: wardId, name: trimmed, created_by: createdBy })
    .select('id')
    .single()

  if (createError) {
    // Race: someone else created the same (ward_id, name) between our
    // select and insert — fall back to re-selecting it.
    if (createError.code === '23505') {
      const { data: retry } = await supabase
        .from('neighborhoods')
        .select('id')
        .eq('ward_id', wardId)
        .ilike('name', trimmed)
        .maybeSingle()
      if (retry) return retry.id
    }
    throw new Error(`Failed to create neighborhood: ${createError.message}`)
  }

  return created.id
}
