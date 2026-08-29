import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { MenuManager } from './MenuManager';
import { RestaurantProvider } from '@/context/RestaurantContext';
import { toast } from 'sonner';

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe('MenuManager - Strict Validation and Deletion Safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders products and additions correctly and opens modals', () => {
    render(
      <RestaurantProvider>
        <MenuManager />
      </RestaurantProvider>
    );

    expect(screen.getByText(/Platos & Productos/i)).toBeDefined();
    expect(screen.getByText(/Adicionales & Extras/i)).toBeDefined();
  });

  it('validates addition creation: rejects empty addition name', async () => {
    render(
      <RestaurantProvider>
        <MenuManager />
      </RestaurantProvider>
    );

    // Switch to Additions sub-tab
    const additionsTab = screen.getByRole('button', { name: /Adicionales & Extras/i });
    fireEvent.click(additionsTab);

    // Click "Añadir Adicional" button
    const newAdditionBtn = screen.getByRole('button', { name: /Añadir Adicional/i });
    fireEvent.click(newAdditionBtn);

    expect(screen.getByRole('heading', { name: /Nuevo Adicional/i })).toBeDefined();

    // Fill with empty/whitespace name
    const nameInput = screen.getByPlaceholderText(/Tocineta ahumada extra/i);
    fireEvent.change(nameInput, { target: { value: '   ' } });

    const saveBtn = screen.getByRole('button', { name: /^Guardar$/i });
    fireEvent.click(saveBtn);

    // Should trigger validation error
    expect(toast.error).toHaveBeenCalledWith('El nombre del adicional no puede estar vacío');
  });

  it('validates product save: rejects empty product name and zero price', async () => {
    render(
      <RestaurantProvider>
        <MenuManager />
      </RestaurantProvider>
    );

    // Click "Crear Producto"
    const newProductBtn = screen.getByRole('button', { name: /Crear Producto/i });
    fireEvent.click(newProductBtn);

    expect(screen.getByRole('heading', { name: /Nuevo Producto/i })).toBeDefined();

    // Fill with whitespace name
    const nameInput = screen.getByPlaceholderText(/Plato Especial/i);
    fireEvent.change(nameInput, { target: { value: '   ' } });

    const saveBtn = screen.getByRole('button', { name: /Guardar en Menú/i });
    fireEvent.click(saveBtn);

    expect(toast.error).toHaveBeenCalledWith('El nombre del producto no puede estar vacío');
  });

  it('validates category modal: prevents duplicate category creation', async () => {
    render(
      <RestaurantProvider>
        <MenuManager />
      </RestaurantProvider>
    );

    // Open category manager
    const manageCatBtn = screen.getByRole('button', { name: /Gestionar Categorías/i });
    fireEvent.click(manageCatBtn);

    expect(screen.getByRole('heading', { name: /Gestionar Categorías del Menú/i })).toBeDefined();

    // Try to add existing category "Clásicas"
    const catInput = screen.getByPlaceholderText(/Nueva categoría/i);
    fireEvent.change(catInput, { target: { value: 'Clásicas' } });

    const addBtn = screen.getByRole('button', { name: /Agregar/i });
    fireEvent.click(addBtn);

    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('ya existe'));
  });
});
