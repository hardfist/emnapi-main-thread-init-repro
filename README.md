# emnapi main-thread init repro

This repository reproduces a threaded WASI failure through the same high-level stack rspack uses:

- Rust `napi-rs` exports
- `wasm32-wasip1-threads`
- `@napi-rs/wasm-runtime`
- `@emnapi/core` / `@emnapi/runtime`
- worker-based threaded WASI

The repro uses the same versions rspack currently uses:

- Rust `napi = 3.8.3`
- Rust `napi-derive = 3.5.2`
- Rust `napi-build = 2.3.1`
- `@napi-rs/wasm-runtime = 1.1.2`
- `@emnapi/core = 1.9.2`
- `@emnapi/runtime = 1.9.2`
- `emnapi = 1.9.2`

## One-click repro

```bash
./repro.sh
```

What it does:

1. installs the pinned JS dependencies
2. builds the `napi-rs` wasm module
3. runs a single-threaded control case
4. runs repeated multi-threaded attempts until the failure is observed

Expected result:

- the single-threaded control case succeeds
- one of the multi-threaded attempts eventually fails with either:
  - `worker (tid = ...) sent an error! memory access out of bounds`
  - a timeout / hang

On my machine, a representative failure looks like:

```text
worker (tid = 59) sent an error! memory access out of bounds

Error [RuntimeError]: memory access out of bounds
    at ...calloc
    at ...__rust_alloc_zeroed
    at ...rayon_core::registry::WorkerThread::from
    at ...rayon_core::registry::ThreadBuilder::run
    at ...std::sys::thread::wasip1::Thread::new::thread_start
    at ...__wasi_thread_start_C
    at ...wasi_thread_start
```

## Manual repro

Install and build:

```bash
npm install
node scripts/build-wasm.mjs
```

Single-threaded control:

```bash
env NODE_NO_WARNINGS=1 RAYON_NUM_THREADS=1 \
  node stress.mjs --modules 4096 --items-per-module 32 --unique-values 4096 --repeat 1 --runs 1
```

Flaky multi-threaded case:

```bash
env NODE_NO_WARNINGS=1 RAYON_NUM_THREADS=32 \
  node stress.mjs --modules 4096 --items-per-module 32 --unique-values 4096 --repeat 1 --runs 1
```

If that single attempt happens to pass, run it a few more times or just use:

```bash
node scripts/repro.mjs
```

## Why this repo is aligned with rspack

This is not a raw wasm export repro. The failing function is a `#[napi]` export loaded through `binding.cjs`, which uses the same `@napi-rs/wasm-runtime` + worker-thread loading style that rspack uses for its threaded WASI build.
