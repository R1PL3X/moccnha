/**
 * Admin Dashboard Logic
 */

let ADMIN_THEME = localStorage.getItem('moho_theme') || 'light';

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  loadDbStatus();
  loadAdminStats();
  if (document.getElementById('adminRevenueTableBody')) loadAdminRevenue();
  if (document.getElementById('adminOrdersTableBody')) loadAdminOrders();
  if (document.getElementById('adminQuotesTableBody')) loadAdminQuotes();
  if (document.getElementById('adminProductsTableBody')) loadAdminProducts();
});

function initAdminTheme() {
  if (ADMIN_THEME === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateAdminThemeIcons();
}

function toggleTheme() {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    ADMIN_THEME = 'light';
  } else {
    document.documentElement.classList.add('dark');
    ADMIN_THEME = 'dark';
  }
  localStorage.setItem('moho_theme', ADMIN_THEME);
  updateAdminThemeIcons();
}

function updateAdminThemeIcons() {
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');
  if (ADMIN_THEME === 'dark') {
    sunIcon?.classList.remove('hidden');
    moonIcon?.classList.add('hidden');
  } else {
    sunIcon?.classList.add('hidden');
    moonIcon?.classList.remove('hidden');
  }
}

function switchAdminTab(tab) {
  const ordersTab = document.getElementById('ordersTabContent');
  const quotesTab = document.getElementById('quotesTabContent');
  const productsTab = document.getElementById('productsTabContent');
  const ordersBtn = document.getElementById('tabOrdersBtn');
  const quotesBtn = document.getElementById('tabQuotesBtn');
  const productsBtn = document.getElementById('tabProductsBtn');

  // Reset all tabs
  ordersTab.classList.add('hidden');
  quotesTab.classList.add('hidden');
  productsTab.classList.add('hidden');

  [ordersBtn, quotesBtn, productsBtn].forEach(btn => {
    if (btn) {
      btn.classList.remove('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-400');
      btn.classList.add('text-gray-500');
    }
  });

  if (tab === 'orders') {
    ordersTab.classList.remove('hidden');
    ordersBtn.classList.add('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-400');
    ordersBtn.classList.remove('text-gray-500');
  } else if (tab === 'quotes') {
    quotesTab.classList.remove('hidden');
    quotesBtn.classList.add('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-400');
    quotesBtn.classList.remove('text-gray-500');
  } else {
    productsTab.classList.remove('hidden');
    productsBtn.classList.add('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-400');
    productsBtn.classList.remove('text-gray-500');
  }
}

function formatPrice(number) {
  return new Intl.NumberFormat('vi-VN').format(number) + '₫';
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    
    const elRev = document.getElementById('statRevenue');
    if (elRev) elRev.textContent = formatPrice(data.total_revenue || 0);

    const elOrders = document.getElementById('statOrders');
    if (elOrders) elOrders.textContent = data.total_orders || 0;

    const elProducts = document.getElementById('statProducts');
    if (elProducts) elProducts.textContent = data.total_products || 0;

    const elQuotes = document.getElementById('statQuotes');
    if (elQuotes) elQuotes.textContent = data.total_quotes || 0;

    const elOrdersBadge = document.getElementById('ordersCountBadge');
    if (elOrdersBadge) elOrdersBadge.textContent = data.total_orders || 0;

    const elProductsBadge = document.getElementById('productsCountBadge');
    if (elProductsBadge) elProductsBadge.textContent = data.total_products || 0;

    const elQuotesBadge = document.getElementById('quotesCountBadge');
    if (elQuotesBadge) elQuotesBadge.textContent = data.total_quotes || 0;
  } catch (err) {
    console.error(err);
  }
}

// ==============================================================================
// 1. DOANH THU TÍCH LŨY (REVENUE ANALYTICS)
// ==============================================================================

async function loadAdminRevenue() {
  const tbody = document.getElementById('adminRevenueTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">Đang tổng hợp dữ liệu doanh thu...</td></tr>`;
    const res = await fetch('/api/orders');
    const orders = await res.json() || [];

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">Chưa có giao dịch phát sinh doanh thu</td></tr>`;
      return;
    }

    const validOrders = orders.filter(o => o.status !== 'cancelled');
    const completedOrders = orders.filter(o => o.status === 'completed');
    const shippingOrders = orders.filter(o => o.status === 'shipping' || o.status === 'confirmed');

    const completedRev = completedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const shippingRev = shippingOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const bankRev = validOrders.filter(o => o.payment_method === 'BANK_TRANSFER').reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const aov = validOrders.length > 0 ? Math.round(validOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / validOrders.length) : 0;

    const elCompletedRev = document.getElementById('revenueCompleted');
    if (elCompletedRev) elCompletedRev.textContent = formatPrice(completedRev);

    const elShippingRev = document.getElementById('revenueShipping');
    if (elShippingRev) elShippingRev.textContent = formatPrice(shippingRev);

    const elBankRev = document.getElementById('revenueBank');
    if (elBankRev) elBankRev.textContent = formatPrice(bankRev);

    const elAov = document.getElementById('revenueAov');
    if (elAov) elAov.textContent = formatPrice(aov);

    const elCompletedCount = document.getElementById('revenueCompletedCount');
    if (elCompletedCount) elCompletedCount.textContent = completedOrders.length;

    tbody.innerHTML = orders.map(o => {
      const isCompleted = o.status === 'completed';
      const isCancelled = o.status === 'cancelled';

      let statusBadge = '';
      if (isCompleted) {
        statusBadge = `<span class="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 px-2.5 py-0.5 rounded text-[11px] font-bold">✅ Đã thực thu</span>`;
      } else if (isCancelled) {
        statusBadge = `<span class="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 px-2.5 py-0.5 rounded text-[11px] font-bold">❌ Đã hủy đơn</span>`;
      } else {
        statusBadge = `<span class="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 px-2.5 py-0.5 rounded text-[11px] font-bold">⏳ Đang giao / Chờ thu</span>`;
      }

      const paymentLabel = o.payment_method === 'BANK_TRANSFER' 
        ? `<span class="text-blue-600 dark:text-blue-400 font-semibold">🏦 Chuyển khoản</span>`
        : `<span class="text-gray-700 dark:text-zinc-300 font-semibold">💵 Tiền mặt (COD)</span>`;

      return `
        <tr class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition">
          <td class="p-3.5 font-mono text-[11px]">
            <a href="/admin/orders" class="font-bold text-amber-800 dark:text-amber-400 hover:underline">#${o.order_code}</a>
            <div class="text-[10px] text-gray-400 mt-0.5">${o.created_at || ''}</div>
          </td>
          <td class="p-3.5">
            <div class="font-bold text-gray-900 dark:text-white">${o.customer_name || 'Khách vãng lai'}</div>
            <div class="text-xs text-gray-500">${o.customer_phone || ''}</div>
          </td>
          <td class="p-3.5 text-xs">
            ${paymentLabel}
          </td>
          <td class="p-3.5">
            ${statusBadge}
          </td>
          <td class="p-3.5 text-right font-black text-sm ${isCancelled ? 'line-through text-gray-400' : 'text-red-600 dark:text-red-400'}">
            ${formatPrice(o.total_amount || 0)}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500">Lỗi khi tải bảng doanh thu</td></tr>`;
  }
}

// ==============================================================================
// 2. TỔNG ĐƠN ĐẶT HÀNG (ORDERS MANAGEMENT)
// ==============================================================================

let ALL_ADMIN_ORDERS = [];
let CURRENT_ORDER_FILTER = 'all';

function setOrderFilter(filter) {
  CURRENT_ORDER_FILTER = filter;
  document.querySelectorAll('.order-filter-btn').forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.className = 'order-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-800 text-white shadow-sm';
    } else {
      btn.className = 'order-filter-btn px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300';
    }
  });
  renderAdminOrdersTable();
}

async function loadAdminOrders() {
  const tbody = document.getElementById('adminOrdersTableBody');
  if (!tbody) return;
  try {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">Đang tải danh sách đơn hàng...</td></tr>`;
    const res = await fetch('/api/orders');
    ALL_ADMIN_ORDERS = await res.json() || [];
    renderAdminOrdersTable();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500">Lỗi khi tải đơn hàng</td></tr>`;
  }
}

function renderAdminOrdersTable() {
  const tbody = document.getElementById('adminOrdersTableBody');
  if (!tbody) return;

  let filtered = ALL_ADMIN_ORDERS;
  if (CURRENT_ORDER_FILTER !== 'all') {
    filtered = ALL_ADMIN_ORDERS.filter(o => o.status === CURRENT_ORDER_FILTER);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">Không tìm thấy đơn hàng nào phù hợp với bộ lọc</td></tr>`;
    return;
  }

  const statusMap = {
    'pending': { text: 'Chờ xử lý', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-400' },
    'confirmed': { text: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400' },
    'shipping': { text: 'Đang vận chuyển', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-400' },
    'completed': { text: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400' },
    'cancelled': { text: 'Đã hủy', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400' }
  };

  tbody.innerHTML = filtered.map(order => {
    const statusInfo = statusMap[order.status] || { text: order.status, color: 'bg-gray-100 text-gray-700' };
    const itemsList = Array.isArray(order.items) ? order.items : [];

    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition">
        <td class="p-3.5 font-bold text-amber-800 dark:text-amber-400">
          <div>#${order.order_code}</div>
          <div class="text-[10px] text-gray-400 font-normal mt-0.5">${order.created_at || ''}</div>
        </td>
        <td class="p-3.5">
          <div class="font-semibold text-gray-900 dark:text-white">${order.customer_name}</div>
          <div class="text-[11px] text-gray-500">${order.customer_phone}</div>
          <div class="text-[11px] text-gray-400 truncate max-w-xs" title="${order.customer_address}">${order.customer_address}</div>
        </td>
        <td class="p-3.5">
          <div class="space-y-1">
            ${itemsList.map(item => `
              <div class="text-[11px] truncate max-w-xs">
                • ${item.title} <strong class="text-gray-900 dark:text-white">x${item.quantity}</strong> (${item.color || 'Gỗ'})
              </div>
            `).join('')}
          </div>
        </td>
        <td class="p-3.5 font-bold text-red-600 dark:text-red-400">${formatPrice(order.total_amount)}</td>
        <td class="p-3.5 text-xs font-medium">
          ${order.payment_method === 'BANK_TRANSFER' ? '🏦 Chuyển khoản' : '💵 Tiền mặt (COD)'}
        </td>
        <td class="p-3.5">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusInfo.color}">
            ${statusInfo.text}
          </span>
        </td>
        <td class="p-3.5">
          <select 
            onchange="changeOrderStatus('${order.order_code}', this.value)" 
            class="text-[11px] bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded px-2 py-1 text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
            <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Đã xác nhận</option>
            <option value="shipping" ${order.status === 'shipping' ? 'selected' : ''}>Đang giao hàng</option>
            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Hủy đơn</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

async function changeOrderStatus(orderCode, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderCode}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const result = await res.json();
    if (res.ok && result.success) {
      showAdminToast(`Đã cập nhật trạng thái đơn ${orderCode}!`, 'success');
      loadAdminOrders();
      loadAdminStats();
    } else {
      showAdminToast(result.error || 'Cập nhật thất bại', 'error');
    }
  } catch (err) {
    showAdminToast('Lỗi mạng', 'error');
  }
}

async function loadAdminProducts() {
  const tbody = document.getElementById('adminProductsTableBody');
  try {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">Đang tải kho sản phẩm...</td></tr>`;
    const res = await fetch('/api/products');
    const products = await res.json();

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">Chưa có sản phẩm nào</td></tr>`;
      return;
    }

    tbody.innerHTML = products.map(product => `
      <tr class="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition">
        <td class="p-3.5 font-mono text-xs text-gray-400">#${product.id}</td>
        <td class="p-3.5">
          <img src="${product.image}" class="w-12 h-12 object-cover rounded bg-gray-100" />
        </td>
        <td class="p-3.5">
          <div class="font-semibold text-gray-900 dark:text-white">${product.title}</div>
          <div class="text-[11px] text-gray-400">BST: ${product.collection || 'MOHO'}</div>
        </td>
        <td class="p-3.5 text-xs text-amber-800 dark:text-amber-400 font-medium">${product.category}</td>
        <td class="p-3.5">
          <div class="font-bold text-red-600 dark:text-red-400">${formatPrice(product.price)}</div>
          ${product.discount_percent > 0 ? `<div class="text-[10px] line-through text-gray-400">${formatPrice(product.original_price)}</div>` : ''}
        </td>
        <td class="p-3.5 text-xs text-gray-700 dark:text-gray-300">${product.sold_count || 0}</td>
        <td class="p-3.5">
          <button 
            onclick="deleteAdminProduct(${product.id}, '${product.title.replace(/'/g, "\\'")}')" 
            class="text-xs text-red-600 hover:text-red-800 font-semibold hover:underline"
          >
            Xóa
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function handleCreateProduct(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    title: form.title.value.trim(),
    category: form.category.value,
    price: parseInt(form.price.value),
    original_price: parseInt(form.original_price.value) || parseInt(form.price.value),
    discount_percent: parseInt(form.discount_percent.value) || 0,
    image: form.image.value.trim() || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
    collection: form.collection.value.trim() || 'MOHO',
    description: form.description.value.trim(),
    is_bestseller: 1
  };

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok && result.success) {
      showAdminToast('Đã thêm sản phẩm mới thành công!', 'success');
      form.reset();
      loadAdminProducts();
      loadAdminStats();
    } else {
      showAdminToast(result.error || 'Thêm sản phẩm thất bại', 'error');
    }
  } catch (err) {
    showAdminToast('Lỗi máy chủ', 'error');
  }
}

async function deleteAdminProduct(productId, title) {
  if (!confirm(`Bạn có chắc muốn xóa sản phẩm: "${title}"?`)) return;

  try {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    const result = await res.json();
    if (res.ok && result.success) {
      showAdminToast('Đã xóa sản phẩm', 'info');
      loadAdminProducts();
      loadAdminStats();
    } else {
      showAdminToast('Lỗi khi xóa sản phẩm', 'error');
    }
  } catch (err) {
    showAdminToast('Lỗi máy chủ', 'error');
  }
}

function showAdminToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-gray-900 dark:bg-zinc-700';

  toast.className = `${bg} text-white text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const showToast = showAdminToast;

async function loadDbStatus() {
  const pill = document.getElementById('db-status-pill');
  if (!pill) return;

  try {
    const res = await fetch('/api/db-status');
    const data = await res.json();
    pill.classList.remove('hidden');

    if (data.mode === 'supabase') {
      pill.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700';
      pill.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Supabase Cloud (Đồng bộ)</span>
      `;
      pill.title = data.description + ` (${data.url})`;
    } else {
      pill.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-zinc-800 dark:text-amber-300 border border-amber-300 dark:border-zinc-700';
      pill.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        <span>SQLite Nội bộ</span>
      `;
      pill.title = data.description + ' - Điền SUPABASE_URL trong .env để đồng bộ đa máy';
    }
  } catch (e) {
    console.warn('Could not check db status:', e);
  }
}

async function loadAdminQuotes() {
  const tbody = document.getElementById('adminQuotesTableBody');
  if (!tbody) return;
  try {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">Đang tải danh sách yêu cầu báo giá...</td></tr>`;
    const res = await fetch('/api/quotes');
    const quotes = await res.json();

    if (!quotes || quotes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">Chưa có yêu cầu báo giá nào từ khách hàng</td></tr>`;
      return;
    }

    tbody.innerHTML = quotes.map(q => {
      return `
        <tr class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition">
          <td class="p-3.5 font-mono text-[11px]">
            <span class="font-bold text-gray-900 dark:text-white">#Q-${q.id}</span>
            <div class="text-[10px] text-gray-400 mt-0.5">${q.created_at || ''}</div>
          </td>
          <td class="p-3.5">
            <div class="font-bold text-gray-900 dark:text-white">${q.fullname || 'Chưa cập nhật'}</div>
            <div class="text-amber-800 dark:text-amber-400 font-semibold">${q.phone || ''}</div>
            ${q.email ? `<div class="text-[10px] text-gray-400">${q.email}</div>` : ''}
          </td>
          <td class="p-3.5">
            <span class="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-[11px] font-medium">
              ${q.project_type || 'Dự án thông thường'}
            </span>
          </td>
          <td class="p-3.5 max-w-xs">
            <div class="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">${q.note || '(Không có ghi chú thêm)'}</div>
          </td>
          <td class="p-3.5">
            <select onchange="updateQuoteStatus(${q.id}, this.value)" class="text-xs font-semibold px-2 py-1 rounded border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 cursor-pointer">
              <option value="pending" ${q.status === 'pending' ? 'selected' : ''}>⏳ Chờ liên hệ</option>
              <option value="contacted" ${q.status === 'contacted' ? 'selected' : ''}>📞 Đã liên hệ</option>
              <option value="completed" ${q.status === 'completed' ? 'selected' : ''}>✅ Đã hoàn tất</option>
              <option value="cancelled" ${q.status === 'cancelled' ? 'selected' : ''}>❌ Đã hủy</option>
            </select>
          </td>
          <td class="p-3.5">
            <button onclick="deleteQuote(${q.id})" class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition" title="Xóa yêu cầu">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">Lỗi tải danh sách yêu cầu báo giá</td></tr>`;
  }
}

async function updateQuoteStatus(quoteId, newStatus) {
  try {
    const res = await fetch(`/api/quotes/${quoteId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Cập nhật trạng thái báo giá thành công!', 'success');
      loadAdminStats();
    } else {
      showToast(data.error || 'Cập nhật thất bại', 'error');
    }
  } catch (err) {
    showToast('Lỗi mạng', 'error');
  }
}

async function deleteQuote(quoteId) {
  if (!confirm('Bạn có chắc chắn muốn xóa yêu cầu báo giá này?')) return;
  try {
    const res = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Đã xóa yêu cầu báo giá!', 'success');
      loadAdminQuotes();
      loadAdminStats();
    } else {
      showToast(data.error || 'Xóa thất bại', 'error');
    }
  } catch (err) {
    showToast('Lỗi mạng', 'error');
  }
}

