// Gâprée — interactions client
// ============================================================

const $  = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

const FR_MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDateLong(iso) {
  const d = new Date(iso);
  const dow = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"][d.getDay()];
  return `${dow} ${d.getDate()} ${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Les données viennent de data/_bundle.js (window globals) — fonctionne en file://
async function loadJSON(path) {
  const map = {
    'data/artisans.json':   () => window.DATA_ARTISANS,
    'data/actualites.json': () => window.DATA_ACTUALITES,
    'data/histoire.json':   () => window.DATA_HISTOIRE,
    'data/mairie.json':     () => window.DATA_MAIRIE,
  };
  const fromBundle = map[path] && map[path]();
  if (fromBundle) return fromBundle;
  // Fallback : si le bundle n'est pas chargé, on tente fetch (HTTP server)
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Fetch ${path}: ${r.status}`);
  return r.json();
}

// ============================================================ Nav active
function highlightNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.nav a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
}

// ============================================================ Artisans page
async function renderArtisans() {
  const grid = $('#artisans-grid');
  if (!grid) return;
  const data = await loadJSON('data/artisans.json');
  const filters = $('#artisans-filters');

  const renderGrid = (cat) => {
    const list = cat === 'all' ? data.artisans : data.artisans.filter(a => a.categorie === cat);
    grid.innerHTML = list.map(a => `
      <article class="card">
        <div class="card-thumb">
          ${iconForCategory(a.categorie)}
        </div>
        <span class="card-meta">${esc(a.categorie)}</span>
        <h3 class="card-title">${esc(a.nom)}</h3>
        <p class="muted" style="font-family:var(--serif);font-style:italic;margin-top:-6px;">${esc(a.metier)}</p>
        <p>${esc(a.description)}</p>
        <div style="margin-top:auto;padding-top:14px;border-top:1px solid var(--line-soft);font-size:13px;color:var(--mousse);">
          <strong>${esc(a.lieu)}</strong> · ${esc(a.ouverture)}
        </div>
      </article>
    `).join('');
  };

  filters.innerHTML = `
    <button class="chip is-active" data-cat="all">Toutes les filières</button>
    ${data.categories.map(c => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
  `;
  filters.addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    $$('.chip', filters).forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    renderGrid(btn.dataset.cat);
  });

  renderGrid('all');
}

function iconForCategory(cat) {
  // Pictogrammes SVG line-art (statiques, contrôlés)
  const map = {
    "Cidre & Calvados": '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M24 14c2-4 6-4 8 0M32 14v6M22 24c-4 0-8 4-8 14s4 18 18 18 18-10 18-18-4-14-8-14c-2 0-3 2-5 2h-12c-2 0-3-2-3-2z"/></svg>',
    "Bois":            '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M32 6L18 28h28zM32 22L14 50h36zM26 50v8h12v-8"/></svg>',
    "Bouche":          '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="32" cy="34" r="20"/><path d="M22 30c2-3 5-4 10-4s8 1 10 4M32 14c0-4 3-6 6-6"/></svg>',
    "Textile":         '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 22h44M10 32h44M10 42h44M18 12v40M32 12v40M46 12v40"/></svg>',
    "Métal":           '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 50l16-32 4 8 12-4-8 16-12 4 4 8z"/></svg>',
    "Vannerie":        '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 24h40l-4 28H16zM12 24c0-6 8-10 20-10s20 4 20 10M18 24v28M30 24v28M42 24v28"/></svg>',
    "Pierre":          '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 50l14-20 12 8 10-14 8 26z"/></svg>',
  };
  return map[cat] || map["Bouche"];
}

// ============================================================ Actualités page
async function renderActualites() {
  const list = $('#news-list');
  if (!list) return;
  const data = await loadJSON('data/actualites.json');
  const filters = $('#news-filters');

  const render = (cat) => {
    const items = cat === 'all' ? data.items : data.items.filter(n => n.categorie === cat);
    list.innerHTML = items.map(n => `
      <article class="news-row">
        <div class="news-date">${esc(fmtDate(n.date))}</div>
        <div class="news-body">
          <h3>${esc(n.titre)}</h3>
          <p>${esc(n.resume)}</p>
        </div>
        <div class="news-cat"><span class="chip">${esc(n.categorie)}</span></div>
      </article>
    `).join('');
  };

  filters.innerHTML = `
    <button class="chip is-active" data-cat="all">Tout</button>
    ${data.categories.map(c => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
  `;
  filters.addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    $$('.chip', filters).forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    render(btn.dataset.cat);
  });

  render('all');
}

// ============================================================ Histoire page
async function renderHistoire() {
  const tl = $('#timeline');
  if (!tl) return;
  const data = await loadJSON('data/histoire.json');
  $('#histoire-intro').textContent = data.introduction;
  tl.innerHTML = data.jalons.map(j => `
    <div class="timeline-item">
      <div class="timeline-date">${esc(j.date)}</div>
      <h3 class="timeline-title">${esc(j.titre)}</h3>
      <p class="timeline-body">${esc(j.body)}</p>
    </div>
  `).join('');
}

// ============================================================ Mairie page
async function renderMairie() {
  const root = $('#mairie-root');
  if (!root) return;
  const data = await loadJSON('data/mairie.json');
  const m = data.mairie;
  const c = data.commune;

  // Info pratique
  const info = $('#mairie-pratique');
  if (info) {
    info.innerHTML = `
      <div class="card" style="grid-column: span 2;">
        <span class="card-meta">Contact mairie</span>
        <h3 class="card-title">${esc(m.adresse)}</h3>
        <p><strong>Téléphone</strong> · <a href="tel:${esc(m.telephone.replace(/\s/g,''))}">${esc(m.telephone)}</a></p>
        <p><strong>Email</strong> · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a></p>
      </div>
      <div class="card">
        <span class="card-meta">Horaires d'ouverture</span>
        <ul style="list-style:none;padding:0;margin:8px 0 0;display:flex;flex-direction:column;gap:6px;">
          ${m.horaires.map(h => `<li style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line-soft);padding:4px 0;"><strong style="font-family:var(--serif);font-style:italic;">${esc(h.jour)}</strong><span class="muted">${esc(h.creneau)}</span></li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Conseil municipal
  const elusEl = $('#mairie-elus');
  if (elusEl) {
    const maireAdj = data.elus.filter(e => /Maire|adjoint/i.test(e.fonction));
    const conseillers = data.elus.filter(e => !/Maire|adjoint/i.test(e.fonction));

    elusEl.innerHTML = `
      <div class="grid grid-2" style="margin-bottom:30px;">
        ${maireAdj.map(e => elusCardHTML(e, true)).join('')}
      </div>
      <div class="grid grid-3">
        ${conseillers.map(e => elusCardHTML(e, false)).join('')}
      </div>
    `;
  }

  // Identité commune
  const identite = $('#mairie-identite');
  if (identite) {
    identite.innerHTML = `
      <dl class="hero-meta" style="border:none;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:14px 30px;">
        <div><dt>Population (2020)</dt><dd>${c.population_2020} habitants</dd></div>
        <div><dt>Évolution 2014–2020</dt><dd>${esc(c.evolution_2014_2020)}</dd></div>
        <div><dt>Surface</dt><dd>${c.surface_km2} km²</dd></div>
        <div><dt>Densité</dt><dd>${c.densite_hab_km2} hab/km²</dd></div>
        <div><dt>Canton</dt><dd>${esc(c.canton)}</dd></div>
        <div><dt>Arrondissement</dt><dd>${esc(c.arrondissement)}</dd></div>
        <div><dt>EPCI</dt><dd>${esc(c.epci)}</dd></div>
        <div><dt>Code INSEE</dt><dd>${esc(c.code_insee)}</dd></div>
      </dl>
    `;
  }
}

function elusCardHTML(e, highlight) {
  const initials = `${e.prenom[0]}${e.nom[0]}`;
  const accent = highlight ? 'background:var(--mousse);color:var(--lin);' : 'background:var(--lin-dark);color:var(--mousse);';
  const age = new Date().getFullYear() - e.annee_naissance;
  return `
    <article class="card" style="${highlight ? 'border-color:var(--mousse-2);' : ''}">
      <div style="display:flex;gap:14px;align-items:center;">
        <div style="width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:18px;font-weight:500;${accent}flex-shrink:0;">${esc(initials)}</div>
        <div style="flex:1;min-width:0;">
          <span class="card-meta" style="display:block;">${esc(e.fonction)}</span>
          <h4 class="card-title" style="font-size:19px;line-height:1.2;margin:2px 0 0;">${esc(e.civilite)} ${esc(e.prenom)} ${esc(e.nom)}</h4>
        </div>
      </div>
      <p class="muted" style="font-size:13px;font-style:italic;font-family:var(--serif);margin-top:-4px;">${esc(e.profession)} · ${age} ans</p>
      ${e.delegation ? `<p style="font-size:14px;"><strong>Délégation :</strong> ${esc(e.delegation)}</p>` : ''}
      <div style="margin-top:auto;padding-top:12px;border-top:1px solid var(--line-soft);font-size:13px;">
        <a href="mailto:${esc(e.email)}" style="color:var(--mousse);">${esc(e.email)}</a>
      </div>
    </article>
  `;
}

// ============================================================ Accueil — extraits
async function renderHomeExtracts() {
  const newsEl = $('#home-news');
  const artisansEl = $('#home-artisans');
  if (!newsEl && !artisansEl) return;

  if (newsEl) {
    const data = await loadJSON('data/actualites.json');
    const latest = data.items.slice(0, 3);
    newsEl.innerHTML = latest.map(n => `
      <article class="card">
        <span class="card-meta">${esc(fmtDate(n.date))} · ${esc(n.categorie)}</span>
        <h3 class="card-title">${esc(n.titre)}</h3>
        <p>${esc(n.resume)}</p>
      </article>
    `).join('');
  }

  if (artisansEl) {
    const data = await loadJSON('data/artisans.json');
    const featured = data.artisans.slice(0, 3);
    artisansEl.innerHTML = featured.map(a => `
      <article class="card">
        <div class="card-thumb">${iconForCategory(a.categorie)}</div>
        <span class="card-meta">${esc(a.categorie)}</span>
        <h3 class="card-title">${esc(a.nom)}</h3>
        <p class="muted" style="font-family:var(--serif);font-style:italic;margin-top:-6px;">${esc(a.metier)}</p>
        <p>${esc(a.description.split('. ').slice(0,1).join('. '))}.</p>
      </article>
    `).join('');
  }
}

// ============================================================ Journal generator
async function setupJournal() {
  const form = $('#journal-form');
  if (!form) return;

  const fromInput = $('#journal-from');
  const toInput   = $('#journal-to');
  const output    = $('#journal-output');
  const presets   = $('#journal-presets');

  // Dates par défaut : 30 derniers jours
  const today = new Date();
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  toInput.value   = today.toISOString().slice(0, 10);
  fromInput.value = monthAgo.toISOString().slice(0, 10);

  presets.addEventListener('click', e => {
    const btn = e.target.closest('.preset'); if (!btn) return;
    $$('.preset', presets).forEach(p => p.classList.remove('is-active'));
    btn.classList.add('is-active');
    const days = parseInt(btn.dataset.days, 10);
    const to = new Date();
    const from = new Date(); from.setDate(from.getDate() - days);
    fromInput.value = from.toISOString().slice(0, 10);
    toInput.value = to.toISOString().slice(0, 10);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    output.innerHTML = '<div class="journal-loading">Le rédacteur compose votre journal</div>';

    const payload = {
      from: fromInput.value,
      to:   toInput.value,
      style: $('#journal-style').value,
    };

    try {
      const r = await fetch('http://localhost:9001/gapree/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const data = await r.json();
        renderJournal(output, data, payload);
        return;
      }
      throw new Error('backend unavailable');
    } catch (err) {
      // Fallback local sans LLM
      const data = await loadJSON('data/actualites.json');
      const filtered = data.items.filter(n => n.date >= payload.from && n.date <= payload.to);
      renderJournal(output, { items: filtered, fallback: true }, payload);
    }
  });
}

function renderJournal(output, data, payload) {
  const dateline = `${fmtDateLong(payload.from)}   —   ${fmtDateLong(payload.to)}`;

  let body;
  if (data.markdown) {
    // Markdown contrôlé côté backend → mini renderer
    body = mdToHtml(data.markdown);
  } else if (data.items) {
    if (data.items.length === 0) {
      body = '<p><em>Aucun événement consigné sur cette période. Le village a goûté à un peu de tranquillité — c\'est aussi cela, Gâprée.</em></p>';
    } else {
      const byCat = {};
      data.items.forEach(it => { (byCat[it.categorie] = byCat[it.categorie] || []).push(it); });
      body = Object.entries(byCat).map(([cat, items]) => `
        <h2>${esc(cat)}</h2>
        ${items.map(it => `
          <h3>${esc(it.titre)}</h3>
          <p><strong>${esc(fmtDate(it.date))}.</strong> ${esc(it.resume)}</p>
        `).join('')}
      `).join('');
    }
  }

  const fallbackNote = data.fallback
    ? '<div class="disclaimer" style="margin-top:24px;">Aperçu généré localement sans rédaction IA. Activez le backend Flask (<code>blueprint.py</code>) pour obtenir un journal rédigé par Claude.</div>'
    : '';

  output.innerHTML = `
    <div class="journal-masthead">
      <div class="kicker">Bulletin communal · numéro spécial</div>
      <h1>Le Gâpréen</h1>
      <div class="dateline">
        <span>${esc(dateline)}</span>
        <span>·</span>
        <span>Édition automatique</span>
      </div>
    </div>
    <div class="journal-content">${body}</div>
    ${fallbackNote}
  `;
}

function mdToHtml(md) {
  // Rendu volontairement minimal : on échappe d'abord tout le HTML,
  // puis on réintroduit uniquement les balises sûres construites depuis du markdown contrôlé.
  const safe = esc(md);
  return safe
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .split(/\n\n+/).map(p => p.trim().startsWith('&lt;h') || p.trim().startsWith('<h') ? p : `<p>${p}</p>`).join('\n');
}

// ============================================================ Boot
document.addEventListener('DOMContentLoaded', () => {
  highlightNav();
  renderHomeExtracts();
  renderArtisans();
  renderActualites();
  renderHistoire();
  renderMairie();
  setupJournal();
});
