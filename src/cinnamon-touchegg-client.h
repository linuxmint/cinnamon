#ifndef __CINNAMON_TOUCHEGG_CLIENT_H__
#define __CINNAMON_TOUCHEGG_CLIENT_H__

#include <glib-object.h>

G_BEGIN_DECLS

#define CINNAMON_TYPE_TOUCHEGG_CLIENT (cinnamon_touchegg_client_get_type ())
G_DECLARE_FINAL_TYPE (CinnamonToucheggClient, cinnamon_touchegg_client, CINNAMON, TOUCHEGG_CLIENT, GObject)

CinnamonToucheggClient  *cinnamon_touchegg_client_new (void);

G_END_DECLS

#endif  /* __CINNAMON_TOUCHEGG_CLIENT_H__ */
