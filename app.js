// ====== CONFIGURA TU NÚMERO DE WHATSAPP (solo dígitos, con +51) ======
const WSP_NUMBER = "+51910006174"; // <-- cámbialo si deseas

// ====== UTILIDADES ======
const $ = (q, ctx = document) => ctx.querySelector(q);
const $$ = (q, ctx = document) => Array.from(ctx.querySelectorAll(q));
const money = n => `S/ ${Number(n).toFixed(2)}`;

// ====== ESTADO DEL CARRITO ======
let cart = []; // [{name, price, qty, img}]
const DELIVERY = 0; // Delivery gratis

// Persistencia básica
try {
  const saved = localStorage.getItem("malcas_cart");
  if (saved) cart = JSON.parse(saved);
} catch (_) {}

const saveCart = () => localStorage.setItem("malcas_cart", JSON.stringify(cart));

// ====== FILTROS / BUSCADOR (estado) ======
let currentFilter = "all";
let currentSearch = "";

// ====== INICIAL ======
window.addEventListener("DOMContentLoaded", () => {
  // Año footer
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Botón WhatsApp simple (sin carrito)
  const directMsg = encodeURIComponent("Hola, deseo hacer un pedido. ¿Me ayudan por favor? 😄");
  const wspUrl = `https://wa.me/${WSP_NUMBER.replace("+","")}?text=${directMsg}`;
  const wspDirect = $("#whatsapp-direct");
  const wspFloat = $("#wsp-float");
  if (wspDirect) wspDirect.href = wspUrl;
  if (wspFloat) wspFloat.href = wspUrl;

  // Filtros
  $$(".chip").forEach(ch => {
    ch.addEventListener("click", () => {
      $$(".chip").forEach(c => c.classList.remove("active"));
      ch.classList.add("active");
      currentFilter = ch.dataset.filter || "all";
      applyFilters();
    });
  });

  // Búsqueda
  const searchInput = $("#search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value.trim().toLowerCase();
      applyFilters();
    });
  }

  // Agregar al carrito
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

  // Drawer carrito
  const openBtn = $("#openCart");
  const closeBtn = $("#closeCart");
  const overlay = $("#overlay");
  if (openBtn) openBtn.addEventListener("click", openCart);
  if (closeBtn) closeBtn.addEventListener("click", closeCart);
  if (overlay) overlay.addEventListener("click", closeCart);

  // Enviar por WhatsApp
  const sendBtn = $("#sendWhatsApp");
  if (sendBtn) sendBtn.addEventListener("click", sendWhatsApp);

  // Primera renderizada
  renderCart();
});

// ====== FILTRAR / BUSCAR ======
function applyFilters() {
  $$("#product-grid .card").forEach(c => {
    const byCat = (currentFilter === "all") || (c.dataset.cat === currentFilter);
    const byText = c.dataset.name.toLowerCase().includes(currentSearch);
    c.style.display = (byCat && byText) ? "" : "none";
  });
}

// ====== CARRITO ======
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
  if (it.qty <= 0) removeFromCart(name);
  saveCart();
  renderCart();
}

function subtotal() {
  return cart.reduce((s, p) => s + p.price * p.qty, 0);
}

function renderCart() {
  // contador
  const count = cart.reduce((s, p) => s + p.qty, 0);
  const countEl = $("#cart-count");
  if (countEl) countEl.textContent = count;

  const list = $("#cart-items");
  if (!list) return;
  list.innerHTML = "";

  if (cart.length === 0) {
    list.innerHTML = `<p style="color:#777">Tu carrito está vacío. Agrega algo rico 😋</p>`;
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

      const [minus, qtyEl, plus, trash] = row.querySelectorAll(".qty > *");
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
  if (grandEl) grandEl.textContent = money(sub); // total = solo subtotal
}

function openCart() {
  $("#cart")?.classList.add("open");
  $("#overlay")?.classList.add("show");
}

function closeCart() {
  $("#cart")?.classList.remove("open");
  $("#overlay")?.classList.remove("show");
}

// ====== WHATSAPP (envío del pedido) ======
function sendWhatsApp() {
  if (cart.length === 0) { alert("Agrega productos al carrito 🙂"); return; }

  const nombre = $("#cliente")?.value.trim() || "Cliente";
  const direccion = $("#direccion")?.value.trim();
  if (!direccion) { alert("Ingresa tu dirección para el delivery."); return; }
  const referencia = $("#referencia")?.value.trim() || "";

  const lines = cart
    .map(p => `• ${p.name} × ${p.qty} — ${money(p.price * p.qty)}`)
    .join("%0A");

  const subVal = subtotal();
  const subTxt = money(subVal);
  const totalTxt = money(subVal); // delivery gratis

  let msg =
    `Hola! Soy ${encodeURIComponent(nombre)}.%0A` +
    `Quiero hacer el siguiente pedido:%0A%0A` +
    `${lines}%0A%0A` +
    `Subtotal: ${encodeURIComponent(subTxt)}%0A` +
    `Delivery: Gratis 😄%0A` +
    `Total: ${encodeURIComponent(totalTxt)}%0A%0A` +
    `Dirección: ${encodeURIComponent(direccion)}%0A` +
    (referencia ? `Referencia: ${encodeURIComponent(referencia)}%0A` : "") +
    `%0A¿Me confirman el tiempo de entrega?`;

  const url = `https://wa.me/${WSP_NUMBER.replace("+", "")}?text=${msg}`;
  window.open(url, "_blank");
}

