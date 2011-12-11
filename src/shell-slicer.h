/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __SHELL_SLICER_H__
#define __SHELL_SLICER_H__

#include "st.h"

#define SHELL_TYPE_SLICER                 (shell_slicer_get_type ())
#define SHELL_SLICER(obj)                 (G_TYPE_CHECK_INSTANCE_CAST ((obj), SHELL_TYPE_SLICER, ShellSlicer))
#define SHELL_SLICER_CLASS(klass)         (G_TYPE_CHECK_CLASS_CAST ((klass), SHELL_TYPE_SLICER, ShellSlicerClass))
#define SHELL_IS_SLICER(obj)              (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SHELL_TYPE_SLICER))
#define SHELL_IS_SLICER_CLASS(klass)      (G_TYPE_CHECK_CLASS_TYPE ((klass), SHELL_TYPE_SLICER))
#define SHELL_SLICER_GET_CLASS(obj)       (G_TYPE_INSTANCE_GET_CLASS ((obj), SHELL_TYPE_SLICER, ShellSlicerClass))

typedef struct _ShellSlicer        ShellSlicer;
typedef struct _ShellSlicerClass   ShellSlicerClass;

typedef struct _ShellSlicerPrivate ShellSlicerPrivate;

struct _ShellSlicer
{
    StBin parent;

    ShellSlicerPrivate *priv;
};

struct _ShellSlicerClass
{
    StBinClass parent_class;
};

GType shell_slicer_get_type (void) G_GNUC_CONST;

#endif /* __SHELL_SLICER_H__ */
