/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_JS_H__
#define __CINNAMON_JS_H__

#include <glib.h>
#include <cjs/gjs.h>

G_BEGIN_DECLS

gboolean cinnamon_js_add_extension_importer (const char   *target_object_script,
                                             const char   *target_property,
                                             const char   *directory,
                                             GError      **error);

typedef struct {
  guint glibc_uordblks;

  guint js_bytes;

  guint gjs_boxed;
  guint gjs_gobject;
  guint gjs_function;
  guint gjs_closure;

  /* 32 bit to avoid js conversion problems with 64 bit */
  guint  last_gc_seconds_ago;
} CinnamonJSMemoryInfo;

void cinnamon_js_get_memory_info (gpointer              ptr,
                                  gint64                last_gc,
                                  CinnamonJSMemoryInfo *meminfo);

G_END_DECLS

#endif /* __CINNAMON_JS_H__ */
