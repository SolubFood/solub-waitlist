# Muro de la comunidad (servidor)

Este servidor guarda los dibujos del muro de la comunidad de `kiosko-3d.html`, para que **todos** vean los dibujos de todos. Mientras no esté publicado, cada persona ve solo sus propios dibujos (se guardan en su navegador).

Usa **Cloudflare Workers + KV**, que es gratis para este uso.

## Cómo publicarlo (una sola vez, ~15 minutos)

1. Crea una cuenta gratis en [cloudflare.com](https://dash.cloudflare.com/sign-up).
2. En una terminal, dentro de esta carpeta `worker/`:
   ```bash
   npx wrangler login
   ```
   ```bash
   npx wrangler kv namespace create WALL
   ```
   Copia el `id` que aparece y pégalo en `wrangler.toml` (donde dice `PASTE_THE_KV_ID_HERE`).
3. Elige una clave secreta para el panel de revisión (solo la saben ustedes):
   ```bash
   npx wrangler secret put ADMIN_KEY
   ```
4. Publica:
   ```bash
   npx wrangler deploy
   ```
   Te da una dirección como `https://solub-wall.<tu-cuenta>.workers.dev`.
5. En `kiosko-3d.html`, pon esa dirección en `const WALL_API = '';` y publica la web.

## Revisar los dibujos

Abre `https://solub-wall.<tu-cuenta>.workers.dev/admin` y escribe tu `ADMIN_KEY` en el campo de contraseña.
Ahí ves los dibujos nuevos y tocas **Approve** (aparece para todos) o **Reject** (se borra).
Un dibujo aprobado no se borra nunca. Usa **Log out** al terminar.

Seguridad del panel:
- La contraseña **nunca va en la URL** (las URLs quedan en el historial y en registros).
- La sesión dura 8 horas, en una cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
- Máximo 5 intentos de contraseña por hora por IP.
- Usa una `ADMIN_KEY` larga y aleatoria (por ejemplo, 24+ caracteres de un gestor de contraseñas).

## Reglas que ya trae

- 1 dibujo por persona al día.
- Cada dibujo es una imagen pequeña (160 × 160 px).
- Solo acepta pedidos desde solubfood.com.
- Solo acepta imágenes PNG válidas (bloquea código escondido en la imagen).
