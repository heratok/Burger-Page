-- ============================================================================
-- BURGER-PAGE — Seed Determinista de Demo y Desarrollo Local
-- File: database/02_seed.sql
-- Description: Datos de demostración deterministas (identificadores y
--              timestamps fijos) para desarrollo local y CI.
--              NO hay fixtures de tests aquí: los datos de QA/E2E viven en los
--              tests, no en el seed canónico. Los datos de negocio (precios,
--              nombres, branding) están en español porque son contenido del
--              producto; los identificadores siguen la convención en inglés.
--
-- USO: psql -U postgres -d burger_page -f database/02_seed.sql
--      (después de 01_schema.sql; docker-compose lo aplica solo).
-- ============================================================================

-- ============================================================================
-- RESTAURANTES (identidad demo: rosto + Burger Craft)
-- ============================================================================
INSERT INTO public.restaurants (id, slug, name, tagline, whatsapp_number, address, is_active, created_at, updated_at) VALUES ('rest-1788579266608', 'rosto', 'rosto', 'La mejor comida artesanal', '573001234567', NULL, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.restaurants (id, slug, name, tagline, whatsapp_number, address, is_active, created_at, updated_at) VALUES ('rest-burger-craft', 'burger-craft', 'Burger Craft', 'Hamburguesas artesanales', '573001234567', NULL, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;

-- ============================================================================
-- RESTAURANT SETTINGS (configuración operativa 1:1)
-- ============================================================================
INSERT INTO public.restaurant_settings (restaurant_id, currency, currency_symbol, delivery_fee, min_order_amount, estimated_delivery_time, opening_hours_text, open_time, close_time, announcement_text, show_announcement, created_at, updated_at) VALUES ('rest-1788579266608', 'COP', '$', '5000.00', '20000.00', '30 - 45 min', '12:00 - 22:30', '12:00', '22:30', NULL, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT (restaurant_id) DO NOTHING;
INSERT INTO public.restaurant_settings (restaurant_id, currency, currency_symbol, delivery_fee, min_order_amount, estimated_delivery_time, opening_hours_text, open_time, close_time, announcement_text, show_announcement, created_at, updated_at) VALUES ('rest-burger-craft', 'COP', '$', '5000.00', '0.00', '30 - 45 min', '12:00 - 22:30', '12:00', '22:30', NULL, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT (restaurant_id) DO NOTHING;

-- ============================================================================
-- RESTAURANT BRANDING (identidad visual 1:1)
-- ============================================================================
INSERT INTO public.restaurant_branding (restaurant_id, logo_url, banner_url, show_banner, primary_color, primary_hover_color, bg_theme, font_family, card_radius, card_style, compact_grid, show_badges, created_at, updated_at) VALUES ('rest-1788579266608', NULL, NULL, TRUE, '#FF7A21', '#F25C69', 'warm-cream', 'sans', 'md', 'elevated', FALSE, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT (restaurant_id) DO NOTHING;
INSERT INTO public.restaurant_branding (restaurant_id, logo_url, banner_url, show_banner, primary_color, primary_hover_color, bg_theme, font_family, card_radius, card_style, compact_grid, show_badges, created_at, updated_at) VALUES ('rest-burger-craft', NULL, NULL, TRUE, '#FF7A21', '#F25C69', 'dark-charcoal', 'sans', 'md', 'elevated', FALSE, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT (restaurant_id) DO NOTHING;

-- ============================================================================
-- USUARIOS (credenciales demo conocidas; hashes fijos)
-- ============================================================================
INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at, updated_at) VALUES ('usr_4637d76c-e093-4ab1-b022-d5f4cb4970ba', 'admin', 'ba8011969765ba31fd3d30f34ea4c18c:6fc1efefb3ef117ff2f476cbf1c1f69a59725658f840697e75f083491d6338ef78d3227e9aa388d70936c8e19e198f80cac8b2ea5af0c9157eaedc112c4867f8', 'super_admin', NULL, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at, updated_at) VALUES ('7f15ae42-8df8-40f3-b5aa-0053e4476433', 'rosto', 'b898788e093f0d7a8864d54627233402:38a6cb377ef303032f8e986b8833ae7b747d43daec6b7a2371fede87fe597cc5e2d0dc737b17f2665b7c3d86d9d409297bb200df3a0203c0ae79e8c4060482a7', 'restaurant_admin', 'rest-1788579266608', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at, updated_at) VALUES ('usr_60aafb53-e264-420d-9bd9-8a87750d69af', 'admin_craft', 'b99042f25a06b9fa56b25476c3ec0d68:76db449b4e3c5f0b11d418e8c11f7ec4fba656df65292676bc971e7f386ab618efacc286be5db6b0afcfd811e80c39c92d01b078554d808f72378c1085cc3d6d', 'restaurant_admin', 'rest-burger-craft', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
-- Fixture demo legítimo (admin de rosto, password 'rosto'); lo usan suites
-- E2E como credencial base de tenant (multi-tenant-security, inventory-contrast).
INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at, updated_at) VALUES ('usr_rosto_e2e_admin', 'admin_rosto', 'b6c8f5afab0521e74f9065efc9e29e98:e9fa1046ab6f489a015e7b1ed1ba5d4e5c623629aa036850077c2cd48f9b89af38b64b2fde4d274be7fe106adfb2d6d99c725c906fb9979d5eb9add146c98fda', 'restaurant_admin', 'rest-1788579266608', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;

-- ============================================================================
-- CATEGORIAS (menú demo de rosto)
-- ============================================================================
INSERT INTO public.categories (id, restaurant_id, name, display_order, is_active, created_at, updated_at) VALUES ('cat_rosto_general', 'rest-1788579266608', 'General', 0, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.categories (id, restaurant_id, name, display_order, is_active, created_at, updated_at) VALUES ('cat_rosto_hamburguesas', 'rest-1788579266608', 'Hamburguesas', 1, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.categories (id, restaurant_id, name, display_order, is_active, created_at, updated_at) VALUES ('cat_rosto_bebidas', 'rest-1788579266608', 'Bebidas', 2, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.categories (id, restaurant_id, name, display_order, is_active, created_at, updated_at) VALUES ('cat_craft_general', 'rest-burger-craft', 'General', 0, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;

-- ============================================================================
-- PRODUCTOS (demo determinista sin la columna category_name)
-- ============================================================================
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_rosto_clasica', 'rest-1788579266608', 'cat_rosto_hamburguesas', 'Hamburguesa Clásica', 'Carne 100% res, lechuga, tomate, queso y salsa especial', '12000.00', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80', TRUE, TRUE, FALSE, 15, 0, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_rosto_doble', 'rest-1788579266608', 'cat_rosto_hamburguesas', 'Doble Carne', 'Dos medallones de carne, queso cheddar y cebolla caramelizada', '18000.00', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80', TRUE, TRUE, FALSE, 18, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_rosto_bbq', 'rest-1788579266608', 'cat_rosto_hamburguesas', 'BBQ Bacon', 'Carne, tocineta crocante, cebolla crispy y salsa BBQ ahumada', '17000.00', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80', TRUE, FALSE, TRUE, 18, 2, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_rosto_yuca', 'rest-1788579266608', 'cat_rosto_general', 'Yuca Frita', 'Porción de yuca frita crocante con salsa de la casa', '5100.00', NULL, TRUE, FALSE, FALSE, 10, 0, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_rosto_gaseosa', 'rest-1788579266608', 'cat_rosto_bebidas', 'Gaseosa 400ml', 'Bebida gaseosa fría 400ml', '3000.00', NULL, TRUE, FALSE, FALSE, 2, 0, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_craft_trufa', 'rest-burger-craft', 'cat_craft_general', 'Trufa Monster Burger', 'Carne angus seleccionada, queso brie y salsa trufada especial', '35000.00', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80', TRUE, TRUE, TRUE, 20, 0, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;

-- ============================================================================
-- ADICIONES DE PRODUCTO (globales del restaurante demo)
-- ============================================================================
INSERT INTO public.product_additions (id, restaurant_id, product_id, name, price, is_available, created_at, updated_at) VALUES ('add_rosto_queso', 'rest-1788579266608', NULL, 'Queso Extra', '2000.00', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.product_additions (id, restaurant_id, product_id, name, price, is_available, created_at, updated_at) VALUES ('add_rosto_bacon', 'rest-1788579266608', NULL, 'Bacon Extra', '3000.00', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.product_additions (id, restaurant_id, product_id, name, price, is_available, created_at, updated_at) VALUES ('add_rosto_papas', 'rest-1788579266608', NULL, 'Papas a la Francesa', '3500.00', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.product_additions (id, restaurant_id, product_id, name, price, is_available, created_at, updated_at) VALUES ('add_craft_trufa_extra', 'rest-burger-craft', NULL, 'Salsa Trufada Extra', '4000.00', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;

-- ============================================================================
-- CONTADORES DE PEDIDOS (identificadores de demo; 0 = el primer pedido será #1)
-- ============================================================================
INSERT INTO public.restaurant_order_counters (restaurant_id, last_number) VALUES ('rest-1788579266608', 0) ON CONFLICT (restaurant_id) DO UPDATE SET last_number = EXCLUDED.last_number;
INSERT INTO public.restaurant_order_counters (restaurant_id, last_number) VALUES ('rest-burger-craft', 0) ON CONFLICT (restaurant_id) DO UPDATE SET last_number = EXCLUDED.last_number;