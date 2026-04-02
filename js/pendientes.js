/* ══════════════════════════════════════════
   pendientes.js — Pedidos + Preventas  v4.1
   ─────────────────────────────────────────
   Preventa con entregas PARCIALES:
   • Se crea con lista de productos, cantidades totales y precio/und.
   • Cada entrega permite indicar cuántas unidades se entregan ahora.
   • Cada entrega: descuenta stock + registra ingreso parcial.
   • La preventa permanece con saldo restante hasta agotar.
   • Al entregar el último ítem se cierra automáticamente.
   ══════════════════════════════════════════ */

let _pendingOrdenSnapshot = null;

// ─────────────────────────────────────────
// PENDIENTE NORMAL
// ─────────────────────────────────────────
function guardarPendiente() {
  if (!ordenActual.length) { notify('Agrega productos al pedido', 'warning'); return; }
  const cliente = document.getElementById('ordenCliente').value.trim();
  if (!cliente) {
    _pendingOrdenSnapshot = [...ordenActual];
    _abrirPedirNombre();
    return;
  }
  _guardarPendienteConCliente(cliente);
}

function _abrirPedirNombre() {
  document.getElementById('pendNombreInput').value = '';
  _fillClienteSuggestions(document.getElementById('clientesSuggestions2'));
  document.getElementById('pedirNombreModal').classList.add('active');
  setTimeout(() => document.getElementById('pendNombreInput').focus(), 200);
}

function confirmarGuardarPendienteConNombre() {
  const nombre = document.getElementById('pendNombreInput').value.trim();
  if (!nombre) { notify('Ingresa un nombre', 'warning'); return; }
  document.getElementById('pedirNombreModal').classList.remove('active');
  if (_pendingOrdenSnapshot) { ordenActual = [..._pendingOrdenSnapshot]; _pendingOrdenSnapshot = null; }
  const yaExiste = creditos.some(c => c.cliente.toLowerCase() === nombre.toLowerCase());
  if (!yaExiste) {
    const credAuto = { id: Date.now(), cliente: nombre, deuda: 0,
      desc: 'Cliente registrado al guardar pendiente', fecha: fmtDateInput(new Date()), pagos: [], _isNew: true };
    creditos.push(credAuto);
    saveCreditos(); updateCreditosList();
    // FIX: sincronizar cliente auto-creado con Sheets
    sheetsSync('credito', credAuto);
  }
  _guardarPendienteConCliente(nombre);
}

function _guardarPendienteConCliente(cliente) {
  const total    = ordenActual.reduce((s,i) => s + i.precio * i.qty, 0);
  const concepto = ordenActual.map(i => `${i.qty}x ${i.nombre}`).join(', ');
  const p = {
    id: Date.now(), cliente, concepto, total,
    items: [...ordenActual], esPreventa: false,
    fecha: fmtDateInput(new Date()),
    hora:  new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
  };
  p._isNew = true;
  pendientes.push(p);
  savePendientes(); limpiarOrden(); updatePendientesList();
  updatePendBadge(); updateClienteSuggestions();
  sheetsSync('pendiente', p);
  notify(`⏳ Pedido de ${p.cliente} guardado como pendiente`, 'info');
  switchTab('pendientes');
}

// ─────────────────────────────────────────
// PREVENTA — CREAR
// ─────────────────────────────────────────
function abrirPreventa() {
  if (!ordenActual.length) { notify('Agrega productos al pedido', 'warning'); return; }
  _renderPreventaModal();
  document.getElementById('preventaModal').classList.add('active');
}

function _renderPreventaModal() {
  const body = document.getElementById('preventaModal').querySelector('.mbody');

  const itemsHtml = ordenActual.map((it, idx) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--cream)">
      <div style="flex:1">
        <div style="font-weight:600;font-size:.88rem">${it.emoji||'☕'} ${it.nombre}</div>
        <div style="font-size:.75rem;color:#888">${it.qty} und · precio catálogo: $${fmt(it.precio)}</div>
      </div>
      <div style="min-width:110px">
        <label style="font-size:.68rem;color:#aaa;display:block">Precio/und $</label>
        <input type="number" id="pvPrecio_${idx}" value="${it.precio}" min="0"
               style="width:100%;text-align:right;font-weight:600"
               oninput="_calcPreventaTotal()">
      </div>
    </div>`).join('');

  body.innerHTML = `
    <div class="fg" style="margin-bottom:10px">
      <label><i class="fas fa-user" style="color:var(--cw)"></i> Cliente</label>
      <input type="text" id="pvCliente" placeholder="Nombre del cliente"
             list="pvClientesSuggestions" autocomplete="off">
      <datalist id="pvClientesSuggestions"></datalist>
    </div>
    <div style="font-size:.78rem;font-weight:600;color:#888;text-transform:uppercase;
                letter-spacing:.5px;margin-bottom:6px">
      <i class="fas fa-boxes"></i> Productos y precio por unidad
    </div>
    ${itemsHtml}
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:10px 0;margin-top:4px;border-top:2px solid var(--cream)">
      <span style="font-weight:600">Total a cobrar ahora:</span>
      <span id="pvTotal" style="font-family:'Playfair Display',serif;font-size:1.3rem;
            color:var(--cw);font-weight:700">$ 0</span>
    </div>

    <div class="stitle" style="font-size:.82rem;margin:8px 0 6px">
      <i class="fas fa-credit-card"></i> Método de pago
    </div>
    <div class="pmethods" style="flex-wrap:wrap;margin-bottom:10px">
      <button class="pmb sel" data-cuenta="efectivo" onclick="_selPvPay(this)">
        <i class="fas fa-money-bill-wave" style="color:#d97706"></i>Efectivo</button>
      <button class="pmb" data-cuenta="nequi" onclick="_selPvPay(this)">
        <i class="fas fa-mobile-alt" style="color:#7c3aed"></i>Nequi</button>
      <button class="pmb" data-cuenta="bancolombia" onclick="_selPvPay(this)">
        <i class="fas fa-university" style="color:#0284c7"></i>Bancolombia</button>
      <button class="pmb" data-cuenta="daviplata" onclick="_selPvPay(this)">
        <i class="fas fa-wallet" style="color:#059669"></i>Daviplata</button>
    </div>

    <div class="fg">
      <label>Nota (opcional)</label>
      <input type="text" id="pvNota" placeholder="Ej: Entregar el viernes, 10 unidades…">
    </div>
    <div style="background:#ede9fe;border-radius:var(--rs);padding:9px 12px;
                font-size:.78rem;color:#5b21b6;margin-bottom:10px">
      <i class="fas fa-info-circle"></i>
      El <strong>pago se registra ahora</strong>. La tarjeta queda en Pendientes solo para
      hacer seguimiento de la <strong>entrega física</strong>.
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-s btn-full"
              onclick="document.getElementById('preventaModal').classList.remove('active')">
        Cancelar
      </button>
      <button class="btn btn-p btn-full" onclick="confirmarPreventa()">
        <i class="fas fa-check-circle"></i> Cobrar y guardar preventa
      </button>
    </div>`;

  window._pvPayMethod = 'efectivo';
  _fillClienteSuggestions(body.querySelector('#pvClientesSuggestions'));
  _calcPreventaTotal();
}

function _selPvPay(btn) {
  document.querySelectorAll('#preventaModal .pmb').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  window._pvPayMethod = btn.getAttribute('data-cuenta');
}

function _calcPreventaTotal() {
  let total = 0;
  ordenActual.forEach((it, idx) => {
    const el    = document.getElementById(`pvPrecio_${idx}`);
    const precio = el ? (parseFloat(el.value) || 0) : it.precio;
    total += precio * it.qty;
  });
  const el = document.getElementById('pvTotal');
  if (el) el.textContent = `$ ${fmt(total)}`;
}

function confirmarPreventa() {
  const cliente  = document.getElementById('pvCliente')?.value.trim();
  const nota     = document.getElementById('pvNota')?.value.trim() || '';
  const cuentaKey = window._pvPayMethod || 'efectivo';
  if (!cliente) { notify('Ingresa el nombre del cliente', 'warning'); return; }

  const itemsFinal = ordenActual.map((it, idx) => {
    const el     = document.getElementById(`pvPrecio_${idx}`);
    const precio = el ? (parseFloat(el.value) || it.precio) : it.precio;
    return { ...it, qtyTotal: it.qty, qtyEntregado: 0, precioUnit: precio };
  });

  const totalPreventa = itemsFinal.reduce((s, it) => s + it.precioUnit * it.qtyTotal, 0);
  const concepto = itemsFinal.map(it =>
    `${it.qtyTotal}x ${it.nombre} @ $${fmt(it.precioUnit)}`).join(', ');

  const fecha = fmtDateInput(new Date());
  const hora  = new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });

  // ── Registrar ingreso inmediatamente ──
  const txConcepto = nota
    ? `[Preventa] ${cliente} — ${concepto} — ${nota}`
    : `[Preventa] ${cliente} — ${concepto}`;
  const tx = {
    id: Date.now(), date: fecha, concept: txConcepto,
    amount: totalPreventa, type: 'ingreso', esventa: true,
    cliente, accKey: cuentaKey, accName: accounts[cuentaKey].name
  };
  accounts[cuentaKey].transactions.push(tx);
  saveAccounts();
  sheetsSync('venta', tx);

  // ── Guardar preventa solo para seguimiento de entrega ──
  const p = {
    id:             Date.now() + 1,
    cliente,
    concepto:       nota ? `${concepto} — ${nota}` : concepto,
    total:          totalPreventa,
    totalEntregado: 0,
    items:          itemsFinal,
    esPreventa:     true,
    pagado:         true,          // dinero ya ingresado
    cuentaKey,
    nota,
    fecha,
    hora
  };

  pendientes.push(p);
  savePendientes(); limpiarOrden(); updatePendientesList();
  updatePendBadge(); updateClienteSuggestions();
  updateUI(); updateCajaHdr(); updateVentasList(); loadTransactions();
  document.getElementById('preventaModal').classList.remove('active');
  notify(`✅ Preventa cobrada — $${fmt(totalPreventa)} en ${accounts[cuentaKey].name}. Pendiente: entrega de productos.`, 'success');
  switchTab('pendientes');
}

// ─────────────────────────────────────────
// PREVENTA — ENTREGAR (parcial)
// ─────────────────────────────────────────
function abrirEntregaPreventa(id) {
  const p = pendientes.find(x => x.id === id);
  if (!p) return;
  const hayPendiente = p.items.some(it => (it.qtyEntregado || 0) < it.qtyTotal);
  if (!hayPendiente) { notify('Esta preventa ya fue entregada completamente', 'info'); return; }
  _renderEntregaModal(p);
  document.getElementById('entregaPreventaModal').classList.add('active');
}

function _renderEntregaModal(p) {
  const body        = document.getElementById('entregaPreventaModal').querySelector('.mbody');
  const totalEnt    = p.totalEntregado || 0;
  const totalRest   = p.total - totalEnt;

  const itemsHtml = p.items.map((it, idx) => {
    const entregado = it.qtyEntregado || 0;
    const restante  = it.qtyTotal - entregado;
    if (restante <= 0) return `
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:8px;background:#f0fdf4;border-radius:var(--rs);margin-bottom:6px;opacity:.6">
        <span style="font-size:.85rem">${it.emoji||'☕'} ${it.nombre}</span>
        <span style="color:var(--ok);font-size:.8rem;font-weight:600">✅ Completado</span>
      </div>`;

    return `
      <div style="background:var(--latte);border-radius:var(--rs);padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600;font-size:.88rem">${it.emoji||'☕'} ${it.nombre}</div>
            <div style="font-size:.72rem;color:#888">
              $${fmt(it.precioUnit)}/und · entregado: ${entregado}/${it.qtyTotal}
            </div>
          </div>
          <div style="text-align:center;min-width:90px">
            <label style="font-size:.68rem;color:#aaa;display:block">Entregar ahora</label>
            <input type="number" id="entQty_${idx}"
                   value="${restante}" min="0" max="${restante}" step="1"
                   style="width:76px;text-align:center;font-weight:700;font-size:1.05rem"
                   oninput="_calcEntregaTotal('${p.id}')">
            <div style="font-size:.65rem;color:#aaa">de ${restante} disponibles</div>
          </div>
        </div>
      </div>`;
  }).join('');

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:8px 0;margin-bottom:10px;border-bottom:2px solid var(--cream)">
      <div>
        <div style="font-weight:700;font-size:.95rem">
          <i class="fas fa-user" style="color:var(--cw)"></i> ${p.cliente}
        </div>
        <div style="font-size:.72rem;color:#888">${p.fecha} ${p.hora||''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.7rem;color:#aaa">Saldo por cobrar</div>
        <div style="font-family:'Playfair Display',serif;font-size:1.15rem;
                    font-weight:700;color:var(--cw)">$ ${fmt(totalRest)}</div>
      </div>
    </div>

    <div style="font-size:.78rem;font-weight:600;color:#888;text-transform:uppercase;
                letter-spacing:.5px;margin-bottom:8px">
      <i class="fas fa-box-open"></i> ¿Cuántas unidades entregas ahora?
    </div>
    ${itemsHtml}

    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:10px 0;border-top:2px solid var(--cream);margin-bottom:10px">
      <span style="font-weight:600">Cobrar esta entrega:</span>
      <span id="entTotal" style="font-family:'Playfair Display',serif;font-size:1.3rem;
            color:var(--cw);font-weight:700">$ 0</span>
    </div>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:var(--rs);
                padding:9px 12px;font-size:.78rem;color:#166534;margin-bottom:10px">
      <i class="fas fa-check-circle"></i>
      <strong>Pago ya registrado</strong> al crear la preventa.
      Solo confirma la entrega física de los productos.
    </div>

    <input type="hidden" id="entregaPreventaId" value="${p.id}">
    <div style="display:flex;gap:8px">
      <button class="btn btn-s btn-full"
              onclick="document.getElementById('entregaPreventaModal').classList.remove('active')">
        Cancelar
      </button>
      <button class="btn btn-ok btn-full" onclick="confirmarEntregaPreventa()">
        <i class="fas fa-check-circle"></i> Confirmar Entrega
      </button>
    </div>`;

  window._entregaPayMethod = 'efectivo';
  _calcEntregaTotal(p.id);
}

function selEntregaPay(btn) {
  document.querySelectorAll('#entregaPreventaModal .pmb').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  window._entregaPayMethod = btn.getAttribute('data-cuenta');
}

function _calcEntregaTotal(pid) {
  const p = pendientes.find(x => x.id == pid);
  if (!p) return;
  let total = 0;
  p.items.forEach((it, idx) => {
    const restante = it.qtyTotal - (it.qtyEntregado || 0);
    if (restante <= 0) return;
    const el  = document.getElementById(`entQty_${idx}`);
    const qty = el ? Math.min(Math.max(0, parseInt(el.value) || 0), restante) : 0;
    total += qty * it.precioUnit;
  });
  const el = document.getElementById('entTotal');
  if (el) el.textContent = `$ ${fmt(total)}`;
}

function confirmarEntregaPreventa() {
  const pid  = document.getElementById('entregaPreventaId')?.value;
  const numPid = Number(pid);
  const pIdx = pendientes.findIndex(x => Number(x.id) === numPid);
  if (pIdx === -1) return;

  const p = pendientes[pIdx];

  // Recolectar cantidades a entregar ahora
  const entregas = [];
  p.items.forEach((it, idx) => {
    const restante  = it.qtyTotal - (it.qtyEntregado || 0);
    if (restante <= 0) return;
    const el       = document.getElementById(`entQty_${idx}`);
    const qtyAhora = el ? Math.min(Math.max(0, parseInt(el.value) || 0), restante) : 0;
    if (qtyAhora > 0) entregas.push({ it, idx, qtyAhora });
  });

  if (!entregas.length) { notify('Ingresa al menos 1 unidad a entregar', 'warning'); return; }

  // 1. Actualizar cantidades entregadas
  entregas.forEach(({ idx, qtyAhora }) => {
    pendientes[pIdx].items[idx].qtyEntregado =
      (pendientes[pIdx].items[idx].qtyEntregado || 0) + qtyAhora;
  });
  const unidadesEsta = entregas.reduce((s, e) => s + e.qtyAhora, 0);
  pendientes[pIdx].totalEntregado = (pendientes[pIdx].totalEntregado || 0) +
    entregas.reduce((s, e) => s + e.qtyAhora * e.it.precioUnit, 0);

  // 2. Descontar stock (el dinero ya fue cobrado al crear la preventa)
  descontarStockPorVenta(entregas.map(({ it, qtyAhora }) => ({ ...it, qty: qtyAhora })));

  // 3. ¿Completada? → eliminar de pendientes
  const quedanItems = pendientes[pIdx].items.some(
    it => (it.qtyEntregado || 0) < it.qtyTotal
  );
  const detalle = entregas.map(e => `${e.qtyAhora}x ${e.it.nombre}`).join(', ');
  if (!quedanItems) {
    pendientes.splice(pIdx, 1);
    notify(`📦 Entrega completa — ${p.cliente} recibió todos sus productos`, 'success');
  } else {
    const entregadas = p.items.reduce((s, it) => s + (it.qtyEntregado || 0), 0);
    const totalUnd   = p.items.reduce((s, it) => s + it.qtyTotal, 0);
    notify(`📦 Entrega parcial — ${detalle} · ${entregadas}/${totalUnd} unidades en total`, 'info');
  }

  savePendientes();
  updatePendientesList(); updatePendBadge();
  document.getElementById('entregaPreventaModal').classList.remove('active');
}

// ─────────────────────────────────────────
// LISTA DE PENDIENTES
// ─────────────────────────────────────────
function updatePendientesList() {
  const list = document.getElementById('pendientesList');
  if (!pendientes.length) {
    list.innerHTML = `<div class="empty"><i class="fas fa-clock"></i>
      <h3>Sin ventas pendientes</h3><p>Los pedidos guardados aparecerán aquí</p></div>`;
    updateCajaHdr();
    return;
  }
  list.innerHTML = '';
  pendientes.forEach(p => {
    const esPrev = p.esPreventa === true || p.esPreventa === 1 || p.esPreventa === 'true';
    const d = document.createElement('div');
    d.className = 'pending-card';

    // Barra de progreso solo para preventas
    let progressHtml = '';
    if (esPrev) {
      const totalUnd  = p.items.reduce((s, it) => s + it.qtyTotal, 0);
      const entUnd    = p.items.reduce((s, it) => s + (it.qtyEntregado || 0), 0);
      const pct       = totalUnd > 0 ? Math.round((entUnd / totalUnd) * 100) : 0;
      const itemRows  = p.items.map(it => {
        const ent  = it.qtyEntregado || 0;
        const rest = it.qtyTotal - ent;
        return `<span style="font-size:.72rem;color:${rest<=0?'var(--ok)':'#888'}">${it.emoji||'☕'} ${ent}/${it.qtyTotal}${rest<=0?' ✅':''}</span>`;
      }).join(' &middot; ');

      progressHtml = `
        <div style="margin:6px 0 2px">${itemRows}</div>
        <div style="background:#e9e9e9;border-radius:10px;height:6px;margin:5px 0 3px;overflow:hidden">
          <div style="background:var(--ok);height:6px;border-radius:10px;width:${pct}%;transition:width .3s"></div>
        </div>
        <div style="font-size:.7rem;color:#888;text-align:right">${entUnd}/${totalUnd} unidades entregadas</div>`;
    }

    d.innerHTML = `
      <div class="pc-hdr">
        <div>
          <div class="pc-name">
            <i class="fas fa-user" style="color:var(--cw);margin-right:5px"></i>${p.cliente}
            ${esPrev
              ? '<span class="badge" style="background:#7c3aed;color:white;font-size:.65rem;padding:2px 7px;border-radius:10px;margin-left:4px">PREVENTA</span>'
              : ''}
          </div>
          <div class="pc-time">${p.fecha} ${p.hora || ''}</div>
        </div>
        ${esPrev
          ? '<span style="background:#f0fdf4;color:var(--ok);font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:10px;border:1px solid #86efac">✅ PAGADO</span>'
          : `<div class="pc-total">$ ${fmt(p.total)}</div>`}
      </div>
      <div class="pc-items" style="font-size:.78rem;color:#888;margin:4px 0">${p.concepto}</div>
      ${progressHtml}
      <div class="pc-actions" style="margin-top:8px">
        ${esPrev
          ? `<button class="btn btn-ok btn-sm" onclick="abrirEntregaPreventa(${p.id})"><i class="fas fa-box-open"></i> Entregar</button>`
          : `<button class="btn btn-ok btn-sm" onclick="cobrarPendiente(${p.id})"><i class="fas fa-money-bill-wave"></i> Cobrar</button>`}
        ${!esPrev ? `<button class="btn btn-warn btn-sm" onclick="moverACreditoPendiente(${p.id})"><i class="fas fa-user-clock"></i> A Crédito</button>` : ''}
        <button class="btn btn-d btn-sm" onclick="eliminarPendiente(${p.id})"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(d);
  });
  updateCajaHdr();
}

function updatePendBadge() {
  const b = document.getElementById('pendBadge');
  if (pendientes.length > 0) { b.textContent = pendientes.length; b.style.display = 'inline'; }
  else b.style.display = 'none';
}

function cobrarPendiente(id) { abrirCobro(true, id); }

function moverACreditoPendiente(id) {
  const p = pendientes.find(x => x.id === id);
  if (!p) return;
  const restante = p.esPreventa ? (p.total - (p.totalEntregado || 0)) : p.total;
  const nuevoCred = { id: Date.now(), cliente: p.cliente, deuda: restante,
                  desc: p.concepto, fecha: p.fecha, pagos: [], _isNew: true };
  creditos.push(nuevoCred);
  pendientes = pendientes.filter(x => x.id !== id);
  saveCreditos(); savePendientes();
  sheetsSync('credito', nuevoCred);
  Sheets.deleteRow(Sheets.HOJAS.PENDIENTES, id);
  updatePendientesList(); updatePendBadge(); updateCreditosList();
  notify(`💳 Pedido de ${p.cliente} movido a crédito`, 'info');
}

function eliminarPendiente(id) {
  if (!confirm('¿Eliminar este pendiente?')) return;
  pendientes = pendientes.filter(x => x.id !== id);
  savePendientes(); updatePendientesList(); updatePendBadge();
  // FIX: sincronizar eliminación con Sheets
  Sheets.deleteRow(Sheets.HOJAS.PENDIENTES, id);
  notify('Pendiente eliminado', 'info');
}

// ─────────────────────────────────────────
// SUGERENCIAS DE CLIENTE
// ─────────────────────────────────────────
function _fillClienteSuggestions(dl) {
  if (!dl) return;
  dl.innerHTML = '';
  const names = new Set();
  creditos.forEach(c => names.add(c.cliente));
  for (const k in accounts) accounts[k].transactions.forEach(tx => { if (tx.cliente) names.add(tx.cliente); });
  pendientes.forEach(p => { if (p.cliente && p.cliente !== 'Sin nombre') names.add(p.cliente); });
  names.forEach(n => { const o = document.createElement('option'); o.value = n; dl.appendChild(o); });
}

function updateClienteSuggestions() {
  ['clientesSuggestions','clientesSuggestions2','clientesSuggestions3'].forEach(id => {
    _fillClienteSuggestions(document.getElementById(id));
  });
}
