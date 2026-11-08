#pragma once

#include <gio/gio.h>
#include "cinnamon-bg-enums.h"
#include "cinnamon-bg-item.h"
#include "cinnamon-bg-monitor-info.h"

G_BEGIN_DECLS

#define CINNAMON_TYPE_BG_LIST (cinnamon_bg_list_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonBgList, cinnamon_bg_list, CINNAMON, BG_LIST, GObject)

CinnamonBgList *cinnamon_bg_list_new                   (void);

void            cinnamon_bg_list_save                  (CinnamonBgList *self);
void            cinnamon_bg_list_save_pictures         (CinnamonBgList *self);

CinnamonBgMode  cinnamon_bg_list_get_mode              (CinnamonBgList *self);
void            cinnamon_bg_list_set_mode              (CinnamonBgList *self,
                                                        CinnamonBgMode  mode);

CinnamonBgItem *cinnamon_bg_list_get_item_for_monitor  (CinnamonBgList *self,
                                                        guint           monitor);

GPtrArray      *cinnamon_bg_list_get_monitor_infos     (CinnamonBgList *self);

void            cinnamon_bg_list_set_single_uri        (const char     *uri);
gboolean        cinnamon_bg_list_has_slideshow         (void);

G_END_DECLS
