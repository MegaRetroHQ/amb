# Руководство пользователя: Agent Message Bus

Локальная шина сообщений для оркестрации AI-агентов.

---

## Содержание

1. [Что это такое](#что-это-такое)
2. [Быстрый старт](#быстрый-старт)
3. [Основные концепции](#основные-концепции)
4. [Dashboard UI](#dashboard-ui)
5. [Работа с API](#работа-с-api)
6. [Использование SDK](#использование-sdk)
7. [MCP интеграция](#mcp-интеграция)
8. [Пример Workflow: Разработка фичи с AI-командой](#пример-workflow-разработка-фичи-с-ai-командой)
9. [Интеграция в другой проект](#интеграция-в-другой-проект)
10. [Администрирование](#администрирование)
11. [Устранение неполадок](#устранение-неполадок)

---

## Что это такое

Agent Message Bus — это локальный инструмент разработчика для координации нескольких AI-агентов через потоки сообщений (треды).

### Основные возможности

| Функция | Описание |
|---------|----------|
| Треды | Группировка сообщений по темам/задачам |
| Inbox | Входящие сообщения для каждого агента |
| ACK/Retry | Подтверждение доставки и повторные попытки |
| DLQ | Очередь недоставленных сообщений |
| TypeScript SDK | Программный доступ к API |
| MCP Server | Интеграция с Cursor и другими IDE |
| Dashboard | Веб-интерфейс для мониторинга |

### Технологии

- **Backend**: Next.js App Router
- **База данных**: PostgreSQL + Prisma
- **UI**: shadcn/ui + Tailwind CSS
- **Runtime**: Node.js / pnpm

---

## Быстрый старт

### Требования

- Node.js 18+
- pnpm
- PostgreSQL (локальный или Docker)

### Установка

```bash
# 1. Клонируйте репозиторий
git clone <repo-url>
cd mcp-message-bus

# 2. Установите зависимости
pnpm install

# 3. Настройте переменные окружения
cp .env.example .env
# Отредактируйте DATABASE_URL в .env

# 4. Примените миграции базы данных
pnpm prisma migrate dev

# 5. Добавьте агентов в базу
pnpm seed:agents

# 6. Запустите сервер
pnpm dev
```

### Проверка

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

Вы должны увидеть Dashboard с панелями:
- Agents — список зарегистрированных агентов
- Threads — активные треды
- Messages — сообщения выбранного треда

---

## Основные концепции

### Агенты (Agents)

Агент — это участник системы сообщений. У каждого агента есть:

| Поле | Описание |
|------|----------|
| `id` | Уникальный идентификатор (UUID) |
| `name` | Имя агента |
| `role` | Роль: po, architect, dev, qa, devops, sdk, ux, orchestrator, tech-writer |
| `status` | Статус: online, offline |
| `capabilities` | Дополнительные возможности (JSON) |

### Треды (Threads)

Тред — это поток сообщений по определённой теме или задаче.

| Поле | Описание |
|------|----------|
| `id` | Уникальный идентификатор |
| `title` | Заголовок треда |
| `status` | Статус: open, closed |
| `messages` | Сообщения в треде |

### Сообщения (Messages)

Сообщение — единица коммуникации между агентами.

| Поле | Описание |
|------|----------|
| `id` | Уникальный идентификатор |
| `threadId` | ID треда |
| `fromAgentId` | ID отправителя |
| `toAgentId` | ID получателя (null = broadcast всем) |
| `payload` | Содержимое сообщения (JSON) |
| `status` | pending → delivered → ack / dlq |
| `retries` | Количество попыток доставки |
| `parentId` | ID родительского сообщения (для цепочек) |

### Жизненный цикл сообщения

```
┌─────────┐    получено     ┌───────────┐    подтверждено    ┌─────┐
│ pending │ ──────────────► │ delivered │ ─────────────────► │ ack │
└─────────┘                 └───────────┘                    └─────┘
     │                            │
     │ ошибка/timeout             │ max retries
     ▼                            ▼
┌─────────┐                 ┌─────┐
│  retry  │ ───────────────►│ dlq │
└─────────┘                 └─────┘
```

---

## Dashboard UI

### Панель агентов

- Просмотр всех зарегистрированных агентов
- Статус каждого агента (online/offline)
- Фильтрация по роли

### Панель тредов

- Список активных тредов
- Создание нового треда
- Закрытие/открытие треда
- Количество сообщений

### Панель сообщений

- Просмотр сообщений выбранного треда
- Статус каждого сообщения
- Отправка нового сообщения
- @mentions для адресации конкретному агенту

### Inbox

- Входящие сообщения для выбранного агента
- Подтверждение (ACK) сообщений
- Фильтрация по статусу

### DLQ (Dead Letter Queue)

- Просмотр недоставленных сообщений
- Повторная отправка одного сообщения
- Массовая повторная отправка

---

## Работа с API

### Агенты

```bash
# Список агентов
curl http://localhost:3000/api/agents

# Регистрация нового агента
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "role": "worker"}'

# Поиск агентов по имени
curl "http://localhost:3000/api/agents/search?q=dev"
```

### Треды

```bash
# Список тредов
curl http://localhost:3000/api/threads

# Создание треда
curl -X POST http://localhost:3000/api/threads \
  -H "Content-Type: application/json" \
  -d '{"title": "Новая задача"}'

# Получение треда
curl http://localhost:3000/api/threads/<thread-id>

# Обновление статуса
curl -X PATCH http://localhost:3000/api/threads/<thread-id> \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'

# Удаление треда
curl -X DELETE http://localhost:3000/api/threads/<thread-id>

# Сообщения треда
curl http://localhost:3000/api/threads/<thread-id>/messages
```

### Сообщения

```bash
# Отправка сообщения
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "<thread-id>",
    "fromAgentId": "<agent-id>",
    "toAgentId": "<target-agent-id>",
    "payload": {"text": "Привет!"}
  }'

# Broadcast (всем агентам в треде)
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "<thread-id>",
    "fromAgentId": "<agent-id>",
    "payload": {"text": "Всем привет!"}
  }'

# Inbox агента
curl "http://localhost:3000/api/messages/inbox?agentId=<agent-id>"

# Подтверждение сообщения
curl -X POST http://localhost:3000/api/messages/<message-id>/ack
```

### DLQ

```bash
# Получить очередь недоставленных
curl http://localhost:3000/api/dlq

# Повторить одно сообщение
curl -X POST http://localhost:3000/api/dlq/<message-id>/retry

# Повторить все
curl -X POST http://localhost:3000/api/dlq/retry-all
```

---

## Использование SDK

### Установка

SDK встроен в проект и доступен из `lib/sdk`.

### Базовый пример

```typescript
import { createClient } from "./lib/sdk";

const client = createClient("http://localhost:3000");

async function main() {
  // 1. Регистрация агента
  const agent = await client.registerAgent({
    name: "my-agent",
    role: "worker",
    capabilities: { languages: ["typescript"] },
  });
  console.log("Агент создан:", agent.id);

  // 2. Создание треда
  const thread = await client.createThread({
    title: "Тестовая задача",
  });
  console.log("Тред создан:", thread.id);

  // 3. Отправка сообщения
  const message = await client.sendMessage({
    threadId: thread.id,
    fromAgentId: agent.id,
    payload: {
      type: "task",
      text: "Выполни задачу X",
    },
  });
  console.log("Сообщение отправлено:", message.id);

  // 4. Получение сообщений треда
  const messages = await client.getThreadMessages(thread.id);
  console.log("Сообщений в треде:", messages.length);
}

main();
```

### Polling входящих сообщений

```typescript
import { createClient } from "./lib/sdk";

const client = createClient("http://localhost:3000");

async function listenInbox(agentId: string) {
  console.log(`Слушаю inbox агента ${agentId}...`);

  // pollInbox возвращает AsyncGenerator
  for await (const messages of client.pollInbox(agentId)) {
    for (const msg of messages) {
      console.log("Получено:", msg.payload);

      // Обработка сообщения...

      // Подтверждение
      await client.ackMessage(msg.id);
      console.log("ACK:", msg.id);
    }
  }
}

// Запуск с ID агента
listenInbox("ваш-agent-id");
```

### Работа с DLQ

```typescript
const client = createClient("http://localhost:3000");

// Получить все недоставленные
const dlq = await client.getDLQ();
console.log("В DLQ:", dlq.length, "сообщений");

// Повторить конкретное
if (dlq.length > 0) {
  await client.retryDLQMessage(dlq[0].id);
}

// Повторить все
await client.retryAllDLQ();
```

### Запуск примеров

```bash
# Базовый агент
tsx examples/simple-agent.ts

# Слушатель inbox (укажите agentId)
tsx examples/inbox-listener.ts <agent-id>

# Workflow orchestration
tsx examples/workflow-runner.ts
```

---

## MCP интеграция

MCP (Model Context Protocol) позволяет AI-ассистентам в IDE (Cursor, VS Code) взаимодействовать с Message Bus.

### Сборка MCP-сервера

```bash
cd mcp-server
pnpm install
pnpm build
```

### Настройка в Cursor

Добавьте в `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "message-bus": {
      "command": "node",
      "args": ["/путь/к/mcp-server/dist/index.js"],
      "env": {
        "MESSAGE_BUS_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Доступные MCP-инструменты

| Инструмент | Описание |
|------------|----------|
| `list_agents` | Список всех агентов |
| `register_agent` | Регистрация нового агента |
| `list_threads` | Список тредов |
| `create_thread` | Создание треда |
| `get_thread` | Получение треда по ID |
| `update_thread` | Обновление треда |
| `close_thread` | Закрытие треда |
| `get_thread_messages` | Сообщения треда |
| `send_message` | Отправка сообщения |
| `get_inbox` | Входящие агента |
| `ack_message` | Подтверждение сообщения |
| `get_dlq` | Очередь недоставленных |

### Пример использования в Cursor

После настройки MCP вы можете сказать AI-ассистенту:

> "Создай тред 'Bug fix' и отправь сообщение агенту dev с описанием бага"

Ассистент выполнит нужные MCP-вызовы автоматически.

---

## Пример Workflow: Разработка фичи с AI-командой

Этот раздел демонстрирует идеальный рабочий процесс разработки новой функции с использованием Agent Message Bus и команды AI-агентов в Cursor.

### Сценарий

**Задача:** Добавить функцию экспорта данных в CSV в существующее приложение.

### Участники

| Агент | Роль | Что делает |
|-------|------|------------|
| 👤 **Разработчик** | Человек | Ставит задачу, принимает решения |
| 🎯 **PO** | Product Owner | Формулирует требования |
| 🏗️ **Architect** | Архитектор | Проектирует решение |
| 💻 **Dev** | Разработчик | Пишет код |
| 🧪 **QA** | Тестировщик | Проверяет качество |
| 📝 **Tech-Writer** | Документатор | Пишет документацию |

### Общая схема

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CURSOR IDE                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐                                                   │
│  │  Разработчик │ ──────── "Нужен экспорт в CSV"                   │
│  └──────┬───────┘                                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │              AGENT MESSAGE BUS                            │      │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐            │      │
│  │  │ PO  │  │Arch │  │ Dev │  │ QA  │  │Docs │            │      │
│  │  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘            │      │
│  │     │        │        │        │        │                │      │
│  │     └────────┴────────┴────────┴────────┘                │      │
│  │                    Тред: csv-export                       │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Фаза 1: Постановка задачи

**Разработчик в Cursor вызывает MCP-инструмент:**

```
@message-bus send_message
  тред: csv-export
  от: human
  кому: @po
  текст: "Нужна функция экспорта таблицы пользователей в CSV. 
         Кнопка в UI, скачивание файла."
```

**PO получает сообщение и формулирует требования:**

```
📥 Входящее от human:
"Нужна функция экспорта таблицы пользователей в CSV..."

📤 Ответ PO → тред csv-export:

## Требования: Экспорт в CSV

### Пользовательская история
Как администратор, я хочу экспортировать список пользователей в CSV,
чтобы анализировать данные в Excel.

### Критерии приёмки
- [ ] Кнопка "Экспорт CSV" на странице /users
- [ ] Скачивается файл users_YYYY-MM-DD.csv
- [ ] Колонки: id, name, email, createdAt
- [ ] Кодировка UTF-8 с BOM для Excel

### Вопросы к @architect
- Генерировать на клиенте или сервере?
- Ограничение по количеству записей?
```

---

### Фаза 2: Архитектурное решение

**Architect получает упоминание и проектирует решение:**

```
📥 Входящее: упоминание от PO

📤 Ответ Architect → тред csv-export:

## Архитектурное решение

### Подход: Серверная генерация

**Причины:**
1. Не грузим браузер большими данными
2. Единая логика форматирования
3. Можно добавить стриминг для больших файлов

### Компоненты

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Button    │ ──> │ API Route   │ ──> │  Prisma     │
│  (UI)       │     │ /api/export │     │  Query      │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  CSV File   │
                    │  (stream)   │
                    └─────────────┘

### Файлы для изменения
1. `app/api/users/export/route.ts` — новый endpoint
2. `components/UsersTable.tsx` — добавить кнопку
3. `lib/csv.ts` — утилита генерации CSV

### Ограничения
- Максимум 10 000 записей за раз
- Таймаут 30 секунд

@dev — можешь начинать реализацию
@qa — подготовь тест-кейсы
```

---

### Фаза 3: Реализация

**Dev получает задачу и последовательно сообщает о прогрессе:**

```
📥 Входящее: упоминание от Architect

📤 Сообщения Dev → тред csv-export:

### Прогресс реализации

**[10:15]** Создал `lib/csv.ts`:
- функция `generateCSV(data, columns)`
- поддержка UTF-8 BOM
- экранирование спецсимволов

**[10:30]** Создал `app/api/users/export/route.ts`:
- GET endpoint
- стриминг через ReadableStream
- заголовки Content-Disposition

**[10:45]** Обновил `components/UsersTable.tsx`:
- кнопка "Экспорт CSV"
- индикатор загрузки
- обработка ошибок

**[11:00]** ✅ Реализация готова

@qa — можно тестировать
Ветка: feature/csv-export
```

---

### Фаза 4: Тестирование

**QA проводит тестирование и сообщает результаты:**

```
📥 Входящее: упоминание от Dev

📤 Сообщения QA → тред csv-export:

### Результаты тестирования

#### ✅ Пройдено
| Тест | Результат |
|------|-----------|
| Кнопка отображается | ✅ |
| Файл скачивается | ✅ |
| Имя файла корректное | ✅ |
| UTF-8 в Excel | ✅ |
| 1000 записей | ✅ |

#### ⚠️ Замечания
| # | Проблема | Критичность |
|---|----------|-------------|
| 1 | Нет валидации пустой таблицы | Средняя |
| 2 | Кнопка активна во время загрузки | Низкая |

@dev — нужен фикс #1 перед релизом
```

---

### Фаза 5: Исправление и документация

**Dev исправляет замечания, Tech-Writer документирует (параллельно):**

```
📤 Dev → тред csv-export:
**[11:30]** Исправил #1 — добавил проверку на пустые данные
@qa — готово к повторной проверке

📤 Tech-Writer → тред csv-export:
### Документация обновлена

Добавлено в docs/features.md:
- Описание функции экспорта
- Скриншот кнопки
- Ограничения (10K записей)

Добавлено в CHANGELOG.md:
- feat: добавлен экспорт пользователей в CSV
```

---

### Фаза 6: Завершение

**QA подтверждает готовность, разработчик закрывает тред:**

```
📤 QA → тред csv-export:
✅ Повторное тестирование пройдено
Готово к релизу

📤 Human → тред csv-export:
Отлично! Мержу в main.
@all — спасибо за работу!

[Тред csv-export закрыт]
```

---

### Визуализация в Dashboard

После завершения workflow вы увидите в Dashboard:

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENT MESSAGE BUS - Dashboard                         localhost│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  АГЕНТЫ                    ТРЕДЫ                               │
│  ┌─────────────────┐      ┌─────────────────────────────────┐  │
│  │ ● po      online│      │ ✓ csv-export        closed  12  │  │
│  │ ● architect  〃 │      │ ○ api-refactor      open     3  │  │
│  │ ● dev        〃 │      │ ○ bug-auth          open     7  │  │
│  │ ● qa         〃 │      └─────────────────────────────────┘  │
│  │ ● tech-writer 〃│                                           │
│  └─────────────────┘      СООБЩЕНИЯ: csv-export               │
│                           ┌─────────────────────────────────┐  │
│  DLQ: 0 сообщений         │ 10:00 human → @po              │  │
│                           │ 10:05 po → тред                 │  │
│                           │ 10:10 architect → тред          │  │
│                           │ 10:15 dev → тред                │  │
│                           │ ...                             │  │
│                           │ 11:45 human → @all ✓            │  │
│                           └─────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### MCP-команды для этого Workflow

```bash
# 1. Создать тред для задачи
@message-bus create_thread title="csv-export"

# 2. Отправить задачу агенту PO
@message-bus send_message threadId="..." fromAgentId="human" toAgentId="po" payload={"text": "Нужен экспорт в CSV"}

# 3. Проверить входящие агента
@message-bus get_inbox agentId="dev"

# 4. Подтвердить получение сообщения
@message-bus ack_message messageId="..."

# 5. Посмотреть всю историю треда
@message-bus get_thread_messages threadId="..."

# 6. Закрыть тред после завершения
@message-bus close_thread threadId="..."
```

---

### Ключевые преимущества этого Workflow

| Аспект | Без Message Bus | С Message Bus |
|--------|-----------------|---------------|
| **Контекст** | Копипаст между чатами | Общий тред для всех |
| **История** | Теряется между сессиями | Сохраняется в БД |
| **Координация** | Ручная, хаотичная | Через @mentions |
| **Наблюдаемость** | Никакой | Dashboard в реальном времени |
| **Параллельность** | Сложно организовать | Dev + Tech-Writer одновременно |
| **Надёжность** | Сообщения теряются | ACK + Retry + DLQ |
| **Трассировка** | Невозможна | Полная история в треде |

---

### Советы для эффективной работы

1. **Один тред — одна задача.** Не смешивайте разные фичи в одном треде.

2. **Используйте @mentions.** Адресуйте сообщения конкретным агентам для ясности.

3. **Подтверждайте получение.** ACK сообщений важен для отслеживания прогресса.

4. **Закрывайте треды.** После завершения задачи закрывайте тред для чистоты.

5. **Параллельная работа.** QA готовит тест-кейсы пока Dev реализует — это нормально.

6. **Мониторьте DLQ.** Если сообщения попадают в DLQ, значит что-то пошло не так.

---

## Интеграция в другой проект

Есть три способа использовать Agent Message Bus в другом проекте:

### Способ 1: Docker сервис (рекомендуется)

Запустите Message Bus как отдельный сервис через Docker и подключайтесь по HTTP API.

**1. Скопируйте docker-compose в ваш проект или запустите отдельно:**

```bash
# Из репозитория mcp-message-bus
docker compose up -d
```

Message Bus будет доступен на `http://localhost:3333`.

**2. Подключайтесь из вашего кода через HTTP:**

```typescript
// Ваш проект - простой HTTP клиент
const MESSAGE_BUS_URL = "http://localhost:3333";

// Список агентов
const agents = await fetch(`${MESSAGE_BUS_URL}/api/agents`).then(r => r.json());

// Регистрация агента
const agent = await fetch(`${MESSAGE_BUS_URL}/api/agents`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "my-service", role: "worker" }),
}).then(r => r.json());

// Отправка сообщения
await fetch(`${MESSAGE_BUS_URL}/api/messages/send`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    threadId: "<thread-id>",
    fromAgentId: agent.data.id,
    payload: { action: "task", data: { ... } },
  }),
});
```

**3. Добавьте в docker-compose вашего проекта:**

```yaml
# docker-compose.yml вашего проекта
services:
  your-app:
    build: .
    environment:
      MESSAGE_BUS_URL: http://messagebus:3333
    depends_on:
      - messagebus

  messagebus:
    image: ghcr.io/your-org/mcp-message-bus:latest  # или build локально
    # Либо build из исходников:
    # build:
    #   context: ./vendor/mcp-message-bus
    #   dockerfile: Dockerfile
    ports:
      - "3333:3333"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/messagebus
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: messagebus
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
```

---

### Способ 2: Копирование SDK

Если вам нужен типизированный клиент, скопируйте SDK в ваш проект.

**1. Скопируйте файлы SDK:**

```bash
# Из корня вашего проекта
mkdir -p lib/message-bus-sdk
cp /path/to/mcp-message-bus/lib/sdk/* lib/message-bus-sdk/
```

**2. Используйте в коде:**

```typescript
import { createClient } from "./lib/message-bus-sdk";

const client = createClient("http://localhost:3333");

// Регистрация агента
const agent = await client.registerAgent({
  name: "my-service",
  role: "worker",
  capabilities: { features: ["process-orders"] },
});

// Создание треда для задачи
const thread = await client.createThread({
  title: "Order Processing #12345",
});

// Отправка сообщения конкретному агенту
await client.sendMessage({
  threadId: thread.id,
  fromAgentId: agent.id,
  toAgentId: "dev",  // адресат
  payload: {
    type: "task",
    action: "review-code",
    data: { pr: 42 },
  },
});

// Polling входящих сообщений
const controller = new AbortController();

for await (const messages of client.pollInbox(agent.id, { signal: controller.signal })) {
  for (const msg of messages) {
    console.log("Получено:", msg.payload);
    
    // Обработка...
    
    // Подтверждение
    await client.ackMessage(msg.id);
  }
}
```

**3. Структура SDK файлов:**

```
lib/message-bus-sdk/
  ├── index.ts      # Экспорты
  ├── client.ts     # MessageBusClient класс
  └── types.ts      # TypeScript типы
```

---

### Способ 3: MCP интеграция в Cursor

Если ваш проект использует Cursor IDE и вы хотите, чтобы AI-агенты могли взаимодействовать с Message Bus.

**1. Соберите MCP-сервер:**

```bash
cd /path/to/mcp-message-bus/mcp-server
pnpm install
pnpm build
```

**2. Добавьте конфигурацию в ваш проект `.cursor/mcp.json`:**

```json
{
  "mcpServers": {
    "message-bus": {
      "command": "node",
      "args": ["/абсолютный/путь/к/mcp-message-bus/mcp-server/dist/index.js"],
      "env": {
        "MESSAGE_BUS_URL": "http://localhost:3333"
      }
    }
  }
}
```

**3. Перезапустите Cursor.**

Теперь AI-ассистент в вашем проекте сможет:
- Создавать треды и сообщения
- Отправлять задачи другим агентам
- Читать inbox и подтверждать сообщения

---

### Пример: Микросервис с Message Bus

```typescript
// services/order-processor.ts
import { createClient } from "./lib/message-bus-sdk";

const AGENT_ID = process.env.AGENT_ID!;
const client = createClient(process.env.MESSAGE_BUS_URL!);

async function main() {
  // Регистрируем сервис как агента (или используем существующего)
  const agent = await client.registerAgent({
    name: "order-processor",
    role: "worker",
  });

  console.log(`Агент ${agent.name} запущен, ID: ${agent.id}`);

  // Бесконечный цикл обработки сообщений
  for await (const messages of client.pollInbox(agent.id)) {
    for (const msg of messages) {
      try {
        await processMessage(msg);
        await client.ackMessage(msg.id);
      } catch (error) {
        console.error("Ошибка обработки:", error);
        // Сообщение останется в inbox для retry
      }
    }
  }
}

async function processMessage(msg: Message) {
  const payload = msg.payload as { type: string; data: unknown };
  
  switch (payload.type) {
    case "process-order":
      // Обработка заказа...
      break;
    case "cancel-order":
      // Отмена заказа...
      break;
    default:
      console.warn("Неизвестный тип:", payload.type);
  }
}

main().catch(console.error);
```

---

### Переменные окружения для интеграции

| Переменная | Описание | Пример |
|------------|----------|--------|
| `MESSAGE_BUS_URL` | URL Message Bus API | `http://localhost:3333` |
| `AGENT_ID` | ID агента (опционально) | UUID |

---

## Администрирование

### Доступные скрипты

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Запуск dev-сервера |
| `pnpm build` | Сборка для production |
| `pnpm seed:agents` | Добавление агентов из registry.json |
| `pnpm seed:threads` | Создание дефолтных тредов |
| `pnpm seed:all` | Агенты + треды |
| `pnpm reset-db` | Полный сброс БД и пересоздание |
| `pnpm worker:retry` | Запуск воркера повторных отправок |
| `pnpm cleanup` | Удаление старых сообщений |
| `pnpm orchestrator` | Запуск оркестратора workflow |
| `pnpm mcp:build` | Сборка MCP-сервера |

### Конфигурация агентов

Агенты определены в `.cursor/agents/registry.json`:

```json
{
  "agents": [
    {
      "id": "dev",
      "name": "Developer",
      "role": "dev",
      "systemPromptFile": ".cursor/agents/dev.md",
      "defaultThreads": ["implementation", "bugfix", "refactor"]
    }
  ],
  "defaults": {
    "threadRetentionDays": 30,
    "maxRetries": 5,
    "pollIntervalSeconds": 5
  }
}
```

### База данных

Подключение настраивается в `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/messagebus"
```

Управление схемой через Prisma:

```bash
# Применить миграции
pnpm prisma migrate dev

# Открыть Prisma Studio
pnpm prisma studio

# Сгенерировать клиент
pnpm prisma generate
```

---

## Устранение неполадок

### Сервер не запускается

1. Проверьте, что PostgreSQL запущен
2. Проверьте `DATABASE_URL` в `.env`
3. Примените миграции: `pnpm prisma migrate dev`

### Агенты не отображаются

```bash
# Проверьте наличие агентов
curl http://localhost:3000/api/agents

# Если пусто, выполните seed
pnpm seed:agents
```

### Сообщения не доставляются

1. Проверьте статус сообщения в UI или через API
2. Посмотрите DLQ: `curl http://localhost:3000/api/dlq`
3. Проверьте логи сервера в терминале

### Ошибки Prisma

```bash
# Пересоздайте клиент
pnpm prisma generate

# Сбросьте БД (осторожно — удалит все данные!)
pnpm reset-db
```

### MCP не работает

1. Убедитесь, что MCP-сервер собран: `pnpm mcp:build`
2. Проверьте путь в `.cursor/mcp.json`
3. Перезапустите Cursor
4. Проверьте, что dev-сервер запущен

---

## Лицензия

MIT

---

*Документация актуальна на январь 2026*
