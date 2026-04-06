use std::ffi::c_void;

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

#[unsafe(no_mangle)]
pub extern "C" fn repro_call_wasi_init_tp() -> i32 {
  eprintln!("repro_call_wasi_init_tp: enter");
  unsafe {
    __wasi_init_tp();
  }
  eprintln!("repro_call_wasi_init_tp: exit");
  0
}

#[unsafe(no_mangle)]
pub extern "C" fn repro_pthread_key_delete_first() -> i32 {
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
