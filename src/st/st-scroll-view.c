/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-scroll-view.h: Container with scroll-bars
 *
 * Copyright 2008 OpenedHand
 * Copyright 2009 Intel Corporation.
 * Copyright 2009, 2010 Red Hat, Inc.
 * Copyright 2010 Maxim Ermilov
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
 * SECTION:st-scroll-view
 * @short_description: a container for scrollable children
 *
 * #StScrollView is a single child container for actors that implement
 * #StScrollable. It provides scrollbars around the edge of the child to
 * allow the user to move around the scrollable area.
 */

/* TODO: The code here currently only deals with height-for-width
 * allocation; width-for-height allocation would need a second set of
 * code paths through get_preferred_height()/get_preferred_width()/allocate()
 * that reverse the roles of the horizontal and vertical scrollbars.
 *
 * TODO: The multiple layout passes with and without scrollbars when
 * using the automatic policy causes considerable inefficiency because
 * it breaks request caching; we should saved the last size passed
 * into allocate() and if it's the same as previous size not repeat
 * the determination of scrollbar visibility. This requires overriding
 * queue_relayout() so we know when to discard the saved value.
 *
 * The size negotiation between the #StScrollView and the child is
 * described in the documentation for #StScrollable; the significant
 * part to note there is that reported minimum sizes for a scrolled
 * child are the minimum sizes when no scrollbar is needed. This allows
 * us to determine what scrollbars are visible without a need to look
 * inside the #StAdjustment.
 *
 * The second simplification that we make that allows us to implement
 * a straighforward height-for-width negotiation without multiple
 * allocate passes is that when the vertical scrollbar policy is
 * AUTO, we always reserve space for the vertical scrollbar in the
 * reported minimum and natural size.
 *
 * See https://bugzilla.gnome.org/show_bug.cgi?id=611740 for a more
 * detailed description of the considerations involved.
 */

#include "st-scroll-view.h"
#include "st-scroll-bar.h"
#include "st-scrollable.h"
#include "st-scroll-view-fade.h"
#include <clutter/clutter.h>
#include <math.h>

static void clutter_container_iface_init (ClutterContainerIface *iface);

static ClutterContainerIface *st_scroll_view_parent_iface = NULL;

G_DEFINE_TYPE_WITH_CODE (StScrollView, st_scroll_view, ST_TYPE_BIN,
                         G_IMPLEMENT_INTERFACE (CLUTTER_TYPE_CONTAINER,
                                                clutter_container_iface_init))

#define SCROLL_VIEW_PRIVATE(o) (G_TYPE_INSTANCE_GET_PRIVATE ((o), \
                                                             ST_TYPE_SCROLL_VIEW, \
                                                             StScrollViewPrivate))

#define AUTO_SCROLL_POLL_INTERVAL 15

#define AUTO_SCROLL_TOTAL_REGION 100

#define AUTO_SCROLL_OVERLAP 10 /* autoscroll region extends this far into the scroll view
                                * remaining portion of region is above or below the view
                                */

/* gdouble - from 0 to TOTAL_REGION / this number to get scroll delta */
#define AUTO_SCROLL_SPEED_DIVISOR 4.0

struct _StScrollViewPrivate
{
  /* a pointer to the child; this is actually stored
   * inside StBin:child, but we keep it to avoid
   * calling st_bin_get_child() every time we need it
   */
  ClutterActor *child;

  StAdjustment *hadjustment;
  ClutterActor *hscroll;
  StAdjustment *vadjustment;
  ClutterActor *vscroll;
  ClutterInputDevice *mouse_pointer;

  GtkPolicyType hscrollbar_policy;
  GtkPolicyType vscrollbar_policy;

  gfloat        row_size;
  gfloat        column_size;

  GSettings *settings;
  gint setting_connect_id;

  StScrollViewFade *vfade_effect;

  gboolean      row_size_set : 1;
  gboolean      column_size_set : 1;
  guint         mouse_scroll : 1;
  guint         hscrollbar_visible : 1;
  guint         vscrollbar_visible : 1;
  gboolean      auto_scroll : 1;
  guint         auto_scroll_timeout_id;
};

enum {
  PROP_0,

  PROP_HSCROLL,
  PROP_VSCROLL,
  PROP_HSCROLLBAR_POLICY,
  PROP_VSCROLLBAR_POLICY,
  PROP_HSCROLLBAR_VISIBLE,
  PROP_VSCROLLBAR_VISIBLE,
  PROP_MOUSE_SCROLL,
  PROP_AUTO_SCROLL
};

static void
st_scroll_view_get_property (GObject    *object,
                             guint       property_id,
                             GValue     *value,
                             GParamSpec *pspec)
{
  StScrollViewPrivate *priv = ((StScrollView *) object)->priv;

  switch (property_id)
    {
    case PROP_HSCROLL:
      g_value_set_object (value, priv->hscroll);
      break;
    case PROP_VSCROLL:
      g_value_set_object (value, priv->vscroll);
      break;
    case PROP_HSCROLLBAR_POLICY:
      g_value_set_enum (value, priv->hscrollbar_policy);
      break;
    case PROP_VSCROLLBAR_POLICY:
      g_value_set_enum (value, priv->vscrollbar_policy);
      break;
    case PROP_HSCROLLBAR_VISIBLE:
      g_value_set_boolean (value, priv->hscrollbar_visible);
      break;
    case PROP_VSCROLLBAR_VISIBLE:
      g_value_set_boolean (value, priv->vscrollbar_visible);
      break;
    case PROP_MOUSE_SCROLL:
      g_value_set_boolean (value, priv->mouse_scroll);
      break;
    case PROP_AUTO_SCROLL:
      g_value_set_boolean (value, priv->auto_scroll);
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
    }
}

/**
 * st_scroll_view_update_vfade_effect:
 * @self: a #StScrollView
 * @fade_offset: The length of the fade effect, in pixels.
 *
 * Sets the height of the fade area area in pixels. A value of 0
 * disables the effect.
 */
static void
st_scroll_view_update_vfade_effect (StScrollView *self,
                                    float fade_offset)
{
  StScrollViewPrivate *priv = ST_SCROLL_VIEW (self)->priv;

  /* A fade amount of more than 0 enables the effect. */
  if (fade_offset > 0.)
    {
      if (priv->vfade_effect == NULL) {
        priv->vfade_effect = g_object_new (ST_TYPE_SCROLL_VIEW_FADE, NULL);

        clutter_actor_add_effect_with_name (CLUTTER_ACTOR (self), "vfade",
                                            CLUTTER_EFFECT (priv->vfade_effect));
      }

      g_object_set (priv->vfade_effect,
                    "fade-offset", fade_offset,
                    NULL);
    }
   else
    {
      if (priv->vfade_effect != NULL) {
        clutter_actor_remove_effect (CLUTTER_ACTOR (self), CLUTTER_EFFECT (priv->vfade_effect));
        priv->vfade_effect = NULL;
      }
    }

  clutter_actor_queue_redraw (CLUTTER_ACTOR (self));
}

static gboolean
get_sub_region_y (gint   mouse_y,
                  gfloat box_y,
                  gfloat height,
                  gint   *sub_region)
{
    gboolean up = mouse_y < (box_y + (height / 2));

    gfloat real_y_upper_limit = box_y + AUTO_SCROLL_OVERLAP - AUTO_SCROLL_TOTAL_REGION;
    gfloat real_y_lower_limit = box_y + height - AUTO_SCROLL_OVERLAP + AUTO_SCROLL_TOTAL_REGION;

    if (up) {
        *sub_region = (real_y_upper_limit + AUTO_SCROLL_TOTAL_REGION) - mouse_y;
    } else {
        *sub_region = mouse_y - (real_y_lower_limit - AUTO_SCROLL_TOTAL_REGION);
    }
    return up;
}

static void
calculate_and_scroll (ClutterActor  *self,
                             gint    mouse_x,
                             gint    mouse_y,
                             gfloat  box_x,
                             gfloat  box_y,
                             gfloat  width,
                             gfloat  height)
{
    StScrollViewPrivate *priv = ST_SCROLL_VIEW (self)->priv;
    gboolean up;
    gint sub_region;
    gdouble delta, vvalue;

    up = get_sub_region_y (mouse_y, box_y, height, &sub_region);

    if (up)
        delta = sub_region * -1.0 / AUTO_SCROLL_SPEED_DIVISOR;
    else
        delta = sub_region / AUTO_SCROLL_SPEED_DIVISOR;

    g_object_get (priv->vadjustment,
                    "value", &vvalue,
                    NULL);
    st_adjustment_set_value (priv->vadjustment, vvalue + delta);
}

static void
get_pointer_and_view_coords (ClutterActor *self,
                             gint         *mouse_x,
                             gint         *mouse_y,
                             gfloat       *box_x,
                             gfloat       *box_y,
                             gfloat       *width,
                             gfloat       *height)
{
    StScrollViewPrivate *priv = ST_SCROLL_VIEW (self)->priv;

    clutter_input_device_get_device_coords (priv->mouse_pointer, mouse_x, mouse_y);
    clutter_actor_get_transformed_position (self, box_x, box_y);
    clutter_actor_get_transformed_size (self, width, height);
}

static gboolean
is_in_auto_scroll_regions (gint   mouse_x,
                           gint   mouse_y,
                           gfloat box_x,
                           gfloat box_y,
                           gfloat width,
                           gfloat height)
{

    gfloat real_y_upper_limit = box_y + AUTO_SCROLL_OVERLAP - AUTO_SCROLL_TOTAL_REGION;
    gfloat real_y_lower_limit = box_y + height - AUTO_SCROLL_OVERLAP + AUTO_SCROLL_TOTAL_REGION;

    if (mouse_x < box_x || mouse_x > box_x + width)
        return FALSE;

    if (((mouse_y < real_y_upper_limit + AUTO_SCROLL_TOTAL_REGION) && (mouse_y > real_y_upper_limit))
        || ((mouse_y > real_y_lower_limit - AUTO_SCROLL_TOTAL_REGION) && (mouse_y < real_y_lower_limit))) {
        return TRUE;
    } else {
        return FALSE;
    }
}

static gboolean
do_auto_scroll (ClutterActor *self)
{


    StScrollViewPrivate *priv = ST_SCROLL_VIEW (self)->priv;
    gfloat box_x, box_y, width, height;
    gint mouse_x, mouse_y;

    get_pointer_and_view_coords (self, &mouse_x, &mouse_y, &box_x, &box_y, &width, &height);

    if (is_in_auto_scroll_regions (mouse_x, mouse_y, box_x, box_y, width, height)) {
        calculate_and_scroll (self, mouse_x, mouse_y, box_x, box_y, width, height);
        return TRUE;
    } else {
        priv->auto_scroll_timeout_id = 0;
        return FALSE;
    }
}

static void
motion_event_cb (ClutterActor *self,
                 ClutterMotionEvent *event,
                 gpointer data)
{
    StScrollViewPrivate *priv = ST_SCROLL_VIEW (self)->priv;
    gfloat box_x, box_y, width, height;
    gint mouse_x, mouse_y;

    if (priv->auto_scroll_timeout_id > 0)
        return;

    get_pointer_and_view_coords (self, &mouse_x, &mouse_y, &box_x, &box_y, &width, &height);

    if (is_in_auto_scroll_regions (mouse_x, mouse_y, box_x, box_y, width, height)) {
        priv->auto_scroll_timeout_id = g_timeout_add (AUTO_SCROLL_POLL_INTERVAL, (GSourceFunc) do_auto_scroll, self);
    }
}

static void
st_scroll_view_set_property (GObject      *object,
                             guint         property_id,
                             const GValue *value,
                             GParamSpec   *pspec)
{
  StScrollView *self = ST_SCROLL_VIEW (object);
  StScrollViewPrivate *priv = self->priv;

  switch (property_id)
    {
    case PROP_MOUSE_SCROLL:
      st_scroll_view_set_mouse_scrolling (self,
                                          g_value_get_boolean (value));
      break;
    case PROP_HSCROLLBAR_POLICY:
      st_scroll_view_set_policy (self,
                                 g_value_get_enum (value),
                                 priv->vscrollbar_policy);
      break;
    case PROP_VSCROLLBAR_POLICY:
      st_scroll_view_set_policy (self,
                                 priv->hscrollbar_policy,
                                 g_value_get_enum (value));
      break;
    case PROP_AUTO_SCROLL:
      st_scroll_view_set_auto_scrolling (self,
                                         g_value_get_boolean (value));
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
    }
}

static void
st_scroll_view_dispose (GObject *object)
{
  StScrollViewPrivate *priv = ST_SCROLL_VIEW (object)->priv;

  if (priv->vfade_effect)
    {
      clutter_actor_remove_effect (CLUTTER_ACTOR (object), CLUTTER_EFFECT (priv->vfade_effect));
      priv->vfade_effect = NULL;
    }

  if (priv->vscroll)
    clutter_actor_destroy (priv->vscroll);

  if (priv->hscroll)
    clutter_actor_destroy (priv->hscroll);

  /* For most reliable freeing of memory, an object with signals
   * like StAdjustment should be explicitly disposed. Since we own
   * the adjustments, we take care of that. This also disconnects
   * the signal handlers that we established on creation.
   */
  if (priv->hadjustment)
    {
      g_object_run_dispose (G_OBJECT (priv->hadjustment));
      g_object_unref (priv->hadjustment);
      priv->hadjustment = NULL;
    }

  if (priv->vadjustment)
    {
      g_object_run_dispose (G_OBJECT (priv->vadjustment));
      g_object_unref (priv->vadjustment);
      priv->vadjustment = NULL;
    }

  if (priv->setting_connect_id > 0) {
    g_signal_handler_disconnect (priv->settings, priv->setting_connect_id);
    priv->setting_connect_id = 0;
  }

  g_signal_handlers_disconnect_by_func (ST_SCROLL_VIEW (object), motion_event_cb, ST_SCROLL_VIEW (object));

  G_OBJECT_CLASS (st_scroll_view_parent_class)->dispose (object);
}

static void
st_scroll_view_paint (ClutterActor *actor)
{
  StScrollViewPrivate *priv = ST_SCROLL_VIEW (actor)->priv;

  /* StBin will paint the child */
  CLUTTER_ACTOR_CLASS (st_scroll_view_parent_class)->paint (actor);

  /* paint our custom children */
  if (priv->hscrollbar_visible)
    clutter_actor_paint (priv->hscroll);
  if (priv->vscrollbar_visible)
    clutter_actor_paint (priv->vscroll);
}

static void
st_scroll_view_pick (ClutterActor       *actor,
                     const ClutterColor *color)
{
  StScrollViewPrivate *priv = ST_SCROLL_VIEW (actor)->priv;

  /* Chain up so we get a bounding box pained (if we are reactive) */
  CLUTTER_ACTOR_CLASS (st_scroll_view_parent_class)->pick (actor, color);

  /* paint our custom children */
  if (priv->hscrollbar_visible)
    clutter_actor_paint (priv->hscroll);
  if (priv->vscrollbar_visible)
    clutter_actor_paint (priv->vscroll);
}

static double
get_scrollbar_width (StScrollView *scroll,
                     gfloat        for_height)
{
  StScrollViewPrivate *priv = scroll->priv;

  if (CLUTTER_ACTOR_IS_VISIBLE (priv->vscroll))
    {
      gfloat min_size;

      clutter_actor_get_preferred_width (CLUTTER_ACTOR (priv->vscroll), for_height,
                                         &min_size, NULL);
      return min_size;
    }
  else
    return 0;
}

static double
get_scrollbar_height (StScrollView *scroll,
                      gfloat        for_width)
{
  StScrollViewPrivate *priv = scroll->priv;

  if (CLUTTER_ACTOR_IS_VISIBLE (priv->hscroll))
    {
      gfloat min_size;

      clutter_actor_get_preferred_height (CLUTTER_ACTOR (priv->hscroll), for_width,
                                          &min_size, NULL);

      return min_size;
    }
  else
    return 0;
}

static void
st_scroll_view_get_preferred_width (ClutterActor *actor,
                                    gfloat        for_height,
                                    gfloat       *min_width_p,
                                    gfloat       *natural_width_p)
{
  StScrollViewPrivate *priv = ST_SCROLL_VIEW (actor)->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  gfloat min_width = 0, natural_width;
  gfloat child_min_width, child_natural_width;

  if (!priv->child)
    return;

  st_theme_node_adjust_for_height (theme_node, &for_height);

  clutter_actor_get_preferred_width (priv->child, -1,
                                     &child_min_width, &child_natural_width);

  natural_width = child_natural_width;

  switch (priv->hscrollbar_policy)
    {
    case GTK_POLICY_NEVER:
      min_width = child_min_width;
      break;
    case GTK_POLICY_ALWAYS:
    case GTK_POLICY_AUTOMATIC:
      /* Should theoretically use the min width of the hscrollbar,
       * but that's not cleanly defined at the moment */
      min_width = 0;
      break;
    }

  if (priv->vscrollbar_policy != GTK_POLICY_NEVER)
    {
      float sb_width = get_scrollbar_width (ST_SCROLL_VIEW (actor), for_height);

      min_width += sb_width;
      natural_width += sb_width;
    }

  if (min_width_p)
    *min_width_p = min_width;

  if (natural_width_p)
    *natural_width_p = natural_width;

  st_theme_node_adjust_preferred_width (theme_node, min_width_p, natural_width_p);
}

static void
st_scroll_view_get_preferred_height (ClutterActor *actor,
                                     gfloat        for_width,
                                     gfloat       *min_height_p,
                                     gfloat       *natural_height_p)
{
  StScrollViewPrivate *priv = ST_SCROLL_VIEW (actor)->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));
  gboolean account_for_hscrollbar = FALSE;
  gfloat min_height = 0, natural_height;
  gfloat child_min_height, child_natural_height;
  gfloat child_min_width;
  gfloat sb_width;

  if (!priv->child)
    return;

  st_theme_node_adjust_for_width (theme_node, &for_width);

  clutter_actor_get_preferred_width (priv->child, -1,
                                     &child_min_width, NULL);

  if (min_height_p)
    *min_height_p = 0;

  sb_width = get_scrollbar_width (ST_SCROLL_VIEW (actor), -1);

  switch (priv->vscrollbar_policy)
    {
    case GTK_POLICY_NEVER:
      break;
    case GTK_POLICY_ALWAYS:
    case GTK_POLICY_AUTOMATIC:
      /* We've requested space for the scrollbar, subtract it back out */
      for_width -= sb_width;
      break;
    }

  switch (priv->hscrollbar_policy)
    {
    case GTK_POLICY_NEVER:
      account_for_hscrollbar = FALSE;
      break;
    case GTK_POLICY_ALWAYS:
      account_for_hscrollbar = TRUE;
      break;
    case GTK_POLICY_AUTOMATIC:
      account_for_hscrollbar = for_width < child_min_width;
      break;
    }

  clutter_actor_get_preferred_height (priv->child, for_width,
                                      &child_min_height, &child_natural_height);

  natural_height = child_natural_height;

  switch (priv->vscrollbar_policy)
    {
    case GTK_POLICY_NEVER:
      min_height = child_min_height;
      break;
    case GTK_POLICY_ALWAYS:
    case GTK_POLICY_AUTOMATIC:
      /* Should theoretically use the min height of the vscrollbar,
       * but that's not cleanly defined at the moment */
      min_height = 0;
      break;
    }

  if (account_for_hscrollbar)
    {
      float sb_height = get_scrollbar_height (ST_SCROLL_VIEW (actor), for_width);

      min_height += sb_height;
      natural_height += sb_height;
    }

  if (min_height_p)
    *min_height_p = min_height;

  if (natural_height_p)
    *natural_height_p = natural_height;

  st_theme_node_adjust_preferred_height (theme_node, min_height_p, natural_height_p);
}

static void
st_scroll_view_allocate (ClutterActor          *actor,
                         const ClutterActorBox *box,
                         ClutterAllocationFlags flags)
{
  ClutterActorBox content_box, child_box;
  ClutterActorClass *parent_parent_class;
  gfloat avail_width, avail_height, sb_width, sb_height;
  gboolean hscrollbar_visible, vscrollbar_visible;

  StScrollViewPrivate *priv = ST_SCROLL_VIEW (actor)->priv;
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (actor));

  /* Chain up to the parent's parent class
   *
   * We do this because we do not want StBin to allocate the child, as we
   * give it a different allocation later, depending on whether the scrollbars
   * are visible
   */
  parent_parent_class
    = g_type_class_peek_parent (st_scroll_view_parent_class);

  CLUTTER_ACTOR_CLASS (parent_parent_class)->
  allocate (actor, box, flags);

  st_theme_node_get_content_box (theme_node, box, &content_box);

  avail_width = content_box.x2 - content_box.x1;
  avail_height = content_box.y2 - content_box.y1;

  if (clutter_actor_get_request_mode (actor) == CLUTTER_REQUEST_HEIGHT_FOR_WIDTH)
    {
      sb_width = get_scrollbar_width (ST_SCROLL_VIEW (actor), -1);
      sb_height = get_scrollbar_height (ST_SCROLL_VIEW (actor), sb_width);
    }
  else
    {
      sb_height = get_scrollbar_height (ST_SCROLL_VIEW (actor), -1);
      sb_width = get_scrollbar_width (ST_SCROLL_VIEW (actor), sb_height);
    }

  /* Determine what scrollbars are visible. The basic idea of the
   * handling of an automatic scrollbars is that we start off with the
   * assumption that we don't need any scrollbars, see if that works,
   * and if not add horizontal and vertical scrollbars until we are no
   * longer overflowing.
   */
  if (priv->child)
    {
      gfloat child_min_width;
      gfloat child_min_height;

      clutter_actor_get_preferred_width (priv->child, -1,
                                         &child_min_width, NULL);

      if (priv->vscrollbar_policy == GTK_POLICY_AUTOMATIC)
        {
          if (priv->hscrollbar_policy == GTK_POLICY_AUTOMATIC)
            {
              /* Pass one, try without a vertical scrollbar */
              clutter_actor_get_preferred_height (priv->child, avail_width, &child_min_height, NULL);
              vscrollbar_visible = child_min_height > avail_height;
              hscrollbar_visible = child_min_width > avail_width - (vscrollbar_visible ? sb_width : 0);
              vscrollbar_visible = child_min_height > avail_height - (hscrollbar_visible ? sb_height : 0);

              /* Pass two - if we needed a vertical scrollbar, get a new preferred height */
              if (vscrollbar_visible)
                {
                  clutter_actor_get_preferred_height (priv->child, MAX (avail_width - sb_width, 0),
                                                      &child_min_height, NULL);
                  hscrollbar_visible = child_min_width > avail_width - sb_width;
                }
            }
          else
            {
              hscrollbar_visible = priv->hscrollbar_policy != GTK_POLICY_NEVER;

              /* try without a vertical scrollbar */
              clutter_actor_get_preferred_height (priv->child, avail_width, &child_min_height, NULL);
              vscrollbar_visible = child_min_height > avail_height - (hscrollbar_visible ? sb_height : 0);
            }
        }
      else
        {
          vscrollbar_visible = priv->vscrollbar_policy != GTK_POLICY_NEVER;

          if (priv->hscrollbar_policy == GTK_POLICY_AUTOMATIC)
            hscrollbar_visible = child_min_width > avail_height - (vscrollbar_visible ? 0 : sb_width);
          else
            hscrollbar_visible = priv->hscrollbar_policy != GTK_POLICY_NEVER;
        }
    }
  else
    {
      hscrollbar_visible = priv->hscrollbar_policy != GTK_POLICY_NEVER;
      vscrollbar_visible = priv->vscrollbar_policy != GTK_POLICY_NEVER;
    }

  /* Whether or not we show the scrollbars, if the scrollbars are visible
   * actors, we need to give them some allocation, so we unconditionally
   * give them the "right" allocation; that might overlap the child when
   * the scrollbars are not visible, but it doesn't matter because we
   * don't include them in pick or paint.
   */

  /* Vertical scrollbar */
  if (CLUTTER_ACTOR_IS_VISIBLE (priv->vscroll))
    {
      if (st_widget_get_direction (ST_WIDGET (actor)) == ST_TEXT_DIRECTION_RTL)
        {
          child_box.x1 = content_box.x1;
          child_box.x2 = content_box.x1 + sb_width;
        }
      else
        {
          child_box.x1 = content_box.x2 - sb_width;
          child_box.x2 = content_box.x2;
        }
      child_box.y1 = content_box.y1;
      child_box.y2 = content_box.y2 - (hscrollbar_visible ? sb_height : 0);

      clutter_actor_allocate (priv->vscroll, &child_box, flags);
    }

  /* Horizontal scrollbar */
  if (CLUTTER_ACTOR_IS_VISIBLE (priv->hscroll))
    {
      if (st_widget_get_direction (ST_WIDGET (actor)) == ST_TEXT_DIRECTION_RTL)
        {
          child_box.x1 = content_box.x1 + (vscrollbar_visible ? sb_width : 0);
          child_box.x2 = content_box.x2;
        }
      else
        {
          child_box.x1 = content_box.x1;
          child_box.x2 = content_box.x2 - (vscrollbar_visible ? sb_width : 0);
        }
      child_box.y1 = content_box.y2 - sb_height;
      child_box.y2 = content_box.y2;

      clutter_actor_allocate (priv->hscroll, &child_box, flags);
    }

  /* Now fold visibility into the scrollbar sizes to simplify the rest
   * of the computations.
   */
  if (!hscrollbar_visible)
    sb_height = 0;
  if (!vscrollbar_visible)
    sb_width = 0;

  /* Child */
  if (st_widget_get_direction (ST_WIDGET (actor)) == ST_TEXT_DIRECTION_RTL)
    {
      child_box.x1 = content_box.x1 + sb_width;
      child_box.x2 = content_box.x2;
    }
  else
    {
      child_box.x1 = content_box.x1;
      child_box.x2 = content_box.x2 - sb_width;
    }
  child_box.y1 = content_box.y1;
  child_box.y2 = content_box.y2 - sb_height;

  if (priv->child)
    clutter_actor_allocate (priv->child, &child_box, flags);

  if (priv->hscrollbar_visible != hscrollbar_visible)
    {
      g_object_freeze_notify (G_OBJECT (actor));
      priv->hscrollbar_visible = hscrollbar_visible;
      g_object_notify (G_OBJECT (actor), "hscrollbar-visible");
      g_object_thaw_notify (G_OBJECT (actor));
    }

  if (priv->vscrollbar_visible != vscrollbar_visible)
    {
      g_object_freeze_notify (G_OBJECT (actor));
      priv->vscrollbar_visible = vscrollbar_visible;
      g_object_notify (G_OBJECT (actor), "vscrollbar-visible");
      g_object_thaw_notify (G_OBJECT (actor));
    }

}

static void
st_scroll_view_style_changed (StWidget *widget)
{
  StScrollView *self = ST_SCROLL_VIEW (widget);
  StScrollViewPrivate *priv = self->priv;

  StThemeNode *theme_node = st_widget_get_theme_node (widget);
  gdouble fade_offset = st_theme_node_get_length (theme_node, "-st-vfade-offset");

  gboolean vfade_enabled = g_settings_get_boolean (priv->settings, "enable-vfade");

  if (!vfade_enabled)
    fade_offset = 0;

  st_scroll_view_update_vfade_effect (self, fade_offset);

  st_widget_style_changed (ST_WIDGET (priv->hscroll));
  st_widget_style_changed (ST_WIDGET (priv->vscroll));

  ST_WIDGET_CLASS (st_scroll_view_parent_class)->style_changed (widget);
}

static void
vfade_setting_changed_cb (GSettings *settings, gchar *key, gpointer user_data)
{
    StWidget *widget = ST_WIDGET (user_data);
    g_return_if_fail (ST_IS_SCROLL_VIEW (widget));

    st_scroll_view_style_changed (widget);
}

static gboolean
st_scroll_view_scroll_event (ClutterActor       *self,
                             ClutterScrollEvent *event)
{
  StScrollViewPrivate *priv = ST_SCROLL_VIEW (self)->priv;
  gdouble value, step, hvalue, vvalue, delta_x, delta_y;

  /* don't handle scroll events if requested not to */
  if (!priv->mouse_scroll)
    return FALSE;

  switch (event->direction)
    {
    case CLUTTER_SCROLL_SMOOTH:
      clutter_event_get_scroll_delta ((ClutterEvent *)event,
                                      &delta_x, &delta_y);
      g_object_get (priv->hadjustment,
                    "value", &hvalue,
                    NULL);
      g_object_get (priv->vadjustment,
                    "value", &vvalue,
                    NULL);
      break;
    case CLUTTER_SCROLL_UP:
    case CLUTTER_SCROLL_DOWN:
      g_object_get (priv->vadjustment,
                    "step-increment", &step,
                    "value", &value,
                    NULL);
      break;
    case CLUTTER_SCROLL_LEFT:
    case CLUTTER_SCROLL_RIGHT:
      g_object_get (priv->hadjustment,
                    "step-increment", &step,
                    "value", &value,
                    NULL);
      break;
    }

  switch (event->direction)
    {
    case CLUTTER_SCROLL_SMOOTH:
      st_adjustment_set_value (priv->hadjustment, hvalue + delta_x);
      st_adjustment_set_value (priv->vadjustment, vvalue + delta_y);
      break;
    case CLUTTER_SCROLL_UP:
      st_adjustment_set_value (priv->vadjustment, value - step);
      break;
    case CLUTTER_SCROLL_DOWN:
      st_adjustment_set_value (priv->vadjustment, value + step);
      break;
    case CLUTTER_SCROLL_LEFT:
      st_adjustment_set_value (priv->hadjustment, value - step);
      break;
    case CLUTTER_SCROLL_RIGHT:
      st_adjustment_set_value (priv->hadjustment, value + step);
      break;
    }

  return TRUE;
}

static void
st_scroll_view_class_init (StScrollViewClass *klass)
{
  GParamSpec *pspec;
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);
  StWidgetClass *widget_class = ST_WIDGET_CLASS (klass);

  g_type_class_add_private (klass, sizeof (StScrollViewPrivate));

  object_class->get_property = st_scroll_view_get_property;
  object_class->set_property = st_scroll_view_set_property;
  object_class->dispose = st_scroll_view_dispose;

  actor_class->paint = st_scroll_view_paint;
  actor_class->pick = st_scroll_view_pick;
  actor_class->get_preferred_width = st_scroll_view_get_preferred_width;
  actor_class->get_preferred_height = st_scroll_view_get_preferred_height;
  actor_class->allocate = st_scroll_view_allocate;
  actor_class->scroll_event = st_scroll_view_scroll_event;

  widget_class->style_changed = st_scroll_view_style_changed;

  g_object_class_install_property (object_class,
                                   PROP_HSCROLL,
                                   g_param_spec_object ("hscroll",
                                                        "StScrollBar",
                                                        "Horizontal scroll indicator",
                                                        ST_TYPE_SCROLL_BAR,
                                                        G_PARAM_READABLE));

  g_object_class_install_property (object_class,
                                   PROP_VSCROLL,
                                   g_param_spec_object ("vscroll",
                                                        "StScrollBar",
                                                        "Vertical scroll indicator",
                                                        ST_TYPE_SCROLL_BAR,
                                                        G_PARAM_READABLE));


  pspec = g_param_spec_enum ("vscrollbar-policy",
                             "Vertical Scrollbar Policy",
                             "When the vertical scrollbar is displayed",
                             GTK_TYPE_POLICY_TYPE,
                             GTK_POLICY_AUTOMATIC,
                             G_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_VSCROLLBAR_POLICY, pspec);

  pspec = g_param_spec_enum ("hscrollbar-policy",
                             "Horizontal Scrollbar Policy",
                             "When the horizontal scrollbar is displayed",
                             GTK_TYPE_POLICY_TYPE,
                             GTK_POLICY_AUTOMATIC,
                             G_PARAM_READWRITE);
  g_object_class_install_property (object_class, PROP_HSCROLLBAR_POLICY, pspec);

  pspec = g_param_spec_boolean ("hscrollbar-visible",
                                "Horizontal Scrollbar Visibility",
                                "Whether the horizontal scrollbar is visible",
                                TRUE,
                                G_PARAM_READABLE);
  g_object_class_install_property (object_class, PROP_HSCROLLBAR_VISIBLE, pspec);

  pspec = g_param_spec_boolean ("vscrollbar-visible",
                                "Vertical Scrollbar Visibility",
                                "Whether the vertical scrollbar is visible",
                                TRUE,
                                G_PARAM_READABLE);
  g_object_class_install_property (object_class, PROP_VSCROLLBAR_VISIBLE, pspec);

  pspec = g_param_spec_boolean ("enable-mouse-scrolling",
                                "Enable Mouse Scrolling",
                                "Enable automatic mouse wheel scrolling",
                                TRUE,
                                G_PARAM_READWRITE);
  g_object_class_install_property (object_class,
                                   PROP_MOUSE_SCROLL,
                                   pspec);

  pspec = g_param_spec_boolean ("enable-auto-scrolling",
                                "Enable Auto Scrolling",
                                "Enable automatic scrolling",
                                FALSE,
                                G_PARAM_READWRITE);
  g_object_class_install_property (object_class,
                                   PROP_AUTO_SCROLL,
                                   pspec);

}

static void
st_scroll_view_init (StScrollView *self)
{
  StScrollViewPrivate *priv = self->priv = SCROLL_VIEW_PRIVATE (self);

  priv->hscrollbar_policy = GTK_POLICY_AUTOMATIC;
  priv->vscrollbar_policy = GTK_POLICY_AUTOMATIC;

  priv->hadjustment = g_object_new (ST_TYPE_ADJUSTMENT, NULL);
  priv->hscroll = g_object_new (ST_TYPE_SCROLL_BAR,
                                "adjustment", priv->hadjustment,
                                "vertical", FALSE,
                                NULL);

  priv->vadjustment = g_object_new (ST_TYPE_ADJUSTMENT, NULL);
  priv->vscroll = g_object_new (ST_TYPE_SCROLL_BAR,
                                "adjustment", priv->vadjustment,
                                "vertical", TRUE,
                                NULL);

  clutter_actor_add_child (CLUTTER_ACTOR (self), priv->hscroll);
  clutter_actor_add_child (CLUTTER_ACTOR (self), priv->vscroll);

  /* mouse scroll is enabled by default, so we also need to be reactive */
  priv->mouse_scroll = TRUE;
  g_object_set (G_OBJECT (self), "reactive", TRUE, NULL);

  priv->auto_scroll = FALSE;
  priv->auto_scroll_timeout_id = 0;
  priv->mouse_pointer = clutter_device_manager_get_core_device (clutter_device_manager_get_default (),
                                                                      CLUTTER_POINTER_DEVICE);
  priv->settings = g_settings_new("org.cinnamon");
  priv->setting_connect_id = g_signal_connect (priv->settings, "changed::enable-vfade", G_CALLBACK (vfade_setting_changed_cb), self);
}

static void
st_scroll_view_add (ClutterContainer *container,
                    ClutterActor     *actor)
{
  StScrollView *self = ST_SCROLL_VIEW (container);
  StScrollViewPrivate *priv = self->priv;

  if (ST_IS_SCROLLABLE (actor))
    {
      priv->child = actor;

      /* chain up to StBin::add() */
      st_scroll_view_parent_iface->add (container, actor);

      st_scrollable_set_adjustments (ST_SCROLLABLE (actor),
                                     priv->hadjustment, priv->vadjustment);
    }
  else
    {
      g_warning ("Attempting to add an actor of type %s to "
                 "a StScrollView, but the actor does "
                 "not implement StScrollable.",
                 g_type_name (G_OBJECT_TYPE (actor)));
    }
}

static void
st_scroll_view_remove (ClutterContainer *container,
                       ClutterActor     *actor)
{
  StScrollView *self = ST_SCROLL_VIEW (container);
  StScrollViewPrivate *priv = self->priv;

  if (actor == priv->child)
    {
      g_object_ref (priv->child);

      /* chain up to StBin::remove() */
      st_scroll_view_parent_iface->remove (container, actor);

      st_scrollable_set_adjustments (ST_SCROLLABLE (priv->child),
                                     NULL, NULL);

      g_object_unref (priv->child);
      priv->child = NULL;
    }
  else
    {
      if (actor == priv->vscroll)
        priv->vscroll = NULL;
      else if (actor == priv->hscroll)
        priv->hscroll = NULL;
      else
        g_assert ("Unknown child removed from StScrollView");

      clutter_actor_unparent (actor);
    }
}

static void
st_scroll_view_foreach_with_internals (ClutterContainer *container,
                                       ClutterCallback   callback,
                                       gpointer          user_data)
{
  StScrollViewPrivate *priv = ST_SCROLL_VIEW (container)->priv;

  if (priv->child != NULL)
    callback (priv->child, user_data);

  if (priv->hscroll != NULL)
    callback (priv->hscroll, user_data);

  if (priv->vscroll != NULL)
    callback (priv->vscroll, user_data);
}

static void
clutter_container_iface_init (ClutterContainerIface *iface)
{
  /* store a pointer to the StBin implementation of
   * ClutterContainer so that we can chain up when
   * overriding the methods
   */
  st_scroll_view_parent_iface = g_type_interface_peek_parent (iface);

  iface->add = st_scroll_view_add;
  iface->remove = st_scroll_view_remove;
  iface->foreach_with_internals = st_scroll_view_foreach_with_internals;
}

StWidget *
st_scroll_view_new (void)
{
  return g_object_new (ST_TYPE_SCROLL_VIEW, NULL);
}

/**
 * st_scroll_view_get_hscroll_bar:
 * @scroll: a #StScrollView
 *
 * Gets the horizontal scrollbar of the scrollbiew
 *
 * Return value: (transfer none): the horizontal #StScrollbar
 */
ClutterActor *
st_scroll_view_get_hscroll_bar (StScrollView *scroll)
{
  g_return_val_if_fail (ST_IS_SCROLL_VIEW (scroll), NULL);

  return scroll->priv->hscroll;
}

/**
 * st_scroll_view_get_vscroll_bar:
 * @scroll: a #StScrollView
 *
 * Gets the vertical scrollbar of the scrollbiew
 *
 * Return value: (transfer none): the vertical #StScrollbar
 */
ClutterActor *
st_scroll_view_get_vscroll_bar (StScrollView *scroll)
{
  g_return_val_if_fail (ST_IS_SCROLL_VIEW (scroll), NULL);

  return scroll->priv->vscroll;
}

gfloat
st_scroll_view_get_column_size (StScrollView *scroll)
{
  gdouble column_size;

  g_return_val_if_fail (scroll, 0);

  g_object_get (scroll->priv->hadjustment,
                "step-increment", &column_size,
                NULL);

  return column_size;
}

void
st_scroll_view_set_column_size (StScrollView *scroll,
                                gfloat        column_size)
{
  g_return_if_fail (scroll);

  if (column_size < 0)
    {
      scroll->priv->column_size_set = FALSE;
      scroll->priv->column_size = -1;
    }
  else
    {
      scroll->priv->column_size_set = TRUE;
      scroll->priv->column_size = column_size;

      g_object_set (scroll->priv->hadjustment,
                    "step-increment", (gdouble) scroll->priv->column_size,
                    NULL);
    }
}

gfloat
st_scroll_view_get_row_size (StScrollView *scroll)
{
  gdouble row_size;

  g_return_val_if_fail (scroll, 0);

  g_object_get (scroll->priv->vadjustment,
                "step-increment", &row_size,
                NULL);

  return row_size;
}

void
st_scroll_view_set_row_size (StScrollView *scroll,
                             gfloat        row_size)
{
  g_return_if_fail (scroll);

  if (row_size < 0)
    {
      scroll->priv->row_size_set = FALSE;
      scroll->priv->row_size = -1;
    }
  else
    {
      scroll->priv->row_size_set = TRUE;
      scroll->priv->row_size = row_size;

      g_object_set (scroll->priv->vadjustment,
                    "step-increment", (gdouble) scroll->priv->row_size,
                    NULL);
    }
}

void
st_scroll_view_set_mouse_scrolling (StScrollView *scroll,
                                    gboolean      enabled)
{
  StScrollViewPrivate *priv;

  g_return_if_fail (ST_IS_SCROLL_VIEW (scroll));

  priv = ST_SCROLL_VIEW (scroll)->priv;

  if (priv->mouse_scroll != enabled)
    {
      priv->mouse_scroll = enabled;

      /* make sure we can receive mouse wheel events */
      if (enabled)
        clutter_actor_set_reactive ((ClutterActor *) scroll, TRUE);
    }
}

gboolean
st_scroll_view_get_mouse_scrolling (StScrollView *scroll)
{
  StScrollViewPrivate *priv;

  g_return_val_if_fail (ST_IS_SCROLL_VIEW (scroll), FALSE);

  priv = ST_SCROLL_VIEW (scroll)->priv;

  return priv->mouse_scroll;
}

void
st_scroll_view_set_auto_scrolling (StScrollView *scroll,
                                   gboolean      enabled)
{
  StScrollViewPrivate *priv;

  g_return_if_fail (ST_IS_SCROLL_VIEW (scroll));

  priv = ST_SCROLL_VIEW (scroll)->priv;

  if (priv->auto_scroll != enabled)
    {
      priv->auto_scroll = enabled;

      /* make sure we can receive mouse wheel events */
      if (enabled) {
        clutter_actor_set_reactive ((ClutterActor *) scroll, TRUE);
        g_signal_connect (scroll, "motion-event",
                          G_CALLBACK (motion_event_cb), scroll);
      } else {
        g_signal_handlers_disconnect_by_func (scroll, motion_event_cb, scroll);
        if (priv->auto_scroll_timeout_id > 0) {
            g_source_remove (priv->auto_scroll_timeout_id);
            priv->auto_scroll_timeout_id = 0;
        }
      }
    }
}

gboolean
st_scroll_view_get_auto_scrolling (StScrollView *scroll)
{
  StScrollViewPrivate *priv;

  g_return_val_if_fail (ST_IS_SCROLL_VIEW (scroll), FALSE);

  priv = ST_SCROLL_VIEW (scroll)->priv;

  return priv->auto_scroll;
}

/**
 * st_scroll_view_set_policy:
 * @scroll: A #StScrollView
 * @hscroll: Whether to enable horizontal scrolling
 * @vscroll: Whether to enable vertical scrolling
 *
 * Set the scroll policy.
 */
void
st_scroll_view_set_policy (StScrollView   *scroll,
                           GtkPolicyType   hscroll,
                           GtkPolicyType   vscroll)
{
  StScrollViewPrivate *priv;

  g_return_if_fail (ST_IS_SCROLL_VIEW (scroll));

  priv = ST_SCROLL_VIEW (scroll)->priv;

  if (priv->hscrollbar_policy == hscroll && priv->vscrollbar_policy == vscroll)
    return;

  g_object_freeze_notify ((GObject *) scroll);

  if (priv->hscrollbar_policy != hscroll)
    {
      priv->hscrollbar_policy = hscroll;
      g_object_notify ((GObject *) scroll, "hscrollbar-policy");
    }

  if (priv->vscrollbar_policy != vscroll)
    {
      priv->vscrollbar_policy = vscroll;
      g_object_notify ((GObject *) scroll, "vscrollbar-policy");
    }

  clutter_actor_queue_relayout (CLUTTER_ACTOR (scroll));

  g_object_thaw_notify ((GObject *) scroll);
}
