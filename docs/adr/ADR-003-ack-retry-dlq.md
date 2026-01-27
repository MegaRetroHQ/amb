# ADR-003: ACK/Retry/DLQ Pattern

**Статус:** Accepted  
**Дата:** 27.01.2026  
**Автор:** Architect Agent  
**Категория:** Reliability

---

## Контекст

Сообщения между AI-агентами должны доставляться надёжно. Агенты могут:
- Быть временно недоступны
- Не успеть обработать сообщение
- Упасть во время обработки

Необходимо гарантировать, что сообщения не потеряются.

## Рассмотренные варианты

### Вариант 1: Fire-and-forget

```
Agent A ──send──> Message Bus ──store──> DB
                                          │
                                    (no tracking)
```

**Плюсы:**
- Простота
- Минимальная латентность

**Минусы:**
- Нет гарантии доставки
- Потеря сообщений при сбоях
- Нет feedback loop

### Вариант 2: Synchronous ACK (request-response)

```
Agent A ──send──> Agent B ──process──> response ──> Agent A
```

**Плюсы:**
- Immediate feedback
- Простая модель

**Минусы:**
- Требует online обоих агентов
- Blocking операции
- Не работает с async workflows

### Вариант 3: At-least-once с ACK/Retry/DLQ

```
┌─────────┐   send    ┌─────────┐   poll    ┌─────────┐
│ Agent A │ ────────> │ Message │ <──────── │ Agent B │
└─────────┘           │   Bus   │           └────┬────┘
                      └────┬────┘                │
                           │                     │ ack
                           │                     │
                      ┌────▼────┐                │
                      │ pending │ <──────────────┘
                      └────┬────┘
                           │
                      timeout?
                           │
                    ┌──────┴──────┐
                    │             │
               retries < MAX   retries >= MAX
                    │             │
                    ▼             ▼
               ┌────────┐    ┌────────┐
               │ retry  │    │  DLQ   │
               └────────┘    └────────┘
```

**Плюсы:**
- Гарантия обработки (at-least-once)
- Асинхронная модель
- Graceful degradation
- Manual intervention для DLQ

**Минусы:**
- Сложнее реализация
- Возможны дубликаты (idempotency needed)
- Требует фоновый worker

### Вариант 4: Exactly-once (distributed transactions)

**Плюсы:**
- Идеальная гарантия

**Минусы:**
- Очень сложная реализация
- Performance overhead
- Overkill для локального использования

## Решение

**Выбран At-least-once с ACK/Retry/DLQ** (Вариант 3)

## Обоснование

1. **Баланс надёжности и сложности** — At-least-once достаточен для локальной разработки, при этом не требует распределённых транзакций.

2. **Асинхронность** — Агенты работают независимо, polling inbox когда готовы.

3. **Graceful degradation** — Если агент временно недоступен, сообщения накапливаются и доставляются позже.

4. **Observability** — DLQ даёт видимость проблем, manual retry позволяет вмешаться.

5. **Простота реализации** — Всё хранится в PostgreSQL, логика в сервисном слое.

## Последствия

### Положительные

- Сообщения не теряются
- Агенты могут работать offline
- Прозрачность через DLQ
- Возможность manual intervention

### Отрицательные

- Возможны дубликаты (требует idempotency в агентах)
- Задержка при retries
- Требует фоновый worker

### Требования к агентам

| Требование | Описание |
|------------|----------|
| **Idempotency** | Агенты должны обрабатывать повторные сообщения корректно |
| **Timely ACK** | ACK должен отправляться после успешной обработки |
| **Error handling** | При ошибке — не отправлять ACK (сообщение будет retried) |

## Имплементация

### Message Status State Machine

```
                    ┌───────────────────────────────────────┐
                    │                                       │
                    ▼                                       │
┌─────────┐    ┌─────────┐    ┌─────────┐           ┌─────────┐
│ pending │───>│delivered│───>│   ack   │           │   dlq   │
└─────────┘    └────┬────┘    └─────────┘           └────▲────┘
     ▲              │                                    │
     │              │ timeout (60s)                      │
     │              │ retries < MAX_RETRIES              │
     │              │                                    │
     └──────────────┘                                    │
                    │                                    │
                    │ timeout (60s)                      │
                    │ retries >= MAX_RETRIES             │
                    └────────────────────────────────────┘
```

### Конфигурация

```typescript
const MAX_RETRIES = 3;           // Максимум попыток
const DELIVERY_TIMEOUT_MS = 60_000; // 1 минута таймаут
const RETENTION_DAYS = 30;       // Хранение DLQ
```

### Inbox Logic

```typescript
export async function getInboxMessages(agentId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Mark pending → delivered
    await tx.message.updateMany({
      where: {
        toAgentId: agentId,
        status: "pending",
      },
      data: {
        status: "delivered",
      },
    });

    // 2. Return all delivered (unacked)
    return tx.message.findMany({
      where: {
        toAgentId: agentId,
        status: "delivered",
      },
      orderBy: { createdAt: "asc" },
    });
  });
}
```

### ACK Logic

```typescript
export async function ackMessage(messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) throw new NotFoundError("Message");
  if (message.status === "ack") return message; // Idempotent
  if (message.status !== "delivered") {
    throw new ConflictError("Message must be delivered before ack");
  }

  return prisma.message.update({
    where: { id: messageId },
    data: { status: "ack" },
  });
}
```

### Retry Worker Logic

```typescript
export async function retryTimedOutMessages() {
  const timeoutThreshold = new Date(Date.now() - DELIVERY_TIMEOUT_MS);

  const timedOut = await prisma.message.findMany({
    where: {
      status: "delivered",
      createdAt: { lt: timeoutThreshold },
    },
  });

  for (const message of timedOut) {
    const newRetries = message.retries + 1;

    if (newRetries >= MAX_RETRIES) {
      // Move to DLQ
      await prisma.message.update({
        where: { id: message.id },
        data: { status: "dlq", retries: newRetries },
      });
    } else {
      // Retry
      await prisma.message.update({
        where: { id: message.id },
        data: { status: "pending", retries: newRetries },
      });
    }
  }
}
```

### DLQ Manual Retry

```typescript
export async function retryDlqMessage(messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (message.status !== "dlq") {
    throw new ConflictError("Message must be in DLQ to retry");
  }

  return prisma.message.update({
    where: { id: messageId },
    data: { status: "pending", retries: 0 },
  });
}
```

## Sequence Diagrams

### Happy Path

```
Agent A              Message Bus              Agent B
   │                      │                      │
   │── sendMessage() ────>│                      │
   │                      │ [pending]            │
   │                      │                      │
   │                      │<── pollInbox() ──────│
   │                      │                      │
   │                      │ [delivered] ────────>│
   │                      │                      │
   │                      │                 process
   │                      │                      │
   │                      │<── ackMessage() ─────│
   │                      │                      │
   │                      │ [ack] ✓              │
```

### Retry Path

```
Agent A              Message Bus              Agent B
   │                      │                      │
   │── sendMessage() ────>│                      │
   │                      │ [pending]            │
   │                      │                      │
   │                      │<── pollInbox() ──────│
   │                      │                      │
   │                      │ [delivered] ────────>│
   │                      │                      │
   │                      │              (agent crashes)
   │                      │                      ✗
   │                      │                      │
   │     ┌─────────────────────────────────────┐ │
   │     │ Retry Worker (after 60s timeout)   │ │
   │     │ retries++ → [pending]              │ │
   │     └─────────────────────────────────────┘ │
   │                      │                      │
   │                      │<── pollInbox() ──────│ (recovered)
   │                      │                      │
   │                      │ [delivered] ────────>│
   │                      │                      │
   │                      │<── ackMessage() ─────│
   │                      │ [ack] ✓              │
```

### DLQ Path

```
Agent A              Message Bus              Agent B
   │                      │                      │
   │── sendMessage() ────>│                      │
   │                      │                      │
   │   (3 retry cycles, agent never acks)       │
   │                      │                      │
   │     ┌─────────────────────────────────────┐ │
   │     │ Retry Worker                        │ │
   │     │ retries >= MAX → [dlq]              │ │
   │     └─────────────────────────────────────┘ │
   │                      │                      │
   │                 Dashboard                   │
   │                      │                      │
   │            (admin sees DLQ)                │
   │            (clicks "Retry")                │
   │                      │                      │
   │     ┌─────────────────────────────────────┐ │
   │     │ retryDlqMessage()                   │ │
   │     │ [dlq] → [pending]                   │ │
   │     └─────────────────────────────────────┘ │
```

## Метрики

| Метрика | Описание | Порог алерта |
|---------|----------|--------------|
| `messages_pending_count` | Сообщения в очереди | > 1000 |
| `messages_dlq_count` | Размер DLQ | > 10 |
| `retry_rate` | Процент retried сообщений | > 5% |
| `delivery_latency_p95` | Время до ACK | > 30s |

## Trade-offs

| Аспект | Выбор | Альтернатива |
|--------|-------|--------------|
| Delivery guarantee | At-least-once | Exactly-once (слишком сложно) |
| Timeout | 60 секунд | Configurable (future) |
| Max retries | 3 | Configurable (future) |
| DLQ retention | 30 дней | Configurable |

## Связанные решения

- [ADR-001: PostgreSQL](./ADR-001-postgresql-database.md) — транзакции для атомарных операций
- [ADR-002: Thread-based Messaging](./ADR-002-thread-messaging.md) — контекст сообщений

---

## История

| Дата | Событие |
|------|---------|
| 27.01.2026 | Решение принято |
