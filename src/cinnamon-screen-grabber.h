/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_SCREEN_GRABBER_H__
#define __CINNAMON_SCREEN_GRABBER_H__

#include <glib-object.h>

G_BEGIN_DECLS

/**
 * SECTION:cinnamon-screen-grabber
 * @short_description: Grab pixel data from the screen
 *
 * The #CinnamonScreenGrabber object is used to download previous drawn
 * content to the screen. It internally uses pixel-buffer objects if
 * available, otherwise falls back to cogl_read_pixels().
 *
 * If you are repeatedly grabbing images of the same size from the
 * screen, it makes sense to create one #CinnamonScreenGrabber and keep
 * it around. Otherwise, it's fine to simply create one as needed and
 * then get rid of it.
 */

typedef struct _CinnamonScreenGrabber      CinnamonScreenGrabber;
typedef struct _CinnamonScreenGrabberClass CinnamonScreenGrabberClass;

#define CINNAMON_TYPE_SCREEN_GRABBER              (cinnamon_screen_grabber_get_type ())
#define CINNAMON_SCREEN_GRABBER(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_SCREEN_GRABBER, CinnamonScreenGrabber))
#define CINNAMON_SCREEN_GRABBER_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_SCREEN_GRABBER, CinnamonScreenGrabberClass))
#define CINNAMON_IS_SCREEN_GRABBER(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_SCREEN_GRABBER))
#define CINNAMON_IS_SCREEN_GRABBER_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_SCREEN_GRABBER))
#define CINNAMON_SCREEN_GRABBER_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_SCREEN_GRABBER, CinnamonScreenGrabberClass))

GType cinnamon_screen_grabber_get_type (void) G_GNUC_CONST;

CinnamonScreenGrabber *cinnamon_screen_grabber_new  (void);
guchar *            cinnamon_screen_grabber_grab (CinnamonScreenGrabber *grabber,
                                               int                 x,
                                               int                 y,
                                               int                 width,
                                               int                 height);

G_END_DECLS

#endif /* __CINNAMON_SCREEN_GRABBER_H__ */
