import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import React from "react"
import { UsersDirectory } from "./UsersDirectory"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"

describe("UsersDirectory - Super Admin User Management (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders user directory header, search bar, role filter and user rows", async () => {
    const mockUsers = [
      {
        id: "usr-1",
        username: "admin_super",
        role: "super_admin",
        createdAt: "2026-08-01T12:00:00Z",
      },
      {
        id: "usr-2",
        username: "admin_craft",
        role: "restaurant_admin",
        restaurantId: "burger-craft",
        createdAt: "2026-08-05T12:00:00Z",
      },
      {
        id: "usr-3",
        username: "admin_napoli",
        role: "restaurant_admin",
        restaurantId: "pizzeria-napoli",
        createdAt: "2026-08-10T12:00:00Z",
      },
    ]

    vi.spyOn(apiClient, "listUsers").mockResolvedValue(mockUsers)

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    // Header & description
    expect(screen.getByText(/Directorio Global de Usuarios/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /\+ Nuevo Usuario/i })).toBeDefined()

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText("admin_super")).toBeDefined()
      expect(screen.getByText("admin_craft")).toBeDefined()
      expect(screen.getByText("admin_napoli")).toBeDefined()
    })

    // Roles badges check
    expect(screen.getAllByText(/Super Admin/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Admin Local/i).length).toBeGreaterThan(0)
  })

  it("filters users by username search input", async () => {
    const mockUsers = [
      {
        id: "usr-1",
        username: "super_admin",
        role: "super_admin",
        createdAt: "2026-08-01T12:00:00Z",
      },
      {
        id: "usr-2",
        username: "rosto_chef",
        role: "restaurant_admin",
        restaurantId: "rosto",
        createdAt: "2026-08-05T12:00:00Z",
      },
    ]

    vi.spyOn(apiClient, "listUsers").mockResolvedValue(mockUsers)

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("super_admin")).toBeDefined()
      expect(screen.getByText("rosto_chef")).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(/Buscar por nombre de usuario/i)
    fireEvent.change(searchInput, { target: { value: "rosto" } })

    expect(screen.getByText("rosto_chef")).toBeDefined()
    expect(screen.queryByText("super_admin")).toBeNull()
  })

  it("opens CreateUserModal when clicking '+ Nuevo Usuario'", async () => {
    vi.spyOn(apiClient, "listUsers").mockResolvedValue([])

    render(
      <RestaurantProvider>
        <UsersDirectory />
      </RestaurantProvider>
    )

    const createUserBtn = screen.getByRole("button", { name: /\+ Nuevo Usuario/i })
    fireEvent.click(createUserBtn)

    expect(screen.getByRole("heading", { name: "Crear Usuario" })).toBeDefined()
  })
})
