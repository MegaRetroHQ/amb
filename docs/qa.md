# 🎯 Task: QA Validation for Local Agent Message Bus (Next.js-only)

## Context

We are testing a **local-only Agent Message Bus** built with:

* Next.js App Router
* Prisma + SQLite
* shadcn/ui UI
* Threads + inbox model
* Retry + DLQ
* No auth
* Runs on localhost

---

## Goals

Validate:

* API correctness
* Thread lifecycle
* Message ordering
* Retry + DLQ logic
* UI polling behavior
* Data integrity in Prisma

---

## Test Areas

### 🔹 Agents

* register agent
* duplicate names allowed / not allowed (document)
* status updates
* lastSeen updated

---

### 🔹 Threads

* create thread
* list threads
* archived thread cannot receive new messages
* messages linked only to correct thread

---

### 🔹 Messages

* send message
* reply to message (parentId)
* ordering by createdAt ASC
* broadcast behavior
* ack flow
* retry increments
* DLQ after maxRetries

---

### 🔹 Inbox

* polling returns only unacked messages
* filtering by threadId
* concurrent readers safe

---

### 🔹 UI

* threads refresh after creation
* messages auto-update
* empty states
* long thread scroll
* status badges
* send button disabled when empty

---

## Deliverables

* QA checklist (markdown)
* Postman/Bruno collection
* happy-path сценарий
* edge cases list
* bug report template
* regression suite

---

## Acceptance Criteria

* all endpoints exercised
* DLQ scenario reproduced
* retry verified
* UI works without reload
* no data corruption
* no crashes in logs

---

## Non-Goals

* security testing
* load testing
* multi-tenant
* cloud infra

---

## Quick curl smoke checks

Use `http://localhost:3001` if `3000` is busy.

Create an agent:

```bash
curl -s -X POST http://localhost:3001/api/agents \
  -H 'Content-Type: application/json' \
  -d '{"name":"PO","role":"product","capabilities":{"scope":["requirements"]}}'
```

List agents:

```bash
curl -s http://localhost:3001/api/agents
```

Create a thread:

```bash
curl -s -X POST http://localhost:3001/api/threads \
  -H 'Content-Type: application/json' \
  -d '{"title":"API smoke thread","status":"open"}'
```

List threads:

```bash
curl -s http://localhost:3001/api/threads
```

Send a message (replace IDs):

```bash
curl -s -X POST http://localhost:3001/api/messages/send \
  -H 'Content-Type: application/json' \
  -d '{"threadId":"<thread-id>","fromAgentId":"<from-agent-id>","toAgentId":"<to-agent-id>","payload":{"text":"hello"}}'
```

List messages for a thread:

```bash
curl -s http://localhost:3001/api/threads/<thread-id>/messages
```

Inbox for an agent (marks pending as delivered):

```bash
curl -s "http://localhost:3001/api/messages/inbox?agentId=<agent-id>"
```

Ack a delivered message:

```bash
curl -s -X POST http://localhost:3001/api/messages/<message-id>/ack
```

Inbox + ACK flow (status transition):

```bash
# 1) Send a message
curl -s -X POST http://localhost:3001/api/messages/send \
  -H 'Content-Type: application/json' \
  -d '{"threadId":"<thread-id>","fromAgentId":"<from-agent-id>","toAgentId":"<to-agent-id>","payload":{"text":"inbox check"}}'

# 2) First inbox fetch should mark pending -> delivered
curl -s "http://localhost:3001/api/messages/inbox?agentId=<to-agent-id>"

# 3) Ack the message (idempotent)
curl -s -X POST http://localhost:3001/api/messages/<message-id>/ack
curl -s -X POST http://localhost:3001/api/messages/<message-id>/ack
```
