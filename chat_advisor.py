"""
AI Interior Advisor & Customer Consultation Engine for moccnha
Provides automated, intelligent, polite, and helpful answers about
products, combo pricing, materials, shipping, warranty, showroom addresses,
and real-time order tracking.
"""

import re
import random
import db_adapter

def format_vnd(amount):
    try:
        return f"{int(amount):,}₫".replace(",", ".")
    except Exception:
        return f"{amount}₫"

def generate_advisor_reply(message, session_id=None):
    text = (message or '').strip()
    lower = text.lower()

    if not lower:
        return "Dạ moccnha xin chào Quý khách! Bạn cần tư vấn mẫu nội thất nào hay hỗ trợ thông tin gì ạ?"

    # 1. Order tracking detection (MOC-12345 or MOHO-12345)
    order_code_match = re.search(r'\b(MOC|MOHO)-?\d{4,6}\b', text, re.IGNORECASE)
    if order_code_match:
        raw_code = order_code_match.group(0).upper()
        norm_code = raw_code if '-' in raw_code else f"{raw_code[:3]}-{raw_code[3:]}"
        
        # Look up order in database
        try:
            orders = db_adapter.get_orders()
            matched_order = next((o for o in orders if norm_code in o.get('order_code', '').upper()), None)
            if matched_order:
                status_map = {
                    'pending': '⏳ Đang chờ xác nhận',
                    'confirmed': '✅ Đã xác nhận - Đang đóng gói xuất kho',
                    'shipping': '🚚 Đang trên đường vận chuyển tới bạn',
                    'completed': '🎉 Đã hoàn thành (Giao thành công)',
                    'cancelled': '❌ Đã hủy đơn'
                }
                status_text = status_map.get(matched_order.get('status'), matched_order.get('status'))
                cust_name = matched_order.get('customer_name') or 'Quý khách'
                total = format_vnd(matched_order.get('total_amount', 0))
                address = matched_order.get('customer_address') or 'Theo thông tin đơn'
                payment = 'Tiền mặt khi nhận (COD)' if matched_order.get('payment_method') == 'COD' else 'Chuyển khoản'

                return (
                    f"Dạ moccnha đã tìm thấy đơn hàng **#{matched_order.get('order_code')}**:\n\n"
                    f"• Khách hàng: **{cust_name}**\n"
                    f"• Trạng thái: **{status_text}**\n"
                    f"• Tổng thanh toán: **{total}** ({payment})\n"
                    f"• Nơi nhận: {address}\n\n"
                    "Bộ phận giao hàng & lắp đặt moccnha sẽ chủ động liên hệ trước 30-45 phút khi hàng đến nơi. Nếu cần hỗ trợ đổi giờ giao, Quý khách nhắn em nhé!"
                )
            else:
                return (
                    f"Dạ moccnha chưa tìm thấy đơn hàng mã **#{norm_code}** trên hệ thống. "
                    "Quý khách vui lòng kiểm tra lại chính xác 5 chữ số mã đơn hoặc nhắn Số điện thoại đặt hàng để em tra cứu nhanh nhất ạ!"
                )
        except Exception:
            pass

    # 2. General order inquiry without code
    if any(k in lower for k in ['tra cứu đơn', 'kiểm tra đơn', 'tình trạng đơn', 'mã đơn', 'đơn hàng của tôi', 'đơn đã đặt']):
        return (
            "Dạ để kiểm tra tiến độ đơn hàng, Quý khách vui lòng gửi giúp em **Mã đơn hàng** (dạng `MOC-xxxxx`) "
            "hoặc **Số điện thoại** lúc đặt hàng, em sẽ kiểm tra trạng thái và báo ngay ạ!"
        )

    # 3. Bedroom Combos (HOBRO, VLINE)
    if any(k in lower for k in ['hobro', 'combo hobro', 'giường hobro']):
        return (
            "Dạ **Combo Giường Ngủ 1m6 & Tủ Đầu Giường MOHO HOBRO** hiện đang là dòng sản phẩm cao cấp bán chạy nhất:\n\n"
            "• **Điểm nhấn độc quyền**: Mặt gỗ tràm ghép vân veneer xương cá đan chéo hiệu ứng thị giác 3D tinh xảo.\n"
            "• **Kết cấu chịu lực**: Khung gỗ tự nhiên vững chãi chuẩn quốc tế, vạt phản gỗ nguyên tấm chịu lực lên đến 350kg.\n"
            "• **Giá ưu đãi**: **8.990.000₫** (Giá gốc niêm yết: 13.180.000₫, tiết kiệm 32%).\n\n"
            "Sản phẩm có sẵn tone Màu Nâu Hạnh Nhân và Màu Gỗ Sồi. Quý khách muốn đặt combo này giao trong tuần này không ạ?"
        )

    if any(k in lower for k in ['vline', 'combo vline', 'giường vline']):
        return (
            "Dạ **Bộ sưu tập VLINE** mang đậm phong cách truyền thống giao thoa đương đại:\n\n"
            "• **Combo Giường & Táp VLINE 1m6**: 100% gỗ tràm tự nhiên đạt chuẩn CARB-P2 an toàn tuyệt đối, giá ưu đãi **8.990.000₫** (giảm 26%).\n"
            "• **Tủ Kệ Tivi VLINE**: Cánh đan mây mắt cáo tự nhiên tinh tế, giá chỉ **3.490.000₫**.\n"
            "• **Bàn Ăn 4 Ghế VLINE**: Gỗ cao su nguyên khối chống trầy xước, giá chỉ **6.990.000₫**.\n\n"
            "Quý khách đang quan tâm mẫu giường ngủ, bàn ăn hay tủ kệ VLINE ạ?"
        )

    # 4. Sofas & Living Room
    if any(k in lower for k in ['sofa', 'ghế sofa', 'phòng khách', 'sofa góc', 'sofa băng', 'sofa giường']):
        return (
            "Dạ moccnha có đầy đủ các dòng Sofa phù hợp cho căn hộ và nhà phố:\n\n"
            "• **Sofa Băng VLINE**: Đệm mút D40 chống xẹp lún, bọc vải bố dệt cao cấp, giá **5.990.000₫**.\n"
            "• **Sofa Giường Đa Năng Thông Minh**: Dễ dàng ngả thành giường ngủ êm ái cho khách tới nhà, giá **4.290.000₫**.\n"
            "• **Sofa Góc L Lớn MOHO VERONA**: Vải công nghệ chống thấm nước Nano Water-Repellent, giá **12.754.000₫**.\n\n"
            "Quý khách muốn tìm sofa kích thước khoảng bao nhiêu mét cho phòng khách nhà mình ạ?"
        )

    # 5. Dining Tables & Chairs
    if any(k in lower for k in ['bàn ăn', 'ghế ăn', 'bàn 4 ghế', 'bàn 6 ghế', 'phòng ăn']):
        return (
            "Dạ moccnha có mẫu **Bộ Bàn Ăn Gỗ Tự Nhiên Kèm 4 Ghế VLINE** rất được yêu thích:\n\n"
            "• Mặt bàn gỗ cao su tự nhiên nguyên khối phủ sơn UV chống trầy và kháng ố nước hoàn hảo.\n"
            "• Lưng ghế uốn cong ôm trọn cột sống, đệm ngồi bọc da simili cao cấp êm ái, dễ lau sạch sau mỗi bữa ăn.\n"
            "• Giá trọn bộ (1 bàn + 4 ghế): **6.990.000₫** (giá gốc 9.990.000₫).\n\n"
            "Nhà mình dùng cho gia đình mấy người ngồi ăn thường xuyên ạ?"
        )

    # 6. Desks & Workspaces
    if any(k in lower for k in ['bàn làm việc', 'bàn học', 'bàn máy tính', 'work']):
        return (
            "Dạ mẫu **Bàn Làm Việc Tối Giản MOHO WORK 01** giá chỉ **2.290.000₫** (giảm 23%):\n\n"
            "• Mặt bàn rộng 1m2 phủ Melamine vân sồi chống trầy, chân sắt sơn tĩnh điện dập cứng cáp.\n"
            "• Tích hợp sẵn khe luồn dây sạc cáp máy tính và móc treo tai nghe/balo rất thông minh.\n"
            "• Có 2 tone: Gỗ Tự Nhiên Chân Đen và Gỗ Trắng Tinh Tế. Quý khách thích màu nào hơn ạ?"
        )

    # 7. Wardrobes & Cabinets
    if any(k in lower for k in ['tủ quần áo', 'tủ áo', 'tủ giày', 'tủ kệ', 'tủ gỗ ikea']):
        return (
            "Dạ các mẫu tủ quần áo & tủ kệ tại moccnha đều được thiết kế chia khoang thông minh:\n\n"
            "• **Tủ Quần Áo 3 Cánh MOHO VIENNA**: Có khoang treo đầm dài, ngăn gấp đồ và hộc kéo có khóa cá nhân, giá **7.990.000₫** (giảm 24%).\n"
            "• **Tủ Gỗ IKEA / Tủ Đa Năng**: Giá hạt dẻ từ **500.000₫ - 5.760.000₫**.\n"
            "• Phụ kiện ray trượt và bản lề giảm chấn đóng êm ái, không gây tiếng ồn.\n\n"
            "Phòng ngủ của bạn có chiều ngang tầm bao nhiêu mét để em tư vấn kích thước vừa vặn nhất ạ?"
        )

    # 8. Shipping & Assembly
    if any(k in lower for k in ['giao hàng', 'vận chuyển', 'lắp đặt', 'phí ship', 'ship', 'bao lâu', 'lắp ráp']):
        return (
            "Dạ chính sách giao nhận & lắp đặt của moccnha:\n\n"
            "🚚 **Miễn phí 100% Giao hàng & Lắp đặt tận phòng** tại nội thành TP.HCM và Hà Nội đối với mọi đơn hàng từ 2.000.000₫!\n"
            "📦 Đơn dưới 2 triệu phí vận chuyển đồng giá chỉ **50.000₫**.\n"
            "⏰ Thời gian giao: 1 - 2 ngày làm việc. Nhân viên kỹ thuật moccnha sẽ mang hàng tận phòng, lắp ráp hoàn chỉnh và dọn dẹp sạch sẽ trước khi bàn giao ạ!"
        )

    # 9. Warranty & Lifetime Maintenance
    if any(k in lower for k in ['bảo hành', 'bảo trì', 'đổi trả', 'bị hỏng', 'mối mọt', 'cong vênh']):
        return (
            "Dạ Quý khách hoàn toàn an tâm khi mua sắm tại moccnha:\n\n"
            "🛡️ **Bảo hành chính hãng 24 tháng (2 năm)** cho tất cả lỗi kết cấu, kỹ thuật và mối mọt gỗ.\n"
            "🔧 **Hỗ trợ bảo trì trọn đời** sản phẩm (sửa chữa, thay thế phụ kiện bản lề/ray trượt với chi phí gốc).\n"
            "🔄 **Đổi mới 1-1 trong 7 ngày** nếu có lỗi từ nhà sản xuất.\n\n"
            "Mỗi đơn hàng đều có mã phiếu bảo hành điện tử theo số điện thoại đặt hàng của Quý khách ạ!"
        )

    # 10. Showrooms & Visiting
    if any(k in lower for k in ['địa chỉ', 'showroom', 'cửa hàng', 'ở đâu', 'xem mẫu', 'trải nghiệm', 'qua xem']):
        return (
            "Dạ kính mời Quý khách ghé trải nghiệm trực tiếp tại hệ thống Showroom moccnha:\n\n"
            "📍 **Showroom 1**: 162 Lê Văn Lương, Phường Tân Hưng, Quận 7, TP.HCM\n"
            "📍 **Showroom 2**: S05.01-S2.05 Vinhome Grand Park, TP. Thủ Đức, TP.HCM\n"
            "⏰ **Giờ mở cửa**: 08:30 - 21:00 (Mở cửa tất cả các ngày trong tuần, có bãi đỗ xe ô tô miễn phí).\n"
            "📞 Hotline hỗ trợ: **097 114 1140**.\n\n"
            "Bạn có dự định ghé showroom nào để em báo bạn chuyên viên chuẩn bị tiếp đón chu đáo ạ?"
        )

    # 11. Materials & Safety (CARB-P2)
    if any(k in lower for k in ['chất liệu', 'gỗ gì', 'loại gỗ', 'an toàn', 'carb', 'sơn']):
        return (
            "Dạ nội thất moccnha cam kết tiêu chuẩn xuất khẩu an toàn sức khỏe hàng đầu:\n\n"
            "🌿 **Nguồn gốc gỗ**: 100% gỗ rừng trồng tự nhiên (gỗ tràm, gỗ cao su, veneer sồi) đạt chứng nhận FSC bảo vệ môi trường.\n"
            "🔬 **Chuẩn CARB-P2 & EPA**: Hàm lượng Formaldehyde gần như bằng 0, tuyệt đối an toàn cho trẻ sơ sinh, trẻ nhỏ và phụ nữ mang thai.\n"
            "💧 **Sơn gốc nước cao cấp**: Không mùi cay hắc, chống trầy xước và kháng ẩm mốc bền bỉ theo thời gian ạ!"
        )

    # 12. B2B / Wholesale / Contract
    if any(k in lower for k in ['b2b', 'dự án', 'sỉ', 'số lượng lớn', 'chiết khấu', 'khách sạn', 'homestay', 'báo giá']):
        return (
            "Dạ moccnha có chính sách cung ứng nội thất dự án B2B cực kỳ ưu đãi:\n\n"
            "🏢 Chiết khấu lên đến **35%** cho các dự án căn hộ cho thuê, homestay, khách sạn, resort và văn phòng.\n"
            "📐 Hỗ trợ dựng phối cảnh 3D và bóc tách khối lượng miễn phí.\n\n"
            "Quý khách vui lòng để lại **Số điện thoại** hoặc gửi yêu cầu tại mục Dự Án B2B trên thanh menu, quản lý dự án moccnha sẽ gửi bảng chào giá chi tiết trong vòng 2 giờ ạ!"
        )

    # 13. Promotions & Discounts
    if any(k in lower for k in ['khuyến mãi', 'ưu đãi', 'giảm giá', 'sale', 'mã giảm', 'voucher']):
        return (
            "Dạ hiện moccnha đang có chương trình khuyến mãi tháng này:\n\n"
            "🎁 Giảm trực tiếp từ **20% - 35%** cho tất cả bộ sưu tập nội thất chủ lực.\n"
            "🚚 Miễn phí vận chuyển & lắp ráp nội thành TP.HCM & Hà Nội (đơn từ 2tr).\n"
            "💵 Hỗ trợ thanh toán linh hoạt: Tiền mặt khi nhận hàng (COD) hoặc Chuyển khoản ngân hàng.\n\n"
            "Bạn muốn tìm sản phẩm nào để em áp dụng mức giá sale tốt nhất cho mình ạ?"
        )

    # 14. Dynamic Product Search by Name (if matching any products in database)
    try:
        all_prods = db_adapter.get_products()
        for p in all_prods:
            title_lower = p.get('title', '').lower()
            # If at least two words match or exact substring
            p_words = [w for w in title_lower.split() if len(w) > 3]
            match_count = sum(1 for w in p_words if w in lower)
            if match_count >= 2 or (len(p_words) == 1 and p_words[0] in lower):
                price = format_vnd(p.get('price', 0))
                orig_price = format_vnd(p.get('original_price', 0))
                disc = p.get('discount_percent', 0)
                mat = p.get('material', 'Gỗ tự nhiên cao cấp')
                dim = p.get('dimensions', 'Tiêu chuẩn')
                return (
                    f"Dạ về sản phẩm **{p.get('title')}**:\n\n"
                    f"• **Giá bán ưu đãi**: **{price}** (Giá gốc: {orig_price}, giảm {disc}%)\n"
                    f"• **Chất liệu**: {mat}\n"
                    f"• **Kích thước**: {dim}\n"
                    f"• **Bảo hành**: 2 năm & Bảo trì trọn đời\n\n"
                    "Quý khách có muốn em hỗ trợ đặt hàng giữ giá khuyến mãi cho mình luôn không ạ?"
                )
    except Exception:
        pass

    # 15. Friendly General Greeting
    if any(k in lower for k in ['chào', 'hello', 'hi', 'alo', 'shop ơi', 'ad ơi', 'tư vấn', 'có ai không']):
        return (
            "Dạ moccnha xin chào Quý khách! Rất vui được đón tiếp bạn ghé thăm cửa hàng trực tuyến moccnha.\n\n"
            "Em có thể hỗ trợ tư vấn cho bạn về:\n"
            "• Combo giường tủ phòng ngủ (VLINE, HOBRO...)\n"
            "• Bàn ghế ăn, Sofa phòng khách, Bàn làm việc\n"
            "• Chính sách giao hàng, lắp đặt miễn phí & bảo hành\n"
            "• Tra cứu tình trạng đơn hàng đã đặt\n\n"
            "Bạn đang tìm nội thất cho không gian nào ạ?"
        )

    # 16. Fallback with helpful suggestions
    return (
        "Dạ cảm ơn Quý khách đã nhắn tin cho moccnha! Để nhận tư vấn chi tiết nhất hoặc xem hình ảnh thực tế sản phẩm, "
        "Quý khách có thể để lại **Số điện thoại** hoặc câu hỏi cụ thể, chuyên viên tư vấn moccnha sẽ hỗ trợ bạn ngay trong ít phút ạ!\n\n"
        "💡 *Gợi ý nhanh: Bạn có thể gõ 'HOBRO', 'VLINE', 'Sofa', 'Giao hàng', 'Bảo hành' hoặc nhập mã đơn 'MOC-xxxxx' để em kiểm tra ngay nhé!*"
    )
