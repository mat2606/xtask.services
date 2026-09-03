# Integrar no xtask.shop

Esta pasta foi feita para ser COPIADA para o repositório que já publica o `xtask.shop`.

## Estrutura que entra no seu repositório

- `radar/` → página do Radar. Depois do deploy: `https://xtask.shop/radar/`
- `scanner/` → Chromium/Playwright que pesquisa o Mercado Livre no GitHub Actions
- `.github/workflows/ml-radar-scan.yml` → executa o scanner
- `firestore.rules` → regras para publicar no Firebase
- `cloudflare-worker/` → acionador imediato opcional/recomendado

O projeto NÃO usa Firebase Storage e NÃO usa Cloud Functions/Blaze.

## 1. Firebase Spark

No projeto `portifoleo-817ad`:

1. Authentication → Sign-in method → habilite `Email/Password`.
2. Se quiser usar o botão Visitante, habilite também `Anonymous`.
3. Authentication → Settings → Authorized domains → adicione `xtask.shop` (e `www.xtask.shop`, se usar).
4. Crie o Cloud Firestore.
5. Firestore → Rules → cole o conteúdo de `firestore.rules` e publique.

## 2. Secret do GitHub para o scanner

Firebase Console → Project settings → Service accounts → Generate new private key.

No GitHub do Xtask:
`Settings → Secrets and variables → Actions → New repository secret`

Nome:
`FIREBASE_SERVICE_ACCOUNT`

Valor: cole TODO o JSON da chave de serviço.

Nunca coloque esse JSON em arquivo público do repositório.

## 3. Subir os arquivos

Copie `radar/`, `scanner/`, `.github/workflows/ml-radar-scan.yml` e `firestore.rules` para o seu repositório atual.

Se o GitHub Pages já publica o Xtask, não troque o workflow de deploy que você já usa. A pasta `radar` passa a ficar disponível em `/radar/` junto com o restante do site.

## 4. Acionamento imediato (Cloudflare Worker Free)

Sem o Worker, clicar em Varrer já salva a pesquisa no Firestore, mas ela será pega pelo workflow agendado (de hora em hora) ou por `Run workflow` manual.

Com o Worker, o clique em Varrer dispara o GitHub Actions imediatamente.

### Criar PAT do GitHub

Crie um Fine-grained Personal Access Token limitado ao repositório do Xtask com:
- Repository permission: `Contents: Read and write`

### Publicar o Worker

Entre na pasta `cloudflare-worker` e copie `wrangler.toml.example` para `wrangler.toml`.
Preencha `GITHUB_OWNER` e `GITHUB_REPO`.

Depois:

```bash
npm install
npx wrangler login
npx wrangler secret put GITHUB_PAT
npm run deploy
```

O deploy mostra uma URL parecida com:
`https://xtask-ml-radar-trigger.seuusuario.workers.dev`

Cole essa URL em `radar/trigger-config.js`.

## 5. Teste

1. Abra `https://xtask.shop/radar/`
2. Crie sua conta ou entre como visitante.
3. Salve um MLB.
4. Adicione uma palavra-chave.
5. Selecione `1x rápida` e clique `Varrer`.
6. A fila deve mudar: aguardando → pesquisando → concluído.
7. Teste `3x mediana`: o robô abre 3 sessões limpas e salva a mediana para reduzir a oscilação de ranking.

## Como a posição é calculada

O Chromium usa um contexto novo, sem login/cookies da sua conta, com viewport e localização fixos. Ele passa pelos resultados reais do Mercado Livre e diferencia cards marcados como `Ad/Patrocinado/Publicidade`.

- Geral: posição contando todos os cards.
- Orgânico: posição contando somente os cards não patrocinados.
- Ads: posição do anúncio entre os cards pagos, quando ele aparece como publicidade.
- 3x mediana: repete em três sessões limpas e usa a mediana.

Se o anúncio aparecer primeiro como Ad, o scanner continua até encontrar a ocorrência orgânica. Assim as duas métricas não são misturadas.
