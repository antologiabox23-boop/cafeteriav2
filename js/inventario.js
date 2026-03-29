/* ══════════════════════════════════════════
   inventario.js — Inventario, Facturas y Productos
   ══════════════════════════════════════════ */

let editingInsumoId   = null;
let editingFacturaId  = null;
let facturaItemsTemp  = [];
let invTabActual      = 'stock';

// ─────────────────────────────────────────
// SWITCH TAB INVENTARIO
// ─────────────────────────────────────────
function switchInvTab(tab, btn) {
  invTabActual = tab;
  ['invStock','invProductos','invFacturas','invMovimientos'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(
    tab === 'stock'       ? 'invStock'      :
    tab === 'productos'   ? 'invProductos'  :
    tab === 'facturas'    ? 'invFacturas'   : 'invMovimientos'
  );
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
  if (invTabActual === 'stock')            renderStock();
  else if (invTabActual === 'productos')   renderProductosInv();
  else if (invTabActual === 'facturas')    renderFacturas();
  else if (invTabActual === 'movimientos') renderMovimientos();
}

function updateInvStats() {
  document.getElementById('invTotalInsumos').textContent  = insumos.length;
  const bajo = insumos.filter(i => i.stockMin > 0 && i.stockActual <= i.stockMin).length;
  document.getElementById('invStockBajo').textContent     = bajo;
  document.getElementById('invTotalFacturas').textContent = facturas.length;
}

function renderAlertas() {
  const cont = document.getElementById('invAlertas');
  cont.innerHTML = '';
  insumos.filter(i => i.stockMin > 0 && i.stockActual <= i.stockMin).forEach(i => {
    const d = document.createElement('div');
    d.className = 'alerta-stock';
    d.innerHTML = `
      <div class="alerta-stock-text"><i class="fas fa-exclamation-triangle"></i> Stock bajo: <strong>${i.emoji||'📦'} ${i.nombre}</strong> — ${i.stockActual} ${i.unidad} (mín: ${i.stockMin})</div>
      <button class="btn btn-warn btn-sm" onclick="abrirFacturaModal()"><i class="fas fa-shopping-cart"></i> Comprar</button>`;
    cont.appendChild(d);
  });
}

// ─────────────────────────────────────────
// STOCK
// ─────────────────────────────────────────
function renderStock() {
  const cont = document.getElementById('invStock');
  if (!insumos.length) {
    cont.innerHTML = `<div class="empty"><i class="fas fa-boxes"></i><h3>Sin insumos registrados</h3><p>Agrega insumos con el botón "Insumo"</p></div>`;
    return;
  }
  const cats = {};
  insumos.forEach(i => { const c = i.categoria||'Otros'; if(!cats[c]) cats[c]=[]; cats[c].push(i); });
  cont.innerHTML = '';
  Object.entries(cats).forEach(([cat, items]) => {
    const sec = document.createElement('div');
    sec.innerHTML = `<div class="stitle" style="font-size:.85rem"><i class="fas fa-tag"></i> ${cat}</div>`;
    items.forEach(i => {
      const bajo = i.stockMin > 0 && i.stockActual <= i.stockMin;
      const card = document.createElement('div');
      card.className = `insumo-card ${bajo ? 'stock-bajo' : 'stock-ok'}`;
      card.innerHTML = `
        <div class="ins-info">
          <div class="ins-name">${i.emoji||'📦'} ${i.nombre}</div>
          <div class="ins-meta">Mín: ${i.stockMin} ${i.unidad} · ${i.categoria}</div>
        </div>
        <div class="ins-stock">
          <div class="ins-qty ${bajo?'bajo':''}">${i.stockActual} <span style="font-size:.7rem;font-weight:400">${i.unidad}</span></div>
          ${bajo ? '<div style="font-size:.65rem;color:var(--err);font-weight:600">STOCK BAJO</div>' : ''}
        </div>
        <div class="ins-actions">
          <button class="btn btn-sm btn-s" onclick="abrirInsumoModal(${JSON.stringify(i).replace(/"/g,'&quot;')})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-d" onclick="eliminarInsumo(${i.id})"><i class="fas fa-trash"></i></button>
        </div>`;
      sec.appendChild(card);
    });
    cont.appendChild(sec);
  });
}

// ─────────────────────────────────────────
// PRODUCTOS (catálogo de venta)
// ─────────────────────────────────────────
function renderProductosInv() {
  const cont = document.getElementById('invProductos');
  const prods = getProds();

  let html = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-p btn-sm" onclick="abrirProdModalDesdeInv()"><i class="fas fa-plus"></i> Nuevo Producto</button>
    </div>`;

  if (!prods.length) {
    cont.innerHTML = html + `<div class="empty"><i class="fas fa-coffee"></i><h3>Sin productos en catálogo</h3><p>Agrega los productos que vendes</p></div>`;
    return;
  }

  html += prods.map(p => `
    <div class="insumo-card stock-ok" style="align-items:center">
      <div class="ins-info">
        <div class="ins-name">${p.emoji||'☕'} ${p.nombre}</div>
        <div class="ins-meta">Precio de venta</div>
      </div>
      <div class="ins-stock">
        <div class="ins-qty" style="color:var(--ok)">$ ${fmt(p.precio)}</div>
      </div>
      <div class="ins-actions">
        <button class="btn btn-sm btn-s" onclick="editarProdDesdeInv(${p.id})"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-d" onclick="eliminarProd(${p.id})"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('');

  cont.innerHTML = html;
}

function abrirProdModalDesdeInv(p = null) {
  if (typeof abrirProdModal === 'function') {
    abrirProdModal(p);
    const modal = document.getElementById('prodModal');
    const observer = new MutationObserver(() => {
      if (!modal.classList.contains('active')) {
        renderInventario();
        observer.disconnect();
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
}

function editarProdDesdeInv(id) {
  const p = getProds().find(x => x.id === id);
  if (p) abrirProdModalDesdeInv(p);
}

// ─────────────────────────────────────────
// FACTURAS
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
      const inv = it.ingresaInventario !== false;
      return `<div style="font-size:.78rem;color:#888;margin-bottom:2px">
        ${it.emoji||'📦'} ${it.nombre} · ${it.cantidad} ${it.unidad||'und'} · $${fmt(it.precioUnitario)}/u = <strong>$${fmt(it.subtotal)}</strong>
        <span style="margin-left:4px;font-size:.7rem" title="${inv?'Ingresa a inventario':'No afecta inventario'}">${inv?'📦':'🏷️'}</span>
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
// MOVIMIENTOS
// ─────────────────────────────────────────
function renderMovimientos() {
  const cont = document.getElementById('invMovimientos');
  if (!movInventario.length) {
    cont.innerHTML = `<div class="empty"><i class="fas fa-history"></i><h3>Sin movimientos</h3></div>`;
    return;
  }
  cont.innerHTML = '';
  [...movInventario].sort((a,b)=>b.id-a.id).slice(0,100).forEach(m => {
    const d = document.createElement('div');
    d.className = 'mov-item';
    const esEntrada = m.tipo === 'entrada';
    d.innerHTML = `
      <div class="mov-info">
        <div class="mov-concept">${m.emoji||'📦'} ${m.insumoNombre}</div>
        <div class="mov-meta">${fmtDate(m.fecha)} · ${m.motivo}</div>
      </div>
      <div class="mov-qty ${esEntrada?'mov-entrada':'mov-salida'}">${esEntrada?'+':'-'}${m.cantidad} ${m.unidad}</div>`;
    cont.appendChild(d);
  });
}

// ─────────────────────────────────────────
// MODAL INSUMO
// ─────────────────────────────────────────
function abrirInsumoModal(ins = null) {
  editingInsumoId = ins ? ins.id : null;
  document.getElementById('insumoModalTitle').innerHTML = `<i class="fas fa-box"></i> ${ins?'Editar Insumo':'Nuevo Insumo'}`;
  document.getElementById('insumoId').value           = ins ? ins.id : '';
  document.getElementById('insumoNombre').value       = ins ? ins.nombre : '';
  document.getElementById('insumoEmoji').value        = ins ? (ins.emoji||'') : '';
  document.getElementById('insumoUnidad').value       = ins ? ins.unidad : 'und';
  document.getElementById('insumoStockMin').value     = ins ? ins.stockMin : '0';
  document.getElementById('insumoStockActual').value  = ins ? ins.stockActual : '0';
  document.getElementById('insumoCategoria').value    = ins ? (ins.categoria||'Otros') : 'Otros';
  document.getElementById('deleteInsumoBtn').style.display = ins ? 'inline-flex' : 'none';
  document.getElementById('insumoModal').classList.add('active');
}

function eliminarInsumo(id) {
  if (!confirm('¿Eliminar este insumo del catálogo?')) return;
  insumos = insumos.filter(i => i.id != id);
  saveInsumos(); renderInventario();
  notify('Insumo eliminado', 'info');
  document.getElementById('insumoModal').classList.remove('active');
}

// ─────────────────────────────────────────
// MODAL FACTURA — items con toggle inventario
// ─────────────────────────────────────────
function abrirFacturaModal(fac = null) {
  editingFacturaId  = fac ? fac.id : null;
  facturaItemsTemp  = fac ? JSON.parse(JSON.stringify(fac.items)) : [];
  document.getElementById('facturaModalTitle').innerHTML = `<i class="fas fa-file-invoice-dollar"></i> ${fac?'Editar Factura':'Nueva Factura'}`;
  document.getElementById('facturaId').value          = fac ? fac.id : '';
  document.getElementById('facturaProveedor').value   = fac ? fac.proveedor : '';
  document.getElementById('facturaNumero').value      = fac ? (fac.numero||'') : '';
  document.getElementById('facturaFecha').value       = fac ? fac.fecha : fmtDateInput(new Date());
  document.getElementById('facturaCuenta').value      = fac ? fac.cuenta : 'efectivo';
  document.getElementById('facturaNote').value        = fac ? (fac.nota||'') : '';
  document.getElementById('deleteFacturaBtn').style.display = fac ? 'inline-flex' : 'none';
  renderFacturaItems();
  document.getElementById('facturaModal').classList.add('active');
}

// tipo: 'insumo' = ingresa a inventario, 'noinv' = no ingresa
function addFacturaItem(tipo = 'insumo') {
  const ingresa    = tipo === 'insumo';
  const defInsumo  = ingresa && insumos.length ? insumos[0] : null;
  facturaItemsTemp.push({
    insumoId:          defInsumo ? defInsumo.id : null,
    nombre:            defInsumo ? defInsumo.nombre : '',
    emoji:             defInsumo ? (defInsumo.emoji||'📦') : '🏷️',
    unidad:            defInsumo ? defInsumo.unidad : 'und',
    cantidad:          1,
    precioUnitario:    0,
    subtotal:          0,
    ingresaInventario: ingresa,
    crearProducto:     false
  });
  renderFacturaItems();
}

function renderFacturaItems() {
  const cont = document.getElementById('facturaItems');
  if (!facturaItemsTemp.length) {
    cont.innerHTML = `<div style="text-align:center;color:#bbb;font-size:.82rem;padding:14px 0">
      Usa <strong>+ Insumo</strong> para items que ingresan al stock, o <strong>+ Sin inventario</strong> para compras que solo se registran como gasto.
    </div>`;
    calcFacturaTotal();
    return;
  }

  const insumoOpts = insumos.map(i =>
    `<option value="${i.id}" data-nombre="${i.nombre}" data-unidad="${i.unidad}" data-emoji="${i.emoji||'📦'}">${i.emoji||'📦'} ${i.nombre} (${i.unidad})</option>`
  ).join('');

  cont.innerHTML = '';
  facturaItemsTemp.forEach((item, idx) => {
    const inv = item.ingresaInventario !== false;
    const row = document.createElement('div');
    row.style.cssText = `background:var(--latte);border-radius:var(--rs);padding:10px;margin-bottom:8px;border-left:3px solid ${inv ? 'var(--ok)' : '#ccc'}`;

    // Badge tipo + botón eliminar
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:.72rem;font-weight:700;color:${inv?'var(--ok)':'#999'};text-transform:uppercase;letter-spacing:.5px">
          ${inv ? '📦 Ingresa a inventario' : '🏷️ Sin inventario'}
        </span>
        <button type="button" class="btn btn-d btn-sm" style="padding:3px 8px" onclick="removeFacturaItem(${idx})">
          <i class="fas fa-times"></i>
        </button>
      </div>`;

    if (inv) {
      // Selector de insumo o nombre personalizado
      const selDiv = document.createElement('div');
      selDiv.className = 'fg';
      selDiv.style.margin = '0 0 8px';
      selDiv.innerHTML = `<label style="font-size:.72rem">Insumo</label>
        <select onchange="onFacturaItemInsumoChange(${idx},this)">
          <option value="__custom__">✏️ Nombre personalizado</option>
          ${insumoOpts}
        </select>`;
      row.appendChild(selDiv);
      const sel = selDiv.querySelector('select');
      sel.value = item.insumoId ? item.insumoId : '__custom__';

      if (!item.insumoId) {
        const ni = document.createElement('div');
        ni.className = 'fg';
        ni.style.margin = '0 0 8px';
        ni.innerHTML = `<label style="font-size:.72rem">Nombre</label>
          <input type="text" placeholder="Nombre del insumo" value="${item.nombre||''}"
            oninput="facturaItemsTemp[${idx}].nombre=this.value">`;
        row.appendChild(ni);
      }
    } else {
      // Item sin inventario: nombre libre
      const ni = document.createElement('div');
      ni.className = 'fg';
      ni.style.margin = '0 0 8px';
      ni.innerHTML = `<label style="font-size:.72rem">Descripción</label>
        <input type="text" placeholder="Ej: Vasos, Creatina, Servilletas..." value="${item.nombre||''}"
          oninput="facturaItemsTemp[${idx}].nombre=this.value">`;
      row.appendChild(ni);
    }

    // Cantidad / precio
    const numRow = document.createElement('div');
    numRow.className = 'frow';
    numRow.style.margin = '0';
    numRow.innerHTML = `
      <div class="fg" style="margin:0">
        <label style="font-size:.72rem">Cantidad</label>
        <input type="number" placeholder="0" min="0" step="0.01" value="${item.cantidad}"
          oninput="updateFacturaItem(${idx},'cantidad',this.value)">
      </div>
      <div class="fg" style="margin:0">
        <label style="font-size:.72rem">Precio Unit. $</label>
        <input type="number" placeholder="0" min="0" value="${item.precioUnitario||''}"
          oninput="updateFacturaItem(${idx},'precioUnitario',this.value)">
      </div>`;
    row.appendChild(numRow);

    // Subtotal + checkbox crear producto (solo para "sin inventario")
    const sub = document.createElement('div');
    sub.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:8px';
    const subtotal = (item.cantidad||0)*(item.precioUnitario||0);
    sub.innerHTML = `<span style="font-size:.78rem;color:#888">Subtotal: <strong>$ ${fmt(subtotal)}</strong></span>`;

    if (!inv) {
      const cpLabel = document.createElement('label');
      cpLabel.style.cssText = 'font-size:.75rem;color:var(--cw);cursor:pointer;display:flex;align-items:center;gap:5px';
      cpLabel.innerHTML = `
        <input type="checkbox" ${item.crearProducto?'checked':''} onchange="toggleCrearProducto(${idx},this.checked)">
        Crear en catálogo`;
      sub.appendChild(cpLabel);
    }
    row.appendChild(sub);

    // Campos de creación de producto
    if (!inv && item.crearProducto) {
      const cp = document.createElement('div');
      cp.style.cssText = 'background:#fff;border-radius:var(--rs);padding:8px;margin-top:8px;border:1px dashed var(--cw)';
      cp.innerHTML = `
        <div style="font-size:.72rem;color:var(--cw);font-weight:600;margin-bottom:6px">☕ Datos del producto en catálogo</div>
        <div class="frow" style="margin:0">
          <div class="fg" style="margin:0">
            <label style="font-size:.72rem">Emoji</label>
            <input type="text" placeholder="☕" maxlength="4" value="${item.prodEmoji||''}"
              oninput="facturaItemsTemp[${idx}].prodEmoji=this.value">
          </div>
          <div class="fg" style="margin:0">
            <label style="font-size:.72rem">Precio Venta $</label>
            <input type="number" placeholder="0" min="0" value="${item.prodPrecio||''}"
              oninput="facturaItemsTemp[${idx}].prodPrecio=parseFloat(this.value)||0">
          </div>
        </div>`;
      row.appendChild(cp);
    }

    cont.appendChild(row);
  });

  calcFacturaTotal();
}

function toggleCrearProducto(idx, val) {
  facturaItemsTemp[idx].crearProducto = val;
  if (val && !facturaItemsTemp[idx].prodEmoji) facturaItemsTemp[idx].prodEmoji = '🏷️';
  renderFacturaItems();
}

function onFacturaItemInsumoChange(idx, sel) {
  const val = sel.value;
  if (val === '__custom__') {
    facturaItemsTemp[idx].insumoId = null;
    facturaItemsTemp[idx].nombre   = '';
    facturaItemsTemp[idx].emoji    = '📦';
    facturaItemsTemp[idx].unidad   = 'und';
  } else {
    const opt = sel.querySelector(`option[value="${val}"]`);
    facturaItemsTemp[idx].insumoId = parseInt(val);
    facturaItemsTemp[idx].nombre   = opt.dataset.nombre;
    facturaItemsTemp[idx].unidad   = opt.dataset.unidad;
    facturaItemsTemp[idx].emoji    = opt.dataset.emoji;
  }
  renderFacturaItems();
}

function updateFacturaItem(idx, field, val) {
  facturaItemsTemp[idx][field] = parseFloat(val) || 0;
  facturaItemsTemp[idx].subtotal = facturaItemsTemp[idx].cantidad * facturaItemsTemp[idx].precioUnitario;
  // Solo recalcular total sin re-renderizar todo (evita perder foco)
  calcFacturaTotal();
  // Actualizar subtotal visible en el item específico sin re-render completo
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

  // ── Form insumo ──────────────────────────
  document.getElementById('insumoForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre      = document.getElementById('insumoNombre').value.trim();
    const emoji       = document.getElementById('insumoEmoji').value.trim() || '📦';
    const unidad      = document.getElementById('insumoUnidad').value;
    const stockMin    = parseFloat(document.getElementById('insumoStockMin').value) || 0;
    const stockActual = parseFloat(document.getElementById('insumoStockActual').value) || 0;
    const categoria   = document.getElementById('insumoCategoria').value;
    if (!nombre) { notify('Ingresa un nombre', 'warning'); return; }

    if (editingInsumoId) {
      const idx = insumos.findIndex(i => i.id == editingInsumoId);
      if (idx > -1) insumos[idx] = { ...insumos[idx], nombre, emoji, unidad, stockMin, stockActual, categoria };
    } else {
      insumos.push({ id: Date.now(), nombre, emoji, unidad, stockMin, stockActual, categoria });
    }
    saveInsumos(); renderInventario();
    document.getElementById('insumoModal').classList.remove('active');
    notify(editingInsumoId ? 'Insumo actualizado' : '✅ Insumo agregado', 'success');
    editingInsumoId = null;
  });

  document.getElementById('deleteInsumoBtn')?.addEventListener('click', () => {
    if (editingInsumoId) eliminarInsumo(editingInsumoId);
  });

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
      if (!it.nombre || !it.nombre.trim()) { notify('Todos los items deben tener nombre o descripción', 'warning'); return; }
      if (!it.precioUnitario) { notify(`"${it.nombre}" no tiene precio`, 'warning'); return; }
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

    // ── Solo items que ingresan a inventario actualizan stock ──
    facturaItemsTemp.forEach(it => {
      if (it.ingresaInventario === false) return;
      if (!it.insumoId) return;
      const ins = insumos.find(i => i.id == it.insumoId);
      if (ins) {
        ins.stockActual = (parseFloat(ins.stockActual)||0) + parseFloat(it.cantidad);
        const mov = {
          id:           Date.now() + Math.random(),
          insumoId:     ins.id,
          insumoNombre: ins.nombre,
          emoji:        ins.emoji,
          unidad:       ins.unidad,
          cantidad:     it.cantidad,
          tipo:         'entrada',
          motivo:       `Factura ${numero||fac.id} - ${proveedor}`,
          fecha
        };
        movInventario.push(mov);
        sheetsSync('movinv', mov);
      }
    });

    // ── Crear productos en catálogo para items marcados ──
    facturaItemsTemp.forEach(it => {
      if (!it.crearProducto || it.ingresaInventario !== false) return;
      if (!it.nombre || !it.prodPrecio) return;
      const prods = getProds();
      const existe = prods.some(p => p.nombre.toLowerCase() === it.nombre.trim().toLowerCase());
      if (!existe) {
        const newProd = { id: Date.now() + Math.random(), nombre: it.nombre.trim(), emoji: it.prodEmoji||'🏷️', precio: it.prodPrecio };
        prods.push(newProd);
        saveProds(prods);
        sheetsSync('producto', newProd);
        if (typeof loadProdGrid === 'function') loadProdGrid();
        if (typeof loadProdsManager === 'function') loadProdsManager();
      }
    });

    // ── Registrar egreso en cuenta ──
    const tx = {
      id:        Date.now() + 1,
      date:      fecha,
      concept:   `Compra: ${proveedor}${numero?' FAC-'+numero:''}`,
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
      concepto:  `Compra: ${proveedor}${numero?' FAC-'+numero:''}`,
      monto:     total,
      categoria: 'Compras',
      cuenta,
      fecha,
      nota:      nota || ''
    };
    gastos.push(gasto);

    saveFacturas(); saveInsumos(); saveMovInv(); saveAccounts(); saveGastos();
    updateUI(); renderInventario(); loadTransactions();
    if (typeof updateGastosList === 'function') updateGastosList();
    if (typeof updateCajaHdr === 'function') updateCajaHdr();

    document.getElementById('facturaModal').classList.remove('active');
    notify(`✅ Factura guardada · $${fmt(total)} registrado como gasto en ${accounts[cuenta]?.name||cuenta}`, 'success');
    sheetsSync('factura', fac);
    sheetsSync('transaccion', tx);
    sheetsSync('gasto', gasto);
    editingFacturaId = null;
    facturaItemsTemp = [];
  });

});
