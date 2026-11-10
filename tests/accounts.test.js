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

test('Mercado Pago coincide con el balance si las demás cuentas están en cero, sin duplicar su saldo inicial', async () => {
  const { distributeAccountBalances } = await import('../src/lib/accounts.js')
  const accounts = [{ id: 'mp', name: 'Mercado Pago', initial_balance: 1002486.29 }, { id: 'nx', initial_balance: 0 }, { id: 's', initial_balance: 0 }]
  const movements = [{ account_id: 'mp', date: '2026-11-01', type: 'income', amount: 2268573.1 }]
  const result = distributeAccountBalances(accounts, movements, 'mp', 2268573.1, '2026-11')
  assert.equal(result.find(a => a.id === 'mp').saldo, 2268573.1)
  assert.equal(result.reduce((sum, a) => sum + a.saldo, 0), 2268573.1)
  assert.equal(accounts[0].initial_balance, 1002486.29)
  assert.equal(distributeAccountBalances(accounts, movements, '', 2268573.1, '2026-11')[0].saldo, 2268573.1)
})

test('la distribución respeta las otras cuentas y excluye sus movimientos de meses posteriores', async () => {
  const { distributeAccountBalances } = await import('../src/lib/accounts.js')
  const accounts = [{ id: 'mp', initial_balance: 9000 }, { id: 'bank', initial_balance: 100 }]
  const movements = [{ account_id: 'bank', date: '2026-11-01', type: 'income', amount: 50 }, { account_id: 'bank', date: '2026-12-01', type: 'income', amount: 800 }]
  const result = distributeAccountBalances(accounts, movements, 'mp', 1000, '2026-11')
  assert.equal(result.find(a => a.id === 'bank').saldo, 150)
  assert.equal(result.find(a => a.id === 'mp').saldo, 850)
  assert.equal(result.reduce((sum, a) => sum + a.saldo, 0), 1000)
  assert.deepEqual(distributeAccountBalances([], movements, '', 1000, '2026-11'), [])
})
