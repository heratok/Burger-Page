import { Component, ErrorInfo, ReactNode } from "react"
import { AlertCircle, RefreshCw, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((props: { error: Error; resetErrorBoundary: () => void }) => ReactNode)
  onReset?: () => void
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env?.MODE !== "test") {
      console.error("[ErrorBoundary caught error]:", error, errorInfo)
    }
    this.props.onError?.(error, errorInfo)
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.()
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
        })
      }

      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          className="min-h-[320px] w-full flex flex-col items-center justify-center p-6 text-center bg-card rounded-2xl border border-destructive/20 shadow-sm my-4"
        >
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-foreground mb-2">
            Algo no salió como esperábamos
          </h2>

          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Ocurrió un error inesperado al renderizar esta sección. El resto de la aplicación continúa funcionando con normalidad.
          </p>

          {import.meta.env?.DEV && this.state.error.message && (
            <div className="mb-6 p-3 bg-muted rounded-lg text-xs font-mono text-left max-w-lg overflow-x-auto text-destructive border border-border">
              {this.state.error.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={this.resetErrorBoundary}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reintentar
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Recargar página
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
