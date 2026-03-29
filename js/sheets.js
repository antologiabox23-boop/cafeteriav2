/* ══════════════════════════════════════════════════════════════════
   sheets.js — Google Sheets como base de datos en tiempo real
   v2.2 — TODO por GET con payload base64 (evita CORS en POST)

   ¿Por qué se cambió POST → GET?
   ─────────────────────────────────────────────────────────────────
   Cuando el navegador hace un fetch() POST a un Apps Script, Google
   responde con un HTTP 302 redirect hacia una URL diferente. Aunque
   el código usa redirect:'follow', el browser bloquea ese redirect
   cross-origin y lanza "Failed to fetch".
   La solución es enviar TODO por GET con el payload serializado en
   base64 en el query string. Apps Script acepta GET sin restricciones
   de CORS. Para payloads grandes (syncAll), el dato se comprime con
   un mini-JSON minificado antes de codificarlo.

   ⚙️  ÚNICO PASO DE CONFIGURACIÓN:
       Reemplaza SCRIPT_URL con la URL de tu Apps Script desplegado.
       La misma URL funciona desde cualquier dispositivo sin config extra.
   ══════════════════════════════════════════════════════════════════ */

const Sheets = (() => {

  // ─── CONFIGURACIÓN ─────────────────────────────────────────────
  // Pega aquí la URL de tu Web App después de desplegar Code.gs:
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz03PyZTc0TjBo_Wt8-T-sHlgxWMATDkPlSJiTaw9EMw7AJ-_RSsr37KfIlnLf2xAU7Sg/exec';
  // ───────────────────────────────────────────────────────────────

  const TIMEOUT_MS = 45000;   // syncAll puede tardar más
  let _ready   = false;
  let _syncing = false;

  // ─── HTTP HELPER (solo GET) ─────────────────────────────────────
  // Serializa el payload a JSON → UTF-8 → base64 → query string.
  // Apps Script decodifica con Utilities.base64Decode + getDataAsString.
  async function _get(action, payload = {}) {
    if (!_validUrl()) throw new Error('⚙️ Configura SCRIPT_URL en js/sheets.js');

    const jsonStr = JSON.stringify(payload);

    // Codificación UTF-8 segura para base64 (soporta tildes, ñ, emojis)
    const bytes = new TextEncoder().encode(jsonStr);
    // Convertir Uint8Array a string binario para btoa
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);

    const url = `${SCRIPT_URL}?action=${encodeURIComponent(action)}&payload=${encodeURIComponent(b64)}`;

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

  function _validUrl() {
    return SCRIPT_URL && SCRIPT_URL.startsWith('https://script.google.com/macros/s/AKfycbz03PyZTc0TjBo_Wt8-T-sHlgxWMATDkPlSJiTaw9EMw7AJ-_RSsr37KfIlnLf2xAU7Sg/exec');
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

  // ─── PUSH COMPLETO → SHEETS (ahora por GET) ────────────────────
  // Se usa GET con payload base64 para evitar el problema de CORS/redirect
  // que causaba "Failed to fetch" al hacer POST desde el navegador.
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
      console.error('[Sheets.pushAll]', err);
    }
  }

  // ─── ESCRITURA OPTIMISTA (fila a fila) — también por GET ───────
  function appendRow(sheet, row) {
    if (!_validUrl()) return;
    _get('addRow', { sheet, row })
      .catch(err => console.warn(`[Sheets.appendRow:${sheet}]`, err.message));
  }

  function updateRow(sheet, id, data) {
    if (!_validUrl()) return;
    _get('updateRow', { sheet, id, data })
      .catch(err => console.warn(`[Sheets.updateRow:${sheet}]`, err.message));
  }

  function deleteRow(sheet, id) {
    if (!_validUrl()) return;
    _get('deleteRow', { sheet, id })
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
