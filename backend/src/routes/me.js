import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { generalApiLimiter } from '../middleware/rateLimiters.js'

const router = Router()

router.get('/', requireAuth, generalApiLimiter, (req, res) => {
  const { id, full_name, role, phone } = req.profile
  res.json({ user_id: id, full_name, role, phone })
})

export default router
