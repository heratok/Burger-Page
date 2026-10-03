output "fqdn" {
  description = "FQDN público de la VM. Usalo como VITE_API_URL en Vercel (sin /api al final) y es el dominio que Caddy sirve con HTTPS automático."
  value       = azurerm_public_ip.main.fqdn
}

output "public_ip" {
  description = "IP pública estática de la VM."
  value       = azurerm_public_ip.main.ip_address
}

output "ssh_note" {
  description = "El puerto 22 NO está expuesto públicamente. Conectate por Tailscale: `tailscale status` desde cualquier otro nodo de tu tailnet te da la IP 100.x.x.x de esta VM, y entrás con `ssh -i ~/.ssh/burgerpage_azure_rsa azureuser@<esa-ip>`."
  value       = "ver infra/README.md — acceso SSH solo vía Tailscale"
}
