# Mis Finanzas

Aplicación React + Vite para administrar finanzas personales.

## Incluye

- Datos históricos de ingresos y egresos cargados automáticamente desde la primera apertura.
- Dashboard mensual con ingresos, egresos, balance, tasa de ahorro, gasto diario promedio y mayor gasto.
- Balance diario acumulado.
- Gastos e ingresos por categoría.
- Comparación diaria de ingresos y egresos.
- Evolución mensual histórica.
- Pestañas independientes: Dashboard, Cargar, Ingresos, Egresos y Control.
- Alta, edición y eliminación de movimientos.
- Categorías independientes para ingresos y egresos.
- Sincronización entre celular y PC mediante Supabase.

## Ejecutar

Descomprimir fuera de OneDrive, por ejemplo en `C:\Proyectos\finanzas-app`.

```powershell
npm install
npm run dev
```

Abrir la URL mostrada por Vite.

## Supabase

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` en SQL Editor.
3. Copiar `.env.example` como `.env` y completar:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
```

Sin Supabase, los datos se guardan en el navegador. Con Supabase, se sincronizan entre celular y PC.

## Lógica mensual incorporada

- Los datos históricos comienzan en abril de 2026.
- Abril se toma como mes inicial, sin saldo anterior.
- Desde mayo, el saldo final del mes anterior se incorpora automáticamente como saldo inicial.
- Saldo final = saldo anterior + ingresos del mes - egresos del mes.
- El balance diario comienza con el saldo anterior y se actualiza con cada movimiento.
- El dashboard incluye tablas desglosadas por categoría, concepto, fecha y monto.

## Instalación como aplicación (PWA)

Después de publicar el proyecto mediante HTTPS, puede instalarse desde Chrome/Edge con **Instalar aplicación** o desde Safari en iPhone/iPad mediante **Compartir → Agregar a pantalla de inicio**.

Cada nueva ejecución de `npm run build` genera una versión diferente del service worker. Cuando esa compilación se publica, las instalaciones existentes muestran el aviso **Nueva versión disponible** y permiten aplicar los cambios con **Actualizar ahora**.

## Cuenta principal y saldo de Inicio

En **Gestión de cuentas**, pulsa **Elegir como principal**. Esa cuenta aparece
primera y seleccionada al abrir un nuevo ingreso o egreso; editar un movimiento
conserva su cuenta original. La preferencia se guarda localmente en modo local
y por usuario en Supabase para sincronizarla entre dispositivos.

En proyectos Supabase nuevos y existentes, ejecuta también
`supabase/account_preferences.sql` en SQL Editor. Este cambio es aditivo y no
modifica cuentas ni movimientos existentes.

**Saldo actual** de Inicio conserva el resultado del balance del mes seleccionado:
saldo anterior más ingresos, menos egresos y aportes a ahorros. Coincide con el
saldo final del Dashboard mensual y es la base de la predicción. Elegir una
cuenta principal solo establece la cuenta predeterminada al registrar movimientos;
no reemplaza el saldo de Inicio por el saldo registrado de esa cuenta.

En **Gestión de cuentas**, editar **Saldo actual** permite guardar el importe
real disponible en esa cuenta. La aplicación calcula la base descontando el neto
de todos los movimientos registrados, para evitar sumarlos dos veces.
Los próximos movimientos actualizan el saldo normalmente. Elegir otra cuenta
principal no modifica ningún importe ni asigna diferencias a otras cuentas.

## Movimientos y saldos de cuentas

Los saldos de cuentas se calculan desde una única lista de movimientos guardados.
Un ingreso suma a su cuenta, un egreso descuenta de su cuenta y una transferencia
resta del origen y suma al destino, sin cambiar el total ni el balance mensual.
Editar, eliminar o cambiar la cuenta de un movimiento recalcula los saldos.
Los movimientos registrados se reflejan en cuentas aunque su fecha sea posterior
al día local; las fechas predeterminadas de los formularios usan el día local.
Los pagos recurrentes y cuotas pendientes no son movimientos hasta registrarlos.

Las transferencias locales se conservan al recargar. Supabase carga todas las
páginas del historial antes de presentar saldos; no usa un historial parcial para
calibrar el saldo real. Un movimiento de ahorro acompañado por una transferencia
entre cuentas no descuenta ni acredita dos veces en la misma cuenta.
Las búsquedas de las tablas no alteran el balance general.

Pruebas de lógica: `node --test tests/*.test.js`.
Prueba de navegador con Playwright disponible: `node tests/account-flow.browser.mjs`.
Acepta `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` y `APP_URL`; usa un contexto aislado
sin datos del usuario. Verifica transferencia total MP→Santander, gasto en
Santander, edición de monto/cuenta, búsquedas, balance de Inicio, recarga y
eliminación de la transferencia.

`node tests/account-flow.supabase.browser.mjs` prueba el cliente real de Supabase
contra una API simulada: inserción conjunta de ambas partes de una transferencia,
registro de gasto en su cuenta y reconstrucción de saldos al recargar. No usa
credenciales ni datos reales de Supabase.
