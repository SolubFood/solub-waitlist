# Mapa del proyecto — solubfood.com

> **Para quién es esto:** cualquier persona que entra a trabajar en el código de SolubFood, especialmente el responsable de ciberseguridad. Explica **qué es cada cosa, dónde está y a qué se conecta**.
>
> *English summary: static marketing/waitlist site for solubfood.com (plain HTML/CSS/JS, no build step), four forms posting to FormSubmit, and one optional Cloudflare Worker (`worker/`) for the community drawing wall. See `SECURITY.md` for the threat surface and review checklist.*

---

## 1. Dónde vive el código

| Qué | Dónde |
|---|---|
| Código fuente (la única versión oficial) | GitHub → `SolubFood/solub-waitlist`, rama **`main`** |
| Web publicada | **solubfood.com**, servida por **Cloudflare Workers** (proyecto `solub-waitlist`; build: `bash build.sh` → carpeta `dist/`, configurado en `wrangler.jsonc`) |
| Cambios hechos con Claude Code | Llegan como ramas `claude/...` y se unen a `main` mediante un Pull Request |
| Copia en el computador de Benjamín | Opcional, con GitHub Desktop (no es la fuente oficial) |

**Regla:** lo que está en `main` es lo que ve el público. Nada llega a `main` sin Pull Request revisado.

## 2. Estructura de carpetas

```
solub-waitlist/
├── index.html            Página principal + formulario de lista de espera (waitlist)
├── about.html            Quiénes somos
├── for-restaurants.html  Página para restaurantes
├── kitchen.html          Registro de cocineros (formulario)
├── tickets.html          Términos de entradas a eventos
├── checkin.html          Check-in en eventos (formulario)
├── cancel.html           Cancelar membresía (formulario)
├── drop.html             Venta semanal de packs ("Drop"): botones a Stripe Payment Links + formulario "avísame"
├── kiosko-3d.html        Kiosko 3D + muro de dibujos de la comunidad
├── map-globe.html        Globo 3D interactivo
├── privacy.html          Política de privacidad
├── terms.html            Términos de uso
├── robots.txt, sitemap.xml, favicon*, apple-touch-icon.png   SEO e íconos
├── CNAME                 Dominio (usado solo por GitHub Pages)
├── build.sh              Copia solo los archivos públicos a dist/
├── wrangler.jsonc        Configuración de Cloudflare: publica solo dist/
├── _headers              Cabeceras de seguridad (Cloudflare)
├── assets/
│   ├── img/              Imágenes, logos, pósters de video
│   ├── videos/           Videos de la web (.mp4)
│   └── js/qrcode.js      Librería local para generar códigos QR
├── worker/               Servidor del muro de dibujos (Cloudflare Worker) — ver worker/README.md
├── design-reference/     Archivos de diseño de referencia (no se usan en la web)
├── ARQUITECTURA.md       Este documento
├── SECURITY.md           Política de seguridad y lista de revisión
└── .github/CODEOWNERS    Quién debe aprobar cambios en cada parte
```

## 3. A qué servicios externos se conecta

| Servicio | Para qué | Dónde en el código | Datos que viajan |
|---|---|---|---|
| **FormSubmit** (formsubmit.co) | Recibir los formularios y enviarlos por email a `hello@teamsolub.com` (vía código alias, el email no aparece en el formulario) | `index.html`, `kitchen.html`, `checkin.html`, `cancel.html` (atributo `action` del `<form>`) | Nombre, email y datos que la persona escribe (datos personales) |
| **jsDelivr** (cdn.jsdelivr.net) | Librerías 3D: `three@0.160.0`, `globe.gl@2.32.2` y mapa de países | `index.html`, `map-globe.html` | Ninguno (solo descarga) |
| **Stripe** (buy.stripe.com) | Pago de los packs del Drop (página de pago alojada por Stripe) | `drop.html` → `DROP_CONFIG.packs[].stripeLink` | Datos de pago: van directo a Stripe, **nunca** pasan por la web |
| **Google Fonts** | Tipografías | Varias páginas | Ninguno (IP del visitante) |
| **Cloudflare Workers + KV** | Guardar dibujos del muro | `worker/` y `const WALL_API` en `kiosko-3d.html` | Dibujo (PNG 160×160) y nombre opcional. **Aún no publicado** (`WALL_API` vacío) |

No hay base de datos propia ni login en esta web. Los pagos del Drop se hacen **en Stripe** (la web solo enlaza); la tarjeta nunca toca solubfood.com.

## 4. Claves y secretos

- **No hay claves en el código.** Así debe seguir siempre.
- El único secreto actual es `ADMIN_KEY` del muro, que se guarda en Cloudflare con `npx wrangler secret put ADMIN_KEY` — **nunca** en un archivo.
- Si en el futuro se agregan claves (APIs, pagos, base de datos), van en los *secrets* del hosting o de GitHub, nunca en el repositorio.

## 5. Cómo se publica un cambio

1. Se hace el cambio en una rama (Claude Code crea `claude/...` automáticamente).
2. Se abre un **Pull Request** hacia `main`.
3. El responsable de seguridad lo revisa y lo aprueba (ver `.github/CODEOWNERS`).
4. Se une a `main` → la web se actualiza sola.
5. Se borra la rama ya unida.

## 6. Futuro: la app

La app de SolubFood tendrá **su propio repositorio** dentro de la organización `SolubFood` (por ejemplo `solub-app` y `solub-backend`), con este mismo esquema: `ARQUITECTURA.md`, `SECURITY.md`, `CODEOWNERS` y `main` protegida.
