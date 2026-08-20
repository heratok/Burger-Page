import Home from "./pages/Home"
import { Toaster } from "@/components/ui/sonner"

function App() {
  return (
    <>
      <Home />
      <Toaster position="top-right" richColors closeButton />
    </>
  )
}

export default App