# Getting Started: Agent Message Bus

Пошаговое руководство для разработчиков.

---

## Содержание

1. [Quick Start (5 минут)](#quick-start-5-минут)
2. [Best Practices](#best-practices)
3. [Developer Cookbook](#developer-cookbook)

---

# Quick Start (5 минут)

Запустите систему и отправьте первое сообщение между агентами.

## Шаг 1: Запуск (2 мин)

```bash
# Клонируйте и установите
git clone <repo-url> && cd mcp-message-bus
pnpm install

# Запустите PostgreSQL
docker compose up -d postgres

# Настройте и запустите
cp .env.example .env
pnpm db:migrate
pnpm seed:agents
pnpm dev
```

**Проверка:** Откройте http://localhost:3333 — должен появиться Dashboard.

## Шаг 2: Создайте тред (1 мин)

```bash
curl -X POST http://localhost:3333/api/threads \
  -H "Content-Type: application/json" \
  -d '{"title": "my-first-thread"}'
```

Ответ:
```json
{"id": "uuid-треда", "title": "my-first-thread", "status": "open"}
```

Сохраните `id` треда.

## Шаг 3: Получите ID агента (30 сек)

```bash
curl http://localhost:3333/api/agents | jq '.[0:2]'
```

Ответ (пример):
```json
[
  {"id": "uuid-dev", "name": "Developer", "role": "dev"},
  {"id": "uuid-qa", "name": "QA Engineer", "role": "qa"}
]
```

Сохраните `id` агентов `dev` и `qa`.

## Шаг 4: Отправьте сообщение (1 мин)

```bash
curl -X POST http://localhost:3333/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "<uuid-треда>",
    "fromAgentId": "<uuid-dev>",
    "toAgentId": "<uuid-qa>",
    "payload": {"task": "Review this PR", "pr": 42}
  }'
```

## Шаг 5: Проверьте inbox получателя (30 сек)

```bash
curl "http://localhost:3333/api/messages/inbox?agentId=<uuid-qa>"
```

Вы увидите сообщение со статусом `pending`.

## Шаг 6: Подтвердите получение

```bash
curl -X POST http://localhost:3333/api/messages/<uuid-сообщения>/ack
```

**Готово!** Вы отправили и подтвердили первое сообщение.

---

# Best Practices

Рекомендации для эффективной работы с Agent Message Bus.

## 1. Структура тредов

### ✅ Один тред — одна задача

```
feature-auth-login     ← конкретная фича
bugfix-api-timeout     ← конкретный баг
release-v1.2.0         ← конкретный релиз
```

### ❌ Не делайте так

```
general-discussion     ← слишком широко
dev-tasks              ← слишком абстрактно
```

### Именование тредов

| Тип задачи | Паттерн | Пример |
|------------|---------|--------|
| Фича | `feature-<название>` | `feature-csv-export` |
| Баг | `bugfix-<описание>` | `bugfix-login-timeout` |
| Релиз | `release-v<версия>` | `release-v1.2.0` |
| Инцидент | `incident-<код>` | `incident-2026-01-27-db` |
| Ревью | `review-<тип>-<id>` | `review-pr-142` |

## 2. Адресация сообщений

### Прямое сообщение → конкретному агенту

```json
{
  "toAgentId": "uuid-qa",
  "payload": {"task": "Протестируй endpoint /api/users"}
}
```

### Broadcast → всем в треде

```json
{
  "toAgentId": null,
  "payload": {"announcement": "Релиз отложен на 1 час"}
}
```

### @mentions в payload

```json
{
  "payload": {
    "text": "@dev исправь баг, @qa проверь после фикса",
    "mentions": ["dev", "qa"]
  }
}
```

## 3. Жизненный цикл сообщений

### Всегда подтверждайте обработку

```typescript
for await (const messages of client.pollInbox(agentId)) {
  for (const msg of messages) {
    try {
      await processMessage(msg);      // Обработка
      await client.ackMessage(msg.id); // ACK после успеха
    } catch (error) {
      console.error("Failed:", error);
      // НЕ делаем ack — сообщение останется для retry
    }
  }
}
```

### Мониторьте DLQ

```bash
# Проверяйте периодически
curl http://localhost:3333/api/dlq

# Если есть сообщения — разберитесь с причиной
curl -X POST http://localhost:3333/api/dlq/<id>/retry
```

## 4. Payload структура

### Используйте типизированные payload

```typescript
interface TaskPayload {
  type: "task";
  action: string;
  data: Record<string, unknown>;
  priority?: "low" | "medium" | "high";
}

interface ResponsePayload {
  type: "response";
  parentMessageId: string;
  status: "success" | "error";
  result?: unknown;
  error?: string;
}
```

### Пример: task → response

```json
// Task от orchestrator → dev
{
  "type": "task",
  "action": "implement-feature",
  "data": {"feature": "csv-export", "spec": "..."}
}

// Response от dev → orchestrator
{
  "type": "response",
  "parentMessageId": "uuid-task",
  "status": "success",
  "result": {"files": ["lib/csv.ts", "app/api/export/route.ts"]}
}
```

## 5. Polling стратегии

### Для интерактивной работы

```typescript
// Быстрый polling для UI
client.pollInbox(agentId, { interval: 1000 }); // 1 сек
```

### Для фоновых воркеров

```typescript
// Экономный polling для воркеров
client.pollInbox(agentId, { interval: 5000 }); // 5 сек
```

### Graceful shutdown

```typescript
const controller = new AbortController();

process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());

for await (const msgs of client.pollInbox(agentId, { 
  signal: controller.signal 
})) {
  // ...
}
```

## 6. Закрытие тредов

### Закрывайте завершённые треды

```bash
curl -X PATCH http://localhost:3333/api/threads/<id> \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
```

### Финальное сообщение перед закрытием

```json
{
  "payload": {
    "type": "thread_summary",
    "outcome": "success",
    "summary": "Фича реализована, протестирована, задеплоена",
    "participants": ["po", "architect", "dev", "qa", "devops"]
  }
}
```

---

# Developer Cookbook

Готовые рецепты для типовых задач.

## Рецепт 1: Регистрация и запуск агента

```typescript
import { createClient } from "./lib/sdk";

const client = createClient("http://localhost:3333");

// Регистрация с capabilities
const agent = await client.registerAgent({
  name: "my-custom-agent",
  role: "worker",
  capabilities: {
    languages: ["typescript", "python"],
    tools: ["eslint", "pytest"],
  },
});

console.log("Agent ID:", agent.id);
```

## Рецепт 2: Отправка задачи конкретному агенту

```typescript
// Найти агента по роли
const agents = await client.listAgents();
const devAgent = agents.find(a => a.role === "dev");

// Отправить задачу
await client.sendMessage({
  threadId: "uuid-треда",
  fromAgentId: myAgent.id,
  toAgentId: devAgent.id,
  payload: {
    type: "task",
    action: "fix-bug",
    data: {
      issue: "Login timeout after 30 seconds",
      file: "lib/auth.ts",
      line: 42,
    },
  },
});
```

## Рецепт 3: Слушатель inbox с обработкой по типам

```typescript
async function processMessage(msg: Message) {
  const payload = msg.payload as { type: string; [key: string]: unknown };

  switch (payload.type) {
    case "task":
      await handleTask(payload);
      break;
    case "question":
      await handleQuestion(payload);
      break;
    case "notification":
      console.log("Notification:", payload.text);
      break;
    default:
      console.warn("Unknown type:", payload.type);
  }
}

// Polling loop
for await (const messages of client.pollInbox(agentId)) {
  for (const msg of messages) {
    await processMessage(msg);
    await client.ackMessage(msg.id);
  }
}
```

## Рецепт 4: Workflow с последовательными шагами

```typescript
interface Step {
  agent: string;
  task: string;
}

async function runWorkflow(threadTitle: string, steps: Step[]) {
  const thread = await client.createThread({ title: threadTitle });
  const agents = await client.listAgents();
  const byRole = new Map(agents.map(a => [a.role, a]));

  for (const step of steps) {
    const target = byRole.get(step.agent);
    if (!target) continue;

    await client.sendMessage({
      threadId: thread.id,
      fromAgentId: orchestratorId,
      toAgentId: target.id,
      payload: { type: "task", task: step.task },
    });

    // Опционально: ждать ответа
    // await waitForResponse(thread.id, target.id);
  }

  return thread;
}

// Использование
await runWorkflow("Deploy v1.2", [
  { agent: "dev", task: "Build release" },
  { agent: "qa", task: "Run smoke tests" },
  { agent: "devops", task: "Deploy to production" },
]);
```

## Рецепт 5: Broadcast всем агентам

```typescript
await client.sendMessage({
  threadId: thread.id,
  fromAgentId: orchestrator.id,
  toAgentId: null,  // ← broadcast
  payload: {
    type: "announcement",
    priority: "high",
    text: "Деплой начинается через 5 минут. Не мержьте в main!",
  },
});
```

## Рецепт 6: Ответ на сообщение (threading)

```typescript
// Получили сообщение
const incomingMsg = inbox[0];

// Отвечаем с parentId
await client.sendMessage({
  threadId: incomingMsg.threadId,
  fromAgentId: myAgent.id,
  toAgentId: incomingMsg.fromAgentId,
  parentId: incomingMsg.id,  // ← связь с родительским
  payload: {
    type: "response",
    status: "done",
    result: { /* ... */ },
  },
});
```

## Рецепт 7: Retry из DLQ

```typescript
// Получить все failed сообщения
const dlq = await client.getDLQ();

console.log(`В DLQ: ${dlq.length} сообщений`);

for (const msg of dlq) {
  console.log(`- ${msg.id}: ${msg.retries} попыток, от ${msg.fromAgentId}`);
}

// Retry конкретного
if (dlq.length > 0) {
  await client.retryDLQMessage(dlq[0].id);
}

// Retry всех
await client.retryAllDLQ();
```

## Рецепт 8: Поиск агентов

```typescript
// По имени или роли
const results = await client.searchAgents("dev");
// Вернёт агентов где name или role содержит "dev"
```

## Рецепт 9: Фильтрация тредов по статусу

```typescript
const allThreads = await client.listThreads();

const openThreads = allThreads.filter(t => t.status === "open");
const closedThreads = allThreads.filter(t => t.status === "closed");

console.log(`Open: ${openThreads.length}, Closed: ${closedThreads.length}`);
```

## Рецепт 10: MCP из Cursor

После настройки `.cursor/mcp.json`:

```
# В Cursor чате:

"Создай тред 'bugfix-api' и отправь задачу агенту dev:
 исправить timeout в /api/users"

# AI выполнит:
# 1. create_thread({ title: "bugfix-api" })
# 2. send_message({ threadId: ..., toAgentId: dev, payload: {...} })
```

---

## Что дальше?

| Ресурс | Описание |
|--------|----------|
| [guide-ru.md](./guide-ru.md) | Полное руководство |
| [PRD.md](./PRD.md) | Требования к продукту |
| [examples/](../examples/) | Готовые скрипты |
| http://localhost:3333 | Dashboard UI |

---

*Документация: январь 2026*
