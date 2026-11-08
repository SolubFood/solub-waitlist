# Security Policy — SolubFood website

## Reporting a vulnerability

Please **do not open a public issue**. Email **hello@teamsolub.com** with the subject `SECURITY` and a description of the problem. We aim to reply within 5 business days.

## Roles

| Role | Person | Responsibility |
|---|---|---|
| Owner | Benjamín Arévalo Rodríguez | Final decisions, accounts (GitHub, domain, Cloudflare, FormSubmit) |
| Security reviewer | _to be assigned_ | Reviews and approves every Pull Request to `main` |

## Attack surface (see `ARQUITECTURA.md` for the full map)

1. **Static site** (HTML/CSS/JS, no build step) served at solubfood.com.
2. **Four forms** posting personal data to FormSubmit → `hello@teamsolub.com`. Honeypot field `_honey` present on all four.
3. **Third-party scripts** from jsDelivr (`three@0.160.0`, `globe.gl@2.32.2`) and Google Fonts.
4. **Cloudflare Worker** `worker/wall-worker.js` (community wall, not yet deployed):
   - Public: `GET /marks`, `POST /marks` (strict PNG data-URL validation, 1 per IP per day, CORS limited to solubfood.com).
   - Admin: `/admin` login form → session cookie (`HttpOnly; Secure; SameSite=Strict`, 8 h), constant-time password check, 5 attempts per IP per hour, CSP + `X-Frame-Options: DENY` + `no-store`. Password never in URLs.

## Repository rules

- No secrets in the repository — ever. Use platform secrets (Cloudflare, GitHub Actions).
- `main` is protected: changes only via Pull Request approved by the security reviewer.
- Merged branches are deleted.
- Dependabot alerts and secret scanning enabled.

## Review checklist for the security reviewer

- [ ] Confirm repository visibility decision (private + hosting outside GitHub Pages, see below).
- [ ] Branch protection on `main` (require PR, 1 approval, code-owner review, no force-push).
- [ ] Secret scanning + push protection + Dependabot alerts enabled.
- [x] Replace the plain email in FormSubmit `action` URLs with the FormSubmit random alias (done; alias delivers to hello@teamsolub.com).
- [ ] Add Subresource Integrity to CDN scripts (verify the served files match first):
  - `three@0.160.0/build/three.min.js` → `sha384-qOkzR5Ke/XkQxuGVJ9hpFEpDlcoLtWwVYhnJf06cLIZa2vaIptSqaubivErzmD5O`
  - `globe.gl@2.32.2/dist/globe.gl.min.js` → `sha384-omA7e/C7sSgm+cS3cQxKAjoJBfEm7k16J89V3IGabhNrgGWk0sNJ0seEY+p5JfG5`
  - add `crossorigin="anonymous"` to both `<script>` tags.
- [ ] Security headers once hosting allows custom headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- [ ] Review `worker/` before first deploy; use a long random `ADMIN_KEY`.
- [ ] Privacy: forms collect personal data — check `privacy.html` matches what is collected and where it goes (FormSubmit, email inbox).
- [ ] 2FA enabled on every account: GitHub, domain registrar, Cloudflare, email inbox.
