import * as rows from './mock/rows'
import { normalizeRow } from './csv'
import {
  toStudent, toTrip, toItineraryRow, toDocument,
  toGuideline, toReminder, toTravelLeg, toMedia,
} from './normalize'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Mock rows keep their human header casing so they read like the real sheet, so
 * they must go through normalizeRow first — the CSV path does that on parse.
 */
const map = (list, fn) => list.map((r, i) => fn(normalizeRow(r), i))

export const mockAdapter = {
  id: 'mock',
  label: 'Sample data',

  async fetchStudents() {
    await delay(220)
    return map(rows.students, toStudent)
  },

  async fetchTripSets() {
    await delay(320)
    return {
      trips: map(rows.trips, toTrip),
      itinerary: map(rows.itinerary, toItineraryRow),
      documents: map(rows.documents, toDocument),
      guidelines: map(rows.guidelines, toGuideline),
      reminders: map(rows.reminders, toReminder),
      travel: map(rows.travel, toTravelLeg),
      media: map(rows.media, toMedia),
    }
  },
}
