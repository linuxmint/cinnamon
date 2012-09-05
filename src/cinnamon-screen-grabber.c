/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include <string.h>

#include <clutter/clutter.h>
#include <cogl/cogl.h>
#include <GL/gl.h>
#include <GL/glx.h>
#include <GL/glext.h>

#include "cinnamon-screen-grabber.h"

PFNGLBINDBUFFERARBPROC pf_glBindBufferARB;
PFNGLBUFFERDATAARBPROC pf_glBufferDataARB;
PFNGLDELETEBUFFERSARBPROC pf_glDeleteBuffersARB;
PFNGLGENBUFFERSARBPROC pf_glGenBuffersARB;
PFNGLMAPBUFFERARBPROC pf_glMapBufferARB;
PFNGLUNMAPBUFFERARBPROC pf_glUnmapBufferARB;

struct _CinnamonScreenGrabberClass
{
  GObjectClass parent_class;
};

struct _CinnamonScreenGrabber
{
  GObject parent_instance;

  int have_pixel_buffers;
  int have_pack_invert;
  int width, height;
  GLuint pixel_buffer;
};

G_DEFINE_TYPE(CinnamonScreenGrabber, cinnamon_screen_grabber, G_TYPE_OBJECT);

static void
cinnamon_screen_grabber_finalize (GObject *gobject)
{
  CinnamonScreenGrabber *grabber = CINNAMON_SCREEN_GRABBER (gobject);

  if (grabber->pixel_buffer != 0)
    pf_glDeleteBuffersARB (1, &grabber->pixel_buffer);
}

static void
cinnamon_screen_grabber_class_init (CinnamonScreenGrabberClass *grabber_class)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (grabber_class);

  gobject_class->finalize = cinnamon_screen_grabber_finalize;
}

static void
cinnamon_screen_grabber_init (CinnamonScreenGrabber *grabber)
{
  grabber->have_pixel_buffers = -1;
  grabber->width = -1;
  grabber->height= -1;
  grabber->pixel_buffer = 0;
}

CinnamonScreenGrabber *
cinnamon_screen_grabber_new  (void)
{
  return g_object_new (CINNAMON_TYPE_SCREEN_GRABBER, NULL);
}

/**
 * cinnamon_screen_grabber_grab:
 * x: X coordinate of the rectangle to grab
 * y: Y coordinate of the rectangle to grab
 * width: width of the rectangle to grab
 * height: heigth of the rectangle to grab
 *
 * Grabs pixel data from a portion of the screen.
 *
 * Return value: buffer holding the grabbed data. The data is stored as 32-bit
 *  words with native-endian xRGB pixels (i.e., the same as CAIRO_FORMAT_RGB24)
 *  with no padding on the rows. So, the size of the buffer is width * height * 4
 *  bytes. Free with g_free().
 **/
guchar *
cinnamon_screen_grabber_grab (CinnamonScreenGrabber *grabber,
                           int                 x,
                           int                 y,
                           int                 width,
                           int                 height)
{
  guchar *data;
  gsize row_bytes;
  gsize data_size;

  row_bytes = width * 4;
  data_size = row_bytes * height;
  data = g_malloc (data_size);

  if (grabber->have_pixel_buffers == -1)
    {
      const GLubyte* extensions = glGetString (GL_EXTENSIONS);
      grabber->have_pixel_buffers = strstr ((const char *)extensions, "GL_EXT_pixel_buffer_object") != NULL;
      grabber->have_pack_invert = strstr ((const char *)extensions, "GL_MESA_pack_invert") != NULL;
    }

  if (grabber->have_pixel_buffers)
    {
      GLubyte *mapped_data;
      GLint old_swap_bytes, old_lsb_first, old_row_length, old_skip_pixels, old_skip_rows, old_alignment;
      GLint old_pack_invert = GL_FALSE;
      GLint vp_size[4];
      guchar *src_row, *dest_row;
      int i;

      cogl_flush ();

      if (pf_glBindBufferARB == NULL)
        {
          pf_glBindBufferARB = (PFNGLBINDBUFFERARBPROC) cogl_get_proc_address ("glBindBufferARB");
          pf_glBufferDataARB = (PFNGLBUFFERDATAARBPROC) cogl_get_proc_address ("glBufferDataARB");
          pf_glDeleteBuffersARB = (PFNGLDELETEBUFFERSARBPROC) cogl_get_proc_address ("glDeleteBuffersARB");
          pf_glGenBuffersARB = (PFNGLGENBUFFERSARBPROC) cogl_get_proc_address ("glGenBuffersARB");
          pf_glMapBufferARB = (PFNGLMAPBUFFERARBPROC) cogl_get_proc_address ("glMapBufferARB");
          pf_glUnmapBufferARB = (PFNGLUNMAPBUFFERARBPROC) cogl_get_proc_address ("glUnmapBufferARB");
        }

      glGetIntegerv (GL_PACK_SWAP_BYTES, &old_swap_bytes);
      glGetIntegerv (GL_PACK_LSB_FIRST, &old_lsb_first);
      glGetIntegerv (GL_PACK_ROW_LENGTH, &old_row_length);
      glGetIntegerv (GL_PACK_SKIP_PIXELS, &old_skip_pixels);
      glGetIntegerv (GL_PACK_SKIP_ROWS, &old_skip_rows);
      glGetIntegerv (GL_PACK_ALIGNMENT, &old_alignment);

      glPixelStorei (GL_PACK_SWAP_BYTES, GL_FALSE);
      glPixelStorei (GL_PACK_LSB_FIRST, GL_FALSE);
      glPixelStorei (GL_PACK_ROW_LENGTH, 0);
      glPixelStorei (GL_PACK_SKIP_PIXELS, 0);
      glPixelStorei (GL_PACK_SKIP_ROWS, 0);
      glPixelStorei (GL_PACK_ALIGNMENT, 1);

      if (grabber->have_pack_invert)
        {
          glGetIntegerv (GL_PACK_INVERT_MESA, &old_pack_invert);
          glPixelStorei (GL_PACK_INVERT_MESA, GL_FALSE);
        }

      if (grabber->pixel_buffer != 0 &&
          (grabber->width != width ||
           grabber->height != height))
        {
          pf_glDeleteBuffersARB (1, &grabber->pixel_buffer);
          grabber->pixel_buffer = 0;
        }

      if (grabber->pixel_buffer == 0)
        {
          pf_glGenBuffersARB (1, &grabber->pixel_buffer);

          pf_glBindBufferARB (GL_PIXEL_PACK_BUFFER_ARB, grabber->pixel_buffer);
          pf_glBufferDataARB (GL_PIXEL_PACK_BUFFER_ARB, data_size, 0, GL_STREAM_READ_ARB);

          grabber->width = width;
          grabber->height = height;
        }
      else
        {
          pf_glBindBufferARB (GL_PIXEL_PACK_BUFFER_ARB, grabber->pixel_buffer);
        }

      /* In OpenGL, (x,y) specifies the bottom-left corner rather than the
       * top-left */
      glGetIntegerv (GL_VIEWPORT, vp_size);
      y = vp_size[3] - (y + height);
      glReadPixels (x, y, width, height, GL_BGRA, GL_UNSIGNED_BYTE, 0);

      mapped_data = pf_glMapBufferARB (GL_PIXEL_PACK_BUFFER_ARB, GL_READ_ONLY_ARB);

      src_row = mapped_data + (height - 1) * row_bytes;
      dest_row = data;

      for (i = 0; i < height; i++)
        {
          memcpy (dest_row, src_row, row_bytes);
          src_row -= row_bytes;
          dest_row += row_bytes;
        }

      pf_glUnmapBufferARB (GL_PIXEL_PACK_BUFFER_ARB);
      pf_glBindBufferARB (GL_PIXEL_PACK_BUFFER_ARB, 0);

      glPixelStorei (GL_PACK_SWAP_BYTES, old_swap_bytes);
      glPixelStorei (GL_PACK_LSB_FIRST, old_lsb_first);
      glPixelStorei (GL_PACK_ROW_LENGTH, old_row_length);
      glPixelStorei (GL_PACK_SKIP_PIXELS, old_skip_pixels);
      glPixelStorei (GL_PACK_SKIP_ROWS, old_skip_rows);
      glPixelStorei (GL_PACK_ALIGNMENT, old_alignment);

      if (grabber->have_pack_invert)
        glPixelStorei (GL_PACK_INVERT_MESA, old_pack_invert);
    }
  else
    {
      cogl_read_pixels (x, y,
                        width, height,
                        COGL_READ_PIXELS_COLOR_BUFFER,
                        CLUTTER_CAIRO_FORMAT_ARGB32,
                        data);
    }

  return data;
}
