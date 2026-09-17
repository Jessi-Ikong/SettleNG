import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// public/sitemap.xml and public/robots.txt are static files Vite copies
// into dist/ unprocessed, so they can't read import.meta.env like the
// rest of the app. This runs after `vite build` and rewrites the
// checked-in http://localhost:5173 URLs in the BUILT copies (dist/ is
// gitignored, so the source files in public/ are never touched) to the
// real deployed origin, taken from VITE_SITE_URL. Falls back to the
// same localhost default already committed in public/, so running a
// local build without VITE_SITE_URL set is a no-op.
const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const devOrigin = 'http://localhost:5173'
const siteUrl = (process.env.VITE_SITE_URL || devOrigin).replace(/\/$/, '')

for (const file of ['sitemap.xml', 'robots.txt']) {
  const path = join(distDir, file)
  const contents = readFileSync(path, 'utf8')
  writeFileSync(path, contents.split(devOrigin).join(siteUrl))
}

console.log(`generate-seo-files: rewrote sitemap.xml/robots.txt URLs to ${siteUrl}`)
