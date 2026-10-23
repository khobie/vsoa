import { neon } from '@neondatabase/serverless'
import { randomBytes, scryptSync } from 'node:crypto'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('ERROR: set DATABASE_URL first')
  process.exit(1)
}
const sql = neon(url)

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`
}

const accounts = [
  ['10987654', 'VoteDemo2026!'],
  ['STAFF-0142', 'AdminDemo2026!'],
]
for (const [institutionalId, password] of accounts) {
  const result = await sql`
    UPDATE users SET password_hash = ${hashPassword(password)}, updated_at = now()
    WHERE institutional_id = ${institutionalId}
    RETURNING id`
  if (!result[0]) throw new Error(`Demo account not found: ${institutionalId}`)
}
console.log('Demo account passwords updated')
