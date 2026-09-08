# Burger-Page — Database (PostgreSQL Canonical)

Este directorio contiene la definición canónica y datos semilla para PostgreSQL (versión 14 en adelante), completamente desacoplada de dependencias o herramientas propietarias.

---

## 📁 Archivos

* **[`01_schema.sql`](file:///C:/Users/ASUS/Desktop/Burger-Page/database/01_schema.sql)**: Esquema canónico DDL completo:
  - Extensiones (`pgcrypto`).
  - Rol de aplicación `app_user` (con aislamiento RLS estricto).
  - 14 tablas relacionales idénticas a Supabase (incluyendo `receipt_url` en `orders`).
  - Índices compuestos y de rendimiento.
  - Funciones PL/pgSQL y procedimientos atómicos (`create_order_atomic`, `update_order_status_with_actor`, `adjust_inventory_stock`).
  - Triggers automáticos (`updated_at`, contadores atómicos, auditoría de estado y métricas de clientes).
  - Políticas Row Level Security (RLS) optimizadas para InitPlan (`SELECT current_setting(...)`).
  - Grants para el rol `app_user`.
* **[`02_seed.sql`](file:///C:/Users/ASUS/Desktop/Burger-Page/database/02_seed.sql)**: Datos semilla **exclusivos para testing y desarrollo local**:
  - NO ejecutar en migraciones de producción (en producción se corre únicamente `01_schema.sql`).
  - Utilizado por Docker Compose / CI para poblar restaurantes, usuarios y menú de prueba.

---

## 🚀 Cómo usar

### 1. Migración a PostgreSQL de Producción (Instancia Limpia)
Para migrar a una base de datos nueva en producción, **solo se ejecuta el esquema**:

```bash
psql -U postgres -d burger_page -f database/01_schema.sql
```

### 2. Entorno Local / Testing con Docker
Para levantar un entorno de pruebas con datos precargados:

```bash
psql -U postgres -d burger_page -f database/01_schema.sql
psql -U postgres -d burger_page -f database/02_seed.sql
```

### 2. Contraseña del rol `app_user`
El script `01_schema.sql` crea el rol `app_user` con password predeterminada `'app_user_test_only'` para entornos de desarrollo y pruebas. En entornos productivos, cambiar la contraseña:

```sql
ALTER ROLE app_user WITH PASSWORD 'tu_password_seguro_aqui';
```

### 3. Configuración en `backend/.env`
```env
STORAGE_DRIVER=postgres
DATABASE_URL=postgres://app_user:tu_password_seguro_aqui@localhost:5432/burger_page
```

---

## 🛡️ Arquitectura Multi-Tenant (RLS)

* **Rol de conexión (`app_user`)**: Sin privilegio `BYPASSRLS`. Acceso restringido por el contexto del tenant.
* **Aislamiento por transacción**: Cada query o transacción establece `SET LOCAL app.restaurant_id = $1`.
* **Políticas InitPlan**: Las políticas RLS usan `(SELECT current_setting('app.restaurant_id', true))` para garantizar que Postgres evalúe el tenant una sola vez por consulta.
