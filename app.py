from flask import Flask, render_template, request, jsonify, session
import random
import string
import os

# Load .env file automatically
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import db_adapter
import chat_advisor
from database import init_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, 'public', 'static') if os.path.exists(os.path.join(BASE_DIR, 'public', 'static')) else os.path.join(BASE_DIR, 'static')

from urllib.parse import parse_qs, urlencode

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=static_dir,
    static_url_path='/static'
)
app.secret_key = os.environ.get('SECRET_KEY', 'moho-vietnam-default-secret-key-2026')

class VercelPathFixMiddleware:
    """
    WSGI Middleware to accurately restore the original request path when deployed on Vercel
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        query_string = environ.get('QUERY_STRING', '')
        custom_path = None

        if '__path' in query_string:
            try:
                qs = parse_qs(query_string, keep_blank_values=True)
                val = qs.pop('__path', [None])[0]
                if val:
                    custom_path = '/' + val.lstrip('/')
                    new_qs = []
                    for k, vals in qs.items():
                        for v in vals:
                            new_qs.append((k, v))
                    environ['QUERY_STRING'] = urlencode(new_qs)
            except Exception:
                pass

        if not custom_path:
            matched = environ.get('HTTP_X_MATCHED_PATH') or environ.get('HTTP_X_VERCEL_MATCHED_PATH')
            if matched and not matched.startswith('/api/index'):
                custom_path = matched.split('?')[0]

        if custom_path:
            environ['PATH_INFO'] = custom_path
        else:
            path = environ.get('PATH_INFO', '')
            if path in ('/api/index', '/api/index.py'):
                environ['PATH_INFO'] = '/'

        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathFixMiddleware(app.wsgi_app)

# Ensure local fallback database schema is initialized safely
try:
    init_db()
except Exception:
    pass

# --- FRONTEND PAGES ---
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/about')
@app.route('/ve-moccnha')
def about_page():
    return render_template('about.html')

@app.route('/stores')
@app.route('/cua-hang')
def stores_page():
    return render_template('stores.html')

@app.route('/news')
@app.route('/tin-tuc')
def news_page():
    return render_template('news.html')

@app.route('/b2b')
@app.route('/noi-that-gia-si')
def b2b_page():
    return render_template('b2b.html')

@app.route('/policy')
@app.route('/chinh-sach')
def policy_page():
    return render_template('policy.html')

# --- ADMIN PORTAL ROUTES ---
@app.route('/admin')
@app.route('/admin/revenue')
def admin_revenue_page():
    return render_template('admin_revenue.html')

@app.route('/admin/orders')
def admin_orders_page():
    return render_template('admin_orders.html')

@app.route('/admin/products')
def admin_products_page():
    return render_template('admin_products.html')

@app.route('/admin/quotes')
def admin_quotes_page():
    return render_template('admin_quotes.html')

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': '404 Không tìm thấy trang yêu cầu'}), 404


# --- DATABASE STATUS & CONFIG ENDPOINTS ---
@app.route('/api/db-status', methods=['GET'])
def get_db_status():
    """Returns whether the system is connected to Supabase Cloud or Local SQLite"""
    return jsonify(db_adapter.get_db_info())

@app.route('/api/admin/db-config', methods=['POST'])
def save_db_config():
    """Configure and switch to Supabase Cloud Database dynamically"""
    data = request.get_json() or {}
    url = (data.get('supabase_url') or '').strip()
    key = (data.get('supabase_key') or '').strip()
    auto_sync = data.get('auto_sync', True)

    if not url or not key:
        return jsonify({'success': False, 'error': 'Vui lòng điền cả SUPABASE_URL và SUPABASE_KEY!'}), 400

    ok, msg = db_adapter.test_and_configure_supabase(url, key)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400

    # Write to .env file in project directory
    env_path = os.path.join(ROOT_DIR, '.env')
    try:
        lines = []
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

        url_found = False
        key_found = False
        new_lines = []
        for line in lines:
            if line.startswith('SUPABASE_URL='):
                new_lines.append(f'SUPABASE_URL={url}\n')
                url_found = True
            elif line.startswith('SUPABASE_KEY='):
                new_lines.append(f'SUPABASE_KEY={key}\n')
                key_found = True
            else:
                new_lines.append(line)
        if not url_found:
            new_lines.append(f'SUPABASE_URL={url}\n')
        if not key_found:
            new_lines.append(f'SUPABASE_KEY={key}\n')

        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
    except Exception as e:
        logger.warning(f"Could not write .env file: {e}")

    # Update in environment variables
    os.environ['SUPABASE_URL'] = url
    os.environ['SUPABASE_KEY'] = key

    sync_result = None
    if auto_sync:
        try:
            _, sync_result = db_adapter.sync_local_to_supabase()
        except Exception as e:
            sync_result = f"Lỗi đồng bộ tự động: {e}"

    return jsonify({
        'success': True,
        'message': 'Đã kết nối Supabase Cloud Database thành công!',
        'db_info': db_adapter.get_db_info(),
        'sync_stats': sync_result
    })

@app.route('/api/admin/db-sync', methods=['POST'])
def trigger_db_sync():
    """Trigger manual data synchronization from local SQLite to Supabase Cloud"""
    ok, result = db_adapter.sync_local_to_supabase()
    if not ok:
        return jsonify({'success': False, 'error': result}), 400
    return jsonify({
        'success': True,
        'message': 'Đồng bộ dữ liệu lên Supabase Cloud thành công!',
        'stats': result
    })

# --- GEMINI AI CONFIG & STATUS ENDPOINTS ---
@app.route('/api/admin/ai-status', methods=['GET'])
def get_ai_status():
    """Returns current Gemini AI status and model info"""
    return jsonify(chat_advisor.get_ai_info())

@app.route('/api/admin/gemini-config', methods=['POST'])
def save_gemini_config():
    """Validate and configure Google Gemini AI API key"""
    data = request.get_json() or {}
    key = (data.get('gemini_api_key') or '').strip()

    if not key:
        return jsonify({'success': False, 'error': 'Vui lòng nhập Gemini API Key!'}), 400

    ok, msg = chat_advisor.test_gemini_key(key)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400

    chat_advisor.configure_gemini(key)

    # Write to .env file in project directory
    env_path = os.path.join(ROOT_DIR, '.env')
    try:
        lines = []
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

        key_found = False
        new_lines = []
        for line in lines:
            if line.startswith('GEMINI_API_KEY='):
                new_lines.append(f'GEMINI_API_KEY={key}\n')
                key_found = True
            else:
                new_lines.append(line)
        if not key_found:
            new_lines.append(f'GEMINI_API_KEY={key}\n')

        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
    except Exception as e:
        logger.warning(f"Could not write .env file: {e}")

    return jsonify({
        'success': True,
        'message': 'Đã kết nối Google Gemini AI thành công! Trợ lý ảo tư vấn đã sẵn sàng.',
        'ai_info': chat_advisor.get_ai_info()
    })

# --- API ENDPOINTS ---

@app.route('/api/categories', methods=['GET'])
def get_categories():
    categories = db_adapter.get_categories()
    return jsonify(categories)

@app.route('/api/products', methods=['GET'])
def get_products():
    category = request.args.get('category')
    search = request.args.get('search')
    bestseller = request.args.get('bestseller')
    promo = request.args.get('promo')
    sort = request.args.get('sort', 'default')

    products = db_adapter.get_products(
        category=category,
        search=search,
        bestseller=bestseller,
        promo=promo,
        sort=sort
    )
    return jsonify(products)

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = db_adapter.get_product_by_id(product_id)
    if product is None:
        return jsonify({'error': 'Không tìm thấy sản phẩm'}), 404
    return jsonify(product)

@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.get_json() or {}
    title = data.get('title')
    category = data.get('category')
    price = data.get('price')

    if not title or not category or price is None:
        return jsonify({'error': 'Vui lòng điền đủ tên, danh mục và giá sản phẩm'}), 400

    try:
        new_id = db_adapter.create_product(data)
        return jsonify({'success': True, 'id': new_id, 'message': 'Thêm sản phẩm thành công'}), 201
    except Exception as e:
        return jsonify({'error': f'Lỗi khi thêm sản phẩm: {str(e)}'}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    try:
        db_adapter.delete_product(product_id)
        return jsonify({'success': True, 'message': 'Đã xóa sản phẩm thành công'})
    except Exception as e:
        return jsonify({'error': f'Lỗi khi xóa sản phẩm: {str(e)}'}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT', 'PATCH'])
def update_product(product_id):
    data = request.get_json() or {}
    try:
        db_adapter.update_product(product_id, data)
        return jsonify({'success': True, 'message': 'Cập nhật sản phẩm thành công'})
    except Exception as e:
        return jsonify({'error': f'Lỗi khi cập nhật sản phẩm: {str(e)}'}), 500

@app.route('/api/products/sync-sold', methods=['POST'])
def sync_sold_endpoint():
    try:
        db_adapter.sync_sold_counts_from_orders()
        return jsonify({'success': True, 'message': 'Đã đồng bộ số lượng đã bán từ đơn hàng thành công'})
    except Exception as e:
        return jsonify({'error': f'Lỗi khi đồng bộ: {str(e)}'}), 500

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.get_json() or {}
    user_id = data.get('user_id')
    customer_name = data.get('name')
    customer_phone = data.get('phone')
    customer_email = data.get('email', '')
    customer_address = data.get('address')
    payment_method = data.get('payment_method', 'COD')
    note = data.get('note', '')
    items = data.get('items', [])
    total_amount = data.get('total_amount', 0)

    # Strictly require login before ordering
    if not user_id:
        return jsonify({'error': 'Quý khách vui lòng đăng nhập tài khoản trước khi đặt hàng'}), 401

    if not customer_name or not customer_phone or not customer_address or not items:
        return jsonify({'error': 'Vui lòng cung cấp đầy đủ thông tin giao hàng và giỏ hàng'}), 400

    # Generate unique order code e.g. MOC-94827
    code_suffix = ''.join(random.choices(string.digits, k=5))
    order_code = f"MOC-{code_suffix}"

    order_payload = {
        'user_id': user_id,
        'order_code': order_code,
        'customer_name': customer_name,
        'customer_phone': customer_phone,
        'customer_email': customer_email,
        'customer_address': customer_address,
        'payment_method': payment_method,
        'note': note,
        'items': items,
        'total_amount': total_amount
    }

    try:
        db_adapter.create_order(order_payload)
        return jsonify({
            'success': True,
            'order_code': order_code,
            'message': 'Đặt hàng thành công! Đội ngũ moccnha sẽ liên hệ xác nhận đơn hàng trong 15 phút.'
        }), 201
    except Exception as e:
        return jsonify({'error': f'Lỗi đặt hàng: {str(e)}'}), 500

@app.route('/api/user/<int:user_id>/orders', methods=['GET'])
def get_user_orders(user_id):
    orders = db_adapter.get_user_orders(user_id)
    return jsonify(orders)

@app.route('/api/orders', methods=['GET'])
def get_orders():
    orders = db_adapter.get_orders()
    return jsonify(orders)

@app.route('/api/orders/<string:order_code>/status', methods=['PATCH'])
def update_order_status(order_code):
    data = request.get_json() or {}
    new_status = data.get('status')
    if not new_status:
        return jsonify({'error': 'Thiếu trạng thái mới'}), 400

    try:
        db_adapter.update_order_status(order_code, new_status)
        return jsonify({'success': True, 'message': 'Cập nhật trạng thái thành công'})
    except Exception as e:
        return jsonify({'error': f'Lỗi cập nhật trạng thái: {str(e)}'}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    stats = db_adapter.get_stats()
    return jsonify(stats)

# --- B2B QUOTES ENDPOINTS ---
@app.route('/api/quotes', methods=['POST'])
def create_quote():
    data = request.get_json() or {}
    fullname = (data.get('fullname') or data.get('name') or '').strip()
    phone = (data.get('phone') or '').strip()

    if not fullname or not phone:
        return jsonify({'error': 'Vui lòng cung cấp họ tên và số điện thoại liên hệ'}), 400

    try:
        new_id = db_adapter.create_quote(data)
        return jsonify({
            'success': True,
            'id': new_id,
            'message': 'Gửi yêu cầu báo giá thành công! Đội ngũ chuyên viên dự án moccnha sẽ liên hệ lại trong vòng 30 phút.'
        }), 201
    except Exception as e:
        return jsonify({'error': f'Lỗi khi gửi yêu cầu báo giá: {str(e)}'}), 500

@app.route('/api/quotes', methods=['GET'])
def get_quotes():
    quotes = db_adapter.get_quotes()
    return jsonify(quotes or [])

@app.route('/api/quotes/<int:quote_id>/status', methods=['PATCH'])
def update_quote_status(quote_id):
    data = request.get_json() or {}
    new_status = data.get('status')
    if not new_status:
        return jsonify({'error': 'Thiếu trạng thái mới'}), 400

    try:
        db_adapter.update_quote_status(quote_id, new_status)
        return jsonify({'success': True, 'message': 'Cập nhật trạng thái báo giá thành công'})
    except Exception as e:
        return jsonify({'error': f'Lỗi cập nhật trạng thái: {str(e)}'}), 500

@app.route('/api/quotes/<int:quote_id>', methods=['DELETE'])
def delete_quote(quote_id):
    try:
        db_adapter.delete_quote(quote_id)
        return jsonify({'success': True, 'message': 'Đã xóa yêu cầu báo giá thành công'})
    except Exception as e:
        return jsonify({'error': f'Lỗi khi xóa yêu cầu: {str(e)}'}), 500

# --- AUTH ENDPOINTS ---
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    fullname = data.get('fullname')
    email = data.get('email')
    phone = data.get('phone', '')
    password = data.get('password')

    if not fullname or not email or not password:
        return jsonify({'error': 'Vui lòng điền đầy đủ họ tên, email và mật khẩu'}), 400

    result = db_adapter.register_user(fullname, email, phone, password)
    if 'error' in result:
        return jsonify(result), 400

    return jsonify({
        'success': True,
        'user': result['user'],
        'message': 'Đăng ký tài khoản thành công!'
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Vui lòng nhập email và mật khẩu'}), 400

    user = db_adapter.authenticate_user(email, password)
    if user:
        return jsonify({
            'success': True,
            'user': user,
            'message': f'Xin chào, {user["fullname"]}!'
        })
    else:
        return jsonify({'error': 'Email hoặc mật khẩu không chính xác'}), 401

# ==============================================================================
# CHAT CONSULTATION & ADVISOR ENDPOINTS
# ==============================================================================

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify({'error': 'Thiếu session_id'}), 400
    messages = db_adapter.get_chat_history(session_id)
    return jsonify({
        'session_id': session_id,
        'messages': messages
    })

@app.route('/api/chat/send', methods=['POST'])
def send_chat_message():
    data = request.get_json() or {}
    session_id = data.get('session_id')
    message = (data.get('message') or '').strip()
    customer_name = data.get('customer_name')
    customer_phone = data.get('customer_phone')
    customer_email = data.get('customer_email')
    user_id = data.get('user_id')

    if not session_id or not message:
        return jsonify({'error': 'Thiếu session_id hoặc nội dung tin nhắn'}), 400

    # 1. Save customer message to DB
    db_adapter.save_chat_message(
        session_id=session_id,
        sender='customer',
        message=message,
        user_id=user_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_email=customer_email
    )

    # 2. Generate automated advisor response
    try:
        reply = chat_advisor.generate_advisor_reply(message, session_id)
    except Exception as e:
        reply = "Dạ moccnha đã nhận được tin nhắn của Quý khách! Chuyên viên tư vấn sẽ liên hệ hỗ trợ bạn ngay trong ít phút ạ!"

    # 3. Save advisor response to DB
    db_adapter.save_chat_message(
        session_id=session_id,
        sender='advisor',
        message=reply,
        user_id=None,
        customer_name='Tư vấn viên moccnha'
    )

    # 4. Fetch updated history
    messages = db_adapter.get_chat_history(session_id)

    return jsonify({
        'success': True,
        'reply': reply,
        'messages': messages
    })

# --- ADMIN CHAT MANAGEMENT ---
@app.route('/api/admin/chat/sessions', methods=['GET'])
def admin_get_chat_sessions():
    sessions = db_adapter.get_chat_sessions()
    return jsonify(sessions)

@app.route('/api/admin/chat/sessions/<string:session_id>', methods=['GET'])
def admin_get_chat_history(session_id):
    db_adapter.mark_chat_read(session_id)
    messages = db_adapter.get_chat_history(session_id)
    return jsonify({
        'session_id': session_id,
        'messages': messages
    })

@app.route('/api/admin/chat/reply', methods=['POST'])
def admin_chat_reply():
    data = request.get_json() or {}
    session_id = data.get('session_id')
    message = (data.get('message') or '').strip()

    if not session_id or not message:
        return jsonify({'error': 'Thiếu session_id hoặc tin nhắn'}), 400

    db_adapter.save_chat_message(
        session_id=session_id,
        sender='advisor',
        message=message,
        customer_name='Quản trị viên'
    )
    db_adapter.mark_chat_read(session_id)

    messages = db_adapter.get_chat_history(session_id)
    return jsonify({
        'success': True,
        'message': 'Đã gửi phản hồi thành công',
        'messages': messages
    })

@app.route('/api/admin/chat/sessions/<string:session_id>', methods=['DELETE'])
def admin_delete_chat_session(session_id):
    db_adapter.delete_chat_session(session_id)
    return jsonify({'success': True, 'message': 'Đã xóa đoạn hội thoại'})

@app.route('/api/admin/reset-demo-data', methods=['POST'])
def reset_demo_data():
    try:
        from database import init_db, seed_data, get_db_connection
        init_db()
        conn = get_db_connection()
        seed_data(conn)
        conn.close()
        if db_adapter.is_supabase_enabled():
            db_adapter.sync_local_to_supabase()
        return jsonify({'success': True, 'message': 'Đã nạp lại dữ liệu mẫu thành công!', 'stats': db_adapter.get_stats()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.after_request
def add_no_cache_headers(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '1') == '1'
    app.run(host='0.0.0.0', port=port, debug=debug)
