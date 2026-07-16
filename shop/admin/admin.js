// ── LUMID ADMIN — admin.js ──────────────────────────────────
// Requires: supabase-config.js loaded before this file.

let editingProductId = null;

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

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">No products yet. Add your first one above.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td>${p.images && p.images[0] ? `<img src="${p.images[0]}" alt="${p.name}"/>` : '—'}</td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>₦${Number(p.price).toLocaleString('en-NG')}</td>
      <td><span class="admin-status-badge ${p.stock_status}">${p.stock_status.replace('_',' ')}</span></td>
      <td>
        <div class="admin-row-actions">
          <button class="admin-link-btn" onclick='editProduct(${JSON.stringify(p)})'>Edit</button>
          <button class="admin-link-btn danger" onclick="deleteProduct('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
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

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', checkSession);
