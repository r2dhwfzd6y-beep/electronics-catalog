/*
 * НАСТРОЙКИ МАГАЗИНА
 * 1) Вставьте номер WhatsApp в формате страны + цифры, без +, пробелов и скобок.
 *    Пример: 79991234567
 * 2) Вставьте URL опубликованного Google Apps Script в SHEET_API_URL.
 *    Если оставить пустым, используется демонстрационный список ниже.
 */
const STORE_NAME = "Магазин электроники";
const CURRENCY = "RUB";
const WHATSAPP_NUMBER = ""; // например: "79991234567"
const SHEET_API_URL = "./products.json";

const SAMPLE_PRODUCTS = [
  { id:"demo-001", name:"Смартфон Nova X", brand:"Nova", model:"128 ГБ · чёрный", category:"Смартфоны", price:24990, stock:true, image:"", description:"Демонстрационный товар. Замените своими данными." },
  { id:"demo-002", name:"Беспроводные наушники", brand:"Sound", model:"Bluetooth · белые", category:"Аудио", price:4990, stock:true, image:"", description:"Демонстрационный товар. Замените своими данными." },
  { id:"demo-003", name:"Умные часы", brand:"Pulse", model:"AMOLED · графит", category:"Носимая электроника", price:7990, stock:true, image:"", description:"Демонстрационный товар. Замените своими данными." },
  { id:"demo-004", name:"Портативная колонка", brand:"Sound", model:"20 Вт · Bluetooth", category:"Аудио", price:3590, stock:false, image:"", description:"Демонстрационный товар. Замените своими данными." },
  { id:"demo-005", name:"Планшет", brand:"Nova", model:"10.9 дюйма · 256 ГБ", category:"Планшеты", price:21990, stock:true, image:"", description:"Демонстрационный товар. Замените своими данными." },
  { id:"demo-006", name:"Зарядное устройство", brand:"Volt", model:"USB-C · 65 Вт", category:"Аксессуары", price:1990, stock:true, image:"", description:"Демонстрационный товар. Замените своими данными." }
];

const $ = (id) => document.getElementById(id);
let products = [];
let selectedCategory = "Все товары";
let cart = new Map();
let toastTimeout;

function normalizeProduct(p, index) {
  const price = Number(String(p.price ?? p.Price ?? "0").replace(",", ".").replace(/[^\d.-]/g, ""));
  const rawStock = p.stock ?? p.Stock ?? p.inStock ?? p["В наличии"] ?? true;
  const stockText = String(rawStock).trim().toLowerCase();
  const stock = rawStock === true || rawStock === 1 || ["true","1","да","yes","в наличии","есть","available"].includes(stockText);
  return {
    id: String(p.id ?? p.sku ?? p.SKU ?? p.article ?? p["Артикул"] ?? `product-${index}`),
    name: String(p.name ?? p.Name ?? p["Название"] ?? "Товар без названия").trim(),
    brand: String(p.brand ?? p.Brand ?? p["Бренд"] ?? "").trim(),
    model: String(p.model ?? p.Model ?? p["Модель / характеристики"] ?? "").trim(),
    category: String(p.category ?? p.Category ?? p["Категория"] ?? "Другое").trim() || "Другое",
    price: Number.isFinite(price) ? Math.max(0, price) : 0,
    stock,
    image: String(p.image ?? p.Image ?? p.photo ?? p["Фото (URL)"] ?? "").trim(),
    description: String(p.description ?? p.Description ?? p["Описание"] ?? "").trim()
  };
}

function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU", { style:"currency", currency:CURRENCY, maximumFractionDigits:0 }).format(value);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch]));
}
function showToast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove("show"), 2400);
}
function getCartCount() {
  return [...cart.values()].reduce((sum, item) => sum + item.qty, 0);
}
function cartTotal() {
  return [...cart.values()].reduce((sum, item) => sum + item.product.price * item.qty, 0);
}
function currentProducts() {
  const q = $("searchInput").value.trim().toLowerCase();
  return products.filter(p => {
    const matchesCategory = selectedCategory === "Все товары" || p.category === selectedCategory;
    const haystack = [p.name,p.brand,p.model,p.category,p.id,p.description].join(" ").toLowerCase();
    return matchesCategory && haystack.includes(q);
  });
}
function renderCategories() {
  const categories = ["Все товары", ...new Set(products.map(p => p.category).filter(Boolean).sort((a,b) => a.localeCompare(b,"ru")))];
  if (!categories.includes(selectedCategory)) selectedCategory = "Все товары";
  $("categoryList").innerHTML = categories.map(c => `<button type="button" class="category-button ${c===selectedCategory?"active":""}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
  $("categoryList").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
    selectedCategory = btn.dataset.category;
    renderCategories();
    renderProducts();
  }));
}
function renderProducts() {
  const list = currentProducts();
  $("resultsCount").textContent = `Найдено товаров: ${list.length}`;
  $("clearSearch").hidden = !$("searchInput").value;
  $("productGrid").innerHTML = list.map(p => {
    const inCart = cart.has(p.id);
    const image = p.image
      ? `<img class="product-image" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;image-placeholder&quot;><span>▧</span><small>Фото не загружено</small></div>'">`
      : `<div class="image-placeholder"><span>▧</span><small>Фото товара</small></div>`;
    return `<article class="product-card">
      <div class="product-image-wrap">${image}<span class="stock-badge ${p.stock?"":"out"}">${p.stock?"В наличии":"Нет в наличии"}</span></div>
      <div class="product-info">
        <div class="product-category">${escapeHtml(p.category)}</div>
        <h2 class="product-name">${escapeHtml(p.name)}</h2>
        <div class="product-model">${escapeHtml([p.brand,p.model].filter(Boolean).join(" · ") || " " )}</div>
        <div class="product-bottom">
          <div class="product-price">${formatPrice(p.price)}</div>
          <button class="add-button ${inCart?"added":""}" type="button" data-add="${escapeHtml(p.id)}" ${p.stock?"":"disabled"}>${inCart?"✓ В корзине":"＋ Выбрать"}</button>
        </div>
      </div>
    </article>`;
  }).join("");
  $("emptyState").hidden = list.length !== 0;
  $("productGrid").hidden = list.length === 0;
  $("productGrid").querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => toggleProduct(btn.dataset.add)));
}
function toggleProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product || !product.stock) return;
  if (cart.has(id)) cart.delete(id);
  else cart.set(id, { product, qty:1 });
  renderProducts();
  renderCart();
  showToast(cart.has(id) ? "Добавлено в корзину" : "Убрано из корзины");
}
function renderCart() {
  const count = getCartCount();
  $("cartCount").textContent = count;
  $("cartCountTitle").textContent = `(${count})`;
  $("cartTotal").textContent = formatPrice(cartTotal());
  $("cartEmpty").hidden = count !== 0;
  $("cartItems").hidden = count === 0;
  $("whatsappOrder").disabled = count === 0;
  $("cartItems").innerHTML = [...cart.entries()].map(([id,item]) => {
    const p = item.product;
    const thumb = p.image ? `<img class="cart-thumb" src="${escapeHtml(p.image)}" alt="">` : `<div class="cart-thumb" style="display:grid;place-items:center;font-size:23px">▧</div>`;
    return `<div class="cart-item">
      ${thumb}
      <div>
        <div class="cart-item-name">${escapeHtml(p.name)}</div>
        <div class="cart-item-price">${formatPrice(p.price)} / шт.</div>
        <div class="quantity-controls">
          <button type="button" data-qty="-1" data-id="${escapeHtml(id)}" aria-label="Уменьшить количество">−</button>
          <span>${item.qty}</span>
          <button type="button" data-qty="1" data-id="${escapeHtml(id)}" aria-label="Увеличить количество">+</button>
        </div>
      </div>
      <button class="remove-item" type="button" data-remove="${escapeHtml(id)}" aria-label="Удалить товар">×</button>
    </div>`;
  }).join("");
  $("cartItems").querySelectorAll("[data-qty]").forEach(btn => btn.addEventListener("click", () => {
    const item = cart.get(btn.dataset.id);
    if (!item) return;
    item.qty += Number(btn.dataset.qty);
    if (item.qty <= 0) cart.delete(btn.dataset.id);
    renderCart(); renderProducts();
  }));
  $("cartItems").querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    cart.delete(btn.dataset.remove); renderCart(); renderProducts();
  }));
}
function openCart() {
  $("cartPanel").hidden = false;
  $("cartBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  $("closeCart").focus();
}
function closeCart() {
  $("cartPanel").hidden = true;
  $("cartBackdrop").hidden = true;
  document.body.style.overflow = "";
}
function orderOnWhatsApp() {
  if (!cart.size) return;
  if (!WHATSAPP_NUMBER || !/^\d{8,15}$/.test(WHATSAPP_NUMBER)) {
    showToast("Сначала укажите номер WhatsApp в app.js");
    $("whatsappNotice").textContent = "Не забудьте указать номер WhatsApp в настройках app.js. Формат: код страны и цифры, без +, пробелов и скобок.";
    $("whatsappNotice").style.color = "#b42318";
    return;
  }
  const lines = [...cart.values()].map((item,i) => `${i+1}. ${item.product.name}${item.product.model ? " ("+item.product.model+")" : ""} — ${item.qty} шт. × ${formatPrice(item.product.price)} = ${formatPrice(item.qty*item.product.price)}`);
  const name = $("customerName").value.trim();
  const message = [
    `Здравствуйте! Хочу заказать товары из каталога «${STORE_NAME}».`,
    name ? `Имя: ${name}` : "",
    "",
    ...lines,
    "",
    `Итого: ${formatPrice(cartTotal())}`,
    "",
    "Пожалуйста, подтвердите наличие и условия получения заказа."
  ].filter(line => line !== "").join("\n");
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
async function loadProducts(showMessage=false) {
  if (!SHEET_API_URL.trim()) {
    products = SAMPLE_PRODUCTS.map(normalizeProduct);
    renderCategories(); renderProducts(); renderCart();
    if (showMessage) showToast("Показаны демонстрационные товары");
    return;
  }
  try {
    const response = await fetch(SHEET_API_URL, { cache:"no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rows = Array.isArray(data) ? data : (data.products || data.items || []);
    products = rows.map(normalizeProduct).filter(p => p.name);
    // Keep cart in sync with current price and stock.
    for (const [id,item] of [...cart.entries()]) {
      const latest = products.find(p => p.id === id);
      if (!latest || !latest.stock) cart.delete(id);
      else item.product = latest;
    }
    renderCategories(); renderProducts(); renderCart();
    if (showMessage) showToast("Каталог обновлён");
  } catch (error) {
    console.error("Не удалось загрузить Google Sheets API:", error);
    if (!products.length) products = SAMPLE_PRODUCTS.map(normalizeProduct);
    renderCategories(); renderProducts(); renderCart();
    showToast("Не удалось обновить каталог — проверьте подключение таблицы");
  }
}
function init() {
  $("storeName").textContent = STORE_NAME;
  $("footerStoreName").textContent = STORE_NAME;
  $("year").textContent = new Date().getFullYear();
  $("searchInput").addEventListener("input", renderProducts);
  $("clearSearch").addEventListener("click", () => { $("searchInput").value=""; renderProducts(); $("searchInput").focus(); });
  $("resetFilters").addEventListener("click", () => { selectedCategory="Все товары"; $("searchInput").value=""; renderCategories(); renderProducts(); });
  $("openCart").addEventListener("click", openCart);
  $("closeCart").addEventListener("click", closeCart);
  $("cartBackdrop").addEventListener("click", closeCart);
  $("whatsappOrder").addEventListener("click", orderOnWhatsApp);
  $("clearCart").addEventListener("click", () => { cart.clear(); renderCart(); renderProducts(); });
  $("refreshBtn").addEventListener("click", () => loadProducts(true));
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeCart(); });
  $("whatsappNotice").textContent = WHATSAPP_NUMBER ? "Заказ откроется в WhatsApp. Перед отправкой проверьте список и сумму." : "Перед запуском укажите номер WhatsApp в файле app.js.";
  loadProducts();
  if (SHEET_API_URL) setInterval(() => loadProducts(false), REFRESH_EVERY_MS);
}
init();
