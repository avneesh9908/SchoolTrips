import { config } from '../config'
import { sheetsAdapter } from './sheetsAdapter'
import { apiAdapter } from './apiAdapter'

const ADAPTERS = { sheets: sheetsAdapter, api: apiAdapter }

/**
 * Resolved per call rather than at import time, because config.json is fetched
 * at startup and may name a different source than .env did.
 *
 * There is no mock adapter: the project runs on real data only. If nothing is
 * configured the adapters raise a clear error rather than quietly serving
 * invented content.
 */
export function getAdapter() {
  const name = config().dataSource
  const chosen = ADAPTERS[name]
  if (!chosen) {
    console.warn(`[data] unknown dataSource "${name}", falling back to sheets`)
    return sheetsAdapter
  }
  return chosen
}

/** True when access control is enforced by a server rather than by the UI. */
export function isServerEnforced() {
  return getAdapter().id === 'api'
}
