
#ifndef ___st_marshal_MARSHAL_H__
#define ___st_marshal_MARSHAL_H__

#include	<glib-object.h>

G_BEGIN_DECLS

/* VOID:OBJECT (./st/st-marshal.list:1) */
#define _st_marshal_VOID__OBJECT	g_cclosure_marshal_VOID__OBJECT

/* VOID:VOID (./st/st-marshal.list:2) */
#define _st_marshal_VOID__VOID	g_cclosure_marshal_VOID__VOID

/* VOID:PARAM (./st/st-marshal.list:3) */
#define _st_marshal_VOID__PARAM	g_cclosure_marshal_VOID__PARAM

/* VOID:POINTER (./st/st-marshal.list:4) */
#define _st_marshal_VOID__POINTER	g_cclosure_marshal_VOID__POINTER

/* VOID:INT (./st/st-marshal.list:5) */
#define _st_marshal_VOID__INT	g_cclosure_marshal_VOID__INT

/* VOID:UINT (./st/st-marshal.list:6) */
#define _st_marshal_VOID__UINT	g_cclosure_marshal_VOID__UINT

/* VOID:UINT,UINT (./st/st-marshal.list:7) */
extern void _st_marshal_VOID__UINT_UINT (GClosure     *closure,
                                         GValue       *return_value,
                                         guint         n_param_values,
                                         const GValue *param_values,
                                         gpointer      invocation_hint,
                                         gpointer      marshal_data);

/* VOID:OBJECT,OBJECT (./st/st-marshal.list:8) */
extern void _st_marshal_VOID__OBJECT_OBJECT (GClosure     *closure,
                                             GValue       *return_value,
                                             guint         n_param_values,
                                             const GValue *param_values,
                                             gpointer      invocation_hint,
                                             gpointer      marshal_data);

/* VOID:STRING,OBJECT (./st/st-marshal.list:9) */
extern void _st_marshal_VOID__STRING_OBJECT (GClosure     *closure,
                                             GValue       *return_value,
                                             guint         n_param_values,
                                             const GValue *param_values,
                                             gpointer      invocation_hint,
                                             gpointer      marshal_data);

/* VOID:OBJECT,OBJECT,INT,INT (./st/st-marshal.list:10) */
extern void _st_marshal_VOID__OBJECT_OBJECT_INT_INT (GClosure     *closure,
                                                     GValue       *return_value,
                                                     guint         n_param_values,
                                                     const GValue *param_values,
                                                     gpointer      invocation_hint,
                                                     gpointer      marshal_data);

/* VOID:OBJECT,FLOAT,FLOAT,INT,ENUM (./st/st-marshal.list:11) */
extern void _st_marshal_VOID__OBJECT_FLOAT_FLOAT_INT_ENUM (GClosure     *closure,
                                                           GValue       *return_value,
                                                           guint         n_param_values,
                                                           const GValue *param_values,
                                                           gpointer      invocation_hint,
                                                           gpointer      marshal_data);

/* VOID:FLOAT,FLOAT,INT,ENUM (./st/st-marshal.list:12) */
extern void _st_marshal_VOID__FLOAT_FLOAT_INT_ENUM (GClosure     *closure,
                                                    GValue       *return_value,
                                                    guint         n_param_values,
                                                    const GValue *param_values,
                                                    gpointer      invocation_hint,
                                                    gpointer      marshal_data);

/* VOID:FLOAT,FLOAT (./st/st-marshal.list:13) */
extern void _st_marshal_VOID__FLOAT_FLOAT (GClosure     *closure,
                                           GValue       *return_value,
                                           guint         n_param_values,
                                           const GValue *param_values,
                                           gpointer      invocation_hint,
                                           gpointer      marshal_data);

G_END_DECLS

#endif /* ___st_marshal_MARSHAL_H__ */

