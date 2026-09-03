# Xtask ML Radar — GitHub Pages + Firebase Spark + GitHub OIDC

Versão sem extensão, sem Firebase Storage, sem Cloud Functions e **sem Service Account JSON**.

## Componentes

- `radar/` — painel em `xtask.shop/radar/`
- `scanner/` — Playwright/Chromium que pesquisa Mercado Livre
- `.github/workflows/ml-radar-scan.yml` — scanner GitHub Actions
- `setup-wif-cloud-shell.sh` — configuração única da autenticação GitHub → Google sem chave
- `firestore.rules` — regras do frontend
- `cloudflare-worker/` — acionador instantâneo opcional

## Autenticação do scanner

O GitHub Actions solicita um token OIDC temporário. O Google Workload Identity Federation aceita apenas execuções originadas do repositório `mat2606/xtask.services` e permite impersonar `github-ml-radar@portifoleo-817ad.iam.gserviceaccount.com`.

Não existe `FIREBASE_SERVICE_ACCOUNT` e não existe arquivo de chave privada no repositório.

Veja `INTEGRAR-XTASK.md`.
