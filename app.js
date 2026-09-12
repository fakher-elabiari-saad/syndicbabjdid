/* ===================== Syndic — logique de l'application ===================== */

const STORAGE_KEY = 'syndic-data-v1';
const MOIS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
const MOIS_LONG = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmtEUR(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
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
    apartments.push({ id: uid(), numero: 'Lot ' + i, nom: '', cotisationMensuelle: 80 });
  }
  return {
    settings: {
      nom: 'Ma résidence',
      cotisationDefaut: 80,
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

  document.getElementById('stat-encaisse').textContent = fmtEUR(encaisse);
  document.getElementById('stat-attendu').textContent = fmtEUR(attendu);
  document.getElementById('stat-depenses').textContent = fmtEUR(totalDepenses);
  document.getElementById('stat-solde').textContent = fmtEUR(solde);
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
        <span class="badge retard">-${fmtEUR(x.ecart)}</span>
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
        <span class="num">${fmtEUR(d.montant)}</span>
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
    const badge = ecart <= 0 ? `<span class="badge ok">À jour</span>` : `<span class="badge retard">-${fmtEUR(ecart)}</span>`;
    return `
      <div class="list-row" data-id="${ap.id}">
        <div class="who">
          <div class="nom">${apartmentLabel(ap)}</div>
          <div class="num">${ap.numero} · ${fmtEUR(ap.cotisationMensuelle)}/mois</div>
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
    <label>Cotisation mensuelle (€)</label>
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
            <span>${fmtEUR(p.montant)}</span>
          </div>
        `).join('')}
    </div>
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn secondary" id="btn-export-logement">Exporter l'historique (CSV)</button>
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
    const rows = [['Logement', 'Occupant', 'Année', 'Mois', 'Date de paiement', 'Montant (€)', 'Note']];
    const all = paiementsFor(apartmentId, annee).sort((a, b) => a.mois - b.mois);
    all.forEach(p => rows.push([ap.numero, ap.nom, annee, MOIS_LONG[p.mois], fmtDateFR(p.date), p.montant, p.note || '']));
    rows.push([]);
    rows.push(['Total dû ' + annee, '', '', '', '', totalDueYear(ap, annee), '']);
    rows.push(['Total payé ' + annee, '', '', '', '', totalPaidYear(apartmentId, annee), '']);
    downloadCSV(`historique_${(ap.nom || ap.numero).replace(/\s+/g, '_')}_${annee}.csv`, rows);
  });
}

function openAddLogementModal() {
  openModal(`
    <h3>Ajouter un logement</h3>
    <label>Numéro / lot</label>
    <input type="text" id="new-numero" placeholder="Lot 18">
    <label>Nom de l'occupant / propriétaire</label>
    <input type="text" id="new-nom" placeholder="">
    <label>Cotisation mensuelle (€)</label>
    <input type="number" id="new-cotis" min="0" step="0.01" value="${DATA.settings.cotisationDefaut}">
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn" id="btn-confirm-add-logement">Ajouter</button>
    </div>
  `);
  document.getElementById('btn-confirm-add-logement').addEventListener('click', () => {
    const numero = document.getElementById('new-numero').value.trim() || `Lot ${DATA.apartments.length + 1}`;
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
    tbody += `<td style="font-weight:700;">${fmtEUR(totalPaye)}</td></tr>`;
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
    <p class="hint">Cotisation mensuelle attendue : ${fmtEUR(ap.cotisationMensuelle)}. Déjà réglé : ${fmtEUR(dejaPaye)}.</p>
    ${existants.length ? `
      <div id="existing-payments">
        ${existants.map(p => `
          <div class="history-row">
            <span>${fmtDateFR(p.date)}${p.note ? ' · ' + escapeHTML(p.note) : ''}</span>
            <span>${fmtEUR(p.montant)} <button data-pid="${p.id}" class="btn-del-paiement" style="border:none;background:none;color:var(--brick);cursor:pointer;">✕</button></span>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <label>Ajouter un règlement — montant (€)</label>
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
  const annee = DATA.settings.anneeAffichee;
  const rows = [['Logement', 'Occupant', 'Année', 'Mois', 'Date', 'Montant (€)', 'Note']];
  DATA.paiements
    .filter(p => p.annee === annee)
    .sort((a, b) => a.mois - b.mois)
    .forEach(p => {
      const ap = DATA.apartments.find(a => a.id === p.apartmentId);
      if (!ap) return;
      rows.push([ap.numero, ap.nom, annee, MOIS_LONG[p.mois], fmtDateFR(p.date), p.montant, p.note || '']);
    });
  downloadCSV(`cotisations_${annee}.csv`, rows);
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
  document.getElementById('depenses-total').textContent = fmtEUR(total);

  const el = document.getElementById('depenses-list');
  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state"><p>Aucune dépense pour ce filtre.</p></div>`;
  } else {
    el.innerHTML = list.map(d => `
      <div class="expense-row" data-id="${d.id}">
        <div class="top-line"><span>${escapeHTML(d.description || d.categorie)}</span><span>${fmtEUR(d.montant)}</span></div>
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
    <label>Montant (€)</label>
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
    <label>Montant (€)</label>
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

  const rows = [['Date', 'Catégorie', 'Description', 'Fournisseur', 'Montant (€)']];
  list.forEach(d => rows.push([fmtDateFR(d.date), d.categorie, d.description, d.fournisseur, d.montant]));
  rows.push([]);
  rows.push(['Total', '', '', '', list.reduce((s, d) => s + Number(d.montant), 0)]);
  downloadCSV(`depenses_${yearVal || 'toutes'}${catVal ? '_' + catVal : ''}.csv`, rows);
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
