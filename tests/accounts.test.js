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
