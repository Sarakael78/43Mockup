#!/usr/bin/env bash
set -euo pipefail

# run.sh — installs dependencies (if needed), finds a free port,
# starts Vite dev server on that port, waits for it, and opens the browser.

cd "$(dirname "$0")"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Kill existing Vite dev server processes for this project
echo "Checking for existing dev server processes..."

# Find processes running vite in this project directory
VITE_PIDS=$(ps aux 2>/dev/null | grep -E "[v]ite|[n]pm.*dev" | grep -E "$PROJECT_ROOT|43Mockup" | awk '{print $2}' | tr '\n' ' ' || true)

# Also find by process name pattern (more reliable)
if command -v pgrep >/dev/null 2>&1; then
  # Find vite processes
  VITE_PIDS="$VITE_PIDS $(pgrep -f 'vite' 2>/dev/null | tr '\n' ' ' || true)"
  # Find npm run dev processes
  VITE_PIDS="$VITE_PIDS $(pgrep -f 'npm.*run.*dev' 2>/dev/null | tr '\n' ' ' || true)"
fi

# Remove duplicates and empty values
EXISTING_PIDS=$(echo "$VITE_PIDS" | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u | tr '\n' ' ' | xargs || true)

if [ -n "$EXISTING_PIDS" ]; then
  echo "Found existing dev server processes: $EXISTING_PIDS"
  echo "Killing existing processes..."
  # Try graceful termination first
  for pid in $EXISTING_PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  sleep 2
  # Force kill if still running
  for pid in $EXISTING_PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "Force killing process $pid..."
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  echo "Existing processes terminated."
else
  echo "No existing dev server processes found."
fi

# Check prerequisites
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Please install Node.js (>=16)." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found. Please install npm." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found. Required to pick a free port." >&2
  exit 1
fi

# Find an ephemeral free port using Python
PORT=$(python3 - <<'PY'
import socket
s=socket.socket()
s.bind(("",0))
port=s.getsockname()[1]
s.close()
print(port)
PY
)

echo "Using port: $PORT"

# Install dependencies if node_modules is missing
if [ ! -d node_modules ]; then
  echo "node_modules not found — running npm install (this may take a while)..."
  npm install
else
  echo "node_modules found — skipping npm install"
fi

LOG_FILE="dev_server.log"

# Start Vite dev server in background
echo "Starting Vite dev server on port $PORT (logs -> $LOG_FILE)..."
# Use npm script so the user's setup (scripts) is respected; pass --port through
npm run dev -- --port "$PORT" > "$LOG_FILE" 2>&1 &
VITE_PID=$!

# Wait for server to become available
URL="http://localhost:$PORT"

echo "Waiting for $URL to become available..."
for i in $(seq 1 120); do
  if curl -sSf "$URL" >/dev/null 2>&1; then
    echo "Server is up: $URL"
    break
  fi
  if ! kill -0 "$VITE_PID" >/dev/null 2>&1; then
    echo "Vite process exited unexpectedly. See $LOG_FILE for details." >&2
    exit 1
  fi
  sleep 0.5
done

# If not up after timeout, show tail of log and exit non-zero
if ! curl -sSf "$URL" >/dev/null 2>&1; then
  echo "Timed out waiting for dev server. Last 200 lines of $LOG_FILE:" >&2
  tail -n 200 "$LOG_FILE" >&2 || true
  exit 1
fi

# Open default browser. Prefer Windows default browser when running under WSL.
OPENED=false
if grep -qi microsoft /proc/version 2>/dev/null || grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null || [[ -n "${WSLENV:-}" ]]; then
  # We're likely in WSL. Try to open Windows default browser using cmd.exe
  if command -v cmd.exe >/dev/null 2>&1; then
    echo "WSL detected — opening Windows default browser to $URL"
    # Use start via cmd.exe. The empty title argument prevents treating the URL as the title.
    cmd.exe /C start "" "$URL" || true
    OPENED=true
  elif command -v powershell.exe >/dev/null 2>&1; then
    echo "WSL detected — opening Windows default browser via PowerShell to $URL"
    powershell.exe -NoProfile -Command "Start-Process '$URL'" || true
    OPENED=true
  fi
fi

if [ "$OPENED" = false ]; then
  if command -v xdg-open >/dev/null 2>&1; then
    echo "Opening browser to $URL"
    xdg-open "$URL" >/dev/null 2>&1 || true
  elif command -v gnome-open >/dev/null 2>&1; then
    gnome-open "$URL" >/dev/null 2>&1 || true
  else
    echo "Open your browser and visit: $URL"
  fi
fi

echo "Dev server running (PID: $VITE_PID). Logs: $LOG_FILE"

echo "To stop the dev server: kill $VITE_PID"
