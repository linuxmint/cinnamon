
/* Generated data (by glib-mkenums) */

#include "shell-enum-types.h"
/* enumerations from "./shell-app.h" */
#include "./shell-app.h"
GType
shell_app_state_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { SHELL_APP_STATE_STOPPED, "SHELL_APP_STATE_STOPPED", "stopped" },
        { SHELL_APP_STATE_STARTING, "SHELL_APP_STATE_STARTING", "starting" },
        { SHELL_APP_STATE_RUNNING, "SHELL_APP_STATE_RUNNING", "running" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static("ShellAppState", values);
    }
  return enum_type_id;
}
/* enumerations from "./shell-global.h" */
#include "./shell-global.h"
GType
shell_stage_input_mode_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { SHELL_STAGE_INPUT_MODE_NONREACTIVE, "SHELL_STAGE_INPUT_MODE_NONREACTIVE", "nonreactive" },
        { SHELL_STAGE_INPUT_MODE_NORMAL, "SHELL_STAGE_INPUT_MODE_NORMAL", "normal" },
        { SHELL_STAGE_INPUT_MODE_FOCUSED, "SHELL_STAGE_INPUT_MODE_FOCUSED", "focused" },
        { SHELL_STAGE_INPUT_MODE_FULLSCREEN, "SHELL_STAGE_INPUT_MODE_FULLSCREEN", "fullscreen" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static("ShellStageInputMode", values);
    }
  return enum_type_id;
}
GType
shell_cursor_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { SHELL_CURSOR_DND_IN_DRAG, "SHELL_CURSOR_DND_IN_DRAG", "dnd-in-drag" },
        { SHELL_CURSOR_DND_UNSUPPORTED_TARGET, "SHELL_CURSOR_DND_UNSUPPORTED_TARGET", "dnd-unsupported-target" },
        { SHELL_CURSOR_DND_MOVE, "SHELL_CURSOR_DND_MOVE", "dnd-move" },
        { SHELL_CURSOR_DND_COPY, "SHELL_CURSOR_DND_COPY", "dnd-copy" },
        { SHELL_CURSOR_POINTING_HAND, "SHELL_CURSOR_POINTING_HAND", "pointing-hand" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static("ShellCursor", values);
    }
  return enum_type_id;
}
GType
shell_session_type_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { SHELL_SESSION_USER, "SHELL_SESSION_USER", "user" },
        { SHELL_SESSION_GDM, "SHELL_SESSION_GDM", "gdm" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static("ShellSessionType", values);
    }
  return enum_type_id;
}
/* enumerations from "./shell-mobile-providers.h" */
#include "./shell-mobile-providers.h"
GType
shell_mobile_access_method_type_get_type(void) {
  static GType enum_type_id = 0;
  if (G_UNLIKELY (!enum_type_id))
    {
      static const GEnumValue values[] = {
        { SHELL_MOBILE_ACCESS_METHOD_TYPE_UNKNOWN, "SHELL_MOBILE_ACCESS_METHOD_TYPE_UNKNOWN", "unknown" },
        { SHELL_MOBILE_ACCESS_METHOD_TYPE_GSM, "SHELL_MOBILE_ACCESS_METHOD_TYPE_GSM", "gsm" },
        { SHELL_MOBILE_ACCESS_METHOD_TYPE_CDMA, "SHELL_MOBILE_ACCESS_METHOD_TYPE_CDMA", "cdma" },
        { 0, NULL, NULL }
      };
      enum_type_id = g_enum_register_static("ShellMobileAccessMethodType", values);
    }
  return enum_type_id;
}

/* Generated data ends here */

