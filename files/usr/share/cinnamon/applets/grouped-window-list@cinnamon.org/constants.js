var CLOSE_BTN_SIZE = 22;
var CLOSED_BUTTON_STYLE = 'padding: 0px; width: ' + CLOSE_BTN_SIZE + 'px; height: '
    + CLOSE_BTN_SIZE + 'px; max-width: ' + CLOSE_BTN_SIZE
    + 'px; max-height: ' + CLOSE_BTN_SIZE + 'px; ' + '-cinnamon-close-overlap: 0px;' +
    'background-size: ' + CLOSE_BTN_SIZE + 'px ' + CLOSE_BTN_SIZE + 'px;';
var THUMBNAIL_ICON_SIZE = 16;
var OPACITY_OPAQUE = 255;
var BUTTON_BOX_ANIMATION_TIME = 150;
var MAX_BUTTON_WIDTH = 150; // Pixels
var FLASH_INTERVAL = 500;
var FLASH_MAX_COUNT = 4;
var RESERVE_KEYS = ['willUnmount'];
var TitleDisplay = {
    None: 1,
    App: 2,
    Title: 3,
    Focused: 4
};
var FavType = {
    favorites: 0,
    pinnedApps: 1,
    none: 2
};
var autoStartStrDir = './.config/autostart';
