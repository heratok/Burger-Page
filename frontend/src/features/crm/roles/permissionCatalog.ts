import type React from "react"
import type { Permission } from "@burger-page/contracts"
import {
  ShoppingBag,
  Users,
  UtensilsCrossed,
  Boxes,
  Layers,
  DollarSign,
  Settings,
  Shield,
} from "lucide-react"

export interface PermissionMeta {
  id: Permission
  label: string
  description: string
}

export interface PermissionCategory {
  category: string
  icon: React.ComponentType<{ className?: string }>
  permissions: PermissionMeta[]
}

export const PERMISSION_GROUPS: PermissionCategory[] = [
  {
    category: "Pedidos & Cocina",
    icon: ShoppingBag,
    permissions: [
      {
        id: "orders.view",
        label: "Ver pedidos",
        description: "Acceso al tablero Kanban y comandas de cocina",
      },
      {
        id: "orders.manage",
        label: "Gestionar pedidos",
        description: "Aceptar, preparar, cambiar estados y cobrar pedidos",
      },
      {
        id: "orders.delete",
        label: "Eliminar pedidos",
        description: "Anular o eliminar órdenes registradas",
      },
    ],
  },
  {
    category: "Clientes (CRM)",
    icon: Users,
    permissions: [
      {
        id: "customers.view",
        label: "Ver clientes",
        description: "Consultar lista de clientes registrados e historial",
      },
      {
        id: "customers.manage",
        label: "Gestionar clientes",
        description: "Editar datos de contacto, direcciones y notas de clientes",
      },
    ],
  },
  {
    category: "Menú & Catálogo",
    icon: UtensilsCrossed,
    permissions: [
      {
        id: "menu.manage",
        label: "Gestionar menú",
        description: "Crear y editar productos, categorías y modificadores",
      },
    ],
  },
  {
    category: "Inventario",
    icon: Boxes,
    permissions: [
      {
        id: "inventory.manage",
        label: "Gestionar inventario",
        description: "Control de stock, alertas de reposición y proveedores",
      },
    ],
  },
  {
    category: "Mesas & Salón",
    icon: Layers,
    permissions: [
      {
        id: "tables.manage",
        label: "Gestionar mesas",
        description: "Configurar distribución de salón y vincular pedidos a mesas",
      },
    ],
  },
  {
    category: "Finanzas & Reportes",
    icon: DollarSign,
    permissions: [
      {
        id: "finance.view",
        label: "Ver finanzas y reportes",
        description: "Visualizar ingresos, totales de ventas y cierre de caja",
      },
    ],
  },
  {
    category: "Equipo & Accesos",
    icon: Shield,
    permissions: [
      {
        id: "users.manage",
        label: "Gestionar equipo",
        description: "Crear usuarios de personal y restablecer contraseñas",
      },
      {
        id: "roles.manage",
        label: "Gestionar roles",
        description: "Crear y configurar roles y permisos de acceso",
      },
    ],
  },
  {
    category: "Configuración",
    icon: Settings,
    permissions: [
      {
        id: "settings.manage",
        label: "Gestionar configuración",
        description: "Ajustes del local, horarios, WhatsApp y personalizador",
      },
    ],
  },
]
