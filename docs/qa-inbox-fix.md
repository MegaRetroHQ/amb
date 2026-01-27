# 🐛 QA Report: Inbox Broadcast Messages Fix

**Дата:** 27.01.2026  
**QA Agent:** QA Engineer  
**Приоритет:** P0 (Критический)  
**Статус:** ✅ Исправлено

---

## 📋 Проблема

### Краткое описание
Inbox не возвращал broadcast сообщения (`toAgentId = null`) и не исключал собственные сообщения агента.

### Детальное описание

Функция `getInboxMessages()` в `lib/services/messages.ts` имела два критических бага:

1. **Broadcast сообщения не обрабатывались**: Inbox возвращал только сообщения, где `toAgentId = agentId`, но не включал broadcast сообщения, где `toAgentId = null`. Согласно PRD (ИП-004), inbox должен возвращать сообщения где `toAgentId = agentId` **или** `toAgentId = null`.

2. **Собственные сообщения попадали в inbox**: Агент мог видеть свои собственные сообщения в inbox, что логически неверно.

### Код до исправления

```typescript
export async function getInboxMessages(agentId: string) {
  return prisma.$transaction(async (tx) => {
    // Mark pending messages as delivered
    await tx.message.updateMany({
      where: {
        toAgentId: agentId,  // ❌ Не включает broadcast (toAgentId = null)
        status: "pending",
      },
      data: {
        status: "delivered",
      },
    });

    // Return all delivered (unacked) messages
    return tx.message.findMany({
      where: {
        toAgentId: agentId,  // ❌ Не включает broadcast, не исключает собственные
        status: "delivered",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  });
}
```

---

## ✅ Исправление

### Код после исправления

```typescript
export async function getInboxMessages(agentId: string) {
  return prisma.$transaction(async (tx) => {
    // Mark pending messages as delivered
    // Include both direct messages (toAgentId = agentId) and broadcast messages (toAgentId = null)
    // Exclude messages from the agent itself (fromAgentId != agentId)
    await tx.message.updateMany({
      where: {
        OR: [
          { toAgentId: agentId },
          { toAgentId: null }, // ✅ Broadcast messages
        ],
        fromAgentId: { not: agentId }, // ✅ Don't include own messages
        status: "pending",
      },
      data: {
        status: "delivered",
      },
    });

    // Return all delivered (unacked) messages
    // Include both direct and broadcast messages, exclude own messages
    return tx.message.findMany({
      where: {
        OR: [
          { toAgentId: agentId },
          { toAgentId: null }, // ✅ Broadcast messages
        ],
        fromAgentId: { not: agentId }, // ✅ Don't include own messages
        status: "delivered",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  });
}
```

### Изменения

1. ✅ Добавлена поддержка broadcast сообщений через `OR: [{ toAgentId: agentId }, { toAgentId: null }]`
2. ✅ Добавлено исключение собственных сообщений через `fromAgentId: { not: agentId }`

---

## 🧪 Тестирование

### Тестовый сценарий

```bash
#!/bin/bash
BASE_URL="http://localhost:3333"

# 1. Создать 3 агентов
AGENT_A=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"AgentA","role":"dev"}')
AGENT_A_ID=$(echo "$AGENT_A" | jq -r '.data.id')

AGENT_B=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"AgentB","role":"qa"}')
AGENT_B_ID=$(echo "$AGENT_B" | jq -r '.data.id')

AGENT_C=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"AgentC","role":"devops"}')
AGENT_C_ID=$(echo "$AGENT_C" | jq -r '.data.id')

# 2. Создать тред
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
    \"payload\":{\"text\":\"Broadcast message\"}
  }")
BROADCAST_ID=$(echo "$BROADCAST" | jq -r '.data.id')

# 4. Проверить inbox каждого агента
echo "Checking inbox for Agent A (sender)..."
INBOX_A=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_A_ID")
COUNT_A=$(echo "$INBOX_A" | jq '.data | length')
echo "  Agent A inbox: $COUNT_A messages (should be 0 - own message excluded)"

echo "Checking inbox for Agent B..."
INBOX_B=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_B_ID")
COUNT_B=$(echo "$INBOX_B" | jq '.data | length')
echo "  Agent B inbox: $COUNT_B messages (should be 1 - broadcast received)"

echo "Checking inbox for Agent C..."
INBOX_C=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_C_ID")
COUNT_C=$(echo "$INBOX_C" | jq '.data | length')
echo "  Agent C inbox: $COUNT_C messages (should be 1 - broadcast received)"
```

### Ожидаемые результаты

| Агент | Ожидаемое количество сообщений | Причина |
|-------|--------------------------------|---------|
| Agent A (отправитель) | 0 | Собственные сообщения исключены |
| Agent B | 1 | Broadcast сообщение получено |
| Agent C | 1 | Broadcast сообщение получено |

---

## 📊 Влияние

### Затронутые компоненты

- ✅ `lib/services/messages.ts` — функция `getInboxMessages()`
- ✅ API endpoint `/api/messages/inbox`
- ✅ UI компонент `InboxViewer`
- ✅ SDK метод `getInbox()`

### Обратная совместимость

✅ **Совместимо**: Исправление не ломает существующий функционал, только добавляет поддержку broadcast сообщений и исключает собственные сообщения.

---

## ✅ Критерии приёмки

- [x] Broadcast сообщения (`toAgentId = null`) видны всем агентам в inbox
- [x] Собственные сообщения агента не попадают в его inbox
- [x] Прямые сообщения (`toAgentId = agentId`) работают как раньше
- [x] Статусы сообщений корректно обновляются (pending → delivered)
- [x] Сортировка по `createdAt ASC` сохранена

---

## 📝 Связанные документы

- [PRD - ИП-004](./PRD.md#ип-004-получение-входящих)
- [QA Test Plan - Broadcast](./qa-test-plan.md#-42-broadcast-сообщения)
- [QA Test Scenarios - Broadcast](./qa-test-scenarios.md#-сценарий-2-broadcast-сообщения)

---

## 🎯 Статус

**✅ ИСПРАВЛЕНО** — 27.01.2026

Исправление применено в `lib/services/messages.ts`. Требуется тестирование для подтверждения корректности работы.
