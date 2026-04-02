/* ══════════════════════════════════════════
   creditos.js — Módulo de Créditos
   ══════════════════════════════════════════ */

function deudaRestante(c) {
  const pagado = c.pagos.reduce((s,p) => s + p.monto, 0);
  return c.deuda - pagado;
}

function updateCreditosList() {
  const list = document.getElementById('creditosList');
  const sum = document.getElementById('creditoSummary');

  const groups = {};
  creditos.forEach(c => {
    const key = c.cliente.trim().toLowerCase();
    if (!groups[key]) groups[key] = { nombre: c.cliente.trim(), ids: [], deudaTotal: 0, pagosTotal: 0, items: [], allPagos: [] };
    groups[key].ids.push(c.id);
    groups[key].items.push(c);
    groups[key].deudaTotal += c.deuda;
    groups[key].pagosTotal += c.pagos.reduce((s,p) => s + p.monto, 0);
    c.pagos.forEach(p => groups[key].allPagos.push(p));
  });

  const groupList = Object.values(groups).map(g => ({ ...g, restante: g.deudaTotal - g.pagosTotal }));
  const totalDeuda = groupList.reduce((s,g) => s + (g.restante > 0 ? g.restante : 0), 0);
  const activosCount = groupList.filter(g => g.restante > 0).length;

  if (totalDeuda > 0) {
    sum.innerHTML = `
      <div class="credito-summary">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:.75rem;opacity:.8;text-transform:uppercase;letter-spacing:.5px">Total en Crédito</div>
            <div style="font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700">$ ${fmt(totalDeuda)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:.75rem;opacity:.8">Clientes activos</div>
            <div style="font-size:1.4rem;font-weight:700">${activosCount}</div>
          </div>
        </div>
      </div>`;
  } else {
    sum.innerHTML = '';
  }

  if (!groupList.length) {
    list.innerHTML = `<div class="empty"><i class="fas fa-user-clock"></i><h3>Sin créditos registrados</h3><p>Los clientes con crédito aparecerán aquí</p></div>`;
    return;
  }

  list.innerHTML = '';
  groupList.sort((a,b) => b.restante - a.restante).forEach(g => {
    if (g.deudaTotal === 0) return;
    const d = document.createElement('div');
    d.className = 'credito-card';
    const saldo = g.restante;
    const pagado = g.pagosTotal;
    const historial = g.items.map(item =>
      `<div style="font-size:.78rem;color:#888;margin-bottom:3px">
        ${fmtDate(item.fecha)} · <em>${item.desc}</em> · <span class="negative">$ ${fmt(item.deuda)}</span>
      </div>`
    ).join('');
    const pagosHist = g.allPagos.length ? g.allPagos.slice(-3).map(p =>
      `<span style="font-size:.75rem;color:var(--ok)">+$ ${fmt(p.monto)} (${fmtDate(p.fecha)})</span>`
    ).join(' · ') : '';

    d.innerHTML = `
      <div class="cc-hdr">
        <div class="cc-name"><i class="fas fa-user" style="color:var(--err);margin-right:5px"></i>${g.nombre}</div>
        <div class="cc-debt">$ ${fmt(saldo > 0 ? saldo : 0)}</div>
      </div>
      <div class="cc-history">${historial}</div>
      ${pagosHist ? `<div style="margin-bottom:8px">${pagosHist}</div>` : ''}
      ${pagado > 0 ? `<div style="font-size:.78rem;color:var(--ok);margin-bottom:8px">✅ Pagado: $ ${fmt(pagado)}</div>` : ''}
      <div class="cc-actions">
        ${saldo > 0 ? `
          <button class="btn btn-ok btn-sm" onclick="abrirAbono(${g.items[0].id})"><i class="fas fa-dollar-sign"></i> Abono</button>
          <button class="btn btn-p btn-sm" onclick="pagarTodo(${g.items[0].id})"><i class="fas fa-check"></i> Pagar Todo</button>
        ` : '<span class="badge bs">✅ Saldado</span>'}
        <button class="btn btn-d btn-sm" onclick="eliminarCreditoGrupo('${g.nombre.toLowerCase()}')"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(d);
  });
}

function abrirNuevoCredito() {
  document.getElementById('creditoId').value = '';
  document.getElementById('creditoCliente').value = '';
  document.getElementById('creditoDeuda').value = '';
  document.getElementById('creditoDesc').value = '';
  document.getElementById('creditoFecha').value = fmtDateInput(new Date());
  updateClienteSuggestions();
  document.getElementById('creditoModal').classList.add('active');
}

function abrirAbono(cid) {
  document.getElementById('abonoCreditoId').value = cid;
  const c = creditos.find(x => x.id == cid);
  if (!c) return;
  const rest = deudaRestante(c);
  document.getElementById('abonoClienteInfo').innerHTML = `
    <strong>${c.cliente}</strong> · Deuda: <span class="negative">$ ${fmt(c.deuda)}</span> · Pendiente: <span class="negative">$ ${fmt(rest)}</span>`;
  document.getElementById('abonoMonto').value = '';
  document.getElementById('abonoNota').value = '';
  document.getElementById('abonoModal').classList.add('active');
}

function pagarTodo(cid) {
  const c = creditos.find(x => x.id == cid);
  if (!c) return;
  abrirAbono(cid);
  setTimeout(() => { document.getElementById('abonoMonto').value = deudaRestante(c); }, 50);
}

function confirmarAbono() {
  const cid = document.getElementById('abonoCreditoId').value;
  const monto = parseFloat(document.getElementById('abonoMonto').value);
  const cuenta = document.getElementById('abonoCuenta').value;
  const nota = document.getElementById('abonoNota').value;
  if (!monto) { notify('Ingresa el monto del abono', 'warning'); return; }

  const idx = creditos.findIndex(x => x.id == cid);
  if (idx === -1) return;
  const c = creditos[idx];
  creditos[idx].pagos.push({ monto, cuenta, fecha: fmtDateInput(new Date()), nota });

  const tx = { id: Date.now(), date: fmtDateInput(new Date()), concept: `Abono crédito - ${c.cliente}${nota ? ' ('+nota+')' : ''}`, amount: monto, type: 'ingreso', esventa: false, accKey: cuenta, accName: accounts[cuenta].name };
  accounts[cuenta].transactions.push(tx);
  saveCreditos(); saveAccounts();
  // FIX: sincronizar crédito actualizado (con el nuevo pago) y la transacción de ingreso
  sheetsSync('credito', creditos[idx]); // sin _isNew → updateRow (abono sobre crédito existente)
  sheetsSync('transaccion', tx);
  updateUI(); updateCreditosList(); loadTransactions(); updateCajaHdr();
  document.getElementById('abonoModal').classList.remove('active');
  notify(`✅ Abono de $${fmt(monto)} registrado`, 'success');
}

function eliminarCredito(cid) {
  if (!confirm('¿Eliminar este registro de crédito?')) return;
  creditos = creditos.filter(x => x.id != cid);
  saveCreditos(); updateCreditosList();
  // FIX: sincronizar eliminación con Sheets
  Sheets.deleteRow(Sheets.HOJAS.CREDITOS, cid);
  notify('Crédito eliminado', 'info');
}

function eliminarCreditoGrupo(nombreLower) {
  if (!confirm('¿Eliminar todos los registros de crédito de este cliente?')) return;
  // FIX: eliminar cada crédito del grupo en Sheets antes de filtrar
  creditos
    .filter(c => c.cliente.trim().toLowerCase() === nombreLower)
    .forEach(c => Sheets.deleteRow(Sheets.HOJAS.CREDITOS, c.id));
  creditos = creditos.filter(c => c.cliente.trim().toLowerCase() !== nombreLower);
  saveCreditos(); updateCreditosList();
  notify('Créditos eliminados', 'info');
}

// Handler para el form de nuevo crédito
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('creditoForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const cliente = document.getElementById('creditoCliente').value.trim();
      const deuda = parseFloat(document.getElementById('creditoDeuda').value);
      const desc = document.getElementById('creditoDesc').value.trim();
      const fecha = document.getElementById('creditoFecha').value;
      if (!cliente || !deuda || !desc) { notify('Completa todos los campos', 'warning'); return; }
      const nuevoCred = { id: Date.now(), cliente, deuda, desc, fecha, pagos: [], _isNew: true };
      creditos.push(nuevoCred);
      saveCreditos(); updateCreditosList(); updateClienteSuggestions();
      sheetsSync('credito', nuevoCred);
      document.getElementById('creditoModal').classList.remove('active');
      notify('Crédito registrado', 'success');
    });
  }
});
