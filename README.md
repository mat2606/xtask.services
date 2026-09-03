# Xtask ML Radar Web

Radar de ranking do Mercado Livre para integrar em `xtask.shop/radar/`.

Arquitetura:

- GitHub Pages: interface.
- Firebase Spark: Authentication + Firestore. Sem Storage e sem Cloud Functions.
- GitHub Actions + Playwright/Chromium: scanner real do Mercado Livre.
- Cloudflare Worker Free: ponte segura opcional para disparar o Action imediatamente.

Leia `INTEGRAR-XTASK.md` para instalar.
