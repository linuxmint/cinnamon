const constants = {
    CLOSE_BTN_SIZE: 22,
    THUMBNAIL_ICON_SIZE: 16,
    OPACITY_OPAQUE: 255,
    BUTTON_BOX_ANIMATION_TIME: 0.15,
    MAX_BUTTON_WIDTH: 150, // Pixels
    FLASH_INTERVAL: 500,
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
    autoStartStrDir: './.config/autostart'
};

module.exports = constants;
