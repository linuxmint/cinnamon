/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-clipboard.c: clipboard object
 *
 * Copyright 2009 Intel Corporation.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms and conditions of the GNU Lesser General Public License,
 * version 2.1, as published by the Free Software Foundation.
 *
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * SECTION:st-clipboard
 * @short_description: a simple representation of the X clipboard
 *
 * #StCliboard is a very simple object representation of the clipboard
 * available to applications. Text is always assumed to be UTF-8 and non-text
 * items are not handled.
 */


#include "st-clipboard.h"
#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <clutter/x11/clutter-x11.h>
#include <string.h>

G_DEFINE_TYPE (StClipboard, st_clipboard, G_TYPE_OBJECT)

#define CLIPBOARD_PRIVATE(o) \
  (G_TYPE_INSTANCE_GET_PRIVATE ((o), ST_TYPE_CLIPBOARD, StClipboardPrivate))

struct _StClipboardPrivate
{
  Window clipboard_window;
  gchar *clipboard_text;

  Atom  *supported_targets;
  gint   n_targets;
};

typedef struct _EventFilterData EventFilterData;
struct _EventFilterData
{
  StClipboard            *clipboard;
  StClipboardCallbackFunc callback;
  gpointer                user_data;
};

static Atom __atom_clip = None;
static Atom __utf8_string = None;
static Atom __atom_targets = None;

static void
st_clipboard_get_property (GObject    *object,
                           guint       property_id,
                           GValue     *value,
                           GParamSpec *pspec)
{
  switch (property_id)
    {
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
    }
}

static void
st_clipboard_set_property (GObject      *object,
                           guint         property_id,
                           const GValue *value,
                           GParamSpec   *pspec)
{
  switch (property_id)
    {
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
    }
}

static void
st_clipboard_dispose (GObject *object)
{
  G_OBJECT_CLASS (st_clipboard_parent_class)->dispose (object);
}

static void
st_clipboard_finalize (GObject *object)
{
  StClipboardPrivate *priv = ((StClipboard *) object)->priv;

  g_free (priv->clipboard_text);
  priv->clipboard_text = NULL;

  g_free (priv->supported_targets);
  priv->supported_targets = NULL;
  priv->n_targets = 0;

  G_OBJECT_CLASS (st_clipboard_parent_class)->finalize (object);
}

static ClutterX11FilterReturn
st_clipboard_provider (XEvent       *xev,
                       ClutterEvent *cev,
                       StClipboard  *clipboard)
{
  XSelectionEvent notify_event;
  XSelectionRequestEvent *req_event;

  if (xev->type != SelectionRequest)
    return CLUTTER_X11_FILTER_CONTINUE;

  req_event = &xev->xselectionrequest;

  clutter_x11_trap_x_errors ();

  if (req_event->target == __atom_targets)
    {
      XChangeProperty (req_event->display,
                       req_event->requestor,
                       req_event->property,
                       XA_ATOM,
                       32,
                       PropModeReplace,
                       (guchar*) clipboard->priv->supported_targets,
                       clipboard->priv->n_targets);
    }
  else
    {
      XChangeProperty (req_event->display,
                       req_event->requestor,
                       req_event->property,
                       req_event->target,
                       8,
                       PropModeReplace,
                       (guchar*) clipboard->priv->clipboard_text,
                       strlen (clipboard->priv->clipboard_text));
    }

  notify_event.type = SelectionNotify;
  notify_event.display = req_event->display;
  notify_event.requestor = req_event->requestor;
  notify_event.selection = req_event->selection;
  notify_event.target = req_event->target;
  notify_event.time = req_event->time;

  if (req_event->property == None)
    notify_event.property = req_event->target;
  else
    notify_event.property = req_event->property;

  /* notify the requestor that they have a copy of the selection */
  XSendEvent (req_event->display, req_event->requestor, False, 0,
              (XEvent *) &notify_event);
  /* Make it happen non async */
  XSync (clutter_x11_get_default_display(), FALSE);

  clutter_x11_untrap_x_errors (); /* FIXME: Warn here on fail ? */

  return CLUTTER_X11_FILTER_REMOVE;
}


static void
st_clipboard_class_init (StClipboardClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  g_type_class_add_private (klass, sizeof (StClipboardPrivate));

  object_class->get_property = st_clipboard_get_property;
  object_class->set_property = st_clipboard_set_property;
  object_class->dispose = st_clipboard_dispose;
  object_class->finalize = st_clipboard_finalize;
}

static void
st_clipboard_init (StClipboard *self)
{
  Display *dpy;
  StClipboardPrivate *priv;

  priv = self->priv = CLIPBOARD_PRIVATE (self);

  priv->clipboard_window =
    XCreateSimpleWindow (clutter_x11_get_default_display (),
                         clutter_x11_get_root_window (),
                         -1, -1, 1, 1, 0, 0, 0);

  dpy = clutter_x11_get_default_display ();

  /* Only create once */
  if (__atom_clip == None)
    __atom_clip = XInternAtom (dpy, "CLIPBOARD", 0);

  if (__utf8_string == None)
    __utf8_string = XInternAtom (dpy, "UTF8_STRING", 0);

  if (__atom_targets == None)
    __atom_targets = XInternAtom (dpy, "TARGETS", 0);

  priv->n_targets = 2;
  priv->supported_targets = g_new (Atom, priv->n_targets);

  priv->supported_targets[0] = __utf8_string;
  priv->supported_targets[1] = __atom_targets;

  clutter_x11_add_filter ((ClutterX11FilterFunc) st_clipboard_provider,
                          self);
}

static ClutterX11FilterReturn
st_clipboard_x11_event_filter (XEvent          *xev,
                               ClutterEvent    *cev,
                               EventFilterData *filter_data)
{
  Atom actual_type;
  int actual_format, result;
  unsigned long nitems, bytes_after;
  unsigned char *data = NULL;

  if(xev->type != SelectionNotify)
    return CLUTTER_X11_FILTER_CONTINUE;

  if (xev->xselection.property == None)
    {
      /* clipboard empty */
      filter_data->callback (filter_data->clipboard,
                             NULL,
                             filter_data->user_data);

      clutter_x11_remove_filter ((ClutterX11FilterFunc) st_clipboard_x11_event_filter,
                                 filter_data);
      g_free (filter_data);
      return CLUTTER_X11_FILTER_REMOVE;
    }

  clutter_x11_trap_x_errors ();

  result = XGetWindowProperty (xev->xselection.display,
                               xev->xselection.requestor,
                               xev->xselection.property,
                               0L, G_MAXINT,
                               True,
                               AnyPropertyType,
                               &actual_type,
                               &actual_format,
                               &nitems,
                               &bytes_after,
                               &data);

  if (clutter_x11_untrap_x_errors () || result != Success)
    {
      /* FIXME: handle failure better */
      g_warning ("Clipboard: prop retrival failed");
    }

  filter_data->callback (filter_data->clipboard, (char*) data,
                         filter_data->user_data);

  clutter_x11_remove_filter
                          ((ClutterX11FilterFunc) st_clipboard_x11_event_filter,
                          filter_data);

  g_free (filter_data);

  if (data)
    XFree (data);

  return CLUTTER_X11_FILTER_REMOVE;
}

/**
 * st_clipboard_get_default:
 *
 * Get the global #StClipboard object that represents the clipboard.
 *
 * Returns: (transfer none): a #StClipboard owned by St and must not be
 * unrefferenced or freed.
 */
StClipboard*
st_clipboard_get_default (void)
{
  static StClipboard *default_clipboard = NULL;

  if (!default_clipboard)
    {
      default_clipboard = g_object_new (ST_TYPE_CLIPBOARD, NULL);
    }

  return default_clipboard;
}

/**
 * st_clipboard_get_text:
 * @clipboard: A #StCliboard
 * @callback: (scope async): function to be called when the text is retreived
 * @user_data: data to be passed to the callback
 *
 * Request the data from the clipboard in text form. @callback is executed
 * when the data is retreived.
 *
 */
void
st_clipboard_get_text (StClipboard            *clipboard,
                       StClipboardCallbackFunc callback,
                       gpointer                user_data)
{
  EventFilterData *data;

  Display *dpy;

  g_return_if_fail (ST_IS_CLIPBOARD (clipboard));
  g_return_if_fail (callback != NULL);

  data = g_new0 (EventFilterData, 1);
  data->clipboard = clipboard;
  data->callback = callback;
  data->user_data = user_data;

  clutter_x11_add_filter ((ClutterX11FilterFunc) st_clipboard_x11_event_filter,
                          data);

  dpy = clutter_x11_get_default_display ();

  clutter_x11_trap_x_errors (); /* safety on */

  XConvertSelection (dpy,
                     __atom_clip,
                     __utf8_string, __utf8_string,
                     clipboard->priv->clipboard_window,
                     CurrentTime);

  clutter_x11_untrap_x_errors ();
}

/**
 * st_clipboard_set_text:
 * @clipboard: A #StClipboard
 * @text: text to copy to the clipboard
 *
 * Sets text as the current contents of the clipboard.
 *
 */
void
st_clipboard_set_text (StClipboard *clipboard,
                       const gchar *text)
{
  StClipboardPrivate *priv;
  Display *dpy;

  g_return_if_fail (ST_IS_CLIPBOARD (clipboard));
  g_return_if_fail (text != NULL);

  priv = clipboard->priv;

  /* make a copy of the text */
  g_free (priv->clipboard_text);
  priv->clipboard_text = g_strdup (text);

  /* tell X we own the clipboard selection */
  dpy = clutter_x11_get_default_display ();

  clutter_x11_trap_x_errors ();

  XSetSelectionOwner (dpy, __atom_clip, priv->clipboard_window, CurrentTime);
  XSync (dpy, FALSE);

  clutter_x11_untrap_x_errors ();
}
