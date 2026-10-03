output "fqdn" {
  description = "FQDN público de la VM. Usalo como VITE_API_URL en Vercel (sin /api al final) y es el dominio que Caddy sirve con HTTPS automático."
  value       = azurerm_public_ip.main.fqdn
}

output "public_ip" {
  description = "IP pública estática de la VM."
  value       = azurerm_public_ip.main.ip_address
}

output "ssh_command" {
  description = "Comando para conectarte por SSH."
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.main.fqdn}"
}
