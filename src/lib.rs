use std::{ffi::c_void, hint::black_box};

use indexmap::IndexMap;
use napi_derive::napi;
use rayon::prelude::*;

mod wasi_pthread {
    use std::ffi;

    pub type PthreadKeyT = u32;

    unsafe extern "C" {
        pub fn pthread_key_create(
            key: *mut PthreadKeyT,
            dtor: Option<unsafe extern "C" fn(*mut ffi::c_void)>,
        ) -> ffi::c_int;
        pub fn pthread_key_delete(key: PthreadKeyT) -> ffi::c_int;
    }
}

unsafe extern "C" {
    fn __wasi_init_tp();
}

unsafe extern "C" fn noop_dtor(_ptr: *mut c_void) {}

fn make_source_vecs(
    module_count: usize,
    items_per_module: usize,
    unique_value_count: usize,
) -> Vec<Vec<u32>> {
    let items_per_module = items_per_module.max(1);
    let unique_value_count = unique_value_count.max(items_per_module);
    (0..module_count)
        .map(|module| {
            let base = module.wrapping_mul(131);
            let len = 1 + (module % items_per_module);
            (0..len)
                .map(|offset| ((base + offset.wrapping_mul(17)) % unique_value_count) as u32)
                .collect::<Vec<_>>()
        })
        .collect()
}

fn checksum_indexmap(map: &IndexMap<String, u32>) -> u64 {
    map.iter().fold(map.len() as u64, |acc, (key, value)| {
        acc.wrapping_mul(1099511628211)
            .wrapping_add(key.len() as u64)
            .wrapping_add(*value as u64)
    })
}

fn checksum_pairs(pairs: &[(u32, IndexMap<String, u32>)]) -> u64 {
    pairs.iter().fold(0u64, |acc, (module, value)| {
        acc.wrapping_mul(1469598103934665603)
            .wrapping_add(*module as u64)
            .wrapping_add(checksum_indexmap(value))
    })
}

fn call_wasi_init_tp_impl() -> i32 {
    eprintln!("repro_call_wasi_init_tp: enter");
    unsafe {
        __wasi_init_tp();
    }
    eprintln!("repro_call_wasi_init_tp: exit");
    0
}

fn pthread_key_delete_first_impl() -> i32 {
    eprintln!("repro_pthread_key_delete_first: enter");

    let mut key = 0u32;
    let ret = unsafe { wasi_pthread::pthread_key_create(&mut key, Some(noop_dtor)) };
    eprintln!("repro_pthread_key_delete_first: after create ret={ret} key={key}");
    if ret != 0 {
        return ret;
    }

    eprintln!("repro_pthread_key_delete_first: before delete key={key}");
    let ret = unsafe { wasi_pthread::pthread_key_delete(key) };
    eprintln!("repro_pthread_key_delete_first: after delete ret={ret}");
    ret
}

#[napi(js_name = "callWasiInitTp")]
pub fn call_wasi_init_tp() -> i32 {
    call_wasi_init_tp_impl()
}

#[napi(js_name = "deleteFirst")]
pub fn delete_first() -> i32 {
    pthread_key_delete_first_impl()
}

#[napi(js_name = "initThenDeleteFirst")]
pub fn init_then_delete_first() -> i32 {
    let _ = call_wasi_init_tp_impl();
    pthread_key_delete_first_impl()
}

#[napi(js_name = "rayonNumThreads")]
pub fn rayon_num_threads() -> u32 {
    rayon::current_num_threads() as u32
}

#[napi(js_name = "indexmapBuildStress")]
pub fn indexmap_build_stress(
    module_count: u32,
    items_per_module: u32,
    unique_value_count: u32,
    repeat: u32,
) -> String {
    let source_vecs = make_source_vecs(
        module_count as usize,
        items_per_module as usize,
        unique_value_count as usize,
    );
    let mut checksum = 0u64;

    for iteration in 0..repeat {
        let salt = iteration.wrapping_mul(2654435761);
        let pairs = source_vecs
            .par_iter()
            .enumerate()
            .map(|(module, values)| {
                let mut map = IndexMap::<String, u32>::default();
                for (index, value) in values.iter().enumerate() {
                    map.insert(
                        format!("m{module:05}_k{index:04}_v{value:08}_s{salt:08}"),
                        *value ^ (module as u32),
                    );
                }
                ((module as u32) ^ salt, map)
            })
            .collect::<Vec<_>>();
        checksum ^= black_box(checksum_pairs(&pairs));
    }

    checksum.to_string()
}
