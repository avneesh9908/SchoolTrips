/**
 * Parents type their number a dozen different ways and the sheet stores it a
 * dozen more (+91, 0 prefix, spaces, dashes, Excel turning it into a number).
 * Comparing the last 10 digits is the only thing that reliably matches.
 */
export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}
