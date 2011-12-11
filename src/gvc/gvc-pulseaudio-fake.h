/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 8 -*-
 *
 * Copyright (C) 2008 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
 *
 */

#ifndef __GVC_PULSEAUDIO_FAKE_H
#define __GVC_PULSEAUDIO_FAKE_H

#ifdef WITH_INTROSPECTION

#ifndef PA_API_VERSION
#define pa_channel_position_t int
#define pa_volume_t guint32
#define pa_context gpointer
#endif /* PA_API_VERSION */

#endif /* WITH_INTROSPECTION */

#endif /* __GVC_PULSEAUDIO_FAKE_H */
