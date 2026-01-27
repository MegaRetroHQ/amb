# Architecture Decision Records (ADR)

Этот каталог содержит записи архитектурных решений (ADR) для проекта Agent Message Bus.

## Что такое ADR?

Architecture Decision Record — документ, фиксирующий важное архитектурное решение вместе с контекстом и последствиями.

## Индекс ADR

| ID | Название | Статус | Категория |
|----|----------|--------|-----------|
| [ADR-001](./ADR-001-postgresql-database.md) | PostgreSQL as Database | Accepted | Data Layer |
| [ADR-002](./ADR-002-thread-messaging.md) | Thread-based Messaging Model | Accepted | Domain Model |
| [ADR-003](./ADR-003-ack-retry-dlq.md) | ACK/Retry/DLQ Pattern | Accepted | Reliability |
| [ADR-004](./ADR-004-mcp-integration.md) | MCP Integration via stdio | Accepted | Integration |

## Статусы

- **Proposed** — решение предложено, обсуждается
- **Accepted** — решение принято и реализовано
- **Deprecated** — решение устарело, есть замена
- **Superseded** — решение заменено другим ADR

## Формат ADR

Каждый ADR содержит:

1. **Контекст** — описание проблемы и обстоятельств
2. **Рассмотренные варианты** — альтернативы с плюсами/минусами
3. **Решение** — выбранный вариант
4. **Обоснование** — почему выбран этот вариант
5. **Последствия** — положительные и отрицательные эффекты

## Как создать новый ADR

1. Скопируйте шаблон:
   ```bash
   cp ADR-000-template.md ADR-XXX-название.md
   ```

2. Заполните все секции

3. Добавьте в индекс выше

4. Создайте PR для review

## Шаблон

```markdown
# ADR-XXX: Название решения

**Статус:** Proposed | Accepted | Deprecated | Superseded  
**Дата:** YYYY-MM-DD  
**Автор:** Имя  
**Категория:** Data Layer | Domain Model | Integration | ...

---

## Контекст

[Описание проблемы и обстоятельств]

## Рассмотренные варианты

### Вариант 1: ...

**Плюсы:**
- ...

**Минусы:**
- ...

### Вариант 2: ...

## Решение

[Выбранный вариант]

## Обоснование

[Почему выбран этот вариант]

## Последствия

### Положительные
- ...

### Отрицательные
- ...

## Связанные решения

- [ADR-XXX](./ADR-XXX.md)

---

## История

| Дата | Событие |
|------|---------|
| YYYY-MM-DD | Решение принято |
```

---

## Ссылки

- [Architecture Documentation](../architecture.md)
- [PRD](../PRD.md)
