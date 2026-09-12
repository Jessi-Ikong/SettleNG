import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import meRouter from './routes/me.js'
import locationsRouter from './routes/locations.js'
import propertiesRouter from './routes/properties.js'
import favoritesRouter from './routes/favorites.js'
import savedSearchesRouter from './routes/savedSearches.js'
import inspectionsRouter from './routes/inspections.js'
import conversationsRouter from './routes/conversations.js'
import messagesRouter from './routes/messages.js'
import reportsRouter from './routes/reports.js'
import reviewsRouter from './routes/reviews.js'
import verificationRouter from './routes/verification.js'

const app = express()
const PORT = process.env.PORT || 5050

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SettleNG API' })
})

app.use('/api/me', meRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/properties', propertiesRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/saved-searches', savedSearchesRouter)
app.use('/api/inspections', inspectionsRouter)
app.use('/api/conversations', conversationsRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/reviews', reviewsRouter)
app.use('/api/verification', verificationRouter)

app.listen(PORT, () => {
  console.log(`SettleNG API listening on port ${PORT}`)
})
