# Burger-Page — Database Schema (PostgreSQL Canonical)

Este directorio contiene el esquema de base de datos relacional puro para PostgreSQL (versiones 14 en adelante), completamente desacoplado de dependencias o herramientas propietarias.

---

## 📁 Archivos

* **[`schema.sql`](file:///C:/Users/hecto/Desktop/Desktop/poryectos_personales/Burger-Page/database/schema.sql)**: Definición canónica completa (DDL, triggers de actualización y métricas, funciones atómicas PL/pgSQL, índices de rendimiento y políticas RLS optimizadas).

---

## 🚀 Cómo usar en Supabase

1. Entrá al panel de tu proyecto en [Supabase](https://supabase.com).
2. Andá a la sección **SQL Editor**.
3. Creá una nueva consulta, pegá todo el contenido de [`schema.sql`](file:///C:/Users/hecto/Desktop/Desktop/poryectos_personales/Burger-Page/database/schema.sql) y ejecutalo (**Run**).
4. Asigná una contraseña segura al rol de aplicación `app_user`:
   ```sql
   ALTER ROLE app_user WITH PASSWORD 'tu_password_seguro_aqui';
   ```
5. En el archivo `backend/.env`, configurá la conexión nativa de Postgres:
   ```env
   STORAGE_DRIVER=postgres
   DATABASE_URL=postgres://app_user:tu_password_seguro_aqui@db.TU_PROYECTO.supabase.co:5432/postgres
   ```
   *(o usando el Session Pooler en el puerto 5432 si estás en entornos serverless).*

---

## 💻 Cómo usar en PostgreSQL Local / Docker

Para ejecutarlo en una instancia local estándar:

```bash
psql -U postgres -d burger_page -f database/schema.sql
```

Y luego asignale password al rol:
```sql
ALTER ROLE app_user WITH PASSWORD 'tu_password_local';
```

---

## 🛡️ Arquitectura de Seguridad (Multi-Tenant RLS)

* **Rol de conexión (`app_user`)**: Sin atributo `BYPASSRLS`. Solo accede a los datos filtrados por su contexto.
* **Aislamiento por transacción**: El backend ejecuta `SET LOCAL app.restaurant_id = $1` al inicio de cada transacción.
* **Políticas InitPlan**: Las políticas RLS envuelven las llamadas en `(SELECT current_setting(...))` para que el motor de Postgres evalúe el tenant una sola vez por consulta (InitPlan) en lugar de hacerlo por cada fila.
