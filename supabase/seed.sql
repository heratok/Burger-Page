-- ============================================================================
-- SUPABASE SEED DATA: Demo Restaurant 'rosto'
-- File: seed.sql
-- Description: Initial test and development data for the 'rosto' tenant.
--              Executed automatically in local dev or on demand in test DBs.
-- ============================================================================

-- 1. RESTAURANT: 'rosto'
INSERT INTO public.restaurants (id, slug, name, tagline, opening_hours, categories, is_active, config)
VALUES (
    'rosto',
    'rosto',
    'Rosto',
    'Sabor artesanal en cada bocado',
    '{"open":"12:00","close":"22:30"}'::jsonb,
    '["Hamburguesas", "Acompañamientos", "Bebidas"]'::jsonb,
    TRUE,
    '{
        "name": "Rosto",
        "tagline": "Sabor artesanal en cada bocado",
        "logoUrl": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=150&auto=format&fit=crop&q=80",
        "bannerUrl": "https://images.unsplash.com/photo-1586816001966-79b736744398?w=1200&auto=format&fit=crop&q=80",
        "showBanner": true,
        "announcementText": "🍔 ¡Bienvenidos a Rosto! Hamburguesas artesanales de autor y papas rústicas",
        "showAnnouncement": true,
        "whatsappNumber": "573001234567",
        "currency": "COP",
        "currencySymbol": "$",
        "deliveryFee": 5000,
        "minOrderAmount": 20000,
        "estimatedDeliveryTime": "30 - 45 min",
        "openingHours": "12:00 - 22:30",
        "address": "Calle 72 # 11-85, Zona Gastronómica",
        "primaryColor": "#E63946",
        "primaryHoverColor": "#F25C69",
        "bgTheme": "dark-charcoal",
        "fontFamily": "sans",
        "cardRadius": "md",
        "cardStyle": "elevated",
        "compactGrid": false,
        "showBadges": true
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    opening_hours = EXCLUDED.opening_hours,
    categories = EXCLUDED.categories,
    is_active = EXCLUDED.is_active,
    config = EXCLUDED.config;

-- 2. PRODUCTS: 'rosto'
INSERT INTO public.products (id, restaurant_id, name, description, price, category, is_available, additions)
VALUES
    (
        'prod-rosto-1',
        'rosto',
        'Rosto Clásica',
        'Carne artesanal 180g, queso cheddar fundido, tocineta ahumada, lechuga fresca, tomate y salsa especial Rosto en pan brioche artesanal',
        26000.00,
        'Hamburguesas',
        TRUE,
        '[{"id": "add-1", "name": "Extra Queso Cheddar", "price": 3000, "available": true}, {"id": "add-2", "name": "Tocineta Ahumada Extra", "price": 4000, "available": true}]'::jsonb
    ),
    (
        'prod-rosto-2',
        'rosto',
        'Rosto Doble Carne',
        'Doble porción de carne artesanal 180g (360g total), doble queso americano, tocineta caramelizada, cebolla crispy y salsa de la casa',
        34000.00,
        'Hamburguesas',
        TRUE,
        '[{"id": "add-3", "name": "Huevo Frito con Yema Blanda", "price": 2500, "available": true}, {"id": "add-4", "name": "Cebolla Caramelizada", "price": 2000, "available": true}]'::jsonb
    ),
    (
        'prod-rosto-3',
        'rosto',
        'Rosto Crispy Chicken',
        'Pechuga de pollo empanizada ultra crocante, ensalada coleslaw fresca, pepinillos dulces y mayonesa de ajo asado',
        24000.00,
        'Hamburguesas',
        TRUE,
        '[{"id": "add-5", "name": "Tocineta Crispy", "price": 4000, "available": true}, {"id": "add-6", "name": "Salsa BBQ Ahumada", "price": 2000, "available": true}]'::jsonb
    ),
    (
        'prod-rosto-4',
        'rosto',
        'Papas Rústicas Rosto',
        'Papas cortadas en gajos rústicos sazonadas con sal marina, romero y paprika con salsa cheddar para acompañar',
        9000.00,
        'Acompañamientos',
        TRUE,
        '[{"id": "add-7", "name": "Salsa Cheddar Extra", "price": 2500, "available": true}, {"id": "add-8", "name": "Tocineta Picada", "price": 3000, "available": true}]'::jsonb
    ),
    (
        'prod-rosto-5',
        'rosto',
        'Aros de Cebolla Crocantes',
        '8 aros de cebolla rebozados y dorados a la perfección acompañados de salsa tártara artesanal',
        8500.00,
        'Acompañamientos',
        TRUE,
        '[]'::jsonb
    ),
    (
        'prod-rosto-6',
        'rosto',
        'Gaseosa Coca-Cola 400ml',
        'Gaseosa refrescante Coca-Cola Original bien fría',
        5000.00,
        'Bebidas',
        TRUE,
        '[]'::jsonb
    ),
    (
        'prod-rosto-7',
        'rosto',
        'Cerveza Club Colombia Dorada 330ml',
        'Cerveza premium tipo lager fría para maridar con tu hamburguesa',
        7000.00,
        'Bebidas',
        TRUE,
        '[]'::jsonb
    )
ON CONFLICT (id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    category = EXCLUDED.category,
    is_available = EXCLUDED.is_available,
    additions = EXCLUDED.additions;

-- 3. CUSTOMERS: 'rosto'
INSERT INTO public.customers (id, restaurant_id, name, email, phone, address, barrio, total_orders, total_spent, loyalty_tier, last_order_date)
VALUES (
    'cust-rosto-1',
    'rosto',
    'Santiago Restrepo',
    'santiago.restrepo@example.com',
    '3109876543',
    'Carrera 15 # 88-21, Apto 302',
    'Chicó',
    3,
    84000.00,
    'silver',
    '2026-08-28 14:30:00+00'
)
ON CONFLICT (id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    barrio = EXCLUDED.barrio,
    total_orders = EXCLUDED.total_orders,
    total_spent = EXCLUDED.total_spent,
    loyalty_tier = EXCLUDED.loyalty_tier,
    last_order_date = EXCLUDED.last_order_date;

-- 4. ORDERS: 'rosto'
INSERT INTO public.orders (id, restaurant_id, order_number, customer_id, status, total, delivery_fee, final_total, items, payment_method, payment_amount, change_amount, comment, created_at, updated_at)
VALUES (
    'ord-rosto-101',
    'rosto',
    1001,
    'cust-rosto-1',
    'pending',
    35000.00,
    5000.00,
    40000.00,
    '[
        {
            "name": "Rosto Clásica",
            "price": 26000,
            "cantidad": 1,
            "total": 29000,
            "adiciones": [{"name": "Extra Queso Cheddar", "price": 3000, "cantidad": 1}]
        },
        {
            "name": "Papas Rústicas Rosto",
            "price": 9000,
            "cantidad": 1,
            "total": 9000
        }
    ]'::jsonb,
    'Efectivo',
    50000.00,
    10000.00,
    'Por favor enviar salsa extra de ajo y timbre 302',
    '2026-08-28 16:00:00+00',
    '2026-08-28 16:00:00+00'
)
ON CONFLICT (id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    order_number = EXCLUDED.order_number,
    customer_id = EXCLUDED.customer_id,
    status = EXCLUDED.status,
    total = EXCLUDED.total,
    delivery_fee = EXCLUDED.delivery_fee,
    final_total = EXCLUDED.final_total,
    items = EXCLUDED.items,
    payment_method = EXCLUDED.payment_method,
    payment_amount = EXCLUDED.payment_amount,
    change_amount = EXCLUDED.change_amount,
    comment = EXCLUDED.comment,
    updated_at = EXCLUDED.updated_at;

-- 5. INVENTORY: 'rosto'
INSERT INTO public.inventory (id, restaurant_id, name, category, current_stock, min_stock_alert, unit, cost_per_unit, updated_at)
VALUES
    ('inv-rosto-1', 'rosto', 'Carne Molida Artesanal 180g (Patties)', 'Ingredientes', 50.00, 15.00, 'unidades', 6500.00, NOW()),
    ('inv-rosto-2', 'rosto', 'Pan Brioche Rosto con Sésamo', 'Ingredientes', 45.00, 12.00, 'unidades', 2200.00, NOW()),
    ('inv-rosto-3', 'rosto', 'Queso Cheddar en Fetas', 'Ingredientes', 80.00, 20.00, 'unidades', 1100.00, NOW()),
    ('inv-rosto-4', 'rosto', 'Tocineta Ahumada de Cerdo', 'Ingredientes', 5.00, 2.00, 'kg', 28000.00, NOW()),
    ('inv-rosto-5', 'rosto', 'Papas Rústicas Pre-cortadas', 'Ingredientes', 20.00, 8.00, 'kg', 7500.00, NOW()),
    ('inv-rosto-6', 'rosto', 'Empaques Térmicos Rosto Kraft', 'Empaques', 120.00, 30.00, 'unidades', 600.00, NOW())
ON CONFLICT (id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    current_stock = EXCLUDED.current_stock,
    min_stock_alert = EXCLUDED.min_stock_alert,
    unit = EXCLUDED.unit,
    cost_per_unit = EXCLUDED.cost_per_unit,
    updated_at = EXCLUDED.updated_at;
