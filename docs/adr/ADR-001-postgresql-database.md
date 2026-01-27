# ADR-001: PostgreSQL as Database

**Статус:** Accepted  
**Дата:** 27.01.2026  
**Автор:** Architect Agent  
**Категория:** Data Layer

---

## Контекст

Agent Message Bus требует надёжного хранилища для:
- Агентов (регистрация, статусы)
- Тредов (организация сообщений)
- Сообщений (с гарантией доставки)

Система работает локально в среде разработки.

## Рассмотренные варианты

### Вариант 1: SQLite

| Критерий | Оценка |
|----------|--------|
| Простота развёртывания | ⭐⭐⭐⭐⭐ |
| Производительность | ⭐⭐⭐ |
| Concurrency | ⭐⭐ |
| Масштабируемость | ⭐ |
| Prisma поддержка | ⭐⭐⭐⭐ |

**Плюсы:**
- Zero configuration
- Single file database
- Нет внешних зависимостей

**Минусы:**
- Write lock (single writer)
- Ограниченная concurrency
- Проблемы с Prisma 7 adapter

### Вариант 2: PostgreSQL

| Критерий | Оценка |
|----------|--------|
| Простота развёртывания | ⭐⭐⭐ |
| Производительность | ⭐⭐⭐⭐⭐ |
| Concurrency | ⭐⭐⭐⭐⭐ |
| Масштабируемость | ⭐⭐⭐⭐⭐ |
| Prisma поддержка | ⭐⭐⭐⭐⭐ |

**Плюсы:**
- Full ACID transactions
- Excellent concurrency (MVCC)
- Native JSON support
- Production-proven
- Full Prisma 7 support with driver adapter

**Минусы:**
- Требует Docker или локальную установку
- Немного сложнее настройка

### Вариант 3: Redis + PostgreSQL

| Критерий | Оценка |
|----------|--------|
| Простота развёртывания | ⭐⭐ |
| Производительность | ⭐⭐⭐⭐⭐ |
| Concurrency | ⭐⭐⭐⭐⭐ |
| Масштабируемость | ⭐⭐⭐⭐⭐ |
| Сложность | ⭐⭐ |

**Плюсы:**
- Очень высокая производительность
- Real-time pub/sub
- Кэширование

**Минусы:**
- Два компонента для управления
- Избыточно для MVP
- Сложнее развёртывание

## Решение

**Выбран PostgreSQL** (Вариант 2)

## Обоснование

1. **Prisma 7 совместимость** — PostgreSQL имеет полную поддержку через `@prisma/adapter-pg`, включая driver adapter для serverless/edge.

2. **Надёжность сообщений** — PostgreSQL гарантирует ACID транзакции, критично для системы с ACK/retry логикой.

3. **JSON поддержка** — Нативный JSONB тип для хранения `payload` сообщений с индексацией.

4. **Concurrency** — MVCC позволяет множественные одновременные операции без блокировок.

5. **Путь к масштабированию** — При необходимости легко добавить реплики, connection pooling.

6. **Docker упрощает развёртывание** — `docker compose up -d postgres` — одна команда.

## Последствия

### Положительные

- Надёжное хранение с полными ACID гарантиями
- Отличная производительность для ~100 msg/sec
- Чёткий путь масштабирования
- Полная Prisma поддержка

### Отрицательные

- Требует Docker или локальную установку PostgreSQL
- Немного большее время первого запуска

### Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Docker недоступен | Низкая | Документация по локальной установке |
| Connection issues | Низкая | Health checks в docker-compose |

## Имплементация

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: messagebus
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

```typescript
// prisma.config.ts
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

export default defineConfig({
  earlyAccess: true,
  schema: "./prisma/schema.prisma",
  migrate: {
    adapter: async () => {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      return new PrismaPg(pool);
    },
  },
});
```

## Связанные решения

- [ADR-003: ACK/Retry/DLQ Pattern](./ADR-003-ack-retry-dlq.md) — использует транзакции PostgreSQL

---

## История

| Дата | Событие |
|------|---------|
| 27.01.2026 | Решение принято |
