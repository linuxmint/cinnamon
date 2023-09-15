#!/usr/bin/python3

# Copyright (C) 2007-2010 www.stani.be
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see http://www.gnu.org/licenses/

import os
from io import StringIO
from itertools import cycle
from PIL import Image
from PIL import ImageDraw
from PIL import ImageEnhance
from PIL import ImageOps, ImageChops, ImageFilter

ALL_PALETTE_INDICES = set(range(256))
CHECKBOARD = {}
COLOR_MAP = [255] * 128 + [0] * 128
WWW_CACHE = {}

EXT_BY_FORMATS = {
    'JPEG': ['JPG', 'JPEG', 'JPE'],
    'TIFF': ['TIF', 'TIFF'],
    'SVG': ['SVG', 'SVGZ'],
}
FORMATS_BY_EXT = {}
for format, exts in EXT_BY_FORMATS.items():
    for ext in exts:
        FORMATS_BY_EXT[ext] = format

CROSS = 'Cross'
ROUNDED = 'Rounded'
SQUARE = 'Square'

CORNERS = [ROUNDED, SQUARE, CROSS]
CORNER_ID = 'rounded_corner_r%d_f%d'
CROSS_POS = (CROSS, CROSS, CROSS, CROSS)
ROUNDED_POS = (ROUNDED, ROUNDED, ROUNDED, ROUNDED)
ROUNDED_RECTANGLE_ID = 'rounded_rectangle_r%d_f%d_s%s_p%s'

class InvalidWriteFormatError(Exception):
    pass


def drop_shadow(image, horizontal_offset=5, vertical_offset=5,
                background_color=(255, 255, 255, 0), shadow_color=0x444444,
                border=8, shadow_blur=3, force_background_color=False, cache=None):
    """Add a gaussian blur drop shadow to an image.

    :param image: The image to overlay on top of the shadow.
    :param type: PIL Image
    :param offset:

        Offset of the shadow from the image as an (x,y) tuple.
        Can be positive or negative.

    :type offset: tuple of integers
    :param background_color: Background color behind the image.
    :param shadow_color: Shadow color (darkness).
    :param border:

        Width of the border around the image.  This must be wide
        enough to account for the blurring of the shadow.

    :param shadow_blur:

        Number of times to apply the filter.  More shadow_blur
        produce a more blurred shadow, but increase processing time.
    """
    if cache is None:
        cache = {}

    if has_transparency(image) and image.mode != 'RGBA':
        # Make sure 'LA' and 'P' with transparency are handled
        image = image.convert('RGBA')

    #get info
    size = image.size
    mode = image.mode

    back = None

    #assert image is RGBA
    if mode != 'RGBA':
        if mode != 'RGB':
            image = image.convert('RGB')
            mode = 'RGB'
        #create cache id
        id = ''.join([str(x) for x in ['shadow_', size,
                                       horizontal_offset, vertical_offset, border, shadow_blur,
                                       background_color, shadow_color]])

        #look up in cache
        if id in cache:
            #retrieve from cache
            back, back_size = cache[id]

    if back is None:
        #size of backdrop
        back_size = (size[0] + abs(horizontal_offset) + 2 * border,
                     size[1] + abs(vertical_offset) + 2 * border)

        #create shadow mask
        if mode == 'RGBA':
            image_mask = get_alpha(image)
            shadow = Image.new('L', back_size, 0)
        else:
            image_mask = Image.new(mode, size, shadow_color)
            shadow = Image.new(mode, back_size, background_color)

        shadow_left = border + max(horizontal_offset, 0)
        shadow_top = border + max(vertical_offset, 0)
        paste(shadow, image_mask, (shadow_left, shadow_top,
                                   shadow_left + size[0], shadow_top + size[1]))
        del image_mask  # free up memory

        #blur shadow mask

        #Apply the filter to blur the edges of the shadow.  Since a small
        #kernel is used, the filter must be applied repeatedly to get a decent
        #blur.
        n = 0
        while n < shadow_blur:
            shadow = shadow.filter(ImageFilter.BLUR)
            n += 1

        #create back
        if mode == 'RGBA':
            back = Image.new('RGBA', back_size, shadow_color)
            back.putalpha(shadow)
            del shadow  # free up memory
        else:
            back = shadow
            cache[id] = back, back_size

    #Paste the input image onto the shadow backdrop
    image_left = border - min(horizontal_offset, 0)
    image_top = border - min(vertical_offset, 0)
    if mode == 'RGBA':
        paste(back, image, (image_left, image_top), image)
        if force_background_color:
            mask = get_alpha(back)
            paste(back, Image.new('RGB', back.size, background_color),
                  (0, 0), ImageChops.invert(mask))
            back.putalpha(mask)
    else:
        paste(back, image, (image_left, image_top))

    return back

def round_image(image, cache={}, round_all=True, rounding_type=None,
                radius=100, opacity=255, pos=ROUNDED_POS, back_color='#FFFFFF'):

    if image.mode != 'RGBA':
        image = image.convert('RGBA')

    if round_all:
        pos = 4 * (rounding_type, )

    mask = create_rounded_rectangle(image.size, cache, radius, opacity, pos)

    paste(image, Image.new('RGB', image.size, back_color), (0, 0),
          ImageChops.invert(mask))
    image.putalpha(mask)
    return image

def create_rounded_rectangle(size=(600, 400), cache={}, radius=100,
                             opacity=255, pos=ROUNDED_POS):
    #rounded_rectangle
    im_x, im_y = size
    rounded_rectangle_id = ROUNDED_RECTANGLE_ID % (radius, opacity, size, pos)
    if rounded_rectangle_id in cache:
        return cache[rounded_rectangle_id]
    else:
        #cross
        cross_id = ROUNDED_RECTANGLE_ID % (radius, opacity, size, CROSS_POS)
        if cross_id in cache:
            cross = cache[cross_id]
        else:
            cross = cache[cross_id] = Image.new('L', size, 0)
            draw = ImageDraw.Draw(cross)
            draw.rectangle((radius, 0, im_x - radius, im_y), fill=opacity)
            draw.rectangle((0, radius, im_x, im_y - radius), fill=opacity)
        if pos == CROSS_POS:
            return cross
        #corner
        corner_id = CORNER_ID % (radius, opacity)
        if corner_id in cache:
            corner = cache[corner_id]
        else:
            corner = cache[corner_id] = create_corner(radius, opacity)
        #rounded rectangle
        rectangle = Image.new('L', (radius, radius), 255)
        rounded_rectangle = cross.copy()
        for index, angle in enumerate(pos):
            if angle == CROSS:
                continue
            if angle == ROUNDED:
                element = corner
            else:
                element = rectangle
            if index % 2:
                x = im_x - radius
                element = element.transpose(Image.FLIP_LEFT_RIGHT)
            else:
                x = 0
            if index < 2:
                y = 0
            else:
                y = im_y - radius
                element = element.transpose(Image.FLIP_TOP_BOTTOM)
            paste(rounded_rectangle, element, (x, y))
        cache[rounded_rectangle_id] = rounded_rectangle
        return rounded_rectangle

def create_corner(radius=100, opacity=255, factor=2):
    corner = Image.new('L', (factor * radius, factor * radius), 0)
    draw = ImageDraw.Draw(corner)
    draw.pieslice((0, 0, 2 * factor * radius, 2 * factor * radius),
                  180, 270, fill=opacity)
    corner = corner.resize((radius, radius), Image.LANCZOS)
    return corner

def get_format(ext):
    """Guess the image format by the file extension.

    :param ext: file extension
    :type ext: string
    :returns: image format
    :rtype: string

    .. warning::

        This is only meant to check before saving files. For existing files
        open the image with PIL and check its format attribute.

    >>> get_format('jpg')
    'JPEG'
    """
    ext = ext.lstrip('.').upper()
    return FORMATS_BY_EXT.get(ext, ext)

def open_image_data(data):
    """Open image from format data.

    :param data: image format data
    :type data: string
    :returns: image
    :rtype: pil.Image
    """
    return Image.open(StringIO(data))


def open_image_exif(uri):
    """Open local files or remote files over http and transpose the
    image to its exif orientation.

    :param uri: image location
    :type uri: string
    :returns: image
    :rtype: pil.Image
    """
    return transpose_exif(open_image(uri))


class _ByteCounter:
    """Helper class to count how many bytes are written to a file.

    .. see also:: :func:`get_size`

    >>> bc = _ByteCounter()
    >>> bc.write('12345')
    >>> bc.bytes
    5
    """
    def __init__(self):
        self.bytes = 0

    def write(self, data):
        self.bytes += len(data)


def get_size(im, format, **options):
    """Gets the size in bytes if the image would be written to a file.

    :param format: image file format (e.g. ``'JPEG'``)
    :type format: string
    :returns: the file size in bytes
    :rtype: int
    """
    try:
        out = _ByteCounter()
        im.save(out, format, **options)
        return out.bytes
    except AttributeError:
        # fall back on full in-memory compression
        out = StringIO()
        im.save(out, format, **options)
        return len(out.getvalue())


def get_quality(im, size, format, down=0, up=100, delta=1000, options=None):
    """Figure out recursively the quality save parameter to obtain a
    certain image size. This mostly used for ``JPEG`` images.

    :param im: image
    :type im: pil.Image
    :param format: image file format (e.g. ``'JPEG'``)
    :type format: string
    :param down: minimum file size in bytes
    :type down: int
    :param up: maximum file size in bytes
    :type up: int
    :param delta: fault tolerance in bytes
    :type delta: int
    :param options: image save options
    :type options: dict
    :returns: save quality
    :rtype: int

    Example::

        filename = '/home/stani/sync/Desktop/IMGA3345.JPG'
        im = Image.open(filename)
        q = get_quality(im, 300000, "JPEG")
        im.save(filename.replace('.jpg', '_sized.jpg'))
    """
    if options is None:
        options = {}
    q = options['quality'] = (down + up) / 2
    if q == down or q == up:
        return max(q, 1)
    s = get_size(im, format, **options)
    if abs(s - size) < delta:
        return q
    elif s > size:
        return get_quality(im, size, format, down, up=q, options=options)
    else:
        return get_quality(im, size, format, down=q, up=up, options=options)


def fill_background_color(image, color):
    """Fills given image with background color.

    :param image: source image
    :type image: pil.Image
    :param color: background color
    :type color: tuple of int
    :returns: filled image
    :rtype: pil.Image
    """
    if image.mode == 'LA':
        image = image.convert('RGBA')
    elif image.mode != 'RGBA' and\
            not (image.mode == 'P' and 'transparency' in image.info):
        return image
    if len(color) == 4 and color[-1] != 255:
        mode = 'RGBA'
    else:
        mode = 'RGB'
    back = Image.new(mode, image.size, color)
    if image.mode == 'P' and mode == 'RGBA':
        image = image.convert('RGBA')
    if has_alpha(image):
        paste(back, image, mask=image)
    elif image.mode == 'P':
        palette = image.getpalette()
        index = image.info['transparency']
        palette[index * 3: index * 3 + 3] = color[:3]
        image.putpalette(palette)
        del image.info['transparency']
        back = image
    else:
        paste(back, image)
    return back


def generate_layer(image_size, mark, method,
                   horizontal_offset, vertical_offset,
                   horizontal_justification, vertical_justification,
                   orientation, opacity):
    """Generate new layer for backgrounds or watermarks on which a given
    image ``mark`` can be positioned, scaled or repeated.

    :param image_size: size of the reference image
    :type image_size: tuple of int
    :param mark: image mark
    :type mark: pil.Image
    :param method: ``'Tile'``, ``'Scale'``, ``'By Offset'``
    :type method: string
    :param horizontal_offset: horizontal offset
    :type horizontal_offset: int
    :param vertical_offset: vertical offset
    :type vertical_offset: int
    :param horizontal_justification: ``'Left'``, ``'Middle'``, ``'Right'``
    :type horizontal_justification: string
    :param vertical_justification: ``'Top'``, ``'Middle'``, ``'Bottom'``
    :type vertical_justification: string
    :param orientation: mark orientation (e.g. ``'ROTATE_270'``)
    :type orientation: string
    :param opacity: opacity within ``[0, 1]``
    :type opacity: float
    :returns: generated layer
    :rtype: pil.Image

    .. see also:: :func:`reduce_opacity`
    """
    mark = convert_safe_mode(open_image(mark))
    opacity /= 100.0
    mark = reduce_opacity(mark, opacity)
    layer = Image.new('RGBA', image_size, (0, 0, 0, 0))
    if method == 'Tile':
        for y in range(0, image_size[1], mark.size[1]):
            for x in range(0, image_size[0], mark.size[0]):
                paste(layer, mark, (x, y))
    elif method == 'Scale':
        # scale, but preserve the aspect ratio
        ratio = min(float(image_size[0]) / mark.size[0],
                    float(image_size[1]) / mark.size[1])
        w = int(mark.size[0] * ratio)
        h = int(mark.size[1] * ratio)
        mark = mark.resize((w, h))
        paste(layer, mark, ((image_size[0] - w) / 2,
                            (image_size[1] - h) / 2))
    elif method == 'By Offset':
        location = calculate_location(
            horizontal_offset, vertical_offset,
            horizontal_justification, vertical_justification,
            image_size, mark.size)
        if orientation:
            orientation_value = getattr(Image, orientation)
            mark = mark.transpose(orientation_value)
        paste(layer, mark, location, force=True)
    else:
        raise ValueError('Unknown method "%s" for generate_layer.' % method)
    return layer


def identity_color(image, value=0):
    """Get a color with same color component values.

    >>> im = Image.new('RGB', (1,1))
    >>> identity_color(im, 2)
    (2, 2, 2)
    >>> im = Image.new('L', (1,1))
    >>> identity_color(im, 7)
    7
    """
    bands = image.getbands()
    if len(bands) == 1:
        return value
    return tuple([value for band in bands])


def blend(im1, im2, amount, color=None):
    """Blend two images with each other. If the images differ in size
    the color will be used for undefined pixels.

    :param im1: first image
    :type im1: pil.Image
    :param im2: second image
    :type im2: pil.Image
    :param amount: amount of blending
    :type amount: int
    :param color: color of undefined pixels
    :type color: tuple
    :returns: blended image
    :rtype: pil.Image
    """
    im2 = convert_safe_mode(im2)
    if im1.size == im2.size:
        im1 = convert(im1, im2.mode)
    else:
        if color is None:
            expanded = Image.new(im2.mode, im2.size)
        elif im2.mode in ('1', 'L') and type(color) != int:
            expanded = Image.new(im2.mode, im2.size, color[0])
        else:
            expanded = Image.new(im2.mode, im2.size, color)
        im1 = im1.convert(expanded.mode)
        we, he = expanded.size
        wi, hi = im1.size
        paste(expanded, im1, ((we - wi) / 2, (he - hi) / 2),
              im1.convert('RGBA'))
        im1 = expanded
    return Image.blend(im1, im2, amount)


def reduce_opacity(im, opacity):
    """Returns an image with reduced opacity if opacity is
    within ``[0, 1]``.

    :param im: source image
    :type im: pil.Image
    :param opacity: opacity within ``[0, 1]``
    :type opacity: float
    :returns im: image
    :rtype: pil.Image

    >>> im = Image.new('RGBA', (1, 1), (255, 255, 255))
    >>> im = reduce_opacity(im, 0.5)
    >>> im.getpixel((0,0))
    (255, 255, 255, 127)
    """
    if opacity < 0 or opacity > 1:
        return im
    alpha = get_alpha(im)
    alpha = ImageEnhance.Brightness(alpha).enhance(opacity)
    put_alpha(im, alpha)
    return im


def calculate_location(horizontal_offset, vertical_offset,
                       horizontal_justification, vertical_justification,
                       canvas_size, image_size):
    """Calculate location based on offset and justification. Offsets
    can be positive and negative.

    :param horizontal_offset: horizontal offset
    :type horizontal_offset: int
    :param vertical_offset: vertical offset
    :type vertical_offset: int
    :param horizontal_justification: ``'Left'``, ``'Middle'``, ``'Right'``
    :type horizontal_justification: string
    :param vertical_justification: ``'Top'``, ``'Middle'``, ``'Bottom'``
    :type vertical_justification: string
    :param canvas_size: size of the total canvas
    :type canvas_size: tuple of int
    :param image_size: size of the image/text which needs to be placed
    :type image_size: tuple of int
    :returns: location
    :rtype: tuple of int

    .. see also:: :func:`generate layer`

    >>> calculate_location(50, 50, 'Left', 'Middle', (100,100), (10,10))
    (50, 45)
    """
    canvas_width, canvas_height = canvas_size
    image_width, image_height = image_size

    # check offsets
    if horizontal_offset < 0:
        horizontal_offset += canvas_width
    if vertical_offset < 0:
        vertical_offset += canvas_height

    # check justifications
    if horizontal_justification == 'Left':
        horizontal_delta = 0
    elif horizontal_justification == 'Middle':
        horizontal_delta = -image_width / 2
    elif horizontal_justification == 'Right':
        horizontal_delta = -image_width

    if vertical_justification == 'Top':
        vertical_delta = 0
    elif vertical_justification == 'Middle':
        vertical_delta = -image_height / 2
    elif vertical_justification == 'Bottom':
        vertical_delta = -image_height

    return horizontal_offset + horizontal_delta, \
        vertical_offset + vertical_delta


####################################
####    PIL helper functions    ####
####################################


def flatten(l):
    """Flatten a list.

    :param l: list to be flattened
    :type l: list
    :returns: flattened list
    :rtype: list

    >>> flatten([[1, 2], [3]])
    [1, 2, 3]
    """
    return [item for sublist in l for item in sublist]


def has_alpha(image):
    """Checks if the image has an alpha band.
    i.e. the image mode is either RGBA or LA.
    The transparency in the P mode doesn't count as an alpha band

    :param image: the image to check
    :type image: PIL image object
    :returns: True or False
    :rtype: boolean
    """
    return image.mode.endswith('A')


def has_transparency(image):
    """Checks if the image has transparency.
    The image has an alpha band or a P mode with transparency.

    :param image: the image to check
    :type image: PIL image object
    :returns: True or False
    :rtype: boolean
    """
    return (image.mode == 'P' and 'transparency' in image.info) or\
        has_alpha(image)


def get_alpha(image):
    """Gets the image alpha band. Can handle P mode images with transparency.
    Returns a band with all values set to 255 if no alpha band exists.

    :param image: input image
    :type image: PIL image object
    :returns: alpha as a band
    :rtype: single band image object
    """
    if has_alpha(image):
        return image.split()[-1]
    if image.mode == 'P' and 'transparency' in image.info:
        return image.convert('RGBA').split()[-1]
    # No alpha layer, create one.
    return Image.new('L', image.size, 255)


def get_format_data(image, format):
    """Convert the image in the file bytes of the image. By consequence
    this byte data is different for the chosen format (``JPEG``,
    ``TIFF``, ...).

    .. see also:: :func:`thumbnail.get_format_data`

    :param image: source image
    :type impage: pil.Image
    :param format: image file type format
    :type format: string
    :returns: byte data of the image
    """
    f = StringIO()
    convert_save_mode_by_format(image, format).save(f, format)
    return f.getvalue()


def get_palette(image):
    """Gets the palette of an image as a sequence of (r, g, b) tuples.

    :param image: image with a palette
    :type impage: pil.Image
    :returns: palette colors
    :rtype: a sequence of (r, g, b) tuples
    """
    palette = image.resize((256, 1))
    palette.putdata(range(256))
    return list(palette.convert("RGB").getdata())


def get_used_palette_indices(image):
    """Get used color indices in an image palette.

    :param image: image with a palette
    :type impage: pil.Image
    :returns: used colors of the palette
    :rtype: set of integers (0-255)
    """
    return set(image.getdata())


def get_used_palette_colors(image):
    """Get used colors in an image palette as a sequence of (r, g, b) tuples.

    :param image: image with a palette
    :type impage: pil.Image
    :returns: used colors of the palette
    :rtype: sequence of (r, g, b) tuples
    """
    used_indices = get_used_palette_indices(image)
    if 'transparency' in image.info:
        used_indices -= set([image.info['transparency']])
    n = len(used_indices)
    palette = image.resize((n, 1))
    palette.putdata(used_indices)
    return palette.convert("RGB").getdata()


def get_unused_palette_indices(image):
    """Get unused color indices in an image palette.

    :param image: image with a palette
    :type impage: pil.Image
    :returns: unused color indices of the palette
    :rtype: set of 0-255
    """
    return ALL_PALETTE_INDICES - get_used_palette_indices(image)


def fit_color_in_palette(image, color):
    """Fit a color into a palette. If the color exists already in the palette
    return its current index, otherwise add the color to the palette if
    possible. Returns -1 for color index if all colors are used already.

    :param image: image with a palette
    :type image: pil.Image
    :param color: color to fit
    :type color: (r, g, b) tuple
    :returns: color index, (new) palette
    :rtype: (r, g, b) tuple, sequence of (r, g, b) tuples
    """
    palette = get_palette(image)
    try:
        index = palette.index(color)
    except ValueError:
        index = -1
    if index > -1:
        # Check if it is not the transparent index, as that doesn't qualify.
        try:
            transparent = index == image.info['transparency']
        except KeyError:
            transparent = False
        # If transparent, look further
        if transparent:
            try:
                index = palette[index + 1:].index(color) + index + 1
            except ValueError:
                index = -1
    if index == -1:
        unused = list(get_unused_palette_indices(image))
        if unused:
            index = unused[0]
            palette[index] = color  # add color to palette
        else:
            palette = None  # palette is full
    return index, palette


def put_palette(image_to, image_from, palette=None):
    """Copies the palette and transparency of one image to another.

    :param image_to: image with a palette
    :type image_to: pil.Image
    :param image_from: image with a palette
    :type image_from: pil.Image
    :param palette: image palette
    :type palette: sequence of (r, g, b) tuples or None
    """
    if palette is None:
        palette = get_palette(image_from)
    image_to.putpalette(flatten(palette))
    if 'transparency' in image_from.info:
        image_to.info['transparency'] = image_from.info['transparency']


def put_alpha(image, alpha):
    """Copies the given band to the alpha layer of the given image.

    :param image: input image
    :type image: PIL image object
    :param alpha: the alpha band to copy
    :type alpha: single band image object
    """
    if image.mode in ['CMYK', 'YCbCr', 'P']:
        image = image.convert('RGBA')
    elif image.mode in ['1', 'F']:
        image = image.convert('RGBA')
    image.putalpha(alpha)


def remove_alpha(image):
    """Returns a copy of the image after removing the alpha band or
    transparency

    :param image: input image
    :type image: PIL image object
    :returns: the input image after removing the alpha band or transparency
    :rtype: PIL image object
    """
    if image.mode == 'RGBA':
        return image.convert('RGB')
    if image.mode == 'LA':
        return image.convert('L')
    if image.mode == 'P' and 'transparency' in image.info:
        img = image.convert('RGB')
        del img.info['transparency']
        return img
    return image


def paste(destination, source, box=(0, 0), mask=None, force=False):
    """"Pastes the source image into the destination image while using an
    alpha channel if available.

    :param destination: destination image
    :type destination:  PIL image object
    :param source: source image
    :type source: PIL image object
    :param box:

        The box argument is either a 2-tuple giving the upper left corner,
        a 4-tuple defining the left, upper, right, and lower pixel coordinate,
        or None (same as (0, 0)). If a 4-tuple is given, the size of the
        pasted image must match the size of the region.

    :type box: tuple
    :param mask: mask or None

    :type mask: bool or PIL image object
    :param force:

        With mask: Force the invert alpha paste or not.

        Without mask:

        - If ``True`` it will overwrite the alpha channel of the destination
          with the alpha channel of the source image. So in that case the
          pixels of the destination layer will be abandoned and replaced
          by exactly the same pictures of the destination image. This is mostly
          what you need if you paste on a transparent canvas.
        - If ``False`` this will use a mask when the image has an alpha
          channel. In this case pixels of the destination image will appear
          through where the source image is transparent.

    :type force: bool
    """
    # Paste on top
    if mask and source == mask:
        if has_alpha(source):
            # invert_alpha = the transparant pixels of the destination
            if has_alpha(destination) and (destination.size == source.size
                                           or force):
                invert_alpha = ImageOps.invert(get_alpha(destination))
                if invert_alpha.size != source.size:
                    # if sizes are not the same be careful!
                    # check the results visually
                    if len(box) == 2:
                        w, h = source.size
                        box = (box[0], box[1], box[0] + w, box[1] + h)
                    invert_alpha = invert_alpha.crop(box)
            else:
                invert_alpha = None
            # we don't want composite of the two alpha channels
            source_without_alpha = remove_alpha(source)
            # paste on top of the opaque destination pixels
            destination.paste(source_without_alpha, box, source)
            if invert_alpha is not None:
                # the alpha channel is ok now, so save it
                destination_alpha = get_alpha(destination)
                # paste on top of the transparent destination pixels
                # the transparent pixels of the destination should
                # be filled with the color information from the source
                destination.paste(source_without_alpha, box, invert_alpha)
                # restore the correct alpha channel
                destination.putalpha(destination_alpha)
        else:
            destination.paste(source, box)
    elif mask:
        destination.paste(source, box, mask)
    else:
        destination.paste(source, box)
        if force and has_alpha(source):
            destination_alpha = get_alpha(destination)
            source_alpha = get_alpha(source)
            destination_alpha.paste(source_alpha, box)
            destination.putalpha(destination_alpha)


def auto_crop(image):
    """Crops all transparent or black background from the image
    :param image: input image
    :type image: PIL image object
    :returns: the cropped image
    :rtype: PIL image object
    """

    alpha = get_alpha(image)
    box = alpha.getbbox()
    return convert_safe_mode(image).crop(box)


def convert(image, mode, *args, **keyw):
    """Returns a converted copy of an image

    :param image: input image
    :type image: PIL image object
    :param mode: the new mode
    :type mode: string
    :param args: extra options
    :type args: tuple of values
    :param keyw: extra keyword options
    :type keyw: dictionary of options
    :returns: the converted image
    :rtype: PIL image object
    """
    if mode == 'P':
        if image.mode == 'P':
            return image
        if image.mode in ['1', 'F']:
            return image.convert('L').convert(mode, *args, **keyw)
        if image.mode in ['RGBA', 'LA']:
            alpha = get_alpha(image)
            output = image.convert('RGB').convert(
                mode, colors=255, *args, **keyw)
            paste(output,
                  255, alpha.point(COLOR_MAP))
            output.info['transparency'] = 255
            return output
        return image.convert('RGB').convert(mode, *args, **keyw)
    if image.mode == 'P' and mode == 'LA':
        # A workaround for a PIL bug.
        # Converting from P to LA directly doesn't work.
        return image.convert('RGBA').convert('LA', *args, **keyw)
    if has_transparency(image) and (mode not in ['RGBA', 'LA']):
        if image.mode == 'P':
            image = image.convert('RGBA')
            del image.info['transparency']
        #image = fill_background_color(image, (255, 255, 255, 255))
        image = image.convert(mode, *args, **keyw)
        return image
    return image.convert(mode, *args, **keyw)


def convert_safe_mode(image):
    """Converts image into a processing-safe mode.

    :param image: input image
    :type image: PIL image object
    :returns: the converted image
    :rtype: PIL image object
    """
    if image.mode in ['1', 'F']:
        return image.convert('L')
    if image.mode == 'P' and 'transparency' in image.info:
        img = image.convert('RGBA')
        del img.info['transparency']
        return img
    if image.mode in ['P', 'YCbCr', 'CMYK', 'RGBX']:
        return image.convert('RGB')
    return image


def convert_save_mode_by_format(image, format):
    """Converts image into a saving-safe mode.

    :param image: input image
    :type image: PIL image object
    :param format: target format
    :type format: string
    :returns: the converted image
    :rtype: PIL image object
    """
    #TODO: Extend this helper function to support other formats as well
    if image.mode == 'P':
        # Make sure P is handled correctly
        if format not in ['GIF', 'PNG', 'TIFF', 'IM', 'PCX']:
            image = remove_alpha(image)
    if format == 'JPEG':
        if image.mode in ['RGBA', 'P']:
            return image.convert('RGB')
        if image.mode in ['LA']:
            return image.convert('L')
    elif format == 'BMP':
        if image.mode in ['LA']:
            return image.convert('L')
        if image.mode in ['P', 'RGBA', 'YCbCr', 'CMYK']:
            return image.convert('RGB')
    elif format == 'DIB':
        if image.mode in ['YCbCr', 'CMYK']:
            return image.convert('RGB')
    elif format == 'EPS':
        if image.mode in ['1', 'LA']:
            return image.convert('L')
        if image.mode in ['P', 'RGBA', 'YCbCr']:
            return image.convert('RGB')
    elif format == 'GIF':
        return convert(image, 'P', palette=Image.ADAPTIVE)
    elif format == 'PBM':
        if image.mode != '1':
            return image.convert('1')
    elif format == 'PCX':
        if image.mode in ['RGBA', 'CMYK', 'YCbCr']:
            return image.convert('RGB')
        if image.mode in ['LA', '1']:
            return image.convert('L')
    elif format == 'PDF':
        if image.mode in ['LA']:
            return image.convert('L')
        if image.mode in ['RGBA', 'YCbCr']:
            return image.convert('RGB')
    elif format == 'PGM':
        if image.mode != 'L':
            return image.convert('L')
    elif format == 'PPM':
        if image.mode in ['P', 'CMYK', 'YCbCr']:
            return image.convert('RGB')
        if image.mode in ['LA']:
            return image.convert('L')
    elif format == 'PS':
        if image.mode in ['1', 'LA']:
            return image.convert('L')
        if image.mode in ['P', 'RGBA', 'YCbCr']:
            return image.convert('RGB')
    elif format == 'XBM':
        if image.mode not in ['1']:
            return image.convert('1')
    elif format == 'TIFF':
        if image.mode in ['YCbCr']:
            return image.convert('RGB')
    elif format == 'PNG':
        if image.mode in ['CMYK', 'YCbCr']:
            return image.convert('RGB')
    #for consistency return a copy! (thumbnail.py depends on it)
    return image.copy()


def save_check_mode(image, filename, **options):
    #save image with pil
    save(image, filename, **options)
    #verify saved file
    try:
        image_file = Image.open(filename)
        image_file.verify()
    except IOError:
        # We can't verify the image mode with PIL, so issue no warnings.
        return ''
    if image.mode != image_file.mode:
        return image_file.mode
    return ''


def save_safely(image, filename):
    """Saves an image with a filename and raise the specific
    ``InvalidWriteFormatError`` in case of an error instead of a
    ``KeyError``. It can also save IM files with unicode.

    :param image: image
    :type image: pil.Image
    :param filename: image filename
    :type filename: string
    """
    ext = os.path.splitext(filename)[-1]
    format = get_format(ext[1:])
    image = convert_save_mode_by_format(image, format)
    save(image, filename)


def get_reverse_transposition(transposition):
    """Get the reverse transposition method.

    :param transposition: transpostion, e.g. ``Image.ROTATE_90``
    :returns: inverse transpostion, e.g. ``Image.ROTATE_270``
    """
    if transposition == Image.ROTATE_90:
        return Image.ROTATE_270
    elif transposition == Image.ROTATE_270:
        return Image.ROTATE_90
    return transposition


def get_exif_transposition(orientation):
    """Get the transposition methods necessary to align the image to
    its exif orientation.

    :param orientation: exif orientation
    :type orientation: int
    :returns: (transposition methods, reverse transpostion methods)
    :rtype: tuple
    """
    #see EXIF.py
    if orientation == 1:
        transposition = transposition_reverse = ()
    elif orientation == 2:
        transposition = Image.FLIP_LEFT_RIGHT,
        transposition_reverse = Image.FLIP_LEFT_RIGHT,
    elif orientation == 3:
        transposition = Image.ROTATE_180,
        transposition_reverse = Image.ROTATE_180,
    elif orientation == 4:
        transposition = Image.FLIP_TOP_BOTTOM,
        transposition_reverse = Image.FLIP_TOP_BOTTOM,
    elif orientation == 5:
        transposition = Image.FLIP_LEFT_RIGHT, \
            Image.ROTATE_90
        transposition_reverse = Image.ROTATE_270, \
            Image.FLIP_LEFT_RIGHT
    elif orientation == 6:
        transposition = Image.ROTATE_270,
        transposition_reverse = Image.ROTATE_90,
    elif orientation == 7:
        transposition = Image.FLIP_LEFT_RIGHT, \
            Image.ROTATE_270
        transposition_reverse = Image.ROTATE_90, \
            Image.FLIP_LEFT_RIGHT
    elif orientation == 8:
        transposition = Image.ROTATE_90,
        transposition_reverse = Image.ROTATE_270,
    else:
        transposition = transposition_reverse = ()
    return transposition, transposition_reverse


def get_exif_orientation(image):
    """Gets the exif orientation of an image.

    :param image: image
    :type image: pil.Image
    :returns: orientation
    :rtype: int
    """
    if not hasattr(image, '_getexif'):
        return 1
    try:
        _exif = image._getexif()
        if not _exif:
            return 1
        return _exif[0x0112]
    except KeyError:
        return 1


def transpose(image, methods):
    """Transpose with a sequence of transformations, mainly useful
    for exif.

    :param image: image
    :type image: pil.Image
    :param methods: transposition methods
    :type methods: list
    :returns: transposed image
    :rtype: pil.Image
    """
    for method in methods:
        image = image.transpose(method)
    return image


def transpose_exif(image, reverse=False):
    """Transpose an image to its exif orientation.

    :param image: image
    :type image: pil.Image
    :param reverse: False when opening, True when saving
    :type reverse: bool
    :returns: transposed image
    :rtype: pil.Image
    """
    orientation = get_exif_orientation(image)
    transposition = get_exif_transposition(orientation)[int(reverse)]
    if transposition:
        return transpose(image, transposition)
    return image


def checkboard(size, delta=8, fg=(128, 128, 128), bg=(204, 204, 204)):
    """Draw an n x n checkboard, which is often used as background
    for transparent images. The checkboards are stored in the
    ``CHECKBOARD`` cache.

    :param delta: dimension of one square
    :type delta: int
    :param fg: foreground color
    :type fg: tuple of int
    :param bg: background color
    :type bg: tuple of int
    :returns: checkboard image
    :rtype: pil.Image
    """
    if size not in CHECKBOARD:
        dim = max(size)
        n = int(dim / delta) + 1  # FIXME: now acts like square->nx, ny

        def sq_start(i):
            """Return the x/y start coord of the square at column/row i."""
            return i * delta

        def square(i, j):
            """Return the square corners"""
            return map(sq_start, [i, j, i + 1, j + 1])

        image = Image.new("RGB", size, bg)
        draw_square = ImageDraw.Draw(image).rectangle
        squares = (square(i, j)
                   for i_start, j in zip(cycle((0, 1)), range(n))
                   for i in range(i_start, n, 2))
        for sq in squares:
            draw_square(sq, fill=fg)
        CHECKBOARD[size] = image
    return CHECKBOARD[size].copy()


def add_checkboard(image):
    """"If the image has a transparent mask, a RGB checkerboard will be
    drawn in the background.

    .. note::

        In case of a thumbnail, the resulting image can not be used for
        the cache, as it replaces the transparency layer with a non
        transparent checkboard.

    :param image: image
    :type image: pil.Image
    :returns: image, with checkboard if transparent
    :rtype: pil.Image
    """
    if (image.mode == 'P' and 'transparency' in image.info) or\
            image.mode.endswith('A'):
        #transparent image
        image = image.convert('RGBA')
        image_bg = checkboard(image.size)
        paste(image_bg, image, (0, 0), image)
        return image_bg
    else:
        return image
