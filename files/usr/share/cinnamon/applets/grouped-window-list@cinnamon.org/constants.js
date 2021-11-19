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
    ICON_NAMES: {
        area_shot: 'screenshot-area',
        base: 'x-office-database',
        big_picture: 'view-fullscreen',
        calc: 'x-office-spreadsheet',
        community: 'system-users',
        compose: 'text-editor',
        contacts: 'x-office-address-book',
        document: 'document-new',
        draw: 'x-office-drawing',
        friends: 'user-available',
        fullscreen: 'view-fullscreen',
        impress: 'x-office-presentation',
        library: 'accessories-dictionary',
        math: 'x-office-math',
        mute: 'audio-volume-muted',
        new_document: 'document-new',
        new_private_window: 'view-private',
        new_root_window: 'dialog-password',
        news: 'news',
        new_session: 'tab-new-symbolic',
        new_window: 'window-new',
        next: 'media-skip-forward',
        open_computer: 'computer',
        open_home: 'user-home',
        open_trash: 'user-trash',
        play: 'media-playback-start',
        play_pause: 'media-playback-start',
        preferences: 'preferences-other',
        prefs: 'preferences-other',
        previous: 'media-skip-backward',
        screen_shot: 'screenshot-fullscreen',
        screenshots: 'applets-screenshooter',
        servers: 'network-server',
        settings: 'preferences-other',
        ssa: 'screenshot-area',
        ssf: 'screenshot-fullscreen',
        ssw: 'screenshot-window',
        stop_quit: 'media-playback-stop',
        store: 'store',
        window: 'window-new',
        window_shot: 'screenshot-window',
        writer: 'x-office-document',
    },
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
