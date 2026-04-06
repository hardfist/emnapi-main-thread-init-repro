# emnapi main-thread init repro

This repository reproduces a threaded WASI main-thread initialization bug with `@emnapi/wasi-threads`.

The repro is intentionally small:

- a tiny `wasm32-wasip1-threads` cdylib
- one raw pthread TLS path: `pthread_key_create()` then `pthread_key_delete()`
- one control path that first calls `__wasi_init_tp()`

## One-click repro

```bash
./repro.sh
```

What it does:

1. installs the Node dependency
2. ensures the Rust target exists
3. builds the wasm
4. runs the failing case
5. runs the control case

Expected result:

- `delete-first` times out after printing `before delete key=0`
- `init-then-delete-first` returns `0`

## Manual repro

```bash
npm install
npm run repro
```

Or step by step:

```bash
rustup target add wasm32-wasip1-threads
cargo build --target wasm32-wasip1-threads --release
timeout 10s node run.mjs delete-first
timeout 10s node run.mjs init-then-delete-first
```

## Why this is a bug

The only difference between the failing path and the control path is an explicit call to `__wasi_init_tp()`.

Without it, the main thread's `pthread_t` is not initialized before pthread/TLS APIs are used. In larger real-world threaded WASI modules, this later shows up as unrelated memory corruption and flaky `memory access out of bounds` crashes.
