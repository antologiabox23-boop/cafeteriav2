/* ══════════════════════════════════════════
   accounts.js — Cuentas y saldos
   ══════════════════════════════════════════ */

function updateUI() {
  let total = 0;
  for (const k in accounts) {
    let bal = accounts[k].transactions.reduce((s,t) => s + t.amount, 0);
    accounts[k].balance = bal;
    total += bal;
    const el = document.getElementById(k + 'Balance');
    if (el) {
      el.textContent = `$ ${fmt(bal)}`;
      el.className = 'acc-bal ' + (bal >= 0 ? 'positive' : 'negative');
    }
  }
  const totalEl = document.getElementById('totalGeneral');
  if (totalEl) {
    totalEl.textContent = `$ ${fmt(total)}`;
    totalEl.className = 'total-amt ' + (total >= 0 ? '' : 'negative');
  }
}

function loadAccountsTab() {
  const list = document.getElementById('accountsList');
  list.innerHTML = '';
  const icons = {
    nequi:       '<i class="fas fa-mobile-alt" style="color:#7c3aed"></i>',
    bancolombia: '<i class="fas fa-university" style="color:#0284c7"></i>',
    daviplata:   '<i class="fas fa-wallet" style="color:#059669"></i>',
    efectivo:    '<i class="fas fa-money-bill-wave" style="color:#d97706"></i>'
  };
  const ibg = { nequi:'#ede9fe', bancolombia:'#e0f2fe', daviplata:'#d1fae5', efectivo:'#fef3c7' };

  for (const k in accounts) {
    const a = accounts[k];
    let inc = 0, exp = 0;
    a.transactions.forEach(t => {
      if (t.type === 'transferencia') return;
      if (t.amount > 0) inc += t.amount; else exp += Math.abs(t.amount);
    });
    const c = document.createElement('div');
    c.className = `account-card ${a.color}`;
    c.style.marginBottom = '11px';
    c.innerHTML = `
      <div class="acc-icon" style="background:${ibg[k]}">${icons[k]}</div>
      <div class="acc-name">${a.name}</div>
      <div class="acc-bal ${a.balance >= 0 ? 'positive' : 'negative'}" style="font-family:'Playfair Display',serif;font-size:1.2rem">$ ${fmt(a.balance)}</div>
      <div style="margin-top:9px;font-size:.78rem;color:#888">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>Ingresos:</span><span class="positive">$ ${fmt(inc)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>Egresos:</span><span class="negative">$ ${fmt(exp)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Movimientos:</span><span>${a.transactions.length}</span></div>
      </div>`;
    c.onclick = () => openAcctDetail(k);
    list.appendChild(c);
  }
}

function openAcctDetail(k) {
  const a = accounts[k];
  let inc = 0, exp = 0, bal = 0;
  a.transactions.forEach(t => {
    bal += t.amount;
    if (t.type === 'transferencia') return;
    if (t.amount > 0) inc += t.amount;
    else exp += Math.abs(t.amount);
  });
  document.getElementById('adName').textContent = a.name;
  document.getElementById('adBalance').textContent = `$ ${fmt(bal)}`;
  document.getElementById('adBalance').className = 'asval ' + (bal >= 0 ? 'positive' : 'negative');
  document.getElementById('adIncome').textContent = `$ ${fmt(inc)}`;
  document.getElementById('adExpense').textContent = `$ ${fmt(exp)}`;
  document.getElementById('adCount').textContent = a.transactions.length;

  const dt = document.getElementById('adTransactions');
  const sorted = [...a.transactions].sort((x,y) => parseDateStr(y.date) - parseDateStr(x.date));
  if (sorted.length) {
    dt.innerHTML = '';
    sorted.slice(0, 20).forEach(tx => {
      const d = document.createElement('div');
      d.className = 'vi';
      d.innerHTML = `
        <div style="flex:1"><div class="vi-concept">${tx.concept}</div><div class="vi-meta">${fmtDate(tx.date)}</div></div>
        <div class="vi-amount ${tx.amount >= 0 ? 'positive' : 'negative'}">${tx.amount >= 0 ? '+' : ''}$ ${fmt(tx.amount)}</div>`;
      dt.appendChild(d);
    });
  } else {
    dt.innerHTML = `<div class="empty"><i class="fas fa-exchange-alt"></i><h3>Sin movimientos</h3></div>`;
  }
  document.getElementById('acctDetailModal').classList.add('active');
}

function eliminarTx(k, id) {
  const idx = accounts[k]?.transactions.findIndex(t => t.id === id);
  if (idx > -1) {
    accounts[k].transactions.splice(idx, 1);
    saveAccounts();
    Sheets.deleteRow(Sheets.HOJAS.TRANSACCIONES, id);
    updateUI();
    loadTransactions();
    loadAccountsTab();
    updateCajaHdr();
    updateVentasList();
    updateGastosList();
    notify('Movimiento eliminado', 'info');
  }
}
