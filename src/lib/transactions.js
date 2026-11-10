export async function readAllTransactions(client, userId, pageSize = 500) {
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('transactions')
      .select('*,accounts(name),categories(name)')
      .eq('user_id', userId)
      .order('date', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return { data: rows, error: null }
  }
}
