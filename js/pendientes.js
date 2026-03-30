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
    creditos.push({ id: Date.now(), cliente: nombre, deuda: 0,
      desc: 'Cliente registrado al guardar pendiente', fecha: fmtDateInput(new Date()), pagos: [] });
    saveCreditos(); updateCreditosList();
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
  pendientes.push(p);
  savePendientes(); limpiarOrden(); updatePendientesList();
  updatePendBadge(); updateClienteSuggestions();
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
      <span style="font-weight:600">Total preventa:</span>
      <span id="pvTotal" style="font-family:'Playfair Display',serif;font-size:1.3rem;
            color:var(--cw);font-weight:700">$ 0</span>
    </div>
    <div class="fg">
      <label>Nota (opcional)</label>
      <input type="text" id="pvNota" placeholder="Ej: Pago contraentrega, entregar viernes…">
    </div>
    <div style="background:#ede9fe;border-radius:var(--rs);padding:9px 12px;
                font-size:.78rem;color:#5b21b6;margin-bottom:10px">
      <i class="fas fa-info-circle"></i>
      Las entregas son <strong>parciales</strong>: cada vez que pulses «Entregar» indicas
      cuántas unidades das ahora. El saldo queda abierto hasta completar el pedido.
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-s btn-full"
              onclick="document.getElementById('preventaModal').classList.remove('active')">
        Cancelar
      </button>
      <button class="btn btn-p btn-full" onclick="confirmarPreventa()">
        <i class="fas fa-save"></i> Guardar Preventa
      </button>
    </div>`;

  _fillClienteSuggestions(body.querySelector('#pvClientesSuggestions'));
  _calcPreventaTotal();
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
  const cliente = document.getElementById('pvCliente')?.value.trim();
  const nota    = document.getElementById('pvNota')?.value.trim() || '';
  if (!cliente) { notify('Ingresa el nombre del cliente', 'warning'); return; }

  const itemsFinal = ordenActual.map((it, idx) => {
    const el     = document.getElementById(`pvPrecio_${idx}`);
    const precio = el ? (parseFloat(el.value) || it.precio) : it.precio;
    return { ...it, qtyTotal: it.qty, qtyEntregado: 0, precioUnit: precio };
  });

  const totalPreventa = itemsFinal.reduce((s, it) => s + it.precioUnit * it.qtyTotal, 0);
  const concepto = itemsFinal.map(it =>
    `${it.qtyTotal}x ${it.nombre} @ $${fmt(it.precioUnit)}`).join(', ');

  const p = {
    id:             Date.now(),
    cliente,
    concepto:       nota ? `${concepto} — ${nota}` : concepto,
    total:          totalPreventa,
    totalEntregado: 0,
    items:          itemsFinal,
    esPreventa:     true,
    nota,
    fecha:          fmtDateInput(new Date()),
    hora:           new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
  };

  pendientes.push(p);
  savePendientes(); limpiarOrden(); updatePendientesList();
  updatePendBadge(); updateClienteSuggestions();
  document.getElementById('preventaModal').classList.remove('active');
  notify(`🏷️ Preventa de ${cliente} guardada — total $${fmt(totalPreventa)}`, 'success');
  switchTab('pendientes');
}

// ─────────────────────────────────────────
// PREVENTA — ENTREGAR (parcial)
// ─────────────────────────────────────────
function abrirEntregaPreventa(id) {
  // Buscar con comparación flexible (id puede llegar como string desde onclick)
  const numId = Number(id);
  const p = pendientes.find(x => Number(x.id) === numId);
  if (!p) { notify('Preventa no encontrada', 'error'); return; }
  const hayPendiente = p.items.some(it => (it.qtyEntregado || 0) < it.qtyTotal);
  if (!hayPendiente) { notify('Esta preventa ya fue entregada completamente', 'info'); return; }
  // Cerrar cualquier modal abierto antes de abrir éste
  document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  _renderEntregaModal(p);
  // Usar setTimeout para asegurar que el DOM se actualice antes de mostrar el modal
  setTimeout(() => {
    document.getElementById('entregaPreventaModal').classList.add('active');
  }, 10);
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

    <div class="stitle" style="font-size:.82rem;margin-bottom:6px">
      <i class="fas fa-credit-card"></i> Método de pago
    </div>
    <div class="pmethods" style="flex-wrap:wrap;margin-bottom:12px">
      <button class="pmb sel" data-cuenta="efectivo" onclick="selEntregaPay(this)">
        <i class="fas fa-money-bill-wave" style="color:#d97706"></i>Efectivo</button>
      <button class="pmb" data-cuenta="nequi" onclick="selEntregaPay(this)">
        <i class="fas fa-mobile-alt" style="color:#7c3aed"></i>Nequi</button>
      <button class="pmb" data-cuenta="bancolombia" onclick="selEntregaPay(this)">
        <i class="fas fa-university" style="color:#0284c7"></i>Bancolombia</button>
      <button class="pmb" data-cuenta="daviplata" onclick="selEntregaPay(this)">
        <i class="fas fa-wallet" style="color:#059669"></i>Daviplata</button>
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
  const p = pendientes.find(x => Number(x.id) === Number(pid));
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
  const pid    = document.getElementById('entregaPreventaId')?.value;
  const cuenta = window._entregaPayMethod || 'efectivo';
  const numPid = Number(pid);
  const pIdx   = pendientes.findIndex(x => Number(x.id) === numPid);
  if (pIdx === -1) return;

  const p     = pendientes[pIdx];
  const fecha = fmtDateInput(new Date());

  // Recolectar cantidades
  const entregas = [];
  p.items.forEach((it, idx) => {
    const restante  = it.qtyTotal - (it.qtyEntregado || 0);
    if (restante <= 0) return;
    const el       = document.getElementById(`entQty_${idx}`);
    const qtyAhora = el ? Math.min(Math.max(0, parseInt(el.value) || 0), restante) : 0;
    if (qtyAhora > 0) entregas.push({ it, idx, qtyAhora });
  });

  if (!entregas.length) { notify('Ingresa al menos 1 unidad a entregar', 'warning'); return; }

  const totalEsta = entregas.reduce((s, e) => s + e.qtyAhora * e.it.precioUnit, 0);
  if (!totalEsta)  { notify('El total de esta entrega es $0', 'warning'); return; }

  // 1. Actualizar cantidades entregadas
  entregas.forEach(({ idx, qtyAhora }) => {
    pendientes[pIdx].items[idx].qtyEntregado =
      (pendientes[pIdx].items[idx].qtyEntregado || 0) + qtyAhora;
  });
  pendientes[pIdx].totalEntregado = (pendientes[pIdx].totalEntregado || 0) + totalEsta;

  // 2. Descontar stock
  descontarStockPorVenta(entregas.map(({ it, qtyAhora }) => ({ ...it, qty: qtyAhora })));

  // 3. Registrar ingreso
  const detalle  = entregas.map(e => `${e.qtyAhora}x ${e.it.nombre}`).join(', ');
  const concepto = `[Preventa] ${p.cliente} — ${detalle}`;
  const tx = {
    id: Date.now(), date: fecha, concept: concepto,
    amount: totalEsta, type: 'ingreso', esventa: true,
    cliente: p.cliente, accKey: cuenta, accName: accounts[cuenta].name
  };
  accounts[cuenta].transactions.push(tx);
  saveAccounts();
  sheetsSync('venta', tx);

  // 4. ¿Completada?
  const quedanItems = pendientes[pIdx].items.some(
    it => (it.qtyEntregado || 0) < it.qtyTotal
  );
  if (!quedanItems) {
    pendientes.splice(pIdx, 1);
    notify(`✅ Preventa de ${p.cliente} completada · $${fmt(totalEsta)} cobrado`, 'success');
  } else {
    const restanteTotal = pendientes[pIdx].total - pendientes[pIdx].totalEntregado;
    notify(`📦 Entrega parcial · $${fmt(totalEsta)} · Saldo: $${fmt(restanteTotal)}`, 'success');
  }

  savePendientes();
  updateUI(); updateCajaHdr(); updateVentasList(); loadTransactions();
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
      const totalEnt = p.totalEntregado || 0;
      const pct      = p.total > 0 ? Math.round((totalEnt / p.total) * 100) : 0;
      const restante = p.total - totalEnt;
      const itemRows = p.items.map(it => {
        const ent  = it.qtyEntregado || 0;
        const rest = it.qtyTotal - ent;
        return `<span style="font-size:.72rem;color:${rest<=0?'var(--ok)':'#888'}">${it.emoji||'☕'} ${ent}/${it.qtyTotal}${rest<=0?' ✅':''}</span>`;
      }).join(' &middot; ');

      progressHtml = `
        <div style="margin:6px 0 2px">${itemRows}</div>
        <div style="background:#e9e9e9;border-radius:10px;height:5px;margin:4px 0 2px;overflow:hidden">
          <div style="background:var(--ok);height:5px;border-radius:10px;width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.7rem">
          <span style="color:#aaa">Cobrado: $${fmt(totalEnt)}</span>
          <span style="color:var(--cw);font-weight:600">Pendiente: $${fmt(restante)}</span>
        </div>`;
    }

    d.innerHTML = `
      <div class="pc-hdr">
        <div>
          <div class="pc-name">
            <i class="fas fa-user" style="color:var(--cw);margin-right:5px"></i>${p.cliente}
            ${esPrev ? '<span class="badge" style="background:#7c3aed;color:white;font-size:.65rem;padding:2px 7px;border-radius:10px;margin-left:6px">PREVENTA</span>' : ''}
          </div>
          <div class="pc-time">${p.fecha} ${p.hora || ''}</div>
        </div>
        <div class="pc-total">$ ${fmt(p.total)}</div>
      </div>
      <div class="pc-items" style="font-size:.78rem;color:#888;margin:4px 0">${p.concepto}</div>
      ${progressHtml}
      <div class="pc-actions" style="margin-top:8px">
        ${esPrev
          ? `<button class="btn btn-ok btn-sm" onclick="abrirEntregaPreventa(${p.id})"><i class="fas fa-box-open"></i> Entregar</button>`
          : `<button class="btn btn-ok btn-sm" onclick="cobrarPendiente(${p.id})"><i class="fas fa-money-bill-wave"></i> Cobrar</button>`}
        <button class="btn btn-warn btn-sm" onclick="moverACreditoPendiente(${p.id})"><i class="fas fa-user-clock"></i> A Crédito</button>
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
  creditos.push({ id: Date.now(), cliente: p.cliente, deuda: restante,
                  desc: p.concepto, fecha: p.fecha, pagos: [] });
  pendientes = pendientes.filter(x => x.id !== id);
  saveCreditos(); savePendientes();
  updatePendientesList(); updatePendBadge(); updateCreditosList();
  notify(`💳 Pedido de ${p.cliente} movido a crédito`, 'info');
}

function eliminarPendiente(id) {
  if (!confirm('¿Eliminar este pendiente?')) return;
  pendientes = pendientes.filter(x => x.id !== id);
  savePendientes(); updatePendientesList(); updatePendBadge();
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
