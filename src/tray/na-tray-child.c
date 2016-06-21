/* na-tray-child.c
 * Copyright (C) 2002 Anders Carlsson <andersca@gnu.org>
 * Copyright (C) 2003-2006 Vincent Untz
 * Copyright (C) 2008 Red Hat, Inc.
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the
 * Free Software Foundation, Inc., 51 Franklin Street - Suite 500,
 * Boston, MA 02110-1335, USA.
 */

#include <config.h>
#include <string.h>

#include "na-tray-child.h"

#include <gdk/gdk.h>
#include <gdk/gdkx.h>
#include <X11/Xatom.h>

G_DEFINE_TYPE (NaTrayChild, na_tray_child, GTK_TYPE_SOCKET)

static void
na_tray_child_finalize (GObject *object)
{
  G_OBJECT_CLASS (na_tray_child_parent_class)->finalize (object);
}

static void
na_tray_child_realize (GtkWidget *widget)
{
  NaTrayChild *child = NA_TRAY_CHILD (widget);
  GdkVisual *visual = gtk_widget_get_visual (widget);
  GdkWindow *window;

  GTK_WIDGET_CLASS (na_tray_child_parent_class)->realize (widget);

  window = gtk_widget_get_window (widget);

  if (child->has_alpha)
    {
      /* We have real transparency with an ARGB visual and the Composite
       * extension. */

      /* Set a transparent background */
      cairo_pattern_t *transparent = cairo_pattern_create_rgba (0, 0, 0, 0);
      gdk_window_set_background_pattern (window, transparent);
      gdk_window_set_composited (window, TRUE);
      cairo_pattern_destroy (transparent);

      child->parent_relative_bg = FALSE;
    }
  else if (visual == gdk_window_get_visual (gdk_window_get_parent (window)))
    {
      /* Otherwise, if the visual matches the visual of the parent window, we
       * can use a parent-relative background and fake transparency. */
      gdk_window_set_background_pattern (window, NULL);

      child->parent_relative_bg = TRUE;
    }
  else
    {
      /* Nothing to do; the icon will sit on top of an ugly gray box */
      child->parent_relative_bg = FALSE;
    }

  gdk_window_set_composited (window, child->composited);

  gtk_widget_set_app_paintable (GTK_WIDGET (child),
                                child->parent_relative_bg || child->has_alpha);

  /* Double-buffering will interfere with the parent-relative-background fake
   * transparency, since the double-buffer code doesn't know how to fill in the
   * background of the double-buffer correctly.
   */
  gtk_widget_set_double_buffered (GTK_WIDGET (child),
                                  child->parent_relative_bg);
}

static void
na_tray_child_style_set (GtkWidget *widget,
                         GtkStyle  *previous_style)
{
  /* The default handler resets the background according to the new style.
   * We either use a transparent background or a parent-relative background
   * and ignore the style background. So, just don't chain up.
   */
}

#define SIZE_BASELINE 24

static void
na_tray_child_get_preferred_height (GtkWidget      *widget,
                                  gint *min_size,
                                  gint *natural_size)
{
    gint scaled_size = SIZE_BASELINE * NA_TRAY_CHILD (widget)->scale;
    *min_size = scaled_size;
    *natural_size = scaled_size;
}

static void
na_tray_child_get_preferred_width (GtkWidget      *widget,
                                  gint *min_size,
                                  gint *natural_size)
{
    gint scaled_size = SIZE_BASELINE * NA_TRAY_CHILD (widget)->scale;
    *min_size = scaled_size;
    *natural_size = scaled_size;
}

static void
na_tray_child_size_allocate (GtkWidget      *widget,
                             GtkAllocation  *allocation)
{
  NaTrayChild *child = NA_TRAY_CHILD (widget);
  GtkAllocation widget_allocation;
  gboolean moved, resized;

  gtk_widget_get_allocation (widget, &widget_allocation);

  moved = (allocation->x != widget_allocation.x ||
	   allocation->y != widget_allocation.y);
  resized = (allocation->width != widget_allocation.width ||
	     allocation->height != widget_allocation.height);

  /* When we are allocating the widget while mapped we need special handling
   * for both real and fake transparency.
   *
   * Real transparency: we need to invalidate and trigger a redraw of the old
   *   and new areas. (GDK really should handle this for us, but doesn't as of
   *   GTK+-2.14)
   *
   * Fake transparency: if the widget moved, we need to force the contents to
   *   be redrawn with the new offset for the parent-relative background.
   */
  if ((moved || resized) && gtk_widget_get_mapped (widget))
    {
      if (na_tray_child_has_alpha (child))
        gdk_window_invalidate_rect (gdk_window_get_parent (gtk_widget_get_window (widget)),
                                    &widget_allocation, FALSE);
    }

  GTK_WIDGET_CLASS (na_tray_child_parent_class)->size_allocate (widget,
                                                                allocation);

  if ((moved || resized) && gtk_widget_get_mapped (widget))
    {
      if (na_tray_child_has_alpha (NA_TRAY_CHILD (widget)))
        gdk_window_invalidate_rect (gdk_window_get_parent (gtk_widget_get_window (widget)),
                                    &widget_allocation, FALSE);
      else if (moved && child->parent_relative_bg)
        na_tray_child_force_redraw (child);
    }
}

/* The plug window should completely occupy the area of the child, so we won't
 * get a draw event. But in case we do (the plug unmaps itself, say), this
 * draw handler draws with real or fake transparency.
 */
static gboolean
na_tray_child_draw (GtkWidget *widget,
                    cairo_t   *cr)
{
  NaTrayChild *child = NA_TRAY_CHILD (widget);

  if (na_tray_child_has_alpha (child))
    {
      /* Clear to transparent */
      cairo_set_source_rgba (cr, 0, 0, 0, 0);
      cairo_set_operator (cr, CAIRO_OPERATOR_SOURCE);
      cairo_paint (cr);
    }
  else if (child->parent_relative_bg)
    {
      GdkWindow *window;
      cairo_surface_t *target;
      GdkRectangle clip_rect;

      window = gtk_widget_get_window (widget);
      target = cairo_get_group_target (cr);

      gdk_cairo_get_clip_rectangle (cr, &clip_rect);

      /* Clear to parent-relative pixmap
       * We need to use direct X access here because GDK doesn't know about
       * the parent relative pixmap. */
      cairo_surface_flush (target);

      XClearArea (GDK_WINDOW_XDISPLAY (window),
                  GDK_WINDOW_XID (window),
                  clip_rect.x, clip_rect.y,
                  clip_rect.width, clip_rect.height,
                  False);
      cairo_surface_mark_dirty_rectangle (target,
                                          clip_rect.x, clip_rect.y,
                                          clip_rect.width, clip_rect.height);
    }

  return FALSE;
}

static void
na_tray_child_init (NaTrayChild *child)
{
    child->scale = 1;
}

static void
na_tray_child_class_init (NaTrayChildClass *klass)
{
  GObjectClass *gobject_class;
  GtkWidgetClass *widget_class;

  gobject_class = (GObjectClass *)klass;
  widget_class = (GtkWidgetClass *)klass;

  gobject_class->finalize = na_tray_child_finalize;
  widget_class->style_set = na_tray_child_style_set;
  widget_class->realize = na_tray_child_realize;
  widget_class->size_allocate = na_tray_child_size_allocate;
  widget_class->draw = na_tray_child_draw;
  widget_class->get_preferred_height = na_tray_child_get_preferred_height;
  widget_class->get_preferred_width = na_tray_child_get_preferred_width;
}

GtkWidget *
na_tray_child_new (GdkScreen *screen,
                   Window     icon_window,
                   gint       scale)
{
  XWindowAttributes window_attributes;
  Display *xdisplay;
  NaTrayChild *child;
  GdkVisual *visual;
  gboolean visual_has_alpha;
  int red_prec, green_prec, blue_prec, depth;
  int result;

  g_return_val_if_fail (GDK_IS_SCREEN (screen), NULL);
  g_return_val_if_fail (icon_window != None, NULL);

  xdisplay = GDK_SCREEN_XDISPLAY (screen);

  /* We need to determine the visual of the window we are embedding and create
   * the socket in the same visual.
   */

  gdk_error_trap_push ();
  result = XGetWindowAttributes (xdisplay, icon_window,
                                 &window_attributes);
  gdk_error_trap_pop_ignored ();

  if (!result) /* Window already gone */
    return NULL;

  visual = gdk_x11_screen_lookup_visual (screen,
                                         window_attributes.visual->visualid);
  if (!visual) /* Icon window is on another screen? */
    return NULL;

  child = g_object_new (NA_TYPE_TRAY_CHILD, NULL);
  child->icon_window = icon_window;
  child->scale = scale;

  gtk_widget_set_visual (GTK_WIDGET (child), visual);

  /* We have alpha if the visual has something other than red, green,
   * and blue */
  gdk_visual_get_red_pixel_details (visual, NULL, NULL, &red_prec);
  gdk_visual_get_green_pixel_details (visual, NULL, NULL, &green_prec);
  gdk_visual_get_blue_pixel_details (visual, NULL, NULL, &blue_prec);
  depth = gdk_visual_get_depth (visual);

  visual_has_alpha = red_prec + blue_prec + green_prec < depth;
  child->has_alpha = (visual_has_alpha &&
                      gdk_display_supports_composite (gdk_screen_get_display (screen)));

  child->composited = child->has_alpha;

  return GTK_WIDGET (child);
}

char *
na_tray_child_get_title (NaTrayChild *child)
{
  char *retval = NULL;
  GdkDisplay *display;
  Atom utf8_string, atom, type;
  int result;
  int format;
  gulong nitems;
  gulong bytes_after;
  gchar *val;

  g_return_val_if_fail (NA_IS_TRAY_CHILD (child), NULL);

  display = gtk_widget_get_display (GTK_WIDGET (child));

  utf8_string = gdk_x11_get_xatom_by_name_for_display (display, "UTF8_STRING");
  atom = gdk_x11_get_xatom_by_name_for_display (display, "_NET_WM_NAME");

  gdk_error_trap_push ();

  result = XGetWindowProperty (GDK_DISPLAY_XDISPLAY (display),
                               child->icon_window,
                               atom,
                               0, G_MAXLONG,
                               False, utf8_string,
                               &type, &format, &nitems,
                               &bytes_after, (guchar **)&val);
  
  if (gdk_error_trap_pop () || result != Success)
    return NULL;

  if (type != utf8_string ||
      format != 8 ||
      nitems == 0)
    {
      if (val)
        XFree (val);
      return NULL;
    }

  if (!g_utf8_validate (val, nitems, NULL))
    {
      XFree (val);
      return NULL;
    }

  retval = g_strndup (val, nitems);

  XFree (val);

  return retval;
}

/**
 * na_tray_child_has_alpha;
 * @child: a #NaTrayChild
 *
 * Checks if the child has an ARGB visual and real alpha transparence.
 * (as opposed to faked alpha transparency with an parent-relative
 * background)
 *
 * Return value: %TRUE if the child has an alpha transparency
 */
gboolean
na_tray_child_has_alpha (NaTrayChild *child)
{
  g_return_val_if_fail (NA_IS_TRAY_CHILD (child), FALSE);

  return child->has_alpha;
}

/**
 * na_tray_child_set_composited;
 * @child: a #NaTrayChild
 * @composited: %TRUE if the child's window should be redirected
 *
 * Sets whether the #GdkWindow of the child should be set redirected
 * using gdk_window_set_composited(). By default this is based off of
 * na_tray_child_has_alpha(), but it may be useful to override it in
 * certain circumstances; for example, if the #NaTrayChild is added
 * to a parent window and that parent window is composited against the
 * background.
 */
void
na_tray_child_set_composited (NaTrayChild *child,
                              gboolean     composited)
{
  g_return_if_fail (NA_IS_TRAY_CHILD (child));

  if (child->composited == composited)
    return;

  child->composited = composited;
  if (gtk_widget_get_realized (GTK_WIDGET (child)))
    gdk_window_set_composited (gtk_widget_get_window (GTK_WIDGET (child)),
                               composited);
}

/* If we are faking transparency with a window-relative background, force a
 * redraw of the icon. This should be called if the background changes or if
 * the child is shifted with respect to the background.
 */
void
na_tray_child_force_redraw (NaTrayChild *child)
{
  GtkWidget *widget = GTK_WIDGET (child);

  if (gtk_widget_get_mapped (widget) && child->parent_relative_bg)
    {
#if 1
      /* Sending an ExposeEvent might cause redraw problems if the
       * icon is expecting the server to clear-to-background before
       * the redraw. It should be ok for GtkStatusIcon or EggTrayIcon.
       */
      Display *xdisplay = GDK_DISPLAY_XDISPLAY (gtk_widget_get_display (widget));
      XEvent xev;
      GdkWindow *plug_window;
      GtkAllocation allocation;

      plug_window = gtk_socket_get_plug_window (GTK_SOCKET (child));
      gtk_widget_get_allocation (widget, &allocation);

      xev.xexpose.type = Expose;
      xev.xexpose.window = GDK_WINDOW_XID (plug_window);
      xev.xexpose.x = 0;
      xev.xexpose.y = 0;
      xev.xexpose.width = allocation.width;
      xev.xexpose.height = allocation.height;
      xev.xexpose.count = 0;

      gdk_error_trap_push ();
      XSendEvent (xdisplay,
                  xev.xexpose.window,
                  False, ExposureMask,
                  &xev);
      gdk_error_trap_pop_ignored ();
#else
      /* Hiding and showing is the safe way to do it, but can result in more
       * flickering.
       */
      gdk_window_hide (widget->window);
      gdk_window_show (widget->window);
#endif
    }
}

/* from libwnck/xutils.c, comes as LGPLv2+ */
static char *
latin1_to_utf8 (const char *latin1)
{
  GString *str;
  const char *p;

  str = g_string_new (NULL);

  p = latin1;
  while (*p)
    {
      g_string_append_unichar (str, (gunichar) *p);
      ++p;
    }

  return g_string_free (str, FALSE);
}

/* derived from libwnck/xutils.c, comes as LGPLv2+ */
static void
_get_wmclass (Display *xdisplay,
              Window   xwindow,
              char   **res_class,
              char   **res_name)
{
  XClassHint ch;

  ch.res_name = NULL;
  ch.res_class = NULL;

  gdk_error_trap_push ();
  XGetClassHint (xdisplay, xwindow, &ch);
  gdk_error_trap_pop_ignored ();

  if (res_class)
    *res_class = NULL;

  if (res_name)
    *res_name = NULL;

  if (ch.res_name)
    {
      if (res_name)
        *res_name = latin1_to_utf8 (ch.res_name);

      XFree (ch.res_name);
    }

  if (ch.res_class)
    {
      if (res_class)
        *res_class = latin1_to_utf8 (ch.res_class);

      XFree (ch.res_class);
    }
}

/**
 * na_tray_child_get_wm_class;
 * @child: a #NaTrayChild
 * @res_name: return location for a string containing the application name of
 * @child, or %NULL
 * @res_class: return location for a string containing the application class of
 * @child, or %NULL
 *
 * Fetches the resource associated with @child.
 */
void
na_tray_child_get_wm_class (NaTrayChild  *child,
                            char        **res_name,
                            char        **res_class)
{
  GdkDisplay *display;

  g_return_if_fail (NA_IS_TRAY_CHILD (child));

  display = gtk_widget_get_display (GTK_WIDGET (child));

  _get_wmclass (GDK_DISPLAY_XDISPLAY (display),
                child->icon_window,
                res_class,
                res_name);
}
