// ── LUMID CHECKOUT — checkout.js ────────────────────────────
// Requires: supabase-config.js and paystack-config.js loaded before this file,
// plus the Paystack Inline JS CDN script.

const CART_KEY = 'lumid_cart';

function formatNaira(amount) {
  return '₦' + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function cartSubtotal(cart) {
  return cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
}

function renderSummary() {
  const cart = getCart();
  const container = document.getElementById('summaryItems');
  const subtotalEl = document.getElementById('summarySubtotal');
  const payBtn = document.getElementById('payBtn');

  if (!cart.length) {
    container.innerHTML = '<p class="checkout-empty-notice">Your cart is empty. <a href="index.html">Go back to the shop →</a></p>';
    subtotalEl.textContent = formatNaira(0);
    payBtn.disabled = true;
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="summary-item">
      <img src="${item.image}" alt="${item.name}"/>
      <div class="summary-item-info">
        <div class="summary-item-name">${item.name}</div>
        <div class="summary-item-qty">Qty ${item.qty}</div>
      </div>
      <div class="summary-item-price">${formatNaira(item.price * item.qty)}</div>
    </div>
  `).join('');

  subtotalEl.textContent = formatNaira(cartSubtotal(cart));
  payBtn.disabled = false;
}

function validateForm() {
  const name = document.getElementById('co-name').value.trim();
  const phone = document.getElementById('co-phone').value.trim();
  const address = document.getElementById('co-address').value.trim();
  const msgEl = document.getElementById('checkoutMsg');

  if (!name || !phone || !address) {
    msgEl.textContent = 'Please fill in your name, phone number and delivery address.';
    msgEl.className = 'checkout-form-msg error';
    return false;
  }
  msgEl.style.display = 'none';
  return true;
}

function handleCheckoutSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const cart = getCart();
  if (!cart.length) return;

  const name = document.getElementById('co-name').value.trim();
  const phone = document.getElementById('co-phone').value.trim();
  const email = document.getElementById('co-email').value.trim();
  const address = document.getElementById('co-address').value.trim();
  const subtotal = cartSubtotal(cart);

  const payBtn = document.getElementById('payBtn');
  payBtn.disabled = true;
  payBtn.textContent = 'Processing…';

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: email || `${phone.replace(/\D/g,'')}@lumidcustomer.ng`, // Paystack requires an email
    amount: Math.round(subtotal * 100), // Paystack expects kobo
    currency: 'NGN',
    ref: 'LUMID-' + Date.now(),
    metadata: {
      customer_name: name,
      customer_phone: phone
    },
    callback: function(response) {
      finalizeOrder({ name, phone, email, address, subtotal, cart, reference: response.reference });
    },
    onClose: function() {
      payBtn.disabled = false;
      payBtn.textContent = 'Pay Now →';
    }
  });

  handler.openIframe();
}

async function finalizeOrder({ name, phone, email, address, subtotal, cart, reference }) {
  const orderItems = cart.map(i => ({ product_id: i.id, name: i.name, price: i.price, qty: i.qty }));

  const { error } = await supabaseClient.from('orders').insert({
    customer_name: name,
    customer_phone: phone,
    customer_email: email || null,
    delivery_address: address,
    items: orderItems,
    subtotal: subtotal,
    status: 'paid',
    paystack_reference: reference
  });

  if (error) {
    const msgEl = document.getElementById('checkoutMsg');
    msgEl.textContent = 'Payment succeeded but we had trouble saving your order. Please screenshot this and WhatsApp us your payment reference: ' + reference;
    msgEl.className = 'checkout-form-msg error';
    return;
  }

  localStorage.removeItem(CART_KEY);
  window.location.href = 'order-success.html?ref=' + encodeURIComponent(reference);
}

document.addEventListener('DOMContentLoaded', renderSummary);
