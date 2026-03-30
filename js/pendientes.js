/* ══════════════════════════════════════════
   pendientes.js — Pedidos + Preventas  v4.0
   ─────────────────────────────────────────
   Nuevas funcionalidades:
   • Preventa: pedido con precio final editable por ítem.
     Se guarda con flag esPreventa=true y muestra badge "PREVENTA".
     Al cobrar, descuenta stock y registra al precio confirmado.
   ══════════════════════════════════════════ */

// ─── Modal "pedir nombre" snapshot ──────────────────────────────
let _pendingOrdenSnapshot = null;

// ─── GUARDAR PENDIENTE NORMAL ────────────────────────────────────
function guardarPendiente() {
  if (!ordenActual.length) { notify('Agrega productos al pedido', 'warning'); return; }
  const cliente = document.getElementById('ordenCliente').value.trim();
  if (!cliente) {
    _pendingOrdenSnapshot = [...ordenActual];
    _abrirPedirNombre('pendiente');
    return;
  }
  _guardarPendienteConCliente(cliente, false);
}

// ─── ABRIR MODAL PREVENTA ────────────────────────────────────────
function abrirPreventa() {
  if (!ordenActual.length) { notify('Agrega productos al pedido', 'warning'); return; }
  // Construir modal de preventa dinámicamente
  _renderPreventaModal();
  document.getElementById('preventaModal').classList.add('active');
}

function _renderPreventaModal() {
  const modal = document.getElementById('preventaModal');
  const body  = modal.querySelector('.mbody');

  // Items con precio editable
  const itemsHtml = ordenActual.map((it, idx) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--cream)">
      <div style="flex:1">
        <div style="font-weight:600;font-size:.88rem">${it.emoji||'☕'} ${it.nombre}</div>
        <div style="font-size:.75rem;color:#888">${it.qty} × precio normal: $${fmt(it.precio)}</div>
      </div>
      <div style="min-width:110px">
        <label style="font-size:.68rem;color:#aaa;display:block">Precio final $</label>
        <input type="number" id="pvPrecio_${idx}" value="${it.precio}"
               min="0" style="width:100%;text-align:right;font-weight:600"
               oninput="_calcPreventaTotal()">
      </div>
    </div>`).join('');

  body.innerHTML = `
    <div class="fg" style="margin-bottom:10px">
      <label><i class="fas fa-user" style="color:var(--cw)"></i> Cliente</label>
      <input type="text" id="pvCliente" placeholder="Nombre del cliente" list="clientesSuggestions" autocomplete="off">
      <datalist id="clientesSuggestions4"></datalist>
    </div>

    <div style="font-size:.78rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
      <i class="fas fa-tag"></i> Ajusta el precio por ítem
    </div>
    ${itemsHtml}

    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;margin-top:4px">
      <span style="font-weight:600">Total preventa:</span>
      <span id="pvTotal" style="font-family:'Playfair Display',serif;font-size:1.3rem;color:var(--cw);font-weight:700">$ 0</span>
    </div>

    <div class="fg">
      <label>Nota (opcional)</label>
      <input type="text" id="pvNota" placeholder="Ej: Entregar el viernes">
    </div>

    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-s btn-full" onclick="document.getElementById('preventaModal').classList.remove('active')">Cancelar</button>
      <button class="btn btn-p btn-full" onclick="confirmarPreventa()"><i class="fas fa-save"></i> Guardar Preventa</button>
    </div>`;

  // Sugerencias de clientes
  const dl = body.querySelector('#clientesSuggestions4');
  if (dl) _fillClienteSuggestions(dl);

  _calcPreventaTotal();
}

function _calcPreventaTotal() {
  let total = 0;
  ordenActual.forEach((it, idx) => {
    const el = document.getElementById(`pvPrecio_${idx}`);
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

  // Construir items con precio final
  const itemsFinal = ordenActual.map((it, idx) => {
    const el     = document.getElementById(`pvPrecio_${idx}`);
    const precio = el ? (parseFloat(el.value) || it.precio) : it.precio;
    return { ...it, precioFinal: precio };
  });

  const total   = itemsFinal.reduce((s, it) => s + it.precioFinal * it.qty, 0);
  const concepto = itemsFinal.map(it => `${it.qty}x ${it.nombre} ($${fmt(it.precioFinal)})`).join(', ');

  const p = {
    id:          Date.now(),
    cliente,
    concepto:    nota ? `${concepto} — ${nota}` : concepto,
    total,
    items:       itemsFinal,
    esPreventa:  true,
    nota,
    fecha:       fmtDateInput(new Date()),
    hora:        new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
  };

  pendientes.push(p);
  savePendientes();
  limpiarOrden();
  updatePendientesList();
  updatePendBadge();
  updateClienteSuggestions();
  document.getElementById('preventaModal').classList.remove('active');
  notify(`🏷️ Preventa de ${cliente} guardada — $${fmt(total)}`, 'success');
  switchTab('pendientes');
}

// ─── GUARDAR PENDIENTE NORMAL ────────────────────────────────────
function _abrirPedirNombre(modo = 'pendiente') {
  const modal = document.getElementById('pedirNombreModal');
  document.getElementById('pendNombreInput').value = '';
  const dl2 = document.getElementById('clientesSuggestions2');
  _fillClienteSuggestions(dl2);
  modal.dataset.modo = modo;
  modal.classList.add('active');
  setTimeout(() => document.getElementById('pendNombreInput').focus(), 200);
}

function confirmarGuardarPendienteConNombre() {
  const nombre = document.getElementById('pendNombreInput').value.trim();
  if (!nombre) { notify('Ingresa un nombre', 'warning'); return; }
  document.getElementById('pedirNombreModal').classList.remove('active');
  if (_pendingOrdenSnapshot) { ordenActual = [..._pendingOrdenSnapshot]; _pendingOrdenSnapshot = null; }

  const yaExiste = creditos.some(c => c.cliente.toLowerCase() === nombre.toLowerCase());
  if (!yaExiste) {
    creditos.push({ id: Date.now(), cliente: nombre, deuda: 0, desc: 'Cliente registrado al guardar pendiente', fecha: fmtDateInput(new Date()), pagos: [] });
    saveCreditos(); updateCreditosList();
  }
  _guardarPendienteConCliente(nombre, false);
}

function _guardarPendienteConCliente(cliente, esPreventa = false) {
  const total   = ordenActual.reduce((s,i) => s + i.precio * i.qty, 0);
  const concepto = ordenActual.map(i => `${i.qty}x ${i.nombre}`).join(', ');
  const p = {
    id: Date.now(), cliente, concepto, total,
    items: [...ordenActual],
    esPreventa,
    fecha: fmtDateInput(new Date()),
    hora:  new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
  };
  pendientes.push(p);
  savePendientes();
  limpiarOrden();
  updatePendientesList();
  updatePendBadge();
  updateClienteSuggestions();
  notify(`⏳ Pedido de ${p.cliente} guardado como pendiente`, 'info');
  switchTab('pendientes');
}

// ─── LISTA DE PENDIENTES ─────────────────────────────────────────
function updatePendientesList() {
  const list = document.getElementById('pendientesList');
  if (!pendientes.length) {
    list.innerHTML = `<div class="empty"><i class="fas fa-clock"></i><h3>Sin ventas pendientes</h3><p>Los pedidos guardados aparecerán aquí</p></div>`;
    updateCajaHdr();
    return;
  }
  list.innerHTML = '';
  pendientes.forEach(p => {
    const esPrev = !!p.esPreventa;
    const d = document.createElement('div');
    d.className = 'pending-card';
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
      <div class="pc-items">${p.concepto}</div>
      <div class="pc-actions">
        <button class="btn btn-ok btn-sm" onclick="cobrarPendiente(${p.id})"><i class="fas fa-money-bill-wave"></i> ${esPrev ? 'Entregar' : 'Cobrar'}</button>
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
  const c = { id: Date.now(), cliente: p.cliente, deuda: p.total, desc: p.concepto, fecha: p.fecha, pagos: [] };
  creditos.push(c);
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

// ─── SUGERENCIAS DE CLIENTE ──────────────────────────────────────
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
  ['clientesSuggestions','clientesSuggestions2','clientesSuggestions3'].forEach(dlId => {
    _fillClienteSuggestions(document.getElementById(dlId));
  });
}
