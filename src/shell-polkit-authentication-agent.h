/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

/*
 * Copyright (C) 20011 Red Hat, Inc.
 *
 * Author: David Zeuthen <davidz@redhat.com>
 */

#ifndef __SHELL_POLKIT_AUTHENTICATION_AGENT_H__
#define __SHELL_POLKIT_AUTHENTICATION_AGENT_H__

#include <glib-object.h>

G_BEGIN_DECLS

typedef struct _ShellPolkitAuthenticationAgent      ShellPolkitAuthenticationAgent;
typedef struct _ShellPolkitAuthenticationAgentClass ShellPolkitAuthenticationAgentClass;

#define SHELL_TYPE_POLKIT_AUTHENTICATION_AGENT              (shell_polkit_authentication_agent_get_type ())
#define SHELL_POLKIT_AUTHENTICATION_AGENT(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), SHELL_TYPE_POLKIT_AUTHENTICATION_AGENT, ShellPolkitAuthenticationAgent))
#define SHELL_POLKIT_AUTHENTICATION_AGENT_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_POLKIT_AUTHENTICATION_AGENT, ShellPolkitAuthenticationAgentClass))
#define SHELL_IS_POLKIT_AUTHENTICATION_AGENT(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), SHELL_TYPE_POLKIT_AUTHENTICATION_AGENT))
#define SHELL_IS_POLKIT_AUTHENTICATION_AGENT_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_POLKIT_AUTHENTICATION_AGENT))
#define SHELL_POLKIT_AUTHENTICATION_AGENT_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_POLKIT_AUTHENTICATION_AGENT, ShellPolkitAuthenticationAgentClass))

GType                           shell_polkit_authentication_agent_get_type (void) G_GNUC_CONST;
ShellPolkitAuthenticationAgent *shell_polkit_authentication_agent_new      (void);
void                            shell_polkit_authentication_agent_complete (ShellPolkitAuthenticationAgent *agent,
                                                                            gboolean                        dismissed);

G_END_DECLS

#endif /* __SHELL_POLKIT_AUTHENTICATION_AGENT_H__ */
