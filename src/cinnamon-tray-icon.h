/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_TRAY_ICON_H__
#define __CINNAMON_TRAY_ICON_H__

#include "cinnamon-gtk-embed.h"

#define CINNAMON_TYPE_TRAY_ICON                 (cinnamon_tray_icon_get_type ())
#define CINNAMON_TRAY_ICON(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), CINNAMON_TYPE_TRAY_ICON, CinnamonTrayIcon))
#define CINNAMON_TRAY_ICON_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_TRAY_ICON, CinnamonTrayIconClass))
#define CINNAMON_IS_TRAY_ICON(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), CINNAMON_TYPE_TRAY_ICON))
#define CINNAMON_IS_TRAY_ICON_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_TRAY_ICON))
#define CINNAMON_TRAY_ICON_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_TRAY_ICON, CinnamonTrayIconClass))

typedef struct _CinnamonTrayIcon        CinnamonTrayIcon;
typedef struct _CinnamonTrayIconClass   CinnamonTrayIconClass;
typedef struct _CinnamonTrayIconPrivate CinnamonTrayIconPrivate;

struct _CinnamonTrayIcon
{
    CinnamonGtkEmbed parent;

    CinnamonTrayIconPrivate *priv;
};

struct _CinnamonTrayIconClass
{
    CinnamonGtkEmbedClass parent_class;
};


GType         cinnamon_tray_icon_get_type (void) G_GNUC_CONST;
ClutterActor *cinnamon_tray_icon_new      (CinnamonEmbeddedWindow *window);

gboolean      cinnamon_tray_icon_handle_event (CinnamonTrayIcon *icon,
                                               ClutterEventType  event_type,
                                               ClutterEvent     *event);

#endif /* __CINNAMON_TRAY_ICON_H__ */
