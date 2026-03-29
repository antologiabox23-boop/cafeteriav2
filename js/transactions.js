/* ══════════════════════════════════════════
   transactions.js — Historial de Movimientos
   ══════════════════════════════════════════ */

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let txFilter = 'current';
let isEditing = false;
let currentEditId = null;

function updateMonthDisplay() {
  const ms = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('currentMonthDisplay').textContent = `${ms[currentMonth]} ${currentYear}`;
}

function loadTransactions() {
  const list = document.getElementById('transactionsList');
  let allTx = [];
  for (const k in accounts) {
    accounts[k].transactions.forEach(tx => {
      allTx.push({ ...tx, accKey: k, accName: accounts[k].name });
    });
  }

  if (txFilter === 'current') {
    allTx = allTx.filter(tx => {
      const d = parseDateStr(tx.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }

  allTx.sort((a,b) => parseDateStr(b.date) - parseDateStr(a.date));

  // Summary
  let income = 0, expense = 0;
  allTx.forEach(tx => {
    if (tx.type === 'transferencia') return; // no afecta contabilidad
    if (tx.amount >= 0) income += tx.amount; else expense += Math.abs(tx.amount);
  });
  const sumEl = document.getElementById('monthSummary');
  if (txFilter === 'current') {
    sumEl.style.display = 'grid';
    document.getElementById('monthTotal').textContent = `$ ${fmt(income - expense)}`;
    document.getElementById('monthTotal').className = 'sval ' + (income-expense >= 0 ? 'positive' : 'negative');
    document.getElementById('monthIncome').textContent = `$ ${fmt(income)}`;
    document.getElementById('monthExpense').textContent = `$ ${fmt(expense)}`;
  } else {
    sumEl.style.display = 'none';
  }

  if (!allTx.length) {
    list.innerHTML = `<div class="empty"><i class="fas fa-exchange-alt"></i><h3>Sin movimientos</h3><p>No hay transacciones para este período</p></div>`;
    return;
  }

  list.innerHTML = '';
  allTx.forEach(tx => {
    const d = document.createElement('div');
    d.className = 'vi';
    const isTransfer = tx.type === 'transferencia';
    const amtClass  = isTransfer ? '' : (tx.amount >= 0 ? 'positive' : 'negative');
    const amtPrefix = isTransfer ? '🔁 ' : (tx.amount >= 0 ? '+' : '');
    d.innerHTML = `
      <div style="flex:1">
        <div class="vi-concept">${tx.concept}</div>
        <div class="vi-meta">${fmtDate(tx.date)} · ${tx.accName}</div>
      </div>
      <div class="vi-amount ${amtClass}">${amtPrefix}$ ${fmt(tx.amount)}</div>
      <div class="vi-actions">
        <button class="btn btn-sm btn-s" onclick="editarTx('${tx.accKey}',${tx.id})"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-d" onclick="delTx('${tx.accKey}',${tx.id})"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(d);
  });
}

function editarTx(k, id) {
  const tx = accounts[k]?.transactions.find(t => t.id === id);
  if (!tx) return;
  isEditing = true;
  currentEditId = id;
  document.getElementById('modalTitle').textContent = 'Editar Transacción';
  document.getElementById('transactionId').value = id;
  document.getElementById('originalAccount').value = k;
  document.getElementById('account').value = k;
  document.getElementById('type').value = tx.amount >= 0 ? 'ingreso' : 'egreso';
  document.getElementById('amount').value = Math.abs(tx.amount);
  document.getElementById('date').value = tx.date;
  document.getElementById('concept').value = tx.concept;
  document.getElementById('deleteTransactionBtn').style.display = 'inline-flex';
  document.getElementById('transactionModal').classList.add('active');
}

function delTx(k, id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  eliminarTx(k, id);
}

function resetTxForm() {
  isEditing = false;
  currentEditId = null;
  document.getElementById('transactionForm').reset();
  setTodayDate();
  document.getElementById('transactionId').value = '';
  document.getElementById('originalAccount').value = '';
  document.getElementById('deleteTransactionBtn').style.display = 'none';
  document.getElementById('modalTitle').textContent = 'Nueva Transacción';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('transactionForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const k = document.getElementById('account').value;
    const type = document.getElementById('type').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const date = document.getElementById('date').value;
    const concept = document.getElementById('concept').value.trim();
    if (!k || !amount || !date || !concept) { notify('Completa todos los campos', 'warning'); return; }
    const signedAmount = type === 'egreso' ? -amount : amount;

    if (isEditing && currentEditId) {
      const origK = document.getElementById('originalAccount').value;
      const idx = accounts[origK]?.transactions.findIndex(t => t.id === currentEditId);
      if (idx > -1) {
        accounts[origK].transactions.splice(idx, 1);
        const updatedTx = { id: currentEditId, date, concept, amount: signedAmount, type,
                            accKey: k, accName: accounts[k].name };
        accounts[k].transactions.push(updatedTx);
        Sheets.deleteRow(Sheets.HOJAS.TRANSACCIONES, currentEditId);
        sheetsSync('transaccion', updatedTx);
      }
    } else {
      const tx = { id: Date.now(), date, concept, amount: signedAmount, type,
                   accKey: k, accName: accounts[k].name };
      accounts[k].transactions.push(tx);
      sheetsSync('transaccion', tx);
    }

    saveAccounts(); updateUI(); loadTransactions(); loadAccountsTab(); updateCajaHdr();
    document.getElementById('transactionModal').classList.remove('active');
    resetTxForm();
    notify('✅ Transacción guardada', 'success');
  });

  document.getElementById('deleteTransactionBtn')?.addEventListener('click', () => {
    const id = parseInt(document.getElementById('transactionId').value);
    const k = document.getElementById('originalAccount').value;
    eliminarTx(k, id);
    document.getElementById('transactionModal').classList.remove('active');
    resetTxForm();
  });

  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    updateMonthDisplay(); loadTransactions();
  });

  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    updateMonthDisplay(); loadTransactions();
  });

  document.querySelectorAll('.fopts .fbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fopts .fbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      txFilter = btn.dataset.filter;
      loadTransactions();
    });
  });
});
