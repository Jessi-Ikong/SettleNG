import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, (req, res) => {
  const { id, full_name, role, phone } = req.profile
  res.json({ user_id: id, full_name, role, phone })
})

export default router
