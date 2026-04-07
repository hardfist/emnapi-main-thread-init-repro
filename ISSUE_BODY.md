Title: threaded WASI napi-rs module can fail in worker bootstrap with `memory access out of bounds`

## Summary

I can reproduce a threaded WASI failure through a minimal `napi-rs` wasm module loaded with:

- `@napi-rs/wasm-runtime`
- `@emnapi/core`
- `@emnapi/runtime`
- `emnapi`
- `node:wasi`
- worker-thread based threaded WASI

This is meant to be aligned with rspack's threaded WASI runtime path, not a raw wasm export repro.

The failure is flaky, but `./repro.sh` in the attached repo usually reproduces it within a few attempts.

## Versions

Pinned to the same versions rspack currently uses:

- Rust `napi = 3.8.3`
- Rust `napi-derive = 3.5.2`
- Rust `napi-build = 2.3.1`
- `@napi-rs/wasm-runtime = 1.1.2`
- `@emnapi/core = 1.9.2`
- `@emnapi/runtime = 1.9.2`
- `emnapi = 1.9.2`

Environment used for verification:

- Node: `v24.14.1`
- Rust target: `wasm32-wasip1-threads`

## Repro

Clone the repo and run:

```bash
./repro.sh
```

What the script does:

1. install dependencies
2. build the `napi-rs` wasm module
3. run a single-threaded control case
4. run repeated multi-threaded attempts until the failure is observed

Control case:

```bash
env NODE_NO_WARNINGS=1 RAYON_NUM_THREADS=1 \
  node stress.mjs --modules 4096 --items-per-module 32 --unique-values 4096 --repeat 1 --runs 1
```

This consistently succeeds.

Flaky case:

```bash
env NODE_NO_WARNINGS=1 RAYON_NUM_THREADS=32 \
  node stress.mjs --modules 4096 --items-per-module 32 --unique-values 4096 --repeat 1 --runs 1
```

This may succeed on some attempts, but repeated runs eventually fail with either:

- `worker (tid = ...) sent an error! memory access out of bounds`
- or a timeout / hang

## Representative failure

One captured failure from this repro:

```text
worker (tid = 59) sent an error! memory access out of bounds

Error [RuntimeError]: memory access out of bounds
    at emnapi_main_thread_init_repro.wasm.calloc
    at emnapi_main_thread_init_repro.wasm.__rust_alloc_zeroed
    at emnapi_main_thread_init_repro.wasm.rayon_core::registry::WorkerThread::from
    at emnapi_main_thread_init_repro.wasm.rayon_core::registry::ThreadBuilder::run
    at emnapi_main_thread_init_repro.wasm.std::sys::thread::wasip1::Thread::new::thread_start
    at emnapi_main_thread_init_repro.wasm.__wasi_thread_start_C
    at emnapi_main_thread_init_repro.wasm.wasi_thread_start
```

So the first visible witness is already in threaded worker bootstrap / allocation, not in application logic.

## Why I think this is runtime-related

- The same function succeeds in single-threaded mode.
- The failing function is only building `IndexMap<String, u32>` values in `rayon` workers.
- The trap occurs in worker bootstrap / allocation paths like `calloc` and `__rust_alloc_zeroed`, before any interesting application-specific behavior.
- The repro goes through `napi-rs + wasm-runtime + emnapi` instead of calling raw wasm exports directly.

## Expected

The same threaded `napi-rs` wasm module should either always succeed or fail deterministically with a normal Rust panic / JS exception, not intermittently trap with `memory access out of bounds` or hang during worker bootstrap.
