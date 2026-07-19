import { useEffect, useState } from 'react'
const blank = { type: 'expense', date: new Date().toISOString().slice(0, 10), description: '', amount: '', account_id: '', category_id: '', notes: '' }
export default function MovementModal({ open, onClose, onSave, accounts, categories, editing, defaultType = 'expense' }) {
  const [form, setForm] = useState(blank)
  useEffect(() => {
    if (!open) return
    const type = editing?.type || defaultType
    setForm(editing ? { ...editing, amount: String(editing.amount) } : {
      ...blank, type, account_id: accounts[0]?.id || '', category_id: categories.find(c => c.type === type)?.id || ''
    })
  }, [open, editing, accounts, categories, defaultType])
  if (!open) return null
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const changeType = type => setForm(f => ({ ...f, type, category_id: categories.find(c => c.type === type)?.id || '' }))
  const submit = e => { e.preventDefault(); onSave({ ...form, amount: Number(form.amount) }) }
  return <div className="modal-bg" onMouseDown={onClose}><form className="modal" onSubmit={submit} onMouseDown={e => e.stopPropagation()}><h2>{editing ? 'Editar movimiento' : form.type === 'income' ? 'Nuevo ingreso' : 'Nuevo egreso'}</h2><div className="segmented two"><button type="button" className={form.type === 'income' ? 'active' : ''} onClick={() => changeType('income')}>Ingreso</button><button type="button" className={form.type === 'expense' ? 'active' : ''} onClick={() => changeType('expense')}>Egreso</button></div><div className="form-grid"><label>Fecha<input type="date" value={form.date} onChange={e => set('date', e.target.value)} required /></label><label>Monto<input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required /></label><label className="span2">Concepto<input value={form.description} onChange={e => set('description', e.target.value)} required placeholder={form.type === 'income' ? 'Ej. Sueldo' : 'Ej. Supermercado'} /></label><label>Cuenta<select value={form.account_id} onChange={e => set('account_id', e.target.value)} required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Categoría<select value={form.category_id || ''} onChange={e => set('category_id', e.target.value)} required><option value="">Seleccionar</option>{categories.filter(c => c.type === form.type || c.type === 'both').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="span2">Notas<textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows="3" /></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button>Guardar {form.type === 'income' ? 'ingreso' : 'egreso'}</button></div></form></div>
}
