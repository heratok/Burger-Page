variable "location" {
  description = "Región de Azure. Esta suscripción (Azure for Students) tiene una Azure Policy 'Allowed resource deployment regions' que SOLO permite: belgiumcentral, westus, francecentral, northcentralus, canadacentral (verificado con `az policy assignment show --name sys.regionrestriction`). eastus2 NO está permitida — cualquier otra región falla en apply por policy, no por capacidad. northcentralus es la elegida porque es la única de las 5 con Standard_B2ats_v2 Y Standard_B2pts_v2 disponibles (verificado con `az vm list-skus`)."
  type        = string
  default     = "northcentralus"
}

variable "resource_group_name" {
  description = "Nombre del resource group."
  type        = string
  default     = "burgerpage-rg"
}

variable "vm_size" {
  description = "Tamaño de la VM. Standard_B1s (y toda la familia B1/A1/A2 en general) está BLOQUEADO para esta suscripción en las 5 regiones permitidas (NotAvailableForSubscription, verificado con az vm list-skus) — no es una opción real, a pesar de ser el tamaño típico de capa gratuita. Standard_B2ats_v2 (x64/AMD, burstable) SÍ está disponible en northcentralus — es el elegido. Alternativa ARM64 real: Standard_B2pts_v2 (también disponible en northcentralus, westus, canadacentral; ahí sí cambiar vm_image_sku a \"server-arm64\")."
  type        = string
  default     = "Standard_B2ats_v2"
}

variable "vm_image_sku" {
  description = "SKU de la imagen Ubuntu 24.04 LTS de Canonical. \"server\" para x64 (Standard_B2ats_v2, el tamaño elegido). \"server-arm64\" únicamente si vm_size se cambia a Standard_B2pts_v2 (el único tamaño ARM64 real de esta familia — B2ats_v2 es x64 a pesar del nombre parecido)."
  type        = string
  default     = "server"
}

variable "admin_username" {
  description = "Usuario administrador de la VM."
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key_path" {
  description = "Ruta local a la llave pública SSH (se expande con pathexpand, admite ~). Azure solo acepta llaves RSA para VMs — ed25519 es rechazado por la API (error validado en terraform plan). Generá una dedicada con: ssh-keygen -t rsa -b 4096 -f ~/.ssh/burgerpage_azure_rsa -N \"\""
  type        = string
  default     = "~/.ssh/burgerpage_azure_rsa.pub"
}

variable "domain_name_label_prefix" {
  description = "Prefijo del label DNS de la IP pública. Se le agrega un sufijo random para garantizar unicidad global en Azure (el label de DNS debe ser único en toda la nube, no solo en tu suscripción)."
  type        = string
  default     = "burger-api"
}

variable "cors_origin" {
  description = "Orígenes permitidos para CORS (separados por coma, sin espacios luego de la coma), inyectados al .env de producción del backend vía cloud-init."
  type        = string
  default     = "https://heratok.app,https://www.heratok.app"
}

variable "ghcr_image" {
  description = "Imagen de GHCR que publica el workflow de GitHub Actions (sin tag)."
  type        = string
  default     = "ghcr.io/heratok/burger-page-backend"
}

variable "ghcr_username" {
  description = "Usuario/owner de GHCR (no es secreto, es el nombre de usuario/org de GitHub). Se precompleta en .env.example; el token (GHCR_PAT) NUNCA va acá — se crea a mano en el .env real."
  type        = string
  default     = "heratok"
}
