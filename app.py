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
from database import init_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, 'public', 'static') if os.path.exists(os.path.join(BASE_DIR, 'public', 'static')) else os.path.join(BASE_DIR, 'static')

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=static_dir,
    static_url_path='/static'
)
app.secret_key = os.environ.get('SECRET_KEY', 'moho-vietnam-default-secret-key-2026')

# Ensure local fallback database schema is initialized safely
try:
    init_db()
except Exception:
    pass

# --- FRONTEND PAGES ---
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/admin')
def admin_page():
    return render_template('admin.html')

# --- DATABASE STATUS ENDPOINT ---
@app.route('/api/db-status', methods=['GET'])
def get_db_status():
    """Returns whether the system is connected to Supabase Cloud or Local SQLite"""
    return jsonify(db_adapter.get_db_info())

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

    # Generate unique order code e.g. MOHO-94827
    code_suffix = ''.join(random.choices(string.digits, k=5))
    order_code = f"MOHO-{code_suffix}"

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
            'message': 'Đặt hàng thành công! Đội ngũ MOHO sẽ liên hệ xác nhận đơn hàng trong 15 phút.'
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '1') == '1'
    app.run(host='0.0.0.0', port=port, debug=debug)
