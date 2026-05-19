#!/usr/bin/env bash
# dev.sh - Start development servers and show ready message

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Start turbo in background
turbo run dev &
TURBO_PID=$!

# Wait for servers to be ready
check_server() {
  local url=$1
  local max_attempts=60
  local attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if curl -s -o /dev/null -w '' "$url" 2>/dev/null; then
      return 0
    fi
    sleep 0.5
    attempt=$((attempt + 1))
  done
  return 1
}

# Wait for both servers
WEB_READY=false
API_READY=false

for i in $(seq 1 60); do
  if [ "$WEB_READY" = false ] && curl -s -o /dev/null http://localhost:3007 2>/dev/null; then
    WEB_READY=true
  fi
  if [ "$API_READY" = false ] && curl -s -o /dev/null http://localhost:3044/health 2>/dev/null; then
    API_READY=true
  fi
  if [ "$WEB_READY" = true ] && [ "$API_READY" = true ]; then
    break
  fi
  sleep 0.5
done

# Print ready banner
echo ""
echo ""
echo -e "  ${GREEN}${BOLD}✓ All servers ready!${NC}"
echo ""
echo -e "  ${CYAN}Frontend${NC}  →  ${BOLD}http://localhost:3007${NC}"
echo -e "  ${CYAN}Backend${NC}   →  ${BOLD}http://localhost:3044${NC}"
echo ""
echo -e "  ${DIM}Open http://localhost:3007 in your browser to get started.${NC}"
echo ""

# Wait for turbo to exit (keeps script alive)
wait $TURBO_PID
