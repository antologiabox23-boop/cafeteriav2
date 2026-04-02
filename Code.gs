// ══════════════════════════════════════════════════════════════════
//  Antología Box 23 — Apps Script Backend  v2.1
//
//  DESPLIEGUE:
//  1. script.google.com → Nuevo proyecto → pega este código
//  2. Implementar → Nueva implementación
//     · Tipo: Aplicación web
//     · Ejecutar como: Yo
//     · Acceso: Cualquier persona
//  3. Copia la URL → pégala en js/sheets.js → SCRIPT_URL
//  4. Cada cambio al código requiere NUEVA implementación
// ══════════════════════════════════════════════════════════════════

// ─── Nombres de hojas ────────────────────────────────────────────
var SH = {
  TRANS:    'Transacciones',
  GASTOS:   'Gastos',
  CREDITOS: 'Creditos',
  PEND:     'Pendientes',
  INSUMOS:  'Inventario_Insumos',
  FACTURAS: 'Inventario_Facturas',
  MOV_INV:  'Inventario_Movimientos',
  PRODS:      'Productos',
  STOCK_MOVS: 'Stock_Movimientos',
  CIERRES:    'Cierres',
  CONFIG:     'Config',
  LOG:        'Log'
};

// ─── Cabeceras por hoja (definen columnas y orden) ───────────────
var HEADERS = {
  'Transacciones':          ['cuenta','cuentaKey','id','date','concept','amount','type','esventa','cliente','facturaId','gastoId'],
  'Gastos':                 ['id','concepto','monto','categoria','cuenta','fecha','nota'],
  'Creditos':               ['id','cliente','deuda','desc','fecha','pagos'],
  'Pendientes':             ['id','cliente','concepto','total','items','fecha','hora','esPreventa','pagado','totalEntregado','cuentaKey'],
  'Inventario_Insumos':     ['id','nombre','emoji','unidad','stockActual','stockMin','categoria'],
  'Inventario_Facturas':    ['id','proveedor','numero','fecha','cuenta','nota','total','items'],
  'Inventario_Movimientos': ['id','insumoId','insumoNombre','emoji','unidad','cantidad','tipo','motivo','fecha'],
  'Productos':              ['id','nombre','emoji','precio','stock'],
  'Stock_Movimientos':      ['id','prodId','prodNombre','emoji','cantidad','tipo','motivo','fecha'],
  'Cierres':                ['id','fecha','baseEfectivo','hora'],
  'Config':                 ['clave','valor','fecha'],
  'Log':                    ['timestamp','accion','detalle']
};

// ═══════════════════════════════════════════════════════════════
//  ENTRY POINT
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    var action  = (e && e.parameter && e.parameter.action)  || '';
    var encoded = (e && e.parameter && e.parameter.payload) || '';

    // Decodificar payload base64 → UTF-8 → JSON
    var payload = {};
    if (encoded) {
      try {
        var bytes   = Utilities.base64Decode(encoded);
        var jsonStr = Utilities.newBlob(bytes).getDataAsString('UTF-8');
        payload = JSON.parse(jsonStr);
      } catch (decErr) {
        Logger.log('Payload decode warning: ' + decErr.message);
      }
    }

    var result;
    switch (action) {
      case 'ping':      result = handlePing();                 break;
      case 'getAll':    result = handleGetAll();               break;
      case 'syncAll':   result = handleSyncAll(payload.data);  break;
      case 'addRow':    result = handleAddRow(payload);        break;
      case 'updateRow': result = handleUpdateRow(payload);     break;
      case 'deleteRow': result = handleDeleteRow(payload);     break;
      default:          result = { ok: false, error: 'Accion desconocida: ' + action };
    }

    return _jsonResponse(result);

  } catch (err) {
    _logError(err);
    return _jsonResponse({ ok: false, error: err.message });
  }
}

function _jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════
//  PING
// ═══════════════════════════════════════════════════════════════
function handlePing() {
  var ss = _getOrCreateSS();
  _ensureAllSheets(ss);
  return { ok: true, data: { spreadsheetName: ss.getName(), ts: new Date().toISOString() } };
}

// ═══════════════════════════════════════════════════════════════
//  GET ALL
// ═══════════════════════════════════════════════════════════════
function handleGetAll() {
  var ss = _getOrCreateSS();
  _ensureAllSheets(ss);

  var data = {
    accounts:      _readTransacciones(ss),
    gastos:        _readRows(ss, SH.GASTOS,   _mapGasto),
    creditos:      _readRows(ss, SH.CREDITOS, _mapCredito),
    pendientes:    _readRows(ss, SH.PEND,     _mapPendiente),
    insumos:       _readRows(ss, SH.INSUMOS,  _mapInsumo),
    facturas:      _readRows(ss, SH.FACTURAS, _mapFactura),
    movInventario: _readRows(ss, SH.MOV_INV,  _mapMovInv),
    productos:     _readRows(ss, SH.PRODS,    _mapProducto),
    stockMovs:     _readRows(ss, SH.STOCK_MOVS, _mapStockMov),
    cierres:       _readRows(ss, SH.CIERRES,    _mapCierre),
    exportedAt:    new Date().toISOString()
  };
  _log(ss, 'getAll', 'OK');
  return { ok: true, data: data };
}

// ═══════════════════════════════════════════════════════════════
//  SYNC ALL
// ═══════════════════════════════════════════════════════════════
function handleSyncAll(data) {
  if (!data) return { ok: false, error: 'Sin datos en payload' };
  var ss = _getOrCreateSS();
  _ensureAllSheets(ss);

  _writeTransacciones(ss, data.accounts      || {});
  _writeRows(ss, SH.GASTOS,   data.gastos        || [], _rowGasto);
  _writeRows(ss, SH.CREDITOS, data.creditos      || [], _rowCredito);
  _writeRows(ss, SH.PEND,     data.pendientes    || [], _rowPendiente);
  _writeRows(ss, SH.INSUMOS,  data.insumos       || [], _rowInsumo);
  _writeRows(ss, SH.FACTURAS, data.facturas      || [], _rowFactura);
  _writeRows(ss, SH.MOV_INV,    data.movInventario || [], _rowMovInv);
  _writeRows(ss, SH.PRODS,      data.productos     || [], _rowProducto);
  _writeRows(ss, SH.STOCK_MOVS, data.stockMovs     || [], _rowStockMov);
  _writeRows(ss, SH.CIERRES,    data.cierres       || [], _rowCierre);
  _writeConfig(ss, data.exportedAt);
  _log(ss, 'syncAll', 'OK');
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
//  ADD ROW (escritura optimista)
// ═══════════════════════════════════════════════════════════════
function handleAddRow(payload) {
  var sheet = payload.sheet;
  var row   = payload.row;
  if (!sheet || !row) return { ok: false, error: 'sheet y row requeridos' };

  var ss = _getOrCreateSS();
  _ensureAllSheets(ss);
  var sh = ss.getSheetByName(sheet);
  if (!sh) return { ok: false, error: 'Hoja no encontrada: ' + sheet };

  var headers = HEADERS[sheet] || [];
  if (!headers.length) return { ok: false, error: 'Headers no definidos para: ' + sheet };

  var values = headers.map(function(h) {
    var v = row[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
  sh.appendRow(values);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
//  UPDATE ROW
// ═══════════════════════════════════════════════════════════════
function handleUpdateRow(payload) {
  var sheet = payload.sheet;
  var id    = payload.id;
  var data  = payload.data;
  if (!sheet || !id || !data) return { ok: false, error: 'sheet, id y data requeridos' };

  var ss = _getOrCreateSS();
  var sh = ss.getSheetByName(sheet);
  if (!sh) return { ok: false, error: 'Hoja no encontrada: ' + sheet };

  var rowIdx = _findRowById(sh, id);
  if (!rowIdx) return { ok: false, error: 'Fila no encontrada con id: ' + id };

  var headers = HEADERS[sheet] || [];
  var values = headers.map(function(h) {
    var v = data[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
  sh.getRange(rowIdx, 1, 1, values.length).setValues([values]);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
//  DELETE ROW
// ═══════════════════════════════════════════════════════════════
function handleDeleteRow(payload) {
  var sheet = payload.sheet;
  var id    = payload.id;
  if (!sheet || !id) return { ok: false, error: 'sheet e id requeridos' };

  var ss = _getOrCreateSS();
  var sh = ss.getSheetByName(sheet);
  if (!sh) return { ok: true }; // hoja no existe, nada que borrar

  var rowIdx = _findRowById(sh, id);
  if (rowIdx) sh.deleteRow(rowIdx);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
//  SPREADSHEET HELPERS
// ═══════════════════════════════════════════════════════════════
function _getOrCreateSS() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('SS_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch(e) {
       Logger.log('No se pudo abrir SS con id ' + id + ': ' + e.message);
    }
  }
  var ss = SpreadsheetApp.create('Antologia Box 23 - Datos');
  props.setProperty('SS_ID', ss.getId());
  return ss;
}

function _ensureAllSheets(ss) {
  var names = Object.values ? Object.values(SH) : Object.keys(SH).map(function(k){ return SH[k]; });
  names.forEach(function(name) {
    if (!ss.getSheetByName(name)) {
      var sh = ss.insertSheet(name);
      _writeHeader(sh, name);
    }
  });
  // Eliminar hoja vacía por defecto si existe
  ['Hoja 1', 'Sheet1'].forEach(function(n) {
    var s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1) {
      try { ss.deleteSheet(s); } catch(e) {}
    }
  });
}

function _writeHeader(sh, name) {
  var h = HEADERS[name];
  if (!h || !h.length) return;
  var range = sh.getRange(1, 1, 1, h.length);
  range.setValues([h]);
  range.setBackground('#0a1a12').setFontColor('#00e5cc').setFontWeight('bold');
  sh.setFrozenRows(1);
}

function _clearData(ss, name) {
  if (!ss) return;
  var sh = ss.getSheetByName(name);
  if (!sh) return;
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;
  sh.getRange(2, 1, lastRow - 1, lastCol).clearContent();
}

// FIX: cada hoja puede tener el campo 'id' en columnas distintas.
// 'Transacciones' tiene: ['cuenta','cuentaKey','id',...] → id está en col 3 (índice 2)
// Todas las demás hojas tienen 'id' en col 1 (índice 0).
// Esta función detecta automáticamente la columna correcta usando HEADERS.
function _findRowById(sh, id) {
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  // Determinar columna del campo 'id' según la hoja
  var sheetName = sh.getName();
  var headers   = HEADERS[sheetName] || [];
  var idColIdx  = headers.indexOf('id'); // índice 0-based; -1 si no se encuentra
  if (idColIdx < 0) idColIdx = 0;        // fallback: columna 1
  var idCol = idColIdx + 1;              // Apps Script usa índice 1-based

  var lastCol = sh.getLastColumn();
  if (idCol > lastCol) return null;

  var vals = sh.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) return i + 2;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  WRITE HELPERS
// ═══════════════════════════════════════════════════════════════
function _writeRows(ss, sheetName, arr, rowFn) {
  if (!ss) return;
  _clearData(ss, sheetName);
  if (!arr || !arr.length) return;

  var sh = ss.getSheetByName(sheetName);
  if (!sh) return; // _ensureAllSheets debería haberla creado

  var rows = arr.map(rowFn).filter(function(r) { return r && r.length; });
  if (!rows.length) return;

  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function _writeTransacciones(ss, accs) {
  _clearData(ss, SH.TRANS);
  var sh   = ss.getSheetByName(SH.TRANS);
  if (!sh) return;
  var rows = [];
  for (var k in accs) {
    var a = accs[k];
    var txs = a.transactions || [];
    for (var i = 0; i < txs.length; i++) {
      var tx = txs[i];
      rows.push([
        a.name, k, tx.id, tx.date, tx.concept, tx.amount,
        tx.type || (tx.amount >= 0 ? 'ingreso' : 'egreso'),
        tx.esventa ? 'SI' : 'NO',
        tx.cliente   || '',
        tx.facturaId || '',
        tx.gastoId   || ''
      ]);
    }
  }
  if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function _writeConfig(ss, exportedAt) {
  _clearData(ss, SH.CONFIG);
  var sh  = ss.getSheetByName(SH.CONFIG);
  if (!sh) return;
  var now = new Date().toISOString();
  sh.getRange(2, 1, 2, 3).setValues([
    ['ultima_sync',  now,              now],
    ['exportedAt',   exportedAt || now, now]
  ]);
}

// ─── objeto → array (para escritura) ────────────────────────────
function _rowGasto(g) {
  return [g.id, g.concepto, g.monto, g.categoria, g.cuenta, g.fecha, g.nota || ''];
}
function _rowCredito(c) {
  return [c.id, c.cliente, c.deuda, c.desc, c.fecha, JSON.stringify(c.pagos || [])];
}
function _rowPendiente(p) {
  return [
    p.id, p.cliente, p.concepto, p.total, JSON.stringify(p.items || []), p.fecha, p.hora || '',
    p.esPreventa ? 'true' : '',
    p.pagado     ? 'true' : '',
    p.totalEntregado || 0,
    p.cuentaKey  || ''
  ];
}
function _rowInsumo(i) {
  return [i.id, i.nombre, i.emoji || '', i.unidad, i.stockActual, i.stockMin || 0, i.categoria || ''];
}
function _rowFactura(f) {
  return [f.id, f.proveedor, f.numero || '', f.fecha, f.cuenta, f.nota || '', f.total, JSON.stringify(f.items || [])];
}
function _rowMovInv(m) {
  return [m.id, m.insumoId || '', m.insumoNombre, m.emoji || '', m.unidad, m.cantidad, m.tipo, m.motivo, m.fecha];
}
function _rowProducto(p) {
  return [p.id, p.nombre, p.emoji || '', p.precio, p.stock !== undefined && p.stock !== null ? p.stock : ''];
}

// ═══════════════════════════════════════════════════════════════
//  READ HELPERS
// ═══════════════════════════════════════════════════════════════
function _readRows(ss, sheetName, mapFn) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, lastCol)
    .getValues()
    .filter(function(r) { return r[0] !== '' && r[0] !== null; })
    .map(mapFn)
    .filter(Boolean);
}

function _readTransacciones(ss) {
  var base = {
    efectivo:    { name:'Efectivo',    color:'efectivo',    transactions:[], balance:0 },
    nequi:       { name:'Nequi',       color:'nequi',       transactions:[], balance:0 },
    bancolombia: { name:'Bancolombia', color:'bancolombia', transactions:[], balance:0 },
    daviplata:   { name:'Daviplata',   color:'daviplata',   transactions:[], balance:0 }
  };
  var sh = ss.getSheetByName(SH.TRANS);
  if (!sh || sh.getLastRow() < 2) return base;
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return base;
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(lastCol, 11)).getValues();
  data.forEach(function(r) {
    var k = r[1];
    if (!k || !base[k]) return;
    base[k].transactions.push({
      id:        Number(r[2])  || Date.now(),
      date:      _dateStr(r[3]),
      concept:   r[4]          || '',
      amount:    Number(r[5])  || 0,
      type:      r[6]          || 'ingreso',
      esventa:   r[7]          === 'SI',
      cliente:   r[8]          || null,
      facturaId: r[9]          || undefined,
      gastoId:   r[10]         || undefined
    });
  });
  return base;
}

// ─── array → objeto (para lectura) ──────────────────────────────
function _mapGasto(r) {
  return { id:r[0], concepto:r[1], monto:Number(r[2]), categoria:r[3], cuenta:r[4], fecha:_dateStr(r[5]), nota:r[6]||'' };
}
function _mapCredito(r) {
  var p = [];
  try { p = JSON.parse(r[5] || '[]'); } catch(e) {}
  return { id:r[0], cliente:r[1], deuda:Number(r[2]), desc:r[3], fecha:_dateStr(r[4]), pagos:p };
}
function _mapPendiente(r) {
  var it = [];
  try { it = JSON.parse(r[4] || '[]'); } catch(e) {}
  return {
    id:             Number(r[0]),
    cliente:        r[1],
    concepto:       r[2],
    total:          Number(r[3]),
    items:          it,
    fecha:          _dateStr(r[5]),
    hora:           r[6] || '',
    esPreventa:     r[7] === 'true' || r[7] === true,
    pagado:         r[8] === 'true' || r[8] === true,
    totalEntregado: Number(r[9]) || 0,
    cuentaKey:      r[10] || ''
  };
}
function _mapInsumo(r) {
  return { id:Number(r[0]), nombre:r[1], emoji:r[2]||'', unidad:r[3], stockActual:Number(r[4]), stockMin:Number(r[5]), categoria:r[6]||'' };
}
function _mapFactura(r) {
  var it = [];
  try { it = JSON.parse(r[7] || '[]'); } catch(e) {}
  return { id:Number(r[0]), proveedor:r[1], numero:r[2]||'', fecha:_dateStr(r[3]), cuenta:r[4], nota:r[5]||'', total:Number(r[6]), items:it };
}
function _rowStockMov(m) {
  return [m.id, m.prodId||'', m.prodNombre||'', m.emoji||'', m.cantidad, m.tipo, m.motivo||'', m.fecha];
}
function _mapStockMov(r) {
  return { id:r[0], prodId:Number(r[1])||null, prodNombre:r[2]||'', emoji:r[3]||'', cantidad:Number(r[4]), tipo:r[5], motivo:r[6]||'', fecha:_dateStr(r[7]) };
}
function _rowCierre(c) {
  return [c.id, c.fecha, c.baseEfectivo||0, c.hora||''];
}
function _mapCierre(r) {
  return { id:r[0], fecha:_dateStr(r[1]), baseEfectivo:Number(r[2])||0, hora:r[3]||'' };
}
function _mapMovInv(r) {
  return { id:r[0], insumoId:r[1]||null, insumoNombre:r[2], emoji:r[3]||'', unidad:r[4], cantidad:Number(r[5]), tipo:r[6], motivo:r[7], fecha:_dateStr(r[8]) };
}
function _mapProducto(r) {
  var stock = r[4] !== '' && r[4] !== null && r[4] !== undefined ? Number(r[4]) : null;
  return { id:Number(r[0]), nombre:r[1], emoji:r[2]||'', precio:Number(r[3]), stock:stock };
}

// ─── Fecha: Date de Sheets → 'YYYY-MM-DD' ───────────────────────
function _dateStr(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v instanceof Date && !isNaN(v)) {
    var y = v.getFullYear();
    var m = String(v.getMonth() + 1).padStart('2', '0');
    var d = String(v.getDate()).padStart('2', '0');
    return y + '-' + m + '-' + d;
  }
  return String(v);
}

// ─── Log ─────────────────────────────────────────────────────────
function _log(ss, action, detail) {
  try {
    var sh = ss.getSheetByName(SH.LOG);
    if (sh) sh.appendRow([new Date().toISOString(), action, detail]);
  } catch(e) {}
}
function _logError(err) {
  try {
    var ss = _getOrCreateSS();
    var sh = ss.getSheetByName(SH.LOG);
    if (sh) sh.appendRow([new Date().toISOString(), 'ERROR', err.message]);
  } catch(e) {}
}
