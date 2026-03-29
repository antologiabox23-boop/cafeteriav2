/* ══════════════════════════════════════════════════════════════════
   sheets.js — Google Sheets como base de datos en tiempo real
   v2.1 — GET para lecturas, POST para escrituras (sin límite de tamaño)

   ⚙️  ÚNICO PASO DE CONFIGURACIÓN:
       Reemplaza SCRIPT_URL con la URL de tu Apps Script desplegado.
       La misma URL funciona desde cualquier dispositivo sin config extra.
   ══════════════════════════════════════════════════════════════════ */

const Sheets = (() => {

  // ─── CONFIGURACIÓN ─────────────────────────────────────────────
  // Pega aquí la URL de tu Web App después de desplegar Code.gs:
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbybgi_Jo3xE7y429zyTtYWDrJgl1vnk9qIM7Q0ZdKuQ-_eYtY3jEq__4jGlF8RpNXI1/exec';
  // ───────────────────────────────────────────────────────────────

  const TIMEOUT_MS = 30000;
  let _ready   = false;
  let _syncing = false;

  // ─── HTTP HELPERS ──────────────────────────────────────────────

  // GET con payload base64 — para lecturas (ping, getAll)
  // No tiene payload grande, así que GET funciona bien.
  async function _get(action, payload = {}) {
    if (!_validUrl()) throw new Error('⚙️ Configura SCRIPT_URL en js/sheets.js');

    const jsonStr = JSON.stringify(payload);
    const bytes   = new TextEncoder().encode(jsonStr);
    const b64     = btoa(String.fromCharCode(...bytes));
    const url = `${SCRIPT_URL}?action=${action}&payload=${encodeURIComponent(b64)}`;

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
    return _parseResponse(res);
  }

  // POST con JSON en body — para escrituras (syncAll, addRow, updateRow, deleteRow)
  // Sin límite de tamaño. Apps Script acepta POST si el script lo maneja.
  async function _post(action, payload = {}) {
    if (!_validUrl()) throw new Error('⚙️ Configura SCRIPT_URL en js/sheets.js');

    const body = JSON.stringify({ action, payload });
    const ctrl    = new AbortController();
    const timerId = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain' }, // text/plain evita preflight CORS
        body
      });
    } catch (err) {
      clearTimeout(timerId);
      if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado. Verifica tu conexión.');
      throw err;
    }
    clearTimeout(timerId);
    return _parseResponse(res);
  }

  function _validUrl() {
    return SCRIPT_URL && SCRIPT_URL.startsWith('https://script.google.com/macros/s/AKfycbybgi_Jo3xE7y429zyTtYWDrJgl1vnk9qIM7Q0ZdKuQ-_eYtY3jEq__4jGlF8RpNXI1/exec');
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
      const r = await _get('ping');
      _setStatus(`✅ Conectado · ${r.spreadsheetName || 'Sheets OK'}`, 'success');
      notify('✅ Conexión exitosa', 'success');
    } catch (err) {
      _setStatus(`❌ ${err.message}`, 'error');
      notify('Error de conexión: ' + err.message, 'danger');
    }
  }

  // ─── CARGA INICIAL / PULL ───────────────────────────────────────
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
  // POST evita el límite de URL que causaba "Failed to fetch"
  async function pushAll() {
    if (!_validUrl()) { notify('Configura SCRIPT_URL en js/sheets.js', 'warning'); return; }
    _setSyncLabel('Enviando a Sheets…');
    notify('Sincronizando con Sheets…', 'info', 4000);
    try {
      await _post('syncAll', { data: exportAllData() });
      _setSyncLabel(`✅ Sincronizado · ${_ts()}`);
      notify('✅ Datos enviados a Sheets', 'success');
    } catch (err) {
      _setSyncLabel(`❌ ${err.message}`);
      notify('Error al sincronizar: ' + err.message, 'danger');
    }
  }

  // ─── ESCRITURA OPTIMISTA (fila a fila) — también POST ──────────
  function appendRow(sheet, row) {
    if (!_validUrl()) return;
    _post('addRow', { sheet, row })
      .catch(err => console.warn(`[Sheets.appendRow:${sheet}]`, err.message));
  }

  function updateRow(sheet, id, data) {
    if (!_validUrl()) return;
    _post('updateRow', { sheet, id, data })
      .catch(err => console.warn(`[Sheets.updateRow:${sheet}]`, err.message));
  }

  function deleteRow(sheet, id) {
    if (!_validUrl()) return;
    _post('deleteRow', { sheet, id })
      .catch(err => console.warn(`[Sheets.deleteRow:${sheet}]`, err.message));
  }

  // ─── CONSTANTES DE HOJAS ───────────────────────────────────────
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
