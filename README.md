# ☕ Antología Box 23 — Sistema de Caja

App web modular para gestión de caja, inventario y sincronización con Google Sheets.

---

## 📁 Estructura del Proyecto

```
antologia-box23/
├── index.html              ← App principal
├── css/
│   └── main.css            ← Estilos
├── js/
│   ├── utils.js            ← Utilidades compartidas
│   ├── storage.js          ← Estado global y localStorage
│   ├── accounts.js         ← Cuentas (Nequi, Bancolombia, etc.)
│   ├── caja.js             ← POS / Punto de venta
│   ├── pendientes.js       ← Pedidos pendientes
│   ├── creditos.js         ← Clientes a crédito
│   ├── gastos.js           ← Gastos del negocio
│   ├── inventario.js       ← Inventario + facturas de compra ← NUEVO
│   ├── transactions.js     ← Historial de movimientos
│   ├── productos.js        ← Catálogo de productos
│   ├── respaldos.js        ← Backup CSV local
│   ├── sheets.js           ← Integración Google Sheets ← NUEVO
│   └── app.js              ← Inicialización y eventos
└── apps-script/
    └── Code.gs             ← Backend Google Apps Script ← NUEVO
```

---

## 🚀 Configuración en GitHub Pages

1. Sube la carpeta al repositorio de GitHub.
2. Ve a **Settings → Pages → Source: main branch / root**.
3. Accede desde `https://tu-usuario.github.io/antologia-box23/`.

---

## 📊 Configurar Google Sheets (Base de datos en la nube)

### Paso 1 — Crear el Apps Script

1. Abre [script.google.com](https://script.google.com) e inicia sesión.
2. Crea un **Nuevo proyecto**.
3. Borra el código de ejemplo.
4. Pega el contenido completo de `apps-script/Code.gs`.
5. Guarda con `Ctrl+S`.

### Paso 2 — Desplegar como Web App

1. Menú: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configurar:
   - **Ejecutar como:** Yo (tu cuenta Google)
   - **Quién tiene acceso:** Cualquier persona
4. Haz clic en **Implementar**.
5. Autoriza los permisos cuando se pida.
6. **Copia la URL** generada (empieza con `https://script.google.com/macros/s/.../exec`).

> ⚠️ Cada vez que modifiques el código del script, debes crear una **nueva implementación** (no editar la existente) para que los cambios tomen efecto.

### Paso 3 — Conectar la App

1. Abre la app en el navegador.
2. Ve a la pestaña **Datos** (ícono de base de datos).
3. Pega la URL en el campo **"URL del Web App"**.
4. Haz clic en **Guardar URL**.
5. Haz clic en **Probar Conexión** para verificar.
6. Usa **Enviar a Sheets** para la primera sincronización.

---

## 🔄 Cómo funciona la sincronización

| Acción | Descripción |
|--------|-------------|
| **Enviar a Sheets** | Escribe todos los datos locales a Google Sheets (sobrescribe) |
| **Traer de Sheets** | Descarga todos los datos de Sheets y reemplaza los datos locales |
| **Auto-sync al inicio** | Si hay URL configurada, descarga automáticamente al abrir la app |
| **Sync incremental** | Ventas, gastos y facturas se envían a Sheets en segundo plano al guardar |

> Los datos siempre se guardan primero en **localStorage** (sin conexión), y luego se sincronizan con Sheets.

---

## 📦 Módulo de Inventario

### Insumos
- Registra el catálogo de insumos con nombre, emoji, unidad, categoría.
- Define un **stock mínimo** para recibir alertas automáticas.
- El stock se actualiza automáticamente al guardar una factura de compra.

### Facturas de Compra
- Registra proveedor, número de factura, fecha y cuenta de pago.
- Agrega múltiples productos por factura.
- Al guardar, se:
  - Actualiza el stock de cada insumo.
  - Registra un movimiento de inventario tipo "entrada".
  - Crea un egreso en la cuenta seleccionada.

### Movimientos
- Historial completo de entradas de stock (generadas por facturas).

---

## 🗂️ Hojas creadas en Google Sheets

| Hoja | Contenido |
|------|-----------|
| `Transacciones` | Todos los movimientos de cuentas |
| `Gastos` | Gastos del negocio |
| `Creditos` | Clientes con crédito |
| `Pendientes` | Pedidos pendientes de pago |
| `Inventario_Insumos` | Catálogo de insumos con stock |
| `Inventario_Facturas` | Facturas de compra |
| `Inventario_Movimientos` | Historial de movimientos de inventario |
| `Productos` | Catálogo de productos de venta |
| `Config` | Metadatos de sincronización |
| `Log` | Log de acciones y errores |

---

## 💾 Datos sin conexión

La app funciona **100% offline** gracias a localStorage. La sincronización con Sheets es opcional y se realiza cuando hay conexión a internet.

---

## 🛠️ Desarrollo local

Abre el `index.html` directamente en el navegador, o usa un servidor local:

```bash
# Con Python
python3 -m http.server 8080

# Con Node.js (npx)
npx serve .
```

---

## 📱 Módulos disponibles

| Tab | Módulo | Archivo |
|-----|--------|---------|
| ☕ Caja | POS, pedidos, cobros | `js/caja.js` |
| ⏳ Pendientes | Pedidos sin cobrar | `js/pendientes.js` |
| 💳 Créditos | Clientes con deuda | `js/creditos.js` |
| 🧾 Gastos | Gastos del día | `js/gastos.js` |
| 📦 Inventario | Insumos + facturas | `js/inventario.js` |
| 📊 Resumen | Saldos por cuenta | `js/accounts.js` |
| 🔄 Movimientos | Historial completo | `js/transactions.js` |
| ☕ Productos | Catálogo de venta | `js/productos.js` |
| 💼 Cuentas | Detalle por cuenta | `js/accounts.js` |
| 🗄️ Datos | Sync + backup | `js/sheets.js` / `js/respaldos.js` |
