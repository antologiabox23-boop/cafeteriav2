/* ══════════════════════════════════════════
   productos.js — Catálogo de Productos
   ══════════════════════════════════════════ */

let editingProdId = null;

function loadProdsManager() {
  const list = document.getElementById('productsList');
  const prods = getProds();
  if (!prods.length) {
    list.innerHTML = `<div class="empty"><i class="fas fa-coffee"></i><h3>Sin productos</h3><p>Agrega tu catálogo</p></div>`;
    return;
  }
  list.innerHTML = '';
  prods.forEach(p => {
    const d = document.createElement('div');
    d.className = 'pmcard';
    d.innerHTML = `
      <div>
        <div class="pmname">${p.emoji || '☕'} ${p.nombre}</div>
        <div class="pmprice">$ ${fmt(p.precio)}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-s" onclick="editarProd(${p.id})"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-d" onclick="eliminarProd(${p.id})"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(d);
  });
}

function abrirProdModal(p = null) {
  editingProdId = p ? p.id : null;
  document.getElementById('prodModalTitle').textContent = p ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('prodId').value = p ? p.id : '';
  document.getElementById('prodEmoji').value = p ? (p.emoji || '') : '';
  document.getElementById('prodPrecio').value = p ? p.precio : '';
  document.getElementById('prodNombre').value = p ? p.nombre : '';
  document.getElementById('deleteProdBtn').style.display = p ? 'inline-flex' : 'none';
  document.getElementById('prodModal').classList.add('active');
}

function editarProd(id) {
  const p = getProds().find(x => x.id === id);
  if (p) abrirProdModal(p);
}

function eliminarProd(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  const prods = getProds().filter(p => p.id !== id);
  saveProds(prods);
  loadProdsManager();
  loadProdGrid();
  notify('Producto eliminado', 'info');
  document.getElementById('prodModal').classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('prodForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('prodNombre').value.trim();
    const precio = parseFloat(document.getElementById('prodPrecio').value);
    const emoji = document.getElementById('prodEmoji').value.trim() || '☕';
    if (!nombre || !precio) { notify('Nombre y precio son requeridos', 'warning'); return; }

    const prods = getProds();
    if (editingProdId) {
      const idx = prods.findIndex(p => p.id === editingProdId);
      if (idx > -1) prods[idx] = { ...prods[idx], nombre, precio, emoji };
    } else {
      prods.push({ id: Date.now(), nombre, precio, emoji });
    }
    saveProds(prods);
    loadProdsManager();
    loadProdGrid();
    document.getElementById('prodModal').classList.remove('active');
    notify(editingProdId ? 'Producto actualizado' : '✅ Producto agregado', 'success');
    editingProdId = null;
  });
});
