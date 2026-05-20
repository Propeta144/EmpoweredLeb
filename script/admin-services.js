/**
 * admin-services.js  (corrected for real DB schema)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from v1:
 *  • Category modal: adds short_description, detail_title, detail_description,
 *    and a dynamic category_features list (feature_text only, no sort_order).
 *  • Service modal: adds service_items with title + description each,
 *    and keeps the schedule (days picker + time label).
 *  • Time slots table is service_time_slots (is_active column respected).
 *  • No schema assumptions beyond what the real DB contains.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ═══════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════ */
const SVC_API = {
  getCategories  : 'src/admin_get_categories.php',
  saveCategory   : 'src/save_category.php',
  deleteCategory : 'src/delete_category.php',
  saveService    : 'src/save_service.php',
  deleteService  : 'src/delete_service.php',

  getTimeSlots   : 'src/get_get_time_slots.php',
  saveTimeSlot   : 'src/save_time_slot.php',
  deleteTimeSlot : 'src/delete_time_slot.php',
};

const ALL_DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const ALL_MODES = ['Walk In','Home Service','Online'];

/* ═══════════════════════════════════════════════════════
   FONT AWESOME ICON PICKER DATA
═══════════════════════════════════════════════════════ */
const FA_ICONS = [
  { cls:'fa-solid fa-desktop',              label:'Desktop'        },
  { cls:'fa-solid fa-laptop',               label:'Laptop'         },
  { cls:'fa-solid fa-mobile-screen',        label:'Mobile'         },
  { cls:'fa-solid fa-tablet-screen-button', label:'Tablet'         },
  { cls:'fa-solid fa-server',               label:'Server'         },
  { cls:'fa-solid fa-database',             label:'Database'       },
  { cls:'fa-solid fa-microchip',            label:'Microchip'      },
  { cls:'fa-solid fa-hard-drive',           label:'Hard Drive'     },
  { cls:'fa-solid fa-memory',               label:'Memory'         },
  { cls:'fa-solid fa-keyboard',             label:'Keyboard'       },
  { cls:'fa-solid fa-computer-mouse',       label:'Mouse'          },
  { cls:'fa-solid fa-print',                label:'Printer'        },
  { cls:'fa-solid fa-wifi',                 label:'Wifi'           },
  { cls:'fa-solid fa-network-wired',        label:'Network'        },
  { cls:'fa-solid fa-plug',                 label:'Plug'           },
  { cls:'fa-solid fa-battery-full',         label:'Battery'        },
  { cls:'fa-solid fa-camera',               label:'Camera'         },
  { cls:'fa-solid fa-tv',                   label:'TV / Monitor'   },
  { cls:'fa-solid fa-headphones',           label:'Headphones'     },
  { cls:'fa-solid fa-screwdriver-wrench',   label:'Tools'          },
  { cls:'fa-solid fa-screwdriver',          label:'Screwdriver'    },
  { cls:'fa-solid fa-wrench',               label:'Wrench'         },
  { cls:'fa-solid fa-stethoscope',          label:'Diagnostics'    },
  { cls:'fa-solid fa-hammer',               label:'Hammer'         },
  { cls:'fa-solid fa-toolbox',              label:'Toolbox'        },
  { cls:'fa-solid fa-gear',                 label:'Gear'           },
  { cls:'fa-solid fa-gears',                label:'Gears'          },
  { cls:'fa-solid fa-bolt',                 label:'Bolt / Power'   },
  { cls:'fa-solid fa-code',                 label:'Code'           },
  { cls:'fa-solid fa-terminal',             label:'Terminal'       },
  { cls:'fa-solid fa-bug',                  label:'Bug'            },
  { cls:'fa-solid fa-shield-halved',        label:'Security'       },
  { cls:'fa-solid fa-lock',                 label:'Lock'           },
  { cls:'fa-solid fa-key',                  label:'Key'            },
  { cls:'fa-solid fa-cloud',                label:'Cloud'          },
  { cls:'fa-solid fa-book-open-reader',     label:'Reading'        },
  { cls:'fa-solid fa-book',                 label:'Book'           },
  { cls:'fa-solid fa-graduation-cap',       label:'Graduation'     },
  { cls:'fa-solid fa-school',               label:'School'         },
  { cls:'fa-solid fa-pencil',               label:'Pencil'         },
  { cls:'fa-solid fa-microscope',           label:'Microscope'     },
  { cls:'fa-solid fa-flask',                label:'Flask'          },
  { cls:'fa-solid fa-calculator',           label:'Calculator'     },
  { cls:'fa-solid fa-chart-line',           label:'Chart'          },
  { cls:'fa-solid fa-lightbulb',            label:'Idea'           },
  { cls:'fa-solid fa-brain',                label:'Brain'          },
  { cls:'fa-solid fa-atom',                 label:'Atom'           },
  { cls:'fa-solid fa-briefcase',            label:'Briefcase'      },
  { cls:'fa-solid fa-handshake',            label:'Handshake'      },
  { cls:'fa-solid fa-house',                label:'Home'           },
  { cls:'fa-solid fa-shop',                 label:'Shop'           },
  { cls:'fa-solid fa-truck',                label:'Delivery'       },
  { cls:'fa-solid fa-headset',              label:'Support'        },
  { cls:'fa-solid fa-comments',             label:'Chat'           },
  { cls:'fa-solid fa-envelope',             label:'Email'          },
  { cls:'fa-solid fa-phone',                label:'Phone'          },
  { cls:'fa-solid fa-video',                label:'Video'          },
  { cls:'fa-solid fa-calendar-check',       label:'Calendar'       },
  { cls:'fa-solid fa-clock',                label:'Clock'          },
  { cls:'fa-solid fa-star',                 label:'Star'           },
  { cls:'fa-solid fa-certificate',          label:'Certificate'    },
  { cls:'fa-solid fa-tag',                  label:'Tag'            },
  { cls:'fa-solid fa-receipt',              label:'Receipt'        },
  { cls:'fa-solid fa-credit-card',          label:'Payment'        },
  { cls:'fa-solid fa-money-bill',           label:'Money'          },
  { cls:'fa-solid fa-users',                label:'Users'          },
  { cls:'fa-solid fa-user-tie',             label:'Professional'   },
  { cls:'fa-solid fa-pen-nib',              label:'Pen Nib'        },
  { cls:'fa-solid fa-magnifying-glass-chart',label:'Research'      },
  { cls:'fa-solid fa-mobile-screen-button', label:'Mobile (btn)'  },
  { cls:'fa-solid fa-computer',             label:'Computer'       },
];

/* ═══════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════ */
let _categories         = [];
let _iconTarget         = null;
let _editingCat         = null;
let _editingSvc         = null;
let _editingCatFeatures = [];   // string[]
let _editingSvcItems    = [];   // { title: string, description: string }[]
let _timeSlots          = [];
let _editingSlot        = null;

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  injectModals();
  wirePageActions();
  loadCategories();
});

/* ═══════════════════════════════════════════════════════
   API HELPERS
═══════════════════════════════════════════════════════ */
async function svcApiFetch(url, body = null) {
  const opts = body
    ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }
    : { method:'GET' };
  const res  = await fetch(url, opts);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Unknown error');
  return data;
}

/* ═══════════════════════════════════════════════════════
   LOAD & RENDER
═══════════════════════════════════════════════════════ */
async function loadCategories() {
  const section = document.getElementById('services');
  if (!section) return;
  const container = getOrCreateContainer(section);
  container.innerHTML = '<div class="svc-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading services…</div>';
  try {
    const { data } = await svcApiFetch(SVC_API.getCategories);
    _categories = data;
    renderAll(container);
  } catch (err) {
    container.innerHTML = `<div class="svc-error"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</div>`;
  }
}

function getOrCreateContainer(section) {
  let el = section.querySelector('#svc-dynamic-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'svc-dynamic-container';
    const header = section.querySelector('.page-header');
    if (header) header.after(el); else section.appendChild(el);
  }
  return el;
}

function renderAll(container) {
  if (!_categories.length) {
    container.innerHTML = `
      <div class="svc-empty">
        <i class="fa-solid fa-folder-open" style="font-size:2rem;color:var(--text-muted);"></i>
        <p style="color:var(--text-muted);margin-top:10px;">No categories yet. Click <strong>Add Category</strong> to get started.</p>
      </div>`;
    return;
  }
  container.innerHTML = _categories.map(renderCategoryCard).join('');
  bindCategoryEvents(container);
}

/* ── Category Card ───────────────────────────────────── */
function renderCategoryCard(cat) {
  const svcCount   = cat.services.length;
  const modeLabels = [...new Set(cat.services.flatMap(s => (s.modes||[]).map(m => m.mode_name)))].join(' · ');
  const featCount  = (cat.features||[]).length;

  const detailPreview = (cat.detail_title || cat.detail_description) ? `
    <div class="sc-cat-detail-preview">
      ${cat.detail_title       ? `<span class="sc-detail-title">${svcEscHtml(cat.detail_title)}</span>` : ''}
      ${cat.detail_description ? `<span class="sc-detail-desc">${svcEscHtml(cat.detail_description.substring(0,130))}${cat.detail_description.length>130?'…':''}</span>` : ''}
    </div>` : '';

  return `
  <div class="service-cat-card" data-cat-id="${cat.category_id}">
    <div class="sc-cat-head">
      <div style="display:flex;align-items:center;">
        <div class="sc-cat-icon"><i class="${svcEscHtml(cat.icon_class||'fa-solid fa-folder')}"></i></div>
        <div style="margin-left:14px;">
          <div class="sc-cat-title">${svcEscHtml(cat.category_name)}</div>
          <div class="sc-cat-sub">
            ${svcCount} service${svcCount!==1?'s':''}
            · ${modeLabels||'No modes set'}
            ${featCount ? `· ${featCount} feature${featCount!==1?'s':''}` : ''}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn btn-ghost btn-xs cat-edit-btn" data-cat-id="${cat.category_id}">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
        <button class="btn btn-ghost btn-xs cat-delete-btn" data-cat-id="${cat.category_id}" style="color:var(--danger);">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
    ${detailPreview}
    <div class="sc-services-list">
      ${cat.services.length
        ? cat.services.map(svc => renderServiceRow(svc, cat.category_id)).join('')
        : `<div style="padding:14px;color:var(--text-muted);font-size:13px;">No services yet.</div>`}
    </div>
    <div style="padding:10px 16px;border-top:1px dashed var(--border);"></div>
  </div>`;
}

/* ── Service Row ─────────────────────────────────────── */
function renderServiceRow(svc, categoryId) {
  const modes = (svc.modes||[]).map(m => {
    const cls = m.mode_name==='Walk In' ? 'pip-walkin' : m.mode_name==='Online' ? 'pip-online' : 'pip-home';
    return `<span class="mode-pip ${cls}">${svcEscHtml(m.mode_name)}</span>`;
  }).join('');

  const itemCount = (svc.items||[]).length;

  return `
  <div class="sc-service-row" data-svc-id="${svc.service_id}">
    <div class="sc-svc-icon"><i class="${svcEscHtml(svc.icon_class||'fa-solid fa-circle-dot')}"></i></div>
    <div class="sc-svc-info">
      <div class="sc-svc-name">${svcEscHtml(svc.service_name)}</div>
      <div class="sc-svc-meta">
        ${svc.price_range   ? svcEscHtml(svc.price_range)+' · ' : ''}
        ${svc.duration_text ? svcEscHtml(svc.duration_text)      : ''}
        ${itemCount ? `<span style="margin-left:4px;color:var(--text-muted);">· ${itemCount} item${itemCount!==1?'s':''}</span>` : ''}
      </div>
      <div class="sc-svc-modes">${modes}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
      <button class="btn btn-ghost btn-xs svc-edit-btn" data-svc-id="${svc.service_id}" data-cat-id="${categoryId}">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button class="btn btn-ghost btn-xs svc-delete-btn" data-svc-id="${svc.service_id}" style="color:var(--danger);">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════
   EVENT WIRING
═══════════════════════════════════════════════════════ */
function wirePageActions() {
  const section = document.getElementById('services');
  if (!section) return;
  const btns = section.querySelectorAll('.page-actions .btn');
  if (btns[0]) btns[0].addEventListener('click', () => openCategoryModal(null));
  if (btns[1]) btns[1].addEventListener('click', () => openServiceModal(null, null));
  const slotBtn = document.getElementById('manage-slots-btn');
  if (slotBtn) slotBtn.addEventListener('click', openTimeSlotsModal);
}

function bindCategoryEvents(container) {
  container.querySelectorAll('.cat-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = _categories.find(c => c.category_id == btn.dataset.catId);
      if (cat) openCategoryModal(cat);
    });
  });
  container.querySelectorAll('.cat-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteCategory(parseInt(btn.dataset.catId)));
  });
  container.querySelectorAll('.svc-add-btn').forEach(btn => {
    btn.addEventListener('click', () => openServiceModal(null, parseInt(btn.dataset.catId)));
  });
  container.querySelectorAll('.svc-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const svc = svcFindService(parseInt(btn.dataset.svcId));
      if (svc) openServiceModal(svc, parseInt(btn.dataset.catId));
    });
  });
  container.querySelectorAll('.svc-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteService(parseInt(btn.dataset.svcId)));
  });
}

function svcFindService(serviceId) {
  for (const cat of _categories) {
    const svc = cat.services.find(s => s.service_id == serviceId);
    if (svc) return svc;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════
   DELETE HANDLERS
═══════════════════════════════════════════════════════ */
async function handleDeleteCategory(categoryId) {
  const cat = _categories.find(c => c.category_id == categoryId);
  if (!svcConfirmDelete(`Delete category "${cat?.category_name}"? This will also delete all its services.`)) return;
  try {
    await svcApiFetch(SVC_API.deleteCategory, { category_id: categoryId });
    _categories = _categories.filter(c => c.category_id != categoryId);
    svcShowToast('Category deleted.', 'success');
    rerenderAll();
  } catch (err) { svcShowToast(err.message, 'error'); }
}

async function handleDeleteService(serviceId) {
  const svc = svcFindService(serviceId);
  if (!svcConfirmDelete(`Delete service "${svc?.service_name}"?`)) return;
  try {
    await svcApiFetch(SVC_API.deleteService, { service_id: serviceId });
    for (const cat of _categories) {
      cat.services = cat.services.filter(s => s.service_id != serviceId);
    }
    svcShowToast('Service deleted.', 'success');
    rerenderAll();
  } catch (err) { svcShowToast(err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════
   RE-RENDER
═══════════════════════════════════════════════════════ */
function rerenderAll() {
  const container = document.getElementById('svc-dynamic-container');
  if (container) renderAll(container);
}

function rerenderCard(categoryId) {
  const card = document.querySelector(`.service-cat-card[data-cat-id="${categoryId}"]`);
  const cat  = _categories.find(c => c.category_id == categoryId);
  if (!card || !cat) { rerenderAll(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = renderCategoryCard(cat);
  card.replaceWith(tmp.firstElementChild);
  bindCategoryEvents(document.getElementById('svc-dynamic-container'));
}

/* ═══════════════════════════════════════════════════════
   CATEGORY MODAL
═══════════════════════════════════════════════════════ */
function openCategoryModal(cat) {
  _editingCat         = cat;
  _editingCatFeatures = (cat?.features || []).map(f => f.feature_text ?? f);

  const modal = document.getElementById('svc-modal-category');
  if (!modal) return;

  document.getElementById('cat-modal-title').textContent       = cat ? 'Edit Category' : 'Add Category';
  document.getElementById('cat-name').value                    = cat?.category_name       || '';
  document.getElementById('cat-description').value             = cat?.description          || '';
  document.getElementById('cat-short-description').value       = cat?.short_description    || '';
  document.getElementById('cat-detail-title').value            = cat?.detail_title         || '';
  document.getElementById('cat-detail-description').value      = cat?.detail_description   || '';
  document.getElementById('cat-icon-class').value              = cat?.icon_class           || '';
  document.getElementById('cat-feature-input').value           = '';

  svcUpdateIconPreview('cat-icon-preview', 'cat-icon-class');
  renderCatFeaturesList();
  svcShowModal('svc-modal-category');
}

function renderCatFeaturesList() {
  const el = document.getElementById('cat-features-list');
  if (!el) return;
  if (!_editingCatFeatures.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:6px 0;">No features added yet.</div>`;
    return;
  }
  el.innerHTML = _editingCatFeatures.map((f, i) => `
    <div class="svc-tag-item">
      <span><i class="fa-solid fa-check" style="color:var(--primary);margin-right:7px;font-size:11px;"></i>${svcEscHtml(f)}</span>
      <button type="button" class="svc-tag-remove" data-idx="${i}" title="Remove">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`).join('');
  el.querySelectorAll('.svc-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      _editingCatFeatures.splice(parseInt(btn.dataset.idx), 1);
      renderCatFeaturesList();
    });
  });
}

function addCatFeature() {
  const input = document.getElementById('cat-feature-input');
  const text  = input.value.trim();
  if (!text) return;
  _editingCatFeatures.push(text);
  input.value = '';
  input.focus();
  renderCatFeaturesList();
}

async function submitCategoryForm() {
  const name = document.getElementById('cat-name').value.trim();
  if (!name) { svcShowToast('Category name is required.', 'error'); return; }

  const payload = {
    category_id        : _editingCat?.category_id ?? null,
    category_name      : name,
    description        : document.getElementById('cat-description').value.trim(),
    short_description  : document.getElementById('cat-short-description').value.trim(),
    detail_title       : document.getElementById('cat-detail-title').value.trim(),
    detail_description : document.getElementById('cat-detail-description').value.trim(),
    icon_class         : document.getElementById('cat-icon-class').value.trim(),
    features           : [..._editingCatFeatures],
  };

  svcSetSavingState('cat-save-btn', true);
  try {
    const res = await svcApiFetch(SVC_API.saveCategory, payload);
    if (!_editingCat) {
      _categories.push({
        category_id        : res.category_id,
        category_name      : payload.category_name,
        description        : payload.description,
        short_description  : payload.short_description,
        detail_title       : payload.detail_title,
        detail_description : payload.detail_description,
        icon_class         : payload.icon_class,
        is_active          : 1,
        features           : payload.features.map((f, i) => ({ feature_id: i, feature_text: f })),
        services           : []
      });
    } else {
      Object.assign(_editingCat, {
        category_name      : payload.category_name,
        description        : payload.description,
        short_description  : payload.short_description,
        detail_title       : payload.detail_title,
        detail_description : payload.detail_description,
        icon_class         : payload.icon_class,
        features           : payload.features.map((f, i) => ({ feature_id: i, feature_text: f })),
      });
    }
    svcShowToast(res.message, 'success');
    svcCloseModal('svc-modal-category');
    rerenderAll();
  } catch (err) {
    svcShowToast(err.message, 'error');
  } finally {
    svcSetSavingState('cat-save-btn', false);
  }
}

/* ═══════════════════════════════════════════════════════
   SERVICE MODAL
═══════════════════════════════════════════════════════ */
function openServiceModal(svc, defaultCatId) {
  _editingSvc      = svc;
  _editingSvcItems = (svc?.items || []).map(it => ({
    title       : it.title       || '',
    description : it.description || ''
  }));

  const modal = document.getElementById('svc-modal-service');
  if (!modal) return;

  document.getElementById('svc-modal-title').textContent = svc ? 'Edit Service' : 'Add Service';

  // Category dropdown
  const sel = document.getElementById('svc-category');
  sel.innerHTML = _categories.map(c =>
    `<option value="${c.category_id}" ${(svc?.category_id || defaultCatId) == c.category_id ? 'selected' : ''}>
      ${svcEscHtml(c.category_name)}
    </option>`
  ).join('');

  // Basic fields
  document.getElementById('svc-name').value          = svc?.service_name  || '';
  document.getElementById('svc-description').value   = svc?.description   || '';
  document.getElementById('svc-icon-class').value    = svc?.icon_class    || '';
  document.getElementById('svc-price-range').value   = svc?.price_range   || '';
  document.getElementById('svc-duration').value      = svc?.duration_text || '';
  document.getElementById('svc-item-title').value    = '';
  document.getElementById('svc-item-desc').value     = '';

  svcUpdateIconPreview('svc-icon-preview', 'svc-icon-class');

  // Delivery modes
  const activeModes = (svc?.modes || []).map(m => m.mode_name);
  modal.querySelectorAll('.mode-checkbox').forEach(cb => {
    cb.checked = activeModes.includes(cb.value);
  });

  // Items list
  renderSvcItemsList();
  svcShowModal('svc-modal-service');
}

/* ── Service items list ──────────────────────────────── */
function renderSvcItemsList() {
  const el = document.getElementById('svc-items-list');
  if (!el) return;
  if (!_editingSvcItems.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:6px 0;">No items added yet.</div>`;
    return;
  }
  el.innerHTML = _editingSvcItems.map((item, i) => `
    <div class="svc-item-card">
      <div class="svc-item-card-body">
        <div class="svc-item-title">${svcEscHtml(item.title)}</div>
        ${item.description ? `<div class="svc-item-desc">${svcEscHtml(item.description)}</div>` : ''}
      </div>
      <button type="button" class="svc-tag-remove svc-item-remove" data-idx="${i}" title="Remove item">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`).join('');
  el.querySelectorAll('.svc-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      _editingSvcItems.splice(parseInt(btn.dataset.idx), 1);
      renderSvcItemsList();
    });
  });
}

function addSvcItem() {
  const titleEl = document.getElementById('svc-item-title');
  const descEl  = document.getElementById('svc-item-desc');
  const title   = titleEl.value.trim();
  if (!title) { titleEl.focus(); return; }
  _editingSvcItems.push({ title, description: descEl.value.trim() });
  titleEl.value = '';
  descEl.value  = '';
  titleEl.focus();
  renderSvcItemsList();
}

async function submitServiceForm() {
  const name = document.getElementById('svc-name').value.trim();
  if (!name) { svcShowToast('Service name is required.', 'error'); return; }
  const catId = parseInt(document.getElementById('svc-category').value);
  if (!catId)  { svcShowToast('Please select a category.', 'error'); return; }

  const modes     = [...document.querySelectorAll('.mode-checkbox:checked')].map(cb => cb.value);

  const payload = {
    service_id    : _editingSvc?.service_id ?? null,
    category_id   : catId,
    service_name  : name,
    description   : document.getElementById('svc-description').value.trim(),
    icon_class    : document.getElementById('svc-icon-class').value.trim(),
    price_range   : document.getElementById('svc-price-range').value.trim(),
    duration_text : document.getElementById('svc-duration').value.trim(),
    modes,
    items         : _editingSvcItems.map(it => ({ title: it.title, description: it.description || '' })),
  };

  svcSetSavingState('svc-save-btn', true);
  try {
    const res = await svcApiFetch(SVC_API.saveService, payload);
    const itemObjs   = payload.items.map((it, i) => ({ item_id: i, title: it.title, description: it.description }));

    if (!_editingSvc) {
      const cat = _categories.find(c => c.category_id == catId);
      if (cat) cat.services.push({
        service_id          : res.service_id,
        category_id         : catId,
        service_name        : payload.service_name,
        description         : payload.description,
        icon_class          : payload.icon_class,
        price_range         : payload.price_range,
        duration_text       : payload.duration_text,
        availability_status : 'available',
        modes               : modes.map(m => ({ mode_name: m })),
        items               : itemObjs,
      });
    } else {
      if (_editingSvc.category_id !== catId) {
        const oldCat = _categories.find(c => c.services.some(s => s.service_id == _editingSvc.service_id));
        const newCat = _categories.find(c => c.category_id == catId);
        if (oldCat && newCat) {
          oldCat.services = oldCat.services.filter(s => s.service_id != _editingSvc.service_id);
          _editingSvc.category_id = catId;
          newCat.services.push(_editingSvc);
        }
      }
      Object.assign(_editingSvc, {
        category_id   : catId,
        service_name  : payload.service_name,
        description   : payload.description,
        icon_class    : payload.icon_class,
        price_range   : payload.price_range,
        duration_text : payload.duration_text,
        modes         : modes.map(m => ({ mode_name: m })),
        items         : itemObjs,
      });
    }

    svcShowToast(res.message, 'success');
    svcCloseModal('svc-modal-service');
    rerenderAll();
  } catch (err) {
    svcShowToast(err.message, 'error');
  } finally {
    svcSetSavingState('svc-save-btn', false);
  }
}

/* ═══════════════════════════════════════════════════════
   TIME SLOTS MODAL  (uses service_time_slots table)
═══════════════════════════════════════════════════════ */
async function openTimeSlotsModal() {
  svcShowModal('svc-modal-slots');
  const list = document.getElementById('slot-list');
  list.innerHTML = `<div class="svc-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading…</div>`;
  try {
    const res  = await svcApiFetch(SVC_API.getTimeSlots);
    _timeSlots = res.data || [];
    renderTimeSlotList();
  } catch (err) {
    list.innerHTML = `<div class="svc-error"><i class="fa-solid fa-triangle-exclamation"></i> ${svcEscHtml(err.message)}</div>`;
  }
}

function renderTimeSlotList() {
  const list = document.getElementById('slot-list');
  if (!_timeSlots.length) {
    list.innerHTML = `<div class="svc-empty">No time slots yet.</div>`;
    return;
  }
  list.innerHTML = _timeSlots.map(slot => `
    <div class="slot-row">
      <div class="slot-label"><i class="fa-regular fa-clock"></i> ${svcEscHtml(slot.slot_label)}</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-xs slot-edit-btn" data-slot-id="${slot.slot_id}">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-ghost btn-xs slot-delete-btn" data-slot-id="${slot.slot_id}" style="color:var(--danger);">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`).join('');
  list.querySelectorAll('.slot-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = _timeSlots.find(s => s.slot_id == btn.dataset.slotId);
      openTimeSlotEditor(slot);
    });
  });
  list.querySelectorAll('.slot-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteTimeSlot(parseInt(btn.dataset.slotId)));
  });
}

function openTimeSlotEditor(slot = null) {
  _editingSlot = slot;
  document.getElementById('slot-modal-title').textContent = slot ? 'Edit Time Slot' : 'Add Time Slot';
  document.getElementById('slot-label-input').value       = slot?.slot_label || '';
  svcShowModal('svc-modal-slot-editor');
}

async function submitTimeSlotForm() {
  const label = document.getElementById('slot-label-input').value.trim();
  if (!label) { svcShowToast('Time slot label is required.', 'error'); return; }
  try {
    const res = await svcApiFetch(SVC_API.saveTimeSlot, {
      slot_id: _editingSlot?.slot_id ?? null, slot_label: label
    });
    if (_editingSlot) {
      _editingSlot.slot_label = label;
    } else {
      _timeSlots.push({ slot_id: res.slot_id, slot_label: label });
    }
    renderTimeSlotList();
    svcCloseModal('svc-modal-slot-editor');
    svcShowToast(res.message, 'success');
  } catch (err) { svcShowToast(err.message, 'error'); }
}

async function handleDeleteTimeSlot(slotId) {
  if (!confirm('Delete this time slot?')) return;
  try {
    await svcApiFetch(SVC_API.deleteTimeSlot, { slot_id: slotId });
    _timeSlots = _timeSlots.filter(s => s.slot_id != slotId);
    renderTimeSlotList();
    svcShowToast('Time slot deleted.', 'success');
  } catch (err) { svcShowToast(err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════
   ICON PICKER
═══════════════════════════════════════════════════════ */
function openIconPicker(targetFieldId, previewId) {
  _iconTarget = { fieldId: targetFieldId, previewId };
  const modal = document.getElementById('svc-modal-icon-picker');
  if (!modal) return;
  const search = document.getElementById('icon-search');
  search.value = '';
  const fresh  = search.cloneNode(true);
  search.parentNode.replaceChild(fresh, search);
  fresh.addEventListener('input', e => renderIconGrid(e.target.value));
  renderIconGrid('');
  svcShowModal('svc-modal-icon-picker');
}

function renderIconGrid(query) {
  const q    = query.toLowerCase().trim();
  const list = q ? FA_ICONS.filter(i => i.label.toLowerCase().includes(q) || i.cls.includes(q)) : FA_ICONS;
  const grid = document.getElementById('icon-picker-grid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px;">No icons found.</div>`;
    return;
  }
  grid.innerHTML = list.map(icon => `
    <div class="icon-picker-item" title="${svcEscHtml(icon.label)}" data-cls="${svcEscHtml(icon.cls)}">
      <i class="${icon.cls}"></i>
      <span>${svcEscHtml(icon.label)}</span>
    </div>`).join('');
  grid.querySelectorAll('.icon-picker-item').forEach(item => {
    item.addEventListener('click', () => {
      if (_iconTarget) {
        const field = document.getElementById(_iconTarget.fieldId);
        if (field) field.value = item.dataset.cls;
        svcUpdateIconPreview(_iconTarget.previewId, _iconTarget.fieldId);
      }
      svcCloseModal('svc-modal-icon-picker');
    });
  });
}

function svcUpdateIconPreview(previewId, fieldId) {
  const el  = document.getElementById(previewId);
  const cls = document.getElementById(fieldId)?.value.trim();
  if (el) el.className = cls || 'fa-solid fa-circle-dashed';
}

/* ═══════════════════════════════════════════════════════
   MODAL INFRASTRUCTURE
═══════════════════════════════════════════════════════ */
const SVC_MODAL_IDS = [
  'svc-modal-category',
  'svc-modal-service',
  'svc-modal-icon-picker',
  'svc-modal-slots',
  'svc-modal-slot-editor'
];

function svcShowModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
  const ov = document.getElementById('svc-modal-overlay');
  if (ov) ov.style.display = 'block';
}

function svcCloseModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
  const anyOpen = SVC_MODAL_IDS.some(mid => {
    const m = document.getElementById(mid);
    return m && m.style.display !== 'none';
  });
  if (!anyOpen) {
    const ov = document.getElementById('svc-modal-overlay');
    if (ov) ov.style.display = 'none';
  }
}

function injectModals() {
  if (document.getElementById('svc-modal-overlay')) return;
  const container = document.createElement('div');
  container.id = 'svc-modals-root';
  container.innerHTML = `

  <!-- Overlay -->
  <div id="svc-modal-overlay" style="
    display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);
    z-index:1000;backdrop-filter:blur(2px);"></div>

  <!-- ══════════════════════════════
       CATEGORY MODAL
  ══════════════════════════════ -->
  <div id="svc-modal-category" class="svc-modal svc-modal-wide" style="display:none;">
    <div class="svc-modal-header">
      <span id="cat-modal-title" class="svc-modal-title">Add Category</span>
      <button class="svc-modal-close" type="button"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="svc-modal-body">

      <div class="svc-form-group">
        <label class="svc-label">Category Name <span class="req">*</span></label>
        <input id="cat-name" class="svc-input" type="text" placeholder="e.g. Computer Systems Maintenance">
      </div>

      <div class="svc-form-group">
        <label class="svc-label">Short Description
          <span style="font-weight:400;"> — one-liner shown on listing cards</span></label>
        <input id="cat-short-description" class="svc-input" type="text" placeholder="e.g. Diagnostics, repair, and software support">
      </div>

      <div class="svc-form-group">
        <label class="svc-label">Full Description</label>
        <textarea id="cat-description" class="svc-input svc-textarea" placeholder="Longer description of this category…"></textarea>
      </div>

      <div class="svc-form-group">
        <label class="svc-label">Detail Page Title
          <span style="font-weight:400;"> — heading on the category detail page</span></label>
        <input id="cat-detail-title" class="svc-input" type="text" placeholder="e.g. Full-Spectrum PC & Hardware Support">
      </div>

      <div class="svc-form-group">
        <label class="svc-label">Detail Page Description</label>
        <textarea id="cat-detail-description" class="svc-input svc-textarea" placeholder="Paragraph shown beneath the detail page heading…"></textarea>
      </div>

      <div class="svc-form-group">
        <label class="svc-label">Icon</label>
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="sc-cat-icon"><i id="cat-icon-preview" class="fa-solid fa-folder"></i></div>
          <input id="cat-icon-class" class="svc-input" type="text" placeholder="fa-solid fa-desktop" style="flex:1;">
          <button class="btn btn-ghost btn-sm" type="button" id="cat-icon-pick-btn">
            <i class="fa-solid fa-grid-2"></i> Pick
          </button>
        </div>
      </div>

      <!-- Features -->
      <div class="svc-form-group">
        <label class="svc-label">Category Features
          <span style="font-weight:400;"> — bullet points shown on detail page</span></label>
        <div class="svc-tag-add-row">
          <input id="cat-feature-input" class="svc-input" type="text"
                 placeholder="e.g. Hardware Diagnostics & Repair" style="flex:1;">
          <button class="btn btn-ghost btn-sm" type="button" id="cat-feature-add-btn">
            <i class="fa-solid fa-plus"></i> Add
          </button>
        </div>
        <div id="cat-features-list" class="svc-tag-list"></div>
      </div>

    </div>
    <div class="svc-modal-footer">
      <button class="btn btn-ghost btn-sm" type="button" id="cat-cancel-btn">Cancel</button>
      <button id="cat-save-btn" class="btn btn-primary btn-sm" type="button">
        <i class="fa-solid fa-floppy-disk"></i> Save Category
      </button>
    </div>
  </div>

  <!-- ══════════════════════════════
       SERVICE MODAL
  ══════════════════════════════ -->
  <div id="svc-modal-service" class="svc-modal svc-modal-wide" style="display:none;">
    <div class="svc-modal-header">
      <span id="svc-modal-title" class="svc-modal-title">Add Service</span>
      <button class="svc-modal-close" type="button"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="svc-modal-body">

      <div class="svc-form-group">
        <label class="svc-label">Category <span class="req">*</span></label>
        <select id="svc-category" class="svc-input"></select>
      </div>

      <div class="svc-form-group">
        <label class="svc-label">Service Name <span class="req">*</span></label>
        <input id="svc-name" class="svc-input" type="text" placeholder="e.g. PC Troubleshooting & Diagnostics">
      </div>

      <div class="svc-form-group">
        <label class="svc-label">Description</label>
        <textarea id="svc-description" class="svc-input svc-textarea" placeholder="What does this service cover?"></textarea>
      </div>

      <div class="svc-form-grid2">
        <div class="svc-form-group">
          <label class="svc-label">Price Range</label>
          <input id="svc-price-range" class="svc-input" type="text" placeholder="e.g. ₱300 – ₱800">
        </div>
        <div class="svc-form-group">
          <label class="svc-label">Duration</label>
          <input id="svc-duration" class="svc-input" type="text" placeholder="e.g. 1–2 hours">
        </div>
      </div>

      <div class="svc-form-group">
        <label class="svc-label">Icon</label>
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="sc-svc-icon"><i id="svc-icon-preview" class="fa-solid fa-circle-dot"></i></div>
          <input id="svc-icon-class" class="svc-input" type="text" placeholder="fa-solid fa-stethoscope" style="flex:1;">
          <button class="btn btn-ghost btn-sm" type="button" id="svc-icon-pick-btn">
            <i class="fa-solid fa-grid-2"></i> Pick
          </button>
        </div>
      </div>

      <div class="svc-form-group">
        <label class="svc-label">Delivery Modes</label>
        <div class="mode-chips">
          <label class="mode-chip">
            <input type="checkbox" class="mode-checkbox" value="Walk In">
            <i class="fa-solid fa-shop"></i> Walk In
          </label>
          <label class="mode-chip">
            <input type="checkbox" class="mode-checkbox" value="Home Service">
            <i class="fa-solid fa-house"></i> Home Service
          </label>
          <label class="mode-chip">
            <input type="checkbox" class="mode-checkbox" value="Online">
            <i class="fa-solid fa-video"></i> Online
          </label>
        </div>
      </div>

      <!-- Service Items -->
      <div class="svc-form-group">
        <label class="svc-label">Service Items
          <span style="font-weight:400;"> — specific things included in this service</span></label>
        <div class="svc-item-add-block">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
            <input id="svc-item-title" class="svc-input" type="text"
                   placeholder="Item title (required)" style="flex:2;">
            <input id="svc-item-desc" class="svc-input" type="text"
                   placeholder="Short description (optional)" style="flex:3;">
            <button class="btn btn-ghost btn-sm" type="button" id="svc-item-add-btn">
              <i class="fa-solid fa-plus"></i> Add
            </button>
          </div>
        </div>
        <div id="svc-items-list" class="svc-tag-list"></div>
      </div>

    </div>
    <div class="svc-modal-footer">
      <button class="btn btn-ghost btn-sm" type="button" id="svc-cancel-btn">Cancel</button>
      <button id="svc-save-btn" class="btn btn-primary btn-sm" type="button">
        <i class="fa-solid fa-floppy-disk"></i> Save Service
      </button>
    </div>
  </div>

  <!-- ══════════════════════════════
       ICON PICKER MODAL
  ══════════════════════════════ -->
  <div id="svc-modal-icon-picker" class="svc-modal svc-modal-wide" style="display:none;">
    <div class="svc-modal-header">
      <span class="svc-modal-title"><i class="fa-solid fa-icons"></i> Choose an Icon</span>
      <button class="svc-modal-close" type="button"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="svc-modal-body">
      <input id="icon-search" class="svc-input" type="text" placeholder="Search icons… (e.g. laptop, code, book)">
      <div id="icon-picker-grid" class="icon-picker-grid"></div>
    </div>
  </div>

  <!-- ══════════════════════════════
       TIME SLOTS MODAL
  ══════════════════════════════ -->
  <div id="svc-modal-slots" class="svc-modal svc-modal-wide" style="display:none;">
    <div class="svc-modal-header">
      <span class="svc-modal-title"><i class="fa-solid fa-clock"></i> Manage Time Slots</span>
      <button class="svc-modal-close" type="button"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="svc-modal-body">
      <div style="margin-bottom:16px;">
        <button class="btn btn-primary btn-sm" id="add-slot-btn">
          <i class="fa-solid fa-plus"></i> Add Time Slot
        </button>
      </div>
      <div id="slot-list"></div>
    </div>
  </div>

  <!-- ══════════════════════════════
       SLOT EDITOR MODAL
  ══════════════════════════════ -->
  <div id="svc-modal-slot-editor" class="svc-modal" style="display:none;">
    <div class="svc-modal-header">
      <span class="svc-modal-title" id="slot-modal-title">Add Time Slot</span>
      <button class="svc-modal-close" type="button"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="svc-modal-body">
      <div class="svc-form-group">
        <label class="svc-label">Time Slot Label</label>
        <input type="text" id="slot-label-input" class="svc-input" placeholder="e.g. 9:00 AM">
      </div>
    </div>
    <div class="svc-modal-footer">
      <button class="btn btn-ghost btn-sm" onclick="svcCloseModal('svc-modal-slot-editor')">Cancel</button>
      <button class="btn btn-primary btn-sm" id="slot-save-btn">
        <i class="fa-solid fa-floppy-disk"></i> Save
      </button>
    </div>
  </div>

  <!-- Toast container -->
  <div id="svc-toast-container"></div>

  <style>
    /* ── Modal base ──────────────────────────────────── */
    .svc-modal {
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      z-index:1001;width:min(520px,94vw);max-height:90vh;
      display:flex;flex-direction:column;
      background:var(--surface);border-radius:var(--radius-lg);
      border:1.5px solid var(--border);
      box-shadow:0 20px 60px rgba(0,0,0,.18);overflow:hidden;
    }
    .svc-modal-wide { width:min(700px,96vw); }
    .svc-modal-header {
      display:flex;align-items:center;justify-content:space-between;
      padding:18px 22px;border-bottom:1px solid var(--border);
      background:linear-gradient(135deg,#f8fafc,#eef1fd);flex-shrink:0;
    }
    .svc-modal-title  { font-size:15px;font-weight:800; }
    .svc-modal-close  {
      background:none;border:none;cursor:pointer;font-size:16px;
      color:var(--text-muted);padding:4px 6px;border-radius:6px;line-height:1;
    }
    .svc-modal-close:hover { background:var(--border);color:var(--text); }
    .svc-modal-body   { padding:22px;overflow-y:auto;flex:1; }
    .svc-modal-footer {
      padding:14px 22px;border-top:1px solid var(--border);
      display:flex;justify-content:flex-end;gap:10px;
      background:var(--bg);flex-shrink:0;
    }

    /* ── Form elements ───────────────────────────────── */
    .svc-form-group   { margin-bottom:16px; }
    .svc-form-group:last-child { margin-bottom:0; }
    .svc-label        { display:block;font-size:12px;font-weight:700;margin-bottom:6px;color:var(--text-muted); }
    .svc-label .req   { color:var(--danger); }
    .svc-input        {
      width:100%;padding:9px 12px;border:1.5px solid var(--border);
      border-radius:var(--radius);font-size:13px;background:var(--bg);
      color:var(--text);outline:none;transition:border .2s;
      box-sizing:border-box;font-family:inherit;
    }
    .svc-input:focus  { border-color:var(--primary); }
    .svc-textarea     { resize:vertical;min-height:70px; }
    select.svc-input  { cursor:pointer; }
    .svc-form-grid2   { display:grid;grid-template-columns:1fr 1fr;gap:14px; }

    /* ── Tag / feature lists ─────────────────────────── */
    .svc-tag-add-row  { display:flex;gap:8px;align-items:center;margin-bottom:8px; }
    .svc-tag-list     { display:flex;flex-direction:column;gap:6px; }
    .svc-tag-item {
      display:flex;align-items:center;justify-content:space-between;
      padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;
      background:var(--bg);font-size:13px;
    }
    .svc-tag-remove {
      background:none;border:none;cursor:pointer;color:var(--text-muted);
      padding:2px 5px;border-radius:4px;line-height:1;flex-shrink:0;
    }
    .svc-tag-remove:hover { background:#fee2e2;color:var(--danger); }

    /* ── Service item cards ──────────────────────────── */
    .svc-item-card {
      display:flex;align-items:flex-start;justify-content:space-between;gap:10px;
      padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;
      background:var(--bg);margin-bottom:6px;
    }
    .svc-item-card-body { flex:1; }
    .svc-item-title  { font-size:13px;font-weight:700;color:var(--text); }
    .svc-item-desc   { font-size:12px;color:var(--text-muted);margin-top:2px; }
    .svc-item-remove { margin-top:1px; }

    /* ── Category detail preview (in card) ──────────── */
    .sc-cat-detail-preview {
      padding:8px 16px 10px;display:flex;flex-direction:column;gap:2px;
      border-bottom:1px dashed var(--border);
    }
    .sc-detail-title { font-size:12px;font-weight:700;color:var(--primary); }
    .sc-detail-desc  { font-size:11px;color:var(--text-muted);line-height:1.4; }

    /* ── Mode chips ──────────────────────────────────── */
    .mode-chips { display:flex;gap:10px;flex-wrap:wrap; }
    .mode-chip  {
      display:flex;align-items:center;gap:7px;padding:8px 14px;
      border:1.5px solid var(--border);border-radius:999px;cursor:pointer;
      font-size:12px;font-weight:600;transition:all .15s;user-select:none;
    }
    .mode-chip:has(input:checked) {
      border-color:var(--primary);background:var(--primary-light);color:var(--primary);
    }
    .mode-chip input { display:none; }

    /* ── Icon picker ─────────────────────────────────── */
    .icon-picker-grid {
      display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));
      gap:8px;margin-top:14px;max-height:380px;overflow-y:auto;
    }
    .icon-picker-item {
      display:flex;flex-direction:column;align-items:center;gap:5px;
      padding:10px 6px;border:1.5px solid var(--border);border-radius:8px;
      cursor:pointer;transition:all .15s;text-align:center;
    }
    .icon-picker-item:hover { border-color:var(--primary);background:var(--primary-light); }
    .icon-picker-item i     { font-size:20px;color:var(--primary); }
    .icon-picker-item span  { font-size:9px;color:var(--text-muted);line-height:1.2; }

    /* ── Toast ───────────────────────────────────────── */
    #svc-toast-container {
      position:fixed;bottom:24px;right:24px;z-index:2000;
      display:flex;flex-direction:column;gap:8px;pointer-events:none;
    }
    .svc-toast {
      padding:11px 18px;border-radius:10px;font-size:13px;font-weight:600;
      box-shadow:0 4px 20px rgba(0,0,0,.14);
      display:flex;align-items:center;gap:9px;
      animation:svcToastIn .25s ease;
    }
    .svc-toast.success { background:#dcfce7;color:#166534;border:1.5px solid #bbf7d0; }
    .svc-toast.error   { background:#fee2e2;color:#991b1b;border:1.5px solid #fecaca; }
    @keyframes svcToastIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }

    /* ── States ──────────────────────────────────────── */
    .svc-loading,.svc-empty,.svc-error {
      text-align:center;padding:40px 20px;color:var(--text-muted);font-size:14px;
    }
    .svc-error { color:var(--danger); }

    /* ── Slot rows ───────────────────────────────────── */
    .slot-row {
      display:flex;align-items:center;justify-content:space-between;
      padding:12px 14px;border:1px solid var(--border);border-radius:10px;
      margin-bottom:10px;background:var(--surface);
    }
    .slot-label { display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600; }
  </style>`;

  document.body.appendChild(container);

  /* ── Bind all events ──────────────────────────────────────────────────── */
  document.getElementById('svc-modal-overlay').addEventListener('click', () => {
    SVC_MODAL_IDS.forEach(id => svcCloseModal(id));
  });

  document.querySelectorAll('#svc-modals-root .svc-modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.svc-modal');
      if (modal) svcCloseModal(modal.id);
    });
  });

  document.getElementById('cat-cancel-btn').addEventListener('click', () => svcCloseModal('svc-modal-category'));
  document.getElementById('svc-cancel-btn').addEventListener('click', () => svcCloseModal('svc-modal-service'));

  document.getElementById('cat-save-btn').addEventListener('click', submitCategoryForm);
  document.getElementById('svc-save-btn').addEventListener('click', submitServiceForm);

  document.getElementById('cat-icon-pick-btn').addEventListener('click', () =>
    openIconPicker('cat-icon-class', 'cat-icon-preview'));
  document.getElementById('svc-icon-pick-btn').addEventListener('click', () =>
    openIconPicker('svc-icon-class', 'svc-icon-preview'));

  document.getElementById('cat-icon-class').addEventListener('input', () =>
    svcUpdateIconPreview('cat-icon-preview', 'cat-icon-class'));
  document.getElementById('svc-icon-class').addEventListener('input', () =>
    svcUpdateIconPreview('svc-icon-preview', 'svc-icon-class'));

  // Category features
  document.getElementById('cat-feature-add-btn').addEventListener('click', addCatFeature);
  document.getElementById('cat-feature-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addCatFeature(); }
  });

  // Service items
  document.getElementById('svc-item-add-btn').addEventListener('click', addSvcItem);
  document.getElementById('svc-item-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addSvcItem(); }
  });

  // Time slots
  document.getElementById('add-slot-btn').addEventListener('click', () => openTimeSlotEditor());
  document.getElementById('slot-save-btn').addEventListener('click', submitTimeSlotForm);
}

/* ═══════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════ */
function svcEscHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function svcConfirmDelete(msg) {
  return window.confirm(msg + '\n\nThis cannot be undone.');
}

function svcSetSavingState(btnId, saving) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled  = saving;
  btn.innerHTML = saving
    ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving…'
    : '<i class="fa-solid fa-floppy-disk"></i> Save';
}

function svcShowToast(message, type = 'success') {
  const container = document.getElementById('svc-toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `svc-toast ${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i>${svcEscHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}