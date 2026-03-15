# Задачи агентов: Epic 4 — Dashboard как продукт

**Обновлено:** 2026-03-15 (Orchestrator). E4-S1…E4-S3 Done. E4-S4 в работе.  
**Тред:** [feature-workflow-epic-4.md](./feature-workflow-epic-4.md)  
**Message Bus:** тред `fb0290b6-57a7-45ea-89c2-7d7af8bae5f8`

**Конвенция:** Frontend (apps/web) — **react-next-engineer**; в payload `area: frontend`. Backend — по запросу.

---

## Frontend (react-next-engineer / Dev)

**Область:** apps/web, Next.js, Dashboard

### ✅ E4-S1 — Next.js Dashboard (apps/web) (Done)

Dashboard component, lib/api/client.ts createClient(baseUrl), app/api/* getApiClient(), без Prisma в web. Evidence: app/[locale]/page.tsx, lib/api/client.ts, api routes.

### ✅ E4-S2 — HTTP клиент к apps/api + JWT (Done)

auth.ts (JWT/cookie, httpOnly set/clear), api/auth/login|logout|session, client.ts token+projectId, http.ts typed helper + ApiHttpError, proxy routes pass token, hooks на typed helper. typecheck pass.

### ✅ E4-S3 — Удалить прямой доступ к БД (Done)

Prisma/@amb-app/db удалены из apps/web; lib/prisma.ts, lib/services/*, prisma.*, scripts (retry-worker, cleanup, reset-db); package.json и root scripts обновлены; Dockerfile без apps/web/prisma. build/typecheck pass.

### Текущая задача: E4-S4 — User authentication flow

**Статус:** In progress | **area:** frontend

**Сделать:**
1. Проверить backend refresh endpoint.
2. Login page + protected dashboard access.
3. Refresh/session-renewal стратегия на текущем API.

**AC:** Login страница; JWT storage (httpOnly cookies); refresh flow.  
**Справочно:** [backlog](./backlog.md) Epic 4.

### Очередь (Frontend)

| Story   | Задача |
|---------|--------|
| E4-S4   | User authentication flow: Login страница, JWT storage (httpOnly cookies), refresh flow |
| E4-S5   | Tenant/Project management UI: список tenant/project, создание/редактирование, переключение контекста |
| E4-S6   | Token management UI: список project tokens, создание, revocation, копирование |

---

## Backend (nest-engineer / Dev)

**Область:** apps/api

API для Epic 4 уже реализован в Epic 2–3 (project-scoped API, JWT, login, project tokens, admin API). Дополнительные изменения в API — **по запросу**.

---

## Architect Agent

**По запросу / блокерам:** структура Dashboard, auth flow, UI для tenant/project/tokens.
