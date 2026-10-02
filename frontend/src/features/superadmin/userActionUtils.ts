export function mapUserActionError(err: any, fallbackMessage: string): string {
  const msg = err?.message || ""
  if (err?.status === 409 || msg.includes("409") || msg.toLowerCase().includes("conflict")) {
    if (msg.includes("own account") || msg.includes("yourself") || msg.includes("propia")) {
      return "No puedes modificar ni eliminar tu propia cuenta de usuario."
    }
    if (msg.includes("last active super admin") || msg.includes("last") || msg.includes("último")) {
      return "No es posible desactivar ni eliminar al único super administrador activo del sistema."
    }
    return "Conflicto: la operación no está permitida en este usuario."
  }
  if (err?.status === 404 || msg.includes("404") || msg.toLowerCase().includes("not found")) {
    return "El usuario no fue encontrado o ya ha sido eliminado."
  }
  return msg || fallbackMessage
}
