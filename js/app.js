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
