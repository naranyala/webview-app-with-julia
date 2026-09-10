#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/native/vendor/webview"
BUILD_DIR="$ROOT_DIR/native/build"
OUTPUT_DIR="$ROOT_DIR/native/lib"
VERSION="0.12.0"

if [[ ! -d "$SOURCE_DIR/.git" ]]; then
    git clone --depth 1 --branch "$VERSION" https://github.com/webview/webview.git "$SOURCE_DIR"
fi

cmake -S "$SOURCE_DIR" -B "$BUILD_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DWEBVIEW_BUILD_EXAMPLES=OFF \
    -DWEBVIEW_BUILD_TESTS=OFF \
    -DWEBVIEW_BUILD_DOCS=OFF \
    -DWEBVIEW_INSTALL_TARGETS=OFF \
    -DWEBVIEW_ENABLE_PACKAGING=OFF \
    -DWEBVIEW_BUILD_SHARED_LIBRARY=ON \
    -DWEBVIEW_BUILD_STATIC_LIBRARY=OFF

cmake --build "$BUILD_DIR" --target webview_core_shared --parallel
mkdir -p "$OUTPUT_DIR"
cp "$BUILD_DIR/core/libwebview.so" "$OUTPUT_DIR/libwebview.so"

"${CXX:-c++}" -std=c++11 -fPIC -shared "$ROOT_DIR/native/bridge.cc" \
    -I"$SOURCE_DIR/core/include" \
    $(pkg-config --cflags gtk+-3.0 webkit2gtk-4.1) \
    -L"$OUTPUT_DIR" -lwebview -Wl,-rpath,'$ORIGIN' \
    -o "$OUTPUT_DIR/libjulia_webview_bridge.so"

printf 'Built %s\n' "$OUTPUT_DIR/libwebview.so"
printf 'Built %s\n' "$OUTPUT_DIR/libjulia_webview_bridge.so"
