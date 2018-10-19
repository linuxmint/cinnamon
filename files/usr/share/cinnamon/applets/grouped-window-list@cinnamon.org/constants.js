const constants = {
    THUMBNAIL_ICON_SIZE: 16,
    OPACITY_OPAQUE: 255,
    BUTTON_BOX_ANIMATION_TIME: 0.15,
    MAX_BUTTON_WIDTH: 150, // Pixels
    FLASH_INTERVAL: 500,
    ICON_HEIGHT_FACTOR: 0.64,
    VERTICAL_ICON_HEIGHT_FACTOR: 0.75,
    RESERVE_KEYS: ['willUnmount'],
    TitleDisplay: {
        None: 1,
        App: 2,
        Title: 3,
        Focused: 4
    },
    NumberDisplay: {
        Smart: 1,
        Normal: 2,
        None: 3,
        All: 4
    },
    FavType: {
        favorites: 0,
        pinnedApps: 1,
        none: 2
    },
    autoStartStrDir: './.config/autostart'
};

module.exports = constants;
