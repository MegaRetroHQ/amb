# ADR-002: Thread-based Messaging Model

**Статус:** Accepted  
**Дата:** 27.01.2026  
**Автор:** Architect Agent  
**Категория:** Domain Model

---

## Контекст

AI-агенты обмениваются сообщениями для координации работы. Необходимо определить модель организации этих сообщений:

- Как группировать связанные сообщения?
- Как обеспечить контекст для агентов?
- Как организовать историю коммуникации?

## Рассмотренные варианты

### Вариант 1: Flat Messages (без группировки)

```
┌─────────────────────────────────────────┐
│              Messages                    │
├─────────────────────────────────────────┤
│ [msg1] A → B: "Review PR"               │
│ [msg2] B → A: "Done"                    │
│ [msg3] C → A: "Deploy?"                 │
│ [msg4] A → C: "Yes"                     │
│ [msg5] B → C: "Config issue"            │
└─────────────────────────────────────────┘
```

**Плюсы:**
- Простейшая модель
- Минимум сущностей

**Минусы:**
- Нет контекста между связанными сообщениями
- Сложно отследить conversation flow
- Агенты не видят историю темы

### Вариант 2: Channel-based (как Slack)

```
┌─────────────────────────────────────────┐
│ #general                                │
│ #development                            │
│ #reviews                                │
└─────────────────────────────────────────┘
```

**Плюсы:**
- Знакомая модель (Slack)
- Постоянные каналы

**Минусы:**
- Слишком много контекста (шум)
- Сложно изолировать конкретные задачи
- Не подходит для task-oriented коммуникации

### Вариант 3: Thread-based (как GitHub Issues)

```
┌─────────────────────────────────────────┐
│ Thread: "Implement auth module"         │
├─────────────────────────────────────────┤
│ [msg1] PO → Dev: "Requirements..."      │
│ [msg2] Dev → Arch: "Architecture?"      │
│ [msg3] Arch → Dev: "Use JWT..."         │
│ [msg4] Dev → QA: "Ready for review"     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Thread: "Fix login bug"                 │
├─────────────────────────────────────────┤
│ [msg1] QA → Dev: "Bug report..."        │
│ [msg2] Dev → QA: "Fixed in PR#42"       │
└─────────────────────────────────────────┘
```

**Плюсы:**
- Изоляция контекста по задачам
- Полная история темы
- Можно закрыть завершённые треды
- Агенты получают релевантный контекст

**Минусы:**
- Требует дополнительной сущности (Thread)
- Нужно управлять lifecycle тредов

### Вариант 4: Topic-based Pub/Sub

```
Topics:
  - tasks.created
  - tasks.completed
  - reviews.requested
  - reviews.approved
```

**Плюсы:**
- Loose coupling
- Масштабируемость

**Минусы:**
- Нет истории/контекста
- Сложнее для понимания
- Избыточно для локального использования

## Решение

**Выбран Thread-based подход** (Вариант 3)

## Обоснование

1. **Изоляция контекста** — Каждый тред содержит только релевантные сообщения. Агент, присоединившийся к треду, получает полный контекст задачи.

2. **Task-oriented** — Один тред = одна задача/тема. Это соответствует workflow разработки.

3. **Lifecycle management** — Треды можно открывать, закрывать, архивировать. Это помогает организовать работу.

4. **Observability** — Легко увидеть все сообщения по конкретной теме в Dashboard.

5. **Replies support** — Сообщения могут ссылаться на родительские (parentId), образуя sub-threads внутри треда.

## Последствия

### Положительные

- Чёткая организация коммуникации
- Агенты получают полный контекст темы
- Легко отслеживать прогресс задач
- Поддержка вложенных ответов

### Отрицательные

- Требует создания треда перед отправкой сообщений
- Дополнительная сущность для управления

### Нейтральные

- Обязательность threadId при отправке сообщения
- Необходимость именования тредов

## Модель данных

```prisma
model Thread {
  id        String    @id @default(uuid())
  title     String    // Описательное название
  status    String    @default("open") // open, closed
  createdAt DateTime  @default(now())
  messages  Message[]
}

model Message {
  id          String    @id @default(uuid())
  threadId    String    // FK → Thread (required)
  thread      Thread    @relation(...)
  fromAgentId String
  toAgentId   String?   // null = broadcast
  payload     Json
  parentId    String?   // FK → Message (self-relation)
  // ...
}
```

## Паттерны использования

### Создание рабочего процесса

```typescript
// 1. Создать тред для задачи
const thread = await client.createThread({
  title: "Implement user authentication"
});

// 2. PO отправляет требования
await client.sendMessage({
  threadId: thread.id,
  fromAgentId: poAgent.id,
  toAgentId: devAgent.id,
  payload: { type: "requirements", text: "..." }
});

// 3. Dev отвечает с вопросом
await client.sendMessage({
  threadId: thread.id,
  fromAgentId: devAgent.id,
  toAgentId: archAgent.id,
  payload: { type: "question", text: "Architecture guidance?" }
});

// 4. Тред содержит полный контекст
const messages = await client.getThreadMessages(thread.id);
// → [requirements, question, ...]
```

### Broadcast в треде

```typescript
// Отправка всем участникам треда
await client.sendMessage({
  threadId: thread.id,
  fromAgentId: devAgent.id,
  toAgentId: null, // broadcast
  payload: { type: "announcement", text: "Feature complete!" }
});
```

### Закрытие треда

```typescript
// Задача завершена
await client.updateThread(thread.id, { status: "closed" });
```

## Альтернативы (отвергнуты)

| Альтернатива | Причина отклонения |
|--------------|-------------------|
| Flat messages | Нет контекста |
| Channels | Слишком много шума |
| Pub/Sub | Нет истории |

## Связанные решения

- [ADR-003: ACK/Retry/DLQ Pattern](./ADR-003-ack-retry-dlq.md) — доставка сообщений внутри тредов

---

## История

| Дата | Событие |
|------|---------|
| 27.01.2026 | Решение принято |
