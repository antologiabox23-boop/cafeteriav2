/* ══════════════════════════════════════════
   inventario.js — Inventario, Facturas y Movimientos  v3.0
   ─────────────────────────────────────────
   Cambios v3.0:
   • Tab "Stock" → muestra los PRODUCTOS RÁPIDOS con su stock actual.
     No hay insumos separados.
   • Tab "Productos" → vista del catálogo de venta (igual que antes).
   • Tab "Facturas" → al agregar un item, se selecciona de los
     productos del catálogo. Si el item coincide con un producto
     rápido, suma stock. Si el nombre no existe en el catálogo,
     se registra en la factura pero NO afecta el stock.
   • Tab "Movimientos" → historial de stockMovs (entradas/salidas).
   • Se eliminó el modal de "Insumo" y su form.
   ══════════════════════════════════════════ */

let editingFacturaId = null;
let facturaItemsTemp = [];
let invTabActual     = 'stock';

// ─────────────────────────────────────────
// SWITCH TAB INVENTARIO
// ─────────────────────────────────────────
function switchInvTab(tab, btn) {
  invTabActual = tab;
  ['invStock','invProductos','invFacturas','invMovimientos'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const map = { stock:'invStock', productos:'invProductos', facturas:'invFacturas', movimientos:'invMovimientos' };
  const target = document.getElementById(map[tab]);
  if (target) target.style.display = 'block';
  document.querySelectorAll('#inventario .fbtn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderInventario();
}

// ─────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────
function renderInventario() {
  updateInvStats();
  renderAlertas();
  if      (invTabActual === 'stock')       renderStock();
  else if (invTabActual === 'productos')   renderProductosInv();
  else if (invTabActual === 'facturas')    renderFacturas();
  else if (invTabActual === 'movimientos') renderMovimientos();
}

function updateInvStats() {
  const prods    = getProds().filter(p => p.stock !== null && p.stock !== undefined);
  const sinStock = prods.filter(p => (p.stock || 0) <= 0).length;
  const stockBajo = prods.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 3).length;

  const elProd  = document.getElementById('invTotalInsumos');
  const elBajo  = document.getElementById('invStockBajo');
  const elFact  = document.getElementById('invTotalFacturas');
  const elLabel = elProd?.previousElementSibling; // label del stat card

  if (elProd)  elProd.textContent  = prods.length;
  if (elBajo)  elBajo.textContent  = sinStock + stockBajo;
  if (elFact)  elFact.textContent  = facturas.length;
  // Actualizar la etiqueta del primer stat card
  const lblEl = document.querySelector('#inventario .slbl');
  if (lblEl && lblEl.textContent === 'Insumos') lblEl.textContent = 'Productos con stock';
}

function renderAlertas() {
  const cont = document.getElementById('invAlertas');
  cont.innerHTML = '';
  getProds()
    .filter(p => p.stock !== null && p.stock !== undefined && (p.stock || 0) <= 3)
    .forEach(p => {
      const d = document.createElement('div');
      d.className = 'alerta-stock';
      const msg = (p.stock || 0) <= 0 ? 'Sin stock' : `Solo ${p.stock} und`;
      d.innerHTML = `
        <div class="alerta-stock-text">
          <i class="fas fa-exclamation-triangle"></i>
          ${(p.stock||0) <= 0 ? '🚫' : '⚠️'} <strong>${p.emoji||'☕'} ${p.nombre}</strong> — ${msg}
        </div>
        <button class="btn btn-warn btn-sm" onclick="abrirFacturaModal()">
          <i class="fas fa-shopping-cart"></i> Comprar
        </button>`;
      cont.appendChild(d);
    });
}

// ─────────────────────────────────────────
// TAB STOCK
// ─────────────────────────────────────────
function renderStock() {
  const cont  = document.getElementById('invStock');
  const prods = getProds();

  const conStock = prods.filter(p => p.stock !== null && p.stock !== undefined);
  const sinCtrl  = prods.filter(p => p.stock === null || p.stock === undefined);

  if (!prods.length) {
    cont.innerHTML = `<div class="empty"><i class="fas fa-boxes"></i><h3>Sin productos en catálogo</h3><p>Agrega productos en la pestaña Productos</p></div>`;
    return;
  }

  cont.innerHTML = '';

  // ── Productos con control de stock ──
  if (conStock.length) {
    const sec = document.createElement('div');
    sec.innerHTML = `<div class="stitle" style="font-size:.85rem"><i class="fas fa-boxes"></i> Stock controlado</div>`;
    conStock.forEach(p => {
      const s     = p.stock || 0;
      const bajo  = s > 0 && s <= 3;
      const vacio = s <= 0;
      const card  = document.createElement('div');
      card.className = `insumo-card ${vacio ? 'stock-bajo' : bajo ? 'stock-bajo' : 'stock-ok'}`;
      card.innerHTML = `
        <div class="ins-info">
          <div class="ins-name">${p.emoji||'☕'} ${p.nombre}</div>
          <div class="ins-meta">$ ${fmt(p.precio)} · precio de venta</div>
        </div>
        <div class="ins-stock">
          <div class="ins-qty ${vacio||bajo ? 'bajo' : ''}">${s} <span style="font-size:.7rem;font-weight:400">und</span></div>
          ${vacio ? '<div style="font-size:.65rem;color:var(--err);font-weight:600">SIN STOCK</div>'
                  : bajo ? '<div style="font-size:.65rem;color:var(--warn);font-weight:600">STOCK BAJO</div>' : ''}
        </div>
        <div class="ins-actions">
          <button class="btn btn-sm btn-s" onclick="editarProd(${p.id})"><i class="fas fa-edit"></i></button>
        </div>`;
      sec.appendChild(card);
    });
    cont.appendChild(sec);
  }

  // ── Productos sin control de stock ──
  if (sinCtrl.length) {
    const sec2 = document.createElement('div');
    sec2.style.marginTop = '16px';
    sec2.innerHTML = `<div class="stitle" style="font-size:.85rem;color:#aaa"><i class="fas fa-tag"></i> Sin control de stock</div>`;
    sinCtrl.forEach(p => {
      const card = document.createElement('div');
      card.className = 'insumo-card stock-ok';
      card.style.opacity = '.7';
      card.innerHTML = `
        <div class="ins-info">
          <div class="ins-name">${p.emoji||'☕'} ${p.nombre}</div>
          <div class="ins-meta">$ ${fmt(p.precio)}</div>
        </div>
        <div class="ins-stock">
          <div style="font-size:.72rem;color:#aaa">—</div>
        </div>
        <div class="ins-actions">
          <button class="btn btn-sm btn-s" onclick="editarProd(${p.id})"><i class="fas fa-edit"></i></button>
        </div>`;
      sec2.appendChild(card);
    });
    cont.appendChild(sec2);
  }
}

// ─────────────────────────────────────────
// TAB PRODUCTOS (catálogo)
// ─────────────────────────────────────────
function renderProductosInv() {
  const cont  = document.getElementById('invProductos');
  const prods = getProds();

  let html = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-p btn-sm" onclick="abrirProdModalDesdeInv()"><i class="fas fa-plus"></i> Nuevo Producto</button>
    </div>`;

  if (!prods.length) {
    cont.innerHTML = html + `<div class="empty"><i class="fas fa-coffee"></i><h3>Sin productos en catálogo</h3></div>`;
    return;
  }

  html += prods.map(p => {
    const info = _prodStockInfo(p);
    const stockBadge = info.limitado
      ? (info.stock <= 0
          ? `<span style="color:var(--err);font-size:.72rem">⚠️ Sin stock</span>`
          : `<span style="color:${info.bajo?'var(--warn)':'var(--ok)'};font-size:.72rem">📦 ${info.stock} und</span>`)
      : '';
    return `
    <div class="insumo-card stock-ok" style="align-items:center">
      <div class="ins-info">
        <div class="ins-name">${p.emoji||'☕'} ${p.nombre}</div>
        <div class="ins-meta">$ ${fmt(p.precio)} ${stockBadge}</div>
      </div>
      <div class="ins-actions">
        <button class="btn btn-sm btn-s" onclick="editarProdDesdeInv(${p.id})"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-d" onclick="eliminarProd(${p.id})"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');

  cont.innerHTML = html;
}

function abrirProdModalDesdeInv(p = null) {
  if (typeof abrirProdModal === 'function') {
    abrirProdModal(p);
    const modal = document.getElementById('prodModal');
    const observer = new MutationObserver(() => {
      if (!modal.classList.contains('active')) { renderInventario(); observer.disconnect(); }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
}

function editarProdDesdeInv(id) {
  const p = getProds().find(x => x.id === id);
  if (p) abrirProdModalDesdeInv(p);
}

// ─────────────────────────────────────────
// TAB FACTURAS
// ─────────────────────────────────────────
function renderFacturas() {
  const cont = document.getElementById('invFacturas');
  if (!facturas.length) {
    cont.innerHTML = `<div class="empty"><i class="fas fa-file-invoice-dollar"></i><h3>Sin facturas registradas</h3></div>`;
    return;
  }
  cont.innerHTML = '';
  [...facturas].sort((a,b) => new Date(b.fecha)-new Date(a.fecha)).forEach(f => {
    const card = document.createElement('div');
    card.className = 'factura-card';
    const itemsHtml = f.items.map(it => {
      const afecta = it.afectaStock !== false && it.prodId;
      return `<div style="font-size:.78rem;color:#888;margin-bottom:2px">
        ${it.emoji||'📦'} ${it.nombre} · ${it.cantidad} und · $${fmt(it.precioUnitario)}/u = <strong>$${fmt(it.subtotal)}</strong>
        <span style="margin-left:4px;font-size:.7rem" title="${afecta?'Suma al stock del producto':'No afecta stock'}">${afecta?'📦':'🏷️'}</span>
      </div>`;
    }).join('');
    card.innerHTML = `
      <div class="fac-hdr">
        <div>
          <div class="fac-num"><i class="fas fa-file-invoice-dollar" style="color:#0284c7;margin-right:5px"></i>${f.numero||'Sin número'} · ${f.proveedor}</div>
          <div class="fac-det">${fmtDate(f.fecha)} · ${accounts[f.cuenta]?.name||f.cuenta}${f.nota?' · '+f.nota:''}</div>
        </div>
        <div class="fac-total">$ ${fmt(f.total)}</div>
      </div>
      <div class="fac-items">${itemsHtml}</div>
      <div class="fac-actions">
        <button class="btn btn-sm btn-d" onclick="eliminarFactura(${f.id})"><i class="fas fa-trash"></i> Eliminar</button>
      </div>`;
    cont.appendChild(card);
  });
}

// ─────────────────────────────────────────
// TAB MOVIMIENTOS
// ─────────────────────────────────────────
function renderMovimientos() {
  const cont = document.getElementById('invMovimientos');
  if (!stockMovs.length) {
    cont.innerHTML = `<div class="empty"><i class="fas fa-history"></i><h3>Sin movimientos</h3></div>`;
    return;
  }
  cont.innerHTML = '';
  [...stockMovs].sort((a,b) => b.id - a.id).slice(0, 120).forEach(m => {
    const d = document.createElement('div');
    d.className = 'mov-item';
    const esEntrada = m.tipo === 'entrada';
    d.innerHTML = `
      <div class="mov-info">
        <div class="mov-concept">${m.emoji||'☕'} ${m.prodNombre}</div>
        <div class="mov-meta">${fmtDate(m.fecha)} · ${m.motivo}</div>
      </div>
      <div class="mov-qty ${esEntrada?'mov-entrada':'mov-salida'}">${esEntrada?'+':'-'}${m.cantidad} und</div>`;
    cont.appendChild(d);
  });
}

// ─────────────────────────────────────────
// MODAL FACTURA
// ─────────────────────────────────────────
function abrirFacturaModal(fac = null) {
  editingFacturaId = fac ? fac.id : null;
  facturaItemsTemp = fac ? JSON.parse(JSON.stringify(fac.items)) : [];
  document.getElementById('facturaModalTitle').innerHTML =
    `<i class="fas fa-file-invoice-dollar"></i> ${fac ? 'Editar Factura' : 'Nueva Factura'}`;
  document.getElementById('facturaId').value        = fac ? fac.id : '';
  document.getElementById('facturaProveedor').value = fac ? fac.proveedor : '';
  document.getElementById('facturaNumero').value    = fac ? (fac.numero||'') : '';
  document.getElementById('facturaFecha').value     = fac ? fac.fecha : fmtDateInput(new Date());
  document.getElementById('facturaCuenta').value    = fac ? fac.cuenta : 'efectivo';
  document.getElementById('facturaNote').value      = fac ? (fac.nota||'') : '';
  document.getElementById('deleteFacturaBtn').style.display = fac ? 'inline-flex' : 'none';
  renderFacturaItems();
  document.getElementById('facturaModal').classList.add('active');
}

// ── Agregar item a la factura ──
// tipo: 'producto' = se intenta vincular al catálogo, 'otro' = sólo gasto
function addFacturaItem(tipo = 'producto') {
  const esProd = tipo === 'producto';
  const prods  = getProds();
  const defProd = esProd && prods.length ? prods[0] : null;
  facturaItemsTemp.push({
    prodId:       defProd ? defProd.id   : null,
    nombre:       defProd ? defProd.nombre : '',
    emoji:        defProd ? (defProd.emoji||'☕') : '🏷️',
    cantidad:     1,
    precioUnitario: 0,
    subtotal:     0,
    afectaStock:  esProd && !!defProd   // solo afecta si está vinculado al catálogo
  });
  renderFacturaItems();
}

function renderFacturaItems() {
  const cont = document.getElementById('facturaItems');
  if (!facturaItemsTemp.length) {
    cont.innerHTML = `<div style="text-align:center;color:#bbb;font-size:.82rem;padding:14px 0">
      Usa <strong>+ Producto catálogo</strong> para items que suman al stock,
      o <strong>+ Otro gasto</strong> para compras que solo se registran como egreso.
    </div>`;
    calcFacturaTotal();
    return;
  }

  const prodOpts = getProds().map(p =>
    `<option value="${p.id}" data-nombre="${p.nombre}" data-emoji="${p.emoji||'☕'}">${p.emoji||'☕'} ${p.nombre} — Stock actual: ${p.stock ?? '—'}</option>`
  ).join('');

  cont.innerHTML = '';
  facturaItemsTemp.forEach((item, idx) => {
    const esProd = item.afectaStock !== false && item.prodId;
    const row    = document.createElement('div');
    row.style.cssText = `background:var(--latte);border-radius:var(--rs);padding:10px;margin-bottom:8px;border-left:3px solid ${esProd ? 'var(--ok)' : '#ccc'}`;

    // Header del item
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:.72rem;font-weight:700;color:${esProd?'var(--ok)':'#999'};text-transform:uppercase;letter-spacing:.5px">
          ${esProd ? '📦 Suma al stock' : '🏷️ Solo gasto'}
        </span>
        <button type="button" class="btn btn-d btn-sm" style="padding:3px 8px" onclick="removeFacturaItem(${idx})">
          <i class="fas fa-times"></i>
        </button>
      </div>`;

    if (item.prodId !== undefined && getProds().length) {
      // Selector de producto del catálogo
      const selDiv = document.createElement('div');
      selDiv.className = 'fg';
      selDiv.style.margin = '0 0 8px';

      if (item.afectaStock !== false) {
        // Item de catálogo: mostrar selector
        selDiv.innerHTML = `<label style="font-size:.72rem">Producto del catálogo</label>
          <select onchange="onFacturaItemProdChange(${idx},this)">
            ${prodOpts}
          </select>`;
        row.appendChild(selDiv);
        const sel = selDiv.querySelector('select');
        if (item.prodId) sel.value = item.prodId;
      } else {
        // Item de otro gasto: nombre libre
        const ni = document.createElement('div');
        ni.className = 'fg';
        ni.style.margin = '0 0 8px';
        ni.innerHTML = `<label style="font-size:.72rem">Descripción</label>
          <input type="text" placeholder="Ej: Vasos, servilletas..." value="${item.nombre||''}"
            oninput="facturaItemsTemp[${idx}].nombre=this.value">`;
        row.appendChild(ni);
      }
    }

    // Cantidad y precio
    const numRow = document.createElement('div');
    numRow.className = 'frow';
    numRow.style.margin = '0';
    numRow.innerHTML = `
      <div class="fg" style="margin:0">
        <label style="font-size:.72rem">Cantidad</label>
        <input type="number" placeholder="0" min="0" step="1" value="${item.cantidad}"
          oninput="updateFacturaItem(${idx},'cantidad',this.value)">
      </div>
      <div class="fg" style="margin:0">
        <label style="font-size:.72rem">Precio Unit. $</label>
        <input type="number" placeholder="0" min="0" value="${item.precioUnitario||''}"
          oninput="updateFacturaItem(${idx},'precioUnitario',this.value)">
      </div>`;
    row.appendChild(numRow);

    // Subtotal
    const sub = document.createElement('div');
    sub.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:8px';
    const subtotal = (item.cantidad||0) * (item.precioUnitario||0);
    sub.innerHTML = `<span style="font-size:.78rem;color:#888">Subtotal: <strong>$ ${fmt(subtotal)}</strong></span>`;
    row.appendChild(sub);

    cont.appendChild(row);
  });

  calcFacturaTotal();
}

function onFacturaItemProdChange(idx, sel) {
  const val = parseInt(sel.value);
  const prods = getProds();
  const prod  = prods.find(p => p.id === val);
  if (prod) {
    facturaItemsTemp[idx].prodId  = prod.id;
    facturaItemsTemp[idx].nombre  = prod.nombre;
    facturaItemsTemp[idx].emoji   = prod.emoji || '☕';
    facturaItemsTemp[idx].afectaStock = true;
  }
  renderFacturaItems();
}

function updateFacturaItem(idx, field, val) {
  facturaItemsTemp[idx][field] = parseFloat(val) || 0;
  facturaItemsTemp[idx].subtotal = facturaItemsTemp[idx].cantidad * facturaItemsTemp[idx].precioUnitario;
  calcFacturaTotal();
  // Actualizar subtotal visible sin re-render completo
  const rows = document.getElementById('facturaItems').children;
  if (rows[idx]) {
    const subEl = rows[idx].querySelector('strong');
    if (subEl) subEl.textContent = `$ ${fmt(facturaItemsTemp[idx].subtotal)}`;
  }
}

function removeFacturaItem(idx) {
  facturaItemsTemp.splice(idx, 1);
  renderFacturaItems();
}

function calcFacturaTotal() {
  const total = facturaItemsTemp.reduce((s,i) => s + ((i.cantidad||0)*(i.precioUnitario||0)), 0);
  const el = document.getElementById('facturaTotalDisplay');
  if (el) el.textContent = `$ ${fmt(total)}`;
  return total;
}

function eliminarFactura(id) {
  const fid = id || editingFacturaId;
  if (!fid) return;
  if (!confirm('¿Eliminar esta factura? Los movimientos de stock NO se revertirán.')) return;
  facturas = facturas.filter(f => f.id != fid);
  saveFacturas(); renderInventario();
  notify('Factura eliminada', 'info');
  document.getElementById('facturaModal').classList.remove('active');
}

// ─────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Form factura ──────────────────────────
  document.getElementById('facturaForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const proveedor = document.getElementById('facturaProveedor').value.trim();
    const numero    = document.getElementById('facturaNumero').value.trim();
    const fecha     = document.getElementById('facturaFecha').value;
    const cuenta    = document.getElementById('facturaCuenta').value;
    const nota      = document.getElementById('facturaNote').value.trim();

    if (!proveedor) { notify('Ingresa el proveedor', 'warning'); return; }
    if (!facturaItemsTemp.length) { notify('Agrega al menos un item', 'warning'); return; }

    for (const it of facturaItemsTemp) {
      if (!it.nombre || !it.nombre.trim()) { notify('Todos los items deben tener nombre', 'warning'); return; }
      if (!it.precioUnitario)              { notify(`"${it.nombre}" no tiene precio`, 'warning'); return; }
      if (!it.cantidad || it.cantidad <= 0){ notify(`"${it.nombre}" necesita cantidad > 0`, 'warning'); return; }
    }

    facturaItemsTemp.forEach(it => { it.subtotal = (it.cantidad||0) * (it.precioUnitario||0); });
    const total = facturaItemsTemp.reduce((s,i) => s + i.subtotal, 0);
    if (!total) { notify('El total de la factura es 0', 'warning'); return; }

    const fac = {
      id: editingFacturaId || Date.now(),
      proveedor, numero, fecha, cuenta, nota,
      items: JSON.parse(JSON.stringify(facturaItemsTemp)),
      total
    };

    if (editingFacturaId) {
      const idx = facturas.findIndex(f => f.id == editingFacturaId);
      if (idx > -1) facturas[idx] = fac;
    } else {
      facturas.push(fac);
    }

    // ── Sumar stock a los productos vinculados al catálogo ──
    const prods = getProds();
    let huboStock = false;
    facturaItemsTemp.forEach(it => {
      if (!it.afectaStock || !it.prodId) return;   // "Otro gasto" → no afecta stock
      const pIdx = prods.findIndex(p => p.id === it.prodId);
      if (pIdx === -1) return;
      const cantAntes = prods[pIdx].stock || 0;
      prods[pIdx].stock = cantAntes + (it.cantidad || 0);
      sheetsSync('producto', prods[pIdx]); // sincronizar stock actualizado

      const mov = {
        id:         Date.now() + Math.random(),
        prodId:     prods[pIdx].id,
        prodNombre: prods[pIdx].nombre,
        emoji:      prods[pIdx].emoji || '☕',
        cantidad:   it.cantidad,
        tipo:       'entrada',
        motivo:     `Factura ${numero || fac.id} — ${proveedor}`,
        fecha
      };
      stockMovs.push(mov);
      sheetsSync('stockmov', mov);
      huboStock = true;
    });
    if (huboStock) { saveProds(prods); saveStockMovs(); }

    // ── Registrar egreso en cuenta ──
    const tx = {
      id:        Date.now() + 1,
      date:      fecha,
      concept:   `Compra: ${proveedor}${numero ? ' FAC-'+numero : ''}`,
      amount:    -total,
      type:      'egreso',
      esventa:   false,
      facturaId: fac.id,
      accKey:    cuenta,
      accName:   accounts[cuenta]?.name || cuenta
    };
    accounts[cuenta].transactions.push(tx);

    // ── También como gasto ──
    const gasto = {
      id:        Date.now() + 2,
      concepto:  `Compra: ${proveedor}${numero ? ' FAC-'+numero : ''}`,
      monto:     total,
      categoria: 'Compras',
      cuenta,
      fecha,
      nota:      nota || ''
    };
    gastos.push(gasto);

    saveFacturas(); saveAccounts(); saveGastos();
    updateUI(); renderInventario(); loadTransactions(); loadProdGrid();
    if (typeof updateGastosList === 'function') updateGastosList();
    if (typeof updateCajaHdr    === 'function') updateCajaHdr();

    document.getElementById('facturaModal').classList.remove('active');
    notify(`✅ Factura guardada · $${fmt(total)} registrado como gasto en ${accounts[cuenta]?.name||cuenta}`, 'success');
    // si es nueva factura → appendRow; si es edición → updateRow
    if (!editingFacturaId) fac._isNew = true;
    sheetsSync('factura', fac);
    if (!editingFacturaId) { tx._isNew = true; gasto._isNew = true; }
    sheetsSync('transaccion', tx);
    sheetsSync('gasto', gasto);
    editingFacturaId = null;
    facturaItemsTemp = [];
  });

});
