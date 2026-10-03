# Infraestructura — Backend en Azure (Terraform)

Provisiona una VM Ubuntu 24.04 LTS en `northcentralus` que corre el backend detrás de Caddy
(HTTPS automático vía el FQDN de la IP pública).

**Modelo de deploy: PULL, no push.** GitHub Actions (`.github/workflows/deploy-azure.yml`)
solo construye la imagen y la publica en GHCR — nunca se conecta a la VM. Un **systemd
timer** instalado por `cloud-init.yaml.tftpl` (`burgerpage-deploy.timer`) corre cada 5
minutos en la propia VM, hace `docker compose pull && up -d`, y así recoge la imagen nueva
solo. No hace falta ningún secret `AZURE_VM_*` en GitHub — la VM nunca necesita que CI le
escriba nada.

## Prerrequisitos

- `az login` ya ejecutado contra la suscripción "Azure for Students" (confirmado).
- Terraform instalado (`>= 1.6.0`).
- Una llave SSH **RSA** local dedicada a esta VM (Azure rechaza ed25519 en `admin_ssh_key` — error validado en `terraform plan`). Generala con:
  ```bash
  ssh-keygen -t rsa -b 4096 -f ~/.ssh/burgerpage_azure_rsa -N ""
  ```
  Tu llave ed25519 personal (`~/.ssh/id_ed25519`) queda intacta y sin usar en este despliegue.

## Cómo correr

Desde `infra/`:

```bash
terraform init
terraform validate
```

**`terraform plan` lo corre el usuario junto con el orquestador en otro paso, para revisarlo antes de pedir confirmación. Nunca corras `terraform apply` sin que el usuario haya visto y aprobado el plan primero.**

Las variables ya están resueltas en `terraform.tfvars` (no se commitea — ver `.gitignore`). `terraform.tfvars.example` es la plantilla pública sin datos reales.

## GitHub Actions — no hace falta ningún secret `AZURE_VM_*`

El workflow solo necesita `GITHUB_TOKEN` (automático, ya lo provee Actions) para loguearse
en GHCR y publicar la imagen. No hay job de deploy, no hay SSH desde CI, no hay que crear
nada en **Settings → Secrets**.

## Autenticación de la VM contra GHCR (`GHCR_PAT`)

El timer de la VM necesita poder hacer `docker pull` de la imagen. Dos opciones:

1. **Más simple — hacer el paquete público**: en GitHub, ir a tu perfil → **Packages** →
   `burger-page-backend` → **Package settings** → cambiar visibilidad a Public. Con esto,
   dejá `GHCR_PAT` vacío en el `.env` de la VM y el pull funciona sin login.
2. **Si preferís mantenerlo privado**: generá un **Personal Access Token de solo lectura**
   (Settings → Developer settings → Personal access tokens → Fine-grained token → permiso
   únicamente `read:packages`, sin ningún otro scope) y pegalo en `/opt/burgerpage/.env`
   como `GHCR_PAT=<token>` (junto a `GHCR_USERNAME`, que ya viene precompletado y no es
   secreto). Igual que el resto de los secretos: **nunca** en Terraform, tfvars, cloud-init
   ni el repo — se crea a mano por SSH, permisos 600.

El timer (`/opt/burgerpage/deploy.sh`) solo hace `docker login` si `GHCR_PAT` está seteado;
si lo dejás vacío (paquete público), se lo salta y pull igual.

## Cómo disparar el primer deploy

El workflow `.github/workflows/deploy-azure.yml` (solo build+push, sin SSH) se dispara:

- Automáticamente con un push a `main` que toque `backend/**` o `packages/contracts/**`.
- Manualmente desde la pestaña **Actions → "Build Backend Image for Azure (pull model)" → "Run workflow"**.

Una vez publicada la imagen en GHCR, el timer de la VM la recoge solo dentro de los
siguientes 5 minutos (`OnUnitActiveSec=5min` en `burgerpage-deploy.timer`). No hace falta
disparar nada más desde afuera.

## Configuración de datos — Supabase (mismo backend de datos que producción en Render)

**SQLite es solo para desarrollo local.** Esta VM corre contra la misma base Supabase que
usa producción (Render) — no es una base nueva ni separada. El backend trata `'postgres'` y
`'supabase'` como el mismo driver de datos (ambos pasan por el pool de Postgres con el rol
`app_user`, RLS-scoped); `STORAGE_DRIVER=supabase` solo agrega un log informativo y habilita
el storage de archivos — confirmado leyendo `backend/src/infrastructure/http/app.ts`.

### Los secretos NUNCA van en Terraform, tfvars ni cloud-init

Ni `DATABASE_URL`, ni `SUPABASE_URL`/`SUPABASE_KEY`, ni `JWT_SECRET` se generan ni se guardan
en este repo, en el state de Terraform, ni en `custom_data` de la VM. Los creás vos a mano,
una sola vez, por SSH:

```bash
ssh -i ~/.ssh/burgerpage_azure_rsa azureuser@<fqdn>
sudo -u azureuser cp /opt/burgerpage/.env.example /opt/burgerpage/.env
nano /opt/burgerpage/.env      # completá los valores reales (ver tabla abajo)
chmod 600 /opt/burgerpage/.env
```

`/opt/burgerpage/.env.example` (sí lo escribe cloud-init, sin secretos) ya trae las claves
correctas y los valores no sensibles (`CORS_ORIGIN`, `RATE_LIMIT_*`, etc.) — solo hay que
completar lo que está vacío.

### Variables requeridas en `/opt/burgerpage/.env`

| Variable | Valor | Por qué |
|---|---|---|
| `JWT_SECRET` | **El mismo valor que ya tenés configurado en Render.** No generes uno nuevo — si no coincide, los tokens emitidos por un backend no sirven en el otro. | `backend/src/infrastructure/security/JwtService.ts` |
| `STORAGE_DRIVER` | `supabase` | Igual que `render.yaml` de producción |
| `DATABASE_URL` | La cadena del **pooler de Supabase (Supavisor)**: `postgresql://app_user.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres` — **nunca** `db.<ref>.supabase.co` | La VM solo tiene IPv4; la conexión directa de Supabase (`db.*.supabase.co`) resuelve a IPv6-only en la mayoría de regiones. El pooler sí soporta IPv4. Mismo patrón que ya usa Render — copiá el mismo valor. |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | API REST de Supabase, solo para storage de archivos (`storage.routes.ts`) — es una URL HTTPS normal, no tiene el problema de IPv4/IPv6 del punto anterior |
| `SUPABASE_KEY` | La misma key que usás en Render para storage | Firma URLs de archivos subidos |
| `CORS_ORIGIN` | `https://heratok.app,https://www.heratok.app` | Ya viene precompletado en `.env.example` vía Terraform |
| `GHCR_USERNAME` | `heratok` | Ya viene precompletado — no es secreto |
| `GHCR_PAT` | Vacío si el paquete GHCR es público; si no, un PAT de solo lectura (`read:packages`) | Ver sección "Autenticación de la VM contra GHCR" arriba |

### Regiones y tamaños — verificado contra la API de Azure para esta suscripción

Esta suscripción ("Azure for Students") tiene una Azure Policy `sys.regionrestriction`
("Allowed resource deployment regions") que limita el despliegue a solo 5 regiones — `eastus2`
**no** es una de ellas. Verificar con:
```bash
az policy assignment show --name sys.regionrestriction --query "parameters"
```

Dentro de esas 5 regiones, además, **toda la familia B1/A1/A2 está bloqueada** para esta
suscripción (`NotAvailableForSubscription`, un bloqueo de oferta/cuota — independiente de la
policy de región). Tabla verificada con `az vm list-skus --location <region> --size Standard_B --all`:

| Región | B2ats_v2 (x64) | B2ts_v2 | B2pts_v2 (ARM64) | B1s |
|---|---|---|---|---|
| belgiumcentral | ❌ | ❌ | N/A | ❌ |
| westus | ❌ | ❌ | ✅ | ❌ |
| francecentral | ❌ | ❌ | ❌ | ❌ |
| **northcentralus** | **✅** | ❌ | ✅ | ❌ |
| canadacentral | ❌ | ❌ | ✅ | ❌ |

**Configurado: `location = "northcentralus"`, `vm_size = "Standard_B2ats_v2"`** (x64/AMD,
burstable — mantiene `vm_image_sku = "server"`). Es la única región con ambos tamaños B
disponibles. Si en el futuro `B2ats_v2` deja de tener capacidad ahí, la alternativa real es
`Standard_B2pts_v2` en la misma región (ahí sí cambiar `vm_image_sku` a `"server-arm64"` —
B2ats_v2 es x64 a pesar del nombre parecido a B2pts_v2, no son la misma arquitectura).
Si cambiás de región, repetí ambas verificaciones (policy + list-skus) antes de aplicar.

### Notas importantes

- Si tu IP pública cambia (común en conexiones residenciales), el acceso SSH se pierde. Actualizá `my_ip` en `terraform.tfvars` y volvé a aplicar.
- La VM tiene `lifecycle { ignore_changes = [custom_data] }`: si editás `cloud-init.yaml.tftpl` después del primer apply (por ejemplo, para cambiar el timer de 5 min o el script de deploy), Terraform NO va a recrear la VM automáticamente (lo que destruiría el `.env` creado a mano). Para aplicar esos cambios a una VM ya existente, hacelos a mano por SSH — copiá el `write_files` actualizado a los mismos paths y corré `systemctl daemon-reload`.
- El timer (`burgerpage-deploy.timer`) va a fallar silenciosamente (visible con `systemctl status burgerpage-deploy.service` / `journalctl -u burgerpage-deploy.service`) hasta que exista `/opt/burgerpage/.env` real — es esperado, `docker compose` no puede levantar sin él.
- `Standard_B2ats_v2` tiene **1 GB de RAM** (2 vCPU) — verificado con `az vm list-skus --query "[0].capabilities[?name=='MemoryGB']"`. El swap de 2GB que crea cloud-init es necesario, no opcional, con ese límite tan ajustado. Backend + Caddy corren bien porque la imagen ya viene compilada desde GitHub Actions — la VM nunca compila nada.
