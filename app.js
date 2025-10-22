// ====== CONFIGURA TU NÚMERO DE WHATSAPP ======
const WSP_NUMBER = "51910006174"; // SIN +

// ====== GA4 helper (para enviar eventos de Analytics) ======
function gaSafeEvent(name, params = {}) {
  if (typeof gtag === "function") {
    try { gtag("event", name, params); } catch (_) {}
  } else {
    console.log("[GA4]", name, params);
  }
}

/* ====== Realtime Admin (entre pestañas del mismo dominio) ====== */
const bc = new BroadcastChannel('malcas_realtime');
function broadcast(type, payload) {
  try { bc.postMessage({ type, payload, at: Date.now() }); } catch (_) {}
}
function emitCart() {
  broadcast('cart_update', { cart, subtotal: subtotal() });
}
function saveOrderLocally(order) {
  const key = 'malcas_orders';
  let list = [];
  try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch(_){}
  list.unshift(order);
  localStorage.setItem(key, JSON.stringify(list));
  broadcast('order_new', order);
}

/* ====== UTILIDADES ====== */
const $ = (q, ctx = document) => ctx.querySelector(q);
const $$ = (q, ctx = document) => Array.from(ctx.querySelectorAll(q));
const money = n => `S/ ${Number(n).toFixed(2)}`;

/* ====== ESTADO DEL CARRITO ====== */
let cart = []; // [{name, price, qty, img}]
const DELIVERY = 0; // Delivery gratis

// Persistencia básica
try {
  const saved = localStorage.getItem("malcas_cart");
  if (saved) cart = JSON.parse(saved);
} catch (_) {}
const saveCart = () => localStorage.setItem("malcas_cart", JSON.stringify(cart));

/* ====== FILTROS / BUSCADOR ====== */
let currentFilter = "all";
let currentSearch = "";

/* ====== helpers WhatsApp ====== */
const MAX_MSG = 1200;
function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
}
function clampMsg(txt, max = MAX_MSG) {
  if (!txt) return "";
  return txt.length <= max ? txt : txt.slice(0, max - 20) + "… (mensaje resumido)";
}
let clicking = false;
function openWhatsApp(rawText) {
  if (clicking) return;
  clicking = true;

  const phone = WSP_NUMBER.replace(/\D/g, "");
  const msg = encodeURIComponent(clampMsg(rawText));

  if (isMobile()) {
    location.href = `whatsapp://send?phone=${phone}&text=${msg}`;
    setTimeout(() => {
      location.href = `https://api.whatsapp.com/send?phone=${phone}&text=${msg}`;
    }, 800);
  } else {
    location.href = `https://web.whatsapp.com/send?phone=${phone}&text=${msg}`;
    setTimeout(() => {
      location.href = `https://api.whatsapp.com/send?phone=${phone}&text=${msg}`;
    }, 1200);
  }
  setTimeout(() => (clicking = false), 2500);
}

/* ====== INICIAL ====== */
window.addEventListener("DOMContentLoaded", () => {
  // Año footer
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Botón WhatsApp flotante/directo (SIN wa.me)
  const directMsg = "Hola, deseo hacer un pedido. ¿Me ayudan por favor? 😄";
  const numero = WSP_NUMBER.replace(/\D/g, "");
  const directLink = isMobile()
    ? `https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(directMsg)}`
    : `https://web.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(directMsg)}`;
  const wspDirect = $("#whatsapp-direct");
  const wspFloat = $("#wsp-float");
  if (wspDirect) wspDirect.href = directLink;
  if (wspFloat) wspFloat.href = directLink;

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

  // Render inicial + emitir carrito al admin
  renderCart();
  emitCart();
});

/* ====== FILTRAR ====== */
function applyFilters() {
  $$("#product-grid .card").forEach(c => {
    const byCat = (currentFilter === "all") || (c.dataset.cat === currentFilter);
    const byText = c.dataset.name.toLowerCase().includes(currentSearch);
    c.style.display = (byCat && byText) ? "" : "none";
  });
}

/* ====== CARRITO ====== */
function addToCart(item) {
  const idx = cart.findIndex(p => p.name === item.name);
  if (idx > -1) {
    cart[idx].qty++;
  } else {
    cart.push(item);
  }
  saveCart();
  renderCart();
  emitCart();  // realtime admin
  openCart();

  // ---- GA4: add_to_cart
  gaSafeEvent("add_to_cart", {
    currency: "PEN",
    value: item.price,
    items: [{ item_name: item.name, price: item.price, quantity: 1 }]
  });
}

function removeFromCart(name) {
  cart = cart.filter(p => p.name !== name);
  saveCart();
  renderCart();
  emitCart();  // realtime admin
}

function changeQty(name, delta) {
  const it = cart.find(p => p.name === name);
  if (!it) return;
  it.qty += delta;
  if (it.qty <= 0) {
    removeFromCart(it.name);
    return;
  }
  saveCart();
  renderCart();
  emitCart();  // realtime admin
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

  // ---- GA4: begin_checkout
  const items = cart.map(p => ({
    item_name: p.name,
    price: p.price,
    quantity: p.qty
  }));
  gaSafeEvent("begin_checkout", {
    currency: "PEN",
    value: subtotal(),
    items
  });
}
function closeCart() {
  $("#cart")?.classList.remove("open");
  $("#overlay")?.classList.remove("show");
}

/* ====== ENVIAR PEDIDO A WHATSAPP Y GUARDAR EN BACKEND ====== */
function sendWhatsApp() {
  const nombre = $("#cliente")?.value.trim();
  const direccion = $("#direccion")?.value.trim();
  const pago = document.querySelector('input[name="pago"]:checked')?.value;

  if (!nombre || !direccion || !pago) {
    alert("Por favor completa todos los campos antes de enviar el pedido.");
    return;
  }

  // Obtener productos y total
  const productos = cart.map(p => `${p.qty}x ${p.name}`).join(", ");
  const total = subtotal().toFixed(2);

  // Mensaje de WhatsApp (texto plano; lo codificamos dentro de openWhatsApp)
  const msg =
`🐔 *Nuevo Pedido de Pollería Malca’s*
👤 Nombre: ${nombre}
📍 Dirección: ${direccion}
🛒 Productos: ${productos}
💰 Total: S/ ${total}
💳 Pago: ${pago}

Gracias por su pedido ❤️`;

  // ===== construir pedido para admin (local + realtime)
  const order = {
    id: "ORD-" + Date.now(),
    created_at: new Date().toISOString(),
    nombre,
    direccion,
    pago,
    items: cart.map(p => ({ name: p.name, price: p.price, qty: p.qty })),
    productos,               // string legible
    total: Number(total)
  };
  saveOrderLocally(order);   // guarda y emite a admin.html

  // ===== GA4: purchase (antes de abrir WhatsApp)
  const items = cart.map(p => ({
    item_name: p.name,
    price: p.price,
    quantity: p.qty
  }));
  gaSafeEvent("purchase", {
    transaction_id: order.id,
    currency: "PEN",
    value: subtotal(),
    items
  });

  // ===== Guardar en BD (opcional si tu backend está activo)
  fetch("https://pollosmalcas.xyz/backend/guardar_pedido.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ nombre, direccion, pago, productos, total })
  })
    .then(res => res.text())
    .then(res => {
      console.log("Respuesta del servidor:", res);
      alert("✅ Pedido guardado. Abriendo WhatsApp…");
      openWhatsApp(msg);

      // limpiar carrito
      cart = [];
      saveCart();
      renderCart();
      emitCart();
    })
    .catch(err => {
      console.error("Error al guardar pedido:", err);
      // Incluso si falla el backend, abrimos WhatsApp para no perder el pedido
      openWhatsApp(msg);

      // limpiar carrito
      cart = [];
      saveCart();
      renderCart();
      emitCart();
    });
}

