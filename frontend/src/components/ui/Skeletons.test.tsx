import React from "react"
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import {
  TableSkeleton,
  KanbanBoardSkeleton,
  MenuGridSkeleton,
  MetricCardsSkeleton,
} from "./Skeletons"

describe("Skeletons UI Components", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders TableSkeleton with specified rows and columns", () => {
    render(<TableSkeleton rows={4} columns={3} />)
    const tableSkeleton = screen.getByTestId("table-skeleton")
    expect(tableSkeleton).toBeDefined()
    expect(tableSkeleton).not.toBeNull()
    const rows = tableSkeleton.querySelectorAll("tbody tr")
    expect(rows.length).toBe(4)
  })

  it("renders KanbanBoardSkeleton with 3 columns", () => {
    render(<KanbanBoardSkeleton columns={3} isDark={true} />)
    const kanbanSkeleton = screen.getByTestId("kanban-skeleton")
    expect(kanbanSkeleton).toBeDefined()
    expect(kanbanSkeleton).not.toBeNull()
    expect(kanbanSkeleton.children.length).toBe(3)
  })

  it("renders MenuGridSkeleton with correct card count", () => {
    render(<MenuGridSkeleton count={8} />)
    const menuSkeleton = screen.getByTestId("menu-grid-skeleton")
    expect(menuSkeleton).toBeDefined()
    expect(menuSkeleton).not.toBeNull()
    expect(menuSkeleton.children.length).toBe(8)
  })

  it("renders MetricCardsSkeleton with correct count in dark mode", () => {
    render(<MetricCardsSkeleton count={4} isDark={true} />)
    const metricsSkeleton = screen.getByTestId("metrics-skeleton")
    expect(metricsSkeleton).toBeDefined()
    expect(metricsSkeleton).not.toBeNull()
    expect(metricsSkeleton.children.length).toBe(4)
  })
})
