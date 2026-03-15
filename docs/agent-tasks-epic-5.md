# Задачи агентов: Epic 5 — Developer Experience

**Обновлено:** 2026-03-16 (Orchestrator)  
**Тред:** [feature-workflow-epic-5.md](./feature-workflow-epic-5.md)  
**Message Bus:** тред `c7a52a0e-fa39-4f05-9109-3fd740c74125`

---

## Dev

**Область:** документация, Docker, SDK-примеры

### ✅ E5-S1 — SDK с JWT поддержкой (Done)

createClient({ baseUrl, token }), Authorization Bearer + x-project-id, MessageBusError: isUnauthorized/isForbidden/isAuthError.

### ✅ E5-S2 — Документация по интеграции (Done)

Сделано:
1. Quick start guide: `docs/integration-guide.md`.
2. API reference: обновлён `docs/api.md` (auth headers + curl).
3. Примеры кода: актуализированы `README.md` и `docs/getting-started.md` под `createClient({ baseUrl, token, projectId })`.

### Очередь

| Story   | Задача |
|---------|--------|
| E5-S3   | Docker Compose: docker compose up запускает DB + API + Web, seed данные (текущая) |
| E5-S4   | Migration guide: v1 → vNext, SDK migration steps, breaking changes |
| E5-S5   | Примеры интеграций: разные языки, best practices, common patterns |

---

## Architect

**По запросу:** структура документации, DX.

## QA

**Queued:** проверка документации (после E5-S2), docker compose up (после E5-S3).
