export function orderAccounts(accounts, primaryAccountId) {
  return [...accounts].sort((a, b) => Number(b.id === primaryAccountId) - Number(a.id === primaryAccountId))
}

export function calculateAccountBalance(account, movements, throughDate) {
  if (!account) return 0
  return movements
    .filter(movement => movement.account_id === account.id && (!throughDate || movement.date <= throughDate))
    .reduce((balance, movement) => {
      const amount = Number(movement.amount) || 0
      const notes = String(movement.notes || '')
      if (notes.includes('[TRANSFER_IN]')) return balance + amount
      if (notes.includes('[TRANSFER_OUT]')) return balance - amount
      return movement.type === 'income' ? balance + amount : balance - amount
    }, Number(account.initial_balance) || 0)
}

// El balance mensual es el total disponible. La principal conserva el remanente
// después de distribuir los saldos registrados en las demás cuentas.
export function distributeAccountBalances(accounts, movements, primaryAccountId, closingBalance, month) {
  const balances = accounts.map(account => ({
    id: account.id,
    name: account.name,
    saldo: calculateAccountBalance(account, movements, `${month}-31`)
  }))
  const principal = balances.find(account => account.id === primaryAccountId)
    || [...balances].sort((a, b) => b.saldo - a.saldo)[0]
  if (!principal) return balances
  const otherBalance = balances.reduce((sum, account) => sum + (account.id === principal.id ? 0 : account.saldo), 0)
  return balances.map(account => ({
    ...account,
    saldo: account.id === principal.id ? closingBalance - otherBalance : account.saldo,
    reconciled: account.id === principal.id
  }))
}
