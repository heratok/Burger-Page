# Design: Super Admin Multi-Tenant Navigation & Quick Actions

## Context & Problem Definition

In our multi-tenant restaurant platform, administrators fall into two categories:
1. **Super Administrator** (`session.role === "super"`): Platform owner managing multiple restaurant tenants, SaaS-level stats, tenant provisioning, and global users.
2. **Restaurant Administrator** (`session.role === "restaurant"`): Store manager managing catalog, orders, inventory, customers, and branding for their specific restaurant.

When a Super Admin wants to configure or manage a specific tenant, they click "Administrar" in `RestaurantsDirectory`. Previously, this navigated to `/admin/dashboard`, but `AdminLayout` broke UX:
- The sidebar hid all restaurant modules because `isSuper === true` forced `navItems` to contain only "Directorio Global SaaS".
- The `AdminSwitcher` was hidden.
- There was no breadcrumb or button to return to the Super Admin directory.
- There were no quick buttons to create new restaurants or users from anywhere in the platform.

## Architecture & Solution

### 1. State & Mode Resolution
In `AdminLayout`:
```typescript
const isSuper = session.role === "super"
const isSuperGlobalMode = isSuper && adminTab === "restaurants"
const isSuperTenantMode = isSuper && adminTab !== "restaurants"
```

### 2. Dynamic Navigation Items
- When `isSuperGlobalMode`:
  `navItems = [{ id: "restaurants", label: "Directorio Global SaaS", icon: Building2, description: "Gestión de inquilinos y métricas globales", badge: "SaaS" }]`
  Plus sidebar quick actions:
  - Button "+ Nuevo Restaurante" -> opens `CreateRestaurantModal`
  - Button "+ Nuevo Usuario" -> opens `CreateUserModal`
- When `isSuperTenantMode` or `!isSuper`:
  `navItems = [dashboard, orders, menu, inventory, customers, reports, customizer]`

### 3. Contextual Impersonation Banner & Return Trigger
When `isSuperTenantMode`:
1. **Header Bar Banner**: Displays an amber badge:
   `👑 Super Admin: Administrando [activeRestaurant.config.name]`
2. **Action Button in Header & Sidebar**:
   `← Volver al Panel Super Admin` with `onClick={() => navigateTo("/admin/restaurants")}`
3. **Sidebar Header Branding**:
   Shows the active restaurant brand while maintaining the `AdminSwitcher` so the Super Admin can switch to another restaurant or jump straight to the directory.

### 4. AdminSwitcher Enhancements
Ensure `AdminSwitcher` is visible and accessible for Super Admin in both global mode and tenant mode. Selecting "🌐 Directorio Global de Restaurantes" in the select dropdown immediately executes `navigateTo("/admin/restaurants")`.

### 5. UI/UX Consistency & Accessibility
- High contrast colors in both Light (`admin-light`) and Dark (`admin-dark`) themes.
- Tooltips, accessible `aria-label`s, and Lucide icons.
- Zero layout shift when toggling between global and tenant modes.
