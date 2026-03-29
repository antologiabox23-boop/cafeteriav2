/* ══════════════════════════════════════════
   app.js — Inicialización y eventos globales
   ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {

  // ── 1. Cargar datos locales primero (funciona offline) ──
  load();
  setTodayDate();

  // ── 2. Inicializar todos los módulos con datos locales ──
  updateUI();
  loadTransactions();
  loadAccountsTab();
  loadProdGrid();
  loadProdsManager();
  updateMonthDisplay();
  updateCajaHdr();
  updateVentasList();
  updatePendientesList();
  updateCreditosList();
  updateGastosList();
  updatePendBadge();
  updateClienteSuggestions();
  renderInventario();
  loadGSUrlInput();   // muestra URL configurada (readonly)

  document.getElementById('cajaDate').textContent =
    new Date().toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  // ── 3. Auto-sync desde Sheets en segundo plano ──────────
  // Si SCRIPT_URL está configurada, descarga datos frescos.
  // La app ya funciona con los datos locales mientras tanto.
  Sheets.loadAll(true);   // silent=true → sin notificaciones al inicio

  // ── Navegación por tabs ──────────────────────────────────
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
      const t = tab.dataset.tab;
      if (t === 'inventario') renderInventario();
      if (t === 'cuentas')    loadAccountsTab();
      if (t === 'productos')  loadProdsManager();
    });
  });

  // ── FAB: nueva transacción ───────────────────────────────
  document.getElementById('addTransactionBtn')?.addEventListener('click', () => {
    resetTxForm();
    document.getElementById('transactionModal').classList.add('active');
  });

  // ── FAB: transferencia entre cuentas ────────────────────
  document.getElementById('addTransferBtn')?.addEventListener('click', () => {
    document.getElementById('transferForm')?.reset();
    const fechaEl = document.getElementById('transferFecha');
    if (fechaEl) fechaEl.value = fmtDateInput(new Date());
    document.getElementById('transferModal').classList.add('active');
  });

  document.getElementById('transferForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const origen  = document.getElementById('transferOrigen').value;
    const destino = document.getElementById('transferDestino').value;
    const monto   = parseFloat(document.getElementById('transferMonto').value);
    const fecha   = document.getElementById('transferFecha').value;
    const nota    = document.getElementById('transferNota').value.trim();
    if (!origen || !destino) { notify('Selecciona las cuentas', 'warning'); return; }
    if (origen === destino)  { notify('Origen y destino deben ser diferentes', 'warning'); return; }
    if (!monto || monto <= 0){ notify('Ingresa un monto válido', 'warning'); return; }

    const concepto     = nota ? `Transferencia → ${accounts[destino].name} (${nota})` : `Transferencia → ${accounts[destino].name}`;
    const conceptoDest = nota ? `Transferencia ← ${accounts[origen].name} (${nota})`  : `Transferencia ← ${accounts[origen].name}`;
    const idBase = Date.now();

    const txOrigen  = { id: idBase,     date: fecha, concept: concepto,     amount: -monto, type: 'transferencia', esventa: false, accKey: origen,  accName: accounts[origen].name };
    const txDestino = { id: idBase + 1, date: fecha, concept: conceptoDest, amount:  monto, type: 'transferencia', esventa: false, accKey: destino, accName: accounts[destino].name };

    accounts[origen].transactions.push(txOrigen);
    accounts[destino].transactions.push(txDestino);
    saveAccounts();
    sheetsSync('transaccion', txOrigen);
    sheetsSync('transaccion', txDestino);
    updateUI(); loadTransactions(); loadAccountsTab(); updateCajaHdr();
    document.getElementById('transferModal').classList.remove('active');
    notify(`✅ $${fmt(monto)} transferidos: ${accounts[origen].name} → ${accounts[destino].name}`, 'success');
  });

  // ── Cerrar modals ────────────────────────────────────────
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
      resetTxForm();
    });
  });

  document.getElementById('closeAcctDetail')?.addEventListener('click', () => {
    document.getElementById('acctDetailModal').classList.remove('active');
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) { modal.classList.remove('active'); resetTxForm(); }
    });
  });

  // ── Backup file input ────────────────────────────────────
  setupBackupFile();
});

function resetTxForm() {
  const form = document.getElementById('transactionForm');
  if (form) form.reset();
  setTodayDate();
  document.getElementById('transactionId').value      = '';
  document.getElementById('originalAccount').value    = '';
  document.getElementById('deleteTransactionBtn').style.display = 'none';
  document.getElementById('modalTitle').textContent   = 'Nueva Transacción';
}
