/* ══════════════════════════════════════════
   caja.js — Módulo de Caja / POS
   ══════════════════════════════════════════ */

let ordenActual = [];
let selPayMethod = 'efectivo';
let cobroEsPendiente = false;
let cobroPendienteId = null;
let _pendingOrdenSnapshot = null;

function loadProdGrid() {
  const grid = document.getElementById('prodGrid');
  grid.innerHTML = '';
  getProds().forEach(p => {
    const b = document.createElement('div');
    b.className = 'prod-btn';
    b.innerHTML = `<div class="pe">${p.emoji || '☕'}</div><div class="pn">${p.nombre}</div><div class="pp">$ ${fmt(p.precio)}</div>`;
    b.onclick = () => addToOrden(p);
    grid.appendChild(b);
  });
}

function addToOrden(p) {
  const ex = ordenActual.find(i => i.id === p.id);
  if (ex) ex.qty++;
  else ordenActual.push({ ...p, qty: 1 });
  renderOrden();
}

function renderOrden() {
  const c = document.getElementById('ordenItems');
  const t = document.getElementById('ordenTotal');
  if (!ordenActual.length) {
    c.innerHTML = `<div class="empty" style="padding:18px"><i class="fas fa-coffee" style="font-size:1.6rem;color:var(--cw)"></i><p style="color:#bbb;margin-top:6px;font-size:.82rem">Selecciona productos</p></div>`;
    t.textContent = '$ 0';
    return;
  }
  let total = 0;
  c.innerHTML = '';
  ordenActual.forEach((it, i) => {
    total += it.precio * it.qty;
    const d = document.createElement('div');
    d.className = 'oi';
    d.innerHTML = `
      <div style="flex:1">
        <div class="oi-name">${it.emoji} ${it.nombre}</div>
        <div class="oi-price">$${fmt(it.precio)} c/u</div>
      </div>
      <div class="qty-ctrl">
        <button class="qbtn qm" onclick="chgQty(${i},-1)">−</button>
        <span class="qn">${it.qty}</span>
        <button class="qbtn qp" onclick="chgQty(${i},1)">+</button>
        <span style="min-width:74px;text-align:right;font-weight:600;font-size:.82rem">$ ${fmt(it.precio * it.qty)}</span>
      </div>`;
    c.appendChild(d);
  });
  t.textContent = `$ ${fmt(total)}`;
}

function chgQty(i, d) {
  ordenActual[i].qty += d;
  if (ordenActual[i].qty <= 0) ordenActual.splice(i, 1);
  renderOrden();
}

function limpiarOrden() {
  ordenActual = [];
  document.getElementById('ordenCliente').value = '';
  renderOrden();
}

function ventaManualRapida() {
  const desc = document.getElementById('vmDesc').value.trim();
  const monto = parseFloat(document.getElementById('vmMonto').value);
  const cliente = document.getElementById('ordenCliente').value.trim();
  if (!desc || !monto) { notify('Ingresa descripción y monto', 'warning'); return; }

  const concepto = cliente ? `[${cliente}] ${desc}` : desc;
  const tx = { id: Date.now(), date: fmtDateInput(new Date()), concept: concepto, amount: monto, type: 'ingreso', esventa: true, cliente: cliente || null };
  accounts['efectivo'].transactions.push(tx);
  saveAccounts();
  updateUI();
  updateCajaHdr();
  updateVentasList();
  loadTransactions();
  document.getElementById('vmDesc').value = '';
  document.getElementById('vmMonto').value = '';
  document.getElementById('ordenCliente').value = '';
  notify(`✅ Venta de $${fmt(monto)} registrada`, 'success');
  sheetsSync('venta', tx);
}

function abrirCobro(esPendiente = false, pendId = null) {
  cobroEsPendiente = esPendiente;
  cobroPendienteId = pendId;
  let total = 0;
  if (esPendiente) {
    const p = pendientes.find(x => x.id === pendId);
    if (!p) return;
    total = p.total;
    document.getElementById('cobroTotal').textContent = `$ ${fmt(total)}`;
  } else {
    if (!ordenActual.length && !document.getElementById('vmDesc').value) {
      notify('Agrega productos o usa venta manual', 'warning'); return;
    }
    total = ordenActual.reduce((s,i) => s + i.precio * i.qty, 0);
    document.getElementById('cobroTotal').textContent = `$ ${fmt(total)}`;
  }
  document.getElementById('cobroNota').value = '';
  document.querySelectorAll('.pmb').forEach(b => b.classList.remove('sel'));
  document.querySelector('.pmb[data-cuenta="efectivo"]').classList.add('sel');
  selPayMethod = 'efectivo';
  document.getElementById('cobroModal').classList.add('active');
}

function selPay(btn) {
  document.querySelectorAll('.pmb').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  selPayMethod = btn.getAttribute('data-cuenta');
}

function confirmarCobro() {
  const nota = document.getElementById('cobroNota').value;
  let total = 0, concepto = '', cliente = '';

  if (cobroEsPendiente) {
    const p = pendientes.find(x => x.id === cobroPendienteId);
    if (!p) return;
    total = p.total; concepto = p.concepto; cliente = p.cliente || '';
    pendientes = pendientes.filter(x => x.id !== cobroPendienteId);
    savePendientes(); updatePendientesList(); updatePendBadge();
  } else {
    cliente = document.getElementById('ordenCliente').value.trim();
    concepto = ordenActual.length ? ordenActual.map(i => `${i.qty}x ${i.nombre}`).join(', ') : 'Venta manual';
    if (cliente) concepto = `[${cliente}] ${concepto}`;
    if (nota) concepto += ` (${nota})`;
    total = ordenActual.reduce((s,i) => s + i.precio * i.qty, 0);
    if (!total) { notify('Sin monto a cobrar', 'warning'); return; }
  }

  const tx = { id: Date.now(), date: fmtDateInput(new Date()), concept: concepto, amount: total, type: 'ingreso', esventa: true, cliente: cliente || null };
  accounts[selPayMethod].transactions.push(tx);
  saveAccounts();
  updateUI();
  updateCajaHdr();
  updateVentasList();
  loadTransactions();
  document.getElementById('cobroModal').classList.remove('active');
  limpiarOrden();
  notify(`✅ $${fmt(total)} cobrado en ${accounts[selPayMethod].name}`, 'success');
  sheetsSync('venta', tx);
}

function updateCajaHdr() {
  const today = fmtDateInput(new Date());
  let v = 0, cnt = 0;
  for (const k in accounts) {
    accounts[k].transactions.forEach(tx => {
      if (tx.date === today && tx.amount > 0 && tx.esventa) { v += tx.amount; cnt++; }
    });
  }
  document.getElementById('ventasHoy').textContent = `$ ${fmt(v)}`;
  document.getElementById('txHoy').textContent = cnt;
  document.getElementById('cajaPendCount').textContent = pendientes.length;
}

function updateVentasList() {
  const list = document.getElementById('ventasList');
  const today = fmtDateInput(new Date());
  let vs = [];
  for (const k in accounts) {
    accounts[k].transactions.forEach(tx => { if (tx.date === today && tx.esventa) vs.push({ ...tx, accKey: k }); });
  }
  vs.sort((a,b) => b.id - a.id);
  if (!vs.length) { list.innerHTML = `<div class="empty"><i class="fas fa-coffee"></i><h3>Sin ventas hoy</h3></div>`; return; }
  list.innerHTML = '';
  vs.forEach(v => {
    const d = document.createElement('div');
    d.className = 'vi';
    d.innerHTML = `
      <div style="flex:1">
        <div class="vi-concept">${v.concept}</div>
        <div class="vi-meta">${accounts[v.accKey].name}</div>
      </div>
      <div class="vi-amount positive">$ ${fmt(v.amount)}</div>
      <div class="vi-actions"><button class="btn btn-sm btn-d" onclick="eliminarTx('${v.accKey}',${v.id})"><i class="fas fa-trash"></i></button></div>`;
    list.appendChild(d);
  });
}

function cerrarCaja() {
  const today = fmtDateInput(new Date());
  let tv = 0, cv = 0;
  const pc = {};
  for (const k in accounts) {
    accounts[k].transactions.forEach(tx => {
      if (tx.date === today && tx.esventa) { tv += tx.amount; cv++; pc[accounts[k].name] = (pc[accounts[k].name] || 0) + tx.amount; }
    });
  }
  const credPend = pendientes.length;
  const totCred = creditos.reduce((s,c) => s + deudaRestante(c), 0);
  const todayGastos = gastos.filter(g => g.fecha === today).reduce((s,g) => s + g.monto, 0);
  const desglose = Object.entries(pc).map(([k,v]) =>
    `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--cream)"><span>${k}</span><strong>$ ${fmt(v)}</strong></div>`
  ).join('');

  document.getElementById('cierreCajaContent').innerHTML = `
    <div style="text-align:center;margin-bottom:18px">
      <div style="font-size:.75rem;color:#888">${new Date().toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      <div style="font-family:'Playfair Display',serif;font-size:2.2rem;font-weight:700;color:var(--cw);margin:8px 0">$ ${fmt(tv)}</div>
      <div style="font-size:.85rem;color:#888">${cv} ventas realizadas</div>
    </div>
    <div class="stitle" style="font-size:.86rem"><i class="fas fa-wallet"></i> Por método de pago</div>
    <div style="background:var(--latte);border-radius:var(--r);padding:13px;margin-bottom:14px">
      ${desglose || '<p style="color:#bbb;text-align:center;padding:8px">Sin ventas hoy</p>'}
    </div>
    <div style="background:var(--latte);border-radius:var(--r);padding:13px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--cream)"><span>Gastos del día</span><span class="negative">- $ ${fmt(todayGastos)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--cream)"><span>Neto del día</span><strong><span class="${(tv-todayGastos)>=0?'positive':'negative'}">${tv-todayGastos>=0?'+':''}$ ${fmt(tv-todayGastos)}</span></strong></div>
      ${credPend > 0 ? `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--cream)"><span>Ventas pendientes</span><span class="negative">${credPend} pend.</span></div>` : ''}
      ${totCred > 0 ? `<div style="display:flex;justify-content:space-between;padding:7px 0"><span>Total créditos</span><span class="negative">$ ${fmt(totCred)}</span></div>` : ''}
    </div>
    <button class="btn btn-p btn-full" onclick="document.getElementById('cierreCajaModal').classList.remove('active')"><i class="fas fa-check"></i> Listo</button>`;
  document.getElementById('cierreCajaModal').classList.add('active');
}
