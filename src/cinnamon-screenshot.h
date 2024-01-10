/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_SCREENSHOT_H__
#define __CINNAMON_SCREENSHOT_H__

/**
 * SECTION:cinnamon-screenshot
 * @short_description: Grabs screenshots of areas and/or windows
 *
 * The #CinnamonScreenshot object is used to take screenshots of screen
 * areas or windows and write them out as png files.
 *
 */

typedef struct _CinnamonScreenshot      CinnamonScreenshot;
typedef struct _CinnamonScreenshotClass CinnamonScreenshotClass;

#define CINNAMON_TYPE_SCREENSHOT              (cinnamon_screenshot_get_type ())
#define CINNAMON_SCREENSHOT(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_SCREENSHOT, CinnamonScreenshot))
#define CINNAMON_SCREENSHOT_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_SCREENSHOT, CinnamonScreenshotClass))
#define CINNAMON_IS_SCREENSHOT(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_SCREENSHOT))
#define CINNAMON_IS_SCREENSHOT_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_SCREENSHOT))
#define CINNAMON_SCREENSHOT_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_SCREENSHOT, CinnamonScreenshotClass))

GType cinnamon_screenshot_get_type (void) G_GNUC_CONST;

CinnamonScreenshot *cinnamon_screenshot_new (void);

typedef void (*CinnamonScreenshotCallback)  (CinnamonScreenshot *screenshot,
                                           gboolean success,
                                           cairo_rectangle_int_t *screenshot_area);

typedef void (*CinnamonScreenshotPickColorCallback)  (CinnamonScreenshot *screenshot,
                                                      gboolean success,
                                                      ClutterColor *color);

void    cinnamon_screenshot_screenshot_area      (CinnamonScreenshot *screenshot,
                                                gboolean include_cursor,
                                                int x,
                                                int y,
                                                int width,
                                                int height,
                                                const char *filename,
                                                CinnamonScreenshotCallback callback);

void    cinnamon_screenshot_screenshot_window    (CinnamonScreenshot *screenshot,
                                                gboolean include_frame,
                                                gboolean include_cursor,
                                                const char *filename,
                                                CinnamonScreenshotCallback callback);

void    cinnamon_screenshot_screenshot           (CinnamonScreenshot *screenshot,
                                                gboolean include_cursor,
                                                const char *filename,
                                                CinnamonScreenshotCallback callback);

void    cinnamon_screenshot_pick_color         (CinnamonScreenshot *screenshot,
                                                int x,
                                                int y,
                                                CinnamonScreenshotPickColorCallback callback);

#endif /* ___CINNAMON_SCREENSHOT_H__ */
