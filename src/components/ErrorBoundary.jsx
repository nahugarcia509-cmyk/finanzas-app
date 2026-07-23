import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={hasError:false,error:null} }
  static getDerivedStateFromError(error){ return {hasError:true,error} }
  componentDidCatch(error,info){ console.error('Error no controlado:',error,info) }
  render(){
    if(!this.state.hasError) return this.props.children
    return <main className="global-error-screen" role="alert"><section className="global-error-card"><AlertTriangle/><h1>La aplicación encontró un problema</h1><p>Los datos guardados no fueron eliminados. Recargar la pantalla permite continuar.</p><button onClick={()=>window.location.reload()}><RefreshCw/> Recargar aplicación</button><details><summary>Detalle técnico</summary><pre>{String(this.state.error?.message||this.state.error||'Error desconocido')}</pre></details></section></main>
  }
}
