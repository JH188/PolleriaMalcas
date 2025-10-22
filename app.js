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

function emit(type, payload) {
  const msg = { type, payload, at: Date.now() };
  try { bc.postMessage(msg); } catch (e) { console.warn('[RT] BC postMessage falló', e); }
  try {
    localStorage.setItem('__malcas_bus__', JSON.stringify(msg));
    localStorage.removeItem('__malcas_bus__');
  } catch (e) { console.warn('[RT] storage fallback falló', e); }
}
function emitCart() {
  emit('cart_update', { cart, subtotal: subtotal() });
}
function saveOrderLocally(order) {
  const key = 'malcas_orders';
  let list = [];
  try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch(_){}
  list.unshift(order);
  localStorage.setItem(key, JSON.stringify(list));
  emit('order_new', order);
}

/* ====== UTILIDADES ====== */
const $  = (q, ctx = document) => ctx.querySelector(q);
const $$ = (q, ctx = document) => Array.from(ctx.querySelectorAll(q));
const money = n => `S/ ${Number(n).toFixed(2)}`;

/* ====== ESTADO DEL CARRITO ====== */
let cart = []; // [{name, price, qty, img}]
const DELIVERY = 0;

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
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const directMsg = "Hola, deseo hacer un pedido. ¿Me ayudan por favor? 😄";
  const numero = WSP_NUMBER.replace(/\D/g, "");
  const directLink = isMobile()
    ? `https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(directMsg)}`
    : `https://web.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(directMsg)}`;
  const wspDirect = $("#whatsapp-direct");
  const wspFloat  = $("#wsp-float");
  if (wspDirect) wspDirect.href = directLink;
  if (wspFloat)  wspFloat.href  = directLink;

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
        name:  card.dataset.name,
        price: Number(card.dataset.price),
        img:   card.querySelector("img")?.getAttribute("src") || "",
        qty:   1
      };
      addToCart(item);
    });
  });

  // Drawer carrito
  $("#openCart")?.addEventListener("click", openCart);
  $("#closeCart")?.addEventListener("click", closeCart);
  $("#overlay")?.addEventListener("click", closeCart);

  // Enviar por WhatsApp (con preventDefault)
  const sendBtn = $("#sendWhatsApp");
  if (sendBtn) sendBtn.addEventListener("click", (e)=>sendWhatsApp(e));

  // Quitar resaltado rojo al escribir
  ["#cliente","#direccion"].forEach(sel=>{
    const el = $(sel);
    if (el) el.addEventListener("input", ()=> el.classList.remove("invalid"));
  });
  $$('.pago-opciones input[name="pago"]').forEach(r => {
    r.addEventListener('change', ()=> {
      const grp = r.closest('.pago-opciones');
      grp?.classList.remove('invalid');
    });
  });

  renderCart();
  emitCart();
});

/* ====== FILTRAR ====== */
function applyFilters() {
  $$("#product-grid .card").forEach(c => {
    const byCat  = (currentFilter === "all") || (c.dataset.cat === currentFilter);
    const byText = c.dataset.name.toLowerCase().includes(currentSearch);
    c.style.display = (byCat && byText) ? "" : "none";
  });
}

/* ====== CARRITO ====== */
function addToCart(item) {
  const idx = cart.findIndex(p => p.name === item.name);
  if (idx > -1) cart[idx].qty++;
  else cart.push(item);

  saveCart();
  renderCart();
  emitCart();
  openCart();

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
  emitCart();
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
  emitCart();
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
  $("#subtotal") && ($("#subtotal").textContent = money(sub));
  $("#delivery") && ($("#delivery").textContent = "Gratis 😄");
  $("#grand")    && ($("#grand").textContent    = money(sub));
}

function openCart() {
  $("#cart")?.classList.add("open");
  $("#overlay")?.classList.add("show");

  const items = cart.map(p => ({ item_name: p.name, price: p.price, quantity: p.qty }));
  gaSafeEvent("begin_checkout", { currency: "PEN", value: subtotal(), items });
}
function closeCart() {
  $("#cart")?.classList.remove("open");
  $("#overlay")?.classList.remove("show");
}

/* ====== ENVIAR PEDIDO A WHATSAPP Y GUARDAR EN BACKEND ====== */
let sending = false; // evita dobles clics

function sendWhatsApp(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  if (sending) return;

  const nombreEl = $("#cliente");
  const dirEl    = $("#direccion");
  const pagoSel  = document.querySelector('input[name="pago"]:checked');

  const nombre    = (nombreEl?.value || "").trim();
  const direccion = (dirEl?.value || "").trim();
  const pago      = pagoSel?.value || "";

  // ---- VALIDACIONES ESTRICTAS ----
  if (cart.length === 0) {
    alert("Tu carrito está vacío. Agrega algún producto antes de enviar el pedido.");
    return;
  }

  // quitar resaltado previo
  nombreEl?.classList.remove("invalid");
  dirEl?.classList.remove("invalid");
  const pagoGroup = document.querySelector('.pago-opciones');
  pagoGroup?.classList.remove('invalid');

  let error = false;
  if (!nombre)    { nombreEl?.classList.add("invalid");    if (!error) nombreEl?.focus(); error = true; }
  if (!direccion) { dirEl?.classList.add("invalid");       if (!error) dirEl?.focus();    error = true; }
  if (!pago)      { pagoGroup?.classList.add("invalid");   if (!error) pagoGroup?.scrollIntoView({behavior:'smooth', block:'center'}); error = true; }

  if (error) {
    alert("Completa los datos del carrito (nombre, dirección y método de pago) para enviar por WhatsApp.");
    return; // ¡NO abre WhatsApp si falta algo!
  }

  // Construcción de mensaje y pedido
  const productos = cart.map(p => `${p.qty}x ${p.name}`).join(", ");
  const total     = subtotal().toFixed(2);

  const msg =
`🐔 *Nuevo Pedido de Pollería Malca’s*
👤 Nombre: ${nombre}
📍 Dirección: ${direccion}
🛒 Productos: ${productos}
💰 Total: S/ ${total}
💳 Pago: ${pago}

Gracias por su pedido ❤️`;

  const order = {
    id: "ORD-" + Date.now(),
    created_at: new Date().toISOString(),
    nombre, direccion, pago,
    items: cart.map(p => ({ name: p.name, price: p.price, qty: p.qty })),
    productos,
    total: Number(total)
  };
  saveOrderLocally(order);

  const items = cart.map(p => ({ item_name: p.name, price: p.price, quantity: p.qty }));
  gaSafeEvent("purchase", { transaction_id: order.id, currency: "PEN", value: subtotal(), items });

  // Evitar doble envío
  sending = true;
  const btn = $("#sendWhatsApp");
  const oldTxt = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }

  // (Opcional) Guardar en backend; si falla igual abrimos WhatsApp
  fetch("https://pollosmalcas.xyz/backend/guardar_pedido.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ nombre, direccion, pago, productos, total })
  })
  .then(r => r.text())
  .catch(err => console.error("Error al guardar pedido:", err))
  .finally(() => {
    // Solo se llega aquí si pasó VALIDACIÓN, así que ahora sí abrimos WhatsApp:
    openWhatsApp(msg);

    // limpiar carrito
    cart = [];
    saveCart();
    renderCart();
    emitCart();

    if (btn) { btn.disabled = false; btn.textContent = oldTxt || "Enviar pedido por WhatsApp"; }
    sending = false;
  });
}

