import { supabase } from './supabaseClient.js'

// Shared by tenant-assignment ("Mark as rented") and payment
// initialization: a tenant is eligible on a property once they have
// an inspection that's been accepted or completed, never just
// requested. Centralized here so all three call sites agree on the
// same rule instead of drifting from separately-maintained copies.
export async function hasEligibleInspection(propertyId, tenantId) {
  const { data, error } = await supabase
    .from('inspections')
    .select('id')
    .eq('property_id', propertyId)
    .eq('tenant_id', tenantId)
    .in('status', ['accepted', 'completed'])
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return !!data
}
