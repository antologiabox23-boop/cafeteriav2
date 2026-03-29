/* ══════════════════════════════════════════
   pendientes.js — Pedidos pendientes de pago
   ══════════════════════════════════════════ */

function guardarPendiente() {
  if (!ordenActual.length) { notify('Agrega productos al pedido', 'warning'); return; }
  const cliente = document.getElementById('ordenCliente').value.trim();
  if (!cliente) {
    _pendingOrdenSnapshot = [...ordenActual];
    document.getElementById('pendNombreInput').value = '';
    const dl2 = document.getElementById('clientesSuggestions2');
    dl2.innerHTML = '';
    const names = new Set();
    creditos.forEach(c => names.add(c.cliente));
    for (const k in accounts) accounts[k].transactions.forEach(tx => { if (tx.cliente) names.add(tx.cliente); });
    pendientes.forEach(p => { if (p.cliente && p.cliente !== 'Sin nombre') names.add(p.cliente); });
    names.forEach(n => { const o = document.createElement('option'); o.value = n; dl2.appendChild(o); });
    document.getElementById('pedirNombreModal').classList.add('active');
    setTimeout(() => document.getElementById('pendNombreInput').focus(), 200);
    return;
  }
  _guardarPendienteConCliente(cliente);
}

function confirmarGuardarPendienteConNombre() {
  const nombre = document.getElementById('pendNombreInput').value.trim();
  if (!nombre) { notify('Ingresa un nombre', 'warning'); return; }
  document.getElementById('pedirNombreModal').classList.remove('active');
  if (_pendingOrdenSnapshot) { ordenActual = [..._pendingOrdenSnapshot]; _pendingOrdenSnapshot = null; }
  const yaExiste = creditos.some(c => c.cliente.toLowerCase() === nombre.toLowerCase());
  if (!yaExiste) {
    creditos.push({ id: Date.now(), cliente: nombre, deuda: 0, desc: 'Cliente registrado al guardar pendiente', fecha: fmtDateInput(new Date()), pagos: [] });
    saveCreditos();
    updateCreditosList();
  }
  _guardarPendienteConCliente(nombre);
}

function _guardarPendienteConCliente(cliente) {
  const total = ordenActual.reduce((s,i) => s + i.precio * i.qty, 0);
  const concepto = ordenActual.map(i => `${i.qty}x ${i.nombre}`).join(', ');
  const p = {
    id: Date.now(), cliente, concepto, total,
    items: [...ordenActual],
    fecha: fmtDateInput(new Date()),
    hora: new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
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

function updatePendientesList() {
  const list = document.getElementById('pendientesList');
  if (!pendientes.length) {
    list.innerHTML = `<div class="empty"><i class="fas fa-clock"></i><h3>Sin ventas pendientes</h3><p>Los pedidos guardados aparecerán aquí</p></div>`;
    updateCajaHdr();
    return;
  }
  list.innerHTML = '';
  pendientes.forEach(p => {
    const d = document.createElement('div');
    d.className = 'pending-card';
    d.innerHTML = `
      <div class="pc-hdr">
        <div>
          <div class="pc-name"><i class="fas fa-user" style="color:var(--cw);margin-right:5px"></i>${p.cliente}</div>
          <div class="pc-time">${p.fecha} ${p.hora || ''}</div>
        </div>
        <div class="pc-total">$ ${fmt(p.total)}</div>
      </div>
      <div class="pc-items">${p.concepto}</div>
      <div class="pc-actions">
        <button class="btn btn-ok btn-sm" onclick="cobrarPendiente(${p.id})"><i class="fas fa-money-bill-wave"></i> Cobrar</button>
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

function updateClienteSuggestions() {
  ['clientesSuggestions','clientesSuggestions3'].forEach(dlId => {
    const dl = document.getElementById(dlId);
    if (!dl) return;
    dl.innerHTML = '';
    const names = new Set();
    creditos.forEach(c => names.add(c.cliente));
    for (const k in accounts) accounts[k].transactions.forEach(tx => { if (tx.cliente) names.add(tx.cliente); });
    pendientes.forEach(p => { if (p.cliente && p.cliente !== 'Sin nombre') names.add(p.cliente); });
    names.forEach(n => { const o = document.createElement('option'); o.value = n; dl.appendChild(o); });
  });
}
