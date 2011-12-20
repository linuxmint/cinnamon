
#ifndef ___cinnamon_marshal_MARSHAL_H__
#define ___cinnamon_marshal_MARSHAL_H__

#include	<glib-object.h>

G_BEGIN_DECLS

/* VOID:INT,INT,INT (./cinnamon-marshal.list:1) */
extern void _cinnamon_marshal_VOID__INT_INT_INT (GClosure     *closure,
                                                 GValue       *return_value,
                                                 guint         n_param_values,
                                                 const GValue *param_values,
                                                 gpointer      invocation_hint,
                                                 gpointer      marshal_data);

/* VOID:OBJECT,INT,INT,INT,INT (./cinnamon-marshal.list:2) */
extern void _cinnamon_marshal_VOID__OBJECT_INT_INT_INT_INT (GClosure     *closure,
                                                            GValue       *return_value,
                                                            guint         n_param_values,
                                                            const GValue *param_values,
                                                            gpointer      invocation_hint,
                                                            gpointer      marshal_data);

/* VOID:BOXED (./cinnamon-marshal.list:3) */
#define _cinnamon_marshal_VOID__BOXED	g_cclosure_marshal_VOID__BOXED

/* VOID:BOXED,OBJECT (./cinnamon-marshal.list:4) */
extern void _cinnamon_marshal_VOID__BOXED_OBJECT (GClosure     *closure,
                                                  GValue       *return_value,
                                                  guint         n_param_values,
                                                  const GValue *param_values,
                                                  gpointer      invocation_hint,
                                                  gpointer      marshal_data);

/* VOID:OBJECT,OBJECT (./cinnamon-marshal.list:5) */
extern void _cinnamon_marshal_VOID__OBJECT_OBJECT (GClosure     *closure,
                                                   GValue       *return_value,
                                                   guint         n_param_values,
                                                   const GValue *param_values,
                                                   gpointer      invocation_hint,
                                                   gpointer      marshal_data);

/* VOID:STRING,UINT,OBJECT,BOOLEAN (./cinnamon-marshal.list:6) */
extern void _cinnamon_marshal_VOID__STRING_UINT_OBJECT_BOOLEAN (GClosure     *closure,
                                                                GValue       *return_value,
                                                                guint         n_param_values,
                                                                const GValue *param_values,
                                                                gpointer      invocation_hint,
                                                                gpointer      marshal_data);

/* VOID:INT,INT (./cinnamon-marshal.list:7) */
extern void _cinnamon_marshal_VOID__INT_INT (GClosure     *closure,
                                             GValue       *return_value,
                                             guint         n_param_values,
                                             const GValue *param_values,
                                             gpointer      invocation_hint,
                                             gpointer      marshal_data);

/* VOID:STRING,STRING,STRING,STRING,BOXED (./cinnamon-marshal.list:8) */
extern void _cinnamon_marshal_VOID__STRING_STRING_STRING_STRING_BOXED (GClosure     *closure,
                                                                       GValue       *return_value,
                                                                       guint         n_param_values,
                                                                       const GValue *param_values,
                                                                       gpointer      invocation_hint,
                                                                       gpointer      marshal_data);

/* VOID:STRING,OBJECT,STRING,BOXED (./cinnamon-marshal.list:9) */
extern void _cinnamon_marshal_VOID__STRING_OBJECT_STRING_BOXED (GClosure     *closure,
                                                                GValue       *return_value,
                                                                guint         n_param_values,
                                                                const GValue *param_values,
                                                                gpointer      invocation_hint,
                                                                gpointer      marshal_data);

G_END_DECLS

#endif /* ___cinnamon_marshal_MARSHAL_H__ */

