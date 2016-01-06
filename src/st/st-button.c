/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
/*
 * st-button.c: Plain button actor
 *
 * Copyright 2007 OpenedHand
 * Copyright 2008, 2009 Intel Corporation.
 * Copyright 2009, 2010 Red Hat, Inc.
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
 * SECTION:st-button
 * @short_description: Button widget
 *
 * A button widget with support for either a text label or icon, toggle mode
 * and transitions effects between states.
 */

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <stdlib.h>
#include <string.h>

#include <glib.h>

#include <clutter/clutter.h>

#include "st-button.h"

#include "st-enum-types.h"
#include "st-texture-cache.h"
#include "st-private.h"

#include <st/st-widget-accessible.h>

enum
{
  PROP_0,

  PROP_LABEL,
  PROP_BUTTON_MASK,
  PROP_TOGGLE_MODE,
  PROP_CHECKED,
  PROP_PRESSED
};

enum
{
  CLICKED,

  LAST_SIGNAL
};

#define ST_BUTTON_GET_PRIVATE(obj)    \
  (G_TYPE_INSTANCE_GET_PRIVATE ((obj), ST_TYPE_BUTTON, StButtonPrivate))

struct _StButtonPrivate
{
  gchar *text;

  guint  button_mask : 3;
  guint  is_toggle   : 1;

  guint  pressed     : 3;
  guint  grabbed     : 3;
  guint  is_checked  : 1;

  gint   spacing;
};

static guint button_signals[LAST_SIGNAL] = { 0, };

G_DEFINE_TYPE (StButton, st_button, ST_TYPE_BIN);

static GType st_button_accessible_get_type (void) G_GNUC_CONST;

static void
st_button_update_label_style (StButton *button)
{
  ClutterActor *label;

  label = st_bin_get_child (ST_BIN (button));

  /* check the child is really a label */
  if (!CLUTTER_IS_TEXT (label))
    return;

  _st_set_text_from_style (CLUTTER_TEXT (label), st_widget_get_theme_node (ST_WIDGET (button)));
}

static void
st_button_style_changed (StWidget *widget)
{
  StButton *button = ST_BUTTON (widget);
  StButtonPrivate *priv = button->priv;
  StButtonClass *button_class = ST_BUTTON_GET_CLASS (button);
  StThemeNode *theme_node = st_widget_get_theme_node (ST_WIDGET (button));
  double spacing;

  ST_WIDGET_CLASS (st_button_parent_class)->style_changed (widget);

  spacing = 6;
  st_theme_node_lookup_length (theme_node, "border-spacing", FALSE, &spacing);
  priv->spacing = (int)(0.5 + spacing);

  /* update the label styling */
  st_button_update_label_style (button);

  /* run a transition if applicable */
  if (button_class->transition)
    {
      button_class->transition (button);
    }
}

static void
st_button_press (StButton     *button,
                 StButtonMask  mask)
{
  if (button->priv->pressed == 0)
    st_widget_add_style_pseudo_class (ST_WIDGET (button), "active");

  button->priv->pressed |= mask;
}

static void
st_button_release (StButton     *button,
                   StButtonMask  mask,
                   int           clicked_button)
{
  button->priv->pressed &= ~mask;
  if (button->priv->pressed != 0)
    return;

  st_widget_remove_style_pseudo_class (ST_WIDGET (button), "active");

  if (clicked_button)
    {
      if (button->priv->is_toggle)
        st_button_set_checked (button, !button->priv->is_checked);

      g_signal_emit (button, button_signals[CLICKED], 0, clicked_button);
    }
}

static gboolean
st_button_button_press (ClutterActor       *actor,
                        ClutterButtonEvent *event)
{
  StButton *button = ST_BUTTON (actor);
  StButtonMask mask = ST_BUTTON_MASK_FROM_BUTTON (event->button);

  if (button->priv->button_mask & mask)
    {
      if (button->priv->grabbed == 0)
        clutter_grab_pointer (actor);

      button->priv->grabbed |= mask;
      st_button_press (button, mask);

      return TRUE;
    }

  return FALSE;
}

static gboolean
st_button_button_release (ClutterActor       *actor,
                          ClutterButtonEvent *event)
{
  StButton *button = ST_BUTTON (actor);
  StButtonMask mask = ST_BUTTON_MASK_FROM_BUTTON (event->button);

  if (button->priv->button_mask & mask)
    {
      gboolean is_click;

      is_click = button->priv->grabbed && st_widget_get_hover (ST_WIDGET (button));
      st_button_release (button, mask, is_click ? event->button : 0);

      button->priv->grabbed &= ~mask;
      if (button->priv->grabbed == 0)
        clutter_ungrab_pointer ();

      return TRUE;
    }

  return FALSE;
}

static gboolean
st_button_key_press (ClutterActor    *actor,
                     ClutterKeyEvent *event)
{
  StButton *button = ST_BUTTON (actor);

  if (button->priv->button_mask & ST_BUTTON_ONE)
    {
      if (event->keyval == CLUTTER_KEY_space ||
          event->keyval == CLUTTER_KEY_Return)
        {
          st_button_press (button, ST_BUTTON_ONE);
          return TRUE;
        }
    }

  return CLUTTER_ACTOR_CLASS (st_button_parent_class)->key_press_event (actor, event);
}

static gboolean
st_button_key_release (ClutterActor    *actor,
                       ClutterKeyEvent *event)
{
  StButton *button = ST_BUTTON (actor);

  if (button->priv->button_mask & ST_BUTTON_ONE)
    {
      if (event->keyval == CLUTTER_KEY_space ||
          event->keyval == CLUTTER_KEY_Return)
        {
          gboolean is_click;

          is_click = (button->priv->pressed & ST_BUTTON_ONE);
          st_button_release (button, ST_BUTTON_ONE, is_click ? 1 : 0);
          return TRUE;
        }
    }

  return FALSE;
}

static void
st_button_key_focus_out (ClutterActor *actor)
{
  StButton *button = ST_BUTTON (actor);

  /* If we lose focus between a key press and release, undo the press */
  if ((button->priv->pressed & ST_BUTTON_ONE) &&
      !(button->priv->grabbed & ST_BUTTON_ONE))
    st_button_release (button, ST_BUTTON_ONE, 0);

  CLUTTER_ACTOR_CLASS (st_button_parent_class)->key_focus_out (actor);
}

static gboolean
st_button_enter (ClutterActor         *actor,
                 ClutterCrossingEvent *event)
{
  StButton *button = ST_BUTTON (actor);
  gboolean ret;

  ret = CLUTTER_ACTOR_CLASS (st_button_parent_class)->enter_event (actor, event);

  if (button->priv->grabbed)
    {
      if (st_widget_get_hover (ST_WIDGET (button)))
        st_button_press (button, button->priv->grabbed);
      else
        st_button_release (button, button->priv->grabbed, 0);
    }

  return ret;
}

static gboolean
st_button_leave (ClutterActor         *actor,
                 ClutterCrossingEvent *event)
{
  StButton *button = ST_BUTTON (actor);
  gboolean ret;

  ret = CLUTTER_ACTOR_CLASS (st_button_parent_class)->leave_event (actor, event);

  if (button->priv->grabbed)
    {
      if (st_widget_get_hover (ST_WIDGET (button)))
        st_button_press (button, button->priv->grabbed);
      else
        st_button_release (button, button->priv->grabbed, 0);
    }

  return ret;
}

static void
st_button_set_property (GObject      *gobject,
                        guint         prop_id,
                        const GValue *value,
                        GParamSpec   *pspec)
{
  StButton *button = ST_BUTTON (gobject);

  switch (prop_id)
    {
    case PROP_LABEL:
      st_button_set_label (button, g_value_get_string (value));
      break;
    case PROP_BUTTON_MASK:
      st_button_set_button_mask (button, g_value_get_flags (value));
      break;
    case PROP_TOGGLE_MODE:
      st_button_set_toggle_mode (button, g_value_get_boolean (value));
      break;
    case PROP_CHECKED:
      st_button_set_checked (button, g_value_get_boolean (value));
      break;


    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_button_get_property (GObject    *gobject,
                        guint       prop_id,
                        GValue     *value,
                        GParamSpec *pspec)
{
  StButtonPrivate *priv = ST_BUTTON (gobject)->priv;

  switch (prop_id)
    {
    case PROP_LABEL:
      g_value_set_string (value, priv->text);
      break;
    case PROP_BUTTON_MASK:
      g_value_set_flags (value, priv->button_mask);
      break;
    case PROP_TOGGLE_MODE:
      g_value_set_boolean (value, priv->is_toggle);
      break;
    case PROP_CHECKED:
      g_value_set_boolean (value, priv->is_checked);
      break;
    case PROP_PRESSED:
      g_value_set_boolean (value, priv->pressed != 0);
      break;


    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
      break;
    }
}

static void
st_button_finalize (GObject *gobject)
{
  StButtonPrivate *priv = ST_BUTTON (gobject)->priv;

  g_free (priv->text);

  G_OBJECT_CLASS (st_button_parent_class)->finalize (gobject);
}

static void
st_button_class_init (StButtonClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  ClutterActorClass *actor_class = CLUTTER_ACTOR_CLASS (klass);
  StWidgetClass *widget_class = ST_WIDGET_CLASS (klass);
  GParamSpec *pspec;

  g_type_class_add_private (klass, sizeof (StButtonPrivate));

  gobject_class->set_property = st_button_set_property;
  gobject_class->get_property = st_button_get_property;
  gobject_class->finalize = st_button_finalize;

  actor_class->button_press_event = st_button_button_press;
  actor_class->button_release_event = st_button_button_release;
  actor_class->key_press_event = st_button_key_press;
  actor_class->key_release_event = st_button_key_release;
  actor_class->key_focus_out = st_button_key_focus_out;
  actor_class->enter_event = st_button_enter;
  actor_class->leave_event = st_button_leave;

  widget_class->style_changed = st_button_style_changed;
  widget_class->get_accessible_type = st_button_accessible_get_type;

  pspec = g_param_spec_string ("label",
                               "Label",
                               "Label of the button",
                               NULL, G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_LABEL, pspec);

  pspec = g_param_spec_flags ("button-mask",
                              "Button mask",
                              "Which buttons trigger the 'clicked' signal",
                              ST_TYPE_BUTTON_MASK, ST_BUTTON_ONE,
                              G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_BUTTON_MASK, pspec);

  pspec = g_param_spec_boolean ("toggle-mode",
                                "Toggle Mode",
                                "Enable or disable toggling",
                                FALSE, G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_TOGGLE_MODE, pspec);

  pspec = g_param_spec_boolean ("checked",
                                "Checked",
                                "Indicates if a toggle button is \"on\""
                                " or \"off\"",
                                FALSE, G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class, PROP_CHECKED, pspec);

  pspec = g_param_spec_boolean ("pressed",
                                "Pressed",
                                "Indicates if the button is pressed in",
                                FALSE, G_PARAM_READABLE);
  g_object_class_install_property (gobject_class, PROP_PRESSED, pspec);


  /**
   * StButton::clicked:
   * @button: the object that received the signal
   * @clicked_button: the mouse button that was used
   *
   * Emitted when the user activates the button, either with a mouse press and
   * release or with the keyboard.
   */
  button_signals[CLICKED] =
    g_signal_new ("clicked",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_LAST,
                  G_STRUCT_OFFSET (StButtonClass, clicked),
                  NULL, NULL, NULL,
                  G_TYPE_NONE, 1,
                  G_TYPE_INT);
}

static void
st_button_init (StButton *button)
{
  button->priv = ST_BUTTON_GET_PRIVATE (button);
  button->priv->spacing = 6;
  button->priv->button_mask = ST_BUTTON_ONE;

  clutter_actor_set_reactive (CLUTTER_ACTOR (button), TRUE);
  st_widget_set_track_hover (ST_WIDGET (button), TRUE);
}

/**
 * st_button_new:
 *
 * Create a new button
 *
 * Returns: a new #StButton
 */
StWidget *
st_button_new (void)
{
  return g_object_new (ST_TYPE_BUTTON, NULL);
}

/**
 * st_button_new_with_label:
 * @text: text to set the label to
 *
 * Create a new #StButton with the specified label
 *
 * Returns: a new #StButton
 */
StWidget *
st_button_new_with_label (const gchar *text)
{
  return g_object_new (ST_TYPE_BUTTON, "label", text, NULL);
}

/**
 * st_button_get_label:
 * @button: a #StButton
 *
 * Get the text displayed on the button
 *
 * Returns: the text for the button. This must not be freed by the application
 */
const gchar *
st_button_get_label (StButton *button)
{
  g_return_val_if_fail (ST_IS_BUTTON (button), NULL);

  return button->priv->text;
}

/**
 * st_button_set_label:
 * @button: a #Stbutton
 * @text: text to set the label to
 *
 * Sets the text displayed on the button
 */
void
st_button_set_label (StButton    *button,
                     const gchar *text)
{
  StButtonPrivate *priv;
  ClutterActor *label;

  g_return_if_fail (ST_IS_BUTTON (button));

  priv = button->priv;

  g_free (priv->text);

  if (text)
    priv->text = g_strdup (text);
  else
    priv->text = g_strdup ("");

  label = st_bin_get_child (ST_BIN (button));

  if (label && CLUTTER_IS_TEXT (label))
    {
      clutter_text_set_text (CLUTTER_TEXT (label), priv->text);
    }
  else
    {
      label = g_object_new (CLUTTER_TYPE_TEXT,
                            "text", priv->text,
                            "line-alignment", PANGO_ALIGN_CENTER,
                            "ellipsize", PANGO_ELLIPSIZE_END,
                            "use-markup", TRUE,
                            NULL);
      st_bin_set_child (ST_BIN (button), label);
    }

  /* Fake a style change so that we reset the style properties on the label */
  st_widget_style_changed (ST_WIDGET (button));

  g_object_notify (G_OBJECT (button), "label");
}

/**
 * st_button_get_button_mask:
 * @button: a #StButton
 *
 * Gets the mask of mouse buttons that @button emits the
 * #StButton::clicked signal for.
 *
 * Returns: the mask of mouse buttons that @button emits the
 * #StButton::clicked signal for.
 */
StButtonMask
st_button_get_button_mask (StButton *button)
{
  g_return_val_if_fail (ST_IS_BUTTON (button), 0);

  return button->priv->button_mask;
}

/**
 * st_button_set_button_mask:
 * @button: a #Stbutton
 * @mask: the mask of mouse buttons that @button responds to
 *
 * Sets which mouse buttons @button emits #StButton::clicked for.
 */
void
st_button_set_button_mask (StButton     *button,
                           StButtonMask  mask)
{
  g_return_if_fail (ST_IS_BUTTON (button));

  button->priv->button_mask = mask;

  g_object_notify (G_OBJECT (button), "button-mask");
}

/**
 * st_button_get_toggle_mode:
 * @button: a #StButton
 *
 * Get the toggle mode status of the button.
 *
 * Returns: %TRUE if toggle mode is set, otherwise %FALSE
 */
gboolean
st_button_get_toggle_mode (StButton *button)
{
  g_return_val_if_fail (ST_IS_BUTTON (button), FALSE);

  return button->priv->is_toggle;
}

/**
 * st_button_set_toggle_mode:
 * @button: a #Stbutton
 * @toggle: %TRUE or %FALSE
 *
 * Enables or disables toggle mode for the button. In toggle mode, the active
 * state will be "toggled" when the user clicks the button.
 */
void
st_button_set_toggle_mode (StButton *button,
                           gboolean  toggle)
{
  g_return_if_fail (ST_IS_BUTTON (button));

  button->priv->is_toggle = toggle;

  g_object_notify (G_OBJECT (button), "toggle-mode");
}

/**
 * st_button_get_checked:
 * @button: a #StButton
 *
 * Get the state of the button that is in toggle mode.
 *
 * Returns: %TRUE if the button is checked, or %FALSE if not
 */
gboolean
st_button_get_checked (StButton *button)
{
  g_return_val_if_fail (ST_IS_BUTTON (button), FALSE);

  return button->priv->is_checked;
}

/**
 * st_button_set_checked:
 * @button: a #Stbutton
 * @checked: %TRUE or %FALSE
 *
 * Sets the pressed state of the button. This is only really useful if the
 * button has #toggle-mode mode set to %TRUE.
 */
void
st_button_set_checked (StButton *button,
                       gboolean  checked)
{
  g_return_if_fail (ST_IS_BUTTON (button));

  if (button->priv->is_checked != checked)
    {
      button->priv->is_checked = checked;

      st_widget_change_style_pseudo_class (ST_WIDGET (button), "checked", checked);
    }

  g_object_notify (G_OBJECT (button), "checked");
}

/**
 * st_button_fake_release:
 * @button: an #StButton
 *
 * If this widget is holding a pointer grab, this function will
 * will ungrab it, and reset the pressed state.  The effect is
 * similar to if the user had released the mouse button, but without
 * emitting the clicked signal.
 *
 * This function is useful if for example you want to do something
 * after the user is holding the mouse button for a given period of
 * time, breaking the grab.
 */
void
st_button_fake_release (StButton *button)
{
  if (button->priv->pressed)
    st_button_release (button, button->priv->pressed, 0);

  if (button->priv->grabbed)
    {
      button->priv->grabbed = 0;
      clutter_ungrab_pointer ();
    }
}

/******************************************************************************/
/*************************** ACCESSIBILITY SUPPORT ****************************/
/******************************************************************************/

#define ST_TYPE_BUTTON_ACCESSIBLE st_button_accessible_get_type ()

#define ST_BUTTON_ACCESSIBLE(obj) \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj), \
  ST_TYPE_BUTTON_ACCESSIBLE, StButtonAccessible))

#define ST_IS_BUTTON_ACCESSIBLE(obj) \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj), \
  ST_TYPE_BUTTON_ACCESSIBLE))

#define ST_BUTTON_ACCESSIBLE_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_CAST ((klass), \
  ST_TYPE_BUTTON_ACCESSIBLE, StButtonAccessibleClass))

#define ST_IS_BUTTON_ACCESSIBLE_CLASS(klass) \
  (G_TYPE_CHECK_CLASS_TYPE ((klass), \
  ST_TYPE_BUTTON_ACCESSIBLE))

#define ST_BUTTON_ACCESSIBLE_GET_CLASS(obj) \
  (G_TYPE_INSTANCE_GET_CLASS ((obj), \
  ST_TYPE_BUTTON_ACCESSIBLE, StButtonAccessibleClass))

typedef struct _StButtonAccessible  StButtonAccessible;
typedef struct _StButtonAccessibleClass  StButtonAccessibleClass;

struct _StButtonAccessible
{
  StWidgetAccessible parent;
};

struct _StButtonAccessibleClass
{
  StWidgetAccessibleClass parent_class;
};

static void st_button_accessible_class_init (StButtonAccessibleClass *klass);
static void st_button_accessible_init       (StButtonAccessible *button);

/* AtkObject */
static void          st_button_accessible_initialize (AtkObject *obj,
                                                      gpointer   data);

G_DEFINE_TYPE (StButtonAccessible, st_button_accessible, ST_TYPE_WIDGET_ACCESSIBLE)

static const gchar *
st_button_accessible_get_name (AtkObject *obj)
{
  StButton *button = NULL;
  const gchar *name = NULL;

  button = ST_BUTTON (atk_gobject_accessible_get_object (ATK_GOBJECT_ACCESSIBLE (obj)));

  if (button == NULL)
    return NULL;

  name = ATK_OBJECT_CLASS (st_button_accessible_parent_class)->get_name (obj);
  if (name != NULL)
    return name;

  return button->priv->text;
}

static void
st_button_accessible_class_init (StButtonAccessibleClass *klass)
{
  AtkObjectClass *atk_class = ATK_OBJECT_CLASS (klass);

  atk_class->initialize = st_button_accessible_initialize;
  atk_class->get_name = st_button_accessible_get_name;
}

static void
st_button_accessible_init (StButtonAccessible *self)
{
  /* initialization done on AtkObject->initialize */
}

static void
st_button_accessible_notify_label_cb (StButton   *button,
                                      GParamSpec *psec,
                                      AtkObject  *accessible)
{
  g_object_notify (G_OBJECT (accessible), "accessible-name");
}

static void
st_button_accessible_initialize (AtkObject *obj,
                                gpointer   data)
{
  ATK_OBJECT_CLASS (st_button_accessible_parent_class)->initialize (obj, data);

  obj->role = ATK_ROLE_PUSH_BUTTON;

  g_signal_connect (data, "notify::label",
                    G_CALLBACK (st_button_accessible_notify_label_cb), obj);
}
