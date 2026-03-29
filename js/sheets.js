/* ══════════════════════════════════════════════════════════════════
   sheets.js — Google Sheets como base de datos en tiempo real
   v2.0 — patrón GET/base64 (sin preflight CORS), escritura optimista

   ⚙️  ÚNICO PASO DE CONFIGURACIÓN:
       Reemplaza SCRIPT_URL con la URL de tu Apps Script desplegado.
       La misma URL funciona desde cualquier dispositivo sin config extra.
   ══════════════════════════════════════════════════════════════════ */

const Sheets = (() => {

  // ─── CONFIGURACIÓN ─────────────────────────────────────────────
  // Pega aquí la URL de tu Web App después de desplegar Code.gs:
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxtsZWha3hZank-scvto_ZybmmztSm_oCCpJVHtW4njql0LurVb2epatjkaQt5ewNS6iA/exec';
  // ───────────────────────────────────────────────────────────────

  const TIMEOUT_MS = 20000;
  let _ready   = false;
  let _syncing = false;

  // ─── HTTP HELPER ───────────────────────────────────────────────
  // Usa GET + payload base64 → evita CORS preflight completamente.
  // Apps Script permite GET desde cualquier origen sin configuración.
  async function _call(action, payload = {}) {
    if (!SCRIPT_URL || SCRIPT_URL === 'https://script.google.com/macros/s/AKfycbxtsZWha3hZank-scvto_ZybmmztSm_oCCpJVHtW4njql0LurVb2epatjkaQt5ewNS6iA/exec') {
      throw new Error('⚙️ Configura SCRIPT_URL en js/sheets.js');
    }

    const encoded = encodeURIComponent(
      btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    );
    const url = `${SCRIPT_URL}?action=${action}&payload=${encoded}`;

    const ctrl    = new AbortController();
    const timerId = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    let res;
    try {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    } catch (err) {
      clearTimeout(timerId);
      if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado. Verifica tu conexión.');
      throw err;
    }
    clearTimeout(timerId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Apps Script a veces envuelve el JSON en HTML al hacer redirect
    const text  = await res.text();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Respuesta vacía del servidor');

    let json;
    try { json = JSON.parse(match[0]); }
    catch (e) { throw new Error('JSON inválido: ' + text.substring(0, 120)); }

    if (json.error) throw new Error(json.error);
    return json.data ?? json;
  }

  // ─── HELPERS DE UI ─────────────────────────────────────────────
  function _setStatus(msg, type = 'info') {
    const colors = { info:'#00695c', success:'#2e7d32', error:'#c62828', warning:'#e65100' };
    const el = document.getElementById('gsStatus');
    if (el) { el.style.color = colors[type] || colors.info; el.innerHTML = msg; }
  }

  function _setSyncLabel(msg) {
    const el = document.getElementById('syncStatus');
    if (el) el.textContent = msg;
  }

  function _ts() { return new Date().toLocaleTimeString('es-CO'); }

  // ─── PING ──────────────────────────────────────────────────────
  async function testConnection() {
    _setStatus('Probando conexión…', 'info');
    try {
      const r = await _call('ping');
      _setStatus(`✅ Conectado · ${r.spreadsheetName || 'Sheets OK'}`, 'success');
      notify('✅ Conexión exitosa', 'success');
    } catch (err) {
      _setStatus(`❌ ${err.message}`, 'error');
      notify('Error de conexión: ' + err.message, 'danger');
    }
  }

  // ─── CARGA INICIAL / PULL ───────────────────────────────────────
  // Descarga todo desde Sheets, aplica al estado global y refresca UI.
  // silent=true se usa para el auto-sync al inicio (sin notificaciones molestas).
  async function loadAll(silent = false) {
    if (!SCRIPT_URL || SCRIPT_URL === 'https://script.google.com/macros/s/AKfycbxtsZWha3hZank-scvto_ZybmmztSm_oCCpJVHtW4njql0LurVb2epatjkaQt5ewNS6iA/exec') return;
    if (_syncing) return;
    _syncing = true;
    _setSyncLabel('Descargando desde Sheets…');
    if (!silent) notify('Descargando datos de Sheets…', 'info', 4000);

    try {
      const data = await _call('getAll');
      _applyData(data);
      _ready = true;
      _setSyncLabel(`✅ Actualizado · ${_ts()}`);
      if (!silent) notify('✅ Datos actualizados desde Sheets', 'success');
    } catch (err) {
      _setSyncLabel('⚠️ Sin conexión — usando datos locales');
      if (!silent) notify('Sin conexión a Sheets, usando datos locales', 'warn');
      console.warn('[Sheets.loadAll]', err.message);
    } finally {
      _syncing = false;
    }
  }

  function _applyData(data) {
    if (!data) return;
    importAllData(data);          // storage.js

    // Refrescar todos los módulos
    updateUI();
    updateCajaHdr();
    updateVentasList();
    updatePendientesList();
    updateCreditosList();
    updateGastosList();
    updatePendBadge();
    updateClienteSuggestions();
    loadTransactions();
    loadAccountsTab();
    loadProdGrid();
    loadProdsManager();
    renderInventario();
  }

  // ─── PUSH COMPLETO → SHEETS ────────────────────────────────────
  // Sobrescribe todo el estado local en Sheets. Sincronización manual.
  async function pushAll() {
    if (!SCRIPT_URL || SCRIPT_URL === 'https://script.google.com/macros/s/AKfycbxtsZWha3hZank-scvto_ZybmmztSm_oCCpJVHtW4njql0LurVb2epatjkaQt5ewNS6iA/exec') {
      notify('Configura SCRIPT_URL en js/sheets.js', 'warning'); return;
    }
    _setSyncLabel('Enviando a Sheets…');
    notify('Sincronizando con Sheets…', 'info', 4000);
    try {
      await _call('syncAll', { data: exportAllData() });   // storage.js
      _setSyncLabel(`✅ Sincronizado · ${_ts()}`);
      notify('✅ Datos enviados a Sheets', 'success');
    } catch (err) {
      _setSyncLabel(`❌ ${err.message}`);
      notify('Error al sincronizar: ' + err.message, 'danger');
    }
  }

  // ─── ESCRITURA OPTIMISTA (fila a fila) ─────────────────────────
  // La UI ya actualizó localStorage antes de llamar estas funciones.
  // Si falla la llamada a Sheets, solo se registra en consola y el
  // próximo pushAll() lo corregirá.

  function appendRow(sheet, row) {
    if (!SCRIPT_URL || SCRIPT_URL === 'https://script.google.com/macros/s/AKfycbxtsZWha3hZank-scvto_ZybmmztSm_oCCpJVHtW4njql0LurVb2epatjkaQt5ewNS6iA/exec') return;
    _call('addRow', { sheet, row })
      .catch(err => console.warn(`[Sheets.appendRow:${sheet}]`, err.message));
  }

  function updateRow(sheet, id, data) {
    if (!SCRIPT_URL || SCRIPT_URL === 'https://script.google.com/macros/s/AKfycbxtsZWha3hZank-scvto_ZybmmztSm_oCCpJVHtW4njql0LurVb2epatjkaQt5ewNS6iA/exec') return;
    _call('updateRow', { sheet, id, data })
      .catch(err => console.warn(`[Sheets.updateRow:${sheet}]`, err.message));
  }

  function deleteRow(sheet, id) {
    if (!SCRIPT_URL || SCRIPT_URL === 'https://script.google.com/macros/s/AKfycbxtsZWha3hZank-scvto_ZybmmztSm_oCCpJVHtW4njql0LurVb2epatjkaQt5ewNS6iA/exec') return;
    _call('deleteRow', { sheet, id })
      .catch(err => console.warn(`[Sheets.deleteRow:${sheet}]`, err.message));
  }

  // ─── CONSTANTES DE HOJAS (contrato con Code.gs) ────────────────
  const HOJAS = {
    TRANSACCIONES: 'Transacciones',
    GASTOS:        'Gastos',
    CREDITOS:      'Creditos',
    PENDIENTES:    'Pendientes',
    INSUMOS:       'Inventario_Insumos',
    FACTURAS:      'Inventario_Facturas',
    MOV_INV:       'Inventario_Movimientos',
    PRODUCTOS:     'Productos'
  };

  return {
    testConnection,
    loadAll,
    pushAll,
    appendRow,
    updateRow,
    deleteRow,
    HOJAS,
    get isReady() { return _ready; }
  };

})();

// ─── Funciones globales llamadas desde el HTML ──────────────────
function testGSConnection() { Sheets.testConnection(); }
function syncToSheets()     { Sheets.pushAll(); }
function syncFromSheets()   { Sheets.loadAll(false); }

// La URL ya no se guarda en localStorage — está en el código.
// Se mantiene saveGSUrl() para no romper el botón del HTML.
function saveGSUrl() {
  notify('La URL está configurada en js/sheets.js · No se necesita guardarla por dispositivo.', 'info', 5000);
}

function loadGSUrlInput() {
  const el = document.getElementById('gsUrl');
  if (!el) return;
  el.value = '(URL configurada en js/sheets.js)';
  el.setAttribute('readonly', true);
  el.style.color = '#888';
  el.style.fontStyle = 'italic';
}
