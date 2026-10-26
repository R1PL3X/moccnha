import unittest
import json
from app import app
from database import init_db

class MohoStoreTestCase(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client = app.test_client()

    def test_home_page(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        content = response.data.decode('utf-8')
        self.assertIn('moccnha', content)
        self.assertIn('VLINE', content)
        self.assertIn('Bán chạy', content)
        self.assertIn('Ưu Đãi Tháng Phái Đẹp', content)
        self.assertIn('theme-toggle-btn', content)

    def test_api_products(self):
        response = self.client.get('/api/products')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        
        # Test item matching screenshot 2
        bed_product = next((p for p in data if 'VLINE' in p['title']), None)
        self.assertIsNotNone(bed_product)
        self.assertEqual(bed_product['price'], 8990000)

    def test_api_categories(self):
        response = self.client.get('/api/categories')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(any(c['name'] == 'Phòng Khách' for c in data))
        self.assertTrue(any(c['name'] == 'Phòng Ngủ' for c in data))

    def test_order_creation_flow(self):
        order_payload = {
            'user_id': 1,
            'name': 'Nguyễn Văn Test',
            'phone': '0901234567',
            'email': 'test@gmail.com',
            'address': '123 Đường Số 1, Quận 1, TP.HCM',
            'payment_method': 'COD',
            'note': 'Giao trong giờ hành chính',
            'items': [
                {
                    'id': 1,
                    'title': 'Combo Giường - Tủ Đầu Giường VLINE 1m6 | Màu Tự Nhiên',
                    'price': 8990000,
                    'color': 'Màu Tự Nhiên',
                    'quantity': 1
                }
            ],
            'total_amount': 8990000
        }
        res = self.client.post('/api/orders', data=json.dumps(order_payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        res_data = json.loads(res.data)
        self.assertTrue(res_data['success'])
        order_code = res_data['order_code']
        self.assertTrue(order_code.startswith('MOC-') or order_code.startswith('MOHO-'))

        # Check status update
        patch_res = self.client.patch(
            f'/api/orders/{order_code}/status',
            data=json.dumps({'status': 'confirmed'}),
            content_type='application/json'
        )
        self.assertEqual(patch_res.status_code, 200)

        # Check user order history retrieval
        user_orders_res = self.client.get('/api/user/1/orders')
        self.assertEqual(user_orders_res.status_code, 200)
        user_orders = json.loads(user_orders_res.data)
        self.assertTrue(any(o['order_code'] == order_code for o in user_orders))

        # Check that order without user_id is rejected (401)
        unauth_payload = dict(order_payload)
        del unauth_payload['user_id']
        unauth_res = self.client.post('/api/orders', data=json.dumps(unauth_payload), content_type='application/json')
        self.assertEqual(unauth_res.status_code, 401)

    def test_auth_login(self):
        res = self.client.post(
            '/api/auth/login',
            data=json.dumps({'email': 'admin@moho.vn', 'password': 'admin123'}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['user']['role'], 'admin')

    def test_admin_pages(self):
        for route in ['/admin', '/admin/revenue', '/admin/orders', '/admin/products', '/admin/quotes']:
            res = self.client.get(route)
            self.assertEqual(res.status_code, 200, f"Route {route} failed")
            content = res.data.decode('utf-8')
            self.assertIn('Admin Portal', content)
    def test_db_status(self):
        res = self.client.get('/api/db-status')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertIn('mode', data)
        self.assertIn('status', data)

    def test_stats(self):
        res = self.client.get('/api/stats')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertIn('total_products', data)
        self.assertIn('total_orders', data)
    def test_pages(self):
        for route in ['/about', '/stores', '/news', '/b2b', '/policy']:
            res = self.client.get(route)
            self.assertEqual(res.status_code, 200, f"Route {route} failed")
            content = res.data.decode('utf-8')
            self.assertIn('moccnha', content)

    def test_quotes_flow(self):
        # 1. Test creating quote
        quote_payload = {
            'fullname': 'Trần Thị B',
            'phone': '0909888999',
            'email': 'b2b@company.vn',
            'project_type': 'Khách sạn / Homestay / Resort',
            'note': 'Cần báo giá 15 bộ combo HOBRO 1m6'
        }
        create_res = self.client.post(
            '/api/quotes',
            data=json.dumps(quote_payload),
            content_type='application/json'
        )
        self.assertEqual(create_res.status_code, 201)
        create_data = json.loads(create_res.data)
        self.assertTrue(create_data['success'])
        quote_id = create_data['id']

        # 2. Test get quotes list
        get_res = self.client.get('/api/quotes')
        self.assertEqual(get_res.status_code, 200)
        quotes = json.loads(get_res.data)
        self.assertTrue(any(q['id'] == quote_id for q in quotes))

        # 3. Test update status
        patch_res = self.client.patch(
            f'/api/quotes/{quote_id}/status',
            data=json.dumps({'status': 'contacted'}),
            content_type='application/json'
        )
        self.assertEqual(patch_res.status_code, 200)

        # 4. Test missing required fields
        invalid_res = self.client.post(
            '/api/quotes',
            data=json.dumps({'fullname': ''}),
            content_type='application/json'
        )
        self.assertEqual(invalid_res.status_code, 400)

        # 5. Test delete quote
        del_res = self.client.delete(f'/api/quotes/{quote_id}')
        self.assertEqual(del_res.status_code, 200)

if __name__ == '__main__':
    unittest.main()

