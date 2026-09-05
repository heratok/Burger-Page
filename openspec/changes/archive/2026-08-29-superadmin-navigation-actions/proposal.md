# Proposal: Super Admin Multi-Tenant Navigation & Quick Actions

## Intent

When a Super Admin (`session.role === "super"`) clicks "Administrar" on a specific restaurant from the Global Directory (`/admin/restaurants`), they are routed to the restaurant's operational dashboard (`/admin/dashboard`). However, the existing UI creates a confusing dead end:
1. The sidebar only exposes the single item "Directorio Global SaaS" and omits the operational modules of the managed restaurant (Orders, Menu, Inventory, Customers, Reports, Customizer).
2. The `AdminSwitcher` is hidden when `isSuper` is true, preventing fast switching.
3. There is no visible banner or intuitive "← Volver al Panel Super Admin" button to exit tenant management back to SaaS overview.
4. The Super Admin lacks quick action buttons in the sidebar for creating restaurants and users.

This proposal introduces a Contextual Mode-Aware Super Admin experience with a prominent impersonation banner, full operational access when administering a tenant, seamless return to the SaaS Directory, and quick-action creation modals in the sidebar.

## Scope

### In Scope
- **Super Admin Dual Mode Navigation**:
  - **Global SaaS Mode** (`adminTab === "restaurants"`): Displays SaaS Directory navigation, tenant overview, and quick-action sidebar buttons ("+ Nuevo Restaurante", "+ Nuevo Usuario").
  - **Tenant Management Mode** (`adminTab !== "restaurants"` while `isSuper === true`): Displays full operational modules for the managed restaurant (Dashboard, Orders, Menu, Inventory, CRM, Reports, Customizer).
- **Impersonation Header & Return Action**: Prominent contextual badge indicating active tenant management and a 1-click button ("← Volver al Panel Super Admin" / "Volver al Directorio SaaS") to return to `/admin/restaurants`.
- **Enhanced Tenant Switcher (`AdminSwitcher`)**: Accessible to Super Admin across all modes, enabling instant switching between tenants or immediate return to the Global Directory.
- **Sidebar Quick Action Modals**: Direct triggers from sidebar to open `CreateRestaurantModal` and `CreateUserModal`.
- **TDD Test Suite**: Comprehensive unit and integration test coverage for Super Admin navigation, tenant mode transitions, and role isolation.

### Out of Scope
- Backend database permission schema changes (existing client-side & API authorization contracts remain intact).
- Modifying public storefront customer-facing routes.

## Capabilities

### New Capabilities
- `superadmin-navigation`: Context-aware navigation for Super Admin supporting global SaaS management, seamless tenant administration with return controls, and sidebar quick creation actions.

## Approach

1. **Context-Aware Navigation Matrix in `AdminLayout.tsx`**:
   - Compute navigation mode based on `session.role` and `adminTab`.
   - Render operational modules when administering a tenant, while providing full Super Admin switching capabilities.
2. **Context Banner & Return Trigger**:
   - Render a high-visibility badge and return button in both the header bar and top of the main container when a Super Admin is managing a tenant.
3. **Sidebar Quick Actions**:
   - Embed quick action buttons in the Super Admin sidebar to launch `CreateRestaurantModal` and `CreateUserModal` from anywhere.
4. **TDD Workflow**:
   - Write tests first in `frontend/src/features/crm/AdminLayout.test.tsx` verifying all role states and transitions.
   - Implement the solution in `AdminLayout.tsx` and `AdminSwitcher.tsx`.
   - Verify zero regressions across the entire test suite.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/features/crm/AdminLayout.tsx` | Modified | Dual-mode navigation items, impersonation banner, return button, and quick create actions |
| `frontend/src/features/superadmin/AdminSwitcher.tsx` | Modified | Ensure proper rendering and options for Super Admin across all views |
| `frontend/src/features/crm/AdminLayout.test.tsx` | New | Comprehensive TDD test suite for AdminLayout navigation and roles |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Inadvertent exposure of Super Admin actions to regular restaurant admins | Low | Strict check on `session.role === "super"` before rendering global options and return buttons |
| Styling contrast issues in Dark/Light modes | Low | Standardized Tailwind semantic color classes matching design system |

## Success Criteria

- [ ] Super Admin can manage any restaurant with full access to all restaurant tabs (Orders, Menu, Inventory, etc.).
- [ ] Super Admin sees a clear banner indicating which restaurant is being managed.
- [ ] Super Admin can return to `/admin/restaurants` with a single click on "Volver al Panel Super Admin".
- [ ] Super Admin has quick-action buttons in the sidebar to create restaurants and users.
- [ ] Regular restaurant admins only see their own store modules without Super Admin controls.
- [ ] All unit and E2E tests pass 100%.
