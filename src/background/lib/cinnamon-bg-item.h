#pragma once

#include <gio/gio.h>
#include "cinnamon-bg-enums.h"

G_BEGIN_DECLS

#define CINNAMON_TYPE_BG_ITEM (cinnamon_bg_item_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonBgItem, cinnamon_bg_item, CINNAMON, BG_ITEM, GObject)

gboolean        cinnamon_bg_item_has_picture   (CinnamonBgItem *self);

G_END_DECLS
