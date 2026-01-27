#!/bin/bash
# Phase 3 Test Script — Inbox + ACK Validation
# Run with: bash scripts/test-phase3.sh

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
echo "🧪 Testing Phase 3 (Inbox + ACK) on $BASE_URL"
echo "=============================================="

# Step 1 — Create Agent A
echo ""
echo "📌 Step 1: Creating Agent A..."
AGENT_A=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"TestAgentA_Phase3","role":"sender","capabilities":{"scope":["testing"]}}')
echo "Response: $AGENT_A"
AGENT_A_ID=$(echo "$AGENT_A" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Agent A ID: $AGENT_A_ID"

# Step 1 — Create Agent B
echo ""
echo "📌 Step 1: Creating Agent B..."
AGENT_B=$(curl -s -X POST "$BASE_URL/api/agents" \
  -H 'Content-Type: application/json' \
  -d '{"name":"TestAgentB_Phase3","role":"receiver","capabilities":{"scope":["testing"]}}')
echo "Response: $AGENT_B"
AGENT_B_ID=$(echo "$AGENT_B" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Agent B ID: $AGENT_B_ID"

# Step 2 — Create Thread
echo ""
echo "📌 Step 2: Creating Thread..."
THREAD=$(curl -s -X POST "$BASE_URL/api/threads" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Phase3 Test Thread","status":"open"}')
echo "Response: $THREAD"
THREAD_ID=$(echo "$THREAD" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Thread ID: $THREAD_ID"

# Step 3 — Send Message to Agent B
echo ""
echo "📌 Step 3: Sending message from Agent A to Agent B..."
MESSAGE=$(curl -s -X POST "$BASE_URL/api/messages/send" \
  -H 'Content-Type: application/json' \
  -d "{\"threadId\":\"$THREAD_ID\",\"fromAgentId\":\"$AGENT_A_ID\",\"toAgentId\":\"$AGENT_B_ID\",\"payload\":{\"text\":\"hello inbox test\"}}")
echo "Response: $MESSAGE"
MESSAGE_ID=$(echo "$MESSAGE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
MESSAGE_STATUS=$(echo "$MESSAGE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Message ID: $MESSAGE_ID"
echo "Initial Status: $MESSAGE_STATUS"

if [ "$MESSAGE_STATUS" != "pending" ]; then
  echo "❌ FAIL: Expected status=pending, got $MESSAGE_STATUS"
else
  echo "✅ PASS: Message created with status=pending"
fi

# Step 4 — Inbox Fetch #1
echo ""
echo "📌 Step 4: First inbox fetch for Agent B..."
INBOX1=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_B_ID")
echo "Response: $INBOX1"
INBOX1_STATUS=$(echo "$INBOX1" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
INBOX1_COUNT=$(echo "$INBOX1" | grep -o '"id":"[^"]*"' | wc -l | tr -d ' ')
echo "Message count in inbox: $INBOX1_COUNT"
echo "Status after inbox: $INBOX1_STATUS"

if [ "$INBOX1_STATUS" == "delivered" ]; then
  echo "✅ PASS: Message status changed to delivered"
else
  echo "❌ FAIL: Expected status=delivered, got $INBOX1_STATUS"
fi

# Step 5 — Inbox Fetch #2 (idempotency)
echo ""
echo "📌 Step 5: Second inbox fetch (idempotency check)..."
INBOX2=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_B_ID")
echo "Response: $INBOX2"
INBOX2_STATUS=$(echo "$INBOX2" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Status after second fetch: $INBOX2_STATUS"

if [ "$INBOX2_STATUS" == "delivered" ]; then
  echo "✅ PASS: Status remains delivered (idempotent)"
else
  echo "❌ FAIL: Status changed unexpectedly to $INBOX2_STATUS"
fi

# Step 6 — ACK Message
echo ""
echo "📌 Step 6: ACK the message..."
ACK1=$(curl -s -X POST "$BASE_URL/api/messages/$MESSAGE_ID/ack")
echo "Response: $ACK1"
ACK1_STATUS=$(echo "$ACK1" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Status after ACK: $ACK1_STATUS"

if [ "$ACK1_STATUS" == "ack" ]; then
  echo "✅ PASS: Message status changed to ack"
else
  echo "❌ FAIL: Expected status=ack, got $ACK1_STATUS"
fi

# Step 7 — Inbox After ACK
echo ""
echo "📌 Step 7: Inbox after ACK..."
INBOX3=$(curl -s "$BASE_URL/api/messages/inbox?agentId=$AGENT_B_ID")
echo "Response: $INBOX3"
INBOX3_COUNT=$(echo "$INBOX3" | grep -c "$MESSAGE_ID" || true)
echo "Message found in inbox: $INBOX3_COUNT times"

if [ "$INBOX3_COUNT" == "0" ]; then
  echo "✅ PASS: ACKed message not returned in inbox"
else
  echo "❌ FAIL: ACKed message still in inbox"
fi

echo ""
echo "=============================================="
echo "⚠️  EDGE CASES"
echo "=============================================="

# Edge Case: Double ACK
echo ""
echo "📌 Edge Case: Double ACK (idempotency)..."
ACK2=$(curl -s -X POST "$BASE_URL/api/messages/$MESSAGE_ID/ack")
echo "Response: $ACK2"
ACK2_STATUS=$(echo "$ACK2" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$ACK2_STATUS" == "ack" ]; then
  echo "✅ PASS: Double ACK is idempotent"
else
  echo "❌ FAIL: Double ACK returned $ACK2_STATUS"
fi

# Edge Case: ACK Unknown Message
echo ""
echo "📌 Edge Case: ACK unknown message..."
ACK_UNKNOWN=$(curl -s -X POST "$BASE_URL/api/messages/00000000-0000-0000-0000-000000000000/ack")
echo "Response: $ACK_UNKNOWN"

if echo "$ACK_UNKNOWN" | grep -q '"code":"not_found"'; then
  echo "✅ PASS: Unknown message returns 404"
else
  echo "❌ FAIL: Expected 404 for unknown message"
fi

# Edge Case: ACK pending message (should fail with 409)
echo ""
echo "📌 Edge Case: ACK pending message..."
MESSAGE2=$(curl -s -X POST "$BASE_URL/api/messages/send" \
  -H 'Content-Type: application/json' \
  -d "{\"threadId\":\"$THREAD_ID\",\"fromAgentId\":\"$AGENT_A_ID\",\"toAgentId\":\"$AGENT_B_ID\",\"payload\":{\"text\":\"pending ack test\"}}")
MESSAGE2_ID=$(echo "$MESSAGE2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created new message: $MESSAGE2_ID"

ACK_PENDING=$(curl -s -X POST "$BASE_URL/api/messages/$MESSAGE2_ID/ack")
echo "Response: $ACK_PENDING"

if echo "$ACK_PENDING" | grep -q '"code":"conflict"'; then
  echo "✅ PASS: ACK pending message returns 409 Conflict"
else
  echo "❌ FAIL: Expected 409 for pending message"
fi

echo ""
echo "=============================================="
echo "🏁 Phase 3 Testing Complete"
echo "=============================================="
echo ""
echo "IDs for manual verification:"
echo "  Agent A: $AGENT_A_ID"
echo "  Agent B: $AGENT_B_ID"
echo "  Thread:  $THREAD_ID"
echo "  Message: $MESSAGE_ID"
