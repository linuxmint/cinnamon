/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * Based on gjs/console.c from GJS
 *
 * Copyright (c) 2008  litl, LLC
 * Copyright (c) 2010  Red Hat, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

#include "config.h"

#include <locale.h>
#include <stdlib.h>
#include <string.h>

#include <clutter/x11/clutter-x11.h>
#include <gdk/gdkx.h>
#include <girepository.h>
#include <gjs/gjs.h>
#include <gtk/gtk.h>

#include "cinnamon-global.h"
#include "cinnamon-global-private.h"

static char *command = NULL;

static GOptionEntry entries[] = {
  { "command", 'c', 0, G_OPTION_ARG_STRING, &command, "Program passed in as a string", "COMMAND" },
  { NULL }
};

static GdkFilterReturn
event_filter (GdkXEvent *xevent,
              GdkEvent  *event,
              gpointer   data)
{
  XEvent *xev = (XEvent *)xevent;

  if (clutter_x11_handle_event (xev) == CLUTTER_X11_FILTER_CONTINUE)
    return GDK_FILTER_CONTINUE;
  else
    return GDK_FILTER_REMOVE;
}

int
main(int argc, char **argv)
{
  GOptionContext *context;
  ClutterActor *stage;
  GError *error = NULL;
  CinnamonGlobal *global;
  GjsContext *js_context;
  char *script;
  const char *filename;
  char *title;
  gsize len;
  int code;


  gtk_init (&argc, &argv);

  clutter_x11_set_display (GDK_DISPLAY_XDISPLAY (gdk_display_get_default ()));
  clutter_x11_disable_event_retrieval ();

  if (clutter_init (&argc, &argv) != CLUTTER_INIT_SUCCESS)
    return 1;

  gdk_window_add_filter (NULL, event_filter, NULL);

  context = g_option_context_new (NULL);

  /* pass unknown through to the JS script */
  g_option_context_set_ignore_unknown_options (context, TRUE);

  g_option_context_add_main_entries (context, entries, NULL);
  if (!g_option_context_parse (context, &argc, &argv, &error))
    g_error ("option parsing failed: %s", error->message);

  setlocale (LC_ALL, "");
  g_type_init ();

  _cinnamon_global_init (NULL);
  global = cinnamon_global_get ();
  js_context = _cinnamon_global_get_gjs_context (global);

  /* prepare command line arguments */
  if (!gjs_context_define_string_array (js_context, "ARGV",
                                        argc - 2, (const char**)argv + 2,
                                        &error)) {
    g_printerr ("Failed to defined ARGV: %s", error->message);
    exit (1);
  }

  if (command != NULL) {
    script = command;
    len = strlen (script);
    filename = "<command line>";
  } else if (argc <= 1) {
    script = g_strdup ("const Console = imports.console; Console.interact();");
    len = strlen (script);
    filename = "<stdin>";
  } else /*if (argc >= 2)*/ {
    error = NULL;
    if (!g_file_get_contents (argv[1], &script, &len, &error)) {
      g_printerr ("%s\n", error->message);
      exit (1);
    }
    filename = argv[1];
  }

  stage = clutter_stage_get_default ();
  title = g_filename_display_basename (filename);
  clutter_stage_set_title (CLUTTER_STAGE (stage), title);
  g_free (title);

#if HAVE_BLUETOOTH
  /* The module imports are all so intertwined that if the test
   * imports anything in js/ui, it will probably eventually end up
   * pulling in ui/status/bluetooth.js. So we need this.
   */
  g_irepository_prepend_search_path (BLUETOOTH_DIR);
#endif

  /* evaluate the script */
  error = NULL;
  if (!gjs_context_eval (js_context, script, len,
                         filename, &code, &error)) {
    g_free (script);
    g_printerr ("%s\n", error->message);
    exit (1);
  }

  g_free (script);
  exit (code);
}
