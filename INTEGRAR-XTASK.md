# ML Radar no xtask.shop — SEM JSON

Esta versão substitui a anterior **nos mesmos caminhos**. Você pode extrair o ZIP e enviar o conteúdo para a raiz do repositório `mat2606/xtask.services`; os arquivos com o mesmo nome são atualizados.

## O que mudou

- Não usa mais `FIREBASE_SERVICE_ACCOUNT`.
- Não cria chave privada JSON.
- GitHub Actions autentica no Google Cloud com OIDC / Workload Identity Federation.
- O scanner usa `@google-cloud/firestore` com Application Default Credentials geradas temporariamente pelo workflow.
- Firebase continua sem Storage e sem Cloud Functions.
- O Radar visual em `radar/` foi preservado.
- A lógica Chromium/Playwright do Mercado Livre foi preservada.

## 1. Substitua os arquivos antigos no GitHub

Extraia o ZIP e envie **o conteúdo inteiro** para a raiz do repositório atual.

Os caminhos importantes são os mesmos:

- `radar/`
- `scanner/`
- `.github/workflows/ml-radar-scan.yml`
- `cloudflare-worker/`
- `firestore.rules`

Não coloque uma pasta externa `xtask-ml-radar-web-v2-sem-json/` dentro do repositório.

O secret antigo `FIREBASE_SERVICE_ACCOUNT`, se você chegou a criar, pode ser apagado depois; esta versão não o lê.

## 2. Configuração única no Google Cloud, sem JSON

Abra o Google Cloud Shell no projeto `portifoleo-817ad` e cole o conteúdo do arquivo:

`setup-wif-cloud-shell.sh`

Ou faça upload desse arquivo no Cloud Shell e execute:

```bash
bash setup-wif-cloud-shell.sh
```

Ele cria:

- Service account `github-ml-radar@portifoleo-817ad.iam.gserviceaccount.com`
- Workload Identity Pool `github`
- Provider `xtask-services`
- Vínculo restrito ao repositório `mat2606/xtask.services`
- Permissão `roles/datastore.user` para o scanner ler/gravar Firestore

**Nenhuma chave privada é criada.**

## 3. Teste

No GitHub:

`Actions → ML Radar Scanner → Run workflow`

O workflow deve passar pela etapa:

`Autenticar no Google Cloud sem JSON`

Depois ele instala o Chromium e executa as filas do Firestore.

Na primeira configuração, permissões IAM podem levar alguns minutos para propagar.

## 4. Site

O site continua em:

`https://xtask.shop/radar/`

A interface continua usando Firebase Web SDK para login e Firestore. Isso não exige chave privada; a `apiKey` web do Firebase não é uma service-account key.

## 5. Cloudflare Worker

O Worker de acionamento imediato continua opcional e não usa a chave JSON do Firebase Admin. Ele valida o ID Token do usuário e dispara o GitHub Actions.

Sem Worker, o botão salva a fila no Firestore e o workflow agendado/manual a processa.
