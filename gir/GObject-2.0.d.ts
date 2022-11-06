/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.GObject {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Binding} instead.
	 */
	interface IBinding {
		/**
		 * Flags to be used to control the #GBinding
		 */
		flags: BindingFlags;
		/**
		 * The #GObject that should be used as the source of the binding
		 */
		source: Object;
		/**
		 * The name of the property of #GBinding:source that should be used
		 * as the source of the binding.
		 * 
		 * This should be in [canonical form][canonical-parameter-names] to get the
		 * best performance.
		 */
		source_property: string;
		/**
		 * The #GObject that should be used as the target of the binding
		 */
		target: Object;
		/**
		 * The name of the property of #GBinding:target that should be used
		 * as the target of the binding.
		 * 
		 * This should be in [canonical form][canonical-parameter-names] to get the
		 * best performance.
		 */
		target_property: string;
		/**
		 * Retrieves the #GObject instance used as the source of the binding.
		 * 
		 * A #GBinding can outlive the source #GObject as the binding does not hold a
		 * strong reference to the source. If the source is destroyed before the
		 * binding then this function will return %NULL.
		 * @returns the source #GObject, or %NULL if the
		 *     source does not exist any more.
		 */
		dup_source(): Object | null;
		/**
		 * Retrieves the #GObject instance used as the target of the binding.
		 * 
		 * A #GBinding can outlive the target #GObject as the binding does not hold a
		 * strong reference to the target. If the target is destroyed before the
		 * binding then this function will return %NULL.
		 * @returns the target #GObject, or %NULL if the
		 *     target does not exist any more.
		 */
		dup_target(): Object | null;
		/**
		 * Retrieves the flags passed when constructing the #GBinding.
		 * @returns the #GBindingFlags used by the #GBinding
		 */
		get_flags(): BindingFlags;
		/**
		 * @deprecated
		 * Use {@link G.binding_dup_source} for a safer version of this
		 * function.
		 * 
		 * Retrieves the #GObject instance used as the source of the binding.
		 * 
		 * A #GBinding can outlive the source #GObject as the binding does not hold a
		 * strong reference to the source. If the source is destroyed before the
		 * binding then this function will return %NULL.
		 * 
		 * Use {@link G.binding_dup_source} if the source or binding are used from different
		 * threads as otherwise the pointer returned from this function might become
		 * invalid if the source is finalized from another thread in the meantime.
		 * @returns the source #GObject, or %NULL if the
		 *     source does not exist any more.
		 */
		get_source(): Object | null;
		/**
		 * Retrieves the name of the property of #GBinding:source used as the source
		 * of the binding.
		 * @returns the name of the source property
		 */
		get_source_property(): string;
		/**
		 * @deprecated
		 * Use {@link G.binding_dup_target} for a safer version of this
		 * function.
		 * 
		 * Retrieves the #GObject instance used as the target of the binding.
		 * 
		 * A #GBinding can outlive the target #GObject as the binding does not hold a
		 * strong reference to the target. If the target is destroyed before the
		 * binding then this function will return %NULL.
		 * 
		 * Use {@link G.binding_dup_target} if the target or binding are used from different
		 * threads as otherwise the pointer returned from this function might become
		 * invalid if the target is finalized from another thread in the meantime.
		 * @returns the target #GObject, or %NULL if the
		 *     target does not exist any more.
		 */
		get_target(): Object | null;
		/**
		 * Retrieves the name of the property of #GBinding:target used as the target
		 * of the binding.
		 * @returns the name of the target property
		 */
		get_target_property(): string;
		/**
		 * Explicitly releases the binding between the source and the target
		 * property expressed by #binding.
		 * 
		 * This function will release the reference that is being held on
		 * the #binding instance if the binding is still bound; if you want to hold on
		 * to the #GBinding instance after calling {@link G.binding_unbind}, you will need
		 * to hold a reference to it.
		 * 
		 * Note however that this function does not take ownership of #binding, it
		 * only unrefs the reference that was initially created by
		 * g_object_bind_property() and is owned by the binding.
		 */
		unbind(): void;
		connect(signal: "notify::flags", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::source", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::source-property", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::target", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::target-property", callback: (owner: this, ...args: any) => void): number;

	}

	type BindingInitOptionsMixin = ObjectInitOptions & 
	Pick<IBinding,
		"flags" |
		"source" |
		"source_property" |
		"target" |
		"target_property">;

	export interface BindingInitOptions extends BindingInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Binding} instead.
	 */
	type BindingMixin = IBinding & Object;

	/**
	 * #GBinding is the representation of a binding between a property on a
	 * #GObject instance (or source) and another property on another #GObject
	 * instance (or target).
	 * 
	 * Whenever the source property changes, the same value is applied to the
	 * target property; for instance, the following binding:
	 * 
	 * |[<!-- language="C" -->
	 *   g_object_bind_property (object1, "property-a",
	 *                           object2, "property-b",
	 *                           G_BINDING_DEFAULT);
	 * ]|
	 * 
	 * will cause the property named "property-b" of #object2 to be updated
	 * every time {@link GObject.set} or the specific accessor changes the value of
	 * the property "property-a" of #object1.
	 * 
	 * It is possible to create a bidirectional binding between two properties
	 * of two #GObject instances, so that if either property changes, the
	 * other is updated as well, for instance:
	 * 
	 * |[<!-- language="C" -->
	 *   g_object_bind_property (object1, "property-a",
	 *                           object2, "property-b",
	 *                           G_BINDING_BIDIRECTIONAL);
	 * ]|
	 * 
	 * will keep the two properties in sync.
	 * 
	 * It is also possible to set a custom transformation function (in both
	 * directions, in case of a bidirectional binding) to apply a custom
	 * transformation from the source value to the target value before
	 * applying it; for instance, the following binding:
	 * 
	 * |[<!-- language="C" -->
	 *   g_object_bind_property_full (adjustment1, "value",
	 *                                adjustment2, "value",
	 *                                G_BINDING_BIDIRECTIONAL,
	 *                                celsius_to_fahrenheit,
	 *                                fahrenheit_to_celsius,
	 *                                NULL, NULL);
	 * ]|
	 * 
	 * will keep the "value" property of the two adjustments in sync; the
	 * #celsius_to_fahrenheit function will be called whenever the "value"
	 * property of #adjustment1 changes and will transform the current value
	 * of the property before applying it to the "value" property of #adjustment2.
	 * 
	 * Vice versa, the #fahrenheit_to_celsius function will be called whenever
	 * the "value" property of #adjustment2 changes, and will transform the
	 * current value of the property before applying it to the "value" property
	 * of #adjustment1.
	 * 
	 * Note that #GBinding does not resolve cycles by itself; a cycle like
	 * 
	 * |[
	 *   object1:propertyA -> object2:propertyB
	 *   object2:propertyB -> object3:propertyC
	 *   object3:propertyC -> object1:propertyA
	 * ]|
	 * 
	 * might lead to an infinite loop. The loop, in this particular case,
	 * can be avoided if the objects emit the #GObject::notify signal only
	 * if the value has effectively been changed. A binding is implemented
	 * using the #GObject::notify signal, so it is susceptible to all the
	 * various ways of blocking a signal emission, like g_signal_stop_emission()
	 * or g_signal_handler_block().
	 * 
	 * A binding will be severed, and the resources it allocates freed, whenever
	 * either one of the #GObject instances it refers to are finalized, or when
	 * the #GBinding instance loses its last reference.
	 * 
	 * Bindings for languages with garbage collection can use
	 * g_binding_unbind() to explicitly release a binding between the source
	 * and target properties, instead of relying on the last reference on the
	 * binding, source, and target instances to drop.
	 * 
	 * #GBinding is available since GObject 2.26
	 */
	interface Binding extends BindingMixin {}

	class Binding {
		public constructor(options?: Partial<BindingInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link InitiallyUnowned} instead.
	 */
	interface IInitiallyUnowned {

	}

	type InitiallyUnownedInitOptionsMixin = ObjectInitOptions
	export interface InitiallyUnownedInitOptions extends InitiallyUnownedInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link InitiallyUnowned} instead.
	 */
	type InitiallyUnownedMixin = IInitiallyUnowned & Object;

	/**
	 * A type for objects that have an initially floating reference.
	 * 
	 * All the fields in the `GInitiallyUnowned` structure are private to the
	 * implementation and should never be accessed directly.
	 */
	interface InitiallyUnowned extends InitiallyUnownedMixin {}

	class InitiallyUnowned {
		public constructor(options?: Partial<InitiallyUnownedInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Object} instead.
	 */
	interface IObject {
		/**
		 * Increases the reference count of the object by one and sets a
		 * callback to be called when all other references to the object are
		 * dropped, or when this is already the last reference to the object
		 * and another reference is established.
		 * 
		 * This functionality is intended for binding #object to a proxy
		 * object managed by another memory manager. This is done with two
		 * paired references: the strong reference added by
		 * {@link GObject.add_toggle_ref} and a reverse reference to the proxy
		 * object which is either a strong reference or weak reference.
		 * 
		 * The setup is that when there are no other references to #object,
		 * only a weak reference is held in the reverse direction from #object
		 * to the proxy object, but when there are other references held to
		 * #object, a strong reference is held. The #notify callback is called
		 * when the reference from #object to the proxy object should be
		 * "toggled" from strong to weak (#is_last_ref true) or weak to strong
		 * (#is_last_ref false).
		 * 
		 * Since a (normal) reference must be held to the object before
		 * calling g_object_add_toggle_ref(), the initial state of the reverse
		 * link is always strong.
		 * 
		 * Multiple toggle references may be added to the same gobject,
		 * however if there are multiple toggle references to an object, none
		 * of them will ever be notified until all but one are removed.  For
		 * this reason, you should only ever use a toggle reference if there
		 * is important state in the proxy object.
		 * @param notify a function to call when this reference is the
		 *  last reference to the object, or is no longer
		 *  the last reference.
		 * @param data data to pass to #notify
		 */
		add_toggle_ref(notify: ToggleNotify, data: any | null): void;
		/**
		 * Adds a weak reference from weak_pointer to #object to indicate that
		 * the pointer located at #weak_pointer_location is only valid during
		 * the lifetime of #object. When the #object is finalized,
		 * #weak_pointer will be set to %NULL.
		 * 
		 * Note that as with g_object_weak_ref(), the weak references created by
		 * this method are not thread-safe: they cannot safely be used in one
		 * thread if the object's last g_object_unref() might happen in another
		 * thread. Use #GWeakRef if thread-safety is required.
		 */
		add_weak_pointer(): void;
		/**
		 * Creates a binding between #source_property on #source and #target_property
		 * on #target.
		 * 
		 * Whenever the #source_property is changed the #target_property is
		 * updated using the same value. For instance:
		 * 
		 * |[<!-- language="C" -->
		 *   g_object_bind_property (action, "active", widget, "sensitive", 0);
		 * ]|
		 * 
		 * Will result in the "sensitive" property of the widget #GObject instance to be
		 * updated with the same value of the "active" property of the action #GObject
		 * instance.
		 * 
		 * If #flags contains %G_BINDING_BIDIRECTIONAL then the binding will be mutual:
		 * if #target_property on #target changes then the #source_property on #source
		 * will be updated as well.
		 * 
		 * The binding will automatically be removed when either the #source or the
		 * #target instances are finalized. To remove the binding without affecting the
		 * #source and the #target you can just call {@link GObject.unref} on the returned
		 * #GBinding instance.
		 * 
		 * Removing the binding by calling g_object_unref() on it must only be done if
		 * the binding, #source and #target are only used from a single thread and it
		 * is clear that both #source and #target outlive the binding. Especially it
		 * is not safe to rely on this if the binding, #source or #target can be
		 * finalized from different threads. Keep another reference to the binding and
		 * use g_binding_unbind() instead to be on the safe side.
		 * 
		 * A #GObject can have multiple bindings.
		 * @param source_property the property on #source to bind
		 * @param target the target #GObject
		 * @param target_property the property on #target to bind
		 * @param flags flags to pass to #GBinding
		 * @returns the #GBinding instance representing the
		 *     binding between the two #GObject instances. The binding is released
		 *     whenever the #GBinding reference count reaches zero.
		 */
		bind_property(source_property: string, target: Object, target_property: string, flags: BindingFlags): Binding;
		/**
		 * Complete version of {@link GObject.bind_property}.
		 * 
		 * Creates a binding between #source_property on #source and #target_property
		 * on #target, allowing you to set the transformation functions to be used by
		 * the binding.
		 * 
		 * If #flags contains %G_BINDING_BIDIRECTIONAL then the binding will be mutual:
		 * if #target_property on #target changes then the #source_property on #source
		 * will be updated as well. The #transform_from function is only used in case
		 * of bidirectional bindings, otherwise it will be ignored
		 * 
		 * The binding will automatically be removed when either the #source or the
		 * #target instances are finalized. This will release the reference that is
		 * being held on the #GBinding instance; if you want to hold on to the
		 * #GBinding instance, you will need to hold a reference to it.
		 * 
		 * To remove the binding, call g_binding_unbind().
		 * 
		 * A #GObject can have multiple bindings.
		 * 
		 * The same #user_data parameter will be used for both #transform_to
		 * and #transform_from transformation functions; the #notify function will
		 * be called once, when the binding is removed. If you need different data
		 * for each transformation function, please use
		 * g_object_bind_property_with_closures() instead.
		 * @param source_property the property on #source to bind
		 * @param target the target #GObject
		 * @param target_property the property on #target to bind
		 * @param flags flags to pass to #GBinding
		 * @param transform_to the transformation function
		 *     from the #source to the #target, or %NULL to use the default
		 * @param transform_from the transformation function
		 *     from the #target to the #source, or %NULL to use the default
		 * @param notify a function to call when disposing the binding, to free
		 *     resources used by the transformation functions, or %NULL if not required
		 * @returns the #GBinding instance representing the
		 *     binding between the two #GObject instances. The binding is released
		 *     whenever the #GBinding reference count reaches zero.
		 */
		bind_property_full(source_property: string, target: Object, target_property: string, flags: BindingFlags, transform_to: BindingTransformFunc | null, transform_from: BindingTransformFunc | null, notify: GLib.DestroyNotify | null): Binding;
		/**
		 * Creates a binding between #source_property on #source and #target_property
		 * on #target, allowing you to set the transformation functions to be used by
		 * the binding.
		 * 
		 * This function is the language bindings friendly version of
		 * {@link GObject.bind_property_full}, using #GClosures instead of
		 * function pointers.
		 * @param source_property the property on #source to bind
		 * @param target the target #GObject
		 * @param target_property the property on #target to bind
		 * @param flags flags to pass to #GBinding
		 * @param transform_to a #GClosure wrapping the transformation function
		 *     from the #source to the #target, or %NULL to use the default
		 * @param transform_from a #GClosure wrapping the transformation function
		 *     from the #target to the #source, or %NULL to use the default
		 * @returns the #GBinding instance representing the
		 *     binding between the two #GObject instances. The binding is released
		 *     whenever the #GBinding reference count reaches zero.
		 */
		bind_property_with_closures(source_property: string, target: Object, target_property: string, flags: BindingFlags, transform_to: Closure, transform_from: Closure): Binding;
		/**
		 * A convenience function to connect multiple signals at once.
		 * 
		 * The signal specs expected by this function have the form
		 * "modifier::signal_name", where modifier can be one of the following:
		 * - signal: equivalent to g_signal_connect_data (..., NULL, 0)
		 * - object-signal, object_signal: equivalent to g_signal_connect_object (..., 0)
		 * - swapped-signal, swapped_signal: equivalent to g_signal_connect_data (..., NULL, G_CONNECT_SWAPPED)
		 * - swapped_object_signal, swapped-object-signal: equivalent to g_signal_connect_object (..., G_CONNECT_SWAPPED)
		 * - signal_after, signal-after: equivalent to g_signal_connect_data (..., NULL, G_CONNECT_AFTER)
		 * - object_signal_after, object-signal-after: equivalent to g_signal_connect_object (..., G_CONNECT_AFTER)
		 * - swapped_signal_after, swapped-signal-after: equivalent to g_signal_connect_data (..., NULL, G_CONNECT_SWAPPED | G_CONNECT_AFTER)
		 * - swapped_object_signal_after, swapped-object-signal-after: equivalent to g_signal_connect_object (..., G_CONNECT_SWAPPED | G_CONNECT_AFTER)
		 * 
		 * |[<!-- language="C" -->
		 *   menu->toplevel = g_object_connect (g_object_new (GTK_TYPE_WINDOW,
		 * 						   "type", GTK_WINDOW_POPUP,
		 * 						   "child", menu,
		 * 						   NULL),
		 * 				     "signal::event", gtk_menu_window_event, menu,
		 * 				     "signal::size_request", gtk_menu_window_size_request, menu,
		 * 				     "signal::destroy", gtk_widget_destroyed, &menu->toplevel,
		 * 				     NULL);
		 * ]|
		 * @param signal_spec the spec for the first signal
		 * @returns #object
		 */
		connect(signal_spec: string): Object;
		/**
		 * A convenience function to disconnect multiple signals at once.
		 * 
		 * The signal specs expected by this function have the form
		 * "any_signal", which means to disconnect any signal with matching
		 * callback and data, or "any_signal::signal_name", which only
		 * disconnects the signal named "signal_name".
		 * @param id returned ID of the connect function
		 */
		disconnect(id: number): void;
		/**
		 * This is a variant of {@link GObject.get_data} which returns
		 * a 'duplicate' of the value. #dup_func defines the
		 * meaning of 'duplicate' in this context, it could e.g.
		 * take a reference on a ref-counted object.
		 * 
		 * If the #key is not set on the object then #dup_func
		 * will be called with a %NULL argument.
		 * 
		 * Note that #dup_func is called while user data of #object
		 * is locked.
		 * 
		 * This function can be useful to avoid races when multiple
		 * threads are using object data on the same key on the same
		 * object.
		 * @param key a string, naming the user data pointer
		 * @param dup_func function to dup the value
		 * @returns the result of calling #dup_func on the value
		 *     associated with #key on #object, or %NULL if not set.
		 *     If #dup_func is %NULL, the value is returned
		 *     unmodified.
		 */
		dup_data(key: string, dup_func: GLib.DuplicateFunc | null): any | null;
		/**
		 * This is a variant of {@link GObject.get_qdata} which returns
		 * a 'duplicate' of the value. #dup_func defines the
		 * meaning of 'duplicate' in this context, it could e.g.
		 * take a reference on a ref-counted object.
		 * 
		 * If the #quark is not set on the object then #dup_func
		 * will be called with a %NULL argument.
		 * 
		 * Note that #dup_func is called while user data of #object
		 * is locked.
		 * 
		 * This function can be useful to avoid races when multiple
		 * threads are using object data on the same key on the same
		 * object.
		 * @param quark a #GQuark, naming the user data pointer
		 * @param dup_func function to dup the value
		 * @returns the result of calling #dup_func on the value
		 *     associated with #quark on #object, or %NULL if not set.
		 *     If #dup_func is %NULL, the value is returned
		 *     unmodified.
		 */
		dup_qdata(quark: GLib.Quark, dup_func: GLib.DuplicateFunc | null): any | null;
		/**
		 * This function is intended for #GObject implementations to re-enforce
		 * a [floating][floating-ref] object reference. Doing this is seldom
		 * required: all #GInitiallyUnowneds are created with a floating reference
		 * which usually just needs to be sunken by calling {@link GObject.ref_sink}.
		 */
		force_floating(): void;
		/**
		 * Increases the freeze count on #object. If the freeze count is
		 * non-zero, the emission of "notify" signals on #object is
		 * stopped. The signals are queued until the freeze count is decreased
		 * to zero. Duplicate notifications are squashed so that at most one
		 * {@link .notify} signal is emitted for each property modified while the
		 * object is frozen.
		 * 
		 * This is necessary for accessors that modify multiple properties to prevent
		 * premature notification while the object is still being modified.
		 */
		freeze_notify(): void;
		/**
		 * Gets properties of an object.
		 * 
		 * In general, a copy is made of the property contents and the caller
		 * is responsible for freeing the memory in the appropriate manner for
		 * the type, for instance by calling {@link G.free} or g_object_unref().
		 * 
		 * Here is an example of using g_object_get() to get the contents
		 * of three properties: an integer, a string and an object:
		 * |[<!-- language="C" -->
		 *  gint intval;
		 *  guint64 uint64val;
		 *  gchar *strval;
		 *  GObject *objval;
		 * 
		 *  g_object_get (my_object,
		 *                "int-property", &intval,
		 *                "uint64-property", &uint64val,
		 *                "str-property", &strval,
		 *                "obj-property", &objval,
		 *                NULL);
		 * 
		 *  // Do something with intval, uint64val, strval, objval
		 * 
		 *  g_free (strval);
		 *  g_object_unref (objval);
		 * ]|
		 * @param first_property_name name of the first property to get
		 */
		// get(first_property_name: string): void;
		/**
		 * Gets a named field from the objects table of associations (see {@link GObject.set_data}).
		 * @param key name of the key for that association
		 * @returns the data if found,
		 *          or %NULL if no such data exists.
		 */
		get_data(key: string): any | null;
		/**
		 * Gets a property of an object.
		 * 
		 * The #value can be:
		 * 
		 *  - an empty #GValue initialized by %G_VALUE_INIT, which will be
		 *    automatically initialized with the expected type of the property
		 *    (since GLib 2.60)
		 *  - a #GValue initialized with the expected type of the property
		 *  - a #GValue initialized with a type to which the expected type
		 *    of the property can be transformed
		 * 
		 * In general, a copy is made of the property contents and the caller is
		 * responsible for freeing the memory by calling {@link G.value_unset}.
		 * 
		 * Note that g_object_get_property() is really intended for language
		 * bindings, g_object_get() is much more convenient for C programming.
		 * @param property_name the name of the property to get
		 * @param value return location for the property value
		 */
		// get_property(property_name: string, value: Value): void;
		/**
		 * This function gets back user data pointers stored via
		 * {@link GObject.set_qdata}.
		 * @param quark A #GQuark, naming the user data pointer
		 * @returns The user data pointer set, or %NULL
		 */
		get_qdata(quark: GLib.Quark): any | null;
		/**
		 * Gets properties of an object.
		 * 
		 * In general, a copy is made of the property contents and the caller
		 * is responsible for freeing the memory in the appropriate manner for
		 * the type, for instance by calling {@link G.free} or g_object_unref().
		 * 
		 * See g_object_get().
		 * @param first_property_name name of the first property to get
		 * @param var_args return location for the first property, followed optionally by more
		 *  name/return location pairs, followed by %NULL
		 */
		// get_valist(first_property_name: string, var_args: any[]): void;
		/**
		 * Gets #n_properties properties for an #object.
		 * Obtained properties will be set to #values. All properties must be valid.
		 * Warnings will be emitted and undefined behaviour may result if invalid
		 * properties are passed in.
		 * @param n_properties the number of properties
		 * @param names the names of each property to get
		 * @param values the values of each property to get
		 */
		getv(n_properties: number, names: string[], values: Value[]): void;
		/**
		 * Checks whether #object has a [floating][floating-ref] reference.
		 * @returns %TRUE if #object has a floating reference
		 */
		is_floating(): boolean;
		/**
		 * Emits a "notify" signal for the property #property_name on #object.
		 * 
		 * When possible, eg. when signaling a property change from within the class
		 * that registered the property, you should use {@link GObject.notify_by_pspec}
		 * instead.
		 * 
		 * Note that emission of the notify signal may be blocked with
		 * g_object_freeze_notify(). In this case, the signal emissions are queued
		 * and will be emitted (in reverse order) when g_object_thaw_notify() is
		 * called.
		 * @param property_name the name of a property installed on the class of #object.
		 */
		notify(property_name: string): void;
		/**
		 * Emits a "notify" signal for the property specified by #pspec on #object.
		 * 
		 * This function omits the property name lookup, hence it is faster than
		 * {@link GObject.notify}.
		 * 
		 * One way to avoid using g_object_notify() from within the
		 * class that registered the properties, and using g_object_notify_by_pspec()
		 * instead, is to store the GParamSpec used with
		 * g_object_class_install_property() inside a static array, e.g.:
		 * 
		 * |[<!-- language="C" -->
		 *   enum
		 *   {
		 *     PROP_0,
		 *     PROP_FOO,
		 *     PROP_LAST
		 *   };
		 * 
		 *   static GParamSpec *properties[PROP_LAST];
		 * 
		 *   static void
		 *   my_object_class_init (MyObjectClass *klass)
		 *   {
		 *     properties[PROP_FOO] = g_param_spec_int ("foo", "Foo", "The foo",
		 *                                              0, 100,
		 *                                              50,
		 *                                              G_PARAM_READWRITE);
		 *     g_object_class_install_property (gobject_class,
		 *                                      PROP_FOO,
		 *                                      properties[PROP_FOO]);
		 *   }
		 * ]|
		 * 
		 * and then notify a change on the "foo" property with:
		 * 
		 * |[<!-- language="C" -->
		 *   g_object_notify_by_pspec (self, properties[PROP_FOO]);
		 * ]|
		 * @param pspec the #GParamSpec of a property installed on the class of #object.
		 */
		notify_by_pspec(pspec: ParamSpec): void;
		/**
		 * Increases the reference count of #object.
		 * 
		 * Since GLib 2.56, if `GLIB_VERSION_MAX_ALLOWED` is 2.56 or greater, the type
		 * of #object will be propagated to the return type (using the GCC typeof()
		 * extension), so any casting the caller needs to do on the return type must be
		 * explicit.
		 * @returns the same #object
		 */
		ref(): Object;
		/**
		 * Increase the reference count of #object, and possibly remove the
		 * [floating][floating-ref] reference, if #object has a floating reference.
		 * 
		 * In other words, if the object is floating, then this call "assumes
		 * ownership" of the floating reference, converting it to a normal
		 * reference by clearing the floating flag while leaving the reference
		 * count unchanged.  If the object is not floating, then this call
		 * adds a new normal reference increasing the reference count by one.
		 * 
		 * Since GLib 2.56, the type of #object will be propagated to the return type
		 * under the same conditions as for {@link GObject.ref}.
		 * @returns #object
		 */
		ref_sink(): Object;
		/**
		 * Removes a reference added with {@link GObject.add_toggle_ref}. The
		 * reference count of the object is decreased by one.
		 * @param notify a function to call when this reference is the
		 *  last reference to the object, or is no longer
		 *  the last reference.
		 * @param data data to pass to #notify, or %NULL to
		 *  match any toggle refs with the #notify argument.
		 */
		remove_toggle_ref(notify: ToggleNotify, data: any | null): void;
		/**
		 * Removes a weak reference from #object that was previously added
		 * using {@link GObject.add_weak_pointer}. The #weak_pointer_location has
		 * to match the one used with g_object_add_weak_pointer().
		 */
		remove_weak_pointer(): void;
		/**
		 * Compares the user data for the key #key on #object with
		 * #oldval, and if they are the same, replaces #oldval with
		 * #newval.
		 * 
		 * This is like a typical atomic compare-and-exchange
		 * operation, for user data on an object.
		 * 
		 * If the previous value was replaced then ownership of the
		 * old value (#oldval) is passed to the caller, including
		 * the registered destroy notify for it (passed out in #old_destroy).
		 * It’s up to the caller to free this as needed, which may
		 * or may not include using #old_destroy as sometimes replacement
		 * should not destroy the object in the normal way.
		 * 
		 * See {@link GObject.set_data} for guidance on using a small, bounded set of values
		 * for #key.
		 * @param key a string, naming the user data pointer
		 * @param oldval the old value to compare against
		 * @param newval the new value
		 * @param destroy a destroy notify for the new value
		 * @returns %TRUE if the existing value for #key was replaced
		 *  by #newval, %FALSE otherwise.
		 * 
		 * destroy notify for the existing value
		 */
		replace_data(key: string, oldval: any | null, newval: any | null, destroy: GLib.DestroyNotify | null): [ boolean, GLib.DestroyNotify | null ];
		/**
		 * Compares the user data for the key #quark on #object with
		 * #oldval, and if they are the same, replaces #oldval with
		 * #newval.
		 * 
		 * This is like a typical atomic compare-and-exchange
		 * operation, for user data on an object.
		 * 
		 * If the previous value was replaced then ownership of the
		 * old value (#oldval) is passed to the caller, including
		 * the registered destroy notify for it (passed out in #old_destroy).
		 * It’s up to the caller to free this as needed, which may
		 * or may not include using #old_destroy as sometimes replacement
		 * should not destroy the object in the normal way.
		 * @param quark a #GQuark, naming the user data pointer
		 * @param oldval the old value to compare against
		 * @param newval the new value
		 * @param destroy a destroy notify for the new value
		 * @returns %TRUE if the existing value for #quark was replaced
		 *  by #newval, %FALSE otherwise.
		 * 
		 * destroy notify for the existing value
		 */
		replace_qdata(quark: GLib.Quark, oldval: any | null, newval: any | null, destroy: GLib.DestroyNotify | null): [ boolean, GLib.DestroyNotify | null ];
		/**
		 * Releases all references to other objects. This can be used to break
		 * reference cycles.
		 * 
		 * This function should only be called from object system implementations.
		 */
		run_dispose(): void;
		/**
		 * Sets properties on an object.
		 * 
		 * The same caveats about passing integer literals as varargs apply as with
		 * {@link GObject.new}. In particular, any integer literals set as the values for
		 * properties of type #gint64 or #guint64 must be 64 bits wide, using the
		 * %G_GINT64_CONSTANT or %G_GUINT64_CONSTANT macros.
		 * 
		 * Note that the "notify" signals are queued and only emitted (in
		 * reverse order) after all properties have been set. See
		 * g_object_freeze_notify().
		 * @param first_property_name name of the first property to set
		 */
		// set(first_property_name: string): void;
		/**
		 * Each object carries around a table of associations from
		 * strings to pointers.  This function lets you set an association.
		 * 
		 * If the object already had an association with that name,
		 * the old association will be destroyed.
		 * 
		 * Internally, the #key is converted to a #GQuark using {@link G.quark_from_string}.
		 * This means a copy of #key is kept permanently (even after #object has been
		 * finalized) — so it is recommended to only use a small, bounded set of values
		 * for #key in your program, to avoid the #GQuark storage growing unbounded.
		 * @param key name of the key
		 * @param data data to associate with that key
		 */
		set_data(key: string, data: any | null): void;
		/**
		 * Like {@link GObject.set_data} except it adds notification
		 * for when the association is destroyed, either by setting it
		 * to a different value or when the object is destroyed.
		 * 
		 * Note that the #destroy callback is not called if #data is %NULL.
		 * @param key name of the key
		 * @param data data to associate with that key
		 * @param destroy function to call when the association is destroyed
		 */
		set_data_full(key: string, data: any | null, destroy: GLib.DestroyNotify | null): void;
		/**
		 * Sets a property on an object.
		 * @param property_name the name of the property to set
		 * @param value the value
		 */
		// set_property(property_name: string, value: Value): void;
		/**
		 * This sets an opaque, named pointer on an object.
		 * The name is specified through a #GQuark (retrieved e.g. via
		 * {@link G.quark_from_static_string}), and the pointer
		 * can be gotten back from the #object with g_object_get_qdata()
		 * until the #object is finalized.
		 * Setting a previously set user data pointer, overrides (frees)
		 * the old pointer set, using #NULL as pointer essentially
		 * removes the data stored.
		 * @param quark A #GQuark, naming the user data pointer
		 * @param data An opaque user data pointer
		 */
		set_qdata(quark: GLib.Quark, data: any | null): void;
		/**
		 * This function works like {@link GObject.set_qdata}, but in addition,
		 * a void (*destroy) (gpointer) function may be specified which is
		 * called with #data as argument when the #object is finalized, or
		 * the data is being overwritten by a call to g_object_set_qdata()
		 * with the same #quark.
		 * @param quark A #GQuark, naming the user data pointer
		 * @param data An opaque user data pointer
		 * @param destroy Function to invoke with #data as argument, when #data
		 *           needs to be freed
		 */
		set_qdata_full(quark: GLib.Quark, data: any | null, destroy: GLib.DestroyNotify | null): void;
		/**
		 * Sets properties on an object.
		 * @param first_property_name name of the first property to set
		 * @param var_args value for the first property, followed optionally by more
		 *  name/value pairs, followed by %NULL
		 */
		// set_valist(first_property_name: string, var_args: any[]): void;
		/**
		 * Sets #n_properties properties for an #object.
		 * Properties to be set will be taken from #values. All properties must be
		 * valid. Warnings will be emitted and undefined behaviour may result if invalid
		 * properties are passed in.
		 * @param n_properties the number of properties
		 * @param names the names of each property to be set
		 * @param values the values of each property to be set
		 */
		setv(n_properties: number, names: string[], values: Value[]): void;
		/**
		 * Remove a specified datum from the object's data associations,
		 * without invoking the association's destroy handler.
		 * @param key name of the key
		 * @returns the data if found, or %NULL
		 *          if no such data exists.
		 */
		steal_data(key: string): any | null;
		/**
		 * This function gets back user data pointers stored via
		 * {@link GObject.set_qdata} and removes the #data from object
		 * without invoking its destroy() function (if any was
		 * set).
		 * Usually, calling this function is only required to update
		 * user data pointers with a destroy notifier, for example:
		 * |[<!-- language="C" -->
		 * void
		 * object_add_to_user_list (GObject     *object,
		 *                          const gchar *new_string)
		 * {
		 *   // the quark, naming the object data
		 *   GQuark quark_string_list = g_quark_from_static_string ("my-string-list");
		 *   // retrieve the old string list
		 *   GList *list = g_object_steal_qdata (object, quark_string_list);
		 * 
		 *   // prepend new string
		 *   list = g_list_prepend (list, g_strdup (new_string));
		 *   // this changed 'list', so we need to set it again
		 *   g_object_set_qdata_full (object, quark_string_list, list, free_string_list);
		 * }
		 * static void
		 * free_string_list (gpointer data)
		 * {
		 *   GList *node, *list = data;
		 * 
		 *   for (node = list; node; node = node->next)
		 *     g_free (node->data);
		 *   g_list_free (list);
		 * }
		 * ]|
		 * Using g_object_get_qdata() in the above example, instead of
		 * g_object_steal_qdata() would have left the destroy function set,
		 * and thus the partial string list would have been freed upon
		 * g_object_set_qdata_full().
		 * @param quark A #GQuark, naming the user data pointer
		 * @returns The user data pointer set, or %NULL
		 */
		steal_qdata(quark: GLib.Quark): any | null;
		/**
		 * If #object is floating, sink it.  Otherwise, do nothing.
		 * 
		 * In other words, this function will convert a floating reference (if
		 * present) into a full reference.
		 * 
		 * Typically you want to use {@link GObject.ref_sink} in order to
		 * automatically do the correct thing with respect to floating or
		 * non-floating references, but there is one specific scenario where
		 * this function is helpful.
		 * 
		 * The situation where this function is helpful is when creating an API
		 * that allows the user to provide a callback function that returns a
		 * GObject. We certainly want to allow the user the flexibility to
		 * return a non-floating reference from this callback (for the case
		 * where the object that is being returned already exists).
		 * 
		 * At the same time, the API style of some popular GObject-based
		 * libraries (such as Gtk) make it likely that for newly-created GObject
		 * instances, the user can be saved some typing if they are allowed to
		 * return a floating reference.
		 * 
		 * Using this function on the return value of the user's callback allows
		 * the user to do whichever is more convenient for them. The caller will
		 * alway receives exactly one full reference to the value: either the
		 * one that was returned in the first place, or a floating reference
		 * that has been converted to a full reference.
		 * 
		 * This function has an odd interaction when combined with
		 * g_object_ref_sink() running at the same time in another thread on
		 * the same #GObject instance. If g_object_ref_sink() runs first then
		 * the result will be that the floating reference is converted to a hard
		 * reference. If g_object_take_ref() runs first then the result will be
		 * that the floating reference is converted to a hard reference and an
		 * additional reference on top of that one is added. It is best to avoid
		 * this situation.
		 * @returns #object
		 */
		take_ref(): Object;
		/**
		 * Reverts the effect of a previous call to
		 * {@link GObject.freeze_notify}. The freeze count is decreased on #object
		 * and when it reaches zero, queued "notify" signals are emitted.
		 * 
		 * Duplicate notifications for each property are squashed so that at most one
		 * {@link .notify} signal is emitted for each property, in the reverse order
		 * in which they have been queued.
		 * 
		 * It is an error to call this function when the freeze count is zero.
		 */
		thaw_notify(): void;
		/**
		 * Decreases the reference count of #object. When its reference count
		 * drops to 0, the object is finalized (i.e. its memory is freed).
		 * 
		 * If the pointer to the #GObject may be reused in future (for example, if it is
		 * an instance variable of another object), it is recommended to clear the
		 * pointer to %NULL rather than retain a dangling pointer to a potentially
		 * invalid #GObject instance. Use {@link G.clear_object} for this.
		 */
		unref(): void;
		/**
		 * This function essentially limits the life time of the #closure to
		 * the life time of the object. That is, when the object is finalized,
		 * the #closure is invalidated by calling {@link G.closure_invalidate} on
		 * it, in order to prevent invocations of the closure with a finalized
		 * (nonexisting) object. Also, g_object_ref() and g_object_unref() are
		 * added as marshal guards to the #closure, to ensure that an extra
		 * reference count is held on #object during invocation of the
		 * #closure.  Usually, this function will be called on closures that
		 * use this #object as closure data.
		 * @param closure #GClosure to watch
		 */
		watch_closure(closure: Closure): void;
		/**
		 * Adds a weak reference callback to an object. Weak references are
		 * used for notification when an object is disposed. They are called
		 * "weak references" because they allow you to safely hold a pointer
		 * to an object without calling {@link GObject.ref} (g_object_ref() adds a
		 * strong reference, that is, forces the object to stay alive).
		 * 
		 * Note that the weak references created by this method are not
		 * thread-safe: they cannot safely be used in one thread if the
		 * object's last g_object_unref() might happen in another thread.
		 * Use #GWeakRef if thread-safety is required.
		 * @param notify callback to invoke before the object is freed
		 * @param data extra data to pass to notify
		 */
		weak_ref(notify: WeakNotify, data: any | null): void;
		/**
		 * Removes a weak reference callback to an object.
		 * @param notify callback to search for
		 * @param data data to search for
		 */
		weak_unref(notify: WeakNotify, data: any | null): void;
		/**
		 * The notify signal is emitted on an object when one of its properties has
		 * its value set through {@link GObject.set_property}, g_object_set(), et al.
		 * 
		 * Note that getting this signal doesn’t itself guarantee that the value of
		 * the property has actually changed. When it is emitted is determined by the
		 * derived GObject class. If the implementor did not create the property with
		 * %G_PARAM_EXPLICIT_NOTIFY, then any call to g_object_set_property() results
		 * in ::notify being emitted, even if the new value is the same as the old.
		 * If they did pass %G_PARAM_EXPLICIT_NOTIFY, then this signal is emitted only
		 * when they explicitly call g_object_notify() or g_object_notify_by_pspec(),
		 * and common practice is to do that only when the value has actually changed.
		 * 
		 * This signal is typically used to obtain change notification for a
		 * single property, by specifying the property name as a detail in the
		 * g_signal_connect() call, like this:
		 * 
		 * |[<!-- language="C" -->
		 * g_signal_connect (text_view->buffer, "notify::paste-target-list",
		 *                   G_CALLBACK (gtk_text_view_target_list_notify),
		 *                   text_view)
		 * ]|
		 * 
		 * It is important to note that you must use
		 * [canonical parameter names][canonical-parameter-names] as
		 * detail strings for the notify signal.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - pspec: the #GParamSpec of the property which changed. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "notify", callback: (owner: this, pspec: ParamSpec) => void): number;

	}

	type ObjectInitOptionsMixin  = {};
	export interface ObjectInitOptions extends ObjectInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Object} instead.
	 */
	type ObjectMixin = IObject;

	/**
	 * The base object type.
	 * 
	 * All the fields in the `GObject` structure are private to the implementation
	 * and should never be accessed directly.
	 */
	interface Object extends ObjectMixin {}

	class Object {
		public constructor(options?: Partial<ObjectInitOptions>);
		/**
		 * Creates a new instance of a #GObject subtype and sets its properties.
		 * 
		 * Construction parameters (see #G_PARAM_CONSTRUCT, #G_PARAM_CONSTRUCT_ONLY)
		 * which are not explicitly specified are set to their default values. Any
		 * private data for the object is guaranteed to be initialized with zeros, as
		 * per {@link G.type_create_instance}.
		 * 
		 * Note that in C, small integer types in variable argument lists are promoted
		 * up to #gint or #guint as appropriate, and read back accordingly. #gint is 32
		 * bits on every platform on which GLib is currently supported. This means that
		 * you can use C expressions of type #gint with g_object_new() and properties of
		 * type #gint or #guint or smaller. Specifically, you can use integer literals
		 * with these property types.
		 * 
		 * When using property types of #gint64 or #guint64, you must ensure that the
		 * value that you provide is 64 bit. This means that you should use a cast or
		 * make use of the %G_GINT64_CONSTANT or %G_GUINT64_CONSTANT macros.
		 * 
		 * Similarly, #gfloat is promoted to #gdouble, so you must ensure that the value
		 * you provide is a #gdouble, even for a property of type #gfloat.
		 * @param object_type the type id of the #GObject subtype to instantiate
		 * @param first_property_name the name of the first property
		 * @returns a new instance of
		 *   #object_type
		 */
		public static new(object_type: GObject.Type, first_property_name: string): Object;
		/**
		 * Creates a new instance of a #GObject subtype and sets its properties.
		 * 
		 * Construction parameters (see #G_PARAM_CONSTRUCT, #G_PARAM_CONSTRUCT_ONLY)
		 * which are not explicitly specified are set to their default values.
		 * @param object_type the type id of the #GObject subtype to instantiate
		 * @param first_property_name the name of the first property
		 * @param var_args the value of the first property, followed optionally by more
		 *  name/value pairs, followed by %NULL
		 * @returns a new instance of #object_type
		 */
		public static new_valist(object_type: GObject.Type, first_property_name: string, var_args: any[]): Object;
		/**
		 * Creates a new instance of a #GObject subtype and sets its properties using
		 * the provided arrays. Both arrays must have exactly #n_properties elements,
		 * and the names and values correspond by index.
		 * 
		 * Construction parameters (see %G_PARAM_CONSTRUCT, %G_PARAM_CONSTRUCT_ONLY)
		 * which are not explicitly specified are set to their default values.
		 * @param object_type the object type to instantiate
		 * @param n_properties the number of properties
		 * @param names the names of each property to be set
		 * @param values the values of each property to be set
		 * @returns a new instance of
		 * #object_type
		 */
		public static new_with_properties(object_type: GObject.Type, n_properties: number, names: string[], values: Value[]): Object;
		/**
		 * @deprecated
		 * Use {@link GObject.new_with_properties} instead.
		 * deprecated. See #GParameter for more information.
		 * 
		 * Creates a new instance of a #GObject subtype and sets its properties.
		 * 
		 * Construction parameters (see #G_PARAM_CONSTRUCT, #G_PARAM_CONSTRUCT_ONLY)
		 * which are not explicitly specified are set to their default values.
		 * @param object_type the type id of the #GObject subtype to instantiate
		 * @param n_parameters the length of the #parameters array
		 * @param parameters an array of #GParameter
		 * @returns a new instance of
		 * #object_type
		 */
		public static newv(object_type: GObject.Type, n_parameters: number, parameters: Parameter[]): Object;
		public static compat_control(what: number, data: any | null): number;
		/**
		 * Find the #GParamSpec with the given name for an
		 * interface. Generally, the interface vtable passed in as #g_iface
		 * will be the default vtable from {@link G.type_default_interface_ref}, or,
		 * if you know the interface has already been loaded,
		 * g_type_default_interface_peek().
		 * @param g_iface any interface vtable for the
		 *  interface, or the default vtable for the interface
		 * @param property_name name of a property to look up.
		 * @returns the #GParamSpec for the property of the
		 *          interface with the name #property_name, or %NULL if no
		 *          such property exists.
		 */
		public static interface_find_property(g_iface: TypeInterface, property_name: string): ParamSpec;
		/**
		 * Add a property to an interface; this is only useful for interfaces
		 * that are added to GObject-derived types. Adding a property to an
		 * interface forces all objects classes with that interface to have a
		 * compatible property. The compatible property could be a newly
		 * created #GParamSpec, but normally
		 * {@link GObject.class_override_property} will be used so that the object
		 * class only needs to provide an implementation and inherits the
		 * property description, default value, bounds, and so forth from the
		 * interface property.
		 * 
		 * This function is meant to be called from the interface's default
		 * vtable initialization function (the #class_init member of
		 * #GTypeInfo.) It must not be called after after #class_init has
		 * been called for any object types implementing this interface.
		 * 
		 * If #pspec is a floating reference, it will be consumed.
		 * @param g_iface any interface vtable for the
		 *    interface, or the default
		 *  vtable for the interface.
		 * @param pspec the #GParamSpec for the new property
		 */
		public static interface_install_property(g_iface: TypeInterface, pspec: ParamSpec): void;
		/**
		 * Lists the properties of an interface.Generally, the interface
		 * vtable passed in as #g_iface will be the default vtable from
		 * {@link G.type_default_interface_ref}, or, if you know the interface has
		 * already been loaded, g_type_default_interface_peek().
		 * @param g_iface any interface vtable for the
		 *  interface, or the default vtable for the interface
		 * @returns a
		 *          pointer to an array of pointers to #GParamSpec
		 *          structures. The paramspecs are owned by GLib, but the
		 *          array should be freed with {@link G.free} when you are done with
		 *          it.
		 * 
		 * location to store number of properties returned.
		 */
		public static interface_list_properties(g_iface: TypeInterface): [ ParamSpec[], number ];
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpec} instead.
	 */
	interface IParamSpec {
		/**
		 * name of this parameter: always an interned string
		 */
		readonly name: string;
		/**
		 * #GParamFlags flags for this parameter
		 */
		readonly flags: ParamFlags;
		/**
		 * the #GValue type for this parameter
		 */
		readonly value_type: GObject.Type;
		/**
		 * #GType type that uses (introduces) this parameter
		 */
		readonly owner_type: GObject.Type;
		/**
		 * Get the short description of a #GParamSpec.
		 * @returns the short description of #pspec.
		 */
		get_blurb(): string | null;
		/**
		 * Gets the default value of #pspec as a pointer to a #GValue.
		 * 
		 * The #GValue will remain valid for the life of #pspec.
		 * @returns a pointer to a #GValue which must not be modified
		 */
		get_default_value(): Value;
		/**
		 * Get the name of a #GParamSpec.
		 * 
		 * The name is always an "interned" string (as per {@link G.intern_string}).
		 * This allows for pointer-value comparisons.
		 * @returns the name of #pspec.
		 */
		get_name(): string;
		/**
		 * Gets the GQuark for the name.
		 * @returns the GQuark for #pspec->name.
		 */
		get_name_quark(): GLib.Quark;
		/**
		 * Get the nickname of a #GParamSpec.
		 * @returns the nickname of #pspec.
		 */
		get_nick(): string;
		/**
		 * Gets back user data pointers stored via {@link G.param_spec_set_qdata}.
		 * @param quark a #GQuark, naming the user data pointer
		 * @returns the user data pointer set, or %NULL
		 */
		get_qdata(quark: GLib.Quark): any | null;
		/**
		 * If the paramspec redirects operations to another paramspec,
		 * returns that paramspec. Redirect is used typically for
		 * providing a new implementation of a property in a derived
		 * type while preserving all the properties from the parent
		 * type. Redirection is established by creating a property
		 * of type #GParamSpecOverride. See {@link GObject.class_override_property}
		 * for an example of the use of this capability.
		 * @returns paramspec to which requests on this
		 *          paramspec should be redirected, or %NULL if none.
		 */
		get_redirect_target(): ParamSpec | null;
		/**
		 * Increments the reference count of #pspec.
		 * @returns the #GParamSpec that was passed into this function
		 */
		ref(): ParamSpec;
		/**
		 * Convenience function to ref and sink a #GParamSpec.
		 * @returns the #GParamSpec that was passed into this function
		 */
		ref_sink(): ParamSpec;
		/**
		 * Sets an opaque, named pointer on a #GParamSpec. The name is
		 * specified through a #GQuark (retrieved e.g. via
		 * {@link G.quark_from_static_string}), and the pointer can be gotten back
		 * from the #pspec with g_param_spec_get_qdata().  Setting a
		 * previously set user data pointer, overrides (frees) the old pointer
		 * set, using %NULL as pointer essentially removes the data stored.
		 * @param quark a #GQuark, naming the user data pointer
		 * @param data an opaque user data pointer
		 */
		set_qdata(quark: GLib.Quark, data: any | null): void;
		/**
		 * This function works like {@link G.param_spec_set_qdata}, but in addition,
		 * a `void (*destroy) (gpointer)` function may be
		 * specified which is called with #data as argument when the #pspec is
		 * finalized, or the data is being overwritten by a call to
		 * g_param_spec_set_qdata() with the same #quark.
		 * @param quark a #GQuark, naming the user data pointer
		 * @param data an opaque user data pointer
		 * @param destroy function to invoke with #data as argument, when #data needs to
		 *  be freed
		 */
		set_qdata_full(quark: GLib.Quark, data: any | null, destroy: GLib.DestroyNotify | null): void;
		/**
		 * The initial reference count of a newly created #GParamSpec is 1,
		 * even though no one has explicitly called {@link G.param_spec_ref} on it
		 * yet. So the initial reference count is flagged as "floating", until
		 * someone calls `g_param_spec_ref (pspec); g_param_spec_sink
		 * (pspec);` in sequence on it, taking over the initial
		 * reference count (thus ending up with a #pspec that has a reference
		 * count of 1 still, but is not flagged "floating" anymore).
		 */
		sink(): void;
		/**
		 * Gets back user data pointers stored via {@link G.param_spec_set_qdata}
		 * and removes the #data from #pspec without invoking its destroy()
		 * function (if any was set).  Usually, calling this function is only
		 * required to update user data pointers with a destroy notifier.
		 * @param quark a #GQuark, naming the user data pointer
		 * @returns the user data pointer set, or %NULL
		 */
		steal_qdata(quark: GLib.Quark): any | null;
		/**
		 * Decrements the reference count of a #pspec.
		 */
		unref(): void;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::flags", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::value_type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::owner_type", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecInitOptionsMixin  = {};
	export interface ParamSpecInitOptions extends ParamSpecInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpec} instead.
	 */
	type ParamSpecMixin = IParamSpec;

	/**
	 * #GParamSpec is an object structure that encapsulates the metadata
	 * required to specify parameters, such as e.g. #GObject properties.
	 * 
	 * ## Parameter names # {#canonical-parameter-names}
	 * 
	 * A property name consists of one or more segments consisting of ASCII letters
	 * and digits, separated by either the `-` or `_` character. The first
	 * character of a property name must be a letter. These are the same rules as
	 * for signal naming (see {@link G.signal_new}).
	 * 
	 * When creating and looking up a #GParamSpec, either separator can be
	 * used, but they cannot be mixed. Using `-` is considerably more
	 * efficient, and is the ‘canonical form’. Using `_` is discouraged.
	 */
	interface ParamSpec extends ParamSpecMixin {}

	class ParamSpec {
		public constructor(options?: Partial<ParamSpecInitOptions>);
		/**
		 * Creates a new #GParamSpec instance.
		 * 
		 * See [canonical parameter names][canonical-parameter-names] for details of
		 * the rules for #name. Names which violate these rules lead to undefined
		 * behaviour.
		 * 
		 * Beyond the name, #GParamSpecs have two more descriptive
		 * strings associated with them, the #nick, which should be suitable
		 * for use as a label for the property in a property editor, and the
		 * #blurb, which should be a somewhat longer description, suitable for
		 * e.g. a tooltip. The #nick and #blurb should ideally be localized.
		 * @param param_type the #GType for the property; must be derived from #G_TYPE_PARAM
		 * @param name the canonical name of the property
		 * @param nick the nickname of the property
		 * @param blurb a short description of the property
		 * @param flags a combination of #GParamFlags
		 * @returns (transfer floating): a newly allocated
		 *     #GParamSpec instance, which is initially floating
		 */
		public static internal(param_type: GObject.Type, name: string, nick: string, blurb: string, flags: ParamFlags): ParamSpec;
		/**
		 * Validate a property name for a #GParamSpec. This can be useful for
		 * dynamically-generated properties which need to be validated at run-time
		 * before actually trying to create them.
		 * 
		 * See [canonical parameter names][canonical-parameter-names] for details of
		 * the rules for valid names.
		 * @param name the canonical name of the property
		 * @returns %TRUE if #name is a valid property name, %FALSE otherwise.
		 */
		public static is_valid_name(name: string): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecBoolean} instead.
	 */
	interface IParamSpecBoolean {
		/**
		 * default value for the property specified
		 */
		readonly default_value: boolean;

		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecBooleanInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecBooleanInitOptions extends ParamSpecBooleanInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecBoolean} instead.
	 */
	type ParamSpecBooleanMixin = IParamSpecBoolean & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for boolean properties.
	 */
	interface ParamSpecBoolean extends ParamSpecBooleanMixin {}

	class ParamSpecBoolean {
		public constructor(options?: Partial<ParamSpecBooleanInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecBoxed} instead.
	 */
	interface IParamSpecBoxed {

	}

	type ParamSpecBoxedInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecBoxedInitOptions extends ParamSpecBoxedInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecBoxed} instead.
	 */
	type ParamSpecBoxedMixin = IParamSpecBoxed & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for boxed properties.
	 */
	interface ParamSpecBoxed extends ParamSpecBoxedMixin {}

	class ParamSpecBoxed {
		public constructor(options?: Partial<ParamSpecBoxedInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecChar} instead.
	 */
	interface IParamSpecChar {
		/**
		 * minimum value for the property specified
		 */
		readonly minimum: number;
		/**
		 * maximum value for the property specified
		 */
		readonly maximum: number;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;

		connect(signal: "notify::minimum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecCharInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecCharInitOptions extends ParamSpecCharInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecChar} instead.
	 */
	type ParamSpecCharMixin = IParamSpecChar & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for character properties.
	 */
	interface ParamSpecChar extends ParamSpecCharMixin {}

	class ParamSpecChar {
		public constructor(options?: Partial<ParamSpecCharInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecDouble} instead.
	 */
	interface IParamSpecDouble {
		/**
		 * minimum value for the property specified
		 */
		readonly minimum: number;
		/**
		 * maximum value for the property specified
		 */
		readonly maximum: number;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;
		/**
		 * values closer than #epsilon will be considered identical
		 *  by {@link G.param_values_cmp}; the default value is 1e-90.
		 */
		readonly epsilon: number;

		connect(signal: "notify::minimum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::epsilon", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecDoubleInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecDoubleInitOptions extends ParamSpecDoubleInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecDouble} instead.
	 */
	type ParamSpecDoubleMixin = IParamSpecDouble & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for double properties.
	 */
	interface ParamSpecDouble extends ParamSpecDoubleMixin {}

	class ParamSpecDouble {
		public constructor(options?: Partial<ParamSpecDoubleInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecEnum} instead.
	 */
	interface IParamSpecEnum {
		/**
		 * the #GEnumClass for the enum
		 */
		readonly enum_class: EnumClass;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;

		connect(signal: "notify::enum_class", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecEnumInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecEnumInitOptions extends ParamSpecEnumInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecEnum} instead.
	 */
	type ParamSpecEnumMixin = IParamSpecEnum & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for enum
	 * properties.
	 */
	interface ParamSpecEnum extends ParamSpecEnumMixin {}

	class ParamSpecEnum {
		public constructor(options?: Partial<ParamSpecEnumInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecFlags} instead.
	 */
	interface IParamSpecFlags {
		/**
		 * the #GFlagsClass for the flags
		 */
		readonly flags_class: FlagsClass;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;

		connect(signal: "notify::flags_class", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecFlagsInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecFlagsInitOptions extends ParamSpecFlagsInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecFlags} instead.
	 */
	type ParamSpecFlagsMixin = IParamSpecFlags & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for flags
	 * properties.
	 */
	interface ParamSpecFlags extends ParamSpecFlagsMixin {}

	class ParamSpecFlags {
		public constructor(options?: Partial<ParamSpecFlagsInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecFloat} instead.
	 */
	interface IParamSpecFloat {
		/**
		 * minimum value for the property specified
		 */
		readonly minimum: number;
		/**
		 * maximum value for the property specified
		 */
		readonly maximum: number;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;
		/**
		 * values closer than #epsilon will be considered identical
		 *  by {@link G.param_values_cmp}; the default value is 1e-30.
		 */
		readonly epsilon: number;

		connect(signal: "notify::minimum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::epsilon", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecFloatInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecFloatInitOptions extends ParamSpecFloatInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecFloat} instead.
	 */
	type ParamSpecFloatMixin = IParamSpecFloat & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for float properties.
	 */
	interface ParamSpecFloat extends ParamSpecFloatMixin {}

	class ParamSpecFloat {
		public constructor(options?: Partial<ParamSpecFloatInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecGType} instead.
	 */
	interface IParamSpecGType {
		/**
		 * a #GType whose subtypes can occur as values
		 */
		readonly is_a_type: GObject.Type;

		connect(signal: "notify::is_a_type", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecGTypeInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecGTypeInitOptions extends ParamSpecGTypeInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecGType} instead.
	 */
	type ParamSpecGTypeMixin = IParamSpecGType & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for #GType properties.
	 */
	interface ParamSpecGType extends ParamSpecGTypeMixin {}

	class ParamSpecGType {
		public constructor(options?: Partial<ParamSpecGTypeInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecInt} instead.
	 */
	interface IParamSpecInt {
		/**
		 * minimum value for the property specified
		 */
		readonly minimum: number;
		/**
		 * maximum value for the property specified
		 */
		readonly maximum: number;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;

		connect(signal: "notify::minimum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecIntInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecIntInitOptions extends ParamSpecIntInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecInt} instead.
	 */
	type ParamSpecIntMixin = IParamSpecInt & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for integer properties.
	 */
	interface ParamSpecInt extends ParamSpecIntMixin {}

	class ParamSpecInt {
		public constructor(options?: Partial<ParamSpecIntInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecInt64} instead.
	 */
	interface IParamSpecInt64 {
		/**
		 * minimum value for the property specified
		 */
		readonly minimum: number;
		/**
		 * maximum value for the property specified
		 */
		readonly maximum: number;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;

		connect(signal: "notify::minimum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecInt64InitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecInt64InitOptions extends ParamSpecInt64InitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecInt64} instead.
	 */
	type ParamSpecInt64Mixin = IParamSpecInt64 & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for 64bit integer properties.
	 */
	interface ParamSpecInt64 extends ParamSpecInt64Mixin {}

	class ParamSpecInt64 {
		public constructor(options?: Partial<ParamSpecInt64InitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecLong} instead.
	 */
	interface IParamSpecLong {
		/**
		 * minimum value for the property specified
		 */
		readonly minimum: number;
		/**
		 * maximum value for the property specified
		 */
		readonly maximum: number;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;

		connect(signal: "notify::minimum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecLongInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecLongInitOptions extends ParamSpecLongInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecLong} instead.
	 */
	type ParamSpecLongMixin = IParamSpecLong & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for long integer properties.
	 */
	interface ParamSpecLong extends ParamSpecLongMixin {}

	class ParamSpecLong {
		public constructor(options?: Partial<ParamSpecLongInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecObject} instead.
	 */
	interface IParamSpecObject {

	}

	type ParamSpecObjectInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecObjectInitOptions extends ParamSpecObjectInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecObject} instead.
	 */
	type ParamSpecObjectMixin = IParamSpecObject & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for object properties.
	 */
	interface ParamSpecObject extends ParamSpecObjectMixin {}

	class ParamSpecObject {
		public constructor(options?: Partial<ParamSpecObjectInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecOverride} instead.
	 */
	interface IParamSpecOverride {

	}

	type ParamSpecOverrideInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecOverrideInitOptions extends ParamSpecOverrideInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecOverride} instead.
	 */
	type ParamSpecOverrideMixin = IParamSpecOverride & ParamSpec;

	/**
	 * A #GParamSpec derived structure that redirects operations to
	 * other types of #GParamSpec.
	 * 
	 * All operations other than getting or setting the value are redirected,
	 * including accessing the nick and blurb, validating a value, and so
	 * forth.
	 * 
	 * See {@link G.param_spec_get_redirect_target} for retrieving the overridden
	 * property. #GParamSpecOverride is used in implementing
	 * g_object_class_override_property(), and will not be directly useful
	 * unless you are implementing a new base type similar to GObject.
	 */
	interface ParamSpecOverride extends ParamSpecOverrideMixin {}

	class ParamSpecOverride {
		public constructor(options?: Partial<ParamSpecOverrideInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecParam} instead.
	 */
	interface IParamSpecParam {

	}

	type ParamSpecParamInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecParamInitOptions extends ParamSpecParamInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecParam} instead.
	 */
	type ParamSpecParamMixin = IParamSpecParam & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for %G_TYPE_PARAM
	 * properties.
	 */
	interface ParamSpecParam extends ParamSpecParamMixin {}

	class ParamSpecParam {
		public constructor(options?: Partial<ParamSpecParamInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecPointer} instead.
	 */
	interface IParamSpecPointer {

	}

	type ParamSpecPointerInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecPointerInitOptions extends ParamSpecPointerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecPointer} instead.
	 */
	type ParamSpecPointerMixin = IParamSpecPointer & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for pointer properties.
	 */
	interface ParamSpecPointer extends ParamSpecPointerMixin {}

	class ParamSpecPointer {
		public constructor(options?: Partial<ParamSpecPointerInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecString} instead.
	 */
	interface IParamSpecString {
		/**
		 * default value for the property specified
		 */
		readonly default_value: string;
		/**
		 * a string containing the allowed values for the first byte
		 */
		readonly cset_first: string;
		/**
		 * a string containing the allowed values for the subsequent bytes
		 */
		readonly cset_nth: string;
		/**
		 * the replacement byte for bytes which don't match #cset_first or #cset_nth.
		 */
		readonly substitutor: string;
		/**
		 * replace empty string by %NULL
		 */
		readonly null_fold_if_empty: number;
		/**
		 * replace %NULL strings by an empty string
		 */
		readonly ensure_non_null: number;

		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::cset_first", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::cset_nth", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::substitutor", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::null_fold_if_empty", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ensure_non_null", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecStringInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecStringInitOptions extends ParamSpecStringInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecString} instead.
	 */
	type ParamSpecStringMixin = IParamSpecString & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for string
	 * properties.
	 */
	interface ParamSpecString extends ParamSpecStringMixin {}

	class ParamSpecString {
		public constructor(options?: Partial<ParamSpecStringInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecUChar} instead.
	 */
	interface IParamSpecUChar {
		/**
		 * minimum value for the property specified
		 */
		readonly minimum: number;
		/**
		 * maximum value for the property specified
		 */
		readonly maximum: number;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;

		connect(signal: "notify::minimum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecUCharInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecUCharInitOptions extends ParamSpecUCharInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecUChar} instead.
	 */
	type ParamSpecUCharMixin = IParamSpecUChar & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for unsigned character properties.
	 */
	interface ParamSpecUChar extends ParamSpecUCharMixin {}

	class ParamSpecUChar {
		public constructor(options?: Partial<ParamSpecUCharInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecUInt} instead.
	 */
	interface IParamSpecUInt {
		/**
		 * minimum value for the property specified
		 */
		readonly minimum: number;
		/**
		 * maximum value for the property specified
		 */
		readonly maximum: number;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;

		connect(signal: "notify::minimum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecUIntInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecUIntInitOptions extends ParamSpecUIntInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecUInt} instead.
	 */
	type ParamSpecUIntMixin = IParamSpecUInt & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for unsigned integer properties.
	 */
	interface ParamSpecUInt extends ParamSpecUIntMixin {}

	class ParamSpecUInt {
		public constructor(options?: Partial<ParamSpecUIntInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecUInt64} instead.
	 */
	interface IParamSpecUInt64 {
		/**
		 * minimum value for the property specified
		 */
		readonly minimum: number;
		/**
		 * maximum value for the property specified
		 */
		readonly maximum: number;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;

		connect(signal: "notify::minimum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecUInt64InitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecUInt64InitOptions extends ParamSpecUInt64InitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecUInt64} instead.
	 */
	type ParamSpecUInt64Mixin = IParamSpecUInt64 & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for unsigned 64bit integer properties.
	 */
	interface ParamSpecUInt64 extends ParamSpecUInt64Mixin {}

	class ParamSpecUInt64 {
		public constructor(options?: Partial<ParamSpecUInt64InitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecULong} instead.
	 */
	interface IParamSpecULong {
		/**
		 * minimum value for the property specified
		 */
		readonly minimum: number;
		/**
		 * maximum value for the property specified
		 */
		readonly maximum: number;
		/**
		 * default value for the property specified
		 */
		readonly default_value: number;

		connect(signal: "notify::minimum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::maximum", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecULongInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecULongInitOptions extends ParamSpecULongInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecULong} instead.
	 */
	type ParamSpecULongMixin = IParamSpecULong & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for unsigned long integer properties.
	 */
	interface ParamSpecULong extends ParamSpecULongMixin {}

	class ParamSpecULong {
		public constructor(options?: Partial<ParamSpecULongInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecUnichar} instead.
	 */
	interface IParamSpecUnichar {
		/**
		 * default value for the property specified
		 */
		readonly default_value: string;

		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecUnicharInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecUnicharInitOptions extends ParamSpecUnicharInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecUnichar} instead.
	 */
	type ParamSpecUnicharMixin = IParamSpecUnichar & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for unichar (unsigned integer) properties.
	 */
	interface ParamSpecUnichar extends ParamSpecUnicharMixin {}

	class ParamSpecUnichar {
		public constructor(options?: Partial<ParamSpecUnicharInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecValueArray} instead.
	 */
	interface IParamSpecValueArray {
		/**
		 * a #GParamSpec describing the elements contained in arrays of this property, may be %NULL
		 */
		readonly element_spec: ParamSpec;
		/**
		 * if greater than 0, arrays of this property will always have this many elements
		 */
		readonly fixed_n_elements: number;

		connect(signal: "notify::element_spec", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::fixed_n_elements", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecValueArrayInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecValueArrayInitOptions extends ParamSpecValueArrayInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecValueArray} instead.
	 */
	type ParamSpecValueArrayMixin = IParamSpecValueArray & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for #GValueArray properties.
	 */
	interface ParamSpecValueArray extends ParamSpecValueArrayMixin {}

	class ParamSpecValueArray {
		public constructor(options?: Partial<ParamSpecValueArrayInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecVariant} instead.
	 */
	interface IParamSpecVariant {
		/**
		 * a #GVariantType, or %NULL
		 */
		readonly type: GLib.VariantType;
		/**
		 * a #GVariant, or %NULL
		 */
		readonly default_value: GLib.Variant;

		connect(signal: "notify::type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::default_value", callback: (owner: this, ...args: any) => void): number;

	}

	type ParamSpecVariantInitOptionsMixin = ParamSpecInitOptions
	export interface ParamSpecVariantInitOptions extends ParamSpecVariantInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamSpecVariant} instead.
	 */
	type ParamSpecVariantMixin = IParamSpecVariant & ParamSpec;

	/**
	 * A #GParamSpec derived structure that contains the meta data for #GVariant properties.
	 * 
	 * When comparing values with {@link G.param_values_cmp}, scalar values with the same
	 * type will be compared with g_variant_compare(). Other non-%NULL variants will
	 * be checked for equality with g_variant_equal(), and their sort order is
	 * otherwise undefined. %NULL is ordered before non-%NULL variants. Two %NULL
	 * values compare equal.
	 */
	interface ParamSpecVariant extends ParamSpecVariantMixin {}

	class ParamSpecVariant {
		public constructor(options?: Partial<ParamSpecVariantInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TypeModule} instead.
	 */
	interface ITypeModule {
		readonly use_count: number;
		readonly type_infos: any[];
		readonly interface_infos: any[];
		/**
		 * the name of the module
		 */
		readonly name: string;
		/**
		 * Registers an additional interface for a type, whose interface lives
		 * in the given type plugin. If the interface was already registered
		 * for the type in this plugin, nothing will be done.
		 * 
		 * As long as any instances of the type exist, the type plugin will
		 * not be unloaded.
		 * 
		 * Since 2.56 if #module is %NULL this will call {@link G.type_add_interface_static}
		 * instead. This can be used when making a static build of the module.
		 * @param instance_type type to which to add the interface.
		 * @param interface_type interface type to add
		 * @param interface_info type information structure
		 */
		add_interface(instance_type: GObject.Type, interface_type: GObject.Type, interface_info: InterfaceInfo): void;
		/**
		 * Looks up or registers an enumeration that is implemented with a particular
		 * type plugin. If a type with name #type_name was previously registered,
		 * the #GType identifier for the type is returned, otherwise the type
		 * is newly registered, and the resulting #GType identifier returned.
		 * 
		 * As long as any instances of the type exist, the type plugin will
		 * not be unloaded.
		 * 
		 * Since 2.56 if #module is %NULL this will call {@link G.type_register_static}
		 * instead. This can be used when making a static build of the module.
		 * @param name name for the type
		 * @param const_static_values an array of #GEnumValue structs for the
		 *                       possible enumeration values. The array is
		 *                       terminated by a struct with all members being
		 *                       0.
		 * @returns the new or existing type ID
		 */
		register_enum(name: string, const_static_values: EnumValue): GObject.Type;
		/**
		 * Looks up or registers a flags type that is implemented with a particular
		 * type plugin. If a type with name #type_name was previously registered,
		 * the #GType identifier for the type is returned, otherwise the type
		 * is newly registered, and the resulting #GType identifier returned.
		 * 
		 * As long as any instances of the type exist, the type plugin will
		 * not be unloaded.
		 * 
		 * Since 2.56 if #module is %NULL this will call {@link G.type_register_static}
		 * instead. This can be used when making a static build of the module.
		 * @param name name for the type
		 * @param const_static_values an array of #GFlagsValue structs for the
		 *                       possible flags values. The array is
		 *                       terminated by a struct with all members being
		 *                       0.
		 * @returns the new or existing type ID
		 */
		register_flags(name: string, const_static_values: FlagsValue): GObject.Type;
		/**
		 * Looks up or registers a type that is implemented with a particular
		 * type plugin. If a type with name #type_name was previously registered,
		 * the #GType identifier for the type is returned, otherwise the type
		 * is newly registered, and the resulting #GType identifier returned.
		 * 
		 * When reregistering a type (typically because a module is unloaded
		 * then reloaded, and reinitialized), #module and #parent_type must
		 * be the same as they were previously.
		 * 
		 * As long as any instances of the type exist, the type plugin will
		 * not be unloaded.
		 * 
		 * Since 2.56 if #module is %NULL this will call {@link G.type_register_static}
		 * instead. This can be used when making a static build of the module.
		 * @param parent_type the type for the parent class
		 * @param type_name name for the type
		 * @param type_info type information structure
		 * @param flags flags field providing details about the type
		 * @returns the new or existing type ID
		 */
		register_type(parent_type: GObject.Type, type_name: string, type_info: TypeInfo, flags: TypeFlags): GObject.Type;
		/**
		 * Sets the name for a #GTypeModule
		 * @param name a human-readable name to use in error messages.
		 */
		set_name(name: string): void;
		/**
		 * Decreases the use count of a #GTypeModule by one. If the
		 * result is zero, the module will be unloaded. (However, the
		 * #GTypeModule will not be freed, and types associated with the
		 * #GTypeModule are not unregistered. Once a #GTypeModule is
		 * initialized, it must exist forever.)
		 */
		unuse(): void;
		/**
		 * Increases the use count of a #GTypeModule by one. If the
		 * use count was zero before, the plugin will be loaded.
		 * If loading the plugin fails, the use count is reset to
		 * its prior value.
		 * @returns %FALSE if the plugin needed to be loaded and
		 *  loading the plugin failed.
		 */
		// use(): boolean;
		connect(signal: "notify::use_count", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::type_infos", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::interface_infos", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;

	}

	type TypeModuleInitOptionsMixin = ObjectInitOptions & TypePluginInitOptions
	export interface TypeModuleInitOptions extends TypeModuleInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TypeModule} instead.
	 */
	type TypeModuleMixin = ITypeModule & Object & TypePlugin;

	/**
	 * #GTypeModule provides a simple implementation of the #GTypePlugin
	 * interface.
	 * 
	 * The model of #GTypeModule is a dynamically loaded module which
	 * implements some number of types and interface implementations.
	 * 
	 * When the module is loaded, it registers its types and interfaces
	 * using {@link G.type_module_register_type} and g_type_module_add_interface().
	 * As long as any instances of these types and interface implementations
	 * are in use, the module is kept loaded. When the types and interfaces
	 * are gone, the module may be unloaded. If the types and interfaces
	 * become used again, the module will be reloaded. Note that the last
	 * reference cannot be released from within the module code, since that
	 * would lead to the caller's code being unloaded before g_object_unref()
	 * returns to it.
	 * 
	 * Keeping track of whether the module should be loaded or not is done by
	 * using a use count - it starts at zero, and whenever it is greater than
	 * zero, the module is loaded. The use count is maintained internally by
	 * the type system, but also can be explicitly controlled by
	 * g_type_module_use() and g_type_module_unuse(). Typically, when loading
	 * a module for the first type, g_type_module_use() will be used to load
	 * it so that it can initialize its types. At some later point, when the
	 * module no longer needs to be loaded except for the type
	 * implementations it contains, g_type_module_unuse() is called.
	 * 
	 * #GTypeModule does not actually provide any implementation of module
	 * loading and unloading. To create a particular module type you must
	 * derive from #GTypeModule and implement the load and unload functions
	 * in #GTypeModuleClass.
	 */
	interface TypeModule extends TypeModuleMixin {}

	class TypeModule {
		public constructor(options?: Partial<TypeModuleInitOptions>);
	}

	export interface CClosureInitOptions {}
	/**
	 * A #GCClosure is a specialization of #GClosure for C function callbacks.
	 */
	interface CClosure {}
	class CClosure {
		public constructor(options?: Partial<CClosureInitOptions>);
		/**
		 * A #GClosureMarshal function for use with signals with handlers that
		 * take two boxed pointers as arguments and return a boolean.  If you
		 * have such a signal, you will probably also need to use an
		 * accumulator, such as {@link G.signal_accumulator_true_handled}.
		 * @param closure A #GClosure.
		 * @param return_value A #GValue to store the return value. May be %NULL
		 *   if the callback of closure doesn't return a value.
		 * @param n_param_values The length of the #param_values array.
		 * @param param_values An array of #GValues holding the arguments
		 *   on which to invoke the callback of closure.
		 * @param invocation_hint The invocation hint given as the last argument to
		 *   {@link G.closure_invoke}.
		 * @param marshal_data Additional data specified when registering the
		 *   marshaller, see {@link G.closure_set_marshal} and
		 *   g_closure_set_meta_marshal()
		 */
		public static marshal_BOOLEAN__BOXED_BOXED(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_BOOLEAN__BOXED_BOXED}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_BOOLEAN__BOXED_BOXEDv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `gboolean (*callback) (gpointer instance, gint arg1, gpointer user_data)` where the #gint parameter
		 * denotes a flags type.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue which can store the returned #gboolean
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding instance and arg1
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_BOOLEAN__FLAGS(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_BOOLEAN__FLAGS}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_BOOLEAN__FLAGSv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `gchar* (*callback) (gpointer instance, GObject *arg1, gpointer arg2, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue, which can store the returned string
		 * @param n_param_values 3
		 * @param param_values a #GValue array holding instance, arg1 and arg2
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_STRING__OBJECT_POINTER(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_STRING__OBJECT_POINTER}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_STRING__OBJECT_POINTERv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, gboolean arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #gboolean parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__BOOLEAN(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__BOOLEAN}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__BOOLEANv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, GBoxed *arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #GBoxed* parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__BOXED(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__BOXED}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__BOXEDv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, gchar arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #gchar parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__CHAR(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__CHAR}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__CHARv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, gdouble arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #gdouble parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__DOUBLE(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__DOUBLE}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__DOUBLEv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, gint arg1, gpointer user_data)` where the #gint parameter denotes an enumeration type..
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the enumeration parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__ENUM(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__ENUM}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__ENUMv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, gint arg1, gpointer user_data)` where the #gint parameter denotes a flags type.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the flags parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__FLAGS(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__FLAGS}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__FLAGSv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, gfloat arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #gfloat parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__FLOAT(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__FLOAT}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__FLOATv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, gint arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #gint parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__INT(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__INT}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__INTv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, glong arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #glong parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__LONG(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__LONG}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__LONGv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, GObject *arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #GObject* parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__OBJECT(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__OBJECT}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__OBJECTv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, GParamSpec *arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #GParamSpec* parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__PARAM(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__PARAM}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__PARAMv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, gpointer arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #gpointer parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__POINTER(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__POINTER}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__POINTERv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, const gchar *arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #gchar* parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__STRING(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__STRING}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__STRINGv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, guchar arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #guchar parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__UCHAR(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__UCHAR}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__UCHARv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, guint arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #guint parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__UINT(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, guint arg1, gpointer arg2, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 3
		 * @param param_values a #GValue array holding instance, arg1 and arg2
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__UINT_POINTER(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__UINT_POINTER}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__UINT_POINTERv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__UINT}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__UINTv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, gulong arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #gulong parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__ULONG(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__ULONG}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__ULONGv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, GVariant *arg1, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 2
		 * @param param_values a #GValue array holding the instance and the #GVariant* parameter
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__VARIANT(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__VARIANT}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__VARIANTv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A marshaller for a #GCClosure with a callback of type
		 * `void (*callback) (gpointer instance, gpointer user_data)`.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value ignored
		 * @param n_param_values 1
		 * @param param_values a #GValue array holding only the instance
		 * @param invocation_hint the invocation hint given as the last argument
		 *  to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when registering the marshaller
		 */
		public static marshal_VOID__VOID(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * The #GVaClosureMarshal equivalent to {@link G.cclosure_marshal_VOID__VOID}.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		public static marshal_VOID__VOIDv(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * A generic marshaller function implemented via
		 * [libffi](http://sourceware.org/libffi/).
		 * 
		 * Normally this function is not passed explicitly to {@link G.signal_new},
		 * but used automatically by GLib when specifying a %NULL marshaller.
		 * @param closure A #GClosure.
		 * @param return_gvalue A #GValue to store the return value. May be %NULL
		 *   if the callback of closure doesn't return a value.
		 * @param n_param_values The length of the #param_values array.
		 * @param param_values An array of #GValues holding the arguments
		 *   on which to invoke the callback of closure.
		 * @param invocation_hint The invocation hint given as the last argument to
		 *   {@link G.closure_invoke}.
		 * @param marshal_data Additional data specified when registering the
		 *   marshaller, see {@link G.closure_set_marshal} and
		 *   g_closure_set_meta_marshal()
		 */
		public static marshal_generic(closure: Closure, return_gvalue: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;
		/**
		 * A generic #GVaClosureMarshal function implemented via
		 * [libffi](http://sourceware.org/libffi/).
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is
		 *  invoked.
		 * @param args_list va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args_list.
		 */
		public static marshal_generic_va(closure: Closure, return_value: Value | null, instance: TypeInstance, args_list: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
		/**
		 * Creates a new closure which invokes #callback_func with #user_data as
		 * the last parameter.
		 * 
		 * #destroy_data will be called as a finalize notifier on the #GClosure.
		 * @param callback_func the function to invoke
		 * @param destroy_data destroy notify to be called when #user_data is no longer used
		 * @returns a floating reference to a new #GCClosure
		 */
		public static new(callback_func: Callback | null, destroy_data: ClosureNotify): Closure;
		/**
		 * A variant of {@link G.cclosure_new} which uses #object as #user_data and
		 * calls g_object_watch_closure() on #object and the created
		 * closure. This function is useful when you have a callback closely
		 * associated with a #GObject, and want the callback to no longer run
		 * after the object is is freed.
		 * @param callback_func the function to invoke
		 * @param object a #GObject pointer to pass to #callback_func
		 * @returns a new #GCClosure
		 */
		public static new_object(callback_func: Callback, object: Object): Closure;
		/**
		 * A variant of {@link G.cclosure_new_swap} which uses #object as #user_data
		 * and calls g_object_watch_closure() on #object and the created
		 * closure. This function is useful when you have a callback closely
		 * associated with a #GObject, and want the callback to no longer run
		 * after the object is is freed.
		 * @param callback_func the function to invoke
		 * @param object a #GObject pointer to pass to #callback_func
		 * @returns a new #GCClosure
		 */
		public static new_object_swap(callback_func: Callback, object: Object): Closure;
		/**
		 * Creates a new closure which invokes #callback_func with #user_data as
		 * the first parameter.
		 * 
		 * #destroy_data will be called as a finalize notifier on the #GClosure.
		 * @param callback_func the function to invoke
		 * @param destroy_data destroy notify to be called when #user_data is no longer used
		 * @returns a floating reference to a new #GCClosure
		 */
		public static new_swap(callback_func: Callback | null, destroy_data: ClosureNotify): Closure;
		/**
		 * the #GClosure
		 */
		public closure: Closure;
		/**
		 * the callback function
		 */
		public callback: any;
	}

	export interface ClosureInitOptions {}
	/**
	 * A #GClosure represents a callback supplied by the programmer.
	 * 
	 * It will generally comprise a function of some kind and a marshaller
	 * used to call it. It is the responsibility of the marshaller to
	 * convert the arguments for the invocation from #GValues into
	 * a suitable form, perform the callback on the converted arguments,
	 * and transform the return value back into a #GValue.
	 * 
	 * In the case of C programs, a closure usually just holds a pointer
	 * to a function and maybe a data argument, and the marshaller
	 * converts between #GValue and native C types. The GObject
	 * library provides the #GCClosure type for this purpose. Bindings for
	 * other languages need marshallers which convert between #GValues
	 * and suitable representations in the runtime of the language in
	 * order to use functions written in that language as callbacks. Use
	 * {@link G.closure_set_marshal} to set the marshaller on such a custom
	 * closure implementation.
	 * 
	 * Within GObject, closures play an important role in the
	 * implementation of signals. When a signal is registered, the
	 * #c_marshaller argument to g_signal_new() specifies the default C
	 * marshaller for any closure which is connected to this
	 * signal. GObject provides a number of C marshallers for this
	 * purpose, see the g_cclosure_marshal_*() functions. Additional C
	 * marshallers can be generated with the [glib-genmarshal][glib-genmarshal]
	 * utility.  Closures can be explicitly connected to signals with
	 * g_signal_connect_closure(), but it usually more convenient to let
	 * GObject create a closure automatically by using one of the
	 * g_signal_connect_*() functions which take a callback function/user
	 * data pair.
	 * 
	 * Using closures has a number of important advantages over a simple
	 * callback function/data pointer combination:
	 * 
	 * - Closures allow the callee to get the types of the callback parameters,
	 *   which means that language bindings don't have to write individual glue
	 *   for each callback type.
	 * 
	 * - The reference counting of #GClosure makes it easy to handle reentrancy
	 *   right; if a callback is removed while it is being invoked, the closure
	 *   and its parameters won't be freed until the invocation finishes.
	 * 
	 * - g_closure_invalidate() and invalidation notifiers allow callbacks to be
	 *   automatically removed when the objects they point to go away.
	 */
	interface Closure {}
	class Closure {
		public constructor(options?: Partial<ClosureInitOptions>);
		/**
		 * A variant of {@link G.closure_new_simple} which stores #object in the
		 * #data field of the closure and calls g_object_watch_closure() on
		 * #object and the created closure. This function is mainly useful
		 * when implementing new types of closures.
		 * @param sizeof_closure the size of the structure to allocate, must be at least
		 *  `sizeof (GClosure)`
		 * @param object a #GObject pointer to store in the #data field of the newly
		 *  allocated #GClosure
		 * @returns a newly allocated #GClosure
		 */
		public static new_object(sizeof_closure: number, object: Object): Closure;
		/**
		 * Allocates a struct of the given size and initializes the initial
		 * part as a #GClosure.
		 * 
		 * This function is mainly useful when implementing new types of closures:
		 * 
		 * |[<!-- language="C" -->
		 * typedef struct _MyClosure MyClosure;
		 * struct _MyClosure
		 * {
		 *   GClosure closure;
		 *   // extra data goes here
		 * };
		 * 
		 * static void
		 * my_closure_finalize (gpointer  notify_data,
		 *                      GClosure *closure)
		 * {
		 *   MyClosure *my_closure = (MyClosure *)closure;
		 * 
		 *   // free extra data here
		 * }
		 * 
		 * MyClosure *my_closure_new (gpointer data)
		 * {
		 *   GClosure *closure;
		 *   MyClosure *my_closure;
		 * 
		 *   closure = g_closure_new_simple (sizeof (MyClosure), data);
		 *   my_closure = (MyClosure *) closure;
		 * 
		 *   // initialize extra data here
		 * 
		 *   g_closure_add_finalize_notifier (closure, notify_data,
		 *                                    my_closure_finalize);
		 *   return my_closure;
		 * }
		 * ]|
		 * @param sizeof_closure the size of the structure to allocate, must be at least
		 *                  `sizeof (GClosure)`
		 * @param data data to store in the #data field of the newly allocated #GClosure
		 * @returns a floating reference to a new #GClosure
		 */
		public static new_simple(sizeof_closure: number, data: any | null): Closure;
		public readonly ref_count: number;
		public readonly meta_marshal_nouse: number;
		public readonly n_guards: number;
		public readonly n_fnotifiers: number;
		public readonly n_inotifiers: number;
		public readonly in_inotify: number;
		public readonly floating: number;
		public readonly derivative_flag: number;
		/**
		 * Indicates whether the closure is currently being invoked with
		 *  {@link G.closure_invoke}
		 */
		public in_marshal: number;
		/**
		 * Indicates whether the closure has been invalidated by
		 *  {@link G.closure_invalidate}
		 */
		public is_invalid: number;
		public readonly data: any;
		public readonly notifiers: ClosureNotifyData;
		public marshal: {(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any, marshal_data: any): void;};
		/**
		 * Registers a finalization notifier which will be called when the
		 * reference count of #closure goes down to 0.
		 * 
		 * Multiple finalization notifiers on a single closure are invoked in
		 * unspecified order. If a single call to {@link G.closure_unref} results in
		 * the closure being both invalidated and finalized, then the invalidate
		 * notifiers will be run before the finalize notifiers.
		 * @param notify_data data to pass to #notify_func
		 * @param notify_func the callback function to register
		 */
		public add_finalize_notifier(notify_data: any | null, notify_func: ClosureNotify | null): void;
		/**
		 * Registers an invalidation notifier which will be called when the
		 * #closure is invalidated with {@link G.closure_invalidate}.
		 * 
		 * Invalidation notifiers are invoked before finalization notifiers,
		 * in an unspecified order.
		 * @param notify_data data to pass to #notify_func
		 * @param notify_func the callback function to register
		 */
		public add_invalidate_notifier(notify_data: any | null, notify_func: ClosureNotify | null): void;
		/**
		 * Adds a pair of notifiers which get invoked before and after the
		 * closure callback, respectively.
		 * 
		 * This is typically used to protect the extra arguments for the
		 * duration of the callback. See {@link GObject.watch_closure} for an
		 * example of marshal guards.
		 * @param pre_marshal_data data to pass
		 *  to #pre_marshal_notify
		 * @param pre_marshal_notify a function to call before the closure callback
		 * @param post_marshal_data data to pass
		 *  to #post_marshal_notify
		 * @param post_marshal_notify a function to call after the closure callback
		 */
		public add_marshal_guards(pre_marshal_data: any | null, pre_marshal_notify: ClosureNotify | null, post_marshal_data: any | null, post_marshal_notify: ClosureNotify | null): void;
		/**
		 * Sets a flag on the closure to indicate that its calling
		 * environment has become invalid, and thus causes any future
		 * invocations of {@link G.closure_invoke} on this #closure to be
		 * ignored.
		 * 
		 * Also, invalidation notifiers installed on the closure will
		 * be called at this point. Note that unless you are holding a
		 * reference to the closure yourself, the invalidation notifiers may
		 * unref the closure and cause it to be destroyed, so if you need to
		 * access the closure after calling g_closure_invalidate(), make sure
		 * that you've previously called g_closure_ref().
		 * 
		 * Note that g_closure_invalidate() will also be called when the
		 * reference count of a closure drops to zero (unless it has already
		 * been invalidated before).
		 */
		public invalidate(): void;
		/**
		 * Invokes the closure, i.e. executes the callback represented by the #closure.
		 * @param n_param_values the length of the #param_values array
		 * @param param_values an array of
		 *                #GValues holding the arguments on which to
		 *                invoke the callback of #closure
		 * @param invocation_hint a context-dependent invocation hint
		 * @returns a #GValue to store the return
		 *                value. May be %NULL if the callback of #closure
		 *                doesn't return a value.
		 */
		public invoke(n_param_values: number, param_values: Value[], invocation_hint: any | null): Value | null;
		/**
		 * Increments the reference count on a closure to force it staying
		 * alive while the caller holds a pointer to it.
		 * @returns The #closure passed in, for convenience
		 */
		public ref(): Closure;
		/**
		 * Removes a finalization notifier.
		 * 
		 * Notice that notifiers are automatically removed after they are run.
		 * @param notify_data data which was passed to {@link G.closure_add_finalize_notifier}
		 *  when registering #notify_func
		 * @param notify_func the callback function to remove
		 */
		public remove_finalize_notifier(notify_data: any | null, notify_func: ClosureNotify): void;
		/**
		 * Removes an invalidation notifier.
		 * 
		 * Notice that notifiers are automatically removed after they are run.
		 * @param notify_data data which was passed to {@link G.closure_add_invalidate_notifier}
		 *               when registering #notify_func
		 * @param notify_func the callback function to remove
		 */
		public remove_invalidate_notifier(notify_data: any | null, notify_func: ClosureNotify): void;
		/**
		 * Sets the marshaller of #closure.
		 * 
		 * The `marshal_data` of #marshal provides a way for a meta marshaller to
		 * provide additional information to the marshaller.
		 * 
		 * For GObject's C predefined marshallers (the {@link `g.cclosure_marshal_*}`
		 * functions), what it provides is a callback function to use instead of
		 * #closure->callback.
		 * 
		 * See also: g_closure_set_meta_marshal()
		 * @param marshal a #GClosureMarshal function
		 */
		public set_marshal(marshal: ClosureMarshal): void;
		/**
		 * Sets the meta marshaller of #closure.
		 * 
		 * A meta marshaller wraps the #closure's marshal and modifies the way
		 * it is called in some fashion. The most common use of this facility
		 * is for C callbacks.
		 * 
		 * The same marshallers (generated by [glib-genmarshal][glib-genmarshal]),
		 * are used everywhere, but the way that we get the callback function
		 * differs. In most cases we want to use the #closure's callback, but in
		 * other cases we want to use some different technique to retrieve the
		 * callback function.
		 * 
		 * For example, class closures for signals (see
		 * {@link G.signal_type_cclosure_new}) retrieve the callback function from a
		 * fixed offset in the class structure.  The meta marshaller retrieves
		 * the right callback and passes it to the marshaller as the
		 * #marshal_data argument.
		 * @param marshal_data context-dependent data to pass
		 *  to #meta_marshal
		 * @param meta_marshal a #GClosureMarshal function
		 */
		public set_meta_marshal(marshal_data: any | null, meta_marshal: ClosureMarshal | null): void;
		/**
		 * Takes over the initial ownership of a closure.
		 * 
		 * Each closure is initially created in a "floating" state, which means
		 * that the initial reference count is not owned by any caller.
		 * 
		 * This function checks to see if the object is still floating, and if so,
		 * unsets the floating state and decreases the reference count. If the
		 * closure is not floating, {@link G.closure_sink} does nothing.
		 * 
		 * The reason for the existence of the floating state is to prevent
		 * cumbersome code sequences like:
		 * 
		 * |[<!-- language="C" -->
		 * closure = g_cclosure_new (cb_func, cb_data);
		 * g_source_set_closure (source, closure);
		 * g_closure_unref (closure); // GObject doesn't really need this
		 * ]|
		 * 
		 * Because g_source_set_closure() (and similar functions) take ownership of the
		 * initial reference count, if it is unowned, we instead can write:
		 * 
		 * |[<!-- language="C" -->
		 * g_source_set_closure (source, g_cclosure_new (cb_func, cb_data));
		 * ]|
		 * 
		 * Generally, this function is used together with g_closure_ref(). An example
		 * of storing a closure for later notification looks like:
		 * 
		 * |[<!-- language="C" -->
		 * static GClosure *notify_closure = NULL;
		 * void
		 * foo_notify_set_closure (GClosure *closure)
		 * {
		 *   if (notify_closure)
		 *     g_closure_unref (notify_closure);
		 *   notify_closure = closure;
		 *   if (notify_closure)
		 *     {
		 *       g_closure_ref (notify_closure);
		 *       g_closure_sink (notify_closure);
		 *     }
		 * }
		 * ]|
		 * 
		 * Because g_closure_sink() may decrement the reference count of a closure
		 * (if it hasn't been called on #closure yet) just like g_closure_unref(),
		 * g_closure_ref() should be called prior to this function.
		 */
		public sink(): void;
		/**
		 * Decrements the reference count of a closure after it was previously
		 * incremented by the same caller.
		 * 
		 * If no other callers are using the closure, then the closure will be
		 * destroyed and freed.
		 */
		public unref(): void;
	}

	export interface ClosureNotifyDataInitOptions {}
	interface ClosureNotifyData {}
	class ClosureNotifyData {
		public constructor(options?: Partial<ClosureNotifyDataInitOptions>);
		public data: any;
		public notify: ClosureNotify;
	}

	export interface EnumClassInitOptions {}
	/**
	 * The class of an enumeration type holds information about its
	 * possible values.
	 */
	interface EnumClass {}
	class EnumClass {
		public constructor(options?: Partial<EnumClassInitOptions>);
		/**
		 * the parent class
		 */
		public g_type_class: TypeClass;
		/**
		 * the smallest possible value.
		 */
		public minimum: number;
		/**
		 * the largest possible value.
		 */
		public maximum: number;
		/**
		 * the number of possible values.
		 */
		public n_values: number;
		/**
		 * an array of #GEnumValue structs describing the
		 *  individual values.
		 */
		public values: EnumValue;
	}

	export interface EnumValueInitOptions {}
	/**
	 * A structure which contains a single enum value, its name, and its
	 * nickname.
	 */
	interface EnumValue {}
	class EnumValue {
		public constructor(options?: Partial<EnumValueInitOptions>);
		/**
		 * the enum value
		 */
		public value: number;
		/**
		 * the name of the value
		 */
		public value_name: string;
		/**
		 * the nickname of the value
		 */
		public value_nick: string;
	}

	export interface FlagsClassInitOptions {}
	/**
	 * The class of a flags type holds information about its
	 * possible values.
	 */
	interface FlagsClass {}
	class FlagsClass {
		public constructor(options?: Partial<FlagsClassInitOptions>);
		/**
		 * the parent class
		 */
		public g_type_class: TypeClass;
		/**
		 * a mask covering all possible values.
		 */
		public mask: number;
		/**
		 * the number of possible values.
		 */
		public n_values: number;
		/**
		 * an array of #GFlagsValue structs describing the
		 *  individual values.
		 */
		public values: FlagsValue;
	}

	export interface FlagsValueInitOptions {}
	/**
	 * A structure which contains a single flags value, its name, and its
	 * nickname.
	 */
	interface FlagsValue {}
	class FlagsValue {
		public constructor(options?: Partial<FlagsValueInitOptions>);
		/**
		 * the flags value
		 */
		public value: number;
		/**
		 * the name of the value
		 */
		public value_name: string;
		/**
		 * the nickname of the value
		 */
		public value_nick: string;
	}

	export interface InterfaceInfoInitOptions {}
	/**
	 * A structure that provides information to the type system which is
	 * used specifically for managing interface types.
	 */
	interface InterfaceInfo {}
	class InterfaceInfo {
		public constructor(options?: Partial<InterfaceInfoInitOptions>);
		/**
		 * location of the interface initialization function
		 */
		public interface_init: InterfaceInitFunc;
		/**
		 * location of the interface finalization function
		 */
		public interface_finalize: InterfaceFinalizeFunc;
		/**
		 * user-supplied data passed to the interface init/finalize functions
		 */
		public interface_data: any;
	}

	export interface ObjectConstructParamInitOptions {}
	/**
	 * The GObjectConstructParam struct is an auxiliary structure used to hand
	 * #GParamSpec/#GValue pairs to the #constructor of a {@link Class}.
	 */
	interface ObjectConstructParam {}
	class ObjectConstructParam {
		public constructor(options?: Partial<ObjectConstructParamInitOptions>);
		/**
		 * the #GParamSpec of the construct parameter
		 */
		public pspec: ParamSpec;
		/**
		 * the value to set the parameter to
		 */
		public value: Value;
	}

	export interface ParamSpecPoolInitOptions {}
	/**
	 * A #GParamSpecPool maintains a collection of #GParamSpecs which can be
	 * quickly accessed by owner and name.
	 * 
	 * The implementation of the #GObject property system uses such a pool to
	 * store the #GParamSpecs of the properties all object types.
	 */
	interface ParamSpecPool {}
	class ParamSpecPool {
		public constructor(options?: Partial<ParamSpecPoolInitOptions>);
		/**
		 * Creates a new #GParamSpecPool.
		 * 
		 * If #type_prefixing is %TRUE, lookups in the newly created pool will
		 * allow to specify the owner as a colon-separated prefix of the
		 * property name, like "GtkContainer:border-width". This feature is
		 * deprecated, so you should always set #type_prefixing to %FALSE.
		 * @param type_prefixing Whether the pool will support type-prefixed property names.
		 * @returns a newly allocated #GParamSpecPool.
		 */
		public static new(type_prefixing: boolean): ParamSpecPool;
		/**
		 * Inserts a #GParamSpec in the pool.
		 * @param pspec the #GParamSpec to insert
		 * @param owner_type a #GType identifying the owner of #pspec
		 */
		public insert(pspec: ParamSpec, owner_type: GObject.Type): void;
		/**
		 * Gets an array of all #GParamSpecs owned by #owner_type in
		 * the pool.
		 * @param owner_type the owner to look for
		 * @returns a newly
		 *          allocated array containing pointers to all #GParamSpecs
		 *          owned by #owner_type in the pool
		 * 
		 * return location for the length of the returned array
		 */
		public list(owner_type: GObject.Type): [ ParamSpec[], number ];
		/**
		 * Gets an #GList of all #GParamSpecs owned by #owner_type in
		 * the pool.
		 * @param owner_type the owner to look for
		 * @returns a
		 *          #GList of all #GParamSpecs owned by #owner_type in
		 *          the pool#GParamSpecs.
		 */
		public list_owned(owner_type: GObject.Type): ParamSpec[];
		/**
		 * Looks up a #GParamSpec in the pool.
		 * @param param_name the name to look for
		 * @param owner_type the owner to look for
		 * @param walk_ancestors If %TRUE, also try to find a #GParamSpec with #param_name
		 *  owned by an ancestor of #owner_type.
		 * @returns The found #GParamSpec, or %NULL if no
		 * matching #GParamSpec was found.
		 */
		public lookup(param_name: string, owner_type: GObject.Type, walk_ancestors: boolean): ParamSpec | null;
		/**
		 * Removes a #GParamSpec from the pool.
		 * @param pspec the #GParamSpec to remove
		 */
		public remove(pspec: ParamSpec): void;
	}

	export interface ParamSpecTypeInfoInitOptions {}
	/**
	 * This structure is used to provide the type system with the information
	 * required to initialize and destruct (finalize) a parameter's class and
	 * instances thereof.
	 * 
	 * The initialized structure is passed to the {@link G.param_type_register_static}
	 * The type system will perform a deep copy of this structure, so its memory
	 * does not need to be persistent across invocation of
	 * g_param_type_register_static().
	 */
	interface ParamSpecTypeInfo {}
	class ParamSpecTypeInfo {
		public constructor(options?: Partial<ParamSpecTypeInfoInitOptions>);
		/**
		 * Size of the instance (object) structure.
		 */
		public instance_size: number;
		/**
		 * Prior to GLib 2.10, it specified the number of pre-allocated (cached) instances to reserve memory for (0 indicates no caching). Since GLib 2.10, it is ignored, since instances are allocated with the [slice allocator][glib-Memory-Slices] now.
		 */
		public n_preallocs: number;
		/**
		 * The #GType of values conforming to this #GParamSpec
		 */
		public value_type: GObject.Type;
		public instance_init: {(pspec: ParamSpec): void;};
		public finalize: {(pspec: ParamSpec): void;};
		public value_set_default: {(pspec: ParamSpec, value: Value): void;};
		public value_validate: {(pspec: ParamSpec, value: Value): boolean;};
		public values_cmp: {(pspec: ParamSpec, value1: Value, value2: Value): number;};
	}

	export interface ParameterInitOptions {}
	/**
	 * The GParameter struct is an auxiliary structure used
	 * to hand parameter name/value pairs to {@link GObject.newv}.
	 */
	interface Parameter {}
	class Parameter {
		public constructor(options?: Partial<ParameterInitOptions>);
		/**
		 * the parameter name
		 */
		public name: string;
		/**
		 * the parameter value
		 */
		public value: Value;
	}

	export interface SignalInvocationHintInitOptions {}
	/**
	 * The #GSignalInvocationHint structure is used to pass on additional information
	 * to callbacks during a signal emission.
	 */
	interface SignalInvocationHint {}
	class SignalInvocationHint {
		public constructor(options?: Partial<SignalInvocationHintInitOptions>);
		/**
		 * The signal id of the signal invoking the callback
		 */
		public signal_id: number;
		/**
		 * The detail passed on for this emission
		 */
		public detail: GLib.Quark;
		/**
		 * The stage the signal emission is currently in, this
		 *  field will contain one of %G_SIGNAL_RUN_FIRST,
		 *  %G_SIGNAL_RUN_LAST or %G_SIGNAL_RUN_CLEANUP and %G_SIGNAL_ACCUMULATOR_FIRST_RUN.
		 *  %G_SIGNAL_ACCUMULATOR_FIRST_RUN is only set for the first run of the accumulator
		 *  function for a signal emission.
		 */
		public run_type: SignalFlags;
	}

	export interface SignalQueryInitOptions {}
	/**
	 * A structure holding in-depth information for a specific signal.
	 * 
	 * See also: {@link G.signal_query}
	 */
	interface SignalQuery {}
	class SignalQuery {
		public constructor(options?: Partial<SignalQueryInitOptions>);
		/**
		 * The signal id of the signal being queried, or 0 if the
		 *  signal to be queried was unknown.
		 */
		public signal_id: number;
		/**
		 * The signal name.
		 */
		public signal_name: string;
		/**
		 * The interface/instance type that this signal can be emitted for.
		 */
		public itype: GObject.Type;
		/**
		 * The signal flags as passed in to {@link G.signal_new}.
		 */
		public signal_flags: SignalFlags;
		/**
		 * The return type for user callbacks.
		 */
		public return_type: GObject.Type;
		/**
		 * The number of parameters that user callbacks take.
		 */
		public n_params: number;
		/**
		 * The individual parameter types for
		 *  user callbacks, note that the effective callback signature is:
		 *  |[<!-- language="C" -->
		 *  #return_type callback (#gpointer     data1,
		 *  [param_types param_names,]
		 *  gpointer     data2);
		 *  ]|
		 */
		public param_types: GObject.Type[];
	}

	export interface TypeClassInitOptions {}
	/**
	 * An opaque structure used as the base of all classes.
	 */
	interface TypeClass {}
	class TypeClass {
		public constructor(options?: Partial<TypeClassInitOptions>);
		public static adjust_private_offset(g_class: any | null, private_size_or_offset: number): void;
		/**
		 * This function is essentially the same as {@link G.type_class_ref},
		 * except that the classes reference count isn't incremented.
		 * As a consequence, this function may return %NULL if the class
		 * of the type passed in does not currently exist (hasn't been
		 * referenced before).
		 * @param type type ID of a classed type
		 * @returns the #GTypeClass
		 *     structure for the given type ID or %NULL if the class does not
		 *     currently exist
		 */
		public static peek(type: GObject.Type): TypeClass;
		/**
		 * A more efficient version of {@link G.type_class_peek} which works only for
		 * static types.
		 * @param type type ID of a classed type
		 * @returns the #GTypeClass
		 *     structure for the given type ID or %NULL if the class does not
		 *     currently exist or is dynamically loaded
		 */
		public static peek_static(type: GObject.Type): TypeClass;
		/**
		 * Increments the reference count of the class structure belonging to
		 * #type. This function will demand-create the class if it doesn't
		 * exist already.
		 * @param type type ID of a classed type
		 * @returns the #GTypeClass
		 *     structure for the given type ID
		 */
		public static ref(type: GObject.Type): TypeClass;
		public readonly g_type: GObject.Type;
		/**
		 * @deprecated
		 * Use the {@link G.ADD_PRIVATE} macro with the `G_DEFINE_*`
		 *   family of macros to add instance private data to a type
		 * 
		 * Registers a private structure for an instantiatable type.
		 * 
		 * When an object is allocated, the private structures for
		 * the type and all of its parent types are allocated
		 * sequentially in the same memory block as the public
		 * structures, and are zero-filled.
		 * 
		 * Note that the accumulated size of the private structures of
		 * a type and all its parent types cannot exceed 64 KiB.
		 * 
		 * This function should be called in the type's {@link Class.init} function.
		 * The private structure can be retrieved using the
		 * G_TYPE_INSTANCE_GET_PRIVATE() macro.
		 * 
		 * The following example shows attaching a private structure
		 * MyObjectPrivate to an object MyObject defined in the standard
		 * GObject fashion in the type's class_init() function.
		 * 
		 * Note the use of a structure member "priv" to avoid the overhead
		 * of repeatedly calling MY_OBJECT_GET_PRIVATE().
		 * 
		 * |[<!-- language="C" -->
		 * typedef struct _MyObject        MyObject;
		 * typedef struct _MyObjectPrivate MyObjectPrivate;
		 * 
		 * struct _MyObject {
		 *  GObject parent;
		 * 
		 *  MyObjectPrivate *priv;
		 * };
		 * 
		 * struct _MyObjectPrivate {
		 *   int some_field;
		 * };
		 * 
		 * static void
		 * my_object_class_init (MyObjectClass *klass)
		 * {
		 *   g_type_class_add_private (klass, sizeof (MyObjectPrivate));
		 * }
		 * 
		 * static void
		 * my_object_init (MyObject *my_object)
		 * {
		 *   my_object->priv = G_TYPE_INSTANCE_GET_PRIVATE (my_object,
		 *                                                  MY_TYPE_OBJECT,
		 *                                                  MyObjectPrivate);
		 *   // my_object->priv->some_field will be automatically initialised to 0
		 * }
		 * 
		 * static int
		 * my_object_get_some_field (MyObject *my_object)
		 * {
		 *   MyObjectPrivate *priv;
		 * 
		 *   g_return_val_if_fail (MY_IS_OBJECT (my_object), 0);
		 * 
		 *   priv = my_object->priv;
		 * 
		 *   return priv->some_field;
		 * }
		 * ]|
		 * @param private_size size of private structure
		 */
		public add_private(private_size: number): void;
		/**
		 * Gets the offset of the private data for instances of #g_class.
		 * 
		 * This is how many bytes you should add to the instance pointer of a
		 * class in order to get the private data for the type represented by
		 * #g_class.
		 * 
		 * You can only call this function after you have registered a private
		 * data area for #g_class using {@link G.type_class_add_private}.
		 * @returns the offset, in bytes
		 */
		public get_instance_private_offset(): number;
		public get_private(private_type: GObject.Type): any | null;
		/**
		 * This is a convenience function often needed in class initializers.
		 * It returns the class structure of the immediate parent type of the
		 * class passed in.  Since derived classes hold a reference count on
		 * their parent classes as long as they are instantiated, the returned
		 * class will always exist.
		 * 
		 * This function is essentially equivalent to:
		 * g_type_class_peek (g_type_parent (G_TYPE_FROM_CLASS (g_class)))
		 * @returns the parent class
		 *     of #g_class
		 */
		public peek_parent(): TypeClass;
		/**
		 * Decrements the reference count of the class structure being passed in.
		 * Once the last reference count of a class has been released, classes
		 * may be finalized by the type system, so further dereferencing of a
		 * class pointer after {@link G.type_class_unref} are invalid.
		 */
		public unref(): void;
		/**
		 * A variant of {@link G.type_class_unref} for use in #GTypeClassCacheFunc
		 * implementations. It unreferences a class without consulting the chain
		 * of #GTypeClassCacheFuncs, avoiding the recursion which would occur
		 * otherwise.
		 */
		public unref_uncached(): void;
	}

	export interface TypeFundamentalInfoInitOptions {}
	/**
	 * A structure that provides information to the type system which is
	 * used specifically for managing fundamental types.
	 */
	interface TypeFundamentalInfo {}
	class TypeFundamentalInfo {
		public constructor(options?: Partial<TypeFundamentalInfoInitOptions>);
		/**
		 * #GTypeFundamentalFlags describing the characteristics of the fundamental type
		 */
		public type_flags: TypeFundamentalFlags;
	}

	export interface TypeInfoInitOptions {}
	/**
	 * This structure is used to provide the type system with the information
	 * required to initialize and destruct (finalize) a type's class and
	 * its instances.
	 * 
	 * The initialized structure is passed to the {@link G.type_register_static} function
	 * (or is copied into the provided #GTypeInfo structure in the
	 * g_type_plugin_complete_type_info()). The type system will perform a deep
	 * copy of this structure, so its memory does not need to be persistent
	 * across invocation of g_type_register_static().
	 */
	interface TypeInfo {}
	class TypeInfo {
		public constructor(options?: Partial<TypeInfoInitOptions>);
		/**
		 * Size of the class structure (required for interface, classed and instantiatable types)
		 */
		public class_size: number;
		/**
		 * Location of the base initialization function (optional)
		 */
		public base_init: BaseInitFunc;
		/**
		 * Location of the base finalization function (optional)
		 */
		public base_finalize: BaseFinalizeFunc;
		/**
		 * Location of the class initialization function for
		 *  classed and instantiatable types. Location of the default vtable
		 *  inititalization function for interface types. (optional) This function
		 *  is used both to fill in virtual functions in the class or default vtable,
		 *  and to do type-specific setup such as registering signals and object
		 *  properties.
		 */
		public class_init: ClassInitFunc;
		/**
		 * Location of the class finalization function for
		 *  classed and instantiatable types. Location of the default vtable
		 *  finalization function for interface types. (optional)
		 */
		public class_finalize: ClassFinalizeFunc;
		/**
		 * User-supplied data passed to the class init/finalize functions
		 */
		public class_data: any;
		/**
		 * Size of the instance (object) structure (required for instantiatable types only)
		 */
		public instance_size: number;
		/**
		 * Prior to GLib 2.10, it specified the number of pre-allocated (cached) instances to reserve memory for (0 indicates no caching). Since GLib 2.10, it is ignored, since instances are allocated with the [slice allocator][glib-Memory-Slices] now.
		 */
		public n_preallocs: number;
		/**
		 * Location of the instance initialization function (optional, for instantiatable types only)
		 */
		public instance_init: InstanceInitFunc;
		/**
		 * A #GTypeValueTable function table for generic handling of GValues
		 *  of this type (usually only useful for fundamental types)
		 */
		public value_table: TypeValueTable;
	}

	export interface TypeInstanceInitOptions {}
	/**
	 * An opaque structure used as the base of all type instances.
	 */
	interface TypeInstance {}
	class TypeInstance {
		public constructor(options?: Partial<TypeInstanceInitOptions>);
		public readonly g_class: TypeClass;
		public get_private(private_type: GObject.Type): any | null;
	}

	export interface TypeInterfaceInitOptions {}
	/**
	 * An opaque structure used as the base of all interface types.
	 */
	interface TypeInterface {}
	class TypeInterface {
		public constructor(options?: Partial<TypeInterfaceInitOptions>);
		/**
		 * Adds #prerequisite_type to the list of prerequisites of #interface_type.
		 * This means that any type implementing #interface_type must also implement
		 * #prerequisite_type. Prerequisites can be thought of as an alternative to
		 * interface derivation (which GType doesn't support). An interface can have
		 * at most one instantiatable prerequisite type.
		 * @param interface_type #GType value of an interface type
		 * @param prerequisite_type #GType value of an interface or instantiatable type
		 */
		public static add_prerequisite(interface_type: GObject.Type, prerequisite_type: GObject.Type): void;
		/**
		 * Returns the #GTypePlugin structure for the dynamic interface
		 * #interface_type which has been added to #instance_type, or %NULL
		 * if #interface_type has not been added to #instance_type or does
		 * not have a #GTypePlugin structure. See {@link G.type_add_interface_dynamic}.
		 * @param instance_type #GType of an instantiatable type
		 * @param interface_type #GType of an interface type
		 * @returns the #GTypePlugin for the dynamic
		 *     interface #interface_type of #instance_type
		 */
		public static get_plugin(instance_type: GObject.Type, interface_type: GObject.Type): TypePlugin;
		/**
		 * Returns the most specific instantiatable prerequisite of an
		 * interface type. If the interface type has no instantiatable
		 * prerequisite, %G_TYPE_INVALID is returned.
		 * 
		 * See {@link G.type_interface_add_prerequisite} for more information
		 * about prerequisites.
		 * @param interface_type an interface type
		 * @returns the instantiatable prerequisite type or %G_TYPE_INVALID if none
		 */
		public static instantiatable_prerequisite(interface_type: GObject.Type): GObject.Type;
		/**
		 * Returns the #GTypeInterface structure of an interface to which the
		 * passed in class conforms.
		 * @param instance_class a #GTypeClass structure
		 * @param iface_type an interface ID which this class conforms to
		 * @returns the #GTypeInterface
		 *     structure of #iface_type if implemented by #instance_class, %NULL
		 *     otherwise
		 */
		public static peek(instance_class: TypeClass, iface_type: GObject.Type): TypeInterface;
		/**
		 * Returns the prerequisites of an interfaces type.
		 * @param interface_type an interface type
		 * @returns a
		 *     newly-allocated zero-terminated array of #GType containing
		 *     the prerequisites of #interface_type
		 * 
		 * location to return the number
		 *     of prerequisites, or %NULL
		 */
		public static prerequisites(interface_type: GObject.Type): [ GObject.Type[], number | null ];
		public readonly g_type: GObject.Type;
		public readonly g_instance_type: GObject.Type;
		/**
		 * Returns the corresponding #GTypeInterface structure of the parent type
		 * of the instance type to which #g_iface belongs. This is useful when
		 * deriving the implementation of an interface from the parent type and
		 * then possibly overriding some methods.
		 * @returns the
		 *     corresponding #GTypeInterface structure of the parent type of the
		 *     instance type to which #g_iface belongs, or %NULL if the parent
		 *     type doesn't conform to the interface
		 */
		public peek_parent(): TypeInterface;
	}

	export interface TypePluginClassInitOptions {}
	/**
	 * The #GTypePlugin interface is used by the type system in order to handle
	 * the lifecycle of dynamically loaded types.
	 */
	interface TypePluginClass {}
	class TypePluginClass {
		public constructor(options?: Partial<TypePluginClassInitOptions>);
		public readonly base_iface: TypeInterface;
		/**
		 * Increases the use count of the plugin.
		 */
		public use_plugin: TypePluginUse;
		/**
		 * Decreases the use count of the plugin.
		 */
		public unuse_plugin: TypePluginUnuse;
		/**
		 * Fills in the #GTypeInfo and
		 *  #GTypeValueTable structs for the type. The structs are initialized
		 *  with `memset(s, 0, sizeof (s))` before calling this function.
		 */
		public complete_type_info: TypePluginCompleteTypeInfo;
		/**
		 * Fills in missing parts of the #GInterfaceInfo
		 *  for the interface. The structs is initialized with
		 *  `memset(s, 0, sizeof (s))` before calling this function.
		 */
		public complete_interface_info: TypePluginCompleteInterfaceInfo;
	}

	export interface TypeQueryInitOptions {}
	/**
	 * A structure holding information for a specific type.
	 * 
	 * See also: {@link G.type_query}
	 */
	interface TypeQuery {}
	class TypeQuery {
		public constructor(options?: Partial<TypeQueryInitOptions>);
		/**
		 * the #GType value of the type
		 */
		public type: GObject.Type;
		/**
		 * the name of the type
		 */
		public type_name: string;
		/**
		 * the size of the class structure
		 */
		public class_size: number;
		/**
		 * the size of the instance structure
		 */
		public instance_size: number;
	}

	export interface TypeValueTableInitOptions {}
	/**
	 * The #GTypeValueTable provides the functions required by the #GValue
	 * implementation, to serve as a container for values of a type.
	 */
	interface TypeValueTable {}
	class TypeValueTable {
		public constructor(options?: Partial<TypeValueTableInitOptions>);
		/**
		 * Returns the location of the #GTypeValueTable associated with #type.
		 * 
		 * Note that this function should only be used from source code
		 * that implements or has internal knowledge of the implementation of
		 * #type.
		 * @param type a #GType
		 * @returns location of the #GTypeValueTable associated with #type or
		 *     %NULL if there is no #GTypeValueTable associated with #type
		 */
		public static peek(type: GObject.Type): TypeValueTable;
		/**
		 * A string format describing how to collect the contents of
		 *  this value bit-by-bit. Each character in the format represents
		 *  an argument to be collected, and the characters themselves indicate
		 *  the type of the argument. Currently supported arguments are:
		 *  - 'i' - Integers. passed as collect_values[].v_int.
		 *  - 'l' - Longs. passed as collect_values[].v_long.
		 *  - 'd' - Doubles. passed as collect_values[].v_double.
		 *  - 'p' - Pointers. passed as collect_values[].v_pointer.
		 *  It should be noted that for variable argument list construction,
		 *  ANSI C promotes every type smaller than an integer to an int, and
		 *  floats to doubles. So for collection of short int or char, 'i'
		 *  needs to be used, and for collection of floats 'd'.
		 */
		public collect_format: string;
		/**
		 * Format description of the arguments to collect for #lcopy_value,
		 *  analogous to #collect_format. Usually, #lcopy_format string consists
		 *  only of 'p's to provide {@link Lcopy.value} with pointers to storage locations.
		 */
		public lcopy_format: string;
		public value_init: {(value: Value): void;};
		public value_free: {(value: Value): void;};
		public value_copy: {(src_value: Value, dest_value: Value): void;};
		public value_peek_pointer: {(value: Value): any;};
		public collect_value: {(value: Value, n_collect_values: number, collect_values: TypeCValue, collect_flags: number): string;};
		public lcopy_value: {(value: Value, n_collect_values: number, collect_values: TypeCValue, collect_flags: number): string;};
	}

	export interface ValueInitOptions {}
	/**
	 * An opaque structure used to hold different types of values.
	 * 
	 * The data within the structure has protected scope: it is accessible only
	 * to functions within a #GTypeValueTable structure, or implementations of
	 * the {@link G.value_*} API. That is, code portions which implement new fundamental
	 * types.
	 * 
	 * #GValue users cannot make any assumptions about how data is stored
	 * within the 2 element #data union, and the #g_type member should
	 * only be accessed through the G_VALUE_TYPE() macro.
	 */
	interface Value {}
	class Value {
		public constructor(options?: Partial<ValueInitOptions>);
		/**
		 * Registers a value transformation function for use in {@link G.value_transform}.
		 * A previously registered transformation function for #src_type and #dest_type
		 * will be replaced.
		 * @param src_type Source type.
		 * @param dest_type Target type.
		 * @param transform_func a function which transforms values of type #src_type
		 *  into value of type #dest_type
		 */
		public static register_transform_func(src_type: GObject.Type, dest_type: GObject.Type, transform_func: ValueTransform): void;
		/**
		 * Returns whether a #GValue of type #src_type can be copied into
		 * a #GValue of type #dest_type.
		 * @param src_type source type to be copied.
		 * @param dest_type destination type for copying.
		 * @returns %TRUE if {@link G.value_copy} is possible with #src_type and #dest_type.
		 */
		public static type_compatible(src_type: GObject.Type, dest_type: GObject.Type): boolean;
		/**
		 * Check whether {@link G.value_transform} is able to transform values
		 * of type #src_type into values of type #dest_type. Note that for
		 * the types to be transformable, they must be compatible or a
		 * transformation function must be registered.
		 * @param src_type Source type.
		 * @param dest_type Target type.
		 * @returns %TRUE if the transformation is possible, %FALSE otherwise.
		 */
		public static type_transformable(src_type: GObject.Type, dest_type: GObject.Type): boolean;
		public readonly g_type: GObject.Type;
		public data: _Value__data__union[];
		/**
		 * Copies the value of #src_value into #dest_value.
		 * @param dest_value An initialized #GValue structure of the same type as #src_value.
		 */
		public copy(dest_value: Value): void;
		/**
		 * Get the contents of a %G_TYPE_BOXED derived #GValue.  Upon getting,
		 * the boxed value is duplicated and needs to be later freed with
		 * {@link G.boxed_free}, e.g. like: g_boxed_free (G_VALUE_TYPE (#value),
		 * return_value);
		 * @returns boxed contents of #value
		 */
		public dup_boxed(): any | null;
		/**
		 * Get the contents of a %G_TYPE_OBJECT derived #GValue, increasing
		 * its reference count. If the contents of the #GValue are %NULL, then
		 * %NULL will be returned.
		 * @returns object content of #value,
		 *          should be unreferenced when no longer needed.
		 */
		public dup_object(): Object;
		/**
		 * Get the contents of a %G_TYPE_PARAM #GValue, increasing its
		 * reference count.
		 * @returns #GParamSpec content of #value, should be
		 *     unreferenced when no longer needed.
		 */
		public dup_param(): ParamSpec;
		/**
		 * Get a copy the contents of a %G_TYPE_STRING #GValue.
		 * @returns a newly allocated copy of the string content of #value
		 */
		public dup_string(): string;
		/**
		 * Get the contents of a variant #GValue, increasing its refcount. The returned
		 * #GVariant is never floating.
		 * @returns variant contents of #value (may be %NULL);
		 *    should be unreffed using {@link G.variant_unref} when no longer needed
		 */
		public dup_variant(): GLib.Variant | null;
		/**
		 * Determines if #value will fit inside the size of a pointer value.
		 * This is an internal function introduced mainly for C marshallers.
		 * @returns %TRUE if #value will fit inside a pointer value.
		 */
		public fits_pointer(): boolean;
		/**
		 * Get the contents of a %G_TYPE_BOOLEAN #GValue.
		 * @returns boolean contents of #value
		 */
		public get_boolean(): boolean;
		/**
		 * Get the contents of a %G_TYPE_BOXED derived #GValue.
		 * @returns boxed contents of #value
		 */
		public get_boxed(): any | null;
		/**
		 * @deprecated
		 * This function's return type is broken, see {@link G.value_get_schar}
		 * 
		 * Do not use this function; it is broken on platforms where the %char
		 * type is unsigned, such as ARM and PowerPC.  See {@link G.value_get_schar}.
		 * 
		 * Get the contents of a %G_TYPE_CHAR #GValue.
		 * @returns character contents of #value
		 */
		public get_char(): string;
		/**
		 * Get the contents of a %G_TYPE_DOUBLE #GValue.
		 * @returns double contents of #value
		 */
		public get_double(): number;
		/**
		 * Get the contents of a %G_TYPE_ENUM #GValue.
		 * @returns enum contents of #value
		 */
		public get_enum(): number;
		/**
		 * Get the contents of a %G_TYPE_FLAGS #GValue.
		 * @returns flags contents of #value
		 */
		public get_flags(): number;
		/**
		 * Get the contents of a %G_TYPE_FLOAT #GValue.
		 * @returns float contents of #value
		 */
		public get_float(): number;
		/**
		 * Get the contents of a %G_TYPE_GTYPE #GValue.
		 * @returns the #GType stored in #value
		 */
		public get_gtype(): GObject.Type;
		/**
		 * Get the contents of a %G_TYPE_INT #GValue.
		 * @returns integer contents of #value
		 */
		public get_int(): number;
		/**
		 * Get the contents of a %G_TYPE_INT64 #GValue.
		 * @returns 64bit integer contents of #value
		 */
		public get_int64(): number;
		/**
		 * Get the contents of a %G_TYPE_LONG #GValue.
		 * @returns long integer contents of #value
		 */
		public get_long(): number;
		/**
		 * Get the contents of a %G_TYPE_OBJECT derived #GValue.
		 * @returns object contents of #value
		 */
		public get_object(): Object;
		/**
		 * Get the contents of a %G_TYPE_PARAM #GValue.
		 * @returns #GParamSpec content of #value
		 */
		public get_param(): ParamSpec;
		/**
		 * Get the contents of a pointer #GValue.
		 * @returns pointer contents of #value
		 */
		public get_pointer(): any | null;
		/**
		 * Get the contents of a %G_TYPE_CHAR #GValue.
		 * @returns signed 8 bit integer contents of #value
		 */
		public get_schar(): number;
		/**
		 * Get the contents of a %G_TYPE_STRING #GValue.
		 * @returns string content of #value
		 */
		public get_string(): string;
		/**
		 * Get the contents of a %G_TYPE_UCHAR #GValue.
		 * @returns unsigned character contents of #value
		 */
		public get_uchar(): number;
		/**
		 * Get the contents of a %G_TYPE_UINT #GValue.
		 * @returns unsigned integer contents of #value
		 */
		public get_uint(): number;
		/**
		 * Get the contents of a %G_TYPE_UINT64 #GValue.
		 * @returns unsigned 64bit integer contents of #value
		 */
		public get_uint64(): number;
		/**
		 * Get the contents of a %G_TYPE_ULONG #GValue.
		 * @returns unsigned long integer contents of #value
		 */
		public get_ulong(): number;
		/**
		 * Get the contents of a variant #GValue.
		 * @returns variant contents of #value (may be %NULL)
		 */
		public get_variant(): GLib.Variant | null;
		/**
		 * Initializes #value with the default value of #type.
		 * @param g_type Type the #GValue should hold values of.
		 * @returns the #GValue structure that has been passed in
		 */
		public init(g_type: GObject.Type): Value;
		/**
		 * Initializes and sets #value from an instantiatable type via the
		 * value_table's {@link Collect.value} function.
		 * 
		 * Note: The #value will be initialised with the exact type of
		 * #instance.  If you wish to set the #value's type to a different GType
		 * (such as a parent class GType), you need to manually call
		 * g_value_init() and g_value_set_instance().
		 * @param instance the instance
		 */
		public init_from_instance(instance: TypeInstance): void;
		/**
		 * Returns the value contents as pointer. This function asserts that
		 * {@link G.value_fits_pointer} returned %TRUE for the passed in value.
		 * This is an internal function introduced mainly for C marshallers.
		 * @returns the value contents as pointer
		 */
		public peek_pointer(): any | null;
		/**
		 * Clears the current value in #value and resets it to the default value
		 * (as if the value had just been initialized).
		 * @returns the #GValue structure that has been passed in
		 */
		public reset(): Value;
		/**
		 * Set the contents of a %G_TYPE_BOOLEAN #GValue to #v_boolean.
		 * @param v_boolean boolean value to be set
		 */
		public set_boolean(v_boolean: boolean): void;
		/**
		 * Set the contents of a %G_TYPE_BOXED derived #GValue to #v_boxed.
		 * @param v_boxed boxed value to be set
		 */
		public set_boxed(v_boxed: any | null): void;
		/**
		 * @deprecated
		 * Use {@link G.value_take_boxed} instead.
		 * 
		 * This is an internal function introduced mainly for C marshallers.
		 * @param v_boxed duplicated unowned boxed value to be set
		 */
		public set_boxed_take_ownership(v_boxed: any | null): void;
		/**
		 * @deprecated
		 * This function's input type is broken, see {@link G.value_set_schar}
		 * 
		 * Set the contents of a %G_TYPE_CHAR #GValue to #v_char.
		 * @param v_char character value to be set
		 */
		public set_char(v_char: string): void;
		/**
		 * Set the contents of a %G_TYPE_DOUBLE #GValue to #v_double.
		 * @param v_double double value to be set
		 */
		public set_double(v_double: number): void;
		/**
		 * Set the contents of a %G_TYPE_ENUM #GValue to #v_enum.
		 * @param v_enum enum value to be set
		 */
		public set_enum(v_enum: number): void;
		/**
		 * Set the contents of a %G_TYPE_FLAGS #GValue to #v_flags.
		 * @param v_flags flags value to be set
		 */
		public set_flags(v_flags: number): void;
		/**
		 * Set the contents of a %G_TYPE_FLOAT #GValue to #v_float.
		 * @param v_float float value to be set
		 */
		public set_float(v_float: number): void;
		/**
		 * Set the contents of a %G_TYPE_GTYPE #GValue to #v_gtype.
		 * @param v_gtype #GType to be set
		 */
		public set_gtype(v_gtype: GObject.Type): void;
		/**
		 * Sets #value from an instantiatable type via the
		 * value_table's {@link Collect.value} function.
		 * @param instance the instance
		 */
		public set_instance(instance: any | null): void;
		/**
		 * Set the contents of a %G_TYPE_INT #GValue to #v_int.
		 * @param v_int integer value to be set
		 */
		public set_int(v_int: number): void;
		/**
		 * Set the contents of a %G_TYPE_INT64 #GValue to #v_int64.
		 * @param v_int64 64bit integer value to be set
		 */
		public set_int64(v_int64: number): void;
		/**
		 * Set the contents of a %G_TYPE_STRING #GValue to #v_string.  The string is
		 * assumed to be static and interned (canonical, for example from
		 * {@link G.intern_string}), and is thus not duplicated when setting the #GValue.
		 * @param v_string static string to be set
		 */
		public set_interned_string(v_string: string | null): void;
		/**
		 * Set the contents of a %G_TYPE_LONG #GValue to #v_long.
		 * @param v_long long integer value to be set
		 */
		public set_long(v_long: number): void;
		/**
		 * Set the contents of a %G_TYPE_OBJECT derived #GValue to #v_object.
		 * 
		 * {@link G.value_set_object} increases the reference count of #v_object
		 * (the #GValue holds a reference to #v_object).  If you do not wish
		 * to increase the reference count of the object (i.e. you wish to
		 * pass your current reference to the #GValue because you no longer
		 * need it), use g_value_take_object() instead.
		 * 
		 * It is important that your #GValue holds a reference to #v_object (either its
		 * own, or one it has taken) to ensure that the object won't be destroyed while
		 * the #GValue still exists).
		 * @param v_object object value to be set
		 */
		public set_object(v_object: Object | null): void;
		/**
		 * @deprecated
		 * Use {@link G.value_take_object} instead.
		 * 
		 * This is an internal function introduced mainly for C marshallers.
		 * @param v_object object value to be set
		 */
		public set_object_take_ownership(v_object: any | null): void;
		/**
		 * Set the contents of a %G_TYPE_PARAM #GValue to #param.
		 * @param param the #GParamSpec to be set
		 */
		public set_param(param: ParamSpec | null): void;
		/**
		 * @deprecated
		 * Use {@link G.value_take_param} instead.
		 * 
		 * This is an internal function introduced mainly for C marshallers.
		 * @param param the #GParamSpec to be set
		 */
		public set_param_take_ownership(param: ParamSpec | null): void;
		/**
		 * Set the contents of a pointer #GValue to #v_pointer.
		 * @param v_pointer pointer value to be set
		 */
		public set_pointer(v_pointer: any | null): void;
		/**
		 * Set the contents of a %G_TYPE_CHAR #GValue to #v_char.
		 * @param v_char signed 8 bit integer to be set
		 */
		public set_schar(v_char: number): void;
		/**
		 * Set the contents of a %G_TYPE_BOXED derived #GValue to #v_boxed.
		 * 
		 * The boxed value is assumed to be static, and is thus not duplicated
		 * when setting the #GValue.
		 * @param v_boxed static boxed value to be set
		 */
		public set_static_boxed(v_boxed: any | null): void;
		/**
		 * Set the contents of a %G_TYPE_STRING #GValue to #v_string.
		 * The string is assumed to be static, and is thus not duplicated
		 * when setting the #GValue.
		 * 
		 * If the the string is a canonical string, using {@link G.value_set_interned_string}
		 * is more appropriate.
		 * @param v_string static string to be set
		 */
		public set_static_string(v_string: string | null): void;
		/**
		 * Set the contents of a %G_TYPE_STRING #GValue to a copy of #v_string.
		 * @param v_string caller-owned string to be duplicated for the #GValue
		 */
		public set_string(v_string: string | null): void;
		/**
		 * @deprecated
		 * Use {@link G.value_take_string} instead.
		 * 
		 * This is an internal function introduced mainly for C marshallers.
		 * @param v_string duplicated unowned string to be set
		 */
		public set_string_take_ownership(v_string: string | null): void;
		/**
		 * Set the contents of a %G_TYPE_UCHAR #GValue to #v_uchar.
		 * @param v_uchar unsigned character value to be set
		 */
		public set_uchar(v_uchar: number): void;
		/**
		 * Set the contents of a %G_TYPE_UINT #GValue to #v_uint.
		 * @param v_uint unsigned integer value to be set
		 */
		public set_uint(v_uint: number): void;
		/**
		 * Set the contents of a %G_TYPE_UINT64 #GValue to #v_uint64.
		 * @param v_uint64 unsigned 64bit integer value to be set
		 */
		public set_uint64(v_uint64: number): void;
		/**
		 * Set the contents of a %G_TYPE_ULONG #GValue to #v_ulong.
		 * @param v_ulong unsigned long integer value to be set
		 */
		public set_ulong(v_ulong: number): void;
		/**
		 * Set the contents of a variant #GValue to #variant.
		 * If the variant is floating, it is consumed.
		 * @param variant a #GVariant, or %NULL
		 */
		public set_variant(variant: GLib.Variant | null): void;
		/**
		 * Sets the contents of a %G_TYPE_BOXED derived #GValue to #v_boxed
		 * and takes over the ownership of the caller’s reference to #v_boxed;
		 * the caller doesn’t have to unref it any more.
		 * @param v_boxed duplicated unowned boxed value to be set
		 */
		public take_boxed(v_boxed: any | null): void;
		/**
		 * Sets the contents of a %G_TYPE_OBJECT derived #GValue to #v_object
		 * and takes over the ownership of the caller’s reference to #v_object;
		 * the caller doesn’t have to unref it any more (i.e. the reference
		 * count of the object is not increased).
		 * 
		 * If you want the #GValue to hold its own reference to #v_object, use
		 * {@link G.value_set_object} instead.
		 * @param v_object object value to be set
		 */
		public take_object(v_object: any | null): void;
		/**
		 * Sets the contents of a %G_TYPE_PARAM #GValue to #param and takes
		 * over the ownership of the caller’s reference to #param; the caller
		 * doesn’t have to unref it any more.
		 * @param param the #GParamSpec to be set
		 */
		public take_param(param: ParamSpec | null): void;
		/**
		 * Sets the contents of a %G_TYPE_STRING #GValue to #v_string.
		 * @param v_string string to take ownership of
		 */
		public take_string(v_string: string | null): void;
		/**
		 * Set the contents of a variant #GValue to #variant, and takes over
		 * the ownership of the caller's reference to #variant;
		 * the caller doesn't have to unref it any more (i.e. the reference
		 * count of the variant is not increased).
		 * 
		 * If #variant was floating then its floating reference is converted to
		 * a hard reference.
		 * 
		 * If you want the #GValue to hold its own reference to #variant, use
		 * {@link G.value_set_variant} instead.
		 * 
		 * This is an internal function introduced mainly for C marshallers.
		 * @param variant a #GVariant, or %NULL
		 */
		public take_variant(variant: GLib.Variant | null): void;
		/**
		 * Tries to cast the contents of #src_value into a type appropriate
		 * to store in #dest_value, e.g. to transform a %G_TYPE_INT value
		 * into a %G_TYPE_FLOAT value. Performing transformations between
		 * value types might incur precision lossage. Especially
		 * transformations into strings might reveal seemingly arbitrary
		 * results and shouldn't be relied upon for production code (such
		 * as rcfile value or object property serialization).
		 * @param dest_value Target value.
		 * @returns Whether a transformation rule was found and could be applied.
		 *  Upon failing transformations, #dest_value is left untouched.
		 */
		public transform(dest_value: Value): boolean;
		/**
		 * Clears the current value in #value (if any) and "unsets" the type,
		 * this releases all resources associated with this GValue. An unset
		 * value is the same as an uninitialized (zero-filled) #GValue
		 * structure.
		 */
		public unset(): void;
	}

	export interface ValueArrayInitOptions {}
	/**
	 * A #GValueArray contains an array of #GValue elements.
	 */
	interface ValueArray {}
	class ValueArray {
		public constructor(options?: Partial<ValueArrayInitOptions>);
		/**
		 * @deprecated
		 * Use #GArray and {@link G.array_sized_new} instead.
		 * 
		 * Allocate and initialize a new #GValueArray, optionally preserve space
		 * for #n_prealloced elements. New arrays always contain 0 elements,
		 * regardless of the value of #n_prealloced.
		 * @param n_prealloced number of values to preallocate space for
		 * @returns a newly allocated #GValueArray with 0 values
		 */
		public static new(n_prealloced: number): ValueArray;
		/**
		 * number of values contained in the array
		 */
		public n_values: number;
		/**
		 * array of values
		 */
		public values: Value;
		public readonly n_prealloced: number;
		/**
		 * @deprecated
		 * Use #GArray and {@link G.array_append_val} instead.
		 * 
		 * Insert a copy of #value as last element of #value_array. If #value is
		 * %NULL, an uninitialized value is appended.
		 * @param value #GValue to copy into #GValueArray, or %NULL
		 * @returns the #GValueArray passed in as #value_array
		 */
		public append(value: Value | null): ValueArray;
		/**
		 * @deprecated
		 * Use #GArray and {@link G.array_ref} instead.
		 * 
		 * Construct an exact copy of a #GValueArray by duplicating all its
		 * contents.
		 * @returns Newly allocated copy of #GValueArray
		 */
		public copy(): ValueArray;
		/**
		 * @deprecated
		 * Use #GArray and {@link G.array_unref} instead.
		 * 
		 * Free a #GValueArray including its contents.
		 */
		public free(): void;
		/**
		 * @deprecated
		 * Use {@link G.array_index} instead.
		 * 
		 * Return a pointer to the value at #index_ containd in #value_array.
		 * @param index_ index of the value of interest
		 * @returns pointer to a value at #index_ in #value_array
		 */
		public get_nth(index_: number): Value;
		/**
		 * @deprecated
		 * Use #GArray and {@link G.array_insert_val} instead.
		 * 
		 * Insert a copy of #value at specified position into #value_array. If #value
		 * is %NULL, an uninitialized value is inserted.
		 * @param index_ insertion position, must be <= value_array->;n_values
		 * @param value #GValue to copy into #GValueArray, or %NULL
		 * @returns the #GValueArray passed in as #value_array
		 */
		public insert(index_: number, value: Value | null): ValueArray;
		/**
		 * @deprecated
		 * Use #GArray and {@link G.array_prepend_val} instead.
		 * 
		 * Insert a copy of #value as first element of #value_array. If #value is
		 * %NULL, an uninitialized value is prepended.
		 * @param value #GValue to copy into #GValueArray, or %NULL
		 * @returns the #GValueArray passed in as #value_array
		 */
		public prepend(value: Value | null): ValueArray;
		/**
		 * @deprecated
		 * Use #GArray and {@link G.array_remove_index} instead.
		 * 
		 * Remove the value at position #index_ from #value_array.
		 * @param index_ position of value to remove, which must be less than
		 *     #value_array->n_values
		 * @returns the #GValueArray passed in as #value_array
		 */
		public remove(index_: number): ValueArray;
		/**
		 * @deprecated
		 * Use #GArray and {@link G.array_sort}.
		 * 
		 * Sort #value_array using #compare_func to compare the elements according to
		 * the semantics of #GCompareFunc.
		 * 
		 * The current implementation uses the same sorting algorithm as standard
		 * C qsort() function.
		 * @param compare_func function to compare elements
		 * @returns the #GValueArray passed in as #value_array
		 */
		public sort(compare_func: GLib.CompareFunc): ValueArray;
		/**
		 * @deprecated
		 * Use #GArray and {@link G.array_sort_with_data}.
		 * 
		 * Sort #value_array using #compare_func to compare the elements according
		 * to the semantics of #GCompareDataFunc.
		 * 
		 * The current implementation uses the same sorting algorithm as standard
		 * C qsort() function.
		 * @param compare_func function to compare elements
		 * @returns the #GValueArray passed in as #value_array
		 */
		public sort_with_data(compare_func: GLib.CompareDataFunc): ValueArray;
	}

	export interface WeakRefInitOptions {}
	/**
	 * A structure containing a weak reference to a #GObject.
	 * 
	 * A `GWeakRef` can either be empty (i.e. point to %NULL), or point to an
	 * object for as long as at least one "strong" reference to that object
	 * exists. Before the object's #GObjectClass.dispose method is called,
	 * every #GWeakRef associated with becomes empty (i.e. points to %NULL).
	 * 
	 * Like #GValue, #GWeakRef can be statically allocated, stack- or
	 * heap-allocated, or embedded in larger structures.
	 * 
	 * Unlike g_object_weak_ref() and g_object_add_weak_pointer(), this weak
	 * reference is thread-safe: converting a weak pointer to a reference is
	 * atomic with respect to invalidation of weak pointers to destroyed
	 * objects.
	 * 
	 * If the object's #GObjectClass.dispose method results in additional
	 * references to the object being held, any #GWeakRefs taken
	 * before it was disposed will continue to point to %NULL.  If
	 * #GWeakRefs are taken after the object is disposed and
	 * re-referenced, they will continue to point to it until its refcount
	 * goes back to zero, at which point they too will be invalidated.
	 */
	interface WeakRef {}
	class WeakRef {
		public constructor(options?: Partial<WeakRefInitOptions>);
		/**
		 * Frees resources associated with a non-statically-allocated #GWeakRef.
		 * After this call, the #GWeakRef is left in an undefined state.
		 * 
		 * You should only call this on a #GWeakRef that previously had
		 * {@link G.weak_ref_init} called on it.
		 */
		public clear(): void;
		/**
		 * If #weak_ref is not empty, atomically acquire a strong
		 * reference to the object it points to, and return that reference.
		 * 
		 * This function is needed because of the potential race between taking
		 * the pointer value and {@link GObject.ref} on it, if the object was losing
		 * its last reference at the same time in a different thread.
		 * 
		 * The caller should release the resulting reference in the usual way,
		 * by using g_object_unref().
		 * @returns the object pointed to
		 *     by #weak_ref, or %NULL if it was empty
		 */
		public get(): Object;
		/**
		 * Initialise a non-statically-allocated #GWeakRef.
		 * 
		 * This function also calls {@link G.weak_ref_set} with #object on the
		 * freshly-initialised weak reference.
		 * 
		 * This function should always be matched with a call to
		 * g_weak_ref_clear().  It is not necessary to use this function for a
		 * #GWeakRef in static storage because it will already be
		 * properly initialised.  Just use g_weak_ref_set() directly.
		 * @param object a #GObject or %NULL
		 */
		public init(object: Object | null): void;
		/**
		 * Change the object to which #weak_ref points, or set it to
		 * %NULL.
		 * 
		 * You must own a strong reference on #object while calling this
		 * function.
		 * @param object a #GObject or %NULL
		 */
		public set(object: Object | null): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TypePlugin} instead.
	 */
	interface ITypePlugin {
		/**
		 * Calls the #complete_interface_info function from the
		 * #GTypePluginClass of #plugin. There should be no need to use this
		 * function outside of the GObject type system itself.
		 * @param instance_type the #GType of an instantiatable type to which the interface
		 *  is added
		 * @param interface_type the #GType of the interface whose info is completed
		 * @param info the #GInterfaceInfo to fill in
		 */
		complete_interface_info(instance_type: GObject.Type, interface_type: GObject.Type, info: InterfaceInfo): void;
		/**
		 * Calls the #complete_type_info function from the #GTypePluginClass of #plugin.
		 * There should be no need to use this function outside of the GObject
		 * type system itself.
		 * @param g_type the #GType whose info is completed
		 * @param info the #GTypeInfo struct to fill in
		 * @param value_table the #GTypeValueTable to fill in
		 */
		complete_type_info(g_type: GObject.Type, info: TypeInfo, value_table: TypeValueTable): void;
		/**
		 * Calls the #unuse_plugin function from the #GTypePluginClass of
		 * #plugin.  There should be no need to use this function outside of
		 * the GObject type system itself.
		 */
		unuse(): void;
		/**
		 * Calls the #use_plugin function from the #GTypePluginClass of
		 * #plugin.  There should be no need to use this function outside of
		 * the GObject type system itself.
		 */
		use(): void;
	}

	type TypePluginInitOptionsMixin  = {};
	export interface TypePluginInitOptions extends TypePluginInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TypePlugin} instead.
	 */
	type TypePluginMixin = ITypePlugin;

	/**
	 * An interface that handles the lifecycle of dynamically loaded types.
	 * 
	 * The GObject type system supports dynamic loading of types.
	 * It goes as follows:
	 * 
	 * 1. The type is initially introduced (usually upon loading the module
	 *    the first time, or by your main application that knows what modules
	 *    introduces what types), like this:
	 *    |[<!-- language="C" -->
	 *    new_type_id = g_type_register_dynamic (parent_type_id,
	 *                                           "TypeName",
	 *                                           new_type_plugin,
	 *                                           type_flags);
	 *    ]|
	 *    where #new_type_plugin is an implementation of the
	 *    #GTypePlugin interface.
	 * 
	 * 2. The type's implementation is referenced, e.g. through
	 *    {@link G.type_class_ref} or through g_type_create_instance() (this is
	 *    being called by g_object_new()) or through one of the above done on
	 *    a type derived from #new_type_id.
	 * 
	 * 3. This causes the type system to load the type's implementation by
	 *    calling g_type_plugin_use() and g_type_plugin_complete_type_info()
	 *    on #new_type_plugin.
	 * 
	 * 4. At some point the type's implementation isn't required anymore,
	 *    e.g. after g_type_class_unref() or g_type_free_instance() (called
	 *    when the reference count of an instance drops to zero).
	 * 
	 * 5. This causes the type system to throw away the information retrieved
	 *    from g_type_plugin_complete_type_info() and then it calls
	 *    g_type_plugin_unuse() on #new_type_plugin.
	 * 
	 * 6. Things may repeat from the second step.
	 * 
	 * So basically, you need to implement a #GTypePlugin type that
	 * carries a use_count, once use_count goes from zero to one, you need
	 * to load the implementation to successfully handle the upcoming
	 * g_type_plugin_complete_type_info() call. Later, maybe after
	 * succeeding use/unuse calls, once use_count drops to zero, you can
	 * unload the implementation again. The type system makes sure to call
	 * g_type_plugin_use() and g_type_plugin_complete_type_info() again
	 * when the type is needed again.
	 * 
	 * #GTypeModule is an implementation of #GTypePlugin that already
	 * implements most of this except for the actual module loading and
	 * unloading. It even handles multiple registered types per module.
	 */
	interface TypePlugin extends TypePluginMixin {}

	class TypePlugin {
		public constructor(options?: Partial<TypePluginInitOptions>);
	}



	/**
	 * Flags to be passed to {@link GObject.bind_property} or
	 * g_object_bind_property_full().
	 * 
	 * This enumeration can be extended at later date.
	 */
	enum BindingFlags {
		/**
		 * The default binding; if the source property
		 *   changes, the target property is updated with its value.
		 */
		DEFAULT = 0,
		/**
		 * Bidirectional binding; if either the
		 *   property of the source or the property of the target changes,
		 *   the other is updated.
		 */
		BIDIRECTIONAL = 1,
		/**
		 * Synchronize the values of the source and
		 *   target properties when creating the binding; the direction of
		 *   the synchronization is always from the source to the target.
		 */
		SYNC_CREATE = 2,
		/**
		 * If the two properties being bound are
		 *   booleans, setting one to %TRUE will result in the other being
		 *   set to %FALSE and vice versa. This flag will only work for
		 *   boolean properties, and cannot be used when passing custom
		 *   transformation functions to {@link GObject.bind_property_full}.
		 */
		INVERT_BOOLEAN = 4
	}

	/**
	 * The connection flags are used to specify the behaviour of a signal's
	 * connection.
	 */
	enum ConnectFlags {
		/**
		 * whether the handler should be called before or after the
		 *  default handler of the signal.
		 */
		AFTER = 1,
		/**
		 * whether the instance and data should be swapped when
		 *  calling the handler; see {@link G.signal_connect_swapped} for an example.
		 */
		SWAPPED = 2
	}

	/**
	 * Through the #GParamFlags flag values, certain aspects of parameters
	 * can be configured.
	 * 
	 * See also: %G_PARAM_STATIC_STRINGS
	 */
	enum ParamFlags {
		/**
		 * the parameter is readable
		 */
		READABLE = 1,
		/**
		 * the parameter is writable
		 */
		WRITABLE = 2,
		/**
		 * alias for %G_PARAM_READABLE | %G_PARAM_WRITABLE
		 */
		READWRITE = 3,
		/**
		 * the parameter will be set upon object construction
		 */
		CONSTRUCT = 4,
		/**
		 * the parameter can only be set upon object construction
		 */
		CONSTRUCT_ONLY = 8,
		/**
		 * upon parameter conversion (see {@link G.param_value_convert})
		 *  strict validation is not required
		 */
		LAX_VALIDATION = 16,
		/**
		 * the string used as name when constructing the
		 *  parameter is guaranteed to remain valid and
		 *  unmodified for the lifetime of the parameter.
		 *  Since 2.8
		 */
		STATIC_NAME = 32,
		/**
		 * internal
		 */
		PRIVATE = 32,
		/**
		 * the string used as nick when constructing the
		 *  parameter is guaranteed to remain valid and
		 *  unmmodified for the lifetime of the parameter.
		 *  Since 2.8
		 */
		STATIC_NICK = 64,
		/**
		 * the string used as blurb when constructing the
		 *  parameter is guaranteed to remain valid and
		 *  unmodified for the lifetime of the parameter.
		 *  Since 2.8
		 */
		STATIC_BLURB = 128,
		/**
		 * calls to {@link GObject.set_property} for this
		 *   property will not automatically result in a "notify" signal being
		 *   emitted: the implementation must call g_object_notify() themselves
		 *   in case the property actually changes.  Since: 2.42.
		 */
		EXPLICIT_NOTIFY = 1073741824,
		/**
		 * the parameter is deprecated and will be removed
		 *  in a future version. A warning will be generated if it is used
		 *  while running with G_ENABLE_DIAGNOSTIC=1.
		 *  Since 2.26
		 */
		DEPRECATED = 2147483648
	}

	/**
	 * The signal flags are used to specify a signal's behaviour.
	 */
	enum SignalFlags {
		/**
		 * Invoke the object method handler in the first emission stage.
		 */
		RUN_FIRST = 1,
		/**
		 * Invoke the object method handler in the third emission stage.
		 */
		RUN_LAST = 2,
		/**
		 * Invoke the object method handler in the last emission stage.
		 */
		RUN_CLEANUP = 4,
		/**
		 * Signals being emitted for an object while currently being in
		 *  emission for this very object will not be emitted recursively,
		 *  but instead cause the first emission to be restarted.
		 */
		NO_RECURSE = 8,
		/**
		 * This signal supports "::detail" appendices to the signal name
		 *  upon handler connections and emissions.
		 */
		DETAILED = 16,
		/**
		 * Action signals are signals that may freely be emitted on alive
		 *  objects from user code via {@link G.signal_emit} and friends, without
		 *  the need of being embedded into extra code that performs pre or
		 *  post emission adjustments on the object. They can also be thought
		 *  of as object methods which can be called generically by
		 *  third-party code.
		 */
		ACTION = 32,
		/**
		 * No emissions hooks are supported for this signal.
		 */
		NO_HOOKS = 64,
		/**
		 * Varargs signal emission will always collect the
		 *   arguments, even if there are no signal handlers connected.  Since 2.30.
		 */
		MUST_COLLECT = 128,
		/**
		 * The signal is deprecated and will be removed
		 *   in a future version. A warning will be generated if it is connected while
		 *   running with G_ENABLE_DIAGNOSTIC=1.  Since 2.32.
		 */
		DEPRECATED = 256,
		/**
		 * Only used in #GSignalAccumulator accumulator
		 *   functions for the #GSignalInvocationHint::run_type field to mark the first
		 *   call to the accumulator function for a signal emission.  Since 2.68.
		 */
		ACCUMULATOR_FIRST_RUN = 131072
	}

	/**
	 * The match types specify what {@link G.signal_handlers_block_matched},
	 * g_signal_handlers_unblock_matched() and g_signal_handlers_disconnect_matched()
	 * match signals by.
	 */
	enum SignalMatchType {
		/**
		 * The signal id must be equal.
		 */
		ID = 1,
		/**
		 * The signal detail must be equal.
		 */
		DETAIL = 2,
		/**
		 * The closure must be the same.
		 */
		CLOSURE = 4,
		/**
		 * The C closure callback must be the same.
		 */
		FUNC = 8,
		/**
		 * The closure data must be the same.
		 */
		DATA = 16,
		/**
		 * Only unblocked signals may be matched.
		 */
		UNBLOCKED = 32
	}

	/**
	 * These flags used to be passed to {@link G.type_init_with_debug_flags} which
	 * is now deprecated.
	 * 
	 * If you need to enable debugging features, use the GOBJECT_DEBUG
	 * environment variable.
	 */
	enum TypeDebugFlags {
		/**
		 * Print no messages
		 */
		NONE = 0,
		/**
		 * Print messages about object bookkeeping
		 */
		OBJECTS = 1,
		/**
		 * Print messages about signal emissions
		 */
		SIGNALS = 2,
		/**
		 * Keep a count of instances of each type
		 */
		INSTANCE_COUNT = 4,
		/**
		 * Mask covering all debug flags
		 */
		MASK = 7
	}

	/**
	 * Bit masks used to check or determine characteristics of a type.
	 */
	enum TypeFlags {
		/**
		 * Indicates an abstract type. No instances can be
		 *  created for an abstract type
		 */
		ABSTRACT = 16,
		/**
		 * Indicates an abstract value type, i.e. a type
		 *  that introduces a value table, but can't be used for
		 *  {@link G.value_init}
		 */
		VALUE_ABSTRACT = 32,
		/**
		 * Indicates a final type. A final type is a non-derivable
		 *  leaf node in a deep derivable type hierarchy tree. Since: 2.70
		 */
		FINAL = 64
	}

	/**
	 * Bit masks used to check or determine specific characteristics of a
	 * fundamental type.
	 */
	enum TypeFundamentalFlags {
		/**
		 * Indicates a classed type
		 */
		CLASSED = 1,
		/**
		 * Indicates an instantiatable type (implies classed)
		 */
		INSTANTIATABLE = 2,
		/**
		 * Indicates a flat derivable type
		 */
		DERIVABLE = 4,
		/**
		 * Indicates a deep derivable type (implies derivable)
		 */
		DEEP_DERIVABLE = 8
	}

	/**
	 * A callback function used by the type system to finalize those portions
	 * of a derived types class structure that were setup from the corresponding
	 * GBaseInitFunc() function.
	 * 
	 * Class finalization basically works the inverse way in which class
	 * initialization is performed.
	 * 
	 * See GClassInitFunc() for a discussion of the class initialization process.
	 */
	interface BaseFinalizeFunc {
		/**
		 * A callback function used by the type system to finalize those portions
		 * of a derived types class structure that were setup from the corresponding
		 * GBaseInitFunc() function.
		 * 
		 * Class finalization basically works the inverse way in which class
		 * initialization is performed.
		 * 
		 * See GClassInitFunc() for a discussion of the class initialization process.
		 * @param g_class The #GTypeClass structure to finalize
		 */
		(g_class: TypeClass): void;
	}

	/**
	 * A callback function used by the type system to do base initialization
	 * of the class structures of derived types.
	 * 
	 * This function is called as part of the initialization process of all derived
	 * classes and should reallocate or reset all dynamic class members copied over
	 * from the parent class.
	 * 
	 * For example, class members (such as strings) that are not sufficiently
	 * handled by a plain memory copy of the parent class into the derived class
	 * have to be altered. See GClassInitFunc() for a discussion of the class
	 * initialization process.
	 */
	interface BaseInitFunc {
		/**
		 * A callback function used by the type system to do base initialization
		 * of the class structures of derived types.
		 * 
		 * This function is called as part of the initialization process of all derived
		 * classes and should reallocate or reset all dynamic class members copied over
		 * from the parent class.
		 * 
		 * For example, class members (such as strings) that are not sufficiently
		 * handled by a plain memory copy of the parent class into the derived class
		 * have to be altered. See GClassInitFunc() for a discussion of the class
		 * initialization process.
		 * @param g_class The #GTypeClass structure to initialize
		 */
		(g_class: TypeClass): void;
	}

	/**
	 * A function to be called to transform #from_value to #to_value.
	 * 
	 * If this is the #transform_to function of a binding, then #from_value
	 * is the #source_property on the #source object, and #to_value is the
	 * #target_property on the #target object. If this is the
	 * #transform_from function of a %G_BINDING_BIDIRECTIONAL binding,
	 * then those roles are reversed.
	 */
	interface BindingTransformFunc {
		/**
		 * A function to be called to transform #from_value to #to_value.
		 * 
		 * If this is the #transform_to function of a binding, then #from_value
		 * is the #source_property on the #source object, and #to_value is the
		 * #target_property on the #target object. If this is the
		 * #transform_from function of a %G_BINDING_BIDIRECTIONAL binding,
		 * then those roles are reversed.
		 * @param binding a #GBinding
		 * @param from_value the #GValue containing the value to transform
		 * @param to_value the #GValue in which to store the transformed value
		 * @returns %TRUE if the transformation was successful, and %FALSE
		 *   otherwise
		 */
		(binding: Binding, from_value: Value, to_value: Value): boolean;
	}

	/**
	 * This function is provided by the user and should produce a copy
	 * of the passed in boxed structure.
	 */
	interface BoxedCopyFunc {
		/**
		 * This function is provided by the user and should produce a copy
		 * of the passed in boxed structure.
		 * @param boxed The boxed structure to be copied.
		 * @returns The newly created copy of the boxed structure.
		 */
		(boxed: any): any;
	}

	/**
	 * This function is provided by the user and should free the boxed
	 * structure passed.
	 */
	interface BoxedFreeFunc {
		/**
		 * This function is provided by the user and should free the boxed
		 * structure passed.
		 * @param boxed The boxed structure to be freed.
		 */
		(boxed: any): void;
	}

	/**
	 * The type used for callback functions in structure definitions and function
	 * signatures.
	 * 
	 * This doesn't mean that all callback functions must take no  parameters and
	 * return void. The required signature of a callback function is determined by
	 * the context in which is used (e.g. the signal to which it is connected).
	 * 
	 * Use {@link G.CALLBACK} to cast the callback function to a #GCallback.
	 */
	interface Callback {
		/**
		 * The type used for callback functions in structure definitions and function
		 * signatures.
		 * 
		 * This doesn't mean that all callback functions must take no  parameters and
		 * return void. The required signature of a callback function is determined by
		 * the context in which is used (e.g. the signal to which it is connected).
		 * 
		 * Use {@link G.CALLBACK} to cast the callback function to a #GCallback.
		 */
		(): void;
	}

	/**
	 * A callback function used by the type system to finalize a class.
	 * 
	 * This function is rarely needed, as dynamically allocated class resources
	 * should be handled by GBaseInitFunc() and GBaseFinalizeFunc().
	 * 
	 * Also, specification of a GClassFinalizeFunc() in the #GTypeInfo
	 * structure of a static type is invalid, because classes of static types
	 * will never be finalized (they are artificially kept alive when their
	 * reference count drops to zero).
	 */
	interface ClassFinalizeFunc {
		/**
		 * A callback function used by the type system to finalize a class.
		 * 
		 * This function is rarely needed, as dynamically allocated class resources
		 * should be handled by GBaseInitFunc() and GBaseFinalizeFunc().
		 * 
		 * Also, specification of a GClassFinalizeFunc() in the #GTypeInfo
		 * structure of a static type is invalid, because classes of static types
		 * will never be finalized (they are artificially kept alive when their
		 * reference count drops to zero).
		 * @param g_class The #GTypeClass structure to finalize
		 * @param class_data The #class_data member supplied via the #GTypeInfo structure
		 */
		(g_class: TypeClass, class_data: any | null): void;
	}

	/**
	 * A callback function used by the type system to initialize the class
	 * of a specific type.
	 * 
	 * This function should initialize all static class members.
	 * 
	 * The initialization process of a class involves:
	 * 
	 * - Copying common members from the parent class over to the
	 *   derived class structure.
	 * - Zero initialization of the remaining members not copied
	 *   over from the parent class.
	 * - Invocation of the GBaseInitFunc() initializers of all parent
	 *   types and the class' type.
	 * - Invocation of the class' GClassInitFunc() initializer.
	 * 
	 * Since derived classes are partially initialized through a memory copy
	 * of the parent class, the general rule is that GBaseInitFunc() and
	 * GBaseFinalizeFunc() should take care of necessary reinitialization
	 * and release of those class members that were introduced by the type
	 * that specified these GBaseInitFunc()/GBaseFinalizeFunc().
	 * GClassInitFunc() should only care about initializing static
	 * class members, while dynamic class members (such as allocated strings
	 * or reference counted resources) are better handled by a GBaseInitFunc()
	 * for this type, so proper initialization of the dynamic class members
	 * is performed for class initialization of derived types as well.
	 * 
	 * An example may help to correspond the intend of the different class
	 * initializers:
	 * 
	 * |[<!-- language="C" -->
	 * typedef struct {
	 *   GObjectClass parent_class;
	 *   gint         static_integer;
	 *   gchar       *dynamic_string;
	 * } TypeAClass;
	 * static void
	 * type_a_base_class_init (TypeAClass *class)
	 * {
	 *   class->dynamic_string = g_strdup ("some string");
	 * }
	 * static void
	 * type_a_base_class_finalize (TypeAClass *class)
	 * {
	 *   g_free (class->dynamic_string);
	 * }
	 * static void
	 * type_a_class_init (TypeAClass *class)
	 * {
	 *   class->static_integer = 42;
	 * }
	 * 
	 * typedef struct {
	 *   TypeAClass   parent_class;
	 *   gfloat       static_float;
	 *   GString     *dynamic_gstring;
	 * } TypeBClass;
	 * static void
	 * type_b_base_class_init (TypeBClass *class)
	 * {
	 *   class->dynamic_gstring = g_string_new ("some other string");
	 * }
	 * static void
	 * type_b_base_class_finalize (TypeBClass *class)
	 * {
	 *   g_string_free (class->dynamic_gstring);
	 * }
	 * static void
	 * type_b_class_init (TypeBClass *class)
	 * {
	 *   class->static_float = 3.14159265358979323846;
	 * }
	 * ]|
	 * 
	 * Initialization of TypeBClass will first cause initialization of
	 * TypeAClass (derived classes reference their parent classes, see
	 * g_type_class_ref() on this).
	 * 
	 * Initialization of TypeAClass roughly involves zero-initializing its fields,
	 * then calling its GBaseInitFunc() type_a_base_class_init() to allocate
	 * its dynamic members (dynamic_string), and finally calling its GClassInitFunc()
	 * type_a_class_init() to initialize its static members (static_integer).
	 * The first step in the initialization process of TypeBClass is then
	 * a plain memory copy of the contents of TypeAClass into TypeBClass and
	 * zero-initialization of the remaining fields in TypeBClass.
	 * The dynamic members of TypeAClass within TypeBClass now need
	 * reinitialization which is performed by calling type_a_base_class_init()
	 * with an argument of TypeBClass.
	 * 
	 * After that, the GBaseInitFunc() of TypeBClass, type_b_base_class_init()
	 * is called to allocate the dynamic members of TypeBClass (dynamic_gstring),
	 * and finally the GClassInitFunc() of TypeBClass, type_b_class_init(),
	 * is called to complete the initialization process with the static members
	 * (static_float).
	 * 
	 * Corresponding finalization counter parts to the GBaseInitFunc() functions
	 * have to be provided to release allocated resources at class finalization
	 * time.
	 */
	interface ClassInitFunc {
		/**
		 * A callback function used by the type system to initialize the class
		 * of a specific type.
		 * 
		 * This function should initialize all static class members.
		 * 
		 * The initialization process of a class involves:
		 * 
		 * - Copying common members from the parent class over to the
		 *   derived class structure.
		 * - Zero initialization of the remaining members not copied
		 *   over from the parent class.
		 * - Invocation of the GBaseInitFunc() initializers of all parent
		 *   types and the class' type.
		 * - Invocation of the class' GClassInitFunc() initializer.
		 * 
		 * Since derived classes are partially initialized through a memory copy
		 * of the parent class, the general rule is that GBaseInitFunc() and
		 * GBaseFinalizeFunc() should take care of necessary reinitialization
		 * and release of those class members that were introduced by the type
		 * that specified these GBaseInitFunc()/GBaseFinalizeFunc().
		 * GClassInitFunc() should only care about initializing static
		 * class members, while dynamic class members (such as allocated strings
		 * or reference counted resources) are better handled by a GBaseInitFunc()
		 * for this type, so proper initialization of the dynamic class members
		 * is performed for class initialization of derived types as well.
		 * 
		 * An example may help to correspond the intend of the different class
		 * initializers:
		 * 
		 * |[<!-- language="C" -->
		 * typedef struct {
		 *   GObjectClass parent_class;
		 *   gint         static_integer;
		 *   gchar       *dynamic_string;
		 * } TypeAClass;
		 * static void
		 * type_a_base_class_init (TypeAClass *class)
		 * {
		 *   class->dynamic_string = g_strdup ("some string");
		 * }
		 * static void
		 * type_a_base_class_finalize (TypeAClass *class)
		 * {
		 *   g_free (class->dynamic_string);
		 * }
		 * static void
		 * type_a_class_init (TypeAClass *class)
		 * {
		 *   class->static_integer = 42;
		 * }
		 * 
		 * typedef struct {
		 *   TypeAClass   parent_class;
		 *   gfloat       static_float;
		 *   GString     *dynamic_gstring;
		 * } TypeBClass;
		 * static void
		 * type_b_base_class_init (TypeBClass *class)
		 * {
		 *   class->dynamic_gstring = g_string_new ("some other string");
		 * }
		 * static void
		 * type_b_base_class_finalize (TypeBClass *class)
		 * {
		 *   g_string_free (class->dynamic_gstring);
		 * }
		 * static void
		 * type_b_class_init (TypeBClass *class)
		 * {
		 *   class->static_float = 3.14159265358979323846;
		 * }
		 * ]|
		 * 
		 * Initialization of TypeBClass will first cause initialization of
		 * TypeAClass (derived classes reference their parent classes, see
		 * g_type_class_ref() on this).
		 * 
		 * Initialization of TypeAClass roughly involves zero-initializing its fields,
		 * then calling its GBaseInitFunc() type_a_base_class_init() to allocate
		 * its dynamic members (dynamic_string), and finally calling its GClassInitFunc()
		 * type_a_class_init() to initialize its static members (static_integer).
		 * The first step in the initialization process of TypeBClass is then
		 * a plain memory copy of the contents of TypeAClass into TypeBClass and
		 * zero-initialization of the remaining fields in TypeBClass.
		 * The dynamic members of TypeAClass within TypeBClass now need
		 * reinitialization which is performed by calling type_a_base_class_init()
		 * with an argument of TypeBClass.
		 * 
		 * After that, the GBaseInitFunc() of TypeBClass, type_b_base_class_init()
		 * is called to allocate the dynamic members of TypeBClass (dynamic_gstring),
		 * and finally the GClassInitFunc() of TypeBClass, type_b_class_init(),
		 * is called to complete the initialization process with the static members
		 * (static_float).
		 * 
		 * Corresponding finalization counter parts to the GBaseInitFunc() functions
		 * have to be provided to release allocated resources at class finalization
		 * time.
		 * @param g_class The #GTypeClass structure to initialize.
		 * @param class_data The #class_data member supplied via the #GTypeInfo structure.
		 */
		(g_class: TypeClass, class_data: any | null): void;
	}

	/**
	 * The type used for marshaller functions.
	 */
	interface ClosureMarshal {
		/**
		 * The type used for marshaller functions.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param n_param_values the length of the #param_values array
		 * @param param_values an array of
		 *  #GValues holding the arguments on which to invoke the
		 *  callback of #closure
		 * @param invocation_hint the invocation hint given as the
		 *  last argument to {@link G.closure_invoke}
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 */
		(closure: Closure, return_value: Value | null, n_param_values: number, param_values: Value[], invocation_hint: any | null, marshal_data: any | null): void;
	}

	/**
	 * The type used for the various notification callbacks which can be registered
	 * on closures.
	 */
	interface ClosureNotify {
		/**
		 * The type used for the various notification callbacks which can be registered
		 * on closures.
		 * @param data data specified when registering the notification callback
		 * @param closure the #GClosure on which the notification is emitted
		 */
		(data: any | null, closure: Closure): void;
	}

	/**
	 * A callback function used by the type system to initialize a new
	 * instance of a type.
	 * 
	 * This function initializes all instance members and allocates any resources
	 * required by it.
	 * 
	 * Initialization of a derived instance involves calling all its parent
	 * types instance initializers, so the class member of the instance
	 * is altered during its initialization to always point to the class that
	 * belongs to the type the current initializer was introduced for.
	 * 
	 * The extended members of #instance are guaranteed to have been filled with
	 * zeros before this function is called.
	 */
	interface InstanceInitFunc {
		/**
		 * A callback function used by the type system to initialize a new
		 * instance of a type.
		 * 
		 * This function initializes all instance members and allocates any resources
		 * required by it.
		 * 
		 * Initialization of a derived instance involves calling all its parent
		 * types instance initializers, so the class member of the instance
		 * is altered during its initialization to always point to the class that
		 * belongs to the type the current initializer was introduced for.
		 * 
		 * The extended members of #instance are guaranteed to have been filled with
		 * zeros before this function is called.
		 * @param instance The instance to initialize
		 * @param g_class The class of the type the instance is
		 *    created for
		 */
		(instance: TypeInstance, g_class: TypeClass): void;
	}

	/**
	 * A callback function used by the type system to finalize an interface.
	 * 
	 * This function should destroy any internal data and release any resources
	 * allocated by the corresponding GInterfaceInitFunc() function.
	 */
	interface InterfaceFinalizeFunc {
		/**
		 * A callback function used by the type system to finalize an interface.
		 * 
		 * This function should destroy any internal data and release any resources
		 * allocated by the corresponding GInterfaceInitFunc() function.
		 * @param g_iface The interface structure to finalize
		 * @param iface_data The #interface_data supplied via the #GInterfaceInfo structure
		 */
		(g_iface: TypeInterface, iface_data: any | null): void;
	}

	/**
	 * A callback function used by the type system to initialize a new
	 * interface.
	 * 
	 * This function should initialize all internal data and* allocate any
	 * resources required by the interface.
	 * 
	 * The members of #iface_data are guaranteed to have been filled with
	 * zeros before this function is called.
	 */
	interface InterfaceInitFunc {
		/**
		 * A callback function used by the type system to initialize a new
		 * interface.
		 * 
		 * This function should initialize all internal data and* allocate any
		 * resources required by the interface.
		 * 
		 * The members of #iface_data are guaranteed to have been filled with
		 * zeros before this function is called.
		 * @param g_iface The interface structure to initialize
		 * @param iface_data The #interface_data supplied via the #GInterfaceInfo structure
		 */
		(g_iface: TypeInterface, iface_data: any | null): void;
	}

	/**
	 * The type of the #finalize function of {@link Class}.
	 */
	interface ObjectFinalizeFunc {
		/**
		 * The type of the #finalize function of {@link Class}.
		 * @param object the #GObject being finalized
		 */
		(object: Object): void;
	}

	/**
	 * The type of the #get_property function of {@link Class}.
	 */
	interface ObjectGetPropertyFunc {
		/**
		 * The type of the #get_property function of {@link Class}.
		 * @param object a #GObject
		 * @param property_id the numeric id under which the property was registered with
		 *  {@link GObject.class_install_property}.
		 * @param value a #GValue to return the property value in
		 * @param pspec the #GParamSpec describing the property
		 */
		(object: Object, property_id: number, value: Value, pspec: ParamSpec): void;
	}

	/**
	 * The type of the #set_property function of {@link Class}.
	 */
	interface ObjectSetPropertyFunc {
		/**
		 * The type of the #set_property function of {@link Class}.
		 * @param object a #GObject
		 * @param property_id the numeric id under which the property was registered with
		 *  {@link GObject.class_install_property}.
		 * @param value the new value for the property
		 * @param pspec the #GParamSpec describing the property
		 */
		(object: Object, property_id: number, value: Value, pspec: ParamSpec): void;
	}

	/**
	 * The signal accumulator is a special callback function that can be used
	 * to collect return values of the various callbacks that are called
	 * during a signal emission.
	 * 
	 * The signal accumulator is specified at signal creation time, if it is
	 * left %NULL, no accumulation of callback return values is performed.
	 * The return value of signal emissions is then the value returned by the
	 * last callback.
	 */
	interface SignalAccumulator {
		/**
		 * The signal accumulator is a special callback function that can be used
		 * to collect return values of the various callbacks that are called
		 * during a signal emission.
		 * 
		 * The signal accumulator is specified at signal creation time, if it is
		 * left %NULL, no accumulation of callback return values is performed.
		 * The return value of signal emissions is then the value returned by the
		 * last callback.
		 * @param ihint Signal invocation hint, see #GSignalInvocationHint.
		 * @param return_accu Accumulator to collect callback return values in, this
		 *  is the return value of the current signal emission.
		 * @param handler_return A #GValue holding the return value of the signal handler.
		 * @param data Callback data that was specified when creating the signal.
		 * @returns The accumulator function returns whether the signal emission
		 *  should be aborted. Returning %TRUE will continue with
		 *  the signal emission. Returning %FALSE will abort the current emission.
		 *  Since 2.62, returning %FALSE will skip to the CLEANUP stage. In this case,
		 *  emission will occur as normal in the CLEANUP stage and the handler's
		 *  return value will be accumulated.
		 */
		(ihint: SignalInvocationHint, return_accu: Value, handler_return: Value, data: any | null): boolean;
	}

	/**
	 * A simple function pointer to get invoked when the signal is emitted.
	 * 
	 * Emission hooks allow you to tie a hook to the signal type, so that it will
	 * trap all emissions of that signal, from any object.
	 * 
	 * You may not attach these to signals created with the #G_SIGNAL_NO_HOOKS flag.
	 */
	interface SignalEmissionHook {
		/**
		 * A simple function pointer to get invoked when the signal is emitted.
		 * 
		 * Emission hooks allow you to tie a hook to the signal type, so that it will
		 * trap all emissions of that signal, from any object.
		 * 
		 * You may not attach these to signals created with the #G_SIGNAL_NO_HOOKS flag.
		 * @param ihint Signal invocation hint, see #GSignalInvocationHint.
		 * @param n_param_values the number of parameters to the function, including
		 *  the instance on which the signal was emitted.
		 * @param param_values the instance on which
		 *  the signal was emitted, followed by the parameters of the emission.
		 * @param data user data associated with the hook.
		 * @returns whether it wants to stay connected. If it returns %FALSE, the signal
		 *  hook is disconnected (and destroyed).
		 */
		(ihint: SignalInvocationHint, n_param_values: number, param_values: Value[], data: any | null): boolean;
	}

	/**
	 * A callback function used for notification when the state
	 * of a toggle reference changes.
	 * 
	 * See also: {@link GObject.add_toggle_ref}
	 */
	interface ToggleNotify {
		/**
		 * A callback function used for notification when the state
		 * of a toggle reference changes.
		 * 
		 * See also: {@link GObject.add_toggle_ref}
		 * @param data Callback data passed to {@link GObject.add_toggle_ref}
		 * @param object The object on which {@link GObject.add_toggle_ref} was called.
		 * @param is_last_ref %TRUE if the toggle reference is now the
		 *  last reference to the object. %FALSE if the toggle
		 *  reference was the last reference and there are now other
		 *  references.
		 */
		(data: any | null, object: Object, is_last_ref: boolean): void;
	}

	/**
	 * A callback function which is called when the reference count of a class
	 * drops to zero.
	 * 
	 * It may use {@link G.type_class_ref} to prevent the class from being freed. You
	 * should not call g_type_class_unref() from a #GTypeClassCacheFunc function
	 * to prevent infinite recursion, use g_type_class_unref_uncached() instead.
	 * 
	 * The functions have to check the class id passed in to figure
	 * whether they actually want to cache the class of this type, since all
	 * classes are routed through the same #GTypeClassCacheFunc chain.
	 */
	interface TypeClassCacheFunc {
		/**
		 * A callback function which is called when the reference count of a class
		 * drops to zero.
		 * 
		 * It may use {@link G.type_class_ref} to prevent the class from being freed. You
		 * should not call g_type_class_unref() from a #GTypeClassCacheFunc function
		 * to prevent infinite recursion, use g_type_class_unref_uncached() instead.
		 * 
		 * The functions have to check the class id passed in to figure
		 * whether they actually want to cache the class of this type, since all
		 * classes are routed through the same #GTypeClassCacheFunc chain.
		 * @param cache_data data that was given to the {@link G.type_add_class_cache_func} call
		 * @param g_class The #GTypeClass structure which is
		 *    unreferenced
		 * @returns %TRUE to stop further #GTypeClassCacheFuncs from being
		 *  called, %FALSE to continue
		 */
		(cache_data: any | null, g_class: TypeClass): boolean;
	}

	/**
	 * A callback called after an interface vtable is initialized.
	 * 
	 * See {@link G.type_add_interface_check}.
	 */
	interface TypeInterfaceCheckFunc {
		/**
		 * A callback called after an interface vtable is initialized.
		 * 
		 * See {@link G.type_add_interface_check}.
		 * @param check_data data passed to {@link G.type_add_interface_check}
		 * @param g_iface the interface that has been
		 *    initialized
		 */
		(check_data: any | null, g_iface: TypeInterface): void;
	}

	/**
	 * The type of the #complete_interface_info function of #GTypePluginClass.
	 */
	interface TypePluginCompleteInterfaceInfo {
		/**
		 * The type of the #complete_interface_info function of #GTypePluginClass.
		 * @param plugin the #GTypePlugin
		 * @param instance_type the #GType of an instantiatable type to which the interface
		 *  is added
		 * @param interface_type the #GType of the interface whose info is completed
		 * @param info the #GInterfaceInfo to fill in
		 */
		(plugin: TypePlugin, instance_type: GObject.Type, interface_type: GObject.Type, info: InterfaceInfo): void;
	}

	/**
	 * The type of the #complete_type_info function of #GTypePluginClass.
	 */
	interface TypePluginCompleteTypeInfo {
		/**
		 * The type of the #complete_type_info function of #GTypePluginClass.
		 * @param plugin the #GTypePlugin
		 * @param g_type the #GType whose info is completed
		 * @param info the #GTypeInfo struct to fill in
		 * @param value_table the #GTypeValueTable to fill in
		 */
		(plugin: TypePlugin, g_type: GObject.Type, info: TypeInfo, value_table: TypeValueTable): void;
	}

	/**
	 * The type of the #unuse_plugin function of #GTypePluginClass.
	 */
	interface TypePluginUnuse {
		/**
		 * The type of the #unuse_plugin function of #GTypePluginClass.
		 * @param plugin the #GTypePlugin whose use count should be decreased
		 */
		(plugin: TypePlugin): void;
	}

	/**
	 * The type of the #use_plugin function of #GTypePluginClass, which gets called
	 * to increase the use count of #plugin.
	 */
	interface TypePluginUse {
		/**
		 * The type of the #use_plugin function of #GTypePluginClass, which gets called
		 * to increase the use count of #plugin.
		 * @param plugin the #GTypePlugin whose use count should be increased
		 */
		(plugin: TypePlugin): void;
	}

	/**
	 * This is the signature of va_list marshaller functions, an optional
	 * marshaller that can be used in some situations to avoid
	 * marshalling the signal argument into GValues.
	 */
	interface VaClosureMarshal {
		/**
		 * This is the signature of va_list marshaller functions, an optional
		 * marshaller that can be used in some situations to avoid
		 * marshalling the signal argument into GValues.
		 * @param closure the #GClosure to which the marshaller belongs
		 * @param return_value a #GValue to store the return
		 *  value. May be %NULL if the callback of #closure doesn't return a
		 *  value.
		 * @param instance the instance on which the closure is
		 *  invoked.
		 * @param args va_list of arguments to be passed to the closure.
		 * @param marshal_data additional data specified when
		 *  registering the marshaller, see {@link G.closure_set_marshal} and
		 *  g_closure_set_meta_marshal()
		 * @param n_params the length of the #param_types array
		 * @param param_types the #GType of each argument from
		 *  #args.
		 */
		(closure: Closure, return_value: Value | null, instance: TypeInstance, args: any[], marshal_data: any | null, n_params: number, param_types: GObject.Type[]): void;
	}

	/**
	 * The type of value transformation functions which can be registered with
	 * {@link G.value_register_transform_func}.
	 * 
	 * #dest_value will be initialized to the correct destination type.
	 */
	interface ValueTransform {
		/**
		 * The type of value transformation functions which can be registered with
		 * {@link G.value_register_transform_func}.
		 * 
		 * #dest_value will be initialized to the correct destination type.
		 * @param src_value Source value.
		 * @param dest_value Target value.
		 */
		(src_value: Value, dest_value: Value): void;
	}

	/**
	 * A #GWeakNotify function can be added to an object as a callback that gets
	 * triggered when the object is finalized.
	 * 
	 * Since the object is already being disposed when the #GWeakNotify is called,
	 * there's not much you could do with the object, apart from e.g. using its
	 * address as hash-index or the like.
	 */
	interface WeakNotify {
		/**
		 * A #GWeakNotify function can be added to an object as a callback that gets
		 * triggered when the object is finalized.
		 * 
		 * Since the object is already being disposed when the #GWeakNotify is called,
		 * there's not much you could do with the object, apart from e.g. using its
		 * address as hash-index or the like.
		 * @param data data that was provided when the weak reference was established
		 * @param where_the_object_was the object being disposed
		 */
		(data: any | null, where_the_object_was: Object): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TypeCValue} instead.
	 */
	interface ITypeCValue {

	}

	type TypeCValueInitOptionsMixin  = {};
	export interface TypeCValueInitOptions extends TypeCValueInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TypeCValue} instead.
	 */
	type TypeCValueMixin = ITypeCValue;

	interface TypeCValue extends TypeCValueMixin {}

	class TypeCValue {
		public constructor(options?: Partial<TypeCValueInitOptions>);
	}


	/** This construct is only for enabling class multi-inheritance,
	 * use {@link _Value__data__union} instead.
	 */
	interface I_Value__data__union {
		v_int: number;
		v_uint: number;
		v_long: number;
		v_ulong: number;
		v_int64: number;
		v_uint64: number;
		v_float: number;
		v_double: number;
		v_pointer: any;

		connect(signal: "notify::v_int", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_uint", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_long", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_ulong", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_int64", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_uint64", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_float", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_double", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_pointer", callback: (owner: this, ...args: any) => void): number;

	}

	type _Value__data__unionInitOptionsMixin = Pick<I_Value__data__union,
		"v_int" |
		"v_uint" |
		"v_long" |
		"v_ulong" |
		"v_int64" |
		"v_uint64" |
		"v_float" |
		"v_double" |
		"v_pointer">;

	export interface _Value__data__unionInitOptions extends _Value__data__unionInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link _Value__data__union} instead.
	 */
	type _Value__data__unionMixin = I_Value__data__union;

	interface _Value__data__union extends _Value__data__unionMixin {}

	class _Value__data__union {
		public constructor(options?: Partial<_Value__data__unionInitOptions>);
	}


	/**
	 * This is the signature of marshaller functions, required to marshall
	 * arrays of parameter values to signal emissions into C language callback
	 * invocations.
	 * 
	 * It is merely an alias to #GClosureMarshal since the #GClosure mechanism
	 * takes over responsibility of actual function invocation for the signal
	 * system.
	 */
	type SignalCMarshaller = ClosureMarshal;

	/**
	 * This is the signature of va_list marshaller functions, an optional
	 * marshaller that can be used in some situations to avoid
	 * marshalling the signal argument into GValues.
	 */
	type SignalCVaMarshaller = VaClosureMarshal;

	/**
	 * A numerical value which represents the unique identifier of a registered
	 * type.
	 */
	type Type = number;

	/**
	 * Provide a copy of a boxed structure #src_boxed which is of type #boxed_type.
	 * @param boxed_type The type of #src_boxed.
	 * @param src_boxed The boxed structure to be copied.
	 * @returns The newly created copy of the boxed
	 *    structure.
	 */
	function boxed_copy(boxed_type: GObject.Type, src_boxed: any): any;

	/**
	 * Free the boxed structure #boxed which is of type #boxed_type.
	 * @param boxed_type The type of #boxed.
	 * @param boxed The boxed structure to be freed.
	 */
	function boxed_free(boxed_type: GObject.Type, boxed: any): void;

	/**
	 * This function creates a new %G_TYPE_BOXED derived type id for a new
	 * boxed type with name #name.
	 * 
	 * Boxed type handling functions have to be provided to copy and free
	 * opaque boxed structures of this type.
	 * 
	 * For the general case, it is recommended to use #G_DEFINE_BOXED_TYPE
	 * instead of calling {@link G.boxed_type_register_static} directly. The macro
	 * will create the appropriate `*_get_type()` function for the boxed type.
	 * @param name Name of the new boxed type.
	 * @param boxed_copy Boxed structure copy function.
	 * @param boxed_free Boxed structure free function.
	 * @returns New %G_TYPE_BOXED derived type id for #name.
	 */
	function boxed_type_register_static(name: string, boxed_copy: BoxedCopyFunc, boxed_free: BoxedFreeFunc): GObject.Type;

	/**
	 * A #GClosureMarshal function for use with signals with handlers that
	 * take two boxed pointers as arguments and return a boolean.  If you
	 * have such a signal, you will probably also need to use an
	 * accumulator, such as {@link G.signal_accumulator_true_handled}.
	 * @param closure A #GClosure.
	 * @param return_value A #GValue to store the return value. May be %NULL
	 *   if the callback of closure doesn't return a value.
	 * @param n_param_values The length of the #param_values array.
	 * @param param_values An array of #GValues holding the arguments
	 *   on which to invoke the callback of closure.
	 * @param invocation_hint The invocation hint given as the last argument to
	 *   {@link G.closure_invoke}.
	 * @param marshal_data Additional data specified when registering the
	 *   marshaller, see {@link G.closure_set_marshal} and
	 *   g_closure_set_meta_marshal()
	 */
	function cclosure_marshal_BOOLEAN__BOXED_BOXED(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `gboolean (*callback) (gpointer instance, gint arg1, gpointer user_data)` where the #gint parameter
	 * denotes a flags type.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value a #GValue which can store the returned #gboolean
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding instance and arg1
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_BOOLEAN__FLAGS(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `gchar* (*callback) (gpointer instance, GObject *arg1, gpointer arg2, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value a #GValue, which can store the returned string
	 * @param n_param_values 3
	 * @param param_values a #GValue array holding instance, arg1 and arg2
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_STRING__OBJECT_POINTER(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, gboolean arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #gboolean parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__BOOLEAN(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, GBoxed *arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #GBoxed* parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__BOXED(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, gchar arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #gchar parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__CHAR(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, gdouble arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #gdouble parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__DOUBLE(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, gint arg1, gpointer user_data)` where the #gint parameter denotes an enumeration type..
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the enumeration parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__ENUM(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, gint arg1, gpointer user_data)` where the #gint parameter denotes a flags type.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the flags parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__FLAGS(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, gfloat arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #gfloat parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__FLOAT(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, gint arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #gint parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__INT(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, glong arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #glong parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__LONG(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, GObject *arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #GObject* parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__OBJECT(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, GParamSpec *arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #GParamSpec* parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__PARAM(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, gpointer arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #gpointer parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__POINTER(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, const gchar *arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #gchar* parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__STRING(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, guchar arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #guchar parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__UCHAR(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, guint arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #guint parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__UINT(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, guint arg1, gpointer arg2, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 3
	 * @param param_values a #GValue array holding instance, arg1 and arg2
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__UINT_POINTER(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, gulong arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #gulong parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__ULONG(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, GVariant *arg1, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 2
	 * @param param_values a #GValue array holding the instance and the #GVariant* parameter
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__VARIANT(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A marshaller for a #GCClosure with a callback of type
	 * `void (*callback) (gpointer instance, gpointer user_data)`.
	 * @param closure the #GClosure to which the marshaller belongs
	 * @param return_value ignored
	 * @param n_param_values 1
	 * @param param_values a #GValue array holding only the instance
	 * @param invocation_hint the invocation hint given as the last argument
	 *  to {@link G.closure_invoke}
	 * @param marshal_data additional data specified when registering the marshaller
	 */
	function cclosure_marshal_VOID__VOID(closure: Closure, return_value: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * A generic marshaller function implemented via
	 * [libffi](http://sourceware.org/libffi/).
	 * 
	 * Normally this function is not passed explicitly to {@link G.signal_new},
	 * but used automatically by GLib when specifying a %NULL marshaller.
	 * @param closure A #GClosure.
	 * @param return_gvalue A #GValue to store the return value. May be %NULL
	 *   if the callback of closure doesn't return a value.
	 * @param n_param_values The length of the #param_values array.
	 * @param param_values An array of #GValues holding the arguments
	 *   on which to invoke the callback of closure.
	 * @param invocation_hint The invocation hint given as the last argument to
	 *   {@link G.closure_invoke}.
	 * @param marshal_data Additional data specified when registering the
	 *   marshaller, see {@link G.closure_set_marshal} and
	 *   g_closure_set_meta_marshal()
	 */
	function cclosure_marshal_generic(closure: Closure, return_gvalue: Value, n_param_values: number, param_values: Value, invocation_hint: any | null, marshal_data: any | null): void;

	/**
	 * Creates a new closure which invokes #callback_func with #user_data as
	 * the last parameter.
	 * 
	 * #destroy_data will be called as a finalize notifier on the #GClosure.
	 * @param callback_func the function to invoke
	 * @param destroy_data destroy notify to be called when #user_data is no longer used
	 * @returns a floating reference to a new #GCClosure
	 */
	function cclosure_new(callback_func: Callback | null, destroy_data: ClosureNotify): Closure;

	/**
	 * A variant of {@link G.cclosure_new} which uses #object as #user_data and
	 * calls g_object_watch_closure() on #object and the created
	 * closure. This function is useful when you have a callback closely
	 * associated with a #GObject, and want the callback to no longer run
	 * after the object is is freed.
	 * @param callback_func the function to invoke
	 * @param object a #GObject pointer to pass to #callback_func
	 * @returns a new #GCClosure
	 */
	function cclosure_new_object(callback_func: Callback, object: Object): Closure;

	/**
	 * A variant of {@link G.cclosure_new_swap} which uses #object as #user_data
	 * and calls g_object_watch_closure() on #object and the created
	 * closure. This function is useful when you have a callback closely
	 * associated with a #GObject, and want the callback to no longer run
	 * after the object is is freed.
	 * @param callback_func the function to invoke
	 * @param object a #GObject pointer to pass to #callback_func
	 * @returns a new #GCClosure
	 */
	function cclosure_new_object_swap(callback_func: Callback, object: Object): Closure;

	/**
	 * Creates a new closure which invokes #callback_func with #user_data as
	 * the first parameter.
	 * 
	 * #destroy_data will be called as a finalize notifier on the #GClosure.
	 * @param callback_func the function to invoke
	 * @param destroy_data destroy notify to be called when #user_data is no longer used
	 * @returns a floating reference to a new #GCClosure
	 */
	function cclosure_new_swap(callback_func: Callback | null, destroy_data: ClosureNotify): Closure;

	/**
	 * Clears a reference to a #GObject.
	 * 
	 * #object_ptr must not be %NULL.
	 * 
	 * If the reference is %NULL then this function does nothing.
	 * Otherwise, the reference count of the object is decreased and the
	 * pointer is set to %NULL.
	 * 
	 * A macro is also included that allows this function to be used without
	 * pointer casts.
	 * @param object_ptr a pointer to a #GObject reference
	 */
	function clear_object(object_ptr: Object): void;

	/**
	 * Disconnects a handler from #instance so it will not be called during
	 * any future or currently ongoing emissions of the signal it has been
	 * connected to. The #handler_id_ptr is then set to zero, which is never a valid handler ID value (see {@link G.signal_connect}).
	 * 
	 * If the handler ID is 0 then this function does nothing.
	 * 
	 * There is also a macro version of this function so that the code
	 * will be inlined.
	 * @param handler_id_ptr A pointer to a handler ID (of type #gulong) of the handler to be disconnected.
	 * @param instance The instance to remove the signal handler from.
	 *   This pointer may be %NULL or invalid, if the handler ID is zero.
	 */
	function clear_signal_handler(handler_id_ptr: number, instance: Object): void;

	/**
	 * This function is meant to be called from the `complete_type_info`
	 * function of a #GTypePlugin implementation, as in the following
	 * example:
	 * 
	 * |[<!-- language="C" -->
	 * static void
	 * my_enum_complete_type_info (GTypePlugin     *plugin,
	 *                             GType            g_type,
	 *                             GTypeInfo       *info,
	 *                             GTypeValueTable *value_table)
	 * {
	 *   static const GEnumValue values[] = {
	 *     { MY_ENUM_FOO, "MY_ENUM_FOO", "foo" },
	 *     { MY_ENUM_BAR, "MY_ENUM_BAR", "bar" },
	 *     { 0, NULL, NULL }
	 *   };
	 * 
	 *   g_enum_complete_type_info (type, info, values);
	 * }
	 * ]|
	 * @param g_enum_type the type identifier of the type being completed
	 * @param const_values An array of #GEnumValue structs for the possible
	 *  enumeration values. The array is terminated by a struct with all
	 *  members being 0.
	 * @returns the #GTypeInfo struct to be filled in
	 */
	function enum_complete_type_info(g_enum_type: GObject.Type, const_values: EnumValue): TypeInfo;

	/**
	 * Returns the #GEnumValue for a value.
	 * @param enum_class a #GEnumClass
	 * @param value the value to look up
	 * @returns the #GEnumValue for #value, or %NULL
	 *          if #value is not a member of the enumeration
	 */
	function enum_get_value(enum_class: EnumClass, value: number): EnumValue | null;

	/**
	 * Looks up a #GEnumValue by name.
	 * @param enum_class a #GEnumClass
	 * @param name the name to look up
	 * @returns the #GEnumValue with name #name,
	 *          or %NULL if the enumeration doesn't have a member
	 *          with that name
	 */
	function enum_get_value_by_name(enum_class: EnumClass, name: string): EnumValue | null;

	/**
	 * Looks up a #GEnumValue by nickname.
	 * @param enum_class a #GEnumClass
	 * @param nick the nickname to look up
	 * @returns the #GEnumValue with nickname #nick,
	 *          or %NULL if the enumeration doesn't have a member
	 *          with that nickname
	 */
	function enum_get_value_by_nick(enum_class: EnumClass, nick: string): EnumValue | null;

	/**
	 * Registers a new static enumeration type with the name #name.
	 * 
	 * It is normally more convenient to let [glib-mkenums][glib-mkenums],
	 * generate a {@link My.enum_get_type} function from a usual C enumeration
	 * definition  than to write one yourself using g_enum_register_static().
	 * @param name A nul-terminated string used as the name of the new type.
	 * @param const_static_values An array of #GEnumValue structs for the possible
	 *  enumeration values. The array is terminated by a struct with all
	 *  members being 0. GObject keeps a reference to the data, so it cannot
	 *  be stack-allocated.
	 * @returns The new type identifier.
	 */
	function enum_register_static(name: string, const_static_values: EnumValue): GObject.Type;

	/**
	 * Pretty-prints #value in the form of the enum’s name.
	 * 
	 * This is intended to be used for debugging purposes. The format of the output
	 * may change in the future.
	 * @param g_enum_type the type identifier of a #GEnumClass type
	 * @param value the value
	 * @returns a newly-allocated text string
	 */
	function enum_to_string(g_enum_type: GObject.Type, value: number): string;

	/**
	 * This function is meant to be called from the {@link Complete.type_info}
	 * function of a #GTypePlugin implementation, see the example for
	 * g_enum_complete_type_info() above.
	 * @param g_flags_type the type identifier of the type being completed
	 * @param const_values An array of #GFlagsValue structs for the possible
	 *  enumeration values. The array is terminated by a struct with all
	 *  members being 0.
	 * @returns the #GTypeInfo struct to be filled in
	 */
	function flags_complete_type_info(g_flags_type: GObject.Type, const_values: FlagsValue): TypeInfo;

	/**
	 * Returns the first #GFlagsValue which is set in #value.
	 * @param flags_class a #GFlagsClass
	 * @param value the value
	 * @returns the first #GFlagsValue which is set in
	 *          #value, or %NULL if none is set
	 */
	function flags_get_first_value(flags_class: FlagsClass, value: number): FlagsValue | null;

	/**
	 * Looks up a #GFlagsValue by name.
	 * @param flags_class a #GFlagsClass
	 * @param name the name to look up
	 * @returns the #GFlagsValue with name #name,
	 *          or %NULL if there is no flag with that name
	 */
	function flags_get_value_by_name(flags_class: FlagsClass, name: string): FlagsValue | null;

	/**
	 * Looks up a #GFlagsValue by nickname.
	 * @param flags_class a #GFlagsClass
	 * @param nick the nickname to look up
	 * @returns the #GFlagsValue with nickname #nick,
	 *          or %NULL if there is no flag with that nickname
	 */
	function flags_get_value_by_nick(flags_class: FlagsClass, nick: string): FlagsValue | null;

	/**
	 * Registers a new static flags type with the name #name.
	 * 
	 * It is normally more convenient to let [glib-mkenums][glib-mkenums]
	 * generate a {@link My.flags_get_type} function from a usual C enumeration
	 * definition than to write one yourself using g_flags_register_static().
	 * @param name A nul-terminated string used as the name of the new type.
	 * @param const_static_values An array of #GFlagsValue structs for the possible
	 *  flags values. The array is terminated by a struct with all members being 0.
	 *  GObject keeps a reference to the data, so it cannot be stack-allocated.
	 * @returns The new type identifier.
	 */
	function flags_register_static(name: string, const_static_values: FlagsValue): GObject.Type;

	/**
	 * Pretty-prints #value in the form of the flag names separated by ` | ` and
	 * sorted. Any extra bits will be shown at the end as a hexadecimal number.
	 * 
	 * This is intended to be used for debugging purposes. The format of the output
	 * may change in the future.
	 * @param flags_type the type identifier of a #GFlagsClass type
	 * @param value the value
	 * @returns a newly-allocated text string
	 */
	function flags_to_string(flags_type: GObject.Type, value: number): string;

	function gtype_get_type(): GObject.Type;

	/**
	 * Creates a new #GParamSpecBoolean instance specifying a %G_TYPE_BOOLEAN
	 * property. In many cases, it may be more appropriate to use an enum with
	 * {@link G.param_spec_enum}, both to improve code clarity by using explicitly named
	 * values, and to allow for more values to be added in future without breaking
	 * API.
	 * 
	 * See g_param_spec_internal() for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_boolean(name: string, nick: string, blurb: string, default_value: boolean, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecBoxed instance specifying a %G_TYPE_BOXED
	 * derived property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param boxed_type %G_TYPE_BOXED derived type of this property
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_boxed(name: string, nick: string, blurb: string, boxed_type: GObject.Type, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecChar instance specifying a %G_TYPE_CHAR property.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param minimum minimum value for the property specified
	 * @param maximum maximum value for the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_char(name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecDouble instance specifying a %G_TYPE_DOUBLE
	 * property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param minimum minimum value for the property specified
	 * @param maximum maximum value for the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_double(name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecEnum instance specifying a %G_TYPE_ENUM
	 * property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param enum_type a #GType derived from %G_TYPE_ENUM
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_enum(name: string, nick: string, blurb: string, enum_type: GObject.Type, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecFlags instance specifying a %G_TYPE_FLAGS
	 * property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param flags_type a #GType derived from %G_TYPE_FLAGS
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_flags(name: string, nick: string, blurb: string, flags_type: GObject.Type, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecFloat instance specifying a %G_TYPE_FLOAT property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param minimum minimum value for the property specified
	 * @param maximum maximum value for the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_float(name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecGType instance specifying a
	 * %G_TYPE_GTYPE property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param is_a_type a #GType whose subtypes are allowed as values
	 *  of the property (use %G_TYPE_NONE for any type)
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_gtype(name: string, nick: string, blurb: string, is_a_type: GObject.Type, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecInt instance specifying a %G_TYPE_INT property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param minimum minimum value for the property specified
	 * @param maximum maximum value for the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_int(name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecInt64 instance specifying a %G_TYPE_INT64 property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param minimum minimum value for the property specified
	 * @param maximum maximum value for the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_int64(name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecLong instance specifying a %G_TYPE_LONG property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param minimum minimum value for the property specified
	 * @param maximum maximum value for the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_long(name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecBoxed instance specifying a %G_TYPE_OBJECT
	 * derived property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param object_type %G_TYPE_OBJECT derived type of this property
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_object(name: string, nick: string, blurb: string, object_type: GObject.Type, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new property of type #GParamSpecOverride. This is used
	 * to direct operations to another paramspec, and will not be directly
	 * useful unless you are implementing a new base type similar to GObject.
	 * @param name the name of the property.
	 * @param overridden The property that is being overridden
	 * @returns the newly created #GParamSpec
	 */
	function param_spec_override(name: string, overridden: ParamSpec): ParamSpec;

	/**
	 * Creates a new #GParamSpecParam instance specifying a %G_TYPE_PARAM
	 * property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param param_type a #GType derived from %G_TYPE_PARAM
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_param(name: string, nick: string, blurb: string, param_type: GObject.Type, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecPointer instance specifying a pointer property.
	 * Where possible, it is better to use {@link G.param_spec_object} or
	 * g_param_spec_boxed() to expose memory management information.
	 * 
	 * See g_param_spec_internal() for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_pointer(name: string, nick: string, blurb: string, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecString instance.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_string(name: string, nick: string, blurb: string, default_value: string | null, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecUChar instance specifying a %G_TYPE_UCHAR property.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param minimum minimum value for the property specified
	 * @param maximum maximum value for the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_uchar(name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecUInt instance specifying a %G_TYPE_UINT property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param minimum minimum value for the property specified
	 * @param maximum maximum value for the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_uint(name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecUInt64 instance specifying a %G_TYPE_UINT64
	 * property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param minimum minimum value for the property specified
	 * @param maximum maximum value for the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_uint64(name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecULong instance specifying a %G_TYPE_ULONG
	 * property.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param minimum minimum value for the property specified
	 * @param maximum maximum value for the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_ulong(name: string, nick: string, blurb: string, minimum: number, maximum: number, default_value: number, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecUnichar instance specifying a %G_TYPE_UINT
	 * property. #GValue structures for this property can be accessed with
	 * {@link G.value_set_uint} and g_value_get_uint().
	 * 
	 * See g_param_spec_internal() for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param default_value default value for the property specified
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_unichar(name: string, nick: string, blurb: string, default_value: string, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecValueArray instance specifying a
	 * %G_TYPE_VALUE_ARRAY property. %G_TYPE_VALUE_ARRAY is a
	 * %G_TYPE_BOXED type, as such, #GValue structures for this property
	 * can be accessed with {@link G.value_set_boxed} and g_value_get_boxed().
	 * 
	 * See g_param_spec_internal() for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param element_spec a #GParamSpec describing the elements contained in
	 *  arrays of this property, may be %NULL
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_value_array(name: string, nick: string, blurb: string, element_spec: ParamSpec, flags: ParamFlags): ParamSpec;

	/**
	 * Creates a new #GParamSpecVariant instance specifying a #GVariant
	 * property.
	 * 
	 * If #default_value is floating, it is consumed.
	 * 
	 * See {@link G.param_spec_internal} for details on property names.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param type a #GVariantType
	 * @param default_value a #GVariant of type #type to
	 *                 use as the default value, or %NULL
	 * @param flags flags for the property specified
	 * @returns the newly created #GParamSpec
	 */
	function param_spec_variant(name: string, nick: string, blurb: string, type: GLib.VariantType, default_value: GLib.Variant | null, flags: ParamFlags): ParamSpec;

	/**
	 * Registers #name as the name of a new static type derived
	 * from #G_TYPE_PARAM.
	 * 
	 * The type system uses the information contained in the #GParamSpecTypeInfo
	 * structure pointed to by #info to manage the #GParamSpec type and its
	 * instances.
	 * @param name 0-terminated string used as the name of the new #GParamSpec type.
	 * @param pspec_info The #GParamSpecTypeInfo for this #GParamSpec type.
	 * @returns The new type identifier.
	 */
	function param_type_register_static(name: string, pspec_info: ParamSpecTypeInfo): GObject.Type;

	/**
	 * Transforms #src_value into #dest_value if possible, and then
	 * validates #dest_value, in order for it to conform to #pspec.  If
	 * #strict_validation is %TRUE this function will only succeed if the
	 * transformed #dest_value complied to #pspec without modifications.
	 * 
	 * See also {@link G.value_type_transformable}, g_value_transform() and
	 * g_param_value_validate().
	 * @param pspec a valid #GParamSpec
	 * @param src_value source #GValue
	 * @param dest_value destination #GValue of correct type for #pspec
	 * @param strict_validation %TRUE requires #dest_value to conform to #pspec
	 * without modifications
	 * @returns %TRUE if transformation and validation were successful,
	 *  %FALSE otherwise and #dest_value is left untouched.
	 */
	function param_value_convert(pspec: ParamSpec, src_value: Value, dest_value: Value, strict_validation: boolean): boolean;

	/**
	 * Checks whether #value contains the default value as specified in #pspec.
	 * @param pspec a valid #GParamSpec
	 * @param value a #GValue of correct type for #pspec
	 * @returns whether #value contains the canonical default for this #pspec
	 */
	function param_value_defaults(pspec: ParamSpec, value: Value): boolean;

	/**
	 * Sets #value to its default value as specified in #pspec.
	 * @param pspec a valid #GParamSpec
	 * @param value a #GValue of correct type for #pspec; since 2.64, you
	 *   can also pass an empty #GValue, initialized with %G_VALUE_INIT
	 */
	function param_value_set_default(pspec: ParamSpec, value: Value): void;

	/**
	 * Ensures that the contents of #value comply with the specifications
	 * set out by #pspec. For example, a #GParamSpecInt might require
	 * that integers stored in #value may not be smaller than -42 and not be
	 * greater than +42. If #value contains an integer outside of this range,
	 * it is modified accordingly, so the resulting value will fit into the
	 * range -42 .. +42.
	 * @param pspec a valid #GParamSpec
	 * @param value a #GValue of correct type for #pspec
	 * @returns whether modifying #value was necessary to ensure validity
	 */
	function param_value_validate(pspec: ParamSpec, value: Value): boolean;

	/**
	 * Compares #value1 with #value2 according to #pspec, and return -1, 0 or +1,
	 * if #value1 is found to be less than, equal to or greater than #value2,
	 * respectively.
	 * @param pspec a valid #GParamSpec
	 * @param value1 a #GValue of correct type for #pspec
	 * @param value2 a #GValue of correct type for #pspec
	 * @returns -1, 0 or +1, for a less than, equal to or greater than result
	 */
	function param_values_cmp(pspec: ParamSpec, value1: Value, value2: Value): number;

	/**
	 * Creates a new %G_TYPE_POINTER derived type id for a new
	 * pointer type with name #name.
	 * @param name the name of the new pointer type.
	 * @returns a new %G_TYPE_POINTER derived type id for #name.
	 */
	function pointer_type_register_static(name: string): GObject.Type;

	/**
	 * A predefined #GSignalAccumulator for signals intended to be used as a
	 * hook for application code to provide a particular value.  Usually
	 * only one such value is desired and multiple handlers for the same
	 * signal don't make much sense (except for the case of the default
	 * handler defined in the class structure, in which case you will
	 * usually want the signal connection to override the class handler).
	 * 
	 * This accumulator will use the return value from the first signal
	 * handler that is run as the return value for the signal and not run
	 * any further handlers (ie: the first handler "wins").
	 * @param ihint standard #GSignalAccumulator parameter
	 * @param return_accu standard #GSignalAccumulator parameter
	 * @param handler_return standard #GSignalAccumulator parameter
	 * @param dummy standard #GSignalAccumulator parameter
	 * @returns standard #GSignalAccumulator result
	 */
	function signal_accumulator_first_wins(ihint: SignalInvocationHint, return_accu: Value, handler_return: Value, dummy: any | null): boolean;

	/**
	 * A predefined #GSignalAccumulator for signals that return a
	 * boolean values. The behavior that this accumulator gives is
	 * that a return of %TRUE stops the signal emission: no further
	 * callbacks will be invoked, while a return of %FALSE allows
	 * the emission to continue. The idea here is that a %TRUE return
	 * indicates that the callback handled the signal, and no further
	 * handling is needed.
	 * @param ihint standard #GSignalAccumulator parameter
	 * @param return_accu standard #GSignalAccumulator parameter
	 * @param handler_return standard #GSignalAccumulator parameter
	 * @param dummy standard #GSignalAccumulator parameter
	 * @returns standard #GSignalAccumulator result
	 */
	function signal_accumulator_true_handled(ihint: SignalInvocationHint, return_accu: Value, handler_return: Value, dummy: any | null): boolean;

	/**
	 * Adds an emission hook for a signal, which will get called for any emission
	 * of that signal, independent of the instance. This is possible only
	 * for signals which don't have #G_SIGNAL_NO_HOOKS flag set.
	 * @param signal_id the signal identifier, as returned by {@link G.signal_lookup}.
	 * @param detail the detail on which to call the hook.
	 * @param hook_func a #GSignalEmissionHook function.
	 * @param hook_data user data for #hook_func.
	 * @param data_destroy a #GDestroyNotify for #hook_data.
	 * @returns the hook id, for later use with {@link G.signal_remove_emission_hook}.
	 */
	function signal_add_emission_hook(signal_id: number, detail: GLib.Quark, hook_func: SignalEmissionHook, hook_data: any | null, data_destroy: GLib.DestroyNotify | null): number;

	/**
	 * Calls the original class closure of a signal. This function should only
	 * be called from an overridden class closure; see
	 * {@link G.signal_override_class_closure} and
	 * g_signal_override_class_handler().
	 * @param instance_and_params the argument list of the signal emission.
	 *  The first element in the array is a #GValue for the instance the signal
	 *  is being emitted on. The rest are any arguments to be passed to the signal.
	 * @param return_value Location for the return value.
	 */
	function signal_chain_from_overridden(instance_and_params: Value[], return_value: Value): void;

	/**
	 * Calls the original class closure of a signal. This function should
	 * only be called from an overridden class closure; see
	 * {@link G.signal_override_class_closure} and
	 * g_signal_override_class_handler().
	 * @param instance the instance the signal is being
	 *    emitted on.
	 */
	function signal_chain_from_overridden_handler(instance: TypeInstance): void;

	/**
	 * Connects a closure to a signal for a particular object.
	 * @param instance the instance to connect to.
	 * @param detailed_signal a string of the form "signal-name::detail".
	 * @param closure the closure to connect.
	 * @param after whether the handler should be called before or after the
	 *  default handler of the signal.
	 * @returns the handler ID (always greater than 0 for successful connections)
	 */
	function signal_connect_closure(instance: Object, detailed_signal: string, closure: Closure, after: boolean): number;

	/**
	 * Connects a closure to a signal for a particular object.
	 * @param instance the instance to connect to.
	 * @param signal_id the id of the signal.
	 * @param detail the detail.
	 * @param closure the closure to connect.
	 * @param after whether the handler should be called before or after the
	 *  default handler of the signal.
	 * @returns the handler ID (always greater than 0 for successful connections)
	 */
	function signal_connect_closure_by_id(instance: Object, signal_id: number, detail: GLib.Quark, closure: Closure, after: boolean): number;

	/**
	 * Connects a #GCallback function to a signal for a particular object. Similar
	 * to {@link G.signal_connect}, but allows to provide a #GClosureNotify for the data
	 * which will be called when the signal handler is disconnected and no longer
	 * used. Specify #connect_flags if you need `..._after()` or
	 * `..._swapped()` variants of this function.
	 * @param instance the instance to connect to.
	 * @param detailed_signal a string of the form "signal-name::detail".
	 * @param c_handler the #GCallback to connect.
	 * @param data data to pass to #c_handler calls.
	 * @param destroy_data a #GClosureNotify for #data.
	 * @param connect_flags a combination of #GConnectFlags.
	 * @returns the handler ID (always greater than 0 for successful connections)
	 */
	function signal_connect_data(instance: Object, detailed_signal: string, c_handler: Callback, data: any | null, destroy_data: ClosureNotify | null, connect_flags: ConnectFlags): number;

	/**
	 * This is similar to {@link G.signal_connect_data}, but uses a closure which
	 * ensures that the #gobject stays alive during the call to #c_handler
	 * by temporarily adding a reference count to #gobject.
	 * 
	 * When the #gobject is destroyed the signal handler will be automatically
	 * disconnected.  Note that this is not currently threadsafe (ie:
	 * emitting a signal while #gobject is being destroyed in another thread
	 * is not safe).
	 * @param instance the instance to connect to.
	 * @param detailed_signal a string of the form "signal-name::detail".
	 * @param c_handler the #GCallback to connect.
	 * @param gobject the object to pass as data
	 *    to #c_handler.
	 * @param connect_flags a combination of #GConnectFlags.
	 * @returns the handler id.
	 */
	function signal_connect_object(instance: TypeInstance, detailed_signal: string, c_handler: Callback, gobject: Object | null, connect_flags: ConnectFlags): number;

	/**
	 * Emits a signal.
	 * 
	 * Note that {@link G.signal_emit} resets the return value to the default
	 * if no handlers are connected, in contrast to g_signal_emitv().
	 * @param instance the instance the signal is being emitted on.
	 * @param signal_id the signal id
	 * @param detail the detail
	 */
	function signal_emit(instance: Object, signal_id: number, detail: GLib.Quark): void;

	/**
	 * Emits a signal.
	 * 
	 * Note that {@link G.signal_emit_by_name} resets the return value to the default
	 * if no handlers are connected, in contrast to g_signal_emitv().
	 * @param instance the instance the signal is being emitted on.
	 * @param detailed_signal a string of the form "signal-name::detail".
	 */
	function signal_emit_by_name(instance: Object, detailed_signal: string): void;

	/**
	 * Emits a signal.
	 * 
	 * Note that {@link G.signal_emit_valist} resets the return value to the default
	 * if no handlers are connected, in contrast to g_signal_emitv().
	 * @param instance the instance the signal is being
	 *    emitted on.
	 * @param signal_id the signal id
	 * @param detail the detail
	 * @param var_args a list of parameters to be passed to the signal, followed by a
	 *  location for the return value. If the return type of the signal
	 *  is #G_TYPE_NONE, the return value location can be omitted.
	 */
	function signal_emit_valist(instance: TypeInstance, signal_id: number, detail: GLib.Quark, var_args: any[]): void;

	/**
	 * Emits a signal.
	 * 
	 * Note that {@link G.signal_emitv} doesn't change #return_value if no handlers are
	 * connected, in contrast to g_signal_emit() and g_signal_emit_valist().
	 * @param instance_and_params argument list for the signal emission.
	 *  The first element in the array is a #GValue for the instance the signal
	 *  is being emitted on. The rest are any arguments to be passed to the signal.
	 * @param signal_id the signal id
	 * @param detail the detail
	 */
	function signal_emitv(instance_and_params: Value[], signal_id: number, detail: GLib.Quark): void;

	/**
	 * Returns the invocation hint of the innermost signal emission of instance.
	 * @param instance the instance to query
	 * @returns the invocation hint of the innermost
	 *     signal emission, or %NULL if not found.
	 */
	function signal_get_invocation_hint(instance: Object): SignalInvocationHint | null;

	/**
	 * Blocks a handler of an instance so it will not be called during any
	 * signal emissions unless it is unblocked again. Thus "blocking" a
	 * signal handler means to temporarily deactivate it, a signal handler
	 * has to be unblocked exactly the same amount of times it has been
	 * blocked before to become active again.
	 * 
	 * The #handler_id has to be a valid signal handler id, connected to a
	 * signal of #instance.
	 * @param instance The instance to block the signal handler of.
	 * @param handler_id Handler id of the handler to be blocked.
	 */
	function signal_handler_block(instance: Object, handler_id: number): void;

	/**
	 * Disconnects a handler from an instance so it will not be called during
	 * any future or currently ongoing emissions of the signal it has been
	 * connected to. The #handler_id becomes invalid and may be reused.
	 * 
	 * The #handler_id has to be a valid signal handler id, connected to a
	 * signal of #instance.
	 * @param instance The instance to remove the signal handler from.
	 * @param handler_id Handler id of the handler to be disconnected.
	 */
	function signal_handler_disconnect(instance: Object, handler_id: number): void;

	/**
	 * Finds the first signal handler that matches certain selection criteria.
	 * The criteria mask is passed as an OR-ed combination of #GSignalMatchType
	 * flags, and the criteria values are passed as arguments.
	 * The match #mask has to be non-0 for successful matches.
	 * If no handler was found, 0 is returned.
	 * @param instance The instance owning the signal handler to be found.
	 * @param mask Mask indicating which of #signal_id, #detail, #closure, #func
	 *  and/or #data the handler has to match.
	 * @param signal_id Signal the handler has to be connected to.
	 * @param detail Signal detail the handler has to be connected to.
	 * @param closure The closure the handler will invoke.
	 * @param func The C closure callback of the handler (useless for non-C closures).
	 * @param data The closure data of the handler's closure.
	 * @returns A valid non-0 signal handler id for a successful match.
	 */
	function signal_handler_find(instance: Object, mask: SignalMatchType, signal_id: number, detail: GLib.Quark, closure: Closure | null, func: any | null, data: any | null): number;

	/**
	 * Returns whether #handler_id is the ID of a handler connected to #instance.
	 * @param instance The instance where a signal handler is sought.
	 * @param handler_id the handler ID.
	 * @returns whether #handler_id identifies a handler connected to #instance.
	 */
	function signal_handler_is_connected(instance: Object, handler_id: number): boolean;

	/**
	 * Undoes the effect of a previous {@link G.signal_handler_block} call.  A
	 * blocked handler is skipped during signal emissions and will not be
	 * invoked, unblocking it (for exactly the amount of times it has been
	 * blocked before) reverts its "blocked" state, so the handler will be
	 * recognized by the signal system and is called upon future or
	 * currently ongoing signal emissions (since the order in which
	 * handlers are called during signal emissions is deterministic,
	 * whether the unblocked handler in question is called as part of a
	 * currently ongoing emission depends on how far that emission has
	 * proceeded yet).
	 * 
	 * The #handler_id has to be a valid id of a signal handler that is
	 * connected to a signal of #instance and is currently blocked.
	 * @param instance The instance to unblock the signal handler of.
	 * @param handler_id Handler id of the handler to be unblocked.
	 */
	function signal_handler_unblock(instance: Object, handler_id: number): void;

	/**
	 * Blocks all handlers on an instance that match a certain selection criteria.
	 * The criteria mask is passed as an OR-ed combination of #GSignalMatchType
	 * flags, and the criteria values are passed as arguments.
	 * Passing at least one of the %G_SIGNAL_MATCH_CLOSURE, %G_SIGNAL_MATCH_FUNC
	 * or %G_SIGNAL_MATCH_DATA match flags is required for successful matches.
	 * If no handlers were found, 0 is returned, the number of blocked handlers
	 * otherwise.
	 * @param instance The instance to block handlers from.
	 * @param mask Mask indicating which of #signal_id, #detail, #closure, #func
	 *  and/or #data the handlers have to match.
	 * @param signal_id Signal the handlers have to be connected to.
	 * @param detail Signal detail the handlers have to be connected to.
	 * @param closure The closure the handlers will invoke.
	 * @param func The C closure callback of the handlers (useless for non-C closures).
	 * @param data The closure data of the handlers' closures.
	 * @returns The number of handlers that matched.
	 */
	function signal_handlers_block_matched(instance: Object, mask: SignalMatchType, signal_id: number, detail: GLib.Quark, closure: Closure | null, func: any | null, data: any | null): number;

	/**
	 * Destroy all signal handlers of a type instance. This function is
	 * an implementation detail of the #GObject dispose implementation,
	 * and should not be used outside of the type system.
	 * @param instance The instance whose signal handlers are destroyed
	 */
	function signal_handlers_destroy(instance: Object): void;

	/**
	 * Disconnects all handlers on an instance that match a certain
	 * selection criteria. The criteria mask is passed as an OR-ed
	 * combination of #GSignalMatchType flags, and the criteria values are
	 * passed as arguments.  Passing at least one of the
	 * %G_SIGNAL_MATCH_CLOSURE, %G_SIGNAL_MATCH_FUNC or
	 * %G_SIGNAL_MATCH_DATA match flags is required for successful
	 * matches.  If no handlers were found, 0 is returned, the number of
	 * disconnected handlers otherwise.
	 * @param instance The instance to remove handlers from.
	 * @param mask Mask indicating which of #signal_id, #detail, #closure, #func
	 *  and/or #data the handlers have to match.
	 * @param signal_id Signal the handlers have to be connected to.
	 * @param detail Signal detail the handlers have to be connected to.
	 * @param closure The closure the handlers will invoke.
	 * @param func The C closure callback of the handlers (useless for non-C closures).
	 * @param data The closure data of the handlers' closures.
	 * @returns The number of handlers that matched.
	 */
	function signal_handlers_disconnect_matched(instance: Object, mask: SignalMatchType, signal_id: number, detail: GLib.Quark, closure: Closure | null, func: any | null, data: any | null): number;

	/**
	 * Unblocks all handlers on an instance that match a certain selection
	 * criteria. The criteria mask is passed as an OR-ed combination of
	 * #GSignalMatchType flags, and the criteria values are passed as arguments.
	 * Passing at least one of the %G_SIGNAL_MATCH_CLOSURE, %G_SIGNAL_MATCH_FUNC
	 * or %G_SIGNAL_MATCH_DATA match flags is required for successful matches.
	 * If no handlers were found, 0 is returned, the number of unblocked handlers
	 * otherwise. The match criteria should not apply to any handlers that are
	 * not currently blocked.
	 * @param instance The instance to unblock handlers from.
	 * @param mask Mask indicating which of #signal_id, #detail, #closure, #func
	 *  and/or #data the handlers have to match.
	 * @param signal_id Signal the handlers have to be connected to.
	 * @param detail Signal detail the handlers have to be connected to.
	 * @param closure The closure the handlers will invoke.
	 * @param func The C closure callback of the handlers (useless for non-C closures).
	 * @param data The closure data of the handlers' closures.
	 * @returns The number of handlers that matched.
	 */
	function signal_handlers_unblock_matched(instance: Object, mask: SignalMatchType, signal_id: number, detail: GLib.Quark, closure: Closure | null, func: any | null, data: any | null): number;

	/**
	 * Returns whether there are any handlers connected to #instance for the
	 * given signal id and detail.
	 * 
	 * If #detail is 0 then it will only match handlers that were connected
	 * without detail.  If #detail is non-zero then it will match handlers
	 * connected both without detail and with the given detail.  This is
	 * consistent with how a signal emitted with #detail would be delivered
	 * to those handlers.
	 * 
	 * Since 2.46 this also checks for a non-default class closure being
	 * installed, as this is basically always what you want.
	 * 
	 * One example of when you might use this is when the arguments to the
	 * signal are difficult to compute. A class implementor may opt to not
	 * emit the signal if no one is attached anyway, thus saving the cost
	 * of building the arguments.
	 * @param instance the object whose signal handlers are sought.
	 * @param signal_id the signal id.
	 * @param detail the detail.
	 * @param may_be_blocked whether blocked handlers should count as match.
	 * @returns %TRUE if a handler is connected to the signal, %FALSE
	 *          otherwise.
	 */
	function signal_has_handler_pending(instance: Object, signal_id: number, detail: GLib.Quark, may_be_blocked: boolean): boolean;

	/**
	 * Validate a signal name. This can be useful for dynamically-generated signals
	 * which need to be validated at run-time before actually trying to create them.
	 * 
	 * See [canonical parameter names][canonical-parameter-names] for details of
	 * the rules for valid names. The rules for signal names are the same as those
	 * for property names.
	 * @param name the canonical name of the signal
	 * @returns %TRUE if #name is a valid signal name, %FALSE otherwise.
	 */
	function signal_is_valid_name(name: string): boolean;

	/**
	 * Lists the signals by id that a certain instance or interface type
	 * created. Further information about the signals can be acquired through
	 * {@link G.signal_query}.
	 * @param itype Instance or interface type.
	 * @returns Newly allocated array of signal IDs.
	 * 
	 * Location to store the number of signal ids for #itype.
	 */
	function signal_list_ids(itype: GObject.Type): [ number[], number ];

	/**
	 * Given the name of the signal and the type of object it connects to, gets
	 * the signal's identifying integer. Emitting the signal by number is
	 * somewhat faster than using the name each time.
	 * 
	 * Also tries the ancestors of the given type.
	 * 
	 * The type class passed as #itype must already have been instantiated (for
	 * example, using {@link G.type_class_ref}) for this function to work, as signals are
	 * always installed during class initialization.
	 * 
	 * See g_signal_new() for details on allowed signal names.
	 * @param name the signal's name.
	 * @param itype the type that the signal operates on.
	 * @returns the signal's identifying number, or 0 if no signal was found.
	 */
	function signal_lookup(name: string, itype: GObject.Type): number;

	/**
	 * Given the signal's identifier, finds its name.
	 * 
	 * Two different signals may have the same name, if they have differing types.
	 * @param signal_id the signal's identifying number.
	 * @returns the signal name, or %NULL if the signal number was invalid.
	 */
	function signal_name(signal_id: number): string | null;

	/**
	 * Creates a new signal. (This is usually done in the class initializer.)
	 * 
	 * A signal name consists of segments consisting of ASCII letters and
	 * digits, separated by either the `-` or `_` character. The first
	 * character of a signal name must be a letter. Names which violate these
	 * rules lead to undefined behaviour. These are the same rules as for property
	 * naming (see {@link G.param_spec_internal}).
	 * 
	 * When registering a signal and looking up a signal, either separator can
	 * be used, but they cannot be mixed. Using `-` is considerably more efficient.
	 * Using `_` is discouraged.
	 * 
	 * If 0 is used for #class_offset subclasses cannot override the class handler
	 * in their class_init method by doing super_class->signal_handler = my_signal_handler.
	 * Instead they will have to use g_signal_override_class_handler().
	 * 
	 * If #c_marshaller is %NULL, g_cclosure_marshal_generic() will be used as
	 * the marshaller for this signal. In some simple cases, g_signal_new()
	 * will use a more optimized c_marshaller and va_marshaller for the signal
	 * instead of g_cclosure_marshal_generic().
	 * 
	 * If #c_marshaller is non-%NULL, you need to also specify a va_marshaller
	 * using g_signal_set_va_marshaller() or the generic va_marshaller will
	 * be used.
	 * @param signal_name the name for the signal
	 * @param itype the type this signal pertains to. It will also pertain to
	 *  types which are derived from this type.
	 * @param signal_flags a combination of #GSignalFlags specifying detail of when
	 *  the default handler is to be invoked. You should at least specify
	 *  %G_SIGNAL_RUN_FIRST or %G_SIGNAL_RUN_LAST.
	 * @param class_offset The offset of the function pointer in the class structure
	 *  for this type. Used to invoke a class method generically. Pass 0 to
	 *  not associate a class method slot with this signal.
	 * @param accumulator the accumulator for this signal; may be %NULL.
	 * @param accu_data user data for the #accumulator.
	 * @param c_marshaller the function to translate arrays of parameter
	 *  values to signal emissions into C language callback invocations or %NULL.
	 * @param return_type the type of return value, or #G_TYPE_NONE for a signal
	 *  without a return value.
	 * @param n_params the number of parameter types to follow.
	 * @returns the signal id
	 */
	function signal_new(signal_name: string, itype: GObject.Type, signal_flags: SignalFlags, class_offset: number, accumulator: SignalAccumulator | null, accu_data: any | null, c_marshaller: SignalCMarshaller | null, return_type: GObject.Type, n_params: number): number;

	/**
	 * Creates a new signal. (This is usually done in the class initializer.)
	 * 
	 * This is a variant of {@link G.signal_new} that takes a C callback instead
	 * of a class offset for the signal's class handler. This function
	 * doesn't need a function pointer exposed in the class structure of
	 * an object definition, instead the function pointer is passed
	 * directly and can be overridden by derived classes with
	 * g_signal_override_class_closure() or
	 * g_signal_override_class_handler()and chained to with
	 * g_signal_chain_from_overridden() or
	 * g_signal_chain_from_overridden_handler().
	 * 
	 * See g_signal_new() for information about signal names.
	 * 
	 * If c_marshaller is %NULL, g_cclosure_marshal_generic() will be used as
	 * the marshaller for this signal.
	 * @param signal_name the name for the signal
	 * @param itype the type this signal pertains to. It will also pertain to
	 *  types which are derived from this type.
	 * @param signal_flags a combination of #GSignalFlags specifying detail of when
	 *  the default handler is to be invoked. You should at least specify
	 *  %G_SIGNAL_RUN_FIRST or %G_SIGNAL_RUN_LAST.
	 * @param class_handler a #GCallback which acts as class implementation of
	 *  this signal. Used to invoke a class method generically. Pass %NULL to
	 *  not associate a class method with this signal.
	 * @param accumulator the accumulator for this signal; may be %NULL.
	 * @param accu_data user data for the #accumulator.
	 * @param c_marshaller the function to translate arrays of parameter
	 *  values to signal emissions into C language callback invocations or %NULL.
	 * @param return_type the type of return value, or #G_TYPE_NONE for a signal
	 *  without a return value.
	 * @param n_params the number of parameter types to follow.
	 * @returns the signal id
	 */
	function signal_new_class_handler(signal_name: string, itype: GObject.Type, signal_flags: SignalFlags, class_handler: Callback | null, accumulator: SignalAccumulator | null, accu_data: any | null, c_marshaller: SignalCMarshaller | null, return_type: GObject.Type, n_params: number): number;

	/**
	 * Creates a new signal. (This is usually done in the class initializer.)
	 * 
	 * See {@link G.signal_new} for details on allowed signal names.
	 * 
	 * If c_marshaller is %NULL, g_cclosure_marshal_generic() will be used as
	 * the marshaller for this signal.
	 * @param signal_name the name for the signal
	 * @param itype the type this signal pertains to. It will also pertain to
	 *  types which are derived from this type.
	 * @param signal_flags a combination of #GSignalFlags specifying detail of when
	 *  the default handler is to be invoked. You should at least specify
	 *  %G_SIGNAL_RUN_FIRST or %G_SIGNAL_RUN_LAST.
	 * @param class_closure The closure to invoke on signal emission; may be %NULL.
	 * @param accumulator the accumulator for this signal; may be %NULL.
	 * @param accu_data user data for the #accumulator.
	 * @param c_marshaller the function to translate arrays of parameter
	 *  values to signal emissions into C language callback invocations or %NULL.
	 * @param return_type the type of return value, or #G_TYPE_NONE for a signal
	 *  without a return value.
	 * @param n_params the number of parameter types in #args.
	 * @param args va_list of #GType, one for each parameter.
	 * @returns the signal id
	 */
	function signal_new_valist(signal_name: string, itype: GObject.Type, signal_flags: SignalFlags, class_closure: Closure | null, accumulator: SignalAccumulator | null, accu_data: any | null, c_marshaller: SignalCMarshaller | null, return_type: GObject.Type, n_params: number, args: any[]): number;

	/**
	 * Creates a new signal. (This is usually done in the class initializer.)
	 * 
	 * See {@link G.signal_new} for details on allowed signal names.
	 * 
	 * If c_marshaller is %NULL, g_cclosure_marshal_generic() will be used as
	 * the marshaller for this signal.
	 * @param signal_name the name for the signal
	 * @param itype the type this signal pertains to. It will also pertain to
	 *     types which are derived from this type
	 * @param signal_flags a combination of #GSignalFlags specifying detail of when
	 *     the default handler is to be invoked. You should at least specify
	 *     %G_SIGNAL_RUN_FIRST or %G_SIGNAL_RUN_LAST
	 * @param class_closure The closure to invoke on signal emission;
	 *     may be %NULL
	 * @param accumulator the accumulator for this signal; may be %NULL
	 * @param accu_data user data for the #accumulator
	 * @param c_marshaller the function to translate arrays of
	 *     parameter values to signal emissions into C language callback
	 *     invocations or %NULL
	 * @param return_type the type of return value, or #G_TYPE_NONE for a signal
	 *     without a return value
	 * @param n_params the length of #param_types
	 * @param param_types an array of types, one for
	 *     each parameter (may be %NULL if #n_params is zero)
	 * @returns the signal id
	 */
	function signal_newv(signal_name: string, itype: GObject.Type, signal_flags: SignalFlags, class_closure: Closure | null, accumulator: SignalAccumulator | null, accu_data: any | null, c_marshaller: SignalCMarshaller | null, return_type: GObject.Type, n_params: number, param_types: GObject.Type[] | null): number;

	/**
	 * Overrides the class closure (i.e. the default handler) for the given signal
	 * for emissions on instances of #instance_type. #instance_type must be derived
	 * from the type to which the signal belongs.
	 * 
	 * See {@link G.signal_chain_from_overridden} and
	 * g_signal_chain_from_overridden_handler() for how to chain up to the
	 * parent class closure from inside the overridden one.
	 * @param signal_id the signal id
	 * @param instance_type the instance type on which to override the class closure
	 *  for the signal.
	 * @param class_closure the closure.
	 */
	function signal_override_class_closure(signal_id: number, instance_type: GObject.Type, class_closure: Closure): void;

	/**
	 * Overrides the class closure (i.e. the default handler) for the
	 * given signal for emissions on instances of #instance_type with
	 * callback #class_handler. #instance_type must be derived from the
	 * type to which the signal belongs.
	 * 
	 * See {@link G.signal_chain_from_overridden} and
	 * g_signal_chain_from_overridden_handler() for how to chain up to the
	 * parent class closure from inside the overridden one.
	 * @param signal_name the name for the signal
	 * @param instance_type the instance type on which to override the class handler
	 *  for the signal.
	 * @param class_handler the handler.
	 */
	function signal_override_class_handler(signal_name: string, instance_type: GObject.Type, class_handler: Callback): void;

	/**
	 * Internal function to parse a signal name into its #signal_id
	 * and #detail quark.
	 * @param detailed_signal a string of the form "signal-name::detail".
	 * @param itype The interface/instance type that introduced "signal-name".
	 * @param force_detail_quark %TRUE forces creation of a #GQuark for the detail.
	 * @returns Whether the signal name could successfully be parsed and #signal_id_p and #detail_p contain valid return values.
	 * 
	 * Location to store the signal id.
	 * 
	 * Location to store the detail quark.
	 */
	function signal_parse_name(detailed_signal: string, itype: GObject.Type, force_detail_quark: boolean): [ boolean, number, GLib.Quark ];

	/**
	 * Queries the signal system for in-depth information about a
	 * specific signal. This function will fill in a user-provided
	 * structure to hold signal-specific information. If an invalid
	 * signal id is passed in, the #signal_id member of the #GSignalQuery
	 * is 0. All members filled into the #GSignalQuery structure should
	 * be considered constant and have to be left untouched.
	 * @param signal_id The signal id of the signal to query information for.
	 * @returns A user provided structure that is
	 *  filled in with constant values upon success.
	 */
	function signal_query(signal_id: number): SignalQuery;

	/**
	 * Deletes an emission hook.
	 * @param signal_id the id of the signal
	 * @param hook_id the id of the emission hook, as returned by
	 *  {@link G.signal_add_emission_hook}
	 */
	function signal_remove_emission_hook(signal_id: number, hook_id: number): void;

	/**
	 * Change the #GSignalCVaMarshaller used for a given signal.  This is a
	 * specialised form of the marshaller that can often be used for the
	 * common case of a single connected signal handler and avoids the
	 * overhead of #GValue.  Its use is optional.
	 * @param signal_id the signal id
	 * @param instance_type the instance type on which to set the marshaller.
	 * @param va_marshaller the marshaller to set.
	 */
	function signal_set_va_marshaller(signal_id: number, instance_type: GObject.Type, va_marshaller: SignalCVaMarshaller): void;

	/**
	 * Stops a signal's current emission.
	 * 
	 * This will prevent the default method from running, if the signal was
	 * %G_SIGNAL_RUN_LAST and you connected normally (i.e. without the "after"
	 * flag).
	 * 
	 * Prints a warning if used on a signal which isn't being emitted.
	 * @param instance the object whose signal handlers you wish to stop.
	 * @param signal_id the signal identifier, as returned by {@link G.signal_lookup}.
	 * @param detail the detail which the signal was emitted with.
	 */
	function signal_stop_emission(instance: Object, signal_id: number, detail: GLib.Quark): void;

	/**
	 * Stops a signal's current emission.
	 * 
	 * This is just like {@link G.signal_stop_emission} except it will look up the
	 * signal id for you.
	 * @param instance the object whose signal handlers you wish to stop.
	 * @param detailed_signal a string of the form "signal-name::detail".
	 */
	function signal_stop_emission_by_name(instance: Object, detailed_signal: string): void;

	/**
	 * Creates a new closure which invokes the function found at the offset
	 * #struct_offset in the class structure of the interface or classed type
	 * identified by #itype.
	 * @param itype the #GType identifier of an interface or classed type
	 * @param struct_offset the offset of the member function of #itype's class
	 *  structure which is to be invoked by the new closure
	 * @returns a floating reference to a new #GCClosure
	 */
	function signal_type_cclosure_new(itype: GObject.Type, struct_offset: number): Closure;

	/**
	 * Set the callback for a source as a #GClosure.
	 * 
	 * If the source is not one of the standard GLib types, the #closure_callback
	 * and #closure_marshal fields of the #GSourceFuncs structure must have been
	 * filled in with pointers to appropriate functions.
	 * @param source the source
	 * @param closure a #GClosure
	 */
	function source_set_closure(source: GLib.Source, closure: Closure): void;

	/**
	 * Sets a dummy callback for #source. The callback will do nothing, and
	 * if the source expects a #gboolean return value, it will return %TRUE.
	 * (If the source expects any other type of return value, it will return
	 * a 0/%NULL value; whatever {@link G.value_init} initializes a #GValue to for
	 * that type.)
	 * 
	 * If the source is not one of the standard GLib types, the
	 * #closure_callback and #closure_marshal fields of the #GSourceFuncs
	 * structure must have been filled in with pointers to appropriate
	 * functions.
	 * @param source the source
	 */
	function source_set_dummy_callback(source: GLib.Source): void;

	/**
	 * Return a newly allocated string, which describes the contents of a
	 * #GValue.  The main purpose of this function is to describe #GValue
	 * contents for debugging output, the way in which the contents are
	 * described may change between different GLib versions.
	 * @param value #GValue which contents are to be described.
	 * @returns Newly allocated string.
	 */
	function strdup_value_contents(value: Value): string;

	/**
	 * Adds a #GTypeClassCacheFunc to be called before the reference count of a
	 * class goes from one to zero. This can be used to prevent premature class
	 * destruction. All installed #GTypeClassCacheFunc functions will be chained
	 * until one of them returns %TRUE. The functions have to check the class id
	 * passed in to figure whether they actually want to cache the class of this
	 * type, since all classes are routed through the same #GTypeClassCacheFunc
	 * chain.
	 * @param cache_data data to be passed to #cache_func
	 * @param cache_func a #GTypeClassCacheFunc
	 */
	function type_add_class_cache_func(cache_data: any | null, cache_func: TypeClassCacheFunc): void;

	/**
	 * Registers a private class structure for a classed type;
	 * when the class is allocated, the private structures for
	 * the class and all of its parent types are allocated
	 * sequentially in the same memory block as the public
	 * structures, and are zero-filled.
	 * 
	 * This function should be called in the
	 * type's {@link Get.type} function after the type is registered.
	 * The private structure can be retrieved using the
	 * G_TYPE_CLASS_GET_PRIVATE() macro.
	 * @param class_type GType of a classed type
	 * @param private_size size of private structure
	 */
	function type_add_class_private(class_type: GObject.Type, private_size: number): void;

	function type_add_instance_private(class_type: GObject.Type, private_size: number): number;

	/**
	 * Adds a function to be called after an interface vtable is
	 * initialized for any class (i.e. after the #interface_init
	 * member of #GInterfaceInfo has been called).
	 * 
	 * This function is useful when you want to check an invariant
	 * that depends on the interfaces of a class. For instance, the
	 * implementation of #GObject uses this facility to check that an
	 * object implements all of the properties that are defined on its
	 * interfaces.
	 * @param check_data data to pass to #check_func
	 * @param check_func function to be called after each interface
	 *     is initialized
	 */
	function type_add_interface_check(check_data: any | null, check_func: TypeInterfaceCheckFunc): void;

	/**
	 * Adds #interface_type to the dynamic #instance_type. The information
	 * contained in the #GTypePlugin structure pointed to by #plugin
	 * is used to manage the relationship.
	 * @param instance_type #GType value of an instantiatable type
	 * @param interface_type #GType value of an interface type
	 * @param plugin #GTypePlugin structure to retrieve the #GInterfaceInfo from
	 */
	function type_add_interface_dynamic(instance_type: GObject.Type, interface_type: GObject.Type, plugin: TypePlugin): void;

	/**
	 * Adds #interface_type to the static #instance_type.
	 * The information contained in the #GInterfaceInfo structure
	 * pointed to by #info is used to manage the relationship.
	 * @param instance_type #GType value of an instantiatable type
	 * @param interface_type #GType value of an interface type
	 * @param info #GInterfaceInfo structure for this
	 *        (#instance_type, #interface_type) combination
	 */
	function type_add_interface_static(instance_type: GObject.Type, interface_type: GObject.Type, info: InterfaceInfo): void;

	function type_check_class_cast(g_class: TypeClass, is_a_type: GObject.Type): TypeClass;

	function type_check_class_is_a(g_class: TypeClass, is_a_type: GObject.Type): boolean;

	/**
	 * Private helper function to aid implementation of the
	 * {@link G.TYPE_CHECK_INSTANCE} macro.
	 * @param instance a valid #GTypeInstance structure
	 * @returns %TRUE if #instance is valid, %FALSE otherwise
	 */
	function type_check_instance(instance: TypeInstance): boolean;

	function type_check_instance_cast(instance: TypeInstance, iface_type: GObject.Type): TypeInstance;

	function type_check_instance_is_a(instance: TypeInstance, iface_type: GObject.Type): boolean;

	function type_check_instance_is_fundamentally_a(instance: TypeInstance, fundamental_type: GObject.Type): boolean;

	function type_check_is_value_type(type: GObject.Type): boolean;

	function type_check_value(value: Value): boolean;

	function type_check_value_holds(value: Value, type: GObject.Type): boolean;

	/**
	 * Return a newly allocated and 0-terminated array of type IDs, listing
	 * the child types of #type.
	 * @param type the parent type
	 * @returns Newly allocated
	 *     and 0-terminated array of child types, free with {@link G.free}
	 * 
	 * location to store the length of
	 *     the returned array, or %NULL
	 */
	function type_children(type: GObject.Type): [ GObject.Type[], number | null ];

	function type_class_adjust_private_offset(g_class: any | null, private_size_or_offset: number): void;

	/**
	 * This function is essentially the same as {@link G.type_class_ref},
	 * except that the classes reference count isn't incremented.
	 * As a consequence, this function may return %NULL if the class
	 * of the type passed in does not currently exist (hasn't been
	 * referenced before).
	 * @param type type ID of a classed type
	 * @returns the #GTypeClass
	 *     structure for the given type ID or %NULL if the class does not
	 *     currently exist
	 */
	function type_class_peek(type: GObject.Type): TypeClass;

	/**
	 * A more efficient version of {@link G.type_class_peek} which works only for
	 * static types.
	 * @param type type ID of a classed type
	 * @returns the #GTypeClass
	 *     structure for the given type ID or %NULL if the class does not
	 *     currently exist or is dynamically loaded
	 */
	function type_class_peek_static(type: GObject.Type): TypeClass;

	/**
	 * Increments the reference count of the class structure belonging to
	 * #type. This function will demand-create the class if it doesn't
	 * exist already.
	 * @param type type ID of a classed type
	 * @returns the #GTypeClass
	 *     structure for the given type ID
	 */
	function type_class_ref(type: GObject.Type): TypeClass;

	/**
	 * Creates and initializes an instance of #type if #type is valid and
	 * can be instantiated. The type system only performs basic allocation
	 * and structure setups for instances: actual instance creation should
	 * happen through functions supplied by the type's fundamental type
	 * implementation.  So use of {@link G.type_create_instance} is reserved for
	 * implementers of fundamental types only. E.g. instances of the
	 * #GObject hierarchy should be created via g_object_new() and never
	 * directly through g_type_create_instance() which doesn't handle things
	 * like singleton objects or object construction.
	 * 
	 * The extended members of the returned instance are guaranteed to be filled
	 * with zeros.
	 * 
	 * Note: Do not use this function, unless you're implementing a
	 * fundamental type. Also language bindings should not use this
	 * function, but g_object_new() instead.
	 * @param type an instantiatable type to create an instance for
	 * @returns an allocated and initialized instance, subject to further
	 *     treatment by the fundamental type implementation
	 */
	function type_create_instance(type: GObject.Type): TypeInstance;

	/**
	 * If the interface type #g_type is currently in use, returns its
	 * default interface vtable.
	 * @param g_type an interface type
	 * @returns the default
	 *     vtable for the interface, or %NULL if the type is not currently
	 *     in use
	 */
	function type_default_interface_peek(g_type: GObject.Type): TypeInterface;

	/**
	 * Increments the reference count for the interface type #g_type,
	 * and returns the default interface vtable for the type.
	 * 
	 * If the type is not currently in use, then the default vtable
	 * for the type will be created and initialized by calling
	 * the base interface init and default vtable init functions for
	 * the type (the #base_init and #class_init members of #GTypeInfo).
	 * Calling {@link G.type_default_interface_ref} is useful when you
	 * want to make sure that signals and properties for an interface
	 * have been installed.
	 * @param g_type an interface type
	 * @returns the default
	 *     vtable for the interface; call {@link G.type_default_interface_unref}
	 *     when you are done using the interface.
	 */
	function type_default_interface_ref(g_type: GObject.Type): TypeInterface;

	/**
	 * Decrements the reference count for the type corresponding to the
	 * interface default vtable #g_iface. If the type is dynamic, then
	 * when no one is using the interface and all references have
	 * been released, the finalize function for the interface's default
	 * vtable (the #class_finalize member of #GTypeInfo) will be called.
	 * @param g_iface the default vtable
	 *     structure for an interface, as returned by {@link G.type_default_interface_ref}
	 */
	function type_default_interface_unref(g_iface: TypeInterface): void;

	/**
	 * Returns the length of the ancestry of the passed in type. This
	 * includes the type itself, so that e.g. a fundamental type has depth 1.
	 * @param type a #GType
	 * @returns the depth of #type
	 */
	function type_depth(type: GObject.Type): number;

	/**
	 * Ensures that the indicated #type has been registered with the
	 * type system, and its {@link .class_init} method has been run.
	 * 
	 * In theory, simply calling the type's _get_type() method (or using
	 * the corresponding macro) is supposed take care of this. However,
	 * _get_type() methods are often marked %G_GNUC_CONST for performance
	 * reasons, even though this is technically incorrect (since
	 * %G_GNUC_CONST requires that the function not have side effects,
	 * which _get_type() methods do on the first call). As a result, if
	 * you write a bare call to a _get_type() macro, it may get optimized
	 * out by the compiler. Using g_type_ensure() guarantees that the
	 * type's _get_type() method is called.
	 * @param type a #GType
	 */
	function type_ensure(type: GObject.Type): void;

	/**
	 * Frees an instance of a type, returning it to the instance pool for
	 * the type, if there is one.
	 * 
	 * Like {@link G.type_create_instance}, this function is reserved for
	 * implementors of fundamental types.
	 * @param instance an instance of a type
	 */
	function type_free_instance(instance: TypeInstance): void;

	/**
	 * Look up the type ID from a given type name, returning 0 if no type
	 * has been registered under this name (this is the preferred method
	 * to find out by name whether a specific type has been registered
	 * yet).
	 * @param name type name to look up
	 * @returns corresponding type ID or 0
	 */
	function type_from_name(name: string): GObject.Type;

	/**
	 * Internal function, used to extract the fundamental type ID portion.
	 * Use {@link G.TYPE_FUNDAMENTAL} instead.
	 * @param type_id valid type ID
	 * @returns fundamental type ID
	 */
	function type_fundamental(type_id: GObject.Type): GObject.Type;

	/**
	 * Returns the next free fundamental type id which can be used to
	 * register a new fundamental type with {@link G.type_register_fundamental}.
	 * The returned type ID represents the highest currently registered
	 * fundamental type identifier.
	 * @returns the next available fundamental type ID to be registered,
	 *     or 0 if the type system ran out of fundamental type IDs
	 */
	function type_fundamental_next(): GObject.Type;

	/**
	 * Returns the number of instances allocated of the particular type;
	 * this is only available if GLib is built with debugging support and
	 * the instance_count debug flag is set (by setting the GOBJECT_DEBUG
	 * variable to include instance-count).
	 * @param type a #GType
	 * @returns the number of instances allocated of the given type;
	 *   if instance counts are not available, returns 0.
	 */
	function type_get_instance_count(type: GObject.Type): number;

	/**
	 * Returns the #GTypePlugin structure for #type.
	 * @param type #GType to retrieve the plugin for
	 * @returns the corresponding plugin
	 *     if #type is a dynamic type, %NULL otherwise
	 */
	function type_get_plugin(type: GObject.Type): TypePlugin;

	/**
	 * Obtains data which has previously been attached to #type
	 * with {@link G.type_set_qdata}.
	 * 
	 * Note that this does not take subtyping into account; data
	 * attached to one type with g_type_set_qdata() cannot
	 * be retrieved from a subtype using g_type_get_qdata().
	 * @param type a #GType
	 * @param quark a #GQuark id to identify the data
	 * @returns the data, or %NULL if no data was found
	 */
	function type_get_qdata(type: GObject.Type, quark: GLib.Quark): any | null;

	/**
	 * Returns an opaque serial number that represents the state of the set
	 * of registered types. Any time a type is registered this serial changes,
	 * which means you can cache information based on type lookups (such as
	 * {@link G.type_from_name}) and know if the cache is still valid at a later
	 * time by comparing the current serial with the one at the type lookup.
	 * @returns An unsigned int, representing the state of type registrations
	 */
	function type_get_type_registration_serial(): number;

	/**
	 * This function used to initialise the type system.  Since GLib 2.36,
	 * the type system is initialised automatically and this function does
	 * nothing.
	 */
	function type_init(): void;

	/**
	 * This function used to initialise the type system with debugging
	 * flags.  Since GLib 2.36, the type system is initialised automatically
	 * and this function does nothing.
	 * 
	 * If you need to enable debugging features, use the GOBJECT_DEBUG
	 * environment variable.
	 * @param debug_flags bitwise combination of #GTypeDebugFlags values for
	 *     debugging purposes
	 */
	function type_init_with_debug_flags(debug_flags: TypeDebugFlags): void;

	/**
	 * Adds #prerequisite_type to the list of prerequisites of #interface_type.
	 * This means that any type implementing #interface_type must also implement
	 * #prerequisite_type. Prerequisites can be thought of as an alternative to
	 * interface derivation (which GType doesn't support). An interface can have
	 * at most one instantiatable prerequisite type.
	 * @param interface_type #GType value of an interface type
	 * @param prerequisite_type #GType value of an interface or instantiatable type
	 */
	function type_interface_add_prerequisite(interface_type: GObject.Type, prerequisite_type: GObject.Type): void;

	/**
	 * Returns the #GTypePlugin structure for the dynamic interface
	 * #interface_type which has been added to #instance_type, or %NULL
	 * if #interface_type has not been added to #instance_type or does
	 * not have a #GTypePlugin structure. See {@link G.type_add_interface_dynamic}.
	 * @param instance_type #GType of an instantiatable type
	 * @param interface_type #GType of an interface type
	 * @returns the #GTypePlugin for the dynamic
	 *     interface #interface_type of #instance_type
	 */
	function type_interface_get_plugin(instance_type: GObject.Type, interface_type: GObject.Type): TypePlugin;

	/**
	 * Returns the most specific instantiatable prerequisite of an
	 * interface type. If the interface type has no instantiatable
	 * prerequisite, %G_TYPE_INVALID is returned.
	 * 
	 * See {@link G.type_interface_add_prerequisite} for more information
	 * about prerequisites.
	 * @param interface_type an interface type
	 * @returns the instantiatable prerequisite type or %G_TYPE_INVALID if none
	 */
	function type_interface_instantiatable_prerequisite(interface_type: GObject.Type): GObject.Type;

	/**
	 * Returns the #GTypeInterface structure of an interface to which the
	 * passed in class conforms.
	 * @param instance_class a #GTypeClass structure
	 * @param iface_type an interface ID which this class conforms to
	 * @returns the #GTypeInterface
	 *     structure of #iface_type if implemented by #instance_class, %NULL
	 *     otherwise
	 */
	function type_interface_peek(instance_class: TypeClass, iface_type: GObject.Type): TypeInterface;

	/**
	 * Returns the prerequisites of an interfaces type.
	 * @param interface_type an interface type
	 * @returns a
	 *     newly-allocated zero-terminated array of #GType containing
	 *     the prerequisites of #interface_type
	 * 
	 * location to return the number
	 *     of prerequisites, or %NULL
	 */
	function type_interface_prerequisites(interface_type: GObject.Type): [ GObject.Type[], number | null ];

	/**
	 * Return a newly allocated and 0-terminated array of type IDs, listing
	 * the interface types that #type conforms to.
	 * @param type the type to list interface types for
	 * @returns Newly allocated
	 *     and 0-terminated array of interface types, free with {@link G.free}
	 * 
	 * location to store the length of
	 *     the returned array, or %NULL
	 */
	function type_interfaces(type: GObject.Type): [ GObject.Type[], number | null ];

	/**
	 * If #is_a_type is a derivable type, check whether #type is a
	 * descendant of #is_a_type. If #is_a_type is an interface, check
	 * whether #type conforms to it.
	 * @param type type to check ancestry for
	 * @param is_a_type possible ancestor of #type or interface that #type
	 *     could conform to
	 * @returns %TRUE if #type is a #is_a_type
	 */
	function type_is_a(type: GObject.Type, is_a_type: GObject.Type): boolean;

	/**
	 * Get the unique name that is assigned to a type ID.  Note that this
	 * function (like all other GType API) cannot cope with invalid type
	 * IDs. %G_TYPE_INVALID may be passed to this function, as may be any
	 * other validly registered type ID, but randomized type IDs should
	 * not be passed in and will most likely lead to a crash.
	 * @param type type to return name for
	 * @returns static type name or %NULL
	 */
	function type_name(type: GObject.Type): string;

	function type_name_from_class(g_class: TypeClass): string;

	function type_name_from_instance(instance: TypeInstance): string;

	/**
	 * Given a #leaf_type and a #root_type which is contained in its
	 * ancestry, return the type that #root_type is the immediate parent
	 * of. In other words, this function determines the type that is
	 * derived directly from #root_type which is also a base class of
	 * #leaf_type.  Given a root type and a leaf type, this function can
	 * be used to determine the types and order in which the leaf type is
	 * descended from the root type.
	 * @param leaf_type descendant of #root_type and the type to be returned
	 * @param root_type immediate parent of the returned type
	 * @returns immediate child of #root_type and ancestor of #leaf_type
	 */
	function type_next_base(leaf_type: GObject.Type, root_type: GObject.Type): GObject.Type;

	/**
	 * Return the direct parent type of the passed in type. If the passed
	 * in type has no parent, i.e. is a fundamental type, 0 is returned.
	 * @param type the derived type
	 * @returns the parent type
	 */
	function type_parent(type: GObject.Type): GObject.Type;

	/**
	 * Get the corresponding quark of the type IDs name.
	 * @param type type to return quark of type name for
	 * @returns the type names quark or 0
	 */
	function type_qname(type: GObject.Type): GLib.Quark;

	/**
	 * Queries the type system for information about a specific type.
	 * This function will fill in a user-provided structure to hold
	 * type-specific information. If an invalid #GType is passed in, the
	 * #type member of the #GTypeQuery is 0. All members filled into the
	 * #GTypeQuery structure should be considered constant and have to be
	 * left untouched.
	 * @param type #GType of a static, classed type
	 * @returns a user provided structure that is
	 *     filled in with constant values upon success
	 */
	function type_query(type: GObject.Type): TypeQuery;

	/**
	 * Registers #type_name as the name of a new dynamic type derived from
	 * #parent_type.  The type system uses the information contained in the
	 * #GTypePlugin structure pointed to by #plugin to manage the type and its
	 * instances (if not abstract).  The value of #flags determines the nature
	 * (e.g. abstract or not) of the type.
	 * @param parent_type type from which this type will be derived
	 * @param type_name 0-terminated string used as the name of the new type
	 * @param plugin #GTypePlugin structure to retrieve the #GTypeInfo from
	 * @param flags bitwise combination of #GTypeFlags values
	 * @returns the new type identifier or #G_TYPE_INVALID if registration failed
	 */
	function type_register_dynamic(parent_type: GObject.Type, type_name: string, plugin: TypePlugin, flags: TypeFlags): GObject.Type;

	/**
	 * Registers #type_id as the predefined identifier and #type_name as the
	 * name of a fundamental type. If #type_id is already registered, or a
	 * type named #type_name is already registered, the behaviour is undefined.
	 * The type system uses the information contained in the #GTypeInfo structure
	 * pointed to by #info and the #GTypeFundamentalInfo structure pointed to by
	 * #finfo to manage the type and its instances. The value of #flags determines
	 * additional characteristics of the fundamental type.
	 * @param type_id a predefined type identifier
	 * @param type_name 0-terminated string used as the name of the new type
	 * @param info #GTypeInfo structure for this type
	 * @param finfo #GTypeFundamentalInfo structure for this type
	 * @param flags bitwise combination of #GTypeFlags values
	 * @returns the predefined type identifier
	 */
	function type_register_fundamental(type_id: GObject.Type, type_name: string, info: TypeInfo, finfo: TypeFundamentalInfo, flags: TypeFlags): GObject.Type;

	/**
	 * Registers #type_name as the name of a new static type derived from
	 * #parent_type. The type system uses the information contained in the
	 * #GTypeInfo structure pointed to by #info to manage the type and its
	 * instances (if not abstract). The value of #flags determines the nature
	 * (e.g. abstract or not) of the type.
	 * @param parent_type type from which this type will be derived
	 * @param type_name 0-terminated string used as the name of the new type
	 * @param info #GTypeInfo structure for this type
	 * @param flags bitwise combination of #GTypeFlags values
	 * @returns the new type identifier
	 */
	function type_register_static(parent_type: GObject.Type, type_name: string, info: TypeInfo, flags: TypeFlags): GObject.Type;

	/**
	 * Registers #type_name as the name of a new static type derived from
	 * #parent_type.  The value of #flags determines the nature (e.g.
	 * abstract or not) of the type. It works by filling a #GTypeInfo
	 * struct and calling {@link G.type_register_static}.
	 * @param parent_type type from which this type will be derived
	 * @param type_name 0-terminated string used as the name of the new type
	 * @param class_size size of the class structure (see #GTypeInfo)
	 * @param class_init location of the class initialization function (see #GTypeInfo)
	 * @param instance_size size of the instance structure (see #GTypeInfo)
	 * @param instance_init location of the instance initialization function (see #GTypeInfo)
	 * @param flags bitwise combination of #GTypeFlags values
	 * @returns the new type identifier
	 */
	function type_register_static_simple(parent_type: GObject.Type, type_name: string, class_size: number, class_init: ClassInitFunc, instance_size: number, instance_init: InstanceInitFunc, flags: TypeFlags): GObject.Type;

	/**
	 * Removes a previously installed #GTypeClassCacheFunc. The cache
	 * maintained by #cache_func has to be empty when calling
	 * {@link G.type_remove_class_cache_func} to avoid leaks.
	 * @param cache_data data that was given when adding #cache_func
	 * @param cache_func a #GTypeClassCacheFunc
	 */
	function type_remove_class_cache_func(cache_data: any | null, cache_func: TypeClassCacheFunc): void;

	/**
	 * Removes an interface check function added with
	 * {@link G.type_add_interface_check}.
	 * @param check_data callback data passed to {@link G.type_add_interface_check}
	 * @param check_func callback function passed to {@link G.type_add_interface_check}
	 */
	function type_remove_interface_check(check_data: any | null, check_func: TypeInterfaceCheckFunc): void;

	/**
	 * Attaches arbitrary data to a type.
	 * @param type a #GType
	 * @param quark a #GQuark id to identify the data
	 * @param data the data
	 */
	function type_set_qdata(type: GObject.Type, quark: GLib.Quark, data: any | null): void;

	function type_test_flags(type: GObject.Type, flags: number): boolean;

	/**
	 * Returns the location of the #GTypeValueTable associated with #type.
	 * 
	 * Note that this function should only be used from source code
	 * that implements or has internal knowledge of the implementation of
	 * #type.
	 * @param type a #GType
	 * @returns location of the #GTypeValueTable associated with #type or
	 *     %NULL if there is no #GTypeValueTable associated with #type
	 */
	function type_value_table_peek(type: GObject.Type): TypeValueTable;

	/**
	 * Registers a value transformation function for use in {@link G.value_transform}.
	 * A previously registered transformation function for #src_type and #dest_type
	 * will be replaced.
	 * @param src_type Source type.
	 * @param dest_type Target type.
	 * @param transform_func a function which transforms values of type #src_type
	 *  into value of type #dest_type
	 */
	function value_register_transform_func(src_type: GObject.Type, dest_type: GObject.Type, transform_func: ValueTransform): void;

	/**
	 * Returns whether a #GValue of type #src_type can be copied into
	 * a #GValue of type #dest_type.
	 * @param src_type source type to be copied.
	 * @param dest_type destination type for copying.
	 * @returns %TRUE if {@link G.value_copy} is possible with #src_type and #dest_type.
	 */
	function value_type_compatible(src_type: GObject.Type, dest_type: GObject.Type): boolean;

	/**
	 * Check whether {@link G.value_transform} is able to transform values
	 * of type #src_type into values of type #dest_type. Note that for
	 * the types to be transformable, they must be compatible or a
	 * transformation function must be registered.
	 * @param src_type Source type.
	 * @param dest_type Target type.
	 * @returns %TRUE if the transformation is possible, %FALSE otherwise.
	 */
	function value_type_transformable(src_type: GObject.Type, dest_type: GObject.Type): boolean;

	/**
	 * Mask containing the bits of #GParamSpec.flags which are reserved for GLib.
	 * @returns Mask containing the bits of #GParamSpec.flags which are reserved for GLib.
	 */
	const PARAM_MASK: number;

	/**
	 * #GParamFlags value alias for %G_PARAM_STATIC_NAME | %G_PARAM_STATIC_NICK | %G_PARAM_STATIC_BLURB.
	 * 
	 * Since 2.13.0
	 * @returns #GParamFlags value alias for %G_PARAM_STATIC_NAME | %G_PARAM_STATIC_NICK | %G_PARAM_STATIC_BLURB.
	 * 
	 * Since 2.13.0
	 */
	const PARAM_STATIC_STRINGS: number;

	/**
	 * Minimum shift count to be used for user defined flags, to be stored in
	 * #GParamSpec.flags. The maximum allowed is 10.
	 * @returns Minimum shift count to be used for user defined flags, to be stored in
	 * #GParamSpec.flags. The maximum allowed is 10.
	 */
	const PARAM_USER_SHIFT: number;

	/**
	 * A mask for all #GSignalFlags bits.
	 * @returns A mask for all #GSignalFlags bits.
	 */
	const SIGNAL_FLAGS_MASK: number;

	/**
	 * A mask for all #GSignalMatchType bits.
	 * @returns A mask for all #GSignalMatchType bits.
	 */
	const SIGNAL_MATCH_MASK: number;

	/**
	 * A bit in the type number that's supposed to be left untouched.
	 * @returns A bit in the type number that's supposed to be left untouched.
	 */
	const TYPE_FLAG_RESERVED_ID_BIT: GLib.Type;

	/**
	 * An integer constant that represents the number of identifiers reserved
	 * for types that are assigned at compile-time.
	 * @returns An integer constant that represents the number of identifiers reserved
	 * for types that are assigned at compile-time.
	 */
	const TYPE_FUNDAMENTAL_MAX: number;

	/**
	 * Shift value used in converting numbers to type IDs.
	 * @returns Shift value used in converting numbers to type IDs.
	 */
	const TYPE_FUNDAMENTAL_SHIFT: number;

	/**
	 * First fundamental type number to create a new fundamental type id with
	 * {@link G.TYPE_MAKE_FUNDAMENTAL} reserved for BSE.
	 * @returns First fundamental type number to create a new fundamental type id with
	 * {@link G.TYPE_MAKE_FUNDAMENTAL} reserved for BSE.
	 */
	const TYPE_RESERVED_BSE_FIRST: number;

	/**
	 * Last fundamental type number reserved for BSE.
	 * @returns Last fundamental type number reserved for BSE.
	 */
	const TYPE_RESERVED_BSE_LAST: number;

	/**
	 * First fundamental type number to create a new fundamental type id with
	 * {@link G.TYPE_MAKE_FUNDAMENTAL} reserved for GLib.
	 * @returns First fundamental type number to create a new fundamental type id with
	 * {@link G.TYPE_MAKE_FUNDAMENTAL} reserved for GLib.
	 */
	const TYPE_RESERVED_GLIB_FIRST: number;

	/**
	 * Last fundamental type number reserved for GLib.
	 * @returns Last fundamental type number reserved for GLib.
	 */
	const TYPE_RESERVED_GLIB_LAST: number;

	/**
	 * First available fundamental type number to create new fundamental
	 * type id with {@link G.TYPE_MAKE_FUNDAMENTAL}.
	 * @returns First available fundamental type number to create new fundamental
	 * type id with {@link G.TYPE_MAKE_FUNDAMENTAL}.
	 */
	const TYPE_RESERVED_USER_FIRST: number;

	/**
	 * For string values, indicates that the string contained is canonical and will
	 * exist for the duration of the process. See {@link G.value_set_interned_string}.
	 * @returns For string values, indicates that the string contained is canonical and will
	 * exist for the duration of the process. See {@link G.value_set_interned_string}.
	 */
	const VALUE_INTERNED_STRING: number;

	/**
	 * If passed to {@link G.VALUE_COLLECT}, allocated data won't be copied
	 * but used verbatim. This does not affect ref-counted types like
	 * objects. This does not affect usage of g_value_copy(), the data will
	 * be copied if it is not ref-counted.
	 * @returns If passed to {@link G.VALUE_COLLECT}, allocated data won't be copied
	 * but used verbatim. This does not affect ref-counted types like
	 * objects. This does not affect usage of g_value_copy(), the data will
	 * be copied if it is not ref-counted.
	 */
	const VALUE_NOCOPY_CONTENTS: number;

}