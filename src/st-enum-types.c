
/* Generated data (by glib-mkenums) */

#include "st-enum-types.h"
/* enumerations from "./st/st-button.h" */
#include "./st/st-button.h"
GType
st_button_mask_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GFlagsValue values[] = {
        { ST_BUTTON_ONE, "ST_BUTTON_ONE", "one" },
        { ST_BUTTON_TWO, "ST_BUTTON_TWO", "two" },
        { ST_BUTTON_THREE, "ST_BUTTON_THREE", "three" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_flags_register_static (g_intern_static_string ("StButtonMask"), values);
    }
  return enum_type_id;
}
/* enumerations from "./st/st-table.h" */
#include "./st/st-table.h"
GType
st_table_child_options_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GFlagsValue values[] = {
        { ST_KEEP_ASPECT_RATIO, "ST_KEEP_ASPECT_RATIO", "keep-aspect-ratio" },
        { ST_X_EXPAND, "ST_X_EXPAND", "x-expand" },
        { ST_Y_EXPAND, "ST_Y_EXPAND", "y-expand" },
        { ST_X_FILL, "ST_X_FILL", "x-fill" },
        { ST_Y_FILL, "ST_Y_FILL", "y-fill" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_flags_register_static (g_intern_static_string ("StTableChildOptions"), values);
    }
  return enum_type_id;
}
/* enumerations from "./st/st-texture-cache.h" */
#include "./st/st-texture-cache.h"
GType
st_texture_cache_policy_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { ST_TEXTURE_CACHE_POLICY_NONE, "ST_TEXTURE_CACHE_POLICY_NONE", "none" },
        { ST_TEXTURE_CACHE_POLICY_FOREVER, "ST_TEXTURE_CACHE_POLICY_FOREVER", "forever" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static (g_intern_static_string ("StTextureCachePolicy"), values);
    }
  return enum_type_id;
}
/* enumerations from "./st/st-theme-node.h" */
#include "./st/st-theme-node.h"
GType
st_side_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { ST_SIDE_TOP, "ST_SIDE_TOP", "top" },
        { ST_SIDE_RIGHT, "ST_SIDE_RIGHT", "right" },
        { ST_SIDE_BOTTOM, "ST_SIDE_BOTTOM", "bottom" },
        { ST_SIDE_LEFT, "ST_SIDE_LEFT", "left" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static (g_intern_static_string ("StSide"), values);
    }
  return enum_type_id;
}
GType
st_corner_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { ST_CORNER_TOPLEFT, "ST_CORNER_TOPLEFT", "topleft" },
        { ST_CORNER_TOPRIGHT, "ST_CORNER_TOPRIGHT", "topright" },
        { ST_CORNER_BOTTOMRIGHT, "ST_CORNER_BOTTOMRIGHT", "bottomright" },
        { ST_CORNER_BOTTOMLEFT, "ST_CORNER_BOTTOMLEFT", "bottomleft" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static (g_intern_static_string ("StCorner"), values);
    }
  return enum_type_id;
}
GType
st_text_decoration_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GFlagsValue values[] = {
        { ST_TEXT_DECORATION_UNDERLINE, "ST_TEXT_DECORATION_UNDERLINE", "underline" },
        { ST_TEXT_DECORATION_OVERLINE, "ST_TEXT_DECORATION_OVERLINE", "overline" },
        { ST_TEXT_DECORATION_LINE_THROUGH, "ST_TEXT_DECORATION_LINE_THROUGH", "line-through" },
        { ST_TEXT_DECORATION_BLINK, "ST_TEXT_DECORATION_BLINK", "blink" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_flags_register_static (g_intern_static_string ("StTextDecoration"), values);
    }
  return enum_type_id;
}
GType
st_text_align_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { ST_TEXT_ALIGN_LEFT, "ST_TEXT_ALIGN_LEFT", "left" },
        { ST_TEXT_ALIGN_CENTER, "ST_TEXT_ALIGN_CENTER", "center" },
        { ST_TEXT_ALIGN_RIGHT, "ST_TEXT_ALIGN_RIGHT", "right" },
        { ST_TEXT_ALIGN_JUSTIFY, "ST_TEXT_ALIGN_JUSTIFY", "justify" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static (g_intern_static_string ("StTextAlign"), values);
    }
  return enum_type_id;
}
GType
st_gradient_type_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { ST_GRADIENT_NONE, "ST_GRADIENT_NONE", "none" },
        { ST_GRADIENT_VERTICAL, "ST_GRADIENT_VERTICAL", "vertical" },
        { ST_GRADIENT_HORIZONTAL, "ST_GRADIENT_HORIZONTAL", "horizontal" },
        { ST_GRADIENT_RADIAL, "ST_GRADIENT_RADIAL", "radial" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static (g_intern_static_string ("StGradientType"), values);
    }
  return enum_type_id;
}
/* enumerations from "./st/st-types.h" */
#include "./st/st-types.h"
GType
st_align_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { ST_ALIGN_START, "ST_ALIGN_START", "start" },
        { ST_ALIGN_MIDDLE, "ST_ALIGN_MIDDLE", "middle" },
        { ST_ALIGN_END, "ST_ALIGN_END", "end" },
        { ST_ALIGN_CENTER_SPECIAL, "ST_ALIGN_CENTER_SPECIAL", "center-special" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static (g_intern_static_string ("StAlign"), values);
    }
  return enum_type_id;
}
GType
st_icon_type_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { ST_ICON_SYMBOLIC, "ST_ICON_SYMBOLIC", "symbolic" },
        { ST_ICON_FULLCOLOR, "ST_ICON_FULLCOLOR", "fullcolor" },
        { ST_ICON_APPLICATION, "ST_ICON_APPLICATION", "application" },
        { ST_ICON_DOCUMENT, "ST_ICON_DOCUMENT", "document" },
        { ST_ICON_FADED, "ST_ICON_FADED", "faded" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static (g_intern_static_string ("StIconType"), values);
    }
  return enum_type_id;
}
/* enumerations from "./st/st-widget.h" */
#include "./st/st-widget.h"
GType
st_text_direction_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { ST_TEXT_DIRECTION_NONE, "ST_TEXT_DIRECTION_NONE", "none" },
        { ST_TEXT_DIRECTION_LTR, "ST_TEXT_DIRECTION_LTR", "ltr" },
        { ST_TEXT_DIRECTION_RTL, "ST_TEXT_DIRECTION_RTL", "rtl" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static (g_intern_static_string ("StTextDirection"), values);
    }
  return enum_type_id;
}

/* Generated data ends here */

