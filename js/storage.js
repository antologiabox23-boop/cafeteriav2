/* ══════════════════════════════════════════════════════════════════
   storage.js — Estado global y persistencia  v3.0
   ─────────────────────────────────────────────────────────────────
   Cambios v3.0:
   • Se eliminaron insumos[] y movInventario[]. El stock ahora vive
     directamente en los productos rápidos (getProds/saveProds).
   • stockMovs[] registra todos los movimientos de stock
     (entrada por factura / salida por venta).
   • El inventario ya no es una entidad separada; es solo la vista
     de cuántas unidades hay de cada producto del catálogo.
   ══════════════════════════════════════════════════════════════════ */

// ─── Estado global ──────────────────────────────────────────────
let accounts = {
  efectivo:    { name:'Efectivo',    color:'efectivo',    transactions:[], balance:0 },
  nequi:       { name:'Nequi',       color:'nequi',       transactions:[], balance:0 },
  bancolombia: { name:'Bancolombia', color:'bancolombia', transactions:[], balance:0 },
  daviplata:   { name:'Daviplata',   color:'daviplata',   transactions:[], balance:0 }
};

let gastos        = [];
let creditos      = [];
let pendientes    = [];
let facturas      = [];
let stockMovs     = [];   // ← reemplaza movInventario
let cierres       = [];   // registros de cierre diario (base de caja)

// ─── Defaults de productos (con stock = 0) ──────────────────────
const defaultProds = [
  { id:1, nombre:'Café Americano', precio:3000,  emoji:'☕',  stock:0 },
  { id:2, nombre:'Café Latte',     precio:5000,  emoji:'🥛',  stock:0 },
  { id:3, nombre:'Capuchino',      precio:5500,  emoji:'☕',  stock:0 },
  { id:4, nombre:'Té Aromático',   precio:2500,  emoji:'🍵',  stock:0 },
  { id:5, nombre:'Brownie',        precio:4000,  emoji:'🍫',  stock:0 },
  { id:6, nombre:'Agua',           precio:1500,  emoji:'💧',  stock:0 }
];

// ─── localStorage (fallback offline) ────────────────────────────
const LS = {
  accounts: 'ms_accounts',
  gastos:   'ms_gastos',
  creditos: 'ms_creditos',
  pend:     'ms_pendientes',
  facturas: 'ms_facturas',
  stockMovs:'ms_stockmovs',
  prods:    'ms_prods',
  cierres:  'ms_cierres'
};

// Carga desde localStorage — se usa solo si Sheets no está disponible
function load() {
  try {
    const sa = localStorage.getItem(LS.accounts);   if (sa) accounts   = JSON.parse(sa);
    const sg = localStorage.getItem(LS.gastos);     if (sg) gastos     = JSON.parse(sg);
    const sc = localStorage.getItem(LS.creditos);   if (sc) creditos   = JSON.parse(sc);
    const sp = localStorage.getItem(LS.pend);       if (sp) pendientes = JSON.parse(sp);
    const sf = localStorage.getItem(LS.facturas);   if (sf) facturas   = JSON.parse(sf);
    const sm = localStorage.getItem(LS.stockMovs);  if (sm) stockMovs  = JSON.parse(sm);
    const sk = localStorage.getItem(LS.cierres);    if (sk) cierres   = JSON.parse(sk);
  } catch (e) { console.warn('[storage.load]', e); }
}

// ─── Guardar en localStorage ─────────────────────────────────────
function saveAccounts()   { localStorage.setItem(LS.accounts,  JSON.stringify(accounts)); }
function saveGastos()     { localStorage.setItem(LS.gastos,    JSON.stringify(gastos)); }
function saveCreditos()   { localStorage.setItem(LS.creditos,  JSON.stringify(creditos)); }
function savePendientes() { localStorage.setItem(LS.pend,      JSON.stringify(pendientes)); }
function saveFacturas()   { localStorage.setItem(LS.facturas,  JSON.stringify(facturas)); }
function saveStockMovs()  { localStorage.setItem(LS.stockMovs, JSON.stringify(stockMovs)); }
function saveCierres()     { localStorage.setItem(LS.cierres,   JSON.stringify(cierres)); }

function getProds() {
  try { const s = localStorage.getItem(LS.prods); return s ? JSON.parse(s) : defaultProds; }
  catch (e) { return defaultProds; }
}
function saveProds(p) { localStorage.setItem(LS.prods, JSON.stringify(p)); }

// ─── Helpers de stock directo sobre productos ────────────────────
// Devuelve el stock actual de un producto por su id
function getProdStock(prodId) {
  const p = getProds().find(x => x.id === prodId);
  return p ? (p.stock || 0) : 0;
}

// Modifica el stock de un producto y guarda
function setProdStock(prodId, newStock) {
  const prods = getProds();
  const idx = prods.findIndex(x => x.id === prodId);
  if (idx === -1) return;
  prods[idx].stock = Math.max(0, newStock);
  saveProds(prods);
}

function addProdStock(prodId, delta) {
  const current = getProdStock(prodId);
  setProdStock(prodId, current + delta);
}

// ─── Exportar todo (para pushAll a Sheets) ───────────────────────
function exportAllData() {
  return {
    accounts, gastos, creditos, pendientes,
    facturas,
    stockMovs,
    cierres,
    productos:  getProds(),
    exportedAt: new Date().toISOString()
  };
}

// ─── Importar todo (desde loadAll de Sheets) ─────────────────────
function importAllData(data) {
  if (!data) return;
  if (data.accounts) {
    const base = {
      efectivo:    { name:'Efectivo',    color:'efectivo' },
      nequi:       { name:'Nequi',       color:'nequi' },
      bancolombia: { name:'Bancolombia', color:'bancolombia' },
      daviplata:   { name:'Daviplata',   color:'daviplata' }
    };
    for (const k in base) {
      if (!data.accounts[k]) data.accounts[k] = { ...base[k], transactions:[], balance:0 };
      else data.accounts[k] = { ...base[k], ...data.accounts[k] };
    }
    accounts = data.accounts;
    saveAccounts();
  }
  if (data.gastos)     { gastos     = data.gastos;     saveGastos(); }
  if (data.creditos)   { creditos   = data.creditos;   saveCreditos(); }
  if (data.pendientes) {
    // Proteger preventas activas del localStorage que Sheets puede no tener actualizadas.
    // Una preventa "activa" es la que tiene entregas pendientes en este dispositivo.
    const esPrev = p => p.esPreventa === true || p.esPreventa === 1 ||
                        p.esPreventa === 'true' || p.esPreventa === '1';
    let localPrev;
    try {
      const sp = localStorage.getItem('ms_pendientes');
      localPrev = sp ? JSON.parse(sp).filter(p => esPrev(p)) : [];
    } catch(e) { localPrev = []; }

    // Mezclar: tomar los pendientes normales de Sheets + las preventas locales
    // (las preventas locales tienen el estado más fresco de entregas parciales)
    const sheetsNormales = data.pendientes.filter(p => !esPrev(p));
    const sheetsPrevs    = data.pendientes.filter(p => esPrev(p));

    // Para cada preventa de Sheets, usar la versión local si existe (más actualizada)
    const mergedPrevs = sheetsPrevs.map(sp => {
      const local = localPrev.find(lp => Number(lp.id) === Number(sp.id));
      return local || sp;
    });
    // Agregar preventas locales que no están en Sheets (creadas offline)
    localPrev.forEach(lp => {
      if (!mergedPrevs.find(mp => Number(mp.id) === Number(lp.id))) {
        mergedPrevs.push(lp);
      }
    });

    pendientes = [...sheetsNormales, ...mergedPrevs];
    savePendientes();
  }
  if (data.facturas)   { facturas   = data.facturas;   saveFacturas(); }
  if (data.stockMovs)  { stockMovs  = data.stockMovs;  saveStockMovs(); }
  if (data.cierres)    { cierres    = data.cierres;    saveCierres(); }
  if (data.productos)  { saveProds(data.productos); }
}

// ─── Sync optimista a Sheets (llamado por cada módulo al guardar) ─
function sheetsSync(tipo, obj) {
  try {
    switch (tipo) {
      case 'venta':
      case 'transaccion':
        if (obj && obj.id) {
          const accKey = obj.accKey || obj.cuentaKey || '';
          const row = {
            cuenta:    obj.accName   || (accKey && accounts[accKey] ? accounts[accKey].name : '') || '',
            cuentaKey: accKey,
            id:        obj.id,
            date:      obj.date,
            concept:   obj.concept,
            amount:    obj.amount,
            type:      obj.type || (obj.amount >= 0 ? 'ingreso' : 'egreso'),
            esventa:   obj.esventa ? 'SI' : 'NO',
            cliente:   obj.cliente    || '',
            facturaId: obj.facturaId  || '',
            gastoId:   obj.gastoId    || ''
          };
          Sheets.appendRow(Sheets.HOJAS.TRANSACCIONES, row);
        }
        break;
      case 'gasto':
        if (obj && obj.id) Sheets.appendRow(Sheets.HOJAS.GASTOS, obj);
        break;
      case 'credito':
        if (obj && obj.id) Sheets.appendRow(Sheets.HOJAS.CREDITOS, obj);
        break;
      case 'pendiente':
        if (obj && obj.id) Sheets.appendRow(Sheets.HOJAS.PENDIENTES, obj);
        break;
      case 'factura':
        if (obj && obj.id) Sheets.appendRow(Sheets.HOJAS.FACTURAS, obj);
        break;
      case 'stockmov':
        if (obj && obj.id) Sheets.appendRow(Sheets.HOJAS.STOCK_MOVS, obj);
        break;



      case 'producto':
        if (obj && obj.id) {
          if (obj._isNew) Sheets.appendRow(Sheets.HOJAS.PRODUCTOS, obj);
          else Sheets.updateRow(Sheets.HOJAS.PRODUCTOS, obj.id, obj);
        }
        break;
      case 'cierre':
        if (obj && obj.id) Sheets.appendRow(Sheets.HOJAS.CIERRES, obj);
        break;

    }
  } catch (e) {
    console.warn('[sheetsSync]', tipo, e.message);
  }
}
