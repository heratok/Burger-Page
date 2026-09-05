# Spec: Super Admin Navigation & Quick Actions

## Requirements

### Requirement 1: Dual-Mode Navigation Items
- When logged in as Super Admin (`session.role === "super"`):
  - In global directory (`adminTab === "restaurants"`), the sidebar MUST display the "Directorio Global SaaS" navigation item and sidebar quick action buttons for "+ Nuevo Restaurante" and "+ Nuevo Usuario".
  - In tenant mode (`adminTab !== "restaurants"`), the sidebar MUST display all operational restaurant modules (`dashboard`, `orders`, `menu`, `inventory`, `customers`, `reports`, `customizer`).

### Requirement 2: Contextual Impersonation Banner & Return Action
- When logged in as Super Admin and administering a tenant (`adminTab !== "restaurants"`):
  - A contextual banner or prominent return button MUST be visible with label "← Volver al Panel Super Admin" or "Volver a SaaS".
  - Clicking this button MUST navigate to `/admin/restaurants`.

### Requirement 3: Multi-Tenant Switcher Integration
- The `AdminSwitcher` MUST be rendered for Super Admins in both global and tenant administration modes.
- Selecting "Directorio Global de Restaurantes" in the switcher MUST navigate to `/admin/restaurants`.
- Selecting a specific restaurant MUST switch the active restaurant and navigate to `/admin/dashboard`.

### Requirement 4: Role Isolation
- Users with role `restaurant` MUST NOT see the Super Admin return button, global directory items, or quick user creation buttons for super admins.
