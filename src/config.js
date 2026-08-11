const ENV = import.meta.env

const SHEET_NAMES = ['students', 'trips', 'itinerary', 'documents', 'guidelines', 'reminders', 'travel', 'media']

function envMap(prefix) {
  const out = {}
  for (const name of SHEET_NAMES) {
    const v = ENV[`${prefix}${name.toUpperCase()}`]
    if (v) out[name] = v
  }
  return out
}

const FROM_ENV = {
  dataSource: ENV.VITE_DATA_SOURCE || 'mock',
  csvBase: ENV.VITE_SHEET_CSV_BASE || '',
  folderId: ENV.VITE_DRIVE_FOLDER_ID || '',
  sheetId: ENV.VITE_SHEET_ID || '',
  settingsTab: ENV.VITE_SETTINGS_TAB || 'Settings',
  gids: envMap('VITE_GID_'),
  sheetIds: envMap('VITE_SHEET_ID_'),
  googleClientId: ENV.VITE_GOOGLE_CLIENT_ID || '',
  driveApiKey: ENV.VITE_GOOGLE_API_KEY || '',
  driveApiBase: ENV.VITE_DRIVE_API_BASE || 'https://www.googleapis.com/drive/v3',
  apiBaseUrl: ENV.VITE_API_BASE_URL || '',
}

let current = null

function merge(base, override) {
  const out = { ...base }
  for (const [k, v] of Object.entries(override || {})) {
    if (v === null || v === undefined || v === '') continue
    if (typeof v === 'object' && !Array.isArray(v)) {
      const inner = { ...(base[k] || {}) }
      for (const [ik, iv] of Object.entries(v)) if (iv !== '' && iv != null) inner[ik] = String(iv)
      out[k] = inner
    } else {
      out[k] = v
    }
  }
  return out
}

async function readJson(name) {
  try {
    const res = await fetch(name, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    // A missing file under the SPA fallback comes back as index.html.
    if (text.trimStart().startsWith('<')) return null
    return JSON.parse(text)
  } catch (err) {
    console.warn(`[config] could not read ${name}:`, err.message)
    return null
  }
}

/**
 * Reads public/config.json at startup so the spreadsheet pointer can be changed
 * by editing one deployed file, instead of rebuilding the bundle. Values in
 * .env stay as the fallback, so an existing setup keeps working untouched.
 *
 * public/config.local.json then overrides it, and is gitignored. That is how a
 * developer points at real data locally without editing the committed file —
 * which auto-deploys, so a local-only path in there would ship a broken site.
 *
 * Must resolve before the app renders — adapters read config() synchronously.
 */
export async function loadConfig() {
  const base = await readJson('config.json')
  current = base ? merge(FROM_ENV, base) : FROM_ENV

  const local = await readJson('config.local.json')
  if (local) {
    current = merge(current, local)
    console.info('[config] config.local.json applied — local overrides are active.')
  }
  return current
}

export function config() {
  return current || FROM_ENV
}
