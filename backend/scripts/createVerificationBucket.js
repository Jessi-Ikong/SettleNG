import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`)
  }

  if (buckets.some((b) => b.name === 'verification-documents')) {
    console.log('Bucket "verification-documents" already exists — leaving it as it is.')
    return
  }

  const { error: createError } = await supabase.storage.createBucket(
    'verification-documents',
    { public: false },
  )

  if (createError) {
    throw new Error(`Failed to create bucket: ${createError.message}`)
  }

  console.log('Created private bucket "verification-documents".')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
