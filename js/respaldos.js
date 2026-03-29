/* ══════════════════════════════════════════
   respaldos.js — Backup y exportación local
   ══════════════════════════════════════════ */

function downloadBackup() {
  // Transacciones
  let csv = "Cuenta,Fecha,Concepto,Monto,Tipo\n";
  for (const k in accounts) {
    accounts[k].transactions.forEach(tx => {
      csv += `"${accounts[k].name}","${tx.date}","${tx.concept}",${tx.amount},"${tx.amount >= 0 ? 'Ingreso' : 'Egreso'}"\n`;
    });
  }
  dlFile(csv, `antologia_cuentas_${new Date().toISOString().slice(0,10)}.csv`);

  // Gastos
  let csv2 = "ID,Concepto,Monto,Categoria,Cuenta,Fecha,Nota\n";
  gastos.forEach(g => {
    csv2 += `"${g.id}","${g.concepto}",${g.monto},"${g.categoria}","${g.cuenta}","${g.fecha}","${g.nota||''}"\n`;
  });
  dlFile(csv2, `antologia_gastos_${new Date().toISOString().slice(0,10)}.csv`);

  // Inventario
  let csv3 = "Insumo,Unidad,StockActual,StockMinimo,Categoria\n";
  insumos.forEach(i => {
    csv3 += `"${i.nombre}","${i.unidad}",${i.stockActual},${i.stockMin},"${i.categoria}"\n`;
  });
  dlFile(csv3, `antologia_inventario_${new Date().toISOString().slice(0,10)}.csv`);

  notify('📥 Archivos CSV descargados', 'success');
}

function setupBackupFile() {
  const fileInput = document.getElementById('backupFile');
  const fileInfo  = document.getElementById('fileInfo');
  const fileName  = document.getElementById('fileName');
  const importBtn = document.getElementById('importBtn');

  if (!fileInput) return;
  fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) {
      fileInfo.style.display = 'block';
      fileName.textContent = f.name;
      importBtn.disabled = false;
    }
  });
}

function clearFileInput() {
  document.getElementById('backupFile').value = '';
  document.getElementById('fileInfo').style.display = 'none';
  document.getElementById('importBtn').disabled = true;
}

function importFromFile() {
  const f = document.getElementById('backupFile').files[0];
  if (!f) return;
  if (!confirm('¿Importar? Reemplazará las transacciones actuales de cuentas.')) return;
  const r = new FileReader();
  r.onload = function(e) {
    try {
      const lines = e.target.result.split('\n');
      for (const k in accounts) accounts[k].transactions = [];
      let s = lines[0].toLowerCase().includes('cuenta') ? 1 : 0;
      for (let i = s; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const c = parseCSV(line);
        if (c.length >= 4) {
          let cu = c[0].trim(), fe = fixDate(c[1].trim()), co = c[2].trim(), mo = parseFloat(c[3].trim());
          let k = 'efectivo';
          if (cu.toLowerCase().includes('nequi'))       k = 'nequi';
          else if (cu.toLowerCase().includes('bancolombia')) k = 'bancolombia';
          else if (cu.toLowerCase().includes('daviplata'))   k = 'daviplata';
          accounts[k].transactions.push({ id: Date.now() + i, date: fe, concept: co, amount: mo, type: mo >= 0 ? 'ingreso' : 'egreso' });
        }
      }
      saveAccounts(); updateUI(); loadTransactions(); loadAccountsTab(); clearFileInput();
      notify('✅ Datos importados', 'success');
    } catch(er) {
      notify('Error al importar el archivo', 'danger');
    }
  };
  r.readAsText(f);
}
