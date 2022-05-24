const CLOSE_BTN_SIZE = 22;
const constants = {
    CLOSE_BTN_SIZE,
    CLOSED_BUTTON_STYLE: 'padding: 0px; width: ' + CLOSE_BTN_SIZE + 'px; height: '
        + CLOSE_BTN_SIZE + 'px; max-width: ' + CLOSE_BTN_SIZE
        + 'px; max-height: ' + CLOSE_BTN_SIZE + 'px; ' + '-cinnamon-close-overlap: 0px;' +
        'background-size: ' + CLOSE_BTN_SIZE + 'px ' + CLOSE_BTN_SIZE + 'px;',
    THUMBNAIL_ICON_SIZE: 16,
    OPACITY_OPAQUE: 255,
    BUTTON_BOX_ANIMATION_TIME: 0.15,
    MAX_BUTTON_WIDTH: 150, // Pixels
    FLASH_INTERVAL: 500,
    FLASH_MAX_COUNT: 4,
    RESERVE_KEYS: ['willUnmount'],
    TitleDisplay: {
        None: 1,
        App: 2,
        Title: 3,
        Focused: 4
    },
    FavType: {
        favorites: 0,
        pinnedApps: 1,
        none: 2
    },
    autoStartStrDir: './.config/autostart',
};

module.exports = constants;
