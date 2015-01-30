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
 * cinnamon_js_add_extension_importer:
 * @target_object_script: JavaScript code evaluating to a target object
 * @target_property: Name of property to use for importer
 * @directory: Source directory:
 * @error: A #GError
 *
 * This function sets a property named @target_property on the object
 * resulting from the evaluation of @target_object_script code, which
 * acts as a GJS importer for directory @directory.
 *
 * Returns: %TRUE on success
 */
gboolean
cinnamon_js_add_extension_importer (const char  *target_object_script,
                                    const char  *target_property,
                                    const char  *directory,
                                    GError     **error)
{
  jsval target_object;
  GList *contexts;
  JSContext *context;
  char *search_path[2] = { 0, 0 };
  gboolean ret = FALSE;

  /* Take the first GjsContext from all of them --
   * we should only ever have one context, so this
   * should be alright. */
  contexts = gjs_context_get_all ();
  context = (JSContext*) gjs_context_get_native_context ((GjsContext*)contexts->data);
  g_list_free_full (contexts, g_object_unref);

  JS_BeginRequest (context);

  /* This is a bit of a hack; ideally we'd be able to pass our target
   * object directly into this function, but introspection doesn't
   * support that at the moment.  Instead evaluate a string to get it. */
  if (!JS_EvaluateScript(context,
                         JS_GetGlobalObject(context),
                         target_object_script,
                         strlen (target_object_script),
                         "<target_object_script>",
                         0,
                         &target_object))
    {
      gjs_log_exception(context);
      g_set_error(error,
                  G_IO_ERROR,
                  G_IO_ERROR_FAILED,
                  "Unable to import %s", target_object_script);
      goto out;
    }

  if (!JSVAL_IS_OBJECT (target_object))
    {
      g_error ("cinnamon_js_add_extension_importer: invalid target object");
      goto out;
    }

  search_path[0] = (char*)directory;
  gjs_define_importer (context, JSVAL_TO_OBJECT (target_object), target_property, (const char **)search_path, FALSE);
  ret = TRUE;

 out:
  JS_EndRequest (context);
  return ret;
}

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

