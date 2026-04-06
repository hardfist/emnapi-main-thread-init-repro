Title: threaded WASI main thread is not initialized before pthread/TLS APIs are used

## Summary

I can reproduce a threaded WASI runtime bug where the main thread behaves as if `__wasi_init_tp()` was never called.

In a minimal `wasm32-wasip1-threads` cdylib instantiated with `@emnapi/wasi-threads`, this causes:

- `pthread_key_create()` to succeed
- the following `pthread_key_delete()` to hang forever on the main thread

If I manually call `__wasi_init_tp()` first, the exact same `pthread_key_delete()` path returns normally.

This looks like the main thread's `pthread_t` / TLS runtime is not initialized before threaded WASI APIs are used.

## Environment

- Node: `v24.14.1`
- Rust: `rustc 1.93.0-nightly (01867557c 2025-11-12)`
- `@emnapi/wasi-threads`: `1.2.1`

## Repro

Files are in this directory.

Build:

```bash
rustup target add wasm32-wasip1-threads
cargo build --target wasm32-wasip1-threads --release
```

Failing case:

```bash
timeout 10s node run.mjs delete-first
```

Observed:

- exits with `124`
- stderr stops at:

```text
repro_pthread_key_delete_first: enter
repro_pthread_key_delete_first: after create ret=0 key=0
repro_pthread_key_delete_first: before delete key=0
```

Control case:

```bash
timeout 10s node run.mjs init-then-delete-first
```

Observed:

```text
repro_call_wasi_init_tp: enter
repro_call_wasi_init_tp: exit
repro_pthread_key_delete_first: enter
repro_pthread_key_delete_first: after create ret=0 key=0
repro_pthread_key_delete_first: before delete key=0
repro_pthread_key_delete_first: after delete ret=0
```

## Why I think this is initialization-related

The only difference between the two commands is this:

```rust
unsafe extern "C" {
  fn __wasi_init_tp();
}

#[unsafe(no_mangle)]
pub extern "C" fn repro_call_wasi_init_tp() -> i32 {
  unsafe { __wasi_init_tp() };
  0
}
```

Calling it once on the main thread makes the raw pthread TLS path start working immediately.

In a larger real-world case, the same missing initialization later shows up as flaky `memory access out of bounds` crashes in unrelated Rust containers, because the runtime gets corrupted much earlier.

## Expected

The main thread should be initialized before threaded WASI pthread/TLS APIs are used, so `pthread_key_delete()` should return normally without requiring a manual `__wasi_init_tp()` call from user code.
