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
    ffOptions: [
        {id: 1, label: 'Most Visited'},
        {id: 2, label: 'Recent History'},
        {id: 3, label: 'Bookmarks'}
    ],
    menuItemTypeOptions: [
        {id: 1, label: 'SYMBOLIC'},
        {id: 2, label: 'FULLCOLOR'},
        {id: 3, label: null}
    ],
    pseudoOptions: [
        {id: 1, label: 'hover'},
        {id: 2, label: 'focus'},
        {id: 3, label: 'active'},
        {id: 4, label: 'outlined'},
        {id: 5, label: 'selected'},
        {id: 6, label: 'checked'}
    ],
    autoStartStrDir: './.config/autostart'
};

module.exports = constants;
