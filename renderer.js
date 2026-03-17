'use strict';

// ── Chrome UA – required for WhatsApp/Slack to render their full UI ──────────
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

// CSS injected when "Default CSS" is enabled (hides common footer / nav noise)
const DEFAULT_CSS = `
  footer, .footer, [class*="footer"] { display: none !important; }
  .announcement-bar, .top-banner, .cookie-banner { display: none !important; }
`;

// ── Default configuration ─────────────────────────────────────────────────────
const defaultConfig = {
  darkMode: true,
  disabled: false,       // when true, gutter drag is disabled
  columnsOnly: false,    // when true, each column contains exactly one row
  useDefaultCss: false,
  customCss: '',
  columns: [
    {
      visible: true,
      size: 33,
      rows: [
        { name: 'Grafana',   site: 'https://play.grafana.org',  visible: true, size: 50, type: 'webview', isEditable: false, col: 1, row: 1, icon: './assets/grafana.png' },
        { name: 'Slack',     site: 'https://slack.com',         visible: true, size: 50, type: 'webview', isEditable: false, col: 1, row: 2, icon: './assets/slack.png' },
      ],
    },
    {
      visible: true,
      size: 33,
      rows: [
        { name: 'WhatsApp',  site: 'https://web.whatsapp.com',  visible: true, size: 50, type: 'webview', isEditable: false, col: 2, row: 1, icon: './assets/whatsapp.png' },
        { name: 'Telegram',  site: 'https://web.telegram.org',  visible: true, size: 50, type: 'webview', isEditable: false, col: 2, row: 2 },
      ],
    },
    {
      visible: true,
      size: 34,
      rows: [
        { name: 'GitHub',    site: 'https://github.com',        visible: true, size: 50, type: 'webview', isEditable: false, col: 3, row: 1 },
        { name: 'Jira',      site: 'https://jira.atlassian.com',visible: true, size: 50, type: 'webview', isEditable: false, col: 3, row: 2 },
      ],
    },
  ],
};

// ── State ─────────────────────────────────────────────────────────────────────
let config = null;
let splitInstances = [];   // Track Split instances so we can destroy them on re-render

// ── Initialise ────────────────────────────────────────────────────────────────
async function init() {
  const saved = await window.electronAPI.loadConfig();
  config = saved ? saved : deepClone(defaultConfig);

  // Migration: assign col/row and icon fields if missing (older config files)
  const defaultIcons = {
    'grafana':  './assets/grafana.png',
    'slack':    './assets/slack.png',
    'whatsapp': './assets/whatsapp.png',
  };
  config.columns.forEach((col, ci) => {
    col.rows.forEach((row, ri) => {
      if (row.col == null) row.col = ci + 1;
      if (row.row == null) row.row = ri + 1;
      if (row.icon == null) {
        const key = (row.name || '').toLowerCase();
        row.icon = defaultIcons[key] || null;
      }
    });
  });

  // Apply persisted dark-mode preference
  document.body.classList.toggle('dark', config.darkMode !== false);

  renderDashboard();
  renderSidebar();
  renderSettingsPanels();
  syncSettingsUI();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

/** Ensure an array of sizes sums to exactly 100. */
function normalizeSizes(sizes) {
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total === 0) return sizes.map(() => 100 / sizes.length);
  return sizes.map(s => (s / total) * 100);
}

async function saveConfig() {
  await window.electronAPI.saveConfig(config);
}

// ── Dashboard rendering ───────────────────────────────────────────────────────
function renderDashboard() {
  // Tear down old Split instances before clearing DOM
  splitInstances.forEach(s => { try { s.destroy(); } catch (_) {} });
  splitInstances = [];

  const main = document.getElementById('main-content');
  main.innerHTML = '';

  const visibleCols = config.columns.filter(c => c.visible);
  if (visibleCols.length === 0) {
    main.innerHTML =
      '<div id="empty-state"><span>📊</span>' +
      '<p>All panels are hidden.<br>Click a sidebar button to restore one.</p></div>';
    return;
  }

  // ── Build column elements ──────────────────────────────────────────────────
  const colEls = [];

  config.columns.forEach((col, ci) => {
    if (!col.visible) return;

    const colEl = document.createElement('div');
    colEl.className = 'split-col';
    colEl.id = `col-${ci}`;

    const visibleRows = col.rows.filter(r => r.visible);

    if (config.columnsOnly) {
      // Only show first visible row, stretched to fill the column
      const row = visibleRows[0];
      if (row) {
        const el = makePanelEl(ci, col.rows.indexOf(row), row);
        el.style.height = '100%';
        colEl.appendChild(el);
      }
    } else {
      const rowEls = [];

      col.rows.forEach((row, ri) => {
        if (!row.visible) return;
        const rowEl = makePanelEl(ci, ri, row);
        colEl.appendChild(rowEl);
        rowEls.push(rowEl);
      });

      // Ensure rows fill the column when Split.js isn't running
      if (rowEls.length === 1) {
        rowEls[0].style.height = '100%';
      } else if (rowEls.length > 1 && config.disabled) {
        const sizes = normalizeSizes(col.rows.filter(r => r.visible).map(r => r.size));
        rowEls.forEach((el, i) => { el.style.height = sizes[i] + '%'; });
      }

      // Vertical split for rows inside this column
      if (rowEls.length > 1 && !config.disabled) {
        const sizes = normalizeSizes(col.rows.filter(r => r.visible).map(r => r.size));
        try {
          const s = Split(rowEls, {
            direction: 'vertical',
            sizes,
            gutterSize: 4,
            minSize: 40,
            onDragEnd(newSizes) {
              let idx = 0;
              col.rows.forEach(r => { if (r.visible) r.size = newSizes[idx++]; });
              saveConfig();
            },
          });
          splitInstances.push(s);
        } catch (e) { console.warn('Row Split error', e); }
      }
    }

    main.appendChild(colEl);
    colEls.push(colEl);
  });

  // ── Horizontal split for columns ───────────────────────────────────────────
  if (colEls.length === 1) {
    colEls[0].style.width = '100%';
  } else if (colEls.length > 1 && !config.disabled) {
    const sizes = normalizeSizes(config.columns.filter(c => c.visible).map(c => c.size));
    try {
      const s = Split(colEls, {
        direction: 'horizontal',
        sizes,
        gutterSize: 4,
        minSize: 50,
        onDragEnd(newSizes) {
          let idx = 0;
          config.columns.forEach(c => { if (c.visible) c.size = newSizes[idx++]; });
          saveConfig();
        },
      });
      splitInstances.push(s);
    } catch (e) { console.warn('Column Split error', e); }
  }
}

/** Create the DOM element for a single panel (row inside a column). */
function makePanelEl(ci, ri, row) {
  const panel = document.createElement('div');
  panel.className = 'row-panel';
  panel.id = `panel-${ci}-${ri}`;

  // Loading indicator (absolute overlay, hidden once page loads)
  const loading = document.createElement('div');
  loading.className = 'panel-loading';
  loading.innerHTML = `<div class="spinner"></div><span>${escapeHtml(row.name || row.site)}</span>`;

  // Wrapper ensures webview fills the panel via CSS flex
  const wrapper = document.createElement('div');
  wrapper.className = 'webview-wrapper';

  // Webview – always visible so Electron can render the page
  const wv = document.createElement('webview');
  wv.setAttribute('src', row.site);
  wv.setAttribute('useragent', CHROME_UA);
  wv.setAttribute('allowpopups', '');
  wv.setAttribute('autosize', 'on');
  // Persistent partition per panel so sessions (logins, UI state) survive restarts
  const partitionKey = (row.name || row.site).toLowerCase().replace(/[^a-z0-9]/g, '_');
  wv.setAttribute('partition', `persist:${partitionKey}`);

  wv.addEventListener('did-finish-load', () => {
    loading.style.display = 'none';
    injectCssIntoWebview(wv);
  });

  // Right-click → native context menu with DevTools + cache options
  wv.addEventListener('context-menu', () => {
    window.electronAPI.showWebviewContextMenu(wv.getWebContentsId());
  });

  wv.addEventListener('did-fail-load', (_e) => {
    loading.querySelector('span').textContent = `Failed to load: ${row.site}`;
  });


  wrapper.appendChild(wv);
  panel.appendChild(loading);
  panel.appendChild(wrapper);
  return panel;
}

// ── CSS injection ─────────────────────────────────────────────────────────────
function injectCssIntoWebview(wv) {
  let css = '';
  if (config.useDefaultCss) css += DEFAULT_CSS + '\n';
  if (config.customCss) css += config.customCss;
  if (css.trim()) {
    wv.insertCSS(css).catch(e => console.warn('insertCSS failed:', e));
  }
}

function applyCustomCssToAll() {
  document.querySelectorAll('webview').forEach(wv => injectCssIntoWebview(wv));
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  const container = document.getElementById('sidebar-panels');
  container.innerHTML = '';

  config.columns.forEach((col, ci) => {
    col.rows.forEach((row, ri) => {
      const btn = document.createElement('button');
      btn.className = `sidebar-btn ${row.visible ? 'active' : 'inactive'}`;
      btn.title = `${row.name || 'Panel'}\n${row.site}`;
      if (row.icon) {
        btn.innerHTML = `<img src="${row.icon}" alt="${escapeHtml(row.name)}" width="28" height="28" style="object-fit:contain;">`;
      } else {
        btn.textContent = (row.name || row.site).substring(0, 2).toUpperCase();
      }
      btn.addEventListener('click', () => togglePanel(ci, ri));
      container.appendChild(btn);
    });
  });
}

function togglePanel(ci, ri) {
  const row = config.columns[ci].rows[ri];
  row.visible = !row.visible;

  // Hide column when all its rows are hidden
  config.columns[ci].visible = config.columns[ci].rows.some(r => r.visible);

  saveConfig();
  renderDashboard();
  renderSidebar();
  renderSettingsPanels();
}

// ── Settings modal ────────────────────────────────────────────────────────────
function renderSettingsPanels() {
  const container = document.getElementById('settings-panels-list');
  container.innerHTML = '';

  config.columns.forEach((col, ci) => {
    col.rows.forEach((row, ri) => {
      const row_el = document.createElement('div');
      row_el.className = 'settings-panel-row';
      row_el.innerHTML = `
        <label>
          <strong>${escapeHtml(row.name || 'Panel')}</strong>
          <span class="site-url">${escapeHtml(row.site)}</span>
        </label>
        <input type="checkbox" ${row.visible ? 'checked' : ''}>
      `;
      row_el.querySelector('input').addEventListener('change', () => togglePanel(ci, ri));
      container.appendChild(row_el);
    });
  });
}

function syncSettingsUI() {
  document.getElementById('toggle-dark-mode').checked       = config.darkMode !== false;
  document.getElementById('toggle-disable-resize').checked  = config.disabled === true;
  document.getElementById('toggle-columns-only').checked    = config.columnsOnly === true;
  document.getElementById('custom-css-input').value         = config.customCss || '';
  document.getElementById('default-css-state').textContent  = config.useDefaultCss ? 'on' : 'off';
}

// ── Manage URLs modal ─────────────────────────────────────────────────────────
function renderUrlTable() {
  const tbody = document.getElementById('url-table-body');
  tbody.innerHTML = '';

  let n = 0;
  config.columns.forEach((col, ci) => {
    col.rows.forEach((row, ri) => {
      n++;
      const tr = document.createElement('tr');

      if (row.isEditable) {
        tr.innerHTML = `
          <td>${n}</td>
          <td><input type="text" class="edit-name" value="${escapeHtml(row.name)}"></td>
          <td><input type="text" class="edit-url"  value="${escapeHtml(row.site)}"></td>
          <td class="pos-cell">
            <select class="edit-col">
              <option value="1" ${row.col===1?'selected':''}>C1</option>
              <option value="2" ${row.col===2?'selected':''}>C2</option>
              <option value="3" ${row.col===3?'selected':''}>C3</option>
            </select>
            <select class="edit-row">
              <option value="1" ${row.row===1?'selected':''}>R1</option>
              <option value="2" ${row.row===2?'selected':''}>R2</option>
            </select>
          </td>
          <td class="url-actions">
            <button class="btn-sm btn-save">Save</button>
            <button class="btn-sm btn-secondary btn-cancel">Cancel</button>
          </td>`;
        tr.querySelector('.btn-save').addEventListener('click', () => saveRow(ci, ri, tr));
        tr.querySelector('.btn-cancel').addEventListener('click', () => {
          row.isEditable = false;
          renderUrlTable();
        });
      } else {
        tr.innerHTML = `
          <td>${n}</td>
          <td>${escapeHtml(row.name)}</td>
          <td class="url-cell" title="${escapeHtml(row.site)}">${escapeHtml(row.site)}</td>
          <td class="pos-cell"><span class="pos-badge">C${row.col} R${row.row}</span></td>
          <td class="url-actions">
            <button class="btn-sm btn-edit">Edit</button>
            <button class="btn-sm btn-danger btn-delete">Delete</button>
          </td>`;
        tr.querySelector('.btn-edit').addEventListener('click', () => editRow(ci, ri));
        tr.querySelector('.btn-delete').addEventListener('click', () => deleteRow(ci, ri));
      }

      tbody.appendChild(tr);
    });
  });
}

function editRow(ci, ri) {
  config.columns.forEach(col => col.rows.forEach(r => (r.isEditable = false)));
  config.columns[ci].rows[ri].isEditable = true;
  renderUrlTable();
}

function saveRow(ci, ri, tr) {
  const name   = tr.querySelector('.edit-name').value.trim();
  const url    = tr.querySelector('.edit-url').value.trim();
  const newCol = parseInt(tr.querySelector('.edit-col').value);
  const newRow = parseInt(tr.querySelector('.edit-row').value);
  if (!url) return;

  const row = config.columns[ci].rows[ri];
  const posChanged = newCol !== row.col || newRow !== row.row;

  row.name       = name || url;
  row.site       = url;
  row.isEditable = false;

  if (posChanged) {
    movePanel(ci, ri, newCol, newRow);
  }

  saveConfig();
  renderAll();
}

function deleteRow(ci, ri) {
  config.columns[ci].rows.splice(ri, 1);

  // Remove empty columns
  config.columns = config.columns.filter(c => c.rows.length > 0);

  redistributeColumnSizes();
  saveConfig();
  renderAll();
}

function addPanel(name, url, targetCol, targetRow) {
  if (!url.trim()) return;

  // Clamp to allowed grid: max 3 columns, max 2 rows
  targetCol = Math.min(3, Math.max(1, parseInt(targetCol) || 1));
  targetRow = Math.min(2, Math.max(1, parseInt(targetRow) || 1));

  const newPanel = {
    name: name.trim() || url.trim(),
    site: url.trim(),
    visible: true,
    size: 50,
    type: 'webview',
    isEditable: false,
    col: targetCol,
    row: targetRow,
  };

  // Ensure target column exists
  while (config.columns.length < targetCol) {
    config.columns.push({ visible: true, size: 0, rows: [] });
  }

  const destCol = config.columns[targetCol - 1];
  const taken   = destCol.rows.findIndex(r => r.row === targetRow) >= 0;

  if (taken) {
    // Slot occupied — find the next free slot in the 3×2 grid
    const [fc, fr] = findNextAvailableSlot();
    if (fc === null) return; // all 6 slots full
    newPanel.col = fc; newPanel.row = fr;
    while (config.columns.length < fc) {
      config.columns.push({ visible: true, size: 0, rows: [] });
    }
    config.columns[fc - 1].rows.push(newPanel);
    config.columns[fc - 1].rows.sort((a, b) => a.row - b.row);
    config.columns[fc - 1].visible = true;
  } else {
    destCol.rows.push(newPanel);
    destCol.rows.sort((a, b) => a.row - b.row);
    destCol.visible = true;
  }

  redistributeColumnSizes();
  saveConfig();
  renderAll();
}

function redistributeColumnSizes() {
  const visible = config.columns.filter(c => c.visible);
  const n = visible.length;
  if (n === 0) return;
  const eq = 100 / n;
  config.columns.forEach(c => (c.size = c.visible ? eq : 0));
}

/** Find the first empty slot in the 3-column × 2-row grid. */
function findNextAvailableSlot() {
  for (let c = 1; c <= 3; c++) {
    for (let r = 1; r <= 2; r++) {
      const col = config.columns[c - 1];
      if (!col || !col.rows.find(row => row.row === r)) return [c, r];
    }
  }
  return [null, null]; // all 6 slots full
}

/** Move a panel to a new col/row; swaps with the occupant if the slot is taken. */
function movePanel(fromCi, fromRi, toCol, toRow) {
  const toCi = toCol - 1;

  // Ensure destination column exists
  while (config.columns.length <= toCi) {
    config.columns.push({ visible: true, size: 0, rows: [] });
  }

  const panel   = config.columns[fromCi].rows[fromRi];
  const destCol = config.columns[toCi];
  const destIdx = destCol.rows.findIndex(r => r.row === toRow);

  if (destIdx >= 0) {
    // Slot occupied — swap the two panels in place
    const other  = destCol.rows[destIdx];
    const oldCol = panel.col, oldRow = panel.row;
    panel.col = toCol;  panel.row = toRow;
    other.col = oldCol; other.row = oldRow;
    config.columns[fromCi].rows[fromRi] = other;
    destCol.rows[destIdx] = panel;
  } else {
    // Empty slot — move
    config.columns[fromCi].rows.splice(fromRi, 1);
    panel.col = toCol; panel.row = toRow;
    destCol.rows.push(panel);
    destCol.rows.sort((a, b) => a.row - b.row);
    config.columns[fromCi].visible = config.columns[fromCi].rows.length > 0;
    destCol.visible = true;
  }

  redistributeColumnSizes();
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function resetConfig() {
  if (!confirm('Reset to default configuration? All custom panels and settings will be lost.')) return;
  config = deepClone(defaultConfig);
  window.electronAPI.deleteConfig();
  document.body.classList.add('dark');
  renderAll();
  syncSettingsUI();
}

// ── Render everything at once ─────────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderSidebar();
  renderSettingsPanels();
  renderUrlTable();
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ── Bootstrap event listeners ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Sidebar → open modals
  document.getElementById('btn-settings').addEventListener('click', () => openModal('settings-modal'));
  document.getElementById('btn-manage-urls').addEventListener('click', () => {
    renderUrlTable();
    openModal('urls-modal');
  });

  // Close buttons on modals
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // Click backdrop to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
  });

  // Escape key to close topmost open modal
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.modal-overlay.open');
    if (open) closeModal(open.id);
  });

  // ── Settings: dark mode ────────────────────────────────────────────────────
  document.getElementById('toggle-dark-mode').addEventListener('change', e => {
    config.darkMode = e.target.checked;
    document.body.classList.toggle('dark', config.darkMode);
    saveConfig();
  });

  // ── Settings: disable resize ───────────────────────────────────────────────
  document.getElementById('toggle-disable-resize').addEventListener('change', e => {
    config.disabled = e.target.checked;
    saveConfig();
    renderDashboard();
  });

  // ── Settings: columns only ─────────────────────────────────────────────────
  document.getElementById('toggle-columns-only').addEventListener('change', e => {
    config.columnsOnly = e.target.checked;
    saveConfig();
    renderDashboard();
  });

  // ── Settings: apply custom CSS ─────────────────────────────────────────────
  document.getElementById('btn-apply-css').addEventListener('click', () => {
    config.customCss = document.getElementById('custom-css-input').value;
    saveConfig();
    applyCustomCssToAll();
  });

  // ── Settings: toggle default CSS ──────────────────────────────────────────
  document.getElementById('btn-toggle-default-css').addEventListener('click', () => {
    config.useDefaultCss = !config.useDefaultCss;
    document.getElementById('default-css-state').textContent = config.useDefaultCss ? 'on' : 'off';
    saveConfig();
    applyCustomCssToAll();
  });

  // ── Settings: reset ────────────────────────────────────────────────────────
  document.getElementById('btn-reset-config').addEventListener('click', resetConfig);

  // ── Manage Panels: add ─────────────────────────────────────────────────────
  document.getElementById('btn-add-panel').addEventListener('click', () => {
    const name = document.getElementById('new-panel-name').value;
    const url  = document.getElementById('new-panel-url').value;
    const col  = document.getElementById('new-panel-col').value;
    const row  = document.getElementById('new-panel-row').value;
    if (!url.trim()) return;
    addPanel(name, url, col, row);
    document.getElementById('new-panel-name').value = '';
    document.getElementById('new-panel-url').value  = '';
  });

  document.getElementById('new-panel-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-add-panel').click();
  });

  // ── Kick off ───────────────────────────────────────────────────────────────
  init();
});
