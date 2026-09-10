import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// Note: the spec pointed at .../main/full.json, but that path 404s —
// the actual file in this repo lives under data/full.json.
const DATASET_URL =
  'https://raw.githubusercontent.com/temikeezy/nigeria-geojson-data/main/data/full.json'

const BATCH_SIZE = 500

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function batchInsert(table, rows, batchSize = BATCH_SIZE) {
  const inserted = []
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { data, error } = await supabase.from(table).insert(batch).select()
    if (error) {
      throw new Error(`Insert into ${table} failed: ${error.message}`)
    }
    inserted.push(...data)
  }
  return inserted
}

async function main() {
  const { count, error: countError } = await supabase
    .from('states')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('Failed to check existing states:', countError.message)
    process.exit(1)
  }

  if (count > 0) {
    console.warn(
      `states table already has ${count} row(s) — refusing to reseed. ` +
        'Truncate states/lgas/wards first if you really want to reseed.',
    )
    process.exit(1)
  }

  console.log(`Fetching dataset from ${DATASET_URL} ...`)
  const response = await fetch(DATASET_URL)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch dataset: ${response.status} ${response.statusText}`,
    )
  }
  const dataset = await response.json()

  if (!Array.isArray(dataset) || dataset.length === 0) {
    throw new Error('Dataset is not a non-empty array — check its shape')
  }

  console.log('Sample of the first state entry (truncated):')
  console.log(
    JSON.stringify(
      {
        state: dataset[0].state,
        lgaCount: dataset[0].lgas?.length,
        firstLga: dataset[0].lgas?.[0]?.name,
        firstWard: dataset[0].lgas?.[0]?.wards?.[0],
      },
      null,
      2,
    ),
  )

  // --- States ---
  const stateRows = dataset.map((s) => ({ name: s.state }))
  const insertedStates = await batchInsert('states', stateRows)
  console.log(`Inserted ${insertedStates.length} states`)

  const stateIdByName = new Map(insertedStates.map((s) => [s.name, s.id]))

  // --- LGAs ---
  const lgaRows = []
  for (const s of dataset) {
    const stateId = stateIdByName.get(s.state)
    for (const lga of s.lgas || []) {
      lgaRows.push({ state_id: stateId, name: lga.name })
    }
  }
  const insertedLgas = await batchInsert('lgas', lgaRows)
  console.log(`Inserted ${insertedLgas.length} LGAs`)

  const lgaIdByStateAndName = new Map(
    insertedLgas.map((l) => [`${l.state_id}::${l.name}`, l.id]),
  )

  // --- Wards ---
  const wardRows = []
  for (const s of dataset) {
    const stateId = stateIdByName.get(s.state)
    for (const lga of s.lgas || []) {
      const lgaId = lgaIdByStateAndName.get(`${stateId}::${lga.name}`)
      for (const ward of lga.wards || []) {
        wardRows.push({
          lga_id: lgaId,
          name: ward.name,
          latitude: ward.latitude ?? null,
          longitude: ward.longitude ?? null,
        })
      }
    }
  }
  const insertedWards = await batchInsert('wards', wardRows)
  console.log(`Inserted ${insertedWards.length} wards`)

  const { error: activateError } = await supabase
    .from('states')
    .update({ active: true })
    .eq('name', 'Lagos')

  if (activateError) {
    console.error('Failed to activate Lagos:', activateError.message)
    process.exit(1)
  }

  console.log('Marked Lagos as active')
  console.log('Seeding complete.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
