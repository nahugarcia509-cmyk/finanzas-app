import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true })
try {
  const page = await browser.newPage({ timezoneId: 'America/Argentina/Buenos_Aires' })
  await page.clock.setFixedTime(new Date('2026-11-10T01:00:00Z'))
  const user = '00000000-0000-4000-8000-000000000001'
  const db = {
    accounts: [{ id: 'mp', user_id: user, name: 'Mercado Pago', initial_balance: 2268573.1 }, { id: 's', user_id: user, name: 'Santander', initial_balance: 0 }],
    categories: [{ id: 'exp', user_id: user, name: 'Comida', type: 'expense' }],
    transactions: [], user_settings: [{ user_id: user, opening_balance_month: '2026-10', opening_balance_amount: 2268573.1 }],
    account_preferences: [{ user_id: user, primary_account_id: 's' }], recurring_payments: [], credit_plans: [], notification_preferences: []
  }
  let sequence = 0
  const writes = []
  await page.route('**/src/lib/supabase.js', async route => {
    const response = await route.fetch()
    let body = (await response.text()).split('//# sourceMappingURL')[0]
    body = body.replace('import.meta.env.VITE_SUPABASE_URL', "'https://fixture.supabase.co'").replace('import.meta.env.VITE_SUPABASE_ANON_KEY', "'fixture-public-key'")
    body += `\nsupabase.auth.getSession = async () => ({data:{session:{user:{id:'${user}',user_metadata:{}}}}});\nsupabase.auth.onAuthStateChange = () => ({data:{subscription:{unsubscribe(){}}}});`
    await route.fulfill({ response, body })
  })
  await page.route('https://fixture.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url())
    const table = url.pathname.split('/').at(-1)
    if (!db[table]) throw new Error(`Unexpected table ${table}`)
    const method = request.method()
    let result
    if (method === 'POST') {
      const payload = request.postDataJSON()
      const rows = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: `row-${++sequence}`, ...row }))
      if (table === 'transactions') {
        assert.equal(rows.every(row => row.user_id === user), true)
        writes.push(rows)
        db[table].push(...rows)
      } else {
        for (const row of rows) {
          const old = db[table].find(item => item.user_id === row.user_id)
          if (old) Object.assign(old, row); else db[table].push(row)
        }
      }
      result = rows
    } else if (method === 'GET') {
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000)
      result = db[table].slice(offset, offset + limit)
    } else throw new Error(`Unexpected method ${method}`)
    result = result.map(row => table === 'transactions' ? { ...row, accounts: { name: db.accounts.find(a => a.id === row.account_id)?.name }, categories: { name: db.categories.find(c => c.id === row.category_id)?.name } } : row)
    const single = request.headers().accept?.includes('vnd.pgrst.object')
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(single ? result[0] : result), headers: { 'access-control-allow-origin': '*' } })
  })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173')
  const accounts = async () => page.getByRole('button', { name: 'Gestión de cuentas', exact: true }).click()
  const card = name => page.locator('.account-card').filter({ hasText: name }).locator('strong')
  await accounts()
  const transfer = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Transferencia entre cuentas' }) })
  await transfer.getByLabel(/^Desde/).selectOption('mp')
  await transfer.getByLabel(/^Hacia/).selectOption('s')
  await transfer.getByLabel('Fecha', { exact: true }).fill('2026-11-10')
  await transfer.getByLabel('Monto', { exact: true }).fill('2268573.10')
  await transfer.getByRole('button', { name: 'Transferir', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.notice')?.textContent?.includes('Transferencia registrada'))
  assert.equal(await card('Mercado Pago').innerText(), '$ 0')
  assert.equal(await card('Santander').innerText(), '$ 2.268.573,1')
  assert.equal(writes[0].length, 2)
  await page.reload(); await accounts()
  assert.equal(await card('Mercado Pago').innerText(), '$ 0')
  assert.equal(await card('Santander').innerText(), '$ 2.268.573,1')
  await page.getByRole('button', { name: 'Egreso', exact: true }).click()
  const modal = page.locator('.modal')
  assert.equal(await modal.getByLabel(/^Cuenta/).inputValue(), 's')
  await modal.getByLabel('Monto', { exact: true }).fill('1000')
  await modal.getByLabel('Concepto').fill('Gasto Santander')
  await modal.getByRole('button', { name: 'Guardar egreso', exact: true }).click()
  await modal.waitFor({ state: 'detached' })
  assert.equal(await card('Santander').innerText(), '$ 2.267.573,1')
  assert.equal(writes[1][0].account_id, 's')
  await page.reload(); await accounts()
  assert.equal(await card('Mercado Pago').innerText(), '$ 0')
  assert.equal(await card('Santander').innerText(), '$ 2.267.573,1')
  assert.deepEqual(errors, [])
  console.log('PASS: cliente Supabase real contra API simulada; inserción conjunta de transferencia, cuenta seleccionada en gasto y recarga del historial remoto.')
} finally { await browser.close() }
