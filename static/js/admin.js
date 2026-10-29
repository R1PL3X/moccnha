/**
 * Admin Dashboard Logic
 */

let ADMIN_THEME = localStorage.getItem('moho_theme') || 'light';

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  loadDbStatus();
  loadAiStatus();
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

    const elChatsBadge = document.getElementById('chatsCountBadge');
    if (elChatsBadge) elChatsBadge.textContent = data.unread_chats || data.total_chats || 0;
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
    const data = await res.json();
    const orders = Array.isArray(data) ? data : [];

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400">
        <div class="text-3xl mb-1.5">💰</div>
        <div class="font-bold text-gray-600 dark:text-gray-300">Chưa có giao dịch phát sinh doanh thu</div>
      </td></tr>`;
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
    const data = await res.json();
    ALL_ADMIN_ORDERS = Array.isArray(data) ? data : [];
    renderAdminOrdersTable();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500">Lỗi khi tải đơn hàng</td></tr>`;
  }
}

function renderAdminOrdersTable() {
  const tbody = document.getElementById('adminOrdersTableBody');
  if (!tbody) return;

  if (!Array.isArray(ALL_ADMIN_ORDERS)) ALL_ADMIN_ORDERS = [];

  let filtered = ALL_ADMIN_ORDERS;
  if (CURRENT_ORDER_FILTER !== 'all') {
    filtered = ALL_ADMIN_ORDERS.filter(o => o && o.status === CURRENT_ORDER_FILTER);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-400">
      <div class="text-3xl mb-1.5">📦</div>
      <div class="font-bold text-gray-600 dark:text-gray-300">Chưa có đơn hàng nào</div>
      <div class="text-xs text-gray-400 mt-1">Các đơn hàng mới phát sinh từ khách hàng sẽ hiển thị tại đây.</div>
    </td></tr>`;
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

let ALL_ADMIN_PRODUCTS = [];

async function loadAdminProducts() {
  const tbody = document.getElementById('adminProductsTableBody');
  try {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">Đang tải kho sản phẩm...</td></tr>`;
    const res = await fetch('/api/products');
    const data = await res.json();
    const products = Array.isArray(data) ? data : [];
    ALL_ADMIN_PRODUCTS = products;

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-400">
        <div class="text-3xl mb-1.5">🪑</div>
        <div class="font-bold text-gray-600 dark:text-gray-300">Chưa có sản phẩm nào trong kho</div>
      </td></tr>`;
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
        <td class="p-3.5 text-xs text-gray-700 dark:text-gray-300">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-gray-900 dark:text-white">${product.sold_count || 0}</span>
            <button 
              onclick="quickEditSoldCount(${product.id}, ${product.sold_count || 0})" 
              class="text-gray-400 hover:text-amber-800 dark:hover:text-amber-400 p-0.5 rounded transition text-xs"
              title="Sửa nhanh số lượng đã bán"
            >
              ✎
            </button>
          </div>
        </td>
        <td class="p-3.5">
          <div class="flex items-center gap-2">
            <button 
              onclick="openEditProductModal(${product.id})" 
              class="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 font-semibold hover:underline"
            >
              Sửa
            </button>
            <span class="text-gray-300 dark:text-zinc-700">|</span>
            <button 
              onclick="deleteAdminProduct(${product.id}, '${product.title.replace(/'/g, "\\'")}')" 
              class="text-xs text-red-600 hover:text-red-800 font-semibold hover:underline"
            >
              Xóa
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function quickEditSoldCount(productId, currentCount) {
  const newCountStr = prompt(`Nhập số lượng đã bán mới cho sản phẩm #${productId}:`, currentCount);
  if (newCountStr === null) return;
  const newCount = parseInt(newCountStr);
  if (isNaN(newCount) || newCount < 0) {
    showAdminToast('Số lượng đã bán không hợp lệ!', 'error');
    return;
  }
  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sold_count: newCount })
    });
    const result = await res.json();
    if (res.ok && result.success) {
      showAdminToast('Đã cập nhật số lượng đã bán!', 'success');
      loadAdminProducts();
    } else {
      showAdminToast(result.error || 'Cập nhật thất bại', 'error');
    }
  } catch (err) {
    showAdminToast('Lỗi mạng', 'error');
  }
}

function openEditProductModal(productId) {
  const product = ALL_ADMIN_PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  document.getElementById('editProductId').value = product.id;
  document.getElementById('editTitle').value = product.title || '';
  document.getElementById('editCategory').value = product.category || 'Phòng Khách';
  document.getElementById('editCollection').value = product.collection || 'MOHO';
  document.getElementById('editPrice').value = product.price || 0;
  document.getElementById('editOriginalPrice').value = product.original_price || product.price || 0;
  document.getElementById('editDiscountPercent').value = product.discount_percent || 0;
  document.getElementById('editSoldCount').value = product.sold_count || 0;
  document.getElementById('editImage').value = product.image || '';
  document.getElementById('editDescription').value = product.description || '';
  document.getElementById('editProductModal')?.classList.remove('hidden');
}

function closeEditProductModal() {
  document.getElementById('editProductModal')?.classList.add('hidden');
}

async function handleUpdateProduct(e) {
  e.preventDefault();
  const form = e.target;
  const productId = form.id.value;
  const payload = {
    title: form.title.value.trim(),
    category: form.category.value,
    collection: form.collection.value.trim() || 'MOHO',
    price: parseInt(form.price.value),
    original_price: parseInt(form.original_price.value) || parseInt(form.price.value),
    discount_percent: parseInt(form.discount_percent.value) || 0,
    sold_count: parseInt(form.sold_count.value) || 0,
    image: form.image.value.trim(),
    description: form.description.value.trim()
  };

  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok && result.success) {
      showAdminToast('Đã cập nhật thông tin sản phẩm thành công!', 'success');
      closeEditProductModal();
      loadAdminProducts();
    } else {
      showAdminToast(result.error || 'Cập nhật thất bại', 'error');
    }
  } catch (err) {
    showAdminToast('Lỗi mạng', 'error');
  }
}

async function syncAdminSoldCounts() {
  try {
    const res = await fetch('/api/products/sync-sold', { method: 'POST' });
    const result = await res.json();
    if (res.ok && result.success) {
      showAdminToast('Đã đồng bộ số lượng đã bán từ đơn hàng!', 'success');
      loadAdminProducts();
    } else {
      showAdminToast(result.error || 'Đồng bộ thất bại', 'error');
    }
  } catch (err) {
    showAdminToast('Lỗi kết nối máy chủ', 'error');
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
    sold_count: parseInt(form.sold_count?.value) || 0,
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
  const banner = document.getElementById('sqlite-warning-banner');
  if (pill) {
    pill.classList.remove('hidden');
    pill.classList.add('cursor-pointer', 'hover:opacity-80', 'transition');
    pill.onclick = () => openDbConfigModal('db');
  }

  try {
    const res = await fetch('/api/db-status');
    const data = await res.json();
    if (pill) pill.classList.remove('hidden');

    if (data.mode === 'supabase') {
      if (pill) {
        pill.className = 'cursor-pointer hover:opacity-80 transition inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700';
        pill.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Supabase Cloud (Đồng bộ) ⚙️</span>
        `;
        pill.title = (data.description || 'Đang kết nối Supabase Cloud PostgreSQL') + ' - Nhấp để xem/cấu hình Cloud Database';
      }
      if (banner) banner.classList.add('hidden');
      if (data.url) localStorage.setItem('mocnha_supabase_url', data.url);
    } else {
      if (pill) {
        pill.className = 'cursor-pointer hover:opacity-80 transition inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-zinc-800 dark:text-amber-300 border border-amber-300 dark:border-zinc-700';
        pill.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>SQLite Nội bộ (Chưa đồng bộ) ⚙️</span>
        `;
        pill.title = 'Đang dùng SQLite nội bộ chỉ trên máy này. Nhấp vào đây để kết nối Supabase Cloud đồng bộ đa thiết bị!';
      }
      if (banner) banner.classList.remove('hidden');
    }
  } catch (e) {
    console.warn('Could not check db status:', e);
    if (pill) {
      pill.classList.remove('hidden');
      pill.className = 'cursor-pointer hover:opacity-80 transition inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300';
      pill.innerHTML = `<span>⚠️ Kiểm tra DB ⚙️</span>`;
    }
    if (banner) banner.classList.remove('hidden');
  }
}

async function loadAiStatus() {
  const pill = document.getElementById('ai-status-pill');
  if (!pill) return;

  pill.classList.add('cursor-pointer', 'hover:opacity-80', 'transition');
  pill.onclick = () => openDbConfigModal('gemini');

  try {
    const res = await fetch('/api/admin/ai-status');
    const data = await res.json();
    pill.classList.remove('hidden');

    if (data.enabled) {
      pill.className = 'cursor-pointer hover:opacity-80 transition inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-700';
      pill.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
        <span>✨ Gemini AI (Online)</span>
      `;
      pill.title = 'Google Gemini AI đang kích hoạt - Tư vấn viên thông minh tự động';
    } else {
      pill.className = 'cursor-pointer hover:opacity-80 transition inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300 border border-gray-300 dark:border-zinc-700';
      pill.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-gray-400"></span>
        <span>🤖 AI Bot Mẫu ⚙️</span>
      `;
      pill.title = 'Chưa cấu hình Gemini API Key. Nhấp vào đây để kích hoạt AI!';
    }
  } catch (e) {
    console.warn('Could not check AI status:', e);
  }
}

function openDbConfigModal(defaultTab = 'db') {
  let modal = document.getElementById('dbConfigModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dbConfigModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs';
    modal.innerHTML = `
      <div class="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto">
        <!-- MODAL HEADER & TABS -->
        <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div class="flex items-center gap-2">
            <span class="text-xl">⚙️</span>
            <h3 class="font-bold text-gray-900 dark:text-white text-base">Cấu Hình Cloud & AI Tư Vấn</h3>
          </div>
          <button onclick="closeDbConfigModal()" class="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-gray-500 dark:text-gray-400 flex items-center justify-center text-sm transition">✕</button>
        </div>

        <!-- TAB NAVIGATION -->
        <div class="flex border-b border-gray-200 dark:border-zinc-800 text-xs">
          <button 
            type="button" 
            id="tabBtnDb" 
            onclick="switchModalTab('db')" 
            class="py-2 px-4 border-b-2 font-bold transition flex items-center gap-1.5 border-amber-800 text-amber-800 dark:text-amber-400"
          >
            <span>☁️ Supabase Cloud DB</span>
          </button>
          <button 
            type="button" 
            id="tabBtnGemini" 
            onclick="switchModalTab('gemini')" 
            class="py-2 px-4 border-b-2 font-medium transition flex items-center gap-1.5 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <span>✨ Google Gemini AI</span>
          </button>
        </div>

        <!-- ==================== TAB 1: CLOUD DATABASE ==================== -->
        <div id="modalTabDbContent" class="space-y-3.5">
          <div id="dbModalStatusBanner" class="p-3.5 rounded-xl text-xs leading-relaxed">
            Đang kiểm tra trạng thái database...
          </div>

          <form id="dbConfigForm" onsubmit="handleDbConfigSubmit(event)" class="space-y-3.5 text-xs">
            <div>
              <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Supabase Project URL <span class="text-red-500">*</span>
              </label>
              <input 
                type="url" 
                id="cfgSupabaseUrl" 
                placeholder="https://xxxxxxxxxxxx.supabase.co" 
                class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:border-amber-700 font-mono text-xs" 
                required
              />
              <p class="text-[10px] text-gray-400 mt-1">Lấy tại: Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project URL</p>
            </div>

            <div>
              <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Supabase API Key (anon public key hoặc service_role key) <span class="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                id="cfgSupabaseKey" 
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
                class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:border-amber-700 font-mono text-xs" 
                required
              />
              <p class="text-[10px] text-gray-400 mt-1">Lấy tại: Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project API keys</p>
            </div>

            <label class="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer pt-1">
              <input type="checkbox" id="cfgAutoSync" checked class="rounded text-amber-700 focus:ring-amber-600" />
              <span class="font-medium text-xs">Tự động đồng bộ toàn bộ danh mục, sản phẩm và đơn hàng từ máy tính lên Cloud ngay sau khi kết nối</span>
            </label>

            <div class="flex gap-2 pt-2">
              <button 
                type="submit" 
                id="btnSaveDbConfig" 
                class="flex-1 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <span>🚀 Kết Nối & Chuyển Sang Cloud</span>
              </button>
              <button 
                type="button" 
                onclick="handleManualSync()" 
                id="btnManualSync" 
                class="py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 font-semibold text-xs transition"
                title="Đẩy dữ liệu từ máy lên Cloud"
              >
                🔄 Đồng Bộ Dữ Liệu
              </button>
            </div>
          </form>

          <div class="p-3 bg-amber-50/70 dark:bg-zinc-800/60 rounded-xl border border-amber-200/50 dark:border-zinc-700/60 text-[11px] space-y-1.5 text-gray-600 dark:text-gray-400">
            <div class="font-bold text-amber-900 dark:text-amber-300">📖 3 Bước kết nối Supabase Cloud miễn phí:</div>
            <div>1. Truy cập <strong>supabase.com</strong> tạo tài khoản & Project mới (miễn phí).</div>
            <div>2. Vào menu <strong>SQL Editor</strong> &rarr; Dán nội dung file <code class="bg-white dark:bg-zinc-900 px-1 py-0.5 rounded border border-amber-300/50">supabase_schema.sql</code> &rarr; Nhấn <strong>Run</strong>.</div>
            <div>3. Copy <strong>Project URL</strong> và <strong>anon key</strong> dán vào ô trên và lưu lại.</div>
            <div class="text-[10px] text-amber-800 dark:text-amber-400 pt-0.5">💡 Triển khai Vercel: Thêm 2 biến này vào <em>Vercel &rarr; Settings &rarr; Environment Variables</em> để không bị mất dữ liệu!</div>
          </div>
        </div>

        <!-- ==================== TAB 2: GEMINI AI ==================== -->
        <div id="modalTabGeminiContent" class="space-y-3.5 hidden">
          <div id="aiModalStatusBanner" class="p-3.5 rounded-xl text-xs leading-relaxed">
            Đang kiểm tra trạng thái Gemini AI...
          </div>

          <form id="geminiConfigForm" onsubmit="handleGeminiConfigSubmit(event)" class="space-y-3.5 text-xs">
            <div>
              <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Google Gemini API Key <span class="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                id="cfgGeminiKey" 
                placeholder="AIzaSy..." 
                class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:border-purple-600 font-mono text-xs" 
                required
              />
              <div class="flex items-center justify-between mt-1 text-[11px]">
                <span class="text-gray-400">Hỗ trợ Gemini 2.5 Flash & 3.8 Flash tốc độ cao</span>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-0.5">
                  <span>👉 Lấy API Key Miễn Phí</span>
                  <span>&rarr;</span>
                </a>
              </div>
            </div>

            <button 
              type="submit" 
              id="btnSaveGeminiConfig" 
              class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <span>🚀 Kiểm Tra & Kích Hoạt Gemini AI</span>
            </button>
          </form>

          <div class="p-3 bg-purple-50/70 dark:bg-zinc-800/60 rounded-xl border border-purple-200/50 dark:border-zinc-700/60 text-[11px] space-y-1.5 text-gray-600 dark:text-gray-400">
            <div class="font-bold text-purple-900 dark:text-purple-300">✨ Lợi ích vượt trội của Gemini AI:</div>
            <div>• Tự động đọc và ghi nhớ toàn bộ sản phẩm thực tế từ Database của moccnha.</div>
            <div>• Hiểu tự nhiên các câu hỏi phức tạp như: <em>"ở đây gồm những bàn ghế nào"</em>, <em>"tư vấn combo phòng ngủ nhỏ"</em>, <em>"phí ship quận 7 bao nhiêu"</em>.</div>
            <div>• Trả lời lịch sự, thân thiện, báo giá chính xác và gợi ý sản phẩm phù hợp.</div>
            <div class="text-[10px] text-purple-800 dark:text-purple-400 pt-0.5">💡 Triển khai Vercel: Thêm biến <code>GEMINI_API_KEY</code> vào <em>Vercel &rarr; Settings &rarr; Environment Variables</em> để kích hoạt AI trên web thật!</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.remove('hidden');
  const savedUrl = localStorage.getItem('mocnha_supabase_url');
  const savedKey = localStorage.getItem('mocnha_supabase_key');
  const inputUrl = document.getElementById('cfgSupabaseUrl');
  const inputKey = document.getElementById('cfgSupabaseKey');
  if (inputUrl && !inputUrl.value && savedUrl) inputUrl.value = savedUrl;
  if (inputKey && !inputKey.value && savedKey) inputKey.value = savedKey;

  switchModalTab(defaultTab);
  updateDbModalBanner();
  updateAiModalBanner();
}

function switchModalTab(tab) {
  const tabDb = document.getElementById('modalTabDbContent');
  const tabGemini = document.getElementById('modalTabGeminiContent');
  const btnDb = document.getElementById('tabBtnDb');
  const btnGemini = document.getElementById('tabBtnGemini');

  if (tab === 'gemini') {
    tabDb?.classList.add('hidden');
    tabGemini?.classList.remove('hidden');
    btnDb?.classList.remove('border-amber-800', 'text-amber-800', 'dark:text-amber-400', 'font-bold');
    btnDb?.classList.add('border-transparent', 'text-gray-500', 'font-medium');
    btnGemini?.classList.add('border-purple-600', 'text-purple-600', 'dark:text-purple-400', 'font-bold');
    btnGemini?.classList.remove('border-transparent', 'text-gray-500', 'font-medium');
  } else {
    tabGemini?.classList.add('hidden');
    tabDb?.classList.remove('hidden');
    btnGemini?.classList.remove('border-purple-600', 'text-purple-600', 'dark:text-purple-400', 'font-bold');
    btnGemini?.classList.add('border-transparent', 'text-gray-500', 'font-medium');
    btnDb?.classList.add('border-amber-800', 'text-amber-800', 'dark:text-amber-400', 'font-bold');
    btnDb?.classList.remove('border-transparent', 'text-gray-500', 'font-medium');
  }
}

function closeDbConfigModal() {
  const modal = document.getElementById('dbConfigModal');
  if (modal) modal.classList.add('hidden');
}

async function updateDbModalBanner() {
  const banner = document.getElementById('dbModalStatusBanner');
  if (!banner) return;
  try {
    const res = await fetch('/api/db-status');
    const data = await res.json();
    if (data.mode === 'supabase') {
      banner.className = 'p-3.5 rounded-xl text-xs leading-relaxed bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300';
      banner.innerHTML = `
        <div class="font-bold flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Đang kết nối Supabase Cloud PostgreSQL
        </div>
        <div class="mt-1 text-[11px] opacity-90">Dữ liệu được lưu vĩnh viễn trên đám mây, an toàn tuyệt đối và đồng bộ trên mọi thiết bị. URL: <span class="font-mono">${data.url}</span></div>
      `;
    } else {
      banner.className = 'p-3.5 rounded-xl text-xs leading-relaxed bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300';
      banner.innerHTML = `
        <div class="font-bold flex items-center gap-1.5">
          <span>⚠️</span>
          Đang lưu trữ nội bộ (SQLite file moho_store.db)
        </div>
        <div class="mt-1 text-[11px] opacity-90">Dữ liệu chỉ lưu tạm trên máy này và sẽ bị reset trên Vercel. Hãy nhập thông tin Supabase dưới đây để chuyển sang lưu trữ đám mây.</div>
      `;
    }
  } catch (e) {
    banner.innerText = 'Chưa kiểm tra được trạng thái database';
  }
}

async function updateAiModalBanner() {
  const banner = document.getElementById('aiModalStatusBanner');
  if (!banner) return;
  try {
    const res = await fetch('/api/admin/ai-status');
    const data = await res.json();
    if (data.enabled) {
      banner.className = 'p-3.5 rounded-xl text-xs leading-relaxed bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300';
      banner.innerHTML = `
        <div class="font-bold flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
          Google Gemini AI Đang Kích Hoạt
        </div>
        <div class="mt-1 text-[11px] opacity-90">Mô hình: <span class="font-bold">${data.model}</span> (Key: <span class="font-mono">${data.key_preview || '***'}</span>). Trợ lý tư vấn khách hàng tự động hiểu ngữ nghĩa tự nhiên và tư vấn sản phẩm chính xác.</div>
      `;
    } else {
      banner.className = 'p-3.5 rounded-xl text-xs leading-relaxed bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300';
      banner.innerHTML = `
        <div class="font-bold flex items-center gap-1.5">
          <span>⚠️</span>
          Chưa Cấu Hình Gemini AI
        </div>
        <div class="mt-1 text-[11px] opacity-90">Hiện tại chatbox đang dùng bộ quy tắc mẫu (rule-based). Hãy nhập Gemini API Key dưới đây để kích hoạt AI thông minh vượt trội.</div>
      `;
    }
  } catch (e) {
    banner.innerText = 'Chưa kiểm tra được trạng thái Gemini AI';
  }
}

async function handleDbConfigSubmit(e) {
  e.preventDefault();
  const url = document.getElementById('cfgSupabaseUrl').value.trim();
  const key = document.getElementById('cfgSupabaseKey').value.trim();
  const autoSync = document.getElementById('cfgAutoSync').checked;
  const btn = document.getElementById('btnSaveDbConfig');

  if (!url || !key) {
    showToast('Vui lòng điền đủ URL và API Key!', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span>⏳ Đang kiểm tra & kết nối...</span>`;

  try {
    const res = await fetch('/api/admin/db-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabase_url: url,
        supabase_key: key,
        auto_sync: autoSync
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      localStorage.setItem('mocnha_supabase_url', url);
      localStorage.setItem('mocnha_supabase_key', key);
      showToast('🎉 Kết nối Supabase Cloud thành công!', 'success');
      loadDbStatus();
      updateDbModalBanner();
      setTimeout(() => {
        closeDbConfigModal();
        location.reload();
      }, 1500);
    } else {
      showToast(data.error || 'Kết nối Supabase thất bại. Vui lòng kiểm tra lại URL hoặc Key!', 'error');
    }
  } catch (err) {
    showToast('Lỗi gửi yêu cầu kết nối: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>🚀 Kết Nối & Chuyển Sang Cloud</span>`;
  }
}

async function handleGeminiConfigSubmit(e) {
  e.preventDefault();
  const key = document.getElementById('cfgGeminiKey').value.trim();
  const btn = document.getElementById('btnSaveGeminiConfig');

  if (!key) {
    showToast('Vui lòng nhập Gemini API Key!', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span>⏳ Đang kiểm tra API Key với Google...</span>`;

  try {
    const res = await fetch('/api/admin/gemini-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemini_api_key: key })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('🎉 Kích hoạt Google Gemini AI thành công!', 'success');
      loadAiStatus();
      updateAiModalBanner();
      setTimeout(() => {
        closeDbConfigModal();
      }, 1500);
    } else {
      showToast(data.error || 'API Key không hợp lệ hoặc không có quyền truy cập Gemini API!', 'error');
    }
  } catch (err) {
    showToast('Lỗi gửi cấu hình: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>🚀 Kiểm Tra & Kích Hoạt Gemini AI</span>`;
  }
}

async function handleManualSync() {
  const btn = document.getElementById('btnManualSync');
  btn.disabled = true;
  btn.innerText = '⏳ Đang đồng bộ...';
  try {
    const res = await fetch('/api/admin/db-sync', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      const s = data.stats || {};
      showToast(`✅ Đã đồng bộ lên Cloud: ${s.categories || 0} danh mục, ${s.products || 0} sản phẩm, ${s.orders || 0} đơn hàng!`, 'success');
    } else {
      showToast(data.error || 'Đồng bộ thất bại', 'error');
    }
  } catch (e) {
    showToast('Lỗi đồng bộ: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '🔄 Đồng Bộ Dữ Liệu';
  }
}

async function loadAdminQuotes() {
  const tbody = document.getElementById('adminQuotesTableBody');
  if (!tbody) return;
  try {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">Đang tải danh sách yêu cầu báo giá...</td></tr>`;
    const res = await fetch('/api/quotes');
    const data = await res.json();
    const quotes = Array.isArray(data) ? data : [];

    if (quotes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400">
        <div class="text-3xl mb-1.5">📄</div>
        <div class="font-bold text-gray-600 dark:text-gray-300">Chưa có yêu cầu báo giá nào từ khách hàng</div>
      </td></tr>`;
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

// ==============================================================================
// 5. TƯ VẤN KHÁCH HÀNG (ADMIN CHATBOX SESSIONS)
// ==============================================================================

let ADMIN_CHAT_SESSIONS = [];
let ACTIVE_ADMIN_SESSION_ID = null;

async function loadAdminChatSessions() {
  const container = document.getElementById('adminChatSessionsList');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/chat/sessions');
    const sessions = await res.json() || [];
    ADMIN_CHAT_SESSIONS = sessions;

    const countEl = document.getElementById('adminSessionCount');
    if (countEl) countEl.textContent = sessions.length;

    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-gray-400 text-xs">
          <span class="text-2xl block mb-1">📭</span>
          Chưa có khách hàng nào gửi tin nhắn tư vấn.
        </div>
      `;
      return;
    }

    container.innerHTML = sessions.map(sess => {
      const isActive = sess.session_id === ACTIVE_ADMIN_SESSION_ID;
      const unread = sess.unread_count || 0;
      const timeStr = sess.updated_at ? new Date(sess.updated_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div 
          onclick="selectAdminChatSession('${sess.session_id}')" 
          class="p-3.5 hover:bg-white dark:hover:bg-zinc-800/80 cursor-pointer transition flex items-start gap-3 ${isActive ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-800 dark:border-amber-500' : ''}"
        >
          <div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
            ${(sess.customer_name || 'K').charAt(0).toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <div class="font-bold text-xs text-gray-900 dark:text-white truncate">
                ${sess.customer_name || 'Khách hàng'}
              </div>
              <span class="text-[10px] text-gray-400 flex-shrink-0">${timeStr}</span>
            </div>
            <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
              ${sess.last_message || 'Bắt đầu cuộc hội thoại'}
            </div>
            ${sess.customer_phone ? `<div class="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">📞 ${sess.customer_phone}</div>` : ''}
          </div>
          ${unread > 0 ? `<span class="bg-amber-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">${unread}</span>` : ''}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="p-4 text-center text-red-500 text-xs">Lỗi khi tải danh sách hội thoại</div>`;
  }
}

async function selectAdminChatSession(sessionId) {
  ACTIVE_ADMIN_SESSION_ID = sessionId;
  const sess = ADMIN_CHAT_SESSIONS.find(s => s.session_id === sessionId);
  
  // Update header info
  const nameEl = document.getElementById('adminActiveCustomerName');
  const metaEl = document.getElementById('adminActiveSessionMeta');
  const actionsEl = document.getElementById('adminChatActions');
  const inputEl = document.getElementById('adminReplyInput');
  const btnEl = document.getElementById('adminReplySendBtn');

  if (nameEl) nameEl.textContent = sess ? (sess.customer_name || 'Khách hàng') : 'Khách hàng';
  if (metaEl) {
    metaEl.textContent = `Mã phiên: ${sessionId} ${sess && sess.customer_phone ? ' • 📞 ' + sess.customer_phone : ''}`;
  }
  if (actionsEl) actionsEl.classList.remove('hidden');
  if (inputEl) {
    inputEl.disabled = false;
    inputEl.placeholder = `Nhập câu trả lời gửi đến ${sess ? (sess.customer_name || 'Khách') : 'khách'}...`;
    inputEl.focus();
  }
  if (btnEl) btnEl.disabled = false;

  // Refresh left sidebar to show active state and clear unread badge
  loadAdminChatSessions();

  // Load message history
  const messagesArea = document.getElementById('adminChatMessagesArea');
  if (messagesArea) {
    messagesArea.innerHTML = `<div class="p-4 text-center text-gray-400 text-xs">Đang tải lịch sử tin nhắn...</div>`;
    try {
      const res = await fetch(`/api/admin/chat/sessions/${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      const messages = data.messages || [];

      if (messages.length === 0) {
        messagesArea.innerHTML = `<div class="p-8 text-center text-gray-400 text-xs">Chưa có tin nhắn nào trong phiên này.</div>`;
        return;
      }

      messagesArea.innerHTML = messages.map(msg => {
        const isCustomer = msg.sender === 'customer';
        const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
        
        if (isCustomer) {
          return `
            <div class="flex items-start gap-2 max-w-[80%] self-start">
              <div class="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                ${(msg.customer_name || 'K').charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 p-3 rounded-2xl rounded-tl-xs shadow-2xs leading-relaxed break-words">
                  ${msg.message.replace(/\n/g, '<br>')}
                </div>
                <div class="text-[10px] text-gray-400 mt-1 pl-1">${msg.customer_name || 'Khách hàng'} • ${timeStr}</div>
              </div>
            </div>
          `;
        } else {
          return `
            <div class="flex items-start justify-end gap-2 max-w-[80%] self-end ml-auto">
              <div>
                <div class="bg-amber-800 text-white p-3 rounded-2xl rounded-tr-xs shadow-2xs leading-relaxed break-words">
                  ${msg.message.replace(/\n/g, '<br>')}
                </div>
                <div class="text-[10px] text-gray-400 mt-1 pr-1 text-right">Tư vấn viên (moccnha) • ${timeStr}</div>
              </div>
              <div class="w-6 h-6 rounded-full bg-amber-800 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                M
              </div>
            </div>
          `;
        }
      }).join('');

      messagesArea.scrollTop = messagesArea.scrollHeight;

    } catch (err) {
      console.error(err);
      messagesArea.innerHTML = `<div class="p-4 text-center text-red-500 text-xs">Lỗi khi tải tin nhắn</div>`;
    }
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

// ==============================================================================
// 5. TƯ VẤN KHÁCH HÀNG (ADMIN CHATBOX SESSIONS)
// ==============================================================================

let ADMIN_CHAT_SESSIONS = [];
let ACTIVE_ADMIN_SESSION_ID = null;

async function loadAdminChatSessions() {
  const container = document.getElementById('adminChatSessionsList');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/chat/sessions');
    const sessions = await res.json() || [];
    ADMIN_CHAT_SESSIONS = sessions;

    const countEl = document.getElementById('adminSessionCount');
    if (countEl) countEl.textContent = sessions.length;

    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-gray-400 text-xs">
          <span class="text-2xl block mb-1">📭</span>
          Chưa có khách hàng nào gửi tin nhắn tư vấn.
        </div>
      `;
      return;
    }

    container.innerHTML = sessions.map(sess => {
      const isActive = sess.session_id === ACTIVE_ADMIN_SESSION_ID;
      const unread = sess.unread_count || 0;
      const timeStr = sess.updated_at ? new Date(sess.updated_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div 
          onclick="selectAdminChatSession('${sess.session_id}')" 
          class="p-3.5 hover:bg-white dark:hover:bg-zinc-800/80 cursor-pointer transition flex items-start gap-3 ${isActive ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-800 dark:border-amber-500' : ''}"
        >
          <div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
            ${(sess.customer_name || 'K').charAt(0).toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <div class="font-bold text-xs text-gray-900 dark:text-white truncate">
                ${sess.customer_name || 'Khách hàng'}
              </div>
              <span class="text-[10px] text-gray-400 flex-shrink-0">${timeStr}</span>
            </div>
            <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
              ${sess.last_message || 'Bắt đầu cuộc hội thoại'}
            </div>
            ${sess.customer_phone ? `<div class="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">📞 ${sess.customer_phone}</div>` : ''}
          </div>
          ${unread > 0 ? `<span class="bg-amber-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">${unread}</span>` : ''}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="p-4 text-center text-red-500 text-xs">Lỗi khi tải danh sách hội thoại</div>`;
  }
}

async function selectAdminChatSession(sessionId) {
  ACTIVE_ADMIN_SESSION_ID = sessionId;
  const sess = ADMIN_CHAT_SESSIONS.find(s => s.session_id === sessionId);
  
  // Update header info
  const nameEl = document.getElementById('adminActiveCustomerName');
  const metaEl = document.getElementById('adminActiveSessionMeta');
  const actionsEl = document.getElementById('adminChatActions');
  const inputEl = document.getElementById('adminReplyInput');
  const btnEl = document.getElementById('adminReplySendBtn');

  if (nameEl) nameEl.textContent = sess ? (sess.customer_name || 'Khách hàng') : 'Khách hàng';
  if (metaEl) {
    metaEl.textContent = `Mã phiên: ${sessionId} ${sess && sess.customer_phone ? ' • 📞 ' + sess.customer_phone : ''}`;
  }
  if (actionsEl) actionsEl.classList.remove('hidden');
  if (inputEl) {
    inputEl.disabled = false;
    inputEl.placeholder = `Nhập câu trả lời gửi đến ${sess ? (sess.customer_name || 'Khách') : 'khách'}...`;
    inputEl.focus();
  }
  if (btnEl) btnEl.disabled = false;

  // Refresh left sidebar to show active state and clear unread badge
  loadAdminChatSessions();

  // Load message history
  const messagesArea = document.getElementById('adminChatMessagesArea');
  if (messagesArea) {
    messagesArea.innerHTML = `<div class="p-4 text-center text-gray-400 text-xs">Đang tải lịch sử tin nhắn...</div>`;
    try {
      const res = await fetch(`/api/admin/chat/sessions/${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      const messages = data.messages || [];

      if (messages.length === 0) {
        messagesArea.innerHTML = `<div class="p-8 text-center text-gray-400 text-xs">Chưa có tin nhắn nào trong phiên này.</div>`;
        return;
      }

      messagesArea.innerHTML = messages.map(msg => {
        const isCustomer = msg.sender === 'customer';
        const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
        
        if (isCustomer) {
          return `
            <div class="flex items-start gap-2 max-w-[80%] self-start">
              <div class="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                ${(msg.customer_name || 'K').charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 p-3 rounded-2xl rounded-tl-xs shadow-2xs leading-relaxed break-words">
                  ${msg.message.replace(/\n/g, '<br>')}
                </div>
                <div class="text-[10px] text-gray-400 mt-1 pl-1">${msg.customer_name || 'Khách hàng'} • ${timeStr}</div>
              </div>
            </div>
          `;
        } else {
          return `
            <div class="flex items-start justify-end gap-2 max-w-[80%] self-end ml-auto">
              <div>
                <div class="bg-amber-800 text-white p-3 rounded-2xl rounded-tr-xs shadow-2xs leading-relaxed break-words">
                  ${msg.message.replace(/\n/g, '<br>')}
                </div>
                <div class="text-[10px] text-gray-400 mt-1 pr-1 text-right">Tư vấn viên (moccnha) • ${timeStr}</div>
              </div>
              <div class="w-6 h-6 rounded-full bg-amber-800 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                M
              </div>
            </div>
          `;
        }
      }).join('');

      messagesArea.scrollTop = messagesArea.scrollHeight;

    } catch (err) {
      console.error(err);
      messagesArea.innerHTML = `<div class="p-4 text-center text-red-500 text-xs">Lỗi khi tải tin nhắn</div>`;
    }
  }
}

async function handleAdminSendReply(e) {
  e.preventDefault();
  if (!ACTIVE_ADMIN_SESSION_ID) return;

  const input = document.getElementById('adminReplyInput');
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';

  try {
    const res = await fetch('/api/admin/chat/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: ACTIVE_ADMIN_SESSION_ID,
        message: msg
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Đã gửi tin nhắn tư vấn thành công!', 'success');
      selectAdminChatSession(ACTIVE_ADMIN_SESSION_ID);
    } else {
      showToast(data.error || 'Gửi tin nhắn thất bại', 'error');
    }
  } catch (err) {
    showToast('Lỗi mạng', 'error');
  }
}

async function deleteCurrentChatSession() {
  if (!ACTIVE_ADMIN_SESSION_ID) return;
  if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ cuộc hội thoại này?')) return;

  try {
    const res = await fetch(`/api/admin/chat/sessions/${encodeURIComponent(ACTIVE_ADMIN_SESSION_ID)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Đã xóa cuộc hội thoại', 'info');
      ACTIVE_ADMIN_SESSION_ID = null;
      document.getElementById('adminActiveCustomerName').textContent = 'Chọn một cuộc hội thoại từ danh sách';
      document.getElementById('adminActiveSessionMeta').textContent = 'Chưa chọn cuộc hội thoại nào';
      document.getElementById('adminChatActions').classList.add('hidden');
      document.getElementById('adminReplyInput').disabled = true;
      document.getElementById('adminReplySendBtn').disabled = true;
      document.getElementById('adminChatMessagesArea').innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
          <span class="text-3xl mb-2">💬</span>
          <p>Vui lòng bấm vào một phiên chat ở cột bên trái để xem lịch sử và trả lời khách hàng.</p>
        </div>
      `;
      loadAdminChatSessions();
      loadAdminStats();
    }
  } catch (err) {
    showToast('Lỗi khi xóa cuộc hội thoại', 'error');
  }
}

async function handleResetDemoData() {
  if (!confirm('Bạn có muốn nạp lại bộ dữ liệu gốc (12 sản phẩm, danh mục, đơn hàng mẫu) không?')) return;
  try {
    showToast('⏳ Đang nạp dữ liệu mẫu...', 'info');
    const res = await fetch('/api/admin/reset-demo-data', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('🎉 Nạp dữ liệu mẫu thành công!', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showToast(data.error || 'Nạp dữ liệu mẫu thất bại', 'error');
    }
  } catch (e) {
    showToast('Lỗi kết nối: ' + e.message, 'error');
  }
}

