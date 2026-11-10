export function orderAccounts(accounts, primaryAccountId) {
  return [...accounts].sort((a, b) => Number(b.id === primaryAccountId) - Number(a.id === primaryAccountId))
}

export function calculateAccountBalance(account, movements, throughDate) {
  if (!account) return 0
  const included = movements.filter(movement => !throughDate || movement.date <= throughDate)
  const transferIds = new Set(included.flatMap(movement => {
    const match = String(movement.notes || '').match(/\[TRANSFER_(?:IN|OUT)\]\s+(\S+)/)
    return match ? [match[1]] : []
  }))
  // Compatibility with savings created before explicit transfer links existed.
  const savingsTransfers = new Map()
  included.forEach(movement => {
    const notes = String(movement.notes || '')
    const description = String(movement.description || '')
    const kind = notes.includes('[TRANSFER_OUT]') && description.startsWith('Ahorro de ')
      ? 'deposit' : notes.includes('[TRANSFER_IN]') && description.startsWith('Retiro de ahorro de ') ? 'withdrawal' : null
    if (kind) {
      const key = `${movement.date}|${movement.account_id}|${Number(movement.amount)}|${kind}`
      savingsTransfers.set(key, (savingsTransfers.get(key) || 0) + 1)
    }
  })
  const balance = included
    .filter(movement => movement.account_id === account.id)
    .reduce((balance, movement) => {
      const amount = Number(movement.amount) || 0
      const notes = String(movement.notes || '')
      const savingsKind = notes.includes('[SAVINGS_DEPOSIT]') ? 'deposit' : notes.includes('[SAVINGS_WITHDRAWAL]') ? 'withdrawal' : null
      if (savingsKind) {
        const link = notes.match(/\[ACCOUNT_TRANSFER:([^\]]+)\]/)?.[1]
        if (link && transferIds.has(link)) return balance
        const key = `${movement.date}|${movement.account_id}|${amount}|${savingsKind}`
        const pairedCount = savingsTransfers.get(key) || 0
        if (!link && pairedCount > 0) {
          savingsTransfers.set(key, pairedCount - 1)
          return balance
        }
      }
      if (notes.includes('[TRANSFER_IN]')) return balance + amount
      if (notes.includes('[TRANSFER_OUT]')) return balance - amount
      return movement.type === 'income' ? balance + amount : balance - amount
    }, Number(account.initial_balance) || 0)
  return Math.round(balance * 100) / 100
}

// Convierte el saldo real informado en la base necesaria para no duplicar
// los movimientos existentes. Usa el mismo conjunto de movimientos que el saldo mostrado.
export function initialBalanceForCurrentBalance(accountId, movements, currentBalance, throughDate) {
  const net = calculateAccountBalance({ id: accountId, initial_balance: 0 }, movements, throughDate)
  return Math.round((Number(currentBalance) - net) * 100) / 100
}
