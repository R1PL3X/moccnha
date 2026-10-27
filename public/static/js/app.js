/**
 * MOHO Storefront Frontend Application
 * Features: Dark Mode, Product Catalog, Live Search, Cart Drawer, Checkout, Auth, Quick View
 */

const STATE = {
  products: [],
  filteredProducts: [],
  cart: JSON.parse(localStorage.getItem('moho_cart')) || [],
  user: JSON.parse(localStorage.getItem('moho_user')) || null,
  activeCategory: 'all',
  activeSort: 'default',
  searchQuery: '',
  theme: localStorage.getItem('moho_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initScrollHeader();
  fetchCategories();
  fetchProducts();
  renderCart();
  updateAuthUI();
  setupEventListeners();
  fetch('/api/db-status').then(r => r.json()).then(d => {
    console.log(`%c[MOHO Database] %c${d.mode.toUpperCase()}%c - ${d.description}`, 'color:#a0673d;font-weight:bold', 'color:#10b981;font-weight:bold', 'color:#6b7280');
  }).catch(() => {});
});

// --- THEME / DARK MODE ---
function initTheme() {
  const html = document.documentElement;
  if (STATE.theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  updateThemeIcons();
}

function toggleTheme() {
  const html = document.documentElement;
  if (html.classList.contains('dark')) {
    html.classList.remove('dark');
    STATE.theme = 'light';
  } else {
    html.classList.add('dark');
    STATE.theme = 'dark';
  }
  localStorage.setItem('moho_theme', STATE.theme);
  updateThemeIcons();
  showToast(STATE.theme === 'dark' ? '🌙 Đã bật chế độ Dark Mode' : '☀️ Đã bật chế độ Light Mode', 'info');
}

function updateThemeIcons() {
  const themeToggles = document.querySelectorAll('.theme-toggle-btn');
  themeToggles.forEach(btn => {
    const sunIcon = btn.querySelector('.sun-icon');
    const moonIcon = btn.querySelector('.moon-icon');
    const textLabel = btn.querySelector('.theme-text');
    if (STATE.theme === 'dark') {
      if (sunIcon) sunIcon.classList.remove('hidden');
      if (moonIcon) moonIcon.classList.add('hidden');
      if (textLabel) textLabel.textContent = 'Giao diện sáng';
    } else {
      if (sunIcon) sunIcon.classList.add('hidden');
      if (moonIcon) moonIcon.classList.remove('hidden');
      if (textLabel) textLabel.textContent = 'Giao diện tối';
    }
  });
}

// --- HEADER SCROLL EFFECT ---
function initScrollHeader() {
  const header = document.getElementById('mainHeader');
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
      scrollTopBtn?.classList.remove('opacity-0', 'pointer-events-none');
    } else {
      header?.classList.remove('scrolled');
      scrollTopBtn?.classList.add('opacity-0', 'pointer-events-none');
    }
  });
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- DATA FETCHING ---
async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();
    renderCategoriesDropdown(categories);
  } catch (err) {
    console.error('Lỗi tải danh mục:', err);
  }
}

async function fetchProducts() {
  try {
    const container = document.getElementById('productGrid');
    if (container) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-400">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-600 border-t-transparent"></div>
          <p class="mt-2 text-sm">Đang tải sản phẩm MOHO...</p>
        </div>
      `;
    }

    let url = `/api/products?sort=${STATE.activeSort}`;
    if (STATE.activeCategory !== 'all') {
      url += `&category=${encodeURIComponent(STATE.activeCategory)}`;
    }
    if (STATE.searchQuery) {
      url += `&search=${encodeURIComponent(STATE.searchQuery)}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    STATE.products = data;
    renderProducts(data);
    renderPromoSection(data);
  } catch (err) {
    console.error('Lỗi khi tải sản phẩm:', err);
    showToast('Không thể tải danh sách sản phẩm', 'error');
  }
}

// --- RENDERING PRODUCTS ---
function formatPrice(number) {
  return new Intl.NumberFormat('vi-VN').format(number) + '₫';
}

function renderProducts(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p class="mt-3 text-base font-medium text-gray-500 dark:text-gray-400">Không tìm thấy sản phẩm nào phù hợp</p>
        <button onclick="resetFilters()" class="mt-4 px-4 py-2 bg-amber-700 text-white rounded-md text-sm hover:bg-amber-800">
          Xem tất cả sản phẩm
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(product => {
    // Generate color swatches dots if available
    let colorsHtml = '';
    if (product.colors && Array.isArray(product.colors) && product.colors.length > 0) {
      colorsHtml = `
        <div class="flex items-center gap-1.5 mt-2">
          ${product.colors.map((c, i) => `
            <span class="color-dot ${i === 0 ? 'active' : ''}" style="background-color: ${c.hex};" title="${c.name}"></span>
          `).join('')}
        </div>
      `;
    }

    // Generate stars
    const starsHtml = Array.from({ length: 5 }, (_, i) => `
      <svg class="w-3.5 h-3.5 ${i < Math.floor(product.rating || 5) ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    `).join('');

    return `
      <div class="product-card rounded-md overflow-hidden flex flex-col justify-between group">
        <div>
          <!-- Image Wrapper with Discount Badge -->
          <div class="product-img-wrapper relative cursor-pointer" onclick="openProductDetail(${product.id})">
            ${product.discount_percent > 0 ? `
              <span class="absolute top-2.5 left-2.5 discount-badge z-10 shadow-sm">
                -${product.discount_percent}%
              </span>
            ` : ''}
            
            <img 
              src="${product.image}" 
              alt="${product.title}" 
              loading="lazy"
              class="w-full h-full object-cover"
              onerror="this.src='https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800'"
            />

            <!-- Hover Quick Action Buttons -->
            <div class="product-overlay-actions absolute inset-x-3 bottom-3 flex gap-2 z-10">
              <button 
                onclick="event.stopPropagation(); quickAddToCart(${product.id})" 
                class="flex-1 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold py-2.5 px-3 rounded shadow-lg transition flex items-center justify-center gap-1.5"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Thêm vào giỏ
              </button>
              <button 
                onclick="event.stopPropagation(); openProductDetail(${product.id})" 
                class="bg-white/90 hover:bg-white text-gray-800 text-xs font-semibold py-2.5 px-3 rounded shadow-lg transition dark:bg-zinc-800/90 dark:text-white dark:hover:bg-zinc-800"
                title="Xem nhanh"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Product Meta & Info -->
          <div class="p-3.5">
            <h3 
              class="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 hover:text-amber-800 dark:hover:text-amber-500 cursor-pointer transition min-h-[40px]" 
              onclick="openProductDetail(${product.id})"
              title="${product.title}"
            >
              ${product.title}
            </h3>

            <!-- Price and Sold -->
            <div class="mt-2 flex items-baseline justify-between flex-wrap gap-1">
              <div class="flex items-baseline gap-2">
                <span class="sale-price">${formatPrice(product.price)}</span>
                ${product.original_price > product.price ? `
                  <span class="old-price">${formatPrice(product.original_price)}</span>
                ` : ''}
              </div>
              <span class="text-[12px] text-gray-500 dark:text-gray-400">
                Đã bán ${product.sold_count || 0}
              </span>
            </div>

            <!-- Review Stars & Color swatches if any -->
            <div class="mt-2 flex items-center justify-between">
              <div class="flex items-center gap-1">
                <div class="flex items-center">${starsHtml}</div>
                ${product.review_count > 0 ? `
                  <span class="text-[11px] text-gray-500 dark:text-gray-400">(${product.review_count})</span>
                ` : ''}
              </div>
              ${colorsHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPromoSection(products) {
  const promoGrid = document.getElementById('promoGrid');
  if (!promoGrid) return;

  const promoProducts = products.filter(p => p.discount_percent >= 20).slice(0, 4);
  if (promoProducts.length === 0) return;

  promoGrid.innerHTML = promoProducts.map(product => `
    <div class="product-card rounded-md overflow-hidden flex flex-col justify-between group">
      <div class="product-img-wrapper relative cursor-pointer" onclick="openProductDetail(${product.id})">
        <span class="absolute top-2.5 left-2.5 discount-badge z-10 shadow-sm">
          -${product.discount_percent}%
        </span>
        <img 
          src="${product.image}" 
          alt="${product.title}" 
          class="w-full h-full object-cover"
        />
        <div class="product-overlay-actions absolute inset-x-3 bottom-3 flex gap-2 z-10">
          <button 
            onclick="event.stopPropagation(); quickAddToCart(${product.id})" 
            class="flex-1 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold py-2 px-3 rounded shadow transition"
          >
            Thêm vào giỏ
          </button>
        </div>
      </div>
      <div class="p-3">
        <h3 class="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-1 hover:text-amber-800 cursor-pointer" onclick="openProductDetail(${product.id})">
          ${product.title}
        </h3>
        <div class="mt-1 flex items-baseline justify-between">
          <span class="sale-price text-sm">${formatPrice(product.price)}</span>
          <span class="old-price text-xs">${formatPrice(product.original_price)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderCategoriesDropdown(categories) {
  const container = document.getElementById('categoriesDropdownMenu');
  if (!container) return;

  container.innerHTML = categories.map(cat => `
    <a 
      href="javascript:void(0)" 
      onclick="filterCategory('${cat.name}')" 
      class="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-zinc-800 hover:text-amber-800 transition"
    >
      <span>${cat.name}</span>
      <span class="text-xs bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-gray-300 px-2 py-0.5 rounded-full">${cat.product_count}</span>
    </a>
  `).join('');

  // Mobile / Filter pills
  const filterPills = document.getElementById('categoryFilterPills');
  if (filterPills) {
    filterPills.innerHTML = `
      <button 
        onclick="filterCategory('all')" 
        class="category-pill whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition ${STATE.activeCategory === 'all' ? 'bg-amber-800 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}"
      >
        Tất cả
      </button>
      ${categories.map(cat => `
        <button 
          onclick="filterCategory('${cat.name}')" 
          class="category-pill whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition ${STATE.activeCategory === cat.name ? 'bg-amber-800 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}"
        >
          ${cat.name}
        </button>
      `).join('')}
    `;
  }
}

// --- FILTER & SORT ACTIONS ---
function filterCategory(catName) {
  STATE.activeCategory = catName;
  const currentCategoryLabel = document.getElementById('currentCategoryTitle');
  if (currentCategoryLabel) {
    currentCategoryLabel.textContent = catName === 'all' ? 'Tất cả sản phẩm' : catName;
  }
  fetchProducts();

  // Scroll smoothly to products section
  document.getElementById('bestsellerSection')?.scrollIntoView({ behavior: 'smooth' });
}

function handleSortChange(sortVal) {
  STATE.activeSort = sortVal;
  fetchProducts();
}

function resetFilters() {
  STATE.activeCategory = 'all';
  STATE.searchQuery = '';
  STATE.activeSort = 'default';
  const searchInput = document.getElementById('headerSearchInput');
  if (searchInput) searchInput.value = '';
  fetchProducts();
}

// --- LIVE SEARCH ---
function setupEventListeners() {
  const searchInput = document.getElementById('headerSearchInput');
  const searchDropdown = document.getElementById('searchDropdownResults');

  if (searchInput && searchDropdown) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      if (query.length < 2) {
        searchDropdown.classList.add('hidden');
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
          const matches = await res.json();
          renderSearchDropdown(matches, query);
        } catch (err) {
          console.error(err);
        }
      }, 250);
    });

    // Close search dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.add('hidden');
      }
    });

    // Submit search on Enter
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerSearch(searchInput.value.trim());
        searchDropdown.classList.add('hidden');
      }
    });
  }

  // Close user dropdown on click outside
  document.addEventListener('click', (e) => {
    const userSection = document.getElementById('headerUserSection');
    if (userSection && !userSection.contains(e.target)) {
      closeUserDropdown();
    }
  });
}

function renderSearchDropdown(matches, query) {
  const searchDropdown = document.getElementById('searchDropdownResults');
  if (!searchDropdown) return;

  if (matches.length === 0) {
    searchDropdown.innerHTML = `
      <div class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
        Không có sản phẩm nào khớp với "<strong>${query}</strong>"
      </div>
    `;
  } else {
    searchDropdown.innerHTML = `
      <div class="p-2 border-b border-gray-100 dark:border-zinc-700 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Gợi ý sản phẩm (${matches.length})
      </div>
      <div class="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800">
        ${matches.slice(0, 6).map(p => `
          <div 
            onclick="openProductDetail(${p.id}); document.getElementById('searchDropdownResults').classList.add('hidden');" 
            class="flex items-center gap-3 p-3 hover:bg-amber-50 dark:hover:bg-zinc-800/80 cursor-pointer transition"
          >
            <img src="${p.image}" class="w-12 h-12 object-cover rounded" alt="${p.title}" />
            <div class="flex-1 min-w-0">
              <h4 class="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">${p.title}</h4>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs font-bold text-red-600 dark:text-red-400">${formatPrice(p.price)}</span>
                ${p.discount_percent > 0 ? `<span class="text-[11px] line-through text-gray-400">${formatPrice(p.original_price)}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="p-2.5 bg-gray-50 dark:bg-zinc-900 text-center border-t border-gray-100 dark:border-zinc-800">
        <button onclick="triggerSearch('${query}'); document.getElementById('searchDropdownResults').classList.add('hidden');" class="text-xs text-amber-800 dark:text-amber-500 font-semibold hover:underline">
          Xem tất cả kết quả cho "${query}" &rarr;
        </button>
      </div>
    `;
  }
  searchDropdown.classList.remove('hidden');
}

function triggerSearch(keyword) {
  STATE.searchQuery = keyword;
  fetchProducts();
  document.getElementById('bestsellerSection')?.scrollIntoView({ behavior: 'smooth' });
}

// --- SHOPPING CART LOGIC ---
function quickAddToCart(productId) {
  const product = STATE.products.find(p => p.id === productId);
  if (!product) return;

  const defaultColor = (product.colors && product.colors.length > 0) ? product.colors[0].name : 'Tiêu chuẩn';
  addToCart(product, defaultColor, 1);
}

function addToCart(product, selectedColor = 'Mặc định', quantity = 1) {
  const existingIndex = STATE.cart.findIndex(
    item => item.id === product.id && item.color === selectedColor
  );

  if (existingIndex > -1) {
    STATE.cart[existingIndex].quantity += quantity;
  } else {
    STATE.cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      original_price: product.original_price,
      image: product.image,
      color: selectedColor,
      quantity: quantity
    });
  }

  saveCart();
  renderCart();
  showToast(`Đã thêm "${product.title}" vào giỏ hàng!`, 'success');
  openCartDrawer();
}

function updateCartQuantity(index, delta) {
  if (!STATE.cart[index]) return;
  STATE.cart[index].quantity += delta;
  if (STATE.cart[index].quantity <= 0) {
    removeFromCart(index);
    return;
  }
  saveCart();
  renderCart();
}

function removeFromCart(index) {
  STATE.cart.splice(index, 1);
  saveCart();
  renderCart();
  showToast('Đã xóa sản phẩm khỏi giỏ hàng', 'info');
}

function saveCart() {
  localStorage.setItem('moho_cart', JSON.stringify(STATE.cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-badge');
  const count = STATE.cart.reduce((sum, item) => sum + item.quantity, 0);
  badges.forEach(badge => {
    badge.textContent = count;
    if (count > 0) {
      badge.classList.remove('scale-0');
      badge.classList.add('scale-100');
    } else {
      badge.textContent = '0';
    }
  });
}

function renderCart() {
  updateCartBadge();
  const cartList = document.getElementById('cartDrawerItems');
  const cartSubtotal = document.getElementById('cartDrawerSubtotal');
  const cartFreeShipping = document.getElementById('freeShippingProgressBar');
  const cartFreeShippingText = document.getElementById('freeShippingText');

  if (!cartList) return;

  const total = STATE.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  if (cartSubtotal) cartSubtotal.textContent = formatPrice(total);

  // Free shipping threshold: 2,000,000 VND
  const threshold = 2000000;
  if (cartFreeShipping && cartFreeShippingText) {
    if (total >= threshold) {
      cartFreeShipping.style.width = '100%';
      cartFreeShippingText.innerHTML = `🎉 <strong>Chúc mừng!</strong> Bạn đã được <strong>Miễn phí vận chuyển</strong>`;
    } else {
      const remaining = threshold - total;
      const percent = Math.min(100, Math.round((total / threshold) * 100));
      cartFreeShipping.style.width = `${percent}%`;
      cartFreeShippingText.innerHTML = `Mua thêm <strong>${formatPrice(remaining)}</strong> để được <strong>Miễn phí vận chuyển</strong>`;
    }
  }

  if (STATE.cart.length === 0) {
    cartList.innerHTML = `
      <div class="py-12 text-center text-gray-400">
        <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-zinc-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Giỏ hàng của bạn đang trống</p>
        <button onclick="closeCartDrawer()" class="mt-4 px-4 py-2 bg-amber-800 text-white rounded text-xs font-semibold hover:bg-amber-900 transition">
          Khám phá mua sắm ngay
        </button>
      </div>
    `;
    return;
  }

  cartList.innerHTML = STATE.cart.map((item, index) => `
    <div class="flex gap-3 py-3 border-b border-gray-100 dark:border-zinc-800 items-center">
      <img src="${item.image}" alt="${item.title}" class="w-16 h-16 object-cover rounded bg-gray-50 dark:bg-zinc-800" />
      <div class="flex-1 min-w-0">
        <h4 class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">${item.title}</h4>
        <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Phân loại: ${item.color}</p>
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs font-bold text-red-600 dark:text-red-400">${formatPrice(item.price)}</span>
          
          <!-- Quantity buttons -->
          <div class="flex items-center border border-gray-200 dark:border-zinc-700 rounded overflow-hidden">
            <button onclick="updateCartQuantity(${index}, -1)" class="w-6 h-6 flex items-center justify-center bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 text-xs text-gray-600 dark:text-gray-300">-</button>
            <span class="w-8 text-center text-xs font-medium text-gray-800 dark:text-gray-200">${item.quantity}</span>
            <button onclick="updateCartQuantity(${index}, 1)" class="w-6 h-6 flex items-center justify-center bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 text-xs text-gray-600 dark:text-gray-300">+</button>
          </div>
        </div>
      </div>
      <button onclick="removeFromCart(${index})" class="text-gray-400 hover:text-red-500 p-1 transition" title="Xóa">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  `).join('');
}

// --- SIDE MENU (LEFT DRAWER - THU MỞ) ---
function openSideMenu() {
  const drawer = document.getElementById('sideMenuDrawer');
  const panel = document.getElementById('sideMenuPanel');
  if (drawer && panel) {
    drawer.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => {
      drawer.classList.remove('opacity-0');
      panel.firstElementChild?.classList.remove('-translate-x-full');
    }, 10);
  }
}

function closeSideMenu() {
  const drawer = document.getElementById('sideMenuDrawer');
  const panel = document.getElementById('sideMenuPanel');
  if (drawer && panel) {
    panel.firstElementChild?.classList.add('-translate-x-full');
    drawer.classList.add('opacity-0');
    document.body.classList.remove('overflow-hidden');
    setTimeout(() => {
      drawer.classList.add('hidden');
    }, 300);
  }
}

function toggleSideMenu() {
  const drawer = document.getElementById('sideMenuDrawer');
  if (drawer && !drawer.classList.contains('hidden') && !drawer.classList.contains('opacity-0')) {
    closeSideMenu();
  } else {
    openSideMenu();
  }
}

function filterCategoryFromMenu(catName) {
  closeSideMenu();
  if (window.location.pathname !== '/' && window.location.pathname !== '') {
    window.location.href = `/?category=${encodeURIComponent(catName)}`;
  } else {
    filterCategory(catName);
  }
}

function openCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const panel = document.getElementById('cartDrawerPanel');
  if (drawer && panel) {
    drawer.classList.remove('hidden');
    setTimeout(() => {
      drawer.classList.remove('opacity-0');
      panel.classList.remove('translate-x-full');
    }, 10);
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const panel = document.getElementById('cartDrawerPanel');
  if (drawer && panel) {
    panel.classList.add('translate-x-full');
    drawer.classList.add('opacity-0');
    setTimeout(() => {
      drawer.classList.add('hidden');
    }, 300);
  }
}

// --- QUICK VIEW / PRODUCT DETAIL MODAL ---
let currentDetailProduct = null;
let selectedDetailColor = null;

async function openProductDetail(productId) {
  try {
    const res = await fetch(`/api/products/${productId}`);
    const product = await res.json();
    currentDetailProduct = product;
    selectedDetailColor = (product.colors && product.colors.length > 0) ? product.colors[0].name : 'Mặc định';

    const modal = document.getElementById('productDetailModal');
    const content = document.getElementById('productDetailContent');

    const galleryImages = (product.gallery && product.gallery.length > 0) ? product.gallery : [product.image];

    // Highlights matching the user's uploaded image
    const highlights = (product.highlights && Array.isArray(product.highlights) && product.highlights.length > 0) 
      ? product.highlights 
      : [
          {
            title: "Hiệu ứng thị giác 3D độc quyền",
            content: "Điểm nhấn nổi bật nhất nằm ở các mảng veneer gỗ tràm được thợ thủ công ghép đan chéo đối xứng tỉ mỉ trên thân giường, đầu giường và mặt tủ. Nghệ thuật hình học này mang đến hiệu ứng 3D ấn tượng, tạo ra sự chuyển biến màu sắc tinh tế và khác biệt từ mọi góc nhìn."
          },
          {
            title: "Thẩm mỹ tối giản và chuyên nghiệp",
            content: "Lấy cảm hứng từ những ngôi nhà Viking Bắc Âu, bộ combo HOBRO là sự giao thoa hoàn hảo giữa nét cổ điển Mid-Century Modern và phong cách hiện đại. Tone màu nâu trung tính, mộc mạc dễ dàng làm nền tảng cho một không gian phòng ngủ mang tính thẩm mỹ cao, tinh gọn và sang trọng."
          },
          {
            title: "Tiêu chuẩn an toàn CARB-P2 và EPA",
            content: "Được kiểm nghiệm nồng độ phát thải Formaldehyde gần như bằng 0, an toàn tuyệt đối cho gia đình có trẻ nhỏ và người lớn tuổi. Khung gỗ tự nhiên nguyên khối chịu lực cao."
          }
        ];

    const detailImage = product.detail_image || product.image;
    const fullTitle = product.full_title || product.title;

    content.innerHTML = `
      <div class="p-6">
        <!-- TOP SECTION: Gallery & Purchasing Actions -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <!-- Gallery -->
          <div>
            <div class="aspect-square rounded-lg overflow-hidden bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 shadow-sm">
              <img id="detailMainImage" src="${galleryImages[0]}" alt="${product.title}" class="w-full h-full object-cover transition duration-300" />
            </div>
            ${galleryImages.length > 1 ? `
              <div class="flex gap-2.5 mt-3 overflow-x-auto pb-1 scrollbar-none">
                ${galleryImages.map((img, i) => `
                  <img 
                    src="${img}" 
                    onclick="document.getElementById('detailMainImage').src = '${img}'" 
                    class="w-16 h-16 object-cover rounded cursor-pointer border-2 hover:border-amber-600 transition ${i === 0 ? 'border-amber-600' : 'border-transparent'}"
                  />
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Info & Actions -->
          <div class="flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs uppercase tracking-wider font-semibold text-amber-800 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded">
                  Bộ Sưu Tập ${product.collection || 'MOHO'}
                </span>
                ${product.discount_percent > 0 ? `
                  <span class="discount-badge">-${product.discount_percent}%</span>
                ` : ''}
              </div>

              <h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-2 leading-snug">
                ${product.title}
              </h2>

              <div class="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span class="flex items-center text-amber-500 font-semibold">
                  ★ ${product.rating || 5.0} (${product.review_count || 34} đánh giá)
                </span>
                <span>|</span>
                <span>Đã bán: <strong>${product.sold_count || 0}</strong></span>
                <span>|</span>
                <span class="text-emerald-600 dark:text-emerald-400 font-medium">✓ Còn hàng</span>
              </div>

              <div class="mt-4 p-3.5 bg-gray-50 dark:bg-zinc-800/60 rounded-lg flex items-baseline gap-3">
                <span class="text-2xl font-extrabold text-red-600 dark:text-red-400">${formatPrice(product.price)}</span>
                ${product.original_price > product.price ? `
                  <span class="text-sm line-through text-gray-400">${formatPrice(product.original_price)}</span>
                ` : ''}
              </div>

              <!-- Color Options -->
              ${product.colors && product.colors.length > 0 ? `
                <div class="mt-4">
                  <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Màu sắc: <span id="selectedColorName" class="font-normal text-amber-700 dark:text-amber-400">${selectedDetailColor}</span>
                  </label>
                  <div class="flex items-center gap-2">
                    ${product.colors.map((c, i) => `
                      <button 
                        type="button" 
                        onclick="selectColor('${c.name}', this)" 
                        class="color-picker-opt flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition ${i === 0 ? 'border-amber-700 bg-amber-50/50 dark:bg-zinc-800 font-medium' : 'border-gray-200 dark:border-zinc-700'}"
                      >
                        <span class="w-3.5 h-3.5 rounded-full inline-block border shadow-sm" style="background-color: ${c.hex}"></span>
                        ${c.name}
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Specs Summary -->
              <div class="mt-4 space-y-1.5 text-xs text-gray-600 dark:text-gray-300 border-t border-b border-gray-100 dark:border-zinc-700 py-3">
                <div><strong>Chất liệu:</strong> ${product.material || 'Gỗ tự nhiên cao cấp'}</div>
                <div><strong>Kích thước:</strong> ${product.dimensions || 'Tiêu chuẩn'}</div>
                <div><strong>Bảo hành:</strong> 2 năm, bảo trì trọn đời</div>
              </div>

              <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 line-clamp-2">
                ${product.description}
              </p>
            </div>

            <!-- Quantity & Actions -->
            <div class="mt-6 pt-4 space-y-3">
              <div class="flex items-center gap-3">
                <div class="flex items-center border border-gray-300 dark:border-zinc-600 rounded-lg overflow-hidden h-11">
                  <button onclick="changeDetailQty(-1)" class="w-10 h-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 font-bold">-</button>
                  <input id="detailQuantityInput" type="number" value="1" min="1" class="w-12 text-center text-sm font-semibold bg-transparent dark:text-white border-none focus:outline-none" />
                  <button onclick="changeDetailQty(1)" class="w-10 h-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 font-bold">+</button>
                </div>

                <button 
                  onclick="addCurrentDetailToCart()" 
                  class="flex-1 h-11 bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-md transition flex items-center justify-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Thêm vào giỏ hàng
                </button>
              </div>

              <button 
                onclick="buyNowCurrentProduct()" 
                class="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm rounded-lg shadow transition"
              >
                Mua ngay - Thanh toán nhanh
              </button>
            </div>
          </div>
        </div>

        <!-- BOTTOM SECTION: DETAILED DESCRIPTION TABS (Replicating user's uploaded screenshot) -->
        <div class="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden mt-8">
          
          <!-- Tab Navigation Bar -->
          <div class="flex border-b border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900 text-xs sm:text-sm font-medium">
            <button 
              id="tabDescBtn" 
              onclick="switchDetailTab('desc')" 
              class="px-6 py-3 bg-gray-200/70 dark:bg-zinc-800 text-gray-900 dark:text-white font-bold border-r border-gray-200 dark:border-zinc-700 transition"
            >
              Mô tả
            </button>
            <button 
              id="tabStoreBtn" 
              onclick="switchDetailTab('store')" 
              class="px-6 py-3 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white border-r border-gray-200 dark:border-zinc-700 transition"
            >
              Tìm cửa hàng
            </button>
            <button 
              id="tabReviewBtn" 
              onclick="switchDetailTab('review')" 
              class="px-6 py-3 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition"
            >
              Đánh giá (${product.review_count || 34})
            </button>
          </div>

          <!-- TAB CONTENT 1: MÔ TẢ (Replicating user's screenshot layout and typography) -->
          <div id="detailTabDesc" class="p-6 sm:p-8 bg-white dark:bg-zinc-900">
            <!-- Centered Subtitle Header -->
            <div class="text-center text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 mb-6 tracking-wide">
              ${fullTitle}
            </div>

            <!-- "Đặc điểm nổi bật" Heading -->
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-5 tracking-tight">
              Đặc điểm nổi bật
            </h3>

            <!-- Highlights Paragraphs with Bold Prefix -->
            <div class="space-y-4 text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed text-justify">
              ${highlights.map(h => `
                <p>
                  <strong class="text-gray-900 dark:text-white font-bold">${h.title}:</strong>
                  ${h.content}
                </p>
              `).join('')}
            </div>

            <!-- Lifestyle Image Showcase (Matches the veneer/bedroom photo in screenshot) -->
            <div class="mt-8 rounded-lg overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm">
              <img 
                src="${detailImage}" 
                alt="${product.title}" 
                class="w-full object-cover max-h-[500px]"
                onerror="this.src='https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?q=80&w=1200'"
              />
            </div>

            <!-- Detailed Specifications Table -->
            <div class="mt-8 border-t border-gray-100 dark:border-zinc-800 pt-6">
              <h4 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Thông số kỹ thuật chi tiết
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div class="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Bộ sưu tập:</span>
                  <span class="font-semibold text-gray-900 dark:text-white">${product.collection || 'MOHO'}</span>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Chất liệu:</span>
                  <span class="font-semibold text-gray-900 dark:text-white">${product.material || 'Gỗ tự nhiên'}</span>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Kích thước:</span>
                  <span class="font-semibold text-gray-900 dark:text-white">${product.dimensions || 'Tiêu chuẩn'}</span>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Tiêu chuẩn:</span>
                  <span class="font-semibold text-gray-900 dark:text-white">CARB-P2 xuất khẩu Mỹ</span>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Thời gian bảo hành:</span>
                  <span class="font-semibold text-emerald-600 dark:text-emerald-400">24 tháng chính hãng</span>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Xuất xứ:</span>
                  <span class="font-semibold text-gray-900 dark:text-white">Việt Nam (Savimex Corp)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB CONTENT 2: TÌM CỬA HÀNG -->
          <div id="detailTabStore" class="hidden p-6 sm:p-8 bg-white dark:bg-zinc-900 space-y-6">
            <h4 class="text-base font-bold text-gray-900 dark:text-white">Hệ thống showroom trải nghiệm sản phẩm trực tiếp</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/40">
                <div class="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase">Showroom Hồ Chí Minh</div>
                <div class="text-sm font-bold text-gray-900 dark:text-white mt-1">162 Lê Văn Việt, Tăng Nhơn Phú B, TP. Thủ Đức</div>
                <div class="text-xs text-gray-500 mt-1">🕒 Giờ mở cửa: 08:30 - 21:00 (Hàng ngày)</div>
                <div class="text-xs text-gray-500 mt-1">📞 Hotline tư vấn: 097 114 1140</div>
              </div>
              <div class="p-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/40">
                <div class="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase">Showroom Hà Nội</div>
                <div class="text-sm font-bold text-gray-900 dark:text-white mt-1">Số 56 ngõ 86 Phố Chùa Hà, Cầu Giấy, Hà Nội</div>
                <div class="text-xs text-gray-500 mt-1">🕒 Giờ mở cửa: 08:30 - 21:00 (Hàng ngày)</div>
                <div class="text-xs text-gray-500 mt-1">📞 Hotline tư vấn: 097 114 1140</div>
              </div>
            </div>
            <div class="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200">
              💡 <strong>Lưu ý:</strong> Sản phẩm có sẵn mẫu trưng bày tại cả 2 showroom để quý khách nằm thử và kiểm tra chất liệu thực tế.
            </div>
          </div>

          <!-- TAB CONTENT 3: ĐÁNH GIÁ -->
          <div id="detailTabReview" class="hidden p-6 sm:p-8 bg-white dark:bg-zinc-900 space-y-6">
            <div class="flex items-center gap-6 p-4 bg-gray-50 dark:bg-zinc-800/40 rounded-lg">
              <div class="text-center pr-6 border-r border-gray-200 dark:border-zinc-700">
                <div class="text-4xl font-extrabold text-amber-600">5.0</div>
                <div class="flex text-amber-500 justify-center my-1">★★★★★</div>
                <div class="text-xs text-gray-400">${product.review_count || 34} đánh giá xác thực</div>
              </div>
              <div class="flex-1 text-xs space-y-1.5">
                <div class="flex items-center gap-2"><span>5 sao</span><div class="flex-1 bg-gray-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden"><div class="bg-amber-500 h-full w-[95%]"></div></div><span>95%</span></div>
                <div class="flex items-center gap-2"><span>4 sao</span><div class="flex-1 bg-gray-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden"><div class="bg-amber-500 h-full w-[5%]"></div></div><span>5%</span></div>
              </div>
            </div>

            <!-- Customer Reviews List -->
            <div class="space-y-4">
              <div class="p-4 border-b border-gray-100 dark:border-zinc-800">
                <div class="flex justify-between items-center text-xs">
                  <strong class="text-gray-900 dark:text-white">Nguyễn Thu Trang</strong>
                  <span class="text-gray-400">1 tuần trước</span>
                </div>
                <div class="text-amber-500 text-xs my-1">★★★★★ <span class="text-emerald-600 ml-2 font-medium">Đã mua tại MOHO</span></div>
                <p class="text-xs text-gray-600 dark:text-gray-300">
                  "Họa tiết đan chéo ngoài đời thực rất đẹp và tạo chiều sâu 3D như mô tả. Giường rất đầm, nằm không bị cọt kẹt, các cạnh bo tròn an toàn cho bé nhà mình."
                </p>
              </div>

              <div class="p-4 border-b border-gray-100 dark:border-zinc-800">
                <div class="flex justify-between items-center text-xs">
                  <strong class="text-gray-900 dark:text-white">Hoàng Đình Nam</strong>
                  <span class="text-gray-400">2 tuần trước</span>
                </div>
                <div class="text-amber-500 text-xs my-1">★★★★★ <span class="text-emerald-600 ml-2 font-medium">Đã mua tại MOHO</span></div>
                <p class="text-xs text-gray-600 dark:text-gray-300">
                  "Giao hàng đúng giờ, lắp ráp nhanh gọn lẹ chỉ mất 25 phút. Rất hài lòng với chất lượng gỗ tự nhiên của Savimex."
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    showToast('Lỗi hiển thị sản phẩm', 'error');
  }
}

function switchDetailTab(tab) {
  const descTab = document.getElementById('detailTabDesc');
  const storeTab = document.getElementById('detailTabStore');
  const reviewTab = document.getElementById('detailTabReview');
  const descBtn = document.getElementById('tabDescBtn');
  const storeBtn = document.getElementById('tabStoreBtn');
  const reviewBtn = document.getElementById('tabReviewBtn');

  // hide all tabs
  descTab?.classList.add('hidden');
  storeTab?.classList.add('hidden');
  reviewTab?.classList.add('hidden');

  // reset all buttons
  [descBtn, storeBtn, reviewBtn].forEach(btn => {
    btn?.classList.remove('bg-gray-200/70', 'dark:bg-zinc-800', 'text-gray-900', 'dark:text-white', 'font-bold');
    btn?.classList.add('text-gray-500', 'dark:text-gray-400');
  });

  if (tab === 'desc') {
    descTab?.classList.remove('hidden');
    descBtn?.classList.add('bg-gray-200/70', 'dark:bg-zinc-800', 'text-gray-900', 'dark:text-white', 'font-bold');
    descBtn?.classList.remove('text-gray-500', 'dark:text-gray-400');
  } else if (tab === 'store') {
    storeTab?.classList.remove('hidden');
    storeBtn?.classList.add('bg-gray-200/70', 'dark:bg-zinc-800', 'text-gray-900', 'dark:text-white', 'font-bold');
    storeBtn?.classList.remove('text-gray-500', 'dark:text-gray-400');
  } else if (tab === 'review') {
    reviewTab?.classList.remove('hidden');
    reviewBtn?.classList.add('bg-gray-200/70', 'dark:bg-zinc-800', 'text-gray-900', 'dark:text-white', 'font-bold');
    reviewBtn?.classList.remove('text-gray-500', 'dark:text-gray-400');
  }
}

function buyNowCurrentProduct() {
  if (!currentDetailProduct) return;
  const input = document.getElementById('detailQuantityInput');
  const qty = parseInt(input.value) || 1;
  addToCart(currentDetailProduct, selectedDetailColor, qty);
  closeProductDetail();
  proceedToCheckout();
}

function selectColor(colorName, btn) {
  selectedDetailColor = colorName;
  document.getElementById('selectedColorName').textContent = colorName;
  document.querySelectorAll('.color-picker-opt').forEach(b => {
    b.classList.remove('border-amber-700', 'bg-amber-50/50', 'font-medium');
    b.classList.add('border-gray-200');
  });
  btn.classList.add('border-amber-700', 'bg-amber-50/50', 'font-medium');
  btn.classList.remove('border-gray-200');
}

function changeDetailQty(delta) {
  const input = document.getElementById('detailQuantityInput');
  if (!input) return;
  let val = parseInt(input.value) || 1;
  val = Math.max(1, val + delta);
  input.value = val;
}

function addCurrentDetailToCart() {
  if (!currentDetailProduct) return;
  const input = document.getElementById('detailQuantityInput');
  const qty = parseInt(input.value) || 1;
  addToCart(currentDetailProduct, selectedDetailColor, qty);
  closeProductDetail();
}

function closeProductDetail() {
  document.getElementById('productDetailModal')?.classList.add('hidden');
}

// --- CHECKOUT & LOGIN ENFORCEMENT ---
function proceedToCheckout() {
  if (STATE.cart.length === 0) {
    showToast('Giỏ hàng trống! Hãy chọn sản phẩm trước.', 'warning');
    return;
  }

  // Strictly enforce user login before purchasing
  if (!STATE.user) {
    STATE.pendingCheckout = true;
    closeCartDrawer();
    openAuthModal('login', 'Vui lòng đăng nhập tài khoản để tiến hành đặt hàng!');
    showToast('Quý khách bắt buộc phải đăng nhập tài khoản để mua hàng', 'warning');
    return;
  }

  openCheckoutModal();
}

function openCheckoutModal() {
  if (STATE.cart.length === 0) {
    showToast('Giỏ hàng trống! Hãy chọn sản phẩm trước.', 'warning');
    return;
  }

  // Strictly enforce user login
  if (!STATE.user) {
    STATE.pendingCheckout = true;
    closeCartDrawer();
    openAuthModal('login', 'Vui lòng đăng nhập tài khoản để thanh toán đơn hàng');
    showToast('Vui lòng đăng nhập tài khoản để thanh toán', 'warning');
    return;
  }

  closeCartDrawer();
  const modal = document.getElementById('checkoutModal');
  const itemsContainer = document.getElementById('checkoutOrderSummaryItems');
  const subtotalEl = document.getElementById('checkoutSummarySubtotal');
  const totalEl = document.getElementById('checkoutSummaryTotal');

  const total = STATE.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const shippingFee = total >= 2000000 ? 0 : 50000;

  if (itemsContainer) {
    itemsContainer.innerHTML = STATE.cart.map(item => `
      <div class="flex justify-between text-xs py-1.5 text-gray-700 dark:text-gray-300">
        <span class="truncate max-w-[200px]">${item.title} <span class="text-gray-400">x${item.quantity}</span></span>
        <span class="font-medium">${formatPrice(item.price * item.quantity)}</span>
      </div>
    `).join('');
  }

  if (subtotalEl) subtotalEl.textContent = formatPrice(total);
  if (totalEl) totalEl.textContent = formatPrice(total + shippingFee);

  // Prefill user details from logged in account
  const userNotice = document.getElementById('checkoutUserNotice');
  document.getElementById('checkoutName').value = STATE.user.fullname || '';
  document.getElementById('checkoutPhone').value = STATE.user.phone || '';
  document.getElementById('checkoutEmail').value = STATE.user.email || '';
  
  if (userNotice) {
    userNotice.innerHTML = `
      <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded flex items-center justify-between">
        <span>✓ Đang đặt hàng với tài khoản: <strong>${STATE.user.fullname}</strong> (${STATE.user.email})</span>
        <button type="button" onclick="handleLogout()" class="underline text-red-600 hover:text-red-700 ml-2">Đăng xuất</button>
      </div>
    `;
    userNotice.classList.remove('hidden');
  }

  modal?.classList.remove('hidden');
}

function closeCheckoutModal() {
  document.getElementById('checkoutModal')?.classList.add('hidden');
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  if (!STATE.user) {
    showToast('Vui lòng đăng nhập tài khoản trước khi hoàn tất đặt hàng', 'warning');
    openAuthModal('login', 'Vui lòng đăng nhập tài khoản để đặt hàng');
    return;
  }

  const form = e.target;
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  const email = form.email.value.trim();
  const address = form.address.value.trim();
  const paymentMethod = form.payment_method.value;
  const note = form.note.value.trim();

  const total = STATE.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const shippingFee = total >= 2000000 ? 0 : 50000;
  const totalAmount = total + shippingFee;

  const btn = document.getElementById('checkoutSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> Đang xử lý đơn hàng...`;

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: STATE.user.id,
        name, phone, email, address,
        payment_method: paymentMethod,
        note,
        items: STATE.cart,
        total_amount: totalAmount
      })
    });

    const result = await res.json();
    if (res.ok && result.success) {
      STATE.cart = [];
      saveCart();
      renderCart();
      closeCheckoutModal();
      showOrderSuccessModal(result.order_code, totalAmount, paymentMethod);
      loadProducts();
    } else {
      showToast(result.error || 'Đặt hàng thất bại. Vui lòng thử lại!', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Lỗi kết nối máy chủ', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Hoàn tất đặt hàng`;
  }
}

function showOrderSuccessModal(orderCode, total, method) {
  const modal = document.getElementById('orderSuccessModal');
  document.getElementById('successOrderCode').textContent = orderCode;
  document.getElementById('successOrderTotal').textContent = formatPrice(total);
  document.getElementById('successOrderMethod').textContent = method === 'COD' ? 'Thanh toán tiền mặt khi nhận hàng (COD)' : 'Chuyển khoản / QR Code';
  modal?.classList.remove('hidden');
}

function closeOrderSuccessModal() {
  document.getElementById('orderSuccessModal')?.classList.add('hidden');
}

// --- AUTHENTICATION MODAL ---
function openAuthModal(defaultTab = 'login', noticeText = null) {
  const modal = document.getElementById('authModal');
  const noticeBox = document.getElementById('authNoticeBox');

  if (noticeText || STATE.pendingCheckout) {
    const text = noticeText || 'Vui lòng đăng nhập tài khoản để tiến hành mua hàng';
    if (noticeBox) {
      noticeBox.innerHTML = `
        <div class="p-2.5 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs rounded-lg flex items-center gap-2">
          <span>⚠️ <strong>${text}</strong></span>
        </div>
      `;
      noticeBox.classList.remove('hidden');
    }
  } else {
    if (noticeBox) noticeBox.classList.add('hidden');
  }

  switchAuthTab(defaultTab);
  modal?.classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('authModal')?.classList.add('hidden');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTabBtn = document.getElementById('loginTabBtn');
  const registerTabBtn = document.getElementById('registerTabBtn');

  if (tab === 'login') {
    loginForm?.classList.remove('hidden');
    registerForm?.classList.add('hidden');
    loginTabBtn?.classList.add('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-500');
    registerTabBtn?.classList.remove('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-500');
  } else {
    loginForm?.classList.add('hidden');
    registerForm?.classList.remove('hidden');
    registerTabBtn?.classList.add('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-500');
    loginTabBtn?.classList.remove('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-500');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      STATE.user = data.user;
      localStorage.setItem('moho_user', JSON.stringify(data.user));
      updateAuthUI();
      closeAuthModal();
      showToast(`Chào mừng ${data.user.fullname}!`, 'success');

      // If user was trying to checkout, resume checkout now
      if (STATE.pendingCheckout) {
        STATE.pendingCheckout = false;
        showToast('Đang chuyển đến trang thanh toán...', 'info');
        setTimeout(() => {
          openCheckoutModal();
        }, 350);
      }
    } else {
      showToast(data.error || 'Đăng nhập không thành công', 'error');
    }
  } catch (err) {
    showToast('Lỗi máy chủ', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const fullname = form.fullname.value.trim();
  const email = form.email.value.trim();
  const phone = form.phone.value.trim();
  const password = form.password.value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullname, email, phone, password })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      STATE.user = data.user;
      localStorage.setItem('moho_user', JSON.stringify(data.user));
      updateAuthUI();
      closeAuthModal();
      showToast('Đăng ký tài khoản thành công!', 'success');

      // If user was trying to checkout, resume checkout now
      if (STATE.pendingCheckout) {
        STATE.pendingCheckout = false;
        showToast('Đang chuyển đến trang thanh toán...', 'info');
        setTimeout(() => {
          openCheckoutModal();
        }, 350);
      }
    } else {
      showToast(data.error || 'Đăng ký không thành công', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ', 'error');
  }
}

function handleLogout() {
  STATE.user = null;
  localStorage.removeItem('moho_user');
  updateAuthUI();
  showToast('Đã đăng xuất tài khoản', 'info');
}

function toggleUserDropdown(event) {
  if (event) {
    event.stopPropagation();
  }
  const dropdown = document.getElementById('userDropdownMenu');
  const arrow = document.getElementById('userMenuArrow');
  const btn = document.getElementById('userMenuButton');
  if (!dropdown) return;

  const isVisible = dropdown.style.display === 'block';

  if (isVisible) {
    // Đang mở -> Bấm để đóng
    dropdown.style.display = 'none';
    dropdown.classList.add('hidden');
    if (arrow) arrow.classList.remove('rotate-180');
    if (btn) btn.classList.remove('bg-gray-100', 'dark:bg-zinc-800');
  } else {
    // Đang đóng -> BẤM ĐỂ MỞ VÀ GIỮ NGUYÊN (Hold in place)
    dropdown.style.display = 'block';
    dropdown.classList.remove('hidden');
    if (arrow) arrow.classList.add('rotate-180');
    if (btn) btn.classList.add('bg-gray-100', 'dark:bg-zinc-800');
  }
}

function closeUserDropdown() {
  const dropdown = document.getElementById('userDropdownMenu');
  const arrow = document.getElementById('userMenuArrow');
  const btn = document.getElementById('userMenuButton');
  if (dropdown) {
    dropdown.style.display = 'none';
    dropdown.classList.add('hidden');
  }
  if (arrow) arrow.classList.remove('rotate-180');
  if (btn) btn.classList.remove('bg-gray-100', 'dark:bg-zinc-800');
}

function updateAuthUI() {
  const authContainer = document.getElementById('headerUserSection');
  if (!authContainer) return;

  if (STATE.user) {
    authContainer.innerHTML = `
      <div class="relative">
        <!-- Nút bấm mục tài khoản: Bấm để mở và giữ nguyên -->
        <button 
          type="button" 
          id="userMenuButton"
          onclick="toggleUserDropdown(event)" 
          class="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition select-none cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-zinc-700"
          title="Bấm để xem danh mục tài khoản"
        >
          <div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-zinc-800 text-amber-800 dark:text-amber-400 font-bold flex items-center justify-center text-xs shadow-sm">
            ${STATE.user.fullname.charAt(0).toUpperCase()}
          </div>
          <div class="text-left hidden sm:block">
            <div class="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">Xin chào,</div>
            <div class="text-xs font-semibold text-gray-900 dark:text-white max-w-[120px] truncate mt-0.5">${STATE.user.fullname}</div>
          </div>
          <svg id="userMenuArrow" class="w-3.5 h-3.5 text-gray-400 hidden sm:block transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Dropdown Menu: Chỉ mở khi BẤM, giữ nguyên cố định không bao giờ tự biến mất -->
        <div 
          id="userDropdownMenu" 
          class="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 py-1.5 hidden z-50"
          style="display: none;"
          onclick="event.stopPropagation()"
        >
          <div class="px-4 py-2.5 border-b border-gray-100 dark:border-zinc-700 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/70 dark:bg-zinc-800/70">
            <strong class="text-gray-900 dark:text-white font-semibold">${STATE.user.fullname}</strong><br/>
            <span class="text-[11px] text-gray-500 dark:text-gray-400">${STATE.user.email}</span>
          </div>

          <button onclick="closeUserDropdown(); openMyOrdersModal();" class="w-full text-left px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2.5 transition">
            <span>📦</span>
            <span class="font-medium">Đơn hàng của tôi</span>
          </button>

          ${STATE.user.role === 'admin' ? `
            <a href="/admin" class="block px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400 font-semibold hover:bg-amber-50 dark:hover:bg-zinc-700/80 flex items-center gap-2.5 transition">
              <span>⚡</span>
              <span>Trang Quản Trị Admin</span>
            </a>
          ` : ''}

          <button onclick="closeUserDropdown(); handleLogout();" class="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-zinc-700 border-t border-gray-100 dark:border-zinc-700 flex items-center gap-2.5 transition mt-1">
            <span>🚪</span>
            <span class="font-medium">Đăng xuất</span>
          </button>
        </div>
      </div>
    `;
  } else {
    authContainer.innerHTML = `
      <div onclick="openAuthModal('login')" class="cursor-pointer flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:text-amber-800 transition">
        <svg class="w-6 h-6 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <div class="text-left text-xs hidden sm:block leading-tight">
          <div class="text-gray-600 dark:text-gray-300 font-medium">Đăng nhập / Đăng ký</div>
          <div class="text-[11px] text-gray-400">Tài khoản của tôi ▾</div>
        </div>
      </div>
    `;
  }
}

// --- USER ORDERS MODAL ---
async function openMyOrdersModal() {
  if (!STATE.user) {
    openAuthModal('login', 'Vui lòng đăng nhập để xem đơn hàng');
    return;
  }

  const modal = document.getElementById('myOrdersModal');
  const container = document.getElementById('myOrdersContent');
  modal?.classList.remove('hidden');

  container.innerHTML = `<div class="p-8 text-center text-xs text-gray-400">Đang tải lịch sử đơn hàng...</div>`;

  try {
    const res = await fetch(`/api/user/${STATE.user.id}/orders`);
    const orders = await res.json();

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-gray-400">
          <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-zinc-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">Bạn chưa có đơn hàng nào</p>
          <p class="text-xs text-gray-400 mt-1">Các đơn hàng bạn đặt sẽ được lưu trữ và theo dõi tại đây.</p>
        </div>
      `;
      return;
    }

    const statusMap = {
      'pending': { text: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-400' },
      'confirmed': { text: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400' },
      'shipping': { text: 'Đang giao hàng', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-400' },
      'completed': { text: 'Giao thành công', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400' },
      'cancelled': { text: 'Đã hủy', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400' }
    };

    container.innerHTML = orders.map(order => {
      const st = statusMap[order.status] || { text: order.status, color: 'bg-gray-100' };
      const items = Array.isArray(order.items) ? order.items : [];

      return `
        <div class="p-4 border border-gray-100 dark:border-zinc-800 rounded-lg bg-gray-50/50 dark:bg-zinc-800/40 space-y-2">
          <div class="flex items-center justify-between text-xs pb-2 border-b border-gray-200 dark:border-zinc-700">
            <div>
              <span class="text-gray-400">Mã đơn:</span>
              <strong class="text-amber-800 dark:text-amber-400">${order.order_code}</strong>
              <span class="text-[11px] text-gray-400 ml-2">(${order.created_at})</span>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.color}">
              ${st.text}
            </span>
          </div>

          <div class="space-y-1 py-1">
            ${items.map(item => `
              <div class="flex justify-between text-xs text-gray-700 dark:text-gray-300">
                <span class="truncate max-w-[280px]">• ${item.title} <span class="text-gray-400">x${item.quantity}</span></span>
                <span class="font-medium">${formatPrice(item.price * item.quantity)}</span>
              </div>
            `).join('')}
          </div>

          <div class="flex items-center justify-between text-xs pt-2 border-t border-gray-200 dark:border-zinc-700">
            <span class="text-gray-500">Tổng thanh toán (${order.payment_method}):</span>
            <strong class="text-red-600 dark:text-red-400 text-sm">${formatPrice(order.total_amount)}</strong>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-red-500">Lỗi khi tải lịch sử đơn hàng</div>`;
  }
}

function closeMyOrdersModal() {
  document.getElementById('myOrdersModal')?.classList.add('hidden');
}

// --- FLOATING ACTIONS ---
function handleHotlineClick() {
  const phone = '097 114 1140';
  navigator.clipboard.writeText('0971141140');
  showToast(`Hotline: ${phone} (Đã sao chép vào bộ nhớ tạm)`, 'info');
}

function handleZaloChat() {
  showToast('Đang kết nối tới MOHO Official Zalo CSKH...', 'info');
  window.open('https://zalo.me', '_blank');
}

function handleMessengerChat() {
  showToast('Đang kết nối tới MOHO Facebook Messenger...', 'info');
  window.open('https://m.me', '_blank');
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : type === 'warning' ? 'bg-amber-600' : 'bg-gray-900 dark:bg-zinc-700';

  toast.className = `${bg} text-white text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0`;
  toast.innerHTML = `
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
