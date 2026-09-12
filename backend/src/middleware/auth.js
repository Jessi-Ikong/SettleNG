import { supabase } from '../lib/supabaseClient.js'

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (profile.suspended) {
    return res.status(403).json({
      error: 'Your account has been suspended',
      reason: profile.suspended_reason,
    })
  }

  req.user = data.user
  req.profile = profile
  next()
}
