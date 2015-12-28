/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include "cinnamon-js.h"

#include <gio/gio.h>
#include <cjs/gjs-module.h>

/* Memory report bits */
#ifdef HAVE_MALLINFO
#include <malloc.h>
#endif

/**
 * cinnamon_js_get_memory_info: (skip)
 * @ptr: pointer to GjsContext from global
 * @last_gc: The last garbage collection time (passed from global)
 * @meminfo: (out caller-allocates): Output location for memory information
 *
 * Load process-global data about memory usage.
 */
void
cinnamon_js_get_memory_info (gpointer              ptr,
                             gint64                last_gc,
                             CinnamonJSMemoryInfo *meminfo)
{
  GjsContext *gjs_context = GJS_CONTEXT (ptr);
  JSContext *context;

  gint64 now;

  memset (meminfo, 0, sizeof (*meminfo));
#ifdef HAVE_MALLINFO
  {
    struct mallinfo info = mallinfo ();
    meminfo->glibc_uordblks = info.uordblks;
  }
#endif

  context = (JSContext *) gjs_context_get_native_context (gjs_context);

  meminfo->js_bytes = JS_GetGCParameter (JS_GetRuntime (context), JSGC_BYTES);

  meminfo->gjs_boxed = (unsigned int) gjs_counter_boxed.value;
  meminfo->gjs_gobject = (unsigned int) gjs_counter_object.value;
  meminfo->gjs_function = (unsigned int) gjs_counter_function.value;
  meminfo->gjs_closure = (unsigned int) gjs_counter_closure.value;

  now = g_get_monotonic_time ();

  meminfo->last_gc_seconds_ago = (now - last_gc) / G_TIME_SPAN_SECOND;
}

