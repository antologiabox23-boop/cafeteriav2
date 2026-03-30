/* ══════════════════════════════════════════════════════════════════
   sheets.js — Google Sheets como base de datos  v3.0
   ─────────────────────────────────────────────────────────────────
   Cambios v3.0:
   • Se eliminan HOJAS.INSUMOS y HOJAS.MOV_INV.
   • Nueva hoja STOCK_MOVS — movimientos de stock de productos.
   • Los productos ahora incluyen el campo `stock` en la hoja Productos.
   • Todo sigue por GET + base64 (sin POST, evita CORS).
   ══════════════════════════════════════════════════════════════════ */

const Sheets = (() => {

  // ─── CONFIGURACIÓN ─────────────────────────────────────────────
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhLwKekzS_OuSDK3kRwb75ohpzleVJeh3BRdNv89Ud1hMWjzZPE6nooTyHS0n4Iw2riQ/exec';
  // ───────────────────────────────────────────────────────────────

  const TIMEOUT_MS = 45000;
  let _ready   = false;
  let _syncing = false;

  async function _get(action, payload = {}) {
    if (!_validUrl()) throw new Error('⚙️ Configura SCRIPT_URL en js/sheets.js');
    const jsonStr = JSON.stringify(payload);
    const bytes   = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    const url = `${SCRIPT_URL}?action=${encodeURIComponent(action)}&payload=${encodeURIComponent(b64)}`;
    const ctrl    = new AbortController();
    const timerId = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    } catch (err) {
      clearTimeout(timerId);
      if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado.');
      throw err;
    }
    clearTimeout(timerId);
    return _parseResponse(res);
  }

  function _validUrl() {
    return SCRIPT_URL && SCRIPT_URL.startsWith('https://script.google.com/macros/s/');
  }

  async function _parseResponse(res) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text  = await res.text();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Respuesta vacía del servidor');
    let json;
    try { json = JSON.parse(match[0]); }
    catch (e) { throw new Error('JSON inválido: ' + text.substring(0, 120)); }
    if (json.error) throw new Error(json.error);
    return json.data ?? json;
  }

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

  async function testConnection() {
    _setStatus('Probando conexión…', 'info');
    try {
      const r = await _get('ping');
      _setStatus(`✅ Conectado · ${r.spreadsheetName || 'Sheets OK'}`, 'success');
      notify('✅ Conexión exitosa', 'success');
    } catch (err) {
      _setStatus(`❌ ${err.message}`, 'error');
      notify('Error de conexión: ' + err.message, 'danger');
    }
  }

  async function loadAll(silent = false) {
    if (!_validUrl()) return;
    if (_syncing) return;
    _syncing = true;
    _setSyncLabel('Descargando desde Sheets…');
    if (!silent) notify('Descargando datos de Sheets…', 'info', 4000);
    try {
      const data = await _get('getAll');
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
    importAllData(data);
    updateUI(); updateCajaHdr(); updateVentasList(); updatePendientesList();
    updateCreditosList(); updateGastosList(); updatePendBadge();
    updateClienteSuggestions(); loadTransactions(); loadAccountsTab();
    loadProdGrid(); loadProdsManager(); renderInventario();
  }

  async function pushAll() {
    if (!_validUrl()) { notify('Configura SCRIPT_URL en js/sheets.js', 'warning'); return; }
    _setSyncLabel('Enviando a Sheets…');
    notify('Sincronizando con Sheets…', 'info', 4000);
    try {
      await _get('syncAll', { data: exportAllData() });
      _setSyncLabel(`✅ Sincronizado · ${_ts()}`);
      notify('✅ Datos enviados a Sheets', 'success');
    } catch (err) {
      _setSyncLabel(`❌ ${err.message}`);
      notify('Error al sincronizar: ' + err.message, 'danger');
    }
  }

  function appendRow(sheet, row) {
    if (!_validUrl()) return;
    _get('addRow', { sheet, row }).catch(err => console.warn(`[Sheets.appendRow:${sheet}]`, err.message));
  }
  function updateRow(sheet, id, data) {
    if (!_validUrl()) return;
    _get('updateRow', { sheet, id, data }).catch(err => console.warn(`[Sheets.updateRow:${sheet}]`, err.message));
  }
  function deleteRow(sheet, id) {
    if (!_validUrl()) return;
    _get('deleteRow', { sheet, id }).catch(err => console.warn(`[Sheets.deleteRow:${sheet}]`, err.message));
  }

  const HOJAS = {
    TRANSACCIONES: 'Transacciones',
    GASTOS:        'Gastos',
    CREDITOS:      'Creditos',
    PENDIENTES:    'Pendientes',
    FACTURAS:      'Inventario_Facturas',
    STOCK_MOVS:    'Stock_Movimientos',
    PRODUCTOS:     'Productos'
  };

  return {
    testConnection, loadAll, pushAll, appendRow, updateRow, deleteRow,
    HOJAS, get isReady() { return _ready; }
  };
})();

function testGSConnection() { Sheets.testConnection(); }
function syncToSheets()     { Sheets.pushAll(); }
function syncFromSheets()   { Sheets.loadAll(false); }

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
