/* ══════════════════════════════════════════
   inventario.js — Inventario y Facturas de Compra
   ══════════════════════════════════════════ */

let editingInsumoId = null;
let editingFacturaId = null;
let facturaItemsTemp = [];  // items en el form de factura
let invTabActual = 'stock';

// ─────────────────────────────────────────
// SWITCH TAB INVENTARIO
// ─────────────────────────────────────────
function switchInvTab(tab, btn) {
  invTabActual = tab;
  document.getElementById('invStock').style.display      = tab === 'stock'       ? 'block' : 'none';
  document.getElementById('invFacturas').style.display   = tab === 'facturas'    ? 'block' : 'none';
  document.getElementById('invMovimientos').style.display= tab === 'movimientos' ? 'block' : 'none';
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
  if (invTabActual === 'stock')       renderStock();
  else if (invTabActual === 'facturas')    renderFacturas();
  else if (invTabActual === 'movimientos') renderMovimientos();
}

function updateInvStats() {
  document.getElementById('invTotalInsumos').textContent = insumos.length;
  const bajo = insumos.filter(i => i.stockMin > 0 && i.stockActual <= i.stockMin).length;
  document.getElementById('invStockBajo').textContent = bajo;
  document.getElementById('invTotalFacturas').textContent = facturas.length;
}

function renderAlertas() {
  const cont = document.getElementById('invAlertas');
  cont.innerHTML = '';
  const bajos = insumos.filter(i => i.stockMin > 0 && i.stockActual <= i.stockMin);
  bajos.forEach(i => {
    const d = document.createElement('div');
    d.className = 'alerta-stock';
    d.innerHTML = `
      <div class="alerta-stock-text"><i class="fas fa-exclamation-triangle"></i> Stock bajo: <strong>${i.emoji || '📦'} ${i.nombre}</strong> — ${i.stockActual} ${i.unidad} (mín: ${i.stockMin})</div>
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
  // Agrupar por categoría
  const cats = {};
  insumos.forEach(i => {
    const cat = i.categoria || 'Otros';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(i);
  });

  cont.innerHTML = '';
  Object.entries(cats).forEach(([cat, items]) => {
    const section = document.createElement('div');
    section.innerHTML = `<div class="stitle" style="font-size:.85rem"><i class="fas fa-tag"></i> ${cat}</div>`;
    items.forEach(i => {
      const bajo = i.stockMin > 0 && i.stockActual <= i.stockMin;
      const card = document.createElement('div');
      card.className = `insumo-card ${bajo ? 'stock-bajo' : 'stock-ok'}`;
      card.innerHTML = `
        <div class="ins-info">
          <div class="ins-name">${i.emoji || '📦'} ${i.nombre}</div>
          <div class="ins-meta">Mín: ${i.stockMin} ${i.unidad} · Cat: ${i.categoria}</div>
        </div>
        <div class="ins-stock">
          <div class="ins-qty ${bajo ? 'bajo' : ''}">${i.stockActual} <span style="font-size:.7rem;font-weight:400">${i.unidad}</span></div>
          ${bajo ? '<div style="font-size:.65rem;color:var(--err);font-weight:600">STOCK BAJO</div>' : ''}
        </div>
        <div class="ins-actions">
          <button class="btn btn-sm btn-s" onclick="abrirInsumoModal(${JSON.stringify(i).replace(/"/g,'&quot;')})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-d" onclick="eliminarInsumo(${i.id})"><i class="fas fa-trash"></i></button>
        </div>`;
      section.appendChild(card);
    });
    cont.appendChild(section);
  });
}

// ─────────────────────────────────────────
// FACTURAS
// ─────────────────────────────────────────
function renderFacturas() {
  const cont = document.getElementById('invFacturas');
  if (!facturas.length) {
    cont.innerHTML = `<div class="empty"><i class="fas fa-file-invoice-dollar"></i><h3>Sin facturas registradas</h3><p>Agrega una factura de compra para actualizar el inventario</p></div>`;
    return;
  }
  cont.innerHTML = '';
  [...facturas].sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).forEach(f => {
    const card = document.createElement('div');
    card.className = 'factura-card';
    const itemsHtml = f.items.map(it =>
      `<div>${it.emoji || '📦'} ${it.nombre} · ${it.cantidad} ${it.unidad} · $ ${fmt(it.precioUnitario)}/u = <strong>$ ${fmt(it.subtotal)}</strong></div>`
    ).join('');
    card.innerHTML = `
      <div class="fac-hdr">
        <div>
          <div class="fac-num"><i class="fas fa-file-invoice-dollar" style="color:#0284c7;margin-right:5px"></i>${f.numero || 'Sin número'} · ${f.proveedor}</div>
          <div class="fac-det">${fmtDate(f.fecha)} · ${accounts[f.cuenta]?.name || f.cuenta}${f.nota ? ' · ' + f.nota : ''}</div>
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
    cont.innerHTML = `<div class="empty"><i class="fas fa-history"></i><h3>Sin movimientos</h3><p>Los movimientos de stock aparecerán aquí</p></div>`;
    return;
  }
  cont.innerHTML = '';
  [...movInventario].sort((a,b) => b.id - a.id).slice(0, 100).forEach(m => {
    const d = document.createElement('div');
    d.className = 'mov-item';
    const esEntrada = m.tipo === 'entrada';
    d.innerHTML = `
      <div class="mov-info">
        <div class="mov-concept">${m.emoji || '📦'} ${m.insumoNombre}</div>
        <div class="mov-meta">${fmtDate(m.fecha)} · ${m.motivo}</div>
      </div>
      <div class="mov-qty ${esEntrada ? 'mov-entrada' : 'mov-salida'}">
        ${esEntrada ? '+' : '-'}${m.cantidad} ${m.unidad}
      </div>`;
    cont.appendChild(d);
  });
}

// ─────────────────────────────────────────
// MODAL INSUMO
// ─────────────────────────────────────────
function abrirInsumoModal(ins = null) {
  editingInsumoId = ins ? ins.id : null;
  document.getElementById('insumoModalTitle').innerHTML = `<i class="fas fa-box"></i> ${ins ? 'Editar Insumo' : 'Nuevo Insumo'}`;
  document.getElementById('insumoId').value = ins ? ins.id : '';
  document.getElementById('insumoNombre').value = ins ? ins.nombre : '';
  document.getElementById('insumoEmoji').value = ins ? (ins.emoji || '') : '';
  document.getElementById('insumoUnidad').value = ins ? ins.unidad : 'und';
  document.getElementById('insumoStockMin').value = ins ? ins.stockMin : '0';
  document.getElementById('insumoStockActual').value = ins ? ins.stockActual : '0';
  document.getElementById('insumoCategoria').value = ins ? (ins.categoria || 'Otros') : 'Otros';
  document.getElementById('deleteInsumoBtn').style.display = ins ? 'inline-flex' : 'none';
  document.getElementById('insumoModal').classList.add('active');
}

function eliminarInsumo(id) {
  if (!confirm('¿Eliminar este insumo del catálogo?')) return;
  insumos = insumos.filter(i => i.id != id);
  saveInsumos();
  renderInventario();
  notify('Insumo eliminado', 'info');
  document.getElementById('insumoModal').classList.remove('active');
}

// ─────────────────────────────────────────
// MODAL FACTURA
// ─────────────────────────────────────────
function abrirFacturaModal(fac = null) {
  editingFacturaId = fac ? fac.id : null;
  facturaItemsTemp = fac ? JSON.parse(JSON.stringify(fac.items)) : [];
  document.getElementById('facturaModalTitle').innerHTML = `<i class="fas fa-file-invoice-dollar"></i> ${fac ? 'Editar Factura' : 'Nueva Factura de Compra'}`;
  document.getElementById('facturaId').value = fac ? fac.id : '';
  document.getElementById('facturaProveedor').value = fac ? fac.proveedor : '';
  document.getElementById('facturaNumero').value = fac ? (fac.numero || '') : '';
  document.getElementById('facturaFecha').value = fac ? fac.fecha : fmtDateInput(new Date());
  document.getElementById('facturaCuenta').value = fac ? fac.cuenta : 'efectivo';
  document.getElementById('facturaNote').value = fac ? (fac.nota || '') : '';
  document.getElementById('deleteFacturaBtn').style.display = fac ? 'inline-flex' : 'none';

  if (!facturaItemsTemp.length) addFacturaItem();
  else renderFacturaItems();
  document.getElementById('facturaModal').classList.add('active');
}

function addFacturaItem() {
  // Buscar insumo existente por defecto
  const defInsumo = insumos[0] || null;
  facturaItemsTemp.push({
    insumoId: defInsumo ? defInsumo.id : '',
    nombre: defInsumo ? defInsumo.nombre : '',
    emoji: defInsumo ? (defInsumo.emoji || '📦') : '📦',
    unidad: defInsumo ? defInsumo.unidad : 'und',
    cantidad: 1,
    precioUnitario: 0,
    subtotal: 0
  });
  renderFacturaItems();
}

function renderFacturaItems() {
  const cont = document.getElementById('facturaItems');
  cont.innerHTML = '';
  const opts = insumos.map(i => `<option value="${i.id}" data-nombre="${i.nombre}" data-unidad="${i.unidad}" data-emoji="${i.emoji||'📦'}">${i.emoji||'📦'} ${i.nombre} (${i.unidad})</option>`).join('');
  const optsConCustom = `<option value="__custom__">✏️ Insumo personalizado</option>${opts}`;

  facturaItemsTemp.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'factura-item-row';
    row.innerHTML = `
      <select onchange="onFacturaItemInsumoChange(${idx},this)">
        ${optsConCustom}
      </select>
      <input type="number" placeholder="Cantidad" min="0" step="0.01" value="${item.cantidad}" oninput="updateFacturaItem(${idx},'cantidad',this.value)">
      <input type="number" placeholder="Precio Unit. $" min="0" value="${item.precioUnitario}" oninput="updateFacturaItem(${idx},'precioUnitario',this.value)">
      <button type="button" class="btn btn-d btn-sm" onclick="removeFacturaItem(${idx})"><i class="fas fa-times"></i></button>`;

    // Establecer el select al valor correcto
    const sel = row.querySelector('select');
    if (item.insumoId) sel.value = item.insumoId;
    cont.appendChild(row);
  });
  calcFacturaTotal();
}

function onFacturaItemInsumoChange(idx, sel) {
  const val = sel.value;
  if (val === '__custom__') {
    const nombre = prompt('Nombre del insumo personalizado:');
    if (!nombre) { sel.value = facturaItemsTemp[idx].insumoId || ''; return; }
    facturaItemsTemp[idx].insumoId = null;
    facturaItemsTemp[idx].nombre = nombre;
    facturaItemsTemp[idx].emoji = '📦';
    facturaItemsTemp[idx].unidad = 'und';
  } else {
    const opt = sel.querySelector(`option[value="${val}"]`);
    facturaItemsTemp[idx].insumoId = parseInt(val);
    facturaItemsTemp[idx].nombre = opt.dataset.nombre;
    facturaItemsTemp[idx].unidad = opt.dataset.unidad;
    facturaItemsTemp[idx].emoji = opt.dataset.emoji;
  }
  calcFacturaTotal();
}

function updateFacturaItem(idx, field, val) {
  facturaItemsTemp[idx][field] = parseFloat(val) || 0;
  facturaItemsTemp[idx].subtotal = facturaItemsTemp[idx].cantidad * facturaItemsTemp[idx].precioUnitario;
  calcFacturaTotal();
}

function removeFacturaItem(idx) {
  facturaItemsTemp.splice(idx, 1);
  renderFacturaItems();
}

function calcFacturaTotal() {
  const total = facturaItemsTemp.reduce((s,i) => s + (i.cantidad * i.precioUnitario), 0);
  document.getElementById('facturaTotalDisplay').textContent = `$ ${fmt(total)}`;
  return total;
}

function eliminarFactura(id) {
  if (!confirm('¿Eliminar esta factura? Los movimientos de stock NO se revertirán.')) return;
  facturas = facturas.filter(f => f.id != id);
  saveFacturas();
  renderInventario();
  notify('Factura eliminada', 'info');
}

// ─────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Form insumo
  const formIns = document.getElementById('insumoForm');
  if (formIns) {
    formIns.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = document.getElementById('insumoNombre').value.trim();
      const emoji = document.getElementById('insumoEmoji').value.trim() || '📦';
      const unidad = document.getElementById('insumoUnidad').value;
      const stockMin = parseFloat(document.getElementById('insumoStockMin').value) || 0;
      const stockActual = parseFloat(document.getElementById('insumoStockActual').value) || 0;
      const categoria = document.getElementById('insumoCategoria').value;
      if (!nombre) { notify('Ingresa un nombre', 'warning'); return; }

      if (editingInsumoId) {
        const idx = insumos.findIndex(i => i.id == editingInsumoId);
        if (idx > -1) insumos[idx] = { ...insumos[idx], nombre, emoji, unidad, stockMin, stockActual, categoria };
      } else {
        insumos.push({ id: Date.now(), nombre, emoji, unidad, stockMin, stockActual, categoria });
      }
      saveInsumos();
      renderInventario();
      document.getElementById('insumoModal').classList.remove('active');
      notify(editingInsumoId ? 'Insumo actualizado' : '✅ Insumo agregado', 'success');
      editingInsumoId = null;
    });
  }

  // Form factura
  const formFac = document.getElementById('facturaForm');
  if (formFac) {
    formFac.addEventListener('submit', (e) => {
      e.preventDefault();
      const proveedor = document.getElementById('facturaProveedor').value.trim();
      const numero = document.getElementById('facturaNumero').value.trim();
      const fecha = document.getElementById('facturaFecha').value;
      const cuenta = document.getElementById('facturaCuenta').value;
      const nota = document.getElementById('facturaNote').value.trim();
      if (!proveedor) { notify('Ingresa el proveedor', 'warning'); return; }
      if (!facturaItemsTemp.length) { notify('Agrega al menos un producto', 'warning'); return; }

      // Calcular subtotales
      facturaItemsTemp.forEach(it => { it.subtotal = it.cantidad * it.precioUnitario; });
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

      // Actualizar stock
      facturaItemsTemp.forEach(it => {
        if (it.insumoId) {
          const ins = insumos.find(i => i.id == it.insumoId);
          if (ins) {
            ins.stockActual = (parseFloat(ins.stockActual) || 0) + parseFloat(it.cantidad);
            movInventario.push({
              id: Date.now() + Math.random(),
              insumoId: ins.id,
              insumoNombre: ins.nombre,
              emoji: ins.emoji,
              unidad: ins.unidad,
              cantidad: it.cantidad,
              tipo: 'entrada',
              motivo: `Factura ${numero || fac.id} - ${proveedor}`,
              fecha
            });
          }
        }
      });

      // Registrar egreso en cuenta
      const tx = {
        id: Date.now() + 1,
        date: fecha,
        concept: `Compra: ${proveedor}${numero ? ' FAC-'+numero : ''}`,
        amount: -total,
        type: 'egreso',
        facturaId: fac.id
      };
      accounts[cuenta].transactions.push(tx);

      saveFacturas(); saveInsumos(); saveMovInv(); saveAccounts();
      updateUI(); renderInventario(); loadTransactions();
      document.getElementById('facturaModal').classList.remove('active');
      notify(`✅ Factura guardada · $ ${fmt(total)} debitado de ${accounts[cuenta].name}`, 'success');
      sheetsSync('factura', fac);
      editingFacturaId = null;
    });
  }

  document.getElementById('deleteInsumoBtn')?.addEventListener('click', () => {
    if (editingInsumoId) eliminarInsumo(editingInsumoId);
  });
});
