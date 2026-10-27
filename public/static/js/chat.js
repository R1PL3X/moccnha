/**
 * moccnha Floating Customer Service Chatbox Widget
 * Includes real-time database-backed consultation, AI interior advisor,
 * order lookup, and persistent chat sessions.
 */

(function () {
  // Ensure unique session ID per visitor
  let sessionId = localStorage.getItem('moc_chat_session_id');
  if (!sessionId) {
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    sessionId = `CHAT-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
    localStorage.setItem('moc_chat_session_id', sessionId);
  }

  let chatHistory = [];
  let isOpen = false;
  let isSending = false;

  // Helper to format text with simple markdown bold & newlines
  function formatChatText(text) {
    if (!text) return '';
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Bold **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Bullet points
    escaped = escaped.replace(/•/g, '&bull;');
    // Newlines to <br>
    return escaped.replace(/\n/g, '<br>');
  }

  // Inject HTML markup into document.body
  function injectChatWidget() {
    if (document.getElementById('mocChatWidgetContainer')) return;

    const container = document.createElement('div');
    container.id = 'mocChatWidgetContainer';
    container.innerHTML = `
      <!-- FLOATING TRIGGER BUTTON -->
      <button 
        id="mocChatTriggerBtn" 
        onclick="toggleMocChat()" 
        class="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 bg-gradient-to-r from-amber-800 to-amber-900 hover:from-amber-900 hover:to-amber-950 text-white font-medium text-xs sm:text-sm py-3 px-4 sm:px-5 rounded-full shadow-2xl flex items-center gap-2.5 transition transform hover:scale-105 active:scale-95 group border border-amber-600/30"
        title="Tư vấn khách hàng trực tuyến"
      >
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        <svg class="w-5 h-5 transition group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span class="font-semibold tracking-wide">Tư vấn ngay</span>
        <span id="mocChatBadge" class="hidden bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full -ml-1">1</span>
      </button>

      <!-- CHAT WINDOW MODAL -->
      <div 
        id="mocChatWindow" 
        class="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-50 w-[92vw] sm:w-[390px] h-[540px] max-h-[82vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 flex flex-col overflow-hidden transition-all duration-300 transform scale-95 opacity-0 pointer-events-none origin-bottom-right"
      >
        <!-- HEADER -->
        <div class="bg-gradient-to-r from-amber-800 to-amber-950 p-4 text-white flex items-center justify-between shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg font-bold shadow-inner">
              🪵
            </div>
            <div>
              <div class="font-bold text-sm tracking-wide flex items-center gap-1.5">
                <span>Tư Vấn Khách Hàng</span>
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <div class="text-[11px] text-amber-200/90 flex items-center gap-1">
                <span>moccnha AI • Phản hồi tức thì</span>
              </div>
            </div>
          </div>
          <button 
            onclick="toggleMocChat()" 
            class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 text-white/80 hover:text-white flex items-center justify-center text-sm transition"
            title="Đóng chatbox"
          >
            ✕
          </button>
        </div>

        <!-- QUICK PROMPT CHIPS -->
        <div id="mocChatChips" class="px-3 py-2 bg-amber-50/60 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800 flex gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <button onclick="sendQuickPrompt('ở đây gồm những bàn ghế nào')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 hover:border-amber-700 text-amber-900 dark:text-amber-300 transition shadow-xs font-medium">🪑 Các mẫu bàn ghế</button>
          <button onclick="sendQuickPrompt('Combo HOBRO 1m6')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 hover:border-amber-700 text-amber-900 dark:text-amber-300 transition shadow-xs font-medium">🛏️ Combo HOBRO</button>
          <button onclick="sendQuickPrompt('Bộ sưu tập VLINE')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 hover:border-amber-700 text-amber-900 dark:text-amber-300 transition shadow-xs font-medium">🛋️ BST VLINE</button>
          <button onclick="sendQuickPrompt('Phí giao hàng & lắp đặt')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 hover:border-amber-700 text-amber-900 dark:text-amber-300 transition shadow-xs font-medium">🚚 Giao hàng</button>
          <button onclick="sendQuickPrompt('Chính sách bảo hành')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 hover:border-amber-700 text-amber-900 dark:text-amber-300 transition shadow-xs font-medium">🛡️ Bảo hành 2 năm</button>
          <button onclick="sendQuickPrompt('Địa chỉ Showroom')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 hover:border-amber-700 text-amber-900 dark:text-amber-300 transition shadow-xs font-medium">📍 Showroom</button>
          <button onclick="sendQuickPrompt('Tra cứu đơn hàng của tôi')" class="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 hover:border-amber-700 text-amber-900 dark:text-amber-300 transition shadow-xs font-medium">📦 Tra cứu đơn</button>
        </div>

        <!-- MESSAGES CONTAINER -->
        <div id="mocChatMessages" class="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs bg-gray-50/40 dark:bg-zinc-950/40">
          <!-- Initial welcome -->
          <div class="flex gap-2 max-w-[85%] self-start">
            <div class="w-6 h-6 rounded-full bg-amber-800 text-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-1">
              M
            </div>
            <div class="bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 p-3 rounded-2xl rounded-tl-xs shadow-xs border border-gray-100 dark:border-zinc-700/60 leading-relaxed">
              Dạ moccnha xin chào Quý khách! 👋<br><br>
              Em có thể hỗ trợ tư vấn về <strong>Combo phòng ngủ, Sofa, Bàn ghế ăn</strong>, hoặc kiểm tra tiến độ giao hàng cho Quý khách ngay bây giờ ạ!
            </div>
          </div>
        </div>

        <!-- TYPING INDICATOR -->
        <div id="mocChatTyping" class="hidden px-4 py-1.5 text-[11px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1.5 bg-gray-50/40 dark:bg-zinc-950/40">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce"></span>
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce [animation-delay:0.2s]"></span>
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce [animation-delay:0.4s]"></span>
          <span>Tư vấn viên moccnha đang soạn tin...</span>
        </div>

        <!-- INPUT FORM -->
        <form onsubmit="handleMocChatSubmit(event)" class="p-2.5 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
          <input 
            id="mocChatInput" 
            type="text" 
            autocomplete="off"
            placeholder="Nhập câu hỏi hoặc mã đơn (MOC-xxxxx)..." 
            class="flex-1 px-3.5 py-2.5 text-xs rounded-full border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:border-amber-700 focus:bg-white dark:focus:bg-zinc-800 transition"
          />
          <button 
            type="submit" 
            id="mocChatSendBtn"
            class="w-9 h-9 rounded-full bg-amber-800 hover:bg-amber-900 text-white flex items-center justify-center transition flex-shrink-0 shadow-md active:scale-95 disabled:opacity-50"
            title="Gửi tin nhắn"
          >
            <svg class="w-4 h-4 transform rotate-45 -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(container);
    loadChatHistory();
  }

  // Toggle chat window open/closed
  window.toggleMocChat = function () {
    const win = document.getElementById('mocChatWindow');
    if (!win) return;
    isOpen = !isOpen;

    if (isOpen) {
      win.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
      win.classList.add('opacity-100', 'scale-100');
      document.getElementById('mocChatBadge')?.classList.add('hidden');
      setTimeout(() => {
        document.getElementById('mocChatInput')?.focus();
        scrollToBottom();
      }, 100);
    } else {
      win.classList.remove('opacity-100', 'scale-100');
      win.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
    }
  };

  // Quick prompt handler
  window.sendQuickPrompt = function (text) {
    const input = document.getElementById('mocChatInput');
    if (input) {
      input.value = text;
      document.getElementById('mocChatSendBtn')?.click();
    }
  };

  // Scroll messages to bottom
  function scrollToBottom() {
    const container = document.getElementById('mocChatMessages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // Load chat history from backend database
  async function loadChatHistory() {
    try {
      const res = await fetch(`/api/chat/history?session_id=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        chatHistory = data.messages;
        renderMessages();
      }
    } catch (e) {
      console.warn('Could not load chat history:', e);
    }
  }

  // Render chat messages inside container
  function renderMessages() {
    const container = document.getElementById('mocChatMessages');
    if (!container) return;

    if (chatHistory.length === 0) return;

    container.innerHTML = chatHistory.map(msg => {
      const isCustomer = msg.sender === 'customer';
      if (isCustomer) {
        return `
          <div class="flex justify-end">
            <div class="bg-amber-800 text-white p-3 rounded-2xl rounded-tr-xs shadow-xs max-w-[85%] leading-relaxed break-words">
              ${formatChatText(msg.message)}
            </div>
          </div>
        `;
      } else {
        return `
          <div class="flex gap-2 max-w-[88%] self-start">
            <div class="w-6 h-6 rounded-full bg-amber-800 text-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-1">
              M
            </div>
            <div class="bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 p-3 rounded-2xl rounded-tl-xs shadow-xs border border-gray-100 dark:border-zinc-700/60 leading-relaxed break-words">
              ${formatChatText(msg.message)}
            </div>
          </div>
        `;
      }
    }).join('');

    scrollToBottom();
  }

  // Handle send message
  window.handleMocChatSubmit = async function (e) {
    e.preventDefault();
    const input = document.getElementById('mocChatInput');
    const msg = input.value.trim();
    if (!msg || isSending) return;

    input.value = '';
    isSending = true;

    // Get current user info if logged in
    let userId = null;
    let customerName = 'Khách hàng';
    let customerPhone = '';
    let customerEmail = '';

    try {
      const storedUser = localStorage.getItem('moho_user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        userId = u.id;
        customerName = u.fullname || 'Khách hàng';
        customerPhone = u.phone || '';
        customerEmail = u.email || '';
      }
    } catch (_) {}

    // Optimistically add customer message to UI
    chatHistory.push({
      sender: 'customer',
      message: msg
    });
    renderMessages();

    // Show typing indicator
    const typing = document.getElementById('mocChatTyping');
    if (typing) typing.classList.remove('hidden');
    scrollToBottom();

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: msg,
          user_id: userId,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        chatHistory = data.messages || chatHistory;
        renderMessages();
      } else {
        chatHistory.push({
          sender: 'advisor',
          message: 'Dạ hệ thống đang bận một chút, Quý khách vui lòng thử lại sau giây lát ạ!'
        });
        renderMessages();
      }
    } catch (err) {
      chatHistory.push({
        sender: 'advisor',
        message: 'Dạ kết nối mạng không ổn định, Quý khách vui lòng gửi lại tin nhắn nhé!'
      });
      renderMessages();
    } finally {
      if (typing) typing.classList.add('hidden');
      isSending = false;
      input.focus();
    }
  };

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChatWidget);
  } else {
    injectChatWidget();
  }
})();
