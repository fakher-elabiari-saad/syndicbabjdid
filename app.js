/* ===================== Syndic — logique de l'application ===================== */

const STORAGE_KEY = 'syndic-data-v1';
const MOIS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
const MOIS_LONG = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmtMAD(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
}

const MOIS_ABBR = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

function periodeLabel(annee, mois) {
  return `${MOIS_ABBR[mois]}-${String(annee).slice(-2)}`;
}

function stripAccents(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Parses labels like "févr-22", "Mars-2022", "avril 2022", "04/2022"...
function parsePeriodeLabel(label) {
  const raw = String(label ?? '').trim();
  if (!raw) return null;

  const monthNames = {
    'janv': 0, 'janvier': 0, 'jan': 0,
    'fevr': 1, 'fevrier': 1, 'fev': 1,
    'mars': 2, 'mar': 2,
    'avr': 3, 'avril': 3,
    'mai': 4,
    'juin': 5,
    'juil': 6, 'juillet': 6, 'jul': 6,
    'aout': 7,
    'sept': 8, 'septembre': 8, 'sep': 8,
    'oct': 9, 'octobre': 9,
    'nov': 10, 'novembre': 10,
    'dec': 11, 'decembre': 11
  };

  let m = raw.match(/^(\d{1,2})[\/\-.](\d{4}|\d{2})$/); // 04/2022 or 04-22
  if (m) {
    const mois = parseInt(m[1], 10) - 1;
    let annee = parseInt(m[2], 10);
    if (annee < 100) annee += 2000;
    return { annee, mois };
  }

  m = raw.match(/^([a-zéûîôàèç]+)[\s\-\/.]+(\d{2,4})$/i);
  if (m) {
    const key = stripAccents(m[1]).slice(0, 4).replace(/[^a-z]/g, '');
    let moisKey = Object.keys(monthNames).find(k => stripAccents(k).startsWith(key) || key.startsWith(stripAccents(k).slice(0, 3)));
    if (moisKey !== undefined && monthNames[moisKey] !== undefined) {
      let annee = parseInt(m[2], 10);
      if (annee < 100) annee += 2000;
      return { annee, mois: monthNames[moisKey] };
    }
  }
  return null;
}

function parseMontant(cell) {
  if (cell === null || cell === undefined || cell === '') return 0;
  if (typeof cell === 'number') return cell;
  const s = String(cell).replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  const v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDateFR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function defaultData() {
  const apartments = [];
  for (let i = 1; i <= 17; i++) {
    apartments.push({ id: uid(), numero: 'App.' + i, nom: '', cotisationMensuelle: 100 });
  }
  return {
    settings: {
      nom: 'Ma résidence',
      cotisationDefaut: 100,
      anneeAffichee: new Date().getFullYear()
    },
    categories: ['Entretien', 'Électricité communs', 'Eau', 'Assurance', 'Ascenseur', 'Nettoyage', 'Réparations', 'Administration', 'Espaces verts', 'Autres'],
    apartments,
    paiements: [],   // { id, apartmentId, date, annee, mois (0-11), montant, note }
    depenses: []     // { id, date, categorie, fournisseur, description, montant }
  };
}

let DATA = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    // fill in any missing fields for forward-compatibility
    const base = defaultData();
    return Object.assign({}, base, parsed, {
      settings: Object.assign({}, base.settings, parsed.settings),
    });
  } catch (e) {
    console.error('Erreur de lecture des données', e);
    return defaultData();
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

/* ===================== Navigation ===================== */

const views = document.querySelectorAll('.view');
const tabBtns = document.querySelectorAll('.tab-btn');

function goToView(name) {
  views.forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
  render();
}

tabBtns.forEach(b => b.addEventListener('click', () => goToView(b.dataset.view)));

/* ===================== Modal helper ===================== */

const modalBackdrop = document.getElementById('modal-backdrop');
const modalContent = document.getElementById('modal-content');

function openModal(html) {
  modalContent.innerHTML = html;
  modalBackdrop.classList.add('active');
}
function closeModal() {
  modalBackdrop.classList.remove('active');
  modalContent.innerHTML = '';
}
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

/* ===================== CSV export helper ===================== */

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ===================== Computations ===================== */

function apartmentLabel(ap) {
  return ap.nom ? `${ap.nom}` : `${ap.numero}`;
}

function paiementsFor(apartmentId, annee) {
  return DATA.paiements.filter(p => p.apartmentId === apartmentId && p.annee === annee);
}

function totalPaidMonth(apartmentId, annee, mois) {
  return DATA.paiements
    .filter(p => p.apartmentId === apartmentId && p.annee === annee && p.mois === mois)
    .reduce((s, p) => s + Number(p.montant), 0);
}

function totalDueYear(ap, annee) {
  const currentYear = new Date().getFullYear();
  const monthsElapsed = annee < currentYear ? 12 : (annee > currentYear ? 0 : new Date().getMonth() + 1);
  return ap.cotisationMensuelle * monthsElapsed;
}

function totalPaidYear(apartmentId, annee) {
  return paiementsFor(apartmentId, annee).reduce((s, p) => s + Number(p.montant), 0);
}

function depensesYear(annee) {
  return DATA.depenses.filter(d => new Date(d.date).getFullYear() === annee);
}

/* ===================== Render: Dashboard ===================== */

function renderDashboard() {
  const annee = DATA.settings.anneeAffichee;
  document.getElementById('residence-name').textContent = DATA.settings.nom || 'Syndic';
  document.getElementById('header-year').textContent = annee;

  let encaisse = 0, attendu = 0;
  DATA.apartments.forEach(ap => {
    encaisse += totalPaidYear(ap.id, annee);
    attendu += totalDueYear(ap, annee);
  });
  const totalDepenses = depensesYear(annee).reduce((s, d) => s + Number(d.montant), 0);
  const solde = encaisse - totalDepenses;

  document.getElementById('stat-encaisse').textContent = fmtMAD(encaisse);
  document.getElementById('stat-attendu').textContent = fmtMAD(attendu);
  document.getElementById('stat-depenses').textContent = fmtMAD(totalDepenses);
  document.getElementById('stat-solde').textContent = fmtMAD(solde);
  const soldeBox = document.getElementById('stat-solde-box');
  soldeBox.className = 'stat ' + (solde >= 0 ? 'solde-pos' : 'solde-neg');

  // Retards
  const retardEl = document.getElementById('dashboard-retard');
  const enRetard = DATA.apartments
    .map(ap => ({ ap, ecart: totalDueYear(ap, annee) - totalPaidYear(ap.id, annee) }))
    .filter(x => x.ecart > 0)
    .sort((a, b) => b.ecart - a.ecart);

  if (enRetard.length === 0) {
    retardEl.innerHTML = `<div class="empty-state"><p>Tous les logements sont à jour pour ${annee}.</p></div>`;
  } else {
    retardEl.innerHTML = enRetard.map(x => `
      <div class="list-row">
        <div class="who">
          <div class="nom">${apartmentLabel(x.ap)}</div>
          <div class="num">${x.ap.numero}</div>
        </div>
        <span class="badge retard">-${fmtMAD(x.ecart)}</span>
      </div>
    `).join('');
  }

  // Dernières dépenses
  const depEl = document.getElementById('dashboard-depenses');
  const recentes = [...DATA.depenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (recentes.length === 0) {
    depEl.innerHTML = `<div class="empty-state"><p>Aucune dépense enregistrée.</p></div>`;
  } else {
    depEl.innerHTML = recentes.map(d => `
      <div class="list-row" style="cursor:default;">
        <div class="who">
          <div class="nom">${d.description || d.categorie}</div>
          <div class="num">${d.categorie} · ${fmtDateFR(d.date)}</div>
        </div>
        <span class="num">${fmtMAD(d.montant)}</span>
      </div>
    `).join('');
  }
}

/* ===================== Render: Logements ===================== */

function renderLogements() {
  const el = document.getElementById('logements-list');
  const annee = DATA.settings.anneeAffichee;
  if (DATA.apartments.length === 0) {
    el.innerHTML = `<div class="empty-state"><p>Aucun logement. Ajoutez le premier lot.</p></div>`;
    return;
  }
  el.innerHTML = DATA.apartments.map(ap => {
    const du = totalDueYear(ap, annee);
    const paye = totalPaidYear(ap.id, annee);
    const ecart = du - paye;
    const badge = ecart <= 0 ? `<span class="badge ok">À jour</span>` : `<span class="badge retard">-${fmtMAD(ecart)}</span>`;
    return `
      <div class="list-row" data-id="${ap.id}">
        <div class="who">
          <div class="nom">${apartmentLabel(ap)}</div>
          <div class="num">${ap.numero} · ${fmtMAD(ap.cotisationMensuelle)}/mois</div>
        </div>
        ${badge}
      </div>
    `;
  }).join('');

  el.querySelectorAll('.list-row').forEach(row => {
    row.addEventListener('click', () => openLogementDetail(row.dataset.id));
  });
}

function openLogementDetail(apartmentId) {
  const ap = DATA.apartments.find(a => a.id === apartmentId);
  if (!ap) return;
  const annee = DATA.settings.anneeAffichee;
  const historique = paiementsFor(apartmentId, annee).sort((a, b) => (a.mois - b.mois) || a.date.localeCompare(b.date));

  openModal(`
    <h3>${apartmentLabel(ap)}</h3>
    <label>Numéro / lot</label>
    <input type="text" id="ed-numero" value="${escapeAttr(ap.numero)}">
    <label>Nom de l'occupant / propriétaire</label>
    <input type="text" id="ed-nom" value="${escapeAttr(ap.nom)}">
    <label>Cotisation mensuelle (DH)</label>
    <input type="number" id="ed-cotis" min="0" step="0.01" value="${ap.cotisationMensuelle}">

    <div class="btn-row" style="margin-top:16px;">
      <button class="btn" id="btn-save-logement">Enregistrer</button>
      <button class="btn secondary" id="btn-delete-logement">Supprimer</button>
    </div>

    <h3 style="margin-top:22px;">Historique ${annee}</h3>
    <div id="hist-list">
      ${historique.length === 0
        ? `<p class="hint">Aucun paiement enregistré pour ${annee}.</p>`
        : historique.map(p => `
          <div class="history-row">
            <span>${MOIS_LONG[p.mois]} — ${fmtDateFR(p.date)}${p.note ? ' · ' + escapeHTML(p.note) : ''}</span>
            <span>${fmtMAD(p.montant)}</span>
          </div>
        `).join('')}
    </div>
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn secondary" id="btn-export-logement">Exporter l'historique (Excel)</button>
    </div>
  `);

  document.getElementById('btn-save-logement').addEventListener('click', () => {
    ap.numero = document.getElementById('ed-numero').value.trim() || ap.numero;
    ap.nom = document.getElementById('ed-nom').value.trim();
    ap.cotisationMensuelle = parseFloat(document.getElementById('ed-cotis').value) || 0;
    save();
    closeModal();
    render();
  });

  document.getElementById('btn-delete-logement').addEventListener('click', () => {
    if (!confirm(`Supprimer ${apartmentLabel(ap)} et tout son historique de paiements ?`)) return;
    DATA.apartments = DATA.apartments.filter(a => a.id !== apartmentId);
    DATA.paiements = DATA.paiements.filter(p => p.apartmentId !== apartmentId);
    save();
    closeModal();
    render();
  });

  document.getElementById('btn-export-logement').addEventListener('click', () => {
    const rows = [['Logement', 'Occupant', 'Année', 'Mois', 'Date de paiement', 'Montant (DH)', 'Note']];
    const all = paiementsFor(apartmentId, annee).sort((a, b) => a.mois - b.mois);
    all.forEach(p => rows.push([ap.numero, ap.nom, annee, MOIS_LONG[p.mois], fmtDateFR(p.date), p.montant, p.note || '']));
    rows.push([]);
    rows.push(['Total dû ' + annee, '', '', '', '', totalDueYear(ap, annee), '']);
    rows.push(['Total payé ' + annee, '', '', '', '', totalPaidYear(apartmentId, annee), '']);
    downloadXLSX(`historique_${(ap.nom || ap.numero).replace(/\s+/g, '_')}_${annee}.xlsx`, rows, 'Historique');
  });
}

function openAddLogementModal() {
  openModal(`
    <h3>Ajouter un logement</h3>
    <label>Numéro / lot</label>
    <input type="text" id="new-numero" placeholder="App.18">
    <label>Nom de l'occupant / propriétaire</label>
    <input type="text" id="new-nom" placeholder="">
    <label>Cotisation mensuelle (DH)</label>
    <input type="number" id="new-cotis" min="0" step="0.01" value="${DATA.settings.cotisationDefaut}">
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn" id="btn-confirm-add-logement">Ajouter</button>
    </div>
  `);
  document.getElementById('btn-confirm-add-logement').addEventListener('click', () => {
    const numero = document.getElementById('new-numero').value.trim() || `App.${DATA.apartments.length + 1}`;
    const nom = document.getElementById('new-nom').value.trim();
    const cotis = parseFloat(document.getElementById('new-cotis').value) || 0;
    DATA.apartments.push({ id: uid(), numero, nom, cotisationMensuelle: cotis });
    save();
    closeModal();
    render();
  });
}

/* ===================== Render: Cotisations (matrice) ===================== */

function renderCotisations() {
  document.getElementById('cotis-year-label').textContent = DATA.settings.anneeAffichee;
  const annee = DATA.settings.anneeAffichee;
  const table = document.getElementById('cotis-matrix');

  let thead = '<thead><tr><th class="nom-col">Logement</th>';
  MOIS.forEach(m => thead += `<th>${m}</th>`);
  thead += '<th>Total</th></tr></thead>';

  let tbody = '<tbody>';
  DATA.apartments.forEach(ap => {
    tbody += `<tr><td class="nom-col">${apartmentLabel(ap)}<br><span style="font-weight:400;color:var(--ink-soft);font-size:0.7rem;">${ap.numero}</span></td>`;
    let totalPaye = 0;
    for (let m = 0; m < 12; m++) {
      const paye = totalPaidMonth(ap.id, annee, m);
      totalPaye += paye;
      const du = ap.cotisationMensuelle;
      let cls = 'unpaid';
      if (paye >= du && du > 0) cls = 'paid';
      else if (paye > 0) cls = 'partial';
      else if (du === 0) cls = 'paid';
      tbody += `<td class="cell ${cls}" data-ap="${ap.id}" data-mois="${m}">${paye > 0 ? Math.round(paye) : '—'}</td>`;
    }
    tbody += `<td style="font-weight:700;">${fmtMAD(totalPaye)}</td></tr>`;
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;

  table.querySelectorAll('td.cell').forEach(td => {
    td.addEventListener('click', () => openPaiementModal(td.dataset.ap, parseInt(td.dataset.mois, 10)));
  });
}

function openPaiementModal(apartmentId, mois) {
  const ap = DATA.apartments.find(a => a.id === apartmentId);
  const annee = DATA.settings.anneeAffichee;
  const existants = DATA.paiements.filter(p => p.apartmentId === apartmentId && p.annee === annee && p.mois === mois);
  const dejaPaye = existants.reduce((s, p) => s + Number(p.montant), 0);

  openModal(`
    <h3>${apartmentLabel(ap)} — ${MOIS_LONG[mois]} ${annee}</h3>
    <p class="hint">Cotisation mensuelle attendue : ${fmtMAD(ap.cotisationMensuelle)}. Déjà réglé : ${fmtMAD(dejaPaye)}.</p>
    ${existants.length ? `
      <div id="existing-payments">
        ${existants.map(p => `
          <div class="history-row">
            <span>${fmtDateFR(p.date)}${p.note ? ' · ' + escapeHTML(p.note) : ''}</span>
            <span>${fmtMAD(p.montant)} <button data-pid="${p.id}" class="btn-del-paiement" style="border:none;background:none;color:var(--brick);cursor:pointer;">✕</button></span>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <label>Ajouter un règlement — montant (DH)</label>
    <input type="number" id="pay-montant" min="0" step="0.01" placeholder="${ap.cotisationMensuelle}">
    <label>Date du paiement</label>
    <input type="date" id="pay-date" value="${todayISO()}">
    <label>Note (optionnel)</label>
    <input type="text" id="pay-note" placeholder="Virement, espèces...">
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn" id="btn-add-paiement">Enregistrer le règlement</button>
    </div>
  `);

  modalContent.querySelectorAll('.btn-del-paiement').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      DATA.paiements = DATA.paiements.filter(p => p.id !== btn.dataset.pid);
      save();
      openPaiementModal(apartmentId, mois);
      render();
    });
  });

  document.getElementById('btn-add-paiement').addEventListener('click', () => {
    const montant = parseFloat(document.getElementById('pay-montant').value);
    if (!montant || montant <= 0) return;
    const date = document.getElementById('pay-date').value || todayISO();
    const note = document.getElementById('pay-note').value.trim();
    DATA.paiements.push({ id: uid(), apartmentId, annee, mois, montant, date, note });
    save();
    closeModal();
    render();
  });
}

function exportAllCotisations() {
  // Tableau croisé : une ligne par période (mois-année), une colonne par appartement — comme le fichier existant.
  const annees = DATA.paiements.length
    ? [...new Set(DATA.paiements.map(p => p.annee))].sort((a, b) => a - b)
    : [DATA.settings.anneeAffichee];
  const anneeMin = annees[0];
  const anneeMax = Math.max(annees[annees.length - 1], DATA.settings.anneeAffichee);

  const header = ['Période', ...DATA.apartments.map(ap => ap.numero)];
  const rows = [header];

  const now = new Date();
  for (let y = anneeMin; y <= anneeMax; y++) {
    for (let m = 0; m < 12; m++) {
      const isFuture = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth());
      if (isFuture) continue;
      const row = [periodeLabel(y, m)];
      DATA.apartments.forEach(ap => {
        const paye = totalPaidMonth(ap.id, y, m);
        row.push(paye);
      });
      rows.push(row);
    }
  }

  downloadXLSX(`cotisations_${DATA.settings.nom || 'residence'}.xlsx`, rows, 'Cotisations');
}

function importCotisationsExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
      if (!aoa.length) throw new Error('Feuille vide');

      const header = aoa[0];
      const apColIndexes = []; // { col, apartmentId }
      for (let c = 1; c < header.length; c++) {
        const label = String(header[c] ?? '').trim();
        if (!label) continue;
        let ap = DATA.apartments.find(a => stripAccents(a.numero) === stripAccents(label));
        if (!ap) {
          ap = { id: uid(), numero: label, nom: '', cotisationMensuelle: DATA.settings.cotisationDefaut };
          DATA.apartments.push(ap);
        }
        apColIndexes.push({ col: c, apartmentId: ap.id });
      }

      let imported = 0, skippedRows = 0;
      for (let r = 1; r < aoa.length; r++) {
        const row = aoa[r];
        if (!row || !row[0]) continue;
        const periode = parsePeriodeLabel(row[0]);
        if (!periode) { skippedRows++; continue; }
        const { annee, mois } = periode;

        apColIndexes.forEach(({ col, apartmentId }) => {
          const montant = parseMontant(row[col]);
          // Remplace tout paiement déjà importé pour ce mois (évite les doublons en cas de ré-import)
          DATA.paiements = DATA.paiements.filter(p =>
            !(p.apartmentId === apartmentId && p.annee === annee && p.mois === mois && p.note === 'Import Excel')
          );
          if (montant > 0) {
            DATA.paiements.push({ id: uid(), apartmentId, annee, mois, montant, date: `${annee}-${String(mois + 1).padStart(2, '0')}-01`, note: 'Import Excel' });
            imported++;
          }
        });
      }

      save();
      render();
      alert(`Import terminé : ${imported} règlement(s) importé(s).${skippedRows ? ' ' + skippedRows + ' ligne(s) de période non reconnue ignorée(s).' : ''}`);
    } catch (err) {
      console.error(err);
      alert("Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un fichier Excel avec une colonne \"Période\" et une colonne par appartement.");
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ===================== Render: Dépenses ===================== */

function populateDepenseFilters() {
  const years = new Set(DATA.depenses.map(d => new Date(d.date).getFullYear()));
  years.add(DATA.settings.anneeAffichee);
  years.add(new Date().getFullYear());
  const sortedYears = [...years].sort((a, b) => b - a);

  const yearSel = document.getElementById('filter-depense-annee');
  const currentY = yearSel.value || String(DATA.settings.anneeAffichee);
  yearSel.innerHTML = `<option value="">Toutes les années</option>` + sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
  yearSel.value = sortedYears.includes(Number(currentY)) ? currentY : String(DATA.settings.anneeAffichee);

  const catSel = document.getElementById('filter-depense-categorie');
  const currentC = catSel.value;
  catSel.innerHTML = `<option value="">Toutes catégories</option>` + DATA.categories.map(c => `<option value="${c}">${c}</option>`).join('');
  catSel.value = currentC || '';
}

function renderDepenses() {
  populateDepenseFilters();
  const yearVal = document.getElementById('filter-depense-annee').value;
  const catVal = document.getElementById('filter-depense-categorie').value;

  let list = [...DATA.depenses];
  if (yearVal) list = list.filter(d => new Date(d.date).getFullYear() === Number(yearVal));
  if (catVal) list = list.filter(d => d.categorie === catVal);
  list.sort((a, b) => b.date.localeCompare(a.date));

  const total = list.reduce((s, d) => s + Number(d.montant), 0);
  document.getElementById('depenses-total').textContent = fmtMAD(total);

  const el = document.getElementById('depenses-list');
  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state"><p>Aucune dépense pour ce filtre.</p></div>`;
  } else {
    el.innerHTML = list.map(d => `
      <div class="expense-row" data-id="${d.id}">
        <div class="top-line"><span>${escapeHTML(d.description || d.categorie)}</span><span>${fmtMAD(d.montant)}</span></div>
        <div class="meta">${fmtDateFR(d.date)}${d.fournisseur ? ' · ' + escapeHTML(d.fournisseur) : ''}</div>
        <span class="tag">${escapeHTML(d.categorie)}</span>
      </div>
    `).join('');
    el.querySelectorAll('.expense-row').forEach(row => {
      row.addEventListener('click', () => openEditDepenseModal(row.dataset.id));
    });
  }
}

function categorieOptions(selected) {
  return DATA.categories.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

function openAddDepenseModal() {
  openModal(`
    <h3>Nouvelle dépense</h3>
    <label>Date</label>
    <input type="date" id="dep-date" value="${todayISO()}">
    <label>Catégorie</label>
    <select id="dep-categorie">${categorieOptions(DATA.categories[0])}</select>
    <label>Description</label>
    <input type="text" id="dep-description" placeholder="Ex. Réparation ascenseur">
    <label>Fournisseur (optionnel)</label>
    <input type="text" id="dep-fournisseur" placeholder="">
    <label>Montant (DH)</label>
    <input type="number" id="dep-montant" min="0" step="0.01" placeholder="0.00">
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn" id="btn-confirm-add-depense">Ajouter</button>
    </div>
  `);
  document.getElementById('btn-confirm-add-depense').addEventListener('click', () => {
    const montant = parseFloat(document.getElementById('dep-montant').value);
    if (!montant || montant <= 0) { alert('Indiquez un montant valide.'); return; }
    DATA.depenses.push({
      id: uid(),
      date: document.getElementById('dep-date').value || todayISO(),
      categorie: document.getElementById('dep-categorie').value,
      description: document.getElementById('dep-description').value.trim(),
      fournisseur: document.getElementById('dep-fournisseur').value.trim(),
      montant
    });
    save();
    closeModal();
    render();
  });
}

function openEditDepenseModal(id) {
  const d = DATA.depenses.find(x => x.id === id);
  if (!d) return;
  openModal(`
    <h3>Modifier la dépense</h3>
    <label>Date</label>
    <input type="date" id="dep-date" value="${d.date}">
    <label>Catégorie</label>
    <select id="dep-categorie">${categorieOptions(d.categorie)}</select>
    <label>Description</label>
    <input type="text" id="dep-description" value="${escapeAttr(d.description)}">
    <label>Fournisseur (optionnel)</label>
    <input type="text" id="dep-fournisseur" value="${escapeAttr(d.fournisseur)}">
    <label>Montant (DH)</label>
    <input type="number" id="dep-montant" min="0" step="0.01" value="${d.montant}">
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn" id="btn-save-depense">Enregistrer</button>
      <button class="btn secondary" id="btn-delete-depense">Supprimer</button>
    </div>
  `);
  document.getElementById('btn-save-depense').addEventListener('click', () => {
    d.date = document.getElementById('dep-date').value || d.date;
    d.categorie = document.getElementById('dep-categorie').value;
    d.description = document.getElementById('dep-description').value.trim();
    d.fournisseur = document.getElementById('dep-fournisseur').value.trim();
    d.montant = parseFloat(document.getElementById('dep-montant').value) || d.montant;
    save();
    closeModal();
    render();
  });
  document.getElementById('btn-delete-depense').addEventListener('click', () => {
    if (!confirm('Supprimer cette dépense ?')) return;
    DATA.depenses = DATA.depenses.filter(x => x.id !== id);
    save();
    closeModal();
    render();
  });
}

function exportDepenses() {
  const yearVal = document.getElementById('filter-depense-annee').value;
  const catVal = document.getElementById('filter-depense-categorie').value;
  let list = [...DATA.depenses];
  if (yearVal) list = list.filter(d => new Date(d.date).getFullYear() === Number(yearVal));
  if (catVal) list = list.filter(d => d.categorie === catVal);
  list.sort((a, b) => a.date.localeCompare(b.date));

  const rows = [['Date', 'Catégorie', 'Description', 'Fournisseur', 'Montant (DH)']];
  list.forEach(d => rows.push([fmtDateFR(d.date), d.categorie, d.description, d.fournisseur, d.montant]));
  rows.push([]);
  rows.push(['Total', '', '', '', list.reduce((s, d) => s + Number(d.montant), 0)]);
  downloadXLSX(`depenses_${yearVal || 'toutes'}${catVal ? '_' + catVal : ''}.xlsx`, rows, 'Dépenses');
}

function importDepensesExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
      if (!aoa.length) throw new Error('Feuille vide');

      // Repère les colonnes par en-tête, quel que soit leur ordre
      const header = aoa[0].map(h => stripAccents(h));
      const idx = {
        date: header.findIndex(h => h.includes('date')),
        categorie: header.findIndex(h => h.includes('categ')),
        description: header.findIndex(h => h.includes('descri')),
        fournisseur: header.findIndex(h => h.includes('fourniss')),
        montant: header.findIndex(h => h.includes('montant'))
      };
      if (idx.montant === -1) throw new Error('Colonne Montant introuvable');

      let imported = 0;
      for (let r = 1; r < aoa.length; r++) {
        const row = aoa[r];
        if (!row || row.every(c => c === undefined || c === '')) continue;
        const montant = parseMontant(row[idx.montant]);
        if (!montant) continue;

        let dateVal = idx.date > -1 ? row[idx.date] : null;
        let dateISO = todayISO();
        if (dateVal instanceof Date) {
          dateISO = dateVal.toISOString().slice(0, 10);
        } else if (typeof dateVal === 'number') {
          const d = XLSX.SSF.parse_date_code(dateVal);
          if (d) dateISO = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        } else if (typeof dateVal === 'string' && dateVal.trim()) {
          const m = dateVal.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
          if (m) {
            let y = parseInt(m[3], 10); if (y < 100) y += 2000;
            dateISO = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
          }
        }

        const categorie = idx.categorie > -1 ? String(row[idx.categorie] ?? '').trim() : 'Autres';
        if (categorie && !DATA.categories.includes(categorie)) DATA.categories.push(categorie);

        DATA.depenses.push({
          id: uid(),
          date: dateISO,
          categorie: categorie || 'Autres',
          description: idx.description > -1 ? String(row[idx.description] ?? '').trim() : '',
          fournisseur: idx.fournisseur > -1 ? String(row[idx.fournisseur] ?? '').trim() : '',
          montant
        });
        imported++;
      }

      save();
      render();
      alert(`Import terminé : ${imported} dépense(s) importée(s).`);
    } catch (err) {
      console.error(err);
      alert("Impossible de lire ce fichier. Vérifiez qu'il contient bien des colonnes Date, Catégorie, Description, Fournisseur et Montant.");
    }
  };
  reader.readAsArrayBuffer(file);
}

function downloadXLSX(filename, rows, sheetName) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Feuille1');
  XLSX.writeFile(wb, filename);
}

/* ===================== Render: Réglages ===================== */

function renderReglages() {
  document.getElementById('r-nom').value = DATA.settings.nom || '';
  document.getElementById('r-cotis').value = DATA.settings.cotisationDefaut;

  const catEl = document.getElementById('categories-list');
  catEl.innerHTML = DATA.categories.map((c, i) => `
    <div class="list-row" style="cursor:default;">
      <span>${escapeHTML(c)}</span>
      <button data-i="${i}" class="btn-del-cat" style="border:none;background:none;color:var(--brick);cursor:pointer;font-size:0.85rem;">Supprimer</button>
    </div>
  `).join('');
  catEl.querySelectorAll('.btn-del-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      DATA.categories.splice(Number(btn.dataset.i), 1);
      save();
      renderReglages();
    });
  });
}

/* ===================== Master render ===================== */

function render() {
  renderDashboard();
  renderLogements();
  renderCotisations();
  renderDepenses();
  renderReglages();
}

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}
function escapeAttr(str) { return escapeHTML(str); }

/* ===================== Event wiring ===================== */

document.getElementById('btn-add-logement').addEventListener('click', openAddLogementModal);
document.getElementById('btn-add-depense').addEventListener('click', openAddDepenseModal);
document.getElementById('btn-export-cotis-all').addEventListener('click', exportAllCotisations);
document.getElementById('btn-export-depenses').addEventListener('click', exportDepenses);

document.getElementById('btn-import-cotis').addEventListener('click', () => document.getElementById('input-import-cotis').click());
document.getElementById('input-import-cotis').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importCotisationsExcel(file);
  e.target.value = '';
});

document.getElementById('btn-import-depenses').addEventListener('click', () => document.getElementById('input-import-depenses').click());
document.getElementById('input-import-depenses').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importDepensesExcel(file);
  e.target.value = '';
});

document.getElementById('filter-depense-annee').addEventListener('change', renderDepenses);
document.getElementById('filter-depense-categorie').addEventListener('change', renderDepenses);

document.getElementById('btn-year-prev').addEventListener('click', () => {
  DATA.settings.anneeAffichee -= 1;
  save();
  render();
});
document.getElementById('btn-year-next').addEventListener('click', () => {
  DATA.settings.anneeAffichee += 1;
  save();
  render();
});

document.getElementById('form-reglages').addEventListener('submit', (e) => {
  e.preventDefault();
  DATA.settings.nom = document.getElementById('r-nom').value.trim() || 'Ma résidence';
  DATA.settings.cotisationDefaut = parseFloat(document.getElementById('r-cotis').value) || 0;
  save();
  render();
});

document.getElementById('form-add-categorie').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('new-categorie');
  const val = input.value.trim();
  if (val && !DATA.categories.includes(val)) {
    DATA.categories.push(val);
    save();
    input.value = '';
    renderReglages();
  }
});

document.getElementById('btn-reset-all').addEventListener('click', () => {
  if (!confirm('Effacer toutes les données de cet appareil ? Cette action est irréversible.')) return;
  if (!confirm('Confirmez-vous une dernière fois la suppression complète ?')) return;
  DATA = defaultData();
  save();
  render();
});

document.getElementById('btn-export-backup').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `syndic_sauvegarde_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import-backup').addEventListener('click', () => {
  document.getElementById('input-import-backup').click();
});
document.getElementById('input-import-backup').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.apartments) throw new Error('Format invalide');
      if (!confirm('Remplacer toutes les données actuelles par celles de cette sauvegarde ?')) return;
      DATA = Object.assign({}, defaultData(), parsed);
      save();
      render();
      alert('Sauvegarde importée avec succès.');
    } catch (err) {
      alert("Ce fichier n'est pas une sauvegarde valide.");
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ===================== Init ===================== */

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
