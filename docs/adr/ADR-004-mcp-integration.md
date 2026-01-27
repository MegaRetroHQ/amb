# ADR-004: MCP Integration via stdio

**Статус:** Accepted  
**Дата:** 27.01.2026  
**Автор:** Architect Agent  
**Категория:** Integration

---

## Контекст

Agent Message Bus должен интегрироваться с AI-агентами в IDE. Основной целевой IDE — Cursor, который поддерживает Model Context Protocol (MCP) для расширения возможностей AI-ассистентов.

Необходимо определить:
- Как интегрировать Message Bus с Cursor
- Какой транспорт использовать
- Какие операции предоставить

## Рассмотренные варианты

### Вариант 1: Прямые HTTP вызовы из агента

```
┌──────────────┐         HTTP          ┌──────────────┐
│   Cursor     │ ────────────────────> │  Message     │
│   (Claude)   │                       │    Bus       │
└──────────────┘                       └──────────────┘
```

**Плюсы:**
- Простота
- Нет дополнительных компонентов

**Минусы:**
- AI агент должен знать формат API
- Нет structured tools
- Неудобный UX

### Вариант 2: VS Code Extension

```
┌──────────────┐    Extension API     ┌──────────────┐
│   Cursor     │ <──────────────────> │  Extension   │
└──────────────┘                      └──────┬───────┘
                                             │
                                        HTTP │
                                             │
                                      ┌──────▼───────┐
                                      │  Message Bus │
                                      └──────────────┘
```

**Плюсы:**
- Rich UI integration
- Native IDE experience

**Минусы:**
- Сложная разработка
- Отдельный от AI интерфейс
- Требует публикации в marketplace

### Вариант 3: MCP Server (stdio)

```
┌──────────────┐         stdio         ┌──────────────┐
│   Cursor     │ <───────────────────> │  MCP Server  │
│   (Claude)   │                       │              │
└──────────────┘                       └──────┬───────┘
                                             │
                                        HTTP │
                                             │
                                      ┌──────▼───────┐
                                      │  Message Bus │
                                      └──────────────┘
```

**Плюсы:**
- Native Cursor integration
- Structured tools для AI
- Простая конфигурация
- AI "видит" инструменты напрямую

**Минусы:**
- Требует Node.js
- stdio transport ограничен localhost

### Вариант 4: MCP Server (SSE/WebSocket)

**Плюсы:**
- Remote access возможен
- Более гибкий transport

**Минусы:**
- Сложнее настройка
- Не нужен для local-first

## Решение

**Выбран MCP Server с stdio транспортом** (Вариант 3)

## Обоснование

1. **Native Cursor support** — MCP является официальным протоколом для интеграции инструментов в Cursor. AI-агент "видит" инструменты и может их вызывать напрямую.

2. **Structured tools** — Каждая операция описана как tool с типизированными параметрами. AI понимает, что делает каждый инструмент.

3. **Простота для пользователя** — Конфигурация через `.cursor/mcp.json`, запуск автоматический.

4. **Local-first** — stdio идеален для локального использования, не требует сетевой настройки.

5. **Stateless** — MCP сервер stateless, всё состояние в Message Bus API.

## Последствия

### Положительные

- AI-агент в Cursor может напрямую отправлять сообщения, читать inbox
- Пользователь не выходит из IDE
- Типизированные инструменты с описаниями
- Автоматический запуск/остановка

### Отрицательные

- Только localhost (по design)
- Требует Node.js на машине пользователя
- MCP пока не стабилен (возможны breaking changes)

### Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| MCP API changes | Средняя | Версионирование, тесты |
| Cursor не запускает MCP | Низкая | Документация troubleshooting |

## Имплементация

### MCP Server Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Tool Definitions                    │  │
│  │                                                       │  │
│  │  • list_agents      • create_thread                  │  │
│  │  • register_agent   • get_thread                     │  │
│  │  • list_threads     • update_thread                  │  │
│  │  • get_thread_messages                               │  │
│  │  • send_message     • ack_message                    │  │
│  │  • get_inbox        • get_dlq                        │  │
│  │  • close_thread                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Tool Handler                       │  │
│  │                                                       │  │
│  │  switch (toolName) {                                 │  │
│  │    case "list_agents": apiCall("/api/agents");       │  │
│  │    case "send_message": apiCall("/api/messages/.."); │  │
│  │    ...                                               │  │
│  │  }                                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    API Client                         │  │
│  │                                                       │  │
│  │  fetch(`${BASE_URL}${path}`, options)                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Tool Definitions

```typescript
const tools = [
  {
    name: "list_agents",
    description: "List all registered agents in the message bus",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "send_message",
    description: "Send a message to a thread",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread UUID" },
        fromAgentId: { type: "string", description: "Sender agent UUID" },
        toAgentId: { type: "string", description: "Recipient (optional)" },
        payload: { type: "object", description: "Message payload" },
        parentId: { type: "string", description: "Parent message for replies" },
      },
      required: ["threadId", "fromAgentId", "payload"],
    },
  },
  // ... other tools
];
```

### Server Setup

```typescript
const server = new Server(
  {
    name: "message-bus",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await handleTool(name, args);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
});

// Start with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Configuration

**`.cursor/mcp.json`:**
```json
{
  "mcpServers": {
    "message-bus": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "MESSAGE_BUS_URL": "http://localhost:3333"
      }
    }
  }
}
```

### Build Process

```bash
# Build MCP server
cd mcp-server
pnpm install
pnpm build  # tsc → dist/index.js
```

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_agents` | Список всех агентов | — |
| `register_agent` | Регистрация агента | name, role, capabilities? |
| `list_threads` | Список всех тредов | — |
| `create_thread` | Создание треда | title, status? |
| `get_thread` | Получение треда | threadId |
| `update_thread` | Обновление статуса | threadId, status |
| `close_thread` | Закрытие треда | threadId |
| `get_thread_messages` | Сообщения треда | threadId |
| `send_message` | Отправка сообщения | threadId, fromAgentId, payload, toAgentId?, parentId? |
| `get_inbox` | Входящие агента | agentId |
| `ack_message` | Подтверждение | messageId |
| `get_dlq` | Dead letter queue | — |

## Usage Example (Cursor)

```
User: "Send a message to the dev agent about the new feature"

Claude (using MCP):
1. list_agents → finds dev agent (id: "abc-123")
2. list_threads → finds "Feature Discussion" thread (id: "xyz-456")
3. send_message(
     threadId: "xyz-456",
     fromAgentId: "my-agent-id",
     toAgentId: "abc-123",
     payload: { type: "task", text: "Implement the new feature..." }
   )

Result: "Message sent to dev agent in thread 'Feature Discussion'"
```

## Error Handling

```typescript
try {
  const result = await handleTool(name, args);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
} catch (error) {
  return {
    content: [{ type: "text", text: `Error: ${error.message}` }],
    isError: true,
  };
}
```

## Future Enhancements

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| Resources | MCP resources для threads/agents | P2 |
| Prompts | Pre-built prompts для workflows | P3 |
| SSE transport | Remote access | P3 |
| Notifications | Push messages to agent | P2 |

## Связанные решения

- [ADR-002: Thread-based Messaging](./ADR-002-thread-messaging.md) — threads exposed через MCP
- [ADR-003: ACK/Retry/DLQ](./ADR-003-ack-retry-dlq.md) — inbox/ack tools

---

## История

| Дата | Событие |
|------|---------|
| 27.01.2026 | Решение принято |
