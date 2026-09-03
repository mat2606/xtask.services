#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="portifoleo-817ad"
PROJECT_NUMBER="491048678096"
REPO="mat2606/xtask.services"
POOL_ID="github"
PROVIDER_ID="xtask-services"
SA_NAME="github-ml-radar"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"
PROVIDER_NAME="${POOL_NAME}/providers/${PROVIDER_ID}"

echo "== ML Radar: configurando GitHub OIDC sem chave JSON =="
gcloud config set project "$PROJECT_ID" >/dev/null

echo "[1/6] Habilitando APIs de identidade..."
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project "$PROJECT_ID"

echo "[2/6] Criando/confirmando conta de serviço dedicada..."
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" \
    --project "$PROJECT_ID" \
    --display-name "GitHub ML Radar"
fi

echo "[3/6] Dando acesso somente ao Firestore..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.user" \
  --condition=None >/dev/null

echo "[4/6] Criando/confirmando Workload Identity Pool..."
if ! gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project "$PROJECT_ID" --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --project "$PROJECT_ID" \
    --location global \
    --display-name "GitHub Actions"
fi

echo "[5/6] Criando/confirmando provider OIDC preso ao repositório ${REPO}..."
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project "$PROJECT_ID" \
  --location global \
  --workload-identity-pool "$POOL_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --project "$PROJECT_ID" \
    --location global \
    --workload-identity-pool "$POOL_ID" \
    --display-name "xtask.services GitHub" \
    --issuer-uri "https://token.actions.githubusercontent.com/" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository=='${REPO}'"
fi

echo "[6/6] Permitindo que somente este repositório impersonifique a conta de serviço..."
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${REPO}" >/dev/null

echo
echo "PRONTO. Nenhuma chave JSON foi criada."
echo "Provider: ${PROVIDER_NAME}"
echo "Service account: ${SA_EMAIL}"
echo
echo "Agora substitua os arquivos no GitHub e rode: Actions -> ML Radar Scanner -> Run workflow."
echo "A propagação do IAM pode levar alguns minutos na primeira vez."
