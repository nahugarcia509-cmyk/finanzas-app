import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, CalendarDays, CircleDollarSign, FolderCog,
  LayoutDashboard, LogOut, Pencil, Plus, RefreshCw, Search, Settings, Settings2, Trash2,
  TrendingDown, TrendingUp, WalletCards, PiggyBank, ReceiptText, Download, Upload,
  Eye, EyeOff, UserRound, Menu, ChevronDown, HelpCircle, Bell, Home, SlidersHorizontal, Keyboard, Palette, Target, CalendarRange, X, CreditCard, Repeat2, Undo2, AlertTriangle, CheckCircle2
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
  { id: 'a1', name: 'Billetera', initial_balance: 0 },
  { id: 'a2', name: 'Banco', initial_balance: 0 }
]
const initialDemoCategories = seedCategories.map((c, i) => ({ ...c, id: `seed-cat-${i}` }))
const palette = ['#38bdf8', '#4ade80', '#f59e0b', '#fb7185', '#a78bfa', '#22d3ee', '#f97316', '#e879f9', '#84cc16', '#facc15']

const SAVINGS_DEPOSIT = '[SAVINGS_DEPOSIT]'
const SAVINGS_WITHDRAWAL = '[SAVINGS_WITHDRAWAL]'
const TRANSFER_OUT = '[TRANSFER_OUT]'
const TRANSFER_IN = '[TRANSFER_IN]'

const isSavingsMovement = (movement) =>
  String(movement?.notes || '').includes(SAVINGS_DEPOSIT) ||
  String(movement?.notes || '').includes(SAVINGS_WITHDRAWAL)

const savingsKind = (movement) =>
  String(movement?.notes || '').includes(SAVINGS_DEPOSIT) ? 'deposit' :
  String(movement?.notes || '').includes(SAVINGS_WITHDRAWAL) ? 'withdrawal' :
  null

const isTransferMovement = (movement) =>
  String(movement?.notes || '').includes(TRANSFER_OUT) ||
  String(movement?.notes || '').includes(TRANSFER_IN)

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

function TransactionsTable({ rows, title, type, search, setSearch, onEdit, onDelete, onQuickSave, categories }) {
  const [quickId, setQuickId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const allowed = categories.filter(c => c.type === type)
  const begin = m => { setQuickId(m.id); setDraft({ date:m.date || '', description:m.description || '', amount:m.amount ?? '', category_id:m.category_id || '' }) }
  const commit = async m => {
    if (!draft?.date || !draft?.description?.trim() || Number(draft?.amount) <= 0) return
    setSaving(true)
    try {
      await onQuickSave(m, { ...draft, description:draft.description.trim(), amount:Number(draft.amount), category_id:draft.category_id || null })
      setQuickId(null); setDraft(null)
    } catch {} finally { setSaving(false) }
  }
  return <section className="panel table-panel">
    <div className="panel-title table-heading"><div><h3>{title}</h3><span>{rows.length} movimientos</span></div><label className="search compact"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Buscar ${type === 'income' ? 'ingresos' : 'egresos'}...`} /></label></div>
    <div className="table-wrap responsive-movements-table"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th className="right">Monto</th><th></th></tr></thead><tbody>
      {rows.map(m => quickId === m.id ? <tr key={m.id} className="quick-edit-row">
        <td data-label="Fecha"><input type="date" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))}/></td>
        <td data-label="Categoría"><select value={draft.category_id} onChange={e=>setDraft(d=>({...d,category_id:e.target.value}))}><option value="">Sin categoría</option>{allowed.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
        <td data-label="Concepto"><input value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/></td>
        <td data-label="Monto"><input className="quick-amount" type="number" min="0" step="0.01" value={draft.amount} onChange={e=>setDraft(d=>({...d,amount:e.target.value}))}/></td>
        <td data-label="Acciones"><div className="row-actions"><button className="ghost positive" disabled={saving} onClick={()=>commit(m)} title="Guardar"><CheckCircle2/></button><button className="ghost" disabled={saving} onClick={()=>{setQuickId(null);setDraft(null)}} title="Cancelar"><X/></button></div></td>
      </tr> : <tr key={m.id}><td data-label="Fecha">{m.date?.split('-').reverse().join('/')}</td><td data-label="Categoría"><span className={`type-pill ${type}`}>{m.categories?.name || (savingsKind(m) ? 'Ahorros' : 'Sin categoría')}</span></td><td data-label="Concepto">{m.description}{m.notes && !String(m.notes).includes('Dato histórico inicial') && !isSavingsMovement(m) ? <small>{m.notes}</small> : null}</td><td data-label="Monto" className={`right ${type === 'income' ? 'positive' : 'negative'}`}><b>{type === 'income' ? '+' : '-'}{money(m.amount)}</b></td><td data-label="Acciones"><div className="row-actions"><button className="ghost" onClick={()=>begin(m)} title="Edición rápida"><Pencil/></button><button className="ghost" onClick={()=>onEdit(m)} title="Edición completa"><Settings2/></button><button className="ghost danger" onClick={()=>onDelete(m.id)} title="Eliminar"><Trash2/></button></div></td></tr>)}
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
    <style>{`
      /* Formato único para todas las cards KPI */
      .kpi-info-card,
      .kpis article,
      .top-insight-card {
        position: relative !important;
        min-height: 118px !important;
        padding: 18px 56px 18px 18px !important;
        overflow: visible !important;
      }
      .kpi-info-head { display:block !important; padding-right:0 !important; }
      .kpi-info-card .kpi-help,
      .kpis article .card-help,
      .kpis article .kpi-help,
      .top-insight-card .kpi-help {
        position:absolute !important;
        top:14px !important;
        right:14px !important;
        bottom:auto !important;
        left:auto !important;
        margin:0 !important;
        transform:none !important;
      }
      .kpi-info-card .kpi-card-icon,
      .kpis article > svg,
      .top-insight-card > svg,
      .top-insight-card .kpi-card-icon {
        position:absolute !important;
        right:18px !important;
        bottom:16px !important;
        top:auto !important;
        left:auto !important;
        width:28px !important;
        height:28px !important;
        display:flex !important;
        align-items:center !important;
        justify-content:center !important;
        margin:0 !important;
        padding:0 !important;
        color:#7394b8 !important;
        opacity:.95 !important;
        pointer-events:none !important;
        transform:none !important;
      }
      .kpi-info-card .kpi-card-icon > svg,
      .top-insight-card .kpi-card-icon > svg {
        width:28px !important;
        height:28px !important;
        position:static !important;
        margin:0 !important;
        transform:none !important;
      }
      .kpi-info-card > small,
      .kpis article > small,
      .top-insight-card > small { padding-right:34px !important; }
      .kpi-info-card > strong,
      .kpis article > strong,
      .top-insight-card > strong { display:block; padding-right:8px; }
      /* Evita signos de ayuda duplicados creados por reglas antiguas */
      article[data-help]::before,
      article[data-help]::after { display:none !important; content:none !important; }
    `}</style>
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

function ChartInfoTitle({ title, text }) {
  return <div className="chart-title-row">
    <h3>{title}</h3>
    <button type="button" className="chart-help" aria-label={`Explicación de ${title}`}>
      <HelpCircle />
      <span className="chart-help-tooltip">{text}</span>
    </button>
  </div>
}

function CardHelp({ text, label = 'Ver explicación' }) {
  return <button type="button" className="card-help" aria-label={label}>
    <HelpCircle />
    <span className="card-help-tooltip">{text}</span>
  </button>
}

function InlineHelp({ text, label = 'Ver explicación' }) {
  return <button type="button" className="inline-help" aria-label={label}>
    <HelpCircle />
    <span className="inline-help-tooltip">{text}</span>
  </button>
}

function KpiInfoCard({ title, value, detail, icon, tone = '', help }) {
  return <article className={`kpi-info-card ${tone}`}>
    <div className="kpi-info-head">
      <span>{title}</span>
      <button type="button" className="kpi-help" aria-label={`Explicación de ${title}`}>
        <HelpCircle />
        <span className="kpi-help-tooltip">{help}</span>
      </button>
    </div>
    <strong className={tone}>{value}</strong>
    <span className="kpi-card-icon">{icon}</span>
    <small>{detail}</small>
  </article>
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
  const [tab, setTab] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [monthlyOpen, setMonthlyOpen] = useState(true)
  const [dashboardView, setDashboardView] = useState('overview')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [forecastCategoryModalOpen, setForecastCategoryModalOpen] = useState(false)
  const [selectedForecastCategories, setSelectedForecastCategories] = useState(null)
  const [forecastCategoryDraft, setForecastCategoryDraft] = useState([])
  const [forecastRecurringDetailOpen, setForecastRecurringDetailOpen] = useState(false)
  const [forecastDetailOpen, setForecastDetailOpen] = useState({ balance:false, registered:false, pending:false, savings:false })
  const emptyFilters = { dateFrom: '', dateTo: '', category: 'all', minAmount: '', maxAmount: '' }
  const [filters, setFilters] = useState(emptyFilters)
  const [filterDraft, setFilterDraft] = useState(emptyFilters)
  const [comparisonMonth, setComparisonMonth] = useState(() => {
    const [y,m] = monthKey().split('-').map(Number)
    return `${m === 1 ? y-1 : y}-${String(m === 1 ? 12 : m-1).padStart(2,'0')}`
  })
  const [theme, setTheme] = useState('blue')
  const [backgroundTheme, setBackgroundTheme] = useState('navy')
  const [selectedReserveCategories, setSelectedReserveCategories] = useState(null)
  const [selectedIncomeCategories, setSelectedIncomeCategories] = useState(null)
  const [savingsForm, setSavingsForm] = useState({
    kind: 'deposit',
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    description: '',
    from_account_id: '',
    to_account_id: ''
  })
  const [bigExpenseSearch, setBigExpenseSearch] = useState('')
  const [bigExpenseCategory, setBigExpenseCategory] = useState('all')
  const [savingsGoals, setSavingsGoals] = useState([])
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
  const [dataLoading, setDataLoading] = useState(false)
  const [userSettings, setUserSettings] = useState({ opening_balance_month: '', opening_balance_amount: 0 })
  const [settingsDraft, setSettingsDraft] = useState({ opening_balance_month: '', opening_balance_amount: '' })
  const [accountForm, setAccountForm] = useState({ name: '', initial_balance: '' })
  const [editingAccountId, setEditingAccountId] = useState(null)
  const [transferForm, setTransferForm] = useState({ from_account_id: '', to_account_id: '', amount: '', date: new Date().toISOString().slice(0, 10), description: '' })
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches)
  const [mobileQuickMode, setMobileQuickMode] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches)
  const [recurringPayments, setRecurringPayments] = useState([])
  const [recurringForm, setRecurringForm] = useState({ name: '', amount: '', day: 1, category: '', account_id: '', active: true })
  const [creditPlans, setCreditPlans] = useState([])
  const [creditForm, setCreditForm] = useState({ description: '', card: '', total: '', installments: 1, paid: 0, start_month: monthKey(), due_day: 10, category: '', account_id: '' })
  const [undoAction, setUndoAction] = useState(null)
  const [dismissedNotifications, setDismissedNotifications] = useState([])
  const [readNotifications, setReadNotifications] = useState([])
  const loadRequestRef = useRef(0)
  const preferencesRequestRef = useRef(0)
  const notificationsRequestRef = useRef(0)
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

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

  useEffect(() => {
    loadRequestRef.current += 1
    const [y, m] = monthKey().split('-').map(Number)
    const previousMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`

    setAccounts([])
    setCategories([])
    setMovements([])
    setSearch('')
    setNotice('')
    setForecastCategoryModalOpen(false)
    setSelectedForecastCategories(null)
    setForecastCategoryDraft([])
    setFilters(emptyFilters)
    setFilterDraft(emptyFilters)
    setComparisonMonth(previousMonth)
    setSelectedIncomeCategories(null)
    setSelectedReserveCategories(null)
    setSavingsGoals([])
    setSavingsForm({ kind: 'deposit', date: new Date().toISOString().slice(0, 10), amount: '', description: '', from_account_id: '', to_account_id: '' })
    setGoalForm({ name: '', target: '', priority: 1 })
    setBigExpenseSearch('')
    setBigExpenseCategory('all')
    setNotificationsOpen(false)
    setFiltersOpen(false)
    setPreferencesLoaded(false)
    setTheme('blue')
    setBackgroundTheme('navy')
    setSidebarOpen(true)
    setRecurringPayments([])
    setCreditPlans([])
    setDismissedNotifications([])
    setReadNotifications([])

    if (session?.user?.id) loadAll()
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user) return
    setProfileName(session.user.user_metadata?.name || session.user.user_metadata?.full_name || '')
  }, [session])

  useEffect(() => {
    document.documentElement.dataset.financeTheme = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.financeBackground = backgroundTheme
  }, [backgroundTheme])

  useEffect(() => {
    if (!configured || !session?.user?.id || !preferencesLoaded) return

    const timer = window.setTimeout(async () => {
      const requestId = ++preferencesRequestRef.current
      const payload = {
        user_id: session.user.id,
        theme,
        background_theme: backgroundTheme,
        sidebar_open: sidebarOpen,
        selected_income_categories: selectedIncomeCategories,
        selected_reserve_categories: selectedReserveCategories,
        selected_forecast_categories: selectedForecastCategories,
        savings_goals: savingsGoals,
        updated_at: new Date().toISOString()
      }
      const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' })
      if (!mountedRef.current || requestId !== preferencesRequestRef.current) return
      if (error) setNotice(`No se pudieron guardar las preferencias: ${error.message}`)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [configured, session?.user?.id, preferencesLoaded, theme, backgroundTheme, sidebarOpen, selectedIncomeCategories, selectedReserveCategories, selectedForecastCategories, savingsGoals])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const syncViewport = (event) => {
      const matches = event.matches
      setIsMobileViewport(matches)
      if (!matches) setMobileQuickMode(false)
    }
    setIsMobileViewport(media.matches)
    if (media.addEventListener) media.addEventListener('change', syncViewport)
    else media.addListener(syncViewport)
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', syncViewport)
      else media.removeListener(syncViewport)
    }
  }, [])

  useEffect(() => {
    if (configured) return
    const safeRead = (key, fallback = []) => {
      try { return JSON.parse(localStorage.getItem(`${key}_demo`) || JSON.stringify(fallback)) } catch { return fallback }
    }
    setRecurringPayments(safeRead('finance_recurring_payments'))
    setCreditPlans(safeRead('finance_credit_plans'))
    setDismissedNotifications(safeRead('finance_dismissed_notifications'))
    setReadNotifications(safeRead('finance_read_notifications'))
  }, [])

  useEffect(() => {
    if (configured) return
    localStorage.setItem('finance_recurring_payments_demo', JSON.stringify(recurringPayments))
  }, [recurringPayments])

  useEffect(() => {
    if (configured) return
    localStorage.setItem('finance_credit_plans_demo', JSON.stringify(creditPlans))
  }, [creditPlans])

  useEffect(() => {
    if (configured) return
    localStorage.setItem('finance_dismissed_notifications_demo', JSON.stringify(dismissedNotifications))
    localStorage.setItem('finance_read_notifications_demo', JSON.stringify(readNotifications))
  }, [dismissedNotifications, readNotifications])

  useEffect(() => {
    if (!configured || !session?.user?.id || !preferencesLoaded) return
    const timer = window.setTimeout(async () => {
      const requestId = ++notificationsRequestRef.current
      const { error } = await supabase.from('notification_preferences').upsert({
        user_id: session.user.id,
        dismissed_ids: dismissedNotifications,
        read_ids: readNotifications,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      if (!mountedRef.current || requestId !== notificationsRequestRef.current) return
      if (error) setNotice(`No se pudieron guardar las notificaciones: ${error.message}`)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [configured, session?.user?.id, preferencesLoaded, dismissedNotifications, readNotifications])

  useEffect(() => {
    if (!undoAction) return
    const timer = window.setTimeout(() => setUndoAction(null), 7000)
    return () => window.clearTimeout(timer)
  }, [undoAction])

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return
      if (e.key.toLowerCase() === 'i') openNew('income')
      if (e.key.toLowerCase() === 'e') openNew('expense')
      if (e.key.toLowerCase() === 'n') setTab('cargar')
      if (e.key === '/') { e.preventDefault(); setFiltersOpen(true) }
      if (e.key === 'Escape') { setFiltersOpen(false); setNotificationsOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [accounts, categories])

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

  const loadAll = async () => {
    if (!session?.user?.id) return
    const requestId = ++loadRequestRef.current
    setDataLoading(true)
    try {
      const currentUserId = session.user.id
      const recentCutoff = new Date()
      recentCutoff.setMonth(recentCutoff.getMonth() - 12)
      const recentFrom = recentCutoff.toISOString().slice(0, 10)

      const fetchUserData = () => Promise.all([
        supabase.from('accounts').select('*').eq('user_id', currentUserId).order('name'),
        supabase.from('categories').select('*').eq('user_id', currentUserId).order('type').order('name'),
        supabase.from('transactions').select('*,accounts(name),categories(name)').eq('user_id', currentUserId).gte('date', recentFrom).order('date', { ascending: false }),
        supabase.from('user_settings').select('opening_balance_month,opening_balance_amount,theme,background_theme,sidebar_open,selected_income_categories,selected_reserve_categories,selected_forecast_categories,savings_goals').eq('user_id', currentUserId).maybeSingle(),
        supabase.from('recurring_payments').select('*').eq('user_id', currentUserId).order('day').order('name'),
        supabase.from('credit_plans').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
        supabase.from('notification_preferences').select('dismissed_ids,read_ids').eq('user_id', currentUserId).maybeSingle()
      ])

      let [a, c, m, settingsResult, recurringResult, creditResult, notificationResult] = await fetchUserData()
      const firstError = [a, c, m, settingsResult, recurringResult, creditResult, notificationResult].find(result => result.error)?.error
      if (firstError) throw new Error(firstError.message)

      const isBrandNewUser = !settingsResult.data && !(a.data || []).length && !(c.data || []).length
      if (isBrandNewUser) {
        const { error: bootstrapError } = await supabase.rpc('bootstrap_user')
        if (bootstrapError) throw bootstrapError
        ;[a, c, m, settingsResult, recurringResult, creditResult, notificationResult] = await fetchUserData()
        const bootstrapFetchError = [a, c, m, settingsResult, recurringResult, creditResult, notificationResult].find(result => result.error)?.error
        if (bootstrapFetchError) throw new Error(bootstrapFetchError.message)
      }

      const ownAccounts = (a.data || []).filter(row => row.user_id === currentUserId)
      const ownCategories = (c.data || []).filter(row => row.user_id === currentUserId)
      const recentMovements = (m.data || []).filter(row => row.user_id === currentUserId)
      const loadedSettings = settingsResult.data || { opening_balance_month: '', opening_balance_amount: 0, theme: 'blue', background_theme: 'navy', sidebar_open: true, selected_income_categories: null, selected_reserve_categories: null, selected_forecast_categories: null, savings_goals: [] }

      if (!mountedRef.current || requestId !== loadRequestRef.current) return
      setAccounts(ownAccounts)
      setCategories(ownCategories)
      setMovements(recentMovements)
      setUserSettings(loadedSettings)
      setSettingsDraft({
        opening_balance_month: loadedSettings.opening_balance_month || '',
        opening_balance_amount: loadedSettings.opening_balance_amount ?? ''
      })
      setTheme(loadedSettings.theme || 'blue')
      setBackgroundTheme(loadedSettings.background_theme || 'navy')
      setSidebarOpen(loadedSettings.sidebar_open !== false)
      setSelectedIncomeCategories(Array.isArray(loadedSettings.selected_income_categories) ? loadedSettings.selected_income_categories : null)
      setSelectedReserveCategories(Array.isArray(loadedSettings.selected_reserve_categories) ? loadedSettings.selected_reserve_categories : null)
      setSelectedForecastCategories(Array.isArray(loadedSettings.selected_forecast_categories) ? loadedSettings.selected_forecast_categories : null)
      setSavingsGoals(Array.isArray(loadedSettings.savings_goals) ? loadedSettings.savings_goals : [])
      setRecurringPayments((recurringResult.data || []).filter(row => row.user_id === currentUserId))
      setCreditPlans((creditResult.data || []).filter(row => row.user_id === currentUserId))
      setDismissedNotifications(Array.isArray(notificationResult.data?.dismissed_ids) ? notificationResult.data.dismissed_ids : [])
      setReadNotifications(Array.isArray(notificationResult.data?.read_ids) ? notificationResult.data.read_ids : [])
      setPreferencesLoaded(true)
      setTransferForm(current => ({
        ...current,
        from_account_id: current.from_account_id || ownAccounts[0]?.id || '',
        to_account_id: current.to_account_id || ownAccounts[1]?.id || ownAccounts[0]?.id || ''
      }))
      setSavingsForm(current => ({
        ...current,
        from_account_id: current.from_account_id || ownAccounts[0]?.id || '',
        to_account_id: current.to_account_id || ownAccounts[0]?.id || ''
      }))

      // El historial anterior se incorpora después del primer render para no bloquear el inicio.
      const loadOlderHistory = async () => {
        const { data, error } = await supabase
          .from('transactions')
          .select('*,accounts(name),categories(name)')
          .eq('user_id', currentUserId)
          .lt('date', recentFrom)
          .order('date', { ascending: false })
        if (!mountedRef.current || requestId !== loadRequestRef.current) return
        if (error) return setNotice(`No se pudo completar el historial: ${error.message}`)
        const older = (data || []).filter(row => row.user_id === currentUserId)
        if (!older.length) return
        setMovements(current => {
          const ids = new Set(current.map(item => item.id))
          return [...current, ...older.filter(item => !ids.has(item.id))]
            .sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')))
        })
      }
      if ('requestIdleCallback' in window) window.requestIdleCallback(loadOlderHistory, { timeout: 2500 })
      else window.setTimeout(loadOlderHistory, 300)
    } catch (e) {
      setAccounts([])
      setCategories([])
      setMovements([])
      setRecurringPayments([])
      setCreditPlans([])
      setDismissedNotifications([])
      setReadNotifications([])
      setNotice(e.message || String(e))
    } finally {
      if (mountedRef.current && requestId === loadRequestRef.current) setDataLoading(false)
    }
  }


  const requestConfirm = ({ title, message, confirmLabel = 'Eliminar', tone = 'danger', onConfirm }) => {
    setConfirmDialog({ title, message, confirmLabel, tone, onConfirm })
  }

  const runConfirmedAction = async () => {
    const action = confirmDialog?.onConfirm
    setConfirmDialog(null)
    if (action) await action()
  }

  const saveFinancialSettings = async (e) => {
    e.preventDefault()
    if (!configured) {
      const localSettings = {
        opening_balance_month: settingsDraft.opening_balance_month || '',
        opening_balance_amount: Number(settingsDraft.opening_balance_amount) || 0
      }
      setUserSettings(localSettings)
      localStorage.setItem('finance_user_settings_demo', JSON.stringify(localSettings))
      setNotice('Configuración financiera guardada localmente.')
      return
    }
    if (!session?.user?.id) return
    const payload = {
      user_id: session.user.id,
      opening_balance_month: settingsDraft.opening_balance_month || null,
      opening_balance_amount: Number(settingsDraft.opening_balance_amount) || 0,
      updated_at: new Date().toISOString()
    }
    const { data, error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select('opening_balance_month,opening_balance_amount')
      .single()
    if (error) return setNotice(error.message)
    setUserSettings(data)
    setNotice('Configuración financiera guardada.')
  }

  const resetAccountForm = () => {
    setEditingAccountId(null)
    setAccountForm({ name: '', initial_balance: '' })
  }

  const startEditingAccount = (account) => {
    setEditingAccountId(account.id)
    setAccountForm({
      name: account.name || '',
      initial_balance: account.initial_balance ?? ''
    })
  }

  const saveAccountRecord = async (e) => {
    e.preventDefault()
    const name = accountForm.name.trim()
    const initialBalance = Number(accountForm.initial_balance) || 0
    const wasEditing = editingAccountId !== null && editingAccountId !== undefined && editingAccountId !== ''

    if (!name) return setNotice('Ingrese un nombre para la cuenta.')

    if (!configured) {
      setAccounts(current => wasEditing
        ? current.map(account => account.id === editingAccountId
          ? { ...account, name, initial_balance: initialBalance }
          : account)
        : [...current, { id: crypto.randomUUID(), name, initial_balance: initialBalance }]
      )
      resetAccountForm()
      setNotice(wasEditing ? 'Cuenta actualizada.' : 'Cuenta creada.')
      return
    }

    if (!session?.user?.id) return setNotice('No existe una sesión activa.')

    if (wasEditing) {
      const { data, error } = await supabase
        .from('accounts')
        .update({ name, initial_balance: initialBalance })
        .eq('id', editingAccountId)
        .eq('user_id', session.user.id)
        .select('*')
        .maybeSingle()

      if (error) return setNotice(error.message)
      if (!data?.id) return setNotice('No se encontró la cuenta para actualizar. No se creó ninguna cuenta nueva.')
      setAccounts(current => current.map(account => account.id === editingAccountId ? data : account))
      setMovements(current => current.map(item => item.account_id === editingAccountId ? { ...item, accounts: { name } } : item))
    } else {
      const { data, error } = await supabase
        .from('accounts')
        .insert({ name, initial_balance: initialBalance, user_id: session.user.id })
        .select('*')
        .single()
      if (error) return setNotice(error.message)
      setAccounts(current => [...current, data].sort((a, b) => a.name.localeCompare(b.name)))
    }
    resetAccountForm()
    setNotice(wasEditing ? 'Cuenta actualizada.' : 'Cuenta creada.')
  }

  const removeAccount = (account) => {
    const linked = movements.filter(m => m.account_id === account.id).length
    requestConfirm({
      title: 'Eliminar cuenta',
      message: linked
        ? `Se eliminará la cuenta “${account.name}”. Sus ${linked} movimientos se conservarán, pero quedarán sin una cuenta asignada.`
        : `Se eliminará la cuenta “${account.name}”. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar cuenta',
      tone: 'danger',
      onConfirm: async () => {
        if (!configured) {
          setMovements(current => current.map(m => m.account_id === account.id ? { ...m, account_id: null, accounts: null } : m))
          setAccounts(current => current.filter(a => a.id !== account.id))
          editingAccountId === account.id && resetAccountForm()
          return
        }

        if (linked) {
          const { error: unlinkError } = await supabase
            .from('transactions')
            .update({ account_id: null })
            .eq('account_id', account.id)
            .eq('user_id', session.user.id)
          if (unlinkError) {
            setNotice(`No se pudo desvincular la cuenta de sus movimientos: ${unlinkError.message}`)
            return
          }
        }

        const { error } = await supabase
          .from('accounts')
          .delete()
          .eq('id', account.id)
          .eq('user_id', session.user.id)

        if (error) {
          setNotice(error.message)
          return
        }

        editingAccountId === account.id && resetAccountForm()
        setAccounts(current => current.filter(item => item.id !== account.id))
        setMovements(current => current.map(item => item.account_id === account.id ? { ...item, account_id: null, accounts: null } : item))
        setNotice('Cuenta eliminada. Los movimientos asociados se conservaron sin cuenta asignada.')
      }
    })
  }

  const saveTransfer = async (e) => {
    e.preventDefault()
    const amount = Number(transferForm.amount)
    if (!amount || amount <= 0) return setNotice('Ingrese un monto válido para la transferencia.')
    if (!transferForm.from_account_id || !transferForm.to_account_id) return setNotice('Seleccione las dos cuentas.')
    if (transferForm.from_account_id === transferForm.to_account_id) return setNotice('Las cuentas de origen y destino deben ser diferentes.')

    const transferId = crypto.randomUUID()
    const from = accounts.find(a => a.id === transferForm.from_account_id)
    const to = accounts.find(a => a.id === transferForm.to_account_id)
    const description = transferForm.description.trim() || `Transferencia de ${from?.name || 'cuenta'} a ${to?.name || 'cuenta'}`
    const rows = [
      { user_id: session?.user?.id, type: 'expense', date: transferForm.date, description, amount, account_id: transferForm.from_account_id, category_id: null, notes: `${TRANSFER_OUT} ${transferId}` },
      { user_id: session?.user?.id, type: 'income', date: transferForm.date, description, amount, account_id: transferForm.to_account_id, category_id: null, notes: `${TRANSFER_IN} ${transferId}` }
    ]

    if (!configured) {
      const localRows = rows.map((row, index) => ({ ...row, id: `${transferId}-${index}`, accounts: { name: index ? to?.name : from?.name }, categories: null }))
      setMovements(current => [...localRows, ...current])
    } else {
      const { data, error } = await supabase.from('transactions').insert(rows).select('*,accounts(name),categories(name)')
      if (error) return setNotice(error.message)
      setMovements(current => [...(data || []), ...current])
    }
    setTransferForm({ from_account_id: accounts[0]?.id || '', to_account_id: accounts[1]?.id || '', amount: '', date: new Date().toISOString().slice(0, 10), description: '' })
    setNotice('Transferencia registrada sin afectar ingresos ni egresos.')
  }

  const removeTransfer = (transfer) => {
    const movementIds = Array.isArray(transfer?.movementIds) ? transfer.movementIds.filter(Boolean) : []
    if (!movementIds.length) {
      setNotice('No se pudieron identificar los movimientos asociados a esta transferencia.')
      return
    }

    requestConfirm({
      title: 'Eliminar transferencia',
      message: `Se eliminará la transferencia “${transfer.description || 'seleccionada'}” por ${money(transfer.amount || 0)}. Se borrarán tanto el movimiento de salida como el de entrada.`,
      confirmLabel: 'Eliminar transferencia',
      tone: 'danger',
      onConfirm: async () => {
        if (!configured) {
          const next = movements.filter(movement => !movementIds.includes(movement.id))
          setMovements(next)
          localStorage.setItem('finance_demo', JSON.stringify(next))
          setNotice('Transferencia eliminada.')
          return
        }

        if (!session?.user?.id) {
          setNotice('No existe una sesión activa.')
          return
        }

        const { error } = await supabase
          .from('transactions')
          .delete()
          .in('id', movementIds)
          .eq('user_id', session.user.id)

        if (error) {
          setNotice(error.message)
          return
        }

        setMovements(current => current.filter(movement => !movementIds.includes(movement.id)))
        setNotice('Transferencia eliminada correctamente.')
      }
    })
  }

  const accountBalance = (accountId) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return 0

    return movements
      .filter(movement => movement.account_id === accountId)
      .reduce((balance, movement) => {
        const amount = Number(movement.amount) || 0
        const notes = String(movement.notes || '')
        if (notes.includes(TRANSFER_IN)) return balance + amount
        if (notes.includes(TRANSFER_OUT)) return balance - amount
        return movement.type === 'income' ? balance + amount : balance - amount
      }, Number(account.initial_balance) || 0)
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
    const q = editing
      ? supabase.from('transactions').update(payload).eq('id', editing.id).eq('user_id', session.user.id)
      : supabase.from('transactions').insert(payload)
    const { data, error } = await q.select('*,accounts(name),categories(name)').single()
    if (error) setNotice(error.message)
    else {
      setMovements(current => editing
        ? current.map(item => item.id === editing.id ? data : item)
        : [data, ...current]
      )
      setModal(false)
      setEditing(null)
    }
  }


  const saveRecurringPayment = async (e) => {
    e.preventDefault()
    const amount = Number(recurringForm.amount)
    if (!recurringForm.name.trim() || !amount || amount <= 0) return setNotice('Ingrese un nombre y un monto válido para el pago recurrente.')
    const payload = {
      name: recurringForm.name.trim(),
      amount,
      day: Math.min(Math.max(Number(recurringForm.day) || 1, 1), 31),
      category: recurringForm.category.trim(),
      account_id: recurringForm.account_id || null,
      active: recurringForm.active !== false
    }

    if (!configured) {
      const row = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      setRecurringPayments(current => [...current, row].sort((a,b)=>a.day-b.day || a.name.localeCompare(b.name)))
    } else {
      const { data, error } = await supabase.from('recurring_payments')
        .insert({ ...payload, user_id: session.user.id })
        .select()
        .single()
      if (error) return setNotice(error.message)
      setRecurringPayments(current => [...current, data].sort((a,b)=>a.day-b.day || a.name.localeCompare(b.name)))
    }

    setRecurringForm({ name: '', amount: '', day: 1, category: '', account_id: accounts[0]?.id || '', active: true })
    setNotice('Pago recurrente agregado.')
  }

  const toggleRecurringPayment = async (item) => {
    const active = item.active === false
    if (!configured) {
      setRecurringPayments(current => current.map(x => x.id === item.id ? { ...x, active } : x))
      return
    }
    const { error } = await supabase.from('recurring_payments')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', item.id).eq('user_id', session.user.id)
    if (error) return setNotice(error.message)
    setRecurringPayments(current => current.map(x => x.id === item.id ? { ...x, active } : x))
  }

  const removeRecurringPayment = async (id) => {
    const removed = recurringPayments.find(item => item.id === id)
    if (!removed) return
    if (!configured) {
      setRecurringPayments(current => current.filter(item => item.id !== id))
      setUndoAction({ label: `Pago recurrente “${removed.name}” eliminado`, restore: () => setRecurringPayments(current => [...current, removed].sort((a,b)=>a.day-b.day)) })
      return
    }
    const { error } = await supabase.from('recurring_payments').delete().eq('id', id).eq('user_id', session.user.id)
    if (error) return setNotice(error.message)
    setRecurringPayments(current => current.filter(item => item.id !== id))
    setUndoAction({
      label: `Pago recurrente “${removed.name}” eliminado`,
      restore: async () => {
        const { id, created_at, updated_at, ...rest } = removed
        const { data, error: restoreError } = await supabase.from('recurring_payments')
          .insert({ ...rest, user_id: session.user.id })
          .select().single()
        if (restoreError) return setNotice(restoreError.message)
        setRecurringPayments(current => [...current, data].sort((a,b)=>a.day-b.day || a.name.localeCompare(b.name)))
      }
    })
  }

  const saveCreditPlan = async (e) => {
    e.preventDefault()
    const total = Number(creditForm.total)
    const installments = Math.max(Number(creditForm.installments) || 1, 1)
    const paid = Math.min(Math.max(Number(creditForm.paid) || 0, 0), installments)
    if (!creditForm.description.trim() || !creditForm.card.trim() || !total || total <= 0) return setNotice('Complete la descripción, la tarjeta y el importe total.')
    const payload = {
      description: creditForm.description.trim(),
      card: creditForm.card.trim(),
      total, installments, paid,
      start_month: creditForm.start_month,
      due_day: Math.min(Math.max(Number(creditForm.due_day) || 1, 1), 31),
      category: creditForm.category.trim(),
      account_id: creditForm.account_id || null
    }

    if (!configured) {
      setCreditPlans(current => [{ ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...current])
    } else {
      const { data, error } = await supabase.from('credit_plans')
        .insert({ ...payload, user_id: session.user.id })
        .select().single()
      if (error) return setNotice(error.message)
      setCreditPlans(current => [data, ...current])
    }
    setCreditForm({ description: '', card: '', total: '', installments: 1, paid: 0, start_month: monthKey(), due_day: 10, category: '', account_id: accounts[0]?.id || '' })
    setNotice('Compra en cuotas agregada.')
  }

  const updateCreditPaid = async (id, delta) => {
    const currentPlan = creditPlans.find(item => item.id === id)
    if (!currentPlan) return
    const paid = Math.min(Math.max(Number(currentPlan.paid || 0) + delta, 0), Number(currentPlan.installments || 1))
    if (!configured) {
      setCreditPlans(current => current.map(item => item.id === id ? { ...item, paid } : item))
      return
    }
    const { error } = await supabase.from('credit_plans')
      .update({ paid, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', session.user.id)
    if (error) return setNotice(error.message)
    setCreditPlans(current => current.map(item => item.id === id ? { ...item, paid } : item))
  }

  const removeCreditPlan = async (id) => {
    const removed = creditPlans.find(item => item.id === id)
    if (!removed) return
    if (!configured) {
      setCreditPlans(current => current.filter(item => item.id !== id))
      setUndoAction({ label: `Compra “${removed.description}” eliminada`, restore: () => setCreditPlans(current => [removed, ...current]) })
      return
    }
    const { error } = await supabase.from('credit_plans').delete().eq('id', id).eq('user_id', session.user.id)
    if (error) return setNotice(error.message)
    setCreditPlans(current => current.filter(item => item.id !== id))
    setUndoAction({
      label: `Compra “${removed.description}” eliminada`,
      restore: async () => {
        const { id, created_at, updated_at, ...rest } = removed
        const { data, error: restoreError } = await supabase.from('credit_plans')
          .insert({ ...rest, user_id: session.user.id })
          .select().single()
        if (restoreError) return setNotice(restoreError.message)
        setCreditPlans(current => [data, ...current])
      }
    })
  }

  const saveSavingsMovement = async (e) => {
    e.preventDefault()
    const amount = Number(savingsForm.amount)
    if (!amount || amount <= 0) {
      setNotice('Ingrese un monto válido.')
      return
    }

    const fromAccount = accounts.find(account => account.id === savingsForm.from_account_id)
    const toAccount = accounts.find(account => account.id === savingsForm.to_account_id)
    if (!fromAccount || !toAccount) {
      setNotice('Seleccione la cuenta de origen y la cuenta de destino.')
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

    // El movimiento de ahorro se registra una sola vez para que compute en el fondo.
    // Cuando origen y destino son diferentes, se agregan además dos movimientos internos
    // de transferencia. Esos movimientos solo cambian los saldos de las cuentas y no
    // afectan ingresos, egresos ni resultados mensuales.
    const savingsAccount = isDeposit ? fromAccount : toAccount
    const savingsPayload = {
      type: isDeposit ? 'expense' : 'income',
      date: savingsForm.date,
      description,
      amount,
      account_id: savingsAccount.id,
      category_id: category.id,
      notes: `${noteMarker} ${description}`
    }

    const accountsAreDifferent = fromAccount.id !== toAccount.id
    const transferId = accountsAreDifferent ? crypto.randomUUID() : null
    const transferDescription = isDeposit
      ? `Ahorro de ${fromAccount.name} a ${toAccount.name}`
      : `Retiro de ahorro de ${fromAccount.name} a ${toAccount.name}`
    const transferRows = accountsAreDifferent ? [
      {
        user_id: session?.user?.id,
        type: 'expense',
        date: savingsForm.date,
        description: transferDescription,
        amount,
        account_id: fromAccount.id,
        category_id: null,
        notes: `${TRANSFER_OUT} ${transferId}`
      },
      {
        user_id: session?.user?.id,
        type: 'income',
        date: savingsForm.date,
        description: transferDescription,
        amount,
        account_id: toAccount.id,
        category_id: null,
        notes: `${TRANSFER_IN} ${transferId}`
      }
    ] : []

    if (!configured) {
      const savingsRow = {
        ...savingsPayload,
        id: crypto.randomUUID(),
        accounts: { name: savingsAccount.name },
        categories: { name: category.name }
      }
      const localTransferRows = transferRows.map((row, index) => ({
        ...row,
        id: `${transferId}-${index}`,
        accounts: { name: index === 0 ? fromAccount.name : toAccount.name },
        categories: null
      }))
      const next = [savingsRow, ...localTransferRows, ...movements]
      setMovements(next)
      localStorage.setItem('finance_demo', JSON.stringify(next))
    } else {
      const rowsToInsert = [
        { ...savingsPayload, user_id: session.user.id },
        ...transferRows
      ]
      const { data, error } = await supabase.from('transactions').insert(rowsToInsert).select('*,accounts(name),categories(name)')
      if (error) {
        setNotice(error.message)
        return
      }
      setMovements(current => [...(data || []), ...current])
    }

    setSavingsForm({
      kind: 'deposit',
      date: new Date().toISOString().slice(0, 10),
      amount: '',
      description: '',
      from_account_id: fromAccount.id,
      to_account_id: toAccount.id
    })

    if (accountsAreDifferent) {
      setNotice(isDeposit
        ? `Ahorro registrado y ${money(amount)} transferidos de ${fromAccount.name} a ${toAccount.name}.`
        : `Retiro registrado y ${money(amount)} transferidos de ${fromAccount.name} a ${toAccount.name}.`)
    } else {
      setNotice(isDeposit
        ? 'Dinero guardado en ahorros sin modificar el saldo de la cuenta.'
        : 'Dinero retirado de ahorros sin modificar el saldo de la cuenta.')
    }
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
    setGoalForm({ name: '', target: '', priority: next.length + 1 })
    setNotice('Meta de ahorro agregada.')
  }

  const removeSavingsGoal = (id) => {
    const goal = savingsGoals.find(item => item.id === id)
    requestConfirm({
      title: 'Eliminar meta de ahorro',
      message: `Se eliminará la meta “${goal?.name || 'seleccionada'}”. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar meta',
      onConfirm: () => {
        const next = savingsGoals.filter(item => item.id !== id)
        setSavingsGoals(next)
          }
    })
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
  }

  const quickSaveMovement = async (movement, changes) => {
    const category = categories.find(c => c.id === changes.category_id) || null
    const previous = movement
    const optimistic = { ...movement, ...changes, categories: category ? { name:category.name } : null }
    setMovements(current => current.map(item => item.id === movement.id ? optimistic : item))
    if (!configured) {
      const next = movements.map(item => item.id === movement.id ? optimistic : item)
      localStorage.setItem('finance_demo', JSON.stringify(next))
      setNotice('Movimiento actualizado.')
      return
    }
    const { error } = await supabase.from('transactions').update({ date:changes.date, description:changes.description, amount:changes.amount, category_id:changes.category_id, updated_at:new Date().toISOString() }).eq('id', movement.id).eq('user_id', session.user.id)
    if (error) {
      setMovements(current => current.map(item => item.id === movement.id ? previous : item))
      setNotice(`No se pudo actualizar el movimiento: ${error.message}`)
      throw error
    }
    setNotice('Movimiento actualizado.')
  }

  const remove = (id) => {
    const movement = movements.find(item => item.id === id)
    requestConfirm({
      title: 'Eliminar movimiento',
      message: `Se eliminará “${movement?.description || 'el movimiento seleccionado'}” por ${money(movement?.amount || 0)}.`,
      confirmLabel: 'Eliminar movimiento',
      onConfirm: async () => {
        if (!configured) {
          const next = movements.filter(x => x.id !== id)
          setMovements(next)
          localStorage.setItem('finance_demo', JSON.stringify(next))
          setUndoAction({ label: `Movimiento “${movement?.description || ''}” eliminado`, restore: () => {
            const restored = [movement, ...next].filter(Boolean)
            setMovements(restored)
            localStorage.setItem('finance_demo', JSON.stringify(restored))
          }})
          return
        }
        const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', session.user.id)
        if (error) setNotice(error.message)
        else {
          setMovements(current => current.filter(item => item.id !== id))
          setUndoAction({ label: `Movimiento “${movement?.description || ''}” eliminado`, restore: async () => {
            if (!movement) return
            const payload = { type: movement.type, date: movement.date, description: movement.description, amount: movement.amount, account_id: movement.account_id || null, category_id: movement.category_id || null, notes: movement.notes || null, user_id: session.user.id }
            const { data, error: restoreError } = await supabase.from('transactions').insert(payload).select('*,accounts(name),categories(name)').single()
            if (restoreError) setNotice(restoreError.message)
            else { setMovements(current => [data, ...current]); setNotice('Movimiento restaurado.') }
          }})
        }
      }
    })
  }

  const addCategory = async (item) => {
    if (categories.some(c => c.name.toLowerCase() === item.name.toLowerCase() && c.type === item.type)) { setNotice('Esa categoría ya existe.'); return }
    if (!configured) {
      const next = [...categories, { ...item, id: crypto.randomUUID() }].sort((a, b) => a.name.localeCompare(b.name))
      setCategories(next); localStorage.setItem('finance_categories', JSON.stringify(next)); setNotice('Categoría agregada.'); return
    }
    const { data, error } = await supabase.from('categories').insert({ ...item, user_id: session.user.id }).select().single()
    if (error) setNotice(error.message)
    else {
      setCategories(current => [...current, data].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)))
      setNotice('Categoría agregada.')
    }
  }

  const removeCategory = (cat) => {
    const linked = movements.filter(m => m.category_id === cat.id).length
    requestConfirm({
      title: 'Eliminar categoría',
      message: linked
        ? `La categoría “${cat.name}” tiene ${linked} movimientos asociados. Al eliminarla, esos movimientos quedarán sin categoría.`
        : `Se eliminará la categoría “${cat.name}”.`,
      confirmLabel: 'Eliminar categoría',
      onConfirm: async () => {
        if (!configured) {
          const next = categories.filter(c => c.id !== cat.id)
          setCategories(next)
          localStorage.setItem('finance_categories', JSON.stringify(next))
          return
        }
        const { error } = await supabase.from('categories').delete().eq('id', cat.id).eq('user_id', session.user.id)
        if (error) setNotice(error.message)
        else {
          setCategories(current => current.filter(item => item.id !== cat.id))
          setMovements(current => current.map(item => item.category_id === cat.id ? { ...item, category_id: null, categories: null } : item))
          setNotice('Categoría eliminada.')
        }
      }
    })
  }

  const BASE_BALANCE_MONTH = userSettings.opening_balance_month || ''
  const BASE_BALANCE_AMOUNT = Number(userSettings.opening_balance_amount) || 0
  const DATA_START = BASE_BALANCE_MONTH || [...new Set(movements.map(x => x.date?.slice(0, 7)).filter(Boolean))].sort()[0] || month
  const financialMovements = useMemo(() => movements.filter(m => !isTransferMovement(m)), [movements])
  const monthRows = useMemo(() => financialMovements.filter(m => m.date?.startsWith(month)), [financialMovements, month])
  const visibleMonthRows = useMemo(() => monthRows, [monthRows])
  const searchedRows = useMemo(
    () => visibleMonthRows.filter(m => {
      const amount = Number(m.amount) || 0
      const category = m.categories?.name || (savingsKind(m) ? 'Ahorros' : 'Sin categoría')
      return `${m.description} ${category} ${m.notes || ''}`.toLowerCase().includes(search.toLowerCase()) &&
        (!filters.dateFrom || m.date >= filters.dateFrom) &&
        (!filters.dateTo || m.date <= filters.dateTo) &&
        (filters.category === 'all' || category === filters.category) &&
        (!filters.minAmount || amount >= Number(filters.minAmount)) &&
        (!filters.maxAmount || amount <= Number(filters.maxAmount))
    }),
    [visibleMonthRows, search, filters]
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
    if (!month) return 0
    if (BASE_BALANCE_MONTH && month <= BASE_BALANCE_MONTH) return 0
    const previousNet = financialMovements
      .filter(x => {
        const key = x.date?.slice(0, 7)
        if (!key || key >= month) return false
        return BASE_BALANCE_MONTH ? key > BASE_BALANCE_MONTH : true
      })
      .reduce((sum, x) => sum + (x.type === 'income' ? Number(x.amount) : -Number(x.amount)), 0)
    return BASE_BALANCE_AMOUNT + previousNet
  }, [financialMovements, month, BASE_BALANCE_MONTH, BASE_BALANCE_AMOUNT])
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
  const visibleDayLimit = useMemo(() => {
    const currentMonth = monthKey()
    if (month < currentMonth) return daysInSelectedMonth
    if (month > currentMonth) return 0
    return Math.min(new Date().getDate(), daysInSelectedMonth)
  }, [month, daysInSelectedMonth])
  const daily = useMemo(() => {
    const grouped = Object.fromEntries(dayTicks.map(day => [day, { day, ingresos: 0, egresos: 0 }]))

    // Solo se incorporan movimientos hasta el último día que debe mostrarse.
    // El eje X conserva todos los días del mes, pero los días futuros quedan sin valor
    // para que la curva se vaya completando automáticamente día a día.
    monthRows.forEach(x => {
      const day = Number(x.date?.slice(8, 10))
      if (!grouped[day] || day > visibleDayLimit) return
      if (x.type === 'income') grouped[day].ingresos += Number(x.amount)
      else grouped[day].egresos += Number(x.amount)
    })

    let cumulative = openingBalance
    let accumulatedIncome = 0
    let accumulatedExpense = 0

    return dayTicks.map(day => {
      const current = grouped[day]

      if (day > visibleDayLimit || visibleDayLimit === 0) {
        return {
          ...current,
          balanceDia: null,
          acumulado: null,
          ingresosAc: null,
          egresosAc: null
        }
      }

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
  }, [monthRows, openingBalance, dayTicks, visibleDayLimit])

  const monthTotals = useMemo(() => {
    const grouped = financialMovements.reduce((out, item) => {
      const key = item.date?.slice(0, 7)
      if (!key) return out
      out[key] ??= { month: key, ingresos: 0, egresos: 0 }
      if (item.type === 'income') out[key].ingresos += Number(item.amount)
      else out[key].egresos += Number(item.amount)
      return out
    }, {})

    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month)).map((item, index, all) => {
      if (BASE_BALANCE_MONTH && item.month === BASE_BALANCE_MONTH) {
        return { ...item, apertura: 0, neto: item.ingresos - item.egresos, saldoFinal: BASE_BALANCE_AMOUNT }
      }
      const previous = all.slice(0, index).filter(row => !BASE_BALANCE_MONTH || row.month > BASE_BALANCE_MONTH)
      const apertura = BASE_BALANCE_AMOUNT + previous.reduce((sum, row) => sum + row.ingresos - row.egresos, 0)
      const neto = item.ingresos - item.egresos
      return { ...item, apertura, neto, saldoFinal: apertura + neto }
    })
  }, [financialMovements, BASE_BALANCE_MONTH, BASE_BALANCE_AMOUNT])


  const analysisMonths = useMemo(() => {
    const keys = [...new Set(financialMovements.map(x => x.date?.slice(0, 7)).filter(k => k && k >= DATA_START))]
    return keys.sort()
  }, [financialMovements])

  const financeAnalysis = useMemo(() => {
    const monthCount = Math.max(analysisMonths.length, 1)
    const createStats = (type) => {
      const grouped = {}
      financialMovements.filter(x => {
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
      const rows = financialMovements.filter(x => x.date?.startsWith(monthKeyValue))

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
  }, [financialMovements, analysisMonths, monthTotals])

  useEffect(() => {
    if (!financeAnalysis.expenses.length) return

    setSelectedReserveCategories(current => {
      if (Array.isArray(current)) {
        const valid = current.filter(name => financeAnalysis.expenses.some(x => x.name === name))
        return valid
      }

      const defaults = financeAnalysis.expenses.map(x => x.name)
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

      return next
    })
  }

  const selectAllReserveCategories = () => {
    const next = financeAnalysis.expenses.map(x => x.name)
    setSelectedReserveCategories(next)
  }

  const clearReserveCategories = () => {
    setSelectedReserveCategories([])
  }

  useEffect(() => {
    if (!financeAnalysis.incomes.length) return

    setSelectedIncomeCategories(current => {
      if (Array.isArray(current)) {
        const valid = current.filter(name => financeAnalysis.incomes.some(x => x.name === name))
        return valid
      }

      const defaults = financeAnalysis.incomes.map(x => x.name)
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

  const selectedMonthlySavings = useMemo(() => {
    const incomeNames = new Set(selectedIncomeAnalysis.map(x => x.name))
    const expenseNames = new Set(selectedReserveExpenses.map(x => x.name))
    const currentMonthKey = new Date().toISOString().slice(0, 7)

    const totals = analysisMonths.map(monthKeyValue => {
      let ingresos = 0
      let egresos = 0

      financialMovements.forEach(item => {
        if (item.date?.slice(0, 7) !== monthKeyValue) return
        const categoryName = item.categories?.name || 'Sin categoría'

        if (item.type === 'income') {
          if (incomeNames.has(categoryName)) ingresos += Number(item.amount || 0)
          return
        }

        if (item.type !== 'expense' || savingsKind(item) === 'deposit') return
        if (expenseNames.has(categoryName)) egresos += Number(item.amount || 0)
      })

      return { month: monthKeyValue, ingresos, egresos, neto: ingresos - egresos }
    })

    // Solo se consideran meses cerrados que tengan ingresos y egresos reales.
    // Los meses incompletos, vacíos o con déficit no deben llevar automáticamente
    // la recomendación a $0 cuando existen otros meses con capacidad de ahorro.
    const completedMonths = totals.filter(item =>
      item.month < currentMonthKey && item.ingresos > 0 && item.egresos > 0
    )
    const validMonths = completedMonths.length
      ? completedMonths
      : totals.filter(item => item.ingresos > 0 && item.egresos > 0)
    const positiveMonths = validMonths.filter(item => item.neto > 0)
    const referenceMonths = positiveMonths.length ? positiveMonths : []
    const netValues = referenceMonths.map(item => item.neto).sort((a, b) => a - b)

    const average = netValues.length
      ? netValues.reduce((sum, value) => sum + value, 0) / netValues.length
      : 0

    const median = netValues.length
      ? netValues.length % 2 === 1
        ? netValues[Math.floor(netValues.length / 2)]
        : (netValues[netValues.length / 2 - 1] + netValues[netValues.length / 2]) / 2
      : 0

    const lastComplete = referenceMonths.length
      ? referenceMonths[referenceMonths.length - 1].neto
      : 0

    let percentile25 = 0
    if (netValues.length) {
      const position = (netValues.length - 1) * 0.25
      const lower = Math.floor(position)
      const upper = Math.ceil(position)
      const weight = position - lower
      percentile25 = netValues[lower] + (netValues[upper] - netValues[lower]) * weight
    }

    // Se toma una referencia prudente de los meses que efectivamente dejaron saldo.
    // El último mes se conserva como dato informativo, pero no puede anular por sí solo
    // toda la recomendación histórica.
    const recommended = Math.max(0, Math.min(average, median, percentile25))

    return { totals, average, median, lastComplete, percentile25, recommended, validMonths: validMonths.length }
  }, [analysisMonths, financialMovements, selectedIncomeAnalysis, selectedReserveExpenses])

  const selectedSavingsCapacity = selectedMonthlySavings.recommended
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

      return next
    })
  }

  const selectAllIncomeCategories = () => {
    const next = financeAnalysis.incomes.map(x => x.name)
    setSelectedIncomeCategories(next)
  }

  const clearIncomeCategories = () => {
    setSelectedIncomeCategories([])
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

  // Datos específicos del gráfico de distribución de Inicio.
  // Incluye siempre la categoría Ahorros cuando existen aportes en el mes.
  const homeExpenseByCategory = useMemo(() => {
    const regularCategories = byCategory.filter(item => item.name !== 'Ahorros')
    if (monthlySavingsDeposits <= 0) return regularCategories.slice(0, 6)

    const savingsCategory = {
      name: 'Ahorros',
      value: monthlySavingsDeposits,
      count: savingsMovements.filter(item => savingsKind(item) === 'deposit' && item.date?.startsWith(month)).length
    }

    return [...regularCategories.slice(0, 5), savingsCategory]
      .sort((a, b) => b.value - a.value)
  }, [byCategory, monthlySavingsDeposits, savingsMovements, month])

  const homeExpenseCategoryTotal = expenseWithoutSavings + monthlySavingsDeposits

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
    return financialMovements
      .filter(x => x.type === 'expense' && !isSavingsMovement(x))
      .filter(x => bigExpenseCategory === 'all' || (x.categories?.name || 'Sin categoría') === bigExpenseCategory)
      .filter(x => !query || `${x.description} ${x.categories?.name || ''} ${x.notes || ''}`.toLowerCase().includes(query))
      .sort((a, b) => Number(b.amount) - Number(a.amount))
  }, [financialMovements, bigExpenseSearch, bigExpenseCategory])

  const bigExpenseCategories = useMemo(
    () => [...new Set(financialMovements.filter(x => x.type === 'expense' && !isSavingsMovement(x)).map(x => x.categories?.name || 'Sin categoría'))].sort(),
    [financialMovements]
  )


  const allCategoryNames = useMemo(() => [...new Set(financialMovements.map(x => x.categories?.name || (savingsKind(x) ? 'Ahorros' : 'Sin categoría')))].sort(), [financialMovements])
  const previousMonthRows = useMemo(() => financialMovements.filter(x => x.date?.startsWith(comparisonMonth)), [financialMovements, comparisonMonth])
  const previousIncome = previousMonthRows.filter(x => x.type === 'income').reduce((s,x)=>s+Number(x.amount),0)
  const previousExpense = previousMonthRows.filter(x => x.type === 'expense' && savingsKind(x) !== 'deposit').reduce((s,x)=>s+Number(x.amount),0)
  const forecastAvailableCategories = useMemo(
    () => [...new Set(
      financialMovements
        .filter(item => item.type === 'expense' && savingsKind(item) !== 'deposit')
        .map(item => item.categories?.name || 'Sin categoría')
    )].sort(),
    [financialMovements]
  )

  useEffect(() => {
    setSelectedForecastCategories(current => {
      if (!Array.isArray(current)) return forecastAvailableCategories
      return current.filter(name => forecastAvailableCategories.includes(name))
    })
  }, [forecastAvailableCategories])

  const forecastIncludedCategories = Array.isArray(selectedForecastCategories)
    ? selectedForecastCategories
    : forecastAvailableCategories

  const forecastExpenseRows = useMemo(
    () => expenseRowsWithoutSavings.filter(item =>
      forecastIncludedCategories.includes(item.categories?.name || 'Sin categoría')
    ),
    [expenseRowsWithoutSavings, forecastIncludedCategories]
  )

  const forecastExpenseCurrent = useMemo(
    () => forecastExpenseRows.reduce((sum, item) => sum + Number(item.amount), 0),
    [forecastExpenseRows]
  )

  const currentDayForForecast = month === monthKey()
    ? Math.max(new Date().getDate(), 1)
    : daysInSelectedMonth

  const forecastPaceExpense = forecastExpenseCurrent > 0
    ? (forecastExpenseCurrent / currentDayForForecast) * daysInSelectedMonth
    : 0

  // La predicción ya no infiere gastos recurrentes desde movimientos anteriores.
  // Solo considera los pagos recurrentes y las cuotas cargados explícitamente por el usuario.

  const monthIndex = (key) => {
    const [year, monthNumber] = String(key || monthKey()).split('-').map(Number)
    return year * 12 + monthNumber
  }

  const scheduledCommitments = useMemo(() => {
    const today = new Date()
    const selectedCurrent = month === monthKey()
    const passedDay = selectedCurrent ? today.getDate() : 0
    const recurring = recurringPayments.filter(item => item.active !== false && Number(item.day || 1) > passedDay).map(item => ({ id: `rec-${item.id}`, kind: 'recurrente', name: item.name, amount: Number(item.amount) || 0, day: Number(item.day) || 1 }))
    const credits = creditPlans.flatMap(item => {
      const start = monthIndex(item.start_month)
      const selected = monthIndex(month)
      const installmentNumber = selected - start + 1
      const totalInstallments = Number(item.installments) || 1
      if (installmentNumber < 1 || installmentNumber > totalInstallments || installmentNumber <= Number(item.paid || 0)) return []
      if (selectedCurrent && Number(item.due_day || 1) <= passedDay) return []
      return [{ id: `card-${item.id}`, kind: 'cuota', name: `${item.description} · ${item.card}`, amount: (Number(item.total) || 0) / totalInstallments, day: Number(item.due_day) || 1, installmentNumber, totalInstallments }]
    })
    return [...recurring, ...credits].sort((a,b)=>a.day-b.day)
  }, [recurringPayments, creditPlans, month])

  const scheduledCommitmentsPending = useMemo(() => scheduledCommitments.reduce((sum,item)=>sum+Number(item.amount||0),0), [scheduledCommitments])

  const forecastExpense = Math.max(
    forecastPaceExpense,
    forecastExpenseCurrent
  ) + scheduledCommitmentsPending

  // La predicción parte exactamente del mismo "Saldo actual" mostrado en Inicio.
  // Ese saldo ya contiene todos los ingresos, egresos y aportes a ahorros registrados
  // hasta hoy. Por eso solamente se descuentan los gastos que todavía faltan proyectar.
  const currentForecastBalance = closingBalance
  const forecastRemainingExpense = Math.max(forecastExpense - forecastExpenseCurrent, 0)
  const forecastClosing = currentForecastBalance - forecastRemainingExpense

  // Hasta el día actual se replica la curva real del Balance diario del Dashboard mensual.
  // Desde el día actual en adelante se continúa con una curva proyectada.
  const forecastChartData = useMemo(() => {
    const today = new Date()
    const selectedIsCurrentMonth = month === monthKey()
    const currentDay = selectedIsCurrentMonth
      ? Math.min(Math.max(today.getDate(), 1), daysInSelectedMonth)
      : daysInSelectedMonth
    const futureDays = Math.max(daysInSelectedMonth - currentDay, 1)
    const recurringByDay = {}
    scheduledCommitments.forEach(item => {
      const day = Math.min(Math.max(Number(item.day) || currentDay + 1, currentDay + 1), daysInSelectedMonth)
      recurringByDay[day] = (recurringByDay[day] || 0) + Number(item.amount || 0)
    })
    const paceOnlyPending = Math.max(forecastRemainingExpense - scheduledCommitmentsPending, 0)
    const dailyPace = paceOnlyPending / futureDays
    let projectedBalance = currentForecastBalance

    return daily.map((item) => {
      const day = item.day
      const isActualDay = day <= currentDay

      if (day > currentDay) {
        projectedBalance -= dailyPace
        projectedBalance -= recurringByDay[day] || 0
      }

      return {
        day,
        saldoReal: isActualDay ? item.acumulado : null,
        saldoProyectado: day < currentDay ? null : (day === currentDay ? currentForecastBalance : projectedBalance)
      }
    })
  }, [month, daysInSelectedMonth, daily, currentForecastBalance, forecastRemainingExpense, scheduledCommitments, scheduledCommitmentsPending])


  const forecastRegisteredByCategory = useMemo(() => {
    const grouped = forecastExpenseRows.reduce((acc, item) => {
      const name = item.categories?.name || 'Sin categoría'
      acc[name] = (acc[name] || 0) + Number(item.amount || 0)
      return acc
    }, {})
    return Object.entries(grouped)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [forecastExpenseRows])

  const forecastPacePending = Math.max(forecastPaceExpense - forecastExpenseCurrent, 0)

  const forecastPendingByCategory = useMemo(() => {
    if (forecastPacePending <= 0 || forecastExpenseCurrent <= 0) return []
    return forecastRegisteredByCategory.map(item => ({
      name: item.name,
      amount: forecastPacePending * (item.amount / forecastExpenseCurrent)
    })).filter(item => item.amount > 0.5)
  }, [forecastRegisteredByCategory, forecastPacePending, forecastExpenseCurrent])

  const monthlySavingsDetail = useMemo(() => savingsMovements
    .filter(item => savingsKind(item) === 'deposit' && item.date?.startsWith(month))
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
  [savingsMovements, month])

  const toggleForecastDetail = (key) => {
    setForecastDetailOpen(current => ({ ...current, [key]: !current[key] }))
  }

  const openForecastCategoryModal = () => {
    setForecastCategoryDraft([...forecastIncludedCategories])
    setForecastCategoryModalOpen(true)
  }

  const toggleForecastCategory = (name) => {
    setForecastCategoryDraft(current =>
      current.includes(name) ? current.filter(item => item !== name) : [...current, name]
    )
  }

  const applyForecastCategories = () => {
    setSelectedForecastCategories([...forecastCategoryDraft])
    setForecastCategoryModalOpen(false)
  }
  const nextGoal = allocatedSavingsGoals.find(g => !g.completed)
  const unusualExpenses = useMemo(() => {
    const historical = financialMovements.filter(item => item.type === 'expense' && !isSavingsMovement(item))
    const categoryStats = historical.reduce((out,item) => {
      const category = item.categories?.name || 'Sin categoría'
      out[category] ??= { total:0, count:0 }
      out[category].total += Number(item.amount)||0
      out[category].count += 1
      return out
    }, {})
    const duplicateKeys = historical.reduce((out,item) => {
      const key = `${item.date}|${String(item.description||'').trim().toLowerCase()}|${Number(item.amount)||0}`
      out[key] = (out[key]||0)+1
      return out
    }, {})
    return expenseRowsWithoutSavings.flatMap(item => {
      const category = item.categories?.name || 'Sin categoría'
      const stats = categoryStats[category]
      const average = stats?.count ? stats.total / stats.count : 0
      const duplicateKey = `${item.date}|${String(item.description||'').trim().toLowerCase()}|${Number(item.amount)||0}`
      const reasons = []
      if (average > 0 && Number(item.amount) >= average * 2.2 && Number(item.amount) - average >= 25000) reasons.push(`${((Number(item.amount)/average-1)*100).toFixed(0)}% sobre el promedio de ${category}`)
      if ((duplicateKeys[duplicateKey]||0) > 1) reasons.push('posible movimiento duplicado')
      return reasons.length ? [{ ...item, category, average, reasons }] : []
    }).sort((a,b)=>Number(b.amount)-Number(a.amount))
  }, [financialMovements, expenseRowsWithoutSavings])

  const notifications = useMemo(() => {
    const out = []
    const add = (id, type, title, text, group='General') => out.push({ id, type, title, text, group })
    if (expenseWithoutSavings > previousExpense && previousExpense > 0) add('expense-rise','warning','Gastos en aumento',`Los gastos del mes superan en ${((expenseWithoutSavings/previousExpense-1)*100).toFixed(1)}% al mes comparado.`,'Control')
    if (forecastClosing < 0) add('negative-forecast','danger','Saldo proyectado negativo',`La proyección indica un saldo negativo de ${money(Math.abs(forecastClosing))} al cierre del mes.`,'Predicción')
    if (nextGoal && nextGoal.remaining > 0) add(`goal-${nextGoal.id}`,'info','Meta pendiente',`Faltan ${money(nextGoal.remaining)} para completar la meta “${nextGoal.name}”.`,'Metas')
    scheduledCommitments.filter(item => item.day <= new Date().getDate()+7).forEach(item => add(item.id,'warning',item.kind==='cuota'?'Cuota próxima':'Pago próximo',`${item.name}: ${money(item.amount)} vence el día ${item.day}.`,'Vencimientos'))
    unusualExpenses.slice(0,3).forEach(item => add(`unusual-${item.id}`,'danger','Gasto inusual',`${item.description}: ${money(item.amount)} (${item.reasons.join(' y ')}).`,'Grandes gastos'))
    if (!movements.length) add('no-movements','info','Sin movimientos','Todavía no existen movimientos cargados.','General')
    if (!out.length) add('all-good','success','Finanzas al día','No se detectaron alertas financieras importantes.','General')
    return out.filter(item => !dismissedNotifications.includes(item.id))
  }, [expenseWithoutSavings, previousExpense, forecastClosing, nextGoal, movements.length, scheduledCommitments, unusualExpenses, dismissedNotifications])

  const unreadNotifications = notifications.filter(item => !readNotifications.includes(item.id))
  const markAllNotificationsRead = () => setReadNotifications(current => [...new Set([...current, ...notifications.map(item=>item.id)])])
  const dismissNotification = (id) => setDismissedNotifications(current => [...new Set([...current,id])])


  const calendarDays = useMemo(() => {
    const [y,m] = month.split('-').map(Number)
    const first = new Date(y,m-1,1).getDay()
    const days = new Date(y,m,0).getDate()
    const map = {}
    monthRows.forEach(x => { const d=Number(x.date?.slice(8,10)); map[d] ??={income:0,expense:0,savings:0}; if(savingsKind(x)==='deposit') map[d].savings += Number(x.amount); else if(x.type==='income') map[d].income += Number(x.amount); else map[d].expense += Number(x.amount) })
    return { first, days, map }
  }, [month, monthRows])


  const accountDashboardData = useMemo(() => accounts
    .map((account, index) => ({
      id: account.id,
      name: account.name || `Cuenta ${index + 1}`,
      saldo: accountBalance(account.id),
      index
    }))
    .sort((a, b) => b.saldo - a.saldo), [accounts, movements, closingBalance, savingsBalance])

  const totalAccountBalance = useMemo(
    () => accountDashboardData.reduce((sum, account) => sum + Number(account.saldo || 0), 0),
    [accountDashboardData]
  )

  const transferHistory = useMemo(() => {
    const groups = new Map()
    movements.filter(isTransferMovement).forEach(movement => {
      const notes = String(movement.notes || '')
      const transferId = notes.replace(TRANSFER_OUT, '').replace(TRANSFER_IN, '').trim() || movement.id
      const current = groups.get(transferId) || {
        id: transferId,
        date: movement.date,
        description: movement.description || 'Transferencia entre cuentas',
        amount: Number(movement.amount) || 0,
        from: 'Sin cuenta',
        to: 'Sin cuenta',
        movementIds: []
      }
      const accountName = movement.accounts?.name || accounts.find(account => account.id === movement.account_id)?.name || 'Sin cuenta'
      if (notes.includes(TRANSFER_OUT)) current.from = accountName
      if (notes.includes(TRANSFER_IN)) current.to = accountName
      if (!current.date || String(movement.date || '') > current.date) current.date = movement.date
      current.amount = Math.max(current.amount, Number(movement.amount) || 0)
      if (!current.movementIds.includes(movement.id)) current.movementIds.push(movement.id)
      groups.set(transferId, current)
    })
    return [...groups.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [movements, accounts])

  const currentMonthTransfers = useMemo(
    () => transferHistory.filter(item => item.date?.startsWith(month)),
    [transferHistory, month]
  )



  if (loading) return <div className="center"><RefreshCw className="spin" /> Cargando finanzas…</div>
  if (configured && !session) return <Auth supabase={supabase} />

  if (isMobileViewport && mobileQuickMode) {
    const recentMobileMovements = [...financialMovements]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 5)

    return <div className={`mobile-quick-app theme-${theme} background-${backgroundTheme}`}>
      <style>{`
        .mobile-quick-app, .mobile-quick-app * { box-sizing:border-box; }
        .mobile-quick-app { min-height:100vh; padding:16px; background:#071524; color:#eef7ff; font-family:inherit; }
        .mobile-quick-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:18px; }
        .mobile-quick-brand { display:flex; align-items:center; gap:11px; min-width:0; }
        .mobile-quick-brand > div:first-child { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; background:linear-gradient(135deg,#38bdf8,#6366f1); }
        .mobile-quick-brand svg { width:23px; height:23px; }
        .mobile-quick-brand b { display:block; font-size:18px; }
        .mobile-quick-brand small { display:block; color:#8aa7c7; font-size:11px; }
        .mobile-full-button { border:1px solid #365675; background:#0d1c30; color:#dbeafe; border-radius:10px; padding:9px 11px; font-weight:700; }
        .mobile-quick-title { margin:0 0 4px; font-size:24px; }
        .mobile-quick-subtitle { margin:0 0 16px; color:#8aa7c7; }
        .mobile-quick-kpis { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
        .mobile-quick-card { position:relative; min-height:108px; padding:14px; border:1px solid #29405c; border-radius:14px; background:#0d1c30; overflow:hidden; }
        .mobile-quick-card span { display:block; color:#8fb0d3; font-size:12px; margin-bottom:8px; }
        .mobile-quick-card strong { display:block; font-size:21px; line-height:1.15; padding-right:28px; }
        .mobile-quick-card svg { position:absolute; right:12px; bottom:12px; width:24px; height:24px; color:#6f91b4; }
        .mobile-quick-card.balance { grid-column:1 / -1; border-color:rgba(56,189,248,.55); }
        .mobile-quick-card.income { border-color:rgba(74,222,128,.5); }
        .mobile-quick-card.expense { border-color:rgba(251,113,133,.5); }
        .mobile-quick-card.income strong { color:#4ade80; }
        .mobile-quick-card.expense strong { color:#fb7185; }
        .mobile-quick-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:14px 0; }
        .mobile-quick-actions button { min-height:58px; border:0; border-radius:14px; font-size:15px; font-weight:900; display:flex; align-items:center; justify-content:center; gap:8px; }
        .mobile-quick-actions button:first-child { background:#153824; color:#4ade80; border:1px solid rgba(74,222,128,.55); }
        .mobile-quick-actions button:last-child { background:#3a1922; color:#fb7185; border:1px solid rgba(251,113,133,.55); }
        .mobile-quick-actions svg { width:22px; height:22px; }
        .mobile-recent { border:1px solid #29405c; border-radius:14px; background:#0d1c30; padding:14px; }
        .mobile-recent h3 { margin:0 0 12px; font-size:16px; }
        .mobile-recent-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; padding:10px 0; border-top:1px solid #21364e; }
        .mobile-recent-row:first-of-type { border-top:0; }
        .mobile-recent-row b { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .mobile-recent-row small { color:#8aa7c7; }
        .mobile-recent-row strong { align-self:center; white-space:nowrap; }
        .mobile-empty { color:#8aa7c7; text-align:center; padding:16px 0; }
        .mobile-quick-app .notice { margin:0 0 12px; }
        @media (max-width:390px) { .mobile-quick-kpis { grid-template-columns:1fr; } .mobile-quick-card.balance { grid-column:auto; } .mobile-quick-actions { grid-template-columns:1fr; } }
      `}</style>
      <div className="mobile-quick-head">
        <div className="mobile-quick-brand"><div><WalletCards /></div><div><b>Mis Finanzas</b><small>Vista rápida</small></div></div>
        <button className="mobile-full-button" type="button" onClick={() => setMobileQuickMode(false)}>Vista completa</button>
      </div>
      {notice && <div className="notice" onClick={() => setNotice('')}>{notice}</div>}
      <h1 className="mobile-quick-title">Resumen del mes</h1>
      <p className="mobile-quick-subtitle">{month}</p>
      <section className="mobile-quick-kpis">
        <article className="mobile-quick-card balance"><span>Saldo disponible</span><strong>{money(closingBalance)}</strong><WalletCards /></article>
        <article className="mobile-quick-card income"><span>Ingresos del mes</span><strong>{money(income)}</strong><ArrowUpCircle /></article>
        <article className="mobile-quick-card expense"><span>Egresos del mes</span><strong>{money(expenseWithoutSavings)}</strong><ArrowDownCircle /></article>
      </section>
      <section className="mobile-quick-actions">
        <button type="button" onClick={() => openNew('income')}><ArrowUpCircle /> Registrar ingreso</button>
        <button type="button" onClick={() => openNew('expense')}><ArrowDownCircle /> Registrar egreso</button>
      </section>
      <section className="mobile-recent">
        <h3>Últimos movimientos</h3>
        {recentMobileMovements.map(item => <div className="mobile-recent-row" key={item.id}>
          <div><b>{item.description || 'Sin concepto'}</b><small>{item.date?.split('-').reverse().join('/')} · {item.categories?.name || (item.type === 'income' ? 'Ingreso' : 'Egreso')}</small></div>
          <strong className={item.type === 'income' ? 'positive' : 'negative'}>{item.type === 'income' ? '+' : '-'}{money(item.amount)}</strong>
        </div>)}
        {!recentMobileMovements.length && <div className="mobile-empty">Todavía no existen movimientos.</div>}
      </section>
      {modal && <MovementModal
        open={modal}
        type={newType}
        accounts={accounts}
        categories={categories}
        movement={editing}
        onClose={() => { setModal(false); setEditing(null) }}
        onSave={save}
      />}
    </div>
  }

  return <div className={`app theme-${theme} background-${backgroundTheme}`}>
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
      .goal-card { position:relative; padding:18px !important; border-top:3px solid #38bdf8; box-shadow:0 12px 28px rgba(0,0,0,.16); }
      .goal-card.completed { border-top-color:#4ade80; }
      .goal-card header { grid-template-columns:minmax(0,1fr) auto !important; align-items:flex-start !important; padding-bottom:14px; border-bottom:1px solid #203852; }
      .goal-card-main { min-width:0; }
      .goal-title-line { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .goal-title-line h3 { font-size:19px; margin:0; text-align:left; }
      .goal-priority { display:inline-flex; align-items:center; min-height:25px; padding:4px 9px; border:1px solid #345372; border-radius:999px; background:#132941; color:#a8c7e7; font-size:11px; font-weight:800; white-space:nowrap; }
      .goal-target { display:flex; align-items:baseline; gap:8px; margin-top:8px; color:#8aa7c7; }
      .goal-target strong { color:#fff; font-size:16px; }
      .goal-progress-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:14px; color:#9fb3c8; font-size:12px; }
      .goal-progress-head strong { color:#fff; }
      .goal-progress { height:12px !important; margin:7px 0 14px !important; }
      .goal-stat-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
      .goal-stat-grid > div { display:flex; flex-direction:column; gap:5px; min-width:0; padding:10px; border:1px solid #263f5b; border-radius:10px; background:#0a192b; }
      .goal-stat-grid span { color:#7897b7; font-size:11px; }
      .goal-stat-grid b { color:#fff; font-size:13px; overflow-wrap:anywhere; }
      .goal-actions {
        position:absolute;
        top:16px;
        right:16px;
        z-index:3;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:4px;
        width:34px;
      }
      .goal-actions button {
        width:32px !important;
        height:32px !important;
        min-width:32px !important;
        padding:0 !important;
        border-radius:8px;
        display:flex !important;
        align-items:center;
        justify-content:center;
      }
      .goal-actions button svg { width:17px !important; height:17px !important; }
      .goal-card { padding:18px 66px 18px 18px !important; }
      .goal-card header {
        display:block !important;
        min-height:76px;
        padding-right:4px;
        overflow:visible;
      }
      .goal-card-main { width:100%; min-width:0; overflow:visible; }
      .goal-title-line {
        display:flex;
        align-items:flex-start;
        justify-content:flex-start;
        gap:8px;
        flex-wrap:wrap;
        padding-right:2px;
      }
      .goal-title-line h3 {
        flex:1 1 180px;
        min-width:0;
        max-width:100%;
        white-space:normal !important;
        overflow:visible !important;
        text-overflow:clip !important;
        word-break:break-word;
        overflow-wrap:anywhere;
      }
      .goal-priority { flex:0 0 auto; }
      .goal-target {
        display:grid;
        grid-template-columns:auto minmax(0,1fr);
        align-items:baseline;
        gap:8px;
        margin-top:9px;
        min-width:0;
      }
      .goal-target strong {
        min-width:0;
        white-space:normal;
        overflow-wrap:anywhere;
      }
      .goal-progress-head, .goal-progress, .goal-stat-grid { margin-right:-48px; }
      @media (max-width:1000px) { .goal-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:650px) {
        .goal-grid { grid-template-columns:1fr; }
        .goal-stat-grid{grid-template-columns:1fr;}
        .goal-card { padding:16px 58px 16px 16px !important; }
        .goal-actions { top:14px; right:14px; }
        .goal-progress-head, .goal-progress, .goal-stat-grid { margin-right:-42px; }
      }
      .savings-account-form { display:grid !important; grid-template-columns:repeat(6,minmax(135px,1fr)); gap:12px !important; width:100%; }
      .savings-account-form .grow { grid-column:span 2; }
      .savings-account-form button { min-height:42px; }
      .savings-account-note { display:block; margin-top:12px; color:#8fb0d3; line-height:1.5; }
      @media (max-width:1100px) { .savings-account-form { grid-template-columns:repeat(3,minmax(0,1fr)); } .savings-account-form .grow { grid-column:span 2; } }
      @media (max-width:700px) { .savings-account-form { grid-template-columns:1fr !important; } .savings-account-form .grow { grid-column:auto; } }
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

      .account-dashboard { display:grid; gap:14px; margin-bottom:18px; }
      .account-dashboard-header h2 { margin:0 0 4px; font-size:22px; }
      .account-dashboard-header p { margin:0; color:#8aa7c7; }
      .account-dashboard-kpis { grid-template-columns:repeat(4,minmax(0,1fr)) !important; }

      /* Alineación uniforme de ayuda e iconos en todas las cards KPI */
      .kpi-info-card {
        position:relative !important;
        padding:18px 62px 18px 18px !important;
        overflow:visible !important;
      }
      .kpi-info-card .kpi-help {
        top:16px !important;
        right:18px !important;
        left:auto !important;
        bottom:auto !important;
      }
      .kpi-info-card .kpi-card-icon {
        right:18px !important;
        bottom:16px !important;
        top:auto !important;
        left:auto !important;
      }
      .kpi-info-card > strong,
      .kpi-info-card > small,
      .kpi-info-card .kpi-info-head {
        max-width:calc(100% - 4px);
        overflow-wrap:anywhere;
      }
      .account-dashboard-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; }
      .account-dashboard-chart { min-width:0; }
      .account-chart-body { display:grid; grid-template-columns:minmax(230px,.8fr) minmax(260px,1.2fr); align-items:center; gap:12px; }
      .account-pie-chart { height:250px !important; }
      .account-bar-chart { height:270px !important; }
      .account-balance-legend { display:grid; gap:8px; min-width:0; }
      .account-legend-row { display:grid; grid-template-columns:12px minmax(90px,1fr) auto 54px; align-items:center; gap:9px; padding:9px 10px; border-bottom:1px dashed #29405c; }
      .account-legend-row:last-child { border-bottom:0; }
      .legend-dot { width:10px; height:10px; border-radius:50%; }
      .account-legend-row b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .account-legend-row strong { color:#eaf4ff; }
      .account-legend-row small { text-align:right; color:#8aa7c7; }
      .account-transfer-table-wrap { overflow-x:auto; }
      .account-transfer-history table { width:100%; min-width:760px; }
      @media (max-width:1200px) { .account-dashboard-kpis { grid-template-columns:repeat(2,minmax(0,1fr)) !important; } .account-dashboard-grid { grid-template-columns:1fr; } }
      @media (max-width:700px) { .account-dashboard-kpis { grid-template-columns:1fr !important; } .account-chart-body { grid-template-columns:1fr; } .account-pie-chart,.account-bar-chart { height:230px !important; } }

      .app-shell { display:flex; min-height:calc(100vh - 76px); width:100%; }
      .side-nav { width:280px; flex:0 0 280px; border-right:1px solid #29405c; background:#091729; padding:14px 10px; transition:width .22s ease, flex-basis .22s ease, padding .22s ease; overflow:hidden; }
      .side-nav.collapsed { width:74px; flex-basis:74px; padding-inline:8px; }
      .side-nav-top { display:flex; justify-content:flex-end; margin-bottom:10px; }
      .side-toggle { width:42px; min-width:42px; height:42px; padding:0 !important; display:flex; align-items:center; justify-content:center; }
      .side-menu { display:flex; flex-direction:column; gap:7px; }
      .side-menu button { width:100%; min-height:44px; display:flex; align-items:center; gap:12px; justify-content:flex-start; border:1px solid transparent; background:transparent; color:#9fb3c8; border-radius:10px; padding:10px 12px; cursor:pointer; white-space:nowrap; }
      .side-menu button svg { width:19px; height:19px; flex:0 0 19px; }
      .side-menu button:hover { background:#10243c; color:#fff; }
      .side-menu button.active { background:#183652; color:#fff; border-color:#38bdf8; }
      .side-menu .monthly-group { border-top:1px solid #29405c; margin-top:7px; padding-top:10px; }
      .monthly-toggle { justify-content:space-between !important; }
      .monthly-toggle .monthly-label { display:flex; align-items:center; gap:12px; min-width:0; }
      .monthly-toggle .chevron { margin-left:auto; transition:transform .2s ease; }
      .monthly-toggle.open .chevron { transform:rotate(180deg); }
      .monthly-items { display:flex; flex-direction:column; gap:5px; margin-top:5px; padding-left:10px; }
      .monthly-items button { padding-left:16px; }
      .side-nav.collapsed .nav-label, .side-nav.collapsed .chevron { display:none; }
      .side-nav.collapsed .side-menu button { justify-content:center; padding-inline:10px; }
      .side-nav.collapsed .monthly-items { padding-left:0; }
      .app-content { flex:1; min-width:0; }
      .chart-title-row { display:flex; align-items:center; gap:8px; }
      .chart-title-row h3 { margin:0; }
      .chart-help { position:relative; display:inline-flex; align-items:center; justify-content:center; color:#8fb0d3; cursor:help; outline:none; border:0; background:transparent; padding:0; min-width:20px; overflow:visible; }
      .chart-help > svg { width:18px; height:18px; }
      .chart-help-tooltip { position:absolute; z-index:1000; left:50%; top:calc(100% + 10px); transform:translateX(-50%); width:min(330px,72vw); padding:12px 14px; border-radius:10px; border:1px solid #3a5878; background:#071524; color:#e8f2ff; font-size:12px; line-height:1.5; box-shadow:0 12px 35px rgba(0,0,0,.45); opacity:0; visibility:hidden; pointer-events:none; transition:opacity .15s ease, visibility .15s ease; }
      .chart-help:hover .chart-help-tooltip { opacity:1; visibility:visible; }
      .home-grid .panel, .home-grid .panel-title, .chart-title-row { overflow:visible !important; }
      .chart-help-tooltip::before { content:''; position:absolute; top:-6px; left:50%; width:10px; height:10px; background:#071524; border-left:1px solid #3a5878; border-top:1px solid #3a5878; transform:translateX(-50%) rotate(45deg); }

      /* Tooltips de Recharts: mismo fondo de la app y contraste alto en toda la aplicación */
      .recharts-tooltip-wrapper { z-index:99999 !important; outline:none !important; }
      .recharts-default-tooltip {
        background:#071524 !important;
        border:1px solid #365b7d !important;
        border-radius:10px !important;
        box-shadow:0 12px 30px rgba(0,0,0,.42) !important;
        color:#f8fbff !important;
        padding:10px 12px !important;
      }
      .recharts-tooltip-label { color:#f8fbff !important; font-weight:800 !important; margin-bottom:6px !important; }
      .recharts-tooltip-item,
      .recharts-tooltip-item-name,
      .recharts-tooltip-item-value,
      .recharts-tooltip-item-separator { color:#f8fbff !important; font-weight:650 !important; }
      .recharts-tooltip-cursor { fill:rgba(56,189,248,.08) !important; stroke:rgba(143,176,211,.55) !important; }
      @media (max-width:850px) { .side-nav { position:fixed; left:0; top:76px; bottom:0; z-index:9990; box-shadow:12px 0 30px rgba(0,0,0,.35); } .side-nav.collapsed { width:68px; flex-basis:68px; } .app-shell { padding-left:68px; } }

      /* Encabezado alineado a los extremos y controles con estilo de la app */
      .app > header { width:100%; max-width:none !important; margin:0 !important; padding:10px 82px 10px 18px !important; display:flex !important; justify-content:space-between !important; align-items:center !important; gap:18px; }
      .app > header .brand { margin:0 !important; flex:0 0 auto; }
      .app > header .header-actions { margin-left:auto !important; padding-right:0 !important; display:flex; align-items:center; gap:8px; }
      .app input, .app select, .app textarea { background:#0b1b2f !important; color:#eaf4ff !important; border:1px solid #294866 !important; border-radius:9px !important; outline:none; min-height:40px; padding:8px 12px; }
      .app input:focus, .app select:focus, .app textarea:focus { border-color:var(--accent,#38bdf8) !important; box-shadow:0 0 0 3px color-mix(in srgb, var(--accent,#38bdf8) 18%, transparent); }
      .app select option { background:#0b1b2f; color:#eaf4ff; }
      .app input[type="month"], .app input[type="date"] { color-scheme:dark; min-width:165px; }
      .app input[type="month"]::-webkit-calendar-picker-indicator, .app input[type="date"]::-webkit-calendar-picker-indicator { filter:invert(88%) sepia(12%) saturate(540%) hue-rotate(170deg); cursor:pointer; }
      .theme-section { display:grid; gap:18px; margin:0 0 24px; padding:18px; border:1px solid #29405c; border-radius:14px; background:#0c1b2f; }
      .theme-block h4 { margin:0 0 6px; }
      .theme-block p { margin:0 0 12px; color:#8aa7c7; font-size:13px; }
      .background-picker { display:grid; grid-template-columns:repeat(5,minmax(86px,1fr)); gap:10px; }
      .background-option { min-height:62px; border-radius:12px !important; border:2px solid transparent !important; position:relative; overflow:hidden; }
      .background-option.active { border-color:#fff !important; box-shadow:0 0 0 3px rgba(56,189,248,.25); }
      .background-option span { position:absolute; left:8px; bottom:6px; font-size:11px; font-weight:800; color:#fff; text-shadow:0 1px 3px #000; }
      .background-navy-btn { background:#071524 !important; }
      .background-slate-btn { background:#111827 !important; }
      .background-black-btn { background:#030712 !important; }
      .background-blue-btn { background:#082f49 !important; }
      .background-plum-btn { background:#24143d !important; }
      .background-navy, .background-navy .app-shell, .background-navy .app-content, .background-navy main { background:#071524 !important; }
      .background-slate, .background-slate .app-shell, .background-slate .app-content, .background-slate main { background:#111827 !important; }
      .background-black, .background-black .app-shell, .background-black .app-content, .background-black main { background:#030712 !important; }
      .background-blue, .background-blue .app-shell, .background-blue .app-content, .background-blue main { background:#082f49 !important; }
      .background-plum, .background-plum .app-shell, .background-plum .app-content, .background-plum main { background:#24143d !important; }
      @media (max-width:700px) { .app > header { padding-right:66px !important; padding-left:10px !important; } .background-picker { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      .accounts-page-heading { margin:0 0 14px; }
      .accounts-page-heading h1 { margin:0 0 4px; }
      .accounts-page-heading p { margin:0; color:#8aa7c7; }
      .account-summary-kpis { grid-template-columns:repeat(3,minmax(0,1fr)) !important; margin-bottom:14px; }
      .accounts-management-page { display:grid; gap:16px; }
      .accounts-management-page .control-subpanel { margin:0; }
      @media (max-width:900px) { .account-summary-kpis { grid-template-columns:1fr !important; } }
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
      .mobile-quick-return { display:none !important; }
      .mobile-quick-floating-return { display:none; }
      @media (max-width:760px) {
        .mobile-quick-return { display:inline-flex !important; }
        .mobile-quick-floating-return {
          position:fixed;
          right:14px;
          bottom:16px;
          z-index:99998;
          min-height:48px;
          padding:0 16px !important;
          border-radius:999px !important;
          border:1px solid #79d8ff !important;
          background:#38bdf8 !important;
          color:#06111f !important;
          font-weight:900;
          display:inline-flex !important;
          align-items:center;
          justify-content:center;
          gap:8px;
          box-shadow:0 12px 30px rgba(0,0,0,.45),0 0 0 4px rgba(56,189,248,.16);
        }
        .mobile-quick-floating-return svg { width:20px; height:20px; }
      }
      /* Sistema unificado de ayuda e iconos */
      .kpi-info-card, .kpis article { position:relative !important; overflow:visible !important; padding:18px 52px 18px 18px !important; min-height:116px; }
      .kpi-info-head { display:block !important; padding-right:0 !important; min-height:auto !important; }
      .kpi-help, .card-help { position:absolute !important; top:12px !important; right:12px !important; z-index:80 !important; width:22px !important; height:22px !important; min-width:22px !important; padding:0 !important; border:1px solid #54789d !important; border-radius:50% !important; background:#102844 !important; color:#b9d6f2 !important; display:flex !important; align-items:center !important; justify-content:center !important; cursor:help !important; box-shadow:none !important; }
      .kpi-help > svg, .card-help > svg { width:14px !important; height:14px !important; flex:0 0 14px !important; }
      .kpi-card-icon { position:absolute !important; right:16px !important; bottom:14px !important; top:auto !important; width:28px !important; height:28px !important; display:flex !important; align-items:center !important; justify-content:center !important; color:#6f91b4 !important; opacity:.95; pointer-events:none; }
      .kpi-card-icon > svg { width:25px !important; height:25px !important; }
      .kpis article > svg { position:absolute !important; right:16px !important; bottom:14px !important; top:auto !important; width:25px !important; height:25px !important; color:#6f91b4 !important; opacity:.95; pointer-events:none; }
      .kpi-info-card.positive { border-color:rgba(74,222,128,.48) !important; }
      .kpi-info-card.negative { border-color:rgba(251,113,133,.48) !important; }
      .home-kpis .kpi-info-card:nth-child(1){border-color:rgba(74,222,128,.55)!important;background:linear-gradient(145deg,rgba(74,222,128,.055),rgba(13,28,48,.96))}
      .home-kpis .kpi-info-card:nth-child(2){border-color:rgba(251,113,133,.55)!important;background:linear-gradient(145deg,rgba(251,113,133,.055),rgba(13,28,48,.96))}
      .home-kpis .kpi-info-card:nth-child(3){border-color:rgba(56,189,248,.55)!important;background:linear-gradient(145deg,rgba(56,189,248,.055),rgba(13,28,48,.96))}
      .home-kpis .kpi-info-card:nth-child(4){border-color:rgba(167,139,250,.55)!important;background:linear-gradient(145deg,rgba(167,139,250,.055),rgba(13,28,48,.96))}
      .home-kpis .kpi-info-card:nth-child(5){border-color:rgba(245,158,11,.55)!important;background:linear-gradient(145deg,rgba(245,158,11,.055),rgba(13,28,48,.96))}
      .kpi-help-tooltip, .card-help-tooltip { position:absolute !important; z-index:999999 !important; top:calc(100% + 9px) !important; right:0 !important; left:auto !important; transform:none !important; width:min(320px,76vw) !important; padding:12px 14px !important; border:1px solid #426486 !important; border-radius:11px !important; background:#071524 !important; color:#eef7ff !important; font-size:12px !important; font-weight:500 !important; line-height:1.5 !important; text-align:left !important; white-space:normal !important; box-shadow:0 16px 42px rgba(0,0,0,.62) !important; opacity:0 !important; visibility:hidden !important; pointer-events:none !important; transition:opacity .15s ease,visibility .15s ease,transform .15s ease !important; }
      .kpi-help:hover .kpi-help-tooltip, .card-help:hover .card-help-tooltip { opacity:1 !important; visibility:visible !important; }
      .kpi-help:focus .kpi-help-tooltip, .card-help:focus .card-help-tooltip, .kpi-help:focus-visible .kpi-help-tooltip, .card-help:focus-visible .card-help-tooltip { opacity:0 !important; visibility:hidden !important; }
      article[data-help]::before, article[data-help]::after { display:none !important; content:none !important; }
      .chart-help-tooltip { right:auto; left:50%; }
      .chart-help:focus .chart-help-tooltip, .chart-help:focus-visible .chart-help-tooltip { opacity:0 !important; visibility:hidden !important; }
      .panel > .card-help { top:14px !important; right:14px !important; }
      .panel-title:has(.chart-help) { padding-right:0 !important; }

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

    <style>{`
      .theme-blue { --accent:#38bdf8; --accent-soft:#183652; }
      .theme-green { --accent:#4ade80; --accent-soft:#153d31; }
      .theme-purple { --accent:#a78bfa; --accent-soft:#302452; }
      .theme-orange { --accent:#f59e0b; --accent-soft:#4a3212; }
      .theme-gray { --accent:#94a3b8; --accent-soft:#273244; }
      .side-menu button.active, .monthly-toggle.open { border-color:var(--accent)!important; color:#fff!important; background:var(--accent-soft)!important; }
      .floating-settings-button.active, .header-icon.active { background:var(--accent)!important; }
      .header-icon { width:42px;height:42px;padding:0;border-radius:12px;display:grid;place-items:center;position:relative; }
      .filter-dot { position:absolute;right:6px;top:6px;width:8px;height:8px;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 2px #09172a; }
      .drawer-actions { display:flex;justify-content:space-between;gap:10px;margin-top:22px;padding-top:18px;border-top:1px solid #29405c; }
      .drawer-actions button { flex:1;justify-content:center; }
      .overlay-panel { position:fixed;inset:0;background:#020817aa;z-index:100001;display:flex;justify-content:flex-end; }
      .drawer { width:min(430px,94vw);height:100%;background:#09172a;border-left:1px solid #29405c;padding:22px;overflow:auto;box-shadow:-20px 0 60px #0008; }
      .drawer-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:20px; }
      .drawer-head button { padding:7px; }
      .filter-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
      .filter-grid label { display:flex;flex-direction:column;gap:6px;font-size:12px;color:#8aa7c7; }
      .filter-grid .full { grid-column:1/-1; }
      .notification-item { border:1px solid #29405c;border-radius:12px;padding:13px;margin-bottom:10px;background:#0d1c30; }
      .notification-item.warning { border-left:4px solid #f59e0b; }.notification-item.danger{border-left:4px solid #fb7185}.notification-item.success{border-left:4px solid #4ade80}.notification-item.info{border-left:4px solid #38bdf8}
      .home-hero { display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:16px; }
      .quick-actions { display:flex;gap:10px;flex-wrap:wrap; }
      .home-grid { display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px; }
      .home-grid>.panel { grid-column:span 6;min-width:0; }.home-grid>.wide{grid-column:1/-1}.home-grid>.third{grid-column:span 4}
      .prediction-card strong { font-size:28px;display:block;margin:8px 0; }
      .calendar-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:6px; }
      .calendar-head { text-align:center;color:#8aa7c7;font-size:12px;padding:6px; }
      .calendar-day { min-height:88px;border:1px solid #29405c;border-radius:10px;padding:7px;background:#0d1c30;font-size:12px; }
      .calendar-day.empty{visibility:hidden}.calendar-day b{display:block;margin-bottom:5px}.calendar-value{display:block;font-size:10px;margin-top:3px}.calendar-value.income{color:#4ade80}.calendar-value.expense{color:#fb7185}.calendar-value.savings{color:#38bdf8}
      .sankey-flow { display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:12px;min-height:210px; }
      .flow-node { border:1px solid #29405c;border-radius:14px;padding:18px;background:#0d1c30;text-align:center; }.flow-node strong{font-size:22px;display:block;margin-top:8px}.flow-arrow{font-size:30px;color:var(--accent)}
      .comparison-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:12px; }.comparison-card{border:1px solid #29405c;border-radius:12px;padding:14px;background:#0d1c30}.comparison-card strong{font-size:20px;display:block;margin:7px 0}
      .category-panel-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px; }.category-panel-card{border:1px solid #29405c;border-radius:12px;padding:14px;background:#0d1c30;overflow:hidden;position:relative}.category-panel-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--card-color,var(--accent))}.category-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0}.category-panel-head b{overflow-wrap:anywhere}.category-panel-head strong{white-space:nowrap;color:var(--card-color,var(--accent))}.category-progress{height:8px;background:#17283d;border-radius:99px;overflow:hidden;margin-top:10px}.category-progress div{height:100%;background:var(--card-color,var(--accent))}.category-color-0{--card-color:#38bdf8}.category-color-1{--card-color:#4ade80}.category-color-2{--card-color:#f59e0b}.category-color-3{--card-color:#fb7185}.category-color-4{--card-color:#a78bfa}.category-color-5{--card-color:#22d3ee}
      .theme-picker { display:grid;grid-template-columns:repeat(5,1fr);gap:10px; }.theme-option{height:54px;border-radius:12px;border:2px solid transparent}.theme-option.active{border-color:#fff;transform:scale(1.04)}.theme-blue-btn{background:#38bdf8}.theme-green-btn{background:#4ade80}.theme-purple-btn{background:#a78bfa}.theme-orange-btn{background:#f59e0b}.theme-gray-btn{background:#94a3b8}
      .shortcut-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.shortcut{display:flex;align-items:center;justify-content:space-between;border:1px solid #29405c;border-radius:10px;padding:10px}.shortcut kbd{background:#17283d;border:1px solid #3a526e;border-radius:6px;padding:4px 8px}
      .entry-grid .entry-card { min-width:0; }
      .entry-card .category-form { display:grid !important;grid-template-columns:minmax(150px,.9fr) minmax(150px,.9fr) minmax(170px,1fr) minmax(220px,1.4fr) auto;gap:10px;align-items:end;width:100%; }
      .entry-card .category-form label { min-width:0; }
      .entry-card .category-form input,.entry-card .category-form select { width:100%;min-width:0; }
      .entry-card .category-form button { white-space:normal;min-height:42px;justify-content:center; }
      .home-grid>.panel:nth-child(1){border-top:3px solid #38bdf8}.home-grid>.panel:nth-child(2){border-top:3px solid #4ade80}.home-grid>.panel:nth-child(3){border-top:3px solid #f59e0b}.home-grid>.panel:nth-child(4){border-top:3px solid #a78bfa}.home-grid>.panel:nth-child(5){border-top:3px solid #fb7185}.home-grid>.panel:nth-child(6){border-top:3px solid #22d3ee}

      .home-kpis { overflow:visible !important; position:relative; z-index:20; }
      .home-kpis .kpi-info-card { position:relative; overflow:visible !important; isolation:visible; }
      .kpi-info-head { display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; }
      .kpi-info-head > span { min-width:0; }
      .kpi-help { position:relative; z-index:40; width:24px; height:24px; min-width:24px; padding:0 !important; border:0 !important; border-radius:50%; display:grid; place-items:center; background:#17304c !important; color:#a9c7e8 !important; cursor:help; overflow:visible !important; }
      .kpi-help:hover, .kpi-help:focus-visible { background:#38bdf8 !important; color:#06111f !important; outline:none; }
      .kpi-help svg { width:16px; height:16px; }
      .kpi-help-tooltip { position:absolute; z-index:999999; top:calc(100% + 10px); right:0; width:min(310px,75vw); padding:12px 14px; border:1px solid #3e6288; border-radius:11px; background:#061525; color:#eef7ff; font-size:12px; line-height:1.5; text-align:left; font-weight:500; box-shadow:0 16px 40px rgba(0,0,0,.55); opacity:0; visibility:hidden; transform:translateY(-4px); pointer-events:none; transition:.15s ease; white-space:normal; }
      .kpi-help:hover .kpi-help-tooltip, .kpi-help:focus .kpi-help-tooltip, .kpi-help:focus-visible .kpi-help-tooltip { opacity:1; visibility:visible; transform:translateY(0); }
      .kpi-help-tooltip::before { content:''; position:absolute; top:-6px; right:7px; width:10px; height:10px; background:#061525; border-left:1px solid #3e6288; border-top:1px solid #3e6288; transform:rotate(45deg); }
      .kpi-card-icon { position:absolute; right:14px; bottom:14px; color:#6f8eaf; opacity:.8; }
      .kpi-card-icon svg { width:22px; height:22px; }
      .savings-entry-section { display:block !important; width:100% !important; }
      .savings-entry-card { width:100% !important; max-width:none !important; min-width:0 !important; }
      .savings-entry-card .category-form { grid-template-columns:minmax(170px,.9fr) minmax(170px,.9fr) minmax(180px,1fr) minmax(240px,1.5fr) minmax(170px,auto) !important; width:100% !important; }
      .savings-entry-card .category-form button { width:100%; min-width:170px; }
      /* Ayuda unificada para todas las tarjetas y gráficos */
      .kpi-info-card { position:relative !important; overflow:visible !important; padding-top:18px !important; }
      .kpi-info-head { position:relative; padding-right:34px; min-height:24px; }
      .kpi-help { position:absolute !important; top:0 !important; right:0 !important; width:22px !important; height:22px !important; min-width:22px !important; border:1px solid #52779d !important; background:#102844 !important; color:#b9d6f2 !important; border-radius:50% !important; padding:0 !important; display:flex !important; align-items:center !important; justify-content:center !important; line-height:1 !important; overflow:visible !important; }
      .kpi-help > svg { position:static !important; inset:auto !important; transform:none !important; margin:0 !important; width:14px !important; height:14px !important; opacity:1 !important; }
      .chart-help { width:22px !important; height:22px !important; min-width:22px !important; border:1px solid #52779d !important; background:#102844 !important; border-radius:50% !important; }
      .chart-help > svg { position:static !important; transform:none !important; width:14px !important; height:14px !important; }
      .chart-help-tooltip,.kpi-help-tooltip { background:#071524 !important; color:#eef7ff !important; border:1px solid #426486 !important; box-shadow:0 16px 42px rgba(0,0,0,.62) !important; }
      article[data-help] { position:relative !important; overflow:visible !important; }
      article[data-help]::before { content:'?'; position:absolute; top:12px; right:12px; z-index:45; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border:1px solid #52779d; border-radius:50%; background:#102844; color:#b9d6f2; font-size:13px; font-weight:800; line-height:1; cursor:help; }
      article[data-help]::after { content:attr(data-help); position:absolute; top:42px; right:12px; z-index:999999; width:min(320px,76vw); padding:12px 14px; border:1px solid #426486; border-radius:11px; background:#071524; color:#eef7ff; font-size:12px; font-weight:500; line-height:1.5; text-align:left; white-space:normal; box-shadow:0 16px 42px rgba(0,0,0,.62); opacity:0; visibility:hidden; transform:translateY(-4px); pointer-events:none; transition:opacity .15s ease,visibility .15s ease,transform .15s ease; }
      article[data-help]:hover::after, article[data-help]:focus-within::after { opacity:1; visibility:visible; transform:translateY(0); }
      article[data-help] > span:first-child, article[data-help] .panel-title { padding-right:30px; }
      /* Evita el tooltip blanco nativo en elementos de ayuda */
      .chart-help[title],.kpi-help[title],article[data-help][title] { pointer-events:auto; }
      @media(max-width:1350px){.savings-entry-card .category-form{grid-template-columns:repeat(2,minmax(0,1fr)) !important}.savings-entry-card .category-form button{grid-column:1/-1;min-width:0}}
      @media(max-width:700px){.savings-entry-card .category-form{grid-template-columns:1fr !important}.savings-entry-card .category-form button{grid-column:1}}
      /* Corrección puntual: tooltips de las tarjetas del Dashboard por encima de todo */
      .kpis,
      .home-summary-cards,
      .app-content,
      .monthly-view,
      .standalone-view { overflow:visible !important; }
      .kpis article,
      .home-summary-cards .kpi-info-card { z-index:1; }
      .kpis article:hover,
      .home-summary-cards .kpi-info-card:hover { z-index:10000 !important; }
      .kpi-help,
      .card-help { z-index:10001 !important; }
      .kpi-help-tooltip,
      .card-help-tooltip {
        z-index:10002 !important;
        max-width:min(320px,calc(100vw - 390px)) !important;
      }
      .kpis article:first-child .kpi-help-tooltip,
      .home-summary-cards .kpi-info-card:first-child .kpi-help-tooltip {
        left:0 !important;
        right:auto !important;
      }

      .notification-toolbar{display:flex;justify-content:flex-end;margin:-6px 0 14px}.notification-toolbar button{font-size:12px}.notification-item{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.notification-item.read{opacity:.62}.notification-copy{min-width:0}.notification-copy small{display:block;color:#7ea0c5;text-transform:uppercase;font-size:10px;letter-spacing:.06em;margin-bottom:3px}.notification-copy p{margin:5px 0 0;line-height:1.45}.notification-actions{display:flex;gap:4px}.notification-actions button{width:30px;height:30px;padding:5px}
      .unusual-expenses-panel{margin-bottom:16px}.unusual-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px}.unusual-card{border:1px solid #553647;border-left:4px solid #fb7185;border-radius:12px;padding:14px;background:#0d1c30;display:grid;gap:8px}.unusual-card>div{display:flex;flex-direction:column}.unusual-card small{color:#88a5c5;margin-top:4px}.unusual-card strong{color:#fb7185;font-size:20px}.unusual-card p{margin:0;color:#bdcbe0;font-size:12px;line-height:1.4}
      .commitments-view{overflow:visible}.commitment-form,.credit-form{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;align-items:end;border:1px solid #29405c;border-radius:14px;padding:16px;background:#0b192b;margin-bottom:16px}.credit-form{grid-template-columns:repeat(4,minmax(0,1fr))}.commitment-form label,.credit-form label{display:flex;flex-direction:column;gap:7px;color:#8fb0d3;font-size:12px;min-width:0}.commitment-form input,.commitment-form select,.credit-form input,.credit-form select{width:100%;min-width:0}.commitment-form button,.credit-form button{min-height:44px;justify-content:center}.commitment-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:16px;overflow:visible}.commitment-list{display:grid;gap:10px}.commitment-card{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:16px;border:1px solid #29405c;border-radius:12px;padding:14px;background:#0d1c30}.commitment-card.disabled{opacity:.55}.commitment-card>div:first-child{display:flex;flex-direction:column;gap:4px}.commitment-card small{color:#88a5c5}.commitment-card strong{font-size:20px;white-space:nowrap}.credit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}.credit-card-item{border:1px solid #29405c;border-top:3px solid var(--accent);border-radius:14px;padding:16px;background:#0d1c30}.credit-card-item header{display:flex;justify-content:space-between;gap:10px}.credit-card-item header>div{display:flex;flex-direction:column;gap:4px}.credit-card-item header small{color:#88a5c5}.credit-card-item>strong{display:block;font-size:24px;margin:16px 0 10px}.credit-card-item>strong small{font-size:12px;color:#8aa7c7}.credit-card-item p{color:#9bb2cc;font-size:12px}.credit-card-item footer{display:flex;justify-content:space-between;align-items:center;margin-top:12px}.credit-card-item footer button{width:36px;height:36px;padding:0;justify-content:center}.undo-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:300000;display:flex;align-items:center;gap:18px;background:#071524;border:1px solid #426486;border-radius:12px;padding:12px 14px;box-shadow:0 18px 50px #0009;color:#eef7ff}.undo-toast button{white-space:nowrap}

      @media(max-width:1250px){.commitment-form{grid-template-columns:repeat(3,minmax(0,1fr))}.credit-form{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:760px){header{padding:10px 12px}.brand small{display:none}.header-actions{gap:6px}.header-actions .secondary,.header-actions>button:not(.header-icon):not(.mobile-quick-return){padding:9px}.header-actions .secondary{font-size:0}.header-actions .secondary svg{margin:0}.layout{display:block}.sidebar{position:fixed;left:0;top:72px;bottom:0;z-index:120000;width:min(86vw,310px);transform:translateX(-105%);transition:transform .2s}.sidebar.open{transform:translateX(0)}.main{padding:14px 10px 92px}.home-summary-cards,.kpis{grid-template-columns:1fr!important}.home-dashboard-grid{grid-template-columns:1fr}.commitment-form,.credit-form{grid-template-columns:1fr}.commitment-summary{grid-template-columns:1fr}.commitment-card{grid-template-columns:1fr auto}.commitment-card .row-actions{grid-column:1/-1;justify-content:flex-end}.credit-grid{grid-template-columns:1fr}.table-wrap{overflow-x:auto}.panel{border-radius:13px}.undo-toast{left:10px;right:10px;bottom:76px;transform:none;justify-content:space-between}.drawer{width:100vw}.floating-settings-button{bottom:14px;right:14px}.home-category-chart{grid-template-columns:1fr}.calendar-grid{min-width:620px}.calendar-view{overflow-x:auto}}

      @media(max-width:1250px){.entry-card .category-form{grid-template-columns:repeat(2,minmax(0,1fr))}.entry-card .category-form button{grid-column:1/-1}}
      @media(max-width:900px){.home-grid>.panel,.home-grid>.third{grid-column:1/-1}.sankey-flow{grid-template-columns:1fr}.flow-arrow{transform:rotate(90deg)}.comparison-grid{grid-template-columns:1fr}.filter-grid{grid-template-columns:1fr}.filter-grid .full{grid-column:1}.calendar-day{min-height:70px}.home-hero{align-items:flex-start;flex-direction:column}}
    `}</style>
    <button className={`floating-settings-button ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')} title="Configuración" aria-label="Abrir configuración"><Settings /></button>
    <style>{`
      /* Vista Inicio profesional y corrección definitiva de iconos */
      .home-hero-clean{display:flex;align-items:flex-end;justify-content:space-between;margin:2px 0 18px;padding:0!important}
      .home-hero-clean h1{font-size:30px;margin:0 0 4px;color:#f6f9ff}
      .home-hero-clean p{margin:0;color:#91a9c4;font-size:14px}
      .home-summary-cards{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:14px!important;margin-bottom:16px!important;overflow:visible!important}
      .home-summary-cards .kpi-info-card{position:relative!important;min-height:168px!important;padding:22px 58px 22px 20px!important;border:1px solid #29405c!important;border-radius:15px!important;background:linear-gradient(145deg,#0d1d31,#0a1728)!important;overflow:visible!important;box-shadow:0 12px 28px rgba(0,0,0,.14)!important}
      .home-summary-cards .kpi-info-card:nth-child(1){border-color:rgba(74,222,128,.58)!important}
      .home-summary-cards .kpi-info-card:nth-child(2){border-color:rgba(251,113,133,.58)!important}
      .home-summary-cards .kpi-info-card:nth-child(3){border-color:rgba(56,189,248,.58)!important}
      .home-summary-cards .kpi-info-card:nth-child(4){border-color:rgba(167,139,250,.58)!important}
      .home-summary-cards .kpi-info-card:nth-child(5){border-color:rgba(245,158,11,.58)!important}
      .home-summary-cards .kpi-info-head{display:block!important;margin:0 0 18px!important;padding:0 28px 0 0!important;line-height:1.3!important}
      .home-summary-cards .kpi-info-head>span{font-size:14px!important;color:#c5d4e6!important}
      .home-summary-cards .kpi-info-card>strong{display:block!important;font-size:27px!important;line-height:1.12!important;margin:0 0 12px!important;letter-spacing:-.02em!important}
      .home-summary-cards .kpi-info-card>small{display:block!important;max-width:calc(100% - 42px)!important;color:#a9bad0!important;font-size:13px!important;line-height:1.45!important}

      /* El signo ? siempre arriba a la derecha y sólo responde al hover */
      .kpi-help,.card-help{position:absolute!important;top:14px!important;right:14px!important;bottom:auto!important;left:auto!important;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;padding:0!important;margin:0!important;border:1px solid #7896b7!important;border-radius:50%!important;background:#0c2037!important;color:#c9d9eb!important;display:flex!important;align-items:center!important;justify-content:center!important;line-height:1!important;z-index:200!important;box-shadow:none!important;transform:none!important;cursor:help!important}
      .kpi-help>svg,.card-help>svg{position:static!important;width:14px!important;height:14px!important;min-width:14px!important;min-height:14px!important;padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:inherit!important;box-shadow:none!important;transform:none!important;opacity:1!important}
      .kpi-help-tooltip,.card-help-tooltip{opacity:0!important;visibility:hidden!important;pointer-events:none!important;display:block!important}
      .kpi-help:hover .kpi-help-tooltip,.card-help:hover .card-help-tooltip{opacity:1!important;visibility:visible!important}
      .kpi-help:focus .kpi-help-tooltip,.kpi-help:focus-visible .kpi-help-tooltip,.card-help:focus .card-help-tooltip,.card-help:focus-visible .card-help-tooltip{opacity:0!important;visibility:hidden!important}

      /* Icono funcional de la card siempre abajo a la derecha */
      .home-summary-cards .kpi-card-icon{position:absolute!important;right:20px!important;bottom:18px!important;top:auto!important;left:auto!important;width:36px!important;height:36px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;opacity:1!important;transform:none!important;pointer-events:none!important;z-index:2!important}
      .home-summary-cards .kpi-card-icon>svg{position:static!important;width:32px!important;height:32px!important;padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;transform:none!important;opacity:1!important}
      .home-summary-cards .kpi-info-card:nth-child(1) .kpi-card-icon{color:#4ade80!important}
      .home-summary-cards .kpi-info-card:nth-child(2) .kpi-card-icon{color:#fb7185!important}
      .home-summary-cards .kpi-info-card:nth-child(3) .kpi-card-icon{color:#38bdf8!important}
      .home-summary-cards .kpi-info-card:nth-child(4) .kpi-card-icon{color:#a78bfa!important}
      .home-summary-cards .kpi-info-card:nth-child(5) .kpi-card-icon{color:#f59e0b!important}

      /* Corrección para todas las demás cards KPI */
      .kpis article{position:relative!important;padding-right:58px!important;overflow:visible!important}
      .kpis article>.card-help{top:14px!important;right:14px!important}
      .kpis article>svg{position:absolute!important;right:18px!important;bottom:16px!important;top:auto!important;left:auto!important;width:27px!important;height:27px!important;padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;transform:none!important;opacity:.95!important;pointer-events:none!important}

      .home-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:18px;margin-bottom:18px}
      .home-dashboard-grid>.panel{position:relative;min-width:0;border-radius:16px;background:linear-gradient(145deg,#0d1c30,#0a1728);border:1px solid #29405c;box-shadow:0 14px 32px rgba(0,0,0,.14);overflow:visible!important}
      .home-main-chart{height:330px!important}
      .home-category-chart{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(260px,1.2fr);gap:12px;align-items:center;min-height:330px}
      .home-donut-chart{height:290px!important}
      .home-category-legend{display:flex;flex-direction:column;gap:12px;padding-right:16px}
      .home-category-legend>div{display:grid;grid-template-columns:12px minmax(0,1fr) auto 48px;align-items:center;gap:10px;font-size:12px}
      .home-category-legend b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .home-category-legend strong{color:#f3f7fc}
      .home-category-legend small{text-align:right;color:#9fb3c8}
      .legend-dot{width:10px;height:10px;border-radius:50%}
      .panel-corner-icon{position:absolute;right:16px;bottom:14px;color:#38bdf8;opacity:.9;pointer-events:none}
      .panel-corner-icon svg{width:28px;height:28px}
      .category-corner{color:#a78bfa}.forecast-corner{color:#4ade80}
      .home-lower-panel{min-height:300px}
      .compact-action{padding:8px 12px!important;font-size:12px!important}
      .recent-movements-list{display:flex;flex-direction:column}
      .recent-movement{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid rgba(41,64,92,.7)}
      .recent-movement:last-child{border-bottom:0}
      .recent-movement>div{min-width:0}.recent-movement b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.recent-movement small{display:block;color:#8fa7c0;margin-top:3px}
      .movement-round-icon{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center}
      .movement-round-icon svg{width:20px;height:20px}.movement-round-icon.income{background:rgba(74,222,128,.15);color:#4ade80}.movement-round-icon.expense{background:rgba(251,113,133,.15);color:#fb7185}
      .prediction-layout{display:grid;grid-template-columns:minmax(200px,.7fr) minmax(260px,1.3fr);gap:20px;align-items:center;min-height:220px}
      .prediction-copy>strong{display:block;font-size:32px;margin-bottom:12px}.prediction-copy p{color:#c7d4e4;line-height:1.5}.prediction-copy small{color:#8fa7c0}.prediction-mini-chart{height:230px!important}
      .home-quick-section{margin:4px 0 20px}.home-quick-section h3{margin:0 0 12px}.home-quick-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
      .home-quick-grid button{min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:10px;background:#0d1c30;border:1px solid #29405c;color:#dce8f5;cursor:pointer}.home-quick-grid button svg{width:19px;height:19px}
      .quick-income{border-color:rgba(74,222,128,.4)!important;color:#4ade80!important}.quick-expense{border-color:rgba(251,113,133,.4)!important;color:#fb7185!important}.quick-calendar{border-color:rgba(56,189,248,.4)!important;color:#38bdf8!important}.quick-compare{border-color:rgba(167,139,250,.4)!important;color:#a78bfa!important}.quick-goal{border-color:rgba(245,158,11,.4)!important;color:#f59e0b!important}.quick-control{border-color:rgba(45,212,191,.4)!important;color:#2dd4bf!important}
      .chart-help{position:relative!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;width:20px!important;height:20px!important;min-width:20px!important;border:1px solid #7896b7!important;border-radius:50%!important;background:#0c2037!important;color:#c9d9eb!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
      .chart-help>svg{position:static!important;width:13px!important;height:13px!important;background:transparent!important;border:0!important;padding:0!important;margin:0!important}
      .chart-help-tooltip{opacity:0!important;visibility:hidden!important}.chart-help:hover .chart-help-tooltip{opacity:1!important;visibility:visible!important}.chart-help:focus .chart-help-tooltip,.chart-help:focus-visible .chart-help-tooltip{opacity:0!important;visibility:hidden!important}
      @media(max-width:1250px){.home-summary-cards{grid-template-columns:repeat(3,minmax(0,1fr))!important}.home-quick-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:900px){.home-dashboard-grid{grid-template-columns:1fr}.home-category-chart,.prediction-layout{grid-template-columns:1fr}.home-summary-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:600px){.home-summary-cards{grid-template-columns:1fr!important}.home-quick-grid{grid-template-columns:1fr 1fr}.home-category-legend{padding-right:0}}

      /* Pestañas laterales y vistas independientes */
      .side-nav nav>button{margin-bottom:5px}

      .monthly-group-top{border-top:0!important;margin-top:0!important;padding-top:0!important;margin-bottom:8px}
      .app-content{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;padding-top:0!important}
      .app-content main{display:block!important;align-self:stretch!important;margin:0!important;padding-top:12px!important}
      .app-content main>section,.app-content main>.panel,.app-content main>.table-panel{align-self:stretch!important;margin-left:0!important;margin-right:0!important}
      .standalone-view,.table-panel,.entry-grid,.charts,.dashboard-grid,.home-grid{align-self:stretch!important;justify-self:stretch!important}
      .table-panel{min-height:0!important}.table-panel .table-wrap{min-height:0!important}
      .top-insight-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 14px}
      .top-insight-card{position:relative;border:1px solid #29405c;border-radius:14px;background:#0d1c30;padding:16px;min-height:108px;overflow:hidden}
      .top-insight-card span{display:block;color:#8fb0d3;font-size:12px;margin-bottom:8px}.top-insight-card strong{display:block;font-size:22px;line-height:1.15;color:#f3f8ff}.top-insight-card small{display:block;color:#7f9ab7;margin-top:7px}.top-insight-card svg{position:absolute;right:14px;bottom:12px;width:26px;height:26px;color:#5e82a8}
      .top-insight-card.positive{border-color:rgba(74,222,128,.45)}.top-insight-card.negative{border-color:rgba(251,113,133,.45)}.top-insight-card.info{border-color:rgba(56,189,248,.45)}.top-insight-card.warn{border-color:rgba(245,158,11,.45)}
      @media(max-width:1100px){.top-insight-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.top-insight-grid{grid-template-columns:1fr}}

      .standalone-view{margin-top:4px;min-height:420px;padding:20px!important}
      .standalone-view .panel-title{align-items:center;gap:18px;flex-wrap:wrap}
      .calendar-view .calendar-grid{margin-top:18px}
      .compare-chart{height:360px;margin-top:20px}
      .goals-form{display:grid!important;grid-template-columns:minmax(260px,1fr) 190px 130px auto!important;align-items:end!important;margin:18px 0}

      /* Ajuste final: vistas independientes siempre arriba y con respiración visual */
      .app-content main{display:block!important;min-height:0!important;height:auto!important;padding-top:8px!important;justify-content:flex-start!important;align-items:stretch!important}
      .standalone-view{margin:0!important;align-self:flex-start!important;justify-self:stretch!important;width:100%!important;max-width:none!important;min-height:0!important;padding:22px!important}
      .standalone-view>.panel-title{margin:0 0 20px!important;padding:0 0 14px!important;border-bottom:1px solid #243b57;align-items:flex-start!important}
      .standalone-view>.panel-title h3{margin:0 0 5px!important}
      .standalone-view>.panel-title label{margin-left:auto;align-self:center}
      .standalone-view .top-insight-grid{margin-bottom:18px!important}
      .standalone-view .top-insight-card{overflow:visible!important;padding-right:48px!important}
      .standalone-view .top-insight-card>.kpi-help{top:12px!important;right:12px!important}
      .standalone-view .top-insight-card>svg{right:14px!important;bottom:12px!important;top:auto!important}
      .visual-two-column{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:14px;margin:16px 0}
      .visual-card{border:1px solid #29405c;border-radius:14px;background:#0b192b;padding:16px;min-width:0;overflow:visible}
      .visual-card .panel-title{margin:0 0 12px!important;padding:0!important;border:0!important}
      .visual-chart{height:280px;width:100%}
      .insight-list{display:grid;gap:10px}
      .insight-row{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #29405c;border-radius:11px;background:#0d1c30;padding:12px}
      .insight-row span{color:#91abc7}.insight-row strong{font-size:17px}
      .goal-overview-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.72fr);gap:14px;margin:16px 0 18px}
      .goal-empty-advice{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
      .goal-empty-advice article{border:1px solid #29405c;border-radius:12px;padding:14px;background:#0d1c30}
      .goal-empty-advice b{display:block;margin-bottom:6px;color:#e9f4ff}.goal-empty-advice span{font-size:12px;color:#8fa9c5;line-height:1.45}
      @media(max-width:1000px){.visual-two-column,.goal-overview-grid{grid-template-columns:1fr}.goal-empty-advice{grid-template-columns:1fr}}

      /* Vista de ingresos y egresos */
      .app-content{padding:20px 22px 34px!important;align-self:stretch!important}
      .toolbar{min-height:44px!important;margin:0 0 12px!important;padding:0!important;align-items:center!important}
      .table-panel{margin-top:0!important;width:100%!important;max-width:none!important}
      .table-panel .panel-title{padding:16px 18px!important;min-height:72px!important}
      .table-panel .table-wrap{max-height:calc(100vh - 255px)!important;overflow:auto!important}
      .table-panel table{width:100%!important;table-layout:fixed!important}
      .table-panel th:nth-child(1),.table-panel td:nth-child(1){width:15%!important}
      .table-panel th:nth-child(2),.table-panel td:nth-child(2){width:23%!important}
      .table-panel th:nth-child(3),.table-panel td:nth-child(3){width:35%!important}
      .table-panel th:nth-child(4),.table-panel td:nth-child(4){width:18%!important}
      .table-panel th:nth-child(5),.table-panel td:nth-child(5){width:9%!important}
      .table-panel td,.table-panel th{padding:14px 16px!important;vertical-align:middle!important}
      .table-panel .search.compact{min-width:280px!important}
      @media(max-width:900px){.goals-form{grid-template-columns:1fr!important}.table-panel .search.compact{min-width:0!important;width:100%!important}.app-content{padding:14px!important}}


      /* Tablas de análisis: columnas compactas sin desplazamiento horizontal */
      .analysis-table-panel { overflow:hidden !important; }
      .analysis-table-panel .analysis-table-wrap {
        width:100% !important;
        max-width:100% !important;
        overflow-x:hidden !important;
        overflow-y:auto !important;
      }
      .analysis-table-panel .analysis-data-table {
        width:100% !important;
        min-width:0 !important;
        max-width:100% !important;
        table-layout:fixed !important;
        border-collapse:collapse !important;
      }
      .analysis-table-panel .analysis-data-table th,
      .analysis-table-panel .analysis-data-table td {
        width:auto !important;
        min-width:0 !important;
        max-width:none !important;
        padding:11px 8px !important;
        font-size:12px !important;
        line-height:1.25 !important;
        white-space:normal !important;
        overflow-wrap:anywhere !important;
        word-break:normal !important;
        vertical-align:middle !important;
      }
      .analysis-table-panel .analysis-data-table thead th {
        font-size:11px !important;
        color:#91b1d2 !important;
        font-weight:700 !important;
      }
      .analysis-table-panel .analysis-data-table .type-pill {
        max-width:100% !important;
        display:inline-flex !important;
        white-space:normal !important;
        line-height:1.15 !important;
        text-align:left !important;
      }
      .analysis-table-panel .analysis-data-table input[type="checkbox"] {
        width:16px !important;
        height:16px !important;
        min-height:16px !important;
        padding:0 !important;
        margin:0 auto !important;
        display:block !important;
      }
      .analysis-table-panel .priority-badge {
        display:inline-flex !important;
        align-items:center !important;
        gap:4px !important;
        white-space:nowrap !important;
        font-size:11px !important;
      }
      .analysis-table-panel tfoot td {
        font-size:12px !important;
        font-weight:700 !important;
      }
      .reserve-analysis-table th:nth-child(1), .reserve-analysis-table td:nth-child(1){width:5%!important;text-align:center!important}
      .reserve-analysis-table th:nth-child(2), .reserve-analysis-table td:nth-child(2){width:14%!important}
      .reserve-analysis-table th:nth-child(3), .reserve-analysis-table td:nth-child(3){width:9%!important}
      .reserve-analysis-table th:nth-child(4), .reserve-analysis-table td:nth-child(4){width:11%!important}
      .reserve-analysis-table th:nth-child(5), .reserve-analysis-table td:nth-child(5){width:11%!important}
      .reserve-analysis-table th:nth-child(6), .reserve-analysis-table td:nth-child(6){width:11%!important}
      .reserve-analysis-table th:nth-child(7), .reserve-analysis-table td:nth-child(7){width:9%!important}
      .reserve-analysis-table th:nth-child(8), .reserve-analysis-table td:nth-child(8){width:8%!important}
      .reserve-analysis-table th:nth-child(9), .reserve-analysis-table td:nth-child(9){width:9%!important}
      .reserve-analysis-table th:nth-child(10), .reserve-analysis-table td:nth-child(10){width:13%!important}
      .income-analysis-table th:nth-child(1), .income-analysis-table td:nth-child(1){width:5%!important;text-align:center!important}
      .income-analysis-table th:nth-child(2), .income-analysis-table td:nth-child(2){width:20%!important}
      .income-analysis-table th:nth-child(3), .income-analysis-table td:nth-child(3){width:11%!important}
      .income-analysis-table th:nth-child(4), .income-analysis-table td:nth-child(4){width:15%!important}
      .income-analysis-table th:nth-child(5), .income-analysis-table td:nth-child(5){width:15%!important}
      .income-analysis-table th:nth-child(6), .income-analysis-table td:nth-child(6){width:15%!important}
      .income-analysis-table th:nth-child(7), .income-analysis-table td:nth-child(7){width:9%!important}
      .income-analysis-table th:nth-child(8), .income-analysis-table td:nth-child(8){width:10%!important}
      @media(max-width:1100px){
        .analysis-table-panel .analysis-data-table th,
        .analysis-table-panel .analysis-data-table td{padding:9px 5px!important;font-size:11px!important}
        .analysis-table-panel .analysis-data-table thead th{font-size:10px!important}
        .analysis-table-panel .priority-badge{font-size:10px!important;gap:2px!important}
      }

      /* CORRECCIÓN DEFINITIVA: ninguna vista puede centrarse verticalmente */
      .app .app-shell {
        display:flex !important;
        align-items:stretch !important;
        justify-content:flex-start !important;
        min-height:calc(100vh - 72px) !important;
        height:auto !important;
      }
      .app .app-shell > main.app-content {
        display:flex !important;
        flex:1 1 auto !important;
        flex-direction:column !important;
        align-items:stretch !important;
        justify-content:flex-start !important;
        align-content:stretch !important;
        align-self:stretch !important;
        min-width:0 !important;
        width:auto !important;
        max-width:none !important;
        min-height:calc(100vh - 72px) !important;
        height:auto !important;
        margin:0 !important;
        padding:18px 22px 34px !important;
        overflow:visible !important;
      }
      .app .app-shell > main.app-content > * {
        flex:0 0 auto !important;
        align-self:stretch !important;
        justify-self:stretch !important;
        max-width:none !important;
      }
      .app .app-shell > main.app-content > .toolbar {
        order:-100 !important;
        display:flex !important;
        align-items:center !important;
        justify-content:space-between !important;
        width:100% !important;
        min-height:44px !important;
        margin:0 0 12px !important;
        padding:0 !important;
      }
      .app .app-shell > main.app-content > section,
      .app .app-shell > main.app-content > .panel,
      .app .app-shell > main.app-content > .table-panel,
      .app .app-shell > main.app-content > .standalone-view,
      .app .app-shell > main.app-content > .entry-grid,
      .app .app-shell > main.app-content > .charts,
      .app .app-shell > main.app-content > .dashboard-grid,
      .app .app-shell > main.app-content > .home-grid {
        position:relative !important;
        top:auto !important;
        bottom:auto !important;
        transform:none !important;
        margin-left:0 !important;
        margin-right:0 !important;
      }
      .app .app-shell > main.app-content > .standalone-view {
        margin-top:0 !important;
        min-height:0 !important;
      }
      .app .app-shell > main.app-content > .table-panel {
        margin-top:0 !important;
      }
      @media(max-width:900px){
        .app .app-shell > main.app-content{padding:14px !important;}
      }
    `}</style>
    <style>{`
      .control-sections-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin:20px 0; }
      .control-subpanel { border:1px solid #29405c; border-radius:14px; background:#0b1b2f; padding:18px; margin:16px 0; }
      .control-sections-grid .control-subpanel { margin:0; }
      .control-subpanel-title { display:flex; align-items:flex-start; gap:12px; margin-bottom:14px; }
      .control-subpanel-title > svg { width:24px; height:24px; color:var(--accent,#38bdf8); flex:0 0 24px; }
      .control-subpanel-title h3 { margin:0 0 3px; }
      .control-subpanel-title span, .control-note { color:#8aa7c7; font-size:12px; line-height:1.5; }
      .control-form-grid { display:grid; gap:12px; margin-bottom:12px; }
      .control-form-grid.two-cols { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .control-form-grid label, .account-management-form label, .transfer-grid label { display:flex; flex-direction:column; gap:7px; color:#9fb3c8; font-size:12px; }
      .data-actions { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:10px; }
      .account-management-form { display:grid; grid-template-columns:minmax(220px,1fr) minmax(180px,.6fr) auto auto; gap:10px; align-items:end; margin-bottom:14px; }
      .account-cards-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:10px; }
      .account-card { border:1px solid #29405c; border-radius:12px; padding:14px; background:#0d1c30; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; align-items:center; }
      .account-card div:first-child { display:flex; flex-direction:column; gap:3px; }
      .account-card small { color:#8aa7c7; }
      .account-card strong { color:#4ade80; font-size:18px; }
      .account-card .row-actions { grid-column:1 / -1; justify-content:flex-end; }
      .transfer-grid { display:grid; grid-template-columns:repeat(4,minmax(150px,1fr)); gap:10px; align-items:end; }
      .transfer-description { grid-column:span 2; }
      .data-loading-strip { display:flex; align-items:center; gap:10px; margin:12px 0 16px; padding:10px 14px; border:1px solid #29405c; border-radius:11px; background:#0c1b2f; color:#9fb3c8; }
      .skeleton-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:14px 0; }
      .skeleton-card { height:110px; border-radius:14px; background:linear-gradient(90deg,#0d1c30 25%,#152a43 50%,#0d1c30 75%); background-size:200% 100%; animation:skeletonPulse 1.25s infinite; }
      @keyframes skeletonPulse { from { background-position:200% 0; } to { background-position:-200% 0; } }
      .confirm-backdrop { position:fixed; inset:0; z-index:1000000; background:rgba(1,8,18,.72); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
      .forecast-category-trigger { display:inline-flex; align-items:center; gap:8px; margin-top:16px; width:max-content; max-width:100%; }
      .forecast-category-trigger svg { width:17px; height:17px; }
      .forecast-category-trigger { margin-top:12px; }
      .forecast-summary-list { display:grid; gap:7px; margin:14px 0 4px; width:100%; max-width:390px; }
      .forecast-summary-list > div { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:8px 0; border-bottom:1px dashed rgba(116,151,187,.28); }
      .forecast-summary-list > div:last-child { border-bottom:0; }
      .forecast-summary-label { display:flex; align-items:center; gap:7px; min-width:0; color:#8fb0d3; font-size:12px; line-height:1.35; }
      .forecast-summary-list b { color:#eef7ff; font-size:12px; text-align:right; white-space:nowrap; }
      .inline-help { position:relative; display:inline-flex; align-items:center; justify-content:center; width:17px; height:17px; min-width:17px; padding:0; border:1px solid #54789d; border-radius:50%; background:#102844; color:#b9d6f2; cursor:help; box-shadow:none; overflow:visible; }
      .inline-help > svg { width:11px; height:11px; }
      .inline-help-tooltip { position:absolute; z-index:999999; left:50%; bottom:calc(100% + 9px); transform:translateX(-50%); width:min(300px,78vw); padding:11px 13px; border:1px solid #426486; border-radius:10px; background:#071524; color:#eef7ff; font-size:12px; font-weight:500; line-height:1.45; text-align:left; box-shadow:0 14px 34px rgba(0,0,0,.48); opacity:0; visibility:hidden; pointer-events:none; transition:opacity .14s ease, visibility .14s ease; white-space:normal; }
      .inline-help:hover .inline-help-tooltip { opacity:1; visibility:visible; }
      .inline-help-tooltip::after { content:''; position:absolute; left:50%; top:100%; width:9px; height:9px; background:#071524; border-right:1px solid #426486; border-bottom:1px solid #426486; transform:translate(-50%,-5px) rotate(45deg); }
      .forecast-summary-list .forecast-summary-total { margin-top:4px; padding:10px 12px; border:1px solid rgba(56,189,248,.35); border-radius:10px; background:rgba(56,189,248,.07); }
      .forecast-summary-list .forecast-summary-total span { color:#d9ecff; font-weight:800; }
      .forecast-summary-list .forecast-summary-total b { font-size:14px; }
      .forecast-category-summary { display:block; margin-top:8px; color:#8fb0d3; font-size:12px; line-height:1.4; }
      .forecast-summary-list > .forecast-recurring-row { align-items:flex-start; }
      .forecast-recurring-heading { display:flex; flex-direction:column; align-items:flex-start; gap:5px; min-width:0; }
      .forecast-detail-toggle { display:inline-flex; align-items:center; gap:4px; padding:0; border:0; background:transparent; color:#38bdf8; font:inherit; font-size:11px; font-weight:800; cursor:pointer; }
      .forecast-detail-toggle svg { width:13px; height:13px; transition:transform .2s ease; }
      .forecast-detail-toggle svg.open { transform:rotate(180deg); }
      .forecast-summary-list > .forecast-recurring-detail { display:grid; gap:8px; margin:-2px 0 5px; padding:10px; border:1px solid rgba(56,189,248,.24); border-radius:10px; background:rgba(7,21,36,.58); }
      .forecast-detail-section-title { color:#75bff0; font-size:10px; font-weight:900; letter-spacing:.03em; text-transform:uppercase; }
      .forecast-detail-item { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:7px 0; border-bottom:1px solid rgba(116,151,187,.16); }
      .forecast-detail-item:last-child { border-bottom:0; }
      .forecast-detail-item div { min-width:0; }
      .forecast-detail-item strong { display:block; color:#edf7ff; font-size:12px; line-height:1.3; overflow-wrap:anywhere; }
      .forecast-detail-item small { display:block; margin-top:2px; color:#8fb0d3; font-size:10px; line-height:1.35; }
      .forecast-detail-item > span { color:#eef7ff; font-size:12px; font-weight:900; white-space:nowrap; }
      .forecast-detail-empty { margin:0; color:#8fb0d3; font-size:11px; line-height:1.4; }
      .forecast-category-dialog { width:min(560px,100%); max-height:min(78vh,720px); display:flex; flex-direction:column; border:1px solid #365675; border-radius:16px; background:#0b1b2f; box-shadow:0 24px 70px rgba(0,0,0,.55); overflow:hidden; }
      .forecast-category-dialog header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding:20px 20px 14px; border-bottom:1px solid #29405c; }
      .forecast-category-dialog header h3 { margin:0 0 5px; }
      .forecast-category-dialog header p { margin:0; color:#8fb0d3; font-size:13px; line-height:1.45; }
      .forecast-category-dialog .icon-close { width:38px; min-width:38px; height:38px; padding:0 !important; display:flex; align-items:center; justify-content:center; }
      .forecast-category-toolbar { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 20px; border-bottom:1px solid #223a55; }
      .forecast-category-toolbar span { color:#9fb3c8; font-size:13px; }
      .forecast-category-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; padding:16px 20px; overflow:auto; }
      .forecast-category-option { display:flex; align-items:center; gap:11px; min-width:0; padding:12px; border:1px solid #294866; border-radius:11px; background:#0d2036; color:#eaf4ff; cursor:pointer; transition:border-color .15s ease, background .15s ease; }
      .forecast-category-option:hover { border-color:#38bdf8; background:#102a46; }
      .forecast-category-option input { width:18px !important; min-width:18px !important; height:18px !important; min-height:18px !important; margin:0; accent-color:#38bdf8; }
      .forecast-category-option span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .forecast-category-actions { display:flex; justify-content:flex-end; gap:10px; padding:14px 20px 20px; border-top:1px solid #29405c; }
      @media (max-width:620px) { .forecast-category-list { grid-template-columns:1fr; } }
      .confirm-dialog { width:min(480px,100%); border:1px solid #365675; border-radius:16px; background:#0b1b2f; box-shadow:0 24px 70px rgba(0,0,0,.55); padding:20px; }
      .confirm-dialog h3 { margin:0 0 8px; }
      .confirm-dialog p { margin:0; color:#9fb3c8; line-height:1.55; }
      .confirm-dialog-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
      .confirm-dialog .info-action { background:#38bdf8 !important; color:#071524 !important; }
      @media (max-width:900px) { .control-sections-grid { grid-template-columns:1fr; } .transfer-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .account-management-form { grid-template-columns:1fr 1fr; } .skeleton-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:600px) { .control-form-grid.two-cols, .transfer-grid, .account-management-form { grid-template-columns:1fr; } .transfer-description { grid-column:1; } .skeleton-grid { grid-template-columns:1fr; } }

      /* Vista tablet / iPad: conserva el estilo general y evita desbordes */
      @media (min-width:761px) and (max-width:1180px) {
        .app .app-shell > main.app-content, .main { padding:16px 18px 34px !important; min-width:0 !important; overflow-x:hidden !important; }
        .home-summary-cards, .home-kpis, .compact-kpis { grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:12px !important; }
        .home-dashboard-grid, .dashboard-grid, .dashboard-wide-grid, .account-dashboard-grid { grid-template-columns:1fr !important; }
        .home-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
        .home-grid > .panel, .home-grid > .third, .home-grid > .wide { grid-column:1/-1 !important; min-width:0 !important; }
        .prediction-layout { grid-template-columns:1fr !important; gap:18px !important; align-items:stretch !important; }
        .prediction-copy { min-width:0 !important; }
        .prediction-mini-chart { min-width:0 !important; width:100% !important; height:310px !important; }
        .prediction-mini-chart .recharts-responsive-container, .prediction-mini-chart .recharts-wrapper { width:100% !important; max-width:100% !important; }
        .home-category-chart, .account-chart-body { grid-template-columns:1fr !important; }
        .charts > article, .dashboard-grid > article, .panel { min-width:0 !important; max-width:100% !important; }
        .chart-box, .chart-wrap, .chart-container { min-width:0 !important; width:100% !important; overflow:hidden !important; }
        .commitment-form, .credit-form { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
        .commitment-summary, .credit-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
        .forecast-summary-list > div { min-width:0 !important; }
        .forecast-recurring-detail { max-width:100% !important; }
        .forecast-detail-item { grid-template-columns:minmax(0,1fr) auto !important; }
        .table-wrap { overflow-x:auto !important; -webkit-overflow-scrolling:touch; }
      }
    `}</style>
    <style>{`
      /* Ajuste final y uniforme de iconos en todas las cards */
      .kpi-info-card,
      .kpis article,
      .top-insight-card {
        position: relative !important;
        overflow: visible !important;
        padding: 18px 58px 18px 18px !important;
      }
      .kpi-info-card .kpi-help,
      .kpis article .card-help,
      .kpis article .kpi-help,
      .top-insight-card .kpi-help,
      .top-insight-card .card-help {
        position: absolute !important;
        top: 14px !important;
        right: 18px !important;
        bottom: auto !important;
        left: auto !important;
        margin: 0 !important;
        transform: none !important;
        width: 22px !important;
        height: 22px !important;
        min-width: 22px !important;
        z-index: 50 !important;
      }
      .kpi-info-card .kpi-card-icon,
      .top-insight-card .kpi-card-icon,
      .kpis article > svg,
      .top-insight-card > svg {
        position: absolute !important;
        right: 18px !important;
        bottom: 16px !important;
        top: auto !important;
        left: auto !important;
        margin: 0 !important;
        transform: none !important;
        width: 28px !important;
        height: 28px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: #7394b8 !important;
        opacity: .95 !important;
        pointer-events: none !important;
      }
      .kpi-info-card .kpi-card-icon > svg,
      .top-insight-card .kpi-card-icon > svg {
        width: 26px !important;
        height: 26px !important;
        position: static !important;
        margin: 0 !important;
        transform: none !important;
      }
      .kpi-info-card > small,
      .kpis article > small,
      .top-insight-card > small {
        display: block !important;
        padding-right: 34px !important;
      }

      /* Metas: acciones en una sola fila y sin superposiciones */
      .goal-card {
        position: relative !important;
        padding: 18px !important;
        overflow: hidden !important;
      }
      .goal-card header {
        display: block !important;
        min-height: 92px !important;
        padding: 0 148px 14px 0 !important;
        margin: 0 0 12px !important;
        border-bottom: 1px solid #203852 !important;
        overflow: visible !important;
      }
      .goal-card-main, .goal-title-line {
        width: 100% !important;
        min-width: 0 !important;
      }
      .goal-title-line {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
      }
      .goal-title-line h3 {
        flex: 1 1 180px !important;
        min-width: 0 !important;
        margin: 0 !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }
      .goal-priority {
        flex: 0 0 auto !important;
      }
      .goal-target {
        display: flex !important;
        align-items: baseline !important;
        gap: 8px !important;
        margin-top: 10px !important;
        white-space: normal !important;
      }
      .goal-actions {
        position: absolute !important;
        top: 16px !important;
        right: 16px !important;
        width: auto !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 6px !important;
        z-index: 5 !important;
      }
      .goal-actions button {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        padding: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 8px !important;
        line-height: 1 !important;
      }
      .goal-actions button svg {
        width: 17px !important;
        height: 17px !important;
      }
      .goal-progress-head {
        margin-top: 0 !important;
      }
      .goal-stat-grid {
        width: 100% !important;
      }
      @media (max-width: 720px) {
        .goal-card header {
          padding-right: 0 !important;
          padding-top: 46px !important;
          min-height: 126px !important;
        }
        .goal-actions {
          top: 12px !important;
          right: 12px !important;
        }
        .goal-stat-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
    <style>{`
      /* CORRECCIÓN DEFINITIVA: ayuda arriba derecha e icono abajo derecha */
      .kpi-info-card,
      .kpis article,
      .top-insight-card {
        position: relative !important;
        overflow: visible !important;
        padding: 18px 58px 18px 18px !important;
      }
      .kpi-info-card .kpi-info-head,
      .kpis article .kpi-info-head,
      .top-insight-card .kpi-info-head {
        position: static !important;
        display: block !important;
      }
      .kpi-info-card .kpi-help,
      .kpi-info-card .card-help,
      .kpis article .kpi-help,
      .kpis article .card-help,
      .top-insight-card .kpi-help,
      .top-insight-card .card-help {
        position: absolute !important;
        top: 14px !important;
        right: 14px !important;
        bottom: auto !important;
        left: auto !important;
        margin: 0 !important;
        transform: none !important;
        width: 24px !important;
        height: 24px !important;
        min-width: 24px !important;
        padding: 0 !important;
        z-index: 20 !important;
      }
      .kpi-info-card .kpi-card-icon,
      .top-insight-card .kpi-card-icon,
      .kpis article > svg,
      .top-insight-card > svg {
        position: absolute !important;
        right: 18px !important;
        bottom: 16px !important;
        top: auto !important;
        left: auto !important;
        margin: 0 !important;
        transform: none !important;
        width: 28px !important;
        height: 28px !important;
        pointer-events: none !important;
      }
      .kpi-info-card > strong,
      .kpi-info-card > small,
      .kpis article > strong,
      .kpis article > small,
      .top-insight-card > strong,
      .top-insight-card > small {
        max-width: calc(100% - 38px) !important;
      }

      /* Metas: prioridad + subir + bajar + eliminar en una sola fila */
      .goal-card {
        padding: 18px !important;
        overflow: hidden !important;
      }
      .goal-card header {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto !important;
        align-items: start !important;
        gap: 16px !important;
        min-height: 0 !important;
        padding: 0 0 14px !important;
        margin: 0 0 14px !important;
        border-bottom: 1px solid #203852 !important;
      }
      .goal-card-main {
        min-width: 0 !important;
      }
      .goal-title-line {
        display: block !important;
        width: 100% !important;
      }
      .goal-title-line h3 {
        margin: 0 0 8px !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
      }
      .goal-target {
        display: flex !important;
        align-items: baseline !important;
        gap: 8px !important;
        margin: 0 !important;
      }
      .goal-actions {
        position: static !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 8px !important;
        width: auto !important;
        min-width: max-content !important;
        margin: 0 !important;
      }
      .goal-priority {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 30px !important;
        padding: 0 10px !important;
        white-space: nowrap !important;
      }
      .goal-actions button {
        width: 30px !important;
        height: 30px !important;
        min-width: 30px !important;
        padding: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      @media (max-width: 720px) {
        .goal-card header {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
          padding-top: 0 !important;
        }
        .goal-actions {
          justify-content: flex-start !important;
          flex-wrap: wrap !important;
        }
      }
    `}</style>
    <style>{`
      /* Ajuste final: textos completos y valores en una sola línea */
      .kpi-info-card,
      .kpis article,
      .top-insight-card {
        min-width: 0 !important;
        padding-left: 20px !important;
        padding-right: 58px !important;
      }
      .kpi-info-card .kpi-info-head,
      .kpi-info-card > strong,
      .kpi-info-card > small,
      .kpis article > span,
      .kpis article > strong,
      .kpis article > small,
      .top-insight-card > span,
      .top-insight-card > strong,
      .top-insight-card > small {
        width: 100% !important;
        max-width: 100% !important;
        padding-right: 0 !important;
        box-sizing: border-box !important;
      }
      .kpi-info-card > strong,
      .kpis article > strong,
      .top-insight-card > strong {
        white-space: nowrap !important;
        overflow: visible !important;
        overflow-wrap: normal !important;
        word-break: normal !important;
        font-size: clamp(20px, 1.8vw, 30px) !important;
        letter-spacing: -0.02em !important;
      }
      .home-summary-cards .kpi-info-card > strong {
        white-space: nowrap !important;
        font-size: clamp(20px, 1.75vw, 28px) !important;
      }
      .home-summary-cards .kpi-info-card > small,
      .kpi-info-card > small,
      .kpis article > small,
      .top-insight-card > small {
        max-width: 100% !important;
        white-space: normal !important;
        overflow-wrap: normal !important;
        word-break: normal !important;
      }

      /* Metas de ahorro: márgenes correctos y cabecera compacta */
      .goal-card {
        padding: 20px !important;
      }
      .goal-card header {
        padding: 2px 0 16px !important;
        margin: 0 0 16px !important;
        gap: 18px !important;
      }
      .goal-card-main {
        padding: 0 !important;
      }
      .goal-title-line h3 {
        margin: 0 0 10px !important;
        line-height: 1.2 !important;
      }
      .goal-target {
        width: 100% !important;
        gap: 10px !important;
        white-space: nowrap !important;
      }
      .goal-target span,
      .goal-target strong {
        white-space: nowrap !important;
      }
      .goal-actions {
        align-self: start !important;
        padding-top: 0 !important;
      }
      .goal-progress-head {
        margin: 0 0 8px !important;
      }
      .goal-stat-grid {
        margin-top: 14px !important;
      }
      @media (max-width: 1180px) {
        .home-summary-cards .kpi-info-card > strong,
        .kpi-info-card > strong,
        .kpis article > strong,
        .top-insight-card > strong {
          font-size: clamp(18px, 2.2vw, 25px) !important;
        }
      }
      @media (max-width: 720px) {
        .goal-card { padding: 16px !important; }
        .goal-card header { gap: 12px !important; }
        .goal-target { white-space: normal !important; flex-wrap: wrap !important; }
      }
    `}</style>
    <style>{`
      /* Ajuste final solicitado: leyenda fuera del trazado y metas con aire interior */
      .prediction-mini-chart {
        min-height: 300px !important;
        padding: 10px 8px 2px !important;
      }
      .prediction-mini-chart .recharts-legend-wrapper {
        position: absolute !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        top: auto !important;
        width: 100% !important;
        padding-top: 8px !important;
      }
      .prediction-mini-chart .recharts-default-legend {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        gap: 18px !important;
        flex-wrap: wrap !important;
      }

      .goal-card {
        padding: 24px !important;
      }
      .goal-card header {
        align-items: center !important;
        padding: 6px 4px 18px !important;
        margin: 0 0 18px !important;
        gap: 22px !important;
      }
      .goal-card-main {
        padding: 0 4px !important;
      }
      .goal-title-line h3 {
        margin: 0 0 12px !important;
        line-height: 1.25 !important;
      }
      .goal-target {
        margin: 0 !important;
        align-items: center !important;
      }
      .goal-actions {
        align-self: center !important;
        padding: 0 2px !important;
      }
      .goal-progress-head,
      .goal-progress,
      .goal-stat-grid {
        margin-left: 4px !important;
        margin-right: 4px !important;
      }
      @media (max-width: 720px) {
        .prediction-mini-chart { min-height: 280px !important; }
        .goal-card { padding: 18px !important; }
        .goal-card header { padding: 4px 2px 16px !important; }
        .goal-card-main { padding: 0 2px !important; }
      }

        .forecast-expandable-row{align-items:flex-start!important}
        .forecast-expandable-row>.forecast-recurring-heading{min-width:0;flex:1}
        .forecast-expandable-row>b{flex:0 0 auto;padding-top:1px}
        .forecast-recurring-detail .positive,.forecast-recurring-detail .negative{font-weight:900}

      /* Análisis con IA */
      .ai-hero{display:flex;align-items:center;justify-content:space-between;gap:28px;padding:28px;margin-bottom:18px;background:linear-gradient(135deg,rgba(56,189,248,.10),rgba(167,139,250,.08));overflow:visible}
      .ai-hero-copy{max-width:780px}.ai-hero-copy h1{margin:8px 0 8px;font-size:clamp(24px,3vw,38px)}.ai-hero-copy p{margin:0;color:var(--muted);line-height:1.6}
      .ai-eyebrow{display:inline-flex;align-items:center;gap:8px;color:#7dd3fc;font-size:12px;font-weight:900;letter-spacing:.08em}.ai-eyebrow svg{width:17px}
      .ai-primary-button{display:flex;align-items:center;justify-content:center;gap:10px;min-width:210px;padding:14px 18px;border-radius:14px;background:linear-gradient(135deg,#38bdf8,#818cf8);color:#04111f;font-weight:900;border:0}.ai-primary-button svg{width:20px}
      .ai-error{display:flex;align-items:center;gap:10px;padding:14px 16px;margin-bottom:16px;border:1px solid rgba(251,113,133,.45);background:rgba(251,113,133,.09);border-radius:14px;color:#fecdd3}.ai-error svg{width:20px}
      .ai-empty-state{text-align:center;padding:55px 24px}.ai-empty-state>svg{width:58px;height:58px;color:#38bdf8;margin-bottom:12px}.ai-empty-state h2{margin:0 0 8px}.ai-empty-state p{max-width:680px;margin:0 auto 20px;color:var(--muted);line-height:1.6}.ai-empty-state button{display:inline-flex;align-items:center;gap:8px}
      .ai-summary-grid{display:grid;grid-template-columns:minmax(0,2.3fr) minmax(240px,.7fr);gap:16px;margin-bottom:16px}.ai-main-summary,.ai-health-card,.ai-list-card,.ai-findings,.ai-question-panel,.ai-history-panel{padding:22px}
      .ai-card-title{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}.ai-card-title>svg{width:24px;height:24px;color:#38bdf8;flex:0 0 auto}.ai-card-title h2,.ai-card-title h3{margin:0}.ai-card-title span{display:block;color:var(--muted);font-size:13px;margin-top:3px}
      .ai-summary-text{font-size:17px;line-height:1.75;margin:0;color:var(--text)}.ai-diagnosis{display:grid;gap:5px;margin-top:18px;padding:14px 16px;border-radius:12px;background:rgba(56,189,248,.07);border:1px solid rgba(56,189,248,.18)}.ai-diagnosis span{color:var(--muted);line-height:1.5}
      .ai-health-card{display:flex;flex-direction:column;justify-content:center;background:linear-gradient(145deg,rgba(74,222,128,.09),rgba(56,189,248,.06))}.ai-health-card>span{color:var(--muted)}.ai-health-card>strong{font-size:28px;margin:10px 0;color:#4ade80}.ai-health-card>small{color:var(--muted)}
      .ai-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:16px}.ai-item-list{display:grid;gap:10px}.ai-list-item{display:flex;gap:12px;align-items:flex-start;padding:13px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.015)}.ai-list-item>span{display:grid;place-items:center;min-width:25px;height:25px;border-radius:50%;font-weight:900}.ai-list-item p{margin:2px 0 0;line-height:1.5}.ai-list-item.warning>span{background:rgba(251,113,133,.15);color:#fb7185}.ai-list-item.positive>span{background:rgba(74,222,128,.14);color:#4ade80}
      .ai-findings{margin-bottom:16px}.ai-finding-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ai-finding-grid article{padding:16px;border:1px solid var(--border);border-radius:13px;background:rgba(255,255,255,.018)}.ai-finding-grid p{color:var(--muted);line-height:1.5}.ai-finding-grid small{color:#7dd3fc;font-weight:800}
      .ai-question-panel{margin-bottom:16px}.ai-question-panel form{display:grid;gap:10px}.ai-question-panel textarea{width:100%;resize:vertical;min-height:92px}.ai-question-panel form>div{display:flex;justify-content:space-between;align-items:center}.ai-question-panel button{display:flex;align-items:center;gap:8px}.ai-question-panel small{color:var(--muted)}
      .ai-history-list{display:grid;gap:8px}.ai-history-list>button{display:flex;align-items:center;justify-content:space-between;text-align:left;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.015);color:var(--text)}.ai-history-list>button div{display:grid;gap:3px}.ai-history-list span{color:var(--muted);font-size:12px}.ai-history-list svg{width:18px;transform:rotate(-90deg)}
      .ai-privacy-note{display:flex;gap:12px;align-items:flex-start;padding:15px 18px;border:1px solid rgba(74,222,128,.25);border-radius:14px;background:rgba(74,222,128,.05);margin:16px 0 30px}.ai-privacy-note svg{color:#4ade80;flex:0 0 auto}.ai-privacy-note div{display:grid;gap:4px}.ai-privacy-note span{color:var(--muted);line-height:1.45}
      @media(max-width:1180px){.ai-summary-grid{grid-template-columns:1fr}.ai-columns{grid-template-columns:1fr}.ai-finding-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ai-hero{align-items:flex-start}.ai-primary-button{min-width:190px}}
      @media(max-width:760px){.ai-hero{display:grid;padding:20px}.ai-primary-button{width:100%}.ai-finding-grid{grid-template-columns:1fr}.ai-main-summary,.ai-health-card,.ai-list-card,.ai-findings,.ai-question-panel,.ai-history-panel{padding:17px}.ai-summary-text{font-size:15px}.ai-question-panel form>div{align-items:flex-end;gap:10px}.ai-question-panel button{justify-content:center}.ai-privacy-note{margin-bottom:90px}}
    `}</style>
    <header><div className="brand"><div className="brand-icon"><WalletCards /></div><div><b>Mis Finanzas</b><small>Información sincronizada y siempre disponible</small></div></div><div className="header-actions"><button className={`ghost header-icon ${filtersOpen || Object.values(filters).some(v => v && v !== 'all') ? 'active' : ''}`} onClick={() => { setFilterDraft(filters); setFiltersOpen(true) }} title="Filtros"><SlidersHorizontal />{Object.values(filters).some(v => v && v !== 'all') && <span className="filter-dot" />}</button><button className={`ghost header-icon ${notificationsOpen ? 'active' : ''}`} onClick={() => setNotificationsOpen(true)} title="Notificaciones"><Bell />{unreadNotifications.length > 0 && <span className="notification-badge">{unreadNotifications.length}</span>}</button><button className="secondary" onClick={() => openNew('income')}><ArrowUpCircle /> Ingreso</button><button onClick={() => openNew('expense')}><ArrowDownCircle /> Egreso</button>{isMobileViewport && <button className="ghost mobile-quick-return" onClick={() => setMobileQuickMode(true)} title="Vista rápida"><Home /></button>}{configured && <button className="ghost" onClick={() => supabase.auth.signOut()} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut /></button>}</div></header>
    {isMobileViewport && !mobileQuickMode && <button type="button" className="mobile-quick-floating-return" onClick={() => setMobileQuickMode(true)} aria-label="Volver a vista rápida"><Home /> Vista rápida</button>}
    {filtersOpen && <div className="overlay-panel" onMouseDown={() => setFiltersOpen(false)}>
      <aside className="drawer" onMouseDown={e => e.stopPropagation()}>
        <div className="drawer-head"><div><h2>Filtros</h2><small>Aplicar filtros a los movimientos del mes seleccionado</small></div><button className="ghost" onClick={() => setFiltersOpen(false)}><X /></button></div>
        <div className="filter-grid">
          <label>Fecha desde<input type="date" value={filterDraft.dateFrom} onChange={e => setFilterDraft({...filterDraft,dateFrom:e.target.value})}/></label>
          <label>Fecha hasta<input type="date" value={filterDraft.dateTo} onChange={e => setFilterDraft({...filterDraft,dateTo:e.target.value})}/></label>
          <label className="full">Categoría<select value={filterDraft.category} onChange={e => setFilterDraft({...filterDraft,category:e.target.value})}><option value="all">Todas las categorías</option>{allCategoryNames.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
          <label>Monto mínimo<input type="number" min="0" step="0.01" value={filterDraft.minAmount} onChange={e => setFilterDraft({...filterDraft,minAmount:e.target.value})} placeholder="0"/></label>
          <label>Monto máximo<input type="number" min="0" step="0.01" value={filterDraft.maxAmount} onChange={e => setFilterDraft({...filterDraft,maxAmount:e.target.value})} placeholder="Sin límite"/></label>
        </div>
        <div className="drawer-actions"><button className="ghost" type="button" onClick={() => { setFilterDraft(emptyFilters); setFilters(emptyFilters); setFiltersOpen(false) }}>Limpiar filtros</button><button type="button" onClick={() => { setFilters(filterDraft); setFiltersOpen(false) }}>Aplicar filtros</button></div>
      </aside>
    </div>}
    {notificationsOpen && <div className="overlay-panel" onMouseDown={() => setNotificationsOpen(false)}>
      <aside className="drawer" onMouseDown={e => e.stopPropagation()}>
        <div className="drawer-head"><div><h2>Centro de notificaciones</h2><small>{unreadNotifications.length} sin leer · {notifications.length} avisos activos</small></div><button className="ghost" onClick={() => setNotificationsOpen(false)}><X /></button></div>
        {!!notifications.length && <div className="notification-toolbar"><button className="ghost" onClick={markAllNotificationsRead}><CheckCircle2/> Marcar todo como leído</button></div>}
        {notifications.map(item=><div className={`notification-item ${item.type || 'info'} ${readNotifications.includes(item.id)?'read':''}`} key={item.id}>
          <div className="notification-copy"><small>{item.group}</small><b>{item.title || 'Aviso'}</b><p>{item.text || item.message}</p></div>
          <div className="notification-actions"><button className="ghost" onClick={()=>setReadNotifications(current=>[...new Set([...current,item.id])])} title="Marcar como leído"><CheckCircle2/></button><button className="ghost danger" onClick={()=>dismissNotification(item.id)} title="Descartar"><X/></button></div>
        </div>)}
        {!notifications.length && <div className="empty-card">No existen notificaciones pendientes.</div>}
      </aside>
    </div>}
    <div className="app-shell">
      <aside className={`side-nav ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="side-nav-top"><button className="ghost side-toggle" onClick={() => setSidebarOpen(v => !v)} title={sidebarOpen ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}><Menu /></button></div>
        <nav className="side-menu">
          <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')} title="Inicio"><Home /><span className="nav-label">INICIO</span></button>
          <div className="monthly-group monthly-group-top">
            <button className={`monthly-toggle ${monthlyOpen ? 'open' : ''}`} onClick={() => setMonthlyOpen(v => !v)} title="Mensual"><span className="monthly-label"><CalendarDays /><span className="nav-label">MENSUAL</span></span><ChevronDown className="chevron" /></button>
            {monthlyOpen && <div className="monthly-items">
              <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')} title="Dashboard mensual"><LayoutDashboard /><span className="nav-label">Dashboard</span></button>
              <button className={tab === 'cargar' ? 'active' : ''} onClick={() => setTab('cargar')} title="Cargar movimientos"><Plus /><span className="nav-label">Cargar</span></button>
              <button className={tab === 'income' ? 'active' : ''} onClick={() => setTab('income')} title="Ingresos mensuales"><TrendingUp /><span className="nav-label">Ingresos</span></button>
              <button className={tab === 'expense' ? 'active' : ''} onClick={() => setTab('expense')} title="Egresos mensuales"><TrendingDown /><span className="nav-label">Egresos</span></button>
              <button className={tab === 'big-expenses' ? 'active' : ''} onClick={() => setTab('big-expenses')} title="Grandes gastos"><ReceiptText /><span className="nav-label">Grandes gastos</span></button>
              <button className={tab === 'savings' ? 'active' : ''} onClick={() => setTab('savings')} title="Ahorros"><PiggyBank /><span className="nav-label">Ahorros</span></button>
              <button className={tab === 'account-management' ? 'active' : ''} onClick={() => setTab('account-management')} title="Gestión de cuentas"><WalletCards /><span className="nav-label">Gestión de cuentas</span></button>
              <button className={tab === 'recurring' ? 'active' : ''} onClick={() => setTab('recurring')} title="Pagos recurrentes"><Repeat2 /><span className="nav-label">Pagos recurrentes</span></button>
              <button className={tab === 'credit' ? 'active' : ''} onClick={() => setTab('credit')} title="Cuotas y tarjetas"><CreditCard /><span className="nav-label">Cuotas y tarjetas</span></button>
            </div>}
          </div>
          <button className={tab === 'analysis' ? 'active' : ''} onClick={() => setTab('analysis')} title="Análisis de finanzas"><CircleDollarSign /><span className="nav-label">ANÁLISIS DE FINANZAS</span></button>
          <button className={tab === 'goals' ? 'active' : ''} onClick={() => setTab('goals')} title="Metas de ahorro"><Target /><span className="nav-label">METAS DE AHORRO</span></button>
          <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')} title="Calendario financiero"><CalendarDays /><span className="nav-label">CALENDARIO FINANCIERO</span></button>
          <button className={tab === 'compare' ? 'active' : ''} onClick={() => setTab('compare')} title="Comparar meses"><RefreshCw /><span className="nav-label">COMPARAR MESES</span></button>
          <button className={tab === 'control' ? 'active' : ''} onClick={() => setTab('control')} title="Control"><SlidersHorizontal /><span className="nav-label">CONTROL</span></button>
        </nav>
      </aside>
      <main className="app-content">
      {dataLoading && <><div className="data-loading-strip"><RefreshCw className="spin" /> Actualizando datos de esta cuenta…</div><div className="skeleton-grid">{[1,2,3,4].map(item => <div className="skeleton-card" key={item} />)}</div></>}
      {notice && <div className="notice" onClick={() => setNotice('')}>{notice}</div>}
      <div className="toolbar">
        {tab === 'analysis'
          ? <label>Período analizado <strong>{analysisMonths[0] || DATA_START} a {analysisMonths.at(-1) || DATA_START}</strong></label>
          : tab === 'big-expenses' || tab === 'savings' || tab === 'settings' || tab === 'calendar' || tab === 'compare' || tab === 'goals' || tab === 'control' || tab === 'account-management' || tab === 'recurring' || tab === 'credit'
            ? <span></span>
            : <label>Período <input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>}
        {tab === 'dashboard' && <small className="period-note"><CalendarDays /> Todos los indicadores corresponden al mes seleccionado</small>}
        {tab === 'analysis' && <small className="period-note"><CalendarDays /> Análisis histórico de todos los movimientos disponibles</small>}
      </div>

      {tab === 'home' && <>
        <section className="home-hero home-hero-clean">
          <div>
            <h1>Inicio</h1>
            <p>Resumen general de las finanzas</p>
          </div>
        </section>

        <section className="kpis home-summary-cards">
          <KpiInfoCard title="Saldo actual" value={money(closingBalance)} detail={`Actualizado a ${month}`} icon={<WalletCards/>} tone={closingBalance>=0?'positive':'negative'} help="Es el dinero disponible al finalizar el mes seleccionado. Se calcula sumando el saldo inicial y los ingresos, y restando los egresos y los aportes enviados a ahorros." />
          <KpiInfoCard title="Gastado este mes" value={money(expenseWithoutSavings)} detail={`${expenseRowsWithoutSavings.length} egresos`} icon={<TrendingDown/>} tone="negative" help="Suma todos los egresos del mes seleccionado, sin contar el dinero trasladado a la sección Ahorros." />
          <KpiInfoCard title="Ahorrado este mes" value={money(monthlySavingsDeposits)} detail={`Saldo total ${money(savingsBalance)}`} icon={<PiggyBank/>} tone="info" help="Muestra cuánto dinero fue guardado durante el mes seleccionado. El detalle inferior indica el saldo total acumulado en ahorros." />
          <KpiInfoCard title="Próxima meta" value={nextGoal ? money(nextGoal.remaining) : 'Sin meta'} detail={nextGoal?.name || 'Crear una meta en Ahorros'} icon={<Target/>} tone="purple" help="Indica cuánto falta para completar la meta de ahorro activa con mayor prioridad." />
          <KpiInfoCard title="Alertas" value={unreadNotifications.length} detail="Revisar centro de notificaciones" icon={<Bell/>} tone="warning" help="Cantidad de avisos financieros detectados, como aumento de gastos, falta de movimientos o metas próximas a completarse." />
        </section>

        <section className="home-dashboard-grid">
          <article className="panel home-chart-panel">
            <div className="panel-title">
              <div>
                <ChartInfoTitle title="Evolución de ingresos y egresos" text="Compara los ingresos y los egresos reales de los últimos meses. Permite detectar rápidamente meses con mayor gasto o mayor capacidad de ahorro." />
                <span>Últimos meses registrados</span>
              </div>
            </div>
            <div className="chart home-main-chart">
              <ResponsiveContainer>
                <BarChart data={financeAnalysis.analysisMonthTotals.slice(-6)} margin={{top:8,right:10,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#203047" />
                  <XAxis dataKey="month" stroke="#7890a8" />
                  <YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`} />
                  <Tooltip formatter={v=>money(v)} contentStyle={{background:'#071524',border:'1px solid #365b7d',borderRadius:10,color:'#f8fbff',boxShadow:'0 12px 30px rgba(0,0,0,.42)'}} labelStyle={{color:'#f8fbff',fontWeight:800}} itemStyle={{color:'#f8fbff'}} />
                  <Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#4ade80" radius={[6,6,0,0]} />
                  <Bar dataKey="egresos" name="Egresos sin ahorros" fill="#fb7185" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <span className="panel-corner-icon income-corner"><TrendingUp /></span>
          </article>

          <article className="panel home-chart-panel">
            <div className="panel-title">
              <div>
                <ChartInfoTitle title="Distribución de gastos por categoría" text="Muestra qué porcentaje del gasto mensual corresponde a cada categoría, incluyendo los aportes enviados a Ahorros." />
                <span>Participación sobre el gasto del mes</span>
              </div>
            </div>
            <div className="home-category-chart">
              <div className="chart home-donut-chart">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={homeExpenseByCategory} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2}>
                      {homeExpenseByCategory.map((_,i)=><Cell key={i} fill={palette[i%palette.length]} />)}
                    </Pie>
                    <Tooltip formatter={v=>money(v)} contentStyle={{background:'#071524',border:'1px solid #365b7d',borderRadius:10,color:'#f8fbff',boxShadow:'0 12px 30px rgba(0,0,0,.42)'}} labelStyle={{color:'#f8fbff',fontWeight:800}} itemStyle={{color:'#f8fbff'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="home-category-legend">
                {homeExpenseByCategory.map((item,i)=><div key={item.name}>
                  <span className="legend-dot" style={{background:palette[i%palette.length]}} />
                  <b>{item.name}</b>
                  <strong>{money(item.value)}</strong>
                  <small>{homeExpenseCategoryTotal ? `${((item.value/homeExpenseCategoryTotal)*100).toFixed(1)}%` : '0%'}</small>
                </div>)}
                {!homeExpenseByCategory.length && <p className="empty">Sin gastos en el mes seleccionado.</p>}
              </div>
            </div>
            <span className="panel-corner-icon category-corner"><CircleDollarSign /></span>
          </article>

          <article className="panel home-lower-panel">
            <div className="panel-title">
              <div><ChartInfoTitle title="Últimos movimientos" text="Muestra los movimientos más recientes de la cuenta, ordenados desde el último registro cargado." /><span>Los cinco registros más recientes</span></div>
              <button className="ghost compact-action" onClick={()=>setTab('dashboard')}>Ver todos</button>
            </div>
            <div className="recent-movements-list">
              {movements.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5).map(x=><div className="recent-movement" key={x.id}>
                <span className={`movement-round-icon ${x.type}`}>
                  {x.type==='income'?<ArrowUpCircle/>:<ArrowDownCircle/>}
                </span>
                <div><b>{x.description}</b><small>{x.categories?.name || 'Sin categoría'} · {x.date?.split('-').reverse().join('/')}</small></div>
                <strong className={x.type==='income'?'positive':'negative'}>{x.type==='income'?'+':'-'}{money(x.amount)}</strong>
              </div>)}
              {!movements.length && <div className="empty">Todavía no hay movimientos registrados.</div>}
            </div>
          </article>

          <article className="panel home-lower-panel prediction-modern">
            <div className="panel-title">
              <div><ChartInfoTitle title="Predicción al cierre del mes" text="Proyecta el saldo de cierre combinando el ritmo de gastos actual con los pagos recurrentes y las cuotas cargados explícitamente. Los aportes a ahorros se descuentan del saldo, pero no se extrapolan como gasto futuro." /><span>Estimación basada en el ritmo actual</span></div>
            </div>
            <div className="prediction-layout">
              <div className="prediction-copy">
                <strong className={forecastClosing>=0?'positive':'negative'}>{money(forecastClosing)}</strong>
                <p>Saldo estimado al finalizar el mes seleccionado.</p>
                <div className="forecast-summary-list">
                  <div className="forecast-expandable-row">
                    <div className="forecast-recurring-heading">
                      <span className="forecast-summary-label">Saldo actual <InlineHelp text="Es el mismo saldo actual que se muestra en la tarjeta de Inicio. Se actualiza con todos los ingresos, egresos y aportes a ahorros registrados hasta hoy, y es el punto de partida de la predicción." /></span>
                      <button type="button" className="forecast-detail-toggle" onClick={() => toggleForecastDetail('balance')} aria-expanded={forecastDetailOpen.balance}>
                        {forecastDetailOpen.balance ? 'Ocultar detalle' : 'Ver detalle'}
                        <ChevronDown className={forecastDetailOpen.balance ? 'open' : ''} />
                      </button>
                    </div>
                    <b>{money(currentForecastBalance)}</b>
                  </div>
                  {forecastDetailOpen.balance && <div className="forecast-recurring-detail">
                    <small className="forecast-detail-section-title">Composición del saldo actual</small>
                    <div className="forecast-detail-item"><div><strong>Saldo al iniciar el mes</strong><small>Saldo acumulado de meses anteriores</small></div><span>{money(openingBalance)}</span></div>
                    <div className="forecast-detail-item"><div><strong>Ingresos registrados</strong><small>Ingresos cargados durante el mes</small></div><span className="positive">+ {money(income)}</span></div>
                    <div className="forecast-detail-item"><div><strong>Egresos registrados</strong><small>Incluye gastos y aportes enviados a ahorros</small></div><span className="negative">- {money(expense)}</span></div>
                  </div>}
                  <div className="forecast-expandable-row">
                    <div className="forecast-recurring-heading">
                      <span className="forecast-summary-label">Gasto registrado este mes <InlineHelp text="Suma los egresos ya cargados en las categorías seleccionadas para la predicción. Los aportes a ahorros no se incluyen como ritmo de gasto." /></span>
                      <button type="button" className="forecast-detail-toggle" onClick={() => toggleForecastDetail('registered')} aria-expanded={forecastDetailOpen.registered}>
                        {forecastDetailOpen.registered ? 'Ocultar detalle' : 'Ver detalle'}
                        <ChevronDown className={forecastDetailOpen.registered ? 'open' : ''} />
                      </button>
                    </div>
                    <b>{money(forecastExpenseCurrent)}</b>
                  </div>
                  {forecastDetailOpen.registered && <div className="forecast-recurring-detail">
                    <small className="forecast-detail-section-title">Gastos registrados por categoría</small>
                    {forecastRegisteredByCategory.map(item => <div className="forecast-detail-item" key={`registered-${item.name}`}><div><strong>{item.name}</strong><small>Movimientos incluidos en la predicción</small></div><span>{money(item.amount)}</span></div>)}
                    {!forecastRegisteredByCategory.length && <p className="forecast-detail-empty">No hay gastos registrados en las categorías seleccionadas.</p>}
                  </div>}
                  <div className="forecast-expandable-row">
                    <div className="forecast-recurring-heading">
                      <span className="forecast-summary-label">Gasto pendiente proyectado <InlineHelp text="Es el gasto que todavía se estima realizar hasta fin de mes. Se obtiene comparando el gasto total proyectado con lo que ya fue registrado." /></span>
                      <button type="button" className="forecast-detail-toggle" onClick={() => toggleForecastDetail('pending')} aria-expanded={forecastDetailOpen.pending}>
                        {forecastDetailOpen.pending ? 'Ocultar detalle' : 'Ver detalle'}
                        <ChevronDown className={forecastDetailOpen.pending ? 'open' : ''} />
                      </button>
                    </div>
                    <b>{money(forecastRemainingExpense)}</b>
                  </div>
                  {forecastDetailOpen.pending && <div className="forecast-recurring-detail">
                    <small className="forecast-detail-section-title">Detalle de la proyección pendiente</small>
                    {forecastPendingByCategory.map(item => <div className="forecast-detail-item" key={`pending-${item.name}`}><div><strong>{item.name}</strong><small>Estimado según el ritmo de gasto del mes</small></div><span>{money(item.amount)}</span></div>)}
                    {scheduledCommitmentsPending > 0 && <div className="forecast-detail-item"><div><strong>Pagos recurrentes y cuotas</strong><small>Compromisos pendientes cargados explícitamente</small></div><span>{money(scheduledCommitmentsPending)}</span></div>}
                    {forecastRemainingExpense <= 0 && <p className="forecast-detail-empty">No se proyectan gastos pendientes para este mes.</p>}
                  </div>}
                  <div className="forecast-recurring-row">
                    <div className="forecast-recurring-heading">
                      <span className="forecast-summary-label">Pagos recurrentes y cuotas incluidos <InlineHelp text="Incluye únicamente los pagos activos cargados en Pagos recurrentes y las cuotas pendientes registradas en Cuotas y tarjetas. No se detectan ni duplican gastos desde movimientos anteriores." /></span>
                      <button
                        type="button"
                        className="forecast-detail-toggle"
                        onClick={() => setForecastRecurringDetailOpen(value => !value)}
                        aria-expanded={forecastRecurringDetailOpen}
                      >
                        {forecastRecurringDetailOpen ? 'Ocultar detalle' : 'Ver detalle'}
                        <ChevronDown className={forecastRecurringDetailOpen ? 'open' : ''} />
                      </button>
                    </div>
                    <b>{money(scheduledCommitmentsPending)}</b>
                  </div>
                  {forecastRecurringDetailOpen && <div className="forecast-recurring-detail">
                    {!!scheduledCommitments.length && <>
                      <small className="forecast-detail-section-title">Cargados en Pagos recurrentes y Cuotas</small>
                      {scheduledCommitments.map(item => <div className="forecast-detail-item" key={`forecast-scheduled-${item.id}`}>
                        <div>
                          <strong>{item.name}</strong>
                          <small>Vence el día {item.day}{item.kind === 'cuota' ? ` · cuota ${item.installmentNumber}/${item.totalInstallments}` : ' · pago recurrente'}</small>
                        </div>
                        <span>{money(item.amount)}</span>
                      </div>)}
                    </>}
                    {!scheduledCommitments.length && <p className="forecast-detail-empty">No hay pagos recurrentes ni cuotas pendientes cargados para este mes.</p>}
                  </div>}
                  <div className="forecast-expandable-row">
                    <div className="forecast-recurring-heading">
                      <span className="forecast-summary-label">Ahorros ya descontados <InlineHelp text="Muestra los aportes enviados a Ahorros durante el mes. Ya están descontados del saldo actual y no se vuelven a restar ni se proyectan como gasto futuro." /></span>
                      <button type="button" className="forecast-detail-toggle" onClick={() => toggleForecastDetail('savings')} aria-expanded={forecastDetailOpen.savings}>
                        {forecastDetailOpen.savings ? 'Ocultar detalle' : 'Ver detalle'}
                        <ChevronDown className={forecastDetailOpen.savings ? 'open' : ''} />
                      </button>
                    </div>
                    <b>{money(monthlySavingsDeposits)}</b>
                  </div>
                  {forecastDetailOpen.savings && <div className="forecast-recurring-detail">
                    <small className="forecast-detail-section-title">Aportes a ahorros del mes</small>
                    {monthlySavingsDetail.map(item => <div className="forecast-detail-item" key={`saving-${item.id}`}><div><strong>{item.description || item.name || 'Aporte a ahorros'}</strong><small>{item.date?.split('-').reverse().join('/') || 'Sin fecha'}</small></div><span>{money(item.amount)}</span></div>)}
                    {!monthlySavingsDetail.length && <p className="forecast-detail-empty">No hay aportes a ahorros registrados durante este mes.</p>}
                  </div>}
                  <div className="forecast-summary-total">
                    <span className="forecast-summary-label">Saldo estimado al cierre <InlineHelp text="Resultado final estimado: saldo actual menos los gastos futuros pendientes. Los ahorros ya están descontados dentro del saldo actual y no se restan nuevamente." /></span>
                    <b className={forecastClosing >= 0 ? 'positive' : 'negative'}>{money(forecastClosing)}</b>
                  </div>
                </div>
                <button type="button" className="secondary forecast-category-trigger" onClick={openForecastCategoryModal}>
                  <Settings2 /> Seleccionar categorías
                </button>
                <span className="forecast-category-summary">
                  {forecastIncludedCategories.length === forecastAvailableCategories.length
                    ? 'Se consideran todas las categorías de egreso.'
                    : `${forecastIncludedCategories.length} de ${forecastAvailableCategories.length} categorías incluidas.`}
                </span>
              </div>
              <div className="chart prediction-mini-chart">
                <ResponsiveContainer>
                  <LineChart data={forecastChartData} margin={{top:8,right:12,left:0,bottom:26}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#203047" />
                    <XAxis dataKey="day" stroke="#7890a8" tick={{fontSize:10}} />
                    <YAxis stroke="#7890a8" tick={{fontSize:10}} tickFormatter={v=>`$${Math.round(v/1000)}k`} />
                    <Tooltip formatter={v=>money(v)} contentStyle={{background:'#071524',border:'1px solid #365b7d',borderRadius:10,color:'#f8fbff',boxShadow:'0 12px 30px rgba(0,0,0,.42)'}} labelStyle={{color:'#f8fbff',fontWeight:800}} itemStyle={{color:'#f8fbff'}} />
                    <Legend verticalAlign="bottom" align="center" height={34} wrapperStyle={{paddingTop:8}} />
                    <Line type="monotone" dataKey="saldoReal" name="Saldo real" stroke="#4ade80" strokeWidth={3} dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="saldoProyectado" name="Saldo proyectado" stroke="#38bdf8" strokeWidth={3} strokeDasharray="7 5" dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <span className="panel-corner-icon forecast-corner"><TrendingUp /></span>
          </article>
        </section>

        <section className="home-quick-section">
          <h3>Accesos rápidos</h3>
          <div className="home-quick-grid">
            <button className="quick-income" onClick={()=>openNew('income')}><ArrowUpCircle/> Nuevo ingreso</button>
            <button className="quick-expense" onClick={()=>openNew('expense')}><ArrowDownCircle/> Nuevo egreso</button>
            <button className="quick-calendar" onClick={()=>setTab('calendar')}><CalendarDays/> Calendario financiero</button>
            <button className="quick-compare" onClick={()=>setTab('compare')}><RefreshCw/> Comparar meses</button>
            <button className="quick-goal" onClick={()=>setTab('goals')}><Target/> Metas de ahorro</button>
            <button className="quick-control" onClick={()=>setTab('control')}><Settings2/> Control</button>
          </div>
        </section>
      </>}
      {tab === 'calendar' && <section className="panel standalone-view calendar-view">
        <div className="panel-title"><div><ChartInfoTitle title="Calendario financiero" text="Resume por día los ingresos, egresos y aportes a ahorros del mes seleccionado." /><span>{month}</span></div><label>Mes <input type="month" value={month} onChange={e=>setMonth(e.target.value)} /></label></div>
        <div className="top-insight-grid">
          <article className="top-insight-card positive"><CardHelp text="Total de ingresos registrados dentro del mes seleccionado."/><span>Ingresos del mes</span><strong>{money(income)}</strong><small>{incomeRows.length} movimientos</small><TrendingUp/></article>
          <article className="top-insight-card negative"><CardHelp text="Total de egresos del mes sin contar los aportes enviados a ahorros."/><span>Egresos del mes</span><strong>{money(expenseWithoutSavings)}</strong><small>{expenseRowsWithoutSavings.length} movimientos</small><TrendingDown/></article>
          <article className="top-insight-card info"><CardHelp text="Cantidad de fechas distintas que tuvieron al menos un movimiento financiero."/><span>Días con movimientos</span><strong>{new Set(monthRows.map(x=>x.date)).size}</strong><small>Actividad registrada</small><CalendarDays/></article>
          <article className="top-insight-card warn"><CardHelp text="Promedio de egresos calculado únicamente sobre los días que tuvieron gastos."/><span>Promedio diario de gasto</span><strong>{money(avgDailyExpense)}</strong><small>Sobre días con egresos</small><CircleDollarSign/></article>
        </div>
        <div className="visual-two-column">
          <article className="visual-card"><div className="panel-title"><div><ChartInfoTitle title="Actividad diaria" text="Compara los ingresos y egresos registrados cada día del mes para detectar jornadas de mayor movimiento."/><span>Ingresos y egresos por día</span></div></div><div className="visual-chart"><ResponsiveContainer><BarChart data={Array.from({length:calendarDays.days},(_,i)=>{const d=i+1;const t=calendarDays.map[d]||{};return{dia:d,ingresos:t.income||0,egresos:t.expense||0}})}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis dataKey="dia" stroke="#7890a8"/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)} contentStyle={{background:'#071524',border:'1px solid #365b7d',borderRadius:10,color:'#f8fbff',boxShadow:'0 12px 30px rgba(0,0,0,.42)'}} labelStyle={{color:'#f8fbff',fontWeight:800}} itemStyle={{color:'#f8fbff'}}/><Legend/><Bar dataKey="ingresos" name="Ingresos" fill="#4ade80" radius={[4,4,0,0]}/><Bar dataKey="egresos" name="Egresos" fill="#fb7185" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></article>
          <article className="visual-card"><div className="panel-title"><div><ChartInfoTitle title="Resumen del mes" text="Destaca los datos más útiles del calendario para interpretar rápidamente la actividad financiera."/></div></div><div className="insight-list"><div className="insight-row"><span>Día con mayor gasto</span><strong>{biggestExpense?.date ? biggestExpense.date.split('-').reverse().join('/') : '—'}</strong></div><div className="insight-row"><span>Mayor gasto individual</span><strong className="negative">{money(biggestExpense?.amount||0)}</strong></div><div className="insight-row"><span>Resultado del mes</span><strong className={(income-expenseWithoutSavings)>=0?'positive':'negative'}>{money(income-expenseWithoutSavings)}</strong></div><div className="insight-row"><span>Días sin movimientos</span><strong>{Math.max(calendarDays.days-new Set(monthRows.map(x=>x.date)).size,0)}</strong></div></div></article>
        </div>
        <div className="calendar-grid">{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(day=><div className="calendar-head" key={day}>{day}</div>)}{Array.from({length:calendarDays.first}).map((_,i)=><div className="calendar-day empty" key={`empty-${i}`}></div>)}{Array.from({length:calendarDays.days},(_,i)=>i+1).map(day=>{ const totals=calendarDays.map[day]||{}; return <article className="calendar-day" key={day}><b>{day}</b>{totals.income>0&&<span className="calendar-value income">+ {money(totals.income)}</span>}{totals.expense>0&&<span className="calendar-value expense">- {money(totals.expense)}</span>}{totals.savings>0&&<span className="calendar-value savings">Ahorro {money(totals.savings)}</span>}</article>})}</div>
      </section>}

      {tab === 'compare' && <section className="panel standalone-view compare-view">
        <div className="panel-title"><div><ChartInfoTitle title="Comparador mensual" text="Compara ingresos, egresos y resultado neto del mes actual contra otro mes seleccionado." /><span>{month} frente a {comparisonMonth}</span></div><label>Comparar con <input type="month" value={comparisonMonth} onChange={e=>setComparisonMonth(e.target.value)} /></label></div>
        <div className="top-insight-grid">
          <article className="top-insight-card positive"><CardHelp text="Cambio porcentual de los ingresos del mes actual respecto del mes elegido para comparar."/><span>Variación de ingresos</span><strong>{previousIncome ? `${(((income-previousIncome)/previousIncome)*100).toFixed(1)}%` : '—'}</strong><small>{money(income-previousIncome)} de diferencia</small><TrendingUp/></article>
          <article className="top-insight-card negative"><CardHelp text="Cambio porcentual de los egresos actuales frente al período comparado, sin incluir aportes a ahorros."/><span>Variación de egresos</span><strong>{previousExpense ? `${(((expenseWithoutSavings-previousExpense)/previousExpense)*100).toFixed(1)}%` : '—'}</strong><small>{money(expenseWithoutSavings-previousExpense)} de diferencia</small><TrendingDown/></article>
          <article className="top-insight-card info"><CardHelp text="Diferencia entre ingresos y egresos del mes actual."/><span>Resultado actual</span><strong>{money(income-expenseWithoutSavings)}</strong><small>Ingreso menos egresos</small><CircleDollarSign/></article>
          <article className="top-insight-card warn"><CardHelp text="Período con el resultado neto más alto entre los dos meses comparados."/><span>Mejor período</span><strong>{(income-expenseWithoutSavings)>=(previousIncome-previousExpense)?month:comparisonMonth}</strong><small>Mayor resultado neto</small><CalendarDays/></article>
        </div>
        <div className="comparison-grid"><article className="comparison-card"><span>Ingresos</span><strong className="positive">{money(income)}</strong><small>Anterior: {money(previousIncome)}</small></article><article className="comparison-card"><span>Egresos</span><strong className="negative">{money(expenseWithoutSavings)}</strong><small>Anterior: {money(previousExpense)}</small></article><article className="comparison-card"><span>Resultado neto</span><strong className={(income-expenseWithoutSavings)>=0?'positive':'negative'}>{money(income-expenseWithoutSavings)}</strong><small>Anterior: {money(previousIncome-previousExpense)}</small></article></div>
        <div className="visual-two-column">
          <article className="visual-card"><div className="panel-title"><div><ChartInfoTitle title="Comparación general" text="Presenta lado a lado los ingresos y egresos de ambos períodos para identificar cambios de escala."/></div></div><div className="visual-chart"><ResponsiveContainer><BarChart data={[{periodo:comparisonMonth,ingresos:previousIncome,egresos:previousExpense},{periodo:month,ingresos:income,egresos:expenseWithoutSavings}]}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis dataKey="periodo" stroke="#7890a8"/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)} contentStyle={{background:'#071524',border:'1px solid #365b7d',borderRadius:10,color:'#f8fbff',boxShadow:'0 12px 30px rgba(0,0,0,.42)'}} labelStyle={{color:'#f8fbff',fontWeight:800}} itemStyle={{color:'#f8fbff'}}/><Legend/><Bar dataKey="ingresos" name="Ingresos" fill="#4ade80" radius={[5,5,0,0]}/><Bar dataKey="egresos" name="Egresos" fill="#fb7185" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></article>
          <article className="visual-card"><div className="panel-title"><div><ChartInfoTitle title="Resultado neto" text="Compara cuánto quedó disponible después de restar los egresos a los ingresos en cada período."/></div></div><div className="visual-chart"><ResponsiveContainer><BarChart data={[{periodo:comparisonMonth,resultado:previousIncome-previousExpense},{periodo:month,resultado:income-expenseWithoutSavings}]}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis dataKey="periodo" stroke="#7890a8"/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)} contentStyle={{background:'#071524',border:'1px solid #365b7d',borderRadius:10,color:'#f8fbff',boxShadow:'0 12px 30px rgba(0,0,0,.42)'}} labelStyle={{color:'#f8fbff',fontWeight:800}} itemStyle={{color:'#f8fbff'}}/><Bar dataKey="resultado" name="Resultado neto" fill="#38bdf8" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></article>
        </div>
      </section>}

      {tab === 'goals' && <section className="panel standalone-view goals-view">
        <div className="panel-title"><div><ChartInfoTitle title="Metas de ahorro" text="Organiza objetivos por prioridad y distribuye automáticamente el saldo disponible entre ellos." /><span>Saldo disponible: {money(savingsBalance)}</span></div></div>
        <div className="top-insight-grid">
          <article className="top-insight-card positive"><CardHelp text="Dinero acumulado actualmente en el fondo de ahorros y disponible para asignar a objetivos."/><span>Saldo disponible</span><strong>{money(savingsBalance)}</strong><small>Para distribuir entre metas</small><PiggyBank/></article>
          <article className="top-insight-card info"><CardHelp text="Cantidad total de metas creadas y cuántas ya alcanzaron el 100%."/><span>Metas activas</span><strong>{allocatedSavingsGoals.length}</strong><small>{allocatedSavingsGoals.filter(x=>x.completed).length} completadas</small><Target/></article>
          <article className="top-insight-card warn"><CardHelp text="Suma de los importes objetivo de todas las metas registradas."/><span>Objetivo total</span><strong>{money(allocatedSavingsGoals.reduce((sum,x)=>sum+Number(x.target||0),0))}</strong><small>Suma de todas las metas</small><CircleDollarSign/></article>
          <article className="top-insight-card negative"><CardHelp text="Dinero que todavía falta acumular para completar todas las metas."/><span>Monto pendiente</span><strong>{money(allocatedSavingsGoals.reduce((sum,x)=>sum+Number(x.remaining||0),0))}</strong><small>Falta para completar todo</small><TrendingUp/></article>
        </div>
        <div className="goal-overview-grid">
          <article className="visual-card"><div className="panel-title"><div><ChartInfoTitle title="Avance por objetivo" text="Compara el dinero ya asignado y el monto que todavía falta para completar cada meta."/></div></div><div className="visual-chart"><ResponsiveContainer><BarChart data={allocatedSavingsGoals.slice(0,8).map(g=>({meta:g.name,asignado:g.allocated,pendiente:g.remaining}))} layout="vertical" margin={{left:18,right:18}}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><YAxis type="category" dataKey="meta" width={120} stroke="#7890a8" tick={{fontSize:11}}/><Tooltip formatter={v=>money(v)} contentStyle={{background:'#071524',border:'1px solid #365b7d',borderRadius:10,color:'#f8fbff',boxShadow:'0 12px 30px rgba(0,0,0,.42)'}} labelStyle={{color:'#f8fbff',fontWeight:800}} itemStyle={{color:'#f8fbff'}}/><Legend/><Bar dataKey="asignado" name="Asignado" stackId="a" fill="#4ade80"/><Bar dataKey="pendiente" name="Pendiente" stackId="a" fill="#334b68" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div></article>
          <article className="visual-card"><div className="panel-title"><div><ChartInfoTitle title="Plan sugerido" text="Usa el ahorro mensual recomendado de Análisis de finanzas. Se consideran únicamente meses cerrados con ingresos, egresos y saldo positivo; luego se toma el menor valor entre el promedio, la mediana y el percentil 25 para mantener una estimación prudente."/></div></div><div className="insight-list"><div className="insight-row"><span>Ahorro mensual recomendado</span><strong className={selectedSavingsCapacity>=0?'positive':'negative'}>{money(Math.max(selectedSavingsCapacity,0))}</strong></div><div className="insight-row"><span>Meses para completar todo</span><strong>{selectedSavingsCapacity>0 ? Math.ceil(allocatedSavingsGoals.reduce((s,g)=>s+g.remaining,0)/selectedSavingsCapacity) : '—'}</strong></div><div className="insight-row"><span>Meta prioritaria</span><strong>{allocatedSavingsGoals[0]?.name||'Sin meta'}</strong></div><div className="insight-row"><span>Progreso global</span><strong>{allocatedSavingsGoals.reduce((s,g)=>s+Number(g.target||0),0)>0 ? `${((allocatedSavingsGoals.reduce((s,g)=>s+g.allocated,0)/allocatedSavingsGoals.reduce((s,g)=>s+Number(g.target||0),0))*100).toFixed(1)}%` : '0%'}</strong></div></div></article>
        </div>
        <form className="category-form goals-form" onSubmit={saveSavingsGoal}><label className="grow">Nombre de la meta<input value={goalForm.name} onChange={e=>setGoalForm({...goalForm,name:e.target.value})} placeholder="Ej. Fondo de emergencia" required /></label><label>Monto objetivo<input type="number" min="0" step="0.01" value={goalForm.target} onChange={e=>setGoalForm({...goalForm,target:e.target.value})} placeholder="0,00" required /></label><label>Prioridad<input type="number" min="1" step="1" value={goalForm.priority} onChange={e=>setGoalForm({...goalForm,priority:e.target.value})} /></label><button type="submit"><Plus/> Agregar meta</button></form>
        <div className="goal-grid">{allocatedSavingsGoals.map(goal=><article className={`goal-card ${goal.completed ? 'completed' : ''}`} key={goal.id}><header><div className="goal-card-main"><div className="goal-title-line"><h3>{goal.completed?'✓ ':''}{goal.name}</h3></div><div className="goal-target"><span>Objetivo</span><strong>{money(goal.target)}</strong></div></div><div className="goal-actions"><span className="goal-priority">Prioridad {goal.priority}</span><button className="ghost" type="button" onClick={()=>moveSavingsGoal(goal.id,-1)} aria-label="Subir prioridad">↑</button><button className="ghost" type="button" onClick={()=>moveSavingsGoal(goal.id,1)} aria-label="Bajar prioridad">↓</button><button className="ghost danger" type="button" onClick={()=>removeSavingsGoal(goal.id)} aria-label="Eliminar meta"><Trash2/></button></div></header><div className="goal-progress-head"><span>Progreso</span><strong>{goal.progress.toFixed(1)}%</strong></div><div className="goal-progress"><div style={{width:`${goal.progress}%`}}></div></div><div className="goal-stat-grid"><div><span>Asignado</span><b className="positive">{money(goal.allocated)}</b></div><div><span>Restante</span><b>{money(goal.remaining)}</b></div><div><span>Estado</span><b>{goal.completed?'Completada':'En progreso'}</b></div></div></article>)}{!allocatedSavingsGoals.length&&<><div className="empty-card">Todavía no existen metas de ahorro.</div><div className="goal-empty-advice"><article><b>Fondo de emergencia</b><span>Una primera meta útil es cubrir entre tres y seis meses de gastos habituales.</span></article><article><b>Objetivo concreto</b><span>Definir nombre, monto y prioridad facilita medir el progreso y mantener constancia.</span></article><article><b>Aporte mensual</b><span>Reservar una cantidad fija al cobrar ayuda a avanzar antes de realizar otros gastos.</span></article></div></>}</div>
      </section>}

      {tab === 'analysis' && <>
        <section className="kpis extended" style={{"--card-cursor":"help"}}>
          <article><CardHelp text="Suma de los promedios mensuales de las categorías de ingreso actualmente seleccionadas en la tabla. Cada categoría se promedia únicamente sobre sus meses activos." /><span>Ingreso mensual promedio</span><strong className="positive">{money(selectedIncomeTotal)}</strong><TrendingUp /><small>{selectedIncomeAnalysis.length} categorías seleccionadas</small></article>
          <article><CardHelp text="Suma de los promedios mensuales de las categorías de egreso actualmente seleccionadas en la tabla. No incluye el margen adicional del 20% ni los aportes enviados a ahorros." /><span>Egreso mensual promedio</span><strong className="negative">{money(selectedExpenseAverageTotal)}</strong><TrendingDown /><small>{selectedReserveExpenses.length} categorías seleccionadas · sin considerar ahorros</small></article>
          <article><CardHelp text="Estimación prudente basada en meses cerrados con ingresos, egresos y saldo positivo. Se utiliza el menor valor entre el promedio, la mediana y el percentil 25, evitando que un mes incompleto o deficitario lleve automáticamente la recomendación a cero." /><span>Ahorro mensual recomendado</span><strong className={selectedSavingsCapacity >= 0 ? 'positive' : 'negative'}>{money(selectedSavingsCapacity)}</strong><CircleDollarSign /><small>{selectedSavingsRate.toFixed(1)}% del ingreso seleccionado · criterio conservador</small></article>
          <article><CardHelp text="Monto recomendado para cubrir tres meses de los egresos promedio seleccionados. Se calcula multiplicando el egreso mensual promedio seleccionado por 3." /><span>Fondo de emergencia sugerido</span><strong>{money(selectedEmergencyFund)}</strong><WalletCards /><small>3 meses de egresos seleccionados</small></article>
          <article><CardHelp text="Suma del dinero sugerido para reservar únicamente en las categorías seleccionadas. Cada categoría usa su promedio mensual activo más un 20% de margen." /><span>Presupuesto mensual seleccionado</span><strong>{money(selectedReserveTotal)}</strong><FolderCog /><small>{selectedReserveExpenses.length} categorías incluidas</small></article>
          <article><CardHelp text="Compara el promedio de egresos de los últimos tres meses con el promedio histórico. Un porcentaje positivo indica que los gastos recientes aumentaron." /><span>Tendencia reciente de gastos</span><strong className={financeAnalysis.expenseTrend <= 0 ? 'positive' : 'negative'}>{financeAnalysis.expenseTrend >= 0 ? '+' : ''}{financeAnalysis.expenseTrend.toFixed(1)}%</strong><TrendingDown /><small>Últimos 3 meses contra promedio histórico</small></article>
        </section>

        <section className="charts dashboard-grid">
          <article className="panel span2"><div className="panel-title"><div><ChartInfoTitle title="Evolución histórica de ingresos y egresos" text="Compara mes a mes los ingresos totales con los egresos reales sin incluir aportes a ahorros. Permite identificar tendencias, picos de gasto y meses con mayor capacidad de ahorro." /><span>Comparación mensual para detectar tendencias</span></div></div><div className="chart tall"><ResponsiveContainer><BarChart data={financeAnalysis.analysisMonthTotals}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis dataKey="month" stroke="#7890a8"/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)}/><Legend/><Bar dataKey="ingresos" name="Ingresos" fill="#4ade80" radius={[5,5,0,0]}/><Bar dataKey="egresos" name="Egresos sin ahorros" fill="#fb7185" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></article>

          <article className="panel span2"><div className="panel-title"><div><ChartInfoTitle title="Cuánto reservar por categoría" text="Muestra el promedio mensual de cada categoría seleccionada y la reserva sugerida, que incorpora un margen adicional del 20% para cubrir variaciones." /><span>{selectedReserveExpenses.length} categorías seleccionadas · Total {money(selectedReserveTotal)}</span></div></div><div className="chart tall"><ResponsiveContainer><BarChart data={selectedReserveExpenses.slice(0,12)} layout="vertical" margin={{left:20,right:20}}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><YAxis type="category" dataKey="name" width={115} stroke="#7890a8" tick={{fontSize:10}}/><Tooltip formatter={(v,name)=>[money(v),name]}/><Legend/><Bar dataKey="averageMonthly" name="Promedio mensual" fill="#38bdf8" radius={[0,5,5,0]}/><Bar dataKey="suggestedReserve" name="Reserva sugerida" fill="#f59e0b" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div></article>
        </section>

        <section className="panel table-panel analysis-table-panel reserve-analysis-panel">
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

          <div className="table-wrap analysis-table-wrap">
            <table className="analysis-data-table reserve-analysis-table">
              <thead>
                <tr>
                  <th>Incluir</th>
                  <th>Categoría</th>
                  <th className="right">Meses<br/>activos</th>
                  <th className="right">Promedio<br/>mensual</th>
                  <th className="right">Máximo<br/>mensual</th>
                  <th className="right">Promedio<br/>por gasto</th>
                  <th className="right">Margen<br/>20%</th>
                  <th className="right">% del<br/>total</th>
                  <th>Prioridad</th>
                  <th className="right">Reserva<br/>mensual</th>
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
                        ? <span className="priority-badge" title="Prioridad calculada según el peso dentro de las categorías seleccionadas"><span aria-hidden="true">{priority.icon}</span>{priority.label}</span>
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

        <section className="panel table-panel analysis-table-panel income-analysis-panel">
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

          <div className="table-wrap analysis-table-wrap">
            <table className="analysis-data-table income-analysis-table">
              <thead>
                <tr>
                  <th>Incluir</th>
                  <th>Categoría</th>
                  <th className="right">Meses<br/>activos</th>
                  <th className="right">Promedio<br/>mensual</th>
                  <th className="right">Máximo<br/>mensual</th>
                  <th className="right">Promedio<br/>por ingreso</th>
                  <th className="right">% del<br/>total</th>
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
                        ? <span className="priority-badge" title="Prioridad calculada según el peso de esta fuente dentro de los ingresos seleccionados"><span aria-hidden="true">{priority.icon}</span>{priority.label}</span>
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
        <section className="panel unusual-expenses-panel">
          <div className="panel-title"><div><h3>Detección de gastos inusuales</h3><span>Importes muy superiores al promedio o posibles duplicados del mes</span></div><AlertTriangle /></div>
          <div className="unusual-grid">
            {unusualExpenses.slice(0,6).map(item=><article className="unusual-card" key={item.id}><div><b>{item.description}</b><small>{item.category} · {item.date?.split('-').reverse().join('/')}</small></div><strong>{money(item.amount)}</strong><p>{item.reasons.join(' · ')}</p></article>)}
            {!unusualExpenses.length && <div className="empty-card">No se detectaron gastos inusuales en el período seleccionado.</div>}
          </div>
        </section>
        <section className="kpis compact-kpis category-kpis">
          <article><CardHelp text="Suma de todos los egresos individuales, excluyendo movimientos de ahorro." /><span>Total histórico de gastos</span><strong className="negative">{money(bigExpenses.reduce((s, x) => s + Number(x.amount), 0))}</strong><TrendingDown /><small>{bigExpenses.length} movimientos visibles</small></article>
          <article><CardHelp text="Gasto individual de mayor importe registrado." /><span>Mayor gasto registrado</span><strong className="negative">{money(bigExpenses[0]?.amount || 0)}</strong><ReceiptText /><small>{bigExpenses[0]?.description || 'Sin datos'}</small></article>
          <article><CardHelp text="Promedio de los gastos individuales actualmente visibles." /><span>Promedio por gasto</span><strong>{money(bigExpenses.length ? bigExpenses.reduce((s, x) => s + Number(x.amount), 0) / bigExpenses.length : 0)}</strong><CircleDollarSign /><small>Según filtros aplicados</small></article>
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
          <article><CardHelp text="Dinero actualmente acumulado en ahorros. Se calcula sumando todos los aportes y restando todos los retiros." /><span>Saldo en ahorros</span><strong className="positive">{money(savingsBalance)}</strong><PiggyBank /><small>Disponible en el fondo</small></article>
          <article><CardHelp text="Suma histórica de todos los aportes realizados al fondo de ahorro." /><span>Total guardado</span><strong>{money(savingsDeposits)}</strong><TrendingUp /><small>{savingsMovements.filter(x => savingsKind(x) === 'deposit').length} aportes</small></article>
          <article><CardHelp text="Suma histórica de todos los retiros realizados desde el fondo de ahorro." /><span>Total retirado</span><strong className="negative">{money(savingsWithdrawals)}</strong><TrendingDown /><small>{savingsMovements.filter(x => savingsKind(x) === 'withdrawal').length} retiros</small></article>
        </section>

        <section className="entry-grid savings-entry-section">
          <article className="panel entry-card savings-entry-card">
            <div className="entry-icon"><PiggyBank /></div>
            <h2>Movimiento de ahorros</h2>
            <p>Guardar dinero reduce el saldo disponible. Retirarlo devuelve el dinero al saldo general.</p>
            <form className="category-form savings-account-form" onSubmit={saveSavingsMovement} style={{ alignItems: 'end' }}>
              <label>Operación
                <select value={savingsForm.kind} onChange={e => setSavingsForm({ ...savingsForm, kind: e.target.value })}>
                  <option value="deposit">Guardar en ahorros</option>
                  <option value="withdrawal">Retirar de ahorros</option>
                </select>
              </label>
              <label>Origen
                <select value={savingsForm.from_account_id} onChange={e => setSavingsForm({ ...savingsForm, from_account_id: e.target.value })} required>
                  <option value="">Seleccionar cuenta</option>
                  {accounts.map(account => <option key={`savings-from-${account.id}`} value={account.id}>{account.name}</option>)}
                </select>
              </label>
              <label>Destino
                <select value={savingsForm.to_account_id} onChange={e => setSavingsForm({ ...savingsForm, to_account_id: e.target.value })} required>
                  <option value="">Seleccionar cuenta</option>
                  {accounts.map(account => <option key={`savings-to-${account.id}`} value={account.id}>{account.name}</option>)}
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
            <small className="savings-account-note">
              Si origen y destino son la misma cuenta, el ahorro se registra pero el saldo de esa cuenta no cambia. Si son diferentes, el importe se descuenta del origen y se suma al destino.
            </small>
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
            {allocatedSavingsGoals.map(goal => <article className={`goal-card ${goal.completed ? 'completed' : ''}`} key={goal.id}>
              <header>
                <div className="goal-card-main">
                  <div className="goal-title-line">
                    <h3>{goal.completed ? '✓ ' : ''}{goal.name}</h3>
                  </div>
                  <div className="goal-target"><span>Objetivo</span><strong>{money(goal.target)}</strong></div>
                </div>
                <div className="goal-actions">
                  <span className="goal-priority">Prioridad {goal.priority}</span>
                  <button className="ghost" type="button" onClick={() => moveSavingsGoal(goal.id, -1)} aria-label="Subir prioridad">↑</button>
                  <button className="ghost" type="button" onClick={() => moveSavingsGoal(goal.id, 1)} aria-label="Bajar prioridad">↓</button>
                  <button className="ghost danger" type="button" onClick={() => removeSavingsGoal(goal.id)} aria-label="Eliminar meta"><Trash2 /></button>
                </div>
              </header>
              <div className="goal-progress-head"><span>Progreso</span><strong>{goal.progress.toFixed(1)}%</strong></div>
              <div className="goal-progress"><div style={{ width: `${goal.progress}%` }}></div></div>
              <div className="goal-stat-grid">
                <div><span>Asignado</span><b className="positive">{money(goal.allocated)}</b></div>
                <div><span>Restante</span><b>{money(goal.remaining)}</b></div>
                <div><span>Estado</span><b>{goal.completed ? 'Completada' : 'En progreso'}</b></div>
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
            <article><CardHelp text="Dinero disponible que se arrastra desde el cierre del mes anterior. Desde mayo parte del saldo final real de abril y continúa acumulándose mes a mes." /><span>Saldo mes anterior</span><strong>{money(openingBalance)}</strong><WalletCards /><small>{month === DATA_START ? 'Mes inicial' : 'Arrastre automático'}</small></article>
            <article><CardHelp text="Suma de todos los movimientos de tipo ingreso registrados en el mes seleccionado." /><span>Ingresos del mes</span><strong className="positive">{money(income)}</strong><ArrowUpCircle /><small>{incomeRows.length} registros</small></article>
            <article><CardHelp text="Suma de los egresos reales del mes, excluyendo el dinero enviado a ahorros." /><span>Egresos del mes</span><strong className="negative">{money(expenseWithoutSavings)}</strong><ArrowDownCircle /><small>{expenseRowsWithoutSavings.length} registros · sin considerar ahorros</small></article>
            <article><CardHelp text="Dinero enviado al fondo de ahorros durante el mes seleccionado. Se calcula sumando únicamente los movimientos de tipo Guardar en ahorros del período." /><span>Dinero enviado a los ahorros</span><strong className="positive">{money(monthlySavingsDeposits)}</strong><PiggyBank /><small>Aportes realizados en {month}</small></article>
            <article><CardHelp text="Saldo final del mes. Se calcula como saldo anterior + ingresos del mes - egresos del mes - dinero enviado a ahorros + retiros de ahorros." /><span>Saldo final disponible</span><strong className={closingBalance >= 0 ? 'positive' : 'negative'}>{money(closingBalance)}</strong><CircleDollarSign /><small>Saldo anterior + ingresos - egresos</small></article>
            <article><CardHelp text="Resultado del mes sin considerar el saldo anterior. Se calcula como ingresos del mes menos egresos del mes." /><span>Resultado propio del mes</span><strong className={monthlyNet >= 0 ? 'positive' : 'negative'}>{money(monthlyNet)}</strong><TrendingUp /><small>Sin contar saldo anterior</small></article>
            <article><CardHelp text="Porcentaje de los fondos disponibles que quedó sin gastar. Se calcula como saldo final dividido por saldo anterior más ingresos del mes." /><span>Porcentaje disponible</span><strong className={savingRate >= 0 ? 'positive' : 'negative'}>{savingRate.toFixed(1)}%</strong><TrendingUp /><small>Sobre fondos disponibles</small></article>
            <article><CardHelp text="Promedio gastado por cada día con egresos, excluyendo los aportes enviados a ahorros." /><span>Promedio diario de egresos</span><strong>{money(avgDailyExpense)}</strong><CalendarDays /><small>{daysWithExpense} días con gastos · sin considerar ahorros</small></article>
            <article><CardHelp text="Movimiento individual de egreso más alto del mes, excluyendo los aportes enviados a ahorros." /><span>Mayor gasto</span><strong className="negative">{money(biggestExpense?.amount || 0)}</strong><TrendingDown /><small>{biggestExpense?.description || 'Sin gastos'} · sin considerar ahorros</small></article>
            <article><CardHelp text="Categoría con mayor gasto del mes, excluyendo los aportes enviados a ahorros." /><span>Categoría con mayor gasto</span><strong className="negative">{money(topExpenseCategory?.value || 0)}</strong><FolderCog /><small>{topExpenseCategory?.name || 'Sin datos'} · {expenseConcentration.toFixed(1)}% del total · sin considerar ahorros</small></article>
          </section>

          <section className="charts dashboard-grid dashboard-wide-grid">
            <article className="panel full-width-chart"><div className="panel-title"><div><ChartInfoTitle title="Balance diario del mes" text="Representa cómo evoluciona el saldo disponible durante cada día del mes, sumando ingresos y restando egresos acumulados." /><span>El eje muestra el mes completo; la curva llega hasta el día actual</span></div></div><div className="chart tall"><ResponsiveContainer><AreaChart data={daily} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" dataKey="day" domain={[1, daysInSelectedMonth]} ticks={dayTicks} interval={0} allowDecimals={false} stroke="#7890a8" tick={{ fontSize: 10 }}/><YAxis stroke="#7890a8" width={72} tickFormatter={v => `$${Math.round(v/1000)}k`}/><Tooltip formatter={v => money(v)} labelFormatter={d => `Día ${Number(d)}`}/><Area type="monotone" dataKey="acumulado" name="Saldo disponible" stroke="#4ade80" fill="#4ade8033" strokeWidth={3}/></AreaChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><ChartInfoTitle title="Gastos por categoría" text="Distribuye el total mensual de egresos entre las distintas categorías para mostrar cuáles concentran la mayor parte del gasto." /><span>Participación sobre el total mensual</span></div></div><div className="chart"><ResponsiveContainer><PieChart><Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={46} outerRadius={88}>{byCategory.map((_,i)=><Cell key={i} fill={palette[i%palette.length]}/>)}</Pie><Tooltip formatter={v=>money(v)}/></PieChart></ResponsiveContainer></div><div className="legend compact-legend">{byCategory.slice(0,8).map((x,i)=><span key={x.name}><i style={{background:palette[i%palette.length]}}></i>{x.name}<b>{money(x.value)}</b></span>)}</div></article>

            <article className="panel"><div className="panel-title"><div><ChartInfoTitle title="Ingresos por categoría" text="Muestra cómo se distribuyen los ingresos del mes según su categoría u origen." /><span>Participación sobre el total mensual</span></div></div><div className="chart"><ResponsiveContainer><PieChart><Pie data={incomeByCategory} dataKey="value" nameKey="name" innerRadius={46} outerRadius={88}>{incomeByCategory.map((_,i)=><Cell key={i} fill={palette[(i+2)%palette.length]}/>)}</Pie><Tooltip formatter={v=>money(v)}/></PieChart></ResponsiveContainer></div><div className="legend compact-legend">{incomeByCategory.slice(0,8).map((x,i)=><span key={x.name}><i style={{background:palette[(i+2)%palette.length]}}></i>{x.name}<b>{money(x.value)}</b></span>)}</div></article>

            <article className="panel"><div className="panel-title"><div><ChartInfoTitle title="Mayores gastos individuales" text="Ordena los diez egresos individuales más altos del período para detectar rápidamente los movimientos de mayor impacto." /><span>Los 10 movimientos de mayor importe · sin considerar ahorros</span></div></div><div className="chart"><ResponsiveContainer><BarChart data={topExpenseItems} layout="vertical" margin={{ left: 18, right: 16 }}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><YAxis type="category" dataKey="name" width={105} stroke="#7890a8" tick={{fontSize:10}}/><Tooltip formatter={(v, _name, item)=>[money(v), item?.payload?.category || 'Egreso']}/><Bar dataKey="value" name="Monto" fill="#fb7185" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><ChartInfoTitle title="Ingresos por categoría" text="Muestra cómo se distribuyen los ingresos del mes según su categoría u origen." /><span>Origen de los fondos del mes</span></div></div><div className="chart"><ResponsiveContainer><BarChart data={incomeByCategory.slice(0,10)} layout="vertical" margin={{ left: 20, right: 16 }}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><YAxis type="category" dataKey="name" width={115} stroke="#7890a8" tick={{fontSize:10}}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="value" name="Ingresos" fill="#4ade80" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><ChartInfoTitle title="Ingresos y egresos diarios" text="Compara los ingresos y egresos registrados en cada día del mes para detectar jornadas con mayor movimiento de dinero." /><span>Comparación por día</span></div></div><div className="chart"><ResponsiveContainer><BarChart data={daily} margin={{ right: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" dataKey="day" domain={[1, daysInSelectedMonth]} ticks={dayTicks} interval={0} allowDecimals={false} stroke="#7890a8" tick={{fontSize:9}}/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)}/><Legend/><Bar dataKey="ingresos" fill="#4ade80"/><Bar dataKey="egresos" fill="#fb7185"/></BarChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><ChartInfoTitle title="Ingresos vs. egresos acumulados" text="Compara la acumulación progresiva de ingresos y egresos dentro del mes y permite observar en qué momento una curva supera a la otra." /><span>Evolución dentro del mes</span></div></div><div className="chart"><ResponsiveContainer><LineChart data={daily}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" dataKey="day" domain={[1, daysInSelectedMonth]} ticks={dayTicks} interval={0} allowDecimals={false} stroke="#7890a8" tick={{fontSize:9}}/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)}/><Legend/><Line type="monotone" dataKey="ingresosAc" name="Ingresos acumulados" stroke="#4ade80" strokeWidth={3} dot={false}/><Line type="monotone" dataKey="egresosAc" name="Egresos acumulados" stroke="#fb7185" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><ChartInfoTitle title="Saldo acumulado por mes" text="Muestra el saldo final alcanzado al cierre de cada mes, incluyendo el arrastre del saldo anterior." /><span>Desde abril de 2026</span></div></div><div className="chart"><ResponsiveContainer><BarChart data={monthTotals}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis dataKey="month" stroke="#7890a8"/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="saldoFinal" name="Saldo final" fill="#22c55e" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></article>

            <article className="panel"><div className="panel-title"><div><ChartInfoTitle title="Evolución mensual completa" text="Presenta conjuntamente ingresos, egresos, resultado mensual y saldo acumulado para analizar la evolución financiera general." /><span>Ingresos, egresos, resultado y saldo</span></div></div><div className="chart"><ResponsiveContainer><LineChart data={monthTotals}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis dataKey="month" stroke="#7890a8"/><YAxis stroke="#7890a8" tickFormatter={v=>`$${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v)}/><Legend/><Line type="monotone" dataKey="ingresos" stroke="#4ade80" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="egresos" stroke="#fb7185" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="neto" name="Resultado mensual" stroke="#38bdf8" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="saldoFinal" name="Saldo acumulado" stroke="#f59e0b" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div></article>
          </section>
          <GeneralBalanceTable openingBalance={openingBalance} incomeByCategory={incomeByCategory} expenseByCategory={byCategory} closingBalance={closingBalance} monthlySavingsDeposits={monthlySavingsDeposits}/>
        </>}

        {dashboardView === 'expenses' && <>
          <section className="kpis compact-kpis category-kpis">
            <article><CardHelp text="Suma de todos los egresos reales del mes seleccionado, excluyendo aportes a ahorros." /><span>Total de egresos</span><strong className="negative">{money(expenseWithoutSavings)}</strong><TrendingDown /><small>{expenseRowsWithoutSavings.length} movimientos · sin considerar ahorros</small></article>
            <article><CardHelp text="Monto promedio de cada egreso real del mes, excluyendo aportes a ahorros." /><span>Promedio por movimiento</span><strong>{money(expenseRowsWithoutSavings.length ? expenseWithoutSavings / expenseRowsWithoutSavings.length : 0)}</strong><CircleDollarSign /><small>Ticket promedio · sin considerar ahorros</small></article>
            <article><CardHelp text="Categoría que acumuló el mayor monto de egresos durante el mes seleccionado." /><span>Mayor categoría</span><strong className="negative">{money(topExpenseCategory?.value || 0)}</strong><TrendingDown /><small>{topExpenseCategory?.name || 'Sin datos'}</small></article>
          </section>
          <CategoryBreakdown title="Egresos desglosados por categoría" rows={expenseRows} type="expense" />
        </>}

        {dashboardView === 'incomes' && <>
          <section className="kpis compact-kpis category-kpis">
            <article><CardHelp text="Suma de todos los ingresos del mes seleccionado, sin incluir retiros desde ahorros." /><span>Total de ingresos</span><strong className="positive">{money(income)}</strong><TrendingUp /><small>{incomeRows.length} movimientos</small></article>
            <article><CardHelp text="Monto promedio de cada ingreso del mes. Se calcula dividiendo el total de ingresos por la cantidad de movimientos." /><span>Promedio por movimiento</span><strong>{money(incomeRows.length ? income / incomeRows.length : 0)}</strong><CircleDollarSign /><small>Ingreso promedio</small></article>
            <article><CardHelp text="Categoría que acumuló el mayor monto de ingresos durante el mes seleccionado." /><span>Mayor categoría</span><strong className="positive">{money(topIncomeCategory?.value || 0)}</strong><TrendingUp /><small>{topIncomeCategory?.name || 'Sin datos'}</small></article>
          </section>
          <CategoryBreakdown title="Ingresos desglosados por categoría" rows={incomeRows} type="income" />
        </>}
      </>}

      {tab === 'cargar' && <section className="entry-grid">
        <article className="panel entry-card income-card"><CardHelp text="Acceso rápido para registrar un nuevo ingreso y asignarlo a una cuenta y categoría." /><div className="entry-icon"><ArrowUpCircle /></div><h2>Cargar ingreso</h2><p>Registrar sueldos, rendimientos, préstamos devueltos u otros ingresos.</p><div className="category-preview">{categories.filter(c => c.type === 'income').slice(0, 8).map(c => <span key={c.id}>{c.name}</span>)}</div><button onClick={() => openNew('income')}><Plus /> Nuevo ingreso</button></article>
        <article className="panel entry-card expense-card"><CardHelp text="Acceso rápido para registrar un nuevo egreso y asignarlo a una cuenta y categoría." /><div className="entry-icon"><ArrowDownCircle /></div><h2>Cargar egreso</h2><p>Registrar compras, servicios, viajes, cuotas y cualquier otro gasto.</p><div className="category-preview">{categories.filter(c => c.type === 'expense').slice(0, 8).map(c => <span key={c.id}>{c.name}</span>)}</div><button onClick={() => openNew('expense')}><Plus /> Nuevo egreso</button></article>
        <article className="panel recent-card"><CardHelp text="Resume la actividad financiera más reciente para revisar rápidamente ingresos y egresos cargados." /><div className="panel-title"><h3>Últimos movimientos</h3><span>Actividad reciente</span></div>{movements.slice(0, 8).map(m => <div className="recent-row" key={m.id}><div><b>{m.description}</b><small>{m.categories?.name} · {m.date?.split('-').reverse().join('/')}</small></div><strong className={m.type === 'income' ? 'positive' : 'negative'}>{m.type === 'income' ? '+' : '-'}{money(m.amount)}</strong></div>)}</article>
      </section>}

      {tab === 'income' && <TransactionsTable rows={incomeRows} title="Ingresos" type="income" search={search} setSearch={setSearch} onEdit={m => { setEditing(m); setNewType('income'); setModal(true) }} onDelete={remove} onQuickSave={quickSaveMovement} categories={categories} />}
      {tab === 'expense' && <TransactionsTable rows={expenseRows} title="Egresos" type="expense" search={search} setSearch={setSearch} onEdit={m => { setEditing(m); setNewType('expense'); setModal(true) }} onDelete={remove} onQuickSave={quickSaveMovement} categories={categories} />}

      {tab === 'recurring' && <section className="panel standalone-view commitments-view">
        <div className="panel-title"><div><h2>Pagos recurrentes</h2><span>Servicios, alquileres, seguros y otros compromisos mensuales</span></div><Repeat2 /></div>
        <form className="commitment-form" onSubmit={saveRecurringPayment}>
          <label>Nombre<input value={recurringForm.name} onChange={e=>setRecurringForm({...recurringForm,name:e.target.value})} placeholder="Ej. Internet" /></label>
          <label>Monto<input type="number" min="0" step="0.01" value={recurringForm.amount} onChange={e=>setRecurringForm({...recurringForm,amount:e.target.value})} placeholder="0,00" /></label>
          <label>Día de vencimiento<input type="number" min="1" max="31" value={recurringForm.day} onChange={e=>setRecurringForm({...recurringForm,day:e.target.value})} /></label>
          <label>Categoría<input value={recurringForm.category} onChange={e=>setRecurringForm({...recurringForm,category:e.target.value})} placeholder="Ej. Servicios" /></label>
          <label>Cuenta<select value={recurringForm.account_id} onChange={e=>setRecurringForm({...recurringForm,account_id:e.target.value})}><option value="">Sin asignar</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <button><Plus/> Agregar pago</button>
        </form>
        <div className="commitment-summary"><KpiInfoCard title="Compromiso mensual" value={money(recurringPayments.filter(x=>x.active!==false).reduce((s,x)=>s+Number(x.amount||0),0))} detail={`${recurringPayments.filter(x=>x.active!==false).length} pagos activos`} icon={<Repeat2/>} tone="info" help="Suma todos los pagos recurrentes activos configurados."/><KpiInfoCard title="Próximo vencimiento" value={scheduledCommitments.find(x=>x.kind==='recurrente') ? `Día ${scheduledCommitments.find(x=>x.kind==='recurrente').day}` : 'Sin vencimientos'} detail={scheduledCommitments.find(x=>x.kind==='recurrente')?.name || 'No hay pagos pendientes'} icon={<CalendarDays/>} tone="warning" help="Muestra el siguiente pago recurrente pendiente del mes."/></div>
        <div className="commitment-list">{recurringPayments.map(item=><article className={`commitment-card ${item.active===false?'disabled':''}`} key={item.id}><div><b>{item.name}</b><small>{item.category||'Sin categoría'} · vence el día {item.day}</small></div><strong>{money(item.amount)}</strong><div className="row-actions"><button type="button" className="ghost" onClick={()=>toggleRecurringPayment(item)}>{item.active===false?'Activar':'Pausar'}</button><button type="button" className="ghost danger" onClick={()=>removeRecurringPayment(item.id)}><Trash2/></button></div></article>)}{!recurringPayments.length&&<div className="empty-card">Todavía no hay pagos recurrentes configurados.</div>}</div>
      </section>}

      {tab === 'credit' && <section className="panel standalone-view commitments-view">
        <div className="panel-title"><div><h2>Cuotas y tarjetas de crédito</h2><span>Compras financiadas y dinero comprometido para los próximos meses</span></div><CreditCard /></div>
        <form className="credit-form" onSubmit={saveCreditPlan}>
          <label>Compra<input value={creditForm.description} onChange={e=>setCreditForm({...creditForm,description:e.target.value})} placeholder="Ej. Heladera" /></label>
          <label>Tarjeta<input value={creditForm.card} onChange={e=>setCreditForm({...creditForm,card:e.target.value})} placeholder="Ej. Visa Banco" /></label>
          <label>Importe total<input type="number" min="0" value={creditForm.total} onChange={e=>setCreditForm({...creditForm,total:e.target.value})} /></label>
          <label>Cuotas<input type="number" min="1" value={creditForm.installments} onChange={e=>setCreditForm({...creditForm,installments:e.target.value})} /></label>
          <label>Pagadas<input type="number" min="0" value={creditForm.paid} onChange={e=>setCreditForm({...creditForm,paid:e.target.value})} /></label>
          <label>Mes inicial<input type="month" value={creditForm.start_month} onChange={e=>setCreditForm({...creditForm,start_month:e.target.value})} /></label>
          <label>Día de vencimiento<input type="number" min="1" max="31" value={creditForm.due_day} onChange={e=>setCreditForm({...creditForm,due_day:e.target.value})} /></label>
          <button><Plus/> Agregar compra</button>
        </form>
        <div className="commitment-summary"><KpiInfoCard title="Saldo pendiente" value={money(creditPlans.reduce((s,x)=>s+(Number(x.total)||0)*(1-(Number(x.paid)||0)/Math.max(Number(x.installments)||1,1)),0))} detail={`${creditPlans.length} compras registradas`} icon={<CreditCard/>} tone="negative" help="Importe total que todavía falta pagar entre todas las compras en cuotas."/><KpiInfoCard title="Cuotas del mes" value={money(scheduledCommitments.filter(x=>x.kind==='cuota').reduce((s,x)=>s+Number(x.amount||0),0))} detail={`${scheduledCommitments.filter(x=>x.kind==='cuota').length} vencimientos pendientes`} icon={<CalendarDays/>} tone="warning" help="Cuotas pendientes que vencen durante el mes seleccionado."/></div>
        <div className="credit-grid">{creditPlans.map(item=>{const total=Number(item.total)||0;const installments=Math.max(Number(item.installments)||1,1);const paid=Math.min(Number(item.paid)||0,installments);const monthly=total/installments;const progress=(paid/installments)*100;return <article className="credit-card-item" key={item.id}><header><div><b>{item.description}</b><small>{item.card}</small></div><button type="button" className="ghost danger" onClick={()=>removeCreditPlan(item.id)}><Trash2/></button></header><strong>{money(monthly)} <small>por mes</small></strong><div className="category-progress"><div style={{width:`${progress}%`}}/></div><p>{paid} de {installments} cuotas pagadas · pendiente {money(total-monthly*paid)}</p><footer><button type="button" className="ghost" disabled={paid<=0} onClick={()=>updateCreditPaid(item.id,-1)}>−</button><span>Cuota {Math.min(paid+1,installments)} / {installments}</span><button type="button" className="ghost" disabled={paid>=installments} onClick={()=>updateCreditPaid(item.id,1)}>+</button></footer></article>})}{!creditPlans.length&&<div className="empty-card">Todavía no hay compras en cuotas registradas.</div>}</div>
      </section>}

      {tab === 'account-management' && <>
        <section className="page-heading accounts-page-heading">
          <div>
            <h1>Gestión de cuentas</h1>
            <p>Consultar, crear y organizar el dinero disponible en cada cuenta.</p>
          </div>
        </section>

        <section className="account-dashboard">
          <div className="account-dashboard-header">
            <div>
              <h2>Dashboard de cuentas</h2>
              <p>Distribución del dinero, saldos disponibles y actividad entre cuentas.</p>
            </div>
          </div>

          <section className="kpis account-dashboard-kpis">
            <KpiInfoCard
              title="Patrimonio distribuido"
              value={money(totalAccountBalance)}
              detail="Suma de los saldos visibles de todas las cuentas"
              icon={<WalletCards />}
              tone="positive"
              help="Suma el saldo actual mostrado en cada cuenta. Incluye el saldo de la cuenta principal y los ajustes realizados mediante transferencias."
            />
            <KpiInfoCard
              title="Cuenta principal"
              value={accountDashboardData[0]?.name || 'Sin cuentas'}
              detail={accountDashboardData.length ? money(accountDashboardData[0]?.saldo || 0) : 'Sin saldo'}
              icon={<TrendingUp />}
              help="Identifica la cuenta que actualmente tiene el mayor saldo disponible."
            />
            <KpiInfoCard
              title="Transferencias del mes"
              value={String(currentMonthTransfers.length)}
              detail={money(currentMonthTransfers.reduce((sum, item) => sum + item.amount, 0)) + ' movilizados'}
              icon={<RefreshCw />}
              help="Cuenta las transferencias realizadas durante el mes seleccionado y suma el dinero movilizado entre cuentas."
            />
            <KpiInfoCard
              title="Saldo promedio por cuenta"
              value={money(accounts.length ? totalAccountBalance / accounts.length : 0)}
              detail={`${accounts.length} ${accounts.length === 1 ? 'cuenta activa' : 'cuentas activas'}`}
              icon={<CircleDollarSign />}
              help="Divide el dinero total distribuido por la cantidad de cuentas activas."
            />
          </section>

          <div className="account-dashboard-grid">
            <article className="panel account-dashboard-chart">
              <div className="panel-title"><div><ChartInfoTitle title="Distribución del dinero por cuenta" text="Muestra qué proporción del dinero total se encuentra en cada cuenta." /><span>Participación de cada cuenta sobre el total</span></div></div>
              <div className="account-chart-body">
                <div className="chart account-pie-chart"><ResponsiveContainer><PieChart><Pie data={accountDashboardData.filter(item => item.saldo > 0)} dataKey="saldo" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2}>{accountDashboardData.filter(item => item.saldo > 0).map((item, index) => <Cell key={item.id} fill={palette[index % palette.length]} />)}</Pie><Tooltip formatter={(value, name) => [money(value), name]} /></PieChart></ResponsiveContainer></div>
                <div className="account-balance-legend">
                  {accountDashboardData.map((item, index) => <div className="account-legend-row" key={item.id}><span className="legend-dot" style={{background:palette[index % palette.length]}}></span><b>{item.name}</b><strong>{money(item.saldo)}</strong><small>{totalAccountBalance > 0 ? `${((item.saldo / totalAccountBalance) * 100).toFixed(1)}%` : '0%'}</small></div>)}
                  {!accountDashboardData.length && <div className="empty">Sin cuentas para mostrar.</div>}
                </div>
              </div>
            </article>

            <article className="panel account-dashboard-chart">
              <div className="panel-title"><div><ChartInfoTitle title="Comparación de saldos" text="Compara visualmente el saldo actual de cada cuenta para identificar dónde está concentrado el dinero." /><span>Saldo actual por cuenta</span></div></div>
              <div className="chart account-bar-chart"><ResponsiveContainer><BarChart data={accountDashboardData} layout="vertical" margin={{left:20,right:28,top:8,bottom:8}}><CartesianGrid strokeDasharray="3 3" stroke="#203047"/><XAxis type="number" stroke="#7890a8" tickFormatter={value => `$${Math.round(value / 1000)}k`}/><YAxis type="category" dataKey="name" width={110} stroke="#7890a8"/><Tooltip formatter={value => money(value)}/><Bar dataKey="saldo" name="Saldo" radius={[0,8,8,0]}>{accountDashboardData.map((item,index)=><Cell key={item.id} fill={palette[index % palette.length]}/>)}</Bar></BarChart></ResponsiveContainer></div>
            </article>
          </div>

          <article className="panel account-transfer-history">
            <div className="panel-title"><div><h3>Últimas transferencias</h3><span>Movimientos recientes entre cuentas</span></div></div>
            <div className="account-transfer-table-wrap"><table><thead><tr><th>Fecha</th><th>Origen</th><th>Destino</th><th>Descripción</th><th className="right">Monto</th><th aria-label="Acciones"></th></tr></thead><tbody>
              {transferHistory.slice(0, 8).map(item => <tr key={item.id}><td>{item.date?.split('-').reverse().join('/')}</td><td>{item.from}</td><td>{item.to}</td><td>{item.description}</td><td className="right positive"><b>{money(item.amount)}</b></td><td><div className="row-actions"><button type="button" className="ghost danger" onClick={() => removeTransfer(item)} aria-label={`Eliminar transferencia ${item.description}`} title="Eliminar transferencia"><Trash2 /></button></div></td></tr>)}
              {!transferHistory.length && <tr><td colSpan="6" className="empty">Todavía no existen transferencias entre cuentas.</td></tr>}
            </tbody></table></div>
          </article>
        </section>

        <section className="kpis account-summary-kpis">
          <KpiInfoCard
            title="Dinero total en cuentas"
            value={money(accounts.reduce((sum, account) => sum + accountBalance(account.id), 0))}
            detail={`${accounts.length} ${accounts.length === 1 ? 'cuenta activa' : 'cuentas activas'}`}
            icon={<WalletCards />}
            tone="positive"
            help="Suma el saldo visible de todas las cuentas, incluyendo las transferencias recibidas y descontando las transferencias enviadas."
          />
          <KpiInfoCard
            title="Cuenta con mayor saldo"
            value={accounts.length ? money(Math.max(...accounts.map(account => accountBalance(account.id)))) : money(0)}
            detail={accounts.length ? [...accounts].sort((a,b) => accountBalance(b.id) - accountBalance(a.id))[0]?.name : 'Sin cuentas'}
            icon={<TrendingUp />}
            help="Muestra la cuenta que actualmente concentra el mayor saldo disponible."
          />
          <KpiInfoCard
            title="Saldo en ahorros"
            value={money(savingsBalance)}
            detail="Fondo acumulado"
            icon={<PiggyBank />}
            tone="info"
            help="Indica el saldo total acumulado en Ahorros. Este monto se administra desde la pestaña Ahorros."
          />
        </section>

        <section className="panel accounts-management-page">
          <div className="control-subpanel account-management">
            <div className="control-subpanel-title"><WalletCards /><div><h3>Cuentas</h3><span>Crear, editar y eliminar cuentas. El saldo se carga y modifica manualmente.</span></div></div>
            <form className="account-management-form" onSubmit={saveAccountRecord}>
              <label>Nombre de la cuenta<input value={accountForm.name} onChange={e => setAccountForm(current => ({ ...current, name: e.target.value }))} placeholder="Ej. Banco o efectivo" /></label>
              <label>Saldo inicial<input type="number" step="0.01" value={accountForm.initial_balance} onChange={e => setAccountForm(current => ({ ...current, initial_balance: e.target.value }))} placeholder="0,00" /></label>
              <button type="submit">{editingAccountId ? <><Pencil /> Guardar edición</> : <><Plus /> Crear cuenta</>}</button>
              {editingAccountId && <button type="button" className="ghost" onClick={resetAccountForm}>Cancelar</button>}
            </form>
            <div className="account-cards-grid">
              {accounts.map(account => <article className="account-card" key={account.id}>
                <div><b>{account.name}</b><small>Saldo actual</small></div>
                <strong>{money(accountBalance(account.id))}</strong>
                <div className="row-actions">
                  <button type="button" className="ghost" onClick={() => startEditingAccount(account)}><Pencil /></button>
                  <button type="button" className="ghost danger" onClick={() => removeAccount(account)}><Trash2 /></button>
                </div>
              </article>)}
              {!accounts.length && <div className="empty-card">Todavía no existen cuentas.</div>}
            </div>
          </div>

          <form className="control-subpanel" onSubmit={saveTransfer}>
            <div className="control-subpanel-title"><RefreshCw /><div><h3>Transferencia entre cuentas</h3><span>Mueve dinero sin modificar ingresos, egresos ni resultados mensuales.</span></div></div>
            <div className="transfer-grid">
              <label>Desde<select value={transferForm.from_account_id} onChange={e => setTransferForm(current => ({ ...current, from_account_id: e.target.value }))}>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              <label>Hacia<select value={transferForm.to_account_id} onChange={e => setTransferForm(current => ({ ...current, to_account_id: e.target.value }))}>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              <label>Monto<input type="number" min="0" step="0.01" value={transferForm.amount} onChange={e => setTransferForm(current => ({ ...current, amount: e.target.value }))} placeholder="0,00" /></label>
              <label>Fecha<input type="date" value={transferForm.date} onChange={e => setTransferForm(current => ({ ...current, date: e.target.value }))} /></label>
              <label className="transfer-description">Descripción<input value={transferForm.description} onChange={e => setTransferForm(current => ({ ...current, description: e.target.value }))} placeholder="Opcional" /></label>
              <button type="submit" disabled={accounts.length < 2}><RefreshCw /> Transferir</button>
            </div>
          </form>
        </section>
      </>}

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

      {tab === 'control' && <section className="panel control-card">
        <div className="section-icon"><FolderCog /></div>
        <h2>Control y personalización</h2>
        <p>Administrar configuración financiera, categorías y apariencia.</p>

        <div className="control-sections-grid">
          <form className="control-subpanel" onSubmit={saveFinancialSettings}>
            <div className="control-subpanel-title"><WalletCards /><div><h3>Saldo inicial</h3><span>Configuración privada guardada por usuario en Supabase</span></div></div>
            <div className="control-form-grid two-cols">
              <label>Mes base
                <input type="month" value={settingsDraft.opening_balance_month} onChange={e => setSettingsDraft(current => ({ ...current, opening_balance_month: e.target.value }))} />
              </label>
              <label>Saldo al cierre de ese mes
                <input type="number" step="0.01" value={settingsDraft.opening_balance_amount} onChange={e => setSettingsDraft(current => ({ ...current, opening_balance_amount: e.target.value }))} placeholder="0,00" />
              </label>
            </div>
            <small className="control-note">Este valor reemplaza cualquier saldo hardcodeado y se utiliza como punto de partida para los meses posteriores.</small>
            <button type="submit"><Settings2 /> Guardar saldo inicial</button>
          </form>
        </div>

        <div className="theme-section">
          <div className="theme-block">
            <h4>Color principal</h4>
            <p>Define el color de botones, bordes activos e indicadores.</p>
            <div className="theme-picker">{['blue','green','purple','orange','gray'].map(x=><button type="button" key={x} className={`theme-option theme-${x}-btn ${theme===x?'active':''}`} onClick={()=>setTheme(x)} aria-label={`Usar color ${x}`} />)}</div>
          </div>
          <div className="theme-block">
            <h4>Color de fondo</h4>
            <p>Permite elegir el tono general de fondo sin modificar la legibilidad de cards y tablas.</p>
            <div className="background-picker">{[['navy','Azul oscuro'],['slate','Pizarra'],['black','Negro'],['blue','Azul profundo'],['plum','Ciruela']].map(([value,label])=><button type="button" key={value} className={`background-option background-${value}-btn ${backgroundTheme===value?'active':''}`} onClick={()=>setBackgroundTheme(value)} aria-label={`Usar fondo ${label}`}><span>{label}</span></button>)}</div>
          </div>
          <div className="theme-block">
            <h4>Atajos de teclado</h4>
            <div className="shortcut-grid"><div className="shortcut"><span>Nuevo ingreso</span><kbd>I</kbd></div><div className="shortcut"><span>Nuevo egreso</span><kbd>E</kbd></div><div className="shortcut"><span>Ir a cargar</span><kbd>N</kbd></div><div className="shortcut"><span>Abrir filtros</span><kbd>/</kbd></div></div>
          </div>
        </div>

        <h2>Control de categorías</h2>
        <p>Las categorías de ingresos y egresos se administran por separado y aparecen automáticamente en los formularios de carga.</p>
        <CategoryForm onAdd={addCategory} />
        <div className="category-columns"><div><h3>Ingresos ({categories.filter(c => c.type === 'income').length})</h3>{categories.filter(c => c.type === 'income').map(c => <div className="category-row" key={c.id}><span>{c.name}</span><button className="ghost danger" onClick={() => removeCategory(c)}><Trash2 /></button></div>)}</div><div><h3>Egresos ({categories.filter(c => c.type === 'expense').length})</h3>{categories.filter(c => c.type === 'expense').map(c => <div className="category-row" key={c.id}><span>{c.name}</span><button className="ghost danger" onClick={() => removeCategory(c)}><Trash2 /></button></div>)}</div></div>
      </section>}
      </main>
    </div>
    {forecastCategoryModalOpen && <div className="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="forecast-category-title" onMouseDown={e => { if (e.target === e.currentTarget) setForecastCategoryModalOpen(false) }}>
      <div className="forecast-category-dialog">
        <header>
          <div>
            <h3 id="forecast-category-title">Categorías para la predicción</h3>
            <p>Seleccione las categorías que participan en la proyección. La selección queda guardada hasta que vuelva a modificarla. También se buscan gastos recurrentes de meses anteriores dentro de estas categorías.</p>
          </div>
          <button type="button" className="ghost icon-close" onClick={() => setForecastCategoryModalOpen(false)} aria-label="Cerrar"><X /></button>
        </header>
        <div className="forecast-category-toolbar">
          <span>{forecastCategoryDraft.length} de {forecastAvailableCategories.length} seleccionadas</span>
          <div className="row-actions">
            <button type="button" className="secondary" onClick={() => setForecastCategoryDraft([...forecastAvailableCategories])}>Seleccionar todas</button>
            <button type="button" className="ghost" onClick={() => setForecastCategoryDraft([])}>Quitar todas</button>
          </div>
        </div>
        <div className="forecast-category-list">
          {forecastAvailableCategories.map(name => <label className="forecast-category-option" key={name}>
            <input type="checkbox" checked={forecastCategoryDraft.includes(name)} onChange={() => toggleForecastCategory(name)} />
            <span>{name}</span>
          </label>)}
          {!forecastAvailableCategories.length && <div className="empty">No existen categorías de egreso en el mes seleccionado.</div>}
        </div>
        <div className="forecast-category-actions">
          <button type="button" className="ghost" onClick={() => setForecastCategoryModalOpen(false)}>Cancelar</button>
          <button type="button" onClick={applyForecastCategories}>Aplicar selección</button>
        </div>
      </div>
    </div>}

    {undoAction && <div className="undo-toast"><span>{undoAction.label}</span><button onClick={async()=>{const restore=undoAction.restore;setUndoAction(null);await restore?.()}}><Undo2/> Deshacer</button></div>}

    {confirmDialog && <div className="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmDialog(null) }}>
      <div className="confirm-dialog">
        <h3 id="confirm-dialog-title">{confirmDialog.title}</h3>
        <p>{confirmDialog.message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="ghost" onClick={() => setConfirmDialog(null)}>Cancelar</button>
          <button type="button" className={confirmDialog.tone === 'info' ? 'info-action' : 'danger'} onClick={runConfirmedAction}>{confirmDialog.confirmLabel}</button>
        </div>
      </div>
    </div>}
    <MovementModal open={modal} onClose={() => { setModal(false); setEditing(null) }} onSave={save} accounts={accounts} categories={categories} editing={editing} defaultType={newType} />
  </div>
}
