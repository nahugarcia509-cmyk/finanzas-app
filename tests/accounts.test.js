import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateAccountBalance, orderAccounts } from '../src/lib/accounts.js'

test('saldo de una cuenta incluye saldo inicial y transferencias, excluye otras cuentas y fechas futuras', () => {
  const account = { id: 'mp', initial_balance: '1000' }
  const movements = [
    { account_id: 'mp', date: '2026-04-01', type: 'income', amount: '100' },
    { account_id: 'mp', date: '2026-04-02', type: 'expense', amount: '40' },
    { account_id: 'mp', date: '2026-04-03', type: 'transfer', amount: '20', notes: '[TRANSFER_IN]' },
    { account_id: 'mp', date: '2026-04-03', type: 'transfer', amount: '10', notes: '[TRANSFER_OUT]' },
    { account_id: 'mp', date: '2026-04-04', type: 'expense', amount: '30', notes: '[SAVINGS_DEPOSIT]' },
    { account_id: 'other', date: '2026-04-01', type: 'income', amount: 9000 },
    { account_id: 'mp', date: '2026-05-01', type: 'income', amount: 500 }
  ]
  assert.equal(calculateAccountBalance(account, movements, '2026-04-30'), 1040)
  assert.equal(calculateAccountBalance(undefined, movements), 0)
})

test('la cuenta principal queda primera sin alterar la lista original; una preferencia eliminada conserva el orden', () => {
  const accounts = [{ id: 'cash' }, { id: 'mp' }, { id: 'bank' }]
  assert.deepEqual(orderAccounts(accounts, 'mp').map(a => a.id), ['mp', 'cash', 'bank'])
  assert.equal(accounts[0].id, 'cash')
  assert.deepEqual(orderAccounts(accounts, 'deleted'), accounts)
})

test('guardar el saldo real de Mercado Pago no duplica los movimientos y no afecta Santander', async () => {
  const { initialBalanceForCurrentBalance } = await import('../src/lib/accounts.js')
  const movements = [{ account_id: 'mp', date: '2026-11-01', type: 'income', amount: 1004617.39 }]
  const account = { id: 'mp', initial_balance: 2266442 }
  assert.equal(calculateAccountBalance(account, movements, '2026-11-10'), 3271059.39)
  const corrected = { ...account, initial_balance: initialBalanceForCurrentBalance('mp', movements, 2268573.1, '2026-11-10') }
  assert.equal(calculateAccountBalance(corrected, movements, '2026-11-10'), 2268573.1)
  assert.equal(calculateAccountBalance({ id: 'santander', initial_balance: 0 }, movements, '2026-11-10'), 0)
  const future = [...movements, { account_id: 'mp', date: '2026-12-01', type: 'expense', amount: 100 }]
  assert.equal(initialBalanceForCurrentBalance('mp', future, 2268573.1, '2026-11-10'), corrected.initial_balance)
  assert.equal(calculateAccountBalance(corrected, future, '2026-12-01'), 2268473.1)
})

test('transferir todo a Santander y gastar allí actualiza cada cuenta sin cambiar el total de la transferencia', () => {
  const mp = { id: 'mp', initial_balance: 2268573.1 }
  const bank = { id: 's', initial_balance: 0 }
  const rows = [
    { id: 'out', account_id: 'mp', date: '2026-11-10', type: 'expense', amount: 2268573.1, notes: '[TRANSFER_OUT] t' },
    { id: 'in', account_id: 's', date: '2026-11-10', type: 'income', amount: 2268573.1, notes: '[TRANSFER_IN] t' }
  ]
  assert.equal(calculateAccountBalance(mp, rows), 0)
  assert.equal(calculateAccountBalance(bank, rows), 2268573.1)
  rows.push({ id: 'expense', account_id: 's', date: '2026-11-10', type: 'expense', amount: 1000 })
  assert.equal(calculateAccountBalance(bank, rows), 2267573.1)
  rows[2] = { ...rows[2], account_id: 'mp', amount: 500 }
  assert.equal(calculateAccountBalance(mp, rows), -500)
  assert.equal(calculateAccountBalance(bank, rows), 2268573.1)
  assert.equal(calculateAccountBalance(mp, rows.slice(0, 2)), 0)
})

test('ahorro entre cuentas se descuenta una vez, con enlaces nuevos e historial anterior', () => {
  const mp = { id: 'mp', initial_balance: 1000 }
  const bank = { id: 's', initial_balance: 0 }
  const rows = [
    { account_id: 'mp', date: '2026-11-10', type: 'expense', amount: 200, notes: '[SAVINGS_DEPOSIT] Ahorro' },
    { account_id: 'mp', date: '2026-11-10', type: 'expense', amount: 200, description: 'Ahorro de Mercado Pago a Santander', notes: '[TRANSFER_OUT] t' },
    { account_id: 's', date: '2026-11-10', type: 'income', amount: 200, description: 'Ahorro de Mercado Pago a Santander', notes: '[TRANSFER_IN] t' }
  ]
  assert.equal(calculateAccountBalance(mp, rows), 800)
  assert.equal(calculateAccountBalance(bank, rows), 200)
  rows[0].notes = '[SAVINGS_DEPOSIT] [ACCOUNT_TRANSFER:t] Ahorro'
  assert.equal(calculateAccountBalance(mp, rows), 800)
  assert.equal(calculateAccountBalance(mp, rows.slice(0, 1)), 800)
})
