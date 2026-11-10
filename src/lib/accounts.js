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

// Convierte el saldo real informado en la base necesaria para no duplicar
// los movimientos existentes. Los movimientos futuros siguen pendientes.
export function initialBalanceForCurrentBalance(accountId, movements, currentBalance, throughDate) {
  const net = calculateAccountBalance({ id: accountId, initial_balance: 0 }, movements, throughDate)
  return Math.round((Number(currentBalance) - net) * 100) / 100
}
