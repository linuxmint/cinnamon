
#ifndef ___na_marshal_MARSHAL_H__
#define ___na_marshal_MARSHAL_H__

#include	<glib-object.h>

G_BEGIN_DECLS

/* VOID:OBJECT,OBJECT (./tray/na-marshal.list:1) */
extern void _na_marshal_VOID__OBJECT_OBJECT (GClosure     *closure,
                                             GValue       *return_value,
                                             guint         n_param_values,
                                             const GValue *param_values,
                                             gpointer      invocation_hint,
                                             gpointer      marshal_data);

/* VOID:OBJECT,STRING,LONG,LONG (./tray/na-marshal.list:2) */
extern void _na_marshal_VOID__OBJECT_STRING_LONG_LONG (GClosure     *closure,
                                                       GValue       *return_value,
                                                       guint         n_param_values,
                                                       const GValue *param_values,
                                                       gpointer      invocation_hint,
                                                       gpointer      marshal_data);

/* VOID:OBJECT,LONG (./tray/na-marshal.list:3) */
extern void _na_marshal_VOID__OBJECT_LONG (GClosure     *closure,
                                           GValue       *return_value,
                                           guint         n_param_values,
                                           const GValue *param_values,
                                           gpointer      invocation_hint,
                                           gpointer      marshal_data);

G_END_DECLS

#endif /* ___na_marshal_MARSHAL_H__ */

