# Timeweb Kubernetes deployment for AMB

Target cluster assumptions from the current environment:

- context: `twc-k8scluster`
- namespace: `megaretro`
- ingress class: `nginx`
- cert-manager ClusterIssuer: `letsencrypt-prod`
- existing image pull secret pattern: `timeweb-registry-secret`
- registry pattern: `966b2a59-megaretro-register.registry.twcstorage.ru/megaretro/...`

## Domains

- `amb.megaretro.ru` -> AMB dashboard
- `api.amb.megaretro.ru` -> AMB API

These DNS records must point to the ingress load balancer IPs used by the cluster.

## Required Kubernetes secrets

The deployment expects:

- secret `amb-secrets`
  - `DATABASE_URL`
  - `JWT_SECRET`
- docker-registry secret `timeweb-registry-secret`

## Manual deploy flow

```bash
export AMB_NAMESPACE=megaretro
export AMB_IMAGE_PULL_SECRET=timeweb-registry-secret
export AMB_CLUSTER_ISSUER=letsencrypt-prod
export AMB_BOOTSTRAP=true
export AMB_WEB_HOST=amb.megaretro.ru
export AMB_API_HOST=api.amb.megaretro.ru
export AMB_WEB_TLS_SECRET=amb-megaretro-ru-tls
export AMB_API_TLS_SECRET=api-amb-megaretro-ru-tls
export AMB_API_IMAGE=966b2a59-megaretro-register.registry.twcstorage.ru/megaretro/amb-api:<tag>
export AMB_WEB_IMAGE=966b2a59-megaretro-register.registry.twcstorage.ru/megaretro/amb-web:<tag>
```

Create or update secrets:

```bash
kubectl create secret generic amb-secrets \
  -n "$AMB_NAMESPACE" \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:6432/amb?sslmode=require' \
  --from-literal=JWT_SECRET='replace-with-long-random-secret' \
  --dry-run=client -o yaml | kubectl apply -f -
```

Run migrations:

```bash
kubectl delete job amb-api-migrate -n "$AMB_NAMESPACE" --ignore-not-found
envsubst < deploy/k8s/timeweb/migrate-job.yaml | kubectl apply -n "$AMB_NAMESPACE" -f -
kubectl wait -n "$AMB_NAMESPACE" --for=condition=complete --timeout=300s job/amb-api-migrate
```

Deploy app:

```bash
envsubst < deploy/k8s/timeweb/apply.yaml | kubectl apply -n "$AMB_NAMESPACE" -f -
kubectl rollout status -n "$AMB_NAMESPACE" deployment/amb-api --timeout=300s
kubectl rollout status -n "$AMB_NAMESPACE" deployment/amb-web --timeout=300s
```

Verify:

```bash
kubectl get ingress -n "$AMB_NAMESPACE" amb-api-ingress amb-web-ingress
curl https://api.amb.megaretro.ru/api/health
curl -I https://amb.megaretro.ru
```

## GitHub Actions secrets

Add these repository secrets before enabling the workflow:

- `TWC_KUBECONFIG`
- `TWC_REGISTRY_HOST`
- `TWC_REGISTRY_USERNAME`
- `TWC_REGISTRY_PASSWORD`
- `AMB_DATABASE_URL`
- `AMB_JWT_SECRET`

Optional repository variables:

- `AMB_K8S_NAMESPACE` default `megaretro`
- `AMB_K8S_CLUSTER_ISSUER` default `letsencrypt-prod`
- `AMB_K8S_IMAGE_PULL_SECRET` default `timeweb-registry-secret`
- `AMB_WEB_HOST` default `amb.megaretro.ru`
- `AMB_API_HOST` default `api.amb.megaretro.ru`
- `TWC_REGISTRY_NAMESPACE` default `megaretro`

The workflow builds two images, pushes them to Timeweb Container Registry, updates the registry pull secret in the cluster, runs Prisma migrations, and rolls out both deployments.
