/**
 * Admin Dashboard Logic
 */

let ADMIN_THEME = localStorage.getItem('moho_theme') || 'light';

document.addEventListener('DOMContentLoaded', () => {
  initAdminTheme();
  loadAdminStats();
  loadAdminOrders();
  loadAdminProducts();
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
  const productsTab = document.getElementById('productsTabContent');
  const ordersBtn = document.getElementById('tabOrdersBtn');
  const productsBtn = document.getElementById('tabProductsBtn');

  if (tab === 'orders') {
    ordersTab.classList.remove('hidden');
    productsTab.classList.add('hidden');
    ordersBtn.classList.add('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-400');
    ordersBtn.classList.remove('text-gray-500');
    productsBtn.classList.remove('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-400');
    productsBtn.classList.add('text-gray-500');
  } else {
    ordersTab.classList.add('hidden');
    productsTab.classList.remove('hidden');
    productsBtn.classList.add('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-400');
    productsBtn.classList.remove('text-gray-500');
    ordersBtn.classList.remove('border-b-2', 'border-amber-800', 'text-amber-800', 'dark:text-amber-400');
    ordersBtn.classList.add('text-gray-500');
  }
}

function formatPrice(number) {
  return new Intl.NumberFormat('vi-VN').format(number) + '₫';
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    document.getElementById('statRevenue').textContent = formatPrice(data.total_revenue || 0);
    document.getElementById('statOrders').textContent = data.total_orders || 0;
    document.getElementById('statProducts').textContent = data.total_products || 0;
    document.getElementById('ordersCountBadge').textContent = data.total_orders || 0;
    document.getElementById('productsCountBadge').textContent = data.total_products || 0;
  } catch (err) {
    console.error(err);
  }
}

async function loadAdminOrders() {
  const tbody = document.getElementById('adminOrdersTableBody');
  try {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">Đang tải danh sách đơn hàng...</td></tr>`;
    const res = await fetch('/api/orders');
    const orders = await res.json();

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">Chưa có đơn hàng nào phát sinh</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(order => {
      const statusMap = {
        'pending': { text: 'Chờ xử lý', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-400' },
        'confirmed': { text: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400' },
        'shipping': { text: 'Đang vận chuyển', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-400' },
        'completed': { text: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400' },
        'cancelled': { text: 'Đã hủy', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400' }
      };

      const statusInfo = statusMap[order.status] || { text: order.status, color: 'bg-gray-100 text-gray-700' };

      const itemsList = Array.isArray(order.items) ? order.items : [];

      return `
        <tr class="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition">
          <td class="p-3.5 font-bold text-amber-800 dark:text-amber-400">${order.order_code}</td>
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
          <td class="p-3.5 text-xs">${order.payment_method}</td>
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
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500">Lỗi khi tải đơn hàng</td></tr>`;
  }
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
