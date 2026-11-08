// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

/**
 * #AlbumArtLoader:
 * @short_description: Turns an MPRIS art URL into a sized ClutterActor
 *
 * Handles http(s) URLs, data:image base64 URLs, file:// URLs and plain
 * paths. Remote and inline images are staged in a temporary file which
 * is replaced on the next such request and removed on destroy().
 *
 * The image is decoded for the highest-scale monitor.
 */
var AlbumArtLoader = class AlbumArtLoader {
    constructor() {
        this._tmpFile = null;
        this._generation = 0;
    }

    /**
     * load:
     * @url (string): the art URL, or null/empty for no art
     * @size (number): the box the art must fit in, in logical pixels
     * @callback (function): called with (imageActor, localPath), or (null, null) when there is no usable art
     *
     * A newer call supersedes any pending one, whose result is dropped.
     */
    load(url, size, callback) {
        const generation = ++this._generation;

        const deliver = (path) => {
            if (generation !== this._generation)
                return;

            if (!path) {
                callback(null, null);
                return;
            }

            this._loadImage(path, size, generation, callback);
        };

        if (!url) {
            deliver(null);
        } else if (url.match(/^https?:\/\//)) {
            this._download(url, deliver);
        } else if (url.match(/^data:image\//)) {
            this._writeBase64(url, deliver);
        } else if (url.match(/^file:\/\//)) {
            this._resolveLocal(Gio.File.new_for_uri(url), deliver);
        } else if (GLib.path_is_absolute(url)) {
            this._resolveLocal(Gio.File.new_for_path(url), deliver);
        } else {
            deliver(null);
        }
    }

    /**
     * destroy:
     *
     * Drops any pending request and removes the temporary file. The loader
     * stays usable afterwards.
     */
    destroy() {
        this._generation++;
        this._removeTmpFile();
    }

    _resolveLocal(file, deliver) {
        file.query_info_async(
            Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (f, result) => {
                try {
                    f.query_info_finish(result);
                    deliver(f.get_path());
                } catch (e) {
                    deliver(null);
                }
            }
        );
    }

    _download(url, deliver) {
        const tmpFile = this._newTmpFile();
        if (!tmpFile) {
            deliver(null);
            return;
        }

        Gio.File.new_for_uri(url).copy_async(
            tmpFile,
            Gio.FileCopyFlags.OVERWRITE,
            GLib.PRIORITY_DEFAULT,
            null, null,
            (source, result) => {
                try {
                    source.copy_finish(result);
                    deliver(tmpFile.get_path());
                } catch (e) {
                    global.logWarning(`AlbumArtLoader: Failed to download album art: ${e.message}`);
                    deliver(null);
                }
            }
        );
    }

    _writeBase64(dataUrl, deliver) {
        const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (!match) {
            deliver(null);
            return;
        }

        let decoded;
        try {
            decoded = GLib.base64_decode(match[2]);
        } catch (e) {
            global.logError(`AlbumArtLoader: Failed to decode base64 album art: ${e}`);
            deliver(null);
            return;
        }

        const tmpFile = this._newTmpFile();
        if (!tmpFile) {
            deliver(null);
            return;
        }

        tmpFile.replace_contents_bytes_async(
            new GLib.Bytes(decoded),
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
            (file, result) => {
                try {
                    file.replace_contents_finish(result);
                    deliver(tmpFile.get_path());
                } catch (e) {
                    global.logError(`AlbumArtLoader: Failed to write album art: ${e}`);
                    deliver(null);
                }
            }
        );
    }

    _loadImage(path, size, generation, callback) {
        const resourceScale = global.stage.get_resource_scale();
        const pixelSize = Math.round(size * global.ui_scale * resourceScale);

        St.TextureCache.get_default().load_image_from_file_async(path, pixelSize, pixelSize, (cache, handle, image) => {
            if (generation !== this._generation) {
                image.destroy();
                return;
            }

            if (image.get_content() === null) {
                image.destroy();
                callback(null, null);
                return;
            }

            image.set_size(image.width / resourceScale, image.height / resourceScale);
            callback(image, path);
        });
    }

    _newTmpFile() {
        this._removeTmpFile();

        try {
            const [file, iostream] = Gio.file_new_tmp('XXXXXX.albumart-cover');
            iostream.close(null);
            this._tmpFile = file;
        } catch (e) {
            global.logError(`AlbumArtLoader: Failed to create temp file: ${e}`);
        }

        return this._tmpFile;
    }

    _removeTmpFile() {
        if (!this._tmpFile)
            return;

        try {
            this._tmpFile.delete(null);
        } catch (e) {
        }

        this._tmpFile = null;
    }
};
