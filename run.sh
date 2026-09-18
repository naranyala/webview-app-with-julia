#!/usr/bin/env bash
set -euo pipefail

# ─── run.sh ───────────────────────────────────────────────────────────────────
# Build and launch the Julia WebView GUI desktop application.
#
# Usage:
#   ./run.sh              Build (if needed) and launch
#   ./run.sh --build      Force full rebuild then launch
#   ./run.sh --dev        Launch with WebView developer tools enabled
#   ./run.sh --devtools   Alias for --dev
#   ./run.sh --build-dev  Force rebuild + dev mode
#   ./run.sh --help       Show this help
# ──────────────────────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
NATIVE_DIR="$ROOT_DIR/native"
FRONTEND_DIST="$FRONTEND_DIR/dist/index.html"
LIBWEBVIEW="$NATIVE_DIR/lib/libwebview.so"
LIBBRIDGE="$NATIVE_DIR/lib/libjulia_webview_bridge.so"
JULIA_ENTRY="$ROOT_DIR/bin/webview_app.jl"

FORCE_BUILD=0
DEV_MODE=0

# ─── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { printf "${CYAN}▸${RESET} %s\n" "$*"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}!${RESET} %s\n" "$*"; }
fail()  { printf "${RED}✗${RESET} %s\n" "$*" >&2; exit 1; }

# ─── Argument parsing ─────────────────────────────────────────────────────────

for arg in "$@"; do
    case "$arg" in
        --build)    FORCE_BUILD=1 ;;
        --dev|--devtools) DEV_MODE=1 ;;
        --build-dev) FORCE_BUILD=1; DEV_MODE=1 ;;
        --help|-h)
            sed -n '/^# Usage:/,/^# ─/p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *)
            fail "Unknown argument: $arg (try --help)"
            ;;
    esac
done

# ─── Prerequisite checks ─────────────────────────────────────────────────────

check_command() {
    if ! command -v "$1" &>/dev/null; then
        fail "$1 is not installed or not in PATH"
    fi
}

info "Checking prerequisites..."
check_command julia
check_command node
check_command npm
check_command cmake
check_command pkg-config

# Check GTK and WebKit dev libraries
if ! pkg-config --exists gtk+-3.0 2>/dev/null; then
    fail "GTK3 development libraries not found. Install with: sudo dnf install gtk3-devel"
fi
if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
    fail "WebKit2GTK 4.1 development libraries not found. Install with: sudo dnf install webkit2gtk4.1-devel"
fi

ok "All prerequisites found"

# ─── Build frontend ───────────────────────────────────────────────────────────

needs_frontend_build() {
    if [[ "$FORCE_BUILD" -eq 1 ]]; then return 0; fi
    if [[ ! -f "$FRONTEND_DIST" ]]; then return 0; fi

    # Rebuild if any frontend input is newer than the generated bundle.
    local newest_input
    newest_input=$(find \
        "$FRONTEND_DIR/src" \
        "$FRONTEND_DIR/public" \
        "$FRONTEND_DIR/scripts" \
        "$FRONTEND_DIR/rsbuild.config.js" \
        "$FRONTEND_DIR/package.json" \
        -type f \
        -print0 | xargs -0 stat -c '%Y' 2>/dev/null | sort -rn | head -1)
    local dist_time
    dist_time=$(stat -c '%Y' "$FRONTEND_DIST" 2>/dev/null || echo 0)

    if [[ -n "$newest_input" && "$newest_input" -gt "$dist_time" ]]; then
        return 0
    fi
    return 1
}

if needs_frontend_build; then
    info "Building frontend..."
    if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
        info "Installing npm dependencies..."
        npm --prefix "$FRONTEND_DIR" ci --no-fund --no-audit 2>&1 | tail -1
    fi
    npm --prefix "$FRONTEND_DIR" run build 2>&1 | tail -3
    ok "Frontend built → $FRONTEND_DIST"
else
    ok "Frontend is up to date"
fi

# ─── Build native libraries ──────────────────────────────────────────────────

needs_native_build() {
    if [[ "$FORCE_BUILD" -eq 1 ]]; then return 0; fi
    if [[ ! -f "$LIBWEBVIEW" || ! -f "$LIBBRIDGE" ]]; then return 0; fi
    return 1
}

if needs_native_build; then
    info "Building native WebView libraries..."
    bash "$NATIVE_DIR/build_webview.sh"
    ok "Native libraries built"
else
    ok "Native libraries are up to date"
fi

# ─── Instantiate Julia project ────────────────────────────────────────────────

info "Preparing Julia project..."
julia --project="$ROOT_DIR" -e 'using Pkg; Pkg.instantiate()' 2>&1 | tail -1
ok "Julia project ready"

# ─── Launch ───────────────────────────────────────────────────────────────────

if [[ "$DEV_MODE" -eq 1 ]]; then
    export JULIA_WEBVIEW_DEVTOOLS=1
    info "Launching GUI (debug mode)..."
else
    info "Launching GUI..."
fi

if [[ -n "${JULIA_NUM_THREADS:-}" ]]; then
    exec julia --project="$ROOT_DIR" "$JULIA_ENTRY"
else
    exec julia --threads=auto --project="$ROOT_DIR" "$JULIA_ENTRY"
fi
