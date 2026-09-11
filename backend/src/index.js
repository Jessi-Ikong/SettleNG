import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import meRouter from './routes/me.js'
import locationsRouter from './routes/locations.js'
import propertiesRouter from './routes/properties.js'
import favoritesRouter from './routes/favorites.js'
import savedSearchesRouter from './routes/savedSearches.js'
import inspectionsRouter from './routes/inspections.js'

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

app.listen(PORT, () => {
  console.log(`SettleNG API listening on port ${PORT}`)
})
