import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, CalendarDays, CircleDollarSign, FolderCog,
  LayoutDashboard, LogOut, Pencil, Plus, RefreshCw, Search, Settings, Settings2, Trash2,
  TrendingDown, TrendingUp, WalletCards, PiggyBank, ReceiptText, Download, Upload,
  Eye, EyeOff, UserRound
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie,
  PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { configured, supabase } from './lib/supabase'
import { money, monthKey } from './lib/money'
import { seedCategories, seedTransactions } from './lib/seedData'
import Auth from './components/Auth'
import MovementModal from './components/MovementModal'

const demoAccounts = [
  { id: 'a1', name: 'Billetera', currency: 'ARS', initial_balance: 0 },
  { id: 'a2', name: 'Banco', currency: 'ARS', initial_balance: 0 }
]
const initialDemoCategories = seedCategories.map((c, i) => ({ ...c, id: `seed-cat-${i}` }))
const palette = ['#38bdf8', '#4ade80', '#f59e0b', '#fb7185', '#a78bfa', '#22d3ee', '#f97316', '#e879f9', '#84cc16', '#facc15']

const SAVINGS_DEPOSIT = '[SAVINGS_DEPOSIT]'
const SAVINGS_WITHDRAWAL = '[SAVINGS_WITHDRAWAL]'

const isSavingsMovement = (movement) =>
  String(movement?.notes || '').includes(SAVINGS_DEPOSIT) ||
  String(movement?.notes || '').includes(SAVINGS_WITHDRAWAL)

const savingsKind = (movement) =>
  String(movement?.notes || '').includes(SAVINGS_DEPOSIT) ? 'deposit' :
  String(movement?.notes || '').includes(SAVINGS_WITHDRAWAL) ? 'withdrawal' :
  null

function CategoryForm({ onAdd }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), type })
    setName('')
  }
  return <form className="category-form" onSubmit={submit}>
    <label>Tipo<select value={type} onChange={e => setType(e.target.value)}><option value="income">Ingreso</option><option value="expense">Egreso</option></select></label>
    <label className="grow">Nombre de la categoría<input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Supermercado" /></label>
    <button><Plus /> Agregar categoría</button>
  </form>
}

function TransactionsTable({ rows, title, type, search, setSearch, onEdit, onDelete }) {
  return <section className="panel table-panel">
    <div className="panel-title table-heading">
      <div><h3>{title}</h3><span>{rows.length} movimientos</span></div>
      <label className="search compact"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Buscar ${type === 'income' ? 'ingresos' : 'egresos'}...`} /></label>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th className="right">Monto</th><th></th></tr></thead><tbody>
      {rows.map(m => <tr key={m.id}><td>{m.date?.split('-').reverse().join('/')}</td><td><span className={`type-pill ${type}`}>{m.categories?.name || (savingsKind(m) ? 'Ahorros' : 'Sin categoría')}</span></td><td>{m.description}{m.notes && !String(m.notes).includes('Dato histórico inicial') && !isSavingsMovement(m) ? <small>{m.notes}</small> : null}</td><td className={`right ${type === 'income' ? 'positive' : 'negative'}`}><b>{type === 'income' ? '+' : '-'}{money(m.amount)}</b></td><td><div className="row-actions"><button className="ghost" onClick={() => onEdit(m)}><Pencil /></button><button className="ghost danger" onClick={() => onDelete(m.id)}><Trash2 /></button></div></td></tr>)}
      {!rows.length && <tr><td colSpan="5" className="empty">No hay movimientos para el período seleccionado.</td></tr>}
    </tbody></table></div>
  </section>
}


function CategoryBreakdown({ title, rows, type }) {
  const grouped = useMemo(() => Object.values(rows.reduce((acc, row) => {
    const name = row.categories?.name || 'Sin categoría'
    acc[name] ??= { name, total: 0, items: [] }
    acc[name].total += Number(row.amount)
    acc[name].items.push(row)
    return acc
  }, {})).sort((a,b) => b.total-a.total), [rows])
  return <section className="panel breakdown-section">
    <div className="panel-title"><div><h3>{title}</h3><span>{grouped.length} categorías · {rows.length} movimientos</span></div></div>
    <div className="category-table-grid">
      {grouped.map(group => <article className={`category-detail-card ${type}`} key={group.name}>
        <header><b>{group.name}</b><strong>{money(group.total)}</strong></header>
        <div className="category-detail-body">
          {group.items.sort((a,b)=>a.date.localeCompare(b.date)).map(item => <div className="concept-row" key={item.id}>
            <div><span>{item.description}</span><small>{item.date?.split('-').reverse().join('/')}</small></div>
            <b>{money(item.amount)}</b>
          </div>)}
        </div>
        <footer><span>Total</span><b>{money(group.total)}</b></footer>
      </article>)}
      {!grouped.length && <div className="empty-card">Sin datos para el mes seleccionado.</div>}
    </div>
  </section>
}

function GeneralBalanceTable({ openingBalance, incomeByCategory, expenseByCategory, closingBalance, monthlySavingsDeposits }) {
  return <section className="panel general-balance">
    <div className="green-title">Balance general del mes</div>
    <div className="balance-table-head"><span>Categoría</span><span>Monto</span><span>Tipo</span></div>
    {openingBalance !== 0 && <div className="balance-line income"><span>Saldo mes anterior</span><b>{money(openingBalance)}</b><small>ingreso</small></div>}
    {incomeByCategory.map(x => <div className="balance-line income" key={`i-${x.name}`}><span>{x.name}</span><b>{money(x.value)}</b><small>ingreso</small></div>)}
    {expenseByCategory.filter(x => x.name !== 'Ahorros').map(x => <div className="balance-line expense" key={`e-${x.name}`}><span>{x.name}</span><b>- {money(x.value)}</b><small>egreso</small></div>)}
    {monthlySavingsDeposits > 0 && <div className="balance-line expense"><span>Ahorros</span><b>- {money(monthlySavingsDeposits)}</b><small>egreso</small></div>}
    <div className="balance-total"><span>Saldo final</span><strong className={closingBalance >= 0 ? 'positive' : 'negative'}>{money(closingBalance)}</strong></div>
  </section>
}

export default function App() {
  const [session, setSession] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(monthKey())
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [newType, setNewType] = useState('expense')
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('dashboard')
  const [dashboardView, setDashboardView] = useState('overview')
  const [selectedReserveCategories, setSelectedReserveCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('finance_selected_reserve_categories')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [selectedIncomeCategories, setSelectedIncomeCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('finance_selected_income_categories')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [savingsForm, setSavingsForm] = useState({
    kind: 'deposit',
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    description: ''
  })
  const [bigExpenseSearch, setBigExpenseSearch] = useState('')
  const [bigExpenseCategory, setBigExpenseCategory] = useState('all')
  const [savingsGoals, setSavingsGoals] = useState(() => {
    try {
      const saved = localStorage.getItem('finance_savings_goals')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [goalForm, setGoalForm] = useState({
    name: '',
    target: '',
    priority: 1
  })
  const [profileName, setProfileName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)

  useEffect(() => {
    if (!configured) {
      const storedCats = localStorage.getItem('finance_categories')
      const storedMovements = localStorage.getItem('finance_demo')
      const cats = storedCats ? JSON.parse(storedCats) : initialDemoCategories
      const catMap = new Map(cats.map(c => [`${c.type}|${c.name.toLowerCase()}`, c]))
      const initialMovements = storedMovements ? JSON.parse(storedMovements) : seedTransactions.map((x, i) => {
        const c = catMap.get(`${x.type}|${x.category.toLowerCase()}`)
        return { ...x, id: `historico-${i}`, account_id: demoAccounts[0].id, category_id: c?.id, accounts: { name: demoAccounts[0].name }, categories: { name: c?.name || x.category }, notes: null }
      })
      const cleanedInitialMovements = initialMovements.map(item => ({
        ...item,
        notes: item.notes === 'Dato histórico inicial' ? null : item.notes
      }))
      setAccounts(demoAccounts)
      setCategories(cats)
      setMovements(cleanedInitialMovements)
      localStorage.setItem('finance_categories', JSON.stringify(cats))
      localStorage.setItem('finance_demo', JSON.stringify(cleanedInitialMovements))
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadAll() }, [session])

  useEffect(() => {
    if (!session?.user) return
    setProfileName(session.user.user_metadata?.name || session.user.user_metadata?.full_name || '')
  }, [session])

  const saveAccountSettings = async (e) => {
    e.preventDefault()
    if (!configured || !supabase || !session?.user) {
      setNotice('La configuración de cuenta requiere una sesión activa de Supabase.')
      return
    }

    const cleanName = profileName.trim()
    const wantsPasswordChange = Boolean(newPassword || repeatPassword)

    if (wantsPasswordChange) {
      if (newPassword.length < 6) {
        setNotice('La nueva contraseña debe tener al menos 6 caracteres.')
        return
      }
      if (newPassword !== repeatPassword) {
        setNotice('Las contraseñas no coinciden.')
        return
      }
    }

    setSavingAccount(true)
    try {
      const updates = { data: { name: cleanName, full_name: cleanName } }
      if (wantsPasswordChange) updates.password = newPassword

      const { data, error } = await supabase.auth.updateUser(updates)
      if (error) throw error

      if (data?.user) {
        setSession(current => current ? { ...current, user: data.user } : current)
      }
      setNewPassword('')
      setRepeatPassword('')
      setNotice(wantsPasswordChange ? 'Nombre y contraseña actualizados correctamente.' : 'Nombre actualizado correctamente.')
    } catch (error) {
      setNotice(error?.message || 'No se pudieron guardar los cambios de la cuenta.')
    } finally {
      setSavingAccount(false)
    }
  }

  const OWNER_EMAIL = 'nahu.garcia.509@gmail.com'

  const loadAll = async () => {
    if (!session?.user?.id) return
    setLoading(true)
    try {
      await supabase.rpc('bootstrap_user')

      const currentEmail = String(session.user.email || '').trim().toLowerCase()
      const isOwner = currentEmail === OWNER_EMAIL

      // Cualquier usuario distinto del propietario debe comenzar sin cargas.
      // Se eliminan únicamente las transacciones pertenecientes a ese usuario.
      if (!isOwner) {
        const { error: clearError } = await supabase
          .from('transactions')
          .delete()
          .eq('user_id', session.user.id)

        if (clearError) throw clearError

        // Las metas se almacenaban en el navegador y podían heredarse entre cuentas.
        localStorage.removeItem('finance_savings_goals')
        localStorage.removeItem('finance_selected_reserve_categories')
        localStorage.removeItem('finance_selected_income_categories')
        setSavingsGoals([])
        setSelectedReserveCategories(null)
        setSelectedIncomeCategories(null)
      }

      const [a, c, m] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', session.user.id).order('name'),
        supabase.from('categories').select('*').eq('user_id', session.user.id).order('type').order('name'),
        supabase.from('transactions').select('*,accounts(name),categories(name)').eq('user_id', session.user.id).order('date', { ascending: false })
      ])
      if (a.error || c.error || m.error) throw new Error(a.error?.message || c.error?.message || m.error?.message)
      setAccounts(a.data || [])
      setCategories(c.data || [])
      setMovements(isOwner ? (m.data || []) : [])
    } catch (e) { setNotice(e.message || String(e)) }
    finally { setLoading(false) }
  }

  const openNew = (type) => { setEditing(null); setNewType(type); setModal(true) }

  const save = async (form) => {
    if (!configured) {
      const row = { ...form, accounts: { name: accounts.find(a => a.id === form.account_id)?.name }, categories: { name: categories.find(c => c.id === form.category_id)?.name } }
      const next = editing ? movements.map(x => x.id === editing.id ? { ...x, ...row } : x) : [{ ...row, id: crypto.randomUUID() }, ...movements]
      setMovements(next)
      localStorage.setItem('finance_demo', JSON.stringify(next))
      setModal(false); setEditing(null)
      return
    }
    const payload = { type: form.type, date: form.date, description: form.description, amount: form.amount, account_id: form.account_id, category_id: form.category_id || null, notes: form.notes || null, user_id: session.user.id }
    const q = editing ? supabase.from('transactions').update(payload).eq('id', editing.id).eq('user_id', session.user.id) : supabase.from('transactions').insert(payload)
    const { error } = await q
    if (error) setNotice(error.message)
    else { setModal(false); setEditing(null); loadAll() }
  }


  const saveSavingsMovement = async (e) => {
    e.preventDefault()
    const amount = Number(savingsForm.amount)
    if (!amount || amount <= 0) {
      setNotice('Ingrese un monto válido.')
      return
    }

    const isDeposit = savingsForm.kind === 'deposit'
    const description = savingsForm.description.trim() || (isDeposit ? 'Aporte a ahorros' : 'Retiro de ahorros')
    const noteMarker = isDeposit ? SAVINGS_DEPOSIT : SAVINGS_WITHDRAWAL
    const categoryName = 'Ahorros'

    let category = categories.find(c => c.type === (isDeposit ? 'expense' : 'income') && c.name.toLowerCase() === categoryName.toLowerCase())

    if (!category) {
      if (!configured) {
        category = { id: crypto.randomUUID(), name: categoryName, type: isDeposit ? 'expense' : 'income' }
        const nextCategories = [...categories, category]
        setCategories(nextCategories)
        localStorage.setItem('finance_categories', JSON.stringify(nextCategories))
      } else {
        const { data, error } = await supabase
          .from('categories')
          .insert({ name: categoryName, type: isDeposit ? 'expense' : 'income', user_id: session.user.id })
          .select()
          .single()
        if (error) {
          setNotice(error.message)
          return
        }
        category = data
      }
    }

    const account = accounts[0]
    if (!account) {
      setNotice('No existe una cuenta disponible.')
      return
    }

    const payload = {
      type: isDeposit ? 'expense' : 'income',
      date: savingsForm.date,
      description,
      amount,
      account_id: account.id,
      category_id: category.id,
      notes: `${noteMarker} ${description}`
    }

    if (!configured) {
      const row = {
        ...payload,
        id: crypto.randomUUID(),
        accounts: { name: account.name },
        categories: { name: category.name }
      }
      const next = [row, ...movements]
      setMovements(next)
      localStorage.setItem('finance_demo', JSON.stringify(next))
    } else {
      const { error } = await supabase.from('transactions').insert({
        ...payload,
        user_id: session.user.id
      })
      if (error) {
        setNotice(error.message)
        return
      }
      await loadAll()
    }

    setSavingsForm({
      kind: 'deposit',
      date: new Date().toISOString().slice(0, 10),
      amount: '',
      description: ''
    })
    setNotice(isDeposit ? 'Dinero guardado en ahorros.' : 'Dinero retirado de ahorros.')
  }


  const saveSavingsGoal = (e) => {
    e.preventDefault()
    const target = Number(goalForm.target)
    const name = goalForm.name.trim()

    if (!name || !target || target <= 0) {
      setNotice('Ingrese un nombre y un objetivo válido para la meta.')
      return
    }

    const next = [
      ...savingsGoals,
      {
        id: crypto.randomUUID(),
        name,
        target,
        priority: Number(goalForm.priority) || 1,
        createdAt: new Date().toISOString()
      }
    ].sort((a, b) => a.priority - b.priority || new Date(a.createdAt) - new Date(b.createdAt))

    setSavingsGoals(next)
    localStorage.setItem('finance_savings_goals', JSON.stringify(next))
    setGoalForm({ name: '', target: '', priority: next.length + 1 })
    setNotice('Meta de ahorro agregada.')
  }

  const removeSavingsGoal = (id) => {
    if (!confirm('¿Eliminar esta meta de ahorro?')) return
    const next = savingsGoals.filter(goal => goal.id !== id)
    setSavingsGoals(next)
    localStorage.setItem('finance_savings_goals', JSON.stringify(next))
  }

  const moveSavingsGoal = (id, direction) => {
    const ordered = [...savingsGoals].sort((a, b) => a.priority - b.priority)
    const index = ordered.findIndex(goal => goal.id === id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return

    const temp = ordered[index].priority
    ordered[index].priority = ordered[targetIndex].priority
    ordered[targetIndex].priority = temp

    const normalized = ordered
      .sort((a, b) => a.priority - b.priority)
      .map((goal, idx) => ({ ...goal, priority: idx + 1 }))

    setSavingsGoals(normalized)
    localStorage.setItem('finance_savings_goals', JSON.stringify(normalized))
  }

  const remove = async (id) => {
    if (!confirm('¿Eliminar este movimiento?')) return
    if (!configured) {
      const next = movements.filter(x => x.id !== id)
      setMovements(next); localStorage.setItem('finance_demo', JSON.stringify(next)); return
    }
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', session.user.id)
    if (error) setNotice(error.message); else loadAll()
  }

  const addCategory = async (item) => {
    if (categories.some(c => c.name.toLowerCase() === item.name.toLowerCase() && c.type === item.type)) { setNotice('Esa categoría ya existe.'); return }
    if (!configured) {
      const next = [...categories, { ...item, id: crypto.randomUUID() }].sort((a, b) => a.name.localeCompare(b.name))
      setCategories(next); localStorage.setItem('finance_categories', JSON.stringify(next)); setNotice('Categoría agregada.'); return
    }
    const { error } = await supabase.from('categories').insert({ ...item, user_id: session.user.id })
    if (error) setNotice(error.message); else { setNotice('Categoría agregada.'); loadAll() }
  }

  const removeCategory = async (cat) => {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return
    if (!configured) {
      const next = categories.filter(c => c.id !== cat.id)
      setCategories(next); localStorage.setItem('finance_categories', JSON.stringify(next)); return
    }
    const { error } = await supabase.from('categories').delete().eq('id', cat.id).eq('user_id', session.user.id)
    if (error) setNotice(error.message); else loadAll()
  }

  const DATA_START = '2026-04'
  // Saldo final real de abril según la planilla original.
  // Desde mayo, este importe se arrastra como saldo del mes anterior.
  const APRIL_CLOSING_BALANCE = session?.user?.email?.toLowerCase() === 'nahu.garcia.509@gmail.com' ? 266941.14 : 0
  const monthRows = useMemo(() => movements.filter(m => m.date?.startsWith(month)), [movements, month])
  const visibleMonthRows = useMemo(() => monthRows, [monthRows])
  const searchedRows = useMemo(
    () => visibleMonthRows.filter(m =>
      `${m.description} ${m.categories?.name || ''}`.toLowerCase().includes(search.toLowerCase())
    ),
    [visibleMonthRows, search]
  )

  // Los retiros desde ahorros se muestran como ingresos de la categoría Ahorros.
  // Los aportes a ahorros se muestran como egresos en la pestaña Egresos.
  const incomeRows = useMemo(
    () => searchedRows
      .filter(x => x.type === 'income')
      .sort((a, b) => {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''))
        if (dateCompare !== 0) return dateCompare
        return Number(b.amount) - Number(a.amount)
      }),
    [searchedRows]
  )

  const expenseRows = useMemo(
    () => searchedRows
      .filter(x => x.type === 'expense')
      .sort((a, b) => {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''))
        if (dateCompare !== 0) return dateCompare
        return Number(b.amount) - Number(a.amount)
      }),
    [searchedRows]
  )
  const income = incomeRows.reduce((s, x) => s + Number(x.amount), 0)
  const expense = expenseRows.reduce((s, x) => s + Number(x.amount), 0)

  const expenseRowsWithoutSavings = useMemo(
    () => expenseRows.filter(x => savingsKind(x) !== 'deposit'),
    [expenseRows]
  )

  const expenseWithoutSavings = useMemo(
    () => expenseRowsWithoutSavings.reduce((sum, x) => sum + Number(x.amount), 0),
    [expenseRowsWithoutSavings]
  )
  const openingBalance = useMemo(() => {
    // Abril es el mes inicial y no arrastra saldo anterior.
    if (!month || month <= DATA_START) return 0

    // Mayo debe comenzar exactamente con el saldo final real de abril.
    // Para junio en adelante se suma al saldo de abril el resultado neto
    // de todos los movimientos cargados desde mayo hasta el mes anterior.
    const carryFromMay = movements
      .filter(x => {
        const k = x.date?.slice(0, 7)
        return k && k >= '2026-05' && k < month
      })
      .reduce((sum, x) => sum + (x.type === 'income' ? Number(x.amount) : -Number(x.amount)), 0)

    return APRIL_CLOSING_BALANCE + carryFromMay
  }, [movements, month])
  const monthlyNet = income - expense
  const closingBalance = openingBalance + monthlyNet
  const savingRate = (openingBalance + income) > 0 ? (closingBalance / (openingBalance + income)) * 100 : 0
  const daysWithExpense = new Set(expenseRowsWithoutSavings.map(x => x.date)).size
  const avgDailyExpense = daysWithExpense ? expenseWithoutSavings / daysWithExpense : 0
  const biggestExpense = expenseRowsWithoutSavings.reduce(
    (max, x) => Number(x.amount) > Number(max?.amount || 0) ? x : max,
    null
  )

  const byCategory = useMemo(() => Object.values(expenseRowsWithoutSavings.reduce((o, x) => {
    const n = x.categories?.name || 'Sin categoría'; o[n] ??= { name:n, value:0, count:0 }; o[n].value += Number(x.amount); o[n].count += 1; return o
  }, {})).sort((a,b)=>b.value-a.value), [expenseRowsWithoutSavings])
  const incomeByCategory = useMemo(() => Object.values(incomeRows.reduce((o, x) => {
    const n = x.categories?.name || 'Sin categoría'; o[n] ??= { name:n, value:0, count:0 }; o[n].value += Number(x.amount); o[n].count += 1; return o
  }, {})).sort((a,b)=>b.value-a.value), [incomeRows])

  const topExpenseCategory = byCategory[0] || null
  const topIncomeCategory = incomeByCategory[0] || null
  const expenseConcentration = expenseWithoutSavings > 0 && topExpenseCategory
    ? (topExpenseCategory.value / expenseWithoutSavings) * 100
    : 0

  const topExpenseItems = [...expenseRowsWithoutSavings]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 10)
    .map(x => ({
      name: x.description || 'Sin concepto',
      value: Number(x.amount),
      category: x.categories?.name || 'Sin categoría'
    }))

  const daysInSelectedMonth = useMemo(() => {
    const [year, monthNumber] = month.split('-').map(Number)
    return new Date(year, monthNumber, 0).getDate()
  }, [month])
  const dayTicks = useMemo(() => Array.from({ length: daysInSelectedMonth }, (_, index) => index + 1), [daysInSelectedMonth])
  const daily = useMemo(() => {
    const grouped = Object.fromEntries(dayTicks.map(day => [day, { day, ingresos: 0, egresos: 0 }]))
    monthRows.forEach(x => {
      const day = Number(x.date?.slice(8, 10))
      if (!grouped[day]) return
      if (x.type === 'income') grouped[day].ingresos += Number(x.amount)
      else grouped[day].egresos += Number(x.amount)
    })
    let cumulative = openingBalance
    let accumulatedIncome = 0
    let accumulatedExpense = 0
    return dayTicks.map(day => {
      const current = grouped[day]
      accumulatedIncome += current.ingresos
      accumulatedExpense += current.egresos
      cumulative += current.ingresos - current.egresos
      return {
        ...current,
        balanceDia: current.ingresos - current.egresos,
        acumulado: cumulative,
        ingresosAc: accumulatedIncome,
        egresosAc: accumulatedExpense
      }
    })
  }, [monthRows, openingBalance, dayTicks])

  const monthTotals = useMemo(() => {
    const grouped = movements.reduce((o,x)=>{ const k=x.date?.slice(0,7); if(!k || k<DATA_START) return o; o[k]??={month:k,ingresos:0,egresos:0}; if(x.type==='income')o[k].ingresos+=Number(x.amount); else o[k].egresos+=Number(x.amount); return o },{})

    return Object.values(grouped).sort((a,b)=>a.month.localeCompare(b.month)).map((x, index, all) => {
      if (x.month === DATA_START) {
        return { ...x, apertura: 0, neto: x.ingresos - x.egresos, saldoFinal: APRIL_CLOSING_BALANCE }
      }

      const previous = all.slice(0, index).filter(item => item.month >= '2026-05')
      const apertura = APRIL_CLOSING_BALANCE + previous.reduce((sum, item) => sum + item.ingresos - item.egresos, 0)
      const neto = x.ingresos - x.egresos
      return { ...x, apertura, neto, saldoFinal: apertura + neto }
    })
  }, [movements])

  const analysisMonths = useMemo(() => {
    const keys = [...new Set(movements.map(x => x.date?.slice(0, 7)).filter(k => k && k >= DATA_START))]
    return keys.sort()
  }, [movements])

  const financeAnalysis = useMemo(() => {
    const monthCount = Math.max(analysisMonths.length, 1)
    const createStats = (type) => {
      const grouped = {}
      movements.filter(x => {
        if (x.date?.slice(0, 7) < DATA_START || x.type !== type) return false

        // Los aportes a ahorros no forman parte del gasto analizado,
        // porque justamente el análisis debe estimar la capacidad de ahorro.
        if (type === 'expense' && savingsKind(x) === 'deposit') return false

        // Los retiros de ahorros sí se consideran ingresos de la categoría Ahorros.
        if (type === 'income' && savingsKind(x) === 'withdrawal') return true

        return !isSavingsMovement(x)
      }).forEach(x => {
        const name = x.categories?.name || 'Sin categoría'
        const monthKeyValue = x.date.slice(0, 7)
        grouped[name] ??= { name, total: 0, count: 0, months: {} }
        grouped[name].total += Number(x.amount)
        grouped[name].count += 1
        grouped[name].months[monthKeyValue] = (grouped[name].months[monthKeyValue] || 0) + Number(x.amount)
      })
      return Object.values(grouped).map(item => {
        const monthlyValues = analysisMonths.map(k => item.months[k] || 0)
        const activeMonths = monthlyValues.filter(v => v > 0).length
        // El promedio mensual de cada categoría se calcula únicamente
        // sobre los meses en los que esa categoría tuvo movimientos.
        const averageMonthly = activeMonths ? item.total / activeMonths : 0
        const maxMonthly = monthlyValues.length ? Math.max(...monthlyValues) : 0
        const consistency = monthCount ? (activeMonths / monthCount) * 100 : 0
        const suggestedReserve = type === 'expense' ? averageMonthly * 1.20 : averageMonthly
        return {
          ...item,
          averageMonthly,
          averageMovement: item.count ? item.total / item.count : 0,
          maxMonthly,
          activeMonths,
          consistency,
          suggestedReserve
        }
      }).sort((a, b) => b.averageMonthly - a.averageMonthly)
    }

    const expenses = createStats('expense')
    const incomes = createStats('income')
    const analysisMonthTotals = analysisMonths.map(monthKeyValue => {
      const rows = movements.filter(x => x.date?.startsWith(monthKeyValue))

      const ingresos = rows
        .filter(x => x.type === 'income')
        .reduce((sum, x) => sum + Number(x.amount), 0)

      const egresos = rows
        .filter(x => x.type === 'expense' && savingsKind(x) !== 'deposit')
        .reduce((sum, x) => sum + Number(x.amount), 0)

      return { month: monthKeyValue, ingresos, egresos }
    })

    const averageIncome = analysisMonthTotals.length
      ? analysisMonthTotals.reduce((s, x) => s + x.ingresos, 0) / analysisMonthTotals.length
      : 0

    const averageExpense = analysisMonthTotals.length
      ? analysisMonthTotals.reduce((s, x) => s + x.egresos, 0) / analysisMonthTotals.length
      : 0
    const averageNet = averageIncome - averageExpense
    const averageSavingRate = averageIncome > 0 ? (averageNet / averageIncome) * 100 : 0
    const emergencyFund = averageExpense * 3
    const recommendedCategoryBudget = expenses.reduce((s, x) => s + x.suggestedReserve, 0)
    const lastThree = analysisMonthTotals.slice(-3)
    const recentAverageExpense = lastThree.length
      ? lastThree.reduce((s, x) => s + x.egresos, 0) / lastThree.length
      : 0
    const expenseTrend = averageExpense > 0 ? ((recentAverageExpense - averageExpense) / averageExpense) * 100 : 0

    return {
      expenses,
      incomes,
      averageIncome,
      averageExpense,
      averageNet,
      averageSavingRate,
      emergencyFund,
      recommendedCategoryBudget,
      recentAverageExpense,
      expenseTrend,
      analysisMonthTotals
    }
  }, [movements, analysisMonths, monthTotals])

  useEffect(() => {
    if (!financeAnalysis.expenses.length) return

    setSelectedReserveCategories(current => {
      if (Array.isArray(current)) {
        const valid = current.filter(name => financeAnalysis.expenses.some(x => x.name === name))
        localStorage.setItem('finance_selected_reserve_categories', JSON.stringify(valid))
        return valid
      }

      const defaults = financeAnalysis.expenses.map(x => x.name)
      localStorage.setItem('finance_selected_reserve_categories', JSON.stringify(defaults))
      return defaults
    })
  }, [financeAnalysis.expenses])

  const selectedReserveExpenses = useMemo(() => {
    if (!Array.isArray(selectedReserveCategories)) return financeAnalysis.expenses
    return financeAnalysis.expenses.filter(x => selectedReserveCategories.includes(x.name))
  }, [financeAnalysis.expenses, selectedReserveCategories])

  const selectedReserveTotal = useMemo(
    () => selectedReserveExpenses.reduce((sum, x) => sum + x.suggestedReserve, 0),
    [selectedReserveExpenses]
  )

  const selectedExpenseAverageTotal = useMemo(
    () => selectedReserveExpenses.reduce((sum, x) => sum + x.averageMonthly, 0),
    [selectedReserveExpenses]
  )

  const toggleReserveCategory = (name) => {
    setSelectedReserveCategories(current => {
      const base = Array.isArray(current)
        ? current
        : financeAnalysis.expenses.map(x => x.name)

      const next = base.includes(name)
        ? base.filter(x => x !== name)
        : [...base, name]

      localStorage.setItem('finance_selected_reserve_categories', JSON.stringify(next))
      return next
    })
  }

  const selectAllReserveCategories = () => {
    const next = financeAnalysis.expenses.map(x => x.name)
    setSelectedReserveCategories(next)
    localStorage.setItem('finance_selected_reserve_categories', JSON.stringify(next))
  }

  const clearReserveCategories = () => {
    setSelectedReserveCategories([])
    localStorage.setItem('finance_selected_reserve_categories', JSON.stringify([]))
  }

  useEffect(() => {
    if (!financeAnalysis.incomes.length) return

    setSelectedIncomeCategories(current => {
      if (Array.isArray(current)) {
        const valid = current.filter(name => financeAnalysis.incomes.some(x => x.name === name))
        localStorage.setItem('finance_selected_income_categories', JSON.stringify(valid))
        return valid
      }

      const defaults = financeAnalysis.incomes.map(x => x.name)
      localStorage.setItem('finance_selected_income_categories', JSON.stringify(defaults))
      return defaults
    })
  }, [financeAnalysis.incomes])

  const selectedIncomeAnalysis = useMemo(() => {
    if (!Array.isArray(selectedIncomeCategories)) return financeAnalysis.incomes
    return financeAnalysis.incomes.filter(x => selectedIncomeCategories.includes(x.name))
  }, [financeAnalysis.incomes, selectedIncomeCategories])

  const selectedIncomeTotal = useMemo(
    () => selectedIncomeAnalysis.reduce((sum, x) => sum + x.averageMonthly, 0),
    [selectedIncomeAnalysis]
  )

  const selectedSavingsCapacity = selectedIncomeTotal - selectedExpenseAverageTotal
  const selectedSavingsRate = selectedIncomeTotal > 0
    ? (selectedSavingsCapacity / selectedIncomeTotal) * 100
    : 0
  const selectedEmergencyFund = selectedExpenseAverageTotal * 3

  const toggleIncomeCategory = (name) => {
    setSelectedIncomeCategories(current => {
      const base = Array.isArray(current)
        ? current
        : financeAnalysis.incomes.map(x => x.name)

      const next = base.includes(name)
        ? base.filter(x => x !== name)
        : [...base, name]

      localStorage.setItem('finance_selected_income_categories', JSON.stringify(next))
      return next
    })
  }

  const selectAllIncomeCategories = () => {
    const next = financeAnalysis.incomes.map(x => x.name)
    setSelectedIncomeCategories(next)
    localStorage.setItem('finance_selected_income_categories', JSON.stringify(next))
  }

  const clearIncomeCategories = () => {
    setSelectedIncomeCategories([])
    localStorage.setItem('finance_selected_income_categories', JSON.stringify([]))
  }


  const savingsMovements = useMemo(
    () => movements
      .filter(isSavingsMovement)
      .sort((a, b) => {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''))
        if (dateCompare !== 0) return dateCompare
        return String(b.id || '').localeCompare(String(a.id || ''))
      }),
    [movements]
  )

  const savingsBalance = useMemo(
    () => savingsMovements.reduce((sum, item) => {
      const amount = Number(item.amount)
      return sum + (savingsKind(item) === 'deposit' ? amount : -amount)
    }, 0),
    [savingsMovements]
  )

  const savingsDeposits = useMemo(
    () => savingsMovements.filter(x => savingsKind(x) === 'deposit').reduce((sum, x) => sum + Number(x.amount), 0),
    [savingsMovements]
  )

  const savingsWithdrawals = useMemo(
    () => savingsMovements.filter(x => savingsKind(x) === 'withdrawal').reduce((sum, x) => sum + Number(x.amount), 0),
    [savingsMovements]
  )


  const monthlySavingsDeposits = useMemo(
    () => savingsMovements
      .filter(x => savingsKind(x) === 'deposit' && x.date?.startsWith(month))
      .reduce((sum, x) => sum + Number(x.amount), 0),
    [savingsMovements, month]
  )

  const allocatedSavingsGoals = useMemo(() => {
    let available = Math.max(savingsBalance, 0)

    return [...savingsGoals]
      .sort((a, b) => a.priority - b.priority || new Date(a.createdAt) - new Date(b.createdAt))
      .map((goal, index) => {
        const target = Number(goal.target) || 0
        const allocated = Math.min(available, target)
        available = Math.max(available - allocated, 0)

        return {
          ...goal,
          priority: index + 1,
          allocated,
          remaining: Math.max(target - allocated, 0),
          progress: target > 0 ? Math.min((allocated / target) * 100, 100) : 0,
          completed: target > 0 && allocated >= target
        }
      })
  }, [savingsGoals, savingsBalance])

  const bigExpenses = useMemo(() => {
    const query = bigExpenseSearch.trim().toLowerCase()
    return movements
      .filter(x => x.type === 'expense' && !isSavingsMovement(x))
      .filter(x => bigExpenseCategory === 'all' || (x.categories?.name || 'Sin categoría') === bigExpenseCategory)
      .filter(x => !query || `${x.description} ${x.categories?.name || ''} ${x.notes || ''}`.toLowerCase().includes(query))
      .sort((a, b) => Number(b.amount) - Number(a.amount))
  }, [movements, bigExpenseSearch, bigExpenseCategory])

  const bigExpenseCategories = useMemo(
    () => [...new Set(movements.filter(x => x.type === 'expense' && !isSavingsMovement(x)).map(x => x.categories?.name || 'Sin categoría'))].sort(),
    [movements]
  )

  if (loading) return <div className="center"><RefreshCw className="spin" /> Cargando finanzas…</div>
  if (configured && !session) return <Auth supabase={supabase} />

  return <div className="app">
    <style>{`
      .kpis.extended article[title] { cursor: help; position: relative; }
      .kpis.extended article[title]:hover { transform: translateY(-2px); transition: transform .15s ease; }
      .reserve-table-note { color: #8aa7c7; font-size: 12px; margin-top: 4px; display: block; }
      .reserve-amount { color: #f59e0b; font-weight: 800; }
      .reserve-margin { color: #38bdf8; }
      .kpis article { cursor: help; }
      .goal-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:14px; margin-top:14px; align-items:stretch; }
      .goal-card { border:1px solid #29405c; border-radius:14px; padding:16px; background:#0d1c30; min-width:0; overflow:hidden; }
      .goal-card header { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:12px; margin-bottom:12px; }
      .goal-card header > div:first-child { min-width:0; overflow:hidden; }
      .goal-card h3 { margin:0 0 4px; white-space:normal; word-break:break-word; overflow-wrap:anywhere; line-height:1.25; font-size:18px; }
      .goal-card small { color:#8aa7c7; }
      .goal-progress { height:12px; border-radius:999px; overflow:hidden; background:#17283d; margin:12px 0 8px; }
      .goal-progress > div { height:100%; background:linear-gradient(90deg,#38bdf8,#4ade80); border-radius:999px; transition:width .25s ease; }
      .goal-values { display:flex; justify-content:space-between; gap:10px; font-size:12px; color:#9fb3c8; }
      .goal-values b { color:#fff; }
      .historical-note-hidden { display:none !important; }
      .goal-card * { max-width:100%; }
      .goal-actions { display:flex; gap:6px; flex-shrink:0; align-items:center; }
      .goal-actions button { padding:6px; min-width:32px; }
      @media (max-width:1000px) { .goal-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:650px) { .goal-grid { grid-template-columns:1fr; } }
    `}</style>
    <style>{`
      .app, .app * { box-sizing: border-box; }
      .app { width: 100%; max-width: 100vw; overflow-x: hidden; }
      .app main { width: 100%; max-width: 100%; padding-left: clamp(12px, 1.5vw, 24px); padding-right: clamp(12px, 1.5vw, 24px); }
      .dashboard-subtabs { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 14px; }
      .dashboard-subtabs button { display:flex; align-items:center; gap:7px; border:1px solid #29405c; background:#0c1b2f; color:#9fb3c8; padding:9px 14px; border-radius:10px; cursor:pointer; }
      .dashboard-subtabs button svg { width:17px; height:17px; }
      .dashboard-subtabs button.active { color:#fff; background:#183652; border-color:#38bdf8; }
      .compact-kpis { display:grid !important; grid-template-columns:repeat(5,minmax(0,1fr)) !important; gap:10px !important; }
      .compact-kpis article { min-width:0; padding:14px !important; }
      .compact-kpis article strong { font-size:clamp(17px,1.35vw,24px) !important; overflow-wrap:anywhere; }
      .dashboard-wide-grid { display:grid !important; grid-template-columns:repeat(4,minmax(0,1fr)) !important; gap:12px !important; width:100%; }
      .dashboard-wide-grid > .panel { grid-column:span 2; min-width:0; }
      .dashboard-wide-grid > .full-width-chart { grid-column:1 / -1; }
      .dashboard-wide-grid .chart { width:100%; min-width:0; height:290px; }
      .dashboard-wide-grid .chart.tall { height:310px; }
      .compact-legend { max-height:150px; overflow:auto; }
      .category-kpis { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
      .category-table-grid { grid-template-columns:repeat(4,minmax(0,1fr)) !important; }
      .category-detail-card { min-width:0; }
      .category-detail-body { max-height:330px; overflow:auto; }
      .account-settings { max-width:760px; margin:0 auto; }
      .account-settings-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
      .account-settings label { display:flex; flex-direction:column; gap:8px; color:#9fb3c8; font-size:13px; }
      .account-settings input { width:100%; }
      .account-settings .full-row { grid-column:1 / -1; }
      .password-field { position:relative; }
      .password-field input { padding-right:48px; }
      .password-toggle { position:absolute; right:6px; top:50%; transform:translateY(-50%); padding:7px !important; min-width:34px; }
      .account-summary { display:flex; align-items:center; gap:14px; padding:14px; margin-bottom:18px; border:1px solid #29405c; border-radius:12px; background:#0d1c30; }
      .account-summary svg { width:30px; height:30px; color:#38bdf8; }
      .settings-actions { display:flex; justify-content:space-between; gap:12px; margin-top:18px; flex-wrap:wrap; }
      .header-settings.active { color:#fff; background:#183652; border-color:#38bdf8; }
      .floating-settings-button { position:fixed; top:18px; right:18px; z-index:99999; width:52px; height:52px; min-width:52px; padding:0 !important; border-radius:50%; display:flex; align-items:center; justify-content:center; background:#38bdf8 !important; color:#06111f !important; border:2px solid #d8f4ff !important; box-shadow:0 8px 28px rgba(0,0,0,.45), 0 0 0 4px rgba(56,189,248,.18); cursor:pointer; }
      .floating-settings-button:hover { transform:rotate(20deg) scale(1.06); }
      .floating-settings-button svg { width:28px; height:28px; stroke-width:2.5; }
      .floating-settings-button.active { background:#ffffff !important; color:#0c1b2f !important; }
      header .header-actions { padding-right:70px; }
      @media (max-width:700px) { .floating-settings-button { top:12px; right:12px; width:46px; height:46px; min-width:46px; } header .header-actions { padding-right:58px; } }
      @media (max-width:1100px) {
        .compact-kpis { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
        .dashboard-wide-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
        .dashboard-wide-grid > .panel { grid-column:span 1; }
        .dashboard-wide-grid > .full-width-chart { grid-column:1 / -1; }
        .category-table-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
      }
      @media (max-width:700px) {
        .compact-kpis, .category-kpis { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
        .dashboard-wide-grid { grid-template-columns:1fr !important; }
        .dashboard-wide-grid > .panel, .dashboard-wide-grid > .full-width-chart { grid-column:1 !important; }
        .dashboard-wide-grid .chart, .dashboard-wide-grid .chart.tall { height:270px; }
        .category-table-grid { grid-template-columns:1fr !important; }
        .dashboard-subtabs button { flex:1 1 100%; justify-content:center; }
        .account-settings-grid { grid-template-columns:1fr; }
        .account-settings .full-row { grid-column:1; }
      }
    `}</style>
    <button className={`floating-settings-button ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')} title="Configuración" aria-label="Abrir configuración"><Settings /></button>
    <header><div className="brand"><div className="brand-icon"><WalletCards /></div><div><b>Mis Finanzas</b><small>Información sincronizada y siempre disponible</small></div></div><div className="header-actions"><button className="secondary" onClick={() => openNew('income')}><ArrowUpCircle /> Ingreso</button><button onClick={() => openNew('expense')}><ArrowDownCircle /> Egreso</button>{configured && <button className="ghost" onClick={() => supabase.auth.signOut()} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut /></button>}</div></header>
    <nav className="tabs">
      <button className={tab === 'analysis' ? 'active' : ''} onClick={() => setTab('analysis')}><CircleDollarSign /> ANÁLISIS DE FINANZAS</button>
      <button className={tab === 'big-expenses' ? 'active' : ''} onClick={() => setTab('big-expenses')}><ReceiptText /> GRANDES GASTOS</button>
      <button className={tab === 'savings' ? 'active' : ''} onClick={() => setTab('savings')}><PiggyBank /> AHORROS</button>
      <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}><LayoutDashboard /> Dashboard</button>
      <button className={tab === 'cargar' ? 'active' : ''} onClick={() => setTab('cargar')}><Plus /> Cargar</button>
      <button className={tab === 'income' ? 'active' : ''} onClick={() => setTab('income')}><TrendingUp /> Ingresos</button>
      <button className={tab === 'expense' ? 'active' : ''} onClick={() => setTab('expense')}><TrendingDown /> Egresos</button>
      <button className={tab === 'control' ? 'active' : ''} onClick={() => setTab('control')}><Settings2 /> Control</button>
    </nav>
    <main>
      {notice && <div className="notice" onClick={() => setNotice('')}>{notice}</div>}
      <div className="toolbar">
        {tab === 'analysis'
          ? <label>Período analizado <strong>{analysisMonths[0] || DATA_START} a {analysisMonths.at(-1) || DATA_START}</strong></label>
          : tab === 'big-expenses' || tab === 'savings' || tab === 'settings'
            ? <span></span>
            : <label>Período <input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>}
        {tab === 'dashboard' && <small className="period-note"><CalendarDays /> Todos los indicadores corresponden al mes seleccionado</small>}
        {tab === 'analysis' && <small className="period-note"><CalendarDays /> Análisis histórico de todos los movimientos disponibles</small>}
      </div>

      {tab === 'analysis' && <>
        <section className="kpis extended" style={{"--card-cursor":"help"}}>
          <article title="Suma de los promedios mensuales de las categorías de ingreso actualmente seleccionadas en la tabla. Cada categoría se promedia únicamente sobre sus meses activos."><span>Ingreso mensual promedio</span><strong className="positive">{money(selectedIncomeTotal)}</strong><TrendingUp /><small>{selectedIncomeAnalysis.length} categorías seleccionadas</small></article>
          <article title="Suma de los promedios mensuales de las categorías de egreso actualmente seleccionadas en la tabla. No incluye el margen adicional del 20% ni los aportes enviados a ahorros."><span>Egreso mensual promedio</span><strong className="negative">{money(selectedExpenseAverageTotal)}</strong><TrendingDown /><small>{selectedReserveExpenses.length} categorías seleccionadas · sin considerar ahorros</small></article>
          <article title="Capacidad mensual de ahorro calculada con las categorías seleccionadas. Se obtiene restando el egreso mensual promedio seleccionado al ingreso mensual promedio seleccionado."><span>Capacidad mensual de ahorro</span><strong className={selectedSavingsCapacity >= 0 ? 'positive' : 'negative'}>{money(selectedSavingsCapacity)}</strong><CircleDollarSign /><small>{selectedSavingsRate.toFixed(1)}% del ingreso seleccionado</small></article>
          <article title="Monto recomendado para cubrir tres meses de los egresos promedio seleccionados. Se calcula multiplicando el egreso mensual promedio seleccionado por 3."><span>Fondo de emergencia sugerido</span><strong>{money(selectedEmergencyFund)}</strong><WalletCards /><small>3 meses de egresos seleccionados</small></article>
          <article title="Suma del dinero sugerido para reservar únicamente en las categorías seleccionadas. Cada categoría usa su promedio mensual activo más un 20% de margen."><span>Presupuesto mensual seleccionado</span><strong>{money(selectedReserveTotal)}</strong><FolderCog /><small>{selectedReserveExpenses.length} categorías incluidas</small></article>
          <article title="Compara el promedio de egresos de los últimos tres meses con el promedio histórico. Un porcentaje positivo indica que los gastos recientes aumentaron."><span>Tendencia reciente de gastos</span><strong className={financeAnalysis.expenseTrend <= 0 ? 'positive' : 'negative'}>{financeAnalysis.expenseTrend >= 0 ? '+' : ''}{financeAnalysis.expenseTrend.toFixed(1)}%</strong><TrendingDown /><small>Últimos 3 meses contra promedio histórico</small></article>
        </section>

        <section className="charts dashboard-grid">
          <article className="panel span2"><div className="panel-title"><div><h3>Evolución histórica de ingresos y egresos</h3><span>Comparación mensual para detectar tendencias</span></div></div><div className="chart tall"><ResponsiveContainer><BarChart data={financeAnalysis.analysisMonthTotals}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis dataKey="month" stroke="#7890a8"/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)}/><Legend/><Bar dataKey="ingresos" name="Ingresos" fill="#4ade80" radius={[5,5,0,0]}/><Bar dataKey="egresos" name="Egresos sin ahorros" fill="#fb7185" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></article>

          <article className="panel span2"><div className="panel-title"><div><h3>Cuánto reservar por categoría</h3><span>{selectedReserveExpenses.length} categorías seleccionadas · Total {money(selectedReserveTotal)}</span></div></div><div className="chart tall"><ResponsiveContainer><BarChart data={selectedReserveExpenses.slice(0,12)} layout="vertical" margin={{left:20,right:20}}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><YAxis type="category" dataKey="name" width={115} stroke="#7890a8" tick={{fontSize:10}}/><Tooltip formatter={(v,name)=>[money(v),name]}/><Legend/><Bar dataKey="averageMonthly" name="Promedio mensual" fill="#38bdf8" radius={[0,5,5,0]}/><Bar dataKey="suggestedReserve" name="Reserva sugerida" fill="#f59e0b" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div></article>
        </section>

        <section className="panel table-panel">
          <div className="panel-title table-heading">
            <div>
              <h3>Plan mensual de reservas por categoría</h3>
              <span>Seleccione qué categorías deben incluirse en el presupuesto y en el gráfico</span>
              <small className="reserve-table-note">
                Las categorías desmarcadas siguen disponibles en el historial, pero no participan del total recomendado.
              </small>
            </div>
            <div className="row-actions">
              <button className="secondary" type="button" onClick={selectAllReserveCategories}>Seleccionar todas</button>
              <button className="ghost" type="button" onClick={clearReserveCategories}>Quitar todas</button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Incluir</th>
                  <th>Categoría</th>
                  <th className="right">Meses activos</th>
                  <th className="right">Promedio mensual</th>
                  <th className="right">Máximo mensual</th>
                  <th className="right">Promedio por gasto</th>
                  <th className="right">Margen 20%</th>
                  <th className="right">% seleccionado</th>
                  <th>Prioridad</th>
                  <th className="right">Reservar por mes</th>
                </tr>
              </thead>

              <tbody>
                {financeAnalysis.expenses.map(x => {
                  const selected = selectedReserveExpenses.some(item => item.name === x.name)
                  const margin = x.suggestedReserve - x.averageMonthly
                  const budgetShare = selected && selectedReserveTotal > 0
                    ? (x.suggestedReserve / selectedReserveTotal) * 100
                    : 0

                  const priority =
                    budgetShare >= 20 ? { label: 'Muy alta', icon: '🔴' } :
                    budgetShare >= 12 ? { label: 'Alta', icon: '🟠' } :
                    budgetShare >= 6 ? { label: 'Media', icon: '🟡' } :
                    { label: 'Baja', icon: '🟢' }

                  return <tr key={`reserve-${x.name}`} style={{ opacity: selected ? 1 : 0.48 }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleReserveCategory(x.name)}
                        aria-label={`Incluir ${x.name} en el presupuesto`}
                        title={selected ? 'Incluida en el total y el gráfico' : 'Excluida del total y el gráfico'}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </td>
                    <td><span className="type-pill expense">{x.name}</span></td>
                    <td className="right">{x.activeMonths}/{analysisMonths.length}</td>
                    <td className="right"><b>{money(x.averageMonthly)}</b></td>
                    <td className="right negative">{money(x.maxMonthly)}</td>
                    <td className="right">{money(x.averageMovement)}</td>
                    <td className="right reserve-margin">{money(margin)}</td>
                    <td className="right">{selected ? `${budgetShare.toFixed(1)}%` : '—'}</td>
                    <td>
                      {selected
                        ? <span title="Prioridad calculada según el peso dentro de las categorías seleccionadas">{priority.icon} {priority.label}</span>
                        : <span>Excluida</span>}
                    </td>
                    <td className="right reserve-amount">{selected ? money(x.suggestedReserve) : '—'}</td>
                  </tr>
                })}

                {!financeAnalysis.expenses.length &&
                  <tr><td colSpan="10" className="empty">No existen egresos para calcular reservas.</td></tr>}
              </tbody>

              <tfoot>
                <tr>
                  <td></td>
                  <td><b>Total seleccionado por mes</b></td>
                  <td className="right">{selectedReserveExpenses.length} categorías</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td className="right"><b>{selectedReserveTotal > 0 ? '100%' : '0%'}</b></td>
                  <td></td>
                  <td className="right reserve-amount">{money(selectedReserveTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="panel table-panel">
          <div className="panel-title table-heading">
            <div>
              <h3>Análisis de ingresos por categoría</h3>
              <span>Seleccione qué fuentes de ingreso deben incluirse en el total mensual analizado</span>
              <small className="reserve-table-note">
                Las categorías desmarcadas siguen visibles, pero no participan del porcentaje ni del total seleccionado.
              </small>
            </div>
            <div className="row-actions">
              <button className="secondary" type="button" onClick={selectAllIncomeCategories}>Seleccionar todas</button>
              <button className="ghost" type="button" onClick={clearIncomeCategories}>Quitar todas</button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Incluir</th>
                  <th>Categoría</th>
                  <th className="right">Meses activos</th>
                  <th className="right">Promedio mensual</th>
                  <th className="right">Máximo mensual</th>
                  <th className="right">Promedio por ingreso</th>
                  <th className="right">% seleccionado</th>
                  <th>Prioridad</th>
                </tr>
              </thead>

              <tbody>
                {financeAnalysis.incomes.map(x => {
                  const selected = selectedIncomeAnalysis.some(item => item.name === x.name)
                  const selectedShare = selected && selectedIncomeTotal > 0
                    ? (x.averageMonthly / selectedIncomeTotal) * 100
                    : 0

                  const priority =
                    selectedShare >= 30 ? { label: 'Muy alta', icon: '🔴' } :
                    selectedShare >= 18 ? { label: 'Alta', icon: '🟠' } :
                    selectedShare >= 8 ? { label: 'Media', icon: '🟡' } :
                    { label: 'Baja', icon: '🟢' }

                  return <tr key={`analysis-inc-${x.name}`} style={{ opacity: selected ? 1 : 0.48 }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleIncomeCategory(x.name)}
                        aria-label={`Incluir ${x.name} en el total de ingresos`}
                        title={selected ? 'Incluida en el total seleccionado' : 'Excluida del total seleccionado'}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </td>
                    <td><span className="type-pill income">{x.name}</span></td>
                    <td className="right">{x.activeMonths}/{analysisMonths.length}</td>
                    <td className="right positive"><b>{money(x.averageMonthly)}</b></td>
                    <td className="right">{money(x.maxMonthly)}</td>
                    <td className="right">{money(x.averageMovement)}</td>
                    <td className="right">{selected ? `${selectedShare.toFixed(1)}%` : '—'}</td>
                    <td>
                      {selected
                        ? <span title="Prioridad calculada según el peso de esta fuente dentro de los ingresos seleccionados">{priority.icon} {priority.label}</span>
                        : <span>Excluida</span>}
                    </td>
                  </tr>
                })}

                {!financeAnalysis.incomes.length &&
                  <tr><td colSpan="8" className="empty">No existen ingresos para analizar.</td></tr>}
              </tbody>

              <tfoot>
                <tr>
                  <td></td>
                  <td><b>Total seleccionado por mes</b></td>
                  <td className="right">{selectedIncomeAnalysis.length} categorías</td>
                  <td className="right positive"><b>{money(selectedIncomeTotal)}</b></td>
                  <td></td>
                  <td></td>
                  <td className="right"><b>{selectedIncomeTotal > 0 ? '100%' : '0%'}</b></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </>}

      {tab === 'big-expenses' && <>
        <section className="kpis compact-kpis category-kpis">
          <article title="Suma de todos los egresos individuales, excluyendo movimientos de ahorro."><span>Total histórico de gastos</span><strong className="negative">{money(bigExpenses.reduce((s, x) => s + Number(x.amount), 0))}</strong><TrendingDown /><small>{bigExpenses.length} movimientos visibles</small></article>
          <article title="Gasto individual de mayor importe registrado."><span>Mayor gasto registrado</span><strong className="negative">{money(bigExpenses[0]?.amount || 0)}</strong><ReceiptText /><small>{bigExpenses[0]?.description || 'Sin datos'}</small></article>
          <article title="Promedio de los gastos individuales actualmente visibles."><span>Promedio por gasto</span><strong>{money(bigExpenses.length ? bigExpenses.reduce((s, x) => s + Number(x.amount), 0) / bigExpenses.length : 0)}</strong><CircleDollarSign /><small>Según filtros aplicados</small></article>
        </section>

        <section className="panel table-panel">
          <div className="panel-title table-heading">
            <div><h3>Grandes gastos</h3><span>Ordenados automáticamente desde el mayor hasta el menor</span></div>
            <div className="row-actions" style={{ flexWrap: 'wrap' }}>
              <label className="search compact"><Search /><input value={bigExpenseSearch} onChange={e => setBigExpenseSearch(e.target.value)} placeholder="Buscar concepto o categoría..." /></label>
              <select value={bigExpenseCategory} onChange={e => setBigExpenseCategory(e.target.value)}>
                <option value="all">Todas las categorías</option>
                {bigExpenseCategories.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Observaciones</th><th className="right">Monto</th><th></th></tr></thead>
              <tbody>
                {bigExpenses.map((m, index) => <tr key={m.id}>
                  <td>{index + 1}</td>
                  <td>{m.date?.split('-').reverse().join('/')}</td>
                  <td><span className="type-pill expense">{m.categories?.name || (savingsKind(m) ? 'Ahorros' : 'Sin categoría')}</span></td>
                  <td><b>{m.description}</b></td>
                  <td>{m.notes && !String(m.notes).includes('Dato histórico inicial') ? m.notes : '—'}</td>
                  <td className="right negative"><b>{money(m.amount)}</b></td>
                  <td><div className="row-actions"><button className="ghost" onClick={() => { setEditing(m); setNewType('expense'); setModal(true) }}><Pencil /></button><button className="ghost danger" onClick={() => remove(m.id)}><Trash2 /></button></div></td>
                </tr>)}
                {!bigExpenses.length && <tr><td colSpan="7" className="empty">No existen gastos para mostrar.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>}

      {tab === 'savings' && <>
        <section className="kpis extended compact-kpis">
          <article title="Dinero actualmente acumulado en ahorros. Se calcula sumando todos los aportes y restando todos los retiros."><span>Saldo en ahorros</span><strong className="positive">{money(savingsBalance)}</strong><PiggyBank /><small>Disponible en el fondo</small></article>
          <article title="Suma histórica de todos los aportes realizados al fondo de ahorro."><span>Total guardado</span><strong>{money(savingsDeposits)}</strong><Download /><small>{savingsMovements.filter(x => savingsKind(x) === 'deposit').length} aportes</small></article>
          <article title="Suma histórica de todos los retiros realizados desde el fondo de ahorro."><span>Total retirado</span><strong className="negative">{money(savingsWithdrawals)}</strong><Upload /><small>{savingsMovements.filter(x => savingsKind(x) === 'withdrawal').length} retiros</small></article>
        </section>

        <section className="entry-grid">
          <article className="panel entry-card">
            <div className="entry-icon"><PiggyBank /></div>
            <h2>Movimiento de ahorros</h2>
            <p>Guardar dinero reduce el saldo disponible. Retirarlo devuelve el dinero al saldo general.</p>
            <form className="category-form" onSubmit={saveSavingsMovement} style={{ alignItems: 'end' }}>
              <label>Operación
                <select value={savingsForm.kind} onChange={e => setSavingsForm({ ...savingsForm, kind: e.target.value })}>
                  <option value="deposit">Guardar en ahorros</option>
                  <option value="withdrawal">Retirar de ahorros</option>
                </select>
              </label>
              <label>Fecha
                <input type="date" value={savingsForm.date} onChange={e => setSavingsForm({ ...savingsForm, date: e.target.value })} required />
              </label>
              <label>Monto
                <input type="number" min="0" step="0.01" value={savingsForm.amount} onChange={e => setSavingsForm({ ...savingsForm, amount: e.target.value })} placeholder="0,00" required />
              </label>
              <label className="grow">Descripción
                <input value={savingsForm.description} onChange={e => setSavingsForm({ ...savingsForm, description: e.target.value })} placeholder="Ej. Fondo de emergencia" />
              </label>
              <button type="submit">{savingsForm.kind === 'deposit' ? <><Download /> Guardar dinero</> : <><Upload /> Retirar dinero</>}</button>
            </form>
          </article>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>Metas de ahorro</h3>
              <span>El saldo disponible se asigna automáticamente según el orden de prioridad</span>
            </div>
          </div>

          <form className="category-form" onSubmit={saveSavingsGoal} style={{ alignItems: 'end' }}>
            <label className="grow">Nombre de la meta
              <input
                value={goalForm.name}
                onChange={e => setGoalForm({ ...goalForm, name: e.target.value })}
                placeholder="Ej. Fondo de emergencia"
                required
              />
            </label>
            <label>Monto objetivo
              <input
                type="number"
                min="0"
                step="0.01"
                value={goalForm.target}
                onChange={e => setGoalForm({ ...goalForm, target: e.target.value })}
                placeholder="0,00"
                required
              />
            </label>
            <label>Prioridad
              <input
                type="number"
                min="1"
                step="1"
                value={goalForm.priority}
                onChange={e => setGoalForm({ ...goalForm, priority: e.target.value })}
              />
            </label>
            <button type="submit"><Plus /> Agregar meta</button>
          </form>

          <div className="goal-grid">
            {allocatedSavingsGoals.map(goal => <article className="goal-card" key={goal.id}>
              <header>
                <div>
                  <h3>{goal.completed ? '✅ ' : ''}{goal.name}</h3>
                  <small>Prioridad {goal.priority} · Objetivo {money(goal.target)}</small>
                </div>
                <div className="goal-actions">
                  <button className="ghost" type="button" onClick={() => moveSavingsGoal(goal.id, -1)} title="Subir prioridad">↑</button>
                  <button className="ghost" type="button" onClick={() => moveSavingsGoal(goal.id, 1)} title="Bajar prioridad">↓</button>
                  <button className="ghost danger" type="button" onClick={() => removeSavingsGoal(goal.id)} title="Eliminar meta"><Trash2 /></button>
                </div>
              </header>

              <div className="goal-progress" title={`${goal.progress.toFixed(1)}% completado`}>
                <div style={{ width: `${goal.progress}%` }}></div>
              </div>

              <div className="goal-values">
                <span>Asignado <b>{money(goal.allocated)}</b></span>
                <span>{goal.progress.toFixed(1)}%</span>
                <span>Falta <b>{money(goal.remaining)}</b></span>
              </div>
            </article>)}

            {!allocatedSavingsGoals.length &&
              <div className="empty-card">Todavía no existen metas de ahorro.</div>}
          </div>
        </section>

        <section className="panel table-panel">
          <div className="panel-title"><div><h3>Historial de ahorros</h3><span>Aportes y retiros ordenados por fecha</span></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Operación</th><th>Descripción</th><th className="right">Monto</th><th className="right">Impacto en ahorros</th><th></th></tr></thead>
              <tbody>
                {savingsMovements.map(m => {
                  const kind = savingsKind(m)
                  return <tr key={m.id}>
                    <td>{m.date?.split('-').reverse().join('/')}</td>
                    <td><span className={`type-pill ${kind === 'deposit' ? 'income' : 'expense'}`}>{kind === 'deposit' ? 'Guardado' : 'Retirado'}</span></td>
                    <td>{m.description}</td>
                    <td className="right">{money(m.amount)}</td>
                    <td className={`right ${kind === 'deposit' ? 'positive' : 'negative'}`}><b>{kind === 'deposit' ? '+' : '-'}{money(m.amount)}</b></td>
                    <td><button className="ghost danger" onClick={() => remove(m.id)}><Trash2 /></button></td>
                  </tr>
                })}
                {!savingsMovements.length && <tr><td colSpan="6" className="empty">Todavía no existen movimientos de ahorro.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>}

      {tab === 'dashboard' && <>
        <div className="dashboard-subtabs">
          <button className={dashboardView === 'overview' ? 'active' : ''} onClick={() => setDashboardView('overview')}><LayoutDashboard /> Dashboard</button>
          <button className={dashboardView === 'expenses' ? 'active' : ''} onClick={() => setDashboardView('expenses')}><TrendingDown /> Egresos por categoría</button>
          <button className={dashboardView === 'incomes' ? 'active' : ''} onClick={() => setDashboardView('incomes')}><TrendingUp /> Ingresos por categoría</button>
        </div>

        {dashboardView === 'overview' && <>
          <section className="kpis extended compact-kpis">
            <article title="Dinero disponible que se arrastra desde el cierre del mes anterior. Desde mayo parte del saldo final real de abril y continúa acumulándose mes a mes."><span>Saldo mes anterior</span><strong>{money(openingBalance)}</strong><WalletCards /><small>{month === DATA_START ? 'Mes inicial' : 'Arrastre automático'}</small></article>
            <article title="Suma de todos los movimientos de tipo ingreso registrados en el mes seleccionado."><span>Ingresos del mes</span><strong className="positive">{money(income)}</strong><ArrowUpCircle /><small>{incomeRows.length} registros</small></article>
            <article title="Suma de los egresos reales del mes, excluyendo el dinero enviado a ahorros."><span>Egresos del mes</span><strong className="negative">{money(expenseWithoutSavings)}</strong><ArrowDownCircle /><small>{expenseRowsWithoutSavings.length} registros · sin considerar ahorros</small></article>
            <article title="Dinero enviado al fondo de ahorros durante el mes seleccionado. Se calcula sumando únicamente los movimientos de tipo Guardar en ahorros del período."><span>Dinero enviado a los ahorros</span><strong className="positive">{money(monthlySavingsDeposits)}</strong><PiggyBank /><small>Aportes realizados en {month}</small></article>
            <article title="Saldo final del mes. Se calcula como saldo anterior + ingresos del mes - egresos del mes - dinero enviado a ahorros + retiros de ahorros."><span>Saldo final disponible</span><strong className={closingBalance >= 0 ? 'positive' : 'negative'}>{money(closingBalance)}</strong><CircleDollarSign /><small>Saldo anterior + ingresos - egresos</small></article>
            <article title="Resultado del mes sin considerar el saldo anterior. Se calcula como ingresos del mes menos egresos del mes."><span>Resultado propio del mes</span><strong className={monthlyNet >= 0 ? 'positive' : 'negative'}>{money(monthlyNet)}</strong><TrendingUp /><small>Sin contar saldo anterior</small></article>
            <article title="Porcentaje de los fondos disponibles que quedó sin gastar. Se calcula como saldo final dividido por saldo anterior más ingresos del mes."><span>Porcentaje disponible</span><strong className={savingRate >= 0 ? 'positive' : 'negative'}>{savingRate.toFixed(1)}%</strong><TrendingUp /><small>Sobre fondos disponibles</small></article>
            <article title="Promedio gastado por cada día con egresos, excluyendo los aportes enviados a ahorros."><span>Promedio diario de egresos</span><strong>{money(avgDailyExpense)}</strong><CalendarDays /><small>{daysWithExpense} días con gastos · sin considerar ahorros</small></article>
            <article title="Movimiento individual de egreso más alto del mes, excluyendo los aportes enviados a ahorros."><span>Mayor gasto</span><strong className="negative">{money(biggestExpense?.amount || 0)}</strong><TrendingDown /><small>{biggestExpense?.description || 'Sin gastos'} · sin considerar ahorros</small></article>
            <article title="Categoría con mayor gasto del mes, excluyendo los aportes enviados a ahorros."><span>Categoría con mayor gasto</span><strong className="negative">{money(topExpenseCategory?.value || 0)}</strong><FolderCog /><small>{topExpenseCategory?.name || 'Sin datos'} · {expenseConcentration.toFixed(1)}% del total · sin considerar ahorros</small></article>
          </section>

          <section className="charts dashboard-grid dashboard-wide-grid">
            <article className="panel full-width-chart"><div className="panel-title"><div><h3>Balance diario del mes</h3><span>Días 1 al último día del período seleccionado</span></div></div><div className="chart tall"><ResponsiveContainer><AreaChart data={daily} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" dataKey="day" domain={[1, daysInSelectedMonth]} ticks={dayTicks} interval={0} allowDecimals={false} stroke="#7890a8" tick={{ fontSize: 10 }}/><YAxis stroke="#7890a8" width={72} tickFormatter={v => `$${Math.round(v/1000)}k`}/><Tooltip formatter={v => money(v)} labelFormatter={d => `Día ${Number(d)}`}/><Area type="monotone" dataKey="acumulado" name="Saldo disponible" stroke="#4ade80" fill="#4ade8033" strokeWidth={3}/></AreaChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><h3>Gastos por categoría</h3><span>Participación sobre el total mensual</span></div></div><div className="chart"><ResponsiveContainer><PieChart><Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={46} outerRadius={88}>{byCategory.map((_,i)=><Cell key={i} fill={palette[i%palette.length]}/>)}</Pie><Tooltip formatter={v=>money(v)}/></PieChart></ResponsiveContainer></div><div className="legend compact-legend">{byCategory.slice(0,8).map((x,i)=><span key={x.name}><i style={{background:palette[i%palette.length]}}></i>{x.name}<b>{money(x.value)}</b></span>)}</div></article>

            <article className="panel"><div className="panel-title"><div><h3>Ingresos por categoría</h3><span>Participación sobre el total mensual</span></div></div><div className="chart"><ResponsiveContainer><PieChart><Pie data={incomeByCategory} dataKey="value" nameKey="name" innerRadius={46} outerRadius={88}>{incomeByCategory.map((_,i)=><Cell key={i} fill={palette[(i+2)%palette.length]}/>)}</Pie><Tooltip formatter={v=>money(v)}/></PieChart></ResponsiveContainer></div><div className="legend compact-legend">{incomeByCategory.slice(0,8).map((x,i)=><span key={x.name}><i style={{background:palette[(i+2)%palette.length]}}></i>{x.name}<b>{money(x.value)}</b></span>)}</div></article>

            <article className="panel"><div className="panel-title"><div><h3>Mayores gastos individuales</h3><span>Los 10 movimientos de mayor importe · sin considerar ahorros</span></div></div><div className="chart"><ResponsiveContainer><BarChart data={topExpenseItems} layout="vertical" margin={{ left: 18, right: 16 }}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><YAxis type="category" dataKey="name" width={105} stroke="#7890a8" tick={{fontSize:10}}/><Tooltip formatter={(v, _name, item)=>[money(v), item?.payload?.category || 'Egreso']}/><Bar dataKey="value" name="Monto" fill="#fb7185" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><h3>Ingresos por categoría</h3><span>Origen de los fondos del mes</span></div></div><div className="chart"><ResponsiveContainer><BarChart data={incomeByCategory.slice(0,10)} layout="vertical" margin={{ left: 20, right: 16 }}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><YAxis type="category" dataKey="name" width={115} stroke="#7890a8" tick={{fontSize:10}}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="value" name="Ingresos" fill="#4ade80" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><h3>Ingresos y egresos diarios</h3><span>Comparación por día</span></div></div><div className="chart"><ResponsiveContainer><BarChart data={daily} margin={{ right: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" dataKey="day" domain={[1, daysInSelectedMonth]} ticks={dayTicks} interval={0} allowDecimals={false} stroke="#7890a8" tick={{fontSize:9}}/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)}/><Legend/><Bar dataKey="ingresos" fill="#4ade80"/><Bar dataKey="egresos" fill="#fb7185"/></BarChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><h3>Ingresos vs. egresos acumulados</h3><span>Evolución dentro del mes</span></div></div><div className="chart"><ResponsiveContainer><LineChart data={daily}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" dataKey="day" domain={[1, daysInSelectedMonth]} ticks={dayTicks} interval={0} allowDecimals={false} stroke="#7890a8" tick={{fontSize:9}}/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)}/><Legend/><Line type="monotone" dataKey="ingresosAc" name="Ingresos acumulados" stroke="#4ade80" strokeWidth={3} dot={false}/><Line type="monotone" dataKey="egresosAc" name="Egresos acumulados" stroke="#fb7185" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><h3>Saldo acumulado por mes</h3><span>Desde abril de 2026</span></div></div><div className="chart"><ResponsiveContainer><BarChart data={monthTotals}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis dataKey="month" stroke="#7890a8"/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="saldoFinal" name="Saldo final" fill="#22c55e" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><h3>Evolución mensual completa</h3><span>Ingresos, egresos, resultado y saldo</span></div></div><div className="chart"><ResponsiveContainer><LineChart data={monthTotals}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis dataKey="month" stroke="#7890a8"/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)}/><Legend/><Line type="monotone" dataKey="ingresos" stroke="#4ade80" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="egresos" stroke="#fb7185" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="neto" name="Resultado mensual" stroke="#38bdf8" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="saldoFinal" name="Saldo acumulado" stroke="#f59e0b" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div></article>
          </section>
          <GeneralBalanceTable openingBalance={openingBalance} incomeByCategory={incomeByCategory} expenseByCategory={byCategory} closingBalance={closingBalance} monthlySavingsDeposits={monthlySavingsDeposits}/>
        </>}

        {dashboardView === 'expenses' && <>
          <section className="kpis compact-kpis category-kpis">
            <article title="Suma de todos los egresos reales del mes seleccionado, excluyendo aportes a ahorros."><span>Total de egresos</span><strong className="negative">{money(expenseWithoutSavings)}</strong><TrendingDown /><small>{expenseRowsWithoutSavings.length} movimientos · sin considerar ahorros</small></article>
            <article title="Monto promedio de cada egreso real del mes, excluyendo aportes a ahorros."><span>Promedio por movimiento</span><strong>{money(expenseRowsWithoutSavings.length ? expenseWithoutSavings / expenseRowsWithoutSavings.length : 0)}</strong><CircleDollarSign /><small>Ticket promedio · sin considerar ahorros</small></article>
            <article title="Categoría que acumuló el mayor monto de egresos durante el mes seleccionado."><span>Mayor categoría</span><strong className="negative">{money(topExpenseCategory?.value || 0)}</strong><TrendingDown /><small>{topExpenseCategory?.name || 'Sin datos'}</small></article>
          </section>
          <CategoryBreakdown title="Egresos desglosados por categoría" rows={expenseRows} type="expense" />
        </>}

        {dashboardView === 'incomes' && <>
          <section className="kpis compact-kpis category-kpis">
            <article title="Suma de todos los ingresos del mes seleccionado, sin incluir retiros desde ahorros."><span>Total de ingresos</span><strong className="positive">{money(income)}</strong><TrendingUp /><small>{incomeRows.length} movimientos</small></article>
            <article title="Monto promedio de cada ingreso del mes. Se calcula dividiendo el total de ingresos por la cantidad de movimientos."><span>Promedio por movimiento</span><strong>{money(incomeRows.length ? income / incomeRows.length : 0)}</strong><CircleDollarSign /><small>Ingreso promedio</small></article>
            <article title="Categoría que acumuló el mayor monto de ingresos durante el mes seleccionado."><span>Mayor categoría</span><strong className="positive">{money(topIncomeCategory?.value || 0)}</strong><TrendingUp /><small>{topIncomeCategory?.name || 'Sin datos'}</small></article>
          </section>
          <CategoryBreakdown title="Ingresos desglosados por categoría" rows={incomeRows} type="income" />
        </>}
      </>}

      {tab === 'cargar' && <section className="entry-grid">
        <article className="panel entry-card income-card"><div className="entry-icon"><ArrowUpCircle /></div><h2>Cargar ingreso</h2><p>Registrar sueldos, rendimientos, préstamos devueltos u otros ingresos.</p><div className="category-preview">{categories.filter(c => c.type === 'income').slice(0, 8).map(c => <span key={c.id}>{c.name}</span>)}</div><button onClick={() => openNew('income')}><Plus /> Nuevo ingreso</button></article>
        <article className="panel entry-card expense-card"><div className="entry-icon"><ArrowDownCircle /></div><h2>Cargar egreso</h2><p>Registrar compras, servicios, viajes, cuotas y cualquier otro gasto.</p><div className="category-preview">{categories.filter(c => c.type === 'expense').slice(0, 8).map(c => <span key={c.id}>{c.name}</span>)}</div><button onClick={() => openNew('expense')}><Plus /> Nuevo egreso</button></article>
        <article className="panel recent-card"><div className="panel-title"><h3>Últimos movimientos</h3><span>Actividad reciente</span></div>{movements.slice(0, 8).map(m => <div className="recent-row" key={m.id}><div><b>{m.description}</b><small>{m.categories?.name} · {m.date?.split('-').reverse().join('/')}</small></div><strong className={m.type === 'income' ? 'positive' : 'negative'}>{m.type === 'income' ? '+' : '-'}{money(m.amount)}</strong></div>)}</article>
      </section>}

      {tab === 'income' && <TransactionsTable rows={incomeRows} title="Ingresos" type="income" search={search} setSearch={setSearch} onEdit={m => { setEditing(m); setNewType('income'); setModal(true) }} onDelete={remove} />}
      {tab === 'expense' && <TransactionsTable rows={expenseRows} title="Egresos" type="expense" search={search} setSearch={setSearch} onEdit={m => { setEditing(m); setNewType('expense'); setModal(true) }} onDelete={remove} />}

      {tab === 'settings' && <section className="panel account-settings">
        <div className="panel-title">
          <div><h3>Configuración de cuenta</h3><span>Administrar los datos de acceso y la sesión actual</span></div>
        </div>
        <div className="account-summary">
          <UserRound />
          <div><b>{profileName || 'Usuario'}</b><small>{session?.user?.email || 'Sin correo disponible'}</small></div>
        </div>
        <form onSubmit={saveAccountSettings}>
          <div className="account-settings-grid">
            <label className="full-row">Nombre
              <input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Nombre del usuario" autoComplete="name" />
            </label>
            <label>Nueva contraseña
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} autoComplete="new-password" />
                <button className="ghost password-toggle" type="button" onClick={() => setShowPassword(v => !v)} title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff /> : <Eye />}</button>
              </div>
            </label>
            <label>Repetir nueva contraseña
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={repeatPassword} onChange={e => setRepeatPassword(e.target.value)} placeholder="Repetir contraseña" minLength={6} autoComplete="new-password" />
                <button className="ghost password-toggle" type="button" onClick={() => setShowPassword(v => !v)} title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff /> : <Eye />}</button>
              </div>
            </label>
          </div>
          <div className="settings-actions">
            <button className="ghost danger" type="button" onClick={() => supabase.auth.signOut()}><LogOut /> Cerrar sesión</button>
            <button type="submit" disabled={savingAccount}>{savingAccount ? <><RefreshCw className="spin" /> Guardando…</> : <><Settings2 /> Guardar cambios</>}</button>
          </div>
        </form>
      </section>}

      {tab === 'control' && <section className="panel control-card"><div className="section-icon"><FolderCog /></div><h2>Control de categorías</h2><p>Las categorías de ingresos y egresos se administran por separado y aparecen automáticamente en los formularios de carga.</p><CategoryForm onAdd={addCategory} /><div className="category-columns"><div><h3>Ingresos ({categories.filter(c => c.type === 'income').length})</h3>{categories.filter(c => c.type === 'income').map(c => <div className="category-row" key={c.id}><span>{c.name}</span><button className="ghost danger" onClick={() => removeCategory(c)}><Trash2 /></button></div>)}</div><div><h3>Egresos ({categories.filter(c => c.type === 'expense').length})</h3>{categories.filter(c => c.type === 'expense').map(c => <div className="category-row" key={c.id}><span>{c.name}</span><button className="ghost danger" onClick={() => removeCategory(c)}><Trash2 /></button></div>)}</div></div></section>}
    </main>
    <MovementModal open={modal} onClose={() => { setModal(false); setEditing(null) }} onSave={save} accounts={accounts} categories={categories} editing={editing} defaultType={newType} />
  </div>
}
