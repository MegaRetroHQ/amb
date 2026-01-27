# Architecture Documentation
# Agent Message Bus

**Версия:** 1.0  
**Дата:** 27.01.2026  
**Автор:** Architect Agent  
**Статус:** Утверждено

---

## Содержание

1. [Обзор системы](#1-обзор-системы)
2. [Архитектурные принципы](#2-архитектурные-принципы)
3. [Компонентная архитектура](#3-компонентная-архитектура)
4. [Модель данных](#4-модель-данных)
5. [Потоки данных](#5-потоки-данных)
6. [API Design](#6-api-design)
7. [Интеграции](#7-интеграции)
8. [Развёртывание](#8-развёртывание)
9. [Масштабирование](#9-масштабирование)
10. [Безопасность](#10-безопасность)
11. [Мониторинг](#11-мониторинг)
12. [Решения и ADR](#12-решения-и-adr)

---

## 1. Обзор системы

### 1.1 Назначение

Agent Message Bus — локальная шина сообщений для оркестрации AI-агентов в процессе разработки. Система обеспечивает структурированную коммуникацию между агентами через потоки сообщений (threads) с гарантией доставки.

### 1.2 Контекст

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DEVELOPMENT ENVIRONMENT                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Cursor     │  │   Claude     │  │    GPT       │                  │
│  │   (MCP)      │  │   (SDK)      │  │   (SDK)      │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                 │                 │                           │
│         └─────────────────┼─────────────────┘                           │
│                           │                                             │
│                   ┌───────▼───────┐                                     │
│                   │  Agent        │                                     │
│                   │  Message Bus  │                                     │
│                   │               │                                     │
│                   │  ┌─────────┐  │                                     │
│                   │  │ Next.js │  │                                     │
│                   │  │   API   │  │                                     │
│                   │  └────┬────┘  │                                     │
│                   │       │       │                                     │
│                   │  ┌────▼────┐  │                                     │
│                   │  │PostgreSQL│ │                                     │
│                   │  └─────────┘  │                                     │
│                   └───────────────┘                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Ключевые характеристики

| Характеристика | Значение |
|----------------|----------|
| Тип развёртывания | Локальное (local-first) |
| Модель доставки | At-least-once с ACK |
| Протокол | REST API (HTTP/JSON) |
| Персистентность | PostgreSQL |
| Масштаб | Single-instance |

---

## 2. Архитектурные принципы

### 2.1 Основные принципы

| Принцип | Описание | Обоснование |
|---------|----------|-------------|
| **Local-first** | Только локальное развёртывание | Безопасность данных, минимальные зависимости |
| **Simplicity** | Минимум движущихся частей | Простота отладки и эксплуатации |
| **Thread-centric** | Все сообщения в контексте треда | Организация и трассировка |
| **Reliable delivery** | ACK + Retry + DLQ | Гарантия обработки |
| **Schema-less payload** | JSON payload без схемы | Гибкость для разных агентов |

### 2.2 Архитектурный стиль

**Monolithic Modular Architecture**

- Единое Next.js приложение
- Модульная структура сервисов
- Чёткое разделение ответственности

```
┌─────────────────────────────────────────────┐
│              Presentation Layer              │
│  ┌─────────────┐  ┌─────────────────────┐   │
│  │  Dashboard  │  │    REST API         │   │
│  │    (React)  │  │  (App Router)       │   │
│  └─────────────┘  └─────────────────────┘   │
├─────────────────────────────────────────────┤
│               Service Layer                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Agents   │ │ Threads  │ │ Messages │    │
│  │ Service  │ │ Service  │ │ Service  │    │
│  └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────┤
│                Data Layer                    │
│  ┌──────────────────────────────────────┐   │
│  │           Prisma ORM                  │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐    │   │
│  │  │ Agent  │ │ Thread │ │Message │    │   │
│  │  └────────┘ └────────┘ └────────┘    │   │
│  └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│              Storage Layer                   │
│  ┌──────────────────────────────────────┐   │
│  │            PostgreSQL                 │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 2.3 Ограничения (Constraints)

| Constraint | Описание |
|------------|----------|
| Next.js App Router | Фреймворк для API и UI |
| Prisma + PostgreSQL | ORM и база данных |
| Threads mandatory | Все сообщения в тредах |
| Retry worker | Фоновая обработка повторов |
| No auth | Только локальное использование |

---

## 3. Компонентная архитектура

### 3.1 Диаграмма компонентов

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AGENT MESSAGE BUS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      PRESENTATION LAYER                          │   │
│  │                                                                  │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │   │
│  │  │   Dashboard  │    │   REST API   │    │  MCP Server  │       │   │
│  │  │    (React)   │    │ (Next.js)    │    │   (stdio)    │       │   │
│  │  │              │    │              │    │              │       │   │
│  │  │ • AgentsList │    │ /api/agents  │    │ list_agents  │       │   │
│  │  │ • ThreadView │    │ /api/threads │    │ send_message │       │   │
│  │  │ • InboxView  │    │ /api/messages│    │ get_inbox    │       │   │
│  │  │ • DLQViewer  │    │ /api/dlq     │    │ ack_message  │       │   │
│  │  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │   │
│  │         │                   │                   │                │   │
│  └─────────┼───────────────────┼───────────────────┼────────────────┘   │
│            │                   │                   │                    │
│            └───────────────────┼───────────────────┘                    │
│                                │                                        │
│  ┌─────────────────────────────▼───────────────────────────────────┐   │
│  │                       SERVICE LAYER                              │   │
│  │                                                                  │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │   │
│  │  │   Agents     │    │   Threads    │    │   Messages   │       │   │
│  │  │   Service    │    │   Service    │    │   Service    │       │   │
│  │  │              │    │              │    │              │       │   │
│  │  │ • register   │    │ • create     │    │ • send       │       │   │
│  │  │ • list       │    │ • get        │    │ • getInbox   │       │   │
│  │  │ • search     │    │ • update     │    │ • ack        │       │   │
│  │  │              │    │ • delete     │    │ • retry      │       │   │
│  │  │              │    │              │    │ • getDlq     │       │   │
│  │  └──────────────┘    └──────────────┘    └──────────────┘       │   │
│  │                                                                  │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│  ┌─────────────────────────────▼───────────────────────────────────┐   │
│  │                        DATA LAYER                                │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                    Prisma Client                          │   │   │
│  │  │                                                           │   │   │
│  │  │  ┌──────────┐    ┌──────────┐    ┌──────────────┐        │   │   │
│  │  │  │  Agent   │    │  Thread  │    │   Message    │        │   │   │
│  │  │  │  Model   │    │  Model   │    │    Model     │        │   │   │
│  │  │  └──────────┘    └──────────┘    └──────────────┘        │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                         EXTERNAL COMPONENTS                              │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  PostgreSQL  │    │ Retry Worker │    │  TypeScript  │              │
│  │   (Docker)   │    │   (cron)     │    │     SDK      │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Описание компонентов

#### 3.2.1 Dashboard (React)

| Атрибут | Значение |
|---------|----------|
| Технология | React 18 + shadcn/ui |
| Расположение | `app/page.tsx`, `components/dashboard/` |
| Назначение | Визуальный мониторинг и управление |

**Подкомпоненты:**
- `AgentsList` — список агентов со статусами
- `ThreadsList` — список тредов
- `ThreadViewer` — просмотр сообщений в треде
- `InboxViewer` — входящие для выбранного агента
- `DLQViewer` — очередь недоставленных
- `MentionInput` — отправка сообщений с @mentions

#### 3.2.2 REST API (Next.js App Router)

| Атрибут | Значение |
|---------|----------|
| Технология | Next.js 15 App Router |
| Расположение | `app/api/` |
| Назначение | HTTP endpoints для всех операций |

**Endpoints:**
- `/api/agents` — CRUD для агентов
- `/api/threads` — CRUD для тредов
- `/api/messages` — отправка, inbox, ACK
- `/api/dlq` — dead letter queue

#### 3.2.3 MCP Server

| Атрибут | Значение |
|---------|----------|
| Технология | @modelcontextprotocol/sdk |
| Транспорт | stdio |
| Расположение | `mcp-server/` |
| Назначение | Интеграция с Cursor IDE |

**Tools:**
- `list_agents`, `register_agent`
- `list_threads`, `create_thread`, `get_thread`, `update_thread`, `close_thread`
- `get_thread_messages`, `send_message`
- `get_inbox`, `ack_message`
- `get_dlq`

#### 3.2.4 Service Layer

| Сервис | Файл | Ответственность |
|--------|------|-----------------|
| Agents | `lib/services/agents.ts` | Регистрация, поиск агентов |
| Threads | `lib/services/threads.ts` | Управление тредами |
| Messages | `lib/services/messages.ts` | Сообщения, inbox, ACK, DLQ |

#### 3.2.5 TypeScript SDK

| Атрибут | Значение |
|---------|----------|
| Расположение | `lib/sdk/` |
| Назначение | Типизированный клиент для внешних приложений |

**Возможности:**
- Типизированные методы API
- Async iterator для polling inbox
- Автоматический retry

---

## 4. Модель данных

### 4.1 ER-диаграмма

```
┌─────────────────────┐
│       Agent         │
├─────────────────────┤
│ id: UUID (PK)       │
│ name: String        │
│ role: String        │
│ status: String      │
│ capabilities: JSON? │
│ createdAt: DateTime │
│ lastSeen: DateTime? │
└─────────────────────┘

┌─────────────────────┐
│       Thread        │
├─────────────────────┤
│ id: UUID (PK)       │
│ title: String       │
│ status: String      │
│ createdAt: DateTime │
└──────────┬──────────┘
           │
           │ 1:N
           │
┌──────────▼──────────┐
│      Message        │
├─────────────────────┤
│ id: UUID (PK)       │
│ threadId: UUID (FK) │───────────────┐
│ fromAgentId: String │               │
│ toAgentId: String?  │               │
│ payload: JSON       │               │
│ status: String      │               │
│ retries: Int        │               │
│ parentId: UUID? (FK)│───┐           │
│ createdAt: DateTime │   │           │
└─────────────────────┘   │           │
           ▲              │           │
           │              │           │
           └──────────────┘           │
           (self-relation)            │
                                      │
           ┌──────────────────────────┘
           │
           ▼
    ┌─────────────┐
    │   Thread    │
    └─────────────┘
```

### 4.2 Статусы сущностей

#### Agent.status
```
┌────────────┐     online      ┌────────────┐
│  created   │ ──────────────> │   online   │
└────────────┘                 └─────┬──────┘
                                     │
                               timeout│
                                     │
                                     ▼
                               ┌────────────┐
                               │  offline   │
                               └────────────┘
```

#### Thread.status
```
┌────────────┐     close       ┌────────────┐
│    open    │ ──────────────> │   closed   │
└────────────┘                 └────────────┘
```

#### Message.status (State Machine)
```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
┌─────────┐    ┌─────────┐    ┌─────────┐           ┌────┴────┐
│ pending │───>│delivered│───>│   ack   │           │   dlq   │
└─────────┘    └────┬────┘    └─────────┘           └─────────┘
     ▲              │                                    ▲
     │              │ timeout + retry                    │
     │              │ (retries < MAX)                    │
     └──────────────┘                                    │
                    │                                    │
                    │ timeout + retry                    │
                    │ (retries >= MAX)                   │
                    └────────────────────────────────────┘
```

### 4.3 Индексы

| Таблица | Поле | Тип индекса | Назначение |
|---------|------|-------------|------------|
| Message | threadId | B-tree | Выборка сообщений треда |
| Message | toAgentId | B-tree | Inbox query |
| Message | fromAgentId | B-tree | Outbox query |
| Message | status | B-tree | Фильтрация по статусу |
| Message | createdAt | B-tree | Сортировка, retention |

---

## 5. Потоки данных

### 5.1 Отправка сообщения

```
┌─────────┐    POST /messages/send    ┌─────────┐    validate    ┌─────────┐
│  Agent  │ ────────────────────────> │   API   │ ─────────────> │ Service │
│    A    │                           │ Route   │                │  Layer  │
└─────────┘                           └─────────┘                └────┬────┘
                                                                      │
                                                                      │ insert
                                                                      │ status=pending
                                                                      ▼
                                                                ┌──────────┐
                                                                │ PostgreSQL│
                                                                └──────────┘
```

### 5.2 Получение и подтверждение (Inbox + ACK)

```
┌─────────┐  GET /messages/inbox   ┌─────────┐   find pending    ┌──────────┐
│  Agent  │ ────────────────────> │   API   │ ────────────────> │ PostgreSQL│
│    B    │                        │ Route   │                   │          │
└────┬────┘                        └────┬────┘                   │  update  │
     │                                  │                        │  status= │
     │                                  │<─────────messages──────│ delivered│
     │<──────────messages───────────────┘                        └──────────┘
     │
     │ process message
     │
     │  POST /messages/:id/ack
     ├─────────────────────────────────────────────────────────> ┌──────────┐
     │                                                           │ PostgreSQL│
     │                                                           │          │
     │                                                           │  update  │
     │                                                           │  status= │
     │                                                           │   ack    │
     └                                                           └──────────┘
```

### 5.3 Retry Flow

```
┌────────────┐
│   cron     │
│ (1 minute) │
└─────┬──────┘
      │
      │ trigger
      ▼
┌─────────────────┐    find delivered    ┌──────────┐
│  Retry Worker   │ ──────────────────> │ PostgreSQL│
│                 │    older than 60s    │          │
└────────┬────────┘                      └──────────┘
         │
         │ for each message
         ▼
   ┌─────────────────┐
   │ retries < MAX?  │
   └────────┬────────┘
            │
     ┌──────┴──────┐
     │ yes         │ no
     ▼             ▼
┌─────────┐   ┌─────────┐
│ status= │   │ status= │
│ pending │   │   dlq   │
│retries++│   │retries++│
└─────────┘   └─────────┘
```

### 5.4 Полный Message Lifecycle

```
                                    ┌─────────────────────┐
                                    │                     │
    Agent A                         │    Message Bus      │                    Agent B
       │                            │                     │                       │
       │ ── sendMessage() ─────────>│                     │                       │
       │                            │ [pending]           │                       │
       │                            │                     │                       │
       │                            │<── pollInbox() ─────────────────────────────│
       │                            │                     │                       │
       │                            │ [delivered] ────────────────────────────────>│
       │                            │                     │                       │
       │                            │                     │                process│
       │                            │                     │                       │
       │                            │<── ackMessage() ────────────────────────────│
       │                            │                     │                       │
       │                            │ [ack] ✓             │                       │
       │                            │                     │                       │
       │                            └─────────────────────┘                       │

```

---

## 6. API Design

### 6.1 REST API Principles

- **Resource-oriented** — `/api/{resource}`
- **JSON everywhere** — request/response bodies
- **Consistent response format** — `{ data, error, meta }`
- **HTTP status codes** — 200, 201, 400, 404, 409, 500

### 6.2 Response Format

```typescript
// Success response
{
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-27T10:00:00Z"
  }
}

// Error response
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Thread not found"
  }
}
```

### 6.3 Endpoint Summary

| Method | Path | Description | Request Body |
|--------|------|-------------|--------------|
| GET | `/api/agents` | List agents | — |
| POST | `/api/agents` | Register agent | `{name, role, capabilities?}` |
| GET | `/api/agents/search?q=` | Search agents | — |
| GET | `/api/threads` | List threads | — |
| POST | `/api/threads` | Create thread | `{title}` |
| GET | `/api/threads/:id` | Get thread | — |
| PATCH | `/api/threads/:id` | Update thread | `{status}` |
| DELETE | `/api/threads/:id` | Delete thread | — |
| GET | `/api/threads/:id/messages` | Thread messages | — |
| POST | `/api/messages/send` | Send message | `{threadId, fromAgentId, toAgentId?, payload, parentId?}` |
| GET | `/api/messages/inbox?agentId=` | Get inbox | — |
| POST | `/api/messages/:id/ack` | Acknowledge | — |
| GET | `/api/dlq` | Get DLQ | — |
| POST | `/api/dlq/:id/retry` | Retry one | — |
| POST | `/api/dlq/retry-all` | Retry all | — |

---

## 7. Интеграции

### 7.1 MCP (Model Context Protocol)

```
┌───────────────────────────────────────────────────────────────┐
│                        CURSOR IDE                              │
│                                                                │
│  ┌──────────────┐           stdio           ┌──────────────┐  │
│  │   AI Agent   │ <──────────────────────> │  MCP Server  │  │
│  │   (Claude)   │                          │              │  │
│  └──────────────┘                          └──────┬───────┘  │
│                                                   │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    │
                                              HTTP  │
                                                    │
                                            ┌───────▼───────┐
                                            │  Message Bus  │
                                            │   REST API    │
                                            └───────────────┘
```

**Конфигурация** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "message-bus": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "MESSAGE_BUS_URL": "http://localhost:3333"
      }
    }
  }
}
```

### 7.2 TypeScript SDK

```typescript
import { createClient } from "./lib/sdk";

const client = createClient("http://localhost:3333");

// Регистрация
const agent = await client.registerAgent({
  name: "my-agent",
  role: "worker"
});

// Polling
for await (const messages of client.pollInbox(agent.id)) {
  for (const msg of messages) {
    await processMessage(msg);
    await client.ackMessage(msg.id);
  }
}
```

### 7.3 Docker Integration

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: messagebus
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build: .
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/messagebus
```

---

## 8. Развёртывание

### 8.1 Deployment Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    LOCAL MACHINE                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Docker Compose                       │ │
│  │                                                         │ │
│  │  ┌─────────────────┐      ┌─────────────────┐          │ │
│  │  │   PostgreSQL    │      │    Next.js      │          │ │
│  │  │    Container    │      │   Container     │          │ │
│  │  │                 │      │                 │          │ │
│  │  │    Port: 5432   │<────>│   Port: 3333    │          │ │
│  │  │                 │      │                 │          │ │
│  │  └─────────────────┘      └────────┬────────┘          │ │
│  │                                    │                    │ │
│  └────────────────────────────────────┼────────────────────┘ │
│                                       │                      │
│  ┌────────────────────────────────────┼────────────────────┐ │
│  │                    Cursor IDE      │                    │ │
│  │                                    │                    │ │
│  │  ┌─────────────────┐              │                    │ │
│  │  │   MCP Server    │──────────────┘                    │ │
│  │  │    (stdio)      │     HTTP                          │ │
│  │  └─────────────────┘                                   │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...@localhost:5432/messagebus` |
| `PORT` | Server port | `3333` |
| `MESSAGE_BUS_URL` | URL for MCP server | `http://localhost:3333` |

### 8.3 Startup Sequence

```
1. docker compose up -d postgres     # Start PostgreSQL
2. pnpm db:migrate                   # Apply migrations
3. pnpm seed:agents                  # Seed default agents
4. pnpm dev                          # Start Next.js
5. Cursor loads MCP server           # stdio transport
```

---

## 9. Масштабирование

### 9.1 Текущие ограничения

| Метрика | Текущий лимит | Узкое место |
|---------|---------------|-------------|
| Сообщений/сек | ~100 | Single PostgreSQL |
| Агентов | ~50 | Memory |
| Сообщений в треде | ~10,000 | Query performance |
| Размер payload | ~1MB | JSON parsing |

### 9.2 Вертикальное масштабирование

```
┌─────────────────────────────────────────────────────────────┐
│                  CURRENT (Single Instance)                   │
│                                                              │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │   Next.js    │ ─────> │  PostgreSQL  │                   │
│  │   (1 CPU)    │        │   (1 CPU)    │                   │
│  └──────────────┘        └──────────────┘                   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                  SCALED (Vertical)                           │
│                                                              │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │   Next.js    │ ─────> │  PostgreSQL  │                   │
│  │   (4 CPU)    │        │   (8 CPU)    │                   │
│  │  Connection  │        │  + SSD RAID  │                   │
│  │    Pool      │        │  + 32GB RAM  │                   │
│  └──────────────┘        └──────────────┘                   │
│                                                              │
│  Expected: 500-1000 msg/sec                                 │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Горизонтальное масштабирование (Future)

```
┌─────────────────────────────────────────────────────────────┐
│                  SCALED (Horizontal)                         │
│                                                              │
│            ┌──────────────┐                                  │
│            │ Load Balancer│                                  │
│            └──────┬───────┘                                  │
│                   │                                          │
│      ┌────────────┼────────────┐                            │
│      │            │            │                            │
│  ┌───▼───┐   ┌───▼───┐   ┌───▼───┐                         │
│  │Next.js│   │Next.js│   │Next.js│                         │
│  │  #1   │   │  #2   │   │  #3   │                         │
│  └───┬───┘   └───┬───┘   └───┬───┘                         │
│      │           │           │                              │
│      └───────────┼───────────┘                              │
│                  │                                          │
│          ┌───────▼───────┐                                  │
│          │  PostgreSQL   │                                  │
│          │   Primary     │                                  │
│          └───────┬───────┘                                  │
│                  │                                          │
│          ┌───────▼───────┐                                  │
│          │  PostgreSQL   │                                  │
│          │   Replica     │                                  │
│          └───────────────┘                                  │
│                                                              │
│  Expected: 2000-5000 msg/sec                                │
└─────────────────────────────────────────────────────────────┘
```

### 9.4 Путь к WebSocket (Phase 2)

```
┌─────────────────────────────────────────────────────────────┐
│                  REALTIME (WebSocket)                        │
│                                                              │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │    Agent     │<──────>│   Next.js    │                   │
│  │              │   WS   │  + Socket.io │                   │
│  └──────────────┘        └──────┬───────┘                   │
│                                 │                           │
│                          ┌──────▼───────┐                   │
│                          │    Redis     │                   │
│                          │   Pub/Sub    │                   │
│                          └──────┬───────┘                   │
│                                 │                           │
│                          ┌──────▼───────┐                   │
│                          │  PostgreSQL  │                   │
│                          └──────────────┘                   │
│                                                              │
│  Benefits:                                                   │
│  • Real-time updates (no polling)                           │
│  • Lower latency (~10ms vs ~1000ms)                         │
│  • Reduced database load                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Безопасность

### 10.1 Security Model

| Аспект | Текущее состояние | Обоснование |
|--------|-------------------|-------------|
| Аутентификация | Отсутствует | Local-only deployment |
| Авторизация | Отсутствует | Single-user scenario |
| Шифрование в transit | HTTP (не HTTPS) | localhost |
| Шифрование at rest | Нет | Local development |

### 10.2 Рекомендации для production

Если система будет развёрнута не локально:

1. **API Keys** — добавить аутентификацию через API ключи
2. **HTTPS** — TLS для всех соединений
3. **Rate Limiting** — ограничение запросов
4. **Input Validation** — валидация всех входных данных (уже есть через Zod)
5. **Audit Log** — логирование всех операций

---

## 11. Мониторинг

### 11.1 Текущие возможности

| Компонент | Мониторинг |
|-----------|------------|
| Dashboard | Визуальный мониторинг агентов, тредов, DLQ |
| PostgreSQL | `docker compose logs postgres` |
| Next.js | Console logs |
| Retry Worker | Console output |

### 11.2 Рекомендуемые метрики (Future)

| Метрика | Описание | Порог |
|---------|----------|-------|
| `messages_pending_count` | Количество pending сообщений | Alert > 1000 |
| `messages_dlq_count` | Размер DLQ | Alert > 10 |
| `api_latency_p95` | Задержка API | Alert > 500ms |
| `inbox_poll_rate` | Частота polling | Info |

---

## 12. Решения и ADR

### 12.1 Принятые решения

| ADR | Решение | Статус |
|-----|---------|--------|
| ADR-001 | PostgreSQL as Database | Accepted |
| ADR-002 | Thread-based Messaging Model | Accepted |
| ADR-003 | ACK/Retry/DLQ Pattern | Accepted |
| ADR-004 | MCP Integration via stdio | Accepted |

### 12.2 Ссылки на ADR

- [ADR-001: PostgreSQL as Database](./adr/ADR-001-postgresql-database.md)
- [ADR-002: Thread-based Messaging](./adr/ADR-002-thread-messaging.md)
- [ADR-003: ACK/Retry/DLQ Pattern](./adr/ADR-003-ack-retry-dlq.md)
- [ADR-004: MCP Integration](./adr/ADR-004-mcp-integration.md)

---

## Приложения

### A. Технологический стек

| Категория | Технология | Версия |
|-----------|------------|--------|
| Runtime | Node.js | 18+ |
| Framework | Next.js | 15 |
| ORM | Prisma | 7 |
| Database | PostgreSQL | 16 |
| UI | React | 18 |
| Components | shadcn/ui | latest |
| MCP SDK | @modelcontextprotocol/sdk | 1.x |
| Package Manager | pnpm | 8+ |

### B. Структура проекта

```
mcp-message-bus/
├── app/
│   ├── api/              # REST API routes
│   │   ├── agents/
│   │   ├── threads/
│   │   ├── messages/
│   │   └── dlq/
│   ├── page.tsx          # Dashboard
│   └── layout.tsx
├── components/
│   ├── dashboard/        # Dashboard components
│   └── ui/               # shadcn components
├── lib/
│   ├── sdk/              # TypeScript SDK
│   ├── services/         # Business logic
│   ├── hooks/            # React hooks
│   └── prisma.ts         # Prisma client
├── mcp-server/           # MCP server
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/
├── scripts/              # Automation
│   ├── retry-worker.ts
│   ├── orchestrator.ts
│   └── cleanup.ts
└── docs/
    ├── architecture.md   # This document
    └── adr/              # Architecture Decision Records
```

---

## История изменений

| Версия | Дата | Автор | Изменения |
|--------|------|-------|-----------|
| 1.0 | 27.01.2026 | Architect Agent | Первоначальная версия |
