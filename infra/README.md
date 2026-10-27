# Challenge 5: Azure deployment

The TypeScript API and React frontend deploy to Azure Container Apps. The public
nginx frontend proxies `/api/` to the private API over HTTPS. Browser requests
stay on the frontend origin. Images use immutable commit tags in ACR and are
pulled using a managed identity, not registry passwords.

## Disposable demo storage and cost scope

The API uses `/app/api-ts/data/app.db` in its container. **Carts and orders are
lost on API container replacement, restart or deployment.** Each fresh instance
starts with the sample seed data. This behavior was explicitly approved for the
lab after organization policies prevented the proposed account-key Azure Files
mount. No storage policies are changed or bypassed.

The API stays at one replica to avoid independent databases serving different
requests. The frontend can scale to two replicas. Production persistence needs
a separately designed, policy-compliant private-network database.

ACR Basic and Consumption compute limit the footprint.
The approved lab budget is USD 1,000 total; this configuration is not a hard
spending cap. Resources continue to incur charges until stopped or removed.

## One-time identity bootstrap

Run as an identity allowed to create resources and assign roles within the
target resource group. The group must already exist.

```powershell
az deployment group create --subscription <subscription-id> `
  --resource-group <resource-group> --name octocat-bootstrap `
  --template-file infra\bootstrap.bicep `
  --parameters githubSubject='repo:OWNER@OWNER_ID/REPO@REPO_ID:ref:refs/heads/challenge-5-deploy'
```

This defines ACR, an application pull identity with `AcrPull` on that registry,
and a GitHub OIDC deployment identity with `Contributor` only on the resource
group. It grants no role-assignment permissions to the pipeline.

When upgrading apps that still use ACR admin passwords, initially pass
`enableRegistryAdmin=true`. After both apps use managed-identity pulls, rerun the
bootstrap with its default `false` to disable admin access.

Set these GitHub Actions **variables** (identifiers, not credentials):

| Variable | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | Bootstrap `clientId` output |
| `AZURE_TENANT_ID` | Bootstrap `tenantId` output |
| `AZURE_SUBSCRIPTION_ID` | Target subscription ID |
| `AZURE_RESOURCE_GROUP` | Existing resource group |
| `AZURE_LOCATION` | Resource group region |
| `AZURE_ACR_NAME` | Bootstrap `registryName` output |

The federated credential must match the **exact subject claim** printed by the
Azure login action. GitHub repositories using immutable IDs include
`OWNER@OWNER_ID/REPO@REPO_ID`; do not replace that with the older `OWNER/REPO`
format. Update `githubSubject` when moving deployment to `main`.
No client secret is required.

## Repeatable deployment

Run **Deploy Octocat to Azure** from GitHub Actions on the configured branch.
The workflow builds both applications, runs existing API tests, builds and
pushes images, deploys `main.bicep`, waits for the exact new revisions to become
ready, and checks the frontend and proxied API.
No new test files are introduced by this deployment work.

`main.parameters.json` supplies the `octocat`/`lab` resource names; image tags
come from the workflow. The API Docker build context is **`src`**, so the shared
database migrations and seed files are included:

```powershell
docker build -f src\api-ts\Dockerfile -t octocat-api src
docker build -t octocat-frontend src\frontend
```

After deployment, open the workflow summary URL. On `/products`, search by SKU,
filter by supplier, clear the filters, then add an item to the cart and reload.
Page reload retains the cart while the same API instance is running; an API
restart or deployment does not.
