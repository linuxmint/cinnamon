/**
 * CinnamonActionMode:
 * @CINNAMON_ACTION_MODE_NONE: block action
 * @CINNAMON_ACTION_MODE_NORMAL: allow action when in window mode,
 *     e.g. when the focus is in an application window
 * @CINNAMON_ACTION_MODE_OVERVIEW: allow action while the overview
 *     is active
 * @CINNAMON_ACTION_MODE_LOCK_SCREEN: allow action when the screen
 *     is locked, e.g. when the screen shield is shown
 * @CINNAMON_ACTION_MODE_UNLOCK_SCREEN: allow action in the unlock
 *     dialog
 * @CINNAMON_ACTION_MODE_LOGIN_SCREEN: allow action in the login screen
 * @CINNAMON_ACTION_MODE_SYSTEM_MODAL: allow action when a system modal
 *     dialog (e.g. authentication or session dialogs) is open
 * @CINNAMON_ACTION_MODE_LOOKING_GLASS: allow action in looking glass
 * @CINNAMON_ACTION_MODE_POPUP: allow action while a shell menu is open
 * @CINNAMON_ACTION_MODE_ALL: always allow action
 *
 * Controls in which Cinnamon states an action (like keybindings and gestures)
 * should be handled.
*/
typedef enum {
  CINNAMON_ACTION_MODE_NONE          = 0,
  CINNAMON_ACTION_MODE_NORMAL        = 1 << 0,
  CINNAMON_ACTION_MODE_OVERVIEW      = 1 << 1,
  CINNAMON_ACTION_MODE_LOCK_SCREEN   = 1 << 2,
  CINNAMON_ACTION_MODE_UNLOCK_SCREEN = 1 << 3,
  CINNAMON_ACTION_MODE_LOGIN_SCREEN  = 1 << 4,
  CINNAMON_ACTION_MODE_SYSTEM_MODAL  = 1 << 5,
  CINNAMON_ACTION_MODE_LOOKING_GLASS = 1 << 6,
  CINNAMON_ACTION_MODE_POPUP         = 1 << 7,

  CINNAMON_ACTION_MODE_ALL = ~0,
} CinnamonActionMode;

