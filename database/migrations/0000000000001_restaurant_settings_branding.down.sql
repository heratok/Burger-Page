-- ============================================================================
-- 0001_restaurant_settings_branding.down.sql (DOWN)
-- Reversa del split: devuelve las columnas a restaurants y rellena desde
-- restaurant_settings / restaurant_branding antes de eliminar las tablas.
-- ============================================================================

ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS banner_url TEXT,
    ADD COLUMN IF NOT EXISTS show_banner BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS announcement_text TEXT,
    ADD COLUMN IF NOT EXISTS show_announcement BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS currency_symbol TEXT NOT NULL DEFAULT '$',
    ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (min_order_amount >= 0),
    ADD COLUMN IF NOT EXISTS estimated_delivery_time TEXT DEFAULT '30 - 45 min',
    ADD COLUMN IF NOT EXISTS opening_hours_text TEXT DEFAULT '12:00 - 22:30',
    ADD COLUMN IF NOT EXISTS open_time TIME DEFAULT '12:00',
    ADD COLUMN IF NOT EXISTS close_time TIME DEFAULT '22:30',
    ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#E63946',
    ADD COLUMN IF NOT EXISTS primary_hover_color TEXT NOT NULL DEFAULT '#F25C69',
    ADD COLUMN IF NOT EXISTS bg_theme TEXT NOT NULL DEFAULT 'dark-charcoal' CHECK (bg_theme IN ('dark-charcoal', 'deep-midnight', 'warm-cream', 'clean-white')),
    ADD COLUMN IF NOT EXISTS font_family TEXT NOT NULL DEFAULT 'sans' CHECK (font_family IN ('sans', 'serif', 'mono', 'display')),
    ADD COLUMN IF NOT EXISTS card_radius TEXT NOT NULL DEFAULT 'md' CHECK (card_radius IN ('sm', 'md', 'lg', 'full')),
    ADD COLUMN IF NOT EXISTS card_style TEXT NOT NULL DEFAULT 'elevated' CHECK (card_style IN ('elevated', 'bordered', 'glass', 'minimal')),
    ADD COLUMN IF NOT EXISTS compact_grid BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS show_badges BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.restaurants r SET
    logo_url = b.logo_url,
    banner_url = b.banner_url,
    show_banner = b.show_banner,
    announcement_text = s.announcement_text,
    show_announcement = s.show_announcement,
    currency = s.currency,
    currency_symbol = s.currency_symbol,
    delivery_fee = s.delivery_fee,
    min_order_amount = s.min_order_amount,
    estimated_delivery_time = s.estimated_delivery_time,
    opening_hours_text = s.opening_hours_text,
    open_time = s.open_time,
    close_time = s.close_time,
    primary_color = b.primary_color,
    primary_hover_color = b.primary_hover_color,
    bg_theme = b.bg_theme,
    font_family = b.font_family,
    card_radius = b.card_radius,
    card_style = b.card_style,
    compact_grid = b.compact_grid,
    show_badges = b.show_badges
FROM public.restaurant_settings s
LEFT JOIN public.restaurant_branding b ON b.restaurant_id = s.restaurant_id
WHERE r.id = s.restaurant_id;

DROP TABLE IF EXISTS public.restaurant_branding;
DROP TABLE IF EXISTS public.restaurant_settings;
