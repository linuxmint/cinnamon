/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_TRAY_ICON_H__
#define __SHELL_TRAY_ICON_H__

#include "shell-gtk-embed.h"

#define SHELL_TYPE_TRAY_ICON                 (shell_tray_icon_get_type ())
#define SHELL_TRAY_ICON(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_TRAY_ICON, ShellTrayIcon))
#define SHELL_TRAY_ICON_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_TRAY_ICON, ShellTrayIconClass))
#define SHELL_IS_TRAY_ICON(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_TRAY_ICON))
#define SHELL_IS_TRAY_ICON_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_TRAY_ICON))
#define SHELL_TRAY_ICON_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_TRAY_ICON, ShellTrayIconClass))

typedef struct _ShellTrayIcon        ShellTrayIcon;
typedef struct _ShellTrayIconClass   ShellTrayIconClass;
typedef struct _ShellTrayIconPrivate ShellTrayIconPrivate;

struct _ShellTrayIcon
{
    ShellGtkEmbed parent;

    ShellTrayIconPrivate *priv;
};

struct _ShellTrayIconClass
{
    ShellGtkEmbedClass parent_class;
};


GType         shell_tray_icon_get_type (void) G_GNUC_CONST;
ClutterActor *shell_tray_icon_new      (ShellEmbeddedWindow *window);

void          shell_tray_icon_click    (ShellTrayIcon       *icon,
                                        ClutterEvent        *event);

#endif /* __SHELL_TRAY_ICON_H__ */
