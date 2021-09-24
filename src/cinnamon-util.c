/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include "cinnamon-util.h"
#include <glib/gi18n-lib.h>
#include <gtk/gtk.h>

#ifdef HAVE__NL_TIME_FIRST_WEEKDAY
#include <langinfo.h>
#endif

#define DESKTOP_SCHEMA "org.cinnamon.desktop.interface"
#define FIRST_WEEKDAY_KEY "first-day-of-week"

#include <libxml/parser.h>
#include <libxml/tree.h>
#include <libxml/xmlmemory.h>

/* Some code in this file adapted under the GPLv2+ from:
 *
 * GNOME panel utils: gnome-panel/gnome-panel/panel-util.c
 * (C) 1997, 1998, 1999, 2000 The Free Software Foundation
 * Copyright 2000 Helix Code, Inc.
 * Copyright 2000,2001 Eazel, Inc.
 * Copyright 2001 George Lebl
 * Copyright 2002 Sun Microsystems Inc.
 *
 * Authors: George Lebl
 *          Jacob Berkman
 *          Mark McLoughlin
 */

static GFile *
cinnamon_util_get_gfile_root (GFile *file)
{
  GFile *parent;
  GFile *parent_old;

  /* search for the root on the URI */
  parent_old = g_object_ref (file);
  parent = g_file_get_parent (file);
  while (parent != NULL)
    {
      g_object_unref (parent_old);
      parent_old = parent;
      parent = g_file_get_parent (parent);
    }

  return parent_old;
}

static char *
cinnamon_util_get_file_display_name_if_mount (GFile *file)
{
  GFile *compare;
  GVolumeMonitor *monitor;
  GList *mounts, *l;
  char *ret;

  ret = NULL;

  /* compare with all mounts */
  monitor = g_volume_monitor_get ();
  mounts = g_volume_monitor_get_mounts (monitor);
  for (l = mounts; l != NULL; l = l->next)
    {
      GMount *mount;
      mount = G_MOUNT(l->data);
      compare = g_mount_get_root (mount);
      if (!ret && g_file_equal (file, compare))
        ret = g_mount_get_name (mount);
      g_object_unref (mount);
      g_object_unref (compare);
    }
  g_list_free (mounts);
  g_object_unref (monitor);

  return ret;
}

static char *
cinnamon_util_get_file_display_for_common_files (GFile *file)
{
  GFile *compare;

  compare = g_file_new_for_path (g_get_home_dir ());
  if (g_file_equal (file, compare))
    {
      g_object_unref (compare);
      /* Translators: this is the same string as the one found in
       * nemo */
      return g_strdup (_("Home"));
    }
  g_object_unref (compare);

  compare = g_file_new_for_path ("/");
  if (g_file_equal (file, compare))
    {
      g_object_unref (compare);
      /* Translators: this is the same string as the one found in
       * nemo */
      return g_strdup (_("File System"));
    }
  g_object_unref (compare);

  return NULL;
}

static char *
cinnamon_util_get_file_description (GFile *file)
{
  GFileInfo *info;
  char *ret;

  ret = NULL;

  info = g_file_query_info (file, "standard::description",
                            G_FILE_QUERY_INFO_NOFOLLOW_SYMLINKS, NULL, NULL);

  if (info)
    {
      ret = g_strdup (g_file_info_get_attribute_string(info,
          G_FILE_ATTRIBUTE_STANDARD_DESCRIPTION));
      g_object_unref (info);
    }

  return ret;
}

static char *
cinnamon_util_get_file_display_name (GFile *file, gboolean use_fallback)
{
  GFileInfo *info;
  char *ret;

  ret = NULL;

  info = g_file_query_info (file, "standard::display-name",
      G_FILE_QUERY_INFO_NOFOLLOW_SYMLINKS, NULL, NULL);

  if (info)
    {
      ret = g_strdup (g_file_info_get_display_name (info));
      g_object_unref (info);
    }

  if (!ret && use_fallback)
    {
      /* can happen with URI schemes non supported by gvfs */
      char *basename;

      basename = g_file_get_basename (file);
      ret = g_filename_display_name (basename);
      g_free (basename);
    }

  return ret;
}

static GIcon *
cinnamon_util_get_file_icon_if_mount (GFile *file)
{
  GFile *compare;
  GVolumeMonitor *monitor;
  GList *mounts, *l;
  GIcon *ret;

  ret = NULL;

  /* compare with all mounts */
  monitor = g_volume_monitor_get ();
  mounts = g_volume_monitor_get_mounts (monitor);
  for (l = mounts; l != NULL; l = l->next)
    {
      GMount *mount;
      mount = G_MOUNT (l->data);
      compare = g_mount_get_root (mount);
      if (!ret && g_file_equal (file, compare))
        {
          ret = g_mount_get_icon (mount);
        }
      g_object_unref (mount);
      g_object_unref (compare);
    }
  g_list_free (mounts);
  g_object_unref (monitor);

  return ret;
}

static const char *
cinnamon_util_get_icon_for_uri_known_folders (const char *uri)
{
  const char *icon;
  char *path;
  int len;

  icon = NULL;

  if (!g_str_has_prefix (uri, "file:"))
    return NULL;

  path = g_filename_from_uri (uri, NULL, NULL);

  if (!path)
    return NULL;

  if (strcmp (path, "/") == 0)
    icon = "drive-harddisk";
  else {
    if (g_str_has_suffix (path, "/")) {
      len = strlen (path);
      path[len - 1] = '\0';
    }

    if (strcmp (path, g_get_home_dir ()) == 0)
      icon = "user-home";
    else if (strcmp (path, g_get_user_special_dir (G_USER_DIRECTORY_DESKTOP))
        == 0)
      icon = "user-desktop";
  }

  g_free (path);

  return icon;
}

/* This is based on nautilus_compute_title_for_uri() and
 * nautilus_file_get_display_name_nocopy() */
char *
cinnamon_util_get_label_for_uri (const char *text_uri)
{
  GFile *file;
  char  *label;
  GFile *root;
  char  *root_display;

  /* Here's what we do:
   *  + x-nautilus-search: URI
   *  + check if the URI is a mount
   *  + if file: URI:
   *   - check for known file: URI
   *   - check for description of the GFile
   *   - use display name of the GFile
   *  + else:
   *   - check for description of the GFile
   *   - if the URI is a root: "root displayname"
   *   - else: "root displayname: displayname"
   */

  label = NULL;

  //FIXME: see nautilus_query_to_readable_string() to have a nice name
  if (g_str_has_prefix (text_uri, "x-nautilus-search:"))
    return g_strdup (_("Search"));

  file = g_file_new_for_uri (text_uri);

  label = cinnamon_util_get_file_display_name_if_mount (file);
  if (label)
    {
      g_object_unref (file);
      return label;
    }

  if (g_str_has_prefix (text_uri, "file:"))
    {
      label = cinnamon_util_get_file_display_for_common_files (file);
      if (!label)
        label = cinnamon_util_get_file_description (file);
      if (!label)
        label = cinnamon_util_get_file_display_name (file, TRUE);
      g_object_unref (file);

      return label;
    }

  label = cinnamon_util_get_file_description (file);
  if (label)
    {
      g_object_unref (file);
      return label;
    }

  root = cinnamon_util_get_gfile_root (file);
  root_display = cinnamon_util_get_file_description (root);
  if (!root_display)
    root_display = cinnamon_util_get_file_display_name (root, FALSE);
  if (!root_display)
    /* can happen with URI schemes non supported by gvfs */
    root_display = g_file_get_uri_scheme (root);

  if (g_file_equal (file, root))
    label = root_display;
  else
    {
      char *displayname;

      displayname = cinnamon_util_get_file_display_name (file, TRUE);
      /* Translators: the first string is the name of a gvfs
       * method, and the second string is a path. For
       * example, "Trash: some-directory". It means that the
       * directory called "some-directory" is in the trash.
       */
       label = g_strdup_printf (_("%1$s: %2$s"),
                                root_display, displayname);
       g_free (root_display);
       g_free (displayname);
    }

  g_object_unref (root);
  g_object_unref (file);

  return label;
}

/**
 * cinnamon_util_get_icon_for_uri:
 * @text_uri: A URI
 *
 * Look up the icon that should be associated with a given URI.  Handles
 * various special GNOME-internal cases like x-nautilus-search, etc.
 *
 * Return Value: (transfer full): A new #GIcon
 */
GIcon *
cinnamon_util_get_icon_for_uri (const char *text_uri)
{
  const char *name;
  GFile *file;
  GFileInfo *info;
  GIcon *retval;
  const char *custom_icon;

  /* Here's what we do:
   *  + check for known file: URI
   *  + x-nautilus-search: URI
   *  + override burn: URI icon
   *  + check if the URI is a mount
   *  + override trash: URI icon for subfolders
   *  + check for application/x-gnome-saved-search mime type and override
   *    icon of the GFile
   *  + use icon of the GFile
   */

  /* this only checks file: URI */
  name = cinnamon_util_get_icon_for_uri_known_folders (text_uri);
  if (name)
    return g_themed_icon_new (name);

  if (g_str_has_prefix (text_uri, "x-nautilus-search:"))
    return g_themed_icon_new ("folder-saved-search");

  /* gvfs doesn't give us a nice icon, so overriding */
  if (g_str_has_prefix (text_uri, "burn:"))
    return g_themed_icon_new ("nautilus-cd-burner");

  file = g_file_new_for_uri (text_uri);

  retval = cinnamon_util_get_file_icon_if_mount (file);
  if (retval)
    {
      g_object_unref (file);
      return retval;
    }

  /* gvfs doesn't give us a nice icon for subfolders of the trash, so
   * overriding */
  if (g_str_has_prefix (text_uri, "trash:"))
    {
      GFile *root;

      root = cinnamon_util_get_gfile_root (file);
      g_object_unref (file);
      file = root;
    }

  info = g_file_query_info (file, "standard::icon,metadata::custom-icon", G_FILE_QUERY_INFO_NONE,
                            NULL, NULL);
  g_object_unref (file);

  if (!info)
    return g_themed_icon_new ("text-x-preview");

  custom_icon = g_file_info_get_attribute_string (info, "metadata::custom-icon");

  if (custom_icon)
    {
      GFile *icon_file = g_file_new_for_uri (custom_icon);

      retval = g_file_icon_new (icon_file);

      g_object_unref (icon_file);
    }

  if (!retval)
    {
      retval = g_file_info_get_icon (info);

      if (retval)
        g_object_ref (retval);
    }

  g_object_unref (info);

  if (retval)
    return retval;

  return g_themed_icon_new ("text-x-preview");
}

static void
stop_pick (ClutterActor       *actor,
           const ClutterColor *color)
{
  g_signal_stop_emission_by_name (actor, "pick");
}

/**
 * cinnamon_util_set_hidden_from_pick:
 * @actor: A #ClutterActor
 * @hidden: Whether @actor should be hidden from pick
 *
 * If @hidden is %TRUE, hide @actor from pick even with a mode of
 * %CLUTTER_PICK_ALL; if @hidden is %FALSE, unhide @actor.
 */
void
cinnamon_util_set_hidden_from_pick (ClutterActor *actor,
                                 gboolean      hidden)
{
  gpointer existing_handler_data;

  existing_handler_data = g_object_get_data (G_OBJECT (actor),
                                             "cinnamon-stop-pick");
  if (hidden)
    {
      if (existing_handler_data != NULL)
        return;
      g_signal_connect (actor, "pick", G_CALLBACK (stop_pick), NULL);
      g_object_set_data (G_OBJECT (actor),
                         "cinnamon-stop-pick", GUINT_TO_POINTER (1));
    }
  else
    {
      if (existing_handler_data == NULL)
        return;
      g_signal_handlers_disconnect_by_func (actor, stop_pick, NULL);
      g_object_set_data (G_OBJECT (actor), "cinnamon-stop-pick", NULL);
    }
}

/**
 * cinnamon_util_get_transformed_allocation:
 * @actor: a #ClutterActor
 * @box: (out): location to store returned box in stage coordinates
 *
 * This function is similar to a combination of clutter_actor_get_transformed_position(),
 * and clutter_actor_get_transformed_size(), but unlike
 * clutter_actor_get_transformed_size(), it always returns a transform
 * of the current allocation, while clutter_actor_get_transformed_size() returns
 * bad values (the transform of the requested size) if a relayout has been
 * queued.
 *
 * This function is more convenient to use than
 * clutter_actor_get_abs_allocation_vertices() if no transformation is in effect
 * and also works around limitations in the GJS binding of arrays.
 */
void
cinnamon_util_get_transformed_allocation (ClutterActor    *actor,
                                       ClutterActorBox *box)
{
  /* Code adapted from clutter-actor.c:
   * Copyright 2006, 2007, 2008 OpenedHand Ltd
   */
  ClutterVertex v[4];
  gfloat x_min, x_max, y_min, y_max;
  guint i;

  g_return_if_fail (CLUTTER_IS_ACTOR (actor));

  clutter_actor_get_abs_allocation_vertices (actor, v);

  x_min = x_max = v[0].x;
  y_min = y_max = v[0].y;

  for (i = 1; i < G_N_ELEMENTS (v); ++i)
    {
      if (v[i].x < x_min)
	x_min = v[i].x;

      if (v[i].x > x_max)
	x_max = v[i].x;

      if (v[i].y < y_min)
	y_min = v[i].y;

      if (v[i].y > y_max)
	y_max = v[i].y;
    }

  box->x1 = x_min;
  box->y1 = y_min;
  box->x2 = x_max;
  box->y2 = y_max;
}

/**
 * cinnamon_util_format_date:
 * @format: a strftime-style string format, as parsed by
 *   g_date_time_format()
 * @time_ms: milliseconds since 1970-01-01 00:00:00 UTC; the
 *   value returned by Date.getTime()
 *
 * Formats a date for the current locale. This should be
 * used instead of the Spidermonkey Date.toLocaleFormat()
 * extension because Date.toLocaleFormat() is buggy for
 * Unicode format strings:
 * https://bugzilla.mozilla.org/show_bug.cgi?id=508783
 *
 * Return value: the formatted date. If the date is
 *  outside of the range of a GDateTime (which contains
 *  any plausible dates we actually care about), will
 *  return an empty string.
 */
char *
cinnamon_util_format_date (const char *format,
                        gint64      time_ms)
{
  GDateTime *datetime;
  char *result;

  datetime = g_date_time_new_from_unix_local (time_ms / 1000);
  if (!datetime) /* time_ms is out of range of GDateTime */
    return g_strdup ("");

  result = g_date_time_format (datetime, format);

  g_date_time_unref (datetime);
  return result;
}

/**
 * cinnamon_util_get_week_start:
 *
 * Gets the first week day for the current locale, expressed as a
 * number in the range 0..6, representing week days from Sunday to
 * Saturday.
 *
 * Returns: A number representing the first week day for the current
 *          locale
 */
/* Copied from gtkcalendar.c */
int
cinnamon_util_get_week_start (void)
{

#ifdef HAVE__NL_TIME_FIRST_WEEKDAY
  union { unsigned int word; char *string; } langinfo;
  int week_1stday = 0;
  int first_weekday = 1;
  guint week_origin;
#else
  char *gtk_week_start;
#endif

  /* Try to get first weekday from gsettings */
  /* If the value from gsettings is not in the range 0-6,
   * continue to get the locale's first weekday */
  GSettings *settings = g_settings_new (DESKTOP_SCHEMA);
  int week_start = g_settings_get_int (settings, FIRST_WEEKDAY_KEY);
  g_object_unref (settings);

  if (0 <= week_start && week_start < 7) return week_start;

#ifdef HAVE__NL_TIME_FIRST_WEEKDAY
  langinfo.string = nl_langinfo (_NL_TIME_FIRST_WEEKDAY);
  first_weekday = langinfo.string[0];
  langinfo.string = nl_langinfo (_NL_TIME_WEEK_1STDAY);
  week_origin = langinfo.word;
  if (week_origin == 19971130) /* Sunday */
    week_1stday = 0;
  else if (week_origin == 19971201) /* Monday */
    week_1stday = 1;
  else
    g_warning ("Unknown value of _NL_TIME_WEEK_1STDAY.\n");

  week_start = (week_1stday + first_weekday - 1) % 7;
#else
  /* Use a define to hide the string from xgettext */
# define GTK_WEEK_START "calendar:week_start:0"
  gtk_week_start = dgettext ("gtk30", GTK_WEEK_START);

  if (strncmp (gtk_week_start, "calendar:week_start:", 20) == 0)
    week_start = *(gtk_week_start + 20) - '0';
  else
    week_start = -1;

  if (week_start < 0 || week_start > 6)
    {
      g_warning ("calendar:week_start:0 for GTK+ "
                 "was translated wrongly.\n");
      week_start = 0;
    }
#endif

  return week_start;
}

/**
 * cinnamon_get_event_state:
 * @event: a #ClutterEvent
 *
 * Gets the current state of the event (the set of modifier keys that
 * are pressed down). Thhis is a wrapper around
 * clutter_event_get_state() that strips out any un-declared modifier
 * flags, to make gjs happy; see
 * https://bugzilla.gnome.org/show_bug.cgi?id=597292.
 *
 * Return value: the state from the event
 */
ClutterModifierType
cinnamon_get_event_state (ClutterEvent *event)
{
  ClutterModifierType state = clutter_event_get_state (event);
  return state & CLUTTER_MODIFIER_MASK;
}

/**
 * cinnamon_write_soup_message_to_stream:
 * @stream: a #GOutputStream
 * @message: a #SoupMessage
 * @error: location to store GError
 *
 * Write a string to a GOutputStream as binary data. This is a
 * workaround for the lack of proper binary strings in GJS.
 */
void
cinnamon_write_soup_message_to_stream (GOutputStream *stream,
                                    SoupMessage   *message,
                                    GError       **error)
{
  SoupMessageBody *body;

  body = message->response_body;

  g_output_stream_write_all (stream,
                             body->data, body->length,
                             NULL, NULL, error);
}

/**
 * cinnamon_write_string_to_stream:
 * @stream: a #GOutputStream
 * @str: a UTF-8 string to write to @stream
 * @error: location to store GError
 *
 * Write a string to a GOutputStream as UTF-8. This is a workaround
 * for not having binary buffers in GJS.
 *
 * Return value: %TRUE if write succeeded
 */
gboolean
cinnamon_write_string_to_stream (GOutputStream *stream,
                              const char    *str,
                              GError       **error)
{
  return g_output_stream_write_all (stream, str, strlen (str),
                                    NULL, NULL, error);
}

/**
 * cinnamon_get_file_contents_utf8_sync:
 * @path: UTF-8 encoded filename path
 * @error: a #GError
 *
 * Synchronously load the contents of a file as a NUL terminated
 * string, validating it as UTF-8.  Embedded NUL characters count as
 * invalid content.
 *
 * Returns: (transfer full): File contents
 *
 * Deprecated: 3.1
 */
char *
cinnamon_get_file_contents_utf8_sync (const char *path,
                                   GError    **error)
{
  char *contents;
  gsize len;
  if (!g_file_get_contents (path, &contents, &len, error))
    return NULL;
  if (!g_utf8_validate (contents, len, NULL))
    {
      g_free (contents);
      g_set_error (error,
                   G_IO_ERROR,
                   G_IO_ERROR_FAILED,
                   "File %s contains invalid UTF-8",
                   path);
      return NULL;
    }
  return contents;
}

typedef struct
{
    CinnamonFileContentsCallback callback;
    gpointer user_data;
} CinnamonFileContentsCallbackData;

static void
get_file_contents_utf8_thread (GTask        *task,
                               gpointer      source_object,
                               gpointer      task_data,
                               GCancellable *cancellable)
{
    gchar *contents = NULL;
    GError *error = NULL;

    const gchar *path = (const gchar *) task_data;

    contents = cinnamon_get_file_contents_utf8_sync (path, &error);

    if (error)
      {
        g_task_return_error (task, error);
        return;
      }

    g_task_return_pointer (task, contents, g_free);
}

static void
get_file_contents_utf8_task_finished (GObject      *source,
                                      GAsyncResult *result,
                                      gpointer      user_data)
{
    CinnamonFileContentsCallbackData *data = (CinnamonFileContentsCallbackData *) user_data;

    GError *error = NULL;
    gchar *contents = NULL;

    contents = g_task_propagate_pointer (G_TASK (result), &error);

    if (error)
      {
        g_printerr ("cinnamon_get_file_contents_utf8 failed: %s\n", error->message);
        g_clear_error (&error);
      }

    (* data->callback) (contents, data->user_data);

    g_clear_pointer (&contents, g_free);
    g_slice_free (CinnamonFileContentsCallbackData, data);
}

/**
 * cinnamon_get_file_contents_utf8:
 * @path: UTF-8 encoded filename path
 * @callback: (scope async): The callback to call when finished
 * @user_data: (closure): data to pass with the callback
 *
 * Asynchronously load the contents of a file as a NUL terminated
 * string, validating it as UTF-8.  Embedded NUL characters count as
 * invalid content.
 **/
void
cinnamon_get_file_contents_utf8         (const char                   *path,
                                         CinnamonFileContentsCallback  callback,
                                         gpointer                      user_data)
{
  gchar *async_path;
  GTask *task;
  CinnamonFileContentsCallbackData *data;

  if (path == NULL || callback == NULL)
    {
      g_warning ("cinnamon_get_file_contents_utf8: path and callback cannot be null");
      return;
    }

  data = g_slice_new (CinnamonFileContentsCallbackData);

  data->callback = callback;
  data->user_data = user_data;

  async_path = g_strdup (path);

  task = g_task_new (NULL,
                     NULL,
                     get_file_contents_utf8_task_finished,
                     data);

  g_task_set_task_data (task, async_path, (GDestroyNotify) g_free);
  g_task_run_in_thread (task, get_file_contents_utf8_thread);

  g_object_unref (task);
}

/**
 * cinnamon_breakpoint:
 *
 * Using G_BREAKPOINT(), interrupt the current process.  This is useful
 * in conjunction with a debugger such as gdb.
 */
void
cinnamon_breakpoint (void)
{
  G_BREAKPOINT ();
}

/**
 * cinnamon_parse_search_provider:
 * @data: description of provider
 * @name: (out): location to store a display name
 * @url: (out): location to store template of url
 * @langs: (out) (transfer full) (element-type utf8): list of supported languages
 * @icon_data_uri: (out): location to store uri
 * @error: location to store GError
 *
 * Returns: %TRUE on success
 */
gboolean
cinnamon_parse_search_provider (const char    *data,
                             char         **name,
                             char         **url,
                             GList        **langs,
                             char         **icon_data_uri,
                             GError       **error)
{
  xmlDocPtr doc = xmlParseMemory (data, strlen (data));
  xmlNode *root;

  *name = NULL;
  *url = NULL;
  *icon_data_uri = NULL;
  *langs = NULL;

  if (!doc)
    {
      g_set_error (error, G_IO_ERROR, G_IO_ERROR_FAILED, "Malformed xml");
      return FALSE;
    }

  root = xmlDocGetRootElement (doc);
  if (root && root->name && xmlStrcmp (root->name, (const xmlChar *)"OpenSearchDescription") == 0)
    {
      xmlNode *child;
      for (child = root->children; child; child = child->next)
        {
            if (!child->name)
              continue;
            if (xmlStrcmp (child->name, (const xmlChar *)"Language") == 0)
              {
                xmlChar *val = xmlNodeListGetString(doc, child->xmlChildrenNode, 1);
                if (!val)
                  continue;
                *langs = g_list_append (*langs, g_strdup ((char *)val));
                xmlFree (val);
              }
            if (!*name && xmlStrcmp (child->name, (const xmlChar *)"ShortName") == 0)
              {
                xmlChar *val = xmlNodeListGetString(doc, child->xmlChildrenNode, 1);
                *name = g_strdup ((char *)val);
                xmlFree (val);
              }
            if (!*icon_data_uri && xmlStrcmp (child->name, (const xmlChar *)"Image") == 0)
              {
                xmlChar *val = xmlNodeListGetString(doc, child->xmlChildrenNode, 1);
                if (val)
                  *icon_data_uri = g_strdup ((char *)val);
                xmlFree (val);
              }
            if (!*url && xmlStrcmp (child->name, (const xmlChar *)"Url") == 0)
              {
                xmlChar *template;
                xmlChar *type;

                type = xmlGetProp(child, (const xmlChar *)"type");
                if (!type)
                  continue;

                if (xmlStrcmp (type, (const xmlChar *)"text/html") != 0)
                  {
                    xmlFree (type);
                    continue;
                  }
                xmlFree (type);

                template = xmlGetProp(child, (const xmlChar *)"template");
                if (!template)
                  continue;
                *url = g_strdup ((char *)template);
                xmlFree (template);
              }
        }
    }
  else
    {
      g_set_error (error, G_IO_ERROR, G_IO_ERROR_FAILED, "Invalid OpenSearch document");
      xmlFreeDoc (doc);
      return FALSE;
    }
  xmlFreeDoc (doc);
  if (*icon_data_uri && *name && *url)
    return TRUE;

  if (*icon_data_uri)
    g_free (*icon_data_uri);
  else
    g_set_error (error, G_IO_ERROR, G_IO_ERROR_FAILED,
                 "search provider doesn't have icon");

  if (*name)
    g_free (*name);
  else if (error && !*error)
    g_set_error (error, G_IO_ERROR, G_IO_ERROR_FAILED,
                 "search provider doesn't have ShortName");

  if (*url)
    g_free (*url);
  else if (error && !*error)
    g_set_error (error, G_IO_ERROR, G_IO_ERROR_FAILED,
                 "search provider doesn't have template for url");

  if (*langs)
    {
      g_list_foreach (*langs, (GFunc)g_free, NULL);
      g_list_free (*langs);
    }

  *url = NULL;
  *name = NULL;
  *icon_data_uri = NULL;
  *langs = NULL;

  return FALSE;
}

/**
 * cinnamon_shader_effect_set_double_uniform:
 * @effect: The #ClutterShaderEffect
 * @name: The name of the uniform
 * @value: The value to set it to.
 *
 * Set a double uniform on a ClutterShaderEffect.
 *
 * The problem here is that JavaScript doesn't have more than
 * one number type, and gjs tries to automatically guess what
 * type we want to set a GValue to. If the number is "1.0" or
 * something, it will use an integer, which will cause errors
 * in GLSL.
 */
void
cinnamon_shader_effect_set_double_uniform (ClutterShaderEffect *effect,
                                        const gchar         *name,
                                        gdouble             value)
{
  GValue gvalue = G_VALUE_INIT;
  g_value_init (&gvalue, G_TYPE_DOUBLE);
  g_value_set_double (&gvalue, value);

  clutter_shader_effect_set_uniform_value (effect,
                                           name,
                                           &gvalue);
}
