-- ============================================================================
-- BURGER-PAGE — Seed Determinista de Demo y Desarrollo Local
-- File: database/02_seed.sql
-- Description: Datos de demostración deterministas (identificadores y
--              timestamps fijos) para desarrollo local y CI.
--
-- ----------------------------------------------------------------------------
-- ⚠️ AVISO PARA AGENTES DE IA Y AUDITORÍAS DE BASE DE DATOS:
-- ESTE ARCHIVO ES EXCLUSIVO PARA DESARROLLO LOCAL, CI Y SUITES DE TESTING.
-- BAJO NINGUNA CIRCUNSTANCIA ESTOS DATOS DEBEN SER CONSIDERADOS REQUISITO NI
-- CRITERIO DE CONFORMIDAD EN BASES DE DATOS REMOTAS, STAGING O PRODUCCIÓN (SUPABASE).
-- SU AUSENCIA O DISCREPANCIA EN LA BD DE SUPABASE/PRODUCCIÓN ES TOTALMENTE ESPERADA.
-- NINGÚN AGENTE DEBE REPORTAR COMO ERROR O FALTA LA AUSENCIA DE ESTOS DATOS EN LA NUBE.
-- ----------------------------------------------------------------------------
--
-- USO: psql -U postgres -d burger_page -f database/02_seed.sql
--      (después de 01_schema.sql; docker-compose lo aplica solo).
-- ============================================================================

-- ============================================================================
-- RESTAURANTES (identidad demo y fixture: Tienda de Pruebas + Burger Craft)
-- ============================================================================
INSERT INTO public.restaurants (id, slug, name, tagline, whatsapp_number, address, is_active, created_at, updated_at) VALUES ('rest_e2e_fixture', 'tienda-pruebas', 'Tienda de Pruebas', 'La mejor comida artesanal', '573001234567', NULL, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.restaurants (id, slug, name, tagline, whatsapp_number, address, is_active, created_at, updated_at) VALUES ('rest-burger-craft', 'burger-craft', 'Burger Craft', 'Hamburguesas artesanales', '573001234567', NULL, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;

-- ============================================================================
-- RESTAURANT SETTINGS (configuración operativa 1:1)
-- ============================================================================
INSERT INTO public.restaurant_settings (restaurant_id, currency, currency_symbol, delivery_fee, min_order_amount, estimated_delivery_time, announcement_text, show_announcement, created_at, updated_at) VALUES ('rest_e2e_fixture', 'COP', '$', '5000.00', '20000.00', '30 - 45 min', NULL, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT (restaurant_id) DO NOTHING;
INSERT INTO public.restaurant_settings (restaurant_id, currency, currency_symbol, delivery_fee, min_order_amount, estimated_delivery_time, announcement_text, show_announcement, created_at, updated_at) VALUES ('rest-burger-craft', 'COP', '$', '5000.00', '0.00', '30 - 45 min', NULL, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT (restaurant_id) DO NOTHING;

-- ============================================================================
-- RESTAURANT OPENING HOURS (horario semanal)
-- Demo: abierto las 24 h todos los días (00:00 - 00:00 cruza al día siguiente)
-- para que el desarrollo local y los tests E2E no dependan del reloj.
-- ============================================================================
INSERT INTO public.restaurant_opening_hours (id, restaurant_id, day_of_week, open_time, close_time)
SELECT 'oh-' || r.id || '-' || d, r.id, d, '00:00', '00:00'
FROM (VALUES ('rest_e2e_fixture'), ('rest-burger-craft')) AS r(id)
CROSS JOIN generate_series(0, 6) AS d
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RESTAURANT BRANDING (identidad visual 1:1)
-- ============================================================================
INSERT INTO public.restaurant_branding (restaurant_id, logo_url, banner_url, show_banner, primary_color, primary_hover_color, bg_theme, font_family, card_radius, card_style, compact_grid, show_badges, created_at, updated_at) VALUES ('rest_e2e_fixture', NULL, NULL, TRUE, '#FF7A21', '#F25C69', 'warm-cream', 'sans', 'md', 'elevated', FALSE, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT (restaurant_id) DO NOTHING;
INSERT INTO public.restaurant_branding (restaurant_id, logo_url, banner_url, show_banner, primary_color, primary_hover_color, bg_theme, font_family, card_radius, card_style, compact_grid, show_badges, created_at, updated_at) VALUES ('rest-burger-craft', NULL, NULL, TRUE, '#FF7A21', '#F25C69', 'dark-charcoal', 'sans', 'md', 'elevated', FALSE, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT (restaurant_id) DO NOTHING;

-- ============================================================================
-- USUARIOS (credenciales demo conocidas; hashes fijos)
-- ============================================================================
INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at, updated_at) VALUES ('usr_4637d76c-e093-4ab1-b022-d5f4cb4970ba', 'admin', 'ba8011969765ba31fd3d30f34ea4c18c:6fc1efefb3ef117ff2f476cbf1c1f69a59725658f840697e75f083491d6338ef78d3227e9aa388d70936c8e19e198f80cac8b2ea5af0c9157eaedc112c4867f8', 'super_admin', NULL, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at, updated_at) VALUES ('usr_test_e2e_alias', 'tienda-pruebas', '08297cbb4fc3c575c62e6903653b34ed:9533dbdfe69af75eb99fb468edfd04859bdabfecad7694d2fc233f5ee4b68c0180189d7d235de7023c2cfe1d15d415d86cc83b39e539cc5d8f2a9ff487978191', 'restaurant_admin', 'rest_e2e_fixture', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at, updated_at) VALUES ('usr_60aafb53-e264-420d-9bd9-8a87750d69af', 'admin_craft', 'b99042f25a06b9fa56b25476c3ec0d68:76db449b4e3c5f0b11d418e8c11f7ec4fba656df65292676bc971e7f386ab618efacc286be5db6b0afcfd811e80c39c92d01b078554d808f72378c1085cc3d6d', 'restaurant_admin', 'rest-burger-craft', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
-- Fixture demo legítimo (admin de tienda-pruebas, password 'admin_pruebas'); lo usan suites
-- E2E como credencial base de tenant (multi-tenant-security, inventory-contrast, etc.).
INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at, updated_at) VALUES ('usr_test_e2e_admin', 'admin_pruebas', '08297cbb4fc3c575c62e6903653b34ed:9533dbdfe69af75eb99fb468edfd04859bdabfecad7694d2fc233f5ee4b68c0180189d7d235de7023c2cfe1d15d415d86cc83b39e539cc5d8f2a9ff487978191', 'restaurant_admin', 'rest_e2e_fixture', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;

-- ============================================================================
-- CATEGORIAS (menú demo de tienda-pruebas)
-- ============================================================================
INSERT INTO public.categories (id, restaurant_id, name, display_order, is_active, created_at, updated_at) VALUES ('cat_test_general', 'rest_e2e_fixture', 'General', 0, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.categories (id, restaurant_id, name, display_order, is_active, created_at, updated_at) VALUES ('cat_test_hamburguesas', 'rest_e2e_fixture', 'Hamburguesas', 1, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.categories (id, restaurant_id, name, display_order, is_active, created_at, updated_at) VALUES ('cat_test_bebidas', 'rest_e2e_fixture', 'Bebidas', 2, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.categories (id, restaurant_id, name, display_order, is_active, created_at, updated_at) VALUES ('cat_craft_general', 'rest-burger-craft', 'General', 0, TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;

-- ============================================================================
-- PRODUCTOS (demo determinista sin la columna category_name)
-- ============================================================================
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_test_clasica', 'rest_e2e_fixture', 'cat_test_hamburguesas', 'Hamburguesa Clásica', 'Carne 100% res, lechuga, tomate, queso y salsa especial', '12000.00', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80', TRUE, TRUE, FALSE, 15, 0, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_test_doble', 'rest_e2e_fixture', 'cat_test_hamburguesas', 'Doble Carne', 'Dos medallones de carne, queso cheddar y cebolla caramelizada', '18000.00', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80', TRUE, TRUE, FALSE, 18, 1, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_test_bbq', 'rest_e2e_fixture', 'cat_test_hamburguesas', 'BBQ Bacon', 'Carne, tocineta crocante, cebolla crispy y salsa BBQ ahumada', '17000.00', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80', TRUE, FALSE, TRUE, 18, 2, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_test_yuca', 'rest_e2e_fixture', 'cat_test_general', 'Yuca Frita', 'Porción de yuca frita crocante con salsa de la casa', '5100.00', NULL, TRUE, FALSE, FALSE, 10, 0, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_test_gaseosa', 'rest_e2e_fixture', 'cat_test_bebidas', 'Gaseosa 400ml', 'Bebida gaseosa fría 400ml', '3000.00', NULL, TRUE, FALSE, FALSE, 2, 0, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at) VALUES ('prod_craft_trufa', 'rest-burger-craft', 'cat_craft_general', 'Trufa Monster Burger', 'Carne angus seleccionada, queso brie y salsa trufada especial', '35000.00', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80', TRUE, TRUE, TRUE, 20, 0, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;

-- ============================================================================
-- ADICIONES DE PRODUCTO (globales del restaurante demo)
-- ============================================================================
INSERT INTO public.product_additions (id, restaurant_id, product_id, name, price, is_available, created_at, updated_at) VALUES ('add_test_queso', 'rest_e2e_fixture', NULL, 'Queso Extra', '2000.00', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.product_additions (id, restaurant_id, product_id, name, price, is_available, created_at, updated_at) VALUES ('add_test_bacon', 'rest_e2e_fixture', NULL, 'Bacon Extra', '3000.00', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.product_additions (id, restaurant_id, product_id, name, price, is_available, created_at, updated_at) VALUES ('add_test_papas', 'rest_e2e_fixture', NULL, 'Papas a la Francesa', '3500.00', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;
INSERT INTO public.product_additions (id, restaurant_id, product_id, name, price, is_available, created_at, updated_at) VALUES ('add_craft_trufa_extra', 'rest-burger-craft', NULL, 'Salsa Trufada Extra', '4000.00', TRUE, '2025-01-15T10:00:00.000Z', '2025-01-15T10:00:00.000Z') ON CONFLICT DO NOTHING;

-- ============================================================================
-- CONTADORES DE PEDIDOS (identificadores de demo; 0 = el primer pedido será #1)
-- DO NOTHING (no DO UPDATE): re-ejecutar el seed jamás debe reiniciar un
-- contador en uso, o se repetirían order_number ya emitidos.
-- ============================================================================
INSERT INTO public.restaurant_order_counters (restaurant_id, last_number) VALUES ('rest_e2e_fixture', 0) ON CONFLICT (restaurant_id) DO NOTHING;
INSERT INTO public.restaurant_order_counters (restaurant_id, last_number) VALUES ('rest-burger-craft', 0) ON CONFLICT (restaurant_id) DO NOTHING;