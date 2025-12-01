#!/usr/bin/env bash
set -euo pipefail

# build.sh — build the Vite app for production and optionally serve the `dist/` folder

cd "$(dirname "$0")"

usage() {
  cat <<EOF
Usage: $0 [--serve]

  --serve   After a successful build, start a simple static server to serve ./dist
EOF
  exit 1
}

if [[ "${1:-}" == "--help" ]]; then
  usage
fi

DO_SERVE=false
if [[ "${1:-}" == "--serve" ]]; then
  DO_SERVE=true
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Install Node.js (>=16)." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found. Install npm." >&2
  exit 1
fi

echo "Installing npm dependencies (if needed)..."
if [ ! -d node_modules ]; then
  npm install
else
  echo "node_modules exists — skipping install"
fi

echo "Running production build..."
npm run build

if [ ! -d dist ]; then
  echo "ERROR: build did not produce a dist/ directory." >&2
  exit 1
fi

echo "Build complete: ./dist is ready."

if [ "$DO_SERVE" = true ]; then
  # Find a free ephemeral port
  if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: python3 required to pick a free port for serving." >&2
    exit 1
  fi

  PORT=$(python3 - <<'PY'
import socket
s=socket.socket()
s.bind(("",0))
port=s.getsockname()[1]
s.close()
print(port)
PY
)

  echo "Serving ./dist on port $PORT"
  # start simple Python static server
  (cd dist && python3 -m http.server "$PORT") &
  SERVER_PID=$!

  URL="http://localhost:$PORT"
  echo "Waiting for $URL to become available..."
  for i in $(seq 1 60); do
    if curl -sSf "$URL" >/dev/null 2>&1; then
      echo "Server is up: $URL"
      break
    fi
    if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
      echo "Server process exited unexpectedly." >&2
      exit 1
    fi
    sleep 0.5
  done

  if ! curl -sSf "$URL" >/dev/null 2>&1; then
    echo "Timed out waiting for server. Check process (PID: $SERVER_PID)." >&2
    exit 1
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  else
    echo "Open your browser and visit: $URL"
  fi

  echo "To stop the server: kill $SERVER_PID"
fi

echo "Done. ./dist is ready for deployment."
