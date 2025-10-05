// ====== CONFIGURA TU NÚMERO DE WHATSAPP ======
const WSP_NUMBER = "+51910006174";

// ====== UTILIDADES ======
const $ = (q, ctx = document) => ctx.querySelector(q);
const $$ = (q, ctx = document) => Array.from(ctx.querySelectorAll(q));
const money = n => `S/ ${Number(n).toFixed(2)}`;

// ====== ESTADO DEL CARRITO ======
let cart = [];
try {
  const saved = localStorage.getItem("malcas_cart");
  if (saved) cart = JSON.parse(saved);
} catch (_) {}

const saveCart = () => localStorage.setItem("malcas_cart", JSON.stringify(cart));

// ====== INICIAL ======
window.addEventListener("DOMContentLoaded", () => {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  $$(".add-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      if (!card) return;
      const item = {
        name: card.dataset.name,
        price: Number(card.dataset.price),
        img: card.querySelector("img")?.getAttribute("src") || "",
        qty: 1
      };
      addToCart(item);
    });
  });

  const openBtn = $("#openCart");
  const closeBtn = $("#closeCart");
  const overlay = $("#overlay");
  if (openBtn) openBtn.addEventListener("click", openCart);
  if (closeBtn) closeBtn.addEventListener("click", closeCart);
  if (overlay) overlay.addEventListener("click", closeCart);

  const sendBtn = $("#sendWhatsApp");
  if (sendBtn) sendBtn.addEventListener("click", () => {
    alert("Funcionalidad de pedido desactivada temporalmente.");
  });

  renderCart();
});

function addToCart(item) {
  const idx = cart.findIndex(p => p.name === item.name);
  if (idx > -1) {
    cart[idx].qty++;
  } else {
    cart.push(item);
  }
  saveCart();
  renderCart();
  openCart();
}

function removeFromCart(name) {
  cart = cart.filter(p => p.name !== name);
  saveCart();
  renderCart();
}

function changeQty(name, delta) {
  const it = cart.find(p => p.name === name);
  if (!it) return;
  it.qty += delta;
  if (it.qty <= 0) removeFromCart(it.name);
  saveCart();
  renderCart();
}

function subtotal() {
  return cart.reduce((s, p) => s + p.price * p.qty, 0);
}

function renderCart() {
  const count = cart.reduce((s, p) => s + p.qty, 0);
  const countEl = $("#cart-count");
  if (countEl) countEl.textContent = count;

  const list = $("#cart-items");
  if (!list) return;
  list.innerHTML = "";

  if (cart.length === 0) {
    list.innerHTML = `<p style="color:#777">Tu carrito está vacío 😋</p>`;
  } else {
    cart.forEach(p => {
      const row = document.createElement("div");
      row.className = "ci";
      row.innerHTML = `
        <img src="${p.img}" alt="${p.name}">
        <div>
          <h5>${p.name}</h5>
          <small>${money(p.price)}</small>
        </div>
        <div class="qty">
          <button aria-label="Disminuir">−</button>
          <strong>${p.qty}</strong>
          <button aria-label="Aumentar">+</button>
          <button class="icon-btn" title="Quitar">🗑️</button>
        </div>`;
      const [minus, , plus, trash] = row.querySelectorAll(".qty > *");
      minus.addEventListener("click", () => changeQty(p.name, -1));
      plus.addEventListener("click", () => changeQty(p.name, 1));
      trash.addEventListener("click", () => removeFromCart(p.name));
      list.appendChild(row);
    });
  }

  const sub = subtotal();
  const subtotalEl = $("#subtotal");
  const deliveryEl = $("#delivery");
  const grandEl = $("#grand");

  if (subtotalEl) subtotalEl.textContent = money(sub);
  if (deliveryEl) deliveryEl.textContent = "Gratis 😄";
  if (grandEl) grandEl.textContent = money(sub);
}

function openCart() {
  $("#cart")?.classList.add("open");
  $("#overlay")?.classList.add("show");
}

function closeCart() {
  $("#cart")?.classList.remove("open");
  $("#overlay")?.classList.remove("show");
}


