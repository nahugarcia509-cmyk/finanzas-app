import { useState } from 'react'
import { WalletCards } from 'lucide-react'
export default function Auth({supabase}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[mode,setMode]=useState('login'),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false)
 const submit=async e=>{e.preventDefault();setBusy(true);setMsg('');try{const fn=mode==='login'?'signInWithPassword':'signUp';const {error}=await supabase.auth[fn]({email,password});if(error)throw error;if(mode==='signup')setMsg('Cuenta creada. Revisar el correo si se solicita confirmación.')}catch(err){setMsg(err.message)}finally{setBusy(false)}}
 return <div className="auth"><form onSubmit={submit} className="auth-card"><div className="brand-icon"><WalletCards/></div><h1>Mis Finanzas</h1><p>Datos sincronizados en todos los dispositivos.</p><label>Correo<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength="6" required/></label><button disabled={busy}>{busy?'Procesando…':mode==='login'?'Ingresar':'Crear cuenta'}</button>{msg&&<div className="message">{msg}</div>}<button type="button" className="link" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Crear una cuenta':'Ya tengo una cuenta'}</button></form></div>
}
