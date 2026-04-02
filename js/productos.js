/* ══════════════════════════════════════════
   productos.js — Catálogo de Productos + Stock directo  v3.0
   ─────────────────────────────────────────
   Cambios v3.0:
   • Cada producto tiene su propio campo stock (número entero ≥ 0).
   • Se eliminó la vinculación de insumos desde el modal de producto.
   • _prodStockInfo lee directamente prod.stock.
   • descontarStockPorVenta resta prod.stock por unidad vendida.
   ══════════════════════════════════════════ */

let editingProdId = null;

// ─────────────────────────────────────────
// GRID DE VENTA RÁPIDA
// ─────────────────────────────────────────
function loadProdGrid() {
  const grid = document.getElementById('prodGrid');
  grid.innerHTML = '';
  getProds().forEach(p => {
    const info    = _prodStockInfo(p);
    const sinStock = info.limitado && info.stock <= 0;
    const bajo    = info.limitado && info.stock > 0 && info.stock <= 3;

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

// Devuelve info de stock del producto.
// limitado = true si el producto tiene stock configurado (stock >= 0 y se controla)
// Un producto con stock === null o undefined no controla stock.
function _prodStockInfo(p) {
  if (p.stock === undefined || p.stock === null) return { limitado: false };
  const stock = Math.max(0, p.stock || 0);
  const bajo  = stock <= 3 && stock > 0;
  return { limitado: true, stock, bajo };
}

// ─────────────────────────────────────────
// DESCUENTO DE STOCK al vender
// ─────────────────────────────────────────
function descontarStockPorVenta(itemsVendidos) {
  const fecha = fmtDateInput(new Date());
  let hubo = false;

  itemsVendidos.forEach(it => {
    const prods = getProds();
    const idx   = prods.findIndex(p => p.id === it.id);
    if (idx === -1) return;
    const p = prods[idx];
    if (p.stock === undefined || p.stock === null) return; // sin control de stock

    const consumo = it.qty || 1;
    prods[idx].stock = Math.max(0, (p.stock || 0) - consumo);
    saveProds(prods);
    sheetsSync('producto', prods[idx]); // sincronizar stock actualizado

    const mov = {
      id:          Date.now() + Math.random(),
      prodId:      p.id,
      prodNombre:  p.nombre,
      emoji:       p.emoji || '☕',
      cantidad:    consumo,
      tipo:        'salida',
      motivo:      `Venta: ${consumo}x ${p.nombre}`,
      fecha
    };
    stockMovs.push(mov);
    sheetsSync('stockmov', mov);
    hubo = true;
  });

  if (hubo) {
    saveStockMovs();
    loadProdGrid();
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
    const info = _prodStockInfo(p);
    const stockLabel = info.limitado
      ? (info.stock <= 0
          ? '<span style="color:var(--err)">⚠️ Sin stock</span>'
          : `<span style="color:${info.bajo ? 'var(--warn)' : 'var(--ok)'}">Stock: ${info.stock} und</span>`)
      : '<span style="color:#aaa">Sin control de stock</span>';

    const d = document.createElement('div');
    d.className = 'pmcard';
    d.innerHTML = `
      <div style="flex:1">
        <div class="pmname">${p.emoji || '☕'} ${p.nombre}</div>
        <div class="pmprice">$ ${fmt(p.precio)}</div>
        <div style="font-size:.72rem;margin-top:2px">${stockLabel}</div>
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
  editingProdId = p ? p.id : null;

  document.getElementById('prodModalTitle').textContent = p ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('prodId').value     = p ? p.id : '';
  document.getElementById('prodEmoji').value  = p ? (p.emoji || '') : '';
  document.getElementById('prodPrecio').value = p ? p.precio : '';
  document.getElementById('prodNombre').value = p ? p.nombre : '';

  // Stock: si el producto no tiene stock definido, dejar vacío (= sin control)
  const stockEl = document.getElementById('prodStock');
  if (stockEl) stockEl.value = (p && p.stock !== undefined && p.stock !== null) ? p.stock : '';

  document.getElementById('deleteProdBtn').style.display = p ? 'inline-flex' : 'none';
  document.getElementById('prodModal').classList.add('active');
}

function editarProd(id) {
  const p = getProds().find(x => x.id === id);
  if (p) abrirProdModal(p);
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

    // Stock: vacío = sin control, número = controla stock
    const stockRaw = document.getElementById('prodStock')?.value;
    const stock    = (stockRaw === '' || stockRaw === undefined || stockRaw === null)
                     ? null
                     : Math.max(0, parseFloat(stockRaw) || 0);

    const prods = getProds();
    let syncProd = null;
    if (editingProdId) {
      const idx = prods.findIndex(p => p.id === editingProdId);
      if (idx > -1) {
        prods[idx] = { ...prods[idx], nombre, precio, emoji, stock };
        syncProd = prods[idx]; // edición → updateRow
      }
    } else {
      const newProd = { id: Date.now(), nombre, precio, emoji, stock };
      prods.push(newProd);
      syncProd = { ...newProd, _isNew: true }; // nuevo → appendRow
    }
    saveProds(prods);
    if (syncProd) sheetsSync('producto', syncProd);
    loadProdsManager();
    loadProdGrid();
    if (typeof renderProductosInv === 'function') renderProductosInv();
    document.getElementById('prodModal').classList.remove('active');
    notify(editingProdId ? 'Producto actualizado' : '✅ Producto agregado', 'success');
    editingProdId = null;
  });
});
