/**
 * Which student-list columns may reach a parent's screen (2026-11-28).
 *
 * The school's lists are working sheets: next to Name and Section they carry each
 * child's Aadhaar card number, date of birth, school email and parents' phone
 * numbers. Every signed-in family of the grade sees the list, so those columns
 * would show the whole batch's identity documents and contacts to every parent.
 *
 * They are dropped by HEADER, case- and punctuation-blind, on both paths: the
 * server's private read and the page's public read. A renamed column that no
 * longer matches would show, so the patterns are generous. To show a column again,
 * remove its pattern here.
 */
const HIDDEN = [
  /aad?h?aa?r/, // Aadhaar, Aadhar, Adhar card no.
  /\bdob\b|dateofbirth|birth/,
  /e-?mail/,
  /mobile|phone|contact|whatsapp/,
  /address/,
  /blood/,
  /passport|pan\b|govt|government/,
]

const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, '')

export function isHiddenColumn(header) {
  const plain = String(header || '').toLowerCase()
  const squashed = norm(header)
  return HIDDEN.some((re) => re.test(plain) || re.test(squashed))
}

/** Rows (header first) with the hidden columns removed. */
export function safeColumns(rows) {
  const [head = [], ...body] = rows || []
  const keep = head.map((_, c) => c).filter((c) => !isHiddenColumn(head[c]))
  if (keep.length === head.length) return rows || []
  const pickRow = (r) => keep.map((c) => (r || [])[c] ?? '')
  return [pickRow(head), ...body.map(pickRow)]
}
