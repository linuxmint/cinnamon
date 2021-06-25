/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

/*
 * Copyright (C) 20011 Red Hat, Inc.
 *
 * Author: David Zeuthen <davidz@redhat.com>
 */

#ifndef __CINNAMON_POLKIT_AUTHENTICATION_AGENT_H__
#define __CINNAMON_POLKIT_AUTHENTICATION_AGENT_H__

#include <glib-object.h>

G_BEGIN_DECLS

typedef struct _CinnamonPolkitAuthenticationAgent      CinnamonPolkitAuthenticationAgent;
typedef struct _CinnamonPolkitAuthenticationAgentClass CinnamonPolkitAuthenticationAgentClass;

#define CINNAMON_TYPE_POLKIT_AUTHENTICATION_AGENT              (cinnamon_polkit_authentication_agent_get_type ())
#define CINNAMON_POLKIT_AUTHENTICATION_AGENT(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), CINNAMON_TYPE_POLKIT_AUTHENTICATION_AGENT, CinnamonPolkitAuthenticationAgent))
#define CINNAMON_POLKIT_AUTHENTICATION_AGENT_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), CINNAMON_TYPE_POLKIT_AUTHENTICATION_AGENT, CinnamonPolkitAuthenticationAgentClass))
#define CINNAMON_IS_POLKIT_AUTHENTICATION_AGENT(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), CINNAMON_TYPE_POLKIT_AUTHENTICATION_AGENT))
#define CINNAMON_IS_POLKIT_AUTHENTICATION_AGENT_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), CINNAMON_TYPE_POLKIT_AUTHENTICATION_AGENT))
#define CINNAMON_POLKIT_AUTHENTICATION_AGENT_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), CINNAMON_TYPE_POLKIT_AUTHENTICATION_AGENT, CinnamonPolkitAuthenticationAgentClass))

GType                           cinnamon_polkit_authentication_agent_get_type (void) G_GNUC_CONST;
CinnamonPolkitAuthenticationAgent *cinnamon_polkit_authentication_agent_new      (void);
void                            cinnamon_polkit_authentication_agent_complete (CinnamonPolkitAuthenticationAgent *agent,
                                                                            gboolean                        dismissed);

G_END_DECLS

#endif /* __CINNAMON_POLKIT_AUTHENTICATION_AGENT_H__ */
