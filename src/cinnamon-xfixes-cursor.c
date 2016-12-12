/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#include <stdio.h>
#include <stdlib.h>

#include "cinnamon-xfixes-cursor.h"

#include "st.h"

#include <clutter/x11/clutter-x11.h>
#include <X11/extensions/Xfixes.h>

/**
 * SECTION:CinnamonXFixesCursor
 * short_description: Capture/manipulate system mouse cursor.
 *
 * The #CinnamonXFixesCursor object uses the XFixes extension to show/hide the
 * the system mouse pointer, to grab its image as it changes, and emit a
 * notification when its image changes.
 */

struct _CinnamonXFixesCursorClass
{
  GObjectClass parent_class;
};

struct _CinnamonXFixesCursor {
  GObject parent;

  ClutterStage *stage;

  gboolean have_xfixes;
  int xfixes_event_base;

  gboolean is_showing;

  CoglHandle *cursor_sprite;
  int cursor_hot_x;
  int cursor_hot_y;
};

static void xfixes_cursor_show        (CinnamonXFixesCursor *xfixes_cursor);
static void xfixes_cursor_hide        (CinnamonXFixesCursor *xfixes_cursor);

static void xfixes_cursor_set_stage   (CinnamonXFixesCursor *xfixes_cursor,
                                       ClutterStage  *stage);

static void xfixes_cursor_reset_image (CinnamonXFixesCursor *xfixes_cursor);

enum {
  PROP_0,
  PROP_STAGE,
};

G_DEFINE_TYPE(CinnamonXFixesCursor, cinnamon_xfixes_cursor, G_TYPE_OBJECT);

enum {
    CURSOR_CHANGED,
    LAST_SIGNAL
};

static guint signals[LAST_SIGNAL] = { 0 };

static void
cinnamon_xfixes_cursor_init (CinnamonXFixesCursor *xfixes_cursor)
{
  // (JS) Best (?) that can be assumed since XFixes doesn't provide a way of
  // detecting if the system mouse cursor is showing or not.
  xfixes_cursor->is_showing = TRUE;
}

static void
cinnamon_xfixes_cursor_finalize (GObject  *object)
{
  CinnamonXFixesCursor *xfixes_cursor = CINNAMON_XFIXES_CURSOR (object);

  // Make sure the system cursor is showing before leaving the stage.
  xfixes_cursor_show (xfixes_cursor);
  xfixes_cursor_set_stage (xfixes_cursor, NULL);
  if (xfixes_cursor->cursor_sprite != NULL)
    cogl_handle_unref (xfixes_cursor->cursor_sprite);

  G_OBJECT_CLASS (cinnamon_xfixes_cursor_parent_class)->finalize (object);
}

static void
xfixes_cursor_on_stage_destroy (ClutterActor  *actor,
                                CinnamonXFixesCursor *xfixes_cursor)
{
  xfixes_cursor_set_stage (xfixes_cursor, NULL);
}

static ClutterX11FilterReturn
xfixes_cursor_event_filter (XEvent        *xev,
                            ClutterEvent  *cev,
                            gpointer       data)
{
  CinnamonXFixesCursor *xfixes_cursor = data;

  if (xev->xany.window != clutter_x11_get_stage_window (xfixes_cursor->stage))
    return CLUTTER_X11_FILTER_CONTINUE;

  if (xev->xany.type == xfixes_cursor->xfixes_event_base + XFixesCursorNotify)
    {
      XFixesCursorNotifyEvent *notify_event = (XFixesCursorNotifyEvent *)xev;
      if (notify_event->subtype == XFixesDisplayCursorNotify)
        xfixes_cursor_reset_image (xfixes_cursor);
    }
    return CLUTTER_X11_FILTER_CONTINUE;
}

static void
xfixes_cursor_set_stage (CinnamonXFixesCursor *xfixes_cursor,
                         ClutterStage  *stage)
{
  if (xfixes_cursor->stage == stage)
    return;

  if (xfixes_cursor->stage)
    {
      g_signal_handlers_disconnect_by_func (xfixes_cursor->stage,
                                            (void *)xfixes_cursor_on_stage_destroy,
                                            xfixes_cursor);

      clutter_x11_remove_filter (xfixes_cursor_event_filter, xfixes_cursor);
    }
  xfixes_cursor->stage = stage;
  if (xfixes_cursor->stage)
    {
      int error_base;

      xfixes_cursor->stage = stage;
      g_signal_connect (xfixes_cursor->stage, "destroy",
                        G_CALLBACK (xfixes_cursor_on_stage_destroy), xfixes_cursor);

      clutter_x11_add_filter (xfixes_cursor_event_filter, xfixes_cursor);

      xfixes_cursor->have_xfixes = XFixesQueryExtension (clutter_x11_get_default_display (),
                                                         &xfixes_cursor->xfixes_event_base,
                                                         &error_base);
      if (xfixes_cursor->have_xfixes)
        XFixesSelectCursorInput (clutter_x11_get_default_display (),
                                 clutter_x11_get_stage_window (stage),
                                 XFixesDisplayCursorNotifyMask);

      xfixes_cursor_reset_image (xfixes_cursor);
    }
}

static void
xfixes_cursor_show (CinnamonXFixesCursor *xfixes_cursor)
{
  int minor, major;
  Display *xdisplay;
  Window xwindow;

  if (xfixes_cursor->is_showing == TRUE)
      return;

  if (!xfixes_cursor->have_xfixes || !xfixes_cursor->stage)
      return;

  xdisplay = clutter_x11_get_default_display ();
  xwindow = clutter_x11_get_stage_window (xfixes_cursor->stage);
  XFixesQueryVersion (xdisplay, &major, &minor);
  if (major >= 4)
    {
      XFixesShowCursor (xdisplay, xwindow);
      xfixes_cursor->is_showing = TRUE;
    }
}

static void
xfixes_cursor_hide (CinnamonXFixesCursor *xfixes_cursor)
{
  int minor, major;
  Display *xdisplay;
  Window xwindow;

  if (xfixes_cursor->is_showing == FALSE)
      return;

  if (!xfixes_cursor->have_xfixes || !xfixes_cursor->stage)
      return;

  xdisplay = clutter_x11_get_default_display ();
  xwindow = clutter_x11_get_stage_window (xfixes_cursor->stage);
  XFixesQueryVersion (xdisplay, &major, &minor);
  if (major >= 4)
    {
      XFixesHideCursor (xdisplay, xwindow);
      xfixes_cursor->is_showing = FALSE;
    }
}

static void
xfixes_cursor_reset_image (CinnamonXFixesCursor *xfixes_cursor)
{
  XFixesCursorImage *cursor_image;
  CoglHandle sprite = COGL_INVALID_HANDLE;
  guint8 *cursor_data;
  gboolean free_cursor_data;

  if (!xfixes_cursor->have_xfixes)
    return;

  cursor_image = XFixesGetCursorImage (clutter_x11_get_default_display ());
  if (!cursor_image)
    return;

  /* Like all X APIs, XFixesGetCursorImage() returns arrays of 32-bit
   * quantities as arrays of long; we need to convert on 64 bit */
  if (sizeof(long) == 4)
    {
      cursor_data = (guint8 *)cursor_image->pixels;
      free_cursor_data = FALSE;
    }
  else
    {
      int i, j;
      guint32 *cursor_words;
      gulong *p;
      guint32 *q;

      cursor_words = g_new (guint32, cursor_image->width * cursor_image->height);
      cursor_data = (guint8 *)cursor_words;

      p = cursor_image->pixels;
      q = cursor_words;
      for (j = 0; j < cursor_image->height; j++)
        for (i = 0; i < cursor_image->width; i++)
          *(q++) = *(p++);

      free_cursor_data = TRUE;
    }

  sprite = st_cogl_texture_new_from_data_wrapper (cursor_image->width, cursor_image->height,
                                                  COGL_TEXTURE_NONE,
                                                  CLUTTER_CAIRO_FORMAT_ARGB32,
                                                  COGL_PIXEL_FORMAT_ANY,
                                                  cursor_image->width * 4,
                                                  cursor_data);

  if (free_cursor_data)
    g_free (cursor_data);

  if (sprite != COGL_INVALID_HANDLE)
    {
      if (xfixes_cursor->cursor_sprite != NULL)
        cogl_handle_unref (xfixes_cursor->cursor_sprite);

      xfixes_cursor->cursor_sprite = sprite;
      xfixes_cursor->cursor_hot_x = cursor_image->xhot;
      xfixes_cursor->cursor_hot_y = cursor_image->yhot;
      g_signal_emit (xfixes_cursor, signals[CURSOR_CHANGED], 0);
    }
  XFree (cursor_image);
}

static void
cinnamon_xfixes_cursor_set_property (GObject      *object,
                                 guint         prop_id,
                                 const GValue *value,
                                 GParamSpec   *pspec)
{
  CinnamonXFixesCursor *xfixes_cursor = CINNAMON_XFIXES_CURSOR (object);

  switch (prop_id)
    {
    case PROP_STAGE:
      xfixes_cursor_set_stage (xfixes_cursor, g_value_get_object (value));
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_xfixes_cursor_get_property (GObject         *object,
                             guint            prop_id,
                             GValue          *value,
                             GParamSpec      *pspec)
{
  CinnamonXFixesCursor *xfixes_cursor = CINNAMON_XFIXES_CURSOR (object);

  switch (prop_id)
    {
    case PROP_STAGE:
      g_value_set_object (value, G_OBJECT (xfixes_cursor->stage));
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_xfixes_cursor_class_init (CinnamonXFixesCursorClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  gobject_class->finalize = cinnamon_xfixes_cursor_finalize;

  signals[CURSOR_CHANGED] = g_signal_new ("cursor-change",
                                       G_TYPE_FROM_CLASS (klass),
                                       G_SIGNAL_RUN_LAST,
                                       0,
                                       NULL, NULL, NULL,
                                       G_TYPE_NONE, 0);

  gobject_class->get_property = cinnamon_xfixes_cursor_get_property;
  gobject_class->set_property = cinnamon_xfixes_cursor_set_property;

  g_object_class_install_property (gobject_class,
                                   PROP_STAGE,
                                   g_param_spec_object ("stage",
                                                        "Stage",
                                                        "Stage for mouse cursor",
                                                        CLUTTER_TYPE_STAGE,
                                                        G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY));
}

/**
 * cinnamon_xfixes_cursor_get_for_stage:
 * @stage: (transfer none): The #ClutterStage to get the cursor for
 *
 * Return value: (transfer none): A #CinnamonXFixesCursor instance
 */
CinnamonXFixesCursor *
cinnamon_xfixes_cursor_get_for_stage (ClutterStage *stage)
{
  CinnamonXFixesCursor *instance;
  static GQuark xfixes_cursor_quark;

  if (G_UNLIKELY (xfixes_cursor_quark == 0))
    xfixes_cursor_quark = g_quark_from_static_string ("cinnamon-xfixes-cursor");

  instance = g_object_get_qdata (G_OBJECT (stage), xfixes_cursor_quark);

  if (instance == NULL)
    {
      instance = g_object_new (CINNAMON_TYPE_XFIXES_CURSOR,
                               "stage", stage,
                               NULL);
      g_object_set_qdata (G_OBJECT (stage), xfixes_cursor_quark, instance);
    }

  return instance;
}

/**
 * cinnamon_xfixes_cursor_hide:
 * @xfixes_cursor: the #CinnamonXFixesCursor
 *
 * Hide the system mouse cursor.
 */
void
cinnamon_xfixes_cursor_hide (CinnamonXFixesCursor *xfixes_cursor)
{
  g_return_if_fail (CINNAMON_IS_XFIXES_CURSOR (xfixes_cursor));

  xfixes_cursor_hide (xfixes_cursor);
}

/**
 * cinnamon_xfixes_cursor_show:
 * @xfixes_cursor: the #CinnamonXFixesCursor
 *
 * Show the system mouse cursor to show
 */
void
cinnamon_xfixes_cursor_show (CinnamonXFixesCursor *xfixes_cursor)
{
  g_return_if_fail (CINNAMON_IS_XFIXES_CURSOR (xfixes_cursor));

  xfixes_cursor_show (xfixes_cursor);
}

/**
 * cinnamon_xfixes_cursor_update_texture_image:
 * @xfixes_cursor:  the #CinnamonXFixesCursor
 * @texture:        ClutterTexture to update with the current sprite image.
 */
void
cinnamon_xfixes_cursor_update_texture_image (CinnamonXFixesCursor *xfixes_cursor,
                                          ClutterTexture *texture)
{
    CoglHandle *old_sprite;
    g_return_if_fail (CINNAMON_IS_XFIXES_CURSOR (xfixes_cursor));

    if (texture == NULL)
        return;

    old_sprite = clutter_texture_get_cogl_texture (texture);
    if (xfixes_cursor->cursor_sprite == old_sprite)
        return;

    clutter_texture_set_cogl_texture (texture, xfixes_cursor->cursor_sprite);
}

/**
 * cinnamon_xfixes_cursor_get_hot_x:
 * @xfixes_cursor: the #CinnamonXFixesCursor
 *
 * Returns: the current mouse cursor's hot x-coordinate.
 */
int
cinnamon_xfixes_cursor_get_hot_x (CinnamonXFixesCursor *xfixes_cursor)
{
  g_return_val_if_fail (CINNAMON_IS_XFIXES_CURSOR (xfixes_cursor), 0);

  return xfixes_cursor->cursor_hot_x;
}

/**
 * cinnamon_xfixes_cursor_get_hot_y:
 * @xfixes_cursor: the #CinnamonXFixesCursor
 *
 * Returns: the current mouse cursor's hot y-coordinate.
 */
int
cinnamon_xfixes_cursor_get_hot_y (CinnamonXFixesCursor *xfixes_cursor)
{
  g_return_val_if_fail (CINNAMON_IS_XFIXES_CURSOR (xfixes_cursor), 0);

  return xfixes_cursor->cursor_hot_y;
}
