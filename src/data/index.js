import { config } from '../config'
import { mockAdapter } from './mockAdapter'
import { sheetsAdapter } from './sheetsAdapter'
import { apiAdapter } from './apiAdapter'

const ADAPTERS = { mock: mockAdapter, sheets: sheetsAdapter, api: apiAdapter }

/**
 * Resolved per call rather than at import time, because config.json is fetched
 * at startup and may name a different source than .env did.
 */
export function getAdapter() {
  const name = config().dataSource
  const chosen = ADAPTERS[name]
  if (!chosen) {
    console.warn(`[data] unknown dataSource "${name}", falling back to mock`)
    return mockAdapter
  }
  return chosen
}

/** True when the source is sample data, so the UI can say so plainly. */
export function isMock() {
  return getAdapter().id === 'mock'
}

/** True when access control is enforced by a server rather than by the UI. */
export function isServerEnforced() {
  return getAdapter().id === 'api'
}
