export const money = (n=0,currency='ARS') => new Intl.NumberFormat('es-AR',{style:'currency',currency,maximumFractionDigits:0}).format(Number(n)||0)
export const monthKey = d => (d||new Date().toISOString()).slice(0,7)
