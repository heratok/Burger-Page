import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { InventoryStats } from "./InventoryStats"
import { InventoryTable } from "./InventoryTable"
import { SuppliersList } from "./SuppliersList"
import { InventoryItemModal } from "./InventoryItemModal"
import { SupplierModal } from "./SupplierModal"
import type { InventoryItem, Supplier } from "@/types/restaurant"

const mockInventory: InventoryItem[] = [
  {
    id: "inv-1",
    name: "Pan Brioche",
    category: "ingredients",
    currentStock: 15,
    minStockAlert: 20,
    unit: "unidades",
    costPerUnit: 1200,
    supplierId: "sup-1",
  },
  {
    id: "inv-2",
    name: "Carne Angus",
    category: "ingredients",
    currentStock: 50,
    minStockAlert: 10,
    unit: "kg",
    costPerUnit: 35000,
    supplierId: "sup-1",
  },
]

const mockSuppliers: Supplier[] = [
  {
    id: "sup-1",
    name: "Distribuidora San José",
    category: "Carnes & Panes",
    contactName: "Mauricio Restrepo",
    phone: "573112233445",
    email: "sanjose@dist.com",
    notes: "Entrega martes y jueves",
  },
]

describe("Inventory Subcomponents Unit Tests (TDD)", () => {
  afterEach(() => {
    cleanup()
  })

  describe("InventoryStats", () => {
    it("renders all 4 metric cards with correct values and handles clicks", () => {
      const handleSelectLowStock = vi.fn()
      const handleSelectSuppliers = vi.fn()

      render(
        <InventoryStats
          totalItems={25}
          lowStockCount={3}
          totalInventoryValue={150000}
          suppliersCount={4}
          isDark={false}
          onSelectLowStock={handleSelectLowStock}
          onSelectSuppliers={handleSelectSuppliers}
        />
      )

      expect(screen.getByText("Insumos Registrados")).toBeDefined()
      expect(screen.getByText("25")).toBeDefined()
      expect(screen.getByText("Alertas de Bajo Stock")).toBeDefined()
      expect(screen.getByText("3")).toBeDefined()
      expect(screen.getByText("Valor del Inventario")).toBeDefined()
      expect(screen.getByText("Proveedores Activos")).toBeDefined()
      expect(screen.getByText("4")).toBeDefined()

      fireEvent.click(screen.getByText("Alertas de Bajo Stock").closest("div")!)
      expect(handleSelectLowStock).toHaveBeenCalled()

      fireEvent.click(screen.getByText("Proveedores Activos").closest("div")!)
      expect(handleSelectSuppliers).toHaveBeenCalled()
    })
  })

  describe("InventoryTable", () => {
    it("renders inventory rows and triggers quick stock adjustments and action callbacks", () => {
      const handleAdjustStock = vi.fn()
      const handleEdit = vi.fn()
      const handleDelete = vi.fn()
      const handleWhatsApp = vi.fn()
      const handleSearchChange = vi.fn()
      const handleCategoryChange = vi.fn()
      const handleToggleLowStock = vi.fn()
      const handlePageChange = vi.fn()
      const handlePageSizeChange = vi.fn()

      render(
        <InventoryTable
          items={mockInventory}
          totalItems={mockInventory.length}
          suppliers={mockSuppliers}
          searchTerm=""
          onSearchChange={handleSearchChange}
          selectedCategory="all"
          onCategoryChange={handleCategoryChange}
          onlyLowStock={false}
          onToggleOnlyLowStock={handleToggleLowStock}
          currentPage={1}
          pageSize={10}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isDark={false}
          onAdjustStock={handleAdjustStock}
          onSendSupplierWhatsApp={handleWhatsApp}
          onEditItem={handleEdit}
          onDeleteItem={handleDelete}
        />
      )

      expect(screen.getByText("Pan Brioche")).toBeDefined()
      expect(screen.getByText("Carne Angus")).toBeDefined()

      // Quick adjust buttons
      const plusOneButtons = screen.getAllByRole("button", { name: "+1" })
      fireEvent.click(plusOneButtons[0])
      expect(handleAdjustStock).toHaveBeenCalledWith("inv-1", 1)

      const minusOneButtons = screen.getAllByRole("button", { name: "-1" })
      fireEvent.click(minusOneButtons[0])
      expect(handleAdjustStock).toHaveBeenCalledWith("inv-1", -1)

      const plusFiveButtons = screen.getAllByRole("button", { name: "+5" })
      fireEvent.click(plusFiveButtons[0])
      expect(handleAdjustStock).toHaveBeenCalledWith("inv-1", 5)

      // Edit item
      const editButtons = screen.getAllByTitle("Editar insumo")
      fireEvent.click(editButtons[0])
      expect(handleEdit).toHaveBeenCalledWith(mockInventory[0])

      // Delete item
      const deleteButtons = screen.getAllByTitle("Eliminar insumo")
      fireEvent.click(deleteButtons[0])
      expect(handleDelete).toHaveBeenCalledWith(mockInventory[0])
    })

    it("renders empty state when there are no items", () => {
      render(
        <InventoryTable
          items={[]}
          totalItems={0}
          suppliers={mockSuppliers}
          searchTerm="no-match"
          onSearchChange={vi.fn()}
          selectedCategory="all"
          onCategoryChange={vi.fn()}
          onlyLowStock={false}
          onToggleOnlyLowStock={vi.fn()}
          currentPage={1}
          pageSize={10}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
          isDark={false}
          onAdjustStock={vi.fn()}
          onSendSupplierWhatsApp={vi.fn()}
          onEditItem={vi.fn()}
          onDeleteItem={vi.fn()}
        />
      )

      expect(screen.getByText(/No se encontraron insumos/i)).toBeDefined()
    })
  })

  describe("SuppliersList", () => {
    it("renders supplier cards and handles edit, delete, and WhatsApp actions", () => {
      const handleEdit = vi.fn()
      const handleDelete = vi.fn()
      const handleWhatsApp = vi.fn()

      render(
        <SuppliersList
          suppliers={mockSuppliers}
          inventory={mockInventory}
          searchTerm=""
          onSearchChange={vi.fn()}
          isDark={false}
          onEditSupplier={handleEdit}
          onDeleteSupplier={handleDelete}
          onSendSupplierWhatsApp={handleWhatsApp}
        />
      )

      expect(screen.getByText("Distribuidora San José")).toBeDefined()
      expect(screen.getByText("Mauricio Restrepo")).toBeDefined()
      expect(screen.getByText("573112233445")).toBeDefined()

      // Edit supplier
      const editBtn = screen.getByTitle("Editar proveedor")
      fireEvent.click(editBtn)
      expect(handleEdit).toHaveBeenCalledWith(mockSuppliers[0])

      // Delete supplier
      const deleteBtn = screen.getByTitle("Eliminar proveedor")
      fireEvent.click(deleteBtn)
      expect(handleDelete).toHaveBeenCalledWith(mockSuppliers[0])

      // WhatsApp button
      const waBtn = screen.getByRole("button", { name: /Pedir Reposición por WhatsApp/i })
      fireEvent.click(waBtn)
      expect(handleWhatsApp).toHaveBeenCalledWith(mockSuppliers[0])
    })

    it("renders empty state when no suppliers are registered", () => {
      render(
        <SuppliersList
          suppliers={[]}
          inventory={mockInventory}
          searchTerm=""
          onSearchChange={vi.fn()}
          isDark={false}
          onEditSupplier={vi.fn()}
          onDeleteSupplier={vi.fn()}
          onSendSupplierWhatsApp={vi.fn()}
        />
      )

      expect(screen.getByText(/No hay proveedores registrados/i)).toBeDefined()
    })
  })

  describe("InventoryItemModal", () => {
    it("validates and submits new inventory item form", () => {
      const handleSave = vi.fn()
      const handleClose = vi.fn()

      render(
        <InventoryItemModal
          isOpen={true}
          editingItem={null}
          suppliers={mockSuppliers}
          isDark={false}
          onClose={handleClose}
          onSave={handleSave}
        />
      )

      expect(screen.getByText("Nuevo Insumo en Inventario")).toBeDefined()

      const nameInput = screen.getByPlaceholderText(/Ej: Pan Brioche de Papa/i)
      fireEvent.change(nameInput, { target: { value: "Salsa de la Casa" } })

      const submitBtn = screen.getByRole("button", { name: /Guardar Insumo/i })
      fireEvent.click(submitBtn)

      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Salsa de la Casa",
          category: "ingredients",
          currentStock: 20,
          minStockAlert: 5,
        })
      )
    })
  })

  describe("SupplierModal", () => {
    it("validates and submits supplier form", () => {
      const handleSave = vi.fn()
      const handleClose = vi.fn()

      render(
        <SupplierModal
          isOpen={true}
          editingSupplier={null}
          isDark={false}
          onClose={handleClose}
          onSave={handleSave}
        />
      )

      expect(screen.getByText("Registrar Nuevo Proveedor")).toBeDefined()

      const nameInput = screen.getByPlaceholderText(/Ej: Distribuidora Cárnicos San José/i)
      fireEvent.change(nameInput, { target: { value: "Lácteos del Valle" } })

      const phoneInput = screen.getByPlaceholderText(/Ej: 573105551234/i)
      fireEvent.change(phoneInput, { target: { value: "573209998877" } })

      const submitBtn = screen.getByRole("button", { name: /Guardar Proveedor/i })
      fireEvent.click(submitBtn)

      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Lácteos del Valle",
          phone: "573209998877",
        })
      )
    })
  })
})
