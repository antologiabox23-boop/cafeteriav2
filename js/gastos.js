/* ══════════════════════════════════════════
   gastos.js — Módulo de Gastos
   ══════════════════════════════════════════ */

let editingGastoId = null;

function abrirGastoModal(g = null) {
  editingGastoId = g ? g.id : null;
  document.getElementById('gastoModalTitle').textContent = g ? 'Editar Gasto' : 'Nuevo Gasto';
  document.getElementById('gastoId').value = g ? g.id : '';
  document.getElementById('gastoConcepto').value = g ? g.concepto : '';
  document.getElementById('gastoMonto').value = g ? g.monto : '';
  document.getElementById('gastoCategoria').value = g ? g.categoria : 'Insumos';
  document.getElementById('gastoCuenta').value = g ? g.cuenta : 'efectivo';
  document.getElementById('gastoFecha').value = g ? g.fecha : fmtDateInput(new Date());
  document.getElementById('gastoNota').value = g ? (g.nota || '') : '';
  document.getElementById('deleteGastoBtn').style.display = g ? 'inline-flex' : 'none';
  document.getElementById('gastoModal').classList.add('active');
}

function updateGastosList() {
  const list = document.getElementById('gastosList');
  const today = fmtDateInput(new Date());
  const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;

  let totalHoy = 0, totalMes = 0;
  gastos.forEach(g => {
    if (g.fecha === today) totalHoy += g.monto;
    if (g.fecha.startsWith(thisMonth)) totalMes += g.monto;
  });

  document.getElementById('gastosTotalHoy').textContent = `$ ${fmt(totalHoy)}`;
  document.getElementById('gastosTotalMes').textContent = `$ ${fmt(totalMes)}`;
  document.getElementById('gastosCount').textContent = gastos.length;

  const sorted = [...gastos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  if (!sorted.length) {
    list.innerHTML = `<div class="empty"><i class="fas fa-receipt"></i><h3>Sin gastos registrados</h3><p>Usa el botón + para agregar</p></div>`;
    return;
  }
  list.innerHTML = '';
  sorted.forEach(g => {
    const d = document.createElement('div');
    d.className = 'gasto-item';
    d.innerHTML = `
      <div class="gi-info">
        <div class="gi-concept">${g.concepto}</div>
        <div class="gi-meta">${fmtDate(g.fecha)} · ${g.categoria} · ${accounts[g.cuenta]?.name || g.cuenta}${g.nota ? ' · ' + g.nota : ''}</div>
      </div>
      <div class="gi-amount">-$ ${fmt(g.monto)}</div>
      <div class="gi-actions">
        <button class="btn btn-sm btn-s" onclick='abrirGastoModal(${JSON.stringify(g)})'><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-d" onclick="eliminarGasto('${g.id}')"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(d);
  });
}

function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  const g = gastos.find(x => x.id == id);
  if (g) {
    gastos = gastos.filter(x => x.id != id);
    // Eliminar transacción asociada de todas las cuentas (por si cambió de cuenta)
    for (const k in accounts) {
      const idx = accounts[k].transactions.findIndex(t => t.gastoId == id);
      if (idx > -1) accounts[k].transactions.splice(idx, 1);
    }
    saveGastos(); saveAccounts(); updateUI(); updateGastosList(); loadTransactions();
    // FIX: sincronizar eliminación con Sheets
    Sheets.deleteRow(Sheets.HOJAS.GASTOS, id);
  }
  notify('Gasto eliminado', 'info');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('gastoForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const concepto = document.getElementById('gastoConcepto').value.trim();
      const monto = parseFloat(document.getElementById('gastoMonto').value);
      const categoria = document.getElementById('gastoCategoria').value;
      const cuenta = document.getElementById('gastoCuenta').value;
      const fecha = document.getElementById('gastoFecha').value;
      const nota = document.getElementById('gastoNota').value.trim();
      if (!concepto || !monto) { notify('Completa los campos obligatorios', 'warning'); return; }

      let gastoSyncObj = null;
      if (editingGastoId) {
        // EDICIÓN: actualizar gasto y reconstruir transacción en la cuenta
        const idx = gastos.findIndex(g => g.id == editingGastoId);
        if (idx > -1) {
          // Quitar la transacción vieja de cualquier cuenta (puede haber cambiado de cuenta)
          let oldTxId = null;
          for (const k in accounts) {
            const txIdx = accounts[k].transactions.findIndex(t => t.gastoId == editingGastoId);
            if (txIdx > -1) {
              oldTxId = accounts[k].transactions[txIdx].id;
              accounts[k].transactions.splice(txIdx, 1);
            }
          }
          gastos[idx] = { ...gastos[idx], concepto, monto, categoria, cuenta, fecha, nota };
          // Re-agregar transacción actualizada a la cuenta correcta
          const newTxId = Date.now();
          const tx = { id: newTxId, date: fecha, concept: `Gasto: ${concepto}`, amount: -monto, type: 'egreso', gastoId: editingGastoId, accKey: cuenta, accName: accounts[cuenta].name };
          accounts[cuenta].transactions.push(tx);
          gastoSyncObj = gastos[idx];
          // Eliminar tx vieja de Sheets y agregar la actualizada
          if (oldTxId) Sheets.deleteRow(Sheets.HOJAS.TRANSACCIONES, oldTxId);
          sheetsSync('transaccion', tx);
        }
      } else {
        // NUEVO gasto
        const id = Date.now();
        const txId = id + 1;
        gastos.push({ id, concepto, monto, categoria, cuenta, fecha, nota });
        const tx = { id: txId, date: fecha, concept: `Gasto: ${concepto}`, amount: -monto, type: 'egreso', gastoId: id, accKey: cuenta, accName: accounts[cuenta].name };
        accounts[cuenta].transactions.push(tx);
        gastoSyncObj = gastos[gastos.length - 1];
        // FIX: también sincronizar la transacción en la hoja Transacciones
        sheetsSync('transaccion', tx);
      }

      saveGastos(); saveAccounts(); updateUI(); updateGastosList(); loadTransactions();
      document.getElementById('gastoModal').classList.remove('active');
      const wasEditing = !!editingGastoId;
      // FIX: guardar referencia antes de limpiar editingGastoId
      if (gastoSyncObj) sheetsSync('gasto', gastoSyncObj);
      editingGastoId = null;
      notify(wasEditing ? 'Gasto actualizado' : '✅ Gasto registrado', 'success');
    });
  }

  document.getElementById('deleteGastoBtn')?.addEventListener('click', () => {
    if (editingGastoId) eliminarGasto(editingGastoId);
    document.getElementById('gastoModal').classList.remove('active');
  });

  document.getElementById('cancelGastoBtn')?.addEventListener('click', () => {
    document.getElementById('gastoModal').classList.remove('active');
  });

  document.getElementById('closeGastoModal')?.addEventListener('click', () => {
    document.getElementById('gastoModal').classList.remove('active');
  });
});
