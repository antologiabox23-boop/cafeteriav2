/* ══════════════════════════════════════════
   productos.js — Catálogo de Productos + vínculo de insumos
   ══════════════════════════════════════════ */

let editingProdId    = null;
let prodInsumosTemp  = [];   // [{insumoId, cantidad}] mientras edita el modal

// ─────────────────────────────────────────
// GRID DE VENTA RÁPIDA
// ─────────────────────────────────────────
function loadProdGrid() {
  const grid = document.getElementById('prodGrid');
  grid.innerHTML = '';
  getProds().forEach(p => {
    const stockInfo = _prodStockInfo(p);
    const sinStock  = stockInfo.limitado && stockInfo.disponible <= 0;
    const bajo      = stockInfo.limitado && stockInfo.disponible > 0 && stockInfo.bajo;

    const b = document.createElement('div');
    b.className = 'prod-btn' + (sinStock ? ' prod-sin-stock' : '');
    b.innerHTML = `
      <div class="pe">${p.emoji || '☕'}</div>
      <div class="pn">${p.nombre}</div>
      <div class="pp">$ ${fmt(p.precio)}</div>
      ${stockInfo.limitado ? `<div class="pstock ${sinStock?'pstock-vacio':bajo?'pstock-bajo':'pstock-ok'}">
        ${sinStock ? 'Sin stock' : stockInfo.disponible + ' ' + stockInfo.unidad}
      </div>` : ''}`;
    if (!sinStock) b.onclick = () => addToOrden(p);
    grid.appendChild(b);
  });
}

// Calcula disponibilidad del producto según insumos vinculados
function _prodStockInfo(p) {
  if (!p.insumos || !p.insumos.length) return { limitado: false };
  let disponible = Infinity;
  let unidad = 'und';
  let bajo = false;
  p.insumos.forEach(vi => {
    const ins = insumos.find(i => i.id == vi.insumoId);
    if (!ins || !vi.cantidad) return;
    const cant = Math.floor(ins.stockActual / vi.cantidad);
    if (cant < disponible) { disponible = cant; unidad = 'und'; }
    if (ins.stockMin > 0 && ins.stockActual <= ins.stockMin * 2) bajo = true;
  });
  return { limitado: true, disponible: disponible === Infinity ? 0 : disponible, bajo, unidad };
}

// ─────────────────────────────────────────
// DESCUENTO DE STOCK al vender
// ─────────────────────────────────────────
function descontarStockPorVenta(itemsVendidos) {
  // itemsVendidos: [{id, qty, nombre, ...}] — del ordenActual o items cobrados
  let huboMovimiento = false;
  const fecha = fmtDateInput(new Date());

  itemsVendidos.forEach(it => {
    const prod = getProds().find(p => p.id === it.id);
    if (!prod || !prod.insumos || !prod.insumos.length) return;

    prod.insumos.forEach(vi => {
      const idx = insumos.findIndex(i => i.id == vi.insumoId);
      if (idx === -1 || !vi.cantidad) return;
      const consumo = vi.cantidad * (it.qty || 1);
      insumos[idx].stockActual = Math.max(0, (parseFloat(insumos[idx].stockActual)||0) - consumo);
      movInventario.push({
        id:           Date.now() + Math.random(),
        insumoId:     insumos[idx].id,
        insumoNombre: insumos[idx].nombre,
        emoji:        insumos[idx].emoji,
        unidad:       insumos[idx].unidad,
        cantidad:     consumo,
        tipo:         'salida',
        motivo:       `Venta: ${it.qty||1}x ${prod.nombre}`,
        fecha
      });
      huboMovimiento = true;
    });
  });

  if (huboMovimiento) {
    saveInsumos();
    saveMovInv();
    // Refrescar grilla para mostrar stock actualizado
    loadProdGrid();
    // Refrescar inventario si está visible
    if (typeof renderInventario === 'function') renderInventario();
  }
}

// ─────────────────────────────────────────
// LISTA EN TAB PRODUCTOS
// ─────────────────────────────────────────
function loadProdsManager() {
  const list = document.getElementById('productsList');
  const prods = getProds();
  if (!prods.length) {
    list.innerHTML = `<div class="empty"><i class="fas fa-coffee"></i><h3>Sin productos</h3><p>Agrega tu catálogo</p></div>`;
    return;
  }
  list.innerHTML = '';
  prods.forEach(p => {
    const stockInfo = _prodStockInfo(p);
    const insumosDesc = (p.insumos||[]).map(vi => {
      const ins = insumos.find(i => i.id == vi.insumoId);
      return ins ? `${ins.emoji||'📦'} ${vi.cantidad} ${ins.unidad}` : '';
    }).filter(Boolean).join(', ');

    const d = document.createElement('div');
    d.className = 'pmcard';
    d.innerHTML = `
      <div style="flex:1">
        <div class="pmname">${p.emoji || '☕'} ${p.nombre}</div>
        <div class="pmprice">$ ${fmt(p.precio)}</div>
        ${insumosDesc ? `<div style="font-size:.72rem;color:#888;margin-top:2px">Usa: ${insumosDesc}</div>` : ''}
        ${stockInfo.limitado ? `<div style="font-size:.72rem;margin-top:2px;color:${stockInfo.disponible<=0?'var(--err)':stockInfo.bajo?'var(--warn)':'var(--ok)'}">
          ${stockInfo.disponible<=0 ? '⚠️ Sin stock' : `Stock: ~${stockInfo.disponible} und`}
        </div>` : ''}
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-s" onclick="editarProd(${p.id})"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-d" onclick="eliminarProd(${p.id})"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(d);
  });
}

// ─────────────────────────────────────────
// MODAL PRODUCTO
// ─────────────────────────────────────────
function abrirProdModal(p = null) {
  editingProdId   = p ? p.id : null;
  prodInsumosTemp = p && p.insumos ? JSON.parse(JSON.stringify(p.insumos)) : [];

  document.getElementById('prodModalTitle').textContent = p ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('prodId').value    = p ? p.id : '';
  document.getElementById('prodEmoji').value = p ? (p.emoji || '') : '';
  document.getElementById('prodPrecio').value= p ? p.precio : '';
  document.getElementById('prodNombre').value= p ? p.nombre : '';
  document.getElementById('deleteProdBtn').style.display = p ? 'inline-flex' : 'none';

  renderProdInsumos();
  document.getElementById('prodModal').classList.add('active');
}

function editarProd(id) {
  const p = getProds().find(x => x.id === id);
  if (p) abrirProdModal(p);
}

// Agrega una fila vacía de insumo al temp
function addProdInsumo() {
  prodInsumosTemp.push({ insumoId: insumos[0]?.id || null, cantidad: 1 });
  renderProdInsumos();
}

function removeProdInsumo(idx) {
  prodInsumosTemp.splice(idx, 1);
  renderProdInsumos();
}

function renderProdInsumos() {
  const cont = document.getElementById('prodInsumosList');
  if (!cont) return;

  if (!insumos.length) {
    cont.innerHTML = `<div style="font-size:.78rem;color:#aaa;padding:6px 0">No hay insumos en inventario. Crea insumos primero.</div>`;
    return;
  }

  if (!prodInsumosTemp.length) {
    cont.innerHTML = '';
    return;
  }

  const opts = insumos.map(i =>
    `<option value="${i.id}" data-unidad="${i.unidad}">${i.emoji||'📦'} ${i.nombre} (${i.unidad}) — stock: ${i.stockActual}</option>`
  ).join('');

  cont.innerHTML = '';
  prodInsumosTemp.forEach((vi, idx) => {
    const ins = insumos.find(i => i.id == vi.insumoId);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
    row.innerHTML = `
      <select style="flex:2;font-size:.8rem" onchange="prodInsumosTemp[${idx}].insumoId=parseInt(this.value);renderProdInsumos()">
        ${opts}
      </select>
      <input type="number" placeholder="Cant." min="0.01" step="0.01"
             value="${vi.cantidad}" style="flex:1;min-width:60px"
             oninput="prodInsumosTemp[${idx}].cantidad=parseFloat(this.value)||0">
      <span style="font-size:.75rem;color:#888;min-width:28px">${ins?.unidad||''}</span>
      <button type="button" class="btn btn-d btn-sm" style="padding:3px 8px" onclick="removeProdInsumo(${idx})">
        <i class="fas fa-times"></i>
      </button>`;
    const sel = row.querySelector('select');
    if (vi.insumoId) sel.value = vi.insumoId;
    cont.appendChild(row);
  });
}

function eliminarProd(id) {
  const pid = id || editingProdId;
  if (!confirm('¿Eliminar este producto?')) return;
  const prods = getProds().filter(p => p.id !== pid);
  saveProds(prods);
  loadProdsManager();
  loadProdGrid();
  notify('Producto eliminado', 'info');
  document.getElementById('prodModal').classList.remove('active');
}

// ─────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('prodForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('prodNombre').value.trim();
    const precio = parseFloat(document.getElementById('prodPrecio').value);
    const emoji  = document.getElementById('prodEmoji').value.trim() || '☕';
    if (!nombre || !precio) { notify('Nombre y precio son requeridos', 'warning'); return; }

    // Filtrar insumos con valores válidos
    const insumosValidos = prodInsumosTemp.filter(vi => vi.insumoId && vi.cantidad > 0);

    const prods = getProds();
    if (editingProdId) {
      const idx = prods.findIndex(p => p.id === editingProdId);
      if (idx > -1) prods[idx] = { ...prods[idx], nombre, precio, emoji, insumos: insumosValidos };
    } else {
      prods.push({ id: Date.now(), nombre, precio, emoji, insumos: insumosValidos });
    }
    saveProds(prods);
    loadProdsManager();
    loadProdGrid();
    if (typeof renderProductosInv === 'function') renderProductosInv();
    document.getElementById('prodModal').classList.remove('active');
    notify(editingProdId ? 'Producto actualizado' : '✅ Producto agregado', 'success');
    editingProdId   = null;
    prodInsumosTemp = [];
  });
});
