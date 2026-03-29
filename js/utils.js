/* ══════════════════════════════════════════
   utils.js — Funciones utilitarias compartidas
   ══════════════════════════════════════════ */

function fmt(n) {
  return Math.abs(n).toLocaleString('es-CO');
}

function parseDateStr(ds) {
  if (!ds) return new Date();
  if (ds instanceof Date) return ds;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) {
    const p = ds.split('-');
    return new Date(p[0], p[1]-1, p[2]);
  }
  const d = new Date(ds);
  return isNaN(d.getTime()) ? new Date() : d;
}

function fmtDateInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(ds) {
  if (!ds) return '';
  const d = parseDateStr(ds);
  if (isNaN(d.getTime())) return ds;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function notify(msg, type = 'info', dur = 3000) {
  document.querySelectorAll('.notif').forEach(n => n.remove());
  const n = document.createElement('div');
  n.className = 'notif';
  const c = { success:'#2e7d32', warning:'var(--warn)', danger:'#c62828', warn:'#e65100', info:'var(--cr)' };
  n.style.background = c[type] || c.info;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), dur);
}

function setTodayDate() {
  const el = document.getElementById('date');
  if (el) el.value = fmtDateInput(new Date());
}

function parseCSV(line) {
  const r = []; let c = '', iq = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') iq = !iq;
    else if (ch === ',' && !iq) { r.push(c); c = ''; }
    else c += ch;
  }
  r.push(c);
  return r;
}

function fixDate(d) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (d.includes('/')) {
    const p = d.split('/');
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  }
  return fmtDateInput(new Date());
}

function dlFile(content, filename) {
  const b = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const l = document.createElement('a');
  l.href = URL.createObjectURL(b);
  l.download = filename;
  document.body.appendChild(l);
  l.click();
  document.body.removeChild(l);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  const navTab = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
  if (navTab) navTab.classList.add('active');
}
