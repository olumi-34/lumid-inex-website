// ── LUMID ADMIN — admin.js ──────────────────────────────────
// Requires: supabase-config.js loaded before this file.

let editingProductId = null;
let productsCache = [];

// ── AUTH ─────────────────────────────────────────────────────
async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showAdminShell(session.user.email);
  } else {
    showLoginScreen();
  }
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminShell').style.display = 'none';
}

function showAdminShell(email) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminShell').style.display = 'block';
  document.getElementById('adminEmail').textContent = email;
  loadProductsList();
  loadOrdersList();
  loadProjectsList();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.style.display = 'none';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = 'Login failed — check your email and password.';
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
  const nameInput = document.getElementById('pf-name');
  const slugInput = document.getElementById('pf-slug');
  if (nameInput && slugInput) {
    nameInput.addEventListener('input', () => {
      if (!slugInput.dataset.manuallyEdited) {
        slugInput.value = slugify(nameInput.value);
      }
    });
    slugInput.addEventListener('input', () => { slugInput.dataset.manuallyEdited = 'true'; });
  }
});

// ── IMAGE UPLOAD ─────────────────────────────────────────────
let pendingImageUrls = [];

async function handleImageUpload(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;

  const previewEl = document.getElementById('pf-image-preview');
  const statusEl = document.getElementById('pf-image-status');
  statusEl.textContent = `Uploading ${files.length} image(s)…`;
  statusEl.style.display = 'block';

  for (const file of files) {
    const fileName = `${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ''))}.${file.name.split('.').pop()}`;
    const { error } = await supabaseClient.storage
      .from('product-images')
      .upload(fileName, file);

    if (error) {
      statusEl.textContent = 'Upload failed: ' + error.message;
      continue;
    }

    const { data: urlData } = supabaseClient.storage
      .from('product-images')
      .getPublicUrl(fileName);

    pendingImageUrls.push(urlData.publicUrl);
  }

  statusEl.style.display = 'none';
  renderImagePreview();
}

function renderImagePreview() {
  const previewEl = document.getElementById('pf-image-preview');
  previewEl.innerHTML = pendingImageUrls.map(url => `<img src="${url}" alt="Product image"/>`).join('');
}

// ── PRODUCT FORM (add / edit) ────────────────────────────────
async function handleProductSubmit(e) {
  e.preventDefault();
  const msgEl = document.getElementById('pf-msg');
  msgEl.style.display = 'none';

  const product = {
    name: document.getElementById('pf-name').value.trim(),
    slug: document.getElementById('pf-slug').value.trim(),
    description: document.getElementById('pf-description').value.trim(),
    price: parseFloat(document.getElementById('pf-price').value),
    category: document.getElementById('pf-category').value,
    dimensions: document.getElementById('pf-dimensions').value.trim(),
    stock_status: document.getElementById('pf-stock').value,
    is_active: document.getElementById('pf-active').checked,
    images: pendingImageUrls
  };

  if (!product.name || !product.slug || !product.price || !product.category) {
    msgEl.textContent = 'Please fill in name, slug, price and category.';
    msgEl.className = 'admin-form-msg error';
    msgEl.style.display = 'block';
    return;
  }

  let result;
  if (editingProductId) {
    result = await supabaseClient.from('products').update(product).eq('id', editingProductId);
  } else {
    result = await supabaseClient.from('products').insert(product);
  }

  if (result.error) {
    msgEl.textContent = 'Error saving product: ' + result.error.message;
    msgEl.className = 'admin-form-msg error';
    msgEl.style.display = 'block';
    return;
  }

  msgEl.textContent = editingProductId ? 'Product updated.' : 'Product added.';
  msgEl.className = 'admin-form-msg success';
  msgEl.style.display = 'block';
  resetProductForm();
  loadProductsList();
}

function resetProductForm() {
  document.getElementById('productForm').reset();
  document.getElementById('pf-slug').dataset.manuallyEdited = '';
  pendingImageUrls = [];
  renderImagePreview();
  editingProductId = null;
  document.getElementById('pf-submit-btn').textContent = 'Add Product';
  document.getElementById('pf-cancel-edit-btn').style.display = 'none';
}

function cancelEdit() {
  resetProductForm();
}

// ── PRODUCT LIST ─────────────────────────────────────────────
async function loadProductsList() {
  const tbody = document.getElementById('productsTableBody');
  const { data, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">Couldn't load products: ${error.message}</td></tr>`;
    return;
  }

  productsCache = data || [];

  if (!productsCache.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">No products yet. Add your first one above.</td></tr>`;
    return;
  }

  tbody.innerHTML = productsCache.map(p => `
    <tr>
      <td>${p.images && p.images[0] ? `<img src="${p.images[0]}" alt="${p.name}"/>` : '—'}</td>
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
  document.getElementById('pf-name').value = product.name;
  document.getElementById('pf-slug').value = product.slug;
  document.getElementById('pf-slug').dataset.manuallyEdited = 'true';
  document.getElementById('pf-description').value = product.description || '';
  document.getElementById('pf-price').value = product.price;
  document.getElementById('pf-category').value = product.category;
  document.getElementById('pf-dimensions').value = product.dimensions || '';
  document.getElementById('pf-stock').value = product.stock_status;
  document.getElementById('pf-active').checked = product.is_active;
  pendingImageUrls = product.images || [];
  renderImagePreview();
  document.getElementById('pf-submit-btn').textContent = 'Save Changes';
  document.getElementById('pf-cancel-edit-btn').style.display = 'inline-block';
  document.getElementById('panel-products').scrollIntoView({ behavior: 'smooth' });
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  const { error } = await supabaseClient.from('products').delete().eq('id', id);
  if (error) {
    alert('Error deleting product: ' + error.message);
    return;
  }
  loadProductsList();
}

// ── ORDERS ───────────────────────────────────────────────────
async function loadOrdersList() {
  const container = document.getElementById('ordersContainer');
  const { data, error } = await supabaseClient
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

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
let editingProjectId  = null;
let projectPhotosUrls = [];

// auto-generate project ID
function generateProjectId() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `LMD-${year}-${rand}`;
}

document.addEventListener('DOMContentLoaded', () => {
  // pre-fill project ID field
  const projIdInput = document.getElementById('proj-id');
  if (projIdInput && !projIdInput.value) {
    projIdInput.value = generateProjectId();
  }
});

async function handleProjectPhotoUpload(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const statusEl  = document.getElementById('proj-photo-status');
  const previewEl = document.getElementById('proj-photo-preview');
  statusEl.style.display = 'block';
  statusEl.textContent   = `Uploading ${files.length} photo(s)…`;

  for (const file of files) {
    const fileName = `projects/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const { error } = await supabaseClient.storage.from('product-images').upload(fileName, file);
    if (error) { statusEl.textContent = 'Upload error: ' + error.message; continue; }
    const { data: urlData } = supabaseClient.storage.from('product-images').getPublicUrl(fileName);
    projectPhotosUrls.push(urlData.publicUrl);
  }

  statusEl.style.display = 'none';
  previewEl.innerHTML = projectPhotosUrls.map(url =>
    `<img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:1px solid var(--warm-grey)"/>`
  ).join('');
}

async function handleProjectSubmit(e) {
  e.preventDefault();
  const msgEl = document.getElementById('proj-msg');
  msgEl.style.display = 'none';

  let milestones = [];
  const rawMs = document.getElementById('proj-milestones').value.trim();
  if (rawMs) {
    try { milestones = JSON.parse(rawMs); }
    catch { msgEl.textContent = 'Milestones JSON is invalid. Please check the format.'; msgEl.className = 'admin-form-msg error'; msgEl.style.display = 'block'; return; }
  }

  const payload = {
    project_id:     document.getElementById('proj-id').value.trim().toUpperCase(),
    client_name:    document.getElementById('proj-client').value.trim(),
    project_type:   document.getElementById('proj-type').value,
    location:       document.getElementById('proj-location').value.trim(),
    start_date:     document.getElementById('proj-start').value || null,
    estimated_end:  document.getElementById('proj-end').value   || null,
    completion_pct: parseInt(document.getElementById('proj-pct').value) || 0,
    current_stage:  document.getElementById('proj-stage').value.trim(),
    notes:          document.getElementById('proj-notes').value.trim(),
    is_visible:     document.getElementById('proj-visible').checked,
    milestones:     milestones,
    photos:         projectPhotosUrls
  };

  let result;
  if (editingProjectId) {
    result = await supabaseClient.from('projects').update(payload).eq('id', editingProjectId);
  } else {
    result = await supabaseClient.from('projects').insert(payload);
  }

  if (result.error) {
    msgEl.textContent = 'Error: ' + result.error.message;
    msgEl.className = 'admin-form-msg error';
    msgEl.style.display = 'block';
    return;
  }

  msgEl.textContent = editingProjectId ? 'Project updated.' : 'Project created. Share the Project ID with your client via WhatsApp.';
  msgEl.className = 'admin-form-msg success';
  msgEl.style.display = 'block';
  resetProjectForm();
  loadProjectsList();
}

function resetProjectForm() {
  document.getElementById('projectForm').reset();
  document.getElementById('proj-id').value = generateProjectId();
  editingProjectId  = null;
  projectPhotosUrls = [];
  document.getElementById('proj-photo-preview').innerHTML = '';
  document.getElementById('proj-submit-btn').textContent   = 'Create Project';
  document.getElementById('proj-cancel-btn').style.display = 'none';
}

function cancelProjectEdit() { resetProjectForm(); }

async function loadProjectsList() {
  const tbody = document.getElementById('projectsTableBody');
  if (!tbody) return;
  const { data, error } = await supabaseClient
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">Error: ${error.message}</td></tr>`; return; }
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">No projects yet.</td></tr>`; return; }

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
  // reload fresh from DB to avoid stale cache issues
  const { data, error } = await supabaseClient.from('projects').select('*').eq('id', id).single();
  if (error || !data) return;
  editingProjectId = data.id;

  document.getElementById('proj-client').value    = data.client_name || '';
  document.getElementById('proj-id').value        = data.project_id  || '';
  document.getElementById('proj-type').value      = data.project_type|| '';
  document.getElementById('proj-location').value  = data.location    || '';
  document.getElementById('proj-start').value     = data.start_date  || '';
  document.getElementById('proj-end').value       = data.estimated_end || '';
  document.getElementById('proj-pct').value       = data.completion_pct || 0;
  document.getElementById('proj-stage').value     = data.current_stage || '';
  document.getElementById('proj-notes').value     = data.notes || '';
  document.getElementById('proj-visible').checked = data.is_visible !== false;
  document.getElementById('proj-milestones').value = data.milestones
    ? JSON.stringify(data.milestones, null, 2)
    : '';

  projectPhotosUrls = data.photos || [];
  document.getElementById('proj-photo-preview').innerHTML = projectPhotosUrls.map(url =>
    `<img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:1px solid var(--warm-grey)"/>`
  ).join('');

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

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', checkSession);
