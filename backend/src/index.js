import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import meRouter from './routes/me.js'

const app = express()
const PORT = process.env.PORT || 5050

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SettleNG API' })
})

app.use('/api/me', meRouter)

app.listen(PORT, () => {
  console.log(`SettleNG API listening on port ${PORT}`)
})
