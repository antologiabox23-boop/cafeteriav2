/* ══════════════════════════════════════════
   caja.js — Módulo de Caja / POS  v4.0
   ─────────────────────────────────────────
   Nuevas funcionalidades:
   • Método de pago "Especial" (Promoción/Bono/Cumpleaños):
     descuenta stock sin registrar ingreso de dinero.
   • Método de pago "Consumo interno" (Entrenador/Propietario):
     descuenta stock, registra con nombre del receptor, sin ingreso.
   • Las preventas al cobrar usan el precioFinal de cada ítem.
   ══════════════════════════════════════════ */

let ordenActual      = [];
let selPayMethod     = 'efectivo';  // 'efectivo'|'nequi'|'bancolombia'|'daviplata'|'especial'|'consumo'
let cobroEsPendiente = false;
let cobroPendienteId = null;

// ─────────────────────────────────────────
// GRID DE PRODUCTOS
// ─────────────────────────────────────────
function loadProdGrid() {
  const grid = document.getElementById('prodGrid');
  grid.innerHTML = '';
  getProds().forEach(p => {
    const info     = _prodStockInfo(p);
    const sinStock = info.limitado && info.stock <= 0;
    const bajo     = info.limitado && info.stock > 0 && info.bajo;

    const b = document.createElement('div');
    b.className = 'prod-btn' + (sinStock ? ' prod-sin-stock' : '');
    b.innerHTML = `
      <div class="pe">${p.emoji || '☕'}</div>
      <div class="pn">${p.nombre}</div>
      <div class="pp">$ ${fmt(p.precio)}</div>
      ${info.limitado
        ? `<div class="pstock ${sinStock ? 'pstock-vacio' : bajo ? 'pstock-bajo' : 'pstock-ok'}">
             ${sinStock ? 'Sin stock' : info.stock + ' und'}
           </div>`
        : ''}`;
    if (!sinStock) b.onclick = () => addToOrden(p);
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
  const cl = document.getElementById('ordenCliente');
  if (cl) cl.value = '';
  renderOrden();
}

// ─────────────────────────────────────────
// VENTA MANUAL RÁPIDA
// ─────────────────────────────────────────
function ventaManualRapida() {
  const desc     = document.getElementById('vmDesc').value.trim();
  const monto    = parseFloat(document.getElementById('vmMonto').value);
  const cliente  = document.getElementById('ordenCliente').value.trim();
  const cuentaKey = document.getElementById('vmCuenta')?.value || 'efectivo';
  if (!desc || !monto) { notify('Ingresa descripción y monto', 'warning'); return; }

  const concepto = cliente ? `[${cliente}] ${desc}` : desc;
  const tx = {
    id: Date.now(), date: fmtDateInput(new Date()), concept: concepto,
    amount: monto, type: 'ingreso', esventa: true, cliente: cliente || null,
    accKey: cuentaKey, accName: accounts[cuentaKey].name
  };
  accounts[cuentaKey].transactions.push(tx);
  saveAccounts();
  updateUI(); updateCajaHdr(); updateVentasList(); loadTransactions();
  document.getElementById('vmDesc').value  = '';
  document.getElementById('vmMonto').value = '';
  document.getElementById('ordenCliente').value = '';
  notify(`✅ Venta de $${fmt(monto)} registrada en ${accounts[cuentaKey].name}`, 'success');
  sheetsSync('venta', tx);
}

// ─────────────────────────────────────────
// ABRIR MODAL DE COBRO
// ─────────────────────────────────────────
function abrirCobro(esPendiente = false, pendId = null) {
  cobroEsPendiente = esPendiente;
  cobroPendienteId = pendId;

  let total = 0;
  if (esPendiente) {
    const p = pendientes.find(x => x.id === pendId);
    if (!p) return;
    // Si es preventa, usar precioFinal de cada ítem
    total = p.esPreventa
      ? (p.items || []).reduce((s, it) => s + (it.precioFinal || it.precio) * it.qty, 0)
      : p.total;
    document.getElementById('cobroTotal').textContent = `$ ${fmt(total)}`;
  } else {
    if (!ordenActual.length && !document.getElementById('vmDesc').value) {
      notify('Agrega productos o usa venta manual', 'warning'); return;
    }
    total = ordenActual.reduce((s,i) => s + i.precio * i.qty, 0);
    document.getElementById('cobroTotal').textContent = `$ ${fmt(total)}`;
  }

  document.getElementById('cobroNota').value = '';

  // Reset método de pago
  document.querySelectorAll('.pmb').forEach(b => b.classList.remove('sel'));
  const defBtn = document.querySelector('.pmb[data-cuenta="efectivo"]');
  if (defBtn) defBtn.classList.add('sel');
  selPayMethod = 'efectivo';

  // Ocultar/resetear sección especial
  _toggleEspecialSection(false);

  // Stock resumen
  _renderCobroStock();

  document.getElementById('cobroModal').classList.add('active');
}

// ─────────────────────────────────────────
// MÉTODOS DE PAGO
// ─────────────────────────────────────────
function selPay(btn) {
  document.querySelectorAll('.pmb').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  selPayMethod = btn.getAttribute('data-cuenta');
  // Mostrar sección extra para especial y consumo
  _toggleEspecialSection(selPayMethod === 'especial' || selPayMethod === 'consumo');
}

function _toggleEspecialSection(show) {
  const sec = document.getElementById('cobroEspecialSection');
  if (!sec) return;
  sec.style.display = show ? 'block' : 'none';
  if (show) {
    const isConsumo = selPayMethod === 'consumo';
    document.getElementById('cobroEspecialLabel').textContent =
      isConsumo ? 'Receptor (propietario/entrenador)' : 'Motivo (ej: Bono cumpleaños)';
    document.getElementById('cobroEspecialInput').placeholder =
      isConsumo ? 'Ej: Tatiana, Diana, Carlos...' : 'Ej: Bono cumpleaños, Promoción...';
    document.getElementById('cobroEspecialTitle').textContent =
      isConsumo ? '🏋️ Consumo interno' : '🎁 Entrega por promoción';
    document.getElementById('cobroEspecialInfo').textContent =
      isConsumo
        ? 'Descuenta del stock sin registrar ingreso. Se guarda como "Consumo interno".'
        : 'Descuenta del stock sin registrar ingreso. Se guarda como "Promoción/Bono".';
  }
}

// ─────────────────────────────────────────
// STOCK EN MODAL DE COBRO
// ─────────────────────────────────────────
function _renderCobroStock() {
  const prev = document.getElementById('cobroStockResumen');
  if (prev) prev.remove();

  // Determinar items a revisar
  let items = [];
  if (cobroEsPendiente) {
    const p = pendientes.find(x => x.id === cobroPendienteId);
    items = p ? (p.items || []) : [];
  } else {
    items = ordenActual;
  }
  if (!items.length) return;

  const itemsConStock = items.filter(it => {
    const p = getProds().find(x => x.id === it.id);
    return p && p.stock !== null && p.stock !== undefined;
  });
  if (!itemsConStock.length) return;

  let hayProblema = false;
  const rows = items.map(it => {
    const p = getProds().find(x => x.id === it.id);
    if (!p || p.stock === null || p.stock === undefined) return null;

    const disponible   = p.stock || 0;
    const insuficiente = disponible < it.qty;
    if (insuficiente) hayProblema = true;

    const color = disponible <= 0 ? 'var(--err)' : insuficiente ? 'var(--warn)' : 'var(--ok)';
    const label = disponible <= 0 ? '🚫 Sin stock'
                : insuficiente   ? `⚠️ Solo ${disponible} disponibles`
                : `✅ ${disponible} disponibles`;

    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--cream)">
      <span style="font-size:.8rem">${p.emoji||'☕'} ${p.nombre} × ${it.qty}</span>
      <span style="font-size:.78rem;font-weight:600;color:${color}">${label}</span>
    </div>`;
  }).filter(Boolean).join('');

  if (!rows) return;

  const section = document.createElement('div');
  section.id = 'cobroStockResumen';
  section.style.cssText = `background:var(--latte);border-radius:var(--rs);padding:10px 12px;margin-bottom:10px;border-left:3px solid ${hayProblema ? 'var(--warn)' : 'var(--ok)'}`;
  section.innerHTML = `
    <div style="font-size:.72rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
      <i class="fas fa-boxes"></i> Stock disponible
    </div>
    ${rows}
    ${hayProblema ? `<div style="font-size:.75rem;color:var(--warn);margin-top:6px"><i class="fas fa-exclamation-triangle"></i> Verifica el stock antes de confirmar</div>` : ''}`;

  const mbody   = document.getElementById('cobroModal')?.querySelector('.mbody');
  const totalEl = document.getElementById('cobroTotal')?.parentElement;
  if (mbody && totalEl) totalEl.insertAdjacentElement('afterend', section);
}

// ─────────────────────────────────────────
// CONFIRMAR COBRO
// ─────────────────────────────────────────
function confirmarCobro() {
  const nota        = document.getElementById('cobroNota').value.trim();
  const especialVal = document.getElementById('cobroEspecialInput')?.value.trim() || '';
  const esEspecial  = selPayMethod === 'especial';
  const esConsumo   = selPayMethod === 'consumo';
  const esSinIngreso = esEspecial || esConsumo;

  // Validar campo especial si aplica
  if (esSinIngreso && !especialVal) {
    notify(esConsumo ? 'Ingresa el nombre del receptor' : 'Ingresa el motivo', 'warning');
    return;
  }

  let total = 0, concepto = '', cliente = '';
  let itemsVendidos = [];

  if (cobroEsPendiente) {
    const p = pendientes.find(x => x.id === cobroPendienteId);
    if (!p) return;
    cliente       = p.cliente || '';
    itemsVendidos = p.items || [];

    // Preventa: usar precioFinal por ítem
    if (p.esPreventa) {
      total   = itemsVendidos.reduce((s, it) => s + (it.precioFinal || it.precio) * it.qty, 0);
      concepto = itemsVendidos.map(it => `${it.qty}x ${it.nombre} ($${fmt(it.precioFinal || it.precio)})`).join(', ');
    } else {
      total   = p.total;
      concepto = p.concepto;
    }
    pendientes = pendientes.filter(x => x.id !== cobroPendienteId);
    savePendientes(); updatePendientesList(); updatePendBadge();
  } else {
    cliente       = document.getElementById('ordenCliente').value.trim();
    itemsVendidos = [...ordenActual];
    total         = itemsVendidos.reduce((s,i) => s + i.precio * i.qty, 0);
    concepto      = itemsVendidos.length ? itemsVendidos.map(i => `${i.qty}x ${i.nombre}`).join(', ') : 'Venta manual';
    if (cliente) concepto = `[${cliente}] ${concepto}`;
    if (nota)    concepto += ` (${nota})`;
    if (!total)  { notify('Sin monto a cobrar', 'warning'); return; }
  }

  // ── Descontar stock siempre que haya ítems ──────────────────────
  if (itemsVendidos.length) {
    descontarStockPorVenta(itemsVendidos);
  }

  // ── Registrar según tipo de pago ────────────────────────────────
  if (esSinIngreso) {
    // Promoción o consumo interno: no registra ingreso, solo movimiento de stock
    // Se registra como gasto/egreso con monto 0 para trazabilidad
    const tipoLabel  = esConsumo ? `Consumo interno (${especialVal})` : `Promoción: ${especialVal}`;
    const conceptoFull = `${tipoLabel} — ${concepto}`;

    // Gasto $0 para aparecer en historial de movimientos
    const mov = {
      id:        Date.now(),
      concepto:  conceptoFull,
      monto:     0,
      categoria: esConsumo ? 'Consumo Interno' : 'Promoción',
      cuenta:    'efectivo',  // no afecta saldo
      fecha:     fmtDateInput(new Date()),
      nota:      `Sin ingreso · ${especialVal}`
    };
    // Solo guardamos en historial de movimientos como referencia
    // (no en gastos para no distorsionar el reporte)
    const refTx = {
      id:      Date.now() + 1,
      date:    fmtDateInput(new Date()),
      concept: conceptoFull,
      amount:  0,
      type:    esConsumo ? 'consumo_interno' : 'promocion',
      esventa: false,
      cliente: esConsumo ? especialVal : (cliente || null),
      accKey:  'efectivo',
      accName: 'Efectivo'
    };
    // No sumamos al balance (amount=0) pero queda en historial
    accounts['efectivo'].transactions.push(refTx);
    saveAccounts();
    updateUI(); updateCajaHdr(); updateVentasList(); loadTransactions();
    document.getElementById('cobroModal').classList.remove('active');
    limpiarOrden();
    const iconLabel = esConsumo ? '🏋️' : '🎁';
    notify(`${iconLabel} Entrega registrada sin ingreso — ${especialVal}`, 'success');
    sheetsSync('transaccion', refTx);

  } else {
    // Cobro normal
    const tx = {
      id:      Date.now(), date: fmtDateInput(new Date()), concept: concepto,
      amount:  total, type: 'ingreso', esventa: true,
      cliente: cliente || null, accKey: selPayMethod, accName: accounts[selPayMethod].name
    };
    accounts[selPayMethod].transactions.push(tx);
    saveAccounts();
    updateUI(); updateCajaHdr(); updateVentasList(); loadTransactions();
    document.getElementById('cobroModal').classList.remove('active');
    limpiarOrden();
    notify(`✅ $${fmt(total)} cobrado en ${accounts[selPayMethod].name}`, 'success');
    sheetsSync('venta', tx);
  }

  // Reset sección especial
  if (document.getElementById('cobroEspecialInput')) {
    document.getElementById('cobroEspecialInput').value = '';
  }
  _toggleEspecialSection(false);
}

// ─────────────────────────────────────────
// ENCABEZADO Y LISTA DE VENTAS
// ─────────────────────────────────────────
function updateCajaHdr() {
  const today = fmtDateInput(new Date());
  let v = 0, cnt = 0;
  for (const k in accounts) {
    accounts[k].transactions.forEach(tx => {
      if (tx.date === today && tx.amount > 0 && tx.esventa) { v += tx.amount; cnt++; }
    });
  }
  document.getElementById('ventasHoy').textContent     = `$ ${fmt(v)}`;
  document.getElementById('txHoy').textContent         = cnt;
  document.getElementById('cajaPendCount').textContent = pendientes.length;
}

function updateVentasList() {
  const list  = document.getElementById('ventasList');
  const today = fmtDateInput(new Date());

  let vs = [];
  for (const k in accounts) {
    accounts[k].transactions.forEach(tx => {
      if (tx.date === today && (tx.esventa || tx.type === 'consumo_interno' || tx.type === 'promocion'))
        vs.push({ ...tx, accKey: k });
    });
  }
  vs.sort((a,b) => b.id - a.id);

  if (!vs.length) {
    list.innerHTML = `<div class="empty"><i class="fas fa-coffee"></i><h3>Sin ventas hoy</h3></div>`;
    return;
  }

  list.innerHTML = '';
  vs.forEach(v => {
    const isPromo   = v.type === 'promocion';
    const isConsumo = v.type === 'consumo_interno';
    const badge = isPromo
      ? '<span style="font-size:.65rem;background:#d97706;color:white;padding:1px 6px;border-radius:8px;margin-left:5px">🎁 PROMO</span>'
      : isConsumo
        ? '<span style="font-size:.65rem;background:#059669;color:white;padding:1px 6px;border-radius:8px;margin-left:5px">🏋️ INTERNO</span>'
        : '';
    const d = document.createElement('div');
    d.className = 'vi';
    d.innerHTML = `
      <div style="flex:1">
        <div class="vi-concept">${v.concept}${badge}</div>
        <div class="vi-meta">${(isPromo||isConsumo) ? 'Sin ingreso' : accounts[v.accKey]?.name || v.accKey}</div>
      </div>
      <div class="vi-amount ${(isPromo||isConsumo) ? '' : 'positive'}">
        ${(isPromo||isConsumo) ? '<span style="color:#aaa;font-size:.8rem">— stock</span>' : `$ ${fmt(v.amount)}`}
      </div>
      <div class="vi-actions">
        <button class="btn btn-sm btn-d" onclick="eliminarTx('${v.accKey}',${v.id})"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(d);
  });
}

// ─────────────────────────────────────────
// CIERRE DE CAJA (sin cambios de lógica)
// ─────────────────────────────────────────
function cerrarCaja() {
  const today = fmtDateInput(new Date());
  let tv = 0, cv = 0;
  const pc = {};
  for (const k in accounts) {
    accounts[k].transactions.forEach(tx => {
      if (tx.date === today && tx.esventa && tx.type !== 'transferencia' && tx.amount > 0) {
        tv += tx.amount; cv++;
        pc[accounts[k].name] = (pc[accounts[k].name] || 0) + tx.amount;
      }
    });
  }
  const todayGastos = gastos.filter(g => g.fecha === today).reduce((s,g) => s + g.monto, 0);
  const netoDia     = tv - todayGastos;
  const pendCount   = pendientes.length;
  const pendTotal   = pendientes.reduce((s,p) => s + p.total, 0);
  const totCred     = creditos.reduce((s,c) => s + deudaRestante(c), 0);
  const desglose    = Object.entries(pc).map(([n,v]) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--cream)">
       <span>${n}</span><strong>$ ${fmt(v)}</strong>
     </div>`).join('');

  // Contar entregas sin ingreso del día
  let entregasSinIngreso = 0;
  for (const k in accounts) {
    accounts[k].transactions.forEach(tx => {
      if (tx.date === today && (tx.type === 'consumo_interno' || tx.type === 'promocion'))
        entregasSinIngreso++;
    });
  }

  document.getElementById('cierreCajaContent').innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:.75rem;color:#888">${new Date().toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      <div style="font-family:'Playfair Display',serif;font-size:2.2rem;font-weight:700;color:var(--cw);margin:8px 0">$ ${fmt(tv)}</div>
      <div style="font-size:.85rem;color:#888">${cv} venta${cv!==1?'s':''} · Neto <strong class="${netoDia>=0?'positive':'negative'}">$ ${fmt(netoDia)}</strong></div>
    </div>
    <div style="background:var(--latte);border-radius:var(--r);padding:13px;margin-bottom:12px">
      <div style="font-size:.78rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Por cuenta</div>
      ${desglose || '<p style="color:#bbb;text-align:center;font-size:.82rem">Sin ventas hoy</p>'}
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-top:2px solid var(--cream);margin-top:4px">
        <span>Gastos del día</span><span class="negative">- $ ${fmt(todayGastos)}</span>
      </div>
    </div>
    ${entregasSinIngreso > 0 ? `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r);padding:10px 13px;margin-bottom:12px">
      <div style="font-size:.82rem;color:#166534"><i class="fas fa-gift"></i> ${entregasSinIngreso} entrega${entregasSinIngreso!==1?'s':''} sin ingreso (promos/internos)</div>
    </div>` : ''}
    ${pendCount > 0 ? `
    <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:var(--r);padding:13px;margin-bottom:12px">
      <div style="font-size:.82rem;font-weight:600;color:#b8860b;margin-bottom:4px">
        <i class="fas fa-clock"></i> ${pendCount} pendiente${pendCount!==1?'s':''} sin cobrar — $ ${fmt(pendTotal)}
      </div>
      <div style="font-size:.78rem;color:#888">Al confirmar el cierre pasarán automáticamente a <strong>Créditos</strong>.</div>
    </div>` : ''}
    ${totCred > 0 ? `
    <div style="background:var(--latte);border-radius:var(--r);padding:10px 13px;margin-bottom:12px;display:flex;justify-content:space-between">
      <span style="font-size:.82rem">Total créditos activos</span>
      <span class="negative" style="font-size:.82rem">$ ${fmt(totCred)}</span>
    </div>` : ''}
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-s btn-full" onclick="document.getElementById('cierreCajaModal').classList.remove('active')">Cancelar</button>
      <button class="btn btn-p btn-full" onclick="_cierrePaso2(${tv},${todayGastos},${netoDia})">
        <i class="fas fa-arrow-right"></i> Continuar
      </button>
    </div>`;

  document.getElementById('cierreCajaModal').classList.add('active');
}

function _cierrePaso2(tv, todayGastos, netoDia) {
  const efectivoActual = accounts['efectivo']?.transactions.reduce((s,t) => s + t.amount, 0) || 0;
  document.getElementById('cierreCajaContent').innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:2rem;margin-bottom:6px">💵</div>
      <div style="font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;color:var(--cw)">Base para mañana</div>
      <div style="font-size:.82rem;color:#888;margin-top:4px">¿Cuánto dinero en efectivo dejas en caja para el día siguiente?</div>
    </div>
    <div style="background:var(--latte);border-radius:var(--r);padding:12px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:4px">
        <span>Efectivo en caja ahora</span>
        <strong class="${efectivoActual>=0?'positive':'negative'}">$ ${fmt(efectivoActual)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.82rem">
        <span>Neto del día</span>
        <strong class="${netoDia>=0?'positive':'negative'}">$ ${fmt(netoDia)}</strong>
      </div>
    </div>
    <div class="fg" style="margin-bottom:16px">
      <label>Base de caja (Efectivo)</label>
      <input type="number" id="baseCajaInput" placeholder="0" min="0"
             style="font-size:1.1rem;font-weight:600;text-align:center" value="">
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-s btn-full" onclick="cerrarCaja()"><i class="fas fa-arrow-left"></i> Volver</button>
      <button class="btn btn-ok btn-full" onclick="_confirmarCierre()"><i class="fas fa-check"></i> Confirmar Cierre</button>
    </div>`;
  setTimeout(() => document.getElementById('baseCajaInput')?.focus(), 100);
}

function _confirmarCierre() {
  const today     = fmtDateInput(new Date());
  const baseInput = document.getElementById('baseCajaInput');
  const base      = parseFloat(baseInput?.value) || 0;

  let movidos = 0;
  pendientes.forEach(p => {
    creditos.push({
      id: Date.now() + movidos, cliente: p.cliente, deuda: p.total,
      desc: `[Cierre ${today}] ${p.concepto}`, fecha: p.fecha, pagos: []
    });
    sheetsSync('credito', creditos[creditos.length - 1]);
    movidos++;
  });
  const pendMovidos = pendientes.length;
  pendientes = [];
  savePendientes(); saveCreditos();

  if (base > 0) {
    const efectivoActual = accounts['efectivo'].transactions.reduce((s,t) => s + t.amount, 0);
    const ajuste = base - efectivoActual;
    const txBase = {
      id: Date.now() + 999, date: today,
      concept: `Base caja día siguiente — $ ${fmt(base)}`,
      amount: ajuste, type: 'base_caja', esventa: false,
      accKey: 'efectivo', accName: 'Efectivo'
    };
    accounts['efectivo'].transactions.push(txBase);
    sheetsSync('transaccion', txBase);
  }
  saveAccounts();
  updateUI(); updatePendientesList(); updatePendBadge();
  updateCreditosList(); loadTransactions(); updateCajaHdr();

  document.getElementById('cierreCajaContent').innerHTML = `
    <div style="text-align:center;padding:10px 0 20px">
      <div style="font-size:3rem;margin-bottom:10px">✅</div>
      <div style="font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;color:var(--cw);margin-bottom:6px">Cierre completado</div>
      <div style="font-size:.85rem;color:#888">${new Date().toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    </div>
    <div style="background:var(--latte);border-radius:var(--r);padding:13px;margin-bottom:12px">
      ${pendMovidos > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--cream)">
        <span style="font-size:.82rem"><i class="fas fa-user-clock" style="color:var(--warn)"></i> Pendientes → Créditos</span>
        <strong style="font-size:.82rem">${pendMovidos} movido${pendMovidos!==1?'s':''}</strong>
      </div>` : ''}
      ${base > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0">
        <span style="font-size:.82rem"><i class="fas fa-money-bill-wave" style="color:var(--ok)"></i> Base efectivo mañana</span>
        <strong style="font-size:.82rem" class="positive">$ ${fmt(base)}</strong>
      </div>` : ''}
    </div>
    <button class="btn btn-p btn-full" onclick="document.getElementById('cierreCajaModal').classList.remove('active')">
      <i class="fas fa-check"></i> Listo
    </button>`;
}
