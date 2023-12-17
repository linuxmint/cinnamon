/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.GdkPixbuf {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Pixbuf} instead.
	 */
	interface IPixbuf {
		/**
		 * The number of bits per sample.
		 * 
		 * Currently only 8 bit per sample are supported.
		 */
		bits_per_sample: number;
		/**
		 * The color space of the pixbuf.
		 * 
		 * Currently, only `GDK_COLORSPACE_RGB` is supported.
		 */
		colorspace: Colorspace;
		/**
		 * Whether the pixbuf has an alpha channel.
		 */
		has_alpha: boolean;
		/**
		 * The number of rows of the pixbuf.
		 */
		height: number;
		/**
		 * The number of samples per pixel.
		 * 
		 * Currently, only 3 or 4 samples per pixel are supported.
		 */
		n_channels: number;
		pixel_bytes: GLib.Bytes;
		/**
		 * A pointer to the pixel data of the pixbuf.
		 */
		pixels: any;
		/**
		 * The number of bytes between the start of a row and
		 * the start of the next row.
		 * 
		 * This number must (obviously) be at least as large as the
		 * width of the pixbuf.
		 */
		rowstride: number;
		/**
		 * The number of columns of the pixbuf.
		 */
		width: number;
		/**
		 * Takes an existing pixbuf and adds an alpha channel to it.
		 * 
		 * If the existing pixbuf already had an alpha channel, the channel
		 * values are copied from the original; otherwise, the alpha channel
		 * is initialized to 255 (full opacity).
		 * 
		 * If `substitute_color` is `TRUE`, then the color specified by the
		 * (`r`, `g`, `b`) arguments will be assigned zero opacity. That is,
		 * if you pass `(255, 255, 255)` for the substitute color, all white
		 * pixels will become fully transparent.
		 * 
		 * If `substitute_color` is `FALSE`, then the (`r`, `g`, `b`) arguments
		 * will be ignored.
		 * @param substitute_color Whether to set a color to zero opacity.
		 * @param r Red value to substitute.
		 * @param g Green value to substitute.
		 * @param b Blue value to substitute.
		 * @returns A newly-created pixbuf
		 */
		add_alpha(substitute_color: boolean, r: number, g: number, b: number): Pixbuf;
		/**
		 * Takes an existing pixbuf and checks for the presence of an
		 * associated "orientation" option.
		 * 
		 * The orientation option may be provided by the JPEG loader (which
		 * reads the exif orientation tag) or the TIFF loader (which reads
		 * the TIFF orientation tag, and compensates it for the partial
		 * transforms performed by libtiff).
		 * 
		 * If an orientation option/tag is present, the appropriate transform
		 * will be performed so that the pixbuf is oriented correctly.
		 * @returns A newly-created pixbuf
		 */
		apply_embedded_orientation(): Pixbuf | null;
		/**
		 * Creates a transformation of the source image #src by scaling by
		 * #scale_x and #scale_y then translating by #offset_x and #offset_y.
		 * 
		 * This gives an image in the coordinates of the destination pixbuf.
		 * The rectangle (#dest_x, #dest_y, #dest_width, #dest_height)
		 * is then alpha blended onto the corresponding rectangle of the
		 * original destination image.
		 * 
		 * When the destination rectangle contains parts not in the source
		 * image, the data at the edges of the source image is replicated
		 * to infinity.
		 * 
		 * ![](composite.png)
		 * @param dest the #GdkPixbuf into which to render the results
		 * @param dest_x the left coordinate for region to render
		 * @param dest_y the top coordinate for region to render
		 * @param dest_width the width of the region to render
		 * @param dest_height the height of the region to render
		 * @param offset_x the offset in the X direction (currently rounded to an integer)
		 * @param offset_y the offset in the Y direction (currently rounded to an integer)
		 * @param scale_x the scale factor in the X direction
		 * @param scale_y the scale factor in the Y direction
		 * @param interp_type the interpolation type for the transformation.
		 * @param overall_alpha overall alpha for source image (0..255)
		 */
		composite(dest: Pixbuf, dest_x: number, dest_y: number, dest_width: number, dest_height: number, offset_x: number, offset_y: number, scale_x: number, scale_y: number, interp_type: InterpType, overall_alpha: number): void;
		/**
		 * Creates a transformation of the source image #src by scaling by
		 * #scale_x and #scale_y then translating by #offset_x and #offset_y,
		 * then alpha blends the rectangle (#dest_x ,#dest_y, #dest_width,
		 * #dest_height) of the resulting image with a checkboard of the
		 * colors #color1 and #color2 and renders it onto the destination
		 * image.
		 * 
		 * If the source image has no alpha channel, and #overall_alpha is 255, a fast
		 * path is used which omits the alpha blending and just performs the scaling.
		 * 
		 * See {@link GdkPixbuf.composite_color_simple} for a simpler variant of this
		 * function suitable for many tasks.
		 * @param dest the #GdkPixbuf into which to render the results
		 * @param dest_x the left coordinate for region to render
		 * @param dest_y the top coordinate for region to render
		 * @param dest_width the width of the region to render
		 * @param dest_height the height of the region to render
		 * @param offset_x the offset in the X direction (currently rounded to an integer)
		 * @param offset_y the offset in the Y direction (currently rounded to an integer)
		 * @param scale_x the scale factor in the X direction
		 * @param scale_y the scale factor in the Y direction
		 * @param interp_type the interpolation type for the transformation.
		 * @param overall_alpha overall alpha for source image (0..255)
		 * @param check_x the X offset for the checkboard (origin of checkboard is at -#check_x, -#check_y)
		 * @param check_y the Y offset for the checkboard
		 * @param check_size the size of checks in the checkboard (must be a power of two)
		 * @param color1 the color of check at upper left
		 * @param color2 the color of the other check
		 */
		composite_color(dest: Pixbuf, dest_x: number, dest_y: number, dest_width: number, dest_height: number, offset_x: number, offset_y: number, scale_x: number, scale_y: number, interp_type: InterpType, overall_alpha: number, check_x: number, check_y: number, check_size: number, color1: number, color2: number): void;
		/**
		 * Creates a new pixbuf by scaling `src` to `dest_width` x `dest_height`
		 * and alpha blending the result with a checkboard of colors `color1`
		 * and `color2`.
		 * @param dest_width the width of destination image
		 * @param dest_height the height of destination image
		 * @param interp_type the interpolation type for the transformation.
		 * @param overall_alpha overall alpha for source image (0..255)
		 * @param check_size the size of checks in the checkboard (must be a power of two)
		 * @param color1 the color of check at upper left
		 * @param color2 the color of the other check
		 * @returns the new pixbuf
		 */
		composite_color_simple(dest_width: number, dest_height: number, interp_type: InterpType, overall_alpha: number, check_size: number, color1: number, color2: number): Pixbuf | null;
		/**
		 * Creates a new `GdkPixbuf` with a copy of the information in the specified
		 * `pixbuf`.
		 * 
		 * Note that this does not copy the options set on the original `GdkPixbuf`,
		 * use {@link GdkPixbuf.copy_options} for this.
		 * @returns A newly-created pixbuf
		 */
		copy(): Pixbuf | null;
		/**
		 * Copies a rectangular area from `src_pixbuf` to `dest_pixbuf`.
		 * 
		 * Conversion of pixbuf formats is done automatically.
		 * 
		 * If the source rectangle overlaps the destination rectangle on the
		 * same pixbuf, it will be overwritten during the copy operation.
		 * Therefore, you can not use this function to scroll a pixbuf.
		 * @param src_x Source X coordinate within #src_pixbuf.
		 * @param src_y Source Y coordinate within #src_pixbuf.
		 * @param width Width of the area to copy.
		 * @param height Height of the area to copy.
		 * @param dest_pixbuf Destination pixbuf.
		 * @param dest_x X coordinate within #dest_pixbuf.
		 * @param dest_y Y coordinate within #dest_pixbuf.
		 */
		copy_area(src_x: number, src_y: number, width: number, height: number, dest_pixbuf: Pixbuf, dest_x: number, dest_y: number): void;
		/**
		 * Copies the key/value pair options attached to a `GdkPixbuf` to another
		 * `GdkPixbuf`.
		 * 
		 * This is useful to keep original metadata after having manipulated
		 * a file. However be careful to remove metadata which you've already
		 * applied, such as the "orientation" option after rotating the image.
		 * @param dest_pixbuf the destination pixbuf
		 * @returns `TRUE` on success.
		 */
		copy_options(dest_pixbuf: Pixbuf): boolean;
		/**
		 * Clears a pixbuf to the given RGBA value, converting the RGBA value into
		 * the pixbuf's pixel format.
		 * 
		 * The alpha component will be ignored if the pixbuf doesn't have an alpha
		 * channel.
		 * @param pixel RGBA pixel to used to clear (`0xffffffff` is opaque white,
		 *   `0x00000000` transparent black)
		 */
		fill(pixel: number): void;
		/**
		 * Flips a pixbuf horizontally or vertically and returns the
		 * result in a new pixbuf.
		 * @param horizontal `TRUE` to flip horizontally, `FALSE` to flip vertically
		 * @returns the new pixbuf
		 */
		flip(horizontal: boolean): Pixbuf | null;
		/**
		 * Queries the number of bits per color sample in a pixbuf.
		 * @returns Number of bits per color sample.
		 */
		get_bits_per_sample(): number;
		/**
		 * Returns the length of the pixel data, in bytes.
		 * @returns The length of the pixel data.
		 */
		get_byte_length(): number;
		/**
		 * Queries the color space of a pixbuf.
		 * @returns Color space.
		 */
		get_colorspace(): Colorspace;
		/**
		 * Queries whether a pixbuf has an alpha channel (opacity information).
		 * @returns `TRUE` if it has an alpha channel, `FALSE` otherwise.
		 */
		get_has_alpha(): boolean;
		/**
		 * Queries the height of a pixbuf.
		 * @returns Height in pixels.
		 */
		get_height(): number;
		/**
		 * Queries the number of channels of a pixbuf.
		 * @returns Number of channels.
		 */
		get_n_channels(): number;
		/**
		 * Looks up #key in the list of options that may have been attached to the
		 * #pixbuf when it was loaded, or that may have been attached by another
		 * function using {@link GdkPixbuf.set_option}.
		 * 
		 * For instance, the ANI loader provides "Title" and "Artist" options.
		 * The ICO, XBM, and XPM loaders provide "x_hot" and "y_hot" hot-spot
		 * options for cursor definitions. The PNG loader provides the tEXt ancillary
		 * chunk key/value pairs as options. Since 2.12, the TIFF and JPEG loaders
		 * return an "orientation" option string that corresponds to the embedded
		 * TIFF/Exif orientation tag (if present). Since 2.32, the TIFF loader sets
		 * the "multipage" option string to "yes" when a multi-page TIFF is loaded.
		 * Since 2.32 the JPEG and PNG loaders set "x-dpi" and "y-dpi" if the file
		 * contains image density information in dots per inch.
		 * Since 2.36.6, the JPEG loader sets the "comment" option with the comment
		 * EXIF tag.
		 * @param key a nul-terminated string.
		 * @returns the value associated with `key`
		 */
		get_option(key: string): string | null;
		/**
		 * Returns a `GHashTable` with a list of all the options that may have been
		 * attached to the `pixbuf` when it was loaded, or that may have been
		 * attached by another function using [method#GdkPixbuf.Pixbuf.set_option].
		 * @returns a #GHashTable
		 *   of key/values pairs
		 */
		get_options(): string[];
		/**
		 * Queries a pointer to the pixel data of a pixbuf.
		 * 
		 * This function will cause an implicit copy of the pixbuf data if the
		 * pixbuf was created from read-only data.
		 * 
		 * Please see the section on [image data](#image-data) for information
		 * about how the pixel data is stored in memory.
		 * @returns A pointer to the pixbuf's
		 * pixel data.
		 * 
		 * The length of the binary data.
		 */
		get_pixels(): [ number[], number ];
		/**
		 * Queries the rowstride of a pixbuf, which is the number of bytes between
		 * the start of a row and the start of the next row.
		 * @returns Distance between row starts.
		 */
		get_rowstride(): number;
		/**
		 * Queries the width of a pixbuf.
		 * @returns Width in pixels.
		 */
		get_width(): number;
		/**
		 * Creates a new pixbuf which represents a sub-region of `src_pixbuf`.
		 * 
		 * The new pixbuf shares its pixels with the original pixbuf, so
		 * writing to one affects both.  The new pixbuf holds a reference to
		 * `src_pixbuf`, so `src_pixbuf` will not be finalized until the new
		 * pixbuf is finalized.
		 * 
		 * Note that if `src_pixbuf` is read-only, this function will force it
		 * to be mutable.
		 * @param src_x X coord in #src_pixbuf
		 * @param src_y Y coord in #src_pixbuf
		 * @param width width of region in #src_pixbuf
		 * @param height height of region in #src_pixbuf
		 * @returns a new pixbuf
		 */
		new_subpixbuf(src_x: number, src_y: number, width: number, height: number): Pixbuf;
		/**
		 * Provides a #GBytes buffer containing the raw pixel data; the data
		 * must not be modified.
		 * 
		 * This function allows skipping the implicit copy that must be made
		 * if {@link GdkPixbuf.get_pixels} is called on a read-only pixbuf.
		 * @returns A new reference to a read-only copy of
		 *   the pixel data.  Note that for mutable pixbufs, this function will
		 *   incur a one-time copy of the pixel data for conversion into the
		 *   returned #GBytes.
		 */
		read_pixel_bytes(): GLib.Bytes;
		/**
		 * Provides a read-only pointer to the raw pixel data.
		 * 
		 * This function allows skipping the implicit copy that must be made
		 * if {@link GdkPixbuf.get_pixels} is called on a read-only pixbuf.
		 * @returns a read-only pointer to the raw pixel data
		 */
		read_pixels(): number;
		/**
		 * @deprecated
		 * Use {@link GObject.ref}.
		 * 
		 * Adds a reference to a pixbuf.
		 * @returns The same as the #pixbuf argument.
		 */
		ref(): Pixbuf;
		/**
		 * Removes the key/value pair option attached to a `GdkPixbuf`.
		 * @param key a nul-terminated string representing the key to remove.
		 * @returns `TRUE` if an option was removed, `FALSE` if not.
		 */
		remove_option(key: string): boolean;
		/**
		 * Rotates a pixbuf by a multiple of 90 degrees, and returns the
		 * result in a new pixbuf.
		 * 
		 * If `angle` is 0, this function will return a copy of `src`.
		 * @param angle the angle to rotate by
		 * @returns the new pixbuf
		 */
		rotate_simple(angle: PixbufRotation): Pixbuf | null;
		/**
		 * Modifies saturation and optionally pixelates `src`, placing the result in
		 * `dest`.
		 * 
		 * The `src` and `dest` pixbufs must have the same image format, size, and
		 * rowstride.
		 * 
		 * The `src` and `dest` arguments may be the same pixbuf with no ill effects.
		 * 
		 * If `saturation` is 1.0 then saturation is not changed. If it's less than 1.0,
		 * saturation is reduced (the image turns toward grayscale); if greater than
		 * 1.0, saturation is increased (the image gets more vivid colors).
		 * 
		 * If `pixelate` is `TRUE`, then pixels are faded in a checkerboard pattern to
		 * create a pixelated image.
		 * @param dest place to write modified version of #src
		 * @param saturation saturation factor
		 * @param pixelate whether to pixelate
		 */
		saturate_and_pixelate(dest: Pixbuf, saturation: number, pixelate: boolean): void;
		/**
		 * Saves pixbuf to a file in format #type. By default, "jpeg", "png", "ico"
		 * and "bmp" are possible file formats to save in, but more formats may be
		 * installed. The list of all writable formats can be determined in the
		 * following way:
		 * 
		 * ```c
		 * void add_if_writable (GdkPixbufFormat *data, GSList **list)
		 * {
		 *   if (gdk_pixbuf_format_is_writable (data))
		 *     *list = g_slist_prepend (*list, data);
		 * }
		 * 
		 * GSList *formats = gdk_pixbuf_get_formats ();
		 * GSList *writable_formats = NULL;
		 * g_slist_foreach (formats, add_if_writable, &writable_formats);
		 * g_slist_free (formats);
		 * ```
		 * 
		 * If `error` is set, `FALSE` will be returned. Possible errors include
		 * those in the `GDK_PIXBUF_ERROR` domain and those in the `G_FILE_ERROR`
		 * domain.
		 * 
		 * The variable argument list should be `NULL`-terminated; if not empty,
		 * it should contain pairs of strings that modify the save
		 * parameters. For example:
		 * 
		 * ```c
		 * gdk_pixbuf_save (pixbuf, handle, "jpeg", &error, "quality", "100", NULL);
		 * ```
		 * 
		 * Currently only few parameters exist.
		 * 
		 * JPEG images can be saved with a "quality" parameter; its value should be
		 * in the range `[0, 100]`. JPEG and PNG density can be set by setting the
		 * "x-dpi" and "y-dpi" parameters to the appropriate values in dots per inch.
		 * 
		 * Text chunks can be attached to PNG images by specifying parameters of
		 * the form "tEXt::key", where key is an ASCII string of length 1-79.
		 * The values are UTF-8 encoded strings. The PNG compression level can
		 * be specified using the "compression" parameter; it's value is in an
		 * integer in the range of `[0, 9]`.
		 * 
		 * ICC color profiles can also be embedded into PNG, JPEG and TIFF images.
		 * The "icc-profile" value should be the complete ICC profile encoded
		 * into base64.
		 * 
		 * ```c
		 * char *contents;
		 * gsize length;
		 * 
		 * // icm_path is set elsewhere
		 * g_file_get_contents (icm_path, &contents, &length, NULL);
		 * 
		 * char *contents_encode = g_base64_encode ((const guchar *) contents, length);
		 * 
		 * gdk_pixbuf_save (pixbuf, handle, "png", &error, "icc-profile", contents_encode, NULL);
		 * ```
		 * 
		 * TIFF images recognize:
		 * 
		 *  1. a "bits-per-sample" option (integer) which can be either 1 for saving
		 *     bi-level CCITTFAX4 images, or 8 for saving 8-bits per sample
		 *  2. a "compression" option (integer) which can be 1 for no compression,
		 *     2 for Huffman, 5 for LZW, 7 for JPEG and 8 for DEFLATE (see the libtiff
		 *     documentation and tiff.h for all supported codec values)
		 *  3. an "icc-profile" option (zero-terminated string) containing a base64
		 *     encoded ICC color profile.
		 * 
		 * ICO images can be saved in depth 16, 24, or 32, by using the "depth"
		 * parameter. When the ICO saver is given "x_hot" and "y_hot" parameters,
		 * it produces a CUR instead of an ICO.
		 * @param filename name of file to save.
		 * @param type name of file format.
		 * @param error return location for error
		 * @returns `TRUE` on success, and `FALSE` otherwise
		 */
		save(filename: string, type: string, error?: GLib.Error | null): boolean;
		/**
		 * Saves pixbuf to a new buffer in format `type`, which is currently "jpeg",
		 * "png", "tiff", "ico" or "bmp".
		 * 
		 * This is a convenience function that uses {@link `gdk.pixbuf_save_to_callback}`
		 * to do the real work.
		 * 
		 * Note that the buffer is not `NUL`-terminated and may contain embedded `NUL`
		 * characters.
		 * 
		 * If #error is set, `FALSE` will be returned and #buffer will be set to
		 * `NULL`. Possible errors include those in the `GDK_PIXBUF_ERROR`
		 * domain.
		 * 
		 * See `gdk_pixbuf_save()` for more details.
		 * @param type name of file format.
		 * @param error return location for error, or `NULL`
		 * @returns whether an error was set
		 * 
		 * location to receive a pointer
		 *   to the new buffer.
		 */
		save_to_buffer(type: string, error?: GLib.Error | null): [ boolean, number[] ];
		/**
		 * Vector version of {@link `gdk.pixbuf_save_to_buffer}`.
		 * 
		 * Saves pixbuf to a new buffer in format #type, which is currently "jpeg",
		 * "tiff", "png", "ico" or "bmp".
		 * 
		 * See [method#GdkPixbuf.Pixbuf.save_to_buffer] for more details.
		 * @param type name of file format.
		 * @param option_keys name of options to set
		 * @param option_values values for named options
		 * @returns whether an error was set
		 * 
		 * 
		 *   location to receive a pointer to the new buffer.
		 */
		save_to_bufferv(type: string, option_keys?: string[] | null, option_values?: string[] | null): [ boolean, number[] ];
		/**
		 * Saves pixbuf in format `type` by feeding the produced data to a
		 * callback.
		 * 
		 * This function can be used when you want to store the image to something
		 * other than a file, such as an in-memory buffer or a socket.
		 * 
		 * If #error is set, `FALSE` will be returned. Possible errors
		 * include those in the `GDK_PIXBUF_ERROR` domain and whatever the save
		 * function generates.
		 * 
		 * See [method#GdkPixbuf.Pixbuf.save] for more details.
		 * @param save_func a function that is called to save each block of data that
		 *   the save routine generates.
		 * @param type name of file format.
		 * @param error return location for error, or `NULL`
		 * @returns whether an error was set
		 */
		save_to_callback(save_func: PixbufSaveFunc, type: string, error?: GLib.Error | null): boolean;
		/**
		 * Vector version of {@link `gdk.pixbuf_save_to_callback}`.
		 * 
		 * Saves pixbuf to a callback in format #type, which is currently "jpeg",
		 * "png", "tiff", "ico" or "bmp".
		 * 
		 * If #error is set, `FALSE` will be returned.
		 * 
		 * See [method#GdkPixbuf.Pixbuf.save_to_callback] for more details.
		 * @param save_func a function that is called to save each block of data that
		 *   the save routine generates.
		 * @param type name of file format.
		 * @param option_keys name of options to set
		 * @param option_values values for named options
		 * @returns whether an error was set
		 */
		save_to_callbackv(save_func: PixbufSaveFunc, type: string, option_keys?: string[] | null, option_values?: string[] | null): boolean;
		/**
		 * Saves `pixbuf` to an output stream.
		 * 
		 * Supported file formats are currently "jpeg", "tiff", "png", "ico" or
		 * "bmp". See {@link `gdk.pixbuf_save_to_buffer}` for more details.
		 * 
		 * The `cancellable` can be used to abort the operation from another
		 * thread. If the operation was cancelled, the error `G_IO_ERROR_CANCELLED`
		 * will be returned. Other possible errors are in the `GDK_PIXBUF_ERROR`
		 * and `G_IO_ERROR` domains.
		 * 
		 * The stream is not closed at the end of this call.
		 * @param stream a `GOutputStream` to save the pixbuf to
		 * @param type name of file format
		 * @param cancellable optional `GCancellable` object, `NULL` to ignore
		 * @param error return location for error, or `NULL`
		 * @returns `TRUE` if the pixbuf was saved successfully, `FALSE` if an
		 *   error was set.
		 */
		save_to_stream(stream: Gio.OutputStream, type: string, cancellable?: Gio.Cancellable | null, error?: GLib.Error | null): boolean;
		/**
		 * Saves `pixbuf` to an output stream asynchronously.
		 * 
		 * For more details see {@link GdkPixbuf.save_to_stream}, which is the synchronous
		 * version of this function.
		 * 
		 * When the operation is finished, `callback` will be called in the main thread.
		 * 
		 * You can then call gdk_pixbuf_save_to_stream_finish() to get the result of
		 * the operation.
		 * @param stream a `GOutputStream` to which to save the pixbuf
		 * @param type name of file format
		 * @param cancellable optional `GCancellable` object, `NULL` to ignore
		 * @param callback a `GAsyncReadyCallback` to call when the pixbuf is saved
		 */
		save_to_stream_async(stream: Gio.OutputStream, type: string, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Saves `pixbuf` to an output stream.
		 * 
		 * Supported file formats are currently "jpeg", "tiff", "png", "ico" or
		 * "bmp".
		 * 
		 * See [method#GdkPixbuf.Pixbuf.save_to_stream] for more details.
		 * @param stream a `GOutputStream` to save the pixbuf to
		 * @param type name of file format
		 * @param option_keys name of options to set
		 * @param option_values values for named options
		 * @param cancellable optional `GCancellable` object, `NULL` to ignore
		 * @returns `TRUE` if the pixbuf was saved successfully, `FALSE` if an
		 *   error was set.
		 */
		save_to_streamv(stream: Gio.OutputStream, type: string, option_keys?: string[] | null, option_values?: string[] | null, cancellable?: Gio.Cancellable | null): boolean;
		/**
		 * Saves `pixbuf` to an output stream asynchronously.
		 * 
		 * For more details see {@link GdkPixbuf.save_to_streamv}, which is the synchronous
		 * version of this function.
		 * 
		 * When the operation is finished, `callback` will be called in the main thread.
		 * 
		 * You can then call gdk_pixbuf_save_to_stream_finish() to get the result of
		 * the operation.
		 * @param stream a `GOutputStream` to which to save the pixbuf
		 * @param type name of file format
		 * @param option_keys name of options to set
		 * @param option_values values for named options
		 * @param cancellable optional `GCancellable` object, `NULL` to ignore
		 * @param callback a `GAsyncReadyCallback` to call when the pixbuf is saved
		 */
		save_to_streamv_async(stream: Gio.OutputStream, type: string, option_keys?: string[] | null, option_values?: string[] | null, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Vector version of {@link `gdk.pixbuf_save}`.
		 * 
		 * Saves pixbuf to a file in `type`, which is currently "jpeg", "png", "tiff", "ico" or "bmp".
		 * 
		 * If #error is set, `FALSE` will be returned.
		 * 
		 * See [method#GdkPixbuf.Pixbuf.save] for more details.
		 * @param filename name of file to save.
		 * @param type name of file format.
		 * @param option_keys name of options to set
		 * @param option_values values for named options
		 * @returns whether an error was set
		 */
		savev(filename: string, type: string, option_keys?: string[] | null, option_values?: string[] | null): boolean;
		/**
		 * Creates a transformation of the source image #src by scaling by
		 * #scale_x and #scale_y then translating by #offset_x and #offset_y,
		 * then renders the rectangle (#dest_x, #dest_y, #dest_width,
		 * #dest_height) of the resulting image onto the destination image
		 * replacing the previous contents.
		 * 
		 * Try to use {@link GdkPixbuf.scale_simple} first; this function is
		 * the industrial-strength power tool you can fall back to, if
		 * gdk_pixbuf_scale_simple() isn't powerful enough.
		 * 
		 * If the source rectangle overlaps the destination rectangle on the
		 * same pixbuf, it will be overwritten during the scaling which
		 * results in rendering artifacts.
		 * @param dest the #GdkPixbuf into which to render the results
		 * @param dest_x the left coordinate for region to render
		 * @param dest_y the top coordinate for region to render
		 * @param dest_width the width of the region to render
		 * @param dest_height the height of the region to render
		 * @param offset_x the offset in the X direction (currently rounded to an integer)
		 * @param offset_y the offset in the Y direction (currently rounded to an integer)
		 * @param scale_x the scale factor in the X direction
		 * @param scale_y the scale factor in the Y direction
		 * @param interp_type the interpolation type for the transformation.
		 */
		scale(dest: Pixbuf, dest_x: number, dest_y: number, dest_width: number, dest_height: number, offset_x: number, offset_y: number, scale_x: number, scale_y: number, interp_type: InterpType): void;
		/**
		 * Create a new pixbuf containing a copy of `src` scaled to
		 * `dest_width` x `dest_height`.
		 * 
		 * This function leaves `src` unaffected.
		 * 
		 * The `interp_type` should be `GDK_INTERP_NEAREST` if you want maximum
		 * speed (but when scaling down `GDK_INTERP_NEAREST` is usually unusably
		 * ugly). The default `interp_type` should be `GDK_INTERP_BILINEAR` which
		 * offers reasonable quality and speed.
		 * 
		 * You can scale a sub-portion of `src` by creating a sub-pixbuf
		 * pointing into `src`; see [method#GdkPixbuf.Pixbuf.new_subpixbuf].
		 * 
		 * If `dest_width` and `dest_height` are equal to the width and height of
		 * `src`, this function will return an unscaled copy of `src`.
		 * 
		 * For more complicated scaling/alpha blending see [method#GdkPixbuf.Pixbuf.scale]
		 * and [method#GdkPixbuf.Pixbuf.composite].
		 * @param dest_width the width of destination image
		 * @param dest_height the height of destination image
		 * @param interp_type the interpolation type for the transformation.
		 * @returns the new pixbuf
		 */
		scale_simple(dest_width: number, dest_height: number, interp_type: InterpType): Pixbuf | null;
		/**
		 * Attaches a key/value pair as an option to a `GdkPixbuf`.
		 * 
		 * If `key` already exists in the list of options attached to the `pixbuf`,
		 * the new value is ignored and `FALSE` is returned.
		 * @param key a nul-terminated string.
		 * @param value a nul-terminated string.
		 * @returns `TRUE` on success
		 */
		set_option(key: string, value: string): boolean;
		/**
		 * @deprecated
		 * Use {@link GObject.unref}.
		 * 
		 * Removes a reference from a pixbuf.
		 */
		unref(): void;
		connect(signal: "notify::bits-per-sample", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::colorspace", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::has-alpha", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::height", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::n-channels", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pixel-bytes", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pixels", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::rowstride", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::width", callback: (owner: this, ...args: any) => void): number;

	}

	type PixbufInitOptionsMixin = GObject.ObjectInitOptions & Gio.IconInitOptions & Gio.LoadableIconInitOptions & 
	Pick<IPixbuf,
		"bits_per_sample" |
		"colorspace" |
		"has_alpha" |
		"height" |
		"n_channels" |
		"pixel_bytes" |
		"pixels" |
		"rowstride" |
		"width">;

	export interface PixbufInitOptions extends PixbufInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Pixbuf} instead.
	 */
	type PixbufMixin = IPixbuf & GObject.Object & Gio.Icon & Gio.LoadableIcon;

	/**
	 * A pixel buffer.
	 * 
	 * `GdkPixbuf` contains information about an image's pixel data,
	 * its color space, bits per sample, width and height, and the
	 * rowstride (the number of bytes between the start of one row
	 * and the start of the next).
	 * 
	 * ## Creating new `GdkPixbuf`
	 * 
	 * The most basic way to create a pixbuf is to wrap an existing pixel
	 * buffer with a [class#GdkPixbuf.Pixbuf] instance. You can use the
	 * [`ctor#GdkPixbuf.Pixbuf.new_from_data`] function to do this.
	 * 
	 * Every time you create a new `GdkPixbuf` instance for some data, you
	 * will need to specify the destroy notification function that will be
	 * called when the data buffer needs to be freed; this will happen when
	 * a `GdkPixbuf` is finalized by the reference counting functions. If
	 * you have a chunk of static data compiled into your application, you
	 * can pass in `NULL` as the destroy notification function so that the
	 * data will not be freed.
	 * 
	 * The [`ctor#GdkPixbuf.Pixbuf.new`] constructor function can be used
	 * as a convenience to create a pixbuf with an empty buffer; this is
	 * equivalent to allocating a data buffer using `malloc()` and then
	 * wrapping it with `gdk_pixbuf_new_from_data()`. The `gdk_pixbuf_new()`
	 * function will compute an optimal rowstride so that rendering can be
	 * performed with an efficient algorithm.
	 * 
	 * As a special case, you can use the [`ctor#GdkPixbuf.Pixbuf.new_from_xpm_data`]
	 * function to create a pixbuf from inline XPM image data.
	 * 
	 * You can also copy an existing pixbuf with the [method#Pixbuf.copy]
	 * function. This is not the same as just acquiring a reference to
	 * the old pixbuf instance: the copy function will actually duplicate
	 * the pixel data in memory and create a new [class#Pixbuf] instance
	 * for it.
	 * 
	 * ## Reference counting
	 * 
	 * `GdkPixbuf` structures are reference counted. This means that an
	 * application can share a single pixbuf among many parts of the
	 * code. When a piece of the program needs to use a pixbuf, it should
	 * acquire a reference to it by calling `g_object_ref()`; when it no
	 * longer needs the pixbuf, it should release the reference it acquired
	 * by calling `g_object_unref()`. The resources associated with a
	 * `GdkPixbuf` will be freed when its reference count drops to zero.
	 * Newly-created `GdkPixbuf` instances start with a reference count
	 * of one.
	 * 
	 * ## Image Data
	 * 
	 * Image data in a pixbuf is stored in memory in an uncompressed,
	 * packed format. Rows in the image are stored top to bottom, and
	 * in each row pixels are stored from left to right.
	 * 
	 * There may be padding at the end of a row.
	 * 
	 * The "rowstride" value of a pixbuf, as returned by [`method#GdkPixbuf.Pixbuf.get_rowstride`],
	 * indicates the number of bytes between rows.
	 * 
	 * **NOTE**: If you are copying raw pixbuf data with `memcpy()` note that the
	 * last row in the pixbuf may not be as wide as the full rowstride, but rather
	 * just as wide as the pixel data needs to be; that is: it is unsafe to do
	 * `memcpy (dest, pixels, rowstride * height)` to copy a whole pixbuf. Use
	 * [method#GdkPixbuf.Pixbuf.copy] instead, or compute the width in bytes of the
	 * last row as:
	 * 
	 * ```c
	 * last_row = width * ((n_channels * bits_per_sample + 7) / 8);
	 * ```
	 * 
	 * The same rule applies when iterating over each row of a `GdkPixbuf` pixels
	 * array.
	 * 
	 * The following code illustrates a simple `put_pixel()`
	 * function for RGB pixbufs with 8 bits per channel with an alpha
	 * channel.
	 * 
	 * ```c
	 * static void
	 * put_pixel (GdkPixbuf *pixbuf,
	 *            int x,
	 * 	   int y,
	 * 	   guchar red,
	 * 	   guchar green,
	 * 	   guchar blue,
	 * 	   guchar alpha)
	 * {
	 *   int n_channels = gdk_pixbuf_get_n_channels (pixbuf);
	 * 
	 *   // Ensure that the pixbuf is valid
	 *   g_assert (gdk_pixbuf_get_colorspace (pixbuf) == GDK_COLORSPACE_RGB);
	 *   g_assert (gdk_pixbuf_get_bits_per_sample (pixbuf) == 8);
	 *   g_assert (gdk_pixbuf_get_has_alpha (pixbuf));
	 *   g_assert (n_channels == 4);
	 * 
	 *   int width = gdk_pixbuf_get_width (pixbuf);
	 *   int height = gdk_pixbuf_get_height (pixbuf);
	 * 
	 *   // Ensure that the coordinates are in a valid range
	 *   g_assert (x >= 0 && x < width);
	 *   g_assert (y >= 0 && y < height);
	 * 
	 *   int rowstride = gdk_pixbuf_get_rowstride (pixbuf);
	 * 
	 *   // The pixel buffer in the GdkPixbuf instance
	 *   guchar *pixels = gdk_pixbuf_get_pixels (pixbuf);
	 * 
	 *   // The pixel we wish to modify
	 *   guchar *p = pixels + y * rowstride + x * n_channels;
	 *   p[0] = red;
	 *   p[1] = green;
	 *   p[2] = blue;
	 *   p[3] = alpha;
	 * }
	 * ```
	 * 
	 * ## Loading images
	 * 
	 * The `GdkPixBuf` class provides a simple mechanism for loading
	 * an image from a file in synchronous and asynchronous fashion.
	 * 
	 * For GUI applications, it is recommended to use the asynchronous
	 * stream API to avoid blocking the control flow of the application.
	 * 
	 * Additionally, `GdkPixbuf` provides the [class#GdkPixbuf.PixbufLoader`]
	 * API for progressive image loading.
	 * 
	 * ## Saving images
	 * 
	 * The `GdkPixbuf` class provides methods for saving image data in
	 * a number of file formats. The formatted data can be written to a
	 * file or to a memory buffer. `GdkPixbuf` can also call a user-defined
	 * callback on the data, which allows to e.g. write the image
	 * to a socket or store it in a database.
	 */
	interface Pixbuf extends PixbufMixin {}

	class Pixbuf {
		public constructor(options?: Partial<PixbufInitOptions>);
		/**
		 * Creates a new `GdkPixbuf` structure and allocates a buffer for it.
		 * 
		 * If the allocation of the buffer failed, this function will return `NULL`.
		 * 
		 * The buffer has an optimal rowstride. Note that the buffer is not cleared;
		 * you will have to fill it completely yourself.
		 * @param colorspace Color space for image
		 * @param has_alpha Whether the image should have transparency information
		 * @param bits_per_sample Number of bits per color sample
		 * @param width Width of image in pixels, must be > 0
		 * @param height Height of image in pixels, must be > 0
		 * @returns A newly-created pixel buffer
		 */
		public static new(colorspace: Colorspace, has_alpha: boolean, bits_per_sample: number, width: number, height: number): Pixbuf | null;
		/**
		 * Creates a new #GdkPixbuf out of in-memory readonly image data.
		 * 
		 * Currently only RGB images with 8 bits per sample are supported.
		 * 
		 * This is the `GBytes` variant of {@link GdkPixbuf.new_from_data}, useful
		 * for language bindings.
		 * @param data Image data in 8-bit/sample packed format inside a #GBytes
		 * @param colorspace Colorspace for the image data
		 * @param has_alpha Whether the data has an opacity channel
		 * @param bits_per_sample Number of bits per sample
		 * @param width Width of the image in pixels, must be > 0
		 * @param height Height of the image in pixels, must be > 0
		 * @param rowstride Distance in bytes between row starts
		 * @returns A newly-created pixbuf
		 */
		public static new_from_bytes(data: GLib.Bytes, colorspace: Colorspace, has_alpha: boolean, bits_per_sample: number, width: number, height: number, rowstride: number): Pixbuf;
		/**
		 * Creates a new #GdkPixbuf out of in-memory image data.
		 * 
		 * Currently only RGB images with 8 bits per sample are supported.
		 * 
		 * Since you are providing a pre-allocated pixel buffer, you must also
		 * specify a way to free that data.  This is done with a function of
		 * type `GdkPixbufDestroyNotify`.  When a pixbuf created with is
		 * finalized, your destroy notification function will be called, and
		 * it is its responsibility to free the pixel array.
		 * 
		 * See also: [ctor#GdkPixbuf.Pixbuf.new_from_bytes]
		 * @param data Image data in 8-bit/sample packed format
		 * @param colorspace Colorspace for the image data
		 * @param has_alpha Whether the data has an opacity channel
		 * @param bits_per_sample Number of bits per sample
		 * @param width Width of the image in pixels, must be > 0
		 * @param height Height of the image in pixels, must be > 0
		 * @param rowstride Distance in bytes between row starts
		 * @param destroy_fn Function used to free the data when the pixbuf's reference count
		 * drops to zero, or %NULL if the data should not be freed
		 * @returns A newly-created pixbuf
		 */
		public static new_from_data(data: number[], colorspace: Colorspace, has_alpha: boolean, bits_per_sample: number, width: number, height: number, rowstride: number, destroy_fn?: PixbufDestroyNotify | null): Pixbuf;
		/**
		 * Creates a new pixbuf by loading an image from a file.
		 * 
		 * The file format is detected automatically.
		 * 
		 * If `NULL` is returned, then #error will be set. Possible errors are:
		 * 
		 *  - the file could not be opened
		 *  - there is no loader for the file's format
		 *  - there is not enough memory to allocate the image buffer
		 *  - the image buffer contains invalid data
		 * 
		 * The error domains are `GDK_PIXBUF_ERROR` and `G_FILE_ERROR`.
		 * @param filename Name of file to load, in the GLib file
		 *   name encoding
		 * @returns A newly-created pixbuf
		 */
		public static new_from_file(filename: string): Pixbuf | null;
		/**
		 * Creates a new pixbuf by loading an image from a file.
		 * 
		 * The file format is detected automatically.
		 * 
		 * If `NULL` is returned, then #error will be set. Possible errors are:
		 * 
		 *  - the file could not be opened
		 *  - there is no loader for the file's format
		 *  - there is not enough memory to allocate the image buffer
		 *  - the image buffer contains invalid data
		 * 
		 * The error domains are `GDK_PIXBUF_ERROR` and `G_FILE_ERROR`.
		 * 
		 * The image will be scaled to fit in the requested size, optionally preserving
		 * the image's aspect ratio.
		 * 
		 * When preserving the aspect ratio, a `width` of -1 will cause the image
		 * to be scaled to the exact given height, and a `height` of -1 will cause
		 * the image to be scaled to the exact given width. When not preserving
		 * aspect ratio, a `width` or `height` of -1 means to not scale the image
		 * at all in that dimension. Negative values for `width` and `height` are
		 * allowed since 2.8.
		 * @param filename Name of file to load, in the GLib file
		 *     name encoding
		 * @param width The width the image should have or -1 to not constrain the width
		 * @param height The height the image should have or -1 to not constrain the height
		 * @param preserve_aspect_ratio `TRUE` to preserve the image's aspect ratio
		 * @returns A newly-created pixbuf
		 */
		public static new_from_file_at_scale(filename: string, width: number, height: number, preserve_aspect_ratio: boolean): Pixbuf | null;
		/**
		 * Creates a new pixbuf by loading an image from a file.
		 * 
		 * The file format is detected automatically.
		 * 
		 * If `NULL` is returned, then #error will be set. Possible errors are:
		 * 
		 *  - the file could not be opened
		 *  - there is no loader for the file's format
		 *  - there is not enough memory to allocate the image buffer
		 *  - the image buffer contains invalid data
		 * 
		 * The error domains are `GDK_PIXBUF_ERROR` and `G_FILE_ERROR`.
		 * 
		 * The image will be scaled to fit in the requested size, preserving
		 * the image's aspect ratio. Note that the returned pixbuf may be smaller
		 * than `width` x `height`, if the aspect ratio requires it. To load
		 * and image at the requested size, regardless of aspect ratio, use
		 * [ctor#GdkPixbuf.Pixbuf.new_from_file_at_scale].
		 * @param filename Name of file to load, in the GLib file
		 *     name encoding
		 * @param width The width the image should have or -1 to not constrain the width
		 * @param height The height the image should have or -1 to not constrain the height
		 * @returns A newly-created pixbuf
		 */
		public static new_from_file_at_size(filename: string, width: number, height: number): Pixbuf | null;
		/**
		 * @deprecated
		 * Use `GResource` instead.
		 * 
		 * Creates a `GdkPixbuf` from a flat representation that is suitable for
		 * storing as inline data in a program.
		 * 
		 * This is useful if you want to ship a program with images, but don't want
		 * to depend on any external files.
		 * 
		 * GdkPixbuf ships with a program called `gdk-pixbuf-csource`, which allows
		 * for conversion of `GdkPixbuf`s into such a inline representation.
		 * 
		 * In almost all cases, you should pass the `--raw` option to
		 * `gdk-pixbuf-csource`. A sample invocation would be:
		 * 
		 * ```
		 * gdk-pixbuf-csource --raw --name=myimage_inline myimage.png
		 * ```
		 * 
		 * For the typical case where the inline pixbuf is read-only static data,
		 * you don't need to copy the pixel data unless you intend to write to
		 * it, so you can pass `FALSE` for `copy_pixels`. If you pass `--rle` to
		 * `gdk-pixbuf-csource`, a copy will be made even if `copy_pixels` is `FALSE`,
		 * so using this option is generally a bad idea.
		 * 
		 * If you create a pixbuf from const inline data compiled into your
		 * program, it's probably safe to ignore errors and disable length checks,
		 * since things will always succeed:
		 * 
		 * ```c
		 * pixbuf = gdk_pixbuf_new_from_inline (-1, myimage_inline, FALSE, NULL);
		 * ```
		 * 
		 * For non-const inline data, you could get out of memory. For untrusted
		 * inline data located at runtime, you could have corrupt inline data in
		 * addition.
		 * @param data Byte data containing a
		 *   serialized `GdkPixdata` structure
		 * @param copy_pixels Whether to copy the pixel data, or use direct pointers
		 *   `data` for the resulting pixbuf
		 * @returns A newly-created pixbuf
		 */
		public static new_from_inline(data: number[], copy_pixels: boolean): Pixbuf;
		/**
		 * Creates a new pixbuf by loading an image from an resource.
		 * 
		 * The file format is detected automatically. If `NULL` is returned, then
		 * #error will be set.
		 * @param resource_path the path of the resource file
		 * @returns A newly-created pixbuf
		 */
		public static new_from_resource(resource_path: string): Pixbuf | null;
		/**
		 * Creates a new pixbuf by loading an image from an resource.
		 * 
		 * The file format is detected automatically. If `NULL` is returned, then
		 * #error will be set.
		 * 
		 * The image will be scaled to fit in the requested size, optionally
		 * preserving the image's aspect ratio. When preserving the aspect ratio,
		 * a #width of -1 will cause the image to be scaled to the exact given
		 * height, and a #height of -1 will cause the image to be scaled to the
		 * exact given width. When not preserving aspect ratio, a #width or
		 * #height of -1 means to not scale the image at all in that dimension.
		 * 
		 * The stream is not closed.
		 * @param resource_path the path of the resource file
		 * @param width The width the image should have or -1 to not constrain the width
		 * @param height The height the image should have or -1 to not constrain the height
		 * @param preserve_aspect_ratio `TRUE` to preserve the image's aspect ratio
		 * @returns A newly-created pixbuf
		 */
		public static new_from_resource_at_scale(resource_path: string, width: number, height: number, preserve_aspect_ratio: boolean): Pixbuf | null;
		/**
		 * Creates a new pixbuf by loading an image from an input stream.
		 * 
		 * The file format is detected automatically.
		 * 
		 * If `NULL` is returned, then `error` will be set.
		 * 
		 * The `cancellable` can be used to abort the operation from another thread.
		 * If the operation was cancelled, the error `G_IO_ERROR_CANCELLED` will be
		 * returned. Other possible errors are in the `GDK_PIXBUF_ERROR` and
		 * `G_IO_ERROR` domains.
		 * 
		 * The stream is not closed.
		 * @param stream a `GInputStream` to load the pixbuf from
		 * @param cancellable optional `GCancellable` object, `NULL` to ignore
		 * @returns A newly-created pixbuf
		 */
		public static new_from_stream(stream: Gio.InputStream, cancellable?: Gio.Cancellable | null): Pixbuf | null;
		/**
		 * Creates a new pixbuf by loading an image from an input stream.
		 * 
		 * The file format is detected automatically. If `NULL` is returned, then
		 * #error will be set. The #cancellable can be used to abort the operation
		 * from another thread. If the operation was cancelled, the error
		 * `G_IO_ERROR_CANCELLED` will be returned. Other possible errors are in
		 * the `GDK_PIXBUF_ERROR` and `G_IO_ERROR` domains.
		 * 
		 * The image will be scaled to fit in the requested size, optionally
		 * preserving the image's aspect ratio.
		 * 
		 * When preserving the aspect ratio, a `width` of -1 will cause the image to be
		 * scaled to the exact given height, and a `height` of -1 will cause the image
		 * to be scaled to the exact given width. If both `width` and `height` are
		 * given, this function will behave as if the smaller of the two values
		 * is passed as -1.
		 * 
		 * When not preserving aspect ratio, a `width` or `height` of -1 means to not
		 * scale the image at all in that dimension.
		 * 
		 * The stream is not closed.
		 * @param stream a `GInputStream` to load the pixbuf from
		 * @param width The width the image should have or -1 to not constrain the width
		 * @param height The height the image should have or -1 to not constrain the height
		 * @param preserve_aspect_ratio `TRUE` to preserve the image's aspect ratio
		 * @param cancellable optional `GCancellable` object, `NULL` to ignore
		 * @returns A newly-created pixbuf
		 */
		public static new_from_stream_at_scale(stream: Gio.InputStream, width: number, height: number, preserve_aspect_ratio: boolean, cancellable?: Gio.Cancellable | null): Pixbuf | null;
		/**
		 * Finishes an asynchronous pixbuf creation operation started with
		 * {@link GdkPixbuf.new_from_stream_async}.
		 * @param async_result a `GAsyncResult`
		 * @returns the newly created pixbuf
		 */
		public static new_from_stream_finish(async_result: Gio.AsyncResult): Pixbuf | null;
		/**
		 * Creates a new pixbuf by parsing XPM data in memory.
		 * 
		 * This data is commonly the result of including an XPM file into a
		 * program's C source.
		 * @param data Pointer to inline XPM data.
		 * @returns A newly-created pixbuf
		 */
		public static new_from_xpm_data(data: string[]): Pixbuf;
		/**
		 * Calculates the rowstride that an image created with those values would
		 * have.
		 * 
		 * This function is useful for front-ends and backends that want to check
		 * image values without needing to create a `GdkPixbuf`.
		 * @param colorspace Color space for image
		 * @param has_alpha Whether the image should have transparency information
		 * @param bits_per_sample Number of bits per color sample
		 * @param width Width of image in pixels, must be > 0
		 * @param height Height of image in pixels, must be > 0
		 * @returns the rowstride for the given values, or -1 in case of error.
		 */
		public static calculate_rowstride(colorspace: Colorspace, has_alpha: boolean, bits_per_sample: number, width: number, height: number): number;
		/**
		 * Parses an image file far enough to determine its format and size.
		 * @param filename The name of the file to identify.
		 * @returns A `GdkPixbufFormat` describing
		 *   the image format of the file
		 * 
		 * Return location for the width of the image
		 * 
		 * Return location for the height of the image
		 */
		public static get_file_info(filename: string): [ PixbufFormat | null, number | null, number | null ];
		/**
		 * Asynchronously parses an image file far enough to determine its
		 * format and size.
		 * 
		 * For more details see {@link GdkPixbuf.get_file_info}, which is the synchronous
		 * version of this function.
		 * 
		 * When the operation is finished, #callback will be called in the
		 * main thread. You can then call gdk_pixbuf_get_file_info_finish() to
		 * get the result of the operation.
		 * @param filename The name of the file to identify
		 * @param cancellable optional `GCancellable` object, `NULL` to ignore
		 * @param callback a `GAsyncReadyCallback` to call when the file info is available
		 */
		public static get_file_info_async(filename: string, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Finishes an asynchronous pixbuf parsing operation started with
		 * {@link GdkPixbuf.get_file_info_async}.
		 * @param async_result a `GAsyncResult`
		 * @returns A `GdkPixbufFormat` describing the
		 *   image format of the file
		 * 
		 * Return location for the width of the image, or `NULL`
		 * 
		 * Return location for the height of the image, or `NULL`
		 */
		public static get_file_info_finish(async_result: Gio.AsyncResult): [ PixbufFormat | null, number, number ];
		/**
		 * Obtains the available information about the image formats supported
		 * by GdkPixbuf.
		 * @returns A list of
		 *   support image formats.
		 */
		public static get_formats(): PixbufFormat[];
		/**
		 * Initalizes the gdk-pixbuf loader modules referenced by the `loaders.cache`
		 * file present inside that directory.
		 * 
		 * This is to be used by applications that want to ship certain loaders
		 * in a different location from the system ones.
		 * 
		 * This is needed when the OS or runtime ships a minimal number of loaders
		 * so as to reduce the potential attack surface of carefully crafted image
		 * files, especially for uncommon file types. Applications that require
		 * broader image file types coverage, such as image viewers, would be
		 * expected to ship the gdk-pixbuf modules in a separate location, bundled
		 * with the application in a separate directory from the OS or runtime-
		 * provided modules.
		 * @param path Path to directory where the `loaders.cache` is installed
		 * @returns 
		 */
		public static init_modules(path: string): boolean;
		/**
		 * Creates a new pixbuf by asynchronously loading an image from an input stream.
		 * 
		 * For more details see {@link GdkPixbuf.new_from_stream}, which is the synchronous
		 * version of this function.
		 * 
		 * When the operation is finished, #callback will be called in the main thread.
		 * You can then call gdk_pixbuf_new_from_stream_finish() to get the result of
		 * the operation.
		 * @param stream a `GInputStream` from which to load the pixbuf
		 * @param cancellable optional `GCancellable` object, `NULL` to ignore
		 * @param callback a `GAsyncReadyCallback` to call when the pixbuf is loaded
		 */
		public static new_from_stream_async(stream: Gio.InputStream, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Creates a new pixbuf by asynchronously loading an image from an input stream.
		 * 
		 * For more details see {@link GdkPixbuf.new_from_stream_at_scale}, which is the synchronous
		 * version of this function.
		 * 
		 * When the operation is finished, #callback will be called in the main thread.
		 * You can then call gdk_pixbuf_new_from_stream_finish() to get the result of the operation.
		 * @param stream a `GInputStream` from which to load the pixbuf
		 * @param width the width the image should have or -1 to not constrain the width
		 * @param height the height the image should have or -1 to not constrain the height
		 * @param preserve_aspect_ratio `TRUE` to preserve the image's aspect ratio
		 * @param cancellable optional `GCancellable` object, `NULL` to ignore
		 * @param callback a `GAsyncReadyCallback` to call when the pixbuf is loaded
		 */
		public static new_from_stream_at_scale_async(stream: Gio.InputStream, width: number, height: number, preserve_aspect_ratio: boolean, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
		/**
		 * Finishes an asynchronous pixbuf save operation started with
		 * {@link GdkPixbuf.save_to_stream_async}.
		 * @param async_result a `GAsyncResult`
		 * @returns `TRUE` if the pixbuf was saved successfully, `FALSE` if an error was set.
		 */
		public static save_to_stream_finish(async_result: Gio.AsyncResult): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufAnimation} instead.
	 */
	interface IPixbufAnimation {
		/**
		 * Queries the height of the bounding box of a pixbuf animation.
		 * @returns Height of the bounding box of the animation.
		 */
		get_height(): number;
		/**
		 * Get an iterator for displaying an animation.
		 * 
		 * The iterator provides the frames that should be displayed at a
		 * given time.
		 * 
		 * #start_time would normally come from {@link G.get_current_time}, and marks
		 * the beginning of animation playback. After creating an iterator, you
		 * should immediately display the pixbuf returned by
		 * gdk_pixbuf_animation_iter_get_pixbuf(). Then, you should install
		 * a timeout (with g_timeout_add()) or by some other mechanism ensure
		 * that you'll update the image after
		 * gdk_pixbuf_animation_iter_get_delay_time() milliseconds. Each time
		 * the image is updated, you should reinstall the timeout with the new,
		 * possibly-changed delay time.
		 * 
		 * As a shortcut, if #start_time is `NULL`, the result of
		 * g_get_current_time() will be used automatically.
		 * 
		 * To update the image (i.e. possibly change the result of
		 * gdk_pixbuf_animation_iter_get_pixbuf() to a new frame of the animation),
		 * call gdk_pixbuf_animation_iter_advance().
		 * 
		 * If you're using {@link Loader}, in addition to updating the image
		 * after the delay time, you should also update it whenever you
		 * receive the area_updated signal and
		 * gdk_pixbuf_animation_iter_on_currently_loading_frame() returns
		 * `TRUE`. In this case, the frame currently being fed into the loader
		 * has received new data, so needs to be refreshed. The delay time for
		 * a frame may also be modified after an area_updated signal, for
		 * example if the delay time for a frame is encoded in the data after
		 * the frame itself. So your timeout should be reinstalled after any
		 * area_updated signal.
		 * 
		 * A delay time of -1 is possible, indicating "infinite".
		 * @param start_time time when the animation starts playing
		 * @returns an iterator to move over the animation
		 */
		get_iter(start_time?: GLib.TimeVal | null): PixbufAnimationIter;
		/**
		 * Retrieves a static image for the animation.
		 * 
		 * If an animation is really just a plain image (has only one frame),
		 * this function returns that image.
		 * 
		 * If the animation is an animation, this function returns a reasonable
		 * image to use as a static unanimated image, which might be the first
		 * frame, or something more sophisticated depending on the file format.
		 * 
		 * If an animation hasn't loaded any frames yet, this function will
		 * return `NULL`.
		 * @returns unanimated image representing the animation
		 */
		get_static_image(): Pixbuf;
		/**
		 * Queries the width of the bounding box of a pixbuf animation.
		 * @returns Width of the bounding box of the animation.
		 */
		get_width(): number;
		/**
		 * Checks whether the animation is a static image.
		 * 
		 * If you load a file with {@link GdkPixbuf.animation_new_from_file} and it
		 * turns out to be a plain, unanimated image, then this function will
		 * return `TRUE`. Use gdk_pixbuf_animation_get_static_image() to retrieve
		 * the image.
		 * @returns `TRUE` if the "animation" was really just an image
		 */
		is_static_image(): boolean;
		/**
		 * @deprecated
		 * Use {@link GObject.ref}.
		 * 
		 * Adds a reference to an animation.
		 * @returns The same as the #animation argument.
		 */
		ref(): PixbufAnimation;
		/**
		 * @deprecated
		 * Use {@link GObject.unref}.
		 * 
		 * Removes a reference from an animation.
		 */
		unref(): void;
	}

	type PixbufAnimationInitOptionsMixin = GObject.ObjectInitOptions
	export interface PixbufAnimationInitOptions extends PixbufAnimationInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufAnimation} instead.
	 */
	type PixbufAnimationMixin = IPixbufAnimation & GObject.Object;

	/**
	 * An opaque object representing an animation.
	 * 
	 * The GdkPixBuf library provides a simple mechanism to load and
	 * represent animations. An animation is conceptually a series of
	 * frames to be displayed over time.
	 * 
	 * The animation may not be represented as a series of frames
	 * internally; for example, it may be stored as a sprite and
	 * instructions for moving the sprite around a background.
	 * 
	 * To display an animation you don't need to understand its
	 * representation, however; you just ask `GdkPixbuf` what should
	 * be displayed at a given point in time.
	 */
	interface PixbufAnimation extends PixbufAnimationMixin {}

	class PixbufAnimation {
		public constructor(options?: Partial<PixbufAnimationInitOptions>);
		/**
		 * Creates a new animation by loading it from a file.
		 * 
		 * The file format is detected automatically.
		 * 
		 * If the file's format does not support multi-frame images, then an animation
		 * with a single frame will be created.
		 * 
		 * Possible errors are in the `GDK_PIXBUF_ERROR` and `G_FILE_ERROR` domains.
		 * @param filename Name of file to load, in the GLib file
		 *   name encoding
		 * @returns A newly-created animation
		 */
		public static new_from_file(filename: string): PixbufAnimation | null;
		/**
		 * Creates a new pixbuf animation by loading an image from an resource.
		 * 
		 * The file format is detected automatically. If `NULL` is returned, then
		 * #error will be set.
		 * @param resource_path the path of the resource file
		 * @returns A newly-created animation
		 */
		public static new_from_resource(resource_path: string): PixbufAnimation | null;
		/**
		 * Creates a new animation by loading it from an input stream.
		 * 
		 * The file format is detected automatically.
		 * 
		 * If `NULL` is returned, then #error will be set.
		 * 
		 * The #cancellable can be used to abort the operation from another thread.
		 * If the operation was cancelled, the error `G_IO_ERROR_CANCELLED` will be
		 * returned. Other possible errors are in the `GDK_PIXBUF_ERROR` and
		 * `G_IO_ERROR` domains.
		 * 
		 * The stream is not closed.
		 * @param stream a `GInputStream` to load the pixbuf from
		 * @param cancellable optional `GCancellable` object
		 * @returns A newly-created animation
		 */
		public static new_from_stream(stream: Gio.InputStream, cancellable?: Gio.Cancellable | null): PixbufAnimation | null;
		/**
		 * Finishes an asynchronous pixbuf animation creation operation started with
		 * [func#GdkPixbuf.PixbufAnimation.new_from_stream_async].
		 * @param async_result a #GAsyncResult
		 * @returns the newly created animation
		 */
		public static new_from_stream_finish(async_result: Gio.AsyncResult): PixbufAnimation | null;
		/**
		 * Creates a new animation by asynchronously loading an image from an input stream.
		 * 
		 * For more details see {@link GdkPixbuf.new_from_stream}, which is the synchronous
		 * version of this function.
		 * 
		 * When the operation is finished, `callback` will be called in the main thread.
		 * You can then call gdk_pixbuf_animation_new_from_stream_finish() to get the
		 * result of the operation.
		 * @param stream a #GInputStream from which to load the animation
		 * @param cancellable optional #GCancellable object
		 * @param callback a `GAsyncReadyCallback` to call when the pixbuf is loaded
		 */
		public static new_from_stream_async(stream: Gio.InputStream, cancellable?: Gio.Cancellable | null, callback?: Gio.AsyncReadyCallback | null): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufAnimationIter} instead.
	 */
	interface IPixbufAnimationIter {
		/**
		 * Possibly advances an animation to a new frame.
		 * 
		 * Chooses the frame based on the start time passed to
		 * {@link GdkPixbuf.animation_get_iter}.
		 * 
		 * #current_time would normally come from g_get_current_time(), and
		 * must be greater than or equal to the time passed to
		 * gdk_pixbuf_animation_get_iter(), and must increase or remain
		 * unchanged each time gdk_pixbuf_animation_iter_get_pixbuf() is
		 * called. That is, you can't go backward in time; animations only
		 * play forward.
		 * 
		 * As a shortcut, pass `NULL` for the current time and g_get_current_time()
		 * will be invoked on your behalf. So you only need to explicitly pass
		 * #current_time if you're doing something odd like playing the animation
		 * at double speed.
		 * 
		 * If this function returns `FALSE`, there's no need to update the animation
		 * display, assuming the display had been rendered prior to advancing;
		 * if `TRUE`, you need to call gdk_pixbuf_animation_iter_get_pixbuf()
		 * and update the display with the new pixbuf.
		 * @param current_time current time
		 * @returns `TRUE` if the image may need updating
		 */
		advance(current_time?: GLib.TimeVal | null): boolean;
		/**
		 * Gets the number of milliseconds the current pixbuf should be displayed,
		 * or -1 if the current pixbuf should be displayed forever.
		 * 
		 * The {@link `g.timeout_add}` function conveniently takes a timeout in milliseconds,
		 * so you can use a timeout to schedule the next update.
		 * 
		 * Note that some formats, like GIF, might clamp the timeout values in the
		 * image file to avoid updates that are just too quick. The minimum timeout
		 * for GIF images is currently 20 milliseconds.
		 * @returns delay time in milliseconds (thousandths of a second)
		 */
		get_delay_time(): number;
		/**
		 * Gets the current pixbuf which should be displayed.
		 * 
		 * The pixbuf might not be the same size as the animation itself
		 * {@link (gdk.pixbuf_animation_get_width}, gdk_pixbuf_animation_get_height()).
		 * 
		 * This pixbuf should be displayed for gdk_pixbuf_animation_iter_get_delay_time()
		 * milliseconds.
		 * 
		 * The caller of this function does not own a reference to the returned
		 * pixbuf; the returned pixbuf will become invalid when the iterator
		 * advances to the next frame, which may happen anytime you call
		 * gdk_pixbuf_animation_iter_advance().
		 * 
		 * Copy the pixbuf to keep it (don't just add a reference), as it may get
		 * recycled as you advance the iterator.
		 * @returns the pixbuf to be displayed
		 */
		get_pixbuf(): Pixbuf;
		/**
		 * Used to determine how to respond to the area_updated signal on
		 * {@link Loader} when loading an animation.
		 * 
		 * The `::area_updated` signal is emitted for an area of the frame currently
		 * streaming in to the loader. So if you're on the currently loading frame,
		 * you will need to redraw the screen for the updated area.
		 * @returns `TRUE` if the frame we're on is partially loaded, or the last frame
		 */
		on_currently_loading_frame(): boolean;
	}

	type PixbufAnimationIterInitOptionsMixin = GObject.ObjectInitOptions
	export interface PixbufAnimationIterInitOptions extends PixbufAnimationIterInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufAnimationIter} instead.
	 */
	type PixbufAnimationIterMixin = IPixbufAnimationIter & GObject.Object;

	/**
	 * An opaque object representing an iterator which points to a
	 * certain position in an animation.
	 */
	interface PixbufAnimationIter extends PixbufAnimationIterMixin {}

	class PixbufAnimationIter {
		public constructor(options?: Partial<PixbufAnimationIterInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufLoader} instead.
	 */
	interface IPixbufLoader {
		/**
		 * Informs a pixbuf loader that no further writes with
		 * {@link GdkPixbuf.loader_write} will occur, so that it can free its
		 * internal loading structures.
		 * 
		 * This function also tries to parse any data that hasn't yet been parsed;
		 * if the remaining data is partial or corrupt, an error will be returned.
		 * 
		 * If `FALSE` is returned, `error` will be set to an error from the
		 * `GDK_PIXBUF_ERROR` or `G_FILE_ERROR` domains.
		 * 
		 * If you're just cancelling a load rather than expecting it to be finished,
		 * passing `NULL` for `error` to ignore it is reasonable.
		 * 
		 * Remember that this function does not release a reference on the loader, so
		 * you will need to explicitly release any reference you hold.
		 * @returns `TRUE` if all image data written so far was successfully
		 *   passed out via the update_area signal
		 */
		close(): boolean;
		/**
		 * Queries the {@link Animation} that a pixbuf loader is currently creating.
		 * 
		 * In general it only makes sense to call this function after the
		 * [signal#GdkPixbuf.PixbufLoader::area-prepared] signal has been emitted by
		 * the loader.
		 * 
		 * If the loader doesn't have enough bytes yet, and hasn't emitted the `area-prepared`
		 * signal, this function will return `NULL`.
		 * @returns The animation that the loader is
		 *   currently loading
		 */
		get_animation(): PixbufAnimation | null;
		/**
		 * Obtains the available information about the format of the
		 * currently loading image file.
		 * @returns A {@link Format}
		 */
		get_format(): PixbufFormat | null;
		/**
		 * Queries the #GdkPixbuf that a pixbuf loader is currently creating.
		 * 
		 * In general it only makes sense to call this function after the
		 * [signal#GdkPixbuf.PixbufLoader::area-prepared] signal has been
		 * emitted by the loader; this means that enough data has been read
		 * to know the size of the image that will be allocated.
		 * 
		 * If the loader has not received enough data via {@link GdkPixbuf.loader_write},
		 * then this function returns `NULL`.
		 * 
		 * The returned pixbuf will be the same in all future calls to the loader,
		 * so if you want to keep using it, you should acquire a reference to it.
		 * 
		 * Additionally, if the loader is an animation, it will return the "static
		 * image" of the animation (see gdk_pixbuf_animation_get_static_image()).
		 * @returns The pixbuf that the loader is
		 *   creating
		 */
		get_pixbuf(): Pixbuf | null;
		/**
		 * Causes the image to be scaled while it is loaded.
		 * 
		 * The desired image size can be determined relative to the original
		 * size of the image by calling {@link GdkPixbuf.loader_set_size} from a
		 * signal handler for the ::size-prepared signal.
		 * 
		 * Attempts to set the desired image size  are ignored after the
		 * emission of the ::size-prepared signal.
		 * @param width The desired width of the image being loaded.
		 * @param height The desired height of the image being loaded.
		 */
		set_size(width: number, height: number): void;
		/**
		 * Parses the next `count` bytes in the given image buffer.
		 * @param buf Pointer to image data.
		 * @returns `TRUE` if the write was successful, or
		 *   `FALSE` if the loader cannot parse the buffer
		 */
		write(buf: number[]): boolean;
		/**
		 * Parses the next contents of the given image buffer.
		 * @param buffer The image data as a `GBytes` buffer.
		 * @returns `TRUE` if the write was successful, or `FALSE` if
		 *   the loader cannot parse the buffer
		 */
		write_bytes(buffer: GLib.Bytes): boolean;
		/**
		 * This signal is emitted when the pixbuf loader has allocated the
		 * pixbuf in the desired size.
		 * 
		 * After this signal is emitted, applications can call
		 * {@link GdkPixbuf.loader_get_pixbuf} to fetch the partially-loaded
		 * pixbuf.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "area-prepared", callback: (owner: this) => void): number;
		/**
		 * This signal is emitted when a significant area of the image being
		 * loaded has been updated.
		 * 
		 * Normally it means that a complete scanline has been read in, but
		 * it could be a different area as well.
		 * 
		 * Applications can use this signal to know when to repaint
		 * areas of an image that is being loaded.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - x: X offset of upper-left corner of the updated area. 
		 *  - y: Y offset of upper-left corner of the updated area. 
		 *  - width: Width of updated area. 
		 *  - height: Height of updated area. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "area-updated", callback: (owner: this, x: number, y: number, width: number, height: number) => void): number;
		/**
		 * This signal is emitted when {@link GdkPixbuf.loader_close} is called.
		 * 
		 * It can be used by different parts of an application to receive
		 * notification when an image loader is closed by the code that
		 * drives it.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "closed", callback: (owner: this) => void): number;
		/**
		 * This signal is emitted when the pixbuf loader has been fed the
		 * initial amount of data that is required to figure out the size
		 * of the image that it will create.
		 * 
		 * Applications can call {@link GdkPixbuf.loader_set_size} in response
		 * to this signal to set the desired size to which the image
		 * should be scaled.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - width: the original width of the image 
		 *  - height: the original height of the image 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "size-prepared", callback: (owner: this, width: number, height: number) => void): number;

	}

	type PixbufLoaderInitOptionsMixin = GObject.ObjectInitOptions
	export interface PixbufLoaderInitOptions extends PixbufLoaderInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufLoader} instead.
	 */
	type PixbufLoaderMixin = IPixbufLoader & GObject.Object;

	/**
	 * Incremental image loader.
	 * 
	 * `GdkPixbufLoader` provides a way for applications to drive the
	 * process of loading an image, by letting them send the image data
	 * directly to the loader instead of having the loader read the data
	 * from a file. Applications can use this functionality instead of
	 * {@link `gdk.pixbuf_new_from_file}` or `gdk_pixbuf_animation_new_from_file()`
	 * when they need to parse image data in small chunks. For example,
	 * it should be used when reading an image from a (potentially) slow
	 * network connection, or when loading an extremely large file.
	 * 
	 * To use `GdkPixbufLoader` to load an image, create a new instance,
	 * and call [method#GdkPixbuf.PixbufLoader.write] to send the data
	 * to it. When done, [method#GdkPixbuf.PixbufLoader.close] should be
	 * called to end the stream and finalize everything.
	 * 
	 * The loader will emit three important signals throughout the process:
	 * 
	 *  - [signal#GdkPixbuf.PixbufLoader::size-prepared] will be emitted as
	 *    soon as the image has enough information to determine the size of
	 *    the image to be used. If you want to scale the image while loading
	 *    it, you can call [method#GdkPixbuf.PixbufLoader.set_size] in
	 *    response to this signal.
	 *  - [signal#GdkPixbuf.PixbufLoader::area-prepared] will be emitted as
	 *    soon as the pixbuf of the desired has been allocated. You can obtain
	 *    the `GdkPixbuf` instance by calling [method#GdkPixbuf.PixbufLoader.get_pixbuf].
	 *    If you want to use it, simply acquire a reference to it. You can
	 *    also call `gdk_pixbuf_loader_get_pixbuf()` later to get the same
	 *    pixbuf.
	 *  - [signal#GdkPixbuf.PixbufLoader::area-updated] will be emitted every
	 *    time a region is updated. This way you can update a partially
	 *    completed image. Note that you do not know anything about the
	 *    completeness of an image from the updated area. For example, in an
	 *    interlaced image you will need to make several passes before the
	 *    image is done loading.
	 * 
	 * ## Loading an animation
	 * 
	 * Loading an animation is almost as easy as loading an image. Once the
	 * first [signal#GdkPixbuf.PixbufLoader::area-prepared] signal has been
	 * emitted, you can call [method#GdkPixbuf.PixbufLoader.get_animation] to
	 * get the [class#GdkPixbuf.PixbufAnimation] instance, and then call
	 * and [method#GdkPixbuf.PixbufAnimation.get_iter] to get a
	 * [class#GdkPixbuf.PixbufAnimationIter] to retrieve the pixbuf for the
	 * desired time stamp.
	 */
	interface PixbufLoader extends PixbufLoaderMixin {}

	class PixbufLoader {
		public constructor(options?: Partial<PixbufLoaderInitOptions>);
		/**
		 * Creates a new pixbuf loader object.
		 * @returns A newly-created pixbuf loader.
		 */
		public static new(): PixbufLoader;
		/**
		 * Creates a new pixbuf loader object that always attempts to parse
		 * image data as if it were an image of MIME type #mime_type, instead of
		 * identifying the type automatically.
		 * 
		 * This function is useful if you want an error if the image isn't the
		 * expected MIME type; for loading image formats that can't be reliably
		 * identified by looking at the data; or if the user manually forces a
		 * specific MIME type.
		 * 
		 * The list of supported mime types depends on what image loaders
		 * are installed, but typically "image/png", "image/jpeg", "image/gif",
		 * "image/tiff" and "image/x-xpixmap" are among the supported mime types.
		 * To obtain the full list of supported mime types, call
		 * {@link GdkPixbuf.format_get_mime_types} on each of the {@link Format}
		 * structs returned by gdk_pixbuf_get_formats().
		 * @param mime_type the mime type to be loaded
		 * @returns A newly-created pixbuf loader.
		 */
		public static new_with_mime_type(mime_type: string): PixbufLoader;
		/**
		 * Creates a new pixbuf loader object that always attempts to parse
		 * image data as if it were an image of type #image_type, instead of
		 * identifying the type automatically.
		 * 
		 * This function is useful if you want an error if the image isn't the
		 * expected type; for loading image formats that can't be reliably
		 * identified by looking at the data; or if the user manually forces
		 * a specific type.
		 * 
		 * The list of supported image formats depends on what image loaders
		 * are installed, but typically "png", "jpeg", "gif", "tiff" and
		 * "xpm" are among the supported formats. To obtain the full list of
		 * supported image formats, call {@link GdkPixbuf.format_get_name} on each
		 * of the {@link Format} structs returned by gdk_pixbuf_get_formats().
		 * @param image_type name of the image format to be loaded with the image
		 * @returns A newly-created pixbuf loader.
		 */
		public static new_with_type(image_type: string): PixbufLoader;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufNonAnim} instead.
	 */
	interface IPixbufNonAnim {

	}

	type PixbufNonAnimInitOptionsMixin = PixbufAnimationInitOptions
	export interface PixbufNonAnimInitOptions extends PixbufNonAnimInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufNonAnim} instead.
	 */
	type PixbufNonAnimMixin = IPixbufNonAnim & PixbufAnimation;

	interface PixbufNonAnim extends PixbufNonAnimMixin {}

	class PixbufNonAnim {
		public constructor(options?: Partial<PixbufNonAnimInitOptions>);
		public static new(pixbuf: Pixbuf): PixbufAnimation;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufSimpleAnim} instead.
	 */
	interface IPixbufSimpleAnim {
		/**
		 * Whether the animation should loop when it reaches the end.
		 */
		loop: boolean;
		/**
		 * Adds a new frame to #animation. The #pixbuf must
		 * have the dimensions specified when the animation
		 * was constructed.
		 * @param pixbuf the pixbuf to add
		 */
		add_frame(pixbuf: Pixbuf): void;
		/**
		 * Gets whether #animation should loop indefinitely when it reaches the end.
		 * @returns %TRUE if the animation loops forever, %FALSE otherwise
		 */
		get_loop(): boolean;
		/**
		 * Sets whether #animation should loop indefinitely when it reaches the end.
		 * @param loop whether to loop the animation
		 */
		set_loop(loop: boolean): void;
		connect(signal: "notify::loop", callback: (owner: this, ...args: any) => void): number;

	}

	type PixbufSimpleAnimInitOptionsMixin = PixbufAnimationInitOptions & 
	Pick<IPixbufSimpleAnim,
		"loop">;

	export interface PixbufSimpleAnimInitOptions extends PixbufSimpleAnimInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufSimpleAnim} instead.
	 */
	type PixbufSimpleAnimMixin = IPixbufSimpleAnim & PixbufAnimation;

	/**
	 * An opaque struct representing a simple animation.
	 */
	interface PixbufSimpleAnim extends PixbufSimpleAnimMixin {}

	class PixbufSimpleAnim {
		public constructor(options?: Partial<PixbufSimpleAnimInitOptions>);
		/**
		 * Creates a new, empty animation.
		 * @param width the width of the animation
		 * @param height the height of the animation
		 * @param rate the speed of the animation, in frames per second
		 * @returns a newly allocated {@link SimpleAnim}
		 */
		public static new(width: number, height: number, rate: number): PixbufSimpleAnim;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufSimpleAnimIter} instead.
	 */
	interface IPixbufSimpleAnimIter {

	}

	type PixbufSimpleAnimIterInitOptionsMixin = PixbufAnimationIterInitOptions
	export interface PixbufSimpleAnimIterInitOptions extends PixbufSimpleAnimIterInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PixbufSimpleAnimIter} instead.
	 */
	type PixbufSimpleAnimIterMixin = IPixbufSimpleAnimIter & PixbufAnimationIter;

	interface PixbufSimpleAnimIter extends PixbufSimpleAnimIterMixin {}

	class PixbufSimpleAnimIter {
		public constructor(options?: Partial<PixbufSimpleAnimIterInitOptions>);
	}

	export interface PixbufFormatInitOptions {}
	/**
	 * A `GdkPixbufFormat` contains information about the image format accepted
	 * by a module.
	 * 
	 * Only modules should access the fields directly, applications should
	 * use the `gdk_pixbuf_format_*` family of functions.
	 */
	interface PixbufFormat {}
	class PixbufFormat {
		public constructor(options?: Partial<PixbufFormatInitOptions>);
		/**
		 * the name of the image format
		 */
		public name: string;
		/**
		 * the signature of the module
		 */
		public signature: PixbufModulePattern;
		/**
		 * the message domain for the `description`
		 */
		public domain: string;
		/**
		 * a description of the image format
		 */
		public description: string;
		/**
		 * the MIME types for the image format
		 */
		public mime_types: string[];
		/**
		 * typical filename extensions for the
		 *   image format
		 */
		public extensions: string[];
		/**
		 * a combination of `GdkPixbufFormatFlags`
		 */
		public flags: number;
		/**
		 * a boolean determining whether the loader is disabled`
		 */
		public disabled: boolean;
		/**
		 * a string containing license information, typically set to
		 *   shorthands like "GPL", "LGPL", etc.
		 */
		public license: string;
		/**
		 * Creates a copy of `format`.
		 * @returns the newly allocated copy of a `GdkPixbufFormat`. Use
		 *   {@link GdkPixbuf.format_free} to free the resources when done
		 */
		public copy(): PixbufFormat;
		/**
		 * Frees the resources allocated when copying a `GdkPixbufFormat`
		 * using {@link GdkPixbuf.format_copy}
		 */
		public free(): void;
		/**
		 * Returns a description of the format.
		 * @returns a description of the format.
		 */
		public get_description(): string;
		/**
		 * Returns the filename extensions typically used for files in the
		 * given format.
		 * @returns an array of
		 *   filename extensions
		 */
		public get_extensions(): string[];
		/**
		 * Returns information about the license of the image loader for the format.
		 * 
		 * The returned string should be a shorthand for a well known license, e.g.
		 * "LGPL", "GPL", "QPL", "GPL/QPL", or "other" to indicate some other license.
		 * @returns a string describing the license of the pixbuf format
		 */
		public get_license(): string;
		/**
		 * Returns the mime types supported by the format.
		 * @returns an array of mime types
		 */
		public get_mime_types(): string[];
		/**
		 * Returns the name of the format.
		 * @returns the name of the format.
		 */
		public get_name(): string;
		/**
		 * Returns whether this image format is disabled.
		 * 
		 * See {@link GdkPixbuf.format_set_disabled}.
		 * @returns whether this image format is disabled.
		 */
		public is_disabled(): boolean;
		/**
		 * Returns `TRUE` if the save option specified by #option_key is supported when
		 * saving a pixbuf using the module implementing #format.
		 * 
		 * See {@link GdkPixbuf.save} for more information about option keys.
		 * @param option_key the name of an option
		 * @returns `TRUE` if the specified option is supported
		 */
		public is_save_option_supported(option_key: string): boolean;
		/**
		 * Returns whether this image format is scalable.
		 * 
		 * If a file is in a scalable format, it is preferable to load it at
		 * the desired size, rather than loading it at the default size and
		 * scaling the resulting pixbuf to the desired size.
		 * @returns whether this image format is scalable.
		 */
		public is_scalable(): boolean;
		/**
		 * Returns whether pixbufs can be saved in the given format.
		 * @returns whether pixbufs can be saved in the given format.
		 */
		public is_writable(): boolean;
		/**
		 * Disables or enables an image format.
		 * 
		 * If a format is disabled, GdkPixbuf won't use the image loader for
		 * this format to load images.
		 * 
		 * Applications can use this to avoid using image loaders with an
		 * inappropriate license, see {@link GdkPixbuf.format_get_license}.
		 * @param disabled `TRUE` to disable the format #format
		 */
		public set_disabled(disabled: boolean): void;
	}

	export interface PixbufModuleInitOptions {}
	/**
	 * A `GdkPixbufModule` contains the necessary functions to load and save
	 * images in a certain file format.
	 * 
	 * If `GdkPixbuf` has been compiled with `GModule` support, it can be extended
	 * by modules which can load (and perhaps also save) new image and animation
	 * formats.
	 * 
	 * ## Implementing modules
	 * 
	 * The `GdkPixbuf` interfaces needed for implementing modules are contained in
	 * `gdk-pixbuf-io.h` (and `gdk-pixbuf-animation.h` if the module supports
	 * animations). They are not covered by the same stability guarantees as the
	 * regular GdkPixbuf API. To underline this fact, they are protected by the
	 * `GDK_PIXBUF_ENABLE_BACKEND` pre-processor symbol.
	 * 
	 * Each loadable module must contain a `GdkPixbufModuleFillVtableFunc` function
	 * named `fill_vtable`, which will get called when the module
	 * is loaded and must set the function pointers of the `GdkPixbufModule`.
	 * 
	 * In order to make format-checking work before actually loading the modules
	 * (which may require calling `dlopen` to load image libraries), modules export
	 * their signatures (and other information) via the `fill_info` function. An
	 * external utility, `gdk-pixbuf-query-loaders`, uses this to create a text
	 * file containing a list of all available loaders and  their signatures.
	 * This file is then read at runtime by `GdkPixbuf` to obtain the list of
	 * available loaders and their signatures.
	 * 
	 * Modules may only implement a subset of the functionality available via
	 * `GdkPixbufModule`. If a particular functionality is not implemented, the
	 * `fill_vtable` function will simply not set the corresponding
	 * function pointers of the `GdkPixbufModule` structure. If a module supports
	 * incremental loading (i.e. provides `begin_load`, `stop_load` and
	 * `load_increment`), it doesn't have to implement `load`, since `GdkPixbuf`
	 * can supply a generic `load` implementation wrapping the incremental loading.
	 * 
	 * ## Installing modules
	 * 
	 * Installing a module is a two-step process:
	 * 
	 *  - copy the module file(s) to the loader directory (normally
	 *    `$libdir/gdk-pixbuf-2.0/$version/loaders`, unless overridden by the
	 *    environment variable `GDK_PIXBUF_MODULEDIR`)
	 *  - call `gdk-pixbuf-query-loaders` to update the module file (normally
	 *    `$libdir/gdk-pixbuf-2.0/$version/loaders.cache`, unless overridden
	 *    by the environment variable `GDK_PIXBUF_MODULE_FILE`)
	 */
	interface PixbufModule {}
	class PixbufModule {
		public constructor(options?: Partial<PixbufModuleInitOptions>);
		/**
		 * the name of the module, usually the same as the
		 *  usual file extension for images of this type, eg. "xpm", "jpeg" or "png".
		 */
		public module_name: string;
		/**
		 * the path from which the module is loaded.
		 */
		public module_path: string;
		/**
		 * the loaded `GModule`.
		 */
		public module: GModule.Module;
		/**
		 * a `GdkPixbufFormat` holding information about the module.
		 */
		public info: PixbufFormat;
		public load: {(f: any): Pixbuf;};
		public load_xpm_data: {(data: string): Pixbuf;};
		public begin_load: {(size_func: PixbufModuleSizeFunc, prepared_func: PixbufModulePreparedFunc, updated_func: PixbufModuleUpdatedFunc): any;};
		public stop_load: {(context: any): boolean;};
		public load_increment: {(context: any, buf: number, size: number): boolean;};
		public load_animation: {(f: any): PixbufAnimation;};
		public save: {(f: any, pixbuf: Pixbuf, param_keys: string, param_values: string): boolean;};
		public save_to_callback: {(save_func: PixbufSaveFunc, pixbuf: Pixbuf, option_keys: string, option_values: string): boolean;};
		public is_save_option_supported: {(option_key: string): boolean;};
		public _reserved1: {(): void;};
		public _reserved2: {(): void;};
		public _reserved3: {(): void;};
		public _reserved4: {(): void;};
	}

	export interface PixbufModulePatternInitOptions {}
	/**
	 * The signature prefix for a module.
	 * 
	 * The signature of a module is a set of prefixes. Prefixes are encoded as
	 * pairs of ordinary strings, where the second string, called the mask, if
	 * not `NULL`, must be of the same length as the first one and may contain
	 * ' ', '!', 'x', 'z', and 'n' to indicate bytes that must be matched,
	 * not matched, "don't-care"-bytes, zeros and non-zeros, respectively.
	 * 
	 * Each prefix has an associated integer that describes the relevance of
	 * the prefix, with 0 meaning a mismatch and 100 a "perfect match".
	 * 
	 * Starting with gdk-pixbuf 2.8, the first byte of the mask may be '*',
	 * indicating an unanchored pattern that matches not only at the beginning,
	 * but also in the middle. Versions prior to 2.8 will interpret the '*'
	 * like an 'x'.
	 * 
	 * The signature of a module is stored as an array of
	 * `GdkPixbufModulePatterns`. The array is terminated by a pattern
	 * where the `prefix` is `NULL`.
	 * 
	 * ```c
	 * GdkPixbufModulePattern *signature[] = {
	 *   { "abcdx", " !x z", 100 },
	 *   { "bla", NULL,  90 },
	 *   { NULL, NULL, 0 }
	 * };
	 * ```
	 * 
	 * In the example above, the signature matches e.g. "auud\0" with
	 * relevance 100, and "blau" with relevance 90.
	 */
	interface PixbufModulePattern {}
	class PixbufModulePattern {
		public constructor(options?: Partial<PixbufModulePatternInitOptions>);
		/**
		 * the prefix for this pattern
		 */
		public prefix: string;
		/**
		 * mask containing bytes which modify how the prefix is matched against
		 *  test data
		 */
		public mask: string;
		/**
		 * relevance of this pattern
		 */
		public relevance: number;
	}

	/**
	 * This enumeration defines the color spaces that are supported by
	 * the gdk-pixbuf library.
	 * 
	 * Currently only RGB is supported.
	 */
	enum Colorspace {
		/**
		 * Indicates a red/green/blue additive color space.
		 */
		RGB = 0
	}

	/**
	 * Interpolation modes for scaling functions.
	 * 
	 * The `GDK_INTERP_NEAREST` mode is the fastest scaling method, but has
	 * horrible quality when scaling down; `GDK_INTERP_BILINEAR` is the best
	 * choice if you aren't sure what to choose, it has a good speed/quality
	 * balance.
	 * 
	 * **Note**: Cubic filtering is missing from the list; hyperbolic
	 * interpolation is just as fast and results in higher quality.
	 */
	enum InterpType {
		/**
		 * Nearest neighbor sampling; this is the fastest
		 *  and lowest quality mode. Quality is normally unacceptable when scaling
		 *  down, but may be OK when scaling up.
		 */
		NEAREST = 0,
		/**
		 * This is an accurate simulation of the PostScript
		 *  image operator without any interpolation enabled.  Each pixel is
		 *  rendered as a tiny parallelogram of solid color, the edges of which
		 *  are implemented with antialiasing.  It resembles nearest neighbor for
		 *  enlargement, and bilinear for reduction.
		 */
		TILES = 1,
		/**
		 * Best quality/speed balance; use this mode by
		 *  default. Bilinear interpolation.  For enlargement, it is
		 *  equivalent to point-sampling the ideal bilinear-interpolated image.
		 *  For reduction, it is equivalent to laying down small tiles and
		 *  integrating over the coverage area.
		 */
		BILINEAR = 2,
		/**
		 * This is the slowest and highest quality
		 *  reconstruction function. It is derived from the hyperbolic filters in
		 *  Wolberg's "Digital Image Warping", and is formally defined as the
		 *  hyperbolic-filter sampling the ideal hyperbolic-filter interpolated
		 *  image (the filter is designed to be idempotent for 1:1 pixel mapping).
		 *  **Deprecated**: this interpolation filter is deprecated, as in reality
		 *  it has a lower quality than the #GDK_INTERP_BILINEAR filter
		 *  (Since: 2.38)
		 */
		HYPER = 3
	}

	/**
	 * Control the alpha channel for drawables.
	 * 
	 * These values can be passed to {@link GdkPixbuf.xlib_render_to_drawable_alpha}
	 * in gdk-pixbuf-xlib to control how the alpha channel of an image should
	 * be handled.
	 * 
	 * This function can create a bilevel clipping mask (black and white) and use
	 * it while painting the image.
	 * 
	 * In the future, when the X Window System gets an alpha channel extension,
	 * it will be possible to do full alpha compositing onto arbitrary drawables.
	 * For now both cases fall back to a bilevel clipping mask.
	 */
	enum PixbufAlphaMode {
		/**
		 * A bilevel clipping mask (black and white)
		 *  will be created and used to draw the image.  Pixels below 0.5 opacity
		 *  will be considered fully transparent, and all others will be
		 *  considered fully opaque.
		 */
		BILEVEL = 0,
		/**
		 * For now falls back to #GDK_PIXBUF_ALPHA_BILEVEL.
		 *  In the future it will do full alpha compositing.
		 */
		FULL = 1
	}

	/**
	 * An error code in the `GDK_PIXBUF_ERROR` domain.
	 * 
	 * Many gdk-pixbuf operations can cause errors in this domain, or in
	 * the `G_FILE_ERROR` domain.
	 */
	enum PixbufError {
		/**
		 * An image file was broken somehow.
		 */
		CORRUPT_IMAGE = 0,
		/**
		 * Not enough memory.
		 */
		INSUFFICIENT_MEMORY = 1,
		/**
		 * A bad option was passed to a pixbuf save module.
		 */
		BAD_OPTION = 2,
		/**
		 * Unknown image type.
		 */
		UNKNOWN_TYPE = 3,
		/**
		 * Don't know how to perform the
		 *  given operation on the type of image at hand.
		 */
		UNSUPPORTED_OPERATION = 4,
		/**
		 * Generic failure code, something went wrong.
		 */
		FAILED = 5,
		/**
		 * Only part of the animation was loaded.
		 */
		INCOMPLETE_ANIMATION = 6
	}

	/**
	 * The possible rotations which can be passed to {@link GdkPixbuf.rotate_simple}.
	 * 
	 * To make them easier to use, their numerical values are the actual degrees.
	 */
	enum PixbufRotation {
		/**
		 * No rotation.
		 */
		NONE = 0,
		/**
		 * Rotate by 90 degrees.
		 */
		COUNTERCLOCKWISE = 90,
		/**
		 * Rotate by 180 degrees.
		 */
		UPSIDEDOWN = 180,
		/**
		 * Rotate by 270 degrees.
		 */
		CLOCKWISE = 270
	}

	/**
	 * Flags which allow a module to specify further details about the supported
	 * operations.
	 */
	enum PixbufFormatFlags {
		/**
		 * the module can write out images in the format.
		 */
		WRITABLE = 1,
		/**
		 * the image format is scalable
		 */
		SCALABLE = 2,
		/**
		 * the module is threadsafe. gdk-pixbuf
		 *     ignores modules that are not marked as threadsafe. (Since 2.28).
		 */
		THREADSAFE = 4
	}

	/**
	 * A function of this type is responsible for freeing the pixel array
	 * of a pixbuf.
	 * 
	 * The {@link GdkPixbuf.new_from_data} function lets you pass in a pre-allocated
	 * pixel array so that a pixbuf can be created from it; in this case you
	 * will need to pass in a function of type `GdkPixbufDestroyNotify` so that
	 * the pixel data can be freed when the pixbuf is finalized.
	 */
	interface PixbufDestroyNotify {
		/**
		 * A function of this type is responsible for freeing the pixel array
		 * of a pixbuf.
		 * 
		 * The {@link GdkPixbuf.new_from_data} function lets you pass in a pre-allocated
		 * pixel array so that a pixbuf can be created from it; in this case you
		 * will need to pass in a function of type `GdkPixbufDestroyNotify` so that
		 * the pixel data can be freed when the pixbuf is finalized.
		 * @param pixels The pixel array of the pixbuf
		 *   that is being finalized.
		 */
		(pixels: number[]): void;
	}

	/**
	 * Defines the type of the function used to fill a
	 * {@link Format} structure with information about a module.
	 */
	interface PixbufModuleFillInfoFunc {
		/**
		 * Defines the type of the function used to fill a
		 * {@link Format} structure with information about a module.
		 * @param info a {@link Format}.
		 */
		(info: PixbufFormat): void;
	}

	/**
	 * Defines the type of the function used to set the vtable of a
	 * {@link Module} when it is loaded.
	 */
	interface PixbufModuleFillVtableFunc {
		/**
		 * Defines the type of the function used to set the vtable of a
		 * {@link Module} when it is loaded.
		 * @param module a {@link Module}.
		 */
		(module: PixbufModule): void;
	}

	/**
	 * Defines the type of the function that gets called once the initial
	 * setup of #pixbuf is done.
	 * 
	 * {@link Loader} uses a function of this type to emit the
	 * "<link linkend="GdkPixbufLoader-area-prepared">area_prepared</link>"
	 * signal.
	 */
	interface PixbufModulePreparedFunc {
		/**
		 * Defines the type of the function that gets called once the initial
		 * setup of #pixbuf is done.
		 * 
		 * {@link Loader} uses a function of this type to emit the
		 * "<link linkend="GdkPixbufLoader-area-prepared">area_prepared</link>"
		 * signal.
		 * @param pixbuf the #GdkPixbuf that is currently being loaded.
		 * @param anim if an animation is being loaded, the {@link Animation}, else %NULL.
		 */
		(pixbuf: Pixbuf, anim: PixbufAnimation): void;
	}

	/**
	 * Defines the type of the function that gets called once the size
	 * of the loaded image is known.
	 * 
	 * The function is expected to set #width and #height to the desired
	 * size to which the image should be scaled. If a module has no efficient
	 * way to achieve the desired scaling during the loading of the image, it may
	 * either ignore the size request, or only approximate it - gdk-pixbuf will
	 * then perform the required scaling on the completely loaded image.
	 * 
	 * If the function sets #width or #height to zero, the module should interpret
	 * this as a hint that it will be closed soon and shouldn't allocate further
	 * resources. This convention is used to implement {@link GdkPixbuf.get_file_info}
	 * efficiently.
	 */
	interface PixbufModuleSizeFunc {
		/**
		 * Defines the type of the function that gets called once the size
		 * of the loaded image is known.
		 * 
		 * The function is expected to set #width and #height to the desired
		 * size to which the image should be scaled. If a module has no efficient
		 * way to achieve the desired scaling during the loading of the image, it may
		 * either ignore the size request, or only approximate it - gdk-pixbuf will
		 * then perform the required scaling on the completely loaded image.
		 * 
		 * If the function sets #width or #height to zero, the module should interpret
		 * this as a hint that it will be closed soon and shouldn't allocate further
		 * resources. This convention is used to implement {@link GdkPixbuf.get_file_info}
		 * efficiently.
		 * @param width pointer to a location containing the current image width
		 * @param height pointer to a location containing the current image height
		 */
		(width: number, height: number): void;
	}

	/**
	 * Defines the type of the function that gets called every time a region
	 * of #pixbuf is updated.
	 * 
	 * {@link Loader} uses a function of this type to emit the
	 * "<link linkend="GdkPixbufLoader-area-updated">area_updated</link>"
	 * signal.
	 */
	interface PixbufModuleUpdatedFunc {
		/**
		 * Defines the type of the function that gets called every time a region
		 * of #pixbuf is updated.
		 * 
		 * {@link Loader} uses a function of this type to emit the
		 * "<link linkend="GdkPixbufLoader-area-updated">area_updated</link>"
		 * signal.
		 * @param pixbuf the #GdkPixbuf that is currently being loaded.
		 * @param x the X origin of the updated area.
		 * @param y the Y origin of the updated area.
		 * @param width the width of the updated area.
		 * @param height the height of the updated area.
		 */
		(pixbuf: Pixbuf, x: number, y: number, width: number, height: number): void;
	}

	/**
	 * Save functions used by [method#GdkPixbuf.Pixbuf.save_to_callback].
	 * 
	 * This function is called once for each block of bytes that is "written"
	 * by {@link `gdk.pixbuf_save_to_callback}`.
	 * 
	 * If successful it should return `TRUE`; if an error occurs it should set
	 * `error` and return `FALSE`, in which case `gdk_pixbuf_save_to_callback()`
	 * will fail with the same error.
	 */
	interface PixbufSaveFunc {
		/**
		 * Save functions used by [method#GdkPixbuf.Pixbuf.save_to_callback].
		 * 
		 * This function is called once for each block of bytes that is "written"
		 * by {@link `gdk.pixbuf_save_to_callback}`.
		 * 
		 * If successful it should return `TRUE`; if an error occurs it should set
		 * `error` and return `FALSE`, in which case `gdk_pixbuf_save_to_callback()`
		 * will fail with the same error.
		 * @param buf bytes to be written.
		 * @returns `TRUE` if successful, `FALSE` otherwise
		 * 
		 * A location to return an error.
		 */
		(buf: number[]): [ boolean, GLib.Error ];
	}

	function pixbuf_error_quark(): GLib.Quark;
	/**
	 * Major version of gdk-pixbuf library, that is the "0" in
	 * "0.8.2" for example.
	 * @returns Major version of gdk-pixbuf library, that is the "0" in
	 * "0.8.2" for example.
	 */
	const PIXBUF_MAJOR: number;

	/**
	 * Micro version of gdk-pixbuf library, that is the "2" in
	 * "0.8.2" for example.
	 * @returns Micro version of gdk-pixbuf library, that is the "2" in
	 * "0.8.2" for example.
	 */
	const PIXBUF_MICRO: number;

	/**
	 * Minor version of gdk-pixbuf library, that is the "8" in
	 * "0.8.2" for example.
	 * @returns Minor version of gdk-pixbuf library, that is the "8" in
	 * "0.8.2" for example.
	 */
	const PIXBUF_MINOR: number;

	/**
	 * Contains the full version of GdkPixbuf as a string.
	 * 
	 * This is the version being compiled against; contrast with
	 * `gdk_pixbuf_version`.
	 * @returns Contains the full version of GdkPixbuf as a string.
	 * 
	 * This is the version being compiled against; contrast with
	 * `gdk_pixbuf_version`.
	 */
	const PIXBUF_VERSION: string;

}