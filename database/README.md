# Burger-Page — Database (PostgreSQL Canonical)

Este directorio contiene la definición canónica y datos demo para PostgreSQL
(versión 14 en adelante), desacoplada de dependencias o herramientas propietarias.

---

## 📁 Archivos

* **[`01_schema.sql`](file:///C:/Users/ASUS/Desktop/Burger-Page/database/01_schema.sql)**: Esquema canónico DDL (baseline):
  - Rol de aplicación `app_user` (aislamiento RLS estricto, sin BYPASSRLS).
  - 14 tablas relacionales (`restaurants`, `orders`, `products`, ...).
  - Índices compuestos y de rendimiento.
  - Funciones PL/pgSQL atómicas (`create_order_atomic`, `update_order_status_with_actor`, `adjust_inventory_stock`).
  - Triggers automáticos (`updated_at`, contadores atómicos, auditoría de estado, métricas de clientes).
  - Políticas Row Level Security (RLS) con InitPlan (`current_setting(...)`) y FORCE RLS.
  - `COMMENT ON TABLE/COLUMN` en español para discovery.
* **[`02_seed.sql`](file:///C:/Users/ASUS/Desktop/Burger-Page/database/02_seed.sql)**: Datos **demo deterministas locales**
  (2 restaurantes, usuarios, menú demo para CI/Docker). **EXCLUSIVO para desarrollo local y tests**: nunca debe exigirse en entornos remotos o Supabase.
* **[`migrations/`](file:///C:/Users/ASUS/Desktop/Burger-Page/database/migrations)**: Migraciones versionadas con `node-pg-migrate`.

---

## 🗣️ Convención de idioma

* **Identificadores (tablas, columnas, funciones, índices, políticas): inglés**
  — estándar de la industria, compatible con Supabase, ORMs y cualquier herramienta.
* **Comentarios y `COMMENT ON`: español** — los lee el equipo.
* **Datos de negocio (nombres de productos, valores de menú): español** — son contenido del producto.
* **Valores que cruzan el contrato HTTP** (estados de pedido, `payment_method`, tokens de tema): fijos.

---

## 🚀 Cómo usar

### 1. Producción (instancia limpia)
Solo el esquema (baseline), y luego migraciones:

```bash
psql -U postgres -d burger_page -f database/01_schema.sql
npm run db:migrate
```

> ⚠️ **Contraseña de `app_user`**: `01_schema.sql` crea el rol con
> `'app_user_test_only'` SOLO para desarrollo/CI. En producción, cambiarla:
> ```sql
> ALTER ROLE app_user WITH PASSWORD 'tu_password_segura_aqui';
> ```

### 2. Desarrollo local / Testing (Docker)
```bash
docker compose up -d --wait postgres-test   # initdb aplica 01 + 02 automáticamente
```

### 3. Migraciones incrementales
```bash
npm run db:migrate:create -- nombre          # crear una migración SQL
npm run db:migrate                           # aplicar pendientes (DATABASE_URL)
npm run db:migrate:down                      # revertir la última
```
Detalles: [`database/migrations/README.md`](file:///C:/Users/ASUS/Desktop/Burger-Page/database/migrations/README.md).

### 4. Configuración en `backend/.env`
```env
STORAGE_DRIVER=postgres
DATABASE_URL=postgres://app_user:tu_password_segura_aqui@localhost:5432/burger_page
```

---

## 🛡️ Arquitectura Multi-Tenant (RLS)

* **Rol de conexión (`app_user`)**: sin `BYPASSRLS`. Acceso restringido por contexto de tenant.
* **Aislamiento por transacción**: cada query/transacción establece `SET LOCAL app.restaurant_id = $1`
  (y `app.actor_role` para escalas de privilegio) vía `PgClient.withTenantContext`.
* **Políticas InitPlan**: las políticas RLS usan `(SELECT current_setting('app.restaurant_id', true))`
  para evaluar el tenant una sola vez por consulta.
* **`users`**: FORCE RLS + lecturas de autenticación solo por las funciones
  SECURITY DEFINER `look_up_user_for_auth*` (search_path endurecido, sin PUBLIC).