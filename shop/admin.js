// ── LUMID ADMIN — admin.js ──────────────────────────────────
// Requires: supabase-config.js loaded before this file.

let editingProductId  = null;
let productsCache     = [];
let editingProjectId  = null;
let projectPhotosUrls = [];
let projectVideoUrls  = [];
let uploadInProgress  = false; // blocks submit while uploads are running

// ── AUTH ─────────────────────────────────────────────────────
async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) showAdminShell(session.user.email);
  else showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminShell').style.display  = 'none';
}

function showAdminShell(email) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminShell').style.display  = 'block';
  document.getElementById('adminEmail').textContent    = email;
  loadProductsList();
  loadOrdersList();
  loadProjectsList();
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl  = document.getElementById('loginError');
  errorEl.style.display = 'none';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent   = 'Login failed — check your email and password.';
    errorEl.style.display = 'block';
    return;
  }
  showAdminShell(data.user.email);
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  showLoginScreen();
}

// ── TABS ─────────────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
}

// ── SLUG HELPER ──────────────────────────────────────────────
function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

document.addEventListener('DOMContentLoaded', () => {
  checkSession();

  // slug auto-fill
  const nameInput = document.getElementById('pf-name');
  const slugInput = document.getElementById('pf-slug');
  if (nameInput && slugInput) {
    nameInput.addEventListener('input', () => {
      if (!slugInput.dataset.manuallyEdited) slugInput.value = slugify(nameInput.value);
    });
    slugInput.addEventListener('input', () => { slugInput.dataset.manuallyEdited = 'true'; });
  }

  // pre-fill project ID
  const projIdInput = document.getElementById('proj-id');
  if (projIdInput && !projIdInput.value) projIdInput.value = generateProjectId();
});

// ── PRODUCT IMAGE UPLOAD ─────────────────────────────────────
let pendingImageUrls = [];

async function handleImageUpload(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const statusEl = document.getElementById('pf-image-status');
  statusEl.style.display = 'block';
  statusEl.style.color   = 'var(--dim-grey)';
  statusEl.textContent   = `Uploading ${files.length} photo(s)…`;

  let successCount = 0;
  let lastError    = null;

  for (const file of files) {
    const fileName = `products/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const { error } = await supabaseClient.storage.from('product-images').upload(fileName, file);
    if (error) { lastError = error; continue; }
    const { data: urlData } = supabaseClient.storage.from('product-images').getPublicUrl(fileName);
    pendingImageUrls.push(urlData.publicUrl);
    successCount++;
  }

  renderImagePreview();
  input.value = '';

  if (lastError) {
    statusEl.style.color = '#b22222';
    statusEl.textContent = successCount
      ? `Uploaded ${successCount}/${files.length}. Error on rest: ${lastError.message}`
      : `Upload failed: ${lastError.message}`;
    return;
  }

  statusEl.style.color = '#c8973c';
  statusEl.textContent = `✓ Uploaded ${successCount} photo(s).`;
  setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
}

function renderImagePreview() {
  const previewEl = document.getElementById('pf-image-preview');
  previewEl.innerHTML = pendingImageUrls.map((url, i) => `
    <div style="position:relative;display:inline-block">
      <img src="${url}" alt="Product image"
           style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:1px solid var(--warm-grey)"/>
      <button type="button" onclick="removeProductImage(${i})"
        style="position:absolute;top:-4px;right:-4px;background:#ff4d4d;color:white;border:none;
               border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;
               display:flex;align-items:center;justify-content:center">×</button>
    </div>
  `).join('');
}

function removeProductImage(index) {
  pendingImageUrls.splice(index, 1);
  renderImagePreview();
}

// ── PRODUCT FORM ─────────────────────────────────────────────
async function handleProductSubmit(e) {
  e.preventDefault();
  const msgEl = document.getElementById('pf-msg');
  msgEl.style.display = 'none';

  const product = {
    name:         document.getElementById('pf-name').value.trim(),
    slug:         document.getElementById('pf-slug').value.trim(),
    description:  document.getElementById('pf-description').value.trim(),
    price:        parseFloat(document.getElementById('pf-price').value),
    category:     document.getElementById('pf-category').value,
    dimensions:   document.getElementById('pf-dimensions').value.trim(),
    stock_status: document.getElementById('pf-stock').value,
    is_active:    document.getElementById('pf-active').checked,
    images:       pendingImageUrls
  };

  if (!product.name || !product.slug || !product.price || !product.category) {
    msgEl.textContent  = 'Please fill in name, slug, price and category.';
    msgEl.className    = 'admin-form-msg error';
    msgEl.style.display = 'block';
    return;
  }

  const result = editingProductId
    ? await supabaseClient.from('products').update(product).eq('id', editingProductId)
    : await supabaseClient.from('products').insert(product);

  if (result.error) {
    msgEl.textContent   = 'Error saving product: ' + result.error.message;
    msgEl.className     = 'admin-form-msg error';
    msgEl.style.display = 'block';
    return;
  }

  msgEl.textContent   = editingProductId ? 'Product updated.' : 'Product added.';
  msgEl.className     = 'admin-form-msg success';
  msgEl.style.display = 'block';
  resetProductForm();
  loadProductsList();
}

function resetProductForm() {
  document.getElementById('productForm').reset();
  document.getElementById('pf-slug').dataset.manuallyEdited = '';
  pendingImageUrls  = [];
  renderImagePreview();
  editingProductId  = null;
  document.getElementById('pf-submit-btn').textContent        = 'Add Product';
  document.getElementById('pf-cancel-edit-btn').style.display = 'none';
}

function cancelEdit() { resetProductForm(); }

// ── PRODUCT LIST ─────────────────────────────────────────────
async function loadProductsList() {
  const tbody = document.getElementById('productsTableBody');
  const { data, error } = await supabaseClient
    .from('products').select('*').order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">Couldn't load products: ${error.message}</td></tr>`;
    return;
  }

  productsCache = data || [];

  if (!productsCache.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">No products yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = productsCache.map(p => `
    <tr>
      <td>${p.images?.[0] ? `<img src="${p.images[0]}" alt="${p.name}" style="width:48px;height:48px;object-fit:cover;border-radius:4px"/>` : '—'}</td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>₦${Number(p.price).toLocaleString('en-NG')}</td>
      <td><span class="admin-status-badge ${p.stock_status}">${p.stock_status.replace('_',' ')}</span></td>
      <td>
        <div class="admin-row-actions">
          <button class="admin-link-btn" onclick="editProductById('${p.id}')">Edit</button>
          <button class="admin-link-btn danger" onclick="deleteProduct('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editProductById(id) {
  const product = productsCache.find(p => p.id === id);
  if (!product) return;
  editProduct(product);
}

function editProduct(product) {
  editingProductId = product.id;
  document.getElementById('pf-name').value        = product.name;
  document.getElementById('pf-slug').value        = product.slug;
  document.getElementById('pf-slug').dataset.manuallyEdited = 'true';
  document.getElementById('pf-description').value = product.description || '';
  document.getElementById('pf-price').value       = product.price;
  document.getElementById('pf-category').value    = product.category;
  document.getElementById('pf-dimensions').value  = product.dimensions || '';
  document.getElementById('pf-stock').value       = product.stock_status;
  document.getElementById('pf-active').checked    = !!product.is_active;
  pendingImageUrls = product.images || [];
  renderImagePreview();
  document.getElementById('pf-submit-btn').textContent        = 'Save Changes';
  document.getElementById('pf-cancel-edit-btn').style.display = 'inline-block';
  document.getElementById('panel-products').scrollIntoView({ behavior: 'smooth' });
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? Cannot be undone.')) return;
  const { error } = await supabaseClient.from('products').delete().eq('id', id);
  if (error) { alert('Error deleting product: ' + error.message); return; }
  loadProductsList();
}

// ── ORDERS ───────────────────────────────────────────────────
async function loadOrdersList() {
  const container = document.getElementById('ordersContainer');
  const { data, error } = await supabaseClient
    .from('orders').select('*').order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<p class="admin-empty">Couldn't load orders: ${error.message}</p>`;
    return;
  }
  if (!data.length) {
    container.innerHTML = `<p class="admin-empty">No orders yet.</p>`;
    return;
  }

  container.innerHTML = data.map(order => `
    <div class="order-card">
      <div class="order-card-top">
        <div>
          <div class="order-customer">${order.customer_name}</div>
          <div class="order-meta">
            📞 ${order.customer_phone}${order.customer_email ? ' · ' + order.customer_email : ''}<br/>
            📍 ${order.delivery_address}<br/>
            ${new Date(order.created_at).toLocaleString('en-NG')}
          </div>
        </div>
        <select class="order-status-select" onchange="updateOrderStatus('${order.id}', this.value)">
          ${['pending','paid','fulfilled','cancelled'].map(s =>
            `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
      <ul class="order-items-list">
        ${(order.items || []).map(i => `<li>${i.qty} × ${i.name} — ₦${Number(i.price).toLocaleString('en-NG')}</li>`).join('')}
      </ul>
      <div class="order-subtotal">₦${Number(order.subtotal).toLocaleString('en-NG')}</div>
    </div>
  `).join('');
}

async function updateOrderStatus(orderId, status) {
  const { error } = await supabaseClient.from('orders').update({ status }).eq('id', orderId);
  if (error) alert('Error updating order status: ' + error.message);
}

// ══════════════════════════════════════════════
// PROJECTS ADMIN
// ══════════════════════════════════════════════

function generateProjectId() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `LMD-${year}-${rand}`;
}

// ── PROJECT MEDIA UPLOAD ─────────────────────────────────────
// MAX: 30 images + 10 videos per project
const MAX_PHOTOS = 30;
const MAX_VIDEOS = 10;

async function handleProjectPhotoUpload(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;

  // ── FIX: separate images from videos ──────────────────────
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  const videoFiles = files.filter(f => f.type.startsWith('video/'));

  // enforce limits
  const remainingPhotos = MAX_PHOTOS - projectPhotosUrls.length;
  const remainingVideos = MAX_VIDEOS - projectVideoUrls.length;

  if (imageFiles.length > remainingPhotos) {
    alert(`You can add ${remainingPhotos} more photo(s). Max is ${MAX_PHOTOS} per project.`);
    input.value = '';
    return;
  }
  if (videoFiles.length > remainingVideos) {
    alert(`You can add ${remainingVideos} more video(s). Max is ${MAX_VIDEOS} per project.`);
    input.value = '';
    return;
  }

  const statusEl = document.getElementById('proj-photo-status');
  statusEl.style.display = 'block';
  statusEl.style.color   = 'var(--dim-grey)';
  statusEl.textContent   = `Uploading ${files.length} file(s)…`;
  uploadInProgress = true;

  let successCount = 0;
  let lastError    = null;
  // timestamp for this batch so photos are groupable chronologically
  const batchTs = new Date().toISOString();

  for (const file of [...imageFiles, ...videoFiles]) {
    const isVideo    = file.type.startsWith('video/');
    const folder     = isVideo ? 'project-videos' : 'project-photos';
    // embed timestamp in filename for chronological sorting
    const safeTs     = batchTs.replace(/[:.]/g, '-');
    const fileName   = `projects/${folder}/${safeTs}-${file.name.replace(/\s+/g, '-')}`;

    const { error } = await supabaseClient.storage
      .from('product-images')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) { lastError = error; continue; }

    const { data: urlData } = supabaseClient.storage
      .from('product-images')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    if (isVideo) {
      projectVideoUrls.push({ url: publicUrl, uploaded_at: batchTs });
    } else {
      projectPhotosUrls.push({ url: publicUrl, uploaded_at: batchTs });
    }
    successCount++;
  }

  uploadInProgress = false;
  renderProjectMediaPreview();
  input.value = '';

  if (lastError) {
    statusEl.style.color = '#b22222';
    statusEl.textContent = successCount
      ? `Uploaded ${successCount}/${files.length}. Error on rest: ${lastError.message}`
      : `Upload failed: ${lastError.message}`;
    return;
  }

  statusEl.style.color = '#c8973c';
  statusEl.textContent = `✓ Uploaded ${successCount} file(s). Photos: ${projectPhotosUrls.length}/${MAX_PHOTOS} · Videos: ${projectVideoUrls.length}/${MAX_VIDEOS}`;
  setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
}

function renderProjectMediaPreview() {
  const previewEl = document.getElementById('proj-photo-preview');
  if (!previewEl) return;

  const photoHtml = projectPhotosUrls.map((item, i) => {
    const url = typeof item === 'string' ? item : item.url;
    const ts  = item.uploaded_at ? new Date(item.uploaded_at).toLocaleString('en-NG', { dateStyle:'short', timeStyle:'short' }) : '';
    return `
      <div style="position:relative;display:inline-block;text-align:center">
        <img src="${url}" style="width:72px;height:72px;object-fit:cover;border-radius:4px;border:1px solid var(--warm-grey);display:block"/>
        ${ts ? `<div style="font-size:9px;color:var(--dim-grey);margin-top:2px;max-width:72px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${ts}</div>` : ''}
        <button type="button" onclick="removeProjectPhoto(${i})"
          style="position:absolute;top:-4px;right:-4px;background:#ff4d4d;color:white;border:none;
                 border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;
                 display:flex;align-items:center;justify-content:center">×</button>
      </div>`;
  }).join('');

  const videoHtml = projectVideoUrls.map((item, i) => {
    const url = typeof item === 'string' ? item : item.url;
    const ts  = item.uploaded_at ? new Date(item.uploaded_at).toLocaleString('en-NG', { dateStyle:'short', timeStyle:'short' }) : '';
    return `
      <div style="position:relative;display:inline-block;text-align:center">
        <div style="width:72px;height:72px;background:#1a1a1a;border-radius:4px;border:1px solid var(--warm-grey);
                    display:flex;align-items:center;justify-content:center;font-size:1.4rem">🎬</div>
        ${ts ? `<div style="font-size:9px;color:var(--dim-grey);margin-top:2px;max-width:72px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${ts}</div>` : ''}
        <button type="button" onclick="removeProjectVideo(${i})"
          style="position:absolute;top:-4px;right:-4px;background:#ff4d4d;color:white;border:none;
                 border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;
                 display:flex;align-items:center;justify-content:center">×</button>
      </div>`;
  }).join('');

  const label = `<div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--dim-grey);margin-bottom:6px">
    Photos (${projectPhotosUrls.length}/${MAX_PHOTOS}) · Videos (${projectVideoUrls.length}/${MAX_VIDEOS})
  </div>`;

  previewEl.innerHTML = label
    + `<div style="display:flex;flex-wrap:wrap;gap:8px">${photoHtml}${videoHtml}</div>`;
}

function removeProjectPhoto(index) {
  projectPhotosUrls.splice(index, 1);
  renderProjectMediaPreview();
}

function removeProjectVideo(index) {
  projectVideoUrls.splice(index, 1);
  renderProjectMediaPreview();
}

// ── PROJECT FORM ─────────────────────────────────────────────
async function handleProjectSubmit(e) {
  e.preventDefault();

  if (uploadInProgress) {
    alert('Please wait — files are still uploading.');
    return;
  }

  const msgEl = document.getElementById('proj-msg');
  msgEl.style.display = 'none';

  let milestones = [];
  const rawMs = document.getElementById('proj-milestones').value.trim();
  if (rawMs) {
    try { milestones = JSON.parse(rawMs); }
    catch {
      msgEl.textContent   = 'Milestones JSON is invalid. Check the format.';
      msgEl.className     = 'admin-form-msg error';
      msgEl.style.display = 'block';
      return;
    }
  }

  // ── FIX: read checkbox state BEFORE reset is ever called ──
  const isVisible = document.getElementById('proj-visible').checked;

  const payload = {
    project_id:    document.getElementById('proj-id').value.trim().toUpperCase(),
    client_name:   document.getElementById('proj-client').value.trim(),
    project_type:  document.getElementById('proj-type').value,
    location:      document.getElementById('proj-location').value.trim(),
    start_date:    document.getElementById('proj-start').value   || null,
    estimated_end: document.getElementById('proj-end').value     || null,
    completion_pct:parseInt(document.getElementById('proj-pct').value) || 0,
    current_stage: document.getElementById('proj-stage').value.trim(),
    notes:         document.getElementById('proj-notes').value.trim(),
    // ── FIX: use captured value — not re-read after possible reset ──
    is_visible:    isVisible,
    milestones:    milestones,
    // ── FIX: store as objects with url + uploaded_at so track page
    //         can show timestamps and the URLs stay clean ──
    photos:        projectPhotosUrls,
    videos:        projectVideoUrls,
    // ── NEW: record when project was last updated by admin ──
    updated_at:    new Date().toISOString()
  };

  const result = editingProjectId
    ? await supabaseClient.from('projects').update(payload).eq('id', editingProjectId)
    : await supabaseClient.from('projects').insert(payload);

  if (result.error) {
    msgEl.textContent   = 'Error: ' + result.error.message;
    msgEl.className     = 'admin-form-msg error';
    msgEl.style.display = 'block';
    return;
  }

  msgEl.textContent   = editingProjectId
    ? 'Project updated successfully.'
    : `Project created. Share ID "${payload.project_id}" with your client on WhatsApp.`;
  msgEl.className     = 'admin-form-msg success';
  msgEl.style.display = 'block';
  resetProjectForm();
  loadProjectsList();
}

function resetProjectForm() {
  // ── FIX: reset fields manually instead of calling form.reset()
  //         so the checkbox always stays checked by default ──
  document.getElementById('proj-client').value    = '';
  document.getElementById('proj-id').value        = generateProjectId();
  document.getElementById('proj-type').value      = '';
  document.getElementById('proj-location').value  = '';
  document.getElementById('proj-start').value     = '';
  document.getElementById('proj-end').value       = '';
  document.getElementById('proj-pct').value       = '0';
  document.getElementById('proj-stage').value     = '';
  document.getElementById('proj-notes').value     = '';
  document.getElementById('proj-milestones').value= '';
  // ── FIX: always default to checked — never let reset() uncheck it ──
  document.getElementById('proj-visible').checked = true;

  editingProjectId  = null;
  projectPhotosUrls = [];
  projectVideoUrls  = [];
  uploadInProgress  = false;
  document.getElementById('proj-photo-preview').innerHTML  = '';
  document.getElementById('proj-submit-btn').textContent   = 'Create Project';
  document.getElementById('proj-cancel-btn').style.display = 'none';
}

function cancelProjectEdit() { resetProjectForm(); }

// ── PROJECT LIST ─────────────────────────────────────────────
async function loadProjectsList() {
  const tbody = document.getElementById('projectsTableBody');
  if (!tbody) return;
  const { data, error } = await supabaseClient
    .from('projects').select('*').order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">Error: ${error.message}</td></tr>`;
    return;
  }
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">No projects yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td><strong>${p.project_id}</strong></td>
      <td>${p.client_name}</td>
      <td>${p.project_type || '—'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <div style="flex:1;height:6px;background:var(--warm-grey);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${p.completion_pct}%;background:var(--gold);border-radius:99px"></div>
          </div>
          <span style="font-size:0.75rem;font-weight:600;color:var(--charcoal)">${p.completion_pct}%</span>
        </div>
      </td>
      <td style="font-size:0.8rem">${p.current_stage || '—'}</td>
      <td>
        <div class="admin-row-actions">
          <button class="admin-link-btn" onclick="editProjectById('${p.id}')">Edit</button>
          <a class="admin-link-btn" href="/track/index.html?id=${p.project_id}" target="_blank">Preview</a>
          <button class="admin-link-btn danger" onclick="deleteProject('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function editProjectById(id) {
  const { data, error } = await supabaseClient
    .from('projects').select('*').eq('id', id).single();
  if (error || !data) return;

  editingProjectId = data.id;
  document.getElementById('proj-client').value    = data.client_name   || '';
  document.getElementById('proj-id').value        = data.project_id    || '';
  document.getElementById('proj-type').value      = data.project_type  || '';
  document.getElementById('proj-location').value  = data.location      || '';
  document.getElementById('proj-start').value     = data.start_date    || '';
  document.getElementById('proj-end').value       = data.estimated_end || '';
  document.getElementById('proj-pct').value       = data.completion_pct || 0;
  document.getElementById('proj-stage').value     = data.current_stage || '';
  document.getElementById('proj-notes').value     = data.notes         || '';
  // ── FIX: explicit boolean coercion — never let undefined == falsy ──
  document.getElementById('proj-visible').checked = data.is_visible !== false;
  document.getElementById('proj-milestones').value = data.milestones
    ? JSON.stringify(data.milestones, null, 2) : '';

  // support both legacy string arrays and new object arrays
  projectPhotosUrls = (data.photos || []).map(p =>
    typeof p === 'string' ? { url: p, uploaded_at: null } : p
  );
  projectVideoUrls = (data.videos || []).map(v =>
    typeof v === 'string' ? { url: v, uploaded_at: null } : v
  );
  renderProjectMediaPreview();

  document.getElementById('proj-submit-btn').textContent   = 'Save Changes';
  document.getElementById('proj-cancel-btn').style.display = 'inline-block';
  document.getElementById('panel-projects').scrollIntoView({ behavior: 'smooth' });
}

async function deleteProject(id) {
  if (!confirm('Delete this project? The client will no longer be able to track it.')) return;
  const { error } = await supabaseClient.from('projects').delete().eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  loadProjectsList();
}