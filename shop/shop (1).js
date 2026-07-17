// ── LUMID STORE — shop.js ───────────────────────────────────
// Requires: supabase-config.js loaded before this file,
// and the Supabase JS CDN script loaded before that.

const CART_KEY = 'lumid_cart';

// ── CURRENCY FORMAT ─────────────────────────────────────────
function formatNaira(amount) {
  return '₦' + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

// ── CART STATE (localStorage-backed) ───────────────────────
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
  updateCartCount();
}
function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images && product.images[0] ? product.images[0] : '',
      qty: 1
    });
  }
  saveCart(cart);
  openCart();
}
function updateQty(id, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  const newCart = item.qty <= 0 ? cart.filter(i => i.id !== id) : cart;
  saveCart(newCart);
}
function removeFromCart(id) {
  saveCart(getCart().filter(i => i.id !== id));
}
function cartSubtotal(cart) {
  return cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
}

// ── CART DRAWER UI ──────────────────────────────────────────
function updateCartCount() {
  const count = getCart().reduce((sum, i) => sum + i.qty, 0);
  const el = document.getElementById('cartCount');
  if (el) el.textContent = count;
}

function renderCart() {
  const cart = getCart();
  const itemsEl = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('cartSubtotalAmount');
  const checkoutBtn = document.getElementById('cartCheckoutBtn');
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p class="cart-empty-msg">Your cart is empty. Browse the collection and add something you love.</p>';
    checkoutBtn.disabled = true;
  } else {
    itemsEl.innerHTML = cart.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <img src="${item.image}" alt="${item.name}"/>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatNaira(item.price)}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="updateQty('${item.id}', -1)">−</button>
            <span>${item.qty}</span>
            <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
            <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">Remove</button>
          </div>
        </div>
      </div>
    `).join('');
    checkoutBtn.disabled = false;
  }

  if (subtotalEl) subtotalEl.textContent = formatNaira(cartSubtotal(cart));
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}
function goToCheckout() {
  window.location.href = 'checkout.html';
}
function buyNow(product) {
  addToCart(product);
  window.location.href = 'checkout.html';
}

// ── PRODUCT GRID ────────────────────────────────────────────
let allProducts = [];

async function loadProducts() {
  const gridEl = document.getElementById('productGrid');
  gridEl.innerHTML = '<p class="shop-state-msg">Loading pieces…</p>';

  const { data, error } = await supabaseClient
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    gridEl.innerHTML = '<p class="shop-state-msg">Couldn\'t load products right now. Please refresh, or reach us on WhatsApp to browse pieces directly.</p>';
    console.error('Supabase error:', error);
    return;
  }

  allProducts = data || [];
  renderProducts(allProducts);
}

function renderProducts(products) {
  const gridEl = document.getElementById('productGrid');
  if (!products.length) {
    gridEl.innerHTML = '<p class="shop-state-msg">No pieces in this category yet — check back soon, or message us on WhatsApp for custom sourcing.</p>';
    return;
  }

  gridEl.innerHTML = products.map(p => {
    const img = (p.images && p.images[0]) ? p.images[0] : '';
    const soldOut = p.stock_status === 'sold_out';
    const stockLabel = { in_stock: 'In Stock', made_to_order: 'Made to Order', sold_out: 'Sold Out' }[p.stock_status] || '';
    return `
      <div class="product-card" data-cat="${p.category}">
        <div class="product-thumb">
          <img src="${img}" alt="${p.name}"/>
          <span class="product-stock-badge ${p.stock_status}">${stockLabel}</span>
        </div>
        <div class="product-body">
          <div class="product-cat">${p.category}</div>
          <div class="product-name">${p.name}</div>
          ${p.dimensions ? `<div class="product-dims">${p.dimensions}</div>` : ''}
          <div class="product-price">${formatNaira(p.price)}</div>
          <div class="product-btn-row">
            <button class="product-add-btn" ${soldOut ? 'disabled' : ''}
              onclick='addToCart(${JSON.stringify({ id: p.id, name: p.name, price: p.price, images: p.images })})'>
              ${soldOut ? 'Sold Out' : 'Add to Cart'}
            </button>
            <button class="product-buy-btn" ${soldOut ? 'disabled' : ''}
              onclick='buyNow(${JSON.stringify({ id: p.id, name: p.name, price: p.price, images: p.images })})'>
              Buy Now
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterShop(cat, btn) {
  document.querySelectorAll('.shop-filters .filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const filtered = cat === 'all' ? allProducts : allProducts.filter(p => p.category === cat);
  renderProducts(filtered);
}

// ── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  renderCart();
  updateCartCount();
});
