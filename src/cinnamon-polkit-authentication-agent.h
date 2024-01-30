/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

/*
 * Copyright (C) 20011 Red Hat, Inc.
 *
 * Author: David Zeuthen <davidz@redhat.com>
 */

#pragma once

#define POLKIT_AGENT_I_KNOW_API_IS_SUBJECT_TO_CHANGE
#include <polkitagent/polkitagent.h>
#include <glib-object.h>

G_BEGIN_DECLS

#if !(POLKIT_VERSION >= 121)
/* Polkit < 121 doesn't have g_autoptr support */
G_DEFINE_AUTOPTR_CLEANUP_FUNC (PolkitAgentListener, g_object_unref)
#endif

#define CINNAMON_TYPE_POLKIT_AUTHENTICATION_AGENT (cinnamon_polkit_authentication_agent_get_type())

G_DECLARE_FINAL_TYPE (CinnamonPolkitAuthenticationAgent, cinnamon_polkit_authentication_agent, CINNAMON, POLKIT_AUTHENTICATION_AGENT, PolkitAgentListener)

CinnamonPolkitAuthenticationAgent *cinnamon_polkit_authentication_agent_new (void);

void                            cinnamon_polkit_authentication_agent_complete (CinnamonPolkitAuthenticationAgent *agent,
                                                                            gboolean                        dismissed);
void                            cinnamon_polkit_authentication_agent_register (CinnamonPolkitAuthenticationAgent *agent,
                                                                            GError                        **error_out);
void                            cinnamon_polkit_authentication_agent_unregister (CinnamonPolkitAuthenticationAgent *agent);

G_END_DECLS

