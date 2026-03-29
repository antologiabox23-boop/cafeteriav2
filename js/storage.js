/* ══════════════════════════════════════════════════════════════════
   storage.js — Estado global y persistencia

   Arquitectura:
     Sheets.loadAll() ──► importAllData() ──► estado en memoria
     Cada módulo guarda en localStorage Y llama Sheets.appendRow()
     Al inicio: Sheets.loadAll(silent=true) gana sobre localStorage
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
let insumos       = [];
let facturas      = [];
let movInventario = [];

// ─── Defaults ───────────────────────────────────────────────────
const defaultProds = [
  { id:1, nombre:'Café Americano', precio:3000,  emoji:'☕' },
  { id:2, nombre:'Café Latte',     precio:5000,  emoji:'🥛' },
  { id:3, nombre:'Capuchino',      precio:5500,  emoji:'☕' },
  { id:4, nombre:'Té Aromático',   precio:2500,  emoji:'🍵' },
  { id:5, nombre:'Brownie',        precio:4000,  emoji:'🍫' },
  { id:6, nombre:'Agua',           precio:1500,  emoji:'💧' }
];

// ─── localStorage (fallback offline) ────────────────────────────
const LS = {
  accounts: 'ms_accounts',
  gastos:   'ms_gastos',
  creditos: 'ms_creditos',
  pend:     'ms_pendientes',
  insumos:  'ms_insumos',
  facturas: 'ms_facturas',
  movinv:   'ms_movinv',
  prods:    'ms_prods'
};

// Carga desde localStorage — se usa solo si Sheets no está disponible
function load() {
  try {
    const sa = localStorage.getItem(LS.accounts);   if (sa) accounts      = JSON.parse(sa);
    const sg = localStorage.getItem(LS.gastos);     if (sg) gastos         = JSON.parse(sg);
    const sc = localStorage.getItem(LS.creditos);   if (sc) creditos       = JSON.parse(sc);
    const sp = localStorage.getItem(LS.pend);       if (sp) pendientes     = JSON.parse(sp);
    const si = localStorage.getItem(LS.insumos);    if (si) insumos        = JSON.parse(si);
    const sf = localStorage.getItem(LS.facturas);   if (sf) facturas       = JSON.parse(sf);
    const sm = localStorage.getItem(LS.movinv);     if (sm) movInventario  = JSON.parse(sm);
  } catch (e) { console.warn('[storage.load]', e); }
}

// ─── Guardar en localStorage ─────────────────────────────────────
function saveAccounts()   { localStorage.setItem(LS.accounts, JSON.stringify(accounts)); }
function saveGastos()     { localStorage.setItem(LS.gastos,   JSON.stringify(gastos)); }
function saveCreditos()   { localStorage.setItem(LS.creditos, JSON.stringify(creditos)); }
function savePendientes() { localStorage.setItem(LS.pend,     JSON.stringify(pendientes)); }
function saveInsumos()    { localStorage.setItem(LS.insumos,  JSON.stringify(insumos)); }
function saveFacturas()   { localStorage.setItem(LS.facturas, JSON.stringify(facturas)); }
function saveMovInv()     { localStorage.setItem(LS.movinv,   JSON.stringify(movInventario)); }

function getProds() {
  try { const s = localStorage.getItem(LS.prods); return s ? JSON.parse(s) : defaultProds; }
  catch (e) { return defaultProds; }
}
function saveProds(p) { localStorage.setItem(LS.prods, JSON.stringify(p)); }

// ─── Exportar todo (para pushAll) ────────────────────────────────
function exportAllData() {
  return {
    accounts, gastos, creditos, pendientes,
    insumos, facturas, movInventario,
    productos:  getProds(),
    exportedAt: new Date().toISOString()
  };
}

// ─── Importar todo (desde loadAll) ───────────────────────────────
// Sobreescribe el estado en memoria Y localStorage.
function importAllData(data) {
  if (!data) return;
  if (data.accounts) {
    // Preservar la estructura base de cuentas si el servidor devuelve algo parcial
    const base = { efectivo:{name:'Efectivo',color:'efectivo'}, nequi:{name:'Nequi',color:'nequi'},
                   bancolombia:{name:'Bancolombia',color:'bancolombia'}, daviplata:{name:'Daviplata',color:'daviplata'} };
    for (const k in base) {
      if (!data.accounts[k]) data.accounts[k] = { ...base[k], transactions:[], balance:0 };
      else data.accounts[k] = { ...base[k], ...data.accounts[k] };
    }
    accounts = data.accounts;
    saveAccounts();
  }
  if (data.gastos)        { gastos        = data.gastos;        saveGastos(); }
  if (data.creditos)      { creditos      = data.creditos;      saveCreditos(); }
  if (data.pendientes)    { pendientes    = data.pendientes;    savePendientes(); }
  if (data.insumos)       { insumos       = data.insumos;       saveInsumos(); }
  if (data.facturas)      { facturas      = data.facturas;      saveFacturas(); }
  if (data.movInventario) { movInventario = data.movInventario; saveMovInv(); }
  if (data.productos)     { saveProds(data.productos); }
}
