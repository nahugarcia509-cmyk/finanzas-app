import test from 'node:test'
import assert from 'node:assert/strict'
import { readAllTransactions } from '../src/lib/transactions.js'
import { localDate } from '../src/lib/dates.js'

test('carga todo el historial por páginas y conserva orden estable', async () => {
  const source = Array.from({ length: 1201 }, (_, id) => ({ id }))
  const ranges = []
  const query = {
    select() { return this }, eq(column, value) { assert.equal(column, 'user_id'); assert.equal(value, 'user'); return this },
    order() { return this }, range(start, end) { ranges.push([start, end]); return Promise.resolve({ data: source.slice(start, end + 1), error: null }) }
  }
  const result = await readAllTransactions({ from: () => query }, 'user')
  assert.deepEqual(result.data, source)
  assert.equal(ranges.length, 3)
})

test('un error de página impide presentar un historial parcial como completo', async () => {
  let page = 0
  const query = { select() { return this }, eq() { return this }, order() { return this }, range() { return ++page === 1 ? {data:[{id:1}],error:null} : {data:null,error:{message:'offline'}} } }
  const result = await readAllTransactions({ from: () => query }, 'user', 1)
  assert.equal(result.data, null)
  assert.equal(result.error.message, 'offline')
})

test('las fechas de formularios respetan el día local cerca de medianoche UTC', () => {
  const previous = process.env.TZ
  process.env.TZ = 'America/Argentina/Buenos_Aires'
  try { assert.equal(localDate(new Date('2026-11-10T01:00:00Z')), '2026-11-09') }
  finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})
