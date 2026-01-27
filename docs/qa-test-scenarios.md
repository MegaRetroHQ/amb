# 🧪 QA Test Scenarios — Практические сценарии

**Версия:** 1.0  
**Дата:** 27.01.2026  
**QA Agent:** QA Engineer

---

## 📋 Быстрый старт

### Подготовка окружения

```bash
# 1. Запустить сервер
pnpm dev

# 2. В другом терминале запустить тесты
./scripts/test-phase3.sh
```

### Базовый URL

```
http://localhost:3333
```

---

## 🔹 Сценарий 1: Happy Path — Полный цикл сообщения

**Цель:** Проверить полный цикл отправки, доставки и подтверждения сообщения

### Шаги

```bash
#!/bin/bash
BASE_URL="http://localhost:3333"

# 1. Создать Agent A
AGENT_A=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"TestAgentA","role":"dev"}')
AGENT_A_ID=$(echo "$AGENT_A" | jq -r '.data.id')
echo "✅ Agent A: $AGENT_A_ID"

# 2. Создать Agent B
AGENT_B=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"TestAgentB","role":"qa"}')
AGENT_B_ID=$(echo "$AGENT_B" | jq -r '.data.id')
echo "✅ Agent B: $AGENT_B_ID"

# 3. Создать Thread
THREAD=$(curl -s -X POST "$BASE_URL/api/threads" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Happy Path Test"}')
THREAD_ID=$(echo "$THREAD" | jq -r '.data.id')
echo "✅ Thread: $THREAD_ID"

# 4. Отправить сообщение A → B
MESSAGE=$(curl -s -X POST "$BASE_URL/api/messages/send" \
  -H 'Content-Type: application/json' \
  -d "{
    \"threadId\":\"$THREAD_ID\",
    \"fromAgentId\":\"$AGENT_A_ID\",
    \"toAgentId\":\"$AGENT_B_ID\",
    \"payload\":{\"text\":\"Hello from Agent A\"}
  }")
MESSAGE_ID=$(echo "$MESSAGE" | jq -r '.data.id')
MESSAGE_STATUS=$(echo "$MESSAGE" | jq -r '.data.status')
echo "✅ Message sent: $MESSAGE_ID (status: $MESSAGE_STATUS)"

# 5. Проверить inbox Agent B (pending → delivered)
INBOX=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_B_ID")
INBOX_STATUS=$(echo "$INBOX" | jq -r '.data[0].status')
echo "✅ Inbox status: $INBOX_STATUS"

# 6. ACK сообщение
ACK=$(curl -s -X POST "$BASE_URL/api/messages/$MESSAGE_ID/ack")
ACK_STATUS=$(echo "$ACK" | jq -r '.data.status')
echo "✅ ACK status: $ACK_STATUS"

# 7. Проверить inbox после ACK (должен быть пуст)
INBOX_AFTER=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_B_ID")
INBOX_COUNT=$(echo "$INBOX_AFTER" | jq '.data | length')
echo "✅ Inbox after ACK: $INBOX_COUNT messages"
```

### Ожидаемые результаты

| Шаг | Ожидаемый результат |
|-----|---------------------|
| 4 | `status: "pending"` |
| 5 | `status: "delivered"` |
| 6 | `status: "ack"` |
| 7 | `inbox: []` (пустой) |

---

## 🔹 Сценарий 2: Broadcast сообщения

**Цель:** Проверить широковещательную рассылку (`toAgentId: null`)

### Шаги

```bash
#!/bin/bash
BASE_URL="http://localhost:3333"

# 1. Создать 3 агентов
AGENT_A=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"BroadcastAgentA","role":"dev"}')
AGENT_A_ID=$(echo "$AGENT_A" | jq -r '.data.id')

AGENT_B=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"BroadcastAgentB","role":"qa"}')
AGENT_B_ID=$(echo "$AGENT_B" | jq -r '.data.id')

AGENT_C=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"BroadcastAgentC","role":"devops"}')
AGENT_C_ID=$(echo "$AGENT_C" | jq -r '.data.id')

# 2. Создать Thread
THREAD=$(curl -s -X POST "$BASE_URL/api/threads" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Broadcast Test"}')
THREAD_ID=$(echo "$THREAD" | jq -r '.data.id')

# 3. Отправить broadcast сообщение (toAgentId: null)
BROADCAST=$(curl -s -X POST "$BASE_URL/api/messages/send" \
  -H 'Content-Type: application/json' \
  -d "{
    \"threadId\":\"$THREAD_ID\",
    \"fromAgentId\":\"$AGENT_A_ID\",
    \"toAgentId\":null,
    \"payload\":{\"text\":\"Broadcast message to all\"}
  }")
BROADCAST_ID=$(echo "$BROADCAST" | jq -r '.data.id')
echo "✅ Broadcast message: $BROADCAST_ID"

# 4. Проверить inbox каждого агента
echo "Checking inbox for Agent A..."
INBOX_A=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_A_ID")
COUNT_A=$(echo "$INBOX_A" | jq '.data | length')
echo "  Agent A inbox: $COUNT_A messages"

echo "Checking inbox for Agent B..."
INBOX_B=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_B_ID")
COUNT_B=$(echo "$INBOX_B" | jq '.data | length')
echo "  Agent B inbox: $COUNT_B messages"

echo "Checking inbox for Agent C..."
INBOX_C=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_C_ID")
COUNT_C=$(echo "$INBOX_C" | jq '.data | length')
echo "  Agent C inbox: $COUNT_C messages"
```

### Ожидаемые результаты

| Агент | Ожидаемое количество сообщений |
|-------|--------------------------------|
| Agent A | 1 |
| Agent B | 1 |
| Agent C | 1 |

---

## 🔹 Сценарий 3: Ответы на сообщения (Replies)

**Цель:** Проверить цепочку ответов через `parentId`

### Шаги

```bash
#!/bin/bash
BASE_URL="http://localhost:3333"

# 1. Создать агентов и тред
AGENT_A=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"ReplyAgentA","role":"dev"}')
AGENT_A_ID=$(echo "$AGENT_A" | jq -r '.data.id')

AGENT_B=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"ReplyAgentB","role":"qa"}')
AGENT_B_ID=$(echo "$AGENT_B" | jq -r '.data.id')

THREAD=$(curl -s -X POST "$BASE_URL/api/threads" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Reply Test"}')
THREAD_ID=$(echo "$THREAD" | jq -r '.data.id')

# 2. Отправить первое сообщение A → B
MESSAGE1=$(curl -s -X POST "$BASE_URL/api/messages/send" \
  -H 'Content-Type: application/json' \
  -d "{
    \"threadId\":\"$THREAD_ID\",
    \"fromAgentId\":\"$AGENT_A_ID\",
    \"toAgentId\":\"$AGENT_B_ID\",
    \"payload\":{\"text\":\"Original message\"}
  }")
MESSAGE1_ID=$(echo "$MESSAGE1" | jq -r '.data.id')
echo "✅ Original message: $MESSAGE1_ID"

# 3. Получить inbox и ACK
INBOX=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_B_ID")
curl -s -X POST "$BASE_URL/api/messages/$MESSAGE1_ID/ack" > /dev/null

# 4. Ответить на сообщение (B → A, parentId = MESSAGE1_ID)
REPLY=$(curl -s -X POST "$BASE_URL/api/messages/send" \
  -H 'Content-Type: application/json' \
  -d "{
    \"threadId\":\"$THREAD_ID\",
    \"fromAgentId\":\"$AGENT_B_ID\",
    \"toAgentId\":\"$AGENT_A_ID\",
    \"parentId\":\"$MESSAGE1_ID\",
    \"payload\":{\"text\":\"Reply to original\"}
  }")
REPLY_ID=$(echo "$REPLY" | jq -r '.data.id')
REPLY_PARENT=$(echo "$REPLY" | jq -r '.data.parentId')
echo "✅ Reply: $REPLY_ID (parent: $REPLY_PARENT)"

# 5. Получить все сообщения треда
THREAD_MESSAGES=$(curl -s "$BASE_URL/api/threads/$THREAD_ID/messages")
MESSAGE_COUNT=$(echo "$THREAD_MESSAGES" | jq '.data | length')
echo "✅ Thread messages: $MESSAGE_COUNT"
```

### Ожидаемые результаты

| Проверка | Ожидаемый результат |
|----------|---------------------|
| `parentId` reply | Должен быть равен `MESSAGE1_ID` |
| Количество сообщений в треде | 2 |
| Порядок сообщений | Хронологический (ASC) |

---

## 🔹 Сценарий 4: Retry и DLQ

**Цель:** Проверить механизм повторов и Dead Letter Queue

### Шаги

```bash
#!/bin/bash
BASE_URL="http://localhost:3333"

# 1. Создать агентов и тред
AGENT_A=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"RetryAgentA","role":"dev"}')
AGENT_A_ID=$(echo "$AGENT_A" | jq -r '.data.id')

AGENT_B=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"RetryAgentB","role":"qa"}')
AGENT_B_ID=$(echo "$AGENT_B" | jq -r '.data.id')

THREAD=$(curl -s -X POST "$BASE_URL/api/threads" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Retry Test"}')
THREAD_ID=$(echo "$THREAD" | jq -r '.data.id')

# 2. Отправить сообщение A → B
MESSAGE=$(curl -s -X POST "$BASE_URL/api/messages/send" \
  -H 'Content-Type: application/json' \
  -d "{
    \"threadId\":\"$THREAD_ID\",
    \"fromAgentId\":\"$AGENT_A_ID\",
    \"toAgentId\":\"$AGENT_B_ID\",
    \"payload\":{\"text\":\"Message for retry test\"}
  }")
MESSAGE_ID=$(echo "$MESSAGE" | jq -r '.data.id')
echo "✅ Message sent: $MESSAGE_ID"

# 3. Получить inbox (pending → delivered)
INBOX=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_B_ID")
STATUS=$(echo "$INBOX" | jq -r '.data[0].status')
echo "✅ Status after inbox: $STATUS"

# 4. НЕ делать ACK, подождать > 1 минуты
echo "⏳ Waiting 65 seconds for timeout..."
sleep 65

# 5. Запустить retry worker (вручную или через API)
# pnpm worker:retry
# Или симулировать через прямой вызов функции

# 6. Проверить статус сообщения
MESSAGE_CHECK=$(curl -s "$BASE_URL/api/threads/$THREAD_ID/messages")
RETRIES=$(echo "$MESSAGE_CHECK" | jq -r '.data[0].retries')
STATUS_AFTER=$(echo "$MESSAGE_CHECK" | jq -r '.data[0].status')
echo "✅ Status after retry: $STATUS_AFTER, retries: $RETRIES"

# 7. Повторить 3 раза, проверить DLQ
# После 3 повторов сообщение должно быть в DLQ
DLQ=$(curl -s "$BASE_URL/api/dlq")
DLQ_COUNT=$(echo "$DLQ" | jq '.data | length')
echo "✅ DLQ messages: $DLQ_COUNT"

# 8. Retry из DLQ
if [ "$DLQ_COUNT" -gt 0 ]; then
  DLQ_MESSAGE_ID=$(echo "$DLQ" | jq -r '.data[0].id')
  RETRY_DLQ=$(curl -s -X POST "$BASE_URL/api/dlq/$DLQ_MESSAGE_ID/retry")
  RETRY_STATUS=$(echo "$RETRY_DLQ" | jq -r '.data.status')
  RETRY_RETRIES=$(echo "$RETRY_DLQ" | jq -r '.data.retries')
  echo "✅ Retry from DLQ: status=$RETRY_STATUS, retries=$RETRY_RETRIES"
fi
```

### Ожидаемые результаты

| Шаг | Ожидаемый результат |
|-----|---------------------|
| 3 | `status: "delivered"` |
| 6 | `status: "pending"`, `retries: 1` (после первого retry) |
| 7 | После 3 повторов: `status: "dlq"`, `retries: 3` |
| 8 | После retry из DLQ: `status: "pending"`, `retries: 0` |

---

## 🔹 Сценарий 5: Граничные случаи — Валидация

**Цель:** Проверить обработку невалидных входных данных

### Тесты

```bash
#!/bin/bash
BASE_URL="http://localhost:3333"

# 1. Создать агента без name (должна быть ошибка)
echo "Test 1: Missing name"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"role":"dev"}')
ERROR_CODE=$(echo "$RESPONSE" | jq -r '.error.code')
echo "  Expected: invalid_params, Got: $ERROR_CODE"

# 2. Создать агента без role (должна быть ошибка)
echo "Test 2: Missing role"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"TestAgent"}')
ERROR_CODE=$(echo "$RESPONSE" | jq -r '.error.code')
echo "  Expected: invalid_params, Got: $ERROR_CODE"

# 3. Отправить сообщение с несуществующим threadId
echo "Test 3: Non-existent threadId"
FAKE_THREAD_ID="00000000-0000-0000-0000-000000000000"
AGENT=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"TestAgent","role":"dev"}')
AGENT_ID=$(echo "$AGENT" | jq -r '.data.id')

RESPONSE=$(curl -s -X POST "$BASE_URL/api/messages/send" \
  -H 'Content-Type: application/json' \
  -d "{
    \"threadId\":\"$FAKE_THREAD_ID\",
    \"fromAgentId\":\"$AGENT_ID\",
    \"payload\":{\"text\":\"test\"}
  }")
ERROR_CODE=$(echo "$RESPONSE" | jq -r '.error.code')
echo "  Expected: not_found, Got: $ERROR_CODE"

# 4. ACK pending сообщения (должна быть ошибка 409)
echo "Test 4: ACK pending message"
THREAD=$(curl -s -X POST "$BASE_URL/api/threads" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test"}')
THREAD_ID=$(echo "$THREAD" | jq -r '.data.id')

MESSAGE=$(curl -s -X POST "$BASE_URL/api/messages/send" \
  -H 'Content-Type: application/json' \
  -d "{
    \"threadId\":\"$THREAD_ID\",
    \"fromAgentId\":\"$AGENT_ID\",
    \"payload\":{\"text\":\"test\"}
  }")
MESSAGE_ID=$(echo "$MESSAGE" | jq -r '.data.id')

# Попытаться ACK без получения inbox (сообщение все еще pending)
RESPONSE=$(curl -s -X POST "$BASE_URL/api/messages/$MESSAGE_ID/ack")
ERROR_CODE=$(echo "$RESPONSE" | jq -r '.error.code')
echo "  Expected: conflict, Got: $ERROR_CODE"

# 5. ACK несуществующего сообщения (должна быть ошибка 404)
echo "Test 5: ACK non-existent message"
FAKE_MESSAGE_ID="00000000-0000-0000-0000-000000000000"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/messages/$FAKE_MESSAGE_ID/ack")
ERROR_CODE=$(echo "$RESPONSE" | jq -r '.error.code')
echo "  Expected: not_found, Got: $ERROR_CODE"
```

### Ожидаемые результаты

| Тест | Ожидаемый код ошибки |
|------|---------------------|
| 1 | `invalid_params` |
| 2 | `invalid_params` |
| 3 | `not_found` |
| 4 | `conflict` |
| 5 | `not_found` |

---

## 🔹 Сценарий 6: Идемпотентность

**Цель:** Проверить идемпотентность операций

### Тесты

```bash
#!/bin/bash
BASE_URL="http://localhost:3333"

# 1. Двойной ACK (должен быть идемпотентен)
echo "Test 1: Double ACK"
# ... создать сообщение, получить inbox, ACK дважды
# Оба вызова должны быть успешными

# 2. Повторный inbox запрос (должен быть идемпотентен)
echo "Test 2: Repeated inbox fetch"
# ... создать сообщение, получить inbox дважды
# Оба запроса должны возвращать одинаковый результат

# 3. Повторное создание агента с тем же именем
echo "Test 3: Duplicate agent name"
# ... создать агента дважды с одинаковым именем
# Оба должны быть успешными (если разрешено)
```

---

## 🔹 Сценарий 7: UI тестирование

**Цель:** Проверить функциональность дашборда

### Чеклист

- [ ] Открыть `http://localhost:3333`
- [ ] Проверить загрузку всех панелей
- [ ] Создать агента через UI
- [ ] Проверить появление в списке агентов
- [ ] Создать тред через UI
- [ ] Проверить появление в списке тредов
- [ ] Отправить сообщение через UI
- [ ] Проверить появление в треде
- [ ] Выбрать агента и проверить inbox
- [ ] Проверить автоматическое обновление (polling)
- [ ] Нажать ACK на сообщении
- [ ] Проверить исчезновение из inbox
- [ ] Открыть DLQ панель
- [ ] Проверить отображение DLQ сообщений
- [ ] Нажать "Retry" на DLQ сообщении
- [ ] Проверить исчезновение из DLQ

---

## 🔹 Сценарий 8: Производительность

**Цель:** Проверить производительность при нагрузке

### Тесты

```bash
#!/bin/bash
BASE_URL="http://localhost:3333"

# 1. Создать 100 сообщений в одном треде
echo "Test: 100 messages in one thread"
# ... создать тред и 100 сообщений
# Проверить время выполнения

# 2. Получить inbox с 1000 сообщениями
echo "Test: Inbox with 1000 messages"
# ... создать 1000 сообщений
# Проверить время выполнения GET /api/messages/inbox

# 3. 50 агентов одновременно
echo "Test: 50 concurrent agents"
# ... создать 50 агентов
# Проверить стабильность системы
```

---

## 📊 Сводная таблица тестов

| Сценарий | Компонент | Приоритет | Статус |
|----------|-----------|-----------|--------|
| Happy Path | Messages | P0 | ⬜ |
| Broadcast | Messages | P1 | ⬜ |
| Replies | Messages | P1 | ⬜ |
| Retry & DLQ | Retry/DLQ | P0 | ⬜ |
| Валидация | API | P0 | ⬜ |
| Идемпотентность | API | P1 | ⬜ |
| UI | Dashboard | P1 | ⬜ |
| Производительность | Performance | P2 | ⬜ |

---

## 🚀 Автоматизация

### Запуск всех тестов

```bash
# 1. Запустить сервер
pnpm dev

# 2. В другом терминале запустить тесты
chmod +x scripts/test-phase3.sh
./scripts/test-phase3.sh

# 3. Запустить дополнительные сценарии
# (создать скрипты для каждого сценария)
```

### Интеграция в CI/CD

```yaml
# .github/workflows/qa.yml
name: QA Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: docker compose up -d postgres
      - run: pnpm db:migrate
      - run: pnpm dev &
      - run: ./scripts/test-phase3.sh
```

---

## 📝 Примечания

- Все тесты должны выполняться на чистой БД
- Использовать `pnpm reset-db` перед каждым запуском тестов
- Проверять логи на наличие ошибок
- Документировать все найденные баги
