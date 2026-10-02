export function mapUserActionError(
  err: any,
  fallbackMessage: string = "Ocurrió un error al procesar el usuario"
): string {
  const rawMsg = err?.message || ""
  const msg = rawMsg.toLowerCase()
  const status =
    err?.status ||
    (rawMsg.includes("409")
      ? 409
      : rawMsg.includes("404")
      ? 404
      : rawMsg.includes("400")
      ? 400
      : null)

  // 1. Own account actions (assertNotSelf / demoting check)
  // "You cannot demote your own account"
  // "You cannot deactivate your own account"
  // "You cannot delete your own account"
  if (
    msg.includes("cannot demote your own account") ||
    msg.includes("cannot deactivate your own account") ||
    msg.includes("cannot delete your own account") ||
    msg.includes("own account") ||
    msg.includes("propia cuenta") ||
    msg.includes("yourself")
  ) {
    if (msg.includes("demote")) {
      return "No podés degradar tu propia cuenta ni quitarte el rol de Super Administrador."
    }
    if (msg.includes("deactivate")) {
      return "No podés desactivar tu propia cuenta."
    }
    if (msg.includes("delete")) {
      return "No podés eliminar tu propia cuenta."
    }
    return "No podés degradar ni desactivar tu propia cuenta."
  }

  // 2. Last active super admin protection (assertGuardedChangeAllowed)
  // "Cannot demote the last active super admin"
  // "Cannot deactivate the last active super admin"
  // "Cannot delete the last active super admin"
  if (
    msg.includes("last active super admin") ||
    msg.includes("last active super") ||
    msg.includes("último super")
  ) {
    if (msg.includes("demote")) {
      return "No podés degradar al último Super Administrador activo de la plataforma."
    }
    return "No es posible desactivar ni eliminar al único super administrador activo del sistema."
  }

  // 3. Username uniqueness collision (409)
  // `Username "${username}" already exists` / `username_taken`
  if (
    status === 409 ||
    msg.includes("already exists") ||
    msg.includes("username_taken") ||
    msg.includes("taken") ||
    msg.includes("en uso")
  ) {
    return "El nombre de usuario ya está en uso por otra cuenta."
  }

  // 4. Role & Restaurant assignment validation (400)
  // "A super_admin cannot be assigned to a restaurant"
  if (msg.includes("super_admin cannot be assigned") || msg.includes("super_admin must")) {
    return "Un superadministrador no puede estar asignado a un restaurante."
  }
  // "restaurantId is required for restaurant_admin role"
  if (
    msg.includes("restaurantid is required") ||
    msg.includes("restaurant_admin must have") ||
    msg.includes("seleccionar un restaurante")
  ) {
    return "Debés seleccionar un restaurante para un administrador de restaurante."
  }

  // 5. Required username (400)
  if (msg.includes("username is required") || msg.includes("nombre de usuario es obligatorio")) {
    return "El nombre de usuario es obligatorio."
  }

  // 6. Nothing to update (400)
  if (msg.includes("nothing to update")) {
    return "No hay cambios para actualizar."
  }

  // 7. Entity not found (404)
  if (status === 404 || msg.includes("not found") || msg.includes("no existe")) {
    if (msg.includes("restaurant")) {
      return "El restaurante seleccionado no existe o fue eliminado."
    }
    return "El usuario o restaurante seleccionado no existe o fue eliminado."
  }

  // 8. Password validation
  if (msg.includes("password must be at least") || msg.includes("contraseña")) {
    return "La contraseña debe tener al menos 8 caracteres."
  }

  return rawMsg || fallbackMessage
}
