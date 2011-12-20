
/* Generated data (by glib-mkenums) */

#include "cinnamon-enum-types.h"
/* enumerations from "./cinnamon-app.h" */
#include "./cinnamon-app.h"
GType
cinnamon_app_state_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { CINNAMON_APP_STATE_STOPPED, "CINNAMON_APP_STATE_STOPPED", "stopped" },
        { CINNAMON_APP_STATE_STARTING, "CINNAMON_APP_STATE_STARTING", "starting" },
        { CINNAMON_APP_STATE_RUNNING, "CINNAMON_APP_STATE_RUNNING", "running" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static("CinnamonAppState", values);
    }
  return enum_type_id;
}
/* enumerations from "./cinnamon-global.h" */
#include "./cinnamon-global.h"
GType
cinnamon_stage_input_mode_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { CINNAMON_STAGE_INPUT_MODE_NONREACTIVE, "CINNAMON_STAGE_INPUT_MODE_NONREACTIVE", "nonreactive" },
        { CINNAMON_STAGE_INPUT_MODE_NORMAL, "CINNAMON_STAGE_INPUT_MODE_NORMAL", "normal" },
        { CINNAMON_STAGE_INPUT_MODE_FOCUSED, "CINNAMON_STAGE_INPUT_MODE_FOCUSED", "focused" },
        { CINNAMON_STAGE_INPUT_MODE_FULLSCREEN, "CINNAMON_STAGE_INPUT_MODE_FULLSCREEN", "fullscreen" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static("CinnamonStageInputMode", values);
    }
  return enum_type_id;
}
GType
cinnamon_cursor_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { CINNAMON_CURSOR_DND_IN_DRAG, "CINNAMON_CURSOR_DND_IN_DRAG", "dnd-in-drag" },
        { CINNAMON_CURSOR_DND_UNSUPPORTED_TARGET, "CINNAMON_CURSOR_DND_UNSUPPORTED_TARGET", "dnd-unsupported-target" },
        { CINNAMON_CURSOR_DND_MOVE, "CINNAMON_CURSOR_DND_MOVE", "dnd-move" },
        { CINNAMON_CURSOR_DND_COPY, "CINNAMON_CURSOR_DND_COPY", "dnd-copy" },
        { CINNAMON_CURSOR_POINTING_HAND, "CINNAMON_CURSOR_POINTING_HAND", "pointing-hand" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static("CinnamonCursor", values);
    }
  return enum_type_id;
}
GType
cinnamon_session_type_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { CINNAMON_SESSION_USER, "CINNAMON_SESSION_USER", "user" },
        { CINNAMON_SESSION_GDM, "CINNAMON_SESSION_GDM", "gdm" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static("CinnamonSessionType", values);
    }
  return enum_type_id;
}
/* enumerations from "./cinnamon-mobile-providers.h" */
#include "./cinnamon-mobile-providers.h"
GType
cinnamon_mobile_access_method_type_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { CINNAMON_MOBILE_ACCESS_METHOD_TYPE_UNKNOWN, "CINNAMON_MOBILE_ACCESS_METHOD_TYPE_UNKNOWN", "unknown" },
        { CINNAMON_MOBILE_ACCESS_METHOD_TYPE_GSM, "CINNAMON_MOBILE_ACCESS_METHOD_TYPE_GSM", "gsm" },
        { CINNAMON_MOBILE_ACCESS_METHOD_TYPE_CDMA, "CINNAMON_MOBILE_ACCESS_METHOD_TYPE_CDMA", "cdma" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static("CinnamonMobileAccessMethodType", values);
    }
  return enum_type_id;
}

/* Generated data ends here */

