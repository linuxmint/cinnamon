// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
//
// albumArtWidget.js - Album art widget for screensaver
//
// Displays album art, track info, and playback controls when music is playing.
//

const Clutter = imports.gi.Clutter;
const Cvc = imports.gi.Cvc;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const MprisPlayer = imports.misc.mprisPlayer;
const ScreensaverWidget = imports.ui.screensaver.screensaverWidget;
const SignalManager = imports.misc.signalManager;
const Slider = imports.ui.slider;

const SCREENSAVER_SCHEMA = 'org.cinnamon.desktop.screensaver';
const ALBUM_ART_SIZE_BASE = 300;
const CONTROL_ICON_SIZE_BASE = 24;

var AlbumArtWidget = GObject.registerClass(
class AlbumArtWidget extends ScreensaverWidget.ScreensaverWidget {
    _init() {
        super._init({
            style_class: 'albumart-widget',
            vertical: true,
            x_expand: false,
            y_expand: false
        });

        this._settings = new Gio.Settings({ schema_id: SCREENSAVER_SCHEMA });
        this._showAlbumArt = this._settings.get_boolean('show-album-art');
        this._allowMediaControl = this._settings.get_boolean('allow-media-control');

        if (!this._showAlbumArt) {
            this.hide();
            return;
        }

        this._artSize = ALBUM_ART_SIZE_BASE * global.ui_scale;
        this._controlIconSize = CONTROL_ICON_SIZE_BASE;

        this.setAwakePosition(0, St.Align.END, St.Align.MIDDLE);

        this._signalManager = new SignalManager.SignalManager(null);
        this._mprisManager = MprisPlayer.getMprisPlayerManager();
        this._currentPlayer = null;
        this._currentArtUrl = null;
        this._coverFileTmp = null;
        this._coverLoadHandle = 0;

        if (this._allowMediaControl) {
            this._volumeControl = new Cvc.MixerControl({ name: 'Cinnamon Screensaver' });
            this._volumeNorm = this._volumeControl.get_vol_max_norm();
            this._outputStream = null;
            this._outputVolumeId = 0;
            this._outputMutedId = 0;
        }

        this._buildUI();
        this._connectToManager();

        if (this._allowMediaControl) {
            this._setupVolumeControl();
        }
    }

    _setupVolumeControl() {
        this._signalManager.connect(this._volumeControl, 'state-changed',
            this._onVolumeControlStateChanged.bind(this));
        this._signalManager.connect(this._volumeControl, 'default-sink-changed',
            this._onDefaultSinkChanged.bind(this));
        this._volumeControl.open();
    }

    _onVolumeControlStateChanged() {
        if (this._volumeControl.get_state() === Cvc.MixerControlState.READY) {
            this._onDefaultSinkChanged();
        }
    }

    _onDefaultSinkChanged() {
        if (this._outputStream) {
            if (this._outputVolumeId) {
                this._outputStream.disconnect(this._outputVolumeId);
                this._outputVolumeId = 0;
            }
            if (this._outputMutedId) {
                this._outputStream.disconnect(this._outputMutedId);
                this._outputMutedId = 0;
            }
        }

        this._outputStream = this._volumeControl.get_default_sink();

        if (this._outputStream) {
            this._outputVolumeId = this._outputStream.connect('notify::volume',
                this._updateVolumeSlider.bind(this));
            this._outputMutedId = this._outputStream.connect('notify::is-muted',
                this._updateVolumeSlider.bind(this));
            this._updateVolumeSlider();
        }
    }

    _updateVolumeSlider() {
        if (!this._outputStream) return;

        let muted = this._outputStream.is_muted;
        let volume = muted ? 0 : this._outputStream.volume / this._volumeNorm;

        this._volumeSlider.setValue(Math.min(1, volume));
        this._updateVolumeIcon(volume, muted);
    }

    _updateVolumeIcon(volume, muted) {
        let iconName;
        if (muted || volume <= 0) {
            iconName = 'audio-volume-muted-symbolic';
        } else if (volume <= 0.33) {
            iconName = 'audio-volume-low-symbolic';
        } else if (volume <= 0.66) {
            iconName = 'audio-volume-medium-symbolic';
        } else {
            iconName = 'audio-volume-high-symbolic';
        }
        this._volumeIcon.icon_name = iconName;
    }

    _onVolumeChanged(slider, value) {
        if (!this._outputStream) return;

        let volume = value * this._volumeNorm;

        // Snap to 100% if close
        if (volume !== this._volumeNorm &&
            volume > this._volumeNorm * 0.975 &&
            volume < this._volumeNorm * 1.025) {
            volume = this._volumeNorm;
        }

        this._outputStream.volume = volume;
        this._outputStream.push_volume();

        if (this._outputStream.is_muted && volume > 0) {
            this._outputStream.change_is_muted(false);
        }

        this._updateVolumeIcon(value, false);
    }

    _buildUI() {
        this._infoContainer = new St.BoxLayout({
            style_class: 'albumart-info-container',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this._infoContainer);

        // Art container using FixedLayout to overlay track info on album art
        this._artContainer = new St.Widget({
            layout_manager: new Clutter.FixedLayout(),
            width: this._artSize,
            height: this._artSize
        });
        this._infoContainer.add_child(this._artContainer);

        this._artBin = new St.Bin({
            style_class: 'albumart-cover-bin',
            width: this._artSize,
            height: this._artSize
        });
        this._artContainer.add_child(this._artBin);
        this._showDefaultArt();

        // Track info overlay - anchored to bottom of album art
        this._trackInfoBox = new St.BoxLayout({
            style_class: 'albumart-track-info-overlay',
            vertical: true,
            width: this._artSize
        });

        this._trackInfoBox.connect('notify::height', () => {
            this._trackInfoBox.set_position(0, this._artSize - this._trackInfoBox.height);
        });
        this._artContainer.add_child(this._trackInfoBox);

        this._titleLabel = new St.Label({
            style_class: 'albumart-title-overlay',
            x_align: Clutter.ActorAlign.CENTER
        });
        this._titleLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._titleLabel.clutter_text.line_wrap = false;
        this._trackInfoBox.add_child(this._titleLabel);

        this._artistLabel = new St.Label({
            style_class: 'albumart-artist-overlay',
            x_align: Clutter.ActorAlign.CENTER
        });
        this._artistLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._artistLabel.clutter_text.line_wrap = false;
        this._trackInfoBox.add_child(this._artistLabel);

        this._albumLabel = new St.Label({
            style_class: 'albumart-album-overlay',
            x_align: Clutter.ActorAlign.CENTER
        });
        this._albumLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._albumLabel.clutter_text.line_wrap = false;
        this._trackInfoBox.add_child(this._albumLabel);

        if (this._allowMediaControl) {
            this._controlsBox = new St.BoxLayout({
                style_class: 'albumart-controls',
                x_align: Clutter.ActorAlign.CENTER
            });

            this._prevButton = this._createControlButton(
                'media-skip-backward-symbolic',
                () => this._onPrevious()
            );
            this._controlsBox.add_child(this._prevButton);

            this._playPauseButton = this._createControlButton(
                'media-playback-start-symbolic',
                () => this._onPlayPause()
            );
            this._controlsBox.add_child(this._playPauseButton);

            this._nextButton = this._createControlButton(
                'media-skip-forward-symbolic',
                () => this._onNext()
            );
            this._controlsBox.add_child(this._nextButton);

            this._infoContainer.add_child(this._controlsBox);

            this._volumeBox = new St.BoxLayout({
                style_class: 'albumart-volume-box',
                x_align: Clutter.ActorAlign.CENTER
            });

            this._volumeIcon = new St.Icon({
                icon_name: 'audio-volume-medium-symbolic',
                icon_type: St.IconType.SYMBOLIC,
                style_class: 'albumart-volume-icon'
            });
            this._volumeBox.add_child(this._volumeIcon);

            this._volumeSlider = new Slider.Slider(0);
            this._volumeSlider.actor.style_class = 'albumart-volume-slider';
            this._volumeSlider.connect('value-changed', this._onVolumeChanged.bind(this));
            this._volumeBox.add_child(this._volumeSlider.actor);

            this._infoContainer.add_child(this._volumeBox);

            this._controlsBox.hide();
            this._volumeBox.hide();
        }

        this.hide();
    }

    _createControlButton(iconName, callback) {
        let button = new St.Button({
            style_class: 'albumart-control-button',
            can_focus: true,
            child: new St.Icon({
                icon_name: iconName,
                icon_type: St.IconType.SYMBOLIC,
                icon_size: this._controlIconSize
            })
        });
        button.connect('clicked', callback.bind(this));
        return button;
    }

    _connectToManager() {
        this._signalManager.connect(this._mprisManager, 'player-added',
            this._onPlayerAdded.bind(this));
        this._signalManager.connect(this._mprisManager, 'player-removed',
            this._onPlayerRemoved.bind(this));

        this._updateCurrentPlayer();
    }

    _onPlayerAdded(manager, player) {
        this._updateCurrentPlayer();
    }

    _onPlayerRemoved(manager, busName, owner) {
        if (this._currentPlayer && this._currentPlayer.getOwner() === owner) {
            this._disconnectFromPlayer();
            this._updateCurrentPlayer();
        }
    }

    _updateCurrentPlayer() {
        let newPlayer = this._mprisManager.getBestPlayer();

        if (newPlayer === this._currentPlayer) {
            if (this._currentPlayer) {
                this._updateDisplay();
            }
            return;
        }

        this._disconnectFromPlayer();

        this._currentPlayer = newPlayer;

        if (this._currentPlayer) {
            this._connectToPlayer();
            this._updateDisplay();
            this.show();
        } else {
            this.hide();
        }
    }

    _connectToPlayer() {
        if (!this._currentPlayer) return;

        this._signalManager.connect(this._currentPlayer, 'metadata-changed',
            this._onMetadataChanged.bind(this));
        this._signalManager.connect(this._currentPlayer, 'status-changed',
            this._onStatusChanged.bind(this));
        this._signalManager.connect(this._currentPlayer, 'capabilities-changed',
            this._updateControls.bind(this));
        this._signalManager.connect(this._currentPlayer, 'closed',
            this._onPlayerClosed.bind(this));
    }

    _disconnectFromPlayer() {
        if (!this._currentPlayer) return;

        this._signalManager.disconnect('metadata-changed', this._currentPlayer);
        this._signalManager.disconnect('status-changed', this._currentPlayer);
        this._signalManager.disconnect('capabilities-changed', this._currentPlayer);
        this._signalManager.disconnect('closed', this._currentPlayer);

        this._currentPlayer = null;
        this._currentArtUrl = null;
    }

    _onMetadataChanged() {
        this._updateDisplay();
    }

    _onStatusChanged(player, status) {
        this._updatePlayPauseButton();
        this._updateCurrentPlayer();
    }

    _onPlayerClosed() {
        this._disconnectFromPlayer();
        this._updateCurrentPlayer();
    }

    _updateDisplay() {
        if (!this._currentPlayer) return;

        let title = this._currentPlayer.getTitle();
        let artist = this._currentPlayer.getArtist();
        let album = this._currentPlayer.getAlbum();

        this._titleLabel.text = title || _("Unknown Title");
        this._artistLabel.text = artist || _("Unknown Artist");
        this._albumLabel.text = album || "";
        this._albumLabel.visible = (album !== "");

        let artUrl = this._currentPlayer.getProcessedArtUrl();

        if (artUrl !== this._currentArtUrl) {
            this._currentArtUrl = artUrl;
            this._loadAlbumArt(artUrl);
        }

        this._updateControls();
        this._updatePlayPauseButton();
    }

    _updateControls() {
        if (!this._allowMediaControl || !this._prevButton)
            return;

        if (!this._currentPlayer) {
            this._prevButton.reactive = false;
            this._playPauseButton.reactive = false;
            this._nextButton.reactive = false;
            return;
        }

        this._prevButton.reactive = this._currentPlayer.canGoPrevious();
        this._playPauseButton.reactive = this._currentPlayer.canControl();
        this._nextButton.reactive = this._currentPlayer.canGoNext();
    }

    _updatePlayPauseButton() {
        if (!this._allowMediaControl || !this._playPauseButton)
            return;

        if (!this._currentPlayer) return;

        let iconName = this._currentPlayer.isPlaying() ?
            'media-playback-pause-symbolic' : 'media-playback-start-symbolic';

        this._playPauseButton.child.icon_name = iconName;
    }

    _loadAlbumArt(url) {
        if (!url || url === "") {
            this._showDefaultArt();
            return;
        }

        if (url.match(/^https?:\/\//)) {
            // Remote URL - download it
            this._downloadAlbumArt(url);
        } else if (url.match(/^file:\/\//)) {
            this._loadLocalArt(url);
        } else if (url.match(/^data:image\//)) {
            // Base64 data URL
            this._loadBase64Art(url);
        } else {
            this._showDefaultArt();
        }
    }

    _ensureTempFile() {
        this._cleanupTempFile();

        try {
            let [file, iostream] = Gio.file_new_tmp('XXXXXX.albumart-cover');
            iostream.close(null);
            this._coverFileTmp = file;
            return true;
        } catch (e) {
            global.logError(`AlbumArtWidget: Failed to create temp file: ${e}`);
            this._showDefaultArt();
            return false;
        }
    }

    _showArtFromPath(path) {
        this._coverLoadHandle = St.TextureCache.get_default().load_image_from_file_async(
            path,
            this._artSize,
            this._artSize,
            this._onCoverLoaded.bind(this)
        );
    }

    _onCoverLoaded(cache, handle, actor) {
        if (handle !== this._coverLoadHandle) {
            return;
        }

        if (actor) {
            this._artBin.set_child(actor);
        } else {
            this._showDefaultArt();
        }
    }

    _loadLocalArt(url) {
        let file = Gio.File.new_for_uri(url);
        file.query_info_async(
            Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (f, result) => {
                try {
                    f.query_info_finish(result);
                    this._showArtFromPath(f.get_path());
                } catch (e) {
                    this._showDefaultArt();
                }
            }
        );
    }

    _downloadAlbumArt(url) {
        if (!this._ensureTempFile())
            return;

        let src = Gio.File.new_for_uri(url);
        src.copy_async(
            this._coverFileTmp,
            Gio.FileCopyFlags.OVERWRITE,
            GLib.PRIORITY_DEFAULT,
            null, null,
            (source, result) => {
                try {
                    source.copy_finish(result);
                    this._showArtFromPath(this._coverFileTmp.get_path());
                } catch (e) {
                    global.logWarning(`AlbumArtWidget: Failed to download album art: ${e.message}`);
                    this._showDefaultArt();
                }
            }
        );
    }

    _loadBase64Art(dataUrl) {
        let match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (!match) {
            this._showDefaultArt();
            return;
        }

        if (!this._ensureTempFile())
            return;

        let decoded;
        try {
            decoded = GLib.base64_decode(match[2]);
        } catch (e) {
            global.logError(`AlbumArtWidget: Failed to decode base64 art: ${e}`);
            this._showDefaultArt();
            return;
        }

        let bytes = new GLib.Bytes(decoded);
        this._coverFileTmp.replace_contents_bytes_async(
            bytes,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
            (file, result) => {
                try {
                    file.replace_contents_finish(result);
                    this._showArtFromPath(this._coverFileTmp.get_path());
                } catch (e) {
                    global.logError(`AlbumArtWidget: Failed to write base64 art: ${e}`);
                    this._showDefaultArt();
                }
            }
        );
    }

    _showDefaultArt() {
        let defaultIcon = new St.Icon({
            icon_name: 'media-optical',
            icon_size: this._artSize,
            icon_type: St.IconType.FULLCOLOR
        });
        this._artBin.set_child(defaultIcon);
    }

    _onPrevious() {
        if (this._currentPlayer) {
            this._currentPlayer.previous();
        }
    }

    _onPlayPause() {
        if (this._currentPlayer) {
            this._currentPlayer.playPause();
        }
    }

    _onNext() {
        if (this._currentPlayer) {
            this._currentPlayer.next();
        }
    }

    onScreensaverActivated() {
        this._updateCurrentPlayer();
    }

    onScreensaverDeactivated() {
        this._cleanupTempFile();
    }

    onAwake() {
        if (this._allowMediaControl && this._controlsBox) {
            this._controlsBox.show();
            this._volumeBox.show();
            this._infoContainer.add_style_pseudo_class('awake');
        }
    }

    onSleep() {
        if (this._allowMediaControl && this._controlsBox) {
            this._controlsBox.hide();
            this._volumeBox.hide();
            this._infoContainer.remove_style_pseudo_class('awake');
        }
    }

    _cleanupTempFile() {
        if (this._coverFileTmp) {
            try {
                this._coverFileTmp.delete(null);
            } catch (e) {
                // Ignore - file may not exist
            }
            this._coverFileTmp = null;
        }
    }

    destroy() {
        if (this._signalManager) {
            this._signalManager.disconnectAllSignals();
        }
        this._disconnectFromPlayer();
        this._cleanupTempFile();

        if (this._outputStream) {
            if (this._outputVolumeId) {
                this._outputStream.disconnect(this._outputVolumeId);
            }
            if (this._outputMutedId) {
                this._outputStream.disconnect(this._outputMutedId);
            }
        }
        if (this._volumeControl) {
            this._volumeControl.close();
            this._volumeControl = null;
        }

        super.destroy();
    }
});
