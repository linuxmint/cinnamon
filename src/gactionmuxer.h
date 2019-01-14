/*
 * Copyright © 2011 Canonical Limited
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the licence, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the
 * Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307, USA.
 *
 * Author: Ryan Lortie <desrt@desrt.ca>
 */

#ifndef __G_ACTION_MUXER_H__
#define __G_ACTION_MUXER_H__

#include <gio/gio.h>

G_BEGIN_DECLS

#define G_TYPE_ACTION_MUXER                                 (g_action_muxer_get_type ())
#define G_ACTION_MUXER(inst)                                (G_TYPE_CHECK_INSTANCE_CAST ((inst),                     \
                                                             G_TYPE_ACTION_MUXER, GActionMuxer))
#define G_IS_ACTION_MUXER(inst)                             (G_TYPE_CHECK_INSTANCE_TYPE ((inst),                     \
                                                             G_TYPE_ACTION_MUXER))

typedef struct _GActionMuxer                                GActionMuxer;

G_GNUC_INTERNAL
GType                   g_action_muxer_get_type                         (void);
G_GNUC_INTERNAL
GActionMuxer *          g_action_muxer_new                              (void);

G_GNUC_INTERNAL
void                    g_action_muxer_insert                           (GActionMuxer *muxer,
                                                                         const gchar  *prefix,
                                                                         GActionGroup *group);

G_GNUC_INTERNAL
void                    g_action_muxer_remove                           (GActionMuxer *muxer,
                                                                         const gchar  *prefix);

G_END_DECLS

#endif /* __G_ACTION_MUXER_H__ */