import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import Home from "./pages/Home"
import { AdminLayout } from "./components/crm/AdminLayout"
import { DashboardOverview } from "./components/crm/DashboardOverview"
import { OrdersKanban } from "./components/crm/OrdersKanban"
import { MenuManager } from "./components/crm/MenuManager"
import { CustomerCRM } from "./components/crm/CustomerCRM"
import { StorefrontCustomizer } from "./components/crm/StorefrontCustomizer"
import { Toaster } from "@/components/ui/sonner"

function MainRouter() {
  const { activeView, adminTab } = useRestaurant()

  if (activeView === "admin") {
    return (
      <AdminLayout>
        {adminTab === "dashboard" && <DashboardOverview />}
        {adminTab === "orders" && <OrdersKanban />}
        {adminTab === "menu" && <MenuManager />}
        {adminTab === "customers" && <CustomerCRM />}
        {adminTab === "customizer" && <StorefrontCustomizer />}
      </AdminLayout>
    )
  }

  return <Home />
}

export default function App() {
  return (
    <RestaurantProvider>
      <MainRouter />
      <Toaster position="top-right" richColors closeButton />
    </RestaurantProvider>
  )
}