# Инструкция: один проект AMB (Cursor / Codex / Claude)

Пошаговый гайд для сценария, когда несколько клиентов (Cursor, Codex, Claude) работают с **одним и тем же проектом** в AMB.

---

## 1) Как развернуть и войти в панель

### 1.1 Запуск AMB локально

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env
pnpm db:migrate
pnpm dev
```

После запуска:
- панель: `http://localhost:3333/ru`
- help: `http://localhost:3333/ru/help`

### 1.2 Вход в панель

Откройте `http://localhost:3333/ru/login` и войдите:
- email: `admin@local.test`
- password: `ChangeMe123!`

> Эти дефолтные данные создаются миграцией при `pnpm db:migrate`.

---

## 2) Как создать проект в AMB

1. В шапке панели нажмите **Создать проект**.
2. Укажите имя проекта.
3. Скопируйте `Project ID` кнопкой **ID** (он понадобится в MCP-конфигах).
4. Перейдите в **Токены** и создайте `project token` для интеграций.
5. Сразу скопируйте токен и сохраните в secrets (он показывается только в момент создания).

Рекомендуется использовать **одни и те же** `projectId` и token для всех клиентов, которые должны работать в одном проекте.

---

## 3) Как настроить Cursor / Codex / Claude для работы с AMB через `packages/mcp-server`

### 3.1 Сборка MCP-сервера

Из репозитория AMB:

```bash
pnpm mcp:build
```

Должен появиться файл:
- `packages/mcp-server/dist/index.js`

Ниже используйте абсолютный путь к этому файлу.

### 3.2 Cursor (`.cursor/mcp.json` в вашем рабочем проекте)

```json
{
  "mcpServers": {
    "message-bus": {
      "command": "node",
      "args": ["/ABS/PATH/TO/amb/packages/mcp-server/dist/index.js"],
      "cwd": "/ABS/PATH/TO/amb",
      "env": {
        "MESSAGE_BUS_URL": "http://localhost:3333",
        "MESSAGE_BUS_PROJECT_ID": "<PROJECT_ID>"
      }
    }
  }
}
```

### 3.3 Codex (`.codex/config.toml` в вашем рабочем проекте)

```toml
[mcp_servers.message-bus]
command = "node"
args = ["/ABS/PATH/TO/amb/packages/mcp-server/dist/index.js"]
cwd = "/ABS/PATH/TO/amb"

[mcp_servers.message-bus.env]
MESSAGE_BUS_URL = "http://localhost:3333"
MESSAGE_BUS_PROJECT_ID = "<PROJECT_ID>"
```

### 3.4 Claude Desktop (`claude_desktop_config.json`)

Обычно файл находится в:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "message-bus": {
      "command": "node",
      "args": ["/ABS/PATH/TO/amb/packages/mcp-server/dist/index.js"],
      "cwd": "/ABS/PATH/TO/amb",
      "env": {
        "MESSAGE_BUS_URL": "http://localhost:3333",
        "MESSAGE_BUS_PROJECT_ID": "<PROJECT_ID>"
      }
    }
  }
}
```

После изменения конфигов перезапустите клиент (Cursor/Codex/Claude) или переподключите MCP.

---

## 4) Как синхронизировать своих агентов, чтобы они появились в AMB

В вашем проекте должен быть реестр агентов:
- `.cursor/agents/registry.json`

Синхронизация через CLI из `packages/mcp-server`:

```bash
MESSAGE_BUS_URL=http://localhost:3333 \
MESSAGE_BUS_PROJECT_ID=<PROJECT_ID> \
node /ABS/PATH/TO/amb/packages/mcp-server/dist/cli.js seed agents /ABS/PATH/TO/your-project/.cursor/agents
```

Опционально можно сразу синхронизировать и треды:

```bash
MESSAGE_BUS_URL=http://localhost:3333 \
MESSAGE_BUS_PROJECT_ID=<PROJECT_ID> \
node /ABS/PATH/TO/amb/packages/mcp-server/dist/cli.js seed all /ABS/PATH/TO/your-project/.cursor/agents
```

### Проверка, что агенты появились

1. Откройте панель AMB и выберите нужный проект.
2. В левой колонке **Агенты** должны появиться новые записи.
3. Либо проверьте API:

```bash
curl -s "http://localhost:3333/api/agents?projectId=<PROJECT_ID>" | jq '.data[] | {id, name, role}'
```

---

## Частые проблемы

- `401 Unauthorized` — проверьте, что вы вошли в панель и используете корректный проект.
- `project not found` — неверный `MESSAGE_BUS_PROJECT_ID`.
- пустой список после `seed` — указан не тот путь к `registry.json` или выбран другой проект.
- MCP не виден в клиенте — проверьте абсолютный путь к `dist/index.js` и перезапустите клиент.
