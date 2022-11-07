/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.Gst {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Allocator} instead.
	 */
	interface IAllocator {
		readonly object: Object;
		readonly mem_type: string;
		/**
		 * the implementation of the GstMemoryMapFunction
		 */
		readonly mem_map: MemoryMapFunction;
		/**
		 * the implementation of the GstMemoryUnmapFunction
		 */
		readonly mem_unmap: MemoryUnmapFunction;
		/**
		 * the implementation of the GstMemoryCopyFunction
		 */
		readonly mem_copy: MemoryCopyFunction;
		/**
		 * the implementation of the GstMemoryShareFunction
		 */
		readonly mem_share: MemoryShareFunction;
		/**
		 * the implementation of the GstMemoryIsSpanFunction
		 */
		readonly mem_is_span: MemoryIsSpanFunction;
		/**
		 * the implementation of the GstMemoryMapFullFunction.
		 *      Will be used instead of #mem_map if present. (Since: 1.6)
		 */
		readonly mem_map_full: MemoryMapFullFunction;
		/**
		 * the implementation of the GstMemoryUnmapFullFunction.
		 *      Will be used instead of #mem_unmap if present. (Since: 1.6)
		 */
		readonly mem_unmap_full: MemoryUnmapFullFunction;
		/**
		 * Use #allocator to allocate a new memory block with memory that is at least
		 * #size big.
		 * 
		 * The optional #params can specify the prefix and padding for the memory. If
		 * %NULL is passed, no flags, no extra prefix/padding and a default alignment is
		 * used.
		 * 
		 * The prefix/padding will be filled with 0 if flags contains
		 * #GST_MEMORY_FLAG_ZERO_PREFIXED and #GST_MEMORY_FLAG_ZERO_PADDED respectively.
		 * 
		 * When #allocator is %NULL, the default allocator will be used.
		 * 
		 * The alignment in #params is given as a bitmask so that #align + 1 equals
		 * the amount of bytes to align to. For example, to align to 8 bytes,
		 * use an alignment of 7.
		 * @param size size of the visible memory area
		 * @param params optional parameters
		 * @returns a new {@link Memory}.
		 */
		alloc(size: number, params?: AllocationParams | null): Memory | null;
		/**
		 * Free #memory that was previously allocated with {@link Gst.Allocator.alloc}.
		 * @param memory the memory to free
		 */
		free(memory: Memory): void;
		/**
		 * Set the default allocator. This function takes ownership of #allocator.
		 */
		set_default(): void;
		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::mem_type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::mem_map", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::mem_unmap", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::mem_copy", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::mem_share", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::mem_is_span", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::mem_map_full", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::mem_unmap_full", callback: (owner: this, ...args: any) => void): number;

	}

	type AllocatorInitOptionsMixin = ObjectInitOptions
	export interface AllocatorInitOptions extends AllocatorInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Allocator} instead.
	 */
	type AllocatorMixin = IAllocator & Object;

	/**
	 * Memory is usually created by allocators with a {@link Gst.Allocator.alloc}
	 * method call. When %NULL is used as the allocator, the default allocator will
	 * be used.
	 * 
	 * New allocators can be registered with gst_allocator_register().
	 * Allocators are identified by name and can be retrieved with
	 * gst_allocator_find(). gst_allocator_set_default() can be used to change the
	 * default allocator.
	 * 
	 * New memory can be created with gst_memory_new_wrapped() that wraps the memory
	 * allocated elsewhere.
	 */
	interface Allocator extends AllocatorMixin {}

	class Allocator {
		public constructor(options?: Partial<AllocatorInitOptions>);
		/**
		 * Find a previously registered allocator with #name. When #name is %NULL, the
		 * default allocator will be returned.
		 * @param name the name of the allocator
		 * @returns a {@link Allocator} or %NULL when
		 * the allocator with #name was not registered. Use {@link Gst.Object.unref}
		 * to release the allocator after usage.
		 */
		public static find(name?: string | null): Allocator | null;
		/**
		 * Registers the memory #allocator with #name. This function takes ownership of
		 * #allocator.
		 * @param name the name of the allocator
		 * @param allocator {@link Allocator}
		 */
		public static register(name: string, allocator: Allocator): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Bin} instead.
	 */
	interface IBin {
		/**
		 * If set to %TRUE, the bin will handle asynchronous state changes.
		 * This should be used only if the bin subclass is modifying the state
		 * of its children on its own.
		 */
		async_handling: boolean;
		/**
		 * Forward all children messages, even those that would normally be filtered by
		 * the bin. This can be interesting when one wants to be notified of the EOS
		 * state of individual elements, for example.
		 * 
		 * The messages are converted to an ELEMENT message with the bin as the
		 * source. The structure of the message is named 'GstBinForwarded' and contains
		 * a field named 'message' of type GST_TYPE_MESSAGE that contains the original
		 * forwarded message.
		 */
		message_forward: boolean;
		readonly element: Element;
		/**
		 * the number of children in this bin
		 */
		readonly numchildren: number;
		/**
		 * the list of children in this bin
		 */
		readonly children: Element[];
		/**
		 * updated whenever #children changes
		 */
		readonly children_cookie: number;
		/**
		 * internal bus for handling child messages
		 */
		readonly child_bus: Bus;
		/**
		 * queued and cached messages
		 */
		readonly messages: Message[];
		/**
		 * the bin is currently calculating its state
		 */
		readonly polling: boolean;
		/**
		 * the bin needs to recalculate its state (deprecated)
		 */
		readonly state_dirty: boolean;
		/**
		 * the bin needs to select a new clock
		 */
		readonly clock_dirty: boolean;
		/**
		 * the last clock selected
		 */
		readonly provided_clock: Clock;
		/**
		 * the element that provided #provided_clock
		 */
		readonly clock_provider: Element;
		/**
		 * Adds the given element to the bin.  Sets the element's parent, and thus
		 * takes ownership of the element. An element can only be added to one bin.
		 * 
		 * If the element's pads are linked to other pads, the pads will be unlinked
		 * before the element is added to the bin.
		 * 
		 * > When you add an element to an already-running pipeline, you will have to
		 * > take care to set the state of the newly-added element to the desired
		 * > state (usually PLAYING or PAUSED, same you set the pipeline to originally)
		 * > with {@link Gst.Element.set_state}, or use gst_element_sync_state_with_parent().
		 * > The bin or pipeline will not take care of this for you.
		 * 
		 * MT safe.
		 * @param element the {@link Element} to add
		 * @returns %TRUE if the element could be added, %FALSE if
		 * the bin does not want to accept the element.
		 */
		add(element: Element): boolean;
		/**
		 * Adds a %NULL-terminated list of elements to a bin.  This function is
		 * equivalent to calling {@link Gst.Bin.add} for each member of the list. The return
		 * value of each gst_bin_add() is ignored.
		 * @param element_1 the {@link Element} element to add to the bin
		 */
		add_many(element_1: Element): void;
		/**
		 * Recursively looks for elements with an unlinked pad of the given
		 * direction within the specified bin and returns an unlinked pad
		 * if one is found, or %NULL otherwise. If a pad is found, the caller
		 * owns a reference to it and should use {@link Gst.Object.unref} on the
		 * pad when it is not needed any longer.
		 * @param direction whether to look for an unlinked source or sink pad
		 * @returns unlinked pad of the given
		 * direction, %NULL.
		 */
		find_unlinked_pad(direction: PadDirection): Pad | null;
		/**
		 * Looks for an element inside the bin that implements the given
		 * interface. If such an element is found, it returns the element.
		 * You can cast this element to the given interface afterwards.  If you want
		 * all elements that implement the interface, use
		 * {@link Gst.Bin.iterate_all_by_interface}. This function recurses into child bins.
		 * 
		 * MT safe.  Caller owns returned reference.
		 * @param iface the #GType of an interface
		 * @returns A {@link Element} inside the bin
		 * implementing the interface
		 */
		get_by_interface(iface: GObject.Type): Element | null;
		/**
		 * Gets the element with the given name from a bin. This
		 * function recurses into child bins.
		 * 
		 * Returns %NULL if no element with the given name is found in the bin.
		 * 
		 * MT safe.  Caller owns returned reference.
		 * @param name the element name to search for
		 * @returns the {@link Element} with the given
		 * name, or %NULL
		 */
		get_by_name(name: string): Element | null;
		/**
		 * Gets the element with the given name from this bin. If the
		 * element is not found, a recursion is performed on the parent bin.
		 * 
		 * Returns %NULL if:
		 * - no element with the given name is found in the bin
		 * 
		 * MT safe.  Caller owns returned reference.
		 * @param name the element name to search for
		 * @returns the {@link Element} with the given
		 * name, or %NULL
		 */
		get_by_name_recurse_up(name: string): Element | null;
		/**
		 * Return the suppressed flags of the bin.
		 * 
		 * MT safe.
		 * @returns the bin's suppressed {@link ElementFlags}.
		 */
		get_suppressed_flags(): ElementFlags;
		/**
		 * Looks for all elements inside the bin with the given element factory name.
		 * The function recurses inside child bins. The iterator will yield a series of
		 * {@link Element} that should be unreffed after use.
		 * 
		 * MT safe. Caller owns returned value.
		 * @param factory_name the name of the {@link ElementFactory}
		 * @returns a {@link Iterator} of #GstElement
		 *     for all elements in the bin with the given element factory name,
		 *     or %NULL.
		 */
		iterate_all_by_element_factory_name(factory_name: string): Iterator | null;
		/**
		 * Looks for all elements inside the bin that implements the given
		 * interface. You can safely cast all returned elements to the given interface.
		 * The function recurses inside child bins. The iterator will yield a series
		 * of {@link Element} that should be unreffed after use.
		 * 
		 * MT safe.  Caller owns returned value.
		 * @param iface the #GType of an interface
		 * @returns a {@link Iterator} of #GstElement
		 *     for all elements in the bin implementing the given interface,
		 *     or %NULL
		 */
		iterate_all_by_interface(iface: GObject.Type): Iterator | null;
		/**
		 * Gets an iterator for the elements in this bin.
		 * 
		 * MT safe.  Caller owns returned value.
		 * @returns a {@link Iterator} of #GstElement,
		 * or %NULL
		 */
		iterate_elements(): Iterator | null;
		/**
		 * Gets an iterator for the elements in this bin.
		 * This iterator recurses into GstBin children.
		 * 
		 * MT safe.  Caller owns returned value.
		 * @returns a {@link Iterator} of #GstElement,
		 * or %NULL
		 */
		iterate_recurse(): Iterator | null;
		/**
		 * Gets an iterator for all elements in the bin that have the
		 * #GST_ELEMENT_FLAG_SINK flag set.
		 * 
		 * MT safe.  Caller owns returned value.
		 * @returns a {@link Iterator} of #GstElement,
		 * or %NULL
		 */
		iterate_sinks(): Iterator | null;
		/**
		 * Gets an iterator for the elements in this bin in topologically
		 * sorted order. This means that the elements are returned from
		 * the most downstream elements (sinks) to the sources.
		 * 
		 * This function is used internally to perform the state changes
		 * of the bin elements and for clock selection.
		 * 
		 * MT safe.  Caller owns returned value.
		 * @returns a {@link Iterator} of #GstElement,
		 * or %NULL
		 */
		iterate_sorted(): Iterator | null;
		/**
		 * Gets an iterator for all elements in the bin that have the
		 * #GST_ELEMENT_FLAG_SOURCE flag set.
		 * 
		 * MT safe.  Caller owns returned value.
		 * @returns a {@link Iterator} of #GstElement,
		 * or %NULL
		 */
		iterate_sources(): Iterator | null;
		/**
		 * Query #bin for the current latency using and reconfigures this latency to all the
		 * elements with a LATENCY event.
		 * 
		 * This method is typically called on the pipeline when a #GST_MESSAGE_LATENCY
		 * is posted on the bus.
		 * 
		 * This function simply emits the 'do-latency' signal so any custom latency
		 * calculations will be performed.
		 * @returns %TRUE if the latency could be queried and reconfigured.
		 */
		recalculate_latency(): boolean;
		/**
		 * Removes the element from the bin, unparenting it as well.
		 * Unparenting the element means that the element will be dereferenced,
		 * so if the bin holds the only reference to the element, the element
		 * will be freed in the process of removing it from the bin.  If you
		 * want the element to still exist after removing, you need to call
		 * {@link Gst.Object.ref} before removing it from the bin.
		 * 
		 * If the element's pads are linked to other pads, the pads will be unlinked
		 * before the element is removed from the bin.
		 * 
		 * MT safe.
		 * @param element the {@link Element} to remove
		 * @returns %TRUE if the element could be removed, %FALSE if
		 * the bin does not want to remove the element.
		 */
		remove(element: Element): boolean;
		/**
		 * Remove a list of elements from a bin. This function is equivalent
		 * to calling {@link Gst.Bin.remove} with each member of the list.
		 * @param element_1 the first {@link Element} to remove from the bin
		 */
		remove_many(element_1: Element): void;
		/**
		 * Suppress the given flags on the bin. {@link ElementFlags} of a
		 * child element are propagated when it is added to the bin.
		 * When suppressed flags are set, those specified flags will
		 * not be propagated to the bin.
		 * 
		 * MT safe.
		 * @param flags the {@link ElementFlags} to suppress
		 */
		set_suppressed_flags(flags: ElementFlags): void;
		/**
		 * Synchronizes the state of every child of #bin with the state
		 * of #bin. See also {@link Gst.Element.sync_state_with_parent}.
		 * @returns %TRUE if syncing the state was successful for all children,
		 *  otherwise %FALSE.
		 */
		sync_children_states(): boolean;
		/**
		 * Will be emitted after the element was added to sub_bin.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - sub_bin: the {@link Bin} the element was added to 
		 *  - element: the #GstElement that was added to #sub_bin 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "deep-element-added", callback: (owner: this, sub_bin: Bin, element: Element) => void): number;
		/**
		 * Will be emitted after the element was removed from sub_bin.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - sub_bin: the {@link Bin} the element was removed from 
		 *  - element: the #GstElement that was removed from #sub_bin 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "deep-element-removed", callback: (owner: this, sub_bin: Bin, element: Element) => void): number;
		/**
		 * Will be emitted when the bin needs to perform latency calculations. This
		 * signal is only emitted for toplevel bins or when async-handling is
		 * enabled.
		 * 
		 * Only one signal handler is invoked. If no signals are connected, the
		 * default handler is invoked, which will query and distribute the lowest
		 * possible latency to all sinks.
		 * 
		 * Connect to this signal if the default latency calculations are not
		 * sufficient, like when you need different latencies for different sinks in
		 * the same pipeline.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - returns  
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "do-latency", callback: (owner: this) => boolean): number;
		/**
		 * Will be emitted after the element was added to the bin.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - element: the {@link Element} that was added to the bin 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "element-added", callback: (owner: this, element: Element) => void): number;
		/**
		 * Will be emitted after the element was removed from the bin.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - element: the {@link Element} that was removed from the bin 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "element-removed", callback: (owner: this, element: Element) => void): number;

		connect(signal: "notify::async-handling", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::message-forward", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::element", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::numchildren", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::children", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::children_cookie", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::child_bus", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::messages", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::polling", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::state_dirty", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::clock_dirty", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::provided_clock", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::clock_provider", callback: (owner: this, ...args: any) => void): number;

	}

	type BinInitOptionsMixin = ElementInitOptions & ChildProxyInitOptions & 
	Pick<IBin,
		"async_handling" |
		"message_forward">;

	export interface BinInitOptions extends BinInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Bin} instead.
	 */
	type BinMixin = IBin & Element & ChildProxy;

	/**
	 * {@link Bin} is an element that can contain other #GstElement, allowing them to be
	 * managed as a group.
	 * Pads from the child elements can be ghosted to the bin, see #GstGhostPad.
	 * This makes the bin look like any other elements and enables creation of
	 * higher-level abstraction elements.
	 * 
	 * A new #GstBin is created with {@link Gst.Bin.new}. Use a #GstPipeline instead if you
	 * want to create a toplevel bin because a normal bin doesn't have a bus or
	 * handle clock distribution of its own.
	 * 
	 * After the bin has been created you will typically add elements to it with
	 * gst_bin_add(). You can remove elements with gst_bin_remove().
	 * 
	 * An element can be retrieved from a bin with gst_bin_get_by_name(), using the
	 * elements name. gst_bin_get_by_name_recurse_up() is mainly used for internal
	 * purposes and will query the parent bins when the element is not found in the
	 * current bin.
	 * 
	 * An iterator of elements in a bin can be retrieved with
	 * gst_bin_iterate_elements(). Various other iterators exist to retrieve the
	 * elements in a bin.
	 * 
	 * gst_object_unref() is used to drop your reference to the bin.
	 * 
	 * The #GstBin::element-added signal is fired whenever a new element is added to
	 * the bin. Likewise the #GstBin::element-removed signal is fired whenever an
	 * element is removed from the bin.
	 * 
	 * ## Notes
	 * 
	 * A #GstBin internally intercepts every #GstMessage posted by its children and
	 * implements the following default behaviour for each of them:
	 * 
	 * * GST_MESSAGE_EOS: This message is only posted by sinks in the PLAYING
	 * state. If all sinks posted the EOS message, this bin will post and EOS
	 * message upwards.
	 * 
	 * * GST_MESSAGE_SEGMENT_START: Just collected and never forwarded upwards.
	 * The messages are used to decide when all elements have completed playback
	 * of their segment.
	 * 
	 * * GST_MESSAGE_SEGMENT_DONE: Is posted by #GstBin when all elements that posted
	 * a SEGMENT_START have posted a SEGMENT_DONE.
	 * 
	 * * GST_MESSAGE_DURATION_CHANGED: Is posted by an element that detected a change
	 * in the stream duration. The duration change is posted to the
	 * application so that it can refetch the new duration with a duration
	 * query. Note that these messages can be posted before the bin is
	 * prerolled, in which case the duration query might fail. Note also that
	 * there might be a discrepancy (due to internal buffering/queueing) between the
	 * stream being currently displayed and the returned duration query.
	 * Applications might want to also query for duration (and changes) by
	 * listening to the GST_MESSAGE_STREAM_START message, signaling the active start
	 * of a (new) stream.
	 * 
	 * * GST_MESSAGE_CLOCK_LOST: This message is posted by an element when it
	 * can no longer provide a clock. The default bin behaviour is to
	 * check if the lost clock was the one provided by the bin. If so and
	 * the bin is currently in the PLAYING state, the message is forwarded to
	 * the bin parent.
	 * This message is also generated when a clock provider is removed from
	 * the bin. If this message is received by the application, it should
	 * PAUSE the pipeline and set it back to PLAYING to force a new clock
	 * distribution.
	 * 
	 * * GST_MESSAGE_CLOCK_PROVIDE: This message is generated when an element
	 * can provide a clock. This mostly happens when a new clock
	 * provider is added to the bin. The default behaviour of the bin is to
	 * mark the currently selected clock as dirty, which will perform a clock
	 * recalculation the next time the bin is asked to provide a clock.
	 * This message is never sent tot the application but is forwarded to
	 * the parent of the bin.
	 * 
	 * * OTHERS: posted upwards.
	 * 
	 * A #GstBin implements the following default behaviour for answering to a
	 * #GstQuery:
	 * 
	 * * GST_QUERY_DURATION: The bin will forward the query to all sink
	 * elements contained within and will return the maximum value.
	 * If no sinks are available in the bin, the query fails.
	 * 
	 * * GST_QUERY_POSITION:The query is sent to all sink elements in the bin and the
	 * MAXIMUM of all values is returned. If no sinks are available in the bin,
	 * the query fails.
	 * 
	 * * OTHERS:the query is forwarded to all sink elements, the result
	 * of the first sink that answers the query successfully is returned. If no
	 * sink is in the bin, the query fails.
	 * 
	 * A #GstBin will by default forward any event sent to it to all sink
	 * (#GST_EVENT_TYPE_DOWNSTREAM) or source (#GST_EVENT_TYPE_UPSTREAM) elements
	 * depending on the event type.
	 * If all the elements return %TRUE, the bin will also return %TRUE, else %FALSE
	 * is returned. If no elements of the required type are in the bin, the event
	 * handler will return %TRUE.
	 */
	interface Bin extends BinMixin {}

	class Bin {
		public constructor(options?: Partial<BinInitOptions>);
		/**
		 * Creates a new bin with the given name.
		 * @param name the name of the new bin
		 * @returns a new {@link Bin}
		 */
		public static new(name?: string | null): Element;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Bitmask} instead.
	 */
	interface IBitmask {

	}

	type BitmaskInitOptionsMixin  = {};
	export interface BitmaskInitOptions extends BitmaskInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Bitmask} instead.
	 */
	type BitmaskMixin = IBitmask;

	/**
	 * A fundamental type that describes a 64-bit bitmask
	 */
	interface Bitmask extends BitmaskMixin {}

	class Bitmask {
		public constructor(options?: Partial<BitmaskInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BufferPool} instead.
	 */
	interface IBufferPool {
		readonly object: Object;
		readonly flushing: number;
		/**
		 * Acquire a buffer from #pool. #buffer should point to a memory location that
		 * can hold a pointer to the new buffer.
		 * 
		 * #params can be %NULL or contain optional parameters to influence the
		 * allocation.
		 * @param params parameters.
		 * @returns a {@link FlowReturn} such as %GST_FLOW_FLUSHING when the pool is
		 * inactive.
		 * 
		 * a location for a #GstBuffer
		 */
		acquire_buffer(params?: BufferPoolAcquireParams | null): [ FlowReturn, Buffer ];
		/**
		 * Get a copy of the current configuration of the pool. This configuration
		 * can either be modified and used for the {@link Gst.BufferPool.set_config} call
		 * or it must be freed after usage.
		 * @returns a copy of the current configuration of #pool. use
		 * {@link Gst.Structure.free} after usage or gst_buffer_pool_set_config().
		 */
		get_config(): Structure;
		/**
		 * Get a %NULL terminated array of string with supported bufferpool options for
		 * #pool. An option would typically be enabled with
		 * {@link Gst.BufferPool.config_add_option}.
		 * @returns a %NULL terminated array
		 *          of strings.
		 */
		get_options(): string[];
		/**
		 * Check if the bufferpool supports #option.
		 * @param option an option
		 * @returns %TRUE if the buffer pool contains #option.
		 */
		has_option(option: string): boolean;
		/**
		 * Check if #pool is active. A pool can be activated with the
		 * {@link Gst.BufferPool.set_active} call.
		 * @returns %TRUE when the pool is active.
		 */
		is_active(): boolean;
		/**
		 * Release #buffer to #pool. #buffer should have previously been allocated from
		 * #pool with {@link Gst.BufferPool.acquire_buffer}.
		 * 
		 * This function is usually called automatically when the last ref on #buffer
		 * disappears.
		 * @param buffer a {@link Buffer}
		 */
		release_buffer(buffer: Buffer): void;
		/**
		 * Control the active state of #pool. When the pool is inactive, new calls to
		 * {@link Gst.BufferPool.acquire_buffer} will return with %GST_FLOW_FLUSHING.
		 * 
		 * Activating the bufferpool will preallocate all resources in the pool based on
		 * the configuration of the pool.
		 * 
		 * Deactivating will free the resources again when there are no outstanding
		 * buffers. When there are outstanding buffers, they will be freed as soon as
		 * they are all returned to the pool.
		 * @param active the new active state
		 * @returns %FALSE when the pool was not configured or when preallocation of the
		 * buffers failed.
		 */
		set_active(active: boolean): boolean;
		/**
		 * Set the configuration of the pool. If the pool is already configured, and
		 * the configuration haven't change, this function will return %TRUE. If the
		 * pool is active, this method will return %FALSE and active configuration
		 * will remain. Buffers allocated form this pool must be returned or else this
		 * function will do nothing and return %FALSE.
		 * 
		 * #config is a {@link Structure} that contains the configuration parameters for
		 * the pool. A default and mandatory set of parameters can be configured with
		 * {@link Gst.BufferPool.config_set_params}, gst_buffer_pool_config_set_allocator()
		 * and gst_buffer_pool_config_add_option().
		 * 
		 * If the parameters in #config can not be set exactly, this function returns
		 * %FALSE and will try to update as much state as possible. The new state can
		 * then be retrieved and refined with gst_buffer_pool_get_config().
		 * 
		 * This function takes ownership of #config.
		 * @param config a {@link Structure}
		 * @returns %TRUE when the configuration could be set.
		 */
		set_config(config: Structure): boolean;
		/**
		 * Enable or disable the flushing state of a #pool without freeing or
		 * allocating buffers.
		 * @param flushing whether to start or stop flushing
		 */
		set_flushing(flushing: boolean): void;
		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::flushing", callback: (owner: this, ...args: any) => void): number;

	}

	type BufferPoolInitOptionsMixin = ObjectInitOptions
	export interface BufferPoolInitOptions extends BufferPoolInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link BufferPool} instead.
	 */
	type BufferPoolMixin = IBufferPool & Object;

	/**
	 * A {@link BufferPool} is an object that can be used to pre-allocate and recycle
	 * buffers of the same size and with the same properties.
	 * 
	 * A #GstBufferPool is created with {@link Gst.BufferPool.new}.
	 * 
	 * Once a pool is created, it needs to be configured. A call to
	 * gst_buffer_pool_get_config() returns the current configuration structure from
	 * the pool. With gst_buffer_pool_config_set_params() and
	 * gst_buffer_pool_config_set_allocator() the bufferpool parameters and
	 * allocator can be configured. Other properties can be configured in the pool
	 * depending on the pool implementation.
	 * 
	 * A bufferpool can have extra options that can be enabled with
	 * gst_buffer_pool_config_add_option(). The available options can be retrieved
	 * with gst_buffer_pool_get_options(). Some options allow for additional
	 * configuration properties to be set.
	 * 
	 * After the configuration structure has been configured,
	 * gst_buffer_pool_set_config() updates the configuration in the pool. This can
	 * fail when the configuration structure is not accepted.
	 * 
	 * After the a pool has been configured, it can be activated with
	 * gst_buffer_pool_set_active(). This will preallocate the configured resources
	 * in the pool.
	 * 
	 * When the pool is active, gst_buffer_pool_acquire_buffer() can be used to
	 * retrieve a buffer from the pool.
	 * 
	 * Buffers allocated from a bufferpool will automatically be returned to the
	 * pool with gst_buffer_pool_release_buffer() when their refcount drops to 0.
	 * 
	 * The bufferpool can be deactivated again with gst_buffer_pool_set_active().
	 * All further gst_buffer_pool_acquire_buffer() calls will return an error. When
	 * all buffers are returned to the pool they will be freed.
	 * 
	 * Use gst_object_unref() to release the reference to a bufferpool. If the
	 * refcount of the pool reaches 0, the pool will be freed.
	 */
	interface BufferPool extends BufferPoolMixin {}

	class BufferPool {
		public constructor(options?: Partial<BufferPoolInitOptions>);
		/**
		 * Creates a new {@link BufferPool} instance.
		 * @returns a new {@link BufferPool} instance
		 */
		public static new(): BufferPool;
		/**
		 * Enabled the option in #config. This will instruct the #bufferpool to enable
		 * the specified option on the buffers that it allocates.
		 * 
		 * The supported options by #pool can be retrieved with {@link Gst.BufferPool.get_options}.
		 * @param config a {@link BufferPool} configuration
		 * @param option an option to add
		 */
		public static config_add_option(config: Structure, option: string): void;
		/**
		 * Get the #allocator and #params from #config.
		 * @param config a {@link BufferPool} configuration
		 * @returns %TRUE, if the values are set.
		 * 
		 * a {@link Allocator}, or %NULL
		 * 
		 * #GstAllocationParams, or %NULL
		 */
		public static config_get_allocator(config: Structure): [ boolean, Allocator | null, AllocationParams | null ];
		/**
		 * Parse an available #config and get the option at #index of the options API
		 * array.
		 * @param config a {@link BufferPool} configuration
		 * @param index position in the option array to read
		 * @returns a #gchar of the option at #index.
		 */
		public static config_get_option(config: Structure, index: number): string | null;
		/**
		 * Get the configuration values from #config.
		 * @param config a {@link BufferPool} configuration
		 * @returns %TRUE if all parameters could be fetched.
		 * 
		 * the caps of buffers
		 * 
		 * the size of each buffer, not including prefix and padding
		 * 
		 * the minimum amount of buffers to allocate.
		 * 
		 * the maximum amount of buffers to allocate or 0 for unlimited.
		 */
		public static config_get_params(config: Structure): [ boolean, Caps | null, number | null, number | null, number | null ];
		/**
		 * Check if #config contains #option.
		 * @param config a {@link BufferPool} configuration
		 * @param option an option
		 * @returns %TRUE if the options array contains #option.
		 */
		public static config_has_option(config: Structure, option: string): boolean;
		/**
		 * Retrieve the number of values currently stored in the options array of the
		 * #config structure.
		 * @param config a {@link BufferPool} configuration
		 * @returns the options array size as a #guint.
		 */
		public static config_n_options(config: Structure): number;
		/**
		 * Set the #allocator and #params on #config.
		 * 
		 * One of #allocator and #params can be %NULL, but not both. When #allocator
		 * is %NULL, the default allocator of the pool will use the values in #param
		 * to perform its allocation. When #param is %NULL, the pool will use the
		 * provided #allocator with its default {@link AllocationParams}.
		 * 
		 * A call to {@link Gst.BufferPool.set_config} can update the allocator and params
		 * with the values that it is able to do. Some pools are, for example, not able
		 * to operate with different allocators or cannot allocate with the values
		 * specified in #params. Use gst_buffer_pool_get_config() to get the currently
		 * used values.
		 * @param config a {@link BufferPool} configuration
		 * @param allocator a {@link Allocator}
		 * @param params {@link AllocationParams}
		 */
		public static config_set_allocator(config: Structure, allocator?: Allocator | null, params?: AllocationParams | null): void;
		/**
		 * Configure #config with the given parameters.
		 * @param config a {@link BufferPool} configuration
		 * @param caps caps for the buffers
		 * @param size the size of each buffer, not including prefix and padding
		 * @param min_buffers the minimum amount of buffers to allocate.
		 * @param max_buffers the maximum amount of buffers to allocate or 0 for unlimited.
		 */
		public static config_set_params(config: Structure, caps: Caps | null, size: number, min_buffers: number, max_buffers: number): void;
		/**
		 * Validate that changes made to #config are still valid in the context of the
		 * expected parameters. This function is a helper that can be used to validate
		 * changes made by a pool to a config when {@link Gst.BufferPool.set_config}
		 * returns %FALSE. This expects that #caps haven't changed and that
		 * #min_buffers aren't lower then what we initially expected.
		 * This does not check if options or allocator parameters are still valid,
		 * won't check if size have changed, since changing the size is valid to adapt
		 * padding.
		 * @param config a {@link BufferPool} configuration
		 * @param caps the excepted caps of buffers
		 * @param size the expected size of each buffer, not including prefix and padding
		 * @param min_buffers the expected minimum amount of buffers to allocate.
		 * @param max_buffers the expect maximum amount of buffers to allocate or 0 for unlimited.
		 * @returns %TRUE, if the parameters are valid in this context.
		 */
		public static config_validate_params(config: Structure, caps: Caps | null, size: number, min_buffers: number, max_buffers: number): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Bus} instead.
	 */
	interface IBus {
		readonly object: Object;
		/**
		 * Adds a bus signal watch to the default main context with the default priority
		 * (%G_PRIORITY_DEFAULT). It is also possible to use a non-default
		 * main context set up using {@link G.main_context_push_thread_default} (before
		 * one had to create a bus watch source and attach it to the desired main
		 * context 'manually').
		 * 
		 * After calling this statement, the bus will emit the "message" signal for each
		 * message posted on the bus.
		 * 
		 * This function may be called multiple times. To clean up, the caller is
		 * responsible for calling gst_bus_remove_signal_watch() as many times as this
		 * function is called.
		 * 
		 * MT safe.
		 */
		add_signal_watch(): void;
		/**
		 * Adds a bus signal watch to the default main context with the given #priority
		 * (e.g. %G_PRIORITY_DEFAULT). It is also possible to use a non-default main
		 * context set up using {@link G.main_context_push_thread_default}
		 * (before one had to create a bus watch source and attach it to the desired
		 * main context 'manually').
		 * 
		 * After calling this statement, the bus will emit the "message" signal for each
		 * message posted on the bus when the main loop is running.
		 * 
		 * This function may be called multiple times. To clean up, the caller is
		 * responsible for calling gst_bus_remove_signal_watch() as many times as this
		 * function is called.
		 * 
		 * There can only be a single bus watch per bus, you must remove any signal
		 * watch before you can set another type of watch.
		 * 
		 * MT safe.
		 * @param priority The priority of the watch.
		 */
		add_signal_watch_full(priority: number): void;
		/**
		 * Adds a bus watch to the default main context with the given #priority (e.g.
		 * %G_PRIORITY_DEFAULT). It is also possible to use a non-default  main
		 * context set up using {@link G.main_context_push_thread_default} (before
		 * one had to create a bus watch source and attach it to the desired main
		 * context 'manually').
		 * 
		 * This function is used to receive asynchronous messages in the main loop.
		 * There can only be a single bus watch per bus, you must remove it before you
		 * can set a new one.
		 * 
		 * The bus watch will only work if a GLib main loop is being run.
		 * 
		 * When #func is called, the message belongs to the caller; if you want to
		 * keep a copy of it, call gst_message_ref() before leaving #func.
		 * 
		 * The watch can be removed using gst_bus_remove_watch() or by returning %FALSE
		 * from #func. If the watch was added to the default main context it is also
		 * possible to remove the watch using g_source_remove().
		 * 
		 * The bus watch will take its own reference to the #bus, so it is safe to unref
		 * #bus using gst_object_unref() after setting the bus watch.
		 * 
		 * MT safe.
		 * @param priority The priority of the watch.
		 * @param func A function to call when a message is received.
		 * @returns The event source id or 0 if #bus already got an event source.
		 */
		add_watch(priority: number, func: BusFunc): number;
		/**
		 * A helper {@link BusFunc} that can be used to convert all asynchronous messages
		 * into signals.
		 * @param message the {@link Message} received
		 * @param data user data
		 * @returns %TRUE
		 */
		async_signal_func(message: Message, data?: any | null): boolean;
		/**
		 * Create watch for this bus. The GSource will be dispatched whenever
		 * a message is on the bus. After the GSource is dispatched, the
		 * message is popped off the bus and unreffed.
		 * @returns a #GSource that can be added to a mainloop.
		 */
		create_watch(): GLib.Source | null;
		/**
		 * Instructs GStreamer to stop emitting the "sync-message" signal for this bus.
		 * See {@link Gst.Bus.enable_sync_message_emission} for more information.
		 * 
		 * In the event that multiple pieces of code have called
		 * gst_bus_enable_sync_message_emission(), the sync-message emissions will only
		 * be stopped after all calls to gst_bus_enable_sync_message_emission() were
		 * "cancelled" by calling this function. In this way the semantics are exactly
		 * the same as gst_object_ref() that which calls enable should also call
		 * disable.
		 * 
		 * MT safe.
		 */
		disable_sync_message_emission(): void;
		/**
		 * Instructs GStreamer to emit the "sync-message" signal after running the bus's
		 * sync handler. This function is here so that code can ensure that they can
		 * synchronously receive messages without having to affect what the bin's sync
		 * handler is.
		 * 
		 * This function may be called multiple times. To clean up, the caller is
		 * responsible for calling {@link Gst.Bus.disable_sync_message_emission} as many times
		 * as this function is called.
		 * 
		 * While this function looks similar to gst_bus_add_signal_watch(), it is not
		 * exactly the same -- this function enables *synchronous* emission of
		 * signals when messages arrive; gst_bus_add_signal_watch() adds an idle callback
		 * to pop messages off the bus *asynchronously*. The sync-message signal
		 * comes from the thread of whatever object posted the message; the "message"
		 * signal is marshalled to the main thread via the main loop.
		 * 
		 * MT safe.
		 */
		enable_sync_message_emission(): void;
		/**
		 * Gets the file descriptor from the bus which can be used to get notified about
		 * messages being available with functions like {@link G.poll}, and allows integration
		 * into other event loops based on file descriptors.
		 * Whenever a message is available, the POLLIN / %G_IO_IN event is set.
		 * 
		 * Warning: NEVER read or write anything to the returned fd but only use it
		 * for getting notifications via g_poll() or similar and then use the normal
		 * GstBus API, e.g. gst_bus_pop().
		 * @returns A GPollFD to fill
		 */
		get_pollfd(): GLib.PollFD;
		/**
		 * Check if there are pending messages on the bus that
		 * should be handled.
		 * @returns %TRUE if there are messages on the bus to be handled, %FALSE
		 * otherwise.
		 * 
		 * MT safe.
		 */
		have_pending(): boolean;
		/**
		 * Peek the message on the top of the bus' queue. The message will remain
		 * on the bus' message queue. A reference is returned, and needs to be unreffed
		 * by the caller.
		 * @returns the {@link Message} that is on the
		 *     bus, or %NULL if the bus is empty.
		 * 
		 * MT safe.
		 */
		peek(): Message | null;
		/**
		 * Poll the bus for messages. Will block while waiting for messages to come.
		 * You can specify a maximum time to poll with the #timeout parameter. If
		 * #timeout is negative, this function will block indefinitely.
		 * 
		 * All messages not in #events will be popped off the bus and will be ignored.
		 * It is not possible to use message enums beyond #GST_MESSAGE_EXTENDED in the
		 * #events mask
		 * 
		 * Because poll is implemented using the "message" signal enabled by
		 * {@link Gst.Bus.add_signal_watch}, calling gst_bus_poll() will cause the "message"
		 * signal to be emitted for every message that poll sees. Thus a "message"
		 * signal handler will see the same messages that this function sees -- neither
		 * will steal messages from the other.
		 * 
		 * This function will run a main loop from the default main context when
		 * polling.
		 * 
		 * You should never use this function, since it is pure evil. This is
		 * especially true for GUI applications based on Gtk+ or Qt, but also for any
		 * other non-trivial application that uses the GLib main loop. As this function
		 * runs a GLib main loop, any callback attached to the default GLib main
		 * context may be invoked. This could be timeouts, GUI events, I/O events etc.;
		 * even if gst_bus_poll() is called with a 0 timeout. Any of these callbacks
		 * may do things you do not expect, e.g. destroy the main application window or
		 * some other resource; change other application state; display a dialog and
		 * run another main loop until the user clicks it away. In short, using this
		 * function may add a lot of complexity to your code through unexpected
		 * re-entrancy and unexpected changes to your application's state.
		 * 
		 * For 0 timeouts use gst_bus_pop_filtered() instead of this function; for
		 * other short timeouts use gst_bus_timed_pop_filtered(); everything else is
		 * better handled by setting up an asynchronous bus watch and doing things
		 * from there.
		 * @param events a mask of {@link MessageType}, representing the set of message types to
		 * poll for (note special handling of extended message types below)
		 * @param timeout the poll timeout, as a {@link ClockTime}, or #GST_CLOCK_TIME_NONE to poll
		 * indefinitely.
		 * @returns the message that was received,
		 *     or %NULL if the poll timed out. The message is taken from the
		 *     bus and needs to be unreffed with {@link Gst.Message.unref} after
		 *     usage.
		 */
		poll(events: MessageType, timeout: ClockTime): Message | null;
		/**
		 * Get a message from the bus.
		 * @returns the {@link Message} that is on the
		 *     bus, or %NULL if the bus is empty. The message is taken from
		 *     the bus and needs to be unreffed with {@link Gst.Message.unref} after
		 *     usage.
		 * 
		 * MT safe.
		 */
		pop(): Message | null;
		/**
		 * Get a message matching #type from the bus.  Will discard all messages on
		 * the bus that do not match #type and that have been posted before the first
		 * message that does match #type.  If there is no message matching #type on
		 * the bus, all messages will be discarded. It is not possible to use message
		 * enums beyond #GST_MESSAGE_EXTENDED in the #events mask.
		 * @param types message types to take into account
		 * @returns the next {@link Message} matching
		 *     #type that is on the bus, or %NULL if the bus is empty or there
		 *     is no message matching #type. The message is taken from the bus
		 *     and needs to be unreffed with {@link Gst.Message.unref} after usage.
		 * 
		 * MT safe.
		 */
		pop_filtered(types: MessageType): Message | null;
		/**
		 * Post a message on the given bus. Ownership of the message
		 * is taken by the bus.
		 * @param message the {@link Message} to post
		 * @returns %TRUE if the message could be posted, %FALSE if the bus is flushing.
		 * 
		 * MT safe.
		 */
		post(message: Message): boolean;
		/**
		 * Removes a signal watch previously added with {@link Gst.Bus.add_signal_watch}.
		 * 
		 * MT safe.
		 */
		remove_signal_watch(): void;
		/**
		 * Removes an installed bus watch from #bus.
		 * @returns %TRUE on success or %FALSE if #bus has no event source.
		 */
		remove_watch(): boolean;
		/**
		 * If #flushing, flush out and unref any messages queued in the bus. Releases
		 * references to the message origin objects. Will flush future messages until
		 * {@link Gst.Bus.set_flushing} sets #flushing to %FALSE.
		 * 
		 * MT safe.
		 * @param flushing whether or not to flush the bus
		 */
		set_flushing(flushing: boolean): void;
		/**
		 * Sets the synchronous handler on the bus. The function will be called
		 * every time a new message is posted on the bus. Note that the function
		 * will be called in the same thread context as the posting object. This
		 * function is usually only called by the creator of the bus. Applications
		 * should handle messages asynchronously using the gst_bus watch and poll
		 * functions.
		 * 
		 * Before 1.16.3 it was not possible to replace an existing handler and
		 * clearing an existing handler with %NULL was not thread-safe.
		 * @param func The handler function to install
		 */
		set_sync_handler(func?: BusSyncHandler | null): void;
		/**
		 * A helper GstBusSyncHandler that can be used to convert all synchronous
		 * messages into signals.
		 * @param message the {@link Message} received
		 * @param data user data
		 * @returns GST_BUS_PASS
		 */
		sync_signal_handler(message: Message, data?: any | null): BusSyncReply;
		/**
		 * Get a message from the bus, waiting up to the specified timeout.
		 * 
		 * If #timeout is 0, this function behaves like {@link Gst.Bus.pop}. If #timeout is
		 * #GST_CLOCK_TIME_NONE, this function will block forever until a message was
		 * posted on the bus.
		 * @param timeout a timeout
		 * @returns the {@link Message} that is on the
		 *     bus after the specified timeout or %NULL if the bus is empty
		 *     after the timeout expired.  The message is taken from the bus
		 *     and needs to be unreffed with {@link Gst.Message.unref} after usage.
		 * 
		 * MT safe.
		 */
		timed_pop(timeout: ClockTime): Message | null;
		/**
		 * Get a message from the bus whose type matches the message type mask #types,
		 * waiting up to the specified timeout (and discarding any messages that do not
		 * match the mask provided).
		 * 
		 * If #timeout is 0, this function behaves like {@link Gst.Bus.pop_filtered}. If
		 * #timeout is #GST_CLOCK_TIME_NONE, this function will block forever until a
		 * matching message was posted on the bus.
		 * @param timeout a timeout in nanoseconds, or GST_CLOCK_TIME_NONE to wait forever
		 * @param types message types to take into account, GST_MESSAGE_ANY for any type
		 * @returns a {@link Message} matching the
		 *     filter in #types, or %NULL if no matching message was found on
		 *     the bus until the timeout expired. The message is taken from
		 *     the bus and needs to be unreffed with {@link Gst.Message.unref} after
		 *     usage.
		 * 
		 * MT safe.
		 */
		timed_pop_filtered(timeout: ClockTime, types: MessageType): Message | null;
		/**
		 * A message has been posted on the bus. This signal is emitted from a
		 * GSource added to the mainloop. this signal will only be emitted when
		 * there is a mainloop running.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - message: the message that has been posted asynchronously 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "message", callback: (owner: this, message: Message) => void): number;
		/**
		 * A message has been posted on the bus. This signal is emitted from the
		 * thread that posted the message so one has to be careful with locking.
		 * 
		 * This signal will not be emitted by default, you have to call
		 * {@link Gst.Bus.enable_sync_message_emission} before.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - message: the message that has been posted synchronously 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "sync-message", callback: (owner: this, message: Message) => void): number;

		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;

	}

	type BusInitOptionsMixin = ObjectInitOptions
	export interface BusInitOptions extends BusInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Bus} instead.
	 */
	type BusMixin = IBus & Object;

	/**
	 * The {@link Bus} is an object responsible for delivering #GstMessage packets in
	 * a first-in first-out way from the streaming threads (see #GstTask) to the
	 * application.
	 * 
	 * Since the application typically only wants to deal with delivery of these
	 * messages from one thread, the GstBus will marshall the messages between
	 * different threads. This is important since the actual streaming of media
	 * is done in another thread than the application.
	 * 
	 * The GstBus provides support for #GSource based notifications. This makes it
	 * possible to handle the delivery in the glib mainloop.
	 * 
	 * The #GSource callback function {@link Gst.Bus.async_signal_func} can be used to
	 * convert all bus messages into signal emissions.
	 * 
	 * A message is posted on the bus with the gst_bus_post() method. With the
	 * gst_bus_peek() and gst_bus_pop() methods one can look at or retrieve a
	 * previously posted message.
	 * 
	 * The bus can be polled with the gst_bus_poll() method. This methods blocks
	 * up to the specified timeout value until one of the specified messages types
	 * is posted on the bus. The application can then gst_bus_pop() the messages
	 * from the bus to handle them.
	 * Alternatively the application can register an asynchronous bus function
	 * using gst_bus_add_watch_full() or gst_bus_add_watch(). This function will
	 * install a #GSource in the default glib main loop and will deliver messages
	 * a short while after they have been posted. Note that the main loop should
	 * be running for the asynchronous callbacks.
	 * 
	 * It is also possible to get messages from the bus without any thread
	 * marshalling with the gst_bus_set_sync_handler() method. This makes it
	 * possible to react to a message in the same thread that posted the
	 * message on the bus. This should only be used if the application is able
	 * to deal with messages from different threads.
	 * 
	 * Every #GstPipeline has one bus.
	 * 
	 * Note that a #GstPipeline will set its bus into flushing state when changing
	 * from READY to NULL state.
	 */
	interface Bus extends BusMixin {}

	class Bus {
		public constructor(options?: Partial<BusInitOptions>);
		/**
		 * Creates a new {@link Bus} instance.
		 * @returns a new {@link Bus} instance
		 */
		public static new(): Bus;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Clock} instead.
	 */
	interface IClock {
		timeout: number;
		window_size: number;
		window_threshold: number;
		readonly object: Object;
		/**
		 * The time #master of the master clock and the time #slave of the slave
		 * clock are added to the list of observations. If enough observations
		 * are available, a linear regression algorithm is run on the
		 * observations and #clock is recalibrated.
		 * 
		 * If this functions returns %TRUE, #r_squared will contain the
		 * correlation coefficient of the interpolation. A value of 1.0
		 * means a perfect regression was performed. This value can
		 * be used to control the sampling frequency of the master and slave
		 * clocks.
		 * @param slave a time on the slave
		 * @param master a time on the master
		 * @returns %TRUE if enough observations were added to run the
		 * regression algorithm.
		 * 
		 * MT safe.
		 * 
		 * a pointer to hold the result
		 */
		add_observation(slave: ClockTime, master: ClockTime): [ boolean, number ];
		/**
		 * Add a clock observation to the internal slaving algorithm the same as
		 * {@link Gst.Clock.add_observation}, and return the result of the master clock
		 * estimation, without updating the internal calibration.
		 * 
		 * The caller can then take the results and call gst_clock_set_calibration()
		 * with the values, or some modified version of them.
		 * @param slave a time on the slave
		 * @param master a time on the master
		 * @returns 
		 * 
		 * a pointer to hold the result
		 * 
		 * a location to store the internal time
		 * 
		 * a location to store the external time
		 * 
		 * a location to store the rate numerator
		 * 
		 * a location to store the rate denominator
		 */
		add_observation_unapplied(slave: ClockTime, master: ClockTime): [ boolean, number, ClockTime | null, ClockTime | null, ClockTime | null, ClockTime | null ];
		/**
		 * Converts the given #internal clock time to the external time, adjusting for the
		 * rate and reference time set with {@link Gst.Clock.set_calibration} and making sure
		 * that the returned time is increasing. This function should be called with the
		 * clock's OBJECT_LOCK held and is mainly used by clock subclasses.
		 * 
		 * This function is the reverse of gst_clock_unadjust_unlocked().
		 * @param internal a clock time
		 * @returns the converted time of the clock.
		 */
		adjust_unlocked(internal: ClockTime): ClockTime;
		/**
		 * Converts the given #internal_target clock time to the external time,
		 * using the passed calibration parameters. This function performs the
		 * same calculation as {@link Gst.Clock.adjust_unlocked} when called using the
		 * current calibration parameters, but doesn't ensure a monotonically
		 * increasing result as gst_clock_adjust_unlocked() does.
		 * 
		 * Note: The #clock parameter is unused and can be NULL
		 * @param internal_target a clock time
		 * @param cinternal a reference internal time
		 * @param cexternal a reference external time
		 * @param cnum the numerator of the rate of the clock relative to its
		 *        internal time
		 * @param cdenom the denominator of the rate of the clock
		 * @returns the converted time of the clock.
		 */
		adjust_with_calibration(internal_target: ClockTime, cinternal: ClockTime, cexternal: ClockTime, cnum: ClockTime, cdenom: ClockTime): ClockTime;
		/**
		 * Gets the internal rate and reference time of #clock. See
		 * {@link Gst.Clock.set_calibration} for more information.
		 * 
		 * #internal, #external, #rate_num, and #rate_denom can be left %NULL if the
		 * caller is not interested in the values.
		 * 
		 * MT safe.
		 * @returns a location to store the internal time
		 * 
		 * a location to store the external time
		 * 
		 * a location to store the rate numerator
		 * 
		 * a location to store the rate denominator
		 */
		get_calibration(): [ internal: ClockTime | null, external: ClockTime | null, rate_num: ClockTime | null, rate_denom: ClockTime | null ];
		/**
		 * Gets the current internal time of the given clock. The time is returned
		 * unadjusted for the offset and the rate.
		 * @returns the internal time of the clock. Or GST_CLOCK_TIME_NONE when
		 * given invalid input.
		 * 
		 * MT safe.
		 */
		get_internal_time(): ClockTime;
		/**
		 * Get the master clock that #clock is slaved to or %NULL when the clock is
		 * not slaved to any master clock.
		 * @returns a master {@link Clock} or %NULL
		 *     when this clock is not slaved to a master clock. Unref after
		 *     usage.
		 * 
		 * MT safe.
		 */
		get_master(): Clock | null;
		/**
		 * Get the accuracy of the clock. The accuracy of the clock is the granularity
		 * of the values returned by {@link Gst.Clock.get_time}.
		 * @returns the resolution of the clock in units of {@link ClockTime}.
		 * 
		 * MT safe.
		 */
		get_resolution(): ClockTime;
		/**
		 * Gets the current time of the given clock. The time is always
		 * monotonically increasing and adjusted according to the current
		 * offset and rate.
		 * @returns the time of the clock. Or GST_CLOCK_TIME_NONE when
		 * given invalid input.
		 * 
		 * MT safe.
		 */
		get_time(): ClockTime;
		/**
		 * Get the amount of time that master and slave clocks are sampled.
		 * @returns the interval between samples.
		 */
		get_timeout(): ClockTime;
		/**
		 * Checks if the clock is currently synced.
		 * 
		 * This returns if GST_CLOCK_FLAG_NEEDS_STARTUP_SYNC is not set on the clock.
		 * @returns %TRUE if the clock is currently synced
		 */
		is_synced(): boolean;
		/**
		 * Get an ID from #clock to trigger a periodic notification.
		 * The periodic notifications will start at time #start_time and
		 * will then be fired with the given #interval. #id should be unreffed
		 * after usage.
		 * 
		 * Free-function: gst_clock_id_unref
		 * @param start_time the requested start time
		 * @param interval the requested interval
		 * @returns a {@link ClockID} that can be used to request the
		 *     time notification.
		 * 
		 * MT safe.
		 */
		new_periodic_id(start_time: ClockTime, interval: ClockTime): ClockID;
		/**
		 * Get a {@link ClockID} from #clock to trigger a single shot
		 * notification at the requested time. The single shot id should be
		 * unreffed after usage.
		 * 
		 * Free-function: gst_clock_id_unref
		 * @param time the requested time
		 * @returns a {@link ClockID} that can be used to request the
		 *     time notification.
		 * 
		 * MT safe.
		 */
		new_single_shot_id(time: ClockTime): ClockID;
		/**
		 * Reinitializes the provided periodic #id to the provided start time and
		 * interval. Does not modify the reference count.
		 * @param id a {@link ClockID}
		 * @param start_time the requested start time
		 * @param interval the requested interval
		 * @returns %TRUE if the GstClockID could be reinitialized to the provided
		 * #time, else %FALSE.
		 */
		periodic_id_reinit(id: ClockID, start_time: ClockTime, interval: ClockTime): boolean;
		/**
		 * Adjusts the rate and time of #clock. A rate of 1/1 is the normal speed of
		 * the clock. Values bigger than 1/1 make the clock go faster.
		 * 
		 * #internal and #external are calibration parameters that arrange that
		 * {@link Gst.Clock.get_time} should have been #external at internal time #internal.
		 * This internal time should not be in the future; that is, it should be less
		 * than the value of gst_clock_get_internal_time() when this function is called.
		 * 
		 * Subsequent calls to gst_clock_get_time() will return clock times computed as
		 * follows:
		 * 
		 * |[
		 *   time = (internal_time - internal) * rate_num / rate_denom + external
		 * ]|
		 * 
		 * This formula is implemented in gst_clock_adjust_unlocked(). Of course, it
		 * tries to do the integer arithmetic as precisely as possible.
		 * 
		 * Note that gst_clock_get_time() always returns increasing values so when you
		 * move the clock backwards, gst_clock_get_time() will report the previous value
		 * until the clock catches up.
		 * 
		 * MT safe.
		 * @param internal a reference internal time
		 * @param external a reference external time
		 * @param rate_num the numerator of the rate of the clock relative to its
		 *            internal time
		 * @param rate_denom the denominator of the rate of the clock
		 */
		set_calibration(internal: ClockTime, external: ClockTime, rate_num: ClockTime, rate_denom: ClockTime): void;
		/**
		 * Set #master as the master clock for #clock. #clock will be automatically
		 * calibrated so that {@link Gst.Clock.get_time} reports the same time as the
		 * master clock.
		 * 
		 * A clock provider that slaves its clock to a master can get the current
		 * calibration values with gst_clock_get_calibration().
		 * 
		 * #master can be %NULL in which case #clock will not be slaved anymore. It will
		 * however keep reporting its time adjusted with the last configured rate
		 * and time offsets.
		 * @param master a master {@link Clock}
		 * @returns %TRUE if the clock is capable of being slaved to a master clock.
		 * Trying to set a master on a clock without the
		 * #GST_CLOCK_FLAG_CAN_SET_MASTER flag will make this function return %FALSE.
		 * 
		 * MT safe.
		 */
		set_master(master?: Clock | null): boolean;
		/**
		 * Set the accuracy of the clock. Some clocks have the possibility to operate
		 * with different accuracy at the expense of more resource usage. There is
		 * normally no need to change the default resolution of a clock. The resolution
		 * of a clock can only be changed if the clock has the
		 * #GST_CLOCK_FLAG_CAN_SET_RESOLUTION flag set.
		 * @param resolution The resolution to set
		 * @returns the new resolution of the clock.
		 */
		set_resolution(resolution: ClockTime): ClockTime;
		/**
		 * Sets #clock to synced and emits the GstClock::synced signal, and wakes up any
		 * thread waiting in {@link Gst.Clock.wait_for_sync}.
		 * 
		 * This function must only be called if GST_CLOCK_FLAG_NEEDS_STARTUP_SYNC
		 * is set on the clock, and is intended to be called by subclasses only.
		 * @param synced if the clock is synced
		 */
		set_synced(synced: boolean): void;
		/**
		 * Set the amount of time, in nanoseconds, to sample master and slave
		 * clocks
		 * @param timeout a timeout
		 */
		set_timeout(timeout: ClockTime): void;
		/**
		 * Reinitializes the provided single shot #id to the provided time. Does not
		 * modify the reference count.
		 * @param id a {@link ClockID}
		 * @param time The requested time.
		 * @returns %TRUE if the GstClockID could be reinitialized to the provided
		 * #time, else %FALSE.
		 */
		single_shot_id_reinit(id: ClockID, time: ClockTime): boolean;
		/**
		 * Converts the given #external clock time to the internal time of #clock,
		 * using the rate and reference time set with {@link Gst.Clock.set_calibration}.
		 * This function should be called with the clock's OBJECT_LOCK held and
		 * is mainly used by clock subclasses.
		 * 
		 * This function is the reverse of gst_clock_adjust_unlocked().
		 * @param external an external clock time
		 * @returns the internal time of the clock corresponding to #external.
		 */
		unadjust_unlocked(external: ClockTime): ClockTime;
		/**
		 * Converts the given #external_target clock time to the internal time,
		 * using the passed calibration parameters. This function performs the
		 * same calculation as {@link Gst.Clock.unadjust_unlocked} when called using the
		 * current calibration parameters.
		 * 
		 * Note: The #clock parameter is unused and can be NULL
		 * @param external_target a clock time
		 * @param cinternal a reference internal time
		 * @param cexternal a reference external time
		 * @param cnum the numerator of the rate of the clock relative to its
		 *        internal time
		 * @param cdenom the denominator of the rate of the clock
		 * @returns the converted time of the clock.
		 */
		unadjust_with_calibration(external_target: ClockTime, cinternal: ClockTime, cexternal: ClockTime, cnum: ClockTime, cdenom: ClockTime): ClockTime;
		/**
		 * Waits until #clock is synced for reporting the current time. If #timeout
		 * is %GST_CLOCK_TIME_NONE it will wait forever, otherwise it will time out
		 * after #timeout nanoseconds.
		 * 
		 * For asynchronous waiting, the GstClock::synced signal can be used.
		 * 
		 * This returns immediately with TRUE if GST_CLOCK_FLAG_NEEDS_STARTUP_SYNC
		 * is not set on the clock, or if the clock is already synced.
		 * @param timeout timeout for waiting or %GST_CLOCK_TIME_NONE
		 * @returns %TRUE if waiting was successful, or %FALSE on timeout
		 */
		wait_for_sync(timeout: ClockTime): boolean;
		/**
		 * Signaled on clocks with GST_CLOCK_FLAG_NEEDS_STARTUP_SYNC set once
		 * the clock is synchronized, or when it completely lost synchronization.
		 * This signal will not be emitted on clocks without the flag.
		 * 
		 * This signal will be emitted from an arbitrary thread, most likely not
		 * the application's main thread.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - synced: if the clock is synced now 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "synced", callback: (owner: this, synced: boolean) => void): number;

		connect(signal: "notify::timeout", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window-size", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::window-threshold", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;

	}

	type ClockInitOptionsMixin = ObjectInitOptions & 
	Pick<IClock,
		"timeout" |
		"window_size" |
		"window_threshold">;

	export interface ClockInitOptions extends ClockInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Clock} instead.
	 */
	type ClockMixin = IClock & Object;

	/**
	 * GStreamer uses a global clock to synchronize the plugins in a pipeline.
	 * Different clock implementations are possible by implementing this abstract
	 * base class or, more conveniently, by subclassing {@link SystemClock}.
	 * 
	 * The #GstClock returns a monotonically increasing time with the method
	 * {@link Gst.Clock.get_time}. Its accuracy and base time depend on the specific
	 * clock implementation but time is always expressed in nanoseconds. Since the
	 * baseline of the clock is undefined, the clock time returned is not
	 * meaningful in itself, what matters are the deltas between two clock times.
	 * The time returned by a clock is called the absolute time.
	 * 
	 * The pipeline uses the clock to calculate the running time. Usually all
	 * renderers synchronize to the global clock using the buffer timestamps, the
	 * newsegment events and the element's base time, see #GstPipeline.
	 * 
	 * A clock implementation can support periodic and single shot clock
	 * notifications both synchronous and asynchronous.
	 * 
	 * One first needs to create a #GstClockID for the periodic or single shot
	 * notification using gst_clock_new_single_shot_id() or
	 * gst_clock_new_periodic_id().
	 * 
	 * To perform a blocking wait for the specific time of the #GstClockID use the
	 * gst_clock_id_wait(). To receive a callback when the specific time is reached
	 * in the clock use gst_clock_id_wait_async(). Both these calls can be
	 * interrupted with the gst_clock_id_unschedule() call. If the blocking wait is
	 * unscheduled a return value of #GST_CLOCK_UNSCHEDULED is returned.
	 * 
	 * Periodic callbacks scheduled async will be repeatedly called automatically
	 * until it is unscheduled. To schedule a sync periodic callback,
	 * gst_clock_id_wait() should be called repeatedly.
	 * 
	 * The async callbacks can happen from any thread, either provided by the core
	 * or from a streaming thread. The application should be prepared for this.
	 * 
	 * A #GstClockID that has been unscheduled cannot be used again for any wait
	 * operation, a new #GstClockID should be created and the old unscheduled one
	 * should be destroyed with gst_clock_id_unref().
	 * 
	 * It is possible to perform a blocking wait on the same #GstClockID from
	 * multiple threads. However, registering the same #GstClockID for multiple
	 * async notifications is not possible, the callback will only be called for
	 * the thread registering the entry last.
	 * 
	 * None of the wait operations unref the #GstClockID, the owner is responsible
	 * for unreffing the ids itself. This holds for both periodic and single shot
	 * notifications. The reason being that the owner of the #GstClockID has to
	 * keep a handle to the #GstClockID to unblock the wait on FLUSHING events or
	 * state changes and if the entry would be unreffed automatically, the handle
	 * might become invalid without any notification.
	 * 
	 * These clock operations do not operate on the running time, so the callbacks
	 * will also occur when not in PLAYING state as if the clock just keeps on
	 * running. Some clocks however do not progress when the element that provided
	 * the clock is not PLAYING.
	 * 
	 * When a clock has the #GST_CLOCK_FLAG_CAN_SET_MASTER flag set, it can be
	 * slaved to another #GstClock with the gst_clock_set_master(). The clock will
	 * then automatically be synchronized to this master clock by repeatedly
	 * sampling the master clock and the slave clock and recalibrating the slave
	 * clock with gst_clock_set_calibration(). This feature is mostly useful for
	 * plugins that have an internal clock but must operate with another clock
	 * selected by the #GstPipeline.  They can track the offset and rate difference
	 * of their internal clock relative to the master clock by using the
	 * gst_clock_get_calibration() function.
	 * 
	 * The master/slave synchronisation can be tuned with the #GstClock:timeout,
	 * #GstClock:window-size and #GstClock:window-threshold properties.
	 * The #GstClock:timeout property defines the interval to sample the master
	 * clock and run the calibration functions. #GstClock:window-size defines the
	 * number of samples to use when calibrating and #GstClock:window-threshold
	 * defines the minimum number of samples before the calibration is performed.
	 */
	interface Clock extends ClockMixin {}

	class Clock {
		public constructor(options?: Partial<ClockInitOptions>);
		/**
		 * Compares the two {@link ClockID} instances. This function can be used
		 * as a GCompareFunc when sorting ids.
		 * @param id1 A {@link ClockID}
		 * @param id2 A {@link ClockID} to compare with
		 * @returns negative value if a < b; zero if a = b; positive value if a > b
		 * 
		 * MT safe.
		 */
		public static id_compare_func(id1?: any | null, id2?: any | null): number;
		/**
		 * This function returns the underlying clock.
		 * @param id a {@link ClockID}
		 * @returns a {@link Clock} or %NULL when the
		 *     underlying clock has been freed.  Unref after usage.
		 * 
		 * MT safe.
		 */
		public static id_get_clock(id: ClockID): Clock | null;
		/**
		 * Get the time of the clock ID
		 * @param id The {@link ClockID} to query
		 * @returns the time of the given clock id.
		 * 
		 * MT safe.
		 */
		public static id_get_time(id: ClockID): ClockTime;
		/**
		 * Increase the refcount of given #id.
		 * @param id The {@link ClockID} to ref
		 * @returns The same {@link ClockID} with increased refcount.
		 * 
		 * MT safe.
		 */
		public static id_ref(id: ClockID): ClockID;
		/**
		 * Unref given #id. When the refcount reaches 0 the
		 * {@link ClockID} will be freed.
		 * 
		 * MT safe.
		 * @param id The {@link ClockID} to unref
		 */
		public static id_unref(id: ClockID): void;
		/**
		 * Cancel an outstanding request with #id. This can either
		 * be an outstanding async notification or a pending sync notification.
		 * After this call, #id cannot be used anymore to receive sync or
		 * async notifications, you need to create a new {@link ClockID}.
		 * 
		 * MT safe.
		 * @param id The id to unschedule
		 */
		public static id_unschedule(id: ClockID): void;
		/**
		 * This function returns whether #id uses #clock as the underlying clock.
		 * #clock can be NULL, in which case the return value indicates whether
		 * the underlying clock has been freed.  If this is the case, the #id is
		 * no longer usable and should be freed.
		 * @param id a {@link ClockID} to check
		 * @param clock a {@link Clock} to compare against
		 * @returns whether the clock #id uses the same underlying {@link Clock} #clock.
		 * 
		 * MT safe.
		 */
		public static id_uses_clock(id: ClockID, clock: Clock): boolean;
		/**
		 * Perform a blocking wait on #id.
		 * #id should have been created with {@link Gst.Clock.new_single_shot_id}
		 * or gst_clock_new_periodic_id() and should not have been unscheduled
		 * with a call to gst_clock_id_unschedule().
		 * 
		 * If the #jitter argument is not %NULL and this function returns #GST_CLOCK_OK
		 * or #GST_CLOCK_EARLY, it will contain the difference
		 * against the clock and the time of #id when this method was
		 * called.
		 * Positive values indicate how late #id was relative to the clock
		 * (in which case this function will return #GST_CLOCK_EARLY).
		 * Negative values indicate how much time was spent waiting on the clock
		 * before this function returned.
		 * @param id The {@link ClockID} to wait on
		 * @returns the result of the blocking wait. #GST_CLOCK_EARLY will be returned
		 * if the current clock time is past the time of #id, #GST_CLOCK_OK if
		 * #id was scheduled in time. #GST_CLOCK_UNSCHEDULED if #id was
		 * unscheduled with {@link Gst.Clock.id_unschedule}.
		 * 
		 * MT safe.
		 * 
		 * a pointer that will contain the jitter,
		 *     can be %NULL.
		 */
		public static id_wait(id: ClockID): [ ClockReturn, ClockTimeDiff | null ];
		/**
		 * Register a callback on the given {@link ClockID} #id with the given
		 * function and user_data. When passing a #GstClockID with an invalid
		 * time to this function, the callback will be called immediately
		 * with  a time set to GST_CLOCK_TIME_NONE. The callback will
		 * be called when the time of #id has been reached.
		 * 
		 * The callback #func can be invoked from any thread, either provided by the
		 * core or from a streaming thread. The application should be prepared for this.
		 * @param id a {@link ClockID} to wait on
		 * @param func The callback function
		 * @returns the result of the non blocking wait.
		 * 
		 * MT safe.
		 */
		public static id_wait_async(id: ClockID, func: ClockCallback): ClockReturn;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ControlBinding} instead.
	 */
	interface IControlBinding {
		name: string;
		object: Object;
		/**
		 * name of the property of this binding
		 */
		// readonly name: string;
		/**
		 * #GParamSpec for this property
		 */
		readonly pspec: GObject.ParamSpec;
		/**
		 * Gets a number of #GValues for the given controlled property starting at the
		 * requested time. The array #values need to hold enough space for #n_values of
		 * #GValue.
		 * 
		 * This function is useful if one wants to e.g. draw a graph of the control
		 * curve or apply a control curve sample by sample.
		 * @param timestamp the time that should be processed
		 * @param interval the time spacing between subsequent values
		 * @param values array to put control-values in
		 * @returns %TRUE if the given array could be filled, %FALSE otherwise
		 */
		// get_g_value_array(timestamp: ClockTime, interval: ClockTime, values: GObject.Value[]): boolean;
		/**
		 * Gets the value for the given controlled property at the requested time.
		 * @param timestamp the time the control-change should be read from
		 * @returns the GValue of the property at the given time,
		 * or %NULL if the property isn't controlled.
		 */
		// get_value(timestamp: ClockTime): GObject.Value | null;
		/**
		 * Gets a number of values for the given controlled property starting at the
		 * requested time. The array #values need to hold enough space for #n_values of
		 * the same type as the objects property's type.
		 * 
		 * This function is useful if one wants to e.g. draw a graph of the control
		 * curve or apply a control curve sample by sample.
		 * 
		 * The values are unboxed and ready to be used. The similar function
		 * {@link Gst.ControlBinding.get_g_value_array} returns the array as #GValues and is
		 * more suitable for bindings.
		 * @param timestamp the time that should be processed
		 * @param interval the time spacing between subsequent values
		 * @param values array to put control-values in
		 * @returns %TRUE if the given array could be filled, %FALSE otherwise
		 */
		// get_value_array(timestamp: ClockTime, interval: ClockTime, values: any[]): boolean;
		/**
		 * Check if the control binding is disabled.
		 * @returns %TRUE if the binding is inactive
		 */
		is_disabled(): boolean;
		/**
		 * This function is used to disable a control binding for some time, i.e.
		 * {@link Gst.Object.sync_values} will do nothing.
		 * @param disabled boolean that specifies whether to disable the controller
		 * or not.
		 */
		set_disabled(disabled: boolean): void;
		/**
		 * Sets the property of the #object, according to the {@link ControlSources} that
		 * handle them and for the given timestamp.
		 * 
		 * If this function fails, it is most likely the application developers fault.
		 * Most probably the control sources are not setup correctly.
		 * @param object the object that has controlled properties
		 * @param timestamp the time that should be processed
		 * @param last_sync the last time this was called
		 * @returns %TRUE if the controller value could be applied to the object
		 * property, %FALSE otherwise
		 */
		// sync_values(object: Object, timestamp: ClockTime, last_sync: ClockTime): boolean;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pspec", callback: (owner: this, ...args: any) => void): number;

	}

	type ControlBindingInitOptionsMixin = ObjectInitOptions & 
	Pick<IControlBinding,
		"name" |
		"object">;

	export interface ControlBindingInitOptions extends ControlBindingInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ControlBinding} instead.
	 */
	type ControlBindingMixin = IControlBinding & Object;

	/**
	 * A base class for value mapping objects that attaches control sources to gobject
	 * properties. Such an object is taking one or more {@link ControlSource} instances,
	 * combines them and maps the resulting value to the type and value range of the
	 * bound property.
	 */
	interface ControlBinding extends ControlBindingMixin {}

	class ControlBinding {
		public constructor(options?: Partial<ControlBindingInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ControlSource} instead.
	 */
	interface IControlSource {
		/**
		 * Function for returning a value for a given timestamp
		 */
		readonly get_value: ControlSourceGetValue;
		/**
		 * Function for returning a values array for a given timestamp
		 */
		readonly get_value_array: ControlSourceGetValueArray;
		/**
		 * Gets the value for this {@link ControlSource} at a given timestamp.
		 * @param timestamp the time for which the value should be returned
		 * @returns %FALSE if the value couldn't be returned, %TRUE otherwise.
		 * 
		 * the value
		 */
		control_source_get_value(timestamp: ClockTime): [ boolean, number ];
		/**
		 * Gets an array of values for for this {@link ControlSource}. Values that are
		 * undefined contain NANs.
		 * @param timestamp the first timestamp
		 * @param interval the time steps
		 * @param values array to put control-values in
		 * @returns %TRUE if the given array could be filled, %FALSE otherwise
		 */
		control_source_get_value_array(timestamp: ClockTime, interval: ClockTime, values: number[]): boolean;
		connect(signal: "notify::get_value", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::get_value_array", callback: (owner: this, ...args: any) => void): number;

	}

	type ControlSourceInitOptionsMixin = ObjectInitOptions
	export interface ControlSourceInitOptions extends ControlSourceInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ControlSource} instead.
	 */
	type ControlSourceMixin = IControlSource & Object;

	/**
	 * The {@link ControlSource} is a base class for control value sources that could
	 * be used to get timestamp-value pairs. A control source essentially is a
	 * function over time.
	 * 
	 * A #GstControlSource is used by first getting an instance of a specific
	 * control-source, creating a binding for the control-source to the target property
	 * of the element and then adding the binding to the element. The binding will
	 * convert the data types and value range to fit to the bound property.
	 * 
	 * For implementing a new #GstControlSource one has to implement
	 * #GstControlSourceGetValue and #GstControlSourceGetValueArray functions.
	 * These are then used by gst_control_source_get_value() and
	 * gst_control_source_get_value_array() to get values for specific timestamps.
	 */
	interface ControlSource extends ControlSourceMixin {}

	class ControlSource {
		public constructor(options?: Partial<ControlSourceInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Device} instead.
	 */
	interface IDevice {
		caps: Caps;
		device_class: string;
		display_name: string;
		properties: Structure;
		/**
		 * Creates the element with all of the required parameters set to use
		 * this device.
		 * @param name name of new element, or %NULL to automatically
		 * create a unique name.
		 * @returns a new {@link Element} configured to use
		 * this device
		 */
		create_element(name?: string | null): Element | null;
		/**
		 * Getter for the {@link Caps} that this device supports.
		 * @returns The {@link Caps} supported by this device. Unref with
		 * {@link Gst.Caps.unref} when done.
		 */
		get_caps(): Caps | null;
		/**
		 * Gets the "class" of a device. This is a "/" separated list of
		 * classes that represent this device. They are a subset of the
		 * classes of the {@link DeviceProvider} that produced this device.
		 * @returns The device class. Free with {@link G.free} after use.
		 */
		get_device_class(): string;
		/**
		 * Gets the user-friendly name of the device.
		 * @returns The device name. Free with {@link G.free} after use.
		 */
		get_display_name(): string;
		/**
		 * Gets the extra properties of a device.
		 * @returns The extra properties or %NULL when there are none.
		 *          Free with {@link Gst.Structure.free} after use.
		 */
		get_properties(): Structure | null;
		/**
		 * Check if #device matches all of the given classes
		 * @param classes a "/"-separated list of device classes to match, only match if
		 *  all classes are matched
		 * @returns %TRUE if #device matches.
		 */
		has_classes(classes: string): boolean;
		/**
		 * Check if #factory matches all of the given classes
		 * @param classes a %NULL terminated array of classes
		 *   to match, only match if all classes are matched
		 * @returns %TRUE if #device matches.
		 */
		has_classesv(classes: string[]): boolean;
		/**
		 * Tries to reconfigure an existing element to use the device. If this
		 * function fails, then one must destroy the element and create a new one
		 * using {@link Gst.Device.create_element}.
		 * 
		 * Note: This should only be implemented for elements can change their
		 * device in the PLAYING state.
		 * @param element a {@link Element}
		 * @returns %TRUE if the element could be reconfigured to use this device,
		 * %FALSE otherwise.
		 */
		reconfigure_element(element: Element): boolean;
		connect(signal: "removed", callback: (owner: this) => void): number;

		connect(signal: "notify::caps", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::device-class", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::display-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::properties", callback: (owner: this, ...args: any) => void): number;

	}

	type DeviceInitOptionsMixin = ObjectInitOptions & 
	Pick<IDevice,
		"caps" |
		"device_class" |
		"display_name" |
		"properties">;

	export interface DeviceInitOptions extends DeviceInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Device} instead.
	 */
	type DeviceMixin = IDevice & Object;

	/**
	 * {@link Device} are objects representing a device, they contain
	 * relevant metadata about the device, such as its class and the #GstCaps
	 * representing the media types it can produce or handle.
	 * 
	 * #GstDevice are created by #GstDeviceProvider objects which can be
	 * aggregated by #GstDeviceMonitor objects.
	 */
	interface Device extends DeviceMixin {}

	class Device {
		public constructor(options?: Partial<DeviceInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DeviceMonitor} instead.
	 */
	interface IDeviceMonitor {
		show_all: boolean;
		/**
		 * Adds a filter for which {@link Device} will be monitored, any device that matches
		 * all these classes and the #GstCaps will be returned.
		 * 
		 * If this function is called multiple times to add more filters, each will be
		 * matched independently. That is, adding more filters will not further restrict
		 * what devices are matched.
		 * 
		 * The #GstCaps supported by the device as returned by {@link Gst.Device.get_caps} are
		 * not intersected with caps filters added using this function.
		 * 
		 * Filters must be added before the #GstDeviceMonitor is started.
		 * @param classes device classes to use as filter or %NULL for any class
		 * @param caps the {@link Caps} to filter or %NULL for ANY
		 * @returns The id of the new filter or 0 if no provider matched the filter's
		 *  classes.
		 */
		add_filter(classes?: string | null, caps?: Caps | null): number;
		/**
		 * Gets the {@link Bus} of this #GstDeviceMonitor
		 * @returns a {@link Bus}
		 */
		get_bus(): Bus;
		/**
		 * Gets a list of devices from all of the relevant monitors. This may actually
		 * probe the hardware if the monitor is not currently started.
		 * @returns a #GList of
		 *   {@link Device}
		 */
		get_devices(): Device[] | null;
		/**
		 * Get a list of the currently selected device provider factories.
		 * 
		 * This
		 * @returns 
		 *     A list of device provider factory names that are currently being
		 *     monitored by #monitor or %NULL when nothing is being monitored.
		 */
		get_providers(): string[];
		/**
		 * Get if #monitor is currently showing all devices, even those from hidden
		 * providers.
		 * @returns %TRUE when all devices will be shown.
		 */
		get_show_all_devices(): boolean;
		/**
		 * Removes a filter from the {@link DeviceMonitor} using the id that was returned
		 * by {@link Gst.DeviceMonitor.add_filter}.
		 * @param filter_id the id of the filter
		 * @returns %TRUE of the filter id was valid, %FALSE otherwise
		 */
		remove_filter(filter_id: number): boolean;
		/**
		 * Set if all devices should be visible, even those devices from hidden
		 * providers. Setting #show_all to true might show some devices multiple times.
		 * @param show_all show all devices
		 */
		set_show_all_devices(show_all: boolean): void;
		/**
		 * Starts monitoring the devices, one this has succeeded, the
		 * %GST_MESSAGE_DEVICE_ADDED and %GST_MESSAGE_DEVICE_REMOVED messages
		 * will be emitted on the bus when the list of devices changes.
		 * @returns %TRUE if the device monitoring could be started
		 */
		start(): boolean;
		/**
		 * Stops monitoring the devices.
		 */
		stop(): void;
		connect(signal: "notify::show-all", callback: (owner: this, ...args: any) => void): number;

	}

	type DeviceMonitorInitOptionsMixin = ObjectInitOptions & 
	Pick<IDeviceMonitor,
		"show_all">;

	export interface DeviceMonitorInitOptions extends DeviceMonitorInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DeviceMonitor} instead.
	 */
	type DeviceMonitorMixin = IDeviceMonitor & Object;

	/**
	 * Applications should create a {@link DeviceMonitor} when they want
	 * to probe, list and monitor devices of a specific type. The
	 * #GstDeviceMonitor will create the appropriate
	 * #GstDeviceProvider objects and manage them. It will then post
	 * messages on its #GstBus for devices that have been added and
	 * removed.
	 * 
	 * The device monitor will monitor all devices matching the filters that
	 * the application has set.
	 * 
	 * The basic use pattern of a device monitor is as follows:
	 * |[
	 *   static gboolean
	 *   my_bus_func (GstBus * bus, GstMessage * message, gpointer user_data)
	 *   {
	 *      GstDevice *device;
	 *      gchar *name;
	 * 
	 *      switch (GST_MESSAGE_TYPE (message)) {
	 *        case GST_MESSAGE_DEVICE_ADDED:
	 *          gst_message_parse_device_added (message, &device);
	 *          name = gst_device_get_display_name (device);
	 *          g_print("Device added: %s\n", name);
	 *          g_free (name);
	 *          gst_object_unref (device);
	 *          break;
	 *        case GST_MESSAGE_DEVICE_REMOVED:
	 *          gst_message_parse_device_removed (message, &device);
	 *          name = gst_device_get_display_name (device);
	 *          g_print("Device removed: %s\n", name);
	 *          g_free (name);
	 *          gst_object_unref (device);
	 *          break;
	 *        default:
	 *          break;
	 *      }
	 * 
	 *      return G_SOURCE_CONTINUE;
	 *   }
	 * 
	 *   GstDeviceMonitor *
	 *   setup_raw_video_source_device_monitor (void) {
	 *      GstDeviceMonitor *monitor;
	 *      GstBus *bus;
	 *      GstCaps *caps;
	 * 
	 *      monitor = gst_device_monitor_new ();
	 * 
	 *      bus = gst_device_monitor_get_bus (monitor);
	 *      gst_bus_add_watch (bus, my_bus_func, NULL);
	 *      gst_object_unref (bus);
	 * 
	 *      caps = gst_caps_new_empty_simple ("video/x-raw");
	 *      gst_device_monitor_add_filter (monitor, "Video/Source", caps);
	 *      gst_caps_unref (caps);
	 * 
	 *      gst_device_monitor_start (monitor);
	 * 
	 *      return monitor;
	 *   }
	 * ]|
	 */
	interface DeviceMonitor extends DeviceMonitorMixin {}

	class DeviceMonitor {
		public constructor(options?: Partial<DeviceMonitorInitOptions>);
		/**
		 * Create a new {@link DeviceMonitor}
		 * @returns a new device monitor.
		 */
		public static new(): DeviceMonitor;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DeviceProvider} instead.
	 */
	interface IDeviceProvider {
		/**
		 * a #GList of the {@link Device} objects
		 */
		readonly devices: any[];
		can_monitor(): boolean;
		/**
		 * Posts a message on the provider's {@link Bus} to inform applications that
		 * a new device has been added.
		 * 
		 * This is for use by subclasses.
		 * 
		 * #device's reference count will be incremented, and any floating reference
		 * will be removed (see {@link Gst.Object.ref_sink}).
		 * @param device a {@link Device} that has been added
		 */
		device_add(device: Device): void;
		/**
		 * This function is used when #changed_device was modified into its new form
		 * #device. This will post a `DEVICE_CHANGED` message on the bus to let
		 * the application know that the device was modified. {@link Device} is immutable
		 * for MT. safety purposes so this is an "atomic" way of letting the application
		 * know when a device was modified.
		 * @param device the new version of #changed_device
		 * @param changed_device the old version of the device that has been updated
		 */
		device_changed(device: Device, changed_device: Device): void;
		/**
		 * Posts a message on the provider's {@link Bus} to inform applications that
		 * a device has been removed.
		 * 
		 * This is for use by subclasses.
		 * @param device a {@link Device} that has been removed
		 */
		device_remove(device: Device): void;
		/**
		 * Gets the {@link Bus} of this #GstDeviceProvider
		 * @returns a {@link Bus}
		 */
		get_bus(): Bus;
		/**
		 * Gets a list of devices that this provider understands. This may actually
		 * probe the hardware if the provider is not currently started.
		 * 
		 * If the provider has been started, this will returned the same {@link Device}
		 * objedcts that have been returned by the #GST_MESSAGE_DEVICE_ADDED messages.
		 * @returns a #GList of
		 *   {@link Device}
		 */
		get_devices(): Device[];
		/**
		 * Retrieves the factory that was used to create this device provider.
		 * @returns the {@link DeviceProviderFactory} used for
		 *     creating this device provider. no refcounting is needed.
		 */
		get_factory(): DeviceProviderFactory | null;
		/**
		 * Get the provider factory names of the {@link DeviceProvider} instances that
		 * are hidden by #provider.
		 * @returns 
		 *   a list of hidden providers factory names or %NULL when
		 *   nothing is hidden by #provider. Free with g_strfreev.
		 */
		get_hidden_providers(): string[];
		/**
		 * Get metadata with #key in #provider.
		 * @param key the key to get
		 * @returns the metadata for #key.
		 */
		get_metadata(key: string): string;
		/**
		 * Make #provider hide the devices from the factory with #name.
		 * 
		 * This function is used when #provider will also provide the devices reported
		 * by provider factory #name. A monitor should stop monitoring the
		 * device provider with #name to avoid duplicate devices.
		 * @param name a provider factory name
		 */
		hide_provider(name: string): void;
		/**
		 * Starts providering the devices. This will cause #GST_MESSAGE_DEVICE_ADDED
		 * and #GST_MESSAGE_DEVICE_REMOVED messages to be posted on the provider's bus
		 * when devices are added or removed from the system.
		 * 
		 * Since the {@link DeviceProvider} is a singleton,
		 * {@link Gst.DeviceProvider.start} may already have been called by another
		 * user of the object, gst_device_provider_stop() needs to be called the same
		 * number of times.
		 * 
		 * After this function has been called, gst_device_provider_get_devices() will
		 * return the same objects that have been received from the
		 * #GST_MESSAGE_DEVICE_ADDED messages and will no longer probe.
		 * @returns %TRUE if the device providering could be started
		 */
		start(): boolean;
		/**
		 * Decreases the use-count by one. If the use count reaches zero, this
		 * {@link DeviceProvider} will stop providering the devices. This needs to be
		 * called the same number of times that {@link Gst.DeviceProvider.start} was called.
		 */
		stop(): void;
		/**
		 * Make #provider unhide the devices from factory #name.
		 * 
		 * This function is used when #provider will no longer provide the devices
		 * reported by provider factory #name. A monitor should start
		 * monitoring the devices from provider factory #name in order to see
		 * all devices again.
		 * @param name a provider factory name
		 */
		unhide_provider(name: string): void;
		connect(signal: "provider-hidden", callback: (owner: this, object: string) => void): number;
		connect(signal: "provider-unhidden", callback: (owner: this, object: string) => void): number;

		connect(signal: "notify::devices", callback: (owner: this, ...args: any) => void): number;

	}

	type DeviceProviderInitOptionsMixin = ObjectInitOptions
	export interface DeviceProviderInitOptions extends DeviceProviderInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DeviceProvider} instead.
	 */
	type DeviceProviderMixin = IDeviceProvider & Object;

	/**
	 * A {@link DeviceProvider} subclass is provided by a plugin that handles devices
	 * if there is a way to programmatically list connected devices. It can also
	 * optionally provide updates to the list of connected devices.
	 * 
	 * Each #GstDeviceProvider subclass is a singleton, a plugin should
	 * normally provide a single subclass for all devices.
	 * 
	 * Applications would normally use a #GstDeviceMonitor to monitor devices
	 * from all relevant providers.
	 */
	interface DeviceProvider extends DeviceProviderMixin {}

	class DeviceProvider {
		public constructor(options?: Partial<DeviceProviderInitOptions>);
		/**
		 * Create a new device providerfactory capable of instantiating objects of the
		 * #type and add the factory to #plugin.
		 * @param plugin {@link Plugin} to register the device provider with, or %NULL for
		 *     a static device provider.
		 * @param name name of device providers of this type
		 * @param rank rank of device provider (higher rank means more importance when autoplugging)
		 * @param type GType of device provider to register
		 * @returns %TRUE, if the registering succeeded, %FALSE on error
		 */
		public static register(plugin: Plugin | null, name: string, rank: number, type: GObject.Type): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DeviceProviderFactory} instead.
	 */
	interface IDeviceProviderFactory {
		/**
		 * Returns the device provider of the type defined by the given device
		 * providerfactory.
		 * @returns the {@link DeviceProvider} or %NULL
		 * if the device provider couldn't be created
		 */
		get(): DeviceProvider | null;
		/**
		 * Get the #GType for device providers managed by this factory. The type can
		 * only be retrieved if the device provider factory is loaded, which can be
		 * assured with {@link Gst.PluginFeature.load}.
		 * @returns the #GType for device providers managed by this factory.
		 */
		get_device_provider_type(): GObject.Type;
		/**
		 * Get the metadata on #factory with #key.
		 * @param key a key
		 * @returns the metadata with #key on #factory or %NULL
		 * when there was no metadata with the given #key.
		 */
		get_metadata(key: string): string | null;
		/**
		 * Get the available keys for the metadata on #factory.
		 * @returns 
		 * a %NULL-terminated array of key strings, or %NULL when there is no
		 * metadata. Free with {@link G.strfreev} when no longer needed.
		 */
		get_metadata_keys(): string[] | null;
		/**
		 * Check if #factory matches all of the given #classes
		 * @param classes a "/" separate list of classes to match, only match
		 *     if all classes are matched
		 * @returns %TRUE if #factory matches or if #classes is %NULL.
		 */
		has_classes(classes?: string | null): boolean;
		/**
		 * Check if #factory matches all of the given classes
		 * @param classes a %NULL terminated array
		 *   of classes to match, only match if all classes are matched
		 * @returns %TRUE if #factory matches.
		 */
		has_classesv(classes?: string[] | null): boolean;
	}

	type DeviceProviderFactoryInitOptionsMixin = PluginFeatureInitOptions
	export interface DeviceProviderFactoryInitOptions extends DeviceProviderFactoryInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DeviceProviderFactory} instead.
	 */
	type DeviceProviderFactoryMixin = IDeviceProviderFactory & PluginFeature;

	/**
	 * {@link DeviceProviderFactory} is used to create instances of device providers. A
	 * GstDeviceProviderfactory can be added to a #GstPlugin as it is also a
	 * #GstPluginFeature.
	 * 
	 * Use the {@link Gst.DeviceProviderFactory.find} and
	 * gst_device_provider_factory_get() functions to create device
	 * provider instances or use gst_device_provider_factory_get_by_name() as a
	 * convenient shortcut.
	 */
	interface DeviceProviderFactory extends DeviceProviderFactoryMixin {}

	class DeviceProviderFactory {
		public constructor(options?: Partial<DeviceProviderFactoryInitOptions>);
		/**
		 * Search for an device provider factory of the given name. Refs the returned
		 * device provider factory; caller is responsible for unreffing.
		 * @param name name of factory to find
		 * @returns {@link DeviceProviderFactory} if
		 * found, %NULL otherwise
		 */
		public static find(name: string): DeviceProviderFactory | null;
		/**
		 * Returns the device provider of the type defined by the given device
		 * provider factory.
		 * @param factoryname a named factory to instantiate
		 * @returns a {@link DeviceProvider} or %NULL
		 * if unable to create device provider
		 */
		public static get_by_name(factoryname: string): DeviceProvider | null;
		/**
		 * Get a list of factories with a rank greater or equal to #minrank.
		 * The list of factories is returned by decreasing rank.
		 * @param minrank Minimum rank
		 * @returns 
		 * a #GList of {@link DeviceProviderFactory} device providers. Use
		 * {@link Gst.PluginFeature.list_free} after usage.
		 */
		public static list_get_device_providers(minrank: Rank): DeviceProviderFactory[];
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DoubleRange} instead.
	 */
	interface IDoubleRange {

	}

	type DoubleRangeInitOptionsMixin  = {};
	export interface DoubleRangeInitOptions extends DoubleRangeInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DoubleRange} instead.
	 */
	type DoubleRangeMixin = IDoubleRange;

	/**
	 * A fundamental type that describes a #gdouble range
	 */
	interface DoubleRange extends DoubleRangeMixin {}

	class DoubleRange {
		public constructor(options?: Partial<DoubleRangeInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DynamicTypeFactory} instead.
	 */
	interface IDynamicTypeFactory {

	}

	type DynamicTypeFactoryInitOptionsMixin = PluginFeatureInitOptions
	export interface DynamicTypeFactoryInitOptions extends DynamicTypeFactoryInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link DynamicTypeFactory} instead.
	 */
	type DynamicTypeFactoryMixin = IDynamicTypeFactory & PluginFeature;

	/**
	 * {@link DynamicTypeFactory} is used to represent a type that can be
	 * automatically loaded the first time it is used. For example,
	 * a non-standard type for use in caps fields.
	 * 
	 * In general, applications and plugins don't need to use the factory
	 * beyond registering the type in a plugin init function. Once that is
	 * done, the type is stored in the registry, and ready as soon as the
	 * registry is loaded.
	 * 
	 * ## Registering a type for dynamic loading
	 * 
	 * |[<!-- language="C" -->
	 * 
	 * static gboolean
	 * plugin_init (GstPlugin * plugin)
	 * {
	 *   return gst_dynamic_type_register (plugin, GST_TYPE_CUSTOM_CAPS_FIELD);
	 * }
	 * ]|
	 */
	interface DynamicTypeFactory extends DynamicTypeFactoryMixin {}

	class DynamicTypeFactory {
		public constructor(options?: Partial<DynamicTypeFactoryInitOptions>);
		public static load(factoryname: string): GObject.Type;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Element} instead.
	 */
	interface IElement {
		readonly object: Object;
		/**
		 * Used to serialize execution of {@link Gst.Element.set_state}
		 */
		readonly state_lock: GLib.RecMutex;
		/**
		 * Used to signal completion of a state change
		 */
		readonly state_cond: GLib.Cond;
		/**
		 * Used to detect concurrent execution of
		 * {@link Gst.Element.set_state} and gst_element_get_state()
		 */
		readonly state_cookie: number;
		/**
		 * the target state of an element as set by the application
		 */
		readonly target_state: State;
		/**
		 * the current state of an element
		 */
		readonly current_state: State;
		/**
		 * the next state of an element, can be #GST_STATE_VOID_PENDING if
		 * the element is in the correct state.
		 */
		readonly next_state: State;
		/**
		 * the final state the element should go to, can be
		 * #GST_STATE_VOID_PENDING if the element is in the correct state
		 */
		readonly pending_state: State;
		/**
		 * the last return value of an element state change
		 */
		readonly last_return: StateChangeReturn;
		/**
		 * the bus of the element. This bus is provided to the element by the
		 * parent element or the application. A {@link Pipeline} has a bus of its own.
		 */
		readonly bus: Bus;
		/**
		 * the clock of the element. This clock is usually provided to the
		 * element by the toplevel {@link Pipeline}.
		 */
		readonly clock: Clock;
		/**
		 * the time of the clock right before the element is set to
		 * PLAYING. Subtracting #base_time from the current clock time in the PLAYING
		 * state will yield the running_time against the clock.
		 */
		readonly base_time: ClockTimeDiff;
		/**
		 * the running_time of the last PAUSED state
		 */
		readonly start_time: ClockTime;
		/**
		 * number of pads of the element, includes both source and sink pads.
		 */
		readonly numpads: number;
		/**
		 * list of pads
		 */
		readonly pads: Pad[];
		/**
		 * number of source pads of the element.
		 */
		readonly numsrcpads: number;
		/**
		 * list of source pads
		 */
		readonly srcpads: Pad[];
		/**
		 * number of sink pads of the element.
		 */
		readonly numsinkpads: number;
		/**
		 * list of sink pads
		 */
		readonly sinkpads: Pad[];
		/**
		 * updated whenever the a pad is added or removed
		 */
		readonly pads_cookie: number;
		/**
		 * list of contexts
		 */
		readonly contexts: Context[];
		/**
		 * Abort the state change of the element. This function is used
		 * by elements that do asynchronous state changes and find out
		 * something is wrong.
		 * 
		 * This function should be called with the STATE_LOCK held.
		 * 
		 * MT safe.
		 */
		abort_state(): void;
		/**
		 * Adds a pad (link point) to #element. #pad's parent will be set to #element;
		 * see {@link Gst.Object.set_parent} for refcounting information.
		 * 
		 * Pads are automatically activated when added in the PAUSED or PLAYING
		 * state.
		 * 
		 * The pad and the element should be unlocked when calling this function.
		 * 
		 * This function will emit the {@link Element.pad_added} signal on the element.
		 * @param pad the {@link Pad} to add to the element.
		 * @returns %TRUE if the pad could be added. This function can fail when
		 * a pad with the same name already existed or the pad already had another
		 * parent.
		 * 
		 * MT safe.
		 */
		add_pad(pad: Pad): boolean;
		add_property_deep_notify_watch(property_name: string | null, include_value: boolean): number;
		add_property_notify_watch(property_name: string | null, include_value: boolean): number;
		/**
		 * Calls #func from another thread and passes #user_data to it. This is to be
		 * used for cases when a state change has to be performed from a streaming
		 * thread, directly via {@link Gst.Element.set_state} or indirectly e.g. via SEEK
		 * events.
		 * 
		 * Calling those functions directly from the streaming thread will cause
		 * deadlocks in many situations, as they might involve waiting for the
		 * streaming thread to shut down from this very streaming thread.
		 * 
		 * MT safe.
		 * @param func Function to call asynchronously from another thread
		 */
		call_async(func: ElementCallAsyncFunc): void;
		/**
		 * Perform #transition on #element.
		 * 
		 * This function must be called with STATE_LOCK held and is mainly used
		 * internally.
		 * @param transition the requested transition
		 * @returns the {@link StateChangeReturn} of the state transition.
		 */
		change_state(transition: StateChange): StateChangeReturn;
		/**
		 * Commit the state change of the element and proceed to the next
		 * pending state if any. This function is used
		 * by elements that do asynchronous state changes.
		 * The core will normally call this method automatically when an
		 * element returned %GST_STATE_CHANGE_SUCCESS from the state change function.
		 * 
		 * If after calling this method the element still has not reached
		 * the pending state, the next state change is performed.
		 * 
		 * This method is used internally and should normally not be called by plugins
		 * or applications.
		 * 
		 * This function must be called with STATE_LOCK held.
		 * @param ret The previous state return value
		 * @returns The result of the commit state change.
		 * 
		 * MT safe.
		 */
		continue_state(ret: StateChangeReturn): StateChangeReturn;
		/**
		 * Creates a pad for each pad template that is always available.
		 * This function is only useful during object initialization of
		 * subclasses of {@link Element}.
		 */
		create_all_pads(): void;
		/**
		 * Call #func with #user_data for each of #element's pads. #func will be called
		 * exactly once for each pad that exists at the time of this call, unless
		 * one of the calls to #func returns %FALSE in which case we will stop
		 * iterating pads and return early. If new pads are added or pads are removed
		 * while pads are being iterated, this will not be taken into account until
		 * next time this function is used.
		 * @param func function to call for each pad
		 * @returns %FALSE if #element had no pads or if one of the calls to #func
		 *   returned %FALSE.
		 */
		foreach_pad(func: ElementForeachPadFunc): boolean;
		/**
		 * Call #func with #user_data for each of #element's sink pads. #func will be
		 * called exactly once for each sink pad that exists at the time of this call,
		 * unless one of the calls to #func returns %FALSE in which case we will stop
		 * iterating pads and return early. If new sink pads are added or sink pads
		 * are removed while the sink pads are being iterated, this will not be taken
		 * into account until next time this function is used.
		 * @param func function to call for each sink pad
		 * @returns %FALSE if #element had no sink pads or if one of the calls to #func
		 *   returned %FALSE.
		 */
		foreach_sink_pad(func: ElementForeachPadFunc): boolean;
		/**
		 * Call #func with #user_data for each of #element's source pads. #func will be
		 * called exactly once for each source pad that exists at the time of this call,
		 * unless one of the calls to #func returns %FALSE in which case we will stop
		 * iterating pads and return early. If new source pads are added or source pads
		 * are removed while the source pads are being iterated, this will not be taken
		 * into account until next time this function is used.
		 * @param func function to call for each source pad
		 * @returns %FALSE if #element had no source pads or if one of the calls
		 *   to #func returned %FALSE.
		 */
		foreach_src_pad(func: ElementForeachPadFunc): boolean;
		/**
		 * Returns the base time of the element. The base time is the
		 * absolute time of the clock when this element was last put to
		 * PLAYING. Subtracting the base time from the clock time gives
		 * the running time of the element.
		 * @returns the base time of the element.
		 * 
		 * MT safe.
		 */
		get_base_time(): ClockTime;
		/**
		 * Returns the bus of the element. Note that only a {@link Pipeline} will provide a
		 * bus for the application.
		 * @returns the element's {@link Bus}. unref after
		 * usage.
		 * 
		 * MT safe.
		 */
		get_bus(): Bus | null;
		/**
		 * Gets the currently configured clock of the element. This is the clock as was
		 * last set with {@link Gst.Element.set_clock}.
		 * 
		 * Elements in a pipeline will only have their clock set when the
		 * pipeline is in the PLAYING state.
		 * @returns the {@link Clock} of the element. unref after usage.
		 * 
		 * MT safe.
		 */
		get_clock(): Clock | null;
		/**
		 * Looks for an unlinked pad to which the given pad can link. It is not
		 * guaranteed that linking the pads will work, though it should work in most
		 * cases.
		 * 
		 * This function will first attempt to find a compatible unlinked ALWAYS pad,
		 * and if none can be found, it will request a compatible REQUEST pad by looking
		 * at the templates of #element.
		 * @param pad the {@link Pad} to find a compatible one for.
		 * @param caps the {@link Caps} to use as a filter.
		 * @returns the {@link Pad} to which a link
		 *   can be made, or %NULL if one cannot be found. {@link Gst.Object.unref}
		 *   after usage.
		 */
		get_compatible_pad(pad: Pad, caps?: Caps | null): Pad | null;
		/**
		 * Retrieves a pad template from #element that is compatible with #compattempl.
		 * Pads from compatible templates can be linked together.
		 * @param compattempl the {@link PadTemplate} to find a compatible
		 *     template for
		 * @returns a compatible {@link PadTemplate},
		 *   or %NULL if none was found. No unreferencing is necessary.
		 */
		get_compatible_pad_template(compattempl: PadTemplate): PadTemplate | null;
		/**
		 * Gets the context with #context_type set on the element or NULL.
		 * 
		 * MT safe.
		 * @param context_type a name of a context to retrieve
		 * @returns A {@link Context} or NULL
		 */
		get_context(context_type: string): Context | null;
		/**
		 * Gets the context with #context_type set on the element or NULL.
		 * @param context_type a name of a context to retrieve
		 * @returns A {@link Context} or NULL
		 */
		get_context_unlocked(context_type: string): Context | null;
		/**
		 * Gets the contexts set on the element.
		 * 
		 * MT safe.
		 * @returns List of {@link Context}
		 */
		get_contexts(): Context[];
		/**
		 * Returns the current clock time of the element, as in, the time of the
		 * element's clock, or GST_CLOCK_TIME_NONE if there is no clock.
		 * @returns the clock time of the element, or GST_CLOCK_TIME_NONE if there is
		 * no clock.
		 */
		get_current_clock_time(): ClockTime;
		/**
		 * Returns the running time of the element. The running time is the
		 * element's clock time minus its base time. Will return GST_CLOCK_TIME_NONE
		 * if the element has no clock, or if its base time has not been set.
		 * @returns the running time of the element, or GST_CLOCK_TIME_NONE if the
		 * element has no clock or its base time has not been set.
		 */
		get_current_running_time(): ClockTime;
		/**
		 * Retrieves the factory that was used to create this element.
		 * @returns the {@link ElementFactory} used for creating this
		 *     element or %NULL if element has not been registered (static element). no refcounting is needed.
		 */
		get_factory(): ElementFactory | null;
		/**
		 * Get metadata with #key in #klass.
		 * @param key the key to get
		 * @returns the metadata for #key.
		 */
		get_metadata(key: string): string;
		/**
		 * Retrieves a padtemplate from #element with the given name.
		 * @param name the name of the {@link PadTemplate} to get.
		 * @returns the {@link PadTemplate} with the
		 *     given name, or %NULL if none was found. No unreferencing is
		 *     necessary.
		 */
		get_pad_template(name: string): PadTemplate | null;
		/**
		 * Retrieves a list of the pad templates associated with #element. The
		 * list must not be modified by the calling code.
		 * @returns the #GList of
		 *     pad templates.
		 */
		get_pad_template_list(): PadTemplate[];
		/**
		 * Retrieves a pad from the element by name (e.g. "src_\%d"). This version only
		 * retrieves request pads. The pad should be released with
		 * {@link Gst.Element.release_request_pad}.
		 * 
		 * This method is slower than manually getting the pad template and calling
		 * gst_element_request_pad() if the pads should have a specific name (e.g.
		 * #name is "src_1" instead of "src_\%u").
		 * @param name the name of the request {@link Pad} to retrieve.
		 * @returns requested {@link Pad} if found,
		 *     otherwise %NULL.  Release after usage.
		 */
		get_request_pad(name: string): Pad | null;
		/**
		 * Returns the start time of the element. The start time is the
		 * running time of the clock when this element was last put to PAUSED.
		 * 
		 * Usually the start_time is managed by a toplevel element such as
		 * {@link Pipeline}.
		 * 
		 * MT safe.
		 * @returns the start time of the element.
		 */
		get_start_time(): ClockTime;
		/**
		 * Gets the state of the element.
		 * 
		 * For elements that performed an ASYNC state change, as reported by
		 * {@link Gst.Element.set_state}, this function will block up to the
		 * specified timeout value for the state change to complete.
		 * If the element completes the state change or goes into
		 * an error, this function returns immediately with a return value of
		 * %GST_STATE_CHANGE_SUCCESS or %GST_STATE_CHANGE_FAILURE respectively.
		 * 
		 * For elements that did not return %GST_STATE_CHANGE_ASYNC, this function
		 * returns the current and pending state immediately.
		 * 
		 * This function returns %GST_STATE_CHANGE_NO_PREROLL if the element
		 * successfully changed its state but is not able to provide data yet.
		 * This mostly happens for live sources that only produce data in
		 * %GST_STATE_PLAYING. While the state change return is equivalent to
		 * %GST_STATE_CHANGE_SUCCESS, it is returned to the application to signal that
		 * some sink elements might not be able to complete their state change because
		 * an element is not producing data to complete the preroll. When setting the
		 * element to playing, the preroll will complete and playback will start.
		 * @param timeout a {@link ClockTime} to specify the timeout for an async
		 *           state change or %GST_CLOCK_TIME_NONE for infinite timeout.
		 * @returns %GST_STATE_CHANGE_SUCCESS if the element has no more pending state
		 *          and the last state change succeeded, %GST_STATE_CHANGE_ASYNC if the
		 *          element is still performing a state change or
		 *          %GST_STATE_CHANGE_FAILURE if the last state change failed.
		 * 
		 * MT safe.
		 * 
		 * a pointer to {@link State} to hold the state.
		 *     Can be %NULL.
		 * 
		 * a pointer to #GstState to hold the pending
		 *     state. Can be %NULL.
		 */
		get_state(timeout: ClockTime): [ StateChangeReturn, State | null, State | null ];
		/**
		 * Retrieves a pad from #element by name. This version only retrieves
		 * already-existing (i.e. 'static') pads.
		 * @param name the name of the static {@link Pad} to retrieve.
		 * @returns the requested {@link Pad} if
		 *     found, otherwise %NULL.  unref after usage.
		 * 
		 * MT safe.
		 */
		get_static_pad(name: string): Pad | null;
		/**
		 * Checks if the state of an element is locked.
		 * If the state of an element is locked, state changes of the parent don't
		 * affect the element.
		 * This way you can leave currently unused elements inside bins. Just lock their
		 * state before changing the state from #GST_STATE_NULL.
		 * 
		 * MT safe.
		 * @returns %TRUE, if the element's state is locked.
		 */
		is_locked_state(): boolean;
		/**
		 * Retrieves an iterator of #element's pads. The iterator should
		 * be freed after usage. Also more specialized iterators exists such as
		 * {@link Gst.Element.iterate_src_pads} or gst_element_iterate_sink_pads().
		 * 
		 * The order of pads returned by the iterator will be the order in which
		 * the pads were added to the element.
		 * @returns the {@link Iterator} of #GstPad.
		 * 
		 * MT safe.
		 */
		iterate_pads(): Iterator;
		/**
		 * Retrieves an iterator of #element's sink pads.
		 * 
		 * The order of pads returned by the iterator will be the order in which
		 * the pads were added to the element.
		 * @returns the {@link Iterator} of #GstPad.
		 * 
		 * MT safe.
		 */
		iterate_sink_pads(): Iterator;
		/**
		 * Retrieves an iterator of #element's source pads.
		 * 
		 * The order of pads returned by the iterator will be the order in which
		 * the pads were added to the element.
		 * @returns the {@link Iterator} of #GstPad.
		 * 
		 * MT safe.
		 */
		iterate_src_pads(): Iterator;
		/**
		 * Links #src to #dest. The link must be from source to
		 * destination; the other direction will not be tried. The function looks for
		 * existing pads that aren't linked yet. It will request new pads if necessary.
		 * Such pads need to be released manually when unlinking.
		 * If multiple links are possible, only one is established.
		 * 
		 * Make sure you have added your elements to a bin or pipeline with
		 * {@link Gst.Bin.add} before trying to link them.
		 * @param dest the {@link Element} containing the destination pad.
		 * @returns %TRUE if the elements could be linked, %FALSE otherwise.
		 */
		link(dest: Element): boolean;
		/**
		 * Links #src to #dest using the given caps as filtercaps.
		 * The link must be from source to
		 * destination; the other direction will not be tried. The function looks for
		 * existing pads that aren't linked yet. It will request new pads if necessary.
		 * If multiple links are possible, only one is established.
		 * 
		 * Make sure you have added your elements to a bin or pipeline with
		 * {@link Gst.Bin.add} before trying to link them.
		 * @param dest the {@link Element} containing the destination pad.
		 * @param filter the {@link Caps} to filter the link,
		 *     or %NULL for no filter.
		 * @returns %TRUE if the pads could be linked, %FALSE otherwise.
		 */
		link_filtered(dest: Element, filter?: Caps | null): boolean;
		/**
		 * Chain together a series of elements. Uses {@link Gst.Element.link}.
		 * Make sure you have added your elements to a bin or pipeline with
		 * gst_bin_add() before trying to link them.
		 * @param element_2 the second {@link Element} in the link chain.
		 * @returns %TRUE on success, %FALSE otherwise.
		 */
		link_many(element_2: Element): boolean;
		/**
		 * Links the two named pads of the source and destination elements.
		 * Side effect is that if one of the pads has no parent, it becomes a
		 * child of the parent of the other element.  If they have different
		 * parents, the link fails.
		 * @param srcpadname the name of the {@link Pad} in source element
		 *     or %NULL for any pad.
		 * @param dest the {@link Element} containing the destination pad.
		 * @param destpadname the name of the {@link Pad} in destination element,
		 * or %NULL for any pad.
		 * @returns %TRUE if the pads could be linked, %FALSE otherwise.
		 */
		link_pads(srcpadname: string | null, dest: Element, destpadname?: string | null): boolean;
		/**
		 * Links the two named pads of the source and destination elements. Side effect
		 * is that if one of the pads has no parent, it becomes a child of the parent of
		 * the other element. If they have different parents, the link fails. If #caps
		 * is not %NULL, makes sure that the caps of the link is a subset of #caps.
		 * @param srcpadname the name of the {@link Pad} in source element
		 *     or %NULL for any pad.
		 * @param dest the {@link Element} containing the destination pad.
		 * @param destpadname the name of the {@link Pad} in destination element
		 *     or %NULL for any pad.
		 * @param filter the {@link Caps} to filter the link,
		 *     or %NULL for no filter.
		 * @returns %TRUE if the pads could be linked, %FALSE otherwise.
		 */
		link_pads_filtered(srcpadname: string | null, dest: Element, destpadname?: string | null, filter?: Caps | null): boolean;
		/**
		 * Links the two named pads of the source and destination elements.
		 * Side effect is that if one of the pads has no parent, it becomes a
		 * child of the parent of the other element.  If they have different
		 * parents, the link fails.
		 * 
		 * Calling {@link Gst.Element.link_pads_full} with #flags == %GST_PAD_LINK_CHECK_DEFAULT
		 * is the same as calling gst_element_link_pads() and the recommended way of
		 * linking pads with safety checks applied.
		 * 
		 * This is a convenience function for gst_pad_link_full().
		 * @param srcpadname the name of the {@link Pad} in source element
		 *     or %NULL for any pad.
		 * @param dest the {@link Element} containing the destination pad.
		 * @param destpadname the name of the {@link Pad} in destination element,
		 * or %NULL for any pad.
		 * @param flags the {@link PadLinkCheck} to be performed when linking pads.
		 * @returns %TRUE if the pads could be linked, %FALSE otherwise.
		 */
		link_pads_full(srcpadname: string | null, dest: Element, destpadname: string | null, flags: PadLinkCheck): boolean;
		/**
		 * Brings the element to the lost state. The current state of the
		 * element is copied to the pending state so that any call to
		 * {@link Gst.Element.get_state} will return %GST_STATE_CHANGE_ASYNC.
		 * 
		 * An ASYNC_START message is posted. If the element was PLAYING, it will
		 * go to PAUSED. The element will be restored to its PLAYING state by
		 * the parent pipeline when it prerolls again.
		 * 
		 * This is mostly used for elements that lost their preroll buffer
		 * in the %GST_STATE_PAUSED or %GST_STATE_PLAYING state after a flush,
		 * they will go to their pending state again when a new preroll buffer is
		 * queued. This function can only be called when the element is currently
		 * not in error or an async state change.
		 * 
		 * This function is used internally and should normally not be called from
		 * plugins or applications.
		 */
		lost_state(): void;
		/**
		 * Post an error, warning or info message on the bus from inside an element.
		 * 
		 * #type must be of #GST_MESSAGE_ERROR, #GST_MESSAGE_WARNING or
		 * #GST_MESSAGE_INFO.
		 * 
		 * MT safe.
		 * @param type the {@link MessageType}
		 * @param domain the GStreamer GError domain this message belongs to
		 * @param code the GError code belonging to the domain
		 * @param text an allocated text string to be used
		 *            as a replacement for the default message connected to code,
		 *            or %NULL
		 * @param debug an allocated debug message to be
		 *            used as a replacement for the default debugging information,
		 *            or %NULL
		 * @param file the source code file where the error was generated
		 * @param _function the source code function where the error was generated
		 * @param line the source code line where the error was generated
		 */
		message_full(type: MessageType, domain: GLib.Quark, code: number, text: string | null, debug: string | null, file: string, _function: string, line: number): void;
		/**
		 * Post an error, warning or info message on the bus from inside an element.
		 * 
		 * #type must be of #GST_MESSAGE_ERROR, #GST_MESSAGE_WARNING or
		 * #GST_MESSAGE_INFO.
		 * @param type the {@link MessageType}
		 * @param domain the GStreamer GError domain this message belongs to
		 * @param code the GError code belonging to the domain
		 * @param text an allocated text string to be used
		 *            as a replacement for the default message connected to code,
		 *            or %NULL
		 * @param debug an allocated debug message to be
		 *            used as a replacement for the default debugging information,
		 *            or %NULL
		 * @param file the source code file where the error was generated
		 * @param _function the source code function where the error was generated
		 * @param line the source code line where the error was generated
		 * @param structure optional details structure
		 */
		message_full_with_details(type: MessageType, domain: GLib.Quark, code: number, text: string | null, debug: string | null, file: string, _function: string, line: number, structure: Structure): void;
		/**
		 * Use this function to signal that the element does not expect any more pads
		 * to show up in the current pipeline. This function should be called whenever
		 * pads have been added by the element itself. Elements with #GST_PAD_SOMETIMES
		 * pad templates use this in combination with autopluggers to figure out that
		 * the element is done initializing its pads.
		 * 
		 * This function emits the {@link Element.no_more_pads} signal.
		 * 
		 * MT safe.
		 */
		no_more_pads(): void;
		/**
		 * Post a message on the element's {@link Bus}. This function takes ownership of the
		 * message; if you want to access the message after this call, you should add an
		 * additional reference before calling.
		 * @param message a {@link Message} to post
		 * @returns %TRUE if the message was successfully posted. The function returns
		 * %FALSE if the element did not have a bus.
		 * 
		 * MT safe.
		 */
		post_message(message: Message): boolean;
		/**
		 * Get the clock provided by the given element.
		 * > An element is only required to provide a clock in the PAUSED
		 * > state. Some elements can provide a clock in other states.
		 * @returns the GstClock provided by the
		 * element or %NULL if no clock could be provided.  Unref after usage.
		 * 
		 * MT safe.
		 */
		provide_clock(): Clock | null;
		/**
		 * Performs a query on the given element.
		 * 
		 * For elements that don't implement a query handler, this function
		 * forwards the query to a random srcpad or to the peer of a
		 * random linked sinkpad of this element.
		 * 
		 * Please note that some queries might need a running pipeline to work.
		 * @param query the {@link Query}.
		 * @returns %TRUE if the query could be performed.
		 * 
		 * MT safe.
		 */
		query(query: Query): boolean;
		/**
		 * Queries an element to convert #src_val in #src_format to #dest_format.
		 * @param src_format a {@link Format} to convert from.
		 * @param src_val a value to convert.
		 * @param dest_format the {@link Format} to convert to.
		 * @returns %TRUE if the query could be performed.
		 * 
		 * a pointer to the result.
		 */
		query_convert(src_format: Format, src_val: number, dest_format: Format): [ boolean, number ];
		/**
		 * Queries an element (usually top-level pipeline or playbin element) for the
		 * total stream duration in nanoseconds. This query will only work once the
		 * pipeline is prerolled (i.e. reached PAUSED or PLAYING state). The application
		 * will receive an ASYNC_DONE message on the pipeline bus when that is the case.
		 * 
		 * If the duration changes for some reason, you will get a DURATION_CHANGED
		 * message on the pipeline bus, in which case you should re-query the duration
		 * using this function.
		 * @param format the {@link Format} requested
		 * @returns %TRUE if the query could be performed.
		 * 
		 * A location in which to store the total duration, or %NULL.
		 */
		query_duration(format: Format): [ boolean, number | null ];
		/**
		 * Queries an element (usually top-level pipeline or playbin element) for the
		 * stream position in nanoseconds. This will be a value between 0 and the
		 * stream duration (if the stream duration is known). This query will usually
		 * only work once the pipeline is prerolled (i.e. reached PAUSED or PLAYING
		 * state). The application will receive an ASYNC_DONE message on the pipeline
		 * bus when that is the case.
		 * 
		 * If one repeatedly calls this function one can also create a query and reuse
		 * it in {@link Gst.Element.query}.
		 * @param format the {@link Format} requested
		 * @returns %TRUE if the query could be performed.
		 * 
		 * a location in which to store the current
		 *     position, or %NULL.
		 */
		query_position(format: Format): [ boolean, number | null ];
		/**
		 * Makes the element free the previously requested pad as obtained
		 * with {@link Gst.Element.request_pad}.
		 * 
		 * This does not unref the pad. If the pad was created by using
		 * gst_element_request_pad(), gst_element_release_request_pad() needs to be
		 * followed by gst_object_unref() to free the #pad.
		 * 
		 * MT safe.
		 * @param pad the {@link Pad} to release.
		 */
		release_request_pad(pad: Pad): void;
		/**
		 * Removes #pad from #element. #pad will be destroyed if it has not been
		 * referenced elsewhere using {@link Gst.Object.unparent}.
		 * 
		 * This function is used by plugin developers and should not be used
		 * by applications. Pads that were dynamically requested from elements
		 * with gst_element_request_pad() should be released with the
		 * gst_element_release_request_pad() function instead.
		 * 
		 * Pads are not automatically deactivated so elements should perform the needed
		 * steps to deactivate the pad in case this pad is removed in the PAUSED or
		 * PLAYING state. See gst_pad_set_active() for more information about
		 * deactivating pads.
		 * 
		 * The pad and the element should be unlocked when calling this function.
		 * 
		 * This function will emit the {@link Element.pad_removed} signal on the element.
		 * @param pad the {@link Pad} to remove from the element.
		 * @returns %TRUE if the pad could be removed. Can return %FALSE if the
		 * pad does not belong to the provided element.
		 * 
		 * MT safe.
		 */
		remove_pad(pad: Pad): boolean;
		remove_property_notify_watch(watch_id: number): void;
		/**
		 * Retrieves a request pad from the element according to the provided template.
		 * Pad templates can be looked up using
		 * {@link Gst.ElementFactory.get_static_pad_templates}.
		 * 
		 * The pad should be released with gst_element_release_request_pad().
		 * @param templ a {@link PadTemplate} of which we want a pad of.
		 * @param name the name of the request {@link Pad}
		 * to retrieve. Can be %NULL.
		 * @param caps the caps of the pad we want to
		 * request. Can be %NULL.
		 * @returns requested {@link Pad} if found,
		 *     otherwise %NULL.  Release after usage.
		 */
		request_pad(templ: PadTemplate, name?: string | null, caps?: Caps | null): Pad | null;
		/**
		 * Sends a seek event to an element. See {@link Gst.Event.new_seek} for the details of
		 * the parameters. The seek event is sent to the element using
		 * gst_element_send_event().
		 * 
		 * MT safe.
		 * @param rate The new playback rate
		 * @param format The format of the seek values
		 * @param flags The optional seek flags.
		 * @param start_type The type and flags for the new start position
		 * @param start The value of the new start position
		 * @param stop_type The type and flags for the new stop position
		 * @param stop The value of the new stop position
		 * @returns %TRUE if the event was handled. Flushing seeks will trigger a
		 * preroll, which will emit %GST_MESSAGE_ASYNC_DONE.
		 */
		seek(rate: number, format: Format, flags: SeekFlags, start_type: SeekType, start: number, stop_type: SeekType, stop: number): boolean;
		/**
		 * Simple API to perform a seek on the given element, meaning it just seeks
		 * to the given position relative to the start of the stream. For more complex
		 * operations like segment seeks (e.g. for looping) or changing the playback
		 * rate or seeking relative to the last configured playback segment you should
		 * use {@link Gst.Element.seek}.
		 * 
		 * In a completely prerolled PAUSED or PLAYING pipeline, seeking is always
		 * guaranteed to return %TRUE on a seekable media type or %FALSE when the media
		 * type is certainly not seekable (such as a live stream).
		 * 
		 * Some elements allow for seeking in the READY state, in this
		 * case they will store the seek event and execute it when they are put to
		 * PAUSED. If the element supports seek in READY, it will always return %TRUE when
		 * it receives the event in the READY state.
		 * @param format a {@link Format} to execute the seek in, such as #GST_FORMAT_TIME
		 * @param seek_flags seek options; playback applications will usually want to use
		 *            GST_SEEK_FLAG_FLUSH | GST_SEEK_FLAG_KEY_UNIT here
		 * @param seek_pos position to seek to (relative to the start); if you are doing
		 *            a seek in #GST_FORMAT_TIME this value is in nanoseconds -
		 *            multiply with #GST_SECOND to convert seconds to nanoseconds or
		 *            with #GST_MSECOND to convert milliseconds to nanoseconds.
		 * @returns %TRUE if the seek operation succeeded. Flushing seeks will trigger a
		 * preroll, which will emit %GST_MESSAGE_ASYNC_DONE.
		 */
		seek_simple(format: Format, seek_flags: SeekFlags, seek_pos: number): boolean;
		/**
		 * Sends an event to an element. If the element doesn't implement an
		 * event handler, the event will be pushed on a random linked sink pad for
		 * downstream events or a random linked source pad for upstream events.
		 * 
		 * This function takes ownership of the provided event so you should
		 * {@link Gst.Event.ref} it if you want to reuse the event after this call.
		 * 
		 * MT safe.
		 * @param event the {@link Event} to send to the element.
		 * @returns %TRUE if the event was handled. Events that trigger a preroll (such
		 * as flushing seeks and steps) will emit %GST_MESSAGE_ASYNC_DONE.
		 */
		send_event(event: Event): boolean;
		/**
		 * Set the base time of an element. See {@link Gst.Element.get_base_time}.
		 * 
		 * MT safe.
		 * @param time the base time to set.
		 */
		set_base_time(time: ClockTime): void;
		/**
		 * Sets the bus of the element. Increases the refcount on the bus.
		 * For internal use only, unless you're testing elements.
		 * 
		 * MT safe.
		 * @param bus the {@link Bus} to set.
		 */
		set_bus(bus?: Bus | null): void;
		/**
		 * Sets the clock for the element. This function increases the
		 * refcount on the clock. Any previously set clock on the object
		 * is unreffed.
		 * @param clock the {@link Clock} to set for the element.
		 * @returns %TRUE if the element accepted the clock. An element can refuse a
		 * clock when it, for example, is not able to slave its internal clock to the
		 * #clock or when it requires a specific clock to operate.
		 * 
		 * MT safe.
		 */
		set_clock(clock?: Clock | null): boolean;
		/**
		 * Sets the context of the element. Increases the refcount of the context.
		 * 
		 * MT safe.
		 * @param context the {@link Context} to set.
		 */
		set_context(context: Context): void;
		/**
		 * Locks the state of an element, so state changes of the parent don't affect
		 * this element anymore.
		 * 
		 * Note that this is racy if the state lock of the parent bin is not taken.
		 * The parent bin might've just checked the flag in another thread and as the
		 * next step proceed to change the child element's state.
		 * 
		 * MT safe.
		 * @param locked_state %TRUE to lock the element's state
		 * @returns %TRUE if the state was changed, %FALSE if bad parameters were given
		 * or the elements state-locking needed no change.
		 */
		set_locked_state(locked_state: boolean): boolean;
		/**
		 * Set the start time of an element. The start time of the element is the
		 * running time of the element when it last went to the PAUSED state. In READY
		 * or after a flushing seek, it is set to 0.
		 * 
		 * Toplevel elements like {@link Pipeline} will manage the start_time and
		 * base_time on its children. Setting the start_time to #GST_CLOCK_TIME_NONE
		 * on such a toplevel element will disable the distribution of the base_time to
		 * the children and can be useful if the application manages the base_time
		 * itself, for example if you want to synchronize capture from multiple
		 * pipelines, and you can also ensure that the pipelines have the same clock.
		 * 
		 * MT safe.
		 * @param time the base time to set.
		 */
		set_start_time(time: ClockTime): void;
		/**
		 * Sets the state of the element. This function will try to set the
		 * requested state by going through all the intermediary states and calling
		 * the class's state change function for each.
		 * 
		 * This function can return #GST_STATE_CHANGE_ASYNC, in which case the
		 * element will perform the remainder of the state change asynchronously in
		 * another thread.
		 * An application can use {@link Gst.Element.get_state} to wait for the completion
		 * of the state change or it can wait for a %GST_MESSAGE_ASYNC_DONE or
		 * %GST_MESSAGE_STATE_CHANGED on the bus.
		 * 
		 * State changes to %GST_STATE_READY or %GST_STATE_NULL never return
		 * #GST_STATE_CHANGE_ASYNC.
		 * @param state the element's new {@link State}.
		 * @returns Result of the state change using {@link StateChangeReturn}.
		 * 
		 * MT safe.
		 */
		set_state(state: State): StateChangeReturn;
		/**
		 * Tries to change the state of the element to the same as its parent.
		 * If this function returns %FALSE, the state of element is undefined.
		 * @returns %TRUE, if the element's state could be synced to the parent's state.
		 * 
		 * MT safe.
		 */
		sync_state_with_parent(): boolean;
		/**
		 * Unlinks all source pads of the source element with all sink pads
		 * of the sink element to which they are linked.
		 * 
		 * If the link has been made using {@link Gst.Element.link}, it could have created an
		 * requestpad, which has to be released using gst_element_release_request_pad().
		 * @param dest the sink {@link Element} to unlink.
		 */
		unlink(dest: Element): void;
		/**
		 * Unlinks a series of elements. Uses {@link Gst.Element.unlink}.
		 * @param element_2 the second {@link Element} in the link chain.
		 */
		unlink_many(element_2: Element): void;
		/**
		 * Unlinks the two named pads of the source and destination elements.
		 * 
		 * This is a convenience function for {@link Gst.Pad.unlink}.
		 * @param srcpadname the name of the {@link Pad} in source element.
		 * @param dest a {@link Element} containing the destination pad.
		 * @param destpadname the name of the {@link Pad} in destination element.
		 */
		unlink_pads(srcpadname: string, dest: Element, destpadname: string): void;
		/**
		 * This signals that the element will not generate more dynamic pads.
		 * Note that this signal will usually be emitted from the context of
		 * the streaming thread.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "no-more-pads", callback: (owner: this) => void): number;
		/**
		 * a new {@link Pad} has been added to the element. Note that this signal will
		 * usually be emitted from the context of the streaming thread. Also keep in
		 * mind that if you add new elements to the pipeline in the signal handler
		 * you will need to set them to the desired target state with
		 * {@link Gst.Element.set_state} or gst_element_sync_state_with_parent().
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - new_pad: the pad that has been added 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "pad-added", callback: (owner: this, new_pad: Pad) => void): number;
		/**
		 * a {@link Pad} has been removed from the element
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - old_pad: the pad that has been removed 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "pad-removed", callback: (owner: this, old_pad: Pad) => void): number;

		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::state_lock", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::state_cond", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::state_cookie", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::target_state", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::current_state", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::next_state", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pending_state", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::last_return", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::bus", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::clock", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::base_time", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::start_time", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::numpads", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pads", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::numsrcpads", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::srcpads", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::numsinkpads", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::sinkpads", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::pads_cookie", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::contexts", callback: (owner: this, ...args: any) => void): number;

	}

	type ElementInitOptionsMixin = ObjectInitOptions
	export interface ElementInitOptions extends ElementInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Element} instead.
	 */
	type ElementMixin = IElement & Object;

	/**
	 * GstElement is the abstract base class needed to construct an element that
	 * can be used in a GStreamer pipeline. Please refer to the plugin writers
	 * guide for more information on creating {@link Element} subclasses.
	 * 
	 * The name of a #GstElement can be get with {@link Gst.Element.get_name} and set with
	 * gst_element_set_name().  For speed, GST_ELEMENT_NAME() can be used in the
	 * core when using the appropriate locking. Do not use this in plug-ins or
	 * applications in order to retain ABI compatibility.
	 * 
	 * Elements can have pads (of the type #GstPad).  These pads link to pads on
	 * other elements.  #GstBuffer flow between these linked pads.
	 * A #GstElement has a #GList of #GstPad structures for all their input (or sink)
	 * and output (or source) pads.
	 * Core and plug-in writers can add and remove pads with gst_element_add_pad()
	 * and gst_element_remove_pad().
	 * 
	 * An existing pad of an element can be retrieved by name with
	 * gst_element_get_static_pad(). A new dynamic pad can be created using
	 * gst_element_request_pad() with a #GstPadTemplate.
	 * An iterator of all pads can be retrieved with gst_element_iterate_pads().
	 * 
	 * Elements can be linked through their pads.
	 * If the link is straightforward, use the gst_element_link()
	 * convenience function to link two elements, or gst_element_link_many()
	 * for more elements in a row.
	 * Use gst_element_link_filtered() to link two elements constrained by
	 * a specified set of #GstCaps.
	 * For finer control, use gst_element_link_pads() and
	 * gst_element_link_pads_filtered() to specify the pads to link on
	 * each element by name.
	 * 
	 * Each element has a state (see #GstState).  You can get and set the state
	 * of an element with gst_element_get_state() and gst_element_set_state().
	 * Setting a state triggers a #GstStateChange. To get a string representation
	 * of a #GstState, use gst_element_state_get_name().
	 * 
	 * You can get and set a #GstClock on an element using gst_element_get_clock()
	 * and gst_element_set_clock().
	 * Some elements can provide a clock for the pipeline if
	 * the #GST_ELEMENT_FLAG_PROVIDE_CLOCK flag is set. With the
	 * gst_element_provide_clock() method one can retrieve the clock provided by
	 * such an element.
	 * Not all elements require a clock to operate correctly. If the
	 * #GST_ELEMENT_FLAG_REQUIRE_CLOCK() flag is set, a clock should be set on the
	 * element with gst_element_set_clock().
	 * 
	 * Note that clock selection and distribution is normally handled by the
	 * toplevel #GstPipeline so the clock functions are only to be used in very
	 * specific situations.
	 */
	interface Element extends ElementMixin {}

	class Element {
		public constructor(options?: Partial<ElementInitOptions>);
		/**
		 * Creates an element for handling the given URI.
		 * @param type Whether to create a source or a sink
		 * @param uri URI to create an element for
		 * @param elementname Name of created element, can be %NULL.
		 * @returns a new element or %NULL if none
		 * could be created
		 */
		public static make_from_uri(type: URIType, uri: string, elementname?: string | null): Element;
		/**
		 * Create a new elementfactory capable of instantiating objects of the
		 * #type and add the factory to #plugin.
		 * @param plugin {@link Plugin} to register the element with, or %NULL for
		 *     a static element.
		 * @param name name of elements of this type
		 * @param rank rank of element (higher rank means more importance when autoplugging)
		 * @param type GType of element to register
		 * @returns %TRUE, if the registering succeeded, %FALSE on error
		 */
		public static register(plugin: Plugin | null, name: string, rank: number, type: GObject.Type): boolean;
		/**
		 * Gets a string representing the given state change result.
		 * @param state_ret a {@link StateChangeReturn} to get the name of.
		 * @returns a string with the name of the state
		 *    result.
		 */
		public static state_change_return_get_name(state_ret: StateChangeReturn): string;
		/**
		 * Gets a string representing the given state.
		 * @param state a {@link State} to get the name of.
		 * @returns a string with the name of the state.
		 */
		public static state_get_name(state: State): string;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ElementFactory} instead.
	 */
	interface IElementFactory {
		/**
		 * Checks if the factory can sink all possible capabilities.
		 * @param caps the caps to check
		 * @returns %TRUE if the caps are fully compatible.
		 */
		can_sink_all_caps(caps: Caps): boolean;
		/**
		 * Checks if the factory can sink any possible capability.
		 * @param caps the caps to check
		 * @returns %TRUE if the caps have a common subset.
		 */
		can_sink_any_caps(caps: Caps): boolean;
		/**
		 * Checks if the factory can src all possible capabilities.
		 * @param caps the caps to check
		 * @returns %TRUE if the caps are fully compatible.
		 */
		can_src_all_caps(caps: Caps): boolean;
		/**
		 * Checks if the factory can src any possible capability.
		 * @param caps the caps to check
		 * @returns %TRUE if the caps have a common subset.
		 */
		can_src_any_caps(caps: Caps): boolean;
		/**
		 * Create a new element of the type defined by the given elementfactory.
		 * It will be given the name supplied, since all elements require a name as
		 * their first argument.
		 * @param name name of new element, or %NULL to automatically create
		 *    a unique name
		 * @returns new {@link Element} or %NULL
		 *     if the element couldn't be created
		 */
		create(name?: string | null): Element | null;
		/**
		 * Get the #GType for elements managed by this factory. The type can
		 * only be retrieved if the element factory is loaded, which can be
		 * assured with {@link Gst.PluginFeature.load}.
		 * @returns the #GType for elements managed by this factory or 0 if
		 * the factory is not loaded.
		 */
		get_element_type(): GObject.Type;
		/**
		 * Get the metadata on #factory with #key.
		 * @param key a key
		 * @returns the metadata with #key on #factory or %NULL
		 * when there was no metadata with the given #key.
		 */
		get_metadata(key: string): string | null;
		/**
		 * Get the available keys for the metadata on #factory.
		 * @returns 
		 * a %NULL-terminated array of key strings, or %NULL when there is no
		 * metadata. Free with {@link G.strfreev} when no longer needed.
		 */
		get_metadata_keys(): string[] | null;
		/**
		 * Gets the number of pad_templates in this factory.
		 * @returns the number of pad_templates
		 */
		get_num_pad_templates(): number;
		/**
		 * Gets the #GList of {@link StaticPadTemplate} for this factory.
		 * @returns the
		 *     static pad templates
		 */
		get_static_pad_templates(): StaticPadTemplate[];
		/**
		 * Gets a %NULL-terminated array of protocols this element supports or %NULL if
		 * no protocols are supported. You may not change the contents of the returned
		 * array, as it is still owned by the element factory. Use {@link G.strdupv} to
		 * make a copy of the protocol string array if you need to.
		 * @returns the supported protocols
		 *     or %NULL
		 */
		get_uri_protocols(): string[];
		/**
		 * Gets the type of URIs the element supports or #GST_URI_UNKNOWN if none.
		 * @returns type of URIs this element supports
		 */
		get_uri_type(): URIType;
		/**
		 * Check if #factory implements the interface with name #interfacename.
		 * @param interfacename an interface name
		 * @returns %TRUE when #factory implement the interface.
		 */
		has_interface(interfacename: string): boolean;
		/**
		 * Check if #factory is of the given types.
		 * @param type a {@link ElementFactoryListType}
		 * @returns %TRUE if #factory is of #type.
		 */
		list_is_type(type: ElementFactoryListType): boolean;
	}

	type ElementFactoryInitOptionsMixin = PluginFeatureInitOptions
	export interface ElementFactoryInitOptions extends ElementFactoryInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ElementFactory} instead.
	 */
	type ElementFactoryMixin = IElementFactory & PluginFeature;

	/**
	 * {@link ElementFactory} is used to create instances of elements. A
	 * GstElementFactory can be added to a #GstPlugin as it is also a
	 * #GstPluginFeature.
	 * 
	 * Use the {@link Gst.ElementFactory.find} and gst_element_factory_create()
	 * functions to create element instances or use gst_element_factory_make() as a
	 * convenient shortcut.
	 * 
	 * The following code example shows you how to create a GstFileSrc element.
	 * 
	 * ## Using an element factory
	 * |[<!-- language="C" -->
	 *   #include &lt;gst/gst.h&gt;
	 * 
	 *   GstElement *src;
	 *   GstElementFactory *srcfactory;
	 * 
	 *   gst_init (&amp;argc, &amp;argv);
	 * 
	 *   srcfactory = gst_element_factory_find ("filesrc");
	 *   g_return_if_fail (srcfactory != NULL);
	 *   src = gst_element_factory_create (srcfactory, "src");
	 *   g_return_if_fail (src != NULL);
	 *   ...
	 * ]|
	 */
	interface ElementFactory extends ElementFactoryMixin {}

	class ElementFactory {
		public constructor(options?: Partial<ElementFactoryInitOptions>);
		/**
		 * Search for an element factory of the given name. Refs the returned
		 * element factory; caller is responsible for unreffing.
		 * @param name name of factory to find
		 * @returns {@link ElementFactory} if found,
		 * %NULL otherwise
		 */
		public static find(name: string): ElementFactory | null;
		/**
		 * Filter out all the elementfactories in #list that can handle #caps in
		 * the given direction.
		 * 
		 * If #subsetonly is %TRUE, then only the elements whose pads templates
		 * are a complete superset of #caps will be returned. Else any element
		 * whose pad templates caps can intersect with #caps will be returned.
		 * @param list a #GList of
		 *     {@link ElementFactory} to filter
		 * @param caps a {@link Caps}
		 * @param direction a {@link PadDirection} to filter on
		 * @param subsetonly whether to filter on caps subsets or not.
		 * @returns a #GList of
		 *     {@link ElementFactory} elements that match the given requisites.
		 *     Use #gst_plugin_feature_list_free after usage.
		 */
		public static list_filter(list: ElementFactory[], caps: Caps, direction: PadDirection, subsetonly: boolean): ElementFactory[];
		/**
		 * Get a list of factories that match the given #type. Only elements
		 * with a rank greater or equal to #minrank will be returned.
		 * The list of factories is returned by decreasing rank.
		 * @param type a {@link ElementFactoryListType}
		 * @param minrank Minimum rank
		 * @returns a #GList of
		 *     {@link ElementFactory} elements. Use {@link Gst.PluginFeature.list_free} after
		 *     usage.
		 */
		public static list_get_elements(type: ElementFactoryListType, minrank: Rank): ElementFactory[];
		/**
		 * Create a new element of the type defined by the given element factory.
		 * If name is %NULL, then the element will receive a guaranteed unique name,
		 * consisting of the element factory name and a number.
		 * If name is given, it will be given the name supplied.
		 * @param factoryname a named factory to instantiate
		 * @param name name of new element, or %NULL to automatically create
		 *    a unique name
		 * @returns new {@link Element} or %NULL
		 * if unable to create element
		 */
		public static make(factoryname: string, name?: string | null): Element | null;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link FlagSet} instead.
	 */
	interface IFlagSet {

	}

	type FlagSetInitOptionsMixin  = {};
	export interface FlagSetInitOptions extends FlagSetInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link FlagSet} instead.
	 */
	type FlagSetMixin = IFlagSet;

	/**
	 * A fundamental type that describes a 32-bit flag bitfield, with 32-bit
	 * mask indicating which of the bits in the field are explicitly set.
	 */
	interface FlagSet extends FlagSetMixin {}

	class FlagSet {
		public constructor(options?: Partial<FlagSetInitOptions>);
		/**
		 * Create a new sub-class of #GST_TYPE_FLAG_SET
		 * which will pretty-print the human-readable flags
		 * when serializing, for easier debugging.
		 * @param flags_type a #GType of a #G_TYPE_FLAGS type.
		 * @returns 
		 */
		public static register(flags_type: GObject.Type): GObject.Type;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Fraction} instead.
	 */
	interface IFraction {

	}

	type FractionInitOptionsMixin  = {};
	export interface FractionInitOptions extends FractionInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Fraction} instead.
	 */
	type FractionMixin = IFraction;

	/**
	 * A fundamental type that describes a fraction of an integer numerator
	 * over an integer denominator
	 */
	interface Fraction extends FractionMixin {}

	class Fraction {
		public constructor(options?: Partial<FractionInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link FractionRange} instead.
	 */
	interface IFractionRange {

	}

	type FractionRangeInitOptionsMixin  = {};
	export interface FractionRangeInitOptions extends FractionRangeInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link FractionRange} instead.
	 */
	type FractionRangeMixin = IFractionRange;

	/**
	 * A fundamental type that describes a {@link FractionRange} range
	 */
	interface FractionRange extends FractionRangeMixin {}

	class FractionRange {
		public constructor(options?: Partial<FractionRangeInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GhostPad} instead.
	 */
	interface IGhostPad {
		readonly pad: ProxyPad;
		/**
		 * @deprecated
		 * This function is deprecated since 1.18 and does nothing
		 * anymore.
		 * 
		 * Finish initialization of a newly allocated ghost pad.
		 * 
		 * This function is most useful in language bindings and when subclassing
		 * {@link GhostPad}; plugin and application developers normally will not call this
		 * function. Call this function directly after a call to g_object_new
		 * (GST_TYPE_GHOST_PAD, "direction", #dir, ..., NULL).
		 * @returns %TRUE if the construction succeeds, %FALSE otherwise.
		 */
		construct(): boolean;
		/**
		 * Get the target pad of #gpad. Unref target pad after usage.
		 * @returns the target {@link Pad}, can be
		 * %NULL if the ghostpad has no target set. Unref target pad after
		 * usage.
		 */
		get_target(): Pad | null;
		/**
		 * Set the new target of the ghostpad #gpad. Any existing target
		 * is unlinked and links to the new target are established. if #newtarget is
		 * %NULL the target will be cleared.
		 * @param newtarget the new pad target
		 * @returns %TRUE if the new target could be set. This function
		 *     can return %FALSE when the internal pads could not be linked.
		 */
		set_target(newtarget?: Pad | null): boolean;
		connect(signal: "notify::pad", callback: (owner: this, ...args: any) => void): number;

	}

	type GhostPadInitOptionsMixin = ProxyPadInitOptions
	export interface GhostPadInitOptions extends GhostPadInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link GhostPad} instead.
	 */
	type GhostPadMixin = IGhostPad & ProxyPad;

	/**
	 * GhostPads are useful when organizing pipelines with {@link Bin} like elements.
	 * The idea here is to create hierarchical element graphs. The bin element
	 * contains a sub-graph. Now one would like to treat the bin-element like any
	 * other #GstElement. This is where GhostPads come into play. A GhostPad acts as
	 * a proxy for another pad. Thus the bin can have sink and source ghost-pads
	 * that are associated with sink and source pads of the child elements.
	 * 
	 * If the target pad is known at creation time, {@link Gst.GhostPad.new} is the
	 * function to use to get a ghost-pad. Otherwise one can use gst_ghost_pad_new_no_target()
	 * to create the ghost-pad and use gst_ghost_pad_set_target() to establish the
	 * association later on.
	 * 
	 * Note that GhostPads add overhead to the data processing of a pipeline.
	 */
	interface GhostPad extends GhostPadMixin {}

	class GhostPad {
		public constructor(options?: Partial<GhostPadInitOptions>);
		/**
		 * Create a new ghostpad with #target as the target. The direction will be taken
		 * from the target pad. #target must be unlinked.
		 * 
		 * Will ref the target.
		 * @param name the name of the new pad, or %NULL to assign a default name
		 * @param target the pad to ghost.
		 * @returns a new {@link Pad}, or %NULL in
		 * case of an error.
		 */
		public static new(name: string | null, target: Pad): Pad | null;
		/**
		 * Create a new ghostpad with #target as the target. The direction will be taken
		 * from the target pad. The template used on the ghostpad will be #template.
		 * 
		 * Will ref the target.
		 * @param name the name of the new pad, or %NULL to assign a default name.
		 * @param target the pad to ghost.
		 * @param templ the {@link PadTemplate} to use on the ghostpad.
		 * @returns a new {@link Pad}, or %NULL in
		 * case of an error.
		 */
		public static new_from_template(name: string | null, target: Pad, templ: PadTemplate): Pad | null;
		/**
		 * Create a new ghostpad without a target with the given direction.
		 * A target can be set on the ghostpad later with the
		 * {@link Gst.GhostPad.set_target} function.
		 * 
		 * The created ghostpad will not have a padtemplate.
		 * @param name the name of the new pad, or %NULL to assign a default name.
		 * @param dir the direction of the ghostpad
		 * @returns a new {@link Pad}, or %NULL in
		 * case of an error.
		 */
		public static new_no_target(name: string | null, dir: PadDirection): Pad | null;
		/**
		 * Create a new ghostpad based on #templ, without setting a target. The
		 * direction will be taken from the #templ.
		 * @param name the name of the new pad, or %NULL to assign a default name
		 * @param templ the {@link PadTemplate} to create the ghostpad from.
		 * @returns a new {@link Pad}, or %NULL in
		 * case of an error.
		 */
		public static new_no_target_from_template(name: string | null, templ: PadTemplate): Pad | null;
		/**
		 * Invoke the default activate mode function of a ghost pad.
		 * @param pad the {@link Pad} to activate or deactivate.
		 * @param parent the parent of #pad or %NULL
		 * @param mode the requested activation mode
		 * @param active whether the pad should be active or not.
		 * @returns %TRUE if the operation was successful.
		 */
		public static activate_mode_default(pad: Pad, parent: Object | null, mode: PadMode, active: boolean): boolean;
		/**
		 * Invoke the default activate mode function of a proxy pad that is
		 * owned by a ghost pad.
		 * @param pad the {@link Pad} to activate or deactivate.
		 * @param parent the parent of #pad or %NULL
		 * @param mode the requested activation mode
		 * @param active whether the pad should be active or not.
		 * @returns %TRUE if the operation was successful.
		 */
		public static internal_activate_mode_default(pad: Pad, parent: Object | null, mode: PadMode, active: boolean): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Int64Range} instead.
	 */
	interface IInt64Range {

	}

	type Int64RangeInitOptionsMixin  = {};
	export interface Int64RangeInitOptions extends Int64RangeInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Int64Range} instead.
	 */
	type Int64RangeMixin = IInt64Range;

	/**
	 * A fundamental type that describes a #gint64 range
	 */
	interface Int64Range extends Int64RangeMixin {}

	class Int64Range {
		public constructor(options?: Partial<Int64RangeInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IntRange} instead.
	 */
	interface IIntRange {

	}

	type IntRangeInitOptionsMixin  = {};
	export interface IntRangeInitOptions extends IntRangeInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link IntRange} instead.
	 */
	type IntRangeMixin = IIntRange;

	/**
	 * A fundamental type that describes a #gint range
	 */
	interface IntRange extends IntRangeMixin {}

	class IntRange {
		public constructor(options?: Partial<IntRangeInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Object} instead.
	 */
	interface IObject {
		name: string;
		readonly object: GObject.InitiallyUnowned;
		/**
		 * object LOCK
		 */
		readonly lock: GLib.Mutex;
		/**
		 * The name of the object
		 */
		// readonly name: string;
		/**
		 * flags for this object
		 */
		readonly flags: number;
		/**
		 * Attach the {@link ControlBinding} to the object. If there already was a
		 * #GstControlBinding for this property it will be replaced.
		 * 
		 * The object's reference count will be incremented, and any floating
		 * reference will be removed (see {@link Gst.Object.ref_sink})
		 * @param binding the {@link ControlBinding} that should be used
		 * @returns %FALSE if the given #binding has not been setup for this object or
		 * has been setup for a non suitable property, %TRUE otherwise.
		 */
		add_control_binding(binding: ControlBinding): boolean;
		/**
		 * A default error function that uses {@link G.printerr} to display the error message
		 * and the optional debug string..
		 * 
		 * The default handler will simply print the error string using g_print.
		 * @param error the GError.
		 * @param debug an additional debug information string, or %NULL
		 */
		default_error(error: GLib.Error, debug?: string | null): void;
		/**
		 * Gets the corresponding {@link ControlBinding} for the property. This should be
		 * unreferenced again after use.
		 * @param property_name name of the property
		 * @returns the {@link ControlBinding} for
		 * #property_name or %NULL if the property is not controlled.
		 */
		get_control_binding(property_name: string): ControlBinding | null;
		/**
		 * Obtain the control-rate for this #object. Audio processing {@link Element}
		 * objects will use this rate to sub-divide their processing loop and call
		 * {@link Gst.Object.sync_values} in between. The length of the processing segment
		 * should be up to #control-rate nanoseconds.
		 * 
		 * If the #object is not under property control, this will return
		 * %GST_CLOCK_TIME_NONE. This allows the element to avoid the sub-dividing.
		 * 
		 * The control-rate is not expected to change if the element is in
		 * %GST_STATE_PAUSED or %GST_STATE_PLAYING.
		 * @returns the control rate in nanoseconds
		 */
		get_control_rate(): ClockTime;
		/**
		 * Gets a number of #GValues for the given controlled property starting at the
		 * requested time. The array #values need to hold enough space for #n_values of
		 * #GValue.
		 * 
		 * This function is useful if one wants to e.g. draw a graph of the control
		 * curve or apply a control curve sample by sample.
		 * @param property_name the name of the property to get
		 * @param timestamp the time that should be processed
		 * @param interval the time spacing between subsequent values
		 * @param values array to put control-values in
		 * @returns %TRUE if the given array could be filled, %FALSE otherwise
		 */
		get_g_value_array(property_name: string, timestamp: ClockTime, interval: ClockTime, values: GObject.Value[]): boolean;
		/**
		 * Returns a copy of the name of #object.
		 * Caller should {@link G.free} the return value after usage.
		 * For a nameless object, this returns %NULL, which you can safely g_free()
		 * as well.
		 * 
		 * Free-function: g_free
		 * @returns the name of #object. {@link G.free}
		 * after usage.
		 * 
		 * MT safe. This function grabs and releases #object's LOCK.
		 */
		get_name(): string | null;
		/**
		 * Returns the parent of #object. This function increases the refcount
		 * of the parent object so you should {@link Gst.Object.unref} it after usage.
		 * @returns parent of #object, this can be
		 *   %NULL if #object has no parent. unref after usage.
		 * 
		 * MT safe. Grabs and releases #object's LOCK.
		 */
		get_parent(): Object | null;
		/**
		 * Generates a string describing the path of #object in
		 * the object hierarchy. Only useful (or used) for debugging.
		 * 
		 * Free-function: g_free
		 * @returns a string describing the path of #object. You must
		 *          {@link G.free} the string after usage.
		 * 
		 * MT safe. Grabs and releases the {@link Object}'s LOCK for all objects
		 *          in the hierarchy.
		 */
		get_path_string(): string;
		/**
		 * Gets the value for the given controlled property at the requested time.
		 * @param property_name the name of the property to get
		 * @param timestamp the time the control-change should be read from
		 * @returns the GValue of the property at the given time,
		 * or %NULL if the property isn't controlled.
		 */
		get_value(property_name: string, timestamp: ClockTime): GObject.Value | null;
		/**
		 * Gets a number of values for the given controlled property starting at the
		 * requested time. The array #values need to hold enough space for #n_values of
		 * the same type as the objects property's type.
		 * 
		 * This function is useful if one wants to e.g. draw a graph of the control
		 * curve or apply a control curve sample by sample.
		 * 
		 * The values are unboxed and ready to be used. The similar function
		 * {@link Gst.Object.get_g_value_array} returns the array as #GValues and is
		 * better suites for bindings.
		 * @param property_name the name of the property to get
		 * @param timestamp the time that should be processed
		 * @param interval the time spacing between subsequent values
		 * @param n_values the number of values
		 * @param values array to put control-values in
		 * @returns %TRUE if the given array could be filled, %FALSE otherwise
		 */
		get_value_array(property_name: string, timestamp: ClockTime, interval: ClockTime, n_values: number, values?: any | null): boolean;
		/**
		 * Check if the #object has active controlled properties.
		 * @returns %TRUE if the object has active controlled properties
		 */
		has_active_control_bindings(): boolean;
		/**
		 * @deprecated
		 * Use {@link Gst.Object.has_as_ancestor} instead.
		 * 
		 * MT safe. Grabs and releases #object's locks.
		 * 
		 * Check if #object has an ancestor #ancestor somewhere up in
		 * the hierarchy. One can e.g. check if a {@link Element} is inside a #GstPipeline.
		 * @param ancestor a {@link Object} to check as ancestor
		 * @returns %TRUE if #ancestor is an ancestor of #object.
		 */
		has_ancestor(ancestor: Object): boolean;
		/**
		 * Check if #object has an ancestor #ancestor somewhere up in
		 * the hierarchy. One can e.g. check if a {@link Element} is inside a #GstPipeline.
		 * @param ancestor a {@link Object} to check as ancestor
		 * @returns %TRUE if #ancestor is an ancestor of #object.
		 * 
		 * MT safe. Grabs and releases #object's locks.
		 */
		has_as_ancestor(ancestor: Object): boolean;
		/**
		 * Check if #parent is the parent of #object.
		 * E.g. a {@link Element} can check if it owns a given #GstPad.
		 * @param parent a {@link Object} to check as parent
		 * @returns %FALSE if either #object or #parent is %NULL. %TRUE if #parent is
		 *          the parent of #object. Otherwise %FALSE.
		 * 
		 * MT safe. Grabs and releases #object's locks.
		 */
		has_as_parent(parent: Object): boolean;
		/**
		 * Increments the reference count on #object. This function
		 * does not take the lock on #object because it relies on
		 * atomic refcounting.
		 * 
		 * This object returns the input parameter to ease writing
		 * constructs like :
		 *  result = gst_object_ref (object->parent);
		 * @returns A pointer to #object
		 */
		ref(): Object;
		/**
		 * Removes the corresponding {@link ControlBinding}. If it was the
		 * last ref of the binding, it will be disposed.
		 * @param binding the binding
		 * @returns %TRUE if the binding could be removed.
		 */
		remove_control_binding(binding: ControlBinding): boolean;
		/**
		 * This function is used to disable the control bindings on a property for
		 * some time, i.e. {@link Gst.Object.sync_values} will do nothing for the
		 * property.
		 * @param property_name property to disable
		 * @param disabled boolean that specifies whether to disable the controller
		 * or not.
		 */
		set_control_binding_disabled(property_name: string, disabled: boolean): void;
		/**
		 * This function is used to disable all controlled properties of the #object for
		 * some time, i.e. {@link Gst.Object.sync_values} will do nothing.
		 * @param disabled boolean that specifies whether to disable the controller
		 * or not.
		 */
		set_control_bindings_disabled(disabled: boolean): void;
		/**
		 * Change the control-rate for this #object. Audio processing {@link Element}
		 * objects will use this rate to sub-divide their processing loop and call
		 * {@link Gst.Object.sync_values} in between. The length of the processing segment
		 * should be up to #control-rate nanoseconds.
		 * 
		 * The control-rate should not change if the element is in %GST_STATE_PAUSED or
		 * %GST_STATE_PLAYING.
		 * @param control_rate the new control-rate in nanoseconds.
		 */
		set_control_rate(control_rate: ClockTime): void;
		/**
		 * Sets the name of #object, or gives #object a guaranteed unique
		 * name (if #name is %NULL).
		 * This function makes a copy of the provided name, so the caller
		 * retains ownership of the name it sent.
		 * @param name new name of object
		 * @returns %TRUE if the name could be set. Since Objects that have
		 * a parent cannot be renamed, this function returns %FALSE in those
		 * cases.
		 * 
		 * MT safe.  This function grabs and releases #object's LOCK.
		 */
		set_name(name?: string | null): boolean;
		/**
		 * Sets the parent of #object to #parent. The object's reference count will
		 * be incremented, and any floating reference will be removed (see {@link Gst.Object.ref_sink}).
		 * @param parent new parent of object
		 * @returns %TRUE if #parent could be set or %FALSE when #object
		 * already had a parent or #object and #parent are the same.
		 * 
		 * MT safe. Grabs and releases #object's LOCK.
		 */
		set_parent(parent: Object): boolean;
		/**
		 * Returns a suggestion for timestamps where buffers should be split
		 * to get best controller results.
		 * @returns Returns the suggested timestamp or %GST_CLOCK_TIME_NONE
		 * if no control-rate was set.
		 */
		suggest_next_sync(): ClockTime;
		/**
		 * Sets the properties of the object, according to the {@link ControlSources} that
		 * (maybe) handle them and for the given timestamp.
		 * 
		 * If this function fails, it is most likely the application developers fault.
		 * Most probably the control sources are not setup correctly.
		 * @param timestamp the time that should be processed
		 * @returns %TRUE if the controller values could be applied to the object
		 * properties, %FALSE otherwise
		 */
		sync_values(timestamp: ClockTime): boolean;
		/**
		 * Clear the parent of #object, removing the associated reference.
		 * This function decreases the refcount of #object.
		 * 
		 * MT safe. Grabs and releases #object's lock.
		 */
		unparent(): void;
		/**
		 * Decrements the reference count on #object.  If reference count hits
		 * zero, destroy #object. This function does not take the lock
		 * on #object as it relies on atomic refcounting.
		 * 
		 * The unref method should never be called with the LOCK held since
		 * this might deadlock the dispose function.
		 */
		unref(): void;
		/**
		 * The deep notify signal is used to be notified of property changes. It is
		 * typically attached to the toplevel bin to receive notifications from all
		 * the elements contained in that bin.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - prop_object: the object that originated the signal 
		 *  - prop: the property that changed 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "deep-notify", callback: (owner: this, prop_object: Object, prop: GObject.ParamSpec) => void): number;

		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::lock", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::flags", callback: (owner: this, ...args: any) => void): number;

	}

	type ObjectInitOptionsMixin = GObject.InitiallyUnownedInitOptions & 
	Pick<IObject,
		"name">;

	export interface ObjectInitOptions extends ObjectInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Object} instead.
	 */
	type ObjectMixin = IObject & GObject.InitiallyUnowned;

	/**
	 * {@link Object} provides a root for the object hierarchy tree filed in by the
	 * GStreamer library.  It is currently a thin wrapper on top of
	 * #GInitiallyUnowned. It is an abstract class that is not very usable on its own.
	 * 
	 * #GstObject gives us basic refcounting, parenting functionality and locking.
	 * Most of the functions are just extended for special GStreamer needs and can be
	 * found under the same name in the base class of #GstObject which is #GObject
	 * (e.g. {@link GObject.ref} becomes gst_object_ref()).
	 * 
	 * Since #GstObject derives from #GInitiallyUnowned, it also inherits the
	 * floating reference. Be aware that functions such as gst_bin_add() and
	 * gst_element_add_pad() take ownership of the floating reference.
	 * 
	 * In contrast to #GObject instances, #GstObject adds a name property. The functions
	 * gst_object_set_name() and gst_object_get_name() are used to set/get the name
	 * of the object.
	 * 
	 * ## controlled properties
	 * 
	 * Controlled properties offers a lightweight way to adjust gobject properties
	 * over stream-time. It works by using time-stamped value pairs that are queued
	 * for element-properties. At run-time the elements continuously pull value
	 * changes for the current stream-time.
	 * 
	 * What needs to be changed in a #GstElement?
	 * Very little - it is just two steps to make a plugin controllable!
	 * 
	 *   * mark gobject-properties paramspecs that make sense to be controlled,
	 *     by GST_PARAM_CONTROLLABLE.
	 * 
	 *   * when processing data (get, chain, loop function) at the beginning call
	 *     gst_object_sync_values(element,timestamp).
	 *     This will make the controller update all GObject properties that are
	 *     under its control with the current values based on the timestamp.
	 * 
	 * What needs to be done in applications? Again it's not a lot to change.
	 * 
	 *   * create a #GstControlSource.
	 *     csource = gst_interpolation_control_source_new ();
	 *     g_object_set (csource, "mode", GST_INTERPOLATION_MODE_LINEAR, NULL);
	 * 
	 *   * Attach the #GstControlSource on the controller to a property.
	 *     gst_object_add_control_binding (object, gst_direct_control_binding_new (object, "prop1", csource));
	 * 
	 *   * Set the control values
	 *     gst_timed_value_control_source_set ((GstTimedValueControlSource *)csource,0 * GST_SECOND, value1);
	 *     gst_timed_value_control_source_set ((GstTimedValueControlSource *)csource,1 * GST_SECOND, value2);
	 * 
	 *   * start your pipeline
	 */
	interface Object extends ObjectMixin {}

	class Object {
		public constructor(options?: Partial<ObjectInitOptions>);
		/**
		 * Checks to see if there is any object named #name in #list. This function
		 * does not do any locking of any kind. You might want to protect the
		 * provided list with the lock of the owner of the list. This function
		 * will lock each {@link Object} in the list to compare the name, so be
		 * careful when passing a list with a locked object.
		 * @param list a list of {@link Object} to
		 *      check through
		 * @param name the name to search for
		 * @returns %TRUE if a {@link Object} named #name does not appear in #list,
		 * %FALSE if it does.
		 * 
		 * MT safe. Grabs and releases the LOCK of each object in the list.
		 */
		public static check_uniqueness(list: Object[], name: string): boolean;
		/**
		 * A default deep_notify signal callback for an object. The user data
		 * should contain a pointer to an array of strings that should be excluded
		 * from the notify. The default handler will print the new value of the property
		 * using g_print.
		 * 
		 * MT safe. This function grabs and releases #object's LOCK for getting its
		 *          path string.
		 * @param object the #GObject that signalled the notify.
		 * @param orig a {@link Object} that initiated the notify.
		 * @param pspec a #GParamSpec of the property.
		 * @param excluded_props 
		 *     a set of user-specified properties to exclude or %NULL to show
		 *     all changes.
		 */
		public static default_deep_notify(object: GObject.Object, orig: Object, pspec: GObject.ParamSpec, excluded_props?: string[] | null): void;
		/**
		 * Increase the reference count of #object, and possibly remove the floating
		 * reference, if #object has a floating reference.
		 * 
		 * In other words, if the object is floating, then this call "assumes ownership"
		 * of the floating reference, converting it to a normal reference by clearing
		 * the floating flag while leaving the reference count unchanged. If the object
		 * is not floating, then this call adds a new normal reference increasing the
		 * reference count by one.
		 * 
		 * For more background on "floating references" please see the #GObject
		 * documentation.
		 * @param object a {@link Object} to sink
		 * @returns 
		 */
		public static ref_sink(object?: any | null): any | null;
		/**
		 * Atomically modifies a pointer to point to a new object.
		 * The reference count of #oldobj is decreased and the reference count of
		 * #newobj is increased.
		 * 
		 * Either #newobj and the value pointed to by #oldobj may be %NULL.
		 * @param newobj a new {@link Object}
		 * @returns %TRUE if #newobj was different from #oldobj
		 */
		public static replace(newobj?: Object | null): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Pad} instead.
	 */
	interface IPad {
		readonly caps: Caps;
		direction: PadDirection;
		/**
		 * The offset that will be applied to the running time of the pad.
		 */
		offset: number;
		template: PadTemplate;
		readonly object: Object;
		/**
		 * private data owned by the parent element
		 */
		readonly element_private: any;
		/**
		 * padtemplate for this pad
		 */
		readonly padtemplate: PadTemplate;
		/**
		 * the direction of the pad, cannot change after creating
		 *             the pad.
		 */
		// readonly direction: PadDirection;
		/**
		 * Activates or deactivates the given pad in #mode via dispatching to the
		 * pad's activatemodefunc. For use from within pad activation functions only.
		 * 
		 * If you don't know what this is, you probably don't want to call it.
		 * @param mode the requested activation mode
		 * @param active whether or not the pad should be active.
		 * @returns %TRUE if the operation was successful.
		 * 
		 * MT safe.
		 */
		activate_mode(mode: PadMode, active: boolean): boolean;
		/**
		 * Be notified of different states of pads. The provided callback is called for
		 * every state that matches #mask.
		 * 
		 * Probes are called in groups: First GST_PAD_PROBE_TYPE_BLOCK probes are
		 * called, then others, then finally GST_PAD_PROBE_TYPE_IDLE. The only
		 * exception here are GST_PAD_PROBE_TYPE_IDLE probes that are called
		 * immediately if the pad is already idle while calling {@link Gst.Pad.add_probe}.
		 * In each of the groups, probes are called in the order in which they were
		 * added.
		 * @param mask the probe mask
		 * @param callback {@link PadProbeCallback} that will be called with notifications of
		 *           the pad state
		 * @returns an id or 0 if no probe is pending. The id can be used to remove the
		 * probe with {@link Gst.Pad.remove_probe}. When using GST_PAD_PROBE_TYPE_IDLE it can
		 * happen that the probe can be run immediately and if the probe returns
		 * GST_PAD_PROBE_REMOVE this functions returns 0.
		 * 
		 * MT safe.
		 */
		add_probe(mask: PadProbeType, callback: PadProbeCallback): number;
		/**
		 * Checks if the source pad and the sink pad are compatible so they can be
		 * linked.
		 * @param sinkpad the sink {@link Pad}.
		 * @returns %TRUE if the pads can be linked.
		 */
		can_link(sinkpad: Pad): boolean;
		/**
		 * Chain a buffer to #pad.
		 * 
		 * The function returns #GST_FLOW_FLUSHING if the pad was flushing.
		 * 
		 * If the buffer type is not acceptable for #pad (as negotiated with a
		 * preceding GST_EVENT_CAPS event), this function returns
		 * #GST_FLOW_NOT_NEGOTIATED.
		 * 
		 * The function proceeds calling the chain function installed on #pad (see
		 * {@link Gst.Pad.set_chain_function}) and the return value of that function is
		 * returned to the caller. #GST_FLOW_NOT_SUPPORTED is returned if #pad has no
		 * chain function.
		 * 
		 * In all cases, success or failure, the caller loses its reference to #buffer
		 * after calling this function.
		 * @param buffer the {@link Buffer} to send, return GST_FLOW_ERROR
		 *     if not.
		 * @returns a {@link FlowReturn} from the pad.
		 * 
		 * MT safe.
		 */
		chain(buffer: Buffer): FlowReturn;
		/**
		 * Chain a bufferlist to #pad.
		 * 
		 * The function returns #GST_FLOW_FLUSHING if the pad was flushing.
		 * 
		 * If #pad was not negotiated properly with a CAPS event, this function
		 * returns #GST_FLOW_NOT_NEGOTIATED.
		 * 
		 * The function proceeds calling the chainlist function installed on #pad (see
		 * {@link Gst.Pad.set_chain_list_function}) and the return value of that function is
		 * returned to the caller. #GST_FLOW_NOT_SUPPORTED is returned if #pad has no
		 * chainlist function.
		 * 
		 * In all cases, success or failure, the caller loses its reference to #list
		 * after calling this function.
		 * 
		 * MT safe.
		 * @param list the {@link BufferList} to send, return GST_FLOW_ERROR
		 *     if not.
		 * @returns a {@link FlowReturn} from the pad.
		 */
		chain_list(list: BufferList): FlowReturn;
		/**
		 * Check and clear the #GST_PAD_FLAG_NEED_RECONFIGURE flag on #pad and return %TRUE
		 * if the flag was set.
		 * @returns %TRUE is the GST_PAD_FLAG_NEED_RECONFIGURE flag was set on #pad.
		 */
		check_reconfigure(): boolean;
		/**
		 * Creates a stream-id for the source {@link Pad} #pad by combining the
		 * upstream information with the optional #stream_id of the stream
		 * of #pad. #pad must have a parent #GstElement and which must have zero
		 * or one sinkpad. #stream_id can only be %NULL if the parent element
		 * of #pad has only a single source pad.
		 * 
		 * This function generates an unique stream-id by getting the upstream
		 * stream-start event stream ID and appending #stream_id to it. If the
		 * element has no sinkpad it will generate an upstream stream-id by
		 * doing an URI query on the element and in the worst case just uses
		 * a random number. Source elements that don't implement the URI
		 * handler interface should ideally generate a unique, deterministic
		 * stream-id manually instead.
		 * 
		 * Since stream IDs are sorted alphabetically, any numbers in the
		 * stream ID should be printed with a fixed number of characters,
		 * preceded by 0's, such as by using the format \%03u instead of \%u.
		 * @param parent Parent {@link Element} of #pad
		 * @param stream_id The stream-id
		 * @returns A stream-id for #pad. {@link G.free} after usage.
		 */
		create_stream_id(parent: Element, stream_id?: string | null): string;
		/**
		 * Creates a stream-id for the source {@link Pad} #pad by combining the
		 * upstream information with the optional #stream_id of the stream
		 * of #pad. #pad must have a parent #GstElement and which must have zero
		 * or one sinkpad. #stream_id can only be %NULL if the parent element
		 * of #pad has only a single source pad.
		 * 
		 * This function generates an unique stream-id by getting the upstream
		 * stream-start event stream ID and appending #stream_id to it. If the
		 * element has no sinkpad it will generate an upstream stream-id by
		 * doing an URI query on the element and in the worst case just uses
		 * a random number. Source elements that don't implement the URI
		 * handler interface should ideally generate a unique, deterministic
		 * stream-id manually instead.
		 * @param parent Parent {@link Element} of #pad
		 * @param stream_id The stream-id
		 * @returns A stream-id for #pad. {@link G.free} after usage.
		 */
		create_stream_id_printf(parent: Element, stream_id?: string | null): string;
		/**
		 * Creates a stream-id for the source {@link Pad} #pad by combining the
		 * upstream information with the optional #stream_id of the stream
		 * of #pad. #pad must have a parent #GstElement and which must have zero
		 * or one sinkpad. #stream_id can only be %NULL if the parent element
		 * of #pad has only a single source pad.
		 * 
		 * This function generates an unique stream-id by getting the upstream
		 * stream-start event stream ID and appending #stream_id to it. If the
		 * element has no sinkpad it will generate an upstream stream-id by
		 * doing an URI query on the element and in the worst case just uses
		 * a random number. Source elements that don't implement the URI
		 * handler interface should ideally generate a unique, deterministic
		 * stream-id manually instead.
		 * @param parent Parent {@link Element} of #pad
		 * @param stream_id The stream-id
		 * @param var_args parameters for the #stream_id format string
		 * @returns A stream-id for #pad. {@link G.free} after usage.
		 */
		create_stream_id_printf_valist(parent: Element, stream_id: string | null, var_args: any[]): string;
		/**
		 * Invokes the default event handler for the given pad.
		 * 
		 * The EOS event will pause the task associated with #pad before it is forwarded
		 * to all internally linked pads,
		 * 
		 * The event is sent to all pads internally linked to #pad. This function
		 * takes ownership of #event.
		 * @param parent the parent of #pad or %NULL
		 * @param event the {@link Event} to handle.
		 * @returns %TRUE if the event was sent successfully.
		 */
		event_default(parent: Object | null, event: Event): boolean;
		/**
		 * Calls #forward for all internally linked pads of #pad. This function deals with
		 * dynamically changing internal pads and will make sure that the #forward
		 * function is only called once for each pad.
		 * 
		 * When #forward returns %TRUE, no further pads will be processed.
		 * @param forward a {@link PadForwardFunction}
		 * @returns %TRUE if one of the dispatcher functions returned %TRUE.
		 */
		forward(forward: PadForwardFunction): boolean;
		/**
		 * Gets the capabilities of the allowed media types that can flow through
		 * #pad and its peer.
		 * 
		 * The allowed capabilities is calculated as the intersection of the results of
		 * calling {@link Gst.Pad.query_caps} on #pad and its peer. The caller owns a reference
		 * on the resulting caps.
		 * @returns the allowed {@link Caps} of the
		 *     pad link. Unref the caps when you no longer need it. This
		 *     function returns %NULL when #pad has no peer.
		 * 
		 * MT safe.
		 */
		get_allowed_caps(): Caps | null;
		/**
		 * Gets the capabilities currently configured on #pad with the last
		 * #GST_EVENT_CAPS event.
		 * @returns the current caps of the pad with
		 * incremented ref-count or %NULL when pad has no caps. Unref after usage.
		 */
		get_current_caps(): Caps | null;
		/**
		 * Gets the direction of the pad. The direction of the pad is
		 * decided at construction time so this function does not take
		 * the LOCK.
		 * @returns the {@link PadDirection} of the pad.
		 * 
		 * MT safe.
		 */
		get_direction(): PadDirection;
		/**
		 * Gets the private data of a pad.
		 * No locking is performed in this function.
		 * @returns a #gpointer to the private data.
		 */
		get_element_private(): any | null;
		/**
		 * Gets the {@link FlowReturn} return from the last data passed by this pad.
		 * @returns 
		 */
		get_last_flow_return(): FlowReturn;
		/**
		 * Get the offset applied to the running time of #pad. #pad has to be a source
		 * pad.
		 * @returns the offset.
		 */
		get_offset(): number;
		/**
		 * Gets the template for #pad.
		 * @returns the {@link PadTemplate} from which
		 *     this pad was instantiated, or %NULL if this pad has no
		 *     template. Unref after usage.
		 */
		get_pad_template(): PadTemplate | null;
		/**
		 * Gets the capabilities for #pad's template.
		 * @returns the {@link Caps} of this pad template.
		 * Unref after usage.
		 */
		get_pad_template_caps(): Caps;
		/**
		 * Gets the parent of #pad, cast to a {@link Element}. If a #pad has no parent or
		 * its parent is not an element, return %NULL.
		 * @returns the parent of the pad. The
		 * caller has a reference on the parent, so unref when you're finished
		 * with it.
		 * 
		 * MT safe.
		 */
		get_parent_element(): Element | null;
		/**
		 * Gets the peer of #pad. This function refs the peer pad so
		 * you need to unref it after use.
		 * @returns the peer {@link Pad}. Unref after usage.
		 * 
		 * MT safe.
		 */
		get_peer(): Pad | null;
		/**
		 * When #pad is flushing this function returns #GST_FLOW_FLUSHING
		 * immediately and #buffer is %NULL.
		 * 
		 * Calls the getrange function of #pad, see {@link PadGetRangeFunction} for a
		 * description of a getrange function. If #pad has no getrange function
		 * installed (see {@link Gst.Pad.set_getrange_function}) this function returns
		 * #GST_FLOW_NOT_SUPPORTED.
		 * 
		 * If #buffer points to a variable holding %NULL, a valid new #GstBuffer will be
		 * placed in #buffer when this function returns #GST_FLOW_OK. The new buffer
		 * must be freed with gst_buffer_unref() after usage.
		 * 
		 * When #buffer points to a variable that points to a valid #GstBuffer, the
		 * buffer will be filled with the result data when this function returns
		 * #GST_FLOW_OK. If the provided buffer is larger than #size, only
		 * #size bytes will be filled in the result buffer and its size will be updated
		 * accordingly.
		 * 
		 * Note that less than #size bytes can be returned in #buffer when, for example,
		 * an EOS condition is near or when #buffer is not large enough to hold #size
		 * bytes. The caller should check the result buffer size to get the result size.
		 * 
		 * When this function returns any other result value than #GST_FLOW_OK, #buffer
		 * will be unchanged.
		 * 
		 * This is a lowlevel function. Usually gst_pad_pull_range() is used.
		 * @param offset The start offset of the buffer
		 * @param size The length of the buffer
		 * @returns a {@link FlowReturn} from the pad.
		 * 
		 * MT safe.
		 * 
		 * a pointer to hold the #GstBuffer,
		 *     returns #GST_FLOW_ERROR if %NULL.
		 */
		get_range(offset: number, size: number): [ FlowReturn, Buffer ];
		/**
		 * If there is a single internal link of the given pad, this function will
		 * return it. Otherwise, it will return NULL.
		 * @returns a {@link Pad}, or %NULL if #pad has none
		 * or more than one internal links. Unref returned pad with
		 * {@link Gst.Object.unref}.
		 */
		get_single_internal_link(): Pad | null;
		/**
		 * Returns a new reference of the sticky event of type #event_type
		 * from the event.
		 * @param event_type the {@link EventType} that should be retrieved.
		 * @param idx the index of the event
		 * @returns a {@link Event} of type
		 * #event_type or %NULL when no event of #event_type was on
		 * #pad. Unref after usage.
		 */
		get_sticky_event(event_type: EventType, idx: number): Event | null;
		/**
		 * Returns the current {@link Stream} for the #pad, or %NULL if none has been
		 * set yet, i.e. the pad has not received a stream-start event yet.
		 * 
		 * This is a convenience wrapper around {@link Gst.Pad.get_sticky_event} and
		 * gst_event_parse_stream().
		 * @returns the current {@link Stream} for #pad, or %NULL.
		 *     unref the returned stream when no longer needed.
		 */
		get_stream(): Stream | null;
		/**
		 * Returns the current stream-id for the #pad, or %NULL if none has been
		 * set yet, i.e. the pad has not received a stream-start event yet.
		 * 
		 * This is a convenience wrapper around {@link Gst.Pad.get_sticky_event} and
		 * gst_event_parse_stream_start().
		 * 
		 * The returned stream-id string should be treated as an opaque string, its
		 * contents should not be interpreted.
		 * @returns a newly-allocated copy of the stream-id for
		 *     #pad, or %NULL.  {@link G.free} the returned string when no longer
		 *     needed.
		 */
		get_stream_id(): string | null;
		/**
		 * Get #pad task state. If no task is currently
		 * set, #GST_TASK_STOPPED is returned.
		 * @returns The current state of #pad's task.
		 */
		get_task_state(): TaskState;
		/**
		 * Check if #pad has caps set on it with a #GST_EVENT_CAPS event.
		 * @returns %TRUE when #pad has caps associated with it.
		 */
		has_current_caps(): boolean;
		/**
		 * Query if a pad is active
		 * @returns %TRUE if the pad is active.
		 * 
		 * MT safe.
		 */
		is_active(): boolean;
		/**
		 * Checks if the pad is blocked or not. This function returns the
		 * last requested state of the pad. It is not certain that the pad
		 * is actually blocking at this point (see {@link Gst.Pad.is_blocking}).
		 * @returns %TRUE if the pad is blocked.
		 * 
		 * MT safe.
		 */
		is_blocked(): boolean;
		/**
		 * Checks if the pad is blocking or not. This is a guaranteed state
		 * of whether the pad is actually blocking on a {@link Buffer} or a #GstEvent.
		 * @returns %TRUE if the pad is blocking.
		 * 
		 * MT safe.
		 */
		is_blocking(): boolean;
		/**
		 * Checks if a #pad is linked to another pad or not.
		 * @returns %TRUE if the pad is linked, %FALSE otherwise.
		 * 
		 * MT safe.
		 */
		is_linked(): boolean;
		/**
		 * Gets an iterator for the pads to which the given pad is linked to inside
		 * of the parent element.
		 * 
		 * Each {@link Pad} element yielded by the iterator will have its refcount increased,
		 * so unref after use.
		 * 
		 * Free-function: gst_iterator_free
		 * @returns a new {@link Iterator} of #GstPad
		 *     or %NULL when the pad does not have an iterator function
		 *     configured. Use {@link Gst.Iterator.free} after usage.
		 */
		iterate_internal_links(): Iterator | null;
		/**
		 * Iterate the list of pads to which the given pad is linked to inside of
		 * the parent element.
		 * This is the default handler, and thus returns an iterator of all of the
		 * pads inside the parent element with opposite direction.
		 * 
		 * The caller must free this iterator after use with {@link Gst.Iterator.free}.
		 * @param parent the parent of #pad or %NULL
		 * @returns a {@link Iterator} of #GstPad, or %NULL if #pad
		 * has no parent. Unref each returned pad with {@link Gst.Object.unref}.
		 */
		iterate_internal_links_default(parent?: Object | null): Iterator | null;
		/**
		 * Links the source pad and the sink pad.
		 * @param sinkpad the sink {@link Pad} to link.
		 * @returns A result code indicating if the connection worked or
		 *          what went wrong.
		 * 
		 * MT Safe.
		 */
		link(sinkpad: Pad): PadLinkReturn;
		/**
		 * Links the source pad and the sink pad.
		 * 
		 * This variant of #gst_pad_link provides a more granular control on the
		 * checks being done when linking. While providing some considerable speedups
		 * the caller of this method must be aware that wrong usage of those flags
		 * can cause severe issues. Refer to the documentation of {@link PadLinkCheck}
		 * for more information.
		 * 
		 * MT Safe.
		 * @param sinkpad the sink {@link Pad} to link.
		 * @param flags the checks to validate when linking
		 * @returns A result code indicating if the connection worked or
		 *          what went wrong.
		 */
		link_full(sinkpad: Pad, flags: PadLinkCheck): PadLinkReturn;
		/**
		 * Links #src to #sink, creating any {@link GhostPad}'s in between as necessary.
		 * 
		 * This is a convenience function to save having to create and add intermediate
		 * #GstGhostPad's as required for linking across #GstBin boundaries.
		 * 
		 * If #src or #sink pads don't have parent elements or do not share a common
		 * ancestor, the link will fail.
		 * @param sink a {@link Pad}
		 * @returns whether the link succeeded.
		 */
		link_maybe_ghosting(sink: Pad): boolean;
		/**
		 * Links #src to #sink, creating any {@link GhostPad}'s in between as necessary.
		 * 
		 * This is a convenience function to save having to create and add intermediate
		 * #GstGhostPad's as required for linking across #GstBin boundaries.
		 * 
		 * If #src or #sink pads don't have parent elements or do not share a common
		 * ancestor, the link will fail.
		 * 
		 * Calling {@link Gst.Pad.link_maybe_ghosting_full} with
		 * #flags == %GST_PAD_LINK_CHECK_DEFAULT is the recommended way of linking
		 * pads with safety checks applied.
		 * @param sink a {@link Pad}
		 * @param flags some {@link PadLinkCheck} flags
		 * @returns whether the link succeeded.
		 */
		link_maybe_ghosting_full(sink: Pad, flags: PadLinkCheck): boolean;
		/**
		 * Mark a pad for needing reconfiguration. The next call to
		 * {@link Gst.Pad.check_reconfigure} will return %TRUE after this call.
		 */
		mark_reconfigure(): void;
		/**
		 * Check the #GST_PAD_FLAG_NEED_RECONFIGURE flag on #pad and return %TRUE
		 * if the flag was set.
		 * @returns %TRUE is the GST_PAD_FLAG_NEED_RECONFIGURE flag is set on #pad.
		 */
		needs_reconfigure(): boolean;
		/**
		 * Pause the task of #pad. This function will also wait until the
		 * function executed by the task is finished if this function is not
		 * called from the task function.
		 * @returns a %TRUE if the task could be paused or %FALSE when the pad
		 * has no task.
		 */
		pause_task(): boolean;
		/**
		 * Performs {@link Gst.Pad.query} on the peer of #pad.
		 * 
		 * The caller is responsible for both the allocation and deallocation of
		 * the query structure.
		 * @param query the {@link Query} to perform.
		 * @returns %TRUE if the query could be performed. This function returns %FALSE
		 * if #pad has no peer.
		 */
		peer_query(query: Query): boolean;
		/**
		 * Check if the peer of #pad accepts #caps. If #pad has no peer, this function
		 * returns %TRUE.
		 * @param caps a {@link Caps} to check on the pad
		 * @returns %TRUE if the peer of #pad can accept the caps or #pad has no peer.
		 */
		peer_query_accept_caps(caps: Caps): boolean;
		/**
		 * Gets the capabilities of the peer connected to this pad. Similar to
		 * {@link Gst.Pad.query_caps}.
		 * 
		 * When called on srcpads #filter contains the caps that
		 * upstream could produce in the order preferred by upstream. When
		 * called on sinkpads #filter contains the caps accepted by
		 * downstream in the preferred order. #filter might be %NULL but
		 * if it is not %NULL the returned caps will be a subset of #filter.
		 * @param filter a {@link Caps} filter, or %NULL.
		 * @returns the caps of the peer pad with incremented
		 * ref-count. When there is no peer pad, this function returns #filter or,
		 * when #filter is %NULL, ANY caps.
		 */
		peer_query_caps(filter?: Caps | null): Caps;
		/**
		 * Queries the peer pad of a given sink pad to convert #src_val in #src_format
		 * to #dest_format.
		 * @param src_format a {@link Format} to convert from.
		 * @param src_val a value to convert.
		 * @param dest_format the {@link Format} to convert to.
		 * @returns %TRUE if the query could be performed.
		 * 
		 * a pointer to the result.
		 */
		peer_query_convert(src_format: Format, src_val: number, dest_format: Format): [ boolean, number ];
		/**
		 * Queries the peer pad of a given sink pad for the total stream duration.
		 * @param format the {@link Format} requested
		 * @returns %TRUE if the query could be performed.
		 * 
		 * a location in which to store the total
		 *     duration, or %NULL.
		 */
		peer_query_duration(format: Format): [ boolean, number | null ];
		/**
		 * Queries the peer of a given sink pad for the stream position.
		 * @param format the {@link Format} requested
		 * @returns %TRUE if the query could be performed.
		 * 
		 * a location in which to store the current
		 *     position, or %NULL.
		 */
		peer_query_position(format: Format): [ boolean, number | null ];
		/**
		 * Checks if all internally linked pads of #pad accepts the caps in #query and
		 * returns the intersection of the results.
		 * 
		 * This function is useful as a default accept caps query function for an element
		 * that can handle any stream format, but requires caps that are acceptable for
		 * all opposite pads.
		 * @param query an ACCEPT_CAPS {@link Query}.
		 * @returns %TRUE if #query could be executed
		 */
		proxy_query_accept_caps(query: Query): boolean;
		/**
		 * Calls {@link Gst.Pad.query_caps} for all internally linked pads of #pad and returns
		 * the intersection of the results.
		 * 
		 * This function is useful as a default caps query function for an element
		 * that can handle any stream format, but requires all its pads to have
		 * the same caps.  Two such elements are tee and adder.
		 * @param query a CAPS {@link Query}.
		 * @returns %TRUE if #query could be executed
		 */
		proxy_query_caps(query: Query): boolean;
		/**
		 * Pulls a #buffer from the peer pad or fills up a provided buffer.
		 * 
		 * This function will first trigger the pad block signal if it was
		 * installed.
		 * 
		 * When #pad is not linked #GST_FLOW_NOT_LINKED is returned else this
		 * function returns the result of {@link Gst.Pad.get_range} on the peer pad.
		 * See gst_pad_get_range() for a list of return values and for the
		 * semantics of the arguments of this function.
		 * 
		 * If #buffer points to a variable holding %NULL, a valid new {@link Buffer} will be
		 * placed in #buffer when this function returns #GST_FLOW_OK. The new buffer
		 * must be freed with gst_buffer_unref() after usage. When this function
		 * returns any other result value, #buffer will still point to %NULL.
		 * 
		 * When #buffer points to a variable that points to a valid #GstBuffer, the
		 * buffer will be filled with the result data when this function returns
		 * #GST_FLOW_OK. When this function returns any other result value,
		 * #buffer will be unchanged. If the provided buffer is larger than #size, only
		 * #size bytes will be filled in the result buffer and its size will be updated
		 * accordingly.
		 * 
		 * Note that less than #size bytes can be returned in #buffer when, for example,
		 * an EOS condition is near or when #buffer is not large enough to hold #size
		 * bytes. The caller should check the result buffer size to get the result size.
		 * @param offset The start offset of the buffer
		 * @param size The length of the buffer
		 * @returns a {@link FlowReturn} from the peer pad.
		 * 
		 * MT safe.
		 * 
		 * a pointer to hold the #GstBuffer, returns
		 *     GST_FLOW_ERROR if %NULL.
		 */
		pull_range(offset: number, size: number): [ FlowReturn, Buffer ];
		/**
		 * Pushes a buffer to the peer of #pad.
		 * 
		 * This function will call installed block probes before triggering any
		 * installed data probes.
		 * 
		 * The function proceeds calling {@link Gst.Pad.chain} on the peer pad and returns
		 * the value from that function. If #pad has no peer, #GST_FLOW_NOT_LINKED will
		 * be returned.
		 * 
		 * In all cases, success or failure, the caller loses its reference to #buffer
		 * after calling this function.
		 * @param buffer the {@link Buffer} to push returns GST_FLOW_ERROR
		 *     if not.
		 * @returns a {@link FlowReturn} from the peer pad.
		 * 
		 * MT safe.
		 */
		push(buffer: Buffer): FlowReturn;
		/**
		 * Sends the event to the peer of the given pad. This function is
		 * mainly used by elements to send events to their peer
		 * elements.
		 * 
		 * This function takes ownership of the provided event so you should
		 * {@link Gst.Event.ref} it if you want to reuse the event after this call.
		 * @param event the {@link Event} to send to the pad.
		 * @returns %TRUE if the event was handled.
		 * 
		 * MT safe.
		 */
		push_event(event: Event): boolean;
		/**
		 * Pushes a buffer list to the peer of #pad.
		 * 
		 * This function will call installed block probes before triggering any
		 * installed data probes.
		 * 
		 * The function proceeds calling the chain function on the peer pad and returns
		 * the value from that function. If #pad has no peer, #GST_FLOW_NOT_LINKED will
		 * be returned. If the peer pad does not have any installed chainlist function
		 * every group buffer of the list will be merged into a normal {@link Buffer} and
		 * chained via {@link Gst.Pad.chain}.
		 * 
		 * In all cases, success or failure, the caller loses its reference to #list
		 * after calling this function.
		 * @param list the {@link BufferList} to push returns GST_FLOW_ERROR
		 *     if not.
		 * @returns a {@link FlowReturn} from the peer pad.
		 * 
		 * MT safe.
		 */
		push_list(list: BufferList): FlowReturn;
		/**
		 * Dispatches a query to a pad. The query should have been allocated by the
		 * caller via one of the type-specific allocation functions. The element that
		 * the pad belongs to is responsible for filling the query with an appropriate
		 * response, which should then be parsed with a type-specific query parsing
		 * function.
		 * 
		 * Again, the caller is responsible for both the allocation and deallocation of
		 * the query structure.
		 * 
		 * Please also note that some queries might need a running pipeline to work.
		 * @param query the {@link Query} to perform.
		 * @returns %TRUE if the query could be performed.
		 */
		query(query: Query): boolean;
		/**
		 * Check if the given pad accepts the caps.
		 * @param caps a {@link Caps} to check on the pad
		 * @returns %TRUE if the pad can accept the caps.
		 */
		query_accept_caps(caps: Caps): boolean;
		/**
		 * Gets the capabilities this pad can produce or consume.
		 * Note that this method doesn't necessarily return the caps set by sending a
		 * {@link Gst.Event.new_caps} - use gst_pad_get_current_caps() for that instead.
		 * gst_pad_query_caps returns all possible caps a pad can operate with, using
		 * the pad's CAPS query function, If the query fails, this function will return
		 * #filter, if not %NULL, otherwise ANY.
		 * 
		 * When called on sinkpads #filter contains the caps that
		 * upstream could produce in the order preferred by upstream. When
		 * called on srcpads #filter contains the caps accepted by
		 * downstream in the preferred order. #filter might be %NULL but
		 * if it is not %NULL the returned caps will be a subset of #filter.
		 * 
		 * Note that this function does not return writable {@link Caps}, use
		 * gst_caps_make_writable() before modifying the caps.
		 * @param filter suggested {@link Caps}, or %NULL
		 * @returns the caps of the pad with incremented ref-count.
		 */
		query_caps(filter?: Caps | null): Caps;
		/**
		 * Queries a pad to convert #src_val in #src_format to #dest_format.
		 * @param src_format a {@link Format} to convert from.
		 * @param src_val a value to convert.
		 * @param dest_format the {@link Format} to convert to.
		 * @returns %TRUE if the query could be performed.
		 * 
		 * a pointer to the result.
		 */
		query_convert(src_format: Format, src_val: number, dest_format: Format): [ boolean, number ];
		/**
		 * Invokes the default query handler for the given pad.
		 * The query is sent to all pads internally linked to #pad. Note that
		 * if there are many possible sink pads that are internally linked to
		 * #pad, only one will be sent the query.
		 * Multi-sinkpad elements should implement custom query handlers.
		 * @param parent the parent of #pad or %NULL
		 * @param query the {@link Query} to handle.
		 * @returns %TRUE if the query was performed successfully.
		 */
		query_default(parent: Object | null, query: Query): boolean;
		/**
		 * Queries a pad for the total stream duration.
		 * @param format the {@link Format} requested
		 * @returns %TRUE if the query could be performed.
		 * 
		 * a location in which to store the total
		 *     duration, or %NULL.
		 */
		query_duration(format: Format): [ boolean, number | null ];
		/**
		 * Queries a pad for the stream position.
		 * @param format the {@link Format} requested
		 * @returns %TRUE if the query could be performed.
		 * 
		 * A location in which to store the current position, or %NULL.
		 */
		query_position(format: Format): [ boolean, number | null ];
		/**
		 * Remove the probe with #id from #pad.
		 * 
		 * MT safe.
		 * @param id the probe id to remove
		 */
		remove_probe(id: number): void;
		/**
		 * Sends the event to the pad. This function can be used
		 * by applications to send events in the pipeline.
		 * 
		 * If #pad is a source pad, #event should be an upstream event. If #pad is a
		 * sink pad, #event should be a downstream event. For example, you would not
		 * send a #GST_EVENT_EOS on a src pad; EOS events only propagate downstream.
		 * Furthermore, some downstream events have to be serialized with data flow,
		 * like EOS, while some can travel out-of-band, like #GST_EVENT_FLUSH_START. If
		 * the event needs to be serialized with data flow, this function will take the
		 * pad's stream lock while calling its event function.
		 * 
		 * To find out whether an event type is upstream, downstream, or downstream and
		 * serialized, see {@link EventTypeFlags}, {@link Gst.event.type_get_flags},
		 * #GST_EVENT_IS_UPSTREAM, #GST_EVENT_IS_DOWNSTREAM, and
		 * #GST_EVENT_IS_SERIALIZED. Note that in practice that an application or
		 * plugin doesn't need to bother itself with this information; the core handles
		 * all necessary locks and checks.
		 * 
		 * This function takes ownership of the provided event so you should
		 * gst_event_ref() it if you want to reuse the event after this call.
		 * @param event the {@link Event} to send to the pad.
		 * @returns %TRUE if the event was handled.
		 */
		send_event(event: Event): boolean;
		/**
		 * Sets the given activate function for #pad. The activate function will
		 * dispatch to {@link Gst.Pad.activate_mode} to perform the actual activation.
		 * Only makes sense to set on sink pads.
		 * 
		 * Call this function if your sink pad can start a pull-based task.
		 * @param activate the {@link PadActivateFunction} to set.
		 */
		set_activate_function_full(activate: PadActivateFunction): void;
		/**
		 * Sets the given activate_mode function for the pad. An activate_mode function
		 * prepares the element for data passing.
		 * @param activatemode the {@link PadActivateModeFunction} to set.
		 */
		set_activatemode_function_full(activatemode: PadActivateModeFunction): void;
		/**
		 * Activates or deactivates the given pad.
		 * Normally called from within core state change functions.
		 * 
		 * If #active, makes sure the pad is active. If it is already active, either in
		 * push or pull mode, just return. Otherwise dispatches to the pad's activate
		 * function to perform the actual activation.
		 * 
		 * If not #active, calls {@link Gst.Pad.activate_mode} with the pad's current mode
		 * and a %FALSE argument.
		 * @param active whether or not the pad should be active.
		 * @returns %TRUE if the operation was successful.
		 * 
		 * MT safe.
		 */
		set_active(active: boolean): boolean;
		/**
		 * Sets the given chain function for the pad. The chain function is called to
		 * process a {@link Buffer} input buffer. see #GstPadChainFunction for more details.
		 * @param chain the {@link PadChainFunction} to set.
		 */
		set_chain_function_full(chain: PadChainFunction): void;
		/**
		 * Sets the given chain list function for the pad. The chainlist function is
		 * called to process a {@link BufferList} input buffer list. See
		 * #GstPadChainListFunction for more details.
		 * @param chainlist the {@link PadChainListFunction} to set.
		 */
		set_chain_list_function_full(chainlist: PadChainListFunction): void;
		/**
		 * Set the given private data gpointer on the pad.
		 * This function can only be used by the element that owns the pad.
		 * No locking is performed in this function.
		 * @param priv The private data to attach to the pad.
		 */
		set_element_private(priv?: any | null): void;
		/**
		 * Sets the given event handler for the pad.
		 * @param event the {@link PadEventFullFunction} to set.
		 */
		set_event_full_function_full(event: PadEventFullFunction): void;
		/**
		 * Sets the given event handler for the pad.
		 * @param event the {@link PadEventFunction} to set.
		 */
		set_event_function_full(event: PadEventFunction): void;
		/**
		 * Sets the given getrange function for the pad. The getrange function is
		 * called to produce a new {@link Buffer} to start the processing pipeline. see
		 * #GstPadGetRangeFunction for a description of the getrange function.
		 * @param get the {@link PadGetRangeFunction} to set.
		 */
		set_getrange_function_full(get: PadGetRangeFunction): void;
		/**
		 * Sets the given internal link iterator function for the pad.
		 * @param iterintlink the {@link PadIterIntLinkFunction} to set.
		 */
		set_iterate_internal_links_function_full(iterintlink: PadIterIntLinkFunction): void;
		/**
		 * Sets the given link function for the pad. It will be called when
		 * the pad is linked with another pad.
		 * 
		 * The return value #GST_PAD_LINK_OK should be used when the connection can be
		 * made.
		 * 
		 * The return value #GST_PAD_LINK_REFUSED should be used when the connection
		 * cannot be made for some reason.
		 * 
		 * If #link is installed on a source pad, it should call the {@link PadLinkFunction}
		 * of the peer sink pad, if present.
		 * @param link the {@link PadLinkFunction} to set.
		 */
		set_link_function_full(link: PadLinkFunction): void;
		/**
		 * Set the offset that will be applied to the running time of #pad.
		 * @param offset the offset
		 */
		set_offset(offset: number): void;
		/**
		 * Set the given query function for the pad.
		 * @param query the {@link PadQueryFunction} to set.
		 */
		set_query_function_full(query: PadQueryFunction): void;
		/**
		 * Sets the given unlink function for the pad. It will be called
		 * when the pad is unlinked.
		 * 
		 * Note that the pad's lock is already held when the unlink
		 * function is called, so most pad functions cannot be called
		 * from within the callback.
		 * @param unlink the {@link PadUnlinkFunction} to set.
		 */
		set_unlink_function_full(unlink: PadUnlinkFunction): void;
		/**
		 * Starts a task that repeatedly calls #func with #user_data. This function
		 * is mostly used in pad activation functions to start the dataflow.
		 * The #GST_PAD_STREAM_LOCK of #pad will automatically be acquired
		 * before #func is called.
		 * @param func the task function to call
		 * @returns a %TRUE if the task could be started.
		 */
		start_task(func: TaskFunction): boolean;
		/**
		 * Iterates all sticky events on #pad and calls #foreach_func for every
		 * event. If #foreach_func returns %FALSE the iteration is immediately stopped.
		 * @param foreach_func the {@link PadStickyEventsForeachFunction} that
		 *                should be called for every event.
		 */
		sticky_events_foreach(foreach_func: PadStickyEventsForeachFunction): void;
		/**
		 * Stop the task of #pad. This function will also make sure that the
		 * function executed by the task will effectively stop if not called
		 * from the GstTaskFunction.
		 * 
		 * This function will deadlock if called from the GstTaskFunction of
		 * the task. Use {@link Gst.Task.pause} instead.
		 * 
		 * Regardless of whether the pad has a task, the stream lock is acquired and
		 * released so as to ensure that streaming through this pad has finished.
		 * @returns a %TRUE if the task could be stopped or %FALSE on error.
		 */
		stop_task(): boolean;
		/**
		 * Store the sticky #event on #pad
		 * @param event a {@link Event}
		 * @returns #GST_FLOW_OK on success, #GST_FLOW_FLUSHING when the pad
		 * was flushing or #GST_FLOW_EOS when the pad was EOS.
		 */
		store_sticky_event(event: Event): FlowReturn;
		/**
		 * Unlinks the source pad from the sink pad. Will emit the {@link Pad.unlinked}
		 * signal on both pads.
		 * @param sinkpad the sink {@link Pad} to unlink.
		 * @returns %TRUE if the pads were unlinked. This function returns %FALSE if
		 * the pads were not linked together.
		 * 
		 * MT safe.
		 */
		unlink(sinkpad: Pad): boolean;
		/**
		 * A helper function you can use that sets the FIXED_CAPS flag
		 * This way the default CAPS query will always return the negotiated caps
		 * or in case the pad is not negotiated, the padtemplate caps.
		 * 
		 * The negotiated caps are the caps of the last CAPS event that passed on the
		 * pad. Use this function on a pad that, once it negotiated to a CAPS, cannot
		 * be renegotiated to something else.
		 */
		use_fixed_caps(): void;
		/**
		 * Signals that a pad has been linked to the peer pad.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - peer: the peer pad that has been connected 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "linked", callback: (owner: this, peer: Pad) => void): number;
		/**
		 * Signals that a pad has been unlinked from the peer pad.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - peer: the peer pad that has been disconnected 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "unlinked", callback: (owner: this, peer: Pad) => void): number;

		connect(signal: "notify::caps", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::direction", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::offset", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::template", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::element_private", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::padtemplate", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::direction", callback: (owner: this, ...args: any) => void): number;

	}

	type PadInitOptionsMixin = ObjectInitOptions & 
	Pick<IPad,
		"direction" |
		"offset" |
		"template">;

	export interface PadInitOptions extends PadInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Pad} instead.
	 */
	type PadMixin = IPad & Object;

	/**
	 * A {@link Element} is linked to other elements via "pads", which are extremely
	 * light-weight generic link points.
	 * 
	 * Pads have a #GstPadDirection, source pads produce data, sink pads consume
	 * data.
	 * 
	 * Pads are typically created from a #GstPadTemplate with
	 * {@link Gst.Pad.new_from_template} and are then added to a #GstElement. This usually
	 * happens when the element is created but it can also happen dynamically based
	 * on the data that the element is processing or based on the pads that the
	 * application requests.
	 * 
	 * Pads without pad templates can be created with gst_pad_new(),
	 * which takes a direction and a name as an argument.  If the name is %NULL,
	 * then a guaranteed unique name will be assigned to it.
	 * 
	 * A #GstElement creating a pad will typically use the various
	 * gst_pad_set_*_function\() calls to register callbacks for events, queries or
	 * dataflow on the pads.
	 * 
	 * gst_pad_get_parent() will retrieve the #GstElement that owns the pad.
	 * 
	 * After two pads are retrieved from an element by gst_element_get_static_pad(),
	 * the pads can be linked with gst_pad_link(). (For quick links,
	 * you can also use gst_element_link(), which will make the obvious
	 * link for you if it's straightforward.). Pads can be unlinked again with
	 * gst_pad_unlink(). gst_pad_get_peer() can be used to check what the pad is
	 * linked to.
	 * 
	 * Before dataflow is possible on the pads, they need to be activated with
	 * gst_pad_set_active().
	 * 
	 * gst_pad_query() and gst_pad_peer_query() can be used to query various
	 * properties of the pad and the stream.
	 * 
	 * To send a #GstEvent on a pad, use gst_pad_send_event() and
	 * gst_pad_push_event(). Some events will be sticky on the pad, meaning that
	 * after they pass on the pad they can be queried later with
	 * gst_pad_get_sticky_event() and gst_pad_sticky_events_foreach().
	 * gst_pad_get_current_caps() and gst_pad_has_current_caps() are convenience
	 * functions to query the current sticky CAPS event on a pad.
	 * 
	 * GstElements will use gst_pad_push() and gst_pad_pull_range() to push out
	 * or pull in a buffer.
	 * 
	 * The dataflow, events and queries that happen on a pad can be monitored with
	 * probes that can be installed with gst_pad_add_probe(). gst_pad_is_blocked()
	 * can be used to check if a block probe is installed on the pad.
	 * gst_pad_is_blocking() checks if the blocking probe is currently blocking the
	 * pad. gst_pad_remove_probe() is used to remove a previously installed probe
	 * and unblock blocking probes if any.
	 * 
	 * Pad have an offset that can be retrieved with gst_pad_get_offset(). This
	 * offset will be applied to the running_time of all data passing over the pad.
	 * gst_pad_set_offset() can be used to change the offset.
	 * 
	 * Convenience functions exist to start, pause and stop the task on a pad with
	 * gst_pad_start_task(), gst_pad_pause_task() and gst_pad_stop_task()
	 * respectively.
	 */
	interface Pad extends PadMixin {}

	class Pad {
		public constructor(options?: Partial<PadInitOptions>);
		/**
		 * Creates a new pad with the given name in the given direction.
		 * If name is %NULL, a guaranteed unique name (across all pads)
		 * will be assigned.
		 * This function makes a copy of the name so you can safely free the name.
		 * @param name the name of the new pad.
		 * @param direction the {@link PadDirection} of the pad.
		 * @returns a new {@link Pad}.
		 * 
		 * MT safe.
		 */
		public static new(name: string | null, direction: PadDirection): Pad;
		/**
		 * Creates a new pad with the given name from the given static template.
		 * If name is %NULL, a guaranteed unique name (across all pads)
		 * will be assigned.
		 * This function makes a copy of the name so you can safely free the name.
		 * @param templ the {@link StaticPadTemplate} to use
		 * @param name the name of the pad
		 * @returns a new {@link Pad}.
		 */
		public static new_from_static_template(templ: StaticPadTemplate, name: string): Pad;
		/**
		 * Creates a new pad with the given name from the given template.
		 * If name is %NULL, a guaranteed unique name (across all pads)
		 * will be assigned.
		 * This function makes a copy of the name so you can safely free the name.
		 * @param templ the pad template to use
		 * @param name the name of the pad
		 * @returns a new {@link Pad}.
		 */
		public static new_from_template(templ: PadTemplate, name?: string | null): Pad;
		/**
		 * Gets a string representing the given pad-link return.
		 * @param ret a {@link PadLinkReturn} to get the name of.
		 * @returns a static string with the name of the pad-link return.
		 */
		public static link_get_name(ret: PadLinkReturn): string;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PadTemplate} instead.
	 */
	interface IPadTemplate {
		/**
		 * The capabilities of the pad described by the pad template.
		 */
		caps: Caps;
		/**
		 * The direction of the pad described by the pad template.
		 */
		direction: PadDirection;
		/**
		 * The type of the pad described by the pad template.
		 */
		gtype: GObject.Type;
		/**
		 * The name template of the pad template.
		 */
		name_template: string;
		/**
		 * When the pad described by the pad template will become available.
		 */
		presence: PadPresence;
		readonly object: Object;
		// readonly name_template: string;
		// readonly direction: PadDirection;
		// readonly presence: PadPresence;
		// readonly caps: Caps;
		/**
		 * Gets the capabilities of the pad template.
		 * @returns the {@link Caps} of the pad template.
		 * Unref after usage.
		 */
		get_caps(): Caps;
		/**
		 * See {@link Gst.PadTemplate.set_documentation_caps}.
		 * @returns The caps to document. For convenience, this will return
		 *   {@link Gst.PadTemplate.get_caps} when no documentation caps were set.
		 */
		get_documentation_caps(): Caps;
		/**
		 * Emit the pad-created signal for this template when created by this pad.
		 * @param pad the {@link Pad} that created it
		 */
		pad_created(pad: Pad): void;
		/**
		 * Certain elements will dynamically construct the caps of their
		 * pad templates. In order not to let environment-specific information
		 * into the documentation, element authors should use this method to
		 * expose "stable" caps to the reader.
		 * @param caps the documented capabilities
		 */
		set_documentation_caps(caps: Caps): void;
		/**
		 * This signal is fired when an element creates a pad from this template.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - pad: the pad that was created. 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "pad-created", callback: (owner: this, pad: Pad) => void): number;

		connect(signal: "notify::caps", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::direction", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::gtype", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name-template", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::presence", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name_template", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::direction", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::presence", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::caps", callback: (owner: this, ...args: any) => void): number;

	}

	type PadTemplateInitOptionsMixin = ObjectInitOptions & 
	Pick<IPadTemplate,
		"caps" |
		"direction" |
		"gtype" |
		"name_template" |
		"presence">;

	export interface PadTemplateInitOptions extends PadTemplateInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PadTemplate} instead.
	 */
	type PadTemplateMixin = IPadTemplate & Object;

	/**
	 * Padtemplates describe the possible media types a pad or an elementfactory can
	 * handle. This allows for both inspection of handled types before loading the
	 * element plugin as well as identifying pads on elements that are not yet
	 * created (request or sometimes pads).
	 * 
	 * Pad and PadTemplates have {@link Caps} attached to it to describe the media type
	 * they are capable of dealing with. {@link Gst.PadTemplate.get_caps} or
	 * GST_PAD_TEMPLATE_CAPS() are used to get the caps of a padtemplate. It's not
	 * possible to modify the caps of a padtemplate after creation.
	 * 
	 * PadTemplates have a #GstPadPresence property which identifies the lifetime
	 * of the pad and that can be retrieved with GST_PAD_TEMPLATE_PRESENCE(). Also
	 * the direction of the pad can be retrieved from the #GstPadTemplate with
	 * GST_PAD_TEMPLATE_DIRECTION().
	 * 
	 * The GST_PAD_TEMPLATE_NAME_TEMPLATE () is important for GST_PAD_REQUEST pads
	 * because it has to be used as the name in the gst_element_get_request_pad()
	 * call to instantiate a pad from this template.
	 * 
	 * Padtemplates can be created with gst_pad_template_new() or with
	 * gst_static_pad_template_get (), which creates a #GstPadTemplate from a
	 * #GstStaticPadTemplate that can be filled with the
	 * convenient GST_STATIC_PAD_TEMPLATE() macro.
	 * 
	 * A padtemplate can be used to create a pad (see gst_pad_new_from_template()
	 * or gst_pad_new_from_static_template ()) or to add to an element class
	 * (see gst_element_class_add_static_pad_template ()).
	 * 
	 * The following code example shows the code to create a pad from a padtemplate.
	 * |[<!-- language="C" -->
	 *   GstStaticPadTemplate my_template =
	 *   GST_STATIC_PAD_TEMPLATE (
	 *     "sink",          // the name of the pad
	 *     GST_PAD_SINK,    // the direction of the pad
	 *     GST_PAD_ALWAYS,  // when this pad will be present
	 *     GST_STATIC_CAPS (        // the capabilities of the padtemplate
	 *       "audio/x-raw, "
	 *         "channels = (int) [ 1, 6 ]"
	 *     )
	 *   );
	 *   void
	 *   my_method (void)
	 *   {
	 *     GstPad *pad;
	 *     pad = gst_pad_new_from_static_template (&amp;my_template, "sink");
	 *     ...
	 *   }
	 * ]|
	 * 
	 * The following example shows you how to add the padtemplate to an
	 * element class, this is usually done in the class_init of the class:
	 * |[<!-- language="C" -->
	 *   static void
	 *   my_element_class_init (GstMyElementClass *klass)
	 *   {
	 *     GstElementClass *gstelement_class = GST_ELEMENT_CLASS (klass);
	 * 
	 *     gst_element_class_add_static_pad_template (gstelement_class, &amp;my_template);
	 *   }
	 * ]|
	 */
	interface PadTemplate extends PadTemplateMixin {}

	class PadTemplate {
		public constructor(options?: Partial<PadTemplateInitOptions>);
		/**
		 * Creates a new pad template with a name according to the given template
		 * and with the given arguments.
		 * @param name_template the name template.
		 * @param direction the {@link PadDirection} of the template.
		 * @param presence the {@link PadPresence} of the pad.
		 * @param caps a {@link Caps} set for the template.
		 * @returns a new {@link PadTemplate}.
		 */
		public static new(name_template: string, direction: PadDirection, presence: PadPresence, caps: Caps): PadTemplate | null;
		/**
		 * Converts a {@link StaticPadTemplate} into a #GstPadTemplate with a type.
		 * @param pad_template the static pad template
		 * @param pad_type The #GType of the pad to create
		 * @returns a new {@link PadTemplate}.
		 */
		public static new_from_static_pad_template_with_gtype(pad_template: StaticPadTemplate, pad_type: GObject.Type): PadTemplate | null;
		/**
		 * Creates a new pad template with a name according to the given template
		 * and with the given arguments.
		 * @param name_template the name template.
		 * @param direction the {@link PadDirection} of the template.
		 * @param presence the {@link PadPresence} of the pad.
		 * @param caps a {@link Caps} set for the template.
		 * @param pad_type The #GType of the pad to create
		 * @returns a new {@link PadTemplate}.
		 */
		public static new_with_gtype(name_template: string, direction: PadDirection, presence: PadPresence, caps: Caps, pad_type: GObject.Type): PadTemplate | null;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamArray} instead.
	 */
	interface IParamArray {

	}

	type ParamArrayInitOptionsMixin = GObject.ParamSpecInitOptions
	export interface ParamArrayInitOptions extends ParamArrayInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamArray} instead.
	 */
	type ParamArrayMixin = IParamArray & GObject.ParamSpec;

	/**
	 * A fundamental type that describes a #GParamSpec for arrays of
	 * values
	 */
	interface ParamArray extends ParamArrayMixin {}

	class ParamArray {
		public constructor(options?: Partial<ParamArrayInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamFraction} instead.
	 */
	interface IParamFraction {

	}

	type ParamFractionInitOptionsMixin = GObject.ParamSpecInitOptions
	export interface ParamFractionInitOptions extends ParamFractionInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ParamFraction} instead.
	 */
	type ParamFractionMixin = IParamFraction & GObject.ParamSpec;

	/**
	 * A fundamental type that describes a #GParamSpec for fractional
	 * properties
	 */
	interface ParamFraction extends ParamFractionMixin {}

	class ParamFraction {
		public constructor(options?: Partial<ParamFractionInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Pipeline} instead.
	 */
	interface IPipeline {
		/**
		 * Whether or not to automatically flush all messages on the
		 * pipeline's bus when going from READY to NULL state. Please see
		 * {@link Gst.Pipeline.set_auto_flush_bus} for more information on this option.
		 */
		auto_flush_bus: boolean;
		/**
		 * The expected delay needed for elements to spin up to the
		 * PLAYING state expressed in nanoseconds.
		 * see {@link Gst.Pipeline.set_delay} for more information on this option.
		 */
		delay: number;
		/**
		 * Latency to configure on the pipeline. See {@link Gst.Pipeline.set_latency}.
		 */
		latency: number;
		readonly bin: Bin;
		/**
		 * The fixed clock of the pipeline, used when
		 *               GST_PIPELINE_FLAG_FIXED_CLOCK is set.
		 */
		readonly fixed_clock: Clock;
		/**
		 * The stream time of the pipeline. A better name for this
		 *         property would be the running_time, the total time spent in the
		 *         PLAYING state without being flushed. (deprecated, use the start_time
		 *         on GstElement).
		 */
		readonly stream_time: ClockTime;
		/**
		 * Extra delay added to base_time to compensate for computing delays
		 *         when setting elements to PLAYING.
		 */
		// readonly delay: ClockTime;
		/**
		 * Let #pipeline select a clock automatically. This is the default
		 * behaviour.
		 * 
		 * Use this function if you previous forced a fixed clock with
		 * {@link Gst.Pipeline.use_clock} and want to restore the default
		 * pipeline clock selection algorithm.
		 * 
		 * MT safe.
		 */
		auto_clock(): void;
		/**
		 * Check if #pipeline will automatically flush messages when going to
		 * the NULL state.
		 * @returns whether the pipeline will automatically flush its bus when
		 * going from READY to NULL state or not.
		 * 
		 * MT safe.
		 */
		get_auto_flush_bus(): boolean;
		/**
		 * Gets the {@link Bus} of #pipeline. The bus allows applications to receive
		 * #GstMessage packets.
		 * @returns a {@link Bus}, unref after usage.
		 * 
		 * MT safe.
		 */
		get_bus(): Bus;
		/**
		 * Gets the current clock used by #pipeline. Users of object
		 * oriented languages should use {@link Gst.Pipeline.get_pipeline_clock}
		 * to avoid confusion with gst_element_get_clock() which has a different behavior.
		 * 
		 * Unlike gst_element_get_clock(), this function will always return a
		 * clock, even if the pipeline is not in the PLAYING state.
		 * @returns a {@link Clock}, unref after usage.
		 */
		get_clock(): Clock;
		/**
		 * Get the configured delay (see {@link Gst.Pipeline.set_delay}).
		 * @returns The configured delay.
		 * 
		 * MT safe.
		 */
		get_delay(): ClockTime;
		/**
		 * Gets the latency that should be configured on the pipeline. See
		 * {@link Gst.Pipeline.set_latency}.
		 * @returns Latency to configure on the pipeline or GST_CLOCK_TIME_NONE
		 */
		get_latency(): ClockTime;
		/**
		 * Gets the current clock used by #pipeline.
		 * 
		 * Unlike {@link Gst.Element.get_clock}, this function will always return a
		 * clock, even if the pipeline is not in the PLAYING state.
		 * @returns a {@link Clock}, unref after usage.
		 */
		get_pipeline_clock(): Clock;
		/**
		 * Usually, when a pipeline goes from READY to NULL state, it automatically
		 * flushes all pending messages on the bus, which is done for refcounting
		 * purposes, to break circular references.
		 * 
		 * This means that applications that update state using (async) bus messages
		 * (e.g. do certain things when a pipeline goes from PAUSED to READY) might
		 * not get to see messages when the pipeline is shut down, because they might
		 * be flushed before they can be dispatched in the main thread. This behaviour
		 * can be disabled using this function.
		 * 
		 * It is important that all messages on the bus are handled when the
		 * automatic flushing is disabled else memory leaks will be introduced.
		 * 
		 * MT safe.
		 * @param auto_flush whether or not to automatically flush the bus when
		 * the pipeline goes from READY to NULL state
		 */
		set_auto_flush_bus(auto_flush: boolean): void;
		/**
		 * Set the clock for #pipeline. The clock will be distributed
		 * to all the elements managed by the pipeline.
		 * @param clock the clock to set
		 * @returns %TRUE if the clock could be set on the pipeline. %FALSE if
		 *   some element did not accept the clock.
		 * 
		 * MT safe.
		 */
		set_clock(clock: Clock): boolean;
		/**
		 * Set the expected delay needed for all elements to perform the
		 * PAUSED to PLAYING state change. #delay will be added to the
		 * base time of the elements so that they wait an additional #delay
		 * amount of time before starting to process buffers and cannot be
		 * #GST_CLOCK_TIME_NONE.
		 * 
		 * This option is used for tuning purposes and should normally not be
		 * used.
		 * 
		 * MT safe.
		 * @param delay the delay
		 */
		set_delay(delay: ClockTime): void;
		/**
		 * Sets the latency that should be configured on the pipeline. Setting
		 * GST_CLOCK_TIME_NONE will restore the default behaviour of using the minimum
		 * latency from the LATENCY query. Setting this is usually not required and
		 * the pipeline will figure out an appropriate latency automatically.
		 * 
		 * Setting a too low latency, especially lower than the minimum latency from
		 * the LATENCY query, will most likely cause the pipeline to fail.
		 * @param latency latency to configure
		 */
		set_latency(latency: ClockTime): void;
		/**
		 * Force #pipeline to use the given #clock. The pipeline will
		 * always use the given clock even if new clock providers are added
		 * to this pipeline.
		 * 
		 * If #clock is %NULL all clocking will be disabled which will make
		 * the pipeline run as fast as possible.
		 * 
		 * MT safe.
		 * @param clock the clock to use
		 */
		use_clock(clock?: Clock | null): void;
		connect(signal: "notify::auto-flush-bus", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::delay", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::latency", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::bin", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::fixed_clock", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::stream_time", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::delay", callback: (owner: this, ...args: any) => void): number;

	}

	type PipelineInitOptionsMixin = BinInitOptions & ChildProxyInitOptions & 
	Pick<IPipeline,
		"auto_flush_bus" |
		"delay" |
		"latency">;

	export interface PipelineInitOptions extends PipelineInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Pipeline} instead.
	 */
	type PipelineMixin = IPipeline & Bin & ChildProxy;

	/**
	 * A {@link Pipeline} is a special #GstBin used as the toplevel container for
	 * the filter graph. The #GstPipeline will manage the selection and
	 * distribution of a global #GstClock as well as provide a #GstBus to the
	 * application.
	 * 
	 * {@link Gst.Pipeline.new} is used to create a pipeline. when you are done with
	 * the pipeline, use gst_object_unref() to free its resources including all
	 * added #GstElement objects (if not otherwise referenced).
	 * 
	 * Elements are added and removed from the pipeline using the #GstBin
	 * methods like gst_bin_add() and gst_bin_remove() (see #GstBin).
	 * 
	 * Before changing the state of the #GstPipeline (see #GstElement) a #GstBus
	 * can be retrieved with gst_pipeline_get_bus(). This bus can then be
	 * used to receive #GstMessage from the elements in the pipeline.
	 * 
	 * By default, a #GstPipeline will automatically flush the pending #GstBus
	 * messages when going to the NULL state to ensure that no circular
	 * references exist when no messages are read from the #GstBus. This
	 * behaviour can be changed with gst_pipeline_set_auto_flush_bus().
	 * 
	 * When the #GstPipeline performs the PAUSED to PLAYING state change it will
	 * select a clock for the elements. The clock selection algorithm will by
	 * default select a clock provided by an element that is most upstream
	 * (closest to the source). For live pipelines (ones that return
	 * #GST_STATE_CHANGE_NO_PREROLL from the gst_element_set_state() call) this
	 * will select the clock provided by the live source. For normal pipelines
	 * this will select a clock provided by the sinks (most likely the audio
	 * sink). If no element provides a clock, a default #GstSystemClock is used.
	 * 
	 * The clock selection can be controlled with the gst_pipeline_use_clock()
	 * method, which will enforce a given clock on the pipeline. With
	 * gst_pipeline_auto_clock() the default clock selection algorithm can be
	 * restored.
	 * 
	 * A #GstPipeline maintains a running time for the elements. The running
	 * time is defined as the difference between the current clock time and
	 * the base time. When the pipeline goes to READY or a flushing seek is
	 * performed on it, the running time is reset to 0. When the pipeline is
	 * set from PLAYING to PAUSED, the current clock time is sampled and used to
	 * configure the base time for the elements when the pipeline is set
	 * to PLAYING again. The effect is that the running time (as the difference
	 * between the clock time and the base time) will count how much time was spent
	 * in the PLAYING state. This default behaviour can be changed with the
	 * gst_element_set_start_time() method.
	 */
	interface Pipeline extends PipelineMixin {}

	class Pipeline {
		public constructor(options?: Partial<PipelineInitOptions>);
		/**
		 * Create a new pipeline with the given name.
		 * @param name name of new pipeline
		 * @returns newly created GstPipeline
		 * 
		 * MT safe.
		 */
		public static new(name?: string | null): Element;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Plugin} instead.
	 */
	interface IPlugin {
		/**
		 * Make GStreamer aware of external dependencies which affect the feature
		 * set of this plugin (ie. the elements or typefinders associated with it).
		 * 
		 * GStreamer will re-inspect plugins with external dependencies whenever any
		 * of the external dependencies change. This is useful for plugins which wrap
		 * other plugin systems, e.g. a plugin which wraps a plugin-based visualisation
		 * library and makes visualisations available as GStreamer elements, or a
		 * codec loader which exposes elements and/or caps dependent on what external
		 * codec libraries are currently installed.
		 * @param env_vars %NULL-terminated array of environment variables affecting the
		 *     feature set of the plugin (e.g. an environment variable containing
		 *     paths where to look for additional modules/plugins of a library),
		 *     or %NULL. Environment variable names may be followed by a path component
		 *      which will be added to the content of the environment variable, e.g.
		 *      "HOME/.mystuff/plugins".
		 * @param paths %NULL-terminated array of directories/paths where dependent files
		 *     may be, or %NULL.
		 * @param names %NULL-terminated array of file names (or file name suffixes,
		 *     depending on #flags) to be used in combination with the paths from
		 *     #paths and/or the paths extracted from the environment variables in
		 *     #env_vars, or %NULL.
		 * @param flags optional flags, or #GST_PLUGIN_DEPENDENCY_FLAG_NONE
		 */
		add_dependency(env_vars: string[] | null, paths: string[] | null, names: string[] | null, flags: PluginDependencyFlags): void;
		/**
		 * Make GStreamer aware of external dependencies which affect the feature
		 * set of this plugin (ie. the elements or typefinders associated with it).
		 * 
		 * GStreamer will re-inspect plugins with external dependencies whenever any
		 * of the external dependencies change. This is useful for plugins which wrap
		 * other plugin systems, e.g. a plugin which wraps a plugin-based visualisation
		 * library and makes visualisations available as GStreamer elements, or a
		 * codec loader which exposes elements and/or caps dependent on what external
		 * codec libraries are currently installed.
		 * 
		 * Convenience wrapper function for {@link Gst.Plugin.add_dependency} which
		 * takes simple strings as arguments instead of string arrays, with multiple
		 * arguments separated by predefined delimiters (see above).
		 * @param env_vars one or more environment variables (separated by ':', ';' or ','),
		 *      or %NULL. Environment variable names may be followed by a path component
		 *      which will be added to the content of the environment variable, e.g.
		 *      "HOME/.mystuff/plugins:MYSTUFF_PLUGINS_PATH"
		 * @param paths one ore more directory paths (separated by ':' or ';' or ','),
		 *      or %NULL. Example: "/usr/lib/mystuff/plugins"
		 * @param names one or more file names or file name suffixes (separated by commas),
		 *      or %NULL
		 * @param flags optional flags, or #GST_PLUGIN_DEPENDENCY_FLAG_NONE
		 */
		add_dependency_simple(env_vars: string | null, paths: string | null, names: string | null, flags: PluginDependencyFlags): void;
		/**
		 * Gets the plugin specific data cache. If it is %NULL there is no cached data
		 * stored. This is the case when the registry is getting rebuilt.
		 * @returns The cached data as a
		 * {@link Structure} or %NULL.
		 */
		get_cache_data(): Structure | null;
		/**
		 * Get the long descriptive name of the plugin
		 * @returns the long name of the plugin
		 */
		get_description(): string;
		/**
		 * get the filename of the plugin
		 * @returns the filename of the plugin
		 */
		get_filename(): string | null;
		/**
		 * get the license of the plugin
		 * @returns the license of the plugin
		 */
		get_license(): string;
		/**
		 * Get the short name of the plugin
		 * @returns the name of the plugin
		 */
		get_name(): string;
		/**
		 * get the URL where the plugin comes from
		 * @returns the origin of the plugin
		 */
		get_origin(): string;
		/**
		 * get the package the plugin belongs to.
		 * @returns the package of the plugin
		 */
		get_package(): string;
		/**
		 * Get the release date (and possibly time) in form of a string, if available.
		 * 
		 * For normal GStreamer plugin releases this will usually just be a date in
		 * the form of "YYYY-MM-DD", while pre-releases and builds from git may contain
		 * a time component after the date as well, in which case the string will be
		 * formatted like "YYYY-MM-DDTHH:MMZ" (e.g. "2012-04-30T09:30Z").
		 * 
		 * There may be plugins that do not have a valid release date set on them.
		 * @returns the date string of the plugin, or %NULL if not
		 * available.
		 */
		get_release_date_string(): string | null;
		/**
		 * get the source module the plugin belongs to.
		 * @returns the source of the plugin
		 */
		get_source(): string;
		/**
		 * get the version of the plugin
		 * @returns the version of the plugin
		 */
		get_version(): string;
		/**
		 * queries if the plugin is loaded into memory
		 * @returns %TRUE is loaded, %FALSE otherwise
		 */
		is_loaded(): boolean;
		/**
		 * Loads #plugin. Note that the *return value* is the loaded plugin; #plugin is
		 * untouched. The normal use pattern of this function goes like this:
		 * 
		 * |[
		 * GstPlugin *loaded_plugin;
		 * loaded_plugin = gst_plugin_load (plugin);
		 * // presumably, we're no longer interested in the potentially-unloaded plugin
		 * gst_object_unref (plugin);
		 * plugin = loaded_plugin;
		 * ]|
		 * @returns a reference to a loaded plugin, or
		 * %NULL on error.
		 */
		load(): Plugin | null;
		/**
		 * Adds plugin specific data to cache. Passes the ownership of the structure to
		 * the #plugin.
		 * 
		 * The cache is flushed every time the registry is rebuilt.
		 * @param cache_data a structure containing the data to cache
		 */
		set_cache_data(cache_data: Structure): void;
	}

	type PluginInitOptionsMixin = ObjectInitOptions
	export interface PluginInitOptions extends PluginInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Plugin} instead.
	 */
	type PluginMixin = IPlugin & Object;

	/**
	 * GStreamer is extensible, so {@link Element} instances can be loaded at runtime.
	 * A plugin system can provide one or more of the basic GStreamer
	 * #GstPluginFeature subclasses.
	 * 
	 * A plugin should export a symbol `gst_plugin_desc` that is a
	 * struct of type #GstPluginDesc.
	 * the plugin loader will check the version of the core library the plugin was
	 * linked against and will create a new #GstPlugin. It will then call the
	 * #GstPluginInitFunc function that was provided in the
	 * `gst_plugin_desc`.
	 * 
	 * Once you have a handle to a #GstPlugin (e.g. from the #GstRegistry), you
	 * can add any object that subclasses #GstPluginFeature.
	 * 
	 * Usually plugins are always automatically loaded so you don't need to call
	 * {@link Gst.Plugin.load} explicitly to bring it into memory. There are options to
	 * statically link plugins to an app or even use GStreamer without a plugin
	 * repository in which case gst_plugin_load() can be needed to bring the plugin
	 * into memory.
	 */
	interface Plugin extends PluginMixin {}

	class Plugin {
		public constructor(options?: Partial<PluginInitOptions>);
		/**
		 * Unrefs each member of #list, then frees the list.
		 * @param list list of {@link Plugin}
		 */
		public static list_free(list: Plugin[]): void;
		/**
		 * Load the named plugin. Refs the plugin.
		 * @param name name of plugin to load
		 * @returns a reference to a loaded plugin, or
		 * %NULL on error.
		 */
		public static load_by_name(name: string): Plugin | null;
		/**
		 * Loads the given plugin and refs it.  Caller needs to unref after use.
		 * @param filename the plugin filename to load
		 * @returns a reference to the existing loaded GstPlugin, a
		 * reference to the newly-loaded GstPlugin, or %NULL if an error occurred.
		 */
		public static load_file(filename: string): Plugin;
		/**
		 * Registers a static plugin, ie. a plugin which is private to an application
		 * or library and contained within the application or library (as opposed to
		 * being shipped as a separate module file).
		 * 
		 * You must make sure that GStreamer has been initialised (with gst_init() or
		 * via gst_init_get_option_group()) before calling this function.
		 * @param major_version the major version number of the GStreamer core that the
		 *     plugin was compiled for, you can just use GST_VERSION_MAJOR here
		 * @param minor_version the minor version number of the GStreamer core that the
		 *     plugin was compiled for, you can just use GST_VERSION_MINOR here
		 * @param name a unique name of the plugin (ideally prefixed with an application- or
		 *     library-specific namespace prefix in order to avoid name conflicts in
		 *     case a similar plugin with the same name ever gets added to GStreamer)
		 * @param description description of the plugin
		 * @param init_func pointer to the init function of this plugin.
		 * @param version version string of the plugin
		 * @param license effective license of plugin. Must be one of the approved licenses
		 *     (see {@link PluginDesc} above) or the plugin will not be registered.
		 * @param source source module plugin belongs to
		 * @param _package shipped package plugin belongs to
		 * @param origin URL to provider of plugin
		 * @returns %TRUE if the plugin was registered correctly, otherwise %FALSE.
		 */
		public static register_static(major_version: number, minor_version: number, name: string, description: string, init_func: PluginInitFunc, version: string, license: string, source: string, _package: string, origin: string): boolean;
		/**
		 * Registers a static plugin, ie. a plugin which is private to an application
		 * or library and contained within the application or library (as opposed to
		 * being shipped as a separate module file) with a {@link PluginInitFullFunc}
		 * which allows user data to be passed to the callback function (useful
		 * for bindings).
		 * 
		 * You must make sure that GStreamer has been initialised (with gst_init() or
		 * via gst_init_get_option_group()) before calling this function.
		 * @param major_version the major version number of the GStreamer core that the
		 *     plugin was compiled for, you can just use GST_VERSION_MAJOR here
		 * @param minor_version the minor version number of the GStreamer core that the
		 *     plugin was compiled for, you can just use GST_VERSION_MINOR here
		 * @param name a unique name of the plugin (ideally prefixed with an application- or
		 *     library-specific namespace prefix in order to avoid name conflicts in
		 *     case a similar plugin with the same name ever gets added to GStreamer)
		 * @param description description of the plugin
		 * @param init_full_func pointer to the init function with user data
		 *     of this plugin.
		 * @param version version string of the plugin
		 * @param license effective license of plugin. Must be one of the approved licenses
		 *     (see {@link PluginDesc} above) or the plugin will not be registered.
		 * @param source source module plugin belongs to
		 * @param _package shipped package plugin belongs to
		 * @param origin URL to provider of plugin
		 * @returns %TRUE if the plugin was registered correctly, otherwise %FALSE.
		 */
		public static register_static_full(major_version: number, minor_version: number, name: string, description: string, init_full_func: PluginInitFullFunc, version: string, license: string, source: string, _package: string, origin: string): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PluginFeature} instead.
	 */
	interface IPluginFeature {
		/**
		 * Checks whether the given plugin feature is at least
		 *  the required version
		 * @param min_major minimum required major version
		 * @param min_minor minimum required minor version
		 * @param min_micro minimum required micro version
		 * @returns %TRUE if the plugin feature has at least
		 *  the required version, otherwise %FALSE.
		 */
		check_version(min_major: number, min_minor: number, min_micro: number): boolean;
		/**
		 * Get the plugin that provides this feature.
		 * @returns the plugin that provides this
		 *     feature, or %NULL.  Unref with {@link Gst.Object.unref} when no
		 *     longer needed.
		 */
		get_plugin(): Plugin | null;
		/**
		 * Get the name of the plugin that provides this feature.
		 * @returns the name of the plugin that provides this
		 *     feature, or %NULL if the feature is not associated with a
		 *     plugin.
		 */
		get_plugin_name(): string | null;
		/**
		 * Gets the rank of a plugin feature.
		 * @returns The rank of the feature
		 */
		get_rank(): number;
		/**
		 * Loads the plugin containing #feature if it's not already loaded. #feature is
		 * unaffected; use the return value instead.
		 * 
		 * Normally this function is used like this:
		 * |[<!-- language="C" -->
		 * GstPluginFeature *loaded_feature;
		 * 
		 * loaded_feature = gst_plugin_feature_load (feature);
		 * // presumably, we're no longer interested in the potentially-unloaded feature
		 * gst_object_unref (feature);
		 * feature = loaded_feature;
		 * ]|
		 * @returns a reference to the loaded
		 * feature, or %NULL on error
		 */
		load(): PluginFeature | null;
		/**
		 * Specifies a rank for a plugin feature, so that autoplugging uses
		 * the most appropriate feature.
		 * @param rank rank value - higher number means more priority rank
		 */
		set_rank(rank: number): void;
	}

	type PluginFeatureInitOptionsMixin = ObjectInitOptions
	export interface PluginFeatureInitOptions extends PluginFeatureInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PluginFeature} instead.
	 */
	type PluginFeatureMixin = IPluginFeature & Object;

	/**
	 * This is a base class for anything that can be added to a {@link Plugin}.
	 */
	interface PluginFeature extends PluginFeatureMixin {}

	class PluginFeature {
		public constructor(options?: Partial<PluginFeatureInitOptions>);
		/**
		 * Copies the list of features. Caller should call #gst_plugin_feature_list_free
		 * when done with the list.
		 * @param list list
		 *     of {@link PluginFeature}
		 * @returns a copy of #list,
		 *     with each feature's reference count incremented.
		 */
		public static list_copy(list: PluginFeature[]): PluginFeature[];
		/**
		 * Debug the plugin feature names in #list.
		 * @param list a #GList of
		 *     plugin features
		 */
		public static list_debug(list: PluginFeature[]): void;
		/**
		 * Unrefs each member of #list, then frees the list.
		 * @param list list
		 *     of {@link PluginFeature}
		 */
		public static list_free(list: PluginFeature[]): void;
		/**
		 * Compares the two given {@link PluginFeature} instances. This function can be
		 * used as a #GCompareFunc when sorting by rank and then by name.
		 * @param p1 a {@link PluginFeature}
		 * @param p2 a {@link PluginFeature}
		 * @returns negative value if the rank of p1 > the rank of p2 or the ranks are
		 * equal but the name of p1 comes before the name of p2; zero if the rank
		 * and names are equal; positive value if the rank of p1 < the rank of p2 or the
		 * ranks are equal but the name of p2 comes before the name of p1
		 */
		public static rank_compare_func(p1?: any | null, p2?: any | null): number;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ProxyPad} instead.
	 */
	interface IProxyPad {
		readonly pad: Pad;
		/**
		 * Get the internal pad of #pad. Unref target pad after usage.
		 * 
		 * The internal pad of a {@link GhostPad} is the internally used
		 * pad of opposite direction, which is used to link to the target.
		 * @returns the target {@link ProxyPad}, can
		 * be %NULL.  Unref target pad after usage.
		 */
		get_internal(): ProxyPad | null;
		connect(signal: "notify::pad", callback: (owner: this, ...args: any) => void): number;

	}

	type ProxyPadInitOptionsMixin = PadInitOptions
	export interface ProxyPadInitOptions extends ProxyPadInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ProxyPad} instead.
	 */
	type ProxyPadMixin = IProxyPad & Pad;

	interface ProxyPad extends ProxyPadMixin {}

	class ProxyPad {
		public constructor(options?: Partial<ProxyPadInitOptions>);
		/**
		 * Invoke the default chain function of the proxy pad.
		 * @param pad a sink {@link Pad}, returns GST_FLOW_ERROR if not.
		 * @param parent the parent of #pad or %NULL
		 * @param buffer the {@link Buffer} to send, return GST_FLOW_ERROR
		 *     if not.
		 * @returns a {@link FlowReturn} from the pad.
		 */
		public static chain_default(pad: Pad, parent: Object | null, buffer: Buffer): FlowReturn;
		/**
		 * Invoke the default chain list function of the proxy pad.
		 * @param pad a sink {@link Pad}, returns GST_FLOW_ERROR if not.
		 * @param parent the parent of #pad or %NULL
		 * @param list the {@link BufferList} to send, return GST_FLOW_ERROR
		 *     if not.
		 * @returns a {@link FlowReturn} from the pad.
		 */
		public static chain_list_default(pad: Pad, parent: Object | null, list: BufferList): FlowReturn;
		/**
		 * Invoke the default getrange function of the proxy pad.
		 * @param pad a src {@link Pad}, returns #GST_FLOW_ERROR if not.
		 * @param parent the parent of #pad
		 * @param offset The start offset of the buffer
		 * @param size The length of the buffer
		 * @returns a {@link FlowReturn} from the pad.
		 * 
		 * a pointer to hold the #GstBuffer,
		 *     returns #GST_FLOW_ERROR if %NULL.
		 */
		public static getrange_default(pad: Pad, parent: Object, offset: number, size: number): [ FlowReturn, Buffer ];
		/**
		 * Invoke the default iterate internal links function of the proxy pad.
		 * @param pad the {@link Pad} to get the internal links of.
		 * @param parent the parent of #pad or %NULL
		 * @returns a {@link Iterator} of #GstPad, or %NULL if #pad
		 * has no parent. Unref each returned pad with {@link Gst.Object.unref}.
		 */
		public static iterate_internal_links_default(pad: Pad, parent?: Object | null): Iterator | null;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Registry} instead.
	 */
	interface IRegistry {
		readonly object: Object;
		/**
		 * Add the feature to the registry. The feature-added signal will be emitted.
		 * 
		 * #feature's reference count will be incremented, and any floating
		 * reference will be removed (see {@link Gst.Object.ref_sink})
		 * @param feature the feature to add
		 * @returns %TRUE on success.
		 * 
		 * MT safe.
		 */
		add_feature(feature: PluginFeature): boolean;
		/**
		 * Add the plugin to the registry. The plugin-added signal will be emitted.
		 * 
		 * #plugin's reference count will be incremented, and any floating
		 * reference will be removed (see {@link Gst.Object.ref_sink})
		 * @param plugin the plugin to add
		 * @returns %TRUE on success.
		 * 
		 * MT safe.
		 */
		add_plugin(plugin: Plugin): boolean;
		/**
		 * Checks whether a plugin feature by the given name exists in
		 * #registry and whether its version is at least the
		 * version required.
		 * @param feature_name the name of the feature (e.g. "oggdemux")
		 * @param min_major the minimum major version number
		 * @param min_minor the minimum minor version number
		 * @param min_micro the minimum micro version number
		 * @returns %TRUE if the feature could be found and the version is
		 * the same as the required version or newer, and %FALSE otherwise.
		 */
		check_feature_version(feature_name: string, min_major: number, min_minor: number, min_micro: number): boolean;
		/**
		 * Runs a filter against all features of the plugins in the registry
		 * and returns a GList with the results.
		 * If the first flag is set, only the first match is
		 * returned (as a list with a single object).
		 * @param filter the filter to use
		 * @param first only return first match
		 * @returns a #GList of
		 *     {@link PluginFeature}. Use {@link Gst.PluginFeature.list_free} after usage.
		 * 
		 * MT safe.
		 */
		feature_filter(filter: PluginFeatureFilter, first: boolean): PluginFeature[];
		/**
		 * Find the pluginfeature with the given name and type in the registry.
		 * @param name the pluginfeature name to find
		 * @param type the pluginfeature type to find
		 * @returns the pluginfeature with the
		 *     given name and type or %NULL if the plugin was not
		 *     found. {@link Gst.Object.unref} after usage.
		 * 
		 * MT safe.
		 */
		find_feature(name: string, type: GObject.Type): PluginFeature | null;
		/**
		 * Find the plugin with the given name in the registry.
		 * The plugin will be reffed; caller is responsible for unreffing.
		 * @param name the plugin name to find
		 * @returns the plugin with the given name
		 *     or %NULL if the plugin was not found. {@link Gst.Object.unref} after
		 *     usage.
		 * 
		 * MT safe.
		 */
		find_plugin(name: string): Plugin | null;
		/**
		 * Retrieves a #GList of {@link PluginFeature} of #type.
		 * @param type a #GType.
		 * @returns a #GList of
		 *     {@link PluginFeature} of #type. Use {@link Gst.PluginFeature.list_free} after use
		 * 
		 * MT safe.
		 */
		get_feature_list(type: GObject.Type): PluginFeature[];
		/**
		 * Retrieves a #GList of features of the plugin with name #name.
		 * @param name a plugin name.
		 * @returns a #GList of
		 *     {@link PluginFeature}. Use {@link Gst.PluginFeature.list_free} after usage.
		 */
		get_feature_list_by_plugin(name: string): PluginFeature[];
		/**
		 * Returns the registry's feature list cookie. This changes
		 * every time a feature is added or removed from the registry.
		 * @returns the feature list cookie.
		 */
		get_feature_list_cookie(): number;
		/**
		 * Get a copy of all plugins registered in the given registry. The refcount
		 * of each element in the list in incremented.
		 * @returns a #GList of {@link Plugin}.
		 *     Use {@link Gst.Plugin.list_free} after usage.
		 * 
		 * MT safe.
		 */
		get_plugin_list(): Plugin[];
		/**
		 * Look up a plugin in the given registry with the given filename.
		 * If found, plugin is reffed.
		 * @param filename the name of the file to look up
		 * @returns the {@link Plugin} if found, or
		 *     %NULL if not.  {@link Gst.Object.unref} after usage.
		 */
		lookup(filename: string): Plugin | null;
		/**
		 * Find a {@link PluginFeature} with #name in #registry.
		 * @param name a {@link PluginFeature} name
		 * @returns a {@link PluginFeature} with its refcount incremented,
		 *     use {@link Gst.Object.unref} after usage.
		 * 
		 * MT safe.
		 */
		lookup_feature(name: string): PluginFeature | null;
		/**
		 * Runs a filter against all plugins in the registry and returns a #GList with
		 * the results. If the first flag is set, only the first match is
		 * returned (as a list with a single object).
		 * Every plugin is reffed; use {@link Gst.Plugin.list_free} after use, which
		 * will unref again.
		 * @param filter the filter to use
		 * @param first only return first match
		 * @returns a #GList of {@link Plugin}.
		 *     Use {@link Gst.Plugin.list_free} after usage.
		 * 
		 * MT safe.
		 */
		plugin_filter(filter: PluginFilter, first: boolean): Plugin[];
		/**
		 * Remove the feature from the registry.
		 * 
		 * MT safe.
		 * @param feature the feature to remove
		 */
		remove_feature(feature: PluginFeature): void;
		/**
		 * Remove the plugin from the registry.
		 * 
		 * MT safe.
		 * @param plugin the plugin to remove
		 */
		remove_plugin(plugin: Plugin): void;
		/**
		 * Scan the given path for plugins to add to the registry. The syntax of the
		 * path is specific to the registry.
		 * @param path the path to scan
		 * @returns %TRUE if registry changed
		 */
		scan_path(path: string): boolean;
		/**
		 * Signals that a feature has been added to the registry (possibly
		 * replacing a previously-added one by the same name)
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - feature: the feature that has been added 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "feature-added", callback: (owner: this, feature: PluginFeature) => void): number;
		/**
		 * Signals that a plugin has been added to the registry (possibly
		 * replacing a previously-added one by the same name)
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - plugin: the plugin that has been added 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "plugin-added", callback: (owner: this, plugin: Plugin) => void): number;

		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;

	}

	type RegistryInitOptionsMixin = ObjectInitOptions
	export interface RegistryInitOptions extends RegistryInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Registry} instead.
	 */
	type RegistryMixin = IRegistry & Object;

	/**
	 * One registry holds the metadata of a set of plugins.
	 * 
	 * <emphasis role="bold">Design:</emphasis>
	 * 
	 * The {@link Registry} object is a list of plugins and some functions for dealing
	 * with them. Each #GstPlugin is matched 1-1 with a file on disk, and may or may
	 * not be loaded at a given time.
	 * 
	 * The primary source, at all times, of plugin information is each plugin file
	 * itself. Thus, if an application wants information about a particular plugin,
	 * or wants to search for a feature that satisfies given criteria, the primary
	 * means of doing so is to load every plugin and look at the resulting
	 * information that is gathered in the default registry. Clearly, this is a time
	 * consuming process, so we cache information in the registry file. The format
	 * and location of the cache file is internal to gstreamer.
	 * 
	 * On startup, plugins are searched for in the plugin search path. The following
	 * locations are checked in this order:
	 * 
	 * * location from --gst-plugin-path commandline option.
	 * * the GST_PLUGIN_PATH environment variable.
	 * * the GST_PLUGIN_SYSTEM_PATH environment variable.
	 * * default locations (if GST_PLUGIN_SYSTEM_PATH is not set).
	 *   Those default locations are:
	 *   `$XDG_DATA_HOME/gstreamer-$GST_API_VERSION/plugins/`
	 *   and `$prefix/libs/gstreamer-$GST_API_VERSION/`.
	 *   [$XDG_DATA_HOME](http://standards.freedesktop.org/basedir-spec/basedir-spec-latest.html) defaults to
	 *   `$HOME/.local/share`.
	 * 
	 * The registry cache file is loaded from
	 * `$XDG_CACHE_HOME/gstreamer-$GST_API_VERSION/registry-$ARCH.bin`
	 * (where $XDG_CACHE_HOME defaults to `$HOME/.cache`) or the file listed in the `GST_REGISTRY`
	 * env var. One reason to change the registry location is for testing.
	 * 
	 * For each plugin that is found in the plugin search path, there could be 3
	 * possibilities for cached information:
	 * 
	 *   * the cache may not contain information about a given file.
	 *   * the cache may have stale information.
	 *   * the cache may have current information.
	 * 
	 * In the first two cases, the plugin is loaded and the cache updated. In
	 * addition to these cases, the cache may have entries for plugins that are not
	 * relevant to the current process. These are marked as not available to the
	 * current process. If the cache is updated for whatever reason, it is marked
	 * dirty.
	 * 
	 * A dirty cache is written out at the end of initialization. Each entry is
	 * checked to make sure the information is minimally valid. If not, the entry is
	 * simply dropped.
	 * 
	 * ## Implementation notes:
	 * 
	 * The "cache" and "registry" are different concepts and can represent
	 * different sets of plugins. For various reasons, at init time, the cache is
	 * stored in the default registry, and plugins not relevant to the current
	 * process are marked with the %GST_PLUGIN_FLAG_CACHED bit. These plugins are
	 * removed at the end of initialization.
	 */
	interface Registry extends RegistryMixin {}

	class Registry {
		public constructor(options?: Partial<RegistryInitOptions>);
		/**
		 * By default GStreamer will perform scanning and rebuilding of the
		 * registry file using a helper child process.
		 * 
		 * Applications might want to disable this behaviour with the
		 * {@link Gst.Registry.fork_set_enabled} function, in which case new plugins
		 * are scanned (and loaded) into the application process.
		 * @returns %TRUE if GStreamer will use the child helper process when
		 * rebuilding the registry.
		 */
		public static fork_is_enabled(): boolean;
		/**
		 * Applications might want to disable/enable spawning of a child helper process
		 * when rebuilding the registry. See {@link Gst.Registry.fork_is_enabled} for more
		 * information.
		 * @param enabled whether rebuilding the registry can use a temporary child helper process.
		 */
		public static fork_set_enabled(enabled: boolean): void;
		/**
		 * Retrieves the singleton plugin registry. The caller does not own a
		 * reference on the registry, as it is alive as long as GStreamer is
		 * initialized.
		 * @returns the {@link Registry}.
		 */
		public static get(): Registry;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Stream} instead.
	 */
	interface IStream {
		/**
		 * The {@link Caps} of the #GstStream.
		 */
		caps: Caps;
		stream_flags: StreamFlags;
		/**
		 * The unique identifier of the {@link Stream}. Can only be set at construction
		 * time.
		 */
		stream_id: string;
		/**
		 * The {@link StreamType} of the #GstStream. Can only be set at construction time.
		 */
		stream_type: StreamType;
		/**
		 * The {@link TagList} of the #GstStream.
		 */
		tags: TagList;
		/**
		 * The Stream Identifier for this {@link Stream}
		 */
		// readonly stream_id: string;
		/**
		 * Retrieve the caps for #stream, if any
		 * @returns The {@link Caps} for #stream
		 */
		get_caps(): Caps | null;
		/**
		 * Retrieve the current stream flags for #stream
		 * @returns The {@link StreamFlags} for #stream
		 */
		get_stream_flags(): StreamFlags;
		/**
		 * Returns the stream ID of #stream.
		 * @returns the stream ID of #stream. Only valid
		 * during the lifetime of #stream.
		 */
		get_stream_id(): string | null;
		/**
		 * Retrieve the stream type for #stream
		 * @returns The {@link StreamType} for #stream
		 */
		get_stream_type(): StreamType;
		/**
		 * Retrieve the tags for #stream, if any
		 * @returns The {@link TagList} for #stream
		 */
		get_tags(): TagList | null;
		/**
		 * Set the caps for the {@link Stream}
		 * @param caps a {@link Caps}
		 */
		set_caps(caps?: Caps | null): void;
		/**
		 * Set the #flags for the #stream.
		 * @param flags the flags to set on #stream
		 */
		set_stream_flags(flags: StreamFlags): void;
		/**
		 * Set the stream type of #stream
		 * @param stream_type the type to set on #stream
		 */
		set_stream_type(stream_type: StreamType): void;
		/**
		 * Set the tags for the {@link Stream}
		 * @param tags a {@link TagList}
		 */
		set_tags(tags?: TagList | null): void;
		connect(signal: "notify::caps", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::stream-flags", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::stream-id", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::stream-type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::tags", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::stream_id", callback: (owner: this, ...args: any) => void): number;

	}

	type StreamInitOptionsMixin = ObjectInitOptions & 
	Pick<IStream,
		"caps" |
		"stream_flags" |
		"stream_id" |
		"stream_type" |
		"tags">;

	export interface StreamInitOptions extends StreamInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Stream} instead.
	 */
	type StreamMixin = IStream & Object;

	/**
	 * A high-level object representing a single stream. It might be backed, or
	 * not, by an actual flow of data in a pipeline ({@link Pad}).
	 * 
	 * A #GstStream does not care about data changes (such as decoding, encoding,
	 * parsing,...) as long as the underlying data flow corresponds to the same
	 * high-level flow (ex: a certain audio track).
	 * 
	 * A #GstStream contains all the information pertinent to a stream, such as
	 * stream-id, tags, caps, type, ...
	 * 
	 * Elements can subclass a #GstStream for internal usage (to contain information
	 * pertinent to streams of data).
	 */
	interface Stream extends StreamMixin {}

	class Stream {
		public constructor(options?: Partial<StreamInitOptions>);
		/**
		 * Create a new {@link Stream} for the given #stream_id, #caps, #type
		 * and #flags
		 * @param stream_id the id for the new stream. If %NULL,
		 * a new one will be automatically generated
		 * @param caps the {@link Caps} of the stream
		 * @param type the {@link StreamType} of the stream
		 * @param flags the {@link StreamFlags} of the stream
		 * @returns The new {@link Stream}
		 */
		public static new(stream_id: string | null, caps: Caps | null, type: StreamType, flags: StreamFlags): Stream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StreamCollection} instead.
	 */
	interface IStreamCollection {
		upstream_id: string;
		/**
		 * Add the given #stream to the #collection.
		 * @param stream the {@link Stream} to add
		 * @returns %TRUE if the #stream was properly added, else %FALSE
		 */
		add_stream(stream: Stream): boolean;
		/**
		 * Get the number of streams this collection contains
		 * @returns The number of streams that #collection contains
		 */
		get_size(): number;
		/**
		 * Retrieve the {@link Stream} with index #index from the collection.
		 * 
		 * The caller should not modify the returned #GstStream
		 * @param index Index of the stream to retrieve
		 * @returns A {@link Stream}
		 */
		get_stream(index: number): Stream | null;
		/**
		 * Returns the upstream id of the #collection.
		 * @returns The upstream id
		 */
		get_upstream_id(): string | null;
		connect(signal: "stream-notify", callback: (owner: this, object: Stream, p0: GObject.ParamSpec) => void): number;

		connect(signal: "notify::upstream-id", callback: (owner: this, ...args: any) => void): number;

	}

	type StreamCollectionInitOptionsMixin = ObjectInitOptions & 
	Pick<IStreamCollection,
		"upstream_id">;

	export interface StreamCollectionInitOptions extends StreamCollectionInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link StreamCollection} instead.
	 */
	type StreamCollectionMixin = IStreamCollection & Object;

	/**
	 * A collection of {@link Stream} that are available.
	 * 
	 * A #GstStreamCollection will be provided by elements that can make those
	 * streams available. Applications can use the collection to show the user
	 * what streams are available by using {@link %gst.stream_collection_get_stream}
	 * 
	 * Once posted, a #GstStreamCollection is immutable. Updates are made by sending
	 * a new #GstStreamCollection message, which may or may not share some of
	 * the #GstStream objects from the collection it replaces. The receiver can check
	 * the sender of a stream collection message to know which collection is
	 * obsoleted.
	 * 
	 * Several elements in a pipeline can provide #GstStreamCollection.
	 * 
	 * Applications can activate streams from a collection by using the
	 * #GST_EVENT_SELECT_STREAMS event on a pipeline, bin or element.
	 */
	interface StreamCollection extends StreamCollectionMixin {}

	class StreamCollection {
		public constructor(options?: Partial<StreamCollectionInitOptions>);
		/**
		 * Create a new {@link StreamCollection}.
		 * @param upstream_id The stream id of the parent stream
		 * @returns The new {@link StreamCollection}.
		 */
		public static new(upstream_id?: string | null): StreamCollection;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link SystemClock} instead.
	 */
	interface ISystemClock {
		clock_type: ClockType;
		readonly clock: Clock;

		connect(signal: "notify::clock-type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::clock", callback: (owner: this, ...args: any) => void): number;

	}

	type SystemClockInitOptionsMixin = ClockInitOptions & 
	Pick<ISystemClock,
		"clock_type">;

	export interface SystemClockInitOptions extends SystemClockInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link SystemClock} instead.
	 */
	type SystemClockMixin = ISystemClock & Clock;

	/**
	 * The GStreamer core provides a GstSystemClock based on the system time.
	 * Asynchronous callbacks are scheduled from an internal thread.
	 * 
	 * Clock implementors are encouraged to subclass this systemclock as it
	 * implements the async notification.
	 * 
	 * Subclasses can however override all of the important methods for sync and
	 * async notifications to implement their own callback methods or blocking
	 * wait operations.
	 */
	interface SystemClock extends SystemClockMixin {}

	class SystemClock {
		public constructor(options?: Partial<SystemClockInitOptions>);
		/**
		 * Get a handle to the default system clock. The refcount of the
		 * clock will be increased so you need to unref the clock after
		 * usage.
		 * @returns the default clock.
		 * 
		 * MT safe.
		 */
		public static obtain(): Clock;
		/**
		 * Sets the default system clock that can be obtained with
		 * {@link Gst.SystemClock.obtain}.
		 * 
		 * This is mostly used for testing and debugging purposes when you
		 * want to have control over the time reported by the default system
		 * clock.
		 * 
		 * MT safe.
		 * @param new_clock a {@link Clock}
		 */
		public static set_default(new_clock?: Clock | null): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Task} instead.
	 */
	interface ITask {
		readonly object: Object;
		/**
		 * the state of the task
		 */
		readonly state: TaskState;
		/**
		 * used to pause/resume the task
		 */
		readonly cond: GLib.Cond;
		/**
		 * The lock taken when iterating the task function
		 */
		readonly lock: GLib.RecMutex;
		/**
		 * the function executed by this task
		 */
		readonly func: TaskFunction;
		/**
		 * user_data passed to the task function
		 */
		readonly user_data: any;
		/**
		 * GDestroyNotify for #user_data
		 */
		readonly notify: GLib.DestroyNotify;
		/**
		 * a flag indicating that the task is running
		 */
		readonly running: boolean;
		/**
		 * Get the {@link TaskPool} that this task will use for its streaming
		 * threads.
		 * 
		 * MT safe.
		 * @returns the {@link TaskPool} used by #task. {@link Gst.Object.unref}
		 * after usage.
		 */
		get_pool(): TaskPool;
		/**
		 * Get the current state of the task.
		 * @returns The {@link TaskState} of the task
		 * 
		 * MT safe.
		 */
		get_state(): TaskState;
		/**
		 * Joins #task. After this call, it is safe to unref the task
		 * and clean up the lock set with {@link Gst.Task.set_lock}.
		 * 
		 * The task will automatically be stopped with this call.
		 * 
		 * This function cannot be called from within a task function as this
		 * would cause a deadlock. The function will detect this and print a
		 * g_warning.
		 * @returns %TRUE if the task could be joined.
		 * 
		 * MT safe.
		 */
		join(): boolean;
		/**
		 * Pauses #task. This method can also be called on a task in the
		 * stopped state, in which case a thread will be started and will remain
		 * in the paused state. This function does not wait for the task to complete
		 * the paused state.
		 * @returns %TRUE if the task could be paused.
		 * 
		 * MT safe.
		 */
		pause(): boolean;
		/**
		 * Resume #task in case it was paused. If the task was stopped, it will
		 * remain in that state and this function will return %FALSE.
		 * @returns %TRUE if the task could be resumed.
		 * 
		 * MT safe.
		 */
		resume(): boolean;
		/**
		 * Call #enter_func when the task function of #task is entered. #user_data will
		 * be passed to #enter_func and #notify will be called when #user_data is no
		 * longer referenced.
		 * @param enter_func a {@link TaskThreadFunc}
		 */
		set_enter_callback(enter_func: TaskThreadFunc): void;
		/**
		 * Call #leave_func when the task function of #task is left. #user_data will
		 * be passed to #leave_func and #notify will be called when #user_data is no
		 * longer referenced.
		 * @param leave_func a {@link TaskThreadFunc}
		 */
		set_leave_callback(leave_func: TaskThreadFunc): void;
		/**
		 * Set the mutex used by the task. The mutex will be acquired before
		 * calling the {@link TaskFunction}.
		 * 
		 * This function has to be called before calling {@link Gst.Task.pause} or
		 * gst_task_start().
		 * 
		 * MT safe.
		 * @param mutex The #GRecMutex to use
		 */
		set_lock(mutex: GLib.RecMutex): void;
		/**
		 * Set #pool as the new GstTaskPool for #task. Any new streaming threads that
		 * will be created by #task will now use #pool.
		 * 
		 * MT safe.
		 * @param pool a {@link TaskPool}
		 */
		set_pool(pool: TaskPool): void;
		/**
		 * Sets the state of #task to #state.
		 * 
		 * The #task must have a lock associated with it using
		 * {@link Gst.Task.set_lock} when going to GST_TASK_STARTED or GST_TASK_PAUSED or
		 * this function will return %FALSE.
		 * 
		 * MT safe.
		 * @param state the new task state
		 * @returns %TRUE if the state could be changed.
		 */
		set_state(state: TaskState): boolean;
		/**
		 * Starts #task. The #task must have a lock associated with it using
		 * {@link Gst.Task.set_lock} or this function will return %FALSE.
		 * @returns %TRUE if the task could be started.
		 * 
		 * MT safe.
		 */
		start(): boolean;
		/**
		 * Stops #task. This method merely schedules the task to stop and
		 * will not wait for the task to have completely stopped. Use
		 * {@link Gst.Task.join} to stop and wait for completion.
		 * @returns %TRUE if the task could be stopped.
		 * 
		 * MT safe.
		 */
		stop(): boolean;
		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::state", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::cond", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::lock", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::func", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::user_data", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::notify", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::running", callback: (owner: this, ...args: any) => void): number;

	}

	type TaskInitOptionsMixin = ObjectInitOptions
	export interface TaskInitOptions extends TaskInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Task} instead.
	 */
	type TaskMixin = ITask & Object;

	/**
	 * {@link Task} is used by #GstElement and #GstPad to provide the data passing
	 * threads in a #GstPipeline.
	 * 
	 * A #GstPad will typically start a #GstTask to push or pull data to/from the
	 * peer pads. Most source elements start a #GstTask to push data. In some cases
	 * a demuxer element can start a #GstTask to pull data from a peer element. This
	 * is typically done when the demuxer can perform random access on the upstream
	 * peer element for improved performance.
	 * 
	 * Although convenience functions exist on #GstPad to start/pause/stop tasks, it
	 * might sometimes be needed to create a #GstTask manually if it is not related to
	 * a #GstPad.
	 * 
	 * Before the #GstTask can be run, it needs a #GRecMutex that can be set with
	 * {@link Gst.Task.set_lock}.
	 * 
	 * The task can be started, paused and stopped with gst_task_start(), gst_task_pause()
	 * and gst_task_stop() respectively or with the gst_task_set_state() function.
	 * 
	 * A #GstTask will repeatedly call the #GstTaskFunction with the user data
	 * that was provided when creating the task with gst_task_new(). While calling
	 * the function it will acquire the provided lock. The provided lock is released
	 * when the task pauses or stops.
	 * 
	 * Stopping a task with gst_task_stop() will not immediately make sure the task is
	 * not running anymore. Use gst_task_join() to make sure the task is completely
	 * stopped and the thread is stopped.
	 * 
	 * After creating a #GstTask, use gst_object_unref() to free its resources. This can
	 * only be done when the task is not running anymore.
	 * 
	 * Task functions can send a #GstMessage to send out-of-band data to the
	 * application. The application can receive messages from the #GstBus in its
	 * mainloop.
	 * 
	 * For debugging purposes, the task will configure its object name as the thread
	 * name on Linux. Please note that the object name should be configured before the
	 * task is started; changing the object name after the task has been started, has
	 * no effect on the thread name.
	 */
	interface Task extends TaskMixin {}

	class Task {
		public constructor(options?: Partial<TaskInitOptions>);
		/**
		 * Create a new Task that will repeatedly call the provided #func
		 * with #user_data as a parameter. Typically the task will run in
		 * a new thread.
		 * 
		 * The function cannot be changed after the task has been created. You
		 * must create a new {@link Task} to change the function.
		 * 
		 * This function will not yet create and start a thread. Use {@link Gst.Task.start} or
		 * gst_task_pause() to create and start the GThread.
		 * 
		 * Before the task can be used, a #GRecMutex must be configured using the
		 * gst_task_set_lock() function. This lock will always be acquired while
		 * #func is called.
		 * @param func The {@link TaskFunction} to use
		 * @returns A new {@link Task}.
		 * 
		 * MT safe.
		 */
		public static new(func: TaskFunction): Task;
		/**
		 * Wait for all tasks to be stopped. This is mainly used internally
		 * to ensure proper cleanup of internal data structures in test suites.
		 * 
		 * MT safe.
		 */
		public static cleanup_all(): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TaskPool} instead.
	 */
	interface ITaskPool {
		readonly object: Object;
		/**
		 * Wait for all tasks to be stopped. This is mainly used internally
		 * to ensure proper cleanup of internal data structures in test suites.
		 * 
		 * MT safe.
		 */
		cleanup(): void;
		/**
		 * Join a task and/or return it to the pool. #id is the id obtained from
		 * {@link Gst.TaskPool.push}.
		 * @param id the id
		 */
		join(id?: any | null): void;
		/**
		 * Prepare the taskpool for accepting {@link Gst.TaskPool.push} operations.
		 * 
		 * MT safe.
		 */
		prepare(): void;
		/**
		 * Start the execution of a new thread from #pool.
		 * @param func the function to call
		 * @returns a pointer that should be used
		 * for the gst_task_pool_join function. This pointer can be %NULL, you
		 * must check #error to detect errors.
		 */
		push(func: TaskPoolFunction): any | null;
		connect(signal: "notify::object", callback: (owner: this, ...args: any) => void): number;

	}

	type TaskPoolInitOptionsMixin = ObjectInitOptions
	export interface TaskPoolInitOptions extends TaskPoolInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TaskPool} instead.
	 */
	type TaskPoolMixin = ITaskPool & Object;

	/**
	 * This object provides an abstraction for creating threads. The default
	 * implementation uses a regular GThreadPool to start tasks.
	 * 
	 * Subclasses can be made to create custom threads.
	 */
	interface TaskPool extends TaskPoolMixin {}

	class TaskPool {
		public constructor(options?: Partial<TaskPoolInitOptions>);
		/**
		 * Create a new default task pool. The default task pool will use a regular
		 * GThreadPool for threads.
		 * @returns a new {@link TaskPool}. {@link Gst.Object.unref} after usage.
		 */
		public static new(): TaskPool;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Tracer} instead.
	 */
	interface ITracer {
		params: string;

		connect(signal: "notify::params", callback: (owner: this, ...args: any) => void): number;

	}

	type TracerInitOptionsMixin = ObjectInitOptions & 
	Pick<ITracer,
		"params">;

	export interface TracerInitOptions extends TracerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Tracer} instead.
	 */
	type TracerMixin = ITracer & Object;

	/**
	 * Tracing modules will subclass {@link Tracer} and register through
	 * {@link Gst.Tracer.register}. Modules can attach to various hook-types - see
	 * gst_tracing_register_hook(). When invoked they receive hook specific
	 * contextual data, which they must not modify.
	 */
	interface Tracer extends TracerMixin {}

	class Tracer {
		public constructor(options?: Partial<TracerInitOptions>);
		/**
		 * Create a new tracer-factory  capable of instantiating objects of the
		 * #type and add the factory to #plugin.
		 * @param plugin A {@link Plugin}, or %NULL for a static typefind function
		 * @param name The name for registering
		 * @param type GType of tracer to register
		 * @returns %TRUE, if the registering succeeded, %FALSE on error
		 */
		public static register(plugin: Plugin | null, name: string, type: GObject.Type): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TracerFactory} instead.
	 */
	interface ITracerFactory {
		/**
		 * Get the #GType for elements managed by this factory. The type can
		 * only be retrieved if the element factory is loaded, which can be
		 * assured with {@link Gst.PluginFeature.load}.
		 * @returns the #GType for tracers managed by this factory or 0 if
		 * the factory is not loaded.
		 */
		get_tracer_type(): GObject.Type;
	}

	type TracerFactoryInitOptionsMixin = PluginFeatureInitOptions
	export interface TracerFactoryInitOptions extends TracerFactoryInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TracerFactory} instead.
	 */
	type TracerFactoryMixin = ITracerFactory & PluginFeature;

	/**
	 * Use {@link Gst.TracerFactory.get_list} to get a list of tracer factories known to
	 * GStreamer.
	 */
	interface TracerFactory extends TracerFactoryMixin {}

	class TracerFactory {
		public constructor(options?: Partial<TracerFactoryInitOptions>);
		/**
		 * Gets the list of all registered tracer factories. You must free the
		 * list using {@link Gst.PluginFeature.list_free}.
		 * 
		 * The returned factories are sorted by factory name.
		 * 
		 * Free-function: gst_plugin_feature_list_free
		 * @returns the list of all
		 *     registered {@link TracerFactory}.
		 */
		public static get_list(): TracerFactory[];
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TracerRecord} instead.
	 */
	interface ITracerRecord {
		/**
		 * Serialzes the trace event into the log.
		 * 
		 * Right now this is using the gstreamer debug log with the level TRACE (7) and
		 * the category "GST_TRACER".
		 * 
		 * > Please note that this is still under discussion and subject to change.
		 */
		log(): void;
	}

	type TracerRecordInitOptionsMixin = ObjectInitOptions
	export interface TracerRecordInitOptions extends TracerRecordInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TracerRecord} instead.
	 */
	type TracerRecordMixin = ITracerRecord & Object;

	/**
	 * Tracing modules will create instances of this class to announce the data they
	 * will log and create a log formatter.
	 */
	interface TracerRecord extends TracerRecordMixin {}

	class TracerRecord {
		public constructor(options?: Partial<TracerRecordInitOptions>);
		/**
		 * Create a new tracer record. The record instance can be used to efficiently
		 * log entries using {@link Gst.TracerRecord.log}.
		 * 
		 * The #name without the ".class" suffix will be used for the log records.
		 * There must be fields for each value that gets logged where the field name is
		 * the value name. The field must be a {@link Structure} describing the value. The
		 * sub structure must contain a field called 'type' of %G_TYPE_GTYPE that
		 * contains the GType of the value. The resulting #GstTracerRecord will take
		 * ownership of the field structures.
		 * 
		 * The way to deal with optional values is to log an additional boolean before
		 * the optional field, that if %TRUE signals that the optional field is valid
		 * and %FALSE signals that the optional field should be ignored. One must still
		 * log a placeholder value for the optional field though. Please also note, that
		 * pointer type values must not be NULL - the underlying serialisation can not
		 * handle that right now.
		 * 
		 * > Please note that this is still under discussion and subject to change.
		 * @param name name of new record, must end on ".class".
		 * @param firstfield name of first field to set
		 * @returns a new {@link TracerRecord}
		 */
		public static new(name: string, firstfield: string): TracerRecord;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TypeFindFactory} instead.
	 */
	interface ITypeFindFactory {
		/**
		 * Calls the {@link TypeFindFunction} associated with this factory.
		 * @param find a properly setup {@link TypeFind} entry. The get_data
		 *     and suggest_type members must be set.
		 */
		call_function(find: TypeFind): void;
		/**
		 * Gets the {@link Caps} associated with a typefind factory.
		 * @returns the {@link Caps} associated with this factory
		 */
		get_caps(): Caps | null;
		/**
		 * Gets the extensions associated with a {@link TypeFindFactory}. The returned
		 * array should not be changed. If you need to change stuff in it, you should
		 * copy it using {@link G.strdupv}.  This function may return %NULL to indicate
		 * a 0-length list.
		 * @returns 
		 *     a %NULL-terminated array of extensions associated with this factory
		 */
		get_extensions(): string[] | null;
		/**
		 * Check whether the factory has a typefind function. Typefind factories
		 * without typefind functions are a last-effort fallback mechanism to
		 * e.g. assume a certain media type based on the file extension.
		 * @returns %TRUE if the factory has a typefind functions set, otherwise %FALSE
		 */
		has_function(): boolean;
	}

	type TypeFindFactoryInitOptionsMixin = PluginFeatureInitOptions
	export interface TypeFindFactoryInitOptions extends TypeFindFactoryInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TypeFindFactory} instead.
	 */
	type TypeFindFactoryMixin = ITypeFindFactory & PluginFeature;

	/**
	 * These functions allow querying information about registered typefind
	 * functions. How to create and register these functions is described in
	 * the section <link linkend="gstreamer-Writing-typefind-functions">
	 * "Writing typefind functions"</link>.
	 * 
	 * The following example shows how to write a very simple typefinder that
	 * identifies the given data. You can get quite a bit more complicated than
	 * that though.
	 * |[<!-- language="C" -->
	 *   typedef struct {
	 *     guint8 *data;
	 *     guint size;
	 *     guint probability;
	 *     GstCaps *data;
	 *   } MyTypeFind;
	 *   static void
	 *   my_peek (gpointer data, gint64 offset, guint size)
	 *   {
	 *     MyTypeFind *find = (MyTypeFind *) data;
	 *     if (offset &gt;= 0 &amp;&amp; offset + size &lt;= find->size) {
	 *       return find->data + offset;
	 *     }
	 *     return NULL;
	 *   }
	 *   static void
	 *   my_suggest (gpointer data, guint probability, GstCaps *caps)
	 *   {
	 *     MyTypeFind *find = (MyTypeFind *) data;
	 *     if (probability &gt; find->probability) {
	 *       find->probability = probability;
	 *       gst_caps_replace (&amp;find->caps, caps);
	 *     }
	 *   }
	 *   static GstCaps *
	 *   find_type (guint8 *data, guint size)
	 *   {
	 *     GList *walk, *type_list;
	 *     MyTypeFind find = {data, size, 0, NULL};
	 *     GstTypeFind gst_find = {my_peek, my_suggest, &amp;find, };
	 *     walk = type_list = gst_type_find_factory_get_list ();
	 *     while (walk) {
	 *       GstTypeFindFactory *factory = GST_TYPE_FIND_FACTORY (walk->data);
	 *       walk = g_list_next (walk)
	 *       gst_type_find_factory_call_function (factory, &amp;gst_find);
	 *     }
	 *     g_list_free (type_list);
	 *     return find.caps;
	 *   };
	 * ]|
	 */
	interface TypeFindFactory extends TypeFindFactoryMixin {}

	class TypeFindFactory {
		public constructor(options?: Partial<TypeFindFactoryInitOptions>);
		/**
		 * Gets the list of all registered typefind factories. You must free the
		 * list using {@link Gst.PluginFeature.list_free}.
		 * 
		 * The returned factories are sorted by highest rank first, and then by
		 * factory name.
		 * 
		 * Free-function: gst_plugin_feature_list_free
		 * @returns the list of all
		 *     registered {@link TypeFindFactory}.
		 */
		public static get_list(): TypeFindFactory[];
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ValueArray} instead.
	 */
	interface IValueArray {

	}

	type ValueArrayInitOptionsMixin  = {};
	export interface ValueArrayInitOptions extends ValueArrayInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ValueArray} instead.
	 */
	type ValueArrayMixin = IValueArray;

	/**
	 * A fundamental type that describes an ordered list of #GValue
	 */
	interface ValueArray extends ValueArrayMixin {}

	class ValueArray {
		public constructor(options?: Partial<ValueArrayInitOptions>);
		/**
		 * Appends #append_value to the GstValueArray in #value.
		 * @param value a #GValue of type #GST_TYPE_ARRAY
		 * @param append_value the value to append
		 */
		public static append_and_take_value(value: GObject.Value, append_value: GObject.Value): void;
		/**
		 * Appends #append_value to the GstValueArray in #value.
		 * @param value a #GValue of type #GST_TYPE_ARRAY
		 * @param append_value the value to append
		 */
		public static append_value(value: GObject.Value, append_value: GObject.Value): void;
		/**
		 * Gets the number of values contained in #value.
		 * @param value a #GValue of type #GST_TYPE_ARRAY
		 * @returns the number of values
		 */
		public static get_size(value: GObject.Value): number;
		/**
		 * Gets the value that is a member of the array contained in #value and
		 * has the index #index.
		 * @param value a #GValue of type #GST_TYPE_ARRAY
		 * @param index index of value to get from the array
		 * @returns the value at the given index
		 */
		public static get_value(value: GObject.Value, index: number): GObject.Value;
		/**
		 * Initializes and pre-allocates a #GValue of type #GST_TYPE_ARRAY.
		 * @param value A zero-filled (uninitialized) #GValue structure
		 * @param prealloc The number of entries to pre-allocate in the array
		 * @returns The #GValue structure that has been passed in
		 */
		public static init(value: GObject.Value, prealloc: number): GObject.Value;
		/**
		 * Prepends #prepend_value to the GstValueArray in #value.
		 * @param value a #GValue of type #GST_TYPE_ARRAY
		 * @param prepend_value the value to prepend
		 */
		public static prepend_value(value: GObject.Value, prepend_value: GObject.Value): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ValueList} instead.
	 */
	interface IValueList {

	}

	type ValueListInitOptionsMixin  = {};
	export interface ValueListInitOptions extends ValueListInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ValueList} instead.
	 */
	type ValueListMixin = IValueList;

	/**
	 * A fundamental type that describes an unordered list of #GValue
	 */
	interface ValueList extends ValueListMixin {}

	class ValueList {
		public constructor(options?: Partial<ValueListInitOptions>);
		/**
		 * Appends #append_value to the GstValueList in #value.
		 * @param value a #GValue of type #GST_TYPE_LIST
		 * @param append_value the value to append
		 */
		public static append_and_take_value(value: GObject.Value, append_value: GObject.Value): void;
		/**
		 * Appends #append_value to the GstValueList in #value.
		 * @param value a #GValue of type #GST_TYPE_LIST
		 * @param append_value the value to append
		 */
		public static append_value(value: GObject.Value, append_value: GObject.Value): void;
		/**
		 * Concatenates copies of #value1 and #value2 into a list.  Values that are not
		 * of type #GST_TYPE_LIST are treated as if they were lists of length 1.
		 * #dest will be initialized to the type #GST_TYPE_LIST.
		 * @param value1 a #GValue
		 * @param value2 a #GValue
		 * @returns an uninitialized #GValue to take the result
		 */
		public static concat(value1: GObject.Value, value2: GObject.Value): GObject.Value;
		/**
		 * Gets the number of values contained in #value.
		 * @param value a #GValue of type #GST_TYPE_LIST
		 * @returns the number of values
		 */
		public static get_size(value: GObject.Value): number;
		/**
		 * Gets the value that is a member of the list contained in #value and
		 * has the index #index.
		 * @param value a #GValue of type #GST_TYPE_LIST
		 * @param index index of value to get from the list
		 * @returns the value at the given index
		 */
		public static get_value(value: GObject.Value, index: number): GObject.Value;
		/**
		 * Initializes and pre-allocates a #GValue of type #GST_TYPE_LIST.
		 * @param value A zero-filled (uninitialized) #GValue structure
		 * @param prealloc The number of entries to pre-allocate in the list
		 * @returns The #GValue structure that has been passed in
		 */
		public static init(value: GObject.Value, prealloc: number): GObject.Value;
		/**
		 * Merges copies of #value1 and #value2.  Values that are not
		 * of type #GST_TYPE_LIST are treated as if they were lists of length 1.
		 * 
		 * The result will be put into #dest and will either be a list that will not
		 * contain any duplicates, or a non-list type (if #value1 and #value2
		 * were equal).
		 * @param value1 a #GValue
		 * @param value2 a #GValue
		 * @returns an uninitialized #GValue to take the result
		 */
		public static merge(value1: GObject.Value, value2: GObject.Value): GObject.Value;
		/**
		 * Prepends #prepend_value to the GstValueList in #value.
		 * @param value a #GValue of type #GST_TYPE_LIST
		 * @param prepend_value the value to prepend
		 */
		public static prepend_value(value: GObject.Value, prepend_value: GObject.Value): void;
	}

	export interface AllocationParamsInitOptions {}
	/**
	 * Parameters to control the allocation of memory
	 */
	interface AllocationParams {}
	class AllocationParams {
		public constructor(options?: Partial<AllocationParamsInitOptions>);
		/**
		 * flags to control allocation
		 */
		public flags: MemoryFlags;
		/**
		 * the desired alignment of the memory
		 */
		public align: number;
		/**
		 * the desired prefix
		 */
		public prefix: number;
		/**
		 * the desired padding
		 */
		public padding: number;
		public readonly _gst_reserved: any[];
		/**
		 * Create a copy of #params.
		 * 
		 * Free-function: gst_allocation_params_free
		 * @returns a new #{@link AllocationParams}, free with
		 * {@link Gst.AllocationParams.free}.
		 */
		public copy(): AllocationParams | null;
		/**
		 * Free #params
		 */
		public free(): void;
		/**
		 * Initialize #params to its default values
		 */
		public init(): void;
	}

	export interface AtomicQueueInitOptions {}
	/**
	 * The {@link AtomicQueue} object implements a queue that can be used from multiple
	 * threads without performing any blocking operations.
	 */
	interface AtomicQueue {}
	class AtomicQueue {
		public constructor(options?: Partial<AtomicQueueInitOptions>);
		/**
		 * Create a new atomic queue instance. #initial_size will be rounded up to the
		 * nearest power of 2 and used as the initial size of the queue.
		 * @param initial_size initial queue size
		 * @returns a new {@link AtomicQueue}
		 */
		public static new(initial_size: number): AtomicQueue;
		/**
		 * Get the amount of items in the queue.
		 * @returns the number of elements in the queue.
		 */
		public length(): number;
		/**
		 * Peek the head element of the queue without removing it from the queue.
		 * @returns the head element of #queue or
		 * %NULL when the queue is empty.
		 */
		public peek(): any | null;
		/**
		 * Get the head element of the queue.
		 * @returns the head element of #queue or %NULL when
		 * the queue is empty.
		 */
		public pop(): any | null;
		/**
		 * Append #data to the tail of the queue.
		 * @param data the data
		 */
		public push(data?: any | null): void;
		/**
		 * Increase the refcount of #queue.
		 */
		public ref(): void;
		/**
		 * Unref #queue and free the memory when the refcount reaches 0.
		 */
		public unref(): void;
	}

	export interface BufferInitOptions {}
	/**
	 * Buffers are the basic unit of data transfer in GStreamer. They contain the
	 * timing and offset along with other arbitrary metadata that is associated
	 * with the {@link Memory} blocks that the buffer contains.
	 * 
	 * Buffers are usually created with {@link Gst.Buffer.new}. After a buffer has been
	 * created one will typically allocate memory for it and add it to the buffer.
	 * The following example creates a buffer that can hold a given video frame
	 * with a given width, height and bits per plane.
	 * |[<!-- language="C" -->
	 *   GstBuffer *buffer;
	 *   GstMemory *memory;
	 *   gint size, width, height, bpp;
	 *   ...
	 *   size = width * height * bpp;
	 *   buffer = gst_buffer_new ();
	 *   memory = gst_allocator_alloc (NULL, size, NULL);
	 *   gst_buffer_insert_memory (buffer, -1, memory);
	 *   ...
	 * ]|
	 * 
	 * Alternatively, use gst_buffer_new_allocate() to create a buffer with
	 * preallocated data of a given size.
	 * 
	 * Buffers can contain a list of #GstMemory objects. You can retrieve how many
	 * memory objects with gst_buffer_n_memory() and you can get a pointer
	 * to memory with gst_buffer_peek_memory()
	 * 
	 * A buffer will usually have timestamps, and a duration, but neither of these
	 * are guaranteed (they may be set to #GST_CLOCK_TIME_NONE). Whenever a
	 * meaningful value can be given for these, they should be set. The timestamps
	 * and duration are measured in nanoseconds (they are #GstClockTime values).
	 * 
	 * The buffer DTS refers to the timestamp when the buffer should be decoded and
	 * is usually monotonically increasing. The buffer PTS refers to the timestamp when
	 * the buffer content should be presented to the user and is not always
	 * monotonically increasing.
	 * 
	 * A buffer can also have one or both of a start and an end offset. These are
	 * media-type specific. For video buffers, the start offset will generally be
	 * the frame number. For audio buffers, it will be the number of samples
	 * produced so far. For compressed data, it could be the byte offset in a
	 * source or destination file. Likewise, the end offset will be the offset of
	 * the end of the buffer. These can only be meaningfully interpreted if you
	 * know the media type of the buffer (the preceding CAPS event). Either or both
	 * can be set to #GST_BUFFER_OFFSET_NONE.
	 * 
	 * gst_buffer_ref() is used to increase the refcount of a buffer. This must be
	 * done when you want to keep a handle to the buffer after pushing it to the
	 * next element. The buffer refcount determines the writability of the buffer, a
	 * buffer is only writable when the refcount is exactly 1, i.e. when the caller
	 * has the only reference to the buffer.
	 * 
	 * To efficiently create a smaller buffer out of an existing one, you can
	 * use gst_buffer_copy_region(). This method tries to share the memory objects
	 * between the two buffers.
	 * 
	 * If a plug-in wants to modify the buffer data or metadata in-place, it should
	 * first obtain a buffer that is safe to modify by using
	 * gst_buffer_make_writable().  This function is optimized so that a copy will
	 * only be made when it is necessary.
	 * 
	 * Several flags of the buffer can be set and unset with the
	 * GST_BUFFER_FLAG_SET() and GST_BUFFER_FLAG_UNSET() macros. Use
	 * GST_BUFFER_FLAG_IS_SET() to test if a certain #GstBufferFlags flag is set.
	 * 
	 * Buffers can be efficiently merged into a larger buffer with
	 * gst_buffer_append(). Copying of memory will only be done when absolutely
	 * needed.
	 * 
	 * Arbitrary extra metadata can be set on a buffer with gst_buffer_add_meta().
	 * Metadata can be retrieved with gst_buffer_get_meta(). See also #GstMeta
	 * 
	 * An element should either unref the buffer or push it out on a src pad
	 * using gst_pad_push() (see #GstPad).
	 * 
	 * Buffers are usually freed by unreffing them with gst_buffer_unref(). When
	 * the refcount drops to 0, any memory and metadata pointed to by the buffer is
	 * unreffed as well. Buffers allocated from a #GstBufferPool will be returned to
	 * the pool when the refcount drops to 0.
	 * 
	 * The #GstParentBufferMeta is a meta which can be attached to a #GstBuffer
	 * to hold a reference to another buffer that is only released when the child
	 * #GstBuffer is released.
	 * 
	 * Typically, #GstParentBufferMeta is used when the child buffer is directly
	 * using the #GstMemory of the parent buffer, and wants to prevent the parent
	 * buffer from being returned to a buffer pool until the #GstMemory is available
	 * for re-use. (Since: 1.6)
	 */
	interface Buffer {}
	class Buffer {
		public constructor(options?: Partial<BufferInitOptions>);
		/**
		 * Creates a newly allocated buffer without any data.
		 * 
		 * MT safe.
		 * @returns the new {@link Buffer}.
		 */
		public static new(): Buffer;
		/**
		 * Tries to create a newly allocated buffer with data of the given size and
		 * extra parameters from #allocator. If the requested amount of memory can't be
		 * allocated, %NULL will be returned. The allocated buffer memory is not cleared.
		 * 
		 * When #allocator is %NULL, the default memory allocator will be used.
		 * 
		 * Note that when #size == 0, the buffer will not have memory associated with it.
		 * 
		 * MT safe.
		 * @param allocator the {@link Allocator} to use, or %NULL to use the
		 *     default allocator
		 * @param size the size in bytes of the new buffer's data.
		 * @param params optional parameters
		 * @returns a new {@link Buffer}, or %NULL if
		 *     the memory couldn't be allocated.
		 */
		public static new_allocate(allocator: Allocator | null, size: number, params?: AllocationParams | null): Buffer | null;
		/**
		 * Creates a new buffer that wraps the given #data. The memory will be freed
		 * with g_free and will be marked writable.
		 * 
		 * MT safe.
		 * @param data data to wrap
		 * @returns a new {@link Buffer}
		 */
		public static new_wrapped(data: number[]): Buffer;
		/**
		 * Creates a new {@link Buffer} that wraps the given #bytes. The data inside
		 * #bytes cannot be %NULL and the resulting buffer will be marked as read only.
		 * 
		 * MT safe.
		 * @param bytes a #GBytes to wrap
		 * @returns a new {@link Buffer} wrapping #bytes
		 */
		public static new_wrapped_bytes(bytes: GLib.Bytes): Buffer;
		/**
		 * Allocate a new buffer that wraps the given memory. #data must point to
		 * #maxsize of memory, the wrapped buffer will have the region from #offset and
		 * #size visible.
		 * 
		 * When the buffer is destroyed, #notify will be called with #user_data.
		 * 
		 * The prefix/padding must be filled with 0 if #flags contains
		 * #GST_MEMORY_FLAG_ZERO_PREFIXED and #GST_MEMORY_FLAG_ZERO_PADDED respectively.
		 * @param flags {@link MemoryFlags}
		 * @param data data to wrap
		 * @param maxsize allocated size of #data
		 * @param offset offset in #data
		 * @returns a new {@link Buffer}
		 */
		public static new_wrapped_full(flags: MemoryFlags, data: number[], maxsize: number, offset: number): Buffer;
		/**
		 * Get the maximum amount of memory blocks that a buffer can hold. This is a
		 * compile time constant that can be queried with the function.
		 * 
		 * When more memory blocks are added, existing memory blocks will be merged
		 * together to make room for the new block.
		 * @returns the maximum amount of memory blocks that a buffer can hold.
		 */
		public static get_max_memory(): number;
		/**
		 * the parent structure
		 */
		public mini_object: MiniObject;
		/**
		 * pointer to the pool owner of the buffer
		 */
		public pool: BufferPool;
		/**
		 * presentation timestamp of the buffer, can be #GST_CLOCK_TIME_NONE when the
		 *     pts is not known or relevant. The pts contains the timestamp when the
		 *     media should be presented to the user.
		 */
		public pts: ClockTime;
		/**
		 * decoding timestamp of the buffer, can be #GST_CLOCK_TIME_NONE when the
		 *     dts is not known or relevant. The dts contains the timestamp when the
		 *     media should be processed.
		 */
		public dts: ClockTime;
		/**
		 * duration in time of the buffer data, can be #GST_CLOCK_TIME_NONE
		 *     when the duration is not known or relevant.
		 */
		public duration: ClockTime;
		/**
		 * a media specific offset for the buffer data.
		 *     For video frames, this is the frame number of this buffer.
		 *     For audio samples, this is the offset of the first sample in this buffer.
		 *     For file data or compressed data this is the byte offset of the first
		 *       byte in this buffer.
		 */
		public offset: number;
		/**
		 * the last offset contained in this buffer. It has the same
		 *     format as #offset.
		 */
		public offset_end: number;
		/**
		 * Add metadata for #info to #buffer using the parameters in #params.
		 * @param info a {@link MetaInfo}
		 * @param params params for #info
		 * @returns the metadata for the api in #info on #buffer.
		 */
		public add_meta(info: MetaInfo, params?: any | null): Meta | null;
		/**
		 * Add a {@link ParentBufferMeta} to #buffer that holds a reference on
		 * #ref until the buffer is freed.
		 * @param ref a {@link Buffer} to ref
		 * @returns The {@link ParentBufferMeta} that was added to the buffer
		 */
		public add_parent_buffer_meta(ref: Buffer): ParentBufferMeta | null;
		/**
		 * Attaches protection metadata to a {@link Buffer}.
		 * @param info a {@link Structure} holding cryptographic
		 *     information relating to the sample contained in #buffer. This
		 *     function takes ownership of #info.
		 * @returns a pointer to the added {@link ProtectionMeta} if successful; %NULL if
		 * unsuccessful.
		 */
		public add_protection_meta(info: Structure): ProtectionMeta;
		/**
		 * Add a {@link ReferenceTimestampMeta} to #buffer that holds a #timestamp and
		 * optionally #duration based on a specific timestamp #reference. See the
		 * documentation of #GstReferenceTimestampMeta for details.
		 * @param reference identifier for the timestamp reference.
		 * @param timestamp timestamp
		 * @param duration duration, or %GST_CLOCK_TIME_NONE
		 * @returns The {@link ReferenceTimestampMeta} that was added to the buffer
		 */
		public add_reference_timestamp_meta(reference: Caps, timestamp: ClockTime, duration: ClockTime): ReferenceTimestampMeta | null;
		/**
		 * Append all the memory from #buf2 to #buf1. The result buffer will contain a
		 * concatenation of the memory of #buf1 and #buf2.
		 * @param buf2 the second source {@link Buffer} to append.
		 * @returns the new {@link Buffer} that contains the memory
		 *     of the two source buffers.
		 */
		public append(buf2: Buffer): Buffer;
		/**
		 * Append the memory block #mem to #buffer. This function takes
		 * ownership of #mem and thus doesn't increase its refcount.
		 * 
		 * This function is identical to {@link Gst.Buffer.insert_memory} with an index of -1.
		 * See gst_buffer_insert_memory() for more details.
		 * @param mem a {@link Memory}.
		 */
		public append_memory(mem: Memory): void;
		/**
		 * Append #size bytes at #offset from #buf2 to #buf1. The result buffer will
		 * contain a concatenation of the memory of #buf1 and the requested region of
		 * #buf2.
		 * @param buf2 the second source {@link Buffer} to append.
		 * @param offset the offset in #buf2
		 * @param size the size or -1 of #buf2
		 * @returns the new {@link Buffer} that contains the memory
		 *     of the two source buffers.
		 */
		public append_region(buf2: Buffer, offset: number, size: number): Buffer;
		/**
		 * Create a copy of the given buffer. This will make a newly allocated
		 * copy of the data the source buffer contains.
		 * @returns a new copy of #buf.
		 */
		public copy_deep(): Buffer;
		/**
		 * Copies the information from #src into #dest.
		 * 
		 * If #dest already contains memory and #flags contains GST_BUFFER_COPY_MEMORY,
		 * the memory from #src will be appended to #dest.
		 * 
		 * #flags indicate which fields will be copied.
		 * @param src a source {@link Buffer}
		 * @param flags flags indicating what metadata fields should be copied.
		 * @param offset offset to copy from
		 * @param size total size to copy. If -1, all data is copied.
		 * @returns %TRUE if the copying succeeded, %FALSE otherwise.
		 */
		public copy_into(src: Buffer, flags: BufferCopyFlags, offset: number, size: number): boolean;
		/**
		 * Creates a sub-buffer from #parent at #offset and #size.
		 * This sub-buffer uses the actual memory space of the parent buffer.
		 * This function will copy the offset and timestamp fields when the
		 * offset is 0. If not, they will be set to #GST_CLOCK_TIME_NONE and
		 * #GST_BUFFER_OFFSET_NONE.
		 * If #offset equals 0 and #size equals the total size of #buffer, the
		 * duration and offset end fields are also copied. If not they will be set
		 * to #GST_CLOCK_TIME_NONE and #GST_BUFFER_OFFSET_NONE.
		 * 
		 * MT safe.
		 * @param flags the {@link BufferCopyFlags}
		 * @param offset the offset into parent {@link Buffer} at which the new sub-buffer
		 *          begins.
		 * @param size the size of the new {@link Buffer} sub-buffer, in bytes. If -1, all
		 *        data is copied.
		 * @returns the new {@link Buffer} or %NULL if the arguments were
		 *     invalid.
		 */
		public copy_region(flags: BufferCopyFlags, offset: number, size: number): Buffer;
		/**
		 * Copy #size bytes starting from #offset in #buffer to #dest.
		 * @param offset the offset to extract
		 * @returns The amount of bytes extracted. This value can be lower than #size
		 *    when #buffer did not contain enough data.
		 * 
		 * 
		 *     the destination address
		 */
		public extract(offset: number): [ number, number[] ];
		/**
		 * Extracts a copy of at most #size bytes the data at #offset into
		 * newly-allocated memory. #dest must be freed using {@link G.free} when done.
		 * @param offset the offset to extract
		 * @param size the size to extract
		 * @returns A pointer where
		 *  the destination array will be written. Might be %NULL if the size is 0.
		 */
		public extract_dup(offset: number, size: number): number[];
		/**
		 * Copy #size bytes from #src to #buffer at #offset.
		 * @param offset the offset to fill
		 * @param src the source address
		 * @returns The amount of bytes copied. This value can be lower than #size
		 *    when #buffer did not contain enough data.
		 */
		public fill(offset: number, src: number[]): number;
		/**
		 * Find the memory blocks that span #size bytes starting from #offset
		 * in #buffer.
		 * 
		 * When this function returns %TRUE, #idx will contain the index of the first
		 * memory block where the byte for #offset can be found and #length contains the
		 * number of memory blocks containing the #size remaining bytes. #skip contains
		 * the number of bytes to skip in the memory block at #idx to get to the byte
		 * for #offset.
		 * 
		 * #size can be -1 to get all the memory blocks after #idx.
		 * @param offset an offset
		 * @param size a size
		 * @returns %TRUE when #size bytes starting from #offset could be found in
		 * #buffer and #idx, #length and #skip will be filled.
		 * 
		 * pointer to index
		 * 
		 * pointer to length
		 * 
		 * pointer to skip
		 */
		public find_memory(offset: number, size: number): [ boolean, number, number, number ];
		/**
		 * Call #func with #user_data for each meta in #buffer.
		 * 
		 * #func can modify the passed meta pointer or its contents. The return value
		 * of #func define if this function returns or if the remaining metadata items
		 * in the buffer should be skipped.
		 * @param func a {@link BufferForeachMetaFunc} to call
		 * @returns %FALSE when #func returned %FALSE for one of the metadata.
		 */
		public foreach_meta(func: BufferForeachMetaFunc): boolean;
		/**
		 * Get all the memory block in #buffer. The memory blocks will be merged
		 * into one large {@link Memory}.
		 * @returns a {@link Memory} that contains the merged memory.
		 * Use gst_memory_unref () after usage.
		 */
		public get_all_memory(): Memory | null;
		/**
		 * Get the {@link BufferFlags} flags set on this buffer.
		 * @returns the flags set on this buffer.
		 */
		public get_flags(): BufferFlags;
		/**
		 * Get the memory block at index #idx in #buffer.
		 * @param idx an index
		 * @returns a {@link Memory} that contains the data of the
		 * memory block at #idx. Use gst_memory_unref () after usage.
		 */
		public get_memory(idx: number): Memory | null;
		/**
		 * Get #length memory blocks in #buffer starting at #idx. The memory blocks will
		 * be merged into one large {@link Memory}.
		 * 
		 * If #length is -1, all memory starting from #idx is merged.
		 * @param idx an index
		 * @param length a length
		 * @returns a {@link Memory} that contains the merged data of #length
		 *    blocks starting at #idx. Use gst_memory_unref () after usage.
		 */
		public get_memory_range(idx: number, length: number): Memory | null;
		/**
		 * Get the metadata for #api on buffer. When there is no such metadata, %NULL is
		 * returned. If multiple metadata with the given #api are attached to this
		 * buffer only the first one is returned.  To handle multiple metadata with a
		 * given API use {@link Gst.Buffer.iterate_meta} or gst_buffer_foreach_meta() instead
		 * and check the meta->info.api member for the API type.
		 * @param api the #GType of an API
		 * @returns the metadata for #api on
		 * #buffer.
		 */
		public get_meta(api: GObject.Type): Meta | null;
		public get_n_meta(api_type: GObject.Type): number;
		/**
		 * Find the first {@link ReferenceTimestampMeta} on #buffer that conforms to
		 * #reference. Conformance is tested by checking if the meta's reference is a
		 * subset of #reference.
		 * 
		 * Buffers can contain multiple #GstReferenceTimestampMeta metadata items.
		 * @param reference a reference {@link Caps}
		 * @returns the {@link ReferenceTimestampMeta} or %NULL when there
		 * is no such metadata on #buffer.
		 */
		public get_reference_timestamp_meta(reference?: Caps | null): ReferenceTimestampMeta | null;
		/**
		 * Get the total size of the memory blocks in #buffer.
		 * @returns total size of the memory blocks in #buffer.
		 */
		public get_size(): number;
		/**
		 * Get the total size of the memory blocks in #b.
		 * 
		 * When not %NULL, #offset will contain the offset of the data in the
		 * first memory block in #buffer and #maxsize will contain the sum of
		 * the size and #offset and the amount of extra padding on the last
		 * memory block.  #offset and #maxsize can be used to resize the
		 * buffer memory blocks with {@link Gst.Buffer.resize}.
		 * @returns total size of the memory blocks in #buffer.
		 * 
		 * a pointer to the offset
		 * 
		 * a pointer to the maxsize
		 */
		public get_sizes(): [ number, number | null, number | null ];
		/**
		 * Get the total size of #length memory blocks stating from #idx in #buffer.
		 * 
		 * When not %NULL, #offset will contain the offset of the data in the
		 * memory block in #buffer at #idx and #maxsize will contain the sum of the size
		 * and #offset and the amount of extra padding on the memory block at #idx +
		 * #length -1.
		 * #offset and #maxsize can be used to resize the buffer memory blocks with
		 * {@link Gst.Buffer.resize_range}.
		 * @param idx an index
		 * @param length a length
		 * @returns total size of #length memory blocks starting at #idx in #buffer.
		 * 
		 * a pointer to the offset
		 * 
		 * a pointer to the maxsize
		 */
		public get_sizes_range(idx: number, length: number): [ number, number | null, number | null ];
		/**
		 * Gives the status of a specific flag on a buffer.
		 * @param flags the {@link BufferFlags} flag to check.
		 * @returns %TRUE if all flags in #flags are found on #buffer.
		 */
		public has_flags(flags: BufferFlags): boolean;
		/**
		 * Insert the memory block #mem to #buffer at #idx. This function takes ownership
		 * of #mem and thus doesn't increase its refcount.
		 * 
		 * Only {@link Gst.buffer.get_max_memory} can be added to a buffer. If more memory is
		 * added, existing memory blocks will automatically be merged to make room for
		 * the new memory.
		 * @param idx the index to add the memory at, or -1 to append it to the end
		 * @param mem a {@link Memory}.
		 */
		public insert_memory(idx: number, mem: Memory): void;
		/**
		 * Check if all memory blocks in #buffer are writable.
		 * 
		 * Note that this function does not check if #buffer is writable, use
		 * {@link Gst.Buffer.is_writable} to check that if needed.
		 * @returns %TRUE if all memory blocks in #buffer are writable
		 */
		public is_all_memory_writable(): boolean;
		/**
		 * Check if #length memory blocks in #buffer starting from #idx are writable.
		 * 
		 * #length can be -1 to check all the memory blocks after #idx.
		 * 
		 * Note that this function does not check if #buffer is writable, use
		 * {@link Gst.Buffer.is_writable} to check that if needed.
		 * @param idx an index
		 * @param length a length should not be 0
		 * @returns %TRUE if the memory range is writable
		 */
		public is_memory_range_writable(idx: number, length: number): boolean;
		/**
		 * Retrieve the next {@link Meta} after #current. If #state points
		 * to %NULL, the first metadata is returned.
		 * 
		 * #state will be updated with an opaque state pointer
		 * @returns The next {@link Meta} or %NULL
		 * when there are no more items.
		 * 
		 * an opaque state pointer
		 */
		public iterate_meta(): [ Meta | null, any | null ];
		/**
		 * Retrieve the next {@link Meta} of type #meta_api_type after the current one
		 * according to #state. If #state points to %NULL, the first metadata of
		 * type #meta_api_type is returned.
		 * 
		 * #state will be updated with an opaque state pointer
		 * @param meta_api_type only return {@link Meta} of this type
		 * @returns The next {@link Meta} of type
		 * #meta_api_type or %NULL when there are no more items.
		 * 
		 * an opaque state pointer
		 */
		public iterate_meta_filtered(meta_api_type: GObject.Type): [ Meta | null, any | null ];
		/**
		 * This function fills #info with the {@link MapInfo} of all merged memory
		 * blocks in #buffer.
		 * 
		 * #flags describe the desired access of the memory. When #flags is
		 * #GST_MAP_WRITE, #buffer should be writable (as returned from
		 * {@link Gst.Buffer.is_writable}).
		 * 
		 * When #buffer is writable but the memory isn't, a writable copy will
		 * automatically be created and returned. The readonly copy of the
		 * buffer memory will then also be replaced with this writable copy.
		 * 
		 * The memory in #info should be unmapped with gst_buffer_unmap() after
		 * usage.
		 * @param flags flags for the mapping
		 * @returns %TRUE if the map succeeded and #info contains valid data.
		 * 
		 * info about the mapping
		 */
		public map(flags: MapFlags): [ boolean, MapInfo ];
		/**
		 * This function fills #info with the {@link MapInfo} of #length merged memory blocks
		 * starting at #idx in #buffer. When #length is -1, all memory blocks starting
		 * from #idx are merged and mapped.
		 * 
		 * #flags describe the desired access of the memory. When #flags is
		 * #GST_MAP_WRITE, #buffer should be writable (as returned from
		 * {@link Gst.Buffer.is_writable}).
		 * 
		 * When #buffer is writable but the memory isn't, a writable copy will
		 * automatically be created and returned. The readonly copy of the buffer memory
		 * will then also be replaced with this writable copy.
		 * 
		 * The memory in #info should be unmapped with gst_buffer_unmap() after usage.
		 * @param idx an index
		 * @param length a length
		 * @param flags flags for the mapping
		 * @returns %TRUE if the map succeeded and #info contains valid
		 * data.
		 * 
		 * info about the mapping
		 */
		public map_range(idx: number, length: number, flags: MapFlags): [ boolean, MapInfo ];
		/**
		 * Compare #size bytes starting from #offset in #buffer with the memory in #mem.
		 * @param offset the offset in #buffer
		 * @param mem the memory to compare
		 * @returns 0 if the memory is equal.
		 */
		public memcmp(offset: number, mem: number[]): number;
		/**
		 * Fill #buf with #size bytes with #val starting from #offset.
		 * @param offset the offset in #buffer
		 * @param val the value to set
		 * @param size the size to set
		 * @returns The amount of bytes filled. This value can be lower than #size
		 *    when #buffer did not contain enough data.
		 */
		public memset(offset: number, val: number, size: number): number;
		/**
		 * Get the amount of memory blocks that this buffer has. This amount is never
		 * larger than what {@link Gst.buffer.get_max_memory} returns.
		 * @returns the number of memory blocks this buffer is made of.
		 */
		public n_memory(): number;
		/**
		 * Get the memory block at #idx in #buffer. The memory block stays valid until
		 * the memory block in #buffer is removed, replaced or merged, typically with
		 * any call that modifies the memory in #buffer.
		 * @param idx an index
		 * @returns the {@link Memory} at #idx.
		 */
		public peek_memory(idx: number): Memory | null;
		/**
		 * Prepend the memory block #mem to #buffer. This function takes
		 * ownership of #mem and thus doesn't increase its refcount.
		 * 
		 * This function is identical to {@link Gst.Buffer.insert_memory} with an index of 0.
		 * See gst_buffer_insert_memory() for more details.
		 * @param mem a {@link Memory}.
		 */
		public prepend_memory(mem: Memory): void;
		/**
		 * Remove all the memory blocks in #buffer.
		 */
		public remove_all_memory(): void;
		/**
		 * Remove the memory block in #b at index #i.
		 * @param idx an index
		 */
		public remove_memory(idx: number): void;
		/**
		 * Remove #length memory blocks in #buffer starting from #idx.
		 * 
		 * #length can be -1, in which case all memory starting from #idx is removed.
		 * @param idx an index
		 * @param length a length
		 */
		public remove_memory_range(idx: number, length: number): void;
		/**
		 * Remove the metadata for #meta on #buffer.
		 * @param meta a {@link Meta}
		 * @returns %TRUE if the metadata existed and was removed, %FALSE if no such
		 * metadata was on #buffer.
		 */
		public remove_meta(meta: Meta): boolean;
		/**
		 * Replaces all memory in #buffer with #mem.
		 * @param mem a {@link Memory}
		 */
		public replace_all_memory(mem: Memory): void;
		/**
		 * Replaces the memory block at index #idx in #buffer with #mem.
		 * @param idx an index
		 * @param mem a {@link Memory}
		 */
		public replace_memory(idx: number, mem: Memory): void;
		/**
		 * Replaces #length memory blocks in #buffer starting at #idx with #mem.
		 * 
		 * If #length is -1, all memory starting from #idx will be removed and
		 * replaced with #mem.
		 * 
		 * #buffer should be writable.
		 * @param idx an index
		 * @param length a length should not be 0
		 * @param mem a {@link Memory}
		 */
		public replace_memory_range(idx: number, length: number, mem: Memory): void;
		/**
		 * Set the offset and total size of the memory blocks in #buffer.
		 * @param offset the offset adjustment
		 * @param size the new size or -1 to just adjust the offset
		 */
		public resize(offset: number, size: number): void;
		/**
		 * Set the total size of the #length memory blocks starting at #idx in
		 * #buffer
		 * @param idx an index
		 * @param length a length
		 * @param offset the offset adjustment
		 * @param size the new size or -1 to just adjust the offset
		 * @returns %TRUE if resizing succeeded, %FALSE otherwise.
		 */
		public resize_range(idx: number, length: number, offset: number, size: number): boolean;
		/**
		 * Sets one or more buffer flags on a buffer.
		 * @param flags the {@link BufferFlags} to set.
		 * @returns %TRUE if #flags were successfully set on buffer.
		 */
		public set_flags(flags: BufferFlags): boolean;
		/**
		 * Set the total size of the memory blocks in #buffer.
		 * @param size the new size
		 */
		public set_size(size: number): void;
		/**
		 * Release the memory previously mapped with {@link Gst.Buffer.map}.
		 * @param info a {@link MapInfo}
		 */
		public unmap(info: MapInfo): void;
		/**
		 * Clears one or more buffer flags.
		 * @param flags the {@link BufferFlags} to clear
		 * @returns true if #flags is successfully cleared from buffer.
		 */
		public unset_flags(flags: BufferFlags): boolean;
	}

	export interface BufferListInitOptions {}
	/**
	 * Buffer lists are an object containing a list of buffers.
	 * 
	 * Buffer lists are created with {@link Gst.BufferList.new} and filled with data
	 * using a gst_buffer_list_insert().
	 * 
	 * Buffer lists can be pushed on a srcpad with gst_pad_push_list(). This is
	 * interesting when multiple buffers need to be pushed in one go because it
	 * can reduce the amount of overhead for pushing each buffer individually.
	 */
	interface BufferList {}
	class BufferList {
		public constructor(options?: Partial<BufferListInitOptions>);
		/**
		 * Creates a new, empty {@link BufferList}. The caller is responsible for unreffing
		 * the returned #GstBufferList.
		 * 
		 * Free-function: gst_buffer_list_unref
		 * @returns the new {@link BufferList}. {@link Gst.BufferList.unref}
		 *     after usage.
		 */
		public static new(): BufferList;
		/**
		 * Creates a new, empty {@link BufferList}. The caller is responsible for unreffing
		 * the returned #GstBufferList. The list will have #size space preallocated so
		 * that memory reallocations can be avoided.
		 * 
		 * Free-function: gst_buffer_list_unref
		 * @param size an initial reserved size
		 * @returns the new {@link BufferList}. {@link Gst.BufferList.unref}
		 *     after usage.
		 */
		public static new_sized(size: number): BufferList;
		/**
		 * Calculates the size of the data contained in buffer list by adding the
		 * size of all buffers.
		 * @returns the size of the data contained in buffer list in bytes.
		 */
		public calculate_size(): number;
		/**
		 * Create a copy of the given buffer list. This will make a newly allocated
		 * copy of the buffer that the source buffer list contains.
		 * @returns a new copy of #list.
		 */
		public copy_deep(): BufferList;
		/**
		 * Call #func with #data for each buffer in #list.
		 * 
		 * #func can modify the passed buffer pointer or its contents. The return value
		 * of #func define if this function returns or if the remaining buffers in
		 * the list should be skipped.
		 * @param func a {@link BufferListFunc} to call
		 * @returns %TRUE when #func returned %TRUE for each buffer in #list or when
		 * #list is empty.
		 */
		public foreach(func: BufferListFunc): boolean;
		/**
		 * Get the buffer at #idx.
		 * 
		 * You must make sure that #idx does not exceed the number of
		 * buffers available.
		 * @param idx the index
		 * @returns the buffer at #idx in #group
		 *     or %NULL when there is no buffer. The buffer remains valid as
		 *     long as #list is valid and buffer is not removed from the list.
		 */
		public get(idx: number): Buffer | null;
		/**
		 * Gets the buffer at #idx, ensuring it is a writable buffer.
		 * 
		 * You must make sure that #idx does not exceed the number of
		 * buffers available.
		 * @param idx the index
		 * @returns the buffer at #idx in #group.
		 *     The returned  buffer remains valid as long as #list is valid and
		 *     the buffer is not removed from the list.
		 */
		public get_writable(idx: number): Buffer | null;
		/**
		 * Insert #buffer at #idx in #list. Other buffers are moved to make room for
		 * this new buffer.
		 * 
		 * A -1 value for #idx will append the buffer at the end.
		 * @param idx the index
		 * @param buffer a {@link Buffer}
		 */
		public insert(idx: number, buffer: Buffer): void;
		/**
		 * Returns the number of buffers in #list.
		 * @returns the number of buffers in the buffer list
		 */
		public length(): number;
		/**
		 * Remove #length buffers starting from #idx in #list. The following buffers
		 * are moved to close the gap.
		 * @param idx the index
		 * @param length the amount to remove
		 */
		public remove(idx: number, length: number): void;
	}

	export interface BufferPoolAcquireParamsInitOptions {}
	/**
	 * Parameters passed to the {@link Gst.BufferPool.acquire_buffer} function to control the
	 * allocation of the buffer.
	 * 
	 * The default implementation ignores the #start and #stop members but other
	 * implementations can use this extra information to decide what buffer to
	 * return.
	 */
	interface BufferPoolAcquireParams {}
	class BufferPoolAcquireParams {
		public constructor(options?: Partial<BufferPoolAcquireParamsInitOptions>);
		/**
		 * the format of #start and #stop
		 */
		public format: Format;
		/**
		 * the start position
		 */
		public start: number;
		/**
		 * the stop position
		 */
		public stop: number;
		/**
		 * additional flags
		 */
		public flags: BufferPoolAcquireFlags;
		public readonly _gst_reserved: any[];
	}

	export interface CapsInitOptions {}
	/**
	 * Caps (capabilities) are lightweight refcounted objects describing media types.
	 * They are composed of an array of {@link Structure}.
	 * 
	 * Caps are exposed on #GstPadTemplate to describe all possible types a
	 * given pad can handle. They are also stored in the #GstRegistry along with
	 * a description of the #GstElement.
	 * 
	 * Caps are exposed on the element pads using the {@link Gst.Pad.query_caps} pad
	 * function. This function describes the possible types that the pad can
	 * handle or produce at runtime.
	 * 
	 * A #GstCaps can be constructed with the following code fragment:
	 * |[<!-- language="C" -->
	 *   GstCaps *caps = gst_caps_new_simple ("video/x-raw",
	 *      "format", G_TYPE_STRING, "I420",
	 *      "framerate", GST_TYPE_FRACTION, 25, 1,
	 *      "pixel-aspect-ratio", GST_TYPE_FRACTION, 1, 1,
	 *      "width", G_TYPE_INT, 320,
	 *      "height", G_TYPE_INT, 240,
	 *      NULL);
	 * ]|
	 * 
	 * A #GstCaps is fixed when it has no properties with ranges or lists. Use
	 * gst_caps_is_fixed() to test for fixed caps. Fixed caps can be used in a
	 * caps event to notify downstream elements of the current media type.
	 * 
	 * Various methods exist to work with the media types such as subtracting
	 * or intersecting.
	 * 
	 * Be aware that the current #GstCaps / #GstStructure serialization into string
	 * has limited support for nested #GstCaps / #GstStructure fields. It can only
	 * support one level of nesting. Using more levels will lead to unexpected
	 * behavior when using serialization features, such as gst_caps_to_string() or
	 * gst_value_serialize() and their counterparts.
	 */
	interface Caps {}
	class Caps {
		public constructor(options?: Partial<CapsInitOptions>);
		/**
		 * Creates a new {@link Caps} that indicates that it is compatible with
		 * any media format.
		 * @returns the new {@link Caps}
		 */
		public static new_any(): Caps;
		/**
		 * Creates a new {@link Caps} that is empty.  That is, the returned
		 * #GstCaps contains no media formats.
		 * The #GstCaps is guaranteed to be writable.
		 * Caller is responsible for unreffing the returned caps.
		 * @returns the new {@link Caps}
		 */
		public static new_empty(): Caps;
		/**
		 * Creates a new {@link Caps} that contains one #GstStructure with name
		 * #media_type.
		 * Caller is responsible for unreffing the returned caps.
		 * @param media_type the media type of the structure
		 * @returns the new {@link Caps}
		 */
		public static new_empty_simple(media_type: string): Caps;
		/**
		 * Creates a new {@link Caps} and adds all the structures listed as
		 * arguments.  The list must be %NULL-terminated.  The structures
		 * are not copied; the returned #GstCaps owns the structures.
		 * @param struct1 the first structure to add
		 * @returns the new {@link Caps}
		 */
		public static new_full(struct1: Structure): Caps;
		/**
		 * Creates a new {@link Caps} and adds all the structures listed as
		 * arguments.  The list must be %NULL-terminated.  The structures
		 * are not copied; the returned #GstCaps owns the structures.
		 * @param structure the first structure to add
		 * @param var_args additional structures to add
		 * @returns the new {@link Caps}
		 */
		public static new_full_valist(structure: Structure, var_args: any[]): Caps;
		/**
		 * Creates a new {@link Caps} that contains one #GstStructure.  The
		 * structure is defined by the arguments, which have the same format
		 * as {@link Gst.Structure.new}.
		 * Caller is responsible for unreffing the returned caps.
		 * @param media_type the media type of the structure
		 * @param fieldname first field to set
		 * @returns the new {@link Caps}
		 */
		public static new_simple(media_type: string, fieldname: string): Caps;
		/**
		 * Converts #caps from a string representation.
		 * 
		 * The current implementation of serialization will lead to unexpected results
		 * when there are nested {@link Caps} / #GstStructure deeper than one level.
		 * @param string a string to convert to {@link Caps}
		 * @returns a newly allocated {@link Caps}
		 */
		public static from_string(string: string): Caps | null;
		/**
		 * the parent type
		 */
		public mini_object: MiniObject;
		/**
		 * Appends the structures contained in #caps2 to #caps1. The structures in
		 * #caps2 are not copied -- they are transferred to #caps1, and then #caps2 is
		 * freed. If either caps is ANY, the resulting caps will be ANY.
		 * @param caps2 the {@link Caps} to append
		 */
		public append(caps2: Caps): void;
		/**
		 * Appends #structure to #caps.  The structure is not copied; #caps
		 * becomes the owner of #structure.
		 * @param structure the {@link Structure} to append
		 */
		public append_structure(structure: Structure): void;
		/**
		 * Appends #structure with #features to #caps.  The structure is not copied; #caps
		 * becomes the owner of #structure.
		 * @param structure the {@link Structure} to append
		 * @param features the {@link CapsFeatures} to append
		 */
		public append_structure_full(structure: Structure, features?: CapsFeatures | null): void;
		/**
		 * Tries intersecting #caps1 and #caps2 and reports whether the result would not
		 * be empty
		 * @param caps2 a {@link Caps} to intersect
		 * @returns %TRUE if intersection would be not empty
		 */
		public can_intersect(caps2: Caps): boolean;
		/**
		 * Creates a new {@link Caps} as a copy of the old #caps. The new caps will have a
		 * refcount of 1, owned by the caller. The structures are copied as well.
		 * 
		 * Note that this function is the semantic equivalent of a {@link Gst.Caps.ref}
		 * followed by a gst_caps_make_writable(). If you only want to hold on to a
		 * reference to the data, you should use gst_caps_ref().
		 * 
		 * When you are finished with the caps, call gst_caps_unref() on it.
		 * @returns the new {@link Caps}
		 */
		public copy(): Caps;
		/**
		 * Creates a new {@link Caps} and appends a copy of the nth structure
		 * contained in #caps.
		 * @param nth the nth structure to copy
		 * @returns the new {@link Caps}
		 */
		public copy_nth(nth: number): Caps;
		/**
		 * Calls the provided function once for each structure and caps feature in the
		 * {@link Caps}. In contrast to {@link Gst.Caps.foreach}, the function may modify the
		 * structure and features. In contrast to gst_caps_filter_and_map_in_place(),
		 * the structure and features are removed from the caps if %FALSE is returned
		 * from the function.
		 * The caps must be mutable.
		 * @param func a function to call for each field
		 */
		public filter_and_map_in_place(func: CapsFilterMapFunc): void;
		/**
		 * Modifies the given #caps into a representation with only fixed
		 * values. First the caps will be truncated and then the first structure will be
		 * fixated with {@link Gst.Structure.fixate}.
		 * 
		 * This function takes ownership of #caps and will call gst_caps_make_writable()
		 * on it so you must not use #caps afterwards unless you keep an additional
		 * reference to it with gst_caps_ref().
		 * 
		 * Note that it is not guaranteed that the returned caps have exactly one
		 * structure. If #caps are empty caps then then returned caps will be
		 * the empty too and contain no structure at all.
		 * 
		 * Calling this function with any caps is not allowed.
		 * @returns the fixated caps
		 */
		public fixate(): Caps;
		/**
		 * Calls the provided function once for each structure and caps feature in the
		 * {@link Caps}. The function must not modify the fields.
		 * Also see {@link Gst.Caps.map_in_place} and gst_caps_filter_and_map_in_place().
		 * @param func a function to call for each field
		 * @returns %TRUE if the supplied function returns %TRUE for each call,
		 * %FALSE otherwise.
		 */
		public foreach(func: CapsForeachFunc): boolean;
		/**
		 * Finds the features in #caps that has the index #index, and
		 * returns it.
		 * 
		 * WARNING: This function takes a const GstCaps *, but returns a
		 * non-const GstCapsFeatures *.  This is for programming convenience --
		 * the caller should be aware that structures inside a constant
		 * {@link Caps} should not be modified. However, if you know the caps
		 * are writable, either because you have just copied them or made
		 * them writable with {@link Gst.Caps.make_writable}, you may modify the
		 * features returned in the usual way, e.g. with functions like
		 * gst_caps_features_add().
		 * 
		 * You do not need to free or unref the structure returned, it
		 * belongs to the #GstCaps.
		 * @param index the index of the structure
		 * @returns a pointer to the {@link CapsFeatures}
		 *     corresponding to #index
		 */
		public get_features(index: number): CapsFeatures | null;
		/**
		 * Gets the number of structures contained in #caps.
		 * @returns the number of structures that #caps contains
		 */
		public get_size(): number;
		/**
		 * Finds the structure in #caps that has the index #index, and
		 * returns it.
		 * 
		 * WARNING: This function takes a const GstCaps *, but returns a
		 * non-const GstStructure *.  This is for programming convenience --
		 * the caller should be aware that structures inside a constant
		 * {@link Caps} should not be modified. However, if you know the caps
		 * are writable, either because you have just copied them or made
		 * them writable with {@link Gst.Caps.make_writable}, you may modify the
		 * structure returned in the usual way, e.g. with functions like
		 * gst_structure_set().
		 * 
		 * You do not need to free or unref the structure returned, it
		 * belongs to the #GstCaps.
		 * @param index the index of the structure
		 * @returns a pointer to the {@link Structure} corresponding
		 *     to #index
		 */
		public get_structure(index: number): Structure;
		/**
		 * Creates a new {@link Caps} that contains all the formats that are common
		 * to both #caps1 and #caps2. Defaults to %GST_CAPS_INTERSECT_ZIG_ZAG mode.
		 * @param caps2 a {@link Caps} to intersect
		 * @returns the new {@link Caps}
		 */
		public intersect(caps2: Caps): Caps;
		/**
		 * Creates a new {@link Caps} that contains all the formats that are common
		 * to both #caps1 and #caps2, the order is defined by the #GstCapsIntersectMode
		 * used.
		 * @param caps2 a {@link Caps} to intersect
		 * @param mode The intersection algorithm/mode to use
		 * @returns the new {@link Caps}
		 */
		public intersect_full(caps2: Caps, mode: CapsIntersectMode): Caps;
		/**
		 * A given {@link Caps} structure is always compatible with another if
		 * every media format that is in the first is also contained in the
		 * second.  That is, #caps1 is a subset of #caps2.
		 * @param caps2 the {@link Caps} to test
		 * @returns %TRUE if #caps1 is a subset of #caps2.
		 */
		public is_always_compatible(caps2: Caps): boolean;
		/**
		 * Determines if #caps represents any media format.
		 * @returns %TRUE if #caps represents any format.
		 */
		public is_any(): boolean;
		/**
		 * Determines if #caps represents no media formats.
		 * @returns %TRUE if #caps represents no formats.
		 */
		public is_empty(): boolean;
		/**
		 * Checks if the given caps represent the same set of caps.
		 * @param caps2 another {@link Caps}
		 * @returns %TRUE if both caps are equal.
		 */
		public is_equal(caps2: Caps): boolean;
		/**
		 * Tests if two {@link Caps} are equal.  This function only works on fixed
		 * #GstCaps.
		 * @param caps2 the {@link Caps} to test
		 * @returns %TRUE if the arguments represent the same format
		 */
		public is_equal_fixed(caps2: Caps): boolean;
		/**
		 * Fixed {@link Caps} describe exactly one format, that is, they have exactly
		 * one structure, and each field in the structure describes a fixed type.
		 * Examples of non-fixed types are GST_TYPE_INT_RANGE and GST_TYPE_LIST.
		 * @returns %TRUE if #caps is fixed
		 */
		public is_fixed(): boolean;
		/**
		 * Checks if the given caps are exactly the same set of caps.
		 * @param caps2 another {@link Caps}
		 * @returns %TRUE if both caps are strictly equal.
		 */
		public is_strictly_equal(caps2: Caps): boolean;
		/**
		 * Checks if all caps represented by #subset are also represented by #superset.
		 * @param superset a potentially greater {@link Caps}
		 * @returns %TRUE if #subset is a subset of #superset
		 */
		public is_subset(superset: Caps): boolean;
		/**
		 * Checks if #structure is a subset of #caps. See {@link Gst.Caps.is_subset}
		 * for more information.
		 * @param structure a potential {@link Structure} subset of #caps
		 * @returns %TRUE if #structure is a subset of #caps
		 */
		public is_subset_structure(structure: Structure): boolean;
		/**
		 * Checks if #structure is a subset of #caps. See {@link Gst.Caps.is_subset}
		 * for more information.
		 * @param structure a potential {@link Structure} subset of #caps
		 * @param features a {@link CapsFeatures} for #structure
		 * @returns %TRUE if #structure is a subset of #caps
		 */
		public is_subset_structure_full(structure: Structure, features?: CapsFeatures | null): boolean;
		/**
		 * Calls the provided function once for each structure and caps feature in the
		 * {@link Caps}. In contrast to {@link Gst.Caps.foreach}, the function may modify but not
		 * delete the structures and features. The caps must be mutable.
		 * @param func a function to call for each field
		 * @returns %TRUE if the supplied function returns %TRUE for each call,
		 * %FALSE otherwise.
		 */
		public map_in_place(func: CapsMapFunc): boolean;
		/**
		 * Appends the structures contained in #caps2 to #caps1 if they are not yet
		 * expressed by #caps1. The structures in #caps2 are not copied -- they are
		 * transferred to a writable copy of #caps1, and then #caps2 is freed.
		 * If either caps is ANY, the resulting caps will be ANY.
		 * @param caps2 the {@link Caps} to merge in
		 * @returns the merged caps.
		 */
		public merge(caps2: Caps): Caps;
		/**
		 * Appends #structure to #caps if its not already expressed by #caps.
		 * @param structure the {@link Structure} to merge
		 * @returns the merged caps.
		 */
		public merge_structure(structure: Structure): Caps;
		/**
		 * Appends #structure with #features to #caps if its not already expressed by #caps.
		 * @param structure the {@link Structure} to merge
		 * @param features the {@link CapsFeatures} to merge
		 * @returns the merged caps.
		 */
		public merge_structure_full(structure: Structure, features?: CapsFeatures | null): Caps;
		/**
		 * Returns a {@link Caps} that represents the same set of formats as
		 * #caps, but contains no lists.  Each list is expanded into separate
		 * #GstStructures.
		 * 
		 * This function takes ownership of #caps and will call {@link Gst.Caps.make_writable}
		 * on it so you must not use #caps afterwards unless you keep an additional
		 * reference to it with gst_caps_ref().
		 * @returns the normalized {@link Caps}
		 */
		public normalize(): Caps;
		/**
		 * removes the structure with the given index from the list of structures
		 * contained in #caps.
		 * @param idx Index of the structure to remove
		 */
		public remove_structure(idx: number): void;
		/**
		 * Sets the {@link CapsFeatures} #features for the structure at #index.
		 * @param index the index of the structure
		 * @param features the {@link CapsFeatures} to set
		 */
		public set_features(index: number, features?: CapsFeatures | null): void;
		/**
		 * Sets the {@link CapsFeatures} #features for all the structures of #caps.
		 * @param features the {@link CapsFeatures} to set
		 */
		public set_features_simple(features?: CapsFeatures | null): void;
		/**
		 * Sets fields in a {@link Caps}.  The arguments must be passed in the same
		 * manner as {@link Gst.Structure.set}, and be %NULL-terminated.
		 * @param field first field to set
		 */
		public set_simple(field: string): void;
		/**
		 * Sets fields in a {@link Caps}.  The arguments must be passed in the same
		 * manner as {@link Gst.Structure.set}, and be %NULL-terminated.
		 * @param field first field to set
		 * @param varargs additional parameters
		 */
		public set_simple_valist(field: string, varargs: any[]): void;
		/**
		 * Sets the given #field on all structures of #caps to the given #value.
		 * This is a convenience function for calling {@link Gst.Structure.set_value} on
		 * all structures of #caps.
		 * @param field name of the field to set
		 * @param value value to set the field to
		 */
		public set_value(field: string, value: GObject.Value): void;
		/**
		 * Converts the given #caps into a representation that represents the
		 * same set of formats, but in a simpler form.  Component structures that are
		 * identical are merged.  Component structures that have values that can be
		 * merged are also merged.
		 * 
		 * This function takes ownership of #caps and will call {@link Gst.Caps.make_writable}
		 * on it if necessary, so you must not use #caps afterwards unless you keep an
		 * additional reference to it with gst_caps_ref().
		 * 
		 * This method does not preserve the original order of #caps.
		 * @returns The simplified caps.
		 */
		public simplify(): Caps;
		/**
		 * Retrieves the structure with the given index from the list of structures
		 * contained in #caps. The caller becomes the owner of the returned structure.
		 * @param index Index of the structure to retrieve
		 * @returns a pointer to the {@link Structure}
		 *     corresponding to #index.
		 */
		public steal_structure(index: number): Structure | null;
		/**
		 * Subtracts the #subtrahend from the #minuend.
		 * > This function does not work reliably if optional properties for caps
		 * > are included on one caps and omitted on the other.
		 * @param subtrahend {@link Caps} to subtract
		 * @returns the resulting caps
		 */
		public subtract(subtrahend: Caps): Caps;
		/**
		 * Converts #caps to a string representation.  This string representation
		 * can be converted back to a {@link Caps} by {@link Gst.caps.from_string}.
		 * 
		 * For debugging purposes its easier to do something like this:
		 * |[<!-- language="C" -->
		 * GST_LOG ("caps are %" GST_PTR_FORMAT, caps);
		 * ]|
		 * This prints the caps in human readable form.
		 * 
		 * The current implementation of serialization will lead to unexpected results
		 * when there are nested #GstCaps / #GstStructure deeper than one level.
		 * @returns a newly allocated string representing #caps.
		 */
		public to_string(): string;
		/**
		 * Discard all but the first structure from #caps. Useful when
		 * fixating.
		 * 
		 * This function takes ownership of #caps and will call {@link Gst.Caps.make_writable}
		 * on it if necessary, so you must not use #caps afterwards unless you keep an
		 * additional reference to it with gst_caps_ref().
		 * 
		 * Note that it is not guaranteed that the returned caps have exactly one
		 * structure. If #caps is any or empty caps then then returned caps will be
		 * the same and contain no structure at all.
		 * @returns truncated caps
		 */
		public truncate(): Caps;
	}

	export interface CapsFeaturesInitOptions {}
	/**
	 * {@link CapsFeatures} can optionally be set on a #GstCaps to add requirements
	 * for additional features for a specific #GstStructure. Caps structures with
	 * the same name but with a non-equal set of caps features are not compatible.
	 * If a pad supports multiple sets of features it has to add multiple equal
	 * structures with different feature sets to the caps.
	 * 
	 * Empty #GstCapsFeatures are equivalent with the #GstCapsFeatures that only
	 * contain #GST_CAPS_FEATURE_MEMORY_SYSTEM_MEMORY. ANY #GstCapsFeatures as
	 * created by {@link Gst.CapsFeatures.new_any} are equal to any other #GstCapsFeatures
	 * and can be used to specify that any #GstCapsFeatures would be supported, e.g.
	 * for elements that don't touch buffer memory. #GstCaps with ANY #GstCapsFeatures
	 * are considered non-fixed and during negotiation some #GstCapsFeatures have
	 * to be selected.
	 * 
	 * Examples for caps features would be the requirement of a specific #GstMemory
	 * types or the requirement of having a specific #GstMeta on the buffer. Features
	 * are given as a string of the format "memory:GstMemoryTypeName" or
	 * "meta:GstMetaAPIName".
	 */
	interface CapsFeatures {}
	class CapsFeatures {
		public constructor(options?: Partial<CapsFeaturesInitOptions>);
		/**
		 * Creates a new {@link CapsFeatures} with the given features.
		 * The last argument must be %NULL.
		 * 
		 * Free-function: gst_caps_features_free
		 * @param feature1 name of first feature to set
		 * @returns a new, empty {@link CapsFeatures}
		 */
		public static new(feature1: string): CapsFeatures;
		/**
		 * Creates a new, ANY {@link CapsFeatures}. This will be equal
		 * to any other #GstCapsFeatures but caps with these are
		 * unfixed.
		 * 
		 * Free-function: gst_caps_features_free
		 * @returns a new, ANY {@link CapsFeatures}
		 */
		public static new_any(): CapsFeatures;
		/**
		 * Creates a new, empty {@link CapsFeatures}.
		 * 
		 * Free-function: gst_caps_features_free
		 * @returns a new, empty {@link CapsFeatures}
		 */
		public static new_empty(): CapsFeatures;
		/**
		 * Creates a new {@link CapsFeatures} with the given features.
		 * The last argument must be 0.
		 * 
		 * Free-function: gst_caps_features_free
		 * @param feature1 name of first feature to set
		 * @returns a new, empty {@link CapsFeatures}
		 */
		public static new_id(feature1: GLib.Quark): CapsFeatures;
		/**
		 * Creates a new {@link CapsFeatures} with the given features.
		 * 
		 * Free-function: gst_caps_features_free
		 * @param feature1 name of first feature to set
		 * @param varargs variable argument list
		 * @returns a new, empty {@link CapsFeatures}
		 */
		public static new_id_valist(feature1: GLib.Quark, varargs: any[]): CapsFeatures;
		/**
		 * Creates a new {@link CapsFeatures} with the given features.
		 * 
		 * Free-function: gst_caps_features_free
		 * @param feature1 name of first feature to set
		 * @param varargs variable argument list
		 * @returns a new, empty {@link CapsFeatures}
		 */
		public static new_valist(feature1: string, varargs: any[]): CapsFeatures;
		/**
		 * Creates a {@link CapsFeatures} from a string representation.
		 * 
		 * Free-function: gst_caps_features_free
		 * @param features a string representation of a {@link CapsFeatures}.
		 * @returns a new {@link CapsFeatures} or
		 *     %NULL when the string could not be parsed. Free with
		 *     {@link Gst.CapsFeatures.free} after use.
		 */
		public static from_string(features: string): CapsFeatures | null;
		/**
		 * Adds #feature to #features.
		 * @param feature a feature.
		 */
		public add(feature: string): void;
		/**
		 * Adds #feature to #features.
		 * @param feature a feature.
		 */
		public add_id(feature: GLib.Quark): void;
		/**
		 * Check if #features contains #feature.
		 * @param feature a feature
		 * @returns %TRUE if #features contains #feature.
		 */
		public contains(feature: string): boolean;
		/**
		 * Check if #features contains #feature.
		 * @param feature a feature
		 * @returns %TRUE if #features contains #feature.
		 */
		public contains_id(feature: GLib.Quark): boolean;
		/**
		 * Duplicates a {@link CapsFeatures} and all its values.
		 * 
		 * Free-function: gst_caps_features_free
		 * @returns a new {@link CapsFeatures}.
		 */
		public copy(): CapsFeatures;
		/**
		 * Frees a {@link CapsFeatures} and all its values. The caps features must not
		 * have a parent when this function is called.
		 */
		public free(): void;
		/**
		 * Returns the #i-th feature of #features.
		 * @param i index of the feature
		 * @returns The #i-th feature of #features.
		 */
		public get_nth(i: number): string | null;
		/**
		 * Returns the #i-th feature of #features.
		 * @param i index of the feature
		 * @returns The #i-th feature of #features.
		 */
		public get_nth_id(i: number): GLib.Quark;
		/**
		 * Returns the number of features in #features.
		 * @returns The number of features in #features.
		 */
		public get_size(): number;
		/**
		 * Check if #features is %GST_CAPS_FEATURES_ANY.
		 * @returns %TRUE if #features is %GST_CAPS_FEATURES_ANY.
		 */
		public is_any(): boolean;
		/**
		 * Check if #features1 and #features2 are equal.
		 * @param features2 a {@link CapsFeatures}.
		 * @returns %TRUE if #features1 and #features2 are equal.
		 */
		public is_equal(features2: CapsFeatures): boolean;
		/**
		 * Removes #feature from #features.
		 * @param feature a feature.
		 */
		public remove(feature: string): void;
		/**
		 * Removes #feature from #features.
		 * @param feature a feature.
		 */
		public remove_id(feature: GLib.Quark): void;
		/**
		 * Sets the parent_refcount field of {@link CapsFeatures}. This field is used to
		 * determine whether a caps features is mutable or not. This function should only be
		 * called by code implementing parent objects of #GstCapsFeatures, as described in
		 * the MT Refcounting section of the design documents.
		 * @param refcount a pointer to the parent's refcount
		 * @returns %TRUE if the parent refcount could be set.
		 */
		public set_parent_refcount(refcount: number): boolean;
		/**
		 * Converts #features to a human-readable string representation.
		 * 
		 * For debugging purposes its easier to do something like this:
		 * |[<!-- language="C" -->
		 * GST_LOG ("features is %" GST_PTR_FORMAT, features);
		 * ]|
		 * This prints the features in human readable form.
		 * 
		 * Free-function: g_free
		 * @returns a pointer to string allocated by {@link G.malloc}.
		 *     g_free() after usage.
		 */
		public to_string(): string;
	}

	export interface ChildProxyInterfaceInitOptions {}
	/**
	 * {@link ChildProxy} interface.
	 */
	interface ChildProxyInterface {}
	class ChildProxyInterface {
		public constructor(options?: Partial<ChildProxyInterfaceInitOptions>);
		public readonly _gst_reserved: any[];
		public get_child_by_name: {(parent: ChildProxy, name: string): GObject.Object | null;};
		public get_child_by_index: {(parent: ChildProxy, index: number): GObject.Object | null;};
		public get_children_count: {(parent: ChildProxy): number;};
		public child_added: {(parent: ChildProxy, child: GObject.Object, name: string): void;};
		public child_removed: {(parent: ChildProxy, child: GObject.Object, name: string): void;};
	}

	export interface ClockEntryInitOptions {}
	/**
	 * All pending timeouts or periodic notifies are converted into
	 * an entry.
	 * Note that GstClockEntry should be treated as an opaque structure. It must
	 * not be extended or allocated using a custom allocator.
	 */
	interface ClockEntry {}
	class ClockEntry {
		public constructor(options?: Partial<ClockEntryInitOptions>);
		/**
		 * reference counter (read-only)
		 */
		public refcount: number;
		public clock: Clock;
		public type: ClockEntryType;
		public time: ClockTime;
		public interval: ClockTime;
		public status: ClockReturn;
		public func: ClockCallback;
		public user_data: any;
		public destroy_data: GLib.DestroyNotify;
		public unscheduled: boolean;
		public woken_up: boolean;
		public readonly _gst_reserved: any[];
	}

	export interface ContextInitOptions {}
	/**
	 * {@link Context} is a container object used to store contexts like a device
	 * context, a display server connection and similar concepts that should
	 * be shared between multiple elements.
	 * 
	 * Applications can set a context on a complete pipeline by using
	 * {@link Gst.Element.set_context}, which will then be propagated to all
	 * child elements. Elements can handle these in #GstElementClass.set_context()
	 * and merge them with the context information they already have.
	 * 
	 * When an element needs a context it will do the following actions in this
	 * order until one step succeeds:
	 * 1. Check if the element already has a context
	 * 2. Query downstream with GST_QUERY_CONTEXT for the context
	 * 3. Query upstream with GST_QUERY_CONTEXT for the context
	 * 4. Post a GST_MESSAGE_NEED_CONTEXT message on the bus with the required
	 *    context types and afterwards check if a usable context was set now
	 * 5. Create a context by itself and post a GST_MESSAGE_HAVE_CONTEXT message
	 *    on the bus.
	 * 
	 * Bins will catch GST_MESSAGE_NEED_CONTEXT messages and will set any previously
	 * known context on the element that asks for it if possible. Otherwise the
	 * application should provide one if it can.
	 * 
	 * #GstContext<!-- -->s can be persistent.
	 * A persistent #GstContext is kept in elements when they reach
	 * %GST_STATE_NULL, non-persistent ones will be removed.
	 * Also, a non-persistent context won't override a previous persistent
	 * context set to an element.
	 */
	interface Context {}
	class Context {
		public constructor(options?: Partial<ContextInitOptions>);
		/**
		 * Create a new context.
		 * @param context_type Context type
		 * @param persistent Persistent context
		 * @returns The new context.
		 */
		public static new(context_type: string, persistent: boolean): Context;
		/**
		 * Get the type of #context.
		 * @returns The type of the context.
		 */
		public get_context_type(): string;
		/**
		 * Access the structure of the context.
		 * @returns The structure of the context. The structure is
		 * still owned by the context, which means that you should not modify it,
		 * free it and that the pointer becomes invalid when you free the context.
		 */
		public get_structure(): Structure;
		/**
		 * Checks if #context has #context_type.
		 * @param context_type Context type to check.
		 * @returns %TRUE if #context has #context_type.
		 */
		public has_context_type(context_type: string): boolean;
		/**
		 * Check if #context is persistent.
		 * @returns %TRUE if the context is persistent.
		 */
		public is_persistent(): boolean;
		/**
		 * Get a writable version of the structure.
		 * @returns The structure of the context. The structure is still
		 * owned by the context, which means that you should not free it and
		 * that the pointer becomes invalid when you free the context.
		 * This function checks if #context is writable.
		 */
		public writable_structure(): Structure;
	}

	export interface DateTimeInitOptions {}
	/**
	 * Struct to store date, time and timezone information altogether.
	 * {@link DateTime} is refcounted and immutable.
	 * 
	 * Date information is handled using the proleptic Gregorian calendar.
	 * 
	 * Provides basic creation functions and accessor functions to its fields.
	 */
	interface DateTime {}
	class DateTime {
		public constructor(options?: Partial<DateTimeInitOptions>);
		/**
		 * Creates a new {@link DateTime} using the date and times in the gregorian calendar
		 * in the supplied timezone.
		 * 
		 * #year should be from 1 to 9999, #month should be from 1 to 12, #day from
		 * 1 to 31, #hour from 0 to 23, #minutes and #seconds from 0 to 59.
		 * 
		 * Note that #tzoffset is a float and was chosen so for being able to handle
		 * some fractional timezones, while it still keeps the readability of
		 * representing it in hours for most timezones.
		 * 
		 * If value is -1 then all over value will be ignored. For example
		 * if #month == -1, then #GstDateTime will created only for #year. If
		 * #day == -1, then #GstDateTime will created for #year and #month and
		 * so on.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param tzoffset Offset from UTC in hours.
		 * @param year the gregorian year
		 * @param month the gregorian month
		 * @param day the day of the gregorian month
		 * @param hour the hour of the day
		 * @param minute the minute of the hour
		 * @param seconds the second of the minute
		 * @returns the newly created {@link DateTime}
		 */
		public static new(tzoffset: number, year: number, month: number, day: number, hour: number, minute: number, seconds: number): DateTime | null;
		/**
		 * Creates a new {@link DateTime} from a #GDateTime object.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param dt the #GDateTime. The new {@link DateTime} takes ownership.
		 * @returns a newly created {@link DateTime},
		 * or %NULL on error
		 */
		public static new_from_g_date_time(dt: GLib.DateTime): DateTime | null;
		/**
		 * Tries to parse common variants of ISO-8601 datetime strings into a
		 * {@link DateTime}. Possible input formats are (for example):
		 * 2012-06-30T22:46:43Z, 2012, 2012-06, 2012-06-30, 2012-06-30T22:46:43-0430,
		 * 2012-06-30T22:46Z, 2012-06-30T22:46-0430, 2012-06-30 22:46,
		 * 2012-06-30 22:46:43, 2012-06-00, 2012-00-00, 2012-00-30, 22:46:43Z, 22:46Z,
		 * 22:46:43-0430, 22:46-0430, 22:46:30, 22:46
		 * If no date is provided, it is assumed to be "today" in the timezone
		 * provided (if any), otherwise UTC.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param string ISO 8601-formatted datetime string.
		 * @returns a newly created {@link DateTime},
		 * or %NULL on error
		 */
		public static new_from_iso8601_string(string: string): DateTime | null;
		/**
		 * Creates a new {@link DateTime} using the time since Jan 1, 1970 specified by
		 * #secs. The #GstDateTime is in the local timezone.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param secs seconds from the Unix epoch
		 * @returns the newly created {@link DateTime}
		 */
		public static new_from_unix_epoch_local_time(secs: number): DateTime | null;
		/**
		 * Creates a new {@link DateTime} using the time since Jan 1, 1970 specified by
		 * #usecs. The #GstDateTime is in the local timezone.
		 * @param usecs microseconds from the Unix epoch
		 * @returns a newly created {@link DateTime}
		 */
		public static new_from_unix_epoch_local_time_usecs(usecs: number): DateTime | null;
		/**
		 * Creates a new {@link DateTime} using the time since Jan 1, 1970 specified by
		 * #secs. The #GstDateTime is in the UTC timezone.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param secs seconds from the Unix epoch
		 * @returns the newly created {@link DateTime}
		 */
		public static new_from_unix_epoch_utc(secs: number): DateTime | null;
		/**
		 * Creates a new {@link DateTime} using the time since Jan 1, 1970 specified by
		 * #usecs. The #GstDateTime is in UTC.
		 * @param usecs microseconds from the Unix epoch
		 * @returns a newly created {@link DateTime}
		 */
		public static new_from_unix_epoch_utc_usecs(usecs: number): DateTime | null;
		/**
		 * Creates a new {@link DateTime} using the date and times in the gregorian calendar
		 * in the local timezone.
		 * 
		 * #year should be from 1 to 9999, #month should be from 1 to 12, #day from
		 * 1 to 31, #hour from 0 to 23, #minutes and #seconds from 0 to 59.
		 * 
		 * If #month is -1, then the #GstDateTime created will only contain #year,
		 * and all other fields will be considered not set.
		 * 
		 * If #day is -1, then the #GstDateTime created will only contain #year and
		 * #month and all other fields will be considered not set.
		 * 
		 * If #hour is -1, then the #GstDateTime created will only contain #year and
		 * #month and #day, and the time fields will be considered not set. In this
		 * case #minute and #seconds should also be -1.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param year the gregorian year
		 * @param month the gregorian month, or -1
		 * @param day the day of the gregorian month, or -1
		 * @param hour the hour of the day, or -1
		 * @param minute the minute of the hour, or -1
		 * @param seconds the second of the minute, or -1
		 * @returns the newly created {@link DateTime}
		 */
		public static new_local_time(year: number, month: number, day: number, hour: number, minute: number, seconds: number): DateTime | null;
		/**
		 * Creates a new {@link DateTime} representing the current date and time.
		 * 
		 * Free-function: gst_date_time_unref
		 * @returns the newly created {@link DateTime} which should
		 *     be freed with {@link Gst.DateTime.unref}.
		 */
		public static new_now_local_time(): DateTime;
		/**
		 * Creates a new {@link DateTime} that represents the current instant at Universal
		 * coordinated time.
		 * 
		 * Free-function: gst_date_time_unref
		 * @returns the newly created {@link DateTime} which should
		 *   be freed with {@link Gst.DateTime.unref}.
		 */
		public static new_now_utc(): DateTime;
		/**
		 * Creates a new {@link DateTime} using the date and times in the gregorian calendar
		 * in the local timezone.
		 * 
		 * #year should be from 1 to 9999.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param year the gregorian year
		 * @returns the newly created {@link DateTime}
		 */
		public static new_y(year: number): DateTime | null;
		/**
		 * Creates a new {@link DateTime} using the date and times in the gregorian calendar
		 * in the local timezone.
		 * 
		 * #year should be from 1 to 9999, #month should be from 1 to 12.
		 * 
		 * If value is -1 then all over value will be ignored. For example
		 * if #month == -1, then #GstDateTime will created only for #year.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param year the gregorian year
		 * @param month the gregorian month
		 * @returns the newly created {@link DateTime}
		 */
		public static new_ym(year: number, month: number): DateTime | null;
		/**
		 * Creates a new {@link DateTime} using the date and times in the gregorian calendar
		 * in the local timezone.
		 * 
		 * #year should be from 1 to 9999, #month should be from 1 to 12, #day from
		 * 1 to 31.
		 * 
		 * If value is -1 then all over value will be ignored. For example
		 * if #month == -1, then #GstDateTime will created only for #year. If
		 * #day == -1, then #GstDateTime will created for #year and #month and
		 * so on.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param year the gregorian year
		 * @param month the gregorian month
		 * @param day the day of the gregorian month
		 * @returns the newly created {@link DateTime}
		 */
		public static new_ymd(year: number, month: number, day: number): DateTime | null;
		/**
		 * Returns the day of the month of this {@link DateTime}.
		 * Call {@link Gst.DateTime.has_day} before, to avoid warnings.
		 * @returns The day of this {@link DateTime}
		 */
		public get_day(): number;
		/**
		 * Retrieves the hour of the day represented by #datetime in the gregorian
		 * calendar. The return is in the range of 0 to 23.
		 * Call {@link Gst.DateTime.has_time} before, to avoid warnings.
		 * @returns the hour of the day
		 */
		public get_hour(): number;
		/**
		 * Retrieves the fractional part of the seconds in microseconds represented by
		 * #datetime in the gregorian calendar.
		 * @returns the microsecond of the second
		 */
		public get_microsecond(): number;
		/**
		 * Retrieves the minute of the hour represented by #datetime in the gregorian
		 * calendar.
		 * Call {@link Gst.DateTime.has_time} before, to avoid warnings.
		 * @returns the minute of the hour
		 */
		public get_minute(): number;
		/**
		 * Returns the month of this {@link DateTime}. January is 1, February is 2, etc..
		 * Call {@link Gst.DateTime.has_month} before, to avoid warnings.
		 * @returns The month of this {@link DateTime}
		 */
		public get_month(): number;
		/**
		 * Retrieves the second of the minute represented by #datetime in the gregorian
		 * calendar.
		 * Call {@link Gst.DateTime.has_time} before, to avoid warnings.
		 * @returns the second represented by #datetime
		 */
		public get_second(): number;
		/**
		 * Retrieves the offset from UTC in hours that the timezone specified
		 * by #datetime represents. Timezones ahead (to the east) of UTC have positive
		 * values, timezones before (to the west) of UTC have negative values.
		 * If #datetime represents UTC time, then the offset is zero.
		 * @returns the offset from UTC in hours
		 */
		public get_time_zone_offset(): number;
		/**
		 * Returns the year of this {@link DateTime}
		 * Call {@link Gst.DateTime.has_year} before, to avoid warnings.
		 * @returns The year of this {@link DateTime}
		 */
		public get_year(): number;
		public has_day(): boolean;
		public has_month(): boolean;
		public has_second(): boolean;
		public has_time(): boolean;
		public has_year(): boolean;
		/**
		 * Atomically increments the reference count of #datetime by one.
		 * @returns the reference #datetime
		 */
		public ref(): DateTime;
		/**
		 * Creates a new #GDateTime from a fully defined {@link DateTime} object.
		 * 
		 * Free-function: g_date_time_unref
		 * @returns a newly created #GDateTime, or
		 * %NULL on error
		 */
		public to_g_date_time(): GLib.DateTime | null;
		/**
		 * Create a minimal string compatible with ISO-8601. Possible output formats
		 * are (for example): 2012, 2012-06, 2012-06-23, 2012-06-23T23:30Z,
		 * 2012-06-23T23:30+0100, 2012-06-23T23:30:59Z, 2012-06-23T23:30:59+0100
		 * @returns a newly allocated string formatted according
		 *     to ISO 8601 and only including the datetime fields that are
		 *     valid, or %NULL in case there was an error. The string should
		 *     be freed with {@link G.free}.
		 */
		public to_iso8601_string(): string | null;
		/**
		 * Atomically decrements the reference count of #datetime by one.  When the
		 * reference count reaches zero, the structure is freed.
		 */
		public unref(): void;
	}

	export interface DebugCategoryInitOptions {}
	/**
	 * This is the struct that describes the categories. Once initialized with
	 * #GST_DEBUG_CATEGORY_INIT, its values can't be changed anymore.
	 */
	interface DebugCategory {}
	class DebugCategory {
		public constructor(options?: Partial<DebugCategoryInitOptions>);
		public readonly threshold: number;
		public readonly color: number;
		public readonly name: string;
		public readonly description: string;
		/**
		 * @deprecated
		 * This function can easily cause memory corruption, don't use it.
		 * 
		 * Removes and frees the category and all associated resources.
		 */
		public free(): void;
		/**
		 * Returns the color of a debug category used when printing output in this
		 * category.
		 * @returns the color of the category.
		 */
		public get_color(): number;
		/**
		 * Returns the description of a debug category.
		 * @returns the description of the category.
		 */
		public get_description(): string;
		/**
		 * Returns the name of a debug category.
		 * @returns the name of the category.
		 */
		public get_name(): string;
		/**
		 * Returns the threshold of a {@link DebugCategory}.
		 * @returns the {@link DebugLevel} that is used as threshold.
		 */
		public get_threshold(): DebugLevel;
		/**
		 * Resets the threshold of the category to the default level. Debug information
		 * will only be output if the threshold is lower or equal to the level of the
		 * debugging message.
		 * Use this function to set the threshold back to where it was after using
		 * {@link Gst.DebugCategory.set_threshold}.
		 */
		public reset_threshold(): void;
		/**
		 * Sets the threshold of the category to the given level. Debug information will
		 * only be output if the threshold is lower or equal to the level of the
		 * debugging message.
		 * > Do not use this function in production code, because other functions may
		 * > change the threshold of categories as side effect. It is however a nice
		 * > function to use when debugging (even from gdb).
		 * @param level the {@link DebugLevel} threshold to set.
		 */
		public set_threshold(level: DebugLevel): void;
	}

	export interface DebugMessageInitOptions {}
	interface DebugMessage {}
	class DebugMessage {
		public constructor(options?: Partial<DebugMessageInitOptions>);
		/**
		 * Gets the string representation of a {@link DebugMessage}. This function is used
		 * in debug handlers to extract the message.
		 * @returns the string representation of a {@link DebugMessage}.
		 */
		public get(): string | null;
	}

	export interface EventInitOptions {}
	/**
	 * The event class provides factory methods to construct events for sending
	 * and functions to query (parse) received events.
	 * 
	 * Events are usually created with {@link Gst.Event.new_*} which takes event-type
	 * specific parameters as arguments.
	 * To send an event application will usually use gst_element_send_event() and
	 * elements will use gst_pad_send_event() or gst_pad_push_event().
	 * The event should be unreffed with gst_event_unref() if it has not been sent.
	 * 
	 * Events that have been received can be parsed with their respective
	 * gst_event_parse_*() functions. It is valid to pass %NULL for unwanted details.
	 * 
	 * Events are passed between elements in parallel to the data stream. Some events
	 * are serialized with buffers, others are not. Some events only travel downstream,
	 * others only upstream. Some events can travel both upstream and downstream.
	 * 
	 * The events are used to signal special conditions in the datastream such as
	 * EOS (end of stream) or the start of a new stream-segment.
	 * Events are also used to flush the pipeline of any pending data.
	 * 
	 * Most of the event API is used inside plugins. Applications usually only
	 * construct and use seek events.
	 * To do that gst_event_new_seek() is used to create a seek event. It takes
	 * the needed parameters to specify seeking time and mode.
	 * |[<!-- language="C" -->
	 *   GstEvent *event;
	 *   gboolean result;
	 *   ...
	 *   // construct a seek event to play the media from second 2 to 5, flush
	 *   // the pipeline to decrease latency.
	 *   event = gst_event_new_seek (1.0,
	 *      GST_FORMAT_TIME,
	 *      GST_SEEK_FLAG_FLUSH,
	 *      GST_SEEK_TYPE_SET, 2 * GST_SECOND,
	 *      GST_SEEK_TYPE_SET, 5 * GST_SECOND);
	 *   ...
	 *   result = gst_element_send_event (pipeline, event);
	 *   if (!result)
	 *     g_warning ("seek failed");
	 *   ...
	 * ]|
	 */
	interface Event {}
	class Event {
		public constructor(options?: Partial<EventInitOptions>);
		/**
		 * Create a new buffersize event. The event is sent downstream and notifies
		 * elements that they should provide a buffer of the specified dimensions.
		 * 
		 * When the #async flag is set, a thread boundary is preferred.
		 * @param format buffer format
		 * @param minsize minimum buffer size
		 * @param maxsize maximum buffer size
		 * @param async thread behavior
		 * @returns a new {@link Event}
		 */
		public static new_buffer_size(format: Format, minsize: number, maxsize: number, async: boolean): Event;
		/**
		 * Create a new CAPS event for #caps. The caps event can only travel downstream
		 * synchronized with the buffer flow and contains the format of the buffers
		 * that will follow after the event.
		 * @param caps a {@link Caps}
		 * @returns the new CAPS event.
		 */
		public static new_caps(caps: Caps): Event | null;
		/**
		 * Create a new custom-typed event. This can be used for anything not
		 * handled by other event-specific functions to pass an event to another
		 * element.
		 * 
		 * Make sure to allocate an event type with the #GST_EVENT_MAKE_TYPE macro,
		 * assigning a free number and filling in the correct direction and
		 * serialization flags.
		 * 
		 * New custom events can also be created by subclassing the event type if
		 * needed.
		 * @param type The type of the new event
		 * @param structure the structure for the event. The event will
		 *     take ownership of the structure.
		 * @returns the new custom event.
		 */
		public static new_custom(type: EventType, structure: Structure): Event | null;
		/**
		 * Create a new EOS event. The eos event can only travel downstream
		 * synchronized with the buffer flow. Elements that receive the EOS
		 * event on a pad can return #GST_FLOW_EOS as a {@link FlowReturn}
		 * when data after the EOS event arrives.
		 * 
		 * The EOS event will travel down to the sink elements in the pipeline
		 * which will then post the #GST_MESSAGE_EOS on the bus after they have
		 * finished playing any buffered data.
		 * 
		 * When all sinks have posted an EOS message, an EOS message is
		 * forwarded to the application.
		 * 
		 * The EOS event itself will not cause any state transitions of the pipeline.
		 * @returns the new EOS event.
		 */
		public static new_eos(): Event;
		/**
		 * Allocate a new flush start event. The flush start event can be sent
		 * upstream and downstream and travels out-of-bounds with the dataflow.
		 * 
		 * It marks pads as being flushing and will make them return
		 * #GST_FLOW_FLUSHING when used for data flow with {@link Gst.Pad.push},
		 * gst_pad_chain(), gst_pad_get_range() and gst_pad_pull_range().
		 * Any event (except a #GST_EVENT_FLUSH_STOP) received
		 * on a flushing pad will return %FALSE immediately.
		 * 
		 * Elements should unlock any blocking functions and exit their streaming
		 * functions as fast as possible when this event is received.
		 * 
		 * This event is typically generated after a seek to flush out all queued data
		 * in the pipeline so that the new media is played as soon as possible.
		 * @returns a new flush start event.
		 */
		public static new_flush_start(): Event;
		/**
		 * Allocate a new flush stop event. The flush stop event can be sent
		 * upstream and downstream and travels serialized with the dataflow.
		 * It is typically sent after sending a FLUSH_START event to make the
		 * pads accept data again.
		 * 
		 * Elements can process this event synchronized with the dataflow since
		 * the preceding FLUSH_START event stopped the dataflow.
		 * 
		 * This event is typically generated to complete a seek and to resume
		 * dataflow.
		 * @param reset_time if time should be reset
		 * @returns a new flush stop event.
		 */
		public static new_flush_stop(reset_time: boolean): Event;
		/**
		 * Create a new GAP event. A gap event can be thought of as conceptually
		 * equivalent to a buffer to signal that there is no data for a certain
		 * amount of time. This is useful to signal a gap to downstream elements
		 * which may wait for data, such as muxers or mixers or overlays, especially
		 * for sparse streams such as subtitle streams.
		 * @param timestamp the start time (pts) of the gap
		 * @param duration the duration of the gap
		 * @returns the new GAP event.
		 */
		public static new_gap(timestamp: ClockTime, duration: ClockTime): Event;
		/**
		 * Create a new instant-rate-change event. This event is sent by seek
		 * handlers (e.g. demuxers) when receiving a seek with the
		 * %GST_SEEK_FLAG_INSTANT_RATE_CHANGE and signals to downstream elements that
		 * the playback rate in the existing segment should be immediately multiplied
		 * by the #rate_multiplier factor.
		 * 
		 * The flags provided replace any flags in the existing segment, for the
		 * flags within the %GST_SEGMENT_INSTANT_FLAGS set. Other GstSegmentFlags
		 * are ignored and not transferred in the event.
		 * @param rate_multiplier the multiplier to be applied to the playback rate
		 * @param new_flags A new subset of segment flags to replace in segments
		 * @returns the new instant-rate-change event.
		 */
		public static new_instant_rate_change(rate_multiplier: number, new_flags: SegmentFlags): Event;
		/**
		 * Create a new instant-rate-sync-time event. This event is sent by the
		 * pipeline to notify elements handling the instant-rate-change event about
		 * the running-time when the new rate should be applied. The running time
		 * may be in the past when elements handle this event, which can lead to
		 * switching artifacts. The magnitude of those depends on the exact timing
		 * of event delivery to each element and the magnitude of the change in
		 * playback rate being applied.
		 * 
		 * The #running_time and #upstream_running_time are the same if this
		 * is the first instant-rate adjustment, but will differ for later ones
		 * to compensate for the accumulated offset due to playing at a rate
		 * different to the one indicated in the playback segments.
		 * @param rate_multiplier the new playback rate multiplier to be applied
		 * @param running_time Running time when the rate change should be applied
		 * @param upstream_running_time The upstream-centric running-time when the
		 *    rate change should be applied.
		 * @returns the new instant-rate-sync-time event.
		 */
		public static new_instant_rate_sync_time(rate_multiplier: number, running_time: ClockTime, upstream_running_time: ClockTime): Event;
		/**
		 * Create a new latency event. The event is sent upstream from the sinks and
		 * notifies elements that they should add an additional #latency to the
		 * running time before synchronising against the clock.
		 * 
		 * The latency is mostly used in live sinks and is always expressed in
		 * the time format.
		 * @param latency the new latency value
		 * @returns a new {@link Event}
		 */
		public static new_latency(latency: ClockTime): Event;
		/**
		 * Create a new navigation event from the given description.
		 * @param structure description of the event. The event will take
		 *     ownership of the structure.
		 * @returns a new {@link Event}
		 */
		public static new_navigation(structure: Structure): Event;
		/**
		 * Creates a new event containing information specific to a particular
		 * protection system (uniquely identified by #system_id), by which that
		 * protection system can acquire key(s) to decrypt a protected stream.
		 * 
		 * In order for a decryption element to decrypt media
		 * protected using a specific system, it first needs all the
		 * protection system specific information necessary to acquire the decryption
		 * key(s) for that stream. The functions defined here enable this information
		 * to be passed in events from elements that extract it
		 * (e.g., ISOBMFF demuxers, MPEG DASH demuxers) to protection decrypter
		 * elements that use it.
		 * 
		 * Events containing protection system specific information are created using
		 * #gst_event_new_protection, and they can be parsed by downstream elements
		 * using #gst_event_parse_protection.
		 * 
		 * In Common Encryption, protection system specific information may be located
		 * within ISOBMFF files, both in movie (moov) boxes and movie fragment (moof)
		 * boxes; it may also be contained in ContentProtection elements within MPEG
		 * DASH MPDs. The events created by #gst_event_new_protection contain data
		 * identifying from which of these locations the encapsulated protection system
		 * specific information originated. This origin information is required as
		 * some protection systems use different encodings depending upon where the
		 * information originates.
		 * 
		 * The events returned by {@link Gst.Event.new_protection} are implemented
		 * in such a way as to ensure that the most recently-pushed protection info
		 * event of a particular #origin and #system_id will
		 * be stuck to the output pad of the sending element.
		 * @param system_id a string holding a UUID that uniquely
		 * identifies a protection system.
		 * @param data a {@link Buffer} holding protection system specific
		 * information. The reference count of the buffer will be incremented by one.
		 * @param origin a string indicating where the protection
		 * information carried in the event was extracted from. The allowed values
		 * of this string will depend upon the protection scheme.
		 * @returns a #GST_EVENT_PROTECTION event, if successful; %NULL
		 * if unsuccessful.
		 */
		public static new_protection(system_id: string, data: Buffer, origin: string): Event;
		/**
		 * Allocate a new qos event with the given values.
		 * The QOS event is generated in an element that wants an upstream
		 * element to either reduce or increase its rate because of
		 * high/low CPU load or other resource usage such as network performance or
		 * throttling. Typically sinks generate these events for each buffer
		 * they receive.
		 * 
		 * #type indicates the reason for the QoS event. #GST_QOS_TYPE_OVERFLOW is
		 * used when a buffer arrived in time or when the sink cannot keep up with
		 * the upstream datarate. #GST_QOS_TYPE_UNDERFLOW is when the sink is not
		 * receiving buffers fast enough and thus has to drop late buffers.
		 * #GST_QOS_TYPE_THROTTLE is used when the datarate is artificially limited
		 * by the application, for example to reduce power consumption.
		 * 
		 * #proportion indicates the real-time performance of the streaming in the
		 * element that generated the QoS event (usually the sink). The value is
		 * generally computed based on more long term statistics about the streams
		 * timestamps compared to the clock.
		 * A value < 1.0 indicates that the upstream element is producing data faster
		 * than real-time. A value > 1.0 indicates that the upstream element is not
		 * producing data fast enough. 1.0 is the ideal #proportion value. The
		 * proportion value can safely be used to lower or increase the quality of
		 * the element.
		 * 
		 * #diff is the difference against the clock in running time of the last
		 * buffer that caused the element to generate the QOS event. A negative value
		 * means that the buffer with #timestamp arrived in time. A positive value
		 * indicates how late the buffer with #timestamp was. When throttling is
		 * enabled, #diff will be set to the requested throttling interval.
		 * 
		 * #timestamp is the timestamp of the last buffer that cause the element
		 * to generate the QOS event. It is expressed in running time and thus an ever
		 * increasing value.
		 * 
		 * The upstream element can use the #diff and #timestamp values to decide
		 * whether to process more buffers. For positive #diff, all buffers with
		 * timestamp <= #timestamp + #diff will certainly arrive late in the sink
		 * as well. A (negative) #diff value so that #timestamp + #diff would yield a
		 * result smaller than 0 is not allowed.
		 * 
		 * The application can use general event probes to intercept the QoS
		 * event and implement custom application specific QoS handling.
		 * @param type the QoS type
		 * @param proportion the proportion of the qos message
		 * @param diff The time difference of the last Clock sync
		 * @param timestamp The timestamp of the buffer
		 * @returns a new QOS event.
		 */
		public static new_qos(type: QOSType, proportion: number, diff: ClockTimeDiff, timestamp: ClockTime): Event | null;
		/**
		 * Create a new reconfigure event. The purpose of the reconfigure event is
		 * to travel upstream and make elements renegotiate their caps or reconfigure
		 * their buffer pools. This is useful when changing properties on elements
		 * or changing the topology of the pipeline.
		 * @returns a new {@link Event}
		 */
		public static new_reconfigure(): Event;
		/**
		 * Allocate a new seek event with the given parameters.
		 * 
		 * The seek event configures playback of the pipeline between #start to #stop
		 * at the speed given in #rate, also called a playback segment.
		 * The #start and #stop values are expressed in #format.
		 * 
		 * A #rate of 1.0 means normal playback rate, 2.0 means double speed.
		 * Negatives values means backwards playback. A value of 0.0 for the
		 * rate is not allowed and should be accomplished instead by PAUSING the
		 * pipeline.
		 * 
		 * A pipeline has a default playback segment configured with a start
		 * position of 0, a stop position of -1 and a rate of 1.0. The currently
		 * configured playback segment can be queried with #GST_QUERY_SEGMENT.
		 * 
		 * #start_type and #stop_type specify how to adjust the currently configured
		 * start and stop fields in playback segment. Adjustments can be made relative
		 * or absolute to the last configured values. A type of #GST_SEEK_TYPE_NONE
		 * means that the position should not be updated.
		 * 
		 * When the rate is positive and #start has been updated, playback will start
		 * from the newly configured start position.
		 * 
		 * For negative rates, playback will start from the newly configured stop
		 * position (if any). If the stop position is updated, it must be different from
		 * -1 (#GST_CLOCK_TIME_NONE) for negative rates.
		 * 
		 * It is not possible to seek relative to the current playback position, to do
		 * this, PAUSE the pipeline, query the current playback position with
		 * #GST_QUERY_POSITION and update the playback segment current position with a
		 * #GST_SEEK_TYPE_SET to the desired position.
		 * @param rate The new playback rate
		 * @param format The format of the seek values
		 * @param flags The optional seek flags
		 * @param start_type The type and flags for the new start position
		 * @param start The value of the new start position
		 * @param stop_type The type and flags for the new stop position
		 * @param stop The value of the new stop position
		 * @returns a new seek event.
		 */
		public static new_seek(rate: number, format: Format, flags: SeekFlags, start_type: SeekType, start: number, stop_type: SeekType, stop: number): Event | null;
		/**
		 * Create a new SEGMENT event for #segment. The segment event can only travel
		 * downstream synchronized with the buffer flow and contains timing information
		 * and playback properties for the buffers that will follow.
		 * 
		 * The segment event marks the range of buffers to be processed. All
		 * data not within the segment range is not to be processed. This can be
		 * used intelligently by plugins to apply more efficient methods of skipping
		 * unneeded data. The valid range is expressed with the #start and #stop
		 * values.
		 * 
		 * The time value of the segment is used in conjunction with the start
		 * value to convert the buffer timestamps into the stream time. This is
		 * usually done in sinks to report the current stream_time.
		 * #time represents the stream_time of a buffer carrying a timestamp of
		 * #start. #time cannot be -1.
		 * 
		 * #start cannot be -1, #stop can be -1. If there
		 * is a valid #stop given, it must be greater or equal the #start, including
		 * when the indicated playback #rate is < 0.
		 * 
		 * The #applied_rate value provides information about any rate adjustment that
		 * has already been made to the timestamps and content on the buffers of the
		 * stream. (#rate * #applied_rate) should always equal the rate that has been
		 * requested for playback. For example, if an element has an input segment
		 * with intended playback #rate of 2.0 and applied_rate of 1.0, it can adjust
		 * incoming timestamps and buffer content by half and output a segment event
		 * with #rate of 1.0 and #applied_rate of 2.0
		 * 
		 * After a segment event, the buffer stream time is calculated with:
		 * 
		 *   time + (TIMESTAMP(buf) - start) * ABS (rate * applied_rate)
		 * @param segment a {@link Segment}
		 * @returns the new SEGMENT event.
		 */
		public static new_segment(segment: Segment): Event | null;
		/**
		 * Create a new segment-done event. This event is sent by elements that
		 * finish playback of a segment as a result of a segment seek.
		 * @param format The format of the position being done
		 * @param position The position of the segment being done
		 * @returns a new {@link Event}
		 */
		public static new_segment_done(format: Format, position: number): Event;
		/**
		 * Allocate a new select-streams event.
		 * 
		 * The select-streams event requests the specified #streams to be activated.
		 * 
		 * The list of #streams corresponds to the "Stream ID" of each stream to be
		 * activated. Those ID can be obtained via the {@link Stream} objects present
		 * in #GST_EVENT_STREAM_START, #GST_EVENT_STREAM_COLLECTION or
		 * #GST_MESSAGE_STREAM_COLLECTION.
		 * 
		 * Note: The list of #streams can not be empty.
		 * @param streams the list of streams to
		 * activate
		 * @returns a new select-streams event or %NULL in case of
		 * an error (like an empty streams list).
		 */
		public static new_select_streams(streams: string[]): Event;
		/**
		 * Create a new sink-message event. The purpose of the sink-message event is
		 * to instruct a sink to post the message contained in the event synchronized
		 * with the stream.
		 * 
		 * #name is used to store multiple sticky events on one pad.
		 * @param name a name for the event
		 * @param msg the {@link Message} to be posted
		 * @returns a new {@link Event}
		 */
		public static new_sink_message(name: string, msg: Message): Event;
		/**
		 * Create a new step event. The purpose of the step event is to instruct a sink
		 * to skip #amount (expressed in #format) of media. It can be used to implement
		 * stepping through the video frame by frame or for doing fast trick modes.
		 * 
		 * A rate of <= 0.0 is not allowed. Pause the pipeline, for the effect of rate
		 * = 0.0 or first reverse the direction of playback using a seek event to get
		 * the same effect as rate < 0.0.
		 * 
		 * The #flush flag will clear any pending data in the pipeline before starting
		 * the step operation.
		 * 
		 * The #intermediate flag instructs the pipeline that this step operation is
		 * part of a larger step operation.
		 * @param format the format of #amount
		 * @param amount the amount of data to step
		 * @param rate the step rate
		 * @param flush flushing steps
		 * @param intermediate intermediate steps
		 * @returns a new {@link Event}
		 */
		public static new_step(format: Format, amount: number, rate: number, flush: boolean, intermediate: boolean): Event | null;
		/**
		 * Create a new STREAM_COLLECTION event. The stream collection event can only
		 * travel downstream synchronized with the buffer flow.
		 * 
		 * Source elements, demuxers and other elements that manage collections
		 * of streams and post {@link StreamCollection} messages on the bus also send
		 * this event downstream on each pad involved in the collection, so that
		 * activation of a new collection can be tracked through the downstream
		 * data flow.
		 * @param collection Active collection for this data flow
		 * @returns the new STREAM_COLLECTION event.
		 */
		public static new_stream_collection(collection: StreamCollection): Event;
		/**
		 * Create a new Stream Group Done event. The stream-group-done event can
		 * only travel downstream synchronized with the buffer flow. Elements
		 * that receive the event on a pad should handle it mostly like EOS,
		 * and emit any data or pending buffers that would depend on more data
		 * arriving and unblock, since there won't be any more data.
		 * 
		 * This event is followed by EOS at some point in the future, and is
		 * generally used when switching pads - to unblock downstream so that
		 * new pads can be exposed before sending EOS on the existing pads.
		 * @param group_id the group id of the stream group which is ending
		 * @returns the new stream-group-done event.
		 */
		public static new_stream_group_done(group_id: number): Event;
		/**
		 * Create a new STREAM_START event. The stream start event can only
		 * travel downstream synchronized with the buffer flow. It is expected
		 * to be the first event that is sent for a new stream.
		 * 
		 * Source elements, demuxers and other elements that create new streams
		 * are supposed to send this event as the first event of a new stream. It
		 * should not be sent after a flushing seek or in similar situations
		 * and is used to mark the beginning of a new logical stream. Elements
		 * combining multiple streams must ensure that this event is only forwarded
		 * downstream once and not for every single input stream.
		 * 
		 * The #stream_id should be a unique string that consists of the upstream
		 * stream-id, / as separator and a unique stream-id for this specific
		 * stream. A new stream-id should only be created for a stream if the upstream
		 * stream is split into (potentially) multiple new streams, e.g. in a demuxer,
		 * but not for every single element in the pipeline.
		 * {@link Gst.Pad.create_stream_id} or gst_pad_create_stream_id_printf() can be
		 * used to create a stream-id.  There are no particular semantics for the
		 * stream-id, though it should be deterministic (to support stream matching)
		 * and it might be used to order streams (besides any information conveyed by
		 * stream flags).
		 * @param stream_id Identifier for this stream
		 * @returns the new STREAM_START event.
		 */
		public static new_stream_start(stream_id: string): Event;
		/**
		 * Generates a metadata tag event from the given #taglist.
		 * 
		 * The scope of the taglist specifies if the taglist applies to the
		 * complete medium or only to this specific stream. As the tag event
		 * is a sticky event, elements should merge tags received from
		 * upstream with a given scope with their own tags with the same
		 * scope and create a new tag event from it.
		 * @param taglist metadata list. The event will take ownership
		 *     of the taglist.
		 * @returns a new {@link Event}
		 */
		public static new_tag(taglist: TagList): Event;
		/**
		 * Generate a TOC event from the given #toc. The purpose of the TOC event is to
		 * inform elements that some kind of the TOC was found.
		 * @param toc {@link Toc} structure.
		 * @param updated whether #toc was updated or not.
		 * @returns a new {@link Event}.
		 */
		public static new_toc(toc: Toc, updated: boolean): Event;
		/**
		 * Generate a TOC select event with the given #uid. The purpose of the
		 * TOC select event is to start playback based on the TOC's entry with the
		 * given #uid.
		 * @param uid UID in the TOC to start playback from.
		 * @returns a new {@link Event}.
		 */
		public static new_toc_select(uid: string): Event;
		/**
		 * the parent structure
		 */
		public mini_object: MiniObject;
		/**
		 * the {@link EventType} of the event
		 */
		public type: EventType;
		/**
		 * the timestamp of the event
		 */
		public timestamp: number;
		/**
		 * the sequence number of the event
		 */
		public seqnum: number;
		/**
		 * Parses a segment #event and copies the {@link Segment} into the location
		 * given by #segment.
		 * @param segment a pointer to a {@link Segment}
		 */
		public copy_segment(segment: Segment): void;
		/**
		 * Retrieve the accumulated running time offset of the event.
		 * 
		 * Events passing through {@link Pads} that have a running time
		 * offset set via {@link Gst.Pad.set_offset} will get their offset
		 * adjusted according to the pad's offset.
		 * 
		 * If the event contains any information that related to the
		 * running time, this information will need to be updated
		 * before usage with this offset.
		 * @returns The event's running time offset
		 * 
		 * MT safe.
		 */
		public get_running_time_offset(): number;
		/**
		 * Retrieve the sequence number of a event.
		 * 
		 * Events have ever-incrementing sequence numbers, which may also be set
		 * explicitly via {@link Gst.Event.set_seqnum}. Sequence numbers are typically used to
		 * indicate that a event corresponds to some other set of events or messages,
		 * for example an EOS event corresponding to a SEEK event. It is considered good
		 * practice to make this correspondence when possible, though it is not
		 * required.
		 * 
		 * Note that events and messages share the same sequence number incrementor;
		 * two events or messages will never have the same sequence number unless
		 * that correspondence was made explicitly.
		 * @returns The event's sequence number.
		 * 
		 * MT safe.
		 */
		public get_seqnum(): number;
		/**
		 * Access the structure of the event.
		 * @returns The structure of the event. The
		 * structure is still owned by the event, which means that you should not free
		 * it and that the pointer becomes invalid when you free the event.
		 * 
		 * MT safe.
		 */
		public get_structure(): Structure | null;
		/**
		 * Checks if #event has the given #name. This function is usually used to
		 * check the name of a custom event.
		 * @param name name to check
		 * @returns %TRUE if #name matches the name of the event structure.
		 */
		public has_name(name: string): boolean;
		/**
		 * Checks if #event has the given #name. This function is usually used to
		 * check the name of a custom event.
		 * @param name name to check as a GQuark
		 * @returns %TRUE if #name matches the name of the event structure.
		 */
		public has_name_id(name: GLib.Quark): boolean;
		/**
		 * Get the format, minsize, maxsize and async-flag in the buffersize event.
		 * @returns A pointer to store the format in
		 * 
		 * A pointer to store the minsize in
		 * 
		 * A pointer to store the maxsize in
		 * 
		 * A pointer to store the async-flag in
		 */
		public parse_buffer_size(): [ format: Format, minsize: number, maxsize: number, async: boolean ];
		/**
		 * Get the caps from #event. The caps remains valid as long as #event remains
		 * valid.
		 * @returns A pointer to the caps
		 */
		public parse_caps(): Caps;
		/**
		 * Parse the FLUSH_STOP event and retrieve the #reset_time member.
		 * @returns if time should be reset
		 */
		public parse_flush_stop(): boolean;
		/**
		 * Extract timestamp and duration from a new GAP event.
		 * @returns location where to store the
		 *     start time (pts) of the gap, or %NULL
		 * 
		 * location where to store the duration of
		 *     the gap, or %NULL
		 */
		public parse_gap(): [ timestamp: ClockTime | null, duration: ClockTime | null ];
		public parse_group_id(): [ boolean, number ];
		/**
		 * Extract rate and flags from an instant-rate-change event.
		 * @returns location in which to store the rate
		 *     multiplier of the instant-rate-change event, or %NULL
		 * 
		 * location in which to store the new
		 *     segment flags of the instant-rate-change event, or %NULL
		 */
		public parse_instant_rate_change(): [ rate_multiplier: number | null, new_flags: SegmentFlags | null ];
		/**
		 * Extract the rate multiplier and running times from an instant-rate-sync-time event.
		 * @returns location where to store the rate of
		 *     the instant-rate-sync-time event, or %NULL
		 * 
		 * location in which to store the running time
		 *     of the instant-rate-sync-time event, or %NULL
		 * 
		 * location in which to store the
		 *     upstream running time of the instant-rate-sync-time event, or %NULL
		 */
		public parse_instant_rate_sync_time(): [ rate_multiplier: number | null, running_time: ClockTime | null, upstream_running_time: ClockTime | null ];
		/**
		 * Get the latency in the latency event.
		 * @returns A pointer to store the latency in.
		 */
		public parse_latency(): ClockTime;
		/**
		 * Parses an event containing protection system specific information and stores
		 * the results in #system_id, #data and #origin. The data stored in #system_id,
		 * #origin and #data are valid until #event is released.
		 * @returns pointer to store the UUID
		 * string uniquely identifying a content protection system.
		 * 
		 * pointer to store a {@link Buffer}
		 * holding protection system specific information.
		 * 
		 * pointer to store a value that
		 * indicates where the protection information carried by #event was extracted
		 * from.
		 */
		public parse_protection(): [ system_id: string | null, data: Buffer | null, origin: string | null ];
		/**
		 * Get the type, proportion, diff and timestamp in the qos event. See
		 * {@link Gst.Event.new_qos} for more information about the different QoS values.
		 * 
		 * #timestamp will be adjusted for any pad offsets of pads it was passing through.
		 * @returns A pointer to store the QoS type in
		 * 
		 * A pointer to store the proportion in
		 * 
		 * A pointer to store the diff in
		 * 
		 * A pointer to store the timestamp in
		 */
		public parse_qos(): [ type: QOSType, proportion: number, diff: ClockTimeDiff, timestamp: ClockTime ];
		/**
		 * Parses a seek #event and stores the results in the given result locations.
		 * @returns result location for the rate
		 * 
		 * result location for the stream format
		 * 
		 * result location for the {@link SeekFlags}
		 * 
		 * result location for the #GstSeekType of the start position
		 * 
		 * result location for the start position expressed in #format
		 * 
		 * result location for the #GstSeekType of the stop position
		 * 
		 * result location for the stop position expressed in #format
		 */
		public parse_seek(): [ rate: number, format: Format, flags: SeekFlags, start_type: SeekType, start: number, stop_type: SeekType, stop: number ];
		/**
		 * Retrieve the trickmode interval that may have been set on a
		 * seek event with {@link Gst.Event.set_seek_trickmode_interval}.
		 * @returns 
		 */
		public parse_seek_trickmode_interval(): ClockTime;
		/**
		 * Parses a segment #event and stores the result in the given #segment location.
		 * #segment remains valid only until the #event is freed. Don't modify the segment
		 * and make a copy if you want to modify it or store it for later use.
		 * @returns a pointer to a {@link Segment}
		 */
		public parse_segment(): Segment;
		/**
		 * Extracts the position and format from the segment done message.
		 * @returns Result location for the format, or %NULL
		 * 
		 * Result location for the position, or %NULL
		 */
		public parse_segment_done(): [ format: Format | null, position: number | null ];
		/**
		 * Parse the SELECT_STREAMS event and retrieve the contained streams.
		 * @returns the streams
		 */
		public parse_select_streams(): string[];
		/**
		 * Parse the sink-message event. Unref #msg after usage.
		 * @returns a pointer to store the {@link Message} in.
		 */
		public parse_sink_message(): Message;
		/**
		 * Parse the step event.
		 * @returns a pointer to store the format in
		 * 
		 * a pointer to store the amount in
		 * 
		 * a pointer to store the rate in
		 * 
		 * a pointer to store the flush boolean in
		 * 
		 * a pointer to store the intermediate
		 *     boolean in
		 */
		public parse_step(): [ format: Format | null, amount: number | null, rate: number | null, flush: boolean | null, intermediate: boolean | null ];
		/**
		 * Parse a stream-start #event and extract the {@link Stream} from it.
		 * @returns address of variable to store the stream
		 */
		public parse_stream(): Stream;
		/**
		 * Retrieve new {@link StreamCollection} from STREAM_COLLECTION event #event.
		 * @returns pointer to store the collection
		 */
		public parse_stream_collection(): StreamCollection;
		public parse_stream_flags(): StreamFlags;
		/**
		 * Parse a stream-group-done #event and store the result in the given
		 * #group_id location.
		 * @returns address of variable to store the group id into
		 */
		public parse_stream_group_done(): number;
		/**
		 * Parse a stream-id #event and store the result in the given #stream_id
		 * location. The string stored in #stream_id must not be modified and will
		 * remain valid only until #event gets freed. Make a copy if you want to
		 * modify it or store it for later use.
		 * @returns pointer to store the stream-id
		 */
		public parse_stream_start(): string;
		/**
		 * Parses a tag #event and stores the results in the given #taglist location.
		 * No reference to the taglist will be returned, it remains valid only until
		 * the #event is freed. Don't modify or free the taglist, make a copy if you
		 * want to modify it or store it for later use.
		 * @returns pointer to metadata list
		 */
		public parse_tag(): TagList;
		/**
		 * Parse a TOC #event and store the results in the given #toc and #updated locations.
		 * @returns pointer to {@link Toc} structure.
		 * 
		 * pointer to store TOC updated flag.
		 */
		public parse_toc(): [ toc: Toc, updated: boolean ];
		/**
		 * Parse a TOC select #event and store the results in the given #uid location.
		 * @returns storage for the selection UID.
		 */
		public parse_toc_select(): string | null;
		/**
		 * All streams that have the same group id are supposed to be played
		 * together, i.e. all streams inside a container file should have the
		 * same group id but different stream ids. The group id should change
		 * each time the stream is started, resulting in different group ids
		 * each time a file is played for example.
		 * 
		 * Use {@link Gst.util.group_id_next} to get a new group id.
		 * @param group_id the group id to set
		 */
		public set_group_id(group_id: number): void;
		/**
		 * Set the running time offset of a event. See
		 * {@link Gst.Event.get_running_time_offset} for more information.
		 * 
		 * MT safe.
		 * @param offset A the new running time offset
		 */
		public set_running_time_offset(offset: number): void;
		/**
		 * Sets a trickmode interval on a (writable) seek event. Elements
		 * that support TRICKMODE_KEY_UNITS seeks SHOULD use this as the minimal
		 * interval between each frame they may output.
		 * @param interval
		 */
		public set_seek_trickmode_interval(interval: ClockTime): void;
		/**
		 * Set the sequence number of a event.
		 * 
		 * This function might be called by the creator of a event to indicate that the
		 * event relates to other events or messages. See {@link Gst.Event.get_seqnum} for
		 * more information.
		 * 
		 * MT safe.
		 * @param seqnum A sequence number.
		 */
		public set_seqnum(seqnum: number): void;
		/**
		 * Set the #stream on the stream-start #event
		 * @param stream the stream object to set
		 */
		public set_stream(stream: Stream): void;
		public set_stream_flags(flags: StreamFlags): void;
		/**
		 * Get a writable version of the structure.
		 * @returns The structure of the event. The structure
		 * is still owned by the event, which means that you should not free
		 * it and that the pointer becomes invalid when you free the event.
		 * This function checks if #event is writable and will never return
		 * %NULL.
		 * 
		 * MT safe.
		 */
		public writable_structure(): Structure;
	}

	export interface FormatDefinitionInitOptions {}
	/**
	 * A format definition
	 */
	interface FormatDefinition {}
	class FormatDefinition {
		public constructor(options?: Partial<FormatDefinitionInitOptions>);
		/**
		 * The unique id of this format
		 */
		public value: Format;
		/**
		 * A short nick of the format
		 */
		public nick: string;
		/**
		 * A longer description of the format
		 */
		public description: string;
		/**
		 * A quark for the nick
		 */
		public quark: GLib.Quark;
	}

	export interface IteratorInitOptions {}
	/**
	 * A GstIterator is used to retrieve multiple objects from another object in
	 * a threadsafe way.
	 * 
	 * Various GStreamer objects provide access to their internal structures using
	 * an iterator.
	 * 
	 * Note that if calling a GstIterator function results in your code receiving
	 * a refcounted object (with, say, {@link G.value_get_object}), the refcount for that
	 * object will not be increased. Your code is responsible for taking a reference
	 * if it wants to continue using it later.
	 * 
	 * The basic use pattern of an iterator is as follows:
	 * |[<!-- language="C" -->
	 *   GstIterator *it = _get_iterator(object);
	 *   GValue item = G_VALUE_INIT;
	 *   done = FALSE;
	 *   while (!done) {
	 *     switch (gst_iterator_next (it, &amp;item)) {
	 *       case GST_ITERATOR_OK:
	 *         ...get/use/change item here...
	 *         g_value_reset (&amp;item);
	 *         break;
	 *       case GST_ITERATOR_RESYNC:
	 *         ...rollback changes to items...
	 *         gst_iterator_resync (it);
	 *         break;
	 *       case GST_ITERATOR_ERROR:
	 *         ...wrong parameters were given...
	 *         done = TRUE;
	 *         break;
	 *       case GST_ITERATOR_DONE:
	 *         done = TRUE;
	 *         break;
	 *     }
	 *   }
	 *   g_value_unset (&amp;item);
	 *   gst_iterator_free (it);
	 * ]|
	 */
	interface Iterator {}
	class Iterator {
		public constructor(options?: Partial<IteratorInitOptions>);
		/**
		 * Create a new iterator. This function is mainly used for objects
		 * implementing the next/resync/free function to iterate a data structure.
		 * 
		 * For each item retrieved, the #item function is called with the lock
		 * held. The #free function is called when the iterator is freed.
		 * @param size the size of the iterator structure
		 * @param type #GType of children
		 * @param lock pointer to a #GMutex.
		 * @param master_cookie pointer to a guint32 that is changed when the items in the
		 *    iterator changed.
		 * @param copy copy function
		 * @param next function to get next item
		 * @param item function to call on each item retrieved
		 * @param resync function to resync the iterator
		 * @param free function to free the iterator
		 * @returns the new {@link Iterator}.
		 * 
		 * MT safe.
		 */
		public static new(size: number, type: GObject.Type, lock: GLib.Mutex, master_cookie: number, copy: IteratorCopyFunction, next: IteratorNextFunction, item: IteratorItemFunction, resync: IteratorResyncFunction, free: IteratorFreeFunction): Iterator;
		/**
		 * Create a new iterator designed for iterating #list.
		 * 
		 * The list you iterate is usually part of a data structure #owner and is
		 * protected with #lock.
		 * 
		 * The iterator will use #lock to retrieve the next item of the list and it
		 * will then call the #item function before releasing #lock again.
		 * 
		 * When a concurrent update to the list is performed, usually by #owner while
		 * holding #lock, #master_cookie will be updated. The iterator implementation
		 * will notice the update of the cookie and will return %GST_ITERATOR_RESYNC to
		 * the user of the iterator in the next call to {@link Gst.Iterator.next}.
		 * @param type #GType of elements
		 * @param lock pointer to a #GMutex protecting the list.
		 * @param master_cookie pointer to a guint32 that is incremented when the list
		 *     is changed.
		 * @param list pointer to the list
		 * @param owner object owning the list
		 * @param item function to call on each item retrieved
		 * @returns the new {@link Iterator} for #list.
		 * 
		 * MT safe.
		 */
		public static new_list(type: GObject.Type, lock: GLib.Mutex, master_cookie: number, list: any[], owner: GObject.Object, item: IteratorItemFunction): Iterator;
		/**
		 * This {@link Iterator} is a convenient iterator for the common
		 * case where a #GstIterator needs to be returned but only
		 * a single object has to be considered. This happens often
		 * for the #GstPadIterIntLinkFunction.
		 * @param type #GType of the passed object
		 * @param object object that this iterator should return
		 * @returns the new {@link Iterator} for #object.
		 */
		public static new_single(type: GObject.Type, object: GObject.Value): Iterator;
		/**
		 * The function to copy the iterator
		 */
		// public copy: IteratorCopyFunction;
		/**
		 * The function to get the next item in the iterator
		 */
		// public next: IteratorNextFunction;
		/**
		 * The function to be called for each item retrieved
		 */
		public item: IteratorItemFunction;
		/**
		 * The function to call when a resync is needed.
		 */
		// public resync: IteratorResyncFunction;
		/**
		 * The function to call when the iterator is freed
		 */
		// public free: IteratorFreeFunction;
		/**
		 * The iterator that is currently pushed with {@link Gst.Iterator.push}
		 */
		public pushed: Iterator;
		/**
		 * The type of the object that this iterator will return
		 */
		public type: GObject.Type;
		/**
		 * The lock protecting the data structure and the cookie.
		 */
		public lock: GLib.Mutex;
		/**
		 * The cookie; the value of the master_cookie when this iterator was
		 *          created.
		 */
		public cookie: number;
		/**
		 * A pointer to the master cookie.
		 */
		public master_cookie: number;
		/**
		 * the size of the iterator
		 */
		public size: number;
		public readonly _gst_reserved: any[];
		/**
		 * Copy the iterator and its state.
		 * @returns a new copy of #it.
		 */
		public copy(): Iterator;
		/**
		 * Create a new iterator from an existing iterator. The new iterator
		 * will only return those elements that match the given compare function #func.
		 * The first parameter that is passed to #func is the #GValue of the current
		 * iterator element and the second parameter is #user_data. #func should
		 * return 0 for elements that should be included in the filtered iterator.
		 * 
		 * When this iterator is freed, #it will also be freed.
		 * @param func the compare function to select elements
		 * @param user_data user data passed to the compare function
		 * @returns a new {@link Iterator}.
		 * 
		 * MT safe.
		 */
		public filter(func: GLib.CompareFunc, user_data: GObject.Value): Iterator;
		/**
		 * Find the first element in #it that matches the compare function #func.
		 * #func should return 0 when the element is found. The first parameter
		 * to #func will be the current element of the iterator and the
		 * second parameter will be #user_data.
		 * The result will be stored in #elem if a result is found.
		 * 
		 * The iterator will not be freed.
		 * 
		 * This function will return %FALSE if an error happened to the iterator
		 * or if the element wasn't found.
		 * @param func the compare function to use
		 * @returns Returns %TRUE if the element was found, else %FALSE.
		 * 
		 * MT safe.
		 * 
		 * pointer to a #GValue where to store the result
		 */
		public find_custom(func: GLib.CompareFunc): [ boolean, GObject.Value ];
		/**
		 * Folds #func over the elements of #iter. That is to say, #func will be called
		 * as #func (object, #ret, #user_data) for each object in #it. The normal use
		 * of this procedure is to accumulate the results of operating on the objects in
		 * #ret.
		 * 
		 * This procedure can be used (and is used internally) to implement the
		 * {@link Gst.Iterator.foreach} and gst_iterator_find_custom() operations.
		 * 
		 * The fold will proceed as long as #func returns %TRUE. When the iterator has no
		 * more arguments, %GST_ITERATOR_DONE will be returned. If #func returns %FALSE,
		 * the fold will stop, and %GST_ITERATOR_OK will be returned. Errors or resyncs
		 * will cause fold to return %GST_ITERATOR_ERROR or %GST_ITERATOR_RESYNC as
		 * appropriate.
		 * 
		 * The iterator will not be freed.
		 * @param func the fold function
		 * @param ret the seed value passed to the fold function
		 * @returns A {@link IteratorResult}, as described above.
		 * 
		 * MT safe.
		 */
		public fold(func: IteratorFoldFunction, ret: GObject.Value): IteratorResult;
		/**
		 * Iterate over all element of #it and call the given function #func for
		 * each element.
		 * @param func the function to call for each element.
		 * @returns the result call to {@link Gst.Iterator.fold}. The iterator will not be
		 * freed.
		 * 
		 * MT safe.
		 */
		public foreach(func: IteratorForeachFunction): IteratorResult;
		/**
		 * Free the iterator.
		 * 
		 * MT safe.
		 */
		public free(): void;
		/**
		 * Get the next item from the iterator in #elem.
		 * 
		 * Only when this function returns %GST_ITERATOR_OK, #elem will contain a valid
		 * value. #elem must have been initialized to the type of the iterator or
		 * initialized to zeroes with {@link G.value_unset}. The caller is responsible for
		 * unsetting or resetting #elem with g_value_unset() or g_value_reset()
		 * after usage.
		 * 
		 * When this function returns %GST_ITERATOR_DONE, no more elements can be
		 * retrieved from #it.
		 * 
		 * A return value of %GST_ITERATOR_RESYNC indicates that the element list was
		 * concurrently updated. The user of #it should call gst_iterator_resync() to
		 * get the newly updated list.
		 * 
		 * A return value of %GST_ITERATOR_ERROR indicates an unrecoverable fatal error.
		 * @returns The result of the iteration. Unset #elem after usage.
		 * 
		 * MT safe.
		 * 
		 * pointer to hold next element
		 */
		public next(): [ IteratorResult, GObject.Value ];
		/**
		 * Pushes #other iterator onto #it. All calls performed on #it are
		 * forwarded to #other. If #other returns %GST_ITERATOR_DONE, it is
		 * popped again and calls are handled by #it again.
		 * 
		 * This function is mainly used by objects implementing the iterator
		 * next function to recurse into substructures.
		 * 
		 * When {@link Gst.Iterator.resync} is called on #it, #other will automatically be
		 * popped.
		 * 
		 * MT safe.
		 * @param other The {@link Iterator} to push
		 */
		public push(other: Iterator): void;
		/**
		 * Resync the iterator. this function is mostly called
		 * after {@link Gst.Iterator.next} returned %GST_ITERATOR_RESYNC.
		 * 
		 * When an iterator was pushed on #it, it will automatically be popped again
		 * with this function.
		 * 
		 * MT safe.
		 */
		public resync(): void;
	}

	export interface MapInfoInitOptions {}
	/**
	 * A structure containing the result of a map operation such as
	 * {@link Gst.Memory.map}. It contains the data and size.
	 */
	interface MapInfo {}
	class MapInfo {
		public constructor(options?: Partial<MapInfoInitOptions>);
		/**
		 * a pointer to the mapped memory
		 */
		public memory: Memory;
		/**
		 * flags used when mapping the memory
		 */
		public flags: MapFlags;
		/**
		 * a pointer to the mapped data
		 */
		public data: number[];
		/**
		 * the valid size in #data
		 */
		public size: number;
		/**
		 * the maximum bytes in #data
		 */
		public maxsize: number;
		/**
		 * extra private user_data that the implementation of the memory
		 *             can use to store extra info.
		 */
		public user_data: any[];
		public readonly _gst_reserved: any[];
	}

	export interface MemoryInitOptions {}
	/**
	 * GstMemory is a lightweight refcounted object that wraps a region of memory.
	 * They are typically used to manage the data of a {@link Buffer}.
	 * 
	 * A GstMemory object has an allocated region of memory of maxsize. The maximum
	 * size does not change during the lifetime of the memory object. The memory
	 * also has an offset and size property that specifies the valid range of memory
	 * in the allocated region.
	 * 
	 * Memory is usually created by allocators with a {@link Gst.Allocator.alloc}
	 * method call. When %NULL is used as the allocator, the default allocator will
	 * be used.
	 * 
	 * New allocators can be registered with gst_allocator_register().
	 * Allocators are identified by name and can be retrieved with
	 * gst_allocator_find(). gst_allocator_set_default() can be used to change the
	 * default allocator.
	 * 
	 * New memory can be created with gst_memory_new_wrapped() that wraps the memory
	 * allocated elsewhere.
	 * 
	 * Refcounting of the memory block is performed with gst_memory_ref() and
	 * gst_memory_unref().
	 * 
	 * The size of the memory can be retrieved and changed with
	 * gst_memory_get_sizes() and gst_memory_resize() respectively.
	 * 
	 * Getting access to the data of the memory is performed with gst_memory_map().
	 * The call will return a pointer to offset bytes into the region of memory.
	 * After the memory access is completed, gst_memory_unmap() should be called.
	 * 
	 * Memory can be copied with gst_memory_copy(), which will return a writable
	 * copy. gst_memory_share() will create a new memory block that shares the
	 * memory with an existing memory block at a custom offset and with a custom
	 * size.
	 * 
	 * Memory can be efficiently merged when gst_memory_is_span() returns %TRUE.
	 */
	interface Memory {}
	class Memory {
		public constructor(options?: Partial<MemoryInitOptions>);
		/**
		 * Allocate a new memory block that wraps the given #data.
		 * 
		 * The prefix/padding must be filled with 0 if #flags contains
		 * #GST_MEMORY_FLAG_ZERO_PREFIXED and #GST_MEMORY_FLAG_ZERO_PADDED respectively.
		 * @param flags {@link MemoryFlags}
		 * @param data data to
		 *   wrap
		 * @param maxsize allocated size of #data
		 * @param offset offset in #data
		 * @returns a new {@link Memory}.
		 */
		public static new_wrapped(flags: MemoryFlags, data: number[], maxsize: number, offset: number): Memory | null;
		/**
		 * parent structure
		 */
		public mini_object: MiniObject;
		/**
		 * pointer to the {@link Allocator}
		 */
		public allocator: Allocator;
		/**
		 * the maximum size allocated
		 */
		public maxsize: number;
		/**
		 * the alignment of the memory
		 */
		public align: number;
		/**
		 * the offset where valid data starts
		 */
		public offset: number;
		/**
		 * the size of valid data
		 */
		public size: number;
		/**
		 * Return a copy of #size bytes from #mem starting from #offset. This copy is
		 * guaranteed to be writable. #size can be set to -1 to return a copy
		 * from #offset to the end of the memory region.
		 * @param offset offset to copy from
		 * @param size size to copy, or -1 to copy to the end of the memory region
		 * @returns a new {@link Memory}.
		 */
		public copy(offset: number, size: number): Memory;
		/**
		 * Get the current #size, #offset and #maxsize of #mem.
		 * @returns the current size of #mem
		 * 
		 * pointer to offset
		 * 
		 * pointer to maxsize
		 */
		public get_sizes(): [ number, number | null, number | null ];
		/**
		 * Initializes a newly allocated #mem with the given parameters. This function
		 * will call {@link Gst.MiniObject.init} with the default memory parameters.
		 * @param flags {@link MemoryFlags}
		 * @param allocator the {@link Allocator}
		 * @param parent the parent of #mem
		 * @param maxsize the total size of the memory
		 * @param align the alignment of the memory
		 * @param offset The offset in the memory
		 * @param size the size of valid data in the memory
		 */
		public init(flags: MemoryFlags, allocator: Allocator, parent: Memory, maxsize: number, align: number, offset: number, size: number): void;
		/**
		 * Check if #mem1 and mem2 share the memory with a common parent memory object
		 * and that the memory is contiguous.
		 * 
		 * If this is the case, the memory of #mem1 and #mem2 can be merged
		 * efficiently by performing {@link Gst.Memory.share} on the parent object from
		 * the returned #offset.
		 * @param mem2 a {@link Memory}
		 * @returns %TRUE if the memory is contiguous and of a common parent.
		 * 
		 * a pointer to a result offset
		 */
		public is_span(mem2: Memory): [ boolean, number ];
		/**
		 * Check if #mem if allocated with an allocator for #mem_type.
		 * @param mem_type a memory type
		 * @returns %TRUE if #mem was allocated from an allocator for #mem_type.
		 */
		public is_type(mem_type: string): boolean;
		/**
		 * Create a {@link Memory} object that is mapped with #flags. If #mem is mappable
		 * with #flags, this function returns the mapped #mem directly. Otherwise a
		 * mapped copy of #mem is returned.
		 * 
		 * This function takes ownership of old #mem and returns a reference to a new
		 * #GstMemory.
		 * @param flags mapping flags
		 * @returns a {@link Memory} object mapped
		 * with #flags or %NULL when a mapping is not possible.
		 * 
		 * pointer for info
		 */
		public make_mapped(flags: MapFlags): [ Memory | null, MapInfo ];
		/**
		 * Fill #info with the pointer and sizes of the memory in #mem that can be
		 * accessed according to #flags.
		 * 
		 * This function can return %FALSE for various reasons:
		 * - the memory backed by #mem is not accessible with the given #flags.
		 * - the memory was already mapped with a different mapping.
		 * 
		 * #info and its contents remain valid for as long as #mem is valid and
		 * until {@link Gst.Memory.unmap} is called.
		 * 
		 * For each gst_memory_map() call, a corresponding gst_memory_unmap() call
		 * should be done.
		 * @param flags mapping flags
		 * @returns %TRUE if the map operation was successful.
		 * 
		 * pointer for info
		 */
		public map(flags: MapFlags): [ boolean, MapInfo ];
		/**
		 * Resize the memory region. #mem should be writable and offset + size should be
		 * less than the maxsize of #mem.
		 * 
		 * #GST_MEMORY_FLAG_ZERO_PREFIXED and #GST_MEMORY_FLAG_ZERO_PADDED will be
		 * cleared when offset or padding is increased respectively.
		 * @param offset a new offset
		 * @param size a new size
		 */
		public resize(offset: number, size: number): void;
		/**
		 * Return a shared copy of #size bytes from #mem starting from #offset. No
		 * memory copy is performed and the memory region is simply shared. The result
		 * is guaranteed to be non-writable. #size can be set to -1 to return a shared
		 * copy from #offset to the end of the memory region.
		 * @param offset offset to share from
		 * @param size size to share, or -1 to share to the end of the memory region
		 * @returns a new {@link Memory}.
		 */
		public share(offset: number, size: number): Memory;
		/**
		 * Release the memory obtained with {@link Gst.Memory.map}
		 * @param info a {@link MapInfo}
		 */
		public unmap(info: MapInfo): void;
	}

	export interface MessageInitOptions {}
	/**
	 * Messages are implemented as a subclass of {@link MiniObject} with a generic
	 * #GstStructure as the content. This allows for writing custom messages without
	 * requiring an API change while allowing a wide range of different types
	 * of messages.
	 * 
	 * Messages are posted by objects in the pipeline and are passed to the
	 * application using the #GstBus.
	 * 
	 * The basic use pattern of posting a message on a #GstBus is as follows:
	 * |[<!-- language="C" -->
	 *   gst_bus_post (bus, {@link Gst.Message.new_eos});
	 * ]|
	 * 
	 * A #GstElement usually posts messages on the bus provided by the parent
	 * container using gst_element_post_message().
	 */
	interface Message {}
	class Message {
		public constructor(options?: Partial<MessageInitOptions>);
		/**
		 * Create a new application-typed message. GStreamer will never create these
		 * messages; they are a gift from us to you. Enjoy.
		 * @param src The object originating the message.
		 * @param structure the structure for the message. The message
		 *     will take ownership of the structure.
		 * @returns The new application message.
		 * 
		 * MT safe.
		 */
		public static new_application(src: Object | null, structure: Structure): Message | null;
		/**
		 * The message is posted when elements completed an ASYNC state change.
		 * #running_time contains the time of the desired running_time when this
		 * elements goes to PLAYING. A value of #GST_CLOCK_TIME_NONE for #running_time
		 * means that the element has no clock interaction and thus doesn't care about
		 * the running_time of the pipeline.
		 * @param src The object originating the message.
		 * @param running_time the desired running_time
		 * @returns The new async_done message.
		 * 
		 * MT safe.
		 */
		public static new_async_done(src: Object | null, running_time: ClockTime): Message;
		/**
		 * This message is posted by elements when they start an ASYNC state change.
		 * @param src The object originating the message.
		 * @returns The new async_start message.
		 * 
		 * MT safe.
		 */
		public static new_async_start(src?: Object | null): Message;
		/**
		 * Create a new buffering message. This message can be posted by an element that
		 * needs to buffer data before it can continue processing. #percent should be a
		 * value between 0 and 100. A value of 100 means that the buffering completed.
		 * 
		 * When #percent is < 100 the application should PAUSE a PLAYING pipeline. When
		 * #percent is 100, the application can set the pipeline (back) to PLAYING.
		 * The application must be prepared to receive BUFFERING messages in the
		 * PREROLLING state and may only set the pipeline to PLAYING after receiving a
		 * message with #percent set to 100, which can happen after the pipeline
		 * completed prerolling.
		 * 
		 * MT safe.
		 * @param src The object originating the message.
		 * @param percent The buffering percent
		 * @returns The new buffering message.
		 */
		public static new_buffering(src: Object | null, percent: number): Message | null;
		/**
		 * Create a clock lost message. This message is posted whenever the
		 * clock is not valid anymore.
		 * 
		 * If this message is posted by the pipeline, the pipeline will
		 * select a new clock again when it goes to PLAYING. It might therefore
		 * be needed to set the pipeline to PAUSED and PLAYING again.
		 * @param src The object originating the message.
		 * @param clock the clock that was lost
		 * @returns The new clock lost message.
		 * 
		 * MT safe.
		 */
		public static new_clock_lost(src: Object | null, clock: Clock): Message;
		/**
		 * Create a clock provide message. This message is posted whenever an
		 * element is ready to provide a clock or lost its ability to provide
		 * a clock (maybe because it paused or became EOS).
		 * 
		 * This message is mainly used internally to manage the clock
		 * selection.
		 * @param src The object originating the message.
		 * @param clock the clock it provides
		 * @param ready %TRUE if the sender can provide a clock
		 * @returns the new provide clock message.
		 * 
		 * MT safe.
		 */
		public static new_clock_provide(src: Object | null, clock: Clock, ready: boolean): Message;
		/**
		 * Create a new custom-typed message. This can be used for anything not
		 * handled by other message-specific functions to pass a message to the
		 * app. The structure field can be %NULL.
		 * @param type The {@link MessageType} to distinguish messages
		 * @param src The object originating the message.
		 * @param structure the structure for the
		 *     message. The message will take ownership of the structure.
		 * @returns The new message.
		 * 
		 * MT safe.
		 */
		public static new_custom(type: MessageType, src?: Object | null, structure?: Structure | null): Message | null;
		/**
		 * Creates a new device-added message. The device-added message is produced by
		 * {@link DeviceProvider} or a #GstDeviceMonitor. They announce the appearance
		 * of monitored devices.
		 * @param src The {@link Object} that created the message
		 * @param device The new {@link Device}
		 * @returns a newly allocated {@link Message}
		 */
		public static new_device_added(src: Object, device: Device): Message;
		/**
		 * Creates a new device-changed message. The device-changed message is produced
		 * by {@link DeviceProvider} or a #GstDeviceMonitor. They announce that a device
		 * properties has changed and #device represent the new modified version of #changed_device.
		 * @param src The {@link Object} that created the message
		 * @param device The newly created device representing #replaced_device
		 *         with its new configuration.
		 * @param changed_device
		 * @returns a newly allocated {@link Message}
		 */
		public static new_device_changed(src: Object, device: Device, changed_device: Device): Message;
		/**
		 * Creates a new device-removed message. The device-removed message is produced
		 * by {@link DeviceProvider} or a #GstDeviceMonitor. They announce the
		 * disappearance of monitored devices.
		 * @param src The {@link Object} that created the message
		 * @param device The removed {@link Device}
		 * @returns a newly allocated {@link Message}
		 */
		public static new_device_removed(src: Object, device: Device): Message;
		/**
		 * Create a new duration changed message. This message is posted by elements
		 * that know the duration of a stream when the duration changes. This message
		 * is received by bins and is used to calculate the total duration of a
		 * pipeline.
		 * @param src The object originating the message.
		 * @returns The new duration-changed message.
		 * 
		 * MT safe.
		 */
		public static new_duration_changed(src?: Object | null): Message;
		/**
		 * Create a new element-specific message. This is meant as a generic way of
		 * allowing one-way communication from an element to an application, for example
		 * "the firewire cable was unplugged". The format of the message should be
		 * documented in the element's documentation. The structure field can be %NULL.
		 * @param src The object originating the message.
		 * @param structure The structure for the
		 *     message. The message will take ownership of the structure.
		 * @returns The new element message.
		 * 
		 * MT safe.
		 */
		public static new_element(src: Object | null, structure: Structure): Message | null;
		/**
		 * Create a new eos message. This message is generated and posted in
		 * the sink elements of a GstBin. The bin will only forward the EOS
		 * message to the application if all sinks have posted an EOS message.
		 * @param src The object originating the message.
		 * @returns The new eos message.
		 * 
		 * MT safe.
		 */
		public static new_eos(src?: Object | null): Message;
		/**
		 * Create a new error message. The message will copy #error and
		 * #debug. This message is posted by element when a fatal event
		 * occurred. The pipeline will probably (partially) stop. The application
		 * receiving this message should stop the pipeline.
		 * @param src The object originating the message.
		 * @param error The GError for this message.
		 * @param debug A debugging string.
		 * @returns the new error message.
		 * 
		 * MT safe.
		 */
		public static new_error(src: Object | null, error: GLib.Error, debug: string): Message;
		/**
		 * Create a new error message. The message will copy #error and
		 * #debug. This message is posted by element when a fatal event
		 * occurred. The pipeline will probably (partially) stop. The application
		 * receiving this message should stop the pipeline.
		 * @param src The object originating the message.
		 * @param error The GError for this message.
		 * @param debug A debugging string.
		 * @param details A GstStructure with details
		 * @returns the new error message.
		 */
		public static new_error_with_details(src: Object | null, error: GLib.Error, debug: string, details?: Structure | null): Message | null;
		/**
		 * This message is posted when an element has a new local {@link Context}.
		 * @param src The object originating the message.
		 * @param context the context
		 * @returns The new have-context message.
		 * 
		 * MT safe.
		 */
		public static new_have_context(src: Object | null, context: Context): Message;
		/**
		 * Create a new info message. The message will make copies of #error and
		 * #debug.
		 * @param src The object originating the message.
		 * @param error The GError for this message.
		 * @param debug A debugging string.
		 * @returns the new info message.
		 * 
		 * MT safe.
		 */
		public static new_info(src: Object | null, error: GLib.Error, debug: string): Message;
		/**
		 * Create a new info message. The message will make copies of #error and
		 * #debug.
		 * @param src The object originating the message.
		 * @param error The GError for this message.
		 * @param debug A debugging string.
		 * @param details A GstStructure with details
		 * @returns the new warning message.
		 */
		public static new_info_with_details(src: Object | null, error: GLib.Error, debug: string, details?: Structure | null): Message | null;
		/**
		 * Creates a new instant-rate-request message. Elements handling the
		 * instant-rate-change event must post this message. The message is
		 * handled at the pipeline, and allows the pipeline to select the
		 * running time when the rate change should happen and to send an
		 * #GST_EVENT_INSTANT_RATE_SYNC_TIME event to notify the elements
		 * in the pipeline.
		 * @param src The {@link Object} that posted the message
		 * @param rate_multiplier the rate multiplier factor that should be applied
		 * @returns a newly allocated {@link Message}
		 */
		public static new_instant_rate_request(src: Object, rate_multiplier: number): Message;
		/**
		 * This message can be posted by elements when their latency requirements have
		 * changed.
		 * @param src The object originating the message.
		 * @returns The new latency message.
		 * 
		 * MT safe.
		 */
		public static new_latency(src?: Object | null): Message;
		/**
		 * This message is posted when an element needs a specific {@link Context}.
		 * @param src The object originating the message.
		 * @param context_type The context type that is needed
		 * @returns The new need-context message.
		 * 
		 * MT safe.
		 */
		public static new_need_context(src: Object | null, context_type: string): Message;
		/**
		 * Create a new clock message. This message is posted whenever the
		 * pipeline selects a new clock for the pipeline.
		 * @param src The object originating the message.
		 * @param clock the new selected clock
		 * @returns The new new clock message.
		 * 
		 * MT safe.
		 */
		public static new_new_clock(src: Object | null, clock: Clock): Message;
		/**
		 * Progress messages are posted by elements when they use an asynchronous task
		 * to perform actions triggered by a state change.
		 * 
		 * #code contains a well defined string describing the action.
		 * #text should contain a user visible string detailing the current action.
		 * @param src The object originating the message.
		 * @param type a {@link ProgressType}
		 * @param code a progress code
		 * @param text free, user visible text describing the progress
		 * @returns The new qos message.
		 */
		public static new_progress(src: Object, type: ProgressType, code: string, text: string): Message | null;
		public static new_property_notify(src: Object, property_name: string, val?: GObject.Value | null): Message;
		/**
		 * A QOS message is posted on the bus whenever an element decides to drop a
		 * buffer because of QoS reasons or whenever it changes its processing strategy
		 * because of QoS reasons (quality adjustments such as processing at lower
		 * accuracy).
		 * 
		 * This message can be posted by an element that performs synchronisation against the
		 * clock (live) or it could be dropped by an element that performs QoS because of QOS
		 * events received from a downstream element (!live).
		 * 
		 * #running_time, #stream_time, #timestamp, #duration should be set to the
		 * respective running-time, stream-time, timestamp and duration of the (dropped)
		 * buffer that generated the QoS event. Values can be left to
		 * GST_CLOCK_TIME_NONE when unknown.
		 * @param src The object originating the message.
		 * @param live if the message was generated by a live element
		 * @param running_time the running time of the buffer that generated the message
		 * @param stream_time the stream time of the buffer that generated the message
		 * @param timestamp the timestamps of the buffer that generated the message
		 * @param duration the duration of the buffer that generated the message
		 * @returns The new qos message.
		 * 
		 * MT safe.
		 */
		public static new_qos(src: Object, live: boolean, running_time: number, stream_time: number, timestamp: number, duration: number): Message;
		/**
		 * Creates a new redirect message and adds a new entry to it. Redirect messages
		 * are posted when an element detects that the actual data has to be retrieved
		 * from a different location. This is useful if such a redirection cannot be
		 * handled inside a source element, for example when HTTP 302/303 redirects
		 * return a non-HTTP URL.
		 * 
		 * The redirect message can hold multiple entries. The first one is added
		 * when the redirect message is created, with the given location, tag_list,
		 * entry_struct arguments. Use {@link Gst.Message.add_redirect_entry} to add more
		 * entries.
		 * 
		 * Each entry has a location, a tag list, and a structure. All of these are
		 * optional. The tag list and structure are useful for additional metadata,
		 * such as bitrate statistics for the given location.
		 * 
		 * By default, message recipients should treat entries in the order they are
		 * stored. The recipient should therefore try entry \#0 first, and if this
		 * entry is not acceptable or working, try entry \#1 etc. Senders must make
		 * sure that they add entries in this order. However, recipients are free to
		 * ignore the order and pick an entry that is "best" for them. One example
		 * would be a recipient that scans the entries for the one with the highest
		 * bitrate tag.
		 * 
		 * The specified location string is copied. However, ownership over the tag
		 * list and structure are transferred to the message.
		 * @param src The {@link Object} whose property changed (may or may not be a #GstElement)
		 * @param location location string for the new entry
		 * @param tag_list tag list for the new entry
		 * @param entry_struct structure for the new entry
		 * @returns a newly allocated {@link Message}
		 */
		public static new_redirect(src: Object, location: string, tag_list?: TagList | null, entry_struct?: Structure | null): Message;
		/**
		 * This message can be posted by elements when they want to have their state
		 * changed. A typical use case would be an audio server that wants to pause the
		 * pipeline because a higher priority stream is being played.
		 * @param src The object originating the message.
		 * @param state The new requested state
		 * @returns the new request state message.
		 * 
		 * MT safe.
		 */
		public static new_request_state(src: Object | null, state: State): Message;
		/**
		 * This message is posted when the pipeline running-time should be reset to
		 * #running_time, like after a flushing seek.
		 * @param src The object originating the message.
		 * @param running_time the requested running-time
		 * @returns The new reset_time message.
		 * 
		 * MT safe.
		 */
		public static new_reset_time(src: Object | null, running_time: ClockTime): Message;
		/**
		 * Create a new segment done message. This message is posted by elements that
		 * finish playback of a segment as a result of a segment seek. This message
		 * is received by the application after all elements that posted a segment_start
		 * have posted the segment_done.
		 * @param src The object originating the message.
		 * @param format The format of the position being done
		 * @param position The position of the segment being done
		 * @returns the new segment done message.
		 * 
		 * MT safe.
		 */
		public static new_segment_done(src: Object | null, format: Format, position: number): Message;
		/**
		 * Create a new segment message. This message is posted by elements that
		 * start playback of a segment as a result of a segment seek. This message
		 * is not received by the application but is used for maintenance reasons in
		 * container elements.
		 * @param src The object originating the message.
		 * @param format The format of the position being played
		 * @param position The position of the segment being played
		 * @returns the new segment start message.
		 * 
		 * MT safe.
		 */
		public static new_segment_start(src: Object | null, format: Format, position: number): Message;
		/**
		 * Create a state change message. This message is posted whenever an element
		 * changed its state.
		 * @param src The object originating the message.
		 * @param oldstate the previous state
		 * @param newstate the new (current) state
		 * @param pending the pending (target) state
		 * @returns the new state change message.
		 * 
		 * MT safe.
		 */
		public static new_state_changed(src: Object | null, oldstate: State, newstate: State, pending: State): Message;
		/**
		 * Create a state dirty message. This message is posted whenever an element
		 * changed its state asynchronously and is used internally to update the
		 * states of container objects.
		 * @param src The object originating the message
		 * @returns the new state dirty message.
		 * 
		 * MT safe.
		 */
		public static new_state_dirty(src?: Object | null): Message;
		/**
		 * This message is posted by elements when they complete a part, when #intermediate set
		 * to %TRUE, or a complete step operation.
		 * 
		 * #duration will contain the amount of time (in GST_FORMAT_TIME) of the stepped
		 * #amount of media in format #format.
		 * @param src The object originating the message.
		 * @param format the format of #amount
		 * @param amount the amount of stepped data
		 * @param rate the rate of the stepped amount
		 * @param flush is this an flushing step
		 * @param intermediate is this an intermediate step
		 * @param duration the duration of the data
		 * @param eos the step caused EOS
		 * @returns the new step_done message.
		 * 
		 * MT safe.
		 */
		public static new_step_done(src: Object, format: Format, amount: number, rate: number, flush: boolean, intermediate: boolean, duration: number, eos: boolean): Message;
		/**
		 * This message is posted by elements when they accept or activate a new step
		 * event for #amount in #format.
		 * 
		 * #active is set to %FALSE when the element accepted the new step event and has
		 * queued it for execution in the streaming threads.
		 * 
		 * #active is set to %TRUE when the element has activated the step operation and
		 * is now ready to start executing the step in the streaming thread. After this
		 * message is emitted, the application can queue a new step operation in the
		 * element.
		 * @param src The object originating the message.
		 * @param active if the step is active or queued
		 * @param format the format of #amount
		 * @param amount the amount of stepped data
		 * @param rate the rate of the stepped amount
		 * @param flush is this an flushing step
		 * @param intermediate is this an intermediate step
		 * @returns The new step_start message.
		 * 
		 * MT safe.
		 */
		public static new_step_start(src: Object, active: boolean, format: Format, amount: number, rate: number, flush: boolean, intermediate: boolean): Message;
		/**
		 * Creates a new stream-collection message. The message is used to announce new
		 * {@link StreamCollection}
		 * @param src The {@link Object} that created the message
		 * @param collection The {@link StreamCollection}
		 * @returns a newly allocated {@link Message}
		 */
		public static new_stream_collection(src: Object, collection: StreamCollection): Message;
		/**
		 * Create a new stream_start message. This message is generated and posted in
		 * the sink elements of a GstBin. The bin will only forward the STREAM_START
		 * message to the application if all sinks have posted an STREAM_START message.
		 * @param src The object originating the message.
		 * @returns The new stream_start message.
		 * 
		 * MT safe.
		 */
		public static new_stream_start(src?: Object | null): Message;
		/**
		 * Create a new stream status message. This message is posted when a streaming
		 * thread is created/destroyed or when the state changed.
		 * @param src The object originating the message.
		 * @param type The stream status type.
		 * @param owner the owner element of #src.
		 * @returns the new stream status message.
		 * 
		 * MT safe.
		 */
		public static new_stream_status(src: Object, type: StreamStatusType, owner: Element): Message;
		/**
		 * Creates a new steams-selected message. The message is used to announce
		 * that an array of streams has been selected. This is generally in response
		 * to a #GST_EVENT_SELECT_STREAMS event, or when an element (such as decodebin3)
		 * makes an initial selection of streams.
		 * 
		 * The message also contains the {@link StreamCollection} to which the various streams
		 * belong to.
		 * 
		 * Users of {@link Gst.Message.new_streams_selected} can add the selected streams with
		 * gst_message_streams_selected_add().
		 * @param src The {@link Object} that created the message
		 * @param collection The {@link StreamCollection}
		 * @returns a newly allocated {@link Message}
		 */
		public static new_streams_selected(src: Object, collection: StreamCollection): Message;
		/**
		 * Create a new structure change message. This message is posted when the
		 * structure of a pipeline is in the process of being changed, for example
		 * when pads are linked or unlinked.
		 * 
		 * #src should be the sinkpad that unlinked or linked.
		 * @param src The object originating the message.
		 * @param type The change type.
		 * @param owner The owner element of #src.
		 * @param busy Whether the structure change is busy.
		 * @returns the new structure change message.
		 * 
		 * MT safe.
		 */
		public static new_structure_change(src: Object | null, type: StructureChangeType, owner: Element, busy: boolean): Message;
		/**
		 * Create a new tag message. The message will take ownership of the tag list.
		 * The message is posted by elements that discovered a new taglist.
		 * @param src The object originating the message.
		 * @param tag_list the tag list for the message.
		 * @returns the new tag message.
		 * 
		 * MT safe.
		 */
		public static new_tag(src: Object | null, tag_list: TagList): Message;
		/**
		 * Create a new TOC message. The message is posted by elements
		 * that discovered or updated a TOC.
		 * @param src the object originating the message.
		 * @param toc {@link Toc} structure for the message.
		 * @param updated whether TOC was updated or not.
		 * @returns a new TOC message.
		 * 
		 * MT safe.
		 */
		public static new_toc(src: Object, toc: Toc, updated: boolean): Message;
		/**
		 * Create a new warning message. The message will make copies of #error and
		 * #debug.
		 * @param src The object originating the message.
		 * @param error The GError for this message.
		 * @param debug A debugging string.
		 * @returns the new warning message.
		 * 
		 * MT safe.
		 */
		public static new_warning(src: Object | null, error: GLib.Error, debug: string): Message;
		/**
		 * Create a new warning message. The message will make copies of #error and
		 * #debug.
		 * @param src The object originating the message.
		 * @param error The GError for this message.
		 * @param debug A debugging string.
		 * @param details A GstStructure with details
		 * @returns the new warning message.
		 */
		public static new_warning_with_details(src: Object | null, error: GLib.Error, debug: string, details?: Structure | null): Message | null;
		/**
		 * Modifies a pointer to a {@link Message} to point to a different #GstMessage. The
		 * modification is done atomically (so this is useful for ensuring thread safety
		 * in some cases), and the reference counts are updated appropriately (the old
		 * message is unreffed, the new one is reffed).
		 * 
		 * Either #new_message or the #GstMessage pointed to by #old_message may be %NULL.
		 * @param new_message pointer to a {@link Message} that will
		 *     replace the message pointed to by #old_message.
		 * @returns %TRUE if #new_message was different from #old_message
		 */
		public static replace(new_message?: Message | null): boolean;
		/**
		 * the parent structure
		 */
		public mini_object: MiniObject;
		/**
		 * the {@link MessageType} of the message
		 */
		public type: MessageType;
		/**
		 * the timestamp of the message
		 */
		public timestamp: number;
		/**
		 * the src of the message
		 */
		public src: Object;
		/**
		 * the sequence number of the message
		 */
		public seqnum: number;
		public readonly lock: GLib.Mutex;
		public readonly cond: GLib.Cond;
		/**
		 * Creates and appends a new entry.
		 * 
		 * The specified location string is copied. However, ownership over the tag
		 * list and structure are transferred to the message.
		 * @param location location string for the new entry
		 * @param tag_list tag list for the new entry
		 * @param entry_struct structure for the new entry
		 */
		public add_redirect_entry(location: string, tag_list?: TagList | null, entry_struct?: Structure | null): void;
		/**
		 * Creates a copy of the message. Returns a copy of the message.
		 * @returns a new copy of #msg.
		 * 
		 * MT safe
		 */
		public copy(): Message;
		public get_num_redirect_entries(): number;
		/**
		 * Retrieve the sequence number of a message.
		 * 
		 * Messages have ever-incrementing sequence numbers, which may also be set
		 * explicitly via {@link Gst.Message.set_seqnum}. Sequence numbers are typically used
		 * to indicate that a message corresponds to some other set of messages or
		 * events, for example a SEGMENT_DONE message corresponding to a SEEK event. It
		 * is considered good practice to make this correspondence when possible, though
		 * it is not required.
		 * 
		 * Note that events and messages share the same sequence number incrementor;
		 * two events or messages will never have the same sequence number unless
		 * that correspondence was made explicitly.
		 * @returns The message's sequence number.
		 * 
		 * MT safe.
		 */
		public get_seqnum(): number;
		/**
		 * Extracts the object managing the streaming thread from #message.
		 * @returns a GValue containing the object that manages the
		 * streaming thread. This object is usually of type GstTask but other types can
		 * be added in the future. The object remains valid as long as #message is
		 * valid.
		 */
		public get_stream_status_object(): GObject.Value | null;
		/**
		 * Access the structure of the message.
		 * @returns The structure of the message. The
		 * structure is still owned by the message, which means that you should not
		 * free it and that the pointer becomes invalid when you free the message.
		 * 
		 * MT safe.
		 */
		public get_structure(): Structure | null;
		/**
		 * Checks if #message has the given #name. This function is usually used to
		 * check the name of a custom message.
		 * @param name name to check
		 * @returns %TRUE if #name matches the name of the message structure.
		 */
		public has_name(name: string): boolean;
		/**
		 * Extract the running_time from the async_done message.
		 * 
		 * MT safe.
		 * @returns Result location for the running_time or %NULL
		 */
		public parse_async_done(): ClockTime | null;
		/**
		 * Extracts the buffering percent from the GstMessage. see also
		 * {@link Gst.Message.new_buffering}.
		 * 
		 * MT safe.
		 * @returns Return location for the percent.
		 */
		public parse_buffering(): number | null;
		/**
		 * Extracts the buffering stats values from #message.
		 * @returns a buffering mode, or %NULL
		 * 
		 * the average input rate, or %NULL
		 * 
		 * the average output rate, or %NULL
		 * 
		 * amount of buffering time left in
		 *     milliseconds, or %NULL
		 */
		public parse_buffering_stats(): [ mode: BufferingMode | null, avg_in: number | null, avg_out: number | null, buffering_left: number | null ];
		/**
		 * Extracts the lost clock from the GstMessage.
		 * The clock object returned remains valid until the message is freed.
		 * 
		 * MT safe.
		 * @returns a pointer to hold the lost clock
		 */
		public parse_clock_lost(): Clock | null;
		/**
		 * Extracts the clock and ready flag from the GstMessage.
		 * The clock object returned remains valid until the message is freed.
		 * 
		 * MT safe.
		 * @returns a pointer to  hold a clock
		 *     object, or %NULL
		 * 
		 * a pointer to hold the ready flag, or %NULL
		 */
		public parse_clock_provide(): [ clock: Clock | null, ready: boolean | null ];
		/**
		 * Parse a context type from an existing GST_MESSAGE_NEED_CONTEXT message.
		 * @returns a #gboolean indicating if the parsing succeeded.
		 * 
		 * the context type, or %NULL
		 */
		public parse_context_type(): [ boolean, string | null ];
		/**
		 * Parses a device-added message. The device-added message is produced by
		 * {@link DeviceProvider} or a #GstDeviceMonitor. It announces the appearance
		 * of monitored devices.
		 * @returns A location where to store a
		 *  pointer to the new {@link Device}, or %NULL
		 */
		public parse_device_added(): Device | null;
		/**
		 * Parses a device-changed message. The device-changed message is produced by
		 * {@link DeviceProvider} or a #GstDeviceMonitor. It announces the
		 * disappearance of monitored devices. * It announce that a device properties has
		 * changed and #device represents the new modified version of #changed_device.
		 * @returns A location where to store a
		 *  pointer to the updated version of the {@link Device}, or %NULL
		 * 
		 * A location where to store a
		 *  pointer to the old version of the #GstDevice, or %NULL
		 */
		public parse_device_changed(): [ device: Device | null, changed_device: Device | null ];
		/**
		 * Parses a device-removed message. The device-removed message is produced by
		 * {@link DeviceProvider} or a #GstDeviceMonitor. It announces the
		 * disappearance of monitored devices.
		 * @returns A location where to store a
		 *  pointer to the removed {@link Device}, or %NULL
		 */
		public parse_device_removed(): Device | null;
		/**
		 * Extracts the GError and debug string from the GstMessage. The values returned
		 * in the output arguments are copies; the caller must free them when done.
		 * 
		 * Typical usage of this function might be:
		 * |[<!-- language="C" -->
		 *   ...
		 *   switch (GST_MESSAGE_TYPE (msg)) {
		 *     case GST_MESSAGE_ERROR: {
		 *       GError *err = NULL;
		 *       gchar *dbg_info = NULL;
		 * 
		 *       gst_message_parse_error (msg, &amp;err, &amp;dbg_info);
		 *       g_printerr ("ERROR from element %s: %s\n",
		 *           GST_OBJECT_NAME (msg->src), err->message);
		 *       g_printerr ("Debugging info: %s\n", (dbg_info) ? dbg_info : "none");
		 *       g_error_free (err);
		 *       g_free (dbg_info);
		 *       break;
		 *     }
		 *     ...
		 *   }
		 *   ...
		 * ]|
		 * 
		 * MT safe.
		 * @returns location for the GError
		 * 
		 * location for the debug message,
		 *     or %NULL
		 */
		public parse_error(): [ gerror: GLib.Error | null, debug: string | null ];
		/**
		 * Returns the optional details structure, may be NULL if none.
		 * The returned structure must not be freed.
		 * @returns A pointer to the returned details
		 */
		public parse_error_details(): Structure;
		/**
		 * Extract the group from the STREAM_START message.
		 * @returns %TRUE if the message had a group id set, %FALSE otherwise
		 * 
		 * MT safe.
		 * 
		 * Result location for the group id or
		 *      %NULL
		 */
		public parse_group_id(): [ boolean, number | null ];
		/**
		 * Extract the context from the HAVE_CONTEXT message.
		 * 
		 * MT safe.
		 * @returns Result location for the
		 *      context or %NULL
		 */
		public parse_have_context(): Context | null;
		/**
		 * Extracts the GError and debug string from the GstMessage. The values returned
		 * in the output arguments are copies; the caller must free them when done.
		 * 
		 * MT safe.
		 * @returns location for the GError
		 * 
		 * location for the debug message,
		 *     or %NULL
		 */
		public parse_info(): [ gerror: GLib.Error | null, debug: string | null ];
		/**
		 * Returns the optional details structure, may be NULL if none
		 * The returned structure must not be freed.
		 * @returns A pointer to the returned details structure
		 */
		public parse_info_details(): Structure;
		/**
		 * Parses the rate_multiplier from the instant-rate-request message.
		 * @returns return location for the rate, or %NULL
		 */
		public parse_instant_rate_request(): number | null;
		/**
		 * Extracts the new clock from the GstMessage.
		 * The clock object returned remains valid until the message is freed.
		 * 
		 * MT safe.
		 * @returns a pointer to hold the selected
		 *     new clock
		 */
		public parse_new_clock(): Clock | null;
		/**
		 * Parses the progress #type, #code and #text.
		 * @returns location for the type
		 * 
		 * location for the code
		 * 
		 * location for the text
		 */
		public parse_progress(): [ type: ProgressType | null, code: string | null, text: string | null ];
		/**
		 * Parses a property-notify message. These will be posted on the bus only
		 * when set up with {@link Gst.Element.add_property_notify_watch} or
		 * gst_element_add_property_deep_notify_watch().
		 * @returns location where to store a
		 *     pointer to the object whose property got changed, or %NULL
		 * 
		 * return location for
		 *     the name of the property that got changed, or %NULL
		 * 
		 * return location for
		 *     the new value of the property that got changed, or %NULL. This will
		 *     only be set if the property notify watch was told to include the value
		 *     when it was set up
		 */
		public parse_property_notify(): [ object: Object | null, property_name: string | null, property_value: GObject.Value | null ];
		/**
		 * Extract the timestamps and live status from the QoS message.
		 * 
		 * The returned values give the running_time, stream_time, timestamp and
		 * duration of the dropped buffer. Values of GST_CLOCK_TIME_NONE mean unknown
		 * values.
		 * 
		 * MT safe.
		 * @returns if the message was generated by a live element
		 * 
		 * the running time of the buffer that
		 *     generated the message
		 * 
		 * the stream time of the buffer that
		 *     generated the message
		 * 
		 * the timestamps of the buffer that
		 *     generated the message
		 * 
		 * the duration of the buffer that
		 *     generated the message
		 */
		public parse_qos(): [ live: boolean | null, running_time: number | null, stream_time: number | null, timestamp: number | null, duration: number | null ];
		/**
		 * Extract the QoS stats representing the history of the current continuous
		 * pipeline playback period.
		 * 
		 * When #format is #GST_FORMAT_UNDEFINED both #dropped and #processed are
		 * invalid. Values of -1 for either #processed or #dropped mean unknown values.
		 * 
		 * MT safe.
		 * @returns Units of the 'processed' and 'dropped' fields.
		 *     Video sinks and video filters will use GST_FORMAT_BUFFERS (frames).
		 *     Audio sinks and audio filters will likely use GST_FORMAT_DEFAULT
		 *     (samples).
		 * 
		 * Total number of units correctly processed
		 *     since the last state change to READY or a flushing operation.
		 * 
		 * Total number of units dropped since the last
		 *     state change to READY or a flushing operation.
		 */
		public parse_qos_stats(): [ format: Format | null, processed: number | null, dropped: number | null ];
		/**
		 * Extract the QoS values that have been calculated/analysed from the QoS data
		 * 
		 * MT safe.
		 * @returns The difference of the running-time against
		 *     the deadline.
		 * 
		 * Long term prediction of the ideal rate
		 *     relative to normal rate to get optimal quality.
		 * 
		 * An element dependent integer value that
		 *     specifies the current quality level of the element. The default
		 *     maximum quality is 1000000.
		 */
		public parse_qos_values(): [ jitter: number | null, proportion: number | null, quality: number | null ];
		/**
		 * Parses the location and/or structure from the entry with the given index.
		 * The index must be between 0 and {@link Gst.Message.get_num_redirect_entries} - 1.
		 * Returned pointers are valid for as long as this message exists.
		 * @param entry_index index of the entry to parse
		 * @returns return location for
		 *     the pointer to the entry's location string, or %NULL
		 * 
		 * return location for
		 *     the pointer to the entry's tag list, or %NULL
		 * 
		 * return location
		 *     for the pointer to the entry's structure, or %NULL
		 */
		public parse_redirect_entry(entry_index: number): [ location: string | null, tag_list: TagList | null, entry_struct: Structure | null ];
		/**
		 * Extract the requested state from the request_state message.
		 * 
		 * MT safe.
		 * @returns Result location for the requested state or %NULL
		 */
		public parse_request_state(): State | null;
		/**
		 * Extract the running-time from the RESET_TIME message.
		 * 
		 * MT safe.
		 * @returns Result location for the running_time or
		 *      %NULL
		 */
		public parse_reset_time(): ClockTime | null;
		/**
		 * Extracts the position and format from the segment done message.
		 * 
		 * MT safe.
		 * @returns Result location for the format, or %NULL
		 * 
		 * Result location for the position, or %NULL
		 */
		public parse_segment_done(): [ format: Format | null, position: number | null ];
		/**
		 * Extracts the position and format from the segment start message.
		 * 
		 * MT safe.
		 * @returns Result location for the format, or %NULL
		 * 
		 * Result location for the position, or %NULL
		 */
		public parse_segment_start(): [ format: Format | null, position: number | null ];
		/**
		 * Extracts the old and new states from the GstMessage.
		 * 
		 * Typical usage of this function might be:
		 * |[<!-- language="C" -->
		 *   ...
		 *   switch (GST_MESSAGE_TYPE (msg)) {
		 *     case GST_MESSAGE_STATE_CHANGED: {
		 *       GstState old_state, new_state;
		 * 
		 *       gst_message_parse_state_changed (msg, &amp;old_state, &amp;new_state, NULL);
		 *       g_print ("Element %s changed state from %s to %s.\n",
		 *           GST_OBJECT_NAME (msg->src),
		 *           gst_element_state_get_name (old_state),
		 *           gst_element_state_get_name (new_state));
		 *       break;
		 *     }
		 *     ...
		 *   }
		 *   ...
		 * ]|
		 * 
		 * MT safe.
		 * @returns the previous state, or %NULL
		 * 
		 * the new (current) state, or %NULL
		 * 
		 * the pending (target) state, or %NULL
		 */
		public parse_state_changed(): [ oldstate: State | null, newstate: State | null, pending: State | null ];
		/**
		 * Extract the values the step_done message.
		 * 
		 * MT safe.
		 * @returns result location for the format
		 * 
		 * result location for the amount
		 * 
		 * result location for the rate
		 * 
		 * result location for the flush flag
		 * 
		 * result location for the intermediate flag
		 * 
		 * result location for the duration
		 * 
		 * result location for the EOS flag
		 */
		public parse_step_done(): [ format: Format | null, amount: number | null, rate: number | null, flush: boolean | null, intermediate: boolean | null, duration: number | null, eos: boolean | null ];
		/**
		 * Extract the values from step_start message.
		 * 
		 * MT safe.
		 * @returns result location for the active flag
		 * 
		 * result location for the format
		 * 
		 * result location for the amount
		 * 
		 * result location for the rate
		 * 
		 * result location for the flush flag
		 * 
		 * result location for the intermediate flag
		 */
		public parse_step_start(): [ active: boolean | null, format: Format | null, amount: number | null, rate: number | null, flush: boolean | null, intermediate: boolean | null ];
		/**
		 * Parses a stream-collection message.
		 * @returns A location where to store a
		 *  pointer to the {@link StreamCollection}, or %NULL
		 */
		public parse_stream_collection(): StreamCollection | null;
		/**
		 * Extracts the stream status type and owner the GstMessage. The returned
		 * owner remains valid for as long as the reference to #message is valid and
		 * should thus not be unreffed.
		 * 
		 * MT safe.
		 * @returns A pointer to hold the status type
		 * 
		 * The owner element of the message source
		 */
		public parse_stream_status(): [ type: StreamStatusType, owner: Element ];
		/**
		 * Parses a streams-selected message.
		 * @returns A location where to store a
		 *  pointer to the {@link StreamCollection}, or %NULL
		 */
		public parse_streams_selected(): StreamCollection | null;
		/**
		 * Extracts the change type and completion status from the GstMessage.
		 * 
		 * MT safe.
		 * @returns A pointer to hold the change type
		 * 
		 * The owner element of the
		 *     message source
		 * 
		 * a pointer to hold whether the change is in
		 *     progress or has been completed
		 */
		public parse_structure_change(): [ type: StructureChangeType, owner: Element | null, busy: boolean | null ];
		/**
		 * Extracts the tag list from the GstMessage. The tag list returned in the
		 * output argument is a copy; the caller must free it when done.
		 * 
		 * Typical usage of this function might be:
		 * |[<!-- language="C" -->
		 *   ...
		 *   switch (GST_MESSAGE_TYPE (msg)) {
		 *     case GST_MESSAGE_TAG: {
		 *       GstTagList *tags = NULL;
		 * 
		 *       gst_message_parse_tag (msg, &amp;tags);
		 *       g_print ("Got tags from element %s\n", GST_OBJECT_NAME (msg->src));
		 *       handle_tags (tags);
		 *       gst_tag_list_unref (tags);
		 *       break;
		 *     }
		 *     ...
		 *   }
		 *   ...
		 * ]|
		 * 
		 * MT safe.
		 * @returns return location for the tag-list.
		 */
		public parse_tag(): TagList;
		/**
		 * Extract the TOC from the {@link Message}. The TOC returned in the
		 * output argument is a copy; the caller must free it with
		 * {@link Gst.Toc.unref} when done.
		 * 
		 * MT safe.
		 * @returns return location for the TOC.
		 * 
		 * return location for the updated flag.
		 */
		public parse_toc(): [ toc: Toc, updated: boolean ];
		/**
		 * Extracts the GError and debug string from the GstMessage. The values returned
		 * in the output arguments are copies; the caller must free them when done.
		 * 
		 * MT safe.
		 * @returns location for the GError
		 * 
		 * location for the debug message,
		 *     or %NULL
		 */
		public parse_warning(): [ gerror: GLib.Error | null, debug: string | null ];
		/**
		 * Returns the optional details structure, may be NULL if none
		 * The returned structure must not be freed.
		 * @returns A pointer to the returned details structure
		 */
		public parse_warning_details(): Structure;
		/**
		 * Configures the buffering stats values in #message.
		 * @param mode a buffering mode
		 * @param avg_in the average input rate
		 * @param avg_out the average output rate
		 * @param buffering_left amount of buffering time left in milliseconds
		 */
		public set_buffering_stats(mode: BufferingMode, avg_in: number, avg_out: number, buffering_left: number): void;
		/**
		 * Sets the group id on the stream-start message.
		 * 
		 * All streams that have the same group id are supposed to be played
		 * together, i.e. all streams inside a container file should have the
		 * same group id but different stream ids. The group id should change
		 * each time the stream is started, resulting in different group ids
		 * each time a file is played for example.
		 * 
		 * MT safe.
		 * @param group_id the group id
		 */
		public set_group_id(group_id: number): void;
		/**
		 * Set the QoS stats representing the history of the current continuous pipeline
		 * playback period.
		 * 
		 * When #format is #GST_FORMAT_UNDEFINED both #dropped and #processed are
		 * invalid. Values of -1 for either #processed or #dropped mean unknown values.
		 * 
		 * MT safe.
		 * @param format Units of the 'processed' and 'dropped' fields. Video sinks and video
		 * filters will use GST_FORMAT_BUFFERS (frames). Audio sinks and audio filters
		 * will likely use GST_FORMAT_DEFAULT (samples).
		 * @param processed Total number of units correctly processed since the last state
		 * change to READY or a flushing operation.
		 * @param dropped Total number of units dropped since the last state change to READY
		 * or a flushing operation.
		 */
		public set_qos_stats(format: Format, processed: number, dropped: number): void;
		/**
		 * Set the QoS values that have been calculated/analysed from the QoS data
		 * 
		 * MT safe.
		 * @param jitter The difference of the running-time against the deadline.
		 * @param proportion Long term prediction of the ideal rate relative to normal rate
		 * to get optimal quality.
		 * @param quality An element dependent integer value that specifies the current
		 * quality level of the element. The default maximum quality is 1000000.
		 */
		public set_qos_values(jitter: number, proportion: number, quality: number): void;
		/**
		 * Set the sequence number of a message.
		 * 
		 * This function might be called by the creator of a message to indicate that
		 * the message relates to other messages or events. See {@link Gst.Message.get_seqnum}
		 * for more information.
		 * 
		 * MT safe.
		 * @param seqnum A sequence number.
		 */
		public set_seqnum(seqnum: number): void;
		/**
		 * Configures the object handling the streaming thread. This is usually a
		 * GstTask object but other objects might be added in the future.
		 * @param object the object controlling the streaming
		 */
		public set_stream_status_object(object: GObject.Value): void;
		/**
		 * Adds the #stream to the #message.
		 * @param stream a {@link Stream} to add to #message
		 */
		public streams_selected_add(stream: Stream): void;
		/**
		 * Returns the number of streams contained in the #message.
		 * @returns The number of streams contained within.
		 */
		public streams_selected_get_size(): number;
		/**
		 * Retrieves the {@link Stream} with index #index from the #message.
		 * @param idx Index of the stream to retrieve
		 * @returns A {@link Stream}
		 */
		public streams_selected_get_stream(idx: number): Stream | null;
		/**
		 * Get a writable version of the structure.
		 * @returns The structure of the message. The structure
		 * is still owned by the message, which means that you should not free
		 * it and that the pointer becomes invalid when you free the message.
		 * This function checks if #message is writable and will never return
		 * %NULL.
		 * 
		 * MT safe.
		 */
		public writable_structure(): Structure;
	}

	export interface MetaInitOptions {}
	/**
	 * The {@link Meta} structure should be included as the first member of a #GstBuffer
	 * metadata structure. The structure defines the API of the metadata and should
	 * be accessible to all elements using the metadata.
	 * 
	 * A metadata API is registered with {@link Gst.meta.api_type_register} which takes a
	 * name for the metadata API and some tags associated with the metadata.
	 * With gst_meta_api_type_has_tag() one can check if a certain metadata API
	 * contains a given tag.
	 * 
	 * Multiple implementations of a metadata API can be registered.
	 * To implement a metadata API, gst_meta_register() should be used. This
	 * function takes all parameters needed to create, free and transform metadata
	 * along with the size of the metadata. The function returns a #GstMetaInfo
	 * structure that contains the information for the implementation of the API.
	 * 
	 * A specific implementation can be retrieved by name with gst_meta_get_info().
	 * 
	 * See #GstBuffer for how the metadata can be added, retrieved and removed from
	 * buffers.
	 */
	interface Meta {}
	class Meta {
		public constructor(options?: Partial<MetaInitOptions>);
		public static api_type_get_tags(api: GObject.Type): string[];
		/**
		 * Check if #api was registered with #tag.
		 * @param api an API
		 * @param tag the tag to check
		 * @returns %TRUE if #api was registered with #tag.
		 */
		public static api_type_has_tag(api: GObject.Type, tag: GLib.Quark): boolean;
		/**
		 * Register and return a GType for the #api and associate it with
		 * #tags.
		 * @param api an API to register
		 * @param tags tags for #api
		 * @returns a unique GType for #api.
		 */
		public static api_type_register(api: string, tags: string[]): GObject.Type;
		/**
		 * Lookup a previously registered meta info structure by its implementation name
		 * #impl.
		 * @param impl the name
		 * @returns a {@link MetaInfo} with #impl, or
		 * %NULL when no such metainfo exists.
		 */
		public static get_info(impl: string): MetaInfo | null;
		/**
		 * Register a new {@link Meta} implementation.
		 * 
		 * The same #info can be retrieved later with {@link Gst.meta.get_info} by using
		 * #impl as the key.
		 * @param api the type of the {@link Meta} API
		 * @param impl the name of the {@link Meta} implementation
		 * @param size the size of the {@link Meta} structure
		 * @param init_func a {@link MetaInitFunction}
		 * @param free_func a {@link MetaFreeFunction}
		 * @param transform_func a {@link MetaTransformFunction}
		 * @returns a {@link MetaInfo} that can be used to
		 * access metadata.
		 */
		public static register(api: GObject.Type, impl: string, size: number, init_func: MetaInitFunction, free_func: MetaFreeFunction, transform_func: MetaTransformFunction): MetaInfo | null;
		/**
		 * extra flags for the metadata
		 */
		public flags: MetaFlags;
		/**
		 * pointer to the {@link MetaInfo}
		 */
		public info: MetaInfo;
		/**
		 * Meta sequence number compare function. Can be used as #GCompareFunc
		 * or a #GCompareDataFunc.
		 * @param meta2 a {@link Meta}
		 * @returns a negative number if #meta1 comes before #meta2, 0 if both metas
		 *   have an equal sequence number, or a positive integer if #meta1 comes
		 *   after #meta2.
		 */
		public compare_seqnum(meta2: Meta): number;
		/**
		 * Gets seqnum for this meta.
		 * @returns 
		 */
		public get_seqnum(): number;
	}

	export interface MetaInfoInitOptions {}
	/**
	 * The {@link MetaInfo} provides information about a specific metadata
	 * structure.
	 */
	interface MetaInfo {}
	class MetaInfo {
		public constructor(options?: Partial<MetaInfoInitOptions>);
		/**
		 * tag identifying the metadata structure and api
		 */
		public api: GObject.Type;
		/**
		 * type identifying the implementor of the api
		 */
		public type: GObject.Type;
		/**
		 * size of the metadata
		 */
		public size: number;
		/**
		 * function for initializing the metadata
		 */
		public init_func: MetaInitFunction;
		/**
		 * function for freeing the metadata
		 */
		public free_func: MetaFreeFunction;
		/**
		 * function for transforming the metadata
		 */
		public transform_func: MetaTransformFunction;
	}

	export interface MetaTransformCopyInitOptions {}
	/**
	 * Extra data passed to a "gst-copy" transform {@link MetaTransformFunction}.
	 */
	interface MetaTransformCopy {}
	class MetaTransformCopy {
		public constructor(options?: Partial<MetaTransformCopyInitOptions>);
		/**
		 * %TRUE if only region is copied
		 */
		public region: boolean;
		/**
		 * the offset to copy, 0 if #region is %FALSE, otherwise > 0
		 */
		public offset: number;
		/**
		 * the size to copy, -1 or the buffer size when #region is %FALSE
		 */
		public size: number;
	}

	export interface MiniObjectInitOptions {}
	/**
	 * {@link MiniObject} is a simple structure that can be used to implement refcounted
	 * types.
	 * 
	 * Subclasses will include #GstMiniObject as the first member in their structure
	 * and then call {@link Gst.MiniObject.init} to initialize the #GstMiniObject fields.
	 * 
	 * gst_mini_object_ref() and gst_mini_object_unref() increment and decrement the
	 * refcount respectively. When the refcount of a mini-object reaches 0, the
	 * dispose function is called first and when this returns %TRUE, the free
	 * function of the miniobject is called.
	 * 
	 * A copy can be made with gst_mini_object_copy().
	 * 
	 * gst_mini_object_is_writable() will return %TRUE when the refcount of the
	 * object is exactly 1 and there is no parent or a single parent exists and is
	 * writable itself, meaning the current caller has the only reference to the
	 * object. gst_mini_object_make_writable() will return a writable version of
	 * the object, which might be a new copy when the refcount was not 1.
	 * 
	 * Opaque data can be associated with a #GstMiniObject with
	 * gst_mini_object_set_qdata() and gst_mini_object_get_qdata(). The data is
	 * meant to be specific to the particular object and is not automatically copied
	 * with gst_mini_object_copy() or similar methods.
	 * 
	 * A weak reference can be added and remove with gst_mini_object_weak_ref()
	 * and gst_mini_object_weak_unref() respectively.
	 */
	interface MiniObject {}
	class MiniObject {
		public constructor(options?: Partial<MiniObjectInitOptions>);
		/**
		 * Atomically modifies a pointer to point to a new mini-object.
		 * The reference count of #olddata is decreased and the reference count of
		 * #newdata is increased.
		 * 
		 * Either #newdata and the value pointed to by #olddata may be %NULL.
		 * @param newdata pointer to new mini-object
		 * @returns %TRUE if #newdata was different from #olddata
		 */
		public static replace(newdata?: MiniObject | null): boolean;
		/**
		 * Replace the current {@link MiniObject} pointer to by #olddata with %NULL and
		 * return the old value.
		 * @returns the {@link MiniObject} at #oldata
		 */
		public static steal(): MiniObject | null;
		/**
		 * Modifies a pointer to point to a new mini-object. The modification
		 * is done atomically. This version is similar to {@link Gst.mini.object_replace}
		 * except that it does not increase the refcount of #newdata and thus
		 * takes ownership of #newdata.
		 * 
		 * Either #newdata and the value pointed to by #olddata may be %NULL.
		 * @param newdata pointer to new mini-object
		 * @returns %TRUE if #newdata was different from #olddata
		 */
		public static take(newdata: MiniObject): boolean;
		/**
		 * the GType of the object
		 */
		public type: GObject.Type;
		/**
		 * atomic refcount
		 */
		public refcount: number;
		/**
		 * atomic state of the locks
		 */
		public lockstate: number;
		/**
		 * extra flags.
		 */
		public flags: number;
		/**
		 * a copy function
		 */
		// public copy: MiniObjectCopyFunction;
		/**
		 * a dispose function
		 */
		public dispose: MiniObjectDisposeFunction;
		/**
		 * the free function
		 */
		public free: MiniObjectFreeFunction;
		public readonly priv_uint: number;
		public readonly priv_pointer: any;
		/**
		 * This adds #parent as a parent for #object. Having one ore more parents affects the
		 * writability of #object: if a #parent is not writable, #object is also not
		 * writable, regardless of its refcount. #object is only writable if all
		 * the parents are writable and its own refcount is exactly 1.
		 * 
		 * Note: This function does not take ownership of #parent and also does not
		 * take an additional reference. It is the responsibility of the caller to
		 * remove the parent again at a later time.
		 * @param parent a parent {@link MiniObject}
		 */
		public add_parent(parent: MiniObject): void;
		/**
		 * Creates a copy of the mini-object.
		 * 
		 * MT safe
		 * @returns the new mini-object if copying is
		 * possible, %NULL otherwise.
		 */
		public copy(): MiniObject | null;
		/**
		 * This function gets back user data pointers stored via
		 * {@link Gst.MiniObject.set_qdata}.
		 * @param quark A #GQuark, naming the user data pointer
		 * @returns The user data pointer set, or
		 * %NULL
		 */
		public get_qdata(quark: GLib.Quark): any | null;
		/**
		 * Initializes a mini-object with the desired type and copy/dispose/free
		 * functions.
		 * @param flags initial {@link MiniObjectFlags}
		 * @param type the #GType of the mini-object to create
		 * @param copy_func the copy function, or %NULL
		 * @param dispose_func the dispose function, or %NULL
		 * @param free_func the free function or %NULL
		 */
		public init(flags: number, type: GObject.Type, copy_func?: MiniObjectCopyFunction | null, dispose_func?: MiniObjectDisposeFunction | null, free_func?: MiniObjectFreeFunction | null): void;
		/**
		 * If #mini_object has the LOCKABLE flag set, check if the current EXCLUSIVE
		 * lock on #object is the only one, this means that changes to the object will
		 * not be visible to any other object.
		 * 
		 * If the LOCKABLE flag is not set, check if the refcount of #mini_object is
		 * exactly 1, meaning that no other reference exists to the object and that the
		 * object is therefore writable.
		 * 
		 * Modification of a mini-object should only be done after verifying that it
		 * is writable.
		 * @returns %TRUE if the object is writable.
		 */
		public is_writable(): boolean;
		/**
		 * Lock the mini-object with the specified access mode in #flags.
		 * @param flags {@link LockFlags}
		 * @returns %TRUE if #object could be locked.
		 */
		public lock(flags: LockFlags): boolean;
		/**
		 * Checks if a mini-object is writable.  If not, a writable copy is made and
		 * returned.  This gives away the reference to the original mini object,
		 * and returns a reference to the new object.
		 * 
		 * MT safe
		 * @returns a mini-object (possibly the same pointer) that
		 *     is writable.
		 */
		public make_writable(): MiniObject;
		/**
		 * Increase the reference count of the mini-object.
		 * 
		 * Note that the refcount affects the writability
		 * of #mini-object, see {@link Gst.MiniObject.is_writable}. It is
		 * important to note that keeping additional references to
		 * GstMiniObject instances can potentially increase the number
		 * of memcpy operations in a pipeline, especially if the miniobject
		 * is a {@link Buffer}.
		 * @returns the mini-object.
		 */
		public ref(): MiniObject;
		/**
		 * This removes #parent as a parent for #object. See
		 * {@link Gst.MiniObject.add_parent}.
		 * @param parent a parent {@link MiniObject}
		 */
		public remove_parent(parent: MiniObject): void;
		/**
		 * This sets an opaque, named pointer on a miniobject.
		 * The name is specified through a #GQuark (retrieved e.g. via
		 * {@link G.quark_from_static_string}), and the pointer
		 * can be gotten back from the #object with gst_mini_object_get_qdata()
		 * until the #object is disposed.
		 * Setting a previously set user data pointer, overrides (frees)
		 * the old pointer set, using %NULL as pointer essentially
		 * removes the data stored.
		 * 
		 * #destroy may be specified which is called with #data as argument
		 * when the #object is disposed, or the data is being overwritten by
		 * a call to gst_mini_object_set_qdata() with the same #quark.
		 * @param quark A #GQuark, naming the user data pointer
		 * @param data An opaque user data pointer
		 */
		public set_qdata(quark: GLib.Quark, data?: any | null): void;
		/**
		 * This function gets back user data pointers stored via {@link Gst.MiniObject.set_qdata}
		 * and removes the data from #object without invoking its `destroy()` function (if
		 * any was set).
		 * @param quark A #GQuark, naming the user data pointer
		 * @returns The user data pointer set, or
		 * %NULL
		 */
		public steal_qdata(quark: GLib.Quark): any | null;
		/**
		 * Unlock the mini-object with the specified access mode in #flags.
		 * @param flags {@link LockFlags}
		 */
		public unlock(flags: LockFlags): void;
		/**
		 * Decreases the reference count of the mini-object, possibly freeing
		 * the mini-object.
		 */
		public unref(): void;
		/**
		 * Adds a weak reference callback to a mini object. Weak references are
		 * used for notification when a mini object is finalized. They are called
		 * "weak references" because they allow you to safely hold a pointer
		 * to the mini object without calling {@link Gst.MiniObject.ref}
		 * (gst_mini_object_ref() adds a strong reference, that is, forces the object
		 * to stay alive).
		 * @param notify callback to invoke before the mini object is freed
		 */
		public weak_ref(notify: MiniObjectNotify): void;
		/**
		 * Removes a weak reference callback from a mini object.
		 * @param notify callback to search for
		 */
		public weak_unref(notify: MiniObjectNotify): void;
	}

	export interface PadProbeInfoInitOptions {}
	/**
	 * Info passed in the {@link PadProbeCallback}.
	 */
	interface PadProbeInfo {}
	class PadProbeInfo {
		public constructor(options?: Partial<PadProbeInfoInitOptions>);
		/**
		 * the current probe type
		 */
		public type: PadProbeType;
		/**
		 * the id of the probe
		 */
		public id: number;
		/**
		 * type specific data, check the #type field to know the
		 *    datatype.  This field can be %NULL.
		 */
		public data: any;
		/**
		 * offset of pull probe, this field is valid when #type contains
		 *    #GST_PAD_PROBE_TYPE_PULL
		 */
		public offset: number;
		/**
		 * size of pull probe, this field is valid when #type contains
		 *    #GST_PAD_PROBE_TYPE_PULL
		 */
		public size: number;
		public get_buffer(): Buffer | null;
		public get_buffer_list(): BufferList | null;
		public get_event(): Event | null;
		public get_query(): Query | null;
	}

	export interface ParamSpecArrayInitOptions {}
	/**
	 * A GParamSpec derived structure for arrays of values.
	 */
	interface ParamSpecArray {}
	class ParamSpecArray {
		public constructor(options?: Partial<ParamSpecArrayInitOptions>);
		/**
		 * the #GParamSpec of the type of values in the array
		 */
		public element_spec: GObject.ParamSpec;
	}

	export interface ParamSpecFractionInitOptions {}
	/**
	 * A GParamSpec derived structure that contains the meta data for fractional
	 * properties.
	 */
	interface ParamSpecFraction {}
	class ParamSpecFraction {
		public constructor(options?: Partial<ParamSpecFractionInitOptions>);
		/**
		 * minimal numerator
		 */
		public min_num: number;
		/**
		 * minimal denominator
		 */
		public min_den: number;
		/**
		 * maximal numerator
		 */
		public max_num: number;
		/**
		 * maximal denominator
		 */
		public max_den: number;
		/**
		 * default numerator
		 */
		public def_num: number;
		/**
		 * default denominator
		 */
		public def_den: number;
	}

	export interface ParentBufferMetaInitOptions {}
	/**
	 * The {@link ParentBufferMeta} is a #GstMeta which can be attached to a #GstBuffer
	 * to hold a reference to another buffer that is only released when the child
	 * #GstBuffer is released.
	 * 
	 * Typically, #GstParentBufferMeta is used when the child buffer is directly
	 * using the #GstMemory of the parent buffer, and wants to prevent the parent
	 * buffer from being returned to a buffer pool until the #GstMemory is available
	 * for re-use.
	 */
	interface ParentBufferMeta {}
	class ParentBufferMeta {
		public constructor(options?: Partial<ParentBufferMetaInitOptions>);
		/**
		 * Get the global {@link MetaInfo} describing  the #GstParentBufferMeta meta.
		 * @returns The {@link MetaInfo}
		 */
		public static get_info(): MetaInfo;
		/**
		 * the {@link Buffer} on which a reference is being held.
		 */
		public buffer: Buffer;
	}

	export interface ParseContextInitOptions {}
	/**
	 * Opaque structure.
	 */
	interface ParseContext {}
	class ParseContext {
		public constructor(options?: Partial<ParseContextInitOptions>);
		/**
		 * Allocates a parse context for use with {@link Gst.parse.launch_full} or
		 * gst_parse_launchv_full().
		 * 
		 * Free-function: gst_parse_context_free
		 * @returns a newly-allocated parse context. Free
		 *     with {@link Gst.ParseContext.free} when no longer needed.
		 */
		public static new(): ParseContext | null;
		/**
		 * Copies the #context.
		 * @returns A copied {@link ParseContext}
		 */
		public copy(): ParseContext | null;
		/**
		 * Frees a parse context previously allocated with {@link Gst.ParseContext.new}.
		 */
		public free(): void;
		/**
		 * Retrieve missing elements from a previous run of {@link Gst.parse.launch_full}
		 * or gst_parse_launchv_full(). Will only return results if an error code
		 * of %GST_PARSE_ERROR_NO_SUCH_ELEMENT was returned.
		 * @returns a
		 *     %NULL-terminated array of element factory name strings of missing
		 *     elements. Free with {@link G.strfreev} when no longer needed.
		 */
		public get_missing_elements(): string[] | null;
	}

	export interface PluginDescInitOptions {}
	/**
	 * A plugin should export a variable of this type called plugin_desc. The plugin
	 * loader will use the data provided there to initialize the plugin.
	 * 
	 * The #licence parameter must be one of: LGPL, GPL, QPL, GPL/QPL, MPL,
	 * BSD, MIT/X11, Proprietary, unknown.
	 */
	interface PluginDesc {}
	class PluginDesc {
		public constructor(options?: Partial<PluginDescInitOptions>);
		/**
		 * the major version number of core that plugin was compiled for
		 */
		public major_version: number;
		/**
		 * the minor version number of core that plugin was compiled for
		 */
		public minor_version: number;
		/**
		 * a unique name of the plugin
		 */
		public name: string;
		/**
		 * description of plugin
		 */
		public description: string;
		/**
		 * pointer to the init function of this plugin.
		 */
		public plugin_init: PluginInitFunc;
		/**
		 * version of the plugin
		 */
		public version: string;
		/**
		 * effective license of plugin
		 */
		public license: string;
		/**
		 * source module plugin belongs to
		 */
		public source: string;
		/**
		 * shipped package plugin belongs to
		 */
		public package: string;
		/**
		 * URL to provider of plugin
		 */
		public origin: string;
		/**
		 * date time string in ISO 8601
		 *     format (or rather, a subset thereof), or %NULL. Allowed are the
		 *     following formats: "YYYY-MM-DD" and "YYY-MM-DDTHH:MMZ" (with
		 *     'T' a separator and 'Z' indicating UTC/Zulu time). This field
		 *     should be set via the GST_PACKAGE_RELEASE_DATETIME
		 *     preprocessor macro.
		 */
		public release_datetime: string;
		public readonly _gst_reserved: any[];
	}

	export interface PollInitOptions {}
	/**
	 * A {@link Poll} keeps track of file descriptors much like fd_set (used with
	 * select ()) or a struct pollfd array (used with poll ()). Once created with
	 * {@link Gst.poll.new}, the set can be used to wait for file descriptors to be
	 * readable and/or writable. It is possible to make this wait be controlled
	 * by specifying %TRUE for the #controllable flag when creating the set (or
	 * later calling gst_poll_set_controllable()).
	 * 
	 * New file descriptors are added to the set using gst_poll_add_fd(), and
	 * removed using gst_poll_remove_fd(). Controlling which file descriptors
	 * should be waited for to become readable and/or writable are done using
	 * gst_poll_fd_ctl_read(), gst_poll_fd_ctl_write() and gst_poll_fd_ctl_pri().
	 * 
	 * Use gst_poll_wait() to wait for the file descriptors to actually become
	 * readable and/or writable, or to timeout if no file descriptor is available
	 * in time. The wait can be controlled by calling gst_poll_restart() and
	 * gst_poll_set_flushing().
	 * 
	 * Once the file descriptor set has been waited for, one can use
	 * gst_poll_fd_has_closed() to see if the file descriptor has been closed,
	 * gst_poll_fd_has_error() to see if it has generated an error,
	 * gst_poll_fd_can_read() to see if it is possible to read from the file
	 * descriptor, and gst_poll_fd_can_write() to see if it is possible to
	 * write to it.
	 */
	interface Poll {}
	class Poll {
		public constructor(options?: Partial<PollInitOptions>);
		/**
		 * Create a new file descriptor set. If #controllable, it
		 * is possible to restart or flush a call to {@link Gst.Poll.wait} with
		 * gst_poll_restart() and gst_poll_set_flushing() respectively.
		 * 
		 * Free-function: gst_poll_free
		 * @param controllable whether it should be possible to control a wait.
		 * @returns a new {@link Poll}, or %NULL in
		 *     case of an error.  Free with {@link Gst.Poll.free}.
		 */
		public static new(controllable: boolean): Poll | null;
		/**
		 * Create a new poll object that can be used for scheduling cancellable
		 * timeouts.
		 * 
		 * A timeout is performed with {@link Gst.Poll.wait}. Multiple timeouts can be
		 * performed from different threads.
		 * 
		 * Free-function: gst_poll_free
		 * @returns a new {@link Poll}, or %NULL in
		 *     case of an error.  Free with {@link Gst.Poll.free}.
		 */
		public static new_timer(): Poll | null;
		/**
		 * Add a file descriptor to the file descriptor set.
		 * @param fd a file descriptor.
		 * @returns %TRUE if the file descriptor was successfully added to the set.
		 */
		public add_fd(fd: PollFD): boolean;
		/**
		 * Check if #fd in #set has data to be read.
		 * @param fd a file descriptor.
		 * @returns %TRUE if the descriptor has data to be read.
		 */
		public fd_can_read(fd: PollFD): boolean;
		/**
		 * Check if #fd in #set can be used for writing.
		 * @param fd a file descriptor.
		 * @returns %TRUE if the descriptor can be used for writing.
		 */
		public fd_can_write(fd: PollFD): boolean;
		/**
		 * Control whether the descriptor #fd in #set will be monitored for
		 * exceptional conditions (POLLPRI).
		 * 
		 * Not implemented on Windows (will just return %FALSE there).
		 * @param fd a file descriptor.
		 * @param active a new status.
		 * @returns %TRUE if the descriptor was successfully updated.
		 */
		public fd_ctl_pri(fd: PollFD, active: boolean): boolean;
		/**
		 * Control whether the descriptor #fd in #set will be monitored for
		 * readability.
		 * @param fd a file descriptor.
		 * @param active a new status.
		 * @returns %TRUE if the descriptor was successfully updated.
		 */
		public fd_ctl_read(fd: PollFD, active: boolean): boolean;
		/**
		 * Control whether the descriptor #fd in #set will be monitored for
		 * writability.
		 * @param fd a file descriptor.
		 * @param active a new status.
		 * @returns %TRUE if the descriptor was successfully updated.
		 */
		public fd_ctl_write(fd: PollFD, active: boolean): boolean;
		/**
		 * Check if #fd in #set has closed the connection.
		 * @param fd a file descriptor.
		 * @returns %TRUE if the connection was closed.
		 */
		public fd_has_closed(fd: PollFD): boolean;
		/**
		 * Check if #fd in #set has an error.
		 * @param fd a file descriptor.
		 * @returns %TRUE if the descriptor has an error.
		 */
		public fd_has_error(fd: PollFD): boolean;
		/**
		 * Check if #fd in #set has an exceptional condition (POLLPRI).
		 * 
		 * Not implemented on Windows (will just return %FALSE there).
		 * @param fd a file descriptor.
		 * @returns %TRUE if the descriptor has an exceptional condition.
		 */
		public fd_has_pri(fd: PollFD): boolean;
		/**
		 * Mark #fd as ignored so that the next call to {@link Gst.Poll.wait} will yield
		 * the same result for #fd as last time. This function must be called if no
		 * operation (read/write/recv/send/etc.) will be performed on #fd before
		 * the next call to gst_poll_wait().
		 * 
		 * The reason why this is needed is because the underlying implementation
		 * might not allow querying the fd more than once between calls to one of
		 * the re-enabling operations.
		 * @param fd a file descriptor.
		 */
		public fd_ignored(fd: PollFD): void;
		/**
		 * Free a file descriptor set.
		 */
		public free(): void;
		/**
		 * Get a GPollFD for the reading part of the control socket. This is useful when
		 * integrating with a GSource and GMainLoop.
		 * @param fd a #GPollFD
		 */
		public get_read_gpollfd(fd: GLib.PollFD): void;
		/**
		 * Read a byte from the control socket of the controllable #set.
		 * 
		 * This function only works for timer {@link Poll} objects created with
		 * {@link Gst.poll.new_timer}.
		 * @returns %TRUE on success. %FALSE when when there was no byte to read or
		 * reading the byte failed. If there was no byte to read, and only then, errno
		 * will contain EWOULDBLOCK or EAGAIN. For all other values of errno this always signals a
		 * critical error.
		 */
		public read_control(): boolean;
		/**
		 * Remove a file descriptor from the file descriptor set.
		 * @param fd a file descriptor.
		 * @returns %TRUE if the file descriptor was successfully removed from the set.
		 */
		public remove_fd(fd: PollFD): boolean;
		/**
		 * Restart any {@link Gst.Poll.wait} that is in progress. This function is typically
		 * used after adding or removing descriptors to #set.
		 * 
		 * If #set is not controllable, then this call will have no effect.
		 * 
		 * This function only works for non-timer {@link Poll} objects created with
		 * gst_poll_new().
		 */
		public restart(): void;
		/**
		 * When #controllable is %TRUE, this function ensures that future calls to
		 * {@link Gst.Poll.wait} will be affected by gst_poll_restart() and
		 * gst_poll_set_flushing().
		 * 
		 * This function only works for non-timer {@link Poll} objects created with
		 * gst_poll_new().
		 * @param controllable new controllable state.
		 * @returns %TRUE if the controllability of #set could be updated.
		 */
		public set_controllable(controllable: boolean): boolean;
		/**
		 * When #flushing is %TRUE, this function ensures that current and future calls
		 * to {@link Gst.Poll.wait} will return -1, with errno set to EBUSY.
		 * 
		 * Unsetting the flushing state will restore normal operation of #set.
		 * 
		 * This function only works for non-timer {@link Poll} objects created with
		 * gst_poll_new().
		 * @param flushing new flushing state.
		 */
		public set_flushing(flushing: boolean): void;
		/**
		 * Wait for activity on the file descriptors in #set. This function waits up to
		 * the specified #timeout.  A timeout of #GST_CLOCK_TIME_NONE waits forever.
		 * 
		 * For {@link Poll} objects created with {@link Gst.poll.new}, this function can only be
		 * called from a single thread at a time.  If called from multiple threads,
		 * -1 will be returned with errno set to EPERM.
		 * 
		 * This is not true for timer #GstPoll objects created with
		 * gst_poll_new_timer(), where it is allowed to have multiple threads waiting
		 * simultaneously.
		 * @param timeout a timeout in nanoseconds.
		 * @returns The number of {@link PollFD} in #set that have activity or 0 when no
		 * activity was detected after #timeout. If an error occurs, -1 is returned
		 * and errno is set.
		 */
		public wait(timeout: ClockTime): number;
		/**
		 * Write a byte to the control socket of the controllable #set.
		 * This function is mostly useful for timer {@link Poll} objects created with
		 * {@link Gst.poll.new_timer}.
		 * 
		 * It will make any current and future gst_poll_wait() function return with
		 * 1, meaning the control socket is set. After an equal amount of calls to
		 * gst_poll_read_control() have been performed, calls to gst_poll_wait() will
		 * block again until their timeout expired.
		 * 
		 * This function only works for timer #GstPoll objects created with
		 * gst_poll_new_timer().
		 * @returns %TRUE on success. %FALSE when when the byte could not be written.
		 * errno contains the detailed error code but will never be EAGAIN, EINTR or
		 * EWOULDBLOCK. %FALSE always signals a critical error.
		 */
		public write_control(): boolean;
	}

	export interface PollFDInitOptions {}
	/**
	 * A file descriptor object.
	 */
	interface PollFD {}
	class PollFD {
		public constructor(options?: Partial<PollFDInitOptions>);
		/**
		 * a file descriptor
		 */
		public fd: number;
		public readonly idx: number;
		/**
		 * Initializes #fd. Alternatively you can initialize it with
		 * #GST_POLL_FD_INIT.
		 */
		public init(): void;
	}

	export interface PresetInterfaceInitOptions {}
	/**
	 * {@link Preset} interface.
	 */
	interface PresetInterface {}
	class PresetInterface {
		public constructor(options?: Partial<PresetInterfaceInitOptions>);
		public readonly _gst_reserved: any[];
		public get_preset_names: {(preset: Preset): string[];};
		public get_property_names: {(preset: Preset): string[];};
		public load_preset: {(preset: Preset, name: string): boolean;};
		public save_preset: {(preset: Preset, name: string): boolean;};
		public rename_preset: {(preset: Preset, old_name: string, new_name: string): boolean;};
		public delete_preset: {(preset: Preset, name: string): boolean;};
		public set_meta: {(preset: Preset, name: string, tag: string, value?: string | null): boolean;};
		public get_meta: {(preset: Preset, name: string, tag: string): [ boolean, string ];};
	}

	export interface PromiseInitOptions {}
	/**
	 * The {@link Promise} object implements the container for values that may
	 * be available later. i.e. a Future or a Promise in
	 * <https://en.wikipedia.org/wiki/Futures_and_promises>.
	 * As with all Future/Promise-like functionality, there is the concept of the
	 * producer of the value and the consumer of the value.
	 * 
	 * A #GstPromise is created with {@link Gst.Promise.new} by the consumer and passed
	 * to the producer to avoid thread safety issues with the change callback.
	 * A #GstPromise can be replied to with a value (or an error) by the producer
	 * with gst_promise_reply(). The exact value returned is defined by the API
	 * contract of the producer and %NULL may be a valid reply.
	 * gst_promise_interrupt() is for the consumer to
	 * indicate to the producer that the value is not needed anymore and producing
	 * that value can stop.  The #GST_PROMISE_RESULT_EXPIRED state set by a call
	 * to gst_promise_expire() indicates to the consumer that a value will never
	 * be produced and is intended to be called by a third party that implements
	 * some notion of message handling such as #GstBus.
	 * A callback can also be installed at #GstPromise creation for
	 * result changes with gst_promise_new_with_change_func().
	 * The change callback can be used to chain #GstPromises's together as in the
	 * following example.
	 * |[<!-- language="C" -->
	 * const GstStructure *reply;
	 * GstPromise *p;
	 * if (gst_promise_wait (promise) != GST_PROMISE_RESULT_REPLIED)
	 *   return; // interrupted or expired value
	 * reply = gst_promise_get_reply (promise);
	 * if (error in reply)
	 *   return; // propagate error
	 * p = gst_promise_new_with_change_func (another_promise_change_func, user_data, notify);
	 * pass p to promise-using API
	 * ]|
	 * 
	 * Each #GstPromise starts out with a #GstPromiseResult of
	 * %GST_PROMISE_RESULT_PENDING and only ever transitions once
	 * into one of the other #GstPromiseResult's.
	 * 
	 * In order to support multi-threaded code, gst_promise_reply(),
	 * gst_promise_interrupt() and gst_promise_expire() may all be from
	 * different threads with some restrictions and the final result of the promise
	 * is whichever call is made first.  There are two restrictions on ordering:
	 * 
	 * 1. That gst_promise_reply() and gst_promise_interrupt() cannot be called
	 * after gst_promise_expire()
	 * 2. That gst_promise_reply() and gst_promise_interrupt()
	 * cannot be called twice.
	 * 
	 * The change function set with gst_promise_new_with_change_func() is
	 * called directly from either the gst_promise_reply(),
	 * gst_promise_interrupt() or gst_promise_expire() and can be called
	 * from an arbitrary thread.  #GstPromise using APIs can restrict this to
	 * a single thread or a subset of threads but that is entirely up to the API
	 * that uses #GstPromise.
	 */
	interface Promise {}
	class Promise {
		public constructor(options?: Partial<PromiseInitOptions>);
		public static new(): Promise;
		/**
		 * #func will be called exactly once when transitioning out of
		 * %GST_PROMISE_RESULT_PENDING into any of the other {@link PromiseResult}
		 * states.
		 * @param func a {@link PromiseChangeFunc} to call
		 * @returns a new {@link Promise}
		 */
		public static new_with_change_func(func: PromiseChangeFunc): Promise;
		/**
		 * Expire a #promise.  This will wake up any waiters with
		 * %GST_PROMISE_RESULT_EXPIRED.  Called by a message loop when the parent
		 * message is handled and/or destroyed (possibly unanswered).
		 */
		public expire(): void;
		/**
		 * Retrieve the reply set on #promise.  #promise must be in
		 * %GST_PROMISE_RESULT_REPLIED and the returned structure is owned by #promise
		 * @returns The reply set on #promise
		 */
		public get_reply(): Structure | null;
		/**
		 * Interrupt waiting for a #promise.  This will wake up any waiters with
		 * %GST_PROMISE_RESULT_INTERRUPTED.  Called when the consumer does not want
		 * the value produced anymore.
		 */
		public interrupt(): void;
		/**
		 * Set a reply on #promise.  This will wake up any waiters with
		 * %GST_PROMISE_RESULT_REPLIED.  Called by the producer of the value to
		 * indicate success (or failure).
		 * 
		 * If #promise has already been interrupted by the consumer, then this reply
		 * is not visible to the consumer.
		 * @param s a {@link Structure} with the the reply contents
		 */
		public reply(s?: Structure | null): void;
		/**
		 * Wait for #promise to move out of the %GST_PROMISE_RESULT_PENDING state.
		 * If #promise is not in %GST_PROMISE_RESULT_PENDING then it will return
		 * immediately with the current result.
		 * @returns the result of the promise
		 */
		public wait(): PromiseResult;
	}

	export interface ProtectionMetaInitOptions {}
	/**
	 * Metadata type that holds information about a sample from a protection-protected
	 * track, including the information needed to decrypt it (if it is encrypted).
	 */
	interface ProtectionMeta {}
	class ProtectionMeta {
		public constructor(options?: Partial<ProtectionMetaInitOptions>);
		public static get_info(): MetaInfo;
		/**
		 * the parent {@link Meta}.
		 */
		public meta: Meta;
		/**
		 * the cryptographic information needed to decrypt the sample.
		 */
		public info: Structure;
	}

	export interface QueryInitOptions {}
	/**
	 * Queries can be performed on pads {@link (gst.pad_query}) and elements
	 * (gst_element_query()). Please note that some queries might need a running
	 * pipeline to work.
	 * 
	 * Queries can be created using the gst_query_new_*() functions.
	 * Query values can be set using gst_query_set_*(), and parsed using
	 * gst_query_parse_*() helpers.
	 * 
	 * The following example shows how to query the duration of a pipeline:
	 * |[<!-- language="C" -->
	 *   GstQuery *query;
	 *   gboolean res;
	 *   query = gst_query_new_duration (GST_FORMAT_TIME);
	 *   res = gst_element_query (pipeline, query);
	 *   if (res) {
	 *     gint64 duration;
	 *     gst_query_parse_duration (query, NULL, &amp;duration);
	 *     g_print ("duration = %"GST_TIME_FORMAT, GST_TIME_ARGS (duration));
	 *   } else {
	 *     g_print ("duration query failed...");
	 *   }
	 *   gst_query_unref (query);
	 * ]|
	 */
	interface Query {}
	class Query {
		public constructor(options?: Partial<QueryInitOptions>);
		/**
		 * Constructs a new query object for querying if #caps are accepted.
		 * 
		 * Free-function: {@link Gst.Query.unref}
		 * @param caps a fixed {@link Caps}
		 * @returns a new {@link Query}
		 */
		public static new_accept_caps(caps: Caps): Query;
		/**
		 * Constructs a new query object for querying the allocation properties.
		 * 
		 * Free-function: {@link Gst.Query.unref}
		 * @param caps the negotiated caps
		 * @param need_pool return a pool
		 * @returns a new {@link Query}
		 */
		public static new_allocation(caps: Caps, need_pool: boolean): Query;
		/**
		 * Constructs a new query object for querying the bitrate.
		 * 
		 * Free-function: {@link Gst.Query.unref}
		 * @returns a new {@link Query}
		 */
		public static new_bitrate(): Query;
		/**
		 * Constructs a new query object for querying the buffering status of
		 * a stream.
		 * 
		 * Free-function: {@link Gst.Query.unref}
		 * @param format the default {@link Format} for the new query
		 * @returns a new {@link Query}
		 */
		public static new_buffering(format: Format): Query;
		/**
		 * Constructs a new query object for querying the caps.
		 * 
		 * The CAPS query should return the allowable caps for a pad in the context
		 * of the element's state, its link to other elements, and the devices or files
		 * it has opened. These caps must be a subset of the pad template caps. In the
		 * NULL state with no links, the CAPS query should ideally return the same caps
		 * as the pad template. In rare circumstances, an object property can affect
		 * the caps returned by the CAPS query, but this is discouraged.
		 * 
		 * For most filters, the caps returned by CAPS query is directly affected by the
		 * allowed caps on other pads. For demuxers and decoders, the caps returned by
		 * the srcpad's getcaps function is directly related to the stream data. Again,
		 * the CAPS query should return the most specific caps it reasonably can, since this
		 * helps with autoplugging.
		 * 
		 * The #filter is used to restrict the result caps, only the caps matching
		 * #filter should be returned from the CAPS query. Specifying a filter might
		 * greatly reduce the amount of processing an element needs to do.
		 * 
		 * Free-function: {@link Gst.Query.unref}
		 * @param filter a filter
		 * @returns a new {@link Query}
		 */
		public static new_caps(filter: Caps): Query;
		/**
		 * Constructs a new query object for querying the pipeline-local context.
		 * 
		 * Free-function: {@link Gst.Query.unref}
		 * @param context_type Context type to query
		 * @returns a new {@link Query}
		 */
		public static new_context(context_type: string): Query;
		/**
		 * Constructs a new convert query object. Use {@link Gst.Query.unref}
		 * when done with it. A convert query is used to ask for a conversion between
		 * one format and another.
		 * 
		 * Free-function: gst_query_unref()
		 * @param src_format the source {@link Format} for the new query
		 * @param value the value to convert
		 * @param dest_format the target {@link Format}
		 * @returns a {@link Query}
		 */
		public static new_convert(src_format: Format, value: number, dest_format: Format): Query;
		/**
		 * Constructs a new custom query object. Use {@link Gst.Query.unref}
		 * when done with it.
		 * 
		 * Free-function: gst_query_unref()
		 * @param type the query type
		 * @param structure a structure for the query
		 * @returns a new {@link Query}
		 */
		public static new_custom(type: QueryType, structure?: Structure | null): Query | null;
		/**
		 * Constructs a new query object for querying the drain state.
		 * 
		 * Free-function: {@link Gst.Query.unref}
		 * @returns a new {@link Query}
		 */
		public static new_drain(): Query;
		/**
		 * Constructs a new stream duration query object to query in the given format.
		 * Use {@link Gst.Query.unref} when done with it. A duration query will give the
		 * total length of the stream.
		 * 
		 * Free-function: gst_query_unref()
		 * @param format the {@link Format} for this duration query
		 * @returns a new {@link Query}
		 */
		public static new_duration(format: Format): Query;
		/**
		 * Constructs a new query object for querying formats of
		 * the stream.
		 * 
		 * Free-function: {@link Gst.Query.unref}
		 * @returns a new {@link Query}
		 */
		public static new_formats(): Query;
		/**
		 * Constructs a new latency query object.
		 * Use {@link Gst.Query.unref} when done with it. A latency query is usually performed
		 * by sinks to compensate for additional latency introduced by elements in the
		 * pipeline.
		 * 
		 * Free-function: gst_query_unref()
		 * @returns a {@link Query}
		 */
		public static new_latency(): Query;
		/**
		 * Constructs a new query stream position query object. Use {@link Gst.Query.unref}
		 * when done with it. A position query is used to query the current position
		 * of playback in the streams, in some format.
		 * 
		 * Free-function: gst_query_unref()
		 * @param format the default {@link Format} for the new query
		 * @returns a new {@link Query}
		 */
		public static new_position(format: Format): Query;
		/**
		 * Constructs a new query object for querying the scheduling properties.
		 * 
		 * Free-function: {@link Gst.Query.unref}
		 * @returns a new {@link Query}
		 */
		public static new_scheduling(): Query;
		/**
		 * Constructs a new query object for querying seeking properties of
		 * the stream.
		 * 
		 * Free-function: {@link Gst.Query.unref}
		 * @param format the default {@link Format} for the new query
		 * @returns a new {@link Query}
		 */
		public static new_seeking(format: Format): Query;
		/**
		 * Constructs a new segment query object. Use {@link Gst.Query.unref}
		 * when done with it. A segment query is used to discover information about the
		 * currently configured segment for playback.
		 * 
		 * Free-function: gst_query_unref()
		 * @param format the {@link Format} for the new query
		 * @returns a new {@link Query}
		 */
		public static new_segment(format: Format): Query;
		/**
		 * Constructs a new query URI query object. Use {@link Gst.Query.unref}
		 * when done with it. An URI query is used to query the current URI
		 * that is used by the source or sink.
		 * 
		 * Free-function: gst_query_unref()
		 * @returns a new {@link Query}
		 */
		public static new_uri(): Query;
		/**
		 * The parent {@link MiniObject} type
		 */
		public mini_object: MiniObject;
		/**
		 * the {@link QueryType}
		 */
		public type: QueryType;
		/**
		 * Add #api with #params as one of the supported metadata API to #query.
		 * @param api the metadata API
		 * @param params API specific parameters
		 */
		public add_allocation_meta(api: GObject.Type, params?: Structure | null): void;
		/**
		 * Add #allocator and its #params as a supported memory allocator.
		 * @param allocator the memory allocator
		 * @param params a {@link AllocationParams}
		 */
		public add_allocation_param(allocator?: Allocator | null, params?: AllocationParams | null): void;
		/**
		 * Set the pool parameters in #query.
		 * @param pool the {@link BufferPool}
		 * @param size the buffer size
		 * @param min_buffers the min buffers
		 * @param max_buffers the max buffers
		 */
		public add_allocation_pool(pool: BufferPool | null, size: number, min_buffers: number, max_buffers: number): void;
		/**
		 * Set the buffering-ranges array field in #query. The current last
		 * start position of the array should be inferior to #start.
		 * @param start start position of the range
		 * @param stop stop position of the range
		 * @returns a #gboolean indicating if the range was added or not.
		 */
		public add_buffering_range(start: number, stop: number): boolean;
		/**
		 * Add #mode as one of the supported scheduling modes to #query.
		 * @param mode a {@link PadMode}
		 */
		public add_scheduling_mode(mode: PadMode): void;
		/**
		 * Check if #query has metadata #api set. When this function returns %TRUE,
		 * #index will contain the index where the requested API and the parameters
		 * can be found.
		 * @param api the metadata API
		 * @returns %TRUE when #api is in the list of metadata.
		 * 
		 * the index
		 */
		public find_allocation_meta(api: GObject.Type): [ boolean, number | null ];
		/**
		 * Retrieve the number of values currently stored in the
		 * meta API array of the query's structure.
		 * @returns the metadata API array size as a #guint.
		 */
		public get_n_allocation_metas(): number;
		/**
		 * Retrieve the number of values currently stored in the
		 * allocator params array of the query's structure.
		 * 
		 * If no memory allocator is specified, the downstream element can handle
		 * the default memory allocator. The first memory allocator in the query
		 * should be generic and allow mapping to system memory, all following
		 * allocators should be ordered by preference with the preferred one first.
		 * @returns the allocator array size as a #guint.
		 */
		public get_n_allocation_params(): number;
		/**
		 * Retrieve the number of values currently stored in the
		 * pool array of the query's structure.
		 * @returns the pool array size as a #guint.
		 */
		public get_n_allocation_pools(): number;
		/**
		 * Retrieve the number of values currently stored in the
		 * buffered-ranges array of the query's structure.
		 * @returns the range array size as a #guint.
		 */
		public get_n_buffering_ranges(): number;
		/**
		 * Retrieve the number of values currently stored in the
		 * scheduling mode array of the query's structure.
		 * @returns the scheduling mode array size as a #guint.
		 */
		public get_n_scheduling_modes(): number;
		/**
		 * Get the structure of a query.
		 * @returns the {@link Structure} of the query. The
		 *     structure is still owned by the query and will therefore be freed when the
		 *     query is unreffed.
		 */
		public get_structure(): Structure | null;
		/**
		 * Check if #query has scheduling mode set.
		 * 
		 * > When checking if upstream supports pull mode, it is usually not
		 * > enough to just check for GST_PAD_MODE_PULL with this function, you
		 * > also want to check whether the scheduling flags returned by
		 * > {@link Gst.Query.parse_scheduling} have the seeking flag set (meaning
		 * > random access is supported, not only sequential pulls).
		 * @param mode the scheduling mode
		 * @returns %TRUE when #mode is in the list of scheduling modes.
		 */
		public has_scheduling_mode(mode: PadMode): boolean;
		/**
		 * Check if #query has scheduling mode set and #flags is set in
		 * query scheduling flags.
		 * @param mode the scheduling mode
		 * @param flags {@link SchedulingFlags}
		 * @returns %TRUE when #mode is in the list of scheduling modes
		 *    and #flags are compatible with query flags.
		 */
		public has_scheduling_mode_with_flags(mode: PadMode, flags: SchedulingFlags): boolean;
		/**
		 * Get the caps from #query. The caps remains valid as long as #query remains
		 * valid.
		 * @returns A pointer to the caps
		 */
		public parse_accept_caps(): Caps;
		/**
		 * Parse the result from #query and store in #result.
		 * @returns location for the result
		 */
		public parse_accept_caps_result(): boolean | null;
		/**
		 * Parse an allocation query, writing the requested caps in #caps and
		 * whether a pool is needed in #need_pool, if the respective parameters
		 * are non-%NULL.
		 * 
		 * Pool details can be retrieved using {@link Gst.Query.get_n_allocation_pools} and
		 * gst_query_parse_nth_allocation_pool().
		 * @returns The {@link Caps}
		 * 
		 * Whether a #GstBufferPool is needed
		 */
		public parse_allocation(): [ caps: Caps | null, need_pool: boolean | null ];
		/**
		 * Get the results of a bitrate query. See also {@link Gst.Query.set_bitrate}.
		 * @returns The resulting bitrate in bits per second
		 */
		public parse_bitrate(): number | null;
		/**
		 * Get the percentage of buffered data. This is a value between 0 and 100.
		 * The #busy indicator is %TRUE when the buffering is in progress.
		 * @returns if buffering is busy, or %NULL
		 * 
		 * a buffering percent, or %NULL
		 */
		public parse_buffering_percent(): [ busy: boolean | null, percent: number | null ];
		/**
		 * Parse an available query, writing the format into #format, and
		 * other results into the passed parameters, if the respective parameters
		 * are non-%NULL
		 * @returns the format to set for the #segment_start
		 *     and #segment_end values, or %NULL
		 * 
		 * the start to set, or %NULL
		 * 
		 * the stop to set, or %NULL
		 * 
		 * estimated total amount of download
		 *     time remaining in milliseconds, or %NULL
		 */
		public parse_buffering_range(): [ format: Format | null, start: number | null, stop: number | null, estimated_total: number | null ];
		/**
		 * Extracts the buffering stats values from #query.
		 * @returns a buffering mode, or %NULL
		 * 
		 * the average input rate, or %NULL
		 * 
		 * the average output rat, or %NULL
		 * 
		 * amount of buffering time left in
		 *     milliseconds, or %NULL
		 */
		public parse_buffering_stats(): [ mode: BufferingMode | null, avg_in: number | null, avg_out: number | null, buffering_left: number | null ];
		/**
		 * Get the filter from the caps #query. The caps remains valid as long as
		 * #query remains valid.
		 * @returns A pointer to the caps filter
		 */
		public parse_caps(): Caps;
		/**
		 * Get the caps result from #query. The caps remains valid as long as
		 * #query remains valid.
		 * @returns A pointer to the caps
		 */
		public parse_caps_result(): Caps;
		/**
		 * Get the context from the context #query. The context remains valid as long as
		 * #query remains valid.
		 * @returns A pointer to store the {@link Context}
		 */
		public parse_context(): Context;
		/**
		 * Parse a context type from an existing GST_QUERY_CONTEXT query.
		 * @returns a #gboolean indicating if the parsing succeeded.
		 * 
		 * the context type, or %NULL
		 */
		public parse_context_type(): [ boolean, string | null ];
		/**
		 * Parse a convert query answer. Any of #src_format, #src_value, #dest_format,
		 * and #dest_value may be %NULL, in which case that value is omitted.
		 * @returns the storage for the {@link Format} of the
		 *     source value, or %NULL
		 * 
		 * the storage for the source value, or %NULL
		 * 
		 * the storage for the #GstFormat of the
		 *     destination value, or %NULL
		 * 
		 * the storage for the destination value,
		 *     or %NULL
		 */
		public parse_convert(): [ src_format: Format | null, src_value: number | null, dest_format: Format | null, dest_value: number | null ];
		/**
		 * Parse a duration query answer. Write the format of the duration into #format,
		 * and the value into #duration, if the respective variables are non-%NULL.
		 * @returns the storage for the {@link Format} of the duration
		 *     value, or %NULL.
		 * 
		 * the storage for the total duration, or %NULL.
		 */
		public parse_duration(): [ format: Format | null, duration: number | null ];
		/**
		 * Parse a latency query answer.
		 * @returns storage for live or %NULL
		 * 
		 * the storage for the min latency or %NULL
		 * 
		 * the storage for the max latency or %NULL
		 */
		public parse_latency(): [ live: boolean | null, min_latency: ClockTime | null, max_latency: ClockTime | null ];
		/**
		 * Parse the number of formats in the formats #query.
		 * @returns the number of formats in this query.
		 */
		public parse_n_formats(): number | null;
		/**
		 * Parse an available query and get the metadata API
		 * at #index of the metadata API array.
		 * @param index position in the metadata API array to read
		 * @returns a #GType of the metadata API at #index.
		 * 
		 * API specific parameters
		 */
		public parse_nth_allocation_meta(index: number): [ GObject.Type, Structure | null ];
		/**
		 * Parse an available query and get the allocator and its params
		 * at #index of the allocator array.
		 * @param index position in the allocator array to read
		 * @returns variable to hold the result
		 * 
		 * parameters for the allocator
		 */
		public parse_nth_allocation_param(index: number): [ allocator: Allocator | null, params: AllocationParams | null ];
		/**
		 * Get the pool parameters in #query.
		 * 
		 * Unref #pool with {@link Gst.Object.unref} when it's not needed any more.
		 * @param index index to parse
		 * @returns the {@link BufferPool}
		 * 
		 * the buffer size
		 * 
		 * the min buffers
		 * 
		 * the max buffers
		 */
		public parse_nth_allocation_pool(index: number): [ pool: BufferPool | null, size: number | null, min_buffers: number | null, max_buffers: number | null ];
		/**
		 * Parse an available query and get the start and stop values stored
		 * at the #index of the buffered ranges array.
		 * @param index position in the buffered-ranges array to read
		 * @returns a #gboolean indicating if the parsing succeeded.
		 * 
		 * the start position to set, or %NULL
		 * 
		 * the stop position to set, or %NULL
		 */
		public parse_nth_buffering_range(index: number): [ boolean, number | null, number | null ];
		/**
		 * Parse the format query and retrieve the #nth format from it into
		 * #format. If the list contains less elements than #nth, #format will be
		 * set to GST_FORMAT_UNDEFINED.
		 * @param nth the nth format to retrieve.
		 * @returns a pointer to store the nth format
		 */
		public parse_nth_format(nth: number): Format | null;
		/**
		 * Parse an available query and get the scheduling mode
		 * at #index of the scheduling modes array.
		 * @param index position in the scheduling modes array to read
		 * @returns a {@link PadMode} of the scheduling mode at #index.
		 */
		public parse_nth_scheduling_mode(index: number): PadMode;
		/**
		 * Parse a position query, writing the format into #format, and the position
		 * into #cur, if the respective parameters are non-%NULL.
		 * @returns the storage for the {@link Format} of the
		 *     position values (may be %NULL)
		 * 
		 * the storage for the current position (may be %NULL)
		 */
		public parse_position(): [ format: Format | null, cur: number | null ];
		/**
		 * Set the scheduling properties.
		 * @returns {@link SchedulingFlags}
		 * 
		 * the suggested minimum size of pull requests
		 * 
		 * the suggested maximum size of pull requests:
		 * 
		 * the suggested alignment of pull requests
		 */
		public parse_scheduling(): [ flags: SchedulingFlags | null, minsize: number | null, maxsize: number | null, align: number | null ];
		/**
		 * Parse a seeking query, writing the format into #format, and
		 * other results into the passed parameters, if the respective parameters
		 * are non-%NULL
		 * @returns the format to set for the #segment_start
		 *     and #segment_end values, or %NULL
		 * 
		 * the seekable flag to set, or %NULL
		 * 
		 * the segment_start to set, or %NULL
		 * 
		 * the segment_end to set, or %NULL
		 */
		public parse_seeking(): [ format: Format | null, seekable: boolean | null, segment_start: number | null, segment_end: number | null ];
		/**
		 * Parse a segment query answer. Any of #rate, #format, #start_value, and
		 * #stop_value may be %NULL, which will cause this value to be omitted.
		 * 
		 * See {@link Gst.Query.set_segment} for an explanation of the function arguments.
		 * @returns the storage for the rate of the segment, or %NULL
		 * 
		 * the storage for the {@link Format} of the values,
		 *     or %NULL
		 * 
		 * the storage for the start value, or %NULL
		 * 
		 * the storage for the stop value, or %NULL
		 */
		public parse_segment(): [ rate: number | null, format: Format | null, start_value: number | null, stop_value: number | null ];
		/**
		 * Parse an URI query, writing the URI into #uri as a newly
		 * allocated string, if the respective parameters are non-%NULL.
		 * Free the string with {@link G.free} after usage.
		 * @returns the storage for the current URI
		 *     (may be %NULL)
		 */
		public parse_uri(): string | null;
		/**
		 * Parse an URI query, writing the URI into #uri as a newly
		 * allocated string, if the respective parameters are non-%NULL.
		 * Free the string with {@link G.free} after usage.
		 * @returns the storage for the redirect URI
		 *     (may be %NULL)
		 */
		public parse_uri_redirection(): string | null;
		/**
		 * Parse an URI query, and set #permanent to %TRUE if there is a redirection
		 * and it should be considered permanent. If a redirection is permanent,
		 * applications should update their internal storage of the URI, otherwise
		 * they should make all future requests to the original URI.
		 * @returns if the URI redirection is permanent
		 *     (may be %NULL)
		 */
		public parse_uri_redirection_permanent(): boolean | null;
		/**
		 * Remove the metadata API at #index of the metadata API array.
		 * @param index position in the metadata API array to remove
		 */
		public remove_nth_allocation_meta(index: number): void;
		/**
		 * Remove the allocation param at #index of the allocation param array.
		 * @param index position in the allocation param array to remove
		 */
		public remove_nth_allocation_param(index: number): void;
		/**
		 * Remove the allocation pool at #index of the allocation pool array.
		 * @param index position in the allocation pool array to remove
		 */
		public remove_nth_allocation_pool(index: number): void;
		/**
		 * Set #result as the result for the #query.
		 * @param result the result to set
		 */
		public set_accept_caps_result(result: boolean): void;
		/**
		 * Set the results of a bitrate query.  The nominal bitrate is the average
		 * bitrate expected over the length of the stream as advertised in file
		 * headers (or similar).
		 * @param nominal_bitrate the nominal bitrate in bits per second
		 */
		public set_bitrate(nominal_bitrate: number): void;
		/**
		 * Set the percentage of buffered data. This is a value between 0 and 100.
		 * The #busy indicator is %TRUE when the buffering is in progress.
		 * @param busy if buffering is busy
		 * @param percent a buffering percent
		 */
		public set_buffering_percent(busy: boolean, percent: number): void;
		/**
		 * Set the available query result fields in #query.
		 * @param format the format to set for the #start and #stop values
		 * @param start the start to set
		 * @param stop the stop to set
		 * @param estimated_total estimated total amount of download time remaining in
		 *     milliseconds
		 */
		public set_buffering_range(format: Format, start: number, stop: number, estimated_total: number): void;
		/**
		 * Configures the buffering stats values in #query.
		 * @param mode a buffering mode
		 * @param avg_in the average input rate
		 * @param avg_out the average output rate
		 * @param buffering_left amount of buffering time left in milliseconds
		 */
		public set_buffering_stats(mode: BufferingMode, avg_in: number, avg_out: number, buffering_left: number): void;
		/**
		 * Set the #caps result in #query.
		 * @param caps A pointer to the caps
		 */
		public set_caps_result(caps: Caps): void;
		/**
		 * Answer a context query by setting the requested context.
		 * @param context the requested {@link Context}
		 */
		public set_context(context: Context): void;
		/**
		 * Answer a convert query by setting the requested values.
		 * @param src_format the source {@link Format}
		 * @param src_value the source value
		 * @param dest_format the destination {@link Format}
		 * @param dest_value the destination value
		 */
		public set_convert(src_format: Format, src_value: number, dest_format: Format, dest_value: number): void;
		/**
		 * Answer a duration query by setting the requested value in the given format.
		 * @param format the {@link Format} for the duration
		 * @param duration the duration of the stream
		 */
		public set_duration(format: Format, duration: number): void;
		/**
		 * Set the formats query result fields in #query. The number of formats passed
		 * must be equal to #n_formats.
		 * @param n_formats the number of formats to set.
		 */
		public set_formats(n_formats: number): void;
		/**
		 * Set the formats query result fields in #query. The number of formats passed
		 * in the #formats array must be equal to #n_formats.
		 * @param formats an array containing #n_formats
		 *     {@link Format} values.
		 */
		public set_formatsv(formats: Format[]): void;
		/**
		 * Answer a latency query by setting the requested values in the given format.
		 * @param live if there is a live element upstream
		 * @param min_latency the minimal latency of the upstream elements
		 * @param max_latency the maximal latency of the upstream elements
		 */
		public set_latency(live: boolean, min_latency: ClockTime, max_latency: ClockTime): void;
		/**
		 * Parse an available query and get the allocator and its params
		 * at #index of the allocator array.
		 * @param index position in the allocator array to set
		 * @param allocator new allocator to set
		 * @param params parameters for the allocator
		 */
		public set_nth_allocation_param(index: number, allocator?: Allocator | null, params?: AllocationParams | null): void;
		/**
		 * Set the pool parameters in #query.
		 * @param index index to modify
		 * @param pool the {@link BufferPool}
		 * @param size the buffer size
		 * @param min_buffers the min buffers
		 * @param max_buffers the max buffers
		 */
		public set_nth_allocation_pool(index: number, pool: BufferPool | null, size: number, min_buffers: number, max_buffers: number): void;
		/**
		 * Answer a position query by setting the requested value in the given format.
		 * @param format the requested {@link Format}
		 * @param cur the position to set
		 */
		public set_position(format: Format, cur: number): void;
		/**
		 * Set the scheduling properties.
		 * @param flags {@link SchedulingFlags}
		 * @param minsize the suggested minimum size of pull requests
		 * @param maxsize the suggested maximum size of pull requests
		 * @param align the suggested alignment of pull requests
		 */
		public set_scheduling(flags: SchedulingFlags, minsize: number, maxsize: number, align: number): void;
		/**
		 * Set the seeking query result fields in #query.
		 * @param format the format to set for the #segment_start and #segment_end values
		 * @param seekable the seekable flag to set
		 * @param segment_start the segment_start to set
		 * @param segment_end the segment_end to set
		 */
		public set_seeking(format: Format, seekable: boolean, segment_start: number, segment_end: number): void;
		/**
		 * Answer a segment query by setting the requested values. The normal
		 * playback segment of a pipeline is 0 to duration at the default rate of
		 * 1.0. If a seek was performed on the pipeline to play a different
		 * segment, this query will return the range specified in the last seek.
		 * 
		 * #start_value and #stop_value will respectively contain the configured
		 * playback range start and stop values expressed in #format.
		 * The values are always between 0 and the duration of the media and
		 * #start_value <= #stop_value. #rate will contain the playback rate. For
		 * negative rates, playback will actually happen from #stop_value to
		 * #start_value.
		 * @param rate the rate of the segment
		 * @param format the {@link Format} of the segment values (#start_value and #stop_value)
		 * @param start_value the start value
		 * @param stop_value the stop value
		 */
		public set_segment(rate: number, format: Format, start_value: number, stop_value: number): void;
		/**
		 * Answer a URI query by setting the requested URI.
		 * @param uri the URI to set
		 */
		public set_uri(uri: string): void;
		/**
		 * Answer a URI query by setting the requested URI redirection.
		 * @param uri the URI to set
		 */
		public set_uri_redirection(uri: string): void;
		/**
		 * Answer a URI query by setting the requested URI redirection
		 * to permanent or not.
		 * @param permanent whether the redirect is permanent or not
		 */
		public set_uri_redirection_permanent(permanent: boolean): void;
		/**
		 * Get the structure of a query. This method should be called with a writable
		 * #query so that the returned structure is guaranteed to be writable.
		 * @returns the {@link Structure} of the query. The structure is
		 *     still owned by the query and will therefore be freed when the query
		 *     is unreffed.
		 */
		public writable_structure(): Structure;
	}

	export interface ReferenceTimestampMetaInitOptions {}
	/**
	 * {@link ReferenceTimestampMeta} can be used to attach alternative timestamps and
	 * possibly durations to a #GstBuffer. These are generally not according to
	 * the pipeline clock and could be e.g. the NTP timestamp when the media was
	 * captured.
	 * 
	 * The reference is stored as a #GstCaps in #reference. Examples of valid
	 * references would be "timestamp/x-drivername-stream" for timestamps that are locally
	 * generated by some driver named "drivername" when generating the stream,
	 * e.g. based on a frame counter, or "timestamp/x-ntp, host=pool.ntp.org,
	 * port=123" for timestamps based on a specific NTP server.
	 */
	interface ReferenceTimestampMeta {}
	class ReferenceTimestampMeta {
		public constructor(options?: Partial<ReferenceTimestampMetaInitOptions>);
		/**
		 * Get the global {@link MetaInfo} describing  the #GstReferenceTimestampMeta meta.
		 * @returns The {@link MetaInfo}
		 */
		public static get_info(): MetaInfo;
		/**
		 * identifier for the timestamp reference.
		 */
		public reference: Caps;
		/**
		 * timestamp
		 */
		public timestamp: ClockTime;
		/**
		 * duration, or %GST_CLOCK_TIME_NONE
		 */
		public duration: ClockTime;
	}

	export interface SampleInitOptions {}
	/**
	 * A {@link Sample} is a small object containing data, a type, timing and
	 * extra arbitrary information.
	 */
	interface Sample {}
	class Sample {
		public constructor(options?: Partial<SampleInitOptions>);
		/**
		 * Create a new {@link Sample} with the provided details.
		 * 
		 * Free-function: gst_sample_unref
		 * @param buffer a {@link Buffer}, or %NULL
		 * @param caps a {@link Caps}, or %NULL
		 * @param segment a {@link Segment}, or %NULL
		 * @param info a {@link Structure}, or %NULL
		 * @returns the new {@link Sample}. {@link Gst.Sample.unref}
		 *     after usage.
		 */
		public static new(buffer?: Buffer | null, caps?: Caps | null, segment?: Segment | null, info?: Structure | null): Sample;
		/**
		 * Get the buffer associated with #sample
		 * @returns the buffer of #sample or %NULL
		 *  when there is no buffer. The buffer remains valid as long as
		 *  #sample is valid.  If you need to hold on to it for longer than
		 *  that, take a ref to the buffer with {@link Gst.Buffer.ref}.
		 */
		public get_buffer(): Buffer | null;
		/**
		 * Get the buffer list associated with #sample
		 * @returns the buffer list of #sample or %NULL
		 *  when there is no buffer list. The buffer list remains valid as long as
		 *  #sample is valid.  If you need to hold on to it for longer than
		 *  that, take a ref to the buffer list with gst_mini_object_ref ().
		 */
		public get_buffer_list(): BufferList | null;
		/**
		 * Get the caps associated with #sample
		 * @returns the caps of #sample or %NULL
		 *  when there is no caps. The caps remain valid as long as #sample is
		 *  valid.  If you need to hold on to the caps for longer than that,
		 *  take a ref to the caps with {@link Gst.Caps.ref}.
		 */
		public get_caps(): Caps | null;
		/**
		 * Get extra information associated with #sample.
		 * @returns the extra info of #sample.
		 *  The info remains valid as long as #sample is valid.
		 */
		public get_info(): Structure | null;
		/**
		 * Get the segment associated with #sample
		 * @returns the segment of #sample.
		 *  The segment remains valid as long as #sample is valid.
		 */
		public get_segment(): Segment;
		/**
		 * Set the buffer associated with #sample. #sample must be writable.
		 * @param buffer A {@link Buffer}
		 */
		public set_buffer(buffer: Buffer): void;
		/**
		 * Set the buffer list associated with #sample. #sample must be writable.
		 * @param buffer_list a {@link BufferList}
		 */
		public set_buffer_list(buffer_list: BufferList): void;
		/**
		 * Set the caps associated with #sample. #sample must be writable.
		 * @param caps A {@link Caps}
		 */
		public set_caps(caps: Caps): void;
		/**
		 * Set the info structure associated with #sample. #sample must be writable,
		 * and #info must not have a parent set already.
		 * @param info A {@link Structure}
		 * @returns 
		 */
		public set_info(info: Structure): boolean;
		/**
		 * Set the segment associated with #sample. #sample must be writable.
		 * @param segment A {@link Segment}
		 */
		public set_segment(segment: Segment): void;
	}

	export interface SegmentInitOptions {}
	/**
	 * This helper structure holds the relevant values for tracking the region of
	 * interest in a media file, called a segment.
	 * 
	 * The structure can be used for two purposes:
	 * 
	 *   * performing seeks (handling seek events)
	 *   * tracking playback regions (handling newsegment events)
	 * 
	 * The segment is usually configured by the application with a seek event which
	 * is propagated upstream and eventually handled by an element that performs the seek.
	 * 
	 * The configured segment is then propagated back downstream with a newsegment event.
	 * This information is then used to clip media to the segment boundaries.
	 * 
	 * A segment structure is initialized with {@link Gst.Segment.init}, which takes a {@link Format}
	 * that will be used as the format of the segment values. The segment will be configured
	 * with a start value of 0 and a stop/duration of -1, which is undefined. The default
	 * rate and applied_rate is 1.0.
	 * 
	 * The public duration field contains the duration of the segment. When using
	 * the segment for seeking, the start and time members should normally be left
	 * to their default 0 value. The stop position is left to -1 unless explicitly
	 * configured to a different value after a seek event.
	 * 
	 * The current position in the segment should be set by changing the position
	 * member in the structure.
	 * 
	 * For elements that perform seeks, the current segment should be updated with the
	 * gst_segment_do_seek() and the values from the seek event. This method will update
	 * all the segment fields. The position field will contain the new playback position.
	 * If the start_type was different from GST_SEEK_TYPE_NONE, playback continues from
	 * the position position, possibly with updated flags or rate.
	 * 
	 * For elements that want to use #GstSegment to track the playback region,
	 * update the segment fields with the information from the newsegment event.
	 * The gst_segment_clip() method can be used to check and clip
	 * the media data to the segment boundaries.
	 * 
	 * For elements that want to synchronize to the pipeline clock, gst_segment_to_running_time()
	 * can be used to convert a timestamp to a value that can be used to synchronize
	 * to the clock. This function takes into account the base as well as
	 * any rate or applied_rate conversions.
	 * 
	 * For elements that need to perform operations on media data in stream_time,
	 * gst_segment_to_stream_time() can be used to convert a timestamp and the segment
	 * info to stream time (which is always between 0 and the duration of the stream).
	 */
	interface Segment {}
	class Segment {
		public constructor(options?: Partial<SegmentInitOptions>);
		/**
		 * Allocate a new {@link Segment} structure and initialize it using
		 * {@link Gst.Segment.init}.
		 * 
		 * Free-function: gst_segment_free
		 * @returns a new {@link Segment}, free with {@link Gst.Segment.free}.
		 */
		public static new(): Segment;
		/**
		 * flags for this segment
		 */
		public flags: SegmentFlags;
		/**
		 * the playback rate of the segment is set in response to a seek
		 *                event and, without any seek, the value should be `1.0`. This
		 *                value is used by elements that synchronize buffer [running
		 *                times](additional/design/synchronisation.md#running-time) on
		 *                the clock (usually the sink elements), leading to consuming
		 *                buffers faster (for a value `> 1.0`) or slower (for `0.0 <
		 *                value < 1.0`) than normal playback speed. The rate also
		 *                defines the playback direction, meaning that when the value is
		 *                lower than `0.0`, the playback happens in reverse, and the
		 *                [stream-time](additional/design/synchronisation.md#stream-time)
		 *                is going backward. The `rate` value should never be `0.0`.
		 */
		public rate: number;
		/**
		 * The applied rate is the rate that has been applied to the stream.
		 *                The effective/resulting playback rate of a stream is
		 *                `rate * applied_rate`.
		 *                The applied rate can be set by source elements when a server is
		 *                sending the stream with an already modified playback speed
		 *                rate. Filter elements that modify the stream in a way that
		 *                modifies the playback speed should also modify the applied
		 *                rate. For example the #videorate element when its
		 *                #videorate:rate property is set will set the applied rate of
		 *                the segment it pushed downstream. Also #scaletempo applies the
		 *                input segment rate to the stream and outputs a segment with
		 *                rate=1.0 and applied_rate=<inputsegment.rate>.
		 */
		public applied_rate: number;
		/**
		 * the unit used for all of the segment's values.
		 */
		public format: Format;
		/**
		 * the running time (plus elapsed time, see offset) of the
		 *                segment [start](GstSegment.start) ([stop](GstSegment.stop) if
		 *                rate < 0.0).
		 */
		public base: number;
		/**
		 * the offset expresses the elapsed time (in buffer timestamps)
		 *                before a seek with its start (stop if rate < 0.0) seek type
		 *                set to #GST_SEEK_TYPE_NONE, the value is set to the position
		 *                of the segment at the time of the seek.
		 */
		public offset: number;
		/**
		 * the start time of the segment (in buffer timestamps)
		 *                [(PTS)](GstBuffer.pts), that is the timestamp of the first
		 *                buffer to output inside the segment (last one during
		 *                reverse playback). For example decoders will
		 *                [clip](gst_segment_clip) out the buffers before the start
		 *                time.
		 */
		public start: number;
		/**
		 * the stop time of the segment (in buffer timestamps)
		 *                [(PTS)](GstBuffer.pts), that is the timestamp of the last
		 *                buffer to output inside the segment (first one during
		 *                reverse playback). For example decoders will
		 *                [clip](gst_segment_clip) out buffers after the stop time.
		 */
		public stop: number;
		/**
		 * the stream time of the segment [start](GstSegment.start)
		 *                ([stop](GstSegment.stop) if rate < 0.0).
		 */
		public time: number;
		/**
		 * the buffer timestamp position in the segment is supposed to be
		 *                updated by elements such as sources, demuxers or parsers to
		 *                track progress by setting it to the last pushed buffer' end time
		 *                ([timestamp](GstBuffer.pts) + {@link Buffer}.duration) for that
		 *                specific segment. The position is used when reconfiguring the
		 *                segment with #gst_segment_do_seek when the seek is only
		 *                updating the segment (see [offset](GstSegment.offset)).
		 */
		public position: number;
		/**
		 * the duration of the segment is the maximum absolute difference
		 *                between {@link Segment}.start and #GstSegment.stop if stop is not
		 *                set, otherwise it should be the difference between those
		 *                two values. This should be set by elements that know the
		 *                overall stream duration (like demuxers) and will be used when
		 *                seeking with #GST_SEEK_TYPE_END.
		 */
		public duration: number;
		public readonly _gst_reserved: any[];
		/**
		 * Clip the given #start and #stop values to the segment boundaries given
		 * in #segment. #start and #stop are compared and clipped to #segment
		 * start and stop values.
		 * 
		 * If the function returns %FALSE, #start and #stop are known to fall
		 * outside of #segment and #clip_start and #clip_stop are not updated.
		 * 
		 * When the function returns %TRUE, #clip_start and #clip_stop will be
		 * updated. If #clip_start or #clip_stop are different from #start or #stop
		 * respectively, the region fell partially in the segment.
		 * 
		 * Note that when #stop is -1, #clip_stop will be set to the end of the
		 * segment. Depending on the use case, this may or may not be what you want.
		 * @param format the format of the segment.
		 * @param start the start position in the segment
		 * @param stop the stop position in the segment
		 * @returns %TRUE if the given #start and #stop times fall partially or
		 *     completely in #segment, %FALSE if the values are completely outside
		 *     of the segment.
		 * 
		 * the clipped start position in the segment
		 * 
		 * the clipped stop position in the segment
		 */
		public clip(format: Format, start: number, stop: number): [ boolean, number | null, number | null ];
		/**
		 * Create a copy of given #segment.
		 * 
		 * Free-function: gst_segment_free
		 * @returns a new {@link Segment}, free with {@link Gst.Segment.free}.
		 */
		public copy(): Segment;
		/**
		 * Copy the contents of #src into #dest.
		 * @param dest a {@link Segment}
		 */
		public copy_into(dest: Segment): void;
		/**
		 * Update the segment structure with the field values of a seek event (see
		 * {@link Gst.Event.new_seek}).
		 * 
		 * After calling this method, the segment field position and time will
		 * contain the requested new position in the segment. The new requested
		 * position in the segment depends on #rate and #start_type and #stop_type.
		 * 
		 * For positive #rate, the new position in the segment is the new #segment
		 * start field when it was updated with a #start_type different from
		 * #GST_SEEK_TYPE_NONE. If no update was performed on #segment start position
		 * (#GST_SEEK_TYPE_NONE), #start is ignored and #segment position is
		 * unmodified.
		 * 
		 * For negative #rate, the new position in the segment is the new #segment
		 * stop field when it was updated with a #stop_type different from
		 * #GST_SEEK_TYPE_NONE. If no stop was previously configured in the segment, the
		 * duration of the segment will be used to update the stop position.
		 * If no update was performed on #segment stop position (#GST_SEEK_TYPE_NONE),
		 * #stop is ignored and #segment position is unmodified.
		 * 
		 * The applied rate of the segment will be set to 1.0 by default.
		 * If the caller can apply a rate change, it should update #segment
		 * rate and applied_rate after calling this function.
		 * 
		 * #update will be set to %TRUE if a seek should be performed to the segment
		 * position field. This field can be %FALSE if, for example, only the #rate
		 * has been changed but not the playback position.
		 * @param rate the rate of the segment.
		 * @param format the format of the segment.
		 * @param flags the segment flags for the segment
		 * @param start_type the seek method
		 * @param start the seek start value
		 * @param stop_type the seek method
		 * @param stop the seek stop value
		 * @returns %TRUE if the seek could be performed.
		 * 
		 * boolean holding whether position was updated.
		 */
		public do_seek(rate: number, format: Format, flags: SeekFlags, start_type: SeekType, start: number, stop_type: SeekType, stop: number): [ boolean, boolean | null ];
		/**
		 * Free the allocated segment #segment.
		 */
		public free(): void;
		/**
		 * The start/position fields are set to 0 and the stop/duration
		 * fields are set to -1 (unknown). The default rate of 1.0 and no
		 * flags are set.
		 * 
		 * Initialize #segment to its default values.
		 * @param format the format of the segment.
		 */
		public init(format: Format): void;
		/**
		 * Checks for two segments being equal. Equality here is defined
		 * as perfect equality, including floating point values.
		 * @param s1 a {@link Segment} structure.
		 * @returns %TRUE if the segments are equal, %FALSE otherwise.
		 */
		public is_equal(s1: Segment): boolean;
		/**
		 * Adjust the values in #segment so that #offset is applied to all
		 * future running-time calculations.
		 * @param format the format of the segment.
		 * @param offset the offset to apply in the segment
		 * @returns %TRUE if the segment could be updated successfully. If %FALSE is
		 * returned, #offset is not in #segment.
		 */
		public offset_running_time(format: Format, offset: number): boolean;
		/**
		 * Convert #running_time into a position in the segment so that
		 * {@link Gst.Segment.to_running_time} with that position returns #running_time.
		 * @param format the format of the segment.
		 * @param running_time the running_time in the segment
		 * @returns the position in the segment for #running_time. This function returns
		 * -1 when #running_time is -1 or when it is not inside #segment.
		 */
		public position_from_running_time(format: Format, running_time: number): number;
		/**
		 * Translate #running_time to the segment position using the currently configured
		 * segment. Compared to {@link Gst.Segment.position_from_running_time} this function can
		 * return negative segment position.
		 * 
		 * This function is typically used by elements that need to synchronize buffers
		 * against the clock or each other.
		 * 
		 * #running_time can be any value and the result of this function for values
		 * outside of the segment is extrapolated.
		 * 
		 * When 1 is returned, #running_time resulted in a positive position returned
		 * in #position.
		 * 
		 * When this function returns -1, the returned #position was < 0, and the value
		 * in the position variable should be negated to get the real negative segment
		 * position.
		 * @param format the format of the segment.
		 * @param running_time the running-time
		 * @returns a 1 or -1 on success, 0 on failure.
		 * 
		 * the resulting position in the segment
		 */
		public position_from_running_time_full(format: Format, running_time: number): [ number, number ];
		/**
		 * Convert #stream_time into a position in the segment so that
		 * {@link Gst.Segment.to_stream_time} with that position returns #stream_time.
		 * @param format the format of the segment.
		 * @param stream_time the stream_time in the segment
		 * @returns the position in the segment for #stream_time. This function returns
		 * -1 when #stream_time is -1 or when it is not inside #segment.
		 */
		public position_from_stream_time(format: Format, stream_time: number): number;
		/**
		 * Translate #stream_time to the segment position using the currently configured
		 * segment. Compared to {@link Gst.Segment.position_from_stream_time} this function can
		 * return negative segment position.
		 * 
		 * This function is typically used by elements that need to synchronize buffers
		 * against the clock or each other.
		 * 
		 * #stream_time can be any value and the result of this function for values outside
		 * of the segment is extrapolated.
		 * 
		 * When 1 is returned, #stream_time resulted in a positive position returned
		 * in #position.
		 * 
		 * When this function returns -1, the returned #position should be negated
		 * to get the real negative segment position.
		 * @param format the format of the segment.
		 * @param stream_time the stream-time
		 * @returns a 1 or -1 on success, 0 on failure.
		 * 
		 * the resulting position in the segment
		 */
		public position_from_stream_time_full(format: Format, stream_time: number): [ number, number ];
		/**
		 * Adjust the start/stop and base values of #segment such that the next valid
		 * buffer will be one with #running_time.
		 * @param format the format of the segment.
		 * @param running_time the running_time in the segment
		 * @returns %TRUE if the segment could be updated successfully. If %FALSE is
		 * returned, #running_time is -1 or not in #segment.
		 */
		public set_running_time(format: Format, running_time: number): boolean;
		/**
		 * @deprecated
		 * Use {@link Gst.Segment.position_from_running_time} instead.
		 * 
		 * Convert #running_time into a position in the segment so that
		 * {@link Gst.Segment.to_running_time} with that position returns #running_time.
		 * @param format the format of the segment.
		 * @param running_time the running_time in the segment
		 * @returns the position in the segment for #running_time. This function returns
		 * -1 when #running_time is -1 or when it is not inside #segment.
		 */
		public to_position(format: Format, running_time: number): number;
		/**
		 * Translate #position to the total running time using the currently configured
		 * segment. Position is a value between #segment start and stop time.
		 * 
		 * This function is typically used by elements that need to synchronize to the
		 * global clock in a pipeline. The running time is a constantly increasing value
		 * starting from 0. When {@link Gst.Segment.init} is called, this value will reset to
		 * 0.
		 * 
		 * This function returns -1 if the position is outside of #segment start and stop.
		 * @param format the format of the segment.
		 * @param position the position in the segment
		 * @returns the position as the total running time or -1 when an invalid position
		 * was given.
		 */
		public to_running_time(format: Format, position: number): number;
		/**
		 * Translate #position to the total running time using the currently configured
		 * segment. Compared to {@link Gst.Segment.to_running_time} this function can return
		 * negative running-time.
		 * 
		 * This function is typically used by elements that need to synchronize buffers
		 * against the clock or each other.
		 * 
		 * #position can be any value and the result of this function for values outside
		 * of the segment is extrapolated.
		 * 
		 * When 1 is returned, #position resulted in a positive running-time returned
		 * in #running_time.
		 * 
		 * When this function returns -1, the returned #running_time should be negated
		 * to get the real negative running time.
		 * @param format the format of the segment.
		 * @param position the position in the segment
		 * @returns a 1 or -1 on success, 0 on failure.
		 * 
		 * result running-time
		 */
		public to_running_time_full(format: Format, position: number): [ number, number | null ];
		/**
		 * Translate #position to stream time using the currently configured
		 * segment. The #position value must be between #segment start and
		 * stop value.
		 * 
		 * This function is typically used by elements that need to operate on
		 * the stream time of the buffers it receives, such as effect plugins.
		 * In those use cases, #position is typically the buffer timestamp or
		 * clock time that one wants to convert to the stream time.
		 * The stream time is always between 0 and the total duration of the
		 * media stream.
		 * @param format the format of the segment.
		 * @param position the position in the segment
		 * @returns the position in stream_time or -1 when an invalid position
		 * was given.
		 */
		public to_stream_time(format: Format, position: number): number;
		/**
		 * Translate #position to the total stream time using the currently configured
		 * segment. Compared to {@link Gst.Segment.to_stream_time} this function can return
		 * negative stream-time.
		 * 
		 * This function is typically used by elements that need to synchronize buffers
		 * against the clock or each other.
		 * 
		 * #position can be any value and the result of this function for values outside
		 * of the segment is extrapolated.
		 * 
		 * When 1 is returned, #position resulted in a positive stream-time returned
		 * in #stream_time.
		 * 
		 * When this function returns -1, the returned #stream_time should be negated
		 * to get the real negative stream time.
		 * @param format the format of the segment.
		 * @param position the position in the segment
		 * @returns a 1 or -1 on success, 0 on failure.
		 * 
		 * result stream-time
		 */
		public to_stream_time_full(format: Format, position: number): [ number, number ];
	}

	export interface StaticCapsInitOptions {}
	/**
	 * Datastructure to initialize {@link Caps} from a string description usually
	 * used in conjunction with {@link GST.STATIC_CAPS} and gst_static_caps_get() to
	 * instantiate a #GstCaps.
	 */
	interface StaticCaps {}
	class StaticCaps {
		public constructor(options?: Partial<StaticCapsInitOptions>);
		/**
		 * the cached {@link Caps}
		 */
		public caps: Caps;
		/**
		 * a string describing a caps
		 */
		public string: string;
		public readonly _gst_reserved: any[];
		/**
		 * Clean up the cached caps contained in #static_caps.
		 */
		public cleanup(): void;
		/**
		 * Converts a {@link StaticCaps} to a #GstCaps.
		 * @returns a pointer to the {@link Caps}. Unref
		 *     after usage. Since the core holds an additional ref to the
		 *     returned caps, use {@link Gst.Caps.make_writable} on the returned caps
		 *     to modify it.
		 */
		public get(): Caps | null;
	}

	export interface StaticPadTemplateInitOptions {}
	/**
	 * Structure describing the {@link StaticPadTemplate}.
	 */
	interface StaticPadTemplate {}
	class StaticPadTemplate {
		public constructor(options?: Partial<StaticPadTemplateInitOptions>);
		/**
		 * the name of the template
		 */
		public name_template: string;
		/**
		 * the direction of the template
		 */
		public direction: PadDirection;
		/**
		 * the presence of the template
		 */
		public presence: PadPresence;
		/**
		 * the caps of the template.
		 */
		public static_caps: StaticCaps;
		/**
		 * Converts a {@link StaticPadTemplate} into a #GstPadTemplate.
		 * @returns a new {@link PadTemplate}.
		 */
		public get(): PadTemplate | null;
		/**
		 * Gets the capabilities of the static pad template.
		 * @returns the {@link Caps} of the static pad template.
		 * Unref after usage. Since the core holds an additional
		 * ref to the returned caps, use {@link Gst.Caps.make_writable}
		 * on the returned caps to modify it.
		 */
		public get_caps(): Caps;
	}

	export interface StructureInitOptions {}
	/**
	 * A {@link Structure} is a collection of key/value pairs. The keys are expressed as
	 * GQuarks and the values can be of any GType.
	 * 
	 * In addition to the key/value pairs, a #GstStructure also has a name. The name
	 * starts with a letter and can be filled by letters, numbers and any of
	 * "/-_.:".
	 * 
	 * #GstStructure is used by various GStreamer subsystems to store information in
	 * a flexible and extensible way. A #GstStructure does not have a refcount
	 * because it usually is part of a higher level object such as #GstCaps,
	 * #GstMessage, #GstEvent, #GstQuery. It provides a means to enforce mutability
	 * using the refcount of the parent with the {@link Gst.Structure.set_parent_refcount}
	 * method.
	 * 
	 * A #GstStructure can be created with gst_structure_new_empty() or
	 * gst_structure_new(), which both take a name and an optional set of key/value
	 * pairs along with the types of the values.
	 * 
	 * Field values can be changed with gst_structure_set_value() or
	 * gst_structure_set().
	 * 
	 * Field values can be retrieved with gst_structure_get_value() or the more
	 * convenient gst_structure_get_*() functions.
	 * 
	 * Fields can be removed with gst_structure_remove_field() or
	 * gst_structure_remove_fields().
	 * 
	 * Strings in structures must be ASCII or UTF-8 encoded. Other encodings are not
	 * allowed. Strings may be %NULL however.
	 * 
	 * ## The serialization format
	 * 
	 * GstStructure serialization format serialize the GstStructure name,
	 * keys/GType/values in a comma separated list with the structure name as first
	 * field without value followed by separated key/value pairs in the form
	 * `key=value`, for example:
	 * 
	 * ```
	 * a-structure, key=value
	 * ````
	 * 
	 * The values type will be inferred if not explicitly specified with the
	 * `(GTypeName)value` syntax, for example the following struct will have one
	 * field called 'is-string' which has the string 'true' as a value:
	 * 
	 * ```
	 * a-struct, field-is-string=(string)true, field-is-boolean=true
	 * ```
	 * 
	 * *Note*: without specifying `(string), `field-is-string` type would have been
	 * inferred as boolean.
	 * 
	 * *Note*: we specified `(string)` as a type even if `gchararray` is the actual
	 * GType name as for convenience some well known types have been aliased or
	 * abbreviated.
	 * 
	 * To avoid specifying the type, you can give some hints to the "type system".
	 * For example to specify a value as a double, you should add a decimal (ie. `1`
	 * is an `int` while `1.0` is a `double`).
	 * 
	 * *Note*: when a structure is serialized with #gst_structure_to_string, all
	 * values are explicitly typed.
	 * 
	 * Some types have special delimiters:
	 * 
	 * - [GstValueArray](GST_TYPE_ARRAY) are inside curly brackets (`{` and `}`).
	 *   For example `a-structure, array={1, 2, 3}`
	 * - Ranges are inside brackets (`[` and `]`). For example `a-structure,
	 *   range=[1, 6, 2]` 1 being the min value, 6 the maximum and 2 the step. To
	 *   specify a #GST_TYPE_INT64_RANGE you need to explicitly specify it like:
	 *   `a-structure, a-int64-range=(gint64) [1, 5]`
	 * - [GstValueList](GST_TYPE_LIST) are inside "less and greater than" (`<` and
	 *   `>`). For example `a-structure, list=<1, 2, 3>
	 * 
	 * Structures are delimited either by a null character `\0` or a semicolumn `;`
	 * the latter allowing to store multiple structures in the same string (see
	 * #GstCaps).
	 * 
	 * Quotes are used as "default" delimiters and can be used around any types that
	 * don't use other delimiters (for example `a-struct, i=(int)"1"`). They are use
	 * to allow adding spaces or special characters (such as delimiters,
	 * semicolumns, etc..) inside strings and you can use backslashes `\` to escape
	 * characters inside them, for example:
	 * 
	 * ```
	 * a-struct, special="\"{[(;)]}\" can be used inside quotes"
	 * ```
	 * 
	 * They also allow for nested structure, such as:
	 * 
	 * ```
	 * a-struct, nested=(GstStructure)"nested-struct, nested=true"
	 * ```
	 * 
	 * > *Note*: Be aware that the current #GstCaps / #GstStructure serialization
	 * > into string has limited support for nested #GstCaps / #GstStructure fields.
	 * > It can only support one level of nesting. Using more levels will lead to
	 * > unexpected behavior when using serialization features, such as
	 * > gst_caps_to_string() or gst_value_serialize() and their counterparts.
	 */
	interface Structure {}
	class Structure {
		public constructor(options?: Partial<StructureInitOptions>);
		/**
		 * Creates a {@link Structure} from a string representation.
		 * If end is not %NULL, a pointer to the place inside the given string
		 * where parsing ended will be returned.
		 * 
		 * Free-function: gst_structure_free
		 * @param string a string representation of a {@link Structure}.
		 * @returns a new {@link Structure} or %NULL
		 *     when the string could not be parsed. Free with
		 *     {@link Gst.Structure.free} after use.
		 * 
		 * pointer to store the end of the string in.
		 */
		public static from_string(string: string): [ Structure | null, string | null ];
		/**
		 * Creates a new {@link Structure} with the given name.  Parses the
		 * list of variable arguments and sets fields to the values listed.
		 * Variable arguments should be passed as field name, field type,
		 * and value.  Last variable argument should be %NULL.
		 * 
		 * Free-function: gst_structure_free
		 * @param name name of new structure
		 * @param firstfield name of first field to set
		 * @returns a new {@link Structure}
		 */
		public static new(name: string, firstfield: string): Structure;
		/**
		 * Creates a new, empty {@link Structure} with the given #name.
		 * 
		 * See {@link Gst.Structure.set_name} for constraints on the #name parameter.
		 * 
		 * Free-function: gst_structure_free
		 * @param name name of new structure
		 * @returns a new, empty {@link Structure}
		 */
		public static new_empty(name: string): Structure;
		/**
		 * Creates a {@link Structure} from a string representation.
		 * If end is not %NULL, a pointer to the place inside the given string
		 * where parsing ended will be returned.
		 * 
		 * The current implementation of serialization will lead to unexpected results
		 * when there are nested #GstCaps / #GstStructure deeper than one level.
		 * 
		 * Free-function: gst_structure_free
		 * @param string a string representation of a {@link Structure}
		 * @returns a new {@link Structure} or %NULL
		 *     when the string could not be parsed. Free with
		 *     {@link Gst.Structure.free} after use.
		 */
		public static new_from_string(string: string): Structure | null;
		/**
		 * Creates a new {@link Structure} with the given name as a GQuark, followed by
		 * fieldname quark, GType, argument(s) "triplets" in the same format as
		 * {@link Gst.Structure.id_set}. Basically a convenience wrapper around
		 * gst_structure_new_id_empty() and gst_structure_id_set().
		 * 
		 * The last variable argument must be %NULL (or 0).
		 * 
		 * Free-function: gst_structure_free
		 * @param name_quark name of new structure
		 * @param field_quark the GQuark for the name of the field to set
		 * @returns a new {@link Structure}
		 */
		public static new_id(name_quark: GLib.Quark, field_quark: GLib.Quark): Structure;
		/**
		 * Creates a new, empty {@link Structure} with the given name as a GQuark.
		 * 
		 * Free-function: gst_structure_free
		 * @param quark name of new structure
		 * @returns a new, empty {@link Structure}
		 */
		public static new_id_empty(quark: GLib.Quark): Structure;
		/**
		 * Creates a new {@link Structure} with the given #name.  Structure fields
		 * are set according to the varargs in a manner similar to
		 * {@link Gst.Structure.new}.
		 * 
		 * See gst_structure_set_name() for constraints on the #name parameter.
		 * 
		 * Free-function: gst_structure_free
		 * @param name name of new structure
		 * @param firstfield name of first field to set
		 * @param varargs variable argument list
		 * @returns a new {@link Structure}
		 */
		public static new_valist(name: string, firstfield: string, varargs: any[]): Structure;
		/**
		 * Atomically modifies a pointer to point to a new structure.
		 * The {@link Structure} #oldstr_ptr is pointing to is freed and
		 * #newstr is taken ownership over.
		 * 
		 * Either #newstr and the value pointed to by #oldstr_ptr may be %NULL.
		 * 
		 * It is a programming error if both #newstr and the value pointed to by
		 * #oldstr_ptr refer to the same, non-%NULL structure.
		 * @param newstr a new {@link Structure}
		 * @returns %TRUE if #newstr was different from #oldstr_ptr
		 */
		public static take(newstr?: Structure | null): boolean;
		/**
		 * the GType of a structure
		 */
		public type: GObject.Type;
		public readonly name: GLib.Quark;
		/**
		 * Tries intersecting #struct1 and #struct2 and reports whether the result
		 * would not be empty.
		 * @param struct2 a {@link Structure}
		 * @returns %TRUE if intersection would not be empty
		 */
		public can_intersect(struct2: Structure): boolean;
		/**
		 * Duplicates a {@link Structure} and all its fields and values.
		 * 
		 * Free-function: gst_structure_free
		 * @returns a new {@link Structure}.
		 */
		public copy(): Structure;
		/**
		 * Calls the provided function once for each field in the {@link Structure}. In
		 * contrast to {@link Gst.Structure.foreach}, the function may modify the fields.
		 * In contrast to gst_structure_map_in_place(), the field is removed from
		 * the structure if %FALSE is returned from the function.
		 * The structure must be mutable.
		 * @param func a function to call for each field
		 */
		public filter_and_map_in_place(func: StructureFilterMapFunc): void;
		/**
		 * Fixate all values in #structure using {@link Gst.value.fixate}.
		 * #structure will be modified in-place and should be writable.
		 */
		public fixate(): void;
		/**
		 * Fixates a {@link Structure} by changing the given field with its fixated value.
		 * @param field_name a field in #structure
		 * @returns %TRUE if the structure field could be fixated
		 */
		public fixate_field(field_name: string): boolean;
		/**
		 * Fixates a {@link Structure} by changing the given #field_name field to the given
		 * #target boolean if that field is not fixed yet.
		 * @param field_name a field in #structure
		 * @param target the target value of the fixation
		 * @returns %TRUE if the structure could be fixated
		 */
		public fixate_field_boolean(field_name: string, target: boolean): boolean;
		/**
		 * Fixates a {@link Structure} by changing the given field to the nearest
		 * double to #target that is a subset of the existing field.
		 * @param field_name a field in #structure
		 * @param target the target value of the fixation
		 * @returns %TRUE if the structure could be fixated
		 */
		public fixate_field_nearest_double(field_name: string, target: number): boolean;
		/**
		 * Fixates a {@link Structure} by changing the given field to the nearest
		 * fraction to #target_numerator/#target_denominator that is a subset
		 * of the existing field.
		 * @param field_name a field in #structure
		 * @param target_numerator The numerator of the target value of the fixation
		 * @param target_denominator The denominator of the target value of the fixation
		 * @returns %TRUE if the structure could be fixated
		 */
		public fixate_field_nearest_fraction(field_name: string, target_numerator: number, target_denominator: number): boolean;
		/**
		 * Fixates a {@link Structure} by changing the given field to the nearest
		 * integer to #target that is a subset of the existing field.
		 * @param field_name a field in #structure
		 * @param target the target value of the fixation
		 * @returns %TRUE if the structure could be fixated
		 */
		public fixate_field_nearest_int(field_name: string, target: number): boolean;
		/**
		 * Fixates a {@link Structure} by changing the given #field_name field to the given
		 * #target string if that field is not fixed yet.
		 * @param field_name a field in #structure
		 * @param target the target value of the fixation
		 * @returns %TRUE if the structure could be fixated
		 */
		public fixate_field_string(field_name: string, target: string): boolean;
		/**
		 * Calls the provided function once for each field in the {@link Structure}. The
		 * function must not modify the fields. Also see {@link Gst.Structure.map_in_place}
		 * and gst_structure_filter_and_map_in_place().
		 * @param func a function to call for each field
		 * @returns %TRUE if the supplied function returns %TRUE For each of the fields,
		 * %FALSE otherwise.
		 */
		public foreach(func: StructureForeachFunc): boolean;
		/**
		 * Frees a {@link Structure} and all its fields and values. The structure must not
		 * have a parent when this function is called.
		 */
		public free(): void;
		/**
		 * Parses the variable arguments and reads fields from #structure accordingly.
		 * Variable arguments should be in the form field name, field type
		 * (as a GType), pointer(s) to a variable(s) to hold the return value(s).
		 * The last variable argument should be %NULL.
		 * 
		 * For refcounted (mini)objects you will receive a new reference which
		 * you must release with a suitable {@link .unref\} when no longer needed. For
		 * strings and boxed types you will receive a copy which you will need to
		 * release with either g_free() or the suitable function for the boxed type.
		 * @param first_fieldname the name of the first field to read
		 * @returns %FALSE if there was a problem reading any of the fields (e.g.
		 *     because the field requested did not exist, or was of a type other
		 *     than the type specified), otherwise %TRUE.
		 */
		public get(first_fieldname: string): boolean;
		/**
		 * This is useful in language bindings where unknown #GValue types are not
		 * supported. This function will convert the %GST_TYPE_ARRAY into a newly
		 * allocated #GValueArray and return it through #array. Be aware that this is
		 * slower then getting the #GValue directly.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a %GST_TYPE_ARRAY,
		 * this function returns %FALSE.
		 * 
		 * a pointer to a #GValueArray
		 */
		public get_array(fieldname: string): [ boolean, GObject.ValueArray ];
		/**
		 * Sets the boolean pointed to by #value corresponding to the value of the
		 * given field.  Caller is responsible for making sure the field exists
		 * and has the correct type.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a boolean, this
		 * function returns %FALSE.
		 * 
		 * a pointer to a #gboolean to set
		 */
		public get_boolean(fieldname: string): [ boolean, boolean ];
		/**
		 * Sets the clock time pointed to by #value corresponding to the clock time
		 * of the given field.  Caller is responsible for making sure the field exists
		 * and has the correct type.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a {@link ClockTime}, this
		 * function returns %FALSE.
		 * 
		 * a pointer to a #GstClockTime to set
		 */
		public get_clock_time(fieldname: string): [ boolean, ClockTime ];
		/**
		 * Sets the date pointed to by #value corresponding to the date of the
		 * given field.  Caller is responsible for making sure the field exists
		 * and has the correct type.
		 * 
		 * On success #value will point to a newly-allocated copy of the date which
		 * should be freed with {@link G.date_free} when no longer needed (note: this is
		 * inconsistent with e.g. gst_structure_get_string() which doesn't return a
		 * copy of the string).
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a data, this function
		 * returns %FALSE.
		 * 
		 * a pointer to a #GDate to set
		 */
		public get_date(fieldname: string): [ boolean, GLib.Date ];
		/**
		 * Sets the datetime pointed to by #value corresponding to the datetime of the
		 * given field. Caller is responsible for making sure the field exists
		 * and has the correct type.
		 * 
		 * On success #value will point to a reference of the datetime which
		 * should be unreffed with {@link Gst.DateTime.unref} when no longer needed
		 * (note: this is inconsistent with e.g. gst_structure_get_string()
		 * which doesn't return a copy of the string).
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a data, this function
		 * returns %FALSE.
		 * 
		 * a pointer to a {@link DateTime} to set
		 */
		public get_date_time(fieldname: string): [ boolean, DateTime ];
		/**
		 * Sets the double pointed to by #value corresponding to the value of the
		 * given field.  Caller is responsible for making sure the field exists
		 * and has the correct type.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a double, this
		 * function returns %FALSE.
		 * 
		 * a pointer to a gdouble to set
		 */
		public get_double(fieldname: string): [ boolean, number ];
		/**
		 * Sets the int pointed to by #value corresponding to the value of the
		 * given field.  Caller is responsible for making sure the field exists,
		 * has the correct type and that the enumtype is correct.
		 * @param fieldname the name of a field
		 * @param enumtype the enum type of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain an enum of the given
		 * type, this function returns %FALSE.
		 * 
		 * a pointer to an int to set
		 */
		public get_enum(fieldname: string, enumtype: GObject.Type): [ boolean, number ];
		/**
		 * Finds the field with the given name, and returns the type of the
		 * value it contains.  If the field is not found, G_TYPE_INVALID is
		 * returned.
		 * @param fieldname the name of the field
		 * @returns the #GValue of the field
		 */
		public get_field_type(fieldname: string): GObject.Type;
		/**
		 * Read the GstFlagSet flags and mask out of the structure into the
		 * provided pointers.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the values could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a GstFlagSet, this
		 * function returns %FALSE.
		 * 
		 * a pointer to a guint for the flags field
		 * 
		 * a pointer to a guint for the mask field
		 */
		public get_flagset(fieldname: string): [ boolean, number | null, number | null ];
		/**
		 * Sets the integers pointed to by #value_numerator and #value_denominator
		 * corresponding to the value of the given field.  Caller is responsible
		 * for making sure the field exists and has the correct type.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the values could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a GstFraction, this
		 * function returns %FALSE.
		 * 
		 * a pointer to an int to set
		 * 
		 * a pointer to an int to set
		 */
		public get_fraction(fieldname: string): [ boolean, number, number ];
		/**
		 * Sets the int pointed to by #value corresponding to the value of the
		 * given field.  Caller is responsible for making sure the field exists
		 * and has the correct type.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain an int, this function
		 * returns %FALSE.
		 * 
		 * a pointer to an int to set
		 */
		public get_int(fieldname: string): [ boolean, number ];
		/**
		 * Sets the #gint64 pointed to by #value corresponding to the value of the
		 * given field. Caller is responsible for making sure the field exists
		 * and has the correct type.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a #gint64, this function
		 * returns %FALSE.
		 * 
		 * a pointer to a #gint64 to set
		 */
		public get_int64(fieldname: string): [ boolean, number ];
		/**
		 * This is useful in language bindings where unknown #GValue types are not
		 * supported. This function will convert the %GST_TYPE_LIST into a newly
		 * allocated GValueArray and return it through #array. Be aware that this is
		 * slower then getting the #GValue directly.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a %GST_TYPE_LIST, this
		 * function returns %FALSE.
		 * 
		 * a pointer to a #GValueArray
		 */
		public get_list(fieldname: string): [ boolean, GObject.ValueArray ];
		/**
		 * Get the name of #structure as a string.
		 * @returns the name of the structure.
		 */
		public get_name(): string;
		/**
		 * Get the name of #structure as a GQuark.
		 * @returns the quark representing the name of the structure.
		 */
		public get_name_id(): GLib.Quark;
		/**
		 * Finds the field corresponding to #fieldname, and returns the string
		 * contained in the field's value.  Caller is responsible for making
		 * sure the field exists and has the correct type.
		 * 
		 * The string should not be modified, and remains valid until the next
		 * call to a {@link Gst.Structure.*} function with the given structure.
		 * @param fieldname the name of a field
		 * @returns a pointer to the string or %NULL when the
		 * field did not exist or did not contain a string.
		 */
		public get_string(fieldname: string): string | null;
		/**
		 * Sets the uint pointed to by #value corresponding to the value of the
		 * given field.  Caller is responsible for making sure the field exists
		 * and has the correct type.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a uint, this function
		 * returns %FALSE.
		 * 
		 * a pointer to a uint to set
		 */
		public get_uint(fieldname: string): [ boolean, number ];
		/**
		 * Sets the #guint64 pointed to by #value corresponding to the value of the
		 * given field. Caller is responsible for making sure the field exists
		 * and has the correct type.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the value could be set correctly. If there was no field
		 * with #fieldname or the existing field did not contain a #guint64, this function
		 * returns %FALSE.
		 * 
		 * a pointer to a #guint64 to set
		 */
		public get_uint64(fieldname: string): [ boolean, number ];
		/**
		 * Parses the variable arguments and reads fields from #structure accordingly.
		 * valist-variant of {@link Gst.Structure.get}. Look at the documentation of
		 * gst_structure_get() for more details.
		 * @param first_fieldname the name of the first field to read
		 * @param args variable arguments
		 * @returns %TRUE, or %FALSE if there was a problem reading any of the fields
		 */
		public get_valist(first_fieldname: string, args: any[]): boolean;
		/**
		 * Get the value of the field with name #fieldname.
		 * @param fieldname the name of the field to get
		 * @returns the #GValue corresponding to the field with the given
		 * name.
		 */
		public get_value(fieldname: string): GObject.Value | null;
		/**
		 * Check if #structure contains a field named #fieldname.
		 * @param fieldname the name of a field
		 * @returns %TRUE if the structure contains a field with the given name
		 */
		public has_field(fieldname: string): boolean;
		/**
		 * Check if #structure contains a field named #fieldname and with GType #type.
		 * @param fieldname the name of a field
		 * @param type the type of a value
		 * @returns %TRUE if the structure contains a field with the given name and type
		 */
		public has_field_typed(fieldname: string, type: GObject.Type): boolean;
		/**
		 * Checks if the structure has the given name
		 * @param name structure name to check for
		 * @returns %TRUE if #name matches the name of the structure.
		 */
		public has_name(name: string): boolean;
		/**
		 * Parses the variable arguments and reads fields from #structure accordingly.
		 * Variable arguments should be in the form field id quark, field type
		 * (as a GType), pointer(s) to a variable(s) to hold the return value(s).
		 * The last variable argument should be %NULL (technically it should be a
		 * 0 quark, but we require %NULL so compilers that support it can check for
		 * the %NULL terminator and warn if it's not there).
		 * 
		 * This function is just like {@link Gst.Structure.get} only that it is slightly
		 * more efficient since it saves the string-to-quark lookup in the global
		 * quark hashtable.
		 * 
		 * For refcounted (mini)objects you will receive a new reference which
		 * you must release with a suitable _unref\() when no longer needed. For
		 * strings and boxed types you will receive a copy which you will need to
		 * release with either g_free() or the suitable function for the boxed type.
		 * @param first_field_id the quark of the first field to read
		 * @returns %FALSE if there was a problem reading any of the fields (e.g.
		 *     because the field requested did not exist, or was of a type other
		 *     than the type specified), otherwise %TRUE.
		 */
		public id_get(first_field_id: GLib.Quark): boolean;
		/**
		 * Parses the variable arguments and reads fields from #structure accordingly.
		 * valist-variant of {@link Gst.Structure.id_get}. Look at the documentation of
		 * gst_structure_id_get() for more details.
		 * @param first_field_id the quark of the first field to read
		 * @param args variable arguments
		 * @returns %TRUE, or %FALSE if there was a problem reading any of the fields
		 */
		public id_get_valist(first_field_id: GLib.Quark, args: any[]): boolean;
		/**
		 * Get the value of the field with GQuark #field.
		 * @param field the #GQuark of the field to get
		 * @returns the #GValue corresponding to the field with the given
		 * name identifier.
		 */
		public id_get_value(field: GLib.Quark): GObject.Value | null;
		/**
		 * Check if #structure contains a field named #field.
		 * @param field #GQuark of the field name
		 * @returns %TRUE if the structure contains a field with the given name
		 */
		public id_has_field(field: GLib.Quark): boolean;
		/**
		 * Check if #structure contains a field named #field and with GType #type.
		 * @param field #GQuark of the field name
		 * @param type the type of a value
		 * @returns %TRUE if the structure contains a field with the given name and type
		 */
		public id_has_field_typed(field: GLib.Quark, type: GObject.Type): boolean;
		/**
		 * Identical to gst_structure_set, except that field names are
		 * passed using the GQuark for the field name. This allows more efficient
		 * setting of the structure if the caller already knows the associated
		 * quark values.
		 * The last variable argument must be %NULL.
		 * @param fieldname the GQuark for the name of the field to set
		 */
		public id_set(fieldname: GLib.Quark): void;
		/**
		 * va_list form of {@link Gst.Structure.id_set}.
		 * @param fieldname the name of the field to set
		 * @param varargs variable arguments
		 */
		public id_set_valist(fieldname: GLib.Quark, varargs: any[]): void;
		/**
		 * Sets the field with the given GQuark #field to #value.  If the field
		 * does not exist, it is created.  If the field exists, the previous
		 * value is replaced and freed.
		 * @param field a #GQuark representing a field
		 * @param value the new value of the field
		 */
		public id_set_value(field: GLib.Quark, value: GObject.Value): void;
		/**
		 * Sets the field with the given GQuark #field to #value.  If the field
		 * does not exist, it is created.  If the field exists, the previous
		 * value is replaced and freed.
		 * @param field a #GQuark representing a field
		 * @param value the new value of the field
		 */
		public id_take_value(field: GLib.Quark, value: GObject.Value): void;
		/**
		 * Intersects #struct1 and #struct2 and returns the intersection.
		 * @param struct2 a {@link Structure}
		 * @returns Intersection of #struct1 and #struct2
		 */
		public intersect(struct2: Structure): Structure | null;
		/**
		 * Tests if the two {@link Structure} are equal.
		 * @param structure2 a {@link Structure}.
		 * @returns %TRUE if the two structures have the same name and field.
		 */
		public is_equal(structure2: Structure): boolean;
		/**
		 * Checks if #subset is a subset of #superset, i.e. has the same
		 * structure name and for all fields that are existing in #superset,
		 * #subset has a value that is a subset of the value in #superset.
		 * @param superset a potentially greater {@link Structure}
		 * @returns %TRUE if #subset is a subset of #superset
		 */
		public is_subset(superset: Structure): boolean;
		/**
		 * Calls the provided function once for each field in the {@link Structure}. In
		 * contrast to {@link Gst.Structure.foreach}, the function may modify but not delete the
		 * fields. The structure must be mutable.
		 * @param func a function to call for each field
		 * @returns %TRUE if the supplied function returns %TRUE For each of the fields,
		 * %FALSE otherwise.
		 */
		public map_in_place(func: StructureMapFunc): boolean;
		/**
		 * Get the number of fields in the structure.
		 * @returns the number of fields in the structure
		 */
		public n_fields(): number;
		/**
		 * Get the name of the given field number, counting from 0 onwards.
		 * @param index the index to get the name of
		 * @returns the name of the given field number
		 */
		public nth_field_name(index: number): string;
		/**
		 * Removes all fields in a GstStructure.
		 */
		public remove_all_fields(): void;
		/**
		 * Removes the field with the given name.  If the field with the given
		 * name does not exist, the structure is unchanged.
		 * @param fieldname the name of the field to remove
		 */
		public remove_field(fieldname: string): void;
		/**
		 * Removes the fields with the given names. If a field does not exist, the
		 * argument is ignored.
		 * @param fieldname the name of the field to remove
		 */
		public remove_fields(fieldname: string): void;
		/**
		 * va_list form of {@link Gst.Structure.remove_fields}.
		 * @param fieldname the name of the field to remove
		 * @param varargs %NULL-terminated list of more fieldnames to remove
		 */
		public remove_fields_valist(fieldname: string, varargs: any[]): void;
		/**
		 * Parses the variable arguments and sets fields accordingly. Fields that
		 * weren't already part of the structure are added as needed.
		 * Variable arguments should be in the form field name, field type
		 * (as a GType), value(s).  The last variable argument should be %NULL.
		 * @param fieldname the name of the field to set
		 */
		public set(fieldname: string): void;
		/**
		 * This is useful in language bindings where unknown GValue types are not
		 * supported. This function will convert a #array to %GST_TYPE_ARRAY and set
		 * the field specified by #fieldname.  Be aware that this is slower then using
		 * %GST_TYPE_ARRAY in a #GValue directly.
		 * @param fieldname the name of a field
		 * @param array a pointer to a #GValueArray
		 */
		public set_array(fieldname: string, array: GObject.ValueArray): void;
		/**
		 * This is useful in language bindings where unknown GValue types are not
		 * supported. This function will convert a #array to %GST_TYPE_LIST and set
		 * the field specified by #fieldname. Be aware that this is slower then using
		 * %GST_TYPE_LIST in a #GValue directly.
		 * @param fieldname the name of a field
		 * @param array a pointer to a #GValueArray
		 */
		public set_list(fieldname: string, array: GObject.ValueArray): void;
		/**
		 * Sets the name of the structure to the given #name.  The string
		 * provided is copied before being used. It must not be empty, start with a
		 * letter and can be followed by letters, numbers and any of "/-_.:".
		 * @param name the new name of the structure
		 */
		public set_name(name: string): void;
		/**
		 * Sets the parent_refcount field of {@link Structure}. This field is used to
		 * determine whether a structure is mutable or not. This function should only be
		 * called by code implementing parent objects of #GstStructure, as described in
		 * the MT Refcounting section of the design documents.
		 * @param refcount a pointer to the parent's refcount
		 * @returns %TRUE if the parent refcount could be set.
		 */
		public set_parent_refcount(refcount: number): boolean;
		/**
		 * va_list form of {@link Gst.Structure.set}.
		 * @param fieldname the name of the field to set
		 * @param varargs variable arguments
		 */
		public set_valist(fieldname: string, varargs: any[]): void;
		/**
		 * Sets the field with the given name #field to #value.  If the field
		 * does not exist, it is created.  If the field exists, the previous
		 * value is replaced and freed.
		 * @param fieldname the name of the field to set
		 * @param value the new value of the field
		 */
		public set_value(fieldname: string, value: GObject.Value): void;
		/**
		 * Sets the field with the given name #field to #value.  If the field
		 * does not exist, it is created.  If the field exists, the previous
		 * value is replaced and freed. The function will take ownership of #value.
		 * @param fieldname the name of the field to set
		 * @param value the new value of the field
		 */
		public take_value(fieldname: string, value: GObject.Value): void;
		/**
		 * Converts #structure to a human-readable string representation.
		 * 
		 * For debugging purposes its easier to do something like this:
		 * |[<!-- language="C" -->
		 * GST_LOG ("structure is %" GST_PTR_FORMAT, structure);
		 * ]|
		 * This prints the structure in human readable form.
		 * 
		 * The current implementation of serialization will lead to unexpected results
		 * when there are nested {@link Caps} / #GstStructure deeper than one level.
		 * 
		 * Free-function: g_free
		 * @returns a pointer to string allocated by {@link G.malloc}.
		 *     g_free() after usage.
		 */
		public to_string(): string;
	}

	export interface TagListInitOptions {}
	/**
	 * List of tags and values used to describe media metadata.
	 * 
	 * Strings in structures must be ASCII or UTF-8 encoded. Other encodings are
	 * not allowed. Strings must not be empty or %NULL.
	 */
	interface TagList {}
	class TagList {
		public constructor(options?: Partial<TagListInitOptions>);
		/**
		 * Creates a new taglist and appends the values for the given tags. It expects
		 * tag-value pairs like {@link Gst.TagList.add}, and a %NULL terminator after the
		 * last pair. The type of the values is implicit and is documented in the API
		 * reference, but can also be queried at runtime with gst_tag_get_type(). It
		 * is an error to pass a value of a type not matching the tag type into this
		 * function. The tag list will make copies of any arguments passed
		 * (e.g. strings, buffers).
		 * 
		 * After creation you might also want to set a {@link TagScope} on the returned
		 * taglist to signal if the contained tags are global or stream tags. By
		 * default stream scope is assumes. See gst_tag_list_set_scope().
		 * 
		 * Free-function: gst_tag_list_unref
		 * @param tag tag
		 * @returns a new {@link TagList}. Free with {@link Gst.TagList.unref}
		 *     when no longer needed.
		 */
		public static new(tag: string): TagList;
		/**
		 * Creates a new empty GstTagList.
		 * 
		 * Free-function: gst_tag_list_unref
		 * @returns An empty tag list
		 */
		public static new_empty(): TagList;
		/**
		 * Deserializes a tag list.
		 * @param str a string created with {@link Gst.TagList.to_string}
		 * @returns a new {@link TagList}, or %NULL in case of an
		 * error.
		 */
		public static new_from_string(str: string): TagList | null;
		/**
		 * Just like {@link Gst.TagList.new}, only that it takes a va_list argument.
		 * Useful mostly for language bindings.
		 * 
		 * Free-function: gst_tag_list_unref
		 * @param var_args tag / value pairs to set
		 * @returns a new {@link TagList}. Free with {@link Gst.TagList.unref}
		 *     when no longer needed.
		 */
		public static new_valist(var_args: any[]): TagList;
		/**
		 * Copies the contents for the given tag into the value,
		 * merging multiple values into one if multiple values are associated
		 * with the tag.
		 * You must {@link G.value_unset} the value after use.
		 * @param list list to get the tag from
		 * @param tag tag to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *          given list.
		 * 
		 * uninitialized #GValue to copy into
		 */
		public static copy_value(list: TagList, tag: string): [ boolean, GObject.Value ];
		/**
		 * the parent type
		 */
		public mini_object: MiniObject;
		/**
		 * Sets the values for the given tags using the specified mode.
		 * @param mode the mode to use
		 * @param tag tag
		 */
		public add(mode: TagMergeMode, tag: string): void;
		/**
		 * Sets the values for the given tags using the specified mode.
		 * @param mode the mode to use
		 * @param tag tag
		 * @param var_args tag / value pairs to set
		 */
		public add_valist(mode: TagMergeMode, tag: string, var_args: any[]): void;
		/**
		 * Sets the GValues for the given tags using the specified mode.
		 * @param mode the mode to use
		 * @param tag tag
		 * @param var_args tag / GValue pairs to set
		 */
		public add_valist_values(mode: TagMergeMode, tag: string, var_args: any[]): void;
		/**
		 * Sets the GValue for a given tag using the specified mode.
		 * @param mode the mode to use
		 * @param tag tag
		 * @param value GValue for this tag
		 */
		public add_value(mode: TagMergeMode, tag: string, value: GObject.Value): void;
		/**
		 * Sets the GValues for the given tags using the specified mode.
		 * @param mode the mode to use
		 * @param tag tag
		 */
		public add_values(mode: TagMergeMode, tag: string): void;
		/**
		 * Creates a new {@link TagList} as a copy of the old #taglist. The new taglist
		 * will have a refcount of 1, owned by the caller, and will be writable as
		 * a result.
		 * 
		 * Note that this function is the semantic equivalent of a {@link Gst.TagList.ref}
		 * followed by a gst_tag_list_make_writable(). If you only want to hold on to a
		 * reference to the data, you should use gst_tag_list_ref().
		 * 
		 * When you are finished with the taglist, call gst_tag_list_unref() on it.
		 * @returns the new {@link TagList}
		 */
		public copy(): TagList;
		/**
		 * Calls the given function for each tag inside the tag list. Note that if there
		 * is no tag, the function won't be called at all.
		 * @param func function to be called for each tag
		 */
		public foreach(func: TagForeachFunc): void;
		/**
		 * Copies the contents for the given tag into the value, merging multiple values
		 * into one if multiple values are associated with the tag.
		 * @param tag tag to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_boolean(tag: string): [ boolean, boolean ];
		/**
		 * Gets the value that is at the given index for the given tag in the given
		 * list.
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_boolean_index(tag: string, index: number): [ boolean, boolean ];
		/**
		 * Copies the first date for the given tag in the taglist into the variable
		 * pointed to by #value. Free the date with {@link G.date_free} when it is no longer
		 * needed.
		 * 
		 * Free-function: g_date_free
		 * @param tag tag to read out
		 * @returns %TRUE, if a date was copied, %FALSE if the tag didn't exist in the
		 *              given list or if it was %NULL.
		 * 
		 * address of a GDate pointer
		 *     variable to store the result into
		 */
		public get_date(tag: string): [ boolean, GLib.Date ];
		/**
		 * Gets the date that is at the given index for the given tag in the given
		 * list and copies it into the variable pointed to by #value. Free the date
		 * with {@link G.date_free} when it is no longer needed.
		 * 
		 * Free-function: g_date_free
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list or if it was %NULL.
		 * 
		 * location for the result
		 */
		public get_date_index(tag: string, index: number): [ boolean, GLib.Date ];
		/**
		 * Copies the first datetime for the given tag in the taglist into the variable
		 * pointed to by #value. Unref the date with {@link Gst.DateTime.unref} when
		 * it is no longer needed.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param tag tag to read out
		 * @returns %TRUE, if a datetime was copied, %FALSE if the tag didn't exist in
		 *              the given list or if it was %NULL.
		 * 
		 * address of a {@link DateTime}
		 *     pointer variable to store the result into
		 */
		public get_date_time(tag: string): [ boolean, DateTime ];
		/**
		 * Gets the datetime that is at the given index for the given tag in the given
		 * list and copies it into the variable pointed to by #value. Unref the datetime
		 * with {@link Gst.DateTime.unref} when it is no longer needed.
		 * 
		 * Free-function: gst_date_time_unref
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list or if it was %NULL.
		 * 
		 * location for the result
		 */
		public get_date_time_index(tag: string, index: number): [ boolean, DateTime ];
		/**
		 * Copies the contents for the given tag into the value, merging multiple values
		 * into one if multiple values are associated with the tag.
		 * @param tag tag to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_double(tag: string): [ boolean, number ];
		/**
		 * Gets the value that is at the given index for the given tag in the given
		 * list.
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_double_index(tag: string, index: number): [ boolean, number ];
		/**
		 * Copies the contents for the given tag into the value, merging multiple values
		 * into one if multiple values are associated with the tag.
		 * @param tag tag to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_float(tag: string): [ boolean, number ];
		/**
		 * Gets the value that is at the given index for the given tag in the given
		 * list.
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_float_index(tag: string, index: number): [ boolean, number ];
		/**
		 * Copies the contents for the given tag into the value, merging multiple values
		 * into one if multiple values are associated with the tag.
		 * @param tag tag to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_int(tag: string): [ boolean, number ];
		/**
		 * Copies the contents for the given tag into the value, merging multiple values
		 * into one if multiple values are associated with the tag.
		 * @param tag tag to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_int64(tag: string): [ boolean, number ];
		/**
		 * Gets the value that is at the given index for the given tag in the given
		 * list.
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_int64_index(tag: string, index: number): [ boolean, number ];
		/**
		 * Gets the value that is at the given index for the given tag in the given
		 * list.
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_int_index(tag: string, index: number): [ boolean, number ];
		/**
		 * Copies the contents for the given tag into the value, merging multiple values
		 * into one if multiple values are associated with the tag.
		 * @param tag tag to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_pointer(tag: string): [ boolean, any | null ];
		/**
		 * Gets the value that is at the given index for the given tag in the given
		 * list.
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_pointer_index(tag: string, index: number): [ boolean, any | null ];
		/**
		 * Copies the first sample for the given tag in the taglist into the variable
		 * pointed to by #sample. Free the sample with {@link Gst.Sample.unref} when it is
		 * no longer needed. You can retrieve the buffer from the sample using
		 * gst_sample_get_buffer() and the associated caps (if any) with
		 * gst_sample_get_caps().
		 * 
		 * Free-function: gst_sample_unref
		 * @param tag tag to read out
		 * @returns %TRUE, if a sample was returned, %FALSE if the tag didn't exist in
		 *              the given list or if it was %NULL.
		 * 
		 * address of a GstSample
		 *     pointer variable to store the result into
		 */
		public get_sample(tag: string): [ boolean, Sample ];
		/**
		 * Gets the sample that is at the given index for the given tag in the given
		 * list and copies it into the variable pointed to by #sample. Free the sample
		 * with {@link Gst.Sample.unref} when it is no longer needed. You can retrieve the
		 * buffer from the sample using gst_sample_get_buffer() and the associated
		 * caps (if any) with gst_sample_get_caps().
		 * 
		 * Free-function: gst_sample_unref
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a sample was copied, %FALSE if the tag didn't exist in the
		 *              given list or if it was %NULL.
		 * 
		 * address of a GstSample
		 *     pointer variable to store the result into
		 */
		public get_sample_index(tag: string, index: number): [ boolean, Sample ];
		/**
		 * Gets the scope of #list.
		 * @returns The scope of #list
		 */
		public get_scope(): TagScope;
		/**
		 * Copies the contents for the given tag into the value, possibly merging
		 * multiple values into one if multiple values are associated with the tag.
		 * 
		 * Use gst_tag_list_get_string_index (list, tag, 0, value) if you want
		 * to retrieve the first string associated with this tag unmodified.
		 * 
		 * The resulting string in #value will be in UTF-8 encoding and should be
		 * freed by the caller using g_free when no longer needed. The
		 * returned string is also guaranteed to be non-%NULL and non-empty.
		 * 
		 * Free-function: g_free
		 * @param tag tag to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_string(tag: string): [ boolean, string ];
		/**
		 * Gets the value that is at the given index for the given tag in the given
		 * list.
		 * 
		 * The resulting string in #value will be in UTF-8 encoding and should be
		 * freed by the caller using g_free when no longer needed. The
		 * returned string is also guaranteed to be non-%NULL and non-empty.
		 * 
		 * Free-function: g_free
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_string_index(tag: string, index: number): [ boolean, string ];
		/**
		 * Checks how many value are stored in this tag list for the given tag.
		 * @param tag the tag to query
		 * @returns The number of tags stored
		 */
		public get_tag_size(tag: string): number;
		/**
		 * Copies the contents for the given tag into the value, merging multiple values
		 * into one if multiple values are associated with the tag.
		 * @param tag tag to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_uint(tag: string): [ boolean, number ];
		/**
		 * Copies the contents for the given tag into the value, merging multiple values
		 * into one if multiple values are associated with the tag.
		 * @param tag tag to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_uint64(tag: string): [ boolean, number ];
		/**
		 * Gets the value that is at the given index for the given tag in the given
		 * list.
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_uint64_index(tag: string, index: number): [ boolean, number ];
		/**
		 * Gets the value that is at the given index for the given tag in the given
		 * list.
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public get_uint_index(tag: string, index: number): [ boolean, number ];
		/**
		 * Gets the value that is at the given index for the given tag in the given
		 * list.
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns The GValue for the specified
		 *          entry or %NULL if the tag wasn't available or the tag
		 *          doesn't have as many entries
		 */
		public get_value_index(tag: string, index: number): GObject.Value | null;
		/**
		 * Inserts the tags of the #from list into the first list using the given mode.
		 * @param from list to merge from
		 * @param mode the mode to use
		 */
		public insert(from: TagList, mode: TagMergeMode): void;
		/**
		 * Checks if the given taglist is empty.
		 * @returns %TRUE if the taglist is empty, otherwise %FALSE.
		 */
		public is_empty(): boolean;
		/**
		 * Checks if the two given taglists are equal.
		 * @param list2 a {@link TagList}.
		 * @returns %TRUE if the taglists are equal, otherwise %FALSE
		 */
		public is_equal(list2: TagList): boolean;
		/**
		 * Merges the two given lists into a new list. If one of the lists is %NULL, a
		 * copy of the other is returned. If both lists are %NULL, %NULL is returned.
		 * 
		 * Free-function: gst_tag_list_unref
		 * @param list2 second list to merge
		 * @param mode the mode to use
		 * @returns the new list
		 */
		public merge(list2: TagList | null, mode: TagMergeMode): TagList | null;
		/**
		 * Get the number of tags in #list.
		 * @returns The number of tags in #list.
		 */
		public n_tags(): number;
		/**
		 * Get the name of the tag in #list at #index.
		 * @param index the index
		 * @returns The name of the tag at #index.
		 */
		public nth_tag_name(index: number): string;
		/**
		 * Peeks at the value that is at the given index for the given tag in the given
		 * list.
		 * 
		 * The resulting string in #value will be in UTF-8 encoding and doesn't need
		 * to be freed by the caller. The returned string is also guaranteed to
		 * be non-%NULL and non-empty.
		 * @param tag tag to read out
		 * @param index number of entry to read out
		 * @returns %TRUE, if a value was set, %FALSE if the tag didn't exist in the
		 *              given list.
		 * 
		 * location for the result
		 */
		public peek_string_index(tag: string, index: number): [ boolean, string ];
		/**
		 * Removes the given tag from the taglist.
		 * @param tag tag to remove
		 */
		public remove_tag(tag: string): void;
		/**
		 * Sets the scope of #list to #scope. By default the scope
		 * of a taglist is stream scope.
		 * @param scope new scope for #list
		 */
		public set_scope(scope: TagScope): void;
		/**
		 * Serializes a tag list to a string.
		 * @returns a newly-allocated string, or %NULL in case of
		 *     an error. The string must be freed with {@link G.free} when no longer
		 *     needed.
		 */
		public to_string(): string | null;
	}

	export interface TagSetterInterfaceInitOptions {}
	/**
	 * {@link TagSetterInterface} interface.
	 */
	interface TagSetterInterface {}
	class TagSetterInterface {
		public constructor(options?: Partial<TagSetterInterfaceInitOptions>);
		/**
		 * parent interface type.
		 */
		public readonly g_iface: GObject.TypeInterface;
	}

	export interface TimedValueInitOptions {}
	/**
	 * Structure for saving a timestamp and a value.
	 */
	interface TimedValue {}
	class TimedValue {
		public constructor(options?: Partial<TimedValueInitOptions>);
		/**
		 * timestamp of the value change
		 */
		public timestamp: ClockTime;
		/**
		 * the corresponding value
		 */
		public value: number;
	}

	export interface TocInitOptions {}
	/**
	 * {@link Toc} functions are used to create/free #GstToc and #GstTocEntry structures.
	 * Also they are used to convert #GstToc into #GstStructure and vice versa.
	 * 
	 * #GstToc lets you to inform other elements in pipeline or application that playing
	 * source has some kind of table of contents (TOC). These may be chapters, editions,
	 * angles or other types. For example: DVD chapters, Matroska chapters or cue sheet
	 * TOC. Such TOC will be useful for applications to display instead of just a
	 * playlist.
	 * 
	 * Using TOC is very easy. Firstly, create #GstToc structure which represents root
	 * contents of the source. You can also attach TOC-specific tags to it. Then fill
	 * it with #GstTocEntry entries by appending them to the #GstToc using
	 * {@link Gst.Toc.append_entry}, and appending subentries to a #GstTocEntry using
	 * gst_toc_entry_append_sub_entry().
	 * 
	 * Note that root level of the TOC can contain only either editions or chapters. You
	 * should not mix them together at the same level. Otherwise you will get serialization
	 * /deserialization errors. Make sure that no one of the entries has negative start and
	 *  stop values.
	 * 
	 * Use gst_event_new_toc() to create a new TOC #GstEvent, and gst_event_parse_toc() to
	 * parse received TOC event. Use gst_event_new_toc_select() to create a new TOC select #GstEvent,
	 * and gst_event_parse_toc_select() to parse received TOC select event. The same rule for
	 * the #GstMessage: gst_message_new_toc() to create new TOC #GstMessage, and
	 * gst_message_parse_toc() to parse received TOC message.
	 * 
	 * TOCs can have global scope or current scope. Global scope TOCs contain
	 * all entries that can possibly be selected using a toc select event, and
	 * are what an application is usually interested in. TOCs with current scope
	 * only contain the parts of the TOC relevant to the currently selected/playing
	 * stream; the current scope TOC is used by downstream elements such as muxers
	 * to write correct TOC entries when transcoding files, for example. When
	 * playing a DVD, the global TOC would contain a hierarchy of all titles,
	 * chapters and angles, for example, while the current TOC would only contain
	 * the chapters for the currently playing title if playback of a specific
	 * title was requested.
	 * 
	 * Applications and plugins should not rely on TOCs having a certain kind of
	 * structure, but should allow for different alternatives. For example, a
	 * simple CUE sheet embedded in a file may be presented as a flat list of
	 * track entries, or could have a top-level edition node (or some other
	 * alternative type entry) with track entries underneath that node; or even
	 * multiple top-level edition nodes (or some other alternative type entries)
	 * each with track entries underneath, in case the source file has extracted
	 * a track listing from different sources).
	 */
	interface Toc {}
	class Toc {
		public constructor(options?: Partial<TocInitOptions>);
		/**
		 * Create a new {@link Toc} structure.
		 * @param scope scope of this TOC
		 * @returns newly allocated {@link Toc} structure, free it
		 *     with {@link Gst.Toc.unref}.
		 */
		public static new(scope: TocScope): Toc;
		/**
		 * Appends the {@link TocEntry} #entry to #toc.
		 * @param entry A {@link TocEntry}
		 */
		public append_entry(entry: TocEntry): void;
		public dump(): void;
		/**
		 * Find {@link TocEntry} with given #uid in the #toc.
		 * @param uid UID to find {@link TocEntry} with.
		 * @returns {@link TocEntry} with specified
		 * #uid from the #toc, or %NULL if not found.
		 */
		public find_entry(uid: string): TocEntry | null;
		/**
		 * Gets the list of {@link TocEntry} of #toc.
		 * @returns A #GList of {@link TocEntry} for #entry
		 */
		public get_entries(): TocEntry[];
		public get_scope(): TocScope;
		/**
		 * Gets the tags for #toc.
		 * @returns A {@link TagList} for #entry
		 */
		public get_tags(): TagList;
		/**
		 * Merge #tags into the existing tags of #toc using #mode.
		 * @param tags A {@link TagList} or %NULL
		 * @param mode A {@link TagMergeMode}
		 */
		public merge_tags(tags: TagList | null, mode: TagMergeMode): void;
		/**
		 * Set a {@link TagList} with tags for the complete #toc.
		 * @param tags A {@link TagList} or %NULL
		 */
		public set_tags(tags?: TagList | null): void;
	}

	export interface TocEntryInitOptions {}
	interface TocEntry {}
	class TocEntry {
		public constructor(options?: Partial<TocEntryInitOptions>);
		/**
		 * Create new {@link TocEntry} structure.
		 * @param type entry type.
		 * @param uid unique ID (UID) in the whole TOC.
		 * @returns newly allocated {@link TocEntry} structure, free it with {@link Gst.TocEntry.unref}.
		 */
		public static new(type: TocEntryType, uid: string): TocEntry;
		/**
		 * Appends the {@link TocEntry} #subentry to #entry.
		 * @param subentry A {@link TocEntry}
		 */
		public append_sub_entry(subentry: TocEntry): void;
		public get_entry_type(): TocEntryType;
		/**
		 * Get #loop_type and #repeat_count values from the #entry and write them into
		 * appropriate storages. Loops are e.g. used by sampled instruments. GStreamer
		 * is not automatically applying the loop. The application can process this
		 * meta data and use it e.g. to send a seek-event to loop a section.
		 * @returns %TRUE if all non-%NULL storage pointers were filled with appropriate
		 * values, %FALSE otherwise.
		 * 
		 * the storage for the loop_type
		 *             value, leave %NULL if not need.
		 * 
		 * the storage for the repeat_count
		 *                value, leave %NULL if not need.
		 */
		public get_loop(): [ boolean, TocLoopType | null, number | null ];
		/**
		 * Gets the parent {@link TocEntry} of #entry.
		 * @returns The parent {@link TocEntry} of #entry
		 */
		public get_parent(): TocEntry | null;
		/**
		 * Get #start and #stop values from the #entry and write them into appropriate
		 * storages.
		 * @returns %TRUE if all non-%NULL storage pointers were filled with appropriate
		 * values, %FALSE otherwise.
		 * 
		 * the storage for the start value, leave
		 *   %NULL if not need.
		 * 
		 * the storage for the stop value, leave
		 *   %NULL if not need.
		 */
		public get_start_stop_times(): [ boolean, number | null, number | null ];
		/**
		 * Gets the sub-entries of #entry.
		 * @returns A #GList of {@link TocEntry} of #entry
		 */
		public get_sub_entries(): TocEntry[];
		/**
		 * Gets the tags for #entry.
		 * @returns A {@link TagList} for #entry
		 */
		public get_tags(): TagList;
		/**
		 * Gets the parent {@link Toc} of #entry.
		 * @returns The parent {@link Toc} of #entry
		 */
		public get_toc(): Toc;
		/**
		 * Gets the UID of #entry.
		 * @returns The UID of #entry
		 */
		public get_uid(): string;
		public is_alternative(): boolean;
		public is_sequence(): boolean;
		/**
		 * Merge #tags into the existing tags of #entry using #mode.
		 * @param tags A {@link TagList} or %NULL
		 * @param mode A {@link TagMergeMode}
		 */
		public merge_tags(tags: TagList | null, mode: TagMergeMode): void;
		/**
		 * Set #loop_type and #repeat_count values for the #entry.
		 * @param loop_type loop_type value to set.
		 * @param repeat_count repeat_count value to set.
		 */
		public set_loop(loop_type: TocLoopType, repeat_count: number): void;
		/**
		 * Set #start and #stop values for the #entry.
		 * @param start start value to set.
		 * @param stop stop value to set.
		 */
		public set_start_stop_times(start: number, stop: number): void;
		/**
		 * Set a {@link TagList} with tags for the complete #entry.
		 * @param tags A {@link TagList} or %NULL
		 */
		public set_tags(tags?: TagList | null): void;
	}

	export interface TocSetterInterfaceInitOptions {}
	/**
	 * {@link TocSetterInterface} interface.
	 */
	interface TocSetterInterface {}
	class TocSetterInterface {
		public constructor(options?: Partial<TocSetterInterfaceInitOptions>);
		/**
		 * parent interface type.
		 */
		public readonly g_iface: GObject.TypeInterface;
	}

	export interface TypeFindInitOptions {}
	/**
	 * The following functions allow you to detect the media type of an unknown
	 * stream.
	 */
	interface TypeFind {}
	class TypeFind {
		public constructor(options?: Partial<TypeFindInitOptions>);
		/**
		 * Registers a new typefind function to be used for typefinding. After
		 * registering this function will be available for typefinding.
		 * This function is typically called during an element's plugin initialization.
		 * @param plugin A {@link Plugin}, or %NULL for a static typefind function
		 * @param name The name for registering
		 * @param rank The rank (or importance) of this typefind function
		 * @param func The {@link TypeFindFunction} to use
		 * @param extensions Optional comma-separated list of extensions
		 *     that could belong to this type
		 * @param possible_caps Optionally the caps that could be returned when typefinding
		 *                 succeeds
		 * @returns %TRUE on success, %FALSE otherwise
		 */
		public static register(plugin: Plugin | null, name: string, rank: number, func: TypeFindFunction, extensions?: string | null, possible_caps?: Caps | null): boolean;
		/**
		 * The data used by the caller of the typefinding function.
		 */
		public data: any;
		public readonly _gst_reserved: any[];
		// public peek: {(data: any, offset: number, size: number): number;};
		// public suggest: {(data: any, probability: number, caps: Caps): void;};
		// public get_length: {(data: any): number;};
		/**
		 * Get the length of the data stream.
		 * @returns The length of the data stream, or 0 if it is not available.
		 */
		public get_length(): number;
		/**
		 * Returns the #size bytes of the stream to identify beginning at offset. If
		 * offset is a positive number, the offset is relative to the beginning of the
		 * stream, if offset is a negative number the offset is relative to the end of
		 * the stream. The returned memory is valid until the typefinding function
		 * returns and must not be freed.
		 * @param offset The offset
		 * @returns the
		 *     requested data, or %NULL if that data is not available.
		 * 
		 * The number of bytes to return
		 */
		public peek(offset: number): [ number[] | null, number ];
		/**
		 * If a {@link TypeFindFunction} calls this function it suggests the caps with the
		 * given probability. A #GstTypeFindFunction may supply different suggestions
		 * in one call.
		 * It is up to the caller of the #GstTypeFindFunction to interpret these values.
		 * @param probability The probability in percent that the suggestion is right
		 * @param caps The fixed {@link Caps} to suggest
		 */
		public suggest(probability: number, caps: Caps): void;
		/**
		 * If a {@link TypeFindFunction} calls this function it suggests the caps with the
		 * given probability. A #GstTypeFindFunction may supply different suggestions
		 * in one call. It is up to the caller of the #GstTypeFindFunction to interpret
		 * these values.
		 * 
		 * This function is similar to {@link Gst.TypeFind.suggest}, only that instead of
		 * passing a #GstCaps argument you can create the caps on the fly in the same
		 * way as you can with gst_caps_new_simple().
		 * 
		 * Make sure you terminate the list of arguments with a %NULL argument and that
		 * the values passed have the correct type (in terms of width in bytes when
		 * passed to the vararg function - this applies particularly to gdouble and
		 * guint64 arguments).
		 * @param probability The probability in percent that the suggestion is right
		 * @param media_type the media type of the suggested caps
		 * @param fieldname first field of the suggested caps, or %NULL
		 */
		public suggest_simple(probability: number, media_type: string, fieldname?: string | null): void;
	}

	export interface URIHandlerInterfaceInitOptions {}
	/**
	 * Any {@link Element} using this interface should implement these methods.
	 */
	interface URIHandlerInterface {}
	class URIHandlerInterface {
		public constructor(options?: Partial<URIHandlerInterfaceInitOptions>);
		public get_type: {(type: GObject.Type): URIType;};
		public get_protocols: {(type: GObject.Type): string[];};
		public get_uri: {(handler: URIHandler): string | null;};
		public set_uri: {(handler: URIHandler, uri: string): boolean;};
	}

	export interface UriInitOptions {}
	/**
	 * A {@link Uri} object can be used to parse and split a URI string into its
	 * constituent parts. Two #GstUri objects can be joined to make a new #GstUri
	 * using the algorithm described in RFC3986.
	 */
	interface Uri {}
	class Uri {
		public constructor(options?: Partial<UriInitOptions>);
		/**
		 * Creates a new {@link Uri} object with the given URI parts. The path and query
		 * strings will be broken down into their elements. All strings should not be
		 * escaped except where indicated.
		 * @param scheme The scheme for the new URI.
		 * @param userinfo The user-info for the new URI.
		 * @param host The host name for the new URI.
		 * @param port The port number for the new URI or %GST_URI_NO_PORT.
		 * @param path The path for the new URI with '/' separating path
		 *                      elements.
		 * @param query The query string for the new URI with '&' separating
		 *                       query elements. Elements containing '&' characters
		 *                       should encode them as "&percnt;26".
		 * @param fragment The fragment name for the new URI.
		 * @returns A new {@link Uri} object.
		 */
		public static new(scheme: string | null, userinfo: string | null, host: string | null, port: number, path?: string | null, query?: string | null, fragment?: string | null): Uri;
		/**
		 * @deprecated
		 * Use GstURI instead.
		 * 
		 * Constructs a URI for a given valid protocol and location.
		 * 
		 * Free-function: g_free
		 * @param protocol Protocol for URI
		 * @param location Location for URI
		 * @returns a new string for this URI. Returns %NULL if the
		 *     given URI protocol is not valid, or the given location is %NULL.
		 */
		public static construct(protocol: string, location: string): string;
		/**
		 * Parses a URI string into a new {@link Uri} object. Will return NULL if the URI
		 * cannot be parsed.
		 * @param uri The URI string to parse.
		 * @returns A new {@link Uri} object, or NULL.
		 */
		public static from_string(uri: string): Uri | null;
		/**
		 * Parses a URI string into a new {@link Uri} object. Will return NULL if the URI
		 * cannot be parsed. This is identical to {@link Gst.uri.from_string} except that
		 * the userinfo and fragment components of the URI will not be unescaped while
		 * parsing.
		 * 
		 * Use this when you need to extract a username and password from the userinfo
		 * such as https://user:password#example.com since either may contain
		 * a URI-escaped ':' character. gst_uri_from_string() will unescape the entire
		 * userinfo component, which will make it impossible to know which ':'
		 * delineates the username and password.
		 * 
		 * The same applies to the fragment component of the URI, such as
		 * https://example.com/path#fragment which may contain a URI-escaped '#'.
		 * @param uri The URI string to parse.
		 * @returns A new {@link Uri} object, or NULL.
		 */
		public static from_string_escaped(uri: string): Uri | null;
		/**
		 * Extracts the location out of a given valid URI, ie. the protocol and "://"
		 * are stripped from the URI, which means that the location returned includes
		 * the hostname if one is specified. The returned string must be freed using
		 * {@link G.free}.
		 * 
		 * Free-function: g_free
		 * @param uri A URI string
		 * @returns the location for this URI. Returns
		 *     %NULL if the URI isn't valid. If the URI does not contain a location, an
		 *     empty string is returned.
		 */
		public static get_location(uri: string): string | null;
		/**
		 * Extracts the protocol out of a given valid URI. The returned string must be
		 * freed using {@link G.free}.
		 * @param uri A URI string
		 * @returns The protocol for this URI.
		 */
		public static get_protocol(uri: string): string | null;
		/**
		 * Checks if the protocol of a given valid URI matches #protocol.
		 * @param uri a URI string
		 * @param protocol a protocol string (e.g. "http")
		 * @returns %TRUE if the protocol matches.
		 */
		public static has_protocol(uri: string, protocol: string): boolean;
		/**
		 * Tests if the given string is a valid URI identifier. URIs start with a valid
		 * scheme followed by ":" and maybe a string identifying the location.
		 * @param uri A URI string
		 * @returns %TRUE if the string is a valid URI
		 */
		public static is_valid(uri: string): boolean;
		/**
		 * This is a convenience function to join two URI strings and return the result.
		 * The returned string should be {@link G.free}'d after use.
		 * @param base_uri The percent-encoded base URI.
		 * @param ref_uri The percent-encoded reference URI to join to the #base_uri.
		 * @returns A string representing the percent-encoded join of
		 *          the two URIs.
		 */
		public static join_strings(base_uri: string, ref_uri: string): string;
		/**
		 * Checks if an element exists that supports the given URI protocol. Note
		 * that a positive return value does not imply that a subsequent call to
		 * {@link Gst.Element.make_from_uri} is guaranteed to work.
		 * @param type Whether to check for a source or a sink
		 * @param protocol Protocol that should be checked for (e.g. "http" or "smb")
		 * @returns %TRUE
		 */
		public static protocol_is_supported(type: URIType, protocol: string): boolean;
		/**
		 * Tests if the given string is a valid protocol identifier. Protocols
		 * must consist of alphanumeric characters, '+', '-' and '.' and must
		 * start with a alphabetic character. See RFC 3986 Section 3.1.
		 * @param protocol A string
		 * @returns %TRUE if the string is a valid protocol identifier, %FALSE otherwise.
		 */
		public static protocol_is_valid(protocol: string): boolean;
		/**
		 * Append a path onto the end of the path in the URI. The path is not
		 * normalized, call {@link #gst.uri_normalize} to normalize the path.
		 * @param relative_path Relative path to append to the end of the current path.
		 * @returns %TRUE if the path was appended successfully.
		 */
		public append_path(relative_path: string): boolean;
		/**
		 * Append a single path segment onto the end of the URI path.
		 * @param path_segment The path segment string to append to the URI path.
		 * @returns %TRUE if the path was appended successfully.
		 */
		public append_path_segment(path_segment: string): boolean;
		/**
		 * Compares two {@link Uri} objects to see if they represent the same normalized
		 * URI.
		 * @param second Second {@link Uri} to compare.
		 * @returns %TRUE if the normalized versions of the two URI's would be equal.
		 */
		public equal(second: Uri): boolean;
		/**
		 * Like {@link Gst.uri.from_string} but also joins with a base URI.
		 * @param uri The URI string to parse.
		 * @returns A new {@link Uri} object.
		 */
		public from_string_with_base(uri: string): Uri;
		/**
		 * Get the fragment name from the URI or %NULL if it doesn't exist.
		 * If #uri is %NULL then returns %NULL.
		 * @returns The host name from the {@link Uri} object or %NULL.
		 */
		public get_fragment(): string | null;
		/**
		 * Get the host name from the URI or %NULL if it doesn't exist.
		 * If #uri is %NULL then returns %NULL.
		 * @returns The host name from the {@link Uri} object or %NULL.
		 */
		public get_host(): string | null;
		/**
		 * Get the media fragment table from the URI, as defined by "Media Fragments URI 1.0".
		 * Hash table returned by this API is a list of "key-value" pairs, and the each
		 * pair is generated by splitting "URI fragment" per "&" sub-delims, then "key"
		 * and "value" are split by "=" sub-delims. The "key" returned by this API may
		 * be undefined keyword by standard.
		 * A value may be %NULL to indicate that the key should appear in the fragment
		 * string in the URI, but does not have a value. Free the returned #GHashTable
		 * with {@link #g.hash_table_unref} when it is no longer required.
		 * Modifying this hash table does not affect the fragment in the URI.
		 * 
		 * See more about Media Fragments URI 1.0 (W3C) at https://www.w3.org/TR/media-frags/
		 * @returns The
		 *          fragment hash table from the URI.
		 */
		public get_media_fragment_table(): string[] | null;
		/**
		 * Extract the path string from the URI object.
		 * @returns The path from the URI. Once finished
		 *                                      with the string should be {@link G.free}'d.
		 */
		public get_path(): string | null;
		/**
		 * Get a list of path segments from the URI.
		 * @returns A #GList of path segment
		 *          strings or %NULL if no path segments are available. Free the list
		 *          when no longer needed with g_list_free_full(list, g_free).
		 */
		public get_path_segments(): string[];
		/**
		 * Extract the path string from the URI object as a percent encoded URI path.
		 * @returns The path from the URI. Once finished
		 *                                      with the string should be {@link G.free}'d.
		 */
		public get_path_string(): string | null;
		/**
		 * Get the port number from the URI or %GST_URI_NO_PORT if it doesn't exist.
		 * If #uri is %NULL then returns %GST_URI_NO_PORT.
		 * @returns The port number from the {@link Uri} object or %GST_URI_NO_PORT.
		 */
		public get_port(): number;
		/**
		 * Get a list of the query keys from the URI.
		 * @returns A list of keys from
		 *          the URI query. Free the list with {@link G.list_free}.
		 */
		public get_query_keys(): string[];
		/**
		 * Get a percent encoded URI query string from the #uri.
		 * @returns A percent encoded query string. Use
		 *                                      {@link G.free} when no longer needed.
		 */
		public get_query_string(): string | null;
		/**
		 * Get the query table from the URI. Keys and values in the table are freed
		 * with g_free when they are deleted. A value may be %NULL to indicate that
		 * the key should appear in the query string in the URI, but does not have a
		 * value. Free the returned #GHashTable with {@link #g.hash_table_unref} when it is
		 * no longer required. Modifying this hash table will modify the query in the
		 * URI.
		 * @returns The query
		 *          hash table from the URI.
		 */
		public get_query_table(): string[] | null;
		/**
		 * Get the value associated with the #query_key key. Will return %NULL if the
		 * key has no value or if the key does not exist in the URI query table. Because
		 * %NULL is returned for both missing keys and keys with no value, you should
		 * use {@link Gst.Uri.query_has_key} to determine if a key is present in the URI
		 * query.
		 * @param query_key The key to lookup.
		 * @returns The value for the given key, or %NULL if not found.
		 */
		public get_query_value(query_key: string): string | null;
		/**
		 * Get the scheme name from the URI or %NULL if it doesn't exist.
		 * If #uri is %NULL then returns %NULL.
		 * @returns The scheme from the {@link Uri} object or %NULL.
		 */
		public get_scheme(): string | null;
		/**
		 * Get the userinfo (usually in the form "username:password") from the URI
		 * or %NULL if it doesn't exist. If #uri is %NULL then returns %NULL.
		 * @returns The userinfo from the {@link Uri} object or %NULL.
		 */
		public get_userinfo(): string | null;
		/**
		 * Tests the #uri to see if it is normalized. A %NULL #uri is considered to be
		 * normalized.
		 * @returns TRUE if the URI is normalized or is %NULL.
		 */
		public is_normalized(): boolean;
		/**
		 * Check if it is safe to write to this {@link Uri}.
		 * 
		 * Check if the refcount of #uri is exactly 1, meaning that no other
		 * reference exists to the #GstUri and that the #GstUri is therefore writable.
		 * 
		 * Modification of a #GstUri should only be done after verifying that it is
		 * writable.
		 * @returns %TRUE if it is safe to write to the object.
		 */
		public is_writable(): boolean;
		/**
		 * Join a reference URI onto a base URI using the method from RFC 3986.
		 * If either URI is %NULL then the other URI will be returned with the ref count
		 * increased.
		 * @param ref_uri The reference URI to join onto the
		 *                                       base URI.
		 * @returns A {@link Uri} which represents the base
		 *                                      with the reference URI joined on.
		 */
		public join(ref_uri?: Uri | null): Uri | null;
		/**
		 * Make the {@link Uri} writable.
		 * 
		 * Checks if #uri is writable, and if so the original object is returned. If
		 * not, then a writable copy is made and returned. This gives away the
		 * reference to #uri and returns a reference to the new #GstUri.
		 * If #uri is %NULL then %NULL is returned.
		 * @returns A writable version of #uri.
		 */
		public make_writable(): Uri;
		/**
		 * Like {@link Gst.Uri.new}, but joins the new URI onto a base URI.
		 * @param scheme The scheme for the new URI.
		 * @param userinfo The user-info for the new URI.
		 * @param host The host name for the new URI.
		 * @param port The port number for the new URI or %GST_URI_NO_PORT.
		 * @param path The path for the new URI with '/' separating path
		 *                      elements.
		 * @param query The query string for the new URI with '&' separating
		 *                       query elements. Elements containing '&' characters
		 *                       should encode them as "&percnt;26".
		 * @param fragment The fragment name for the new URI.
		 * @returns The new URI joined onto #base.
		 */
		public new_with_base(scheme: string | null, userinfo: string | null, host: string | null, port: number, path?: string | null, query?: string | null, fragment?: string | null): Uri;
		/**
		 * Normalization will remove extra path segments ("." and "..") from the URI. It
		 * will also convert the scheme and host name to lower case and any
		 * percent-encoded values to uppercase.
		 * 
		 * The {@link Uri} object must be writable. Check with {@link Gst.Uri.is_writable} or use
		 * gst_uri_make_writable() first.
		 * @returns TRUE if the URI was modified.
		 */
		public normalize(): boolean;
		/**
		 * Check if there is a query table entry for the #query_key key.
		 * @param query_key The key to lookup.
		 * @returns %TRUE if #query_key exists in the URI query table.
		 */
		public query_has_key(query_key: string): boolean;
		/**
		 * Remove an entry from the query table by key.
		 * @param query_key The key to remove.
		 * @returns %TRUE if the key existed in the table and was removed.
		 */
		public remove_query_key(query_key: string): boolean;
		/**
		 * Sets the fragment string in the URI. Use a value of %NULL in #fragment to
		 * unset the fragment string.
		 * @param fragment The fragment string to set.
		 * @returns %TRUE if the fragment was set/unset successfully.
		 */
		public set_fragment(fragment?: string | null): boolean;
		/**
		 * Set or unset the host for the URI.
		 * @param host The new host string to set or %NULL to unset.
		 * @returns %TRUE if the host was set/unset successfully.
		 */
		public set_host(host: string): boolean;
		/**
		 * Sets or unsets the path in the URI.
		 * @param path The new path to set with path segments separated by '/', or use %NULL
		 *        to unset the path.
		 * @returns %TRUE if the path was set successfully.
		 */
		public set_path(path: string): boolean;
		/**
		 * Replace the path segments list in the URI.
		 * @param path_segments The new
		 *                 path list to set.
		 * @returns %TRUE if the path segments were set successfully.
		 */
		public set_path_segments(path_segments?: string[] | null): boolean;
		/**
		 * Sets or unsets the path in the URI.
		 * @param path The new percent encoded path to set with path segments separated by
		 * '/', or use %NULL to unset the path.
		 * @returns %TRUE if the path was set successfully.
		 */
		public set_path_string(path: string): boolean;
		/**
		 * Set or unset the port number for the URI.
		 * @param port The new port number to set or %GST_URI_NO_PORT to unset.
		 * @returns %TRUE if the port number was set/unset successfully.
		 */
		public set_port(port: number): boolean;
		/**
		 * Sets or unsets the query table in the URI.
		 * @param query The new percent encoded query string to use to populate the query
		 *        table, or use %NULL to unset the query table.
		 * @returns %TRUE if the query table was set successfully.
		 */
		public set_query_string(query: string): boolean;
		/**
		 * Set the query table to use in the URI. The old table is unreferenced and a
		 * reference to the new one is used instead. A value if %NULL for #query_table
		 * will remove the query string from the URI.
		 * @param query_table The new
		 *               query table to use.
		 * @returns %TRUE if the new table was successfully used for the query table.
		 */
		public set_query_table(query_table?: string[] | null): boolean;
		/**
		 * This inserts or replaces a key in the query table. A #query_value of %NULL
		 * indicates that the key has no associated value, but will still be present in
		 * the query string.
		 * @param query_key The key for the query entry.
		 * @param query_value The value for the key.
		 * @returns %TRUE if the query table was successfully updated.
		 */
		public set_query_value(query_key: string, query_value?: string | null): boolean;
		/**
		 * Set or unset the scheme for the URI.
		 * @param scheme The new scheme to set or %NULL to unset the scheme.
		 * @returns %TRUE if the scheme was set/unset successfully.
		 */
		public set_scheme(scheme: string): boolean;
		/**
		 * Set or unset the user information for the URI.
		 * @param userinfo The new user-information string to set or %NULL to unset.
		 * @returns %TRUE if the user information was set/unset successfully.
		 */
		public set_userinfo(userinfo: string): boolean;
		/**
		 * Convert the URI to a string.
		 * 
		 * Returns the URI as held in this object as a #gchar* nul-terminated string.
		 * The caller should {@link G.free} the string once they are finished with it.
		 * The string is put together as described in RFC 3986.
		 * @returns The string version of the URI.
		 */
		public to_string(): string;
	}

	export interface ValueTableInitOptions {}
	/**
	 * VTable for the #GValue #type.
	 */
	interface ValueTable {}
	class ValueTable {
		public constructor(options?: Partial<ValueTableInitOptions>);
		/**
		 * a #GType
		 */
		public type: GObject.Type;
		/**
		 * a {@link ValueCompareFunc}
		 */
		public compare: ValueCompareFunc;
		/**
		 * a {@link ValueSerializeFunc}
		 */
		public serialize: ValueSerializeFunc;
		/**
		 * a {@link ValueDeserializeFunc}
		 */
		public deserialize: ValueDeserializeFunc;
		public readonly _gst_reserved: any[];
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ChildProxy} instead.
	 */
	interface IChildProxy {
		/**
		 * Emits the "child-added" signal.
		 * @param child the newly added child
		 * @param name the name of the new child
		 */
		child_added(child: GObject.Object, name: string): void;
		/**
		 * Emits the "child-removed" signal.
		 * @param child the removed child
		 * @param name the name of the old child
		 */
		child_removed(child: GObject.Object, name: string): void;
		/**
		 * Gets properties of the parent object and its children.
		 * @param first_property_name name of the first property to get
		 */
		get(first_property_name: string): void;
		/**
		 * Fetches a child by its number.
		 * @param index the child's position in the child list
		 * @returns the child object or %NULL if
		 *     not found (index too high). Unref after usage.
		 * 
		 * MT safe.
		 */
		get_child_by_index(index: number): GObject.Object | null;
		/**
		 * Looks up a child element by the given name.
		 * 
		 * This virtual method has a default implementation that uses {@link Object}
		 * together with {@link Gst.Object.get_name}. If the interface is to be used with
		 * #GObjects, this methods needs to be overridden.
		 * @param name the child's name
		 * @returns the child object or %NULL if
		 *     not found. Unref after usage.
		 * 
		 * MT safe.
		 */
		get_child_by_name(name: string): GObject.Object | null;
		/**
		 * Gets the number of child objects this parent contains.
		 * @returns the number of child objects
		 * 
		 * MT safe.
		 */
		get_children_count(): number;
		/**
		 * Gets a single property using the GstChildProxy mechanism.
		 * You are responsible for freeing it by calling {@link G.value_unset}
		 * @param name name of the property
		 * @returns a #GValue that should take the result.
		 */
		get_property(name: string): GObject.Value;
		/**
		 * Gets properties of the parent object and its children.
		 * @param first_property_name name of the first property to get
		 * @param var_args return location for the first property, followed optionally by more name/return location pairs, followed by %NULL
		 */
		get_valist(first_property_name: string, var_args: any[]): void;
		/**
		 * Looks up which object and #GParamSpec would be effected by the given #name.
		 * 
		 * MT safe.
		 * @param name name of the property to look up
		 * @returns %TRUE if #target and #pspec could be found. %FALSE otherwise. In that
		 * case the values for #pspec and #target are not modified. Unref #target after
		 * usage. For plain GObjects #target is the same as #object.
		 * 
		 * pointer to a #GObject that
		 *     takes the real object to set property on
		 * 
		 * pointer to take the #GParamSpec
		 *     describing the property
		 */
		lookup(name: string): [ boolean, GObject.Object | null, GObject.ParamSpec | null ];
		/**
		 * Sets properties of the parent object and its children.
		 * @param first_property_name name of the first property to set
		 */
		set(first_property_name: string): void;
		/**
		 * Sets a single property using the GstChildProxy mechanism.
		 * @param name name of the property to set
		 * @param value new #GValue for the property
		 */
		set_property(name: string, value: GObject.Value): void;
		/**
		 * Sets properties of the parent object and its children.
		 * @param first_property_name name of the first property to set
		 * @param var_args value for the first property, followed optionally by more name/value pairs, followed by %NULL
		 */
		set_valist(first_property_name: string, var_args: any[]): void;
		/**
		 * Will be emitted after the #object was added to the #child_proxy.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - object: the #GObject that was added 
		 *  - name: the name of the new child 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "child-added", callback: (owner: this, object: GObject.Object, name: string) => void): number;
		/**
		 * Will be emitted after the #object was removed from the #child_proxy.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - object: the #GObject that was removed 
		 *  - name: the name of the old child 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "child-removed", callback: (owner: this, object: GObject.Object, name: string) => void): number;

	}

	type ChildProxyInitOptionsMixin  = {};
	export interface ChildProxyInitOptions extends ChildProxyInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ChildProxy} instead.
	 */
	type ChildProxyMixin = IChildProxy;

	/**
	 * This interface abstracts handling of property sets for elements with
	 * children. Imagine elements such as mixers or polyphonic generators. They all
	 * have multiple {@link Pad} or some kind of voice objects. Another use case are
	 * container elements like #GstBin.
	 * The element implementing the interface acts as a parent for those child
	 * objects.
	 * 
	 * By implementing this interface the child properties can be accessed from the
	 * parent element by using {@link Gst.ChildProxy.get} and gst_child_proxy_set().
	 * 
	 * Property names are written as "child-name::property-name". The whole naming
	 * scheme is recursive. Thus "child1::child2::property" is valid too, if
	 * "child1" and "child2" implement the #GstChildProxy interface.
	 */
	interface ChildProxy extends ChildProxyMixin {}

	class ChildProxy {
		public constructor(options?: Partial<ChildProxyInitOptions>);
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Preset} instead.
	 */
	interface IPreset {
		/**
		 * Delete the given preset.
		 * @param name preset name to remove
		 * @returns %TRUE for success, %FALSE if e.g. there is no preset with that #name
		 */
		delete_preset(name: string): boolean;
		/**
		 * Gets the #value for an existing meta data #tag. Meta data #tag names can be
		 * something like e.g. "comment". Returned values need to be released when done.
		 * @param name preset name
		 * @param tag meta data item name
		 * @returns %TRUE for success, %FALSE if e.g. there is no preset with that #name
		 * or no value for the given #tag
		 * 
		 * value
		 */
		get_meta(name: string, tag: string): [ boolean, string ];
		/**
		 * Get a copy of preset names as a %NULL terminated string array.
		 * @returns 
		 *     list with names, use {@link G.strfreev} after usage.
		 */
		get_preset_names(): string[];
		/**
		 * Get a the names of the GObject properties that can be used for presets.
		 * @returns an
		 *   array of property names which should be freed with {@link G.strfreev} after use.
		 */
		get_property_names(): string[];
		/**
		 * Check if one can add new presets, change existing ones and remove presets.
		 * @returns %TRUE if presets are editable or %FALSE if they are static
		 */
		is_editable(): boolean;
		/**
		 * Load the given preset.
		 * @param name preset name to load
		 * @returns %TRUE for success, %FALSE if e.g. there is no preset with that #name
		 */
		load_preset(name: string): boolean;
		/**
		 * Renames a preset. If there is already a preset by the #new_name it will be
		 * overwritten.
		 * @param old_name current preset name
		 * @param new_name new preset name
		 * @returns %TRUE for success, %FALSE if e.g. there is no preset with #old_name
		 */
		rename_preset(old_name: string, new_name: string): boolean;
		/**
		 * Save the current object settings as a preset under the given name. If there
		 * is already a preset by this #name it will be overwritten.
		 * @param name preset name to save
		 * @returns %TRUE for success, %FALSE
		 */
		save_preset(name: string): boolean;
		/**
		 * Sets a new #value for an existing meta data item or adds a new item. Meta
		 * data #tag names can be something like e.g. "comment". Supplying %NULL for the
		 * #value will unset an existing value.
		 * @param name preset name
		 * @param tag meta data item name
		 * @param value new value
		 * @returns %TRUE for success, %FALSE if e.g. there is no preset with that #name
		 */
		set_meta(name: string, tag: string, value?: string | null): boolean;
	}

	type PresetInitOptionsMixin  = {};
	export interface PresetInitOptions extends PresetInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Preset} instead.
	 */
	type PresetMixin = IPreset;

	/**
	 * This interface offers methods to query and manipulate parameter preset sets.
	 * A preset is a bunch of property settings, together with meta data and a name.
	 * The name of a preset serves as key for subsequent method calls to manipulate
	 * single presets.
	 * All instances of one type will share the list of presets. The list is created
	 * on demand, if presets are not used, the list is not created.
	 * 
	 * The interface comes with a default implementation that serves most plugins.
	 * Wrapper plugins will override most methods to implement support for the
	 * native preset format of those wrapped plugins.
	 * One method that is useful to be overridden is {@link Gst.Preset.get_property_names}.
	 * With that one can control which properties are saved and in which order.
	 * When implementing support for read-only presets, one should set the vmethods
	 * for gst_preset_save_preset() and gst_preset_delete_preset() to %NULL.
	 * Applications can use gst_preset_is_editable() to check for that.
	 * 
	 * The default implementation supports presets located in a system directory,
	 * application specific directory and in the users home directory. When getting
	 * a list of presets individual presets are read and overlaid in 1) system,
	 * 2) application and 3) user order. Whenever an earlier entry is newer, the
	 * later entries will be updated. Since 1.8 you can also provide extra paths
	 * where to find presets through the GST_PRESET_PATH environment variable.
	 * Presets found in those paths will be considered as "app presets".
	 */
	interface Preset extends PresetMixin {}

	class Preset {
		public constructor(options?: Partial<PresetInitOptions>);
		/**
		 * Gets the directory for application specific presets if set by the
		 * application.
		 * @returns the directory or %NULL, don't free or modify
		 * the string
		 */
		public static get_app_dir(): string | null;
		/**
		 * Sets an extra directory as an absolute path that should be considered when
		 * looking for presets. Any presets in the application dir will shadow the
		 * system presets.
		 * @param app_dir the application specific preset dir
		 * @returns %TRUE for success, %FALSE if the dir already has been set
		 */
		public static set_app_dir(app_dir: string): boolean;
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TagSetter} instead.
	 */
	interface ITagSetter {
		/**
		 * Adds the given tag / value pairs on the setter using the given merge mode.
		 * The list must be terminated with %NULL.
		 * @param mode the mode to use
		 * @param tag tag to set
		 * @param var_args tag / value pairs to set
		 */
		add_tag_valist(mode: TagMergeMode, tag: string, var_args: any[]): void;
		/**
		 * Adds the given tag / GValue pairs on the setter using the given merge mode.
		 * The list must be terminated with %NULL.
		 * @param mode the mode to use
		 * @param tag tag to set
		 * @param var_args tag / GValue pairs to set
		 */
		add_tag_valist_values(mode: TagMergeMode, tag: string, var_args: any[]): void;
		/**
		 * Adds the given tag / GValue pair on the setter using the given merge mode.
		 * @param mode the mode to use
		 * @param tag tag to set
		 * @param value GValue to set for the tag
		 */
		add_tag_value(mode: TagMergeMode, tag: string, value: GObject.Value): void;
		/**
		 * Adds the given tag / GValue pairs on the setter using the given merge mode.
		 * The list must be terminated with %NULL.
		 * @param mode the mode to use
		 * @param tag tag to set
		 */
		add_tag_values(mode: TagMergeMode, tag: string): void;
		/**
		 * Adds the given tag / value pairs on the setter using the given merge mode.
		 * The list must be terminated with %NULL.
		 * @param mode the mode to use
		 * @param tag tag to set
		 */
		add_tags(mode: TagMergeMode, tag: string): void;
		/**
		 * Returns the current list of tags the setter uses.  The list should not be
		 * modified or freed.
		 * 
		 * This function is not thread-safe.
		 * @returns a current snapshot of the
		 *          taglist used in the setter or %NULL if none is used.
		 */
		get_tag_list(): TagList | null;
		/**
		 * Queries the mode by which tags inside the setter are overwritten by tags
		 * from events
		 * @returns the merge mode used inside the element.
		 */
		get_tag_merge_mode(): TagMergeMode;
		/**
		 * Merges the given list into the setter's list using the given mode.
		 * @param list a tag list to merge from
		 * @param mode the mode to merge with
		 */
		merge_tags(list: TagList, mode: TagMergeMode): void;
		/**
		 * Reset the internal taglist. Elements should call this from within the
		 * state-change handler.
		 */
		reset_tags(): void;
		/**
		 * Sets the given merge mode that is used for adding tags from events to tags
		 * specified by this interface. The default is #GST_TAG_MERGE_KEEP, which keeps
		 * the tags set with this interface and discards tags from events.
		 * @param mode The mode with which tags are added
		 */
		set_tag_merge_mode(mode: TagMergeMode): void;
	}

	type TagSetterInitOptionsMixin  = {};
	export interface TagSetterInitOptions extends TagSetterInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TagSetter} instead.
	 */
	type TagSetterMixin = ITagSetter;

	/**
	 * Element interface that allows setting of media metadata.
	 * 
	 * Elements that support changing a stream's metadata will implement this
	 * interface. Examples of such elements are 'vorbisenc', 'theoraenc' and
	 * 'id3v2mux'.
	 * 
	 * If you just want to retrieve metadata in your application then all you
	 * need to do is watch for tag messages on your pipeline's bus. This
	 * interface is only for setting metadata, not for extracting it. To set tags
	 * from the application, find tagsetter elements and set tags using e.g.
	 * {@link Gst.TagSetter.merge_tags} or gst_tag_setter_add_tags(). Also consider
	 * setting the {@link TagMergeMode} that is used for tag events that arrive at the
	 * tagsetter element (default mode is to keep existing tags).
	 * The application should do that before the element goes to %GST_STATE_PAUSED.
	 * 
	 * Elements implementing the #GstTagSetter interface often have to merge
	 * any tags received from upstream and the tags set by the application via
	 * the interface. This can be done like this:
	 * 
	 * |[<!-- language="C" -->
	 * GstTagMergeMode merge_mode;
	 * const GstTagList *application_tags;
	 * const GstTagList *event_tags;
	 * GstTagSetter *tagsetter;
	 * GstTagList *result;
	 * 
	 * tagsetter = GST_TAG_SETTER (element);
	 * 
	 * merge_mode = gst_tag_setter_get_tag_merge_mode (tagsetter);
	 * application_tags = gst_tag_setter_get_tag_list (tagsetter);
	 * event_tags = (const GstTagList *) element->event_tags;
	 * 
	 * GST_LOG_OBJECT (tagsetter, "merging tags, merge mode = %d", merge_mode);
	 * GST_LOG_OBJECT (tagsetter, "event tags: %" GST_PTR_FORMAT, event_tags);
	 * GST_LOG_OBJECT (tagsetter, "set   tags: %" GST_PTR_FORMAT, application_tags);
	 * 
	 * result = gst_tag_list_merge (application_tags, event_tags, merge_mode);
	 * 
	 * GST_LOG_OBJECT (tagsetter, "final tags: %" GST_PTR_FORMAT, result);
	 * ]|
	 */
	interface TagSetter extends TagSetterMixin {}

	class TagSetter {
		public constructor(options?: Partial<TagSetterInitOptions>);
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TocSetter} instead.
	 */
	interface ITocSetter {
		/**
		 * Return current TOC the setter uses. The TOC should not be
		 * modified without making it writable first.
		 * @returns TOC set, or %NULL. Unref with
		 *     {@link Gst.Toc.unref} when no longer needed
		 */
		get_toc(): Toc | null;
		/**
		 * Reset the internal TOC. Elements should call this from within the
		 * state-change handler.
		 */
		reset(): void;
		/**
		 * Set the given TOC on the setter. Previously set TOC will be
		 * unreffed before setting a new one.
		 * @param toc a {@link Toc} to set.
		 */
		set_toc(toc?: Toc | null): void;
	}

	type TocSetterInitOptionsMixin  = {};
	export interface TocSetterInitOptions extends TocSetterInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link TocSetter} instead.
	 */
	type TocSetterMixin = ITocSetter;

	/**
	 * Element interface that allows setting of the TOC.
	 * 
	 * Elements that support some kind of chapters or editions (or tracks like in
	 * the FLAC cue sheet) will implement this interface.
	 * 
	 * If you just want to retrieve the TOC in your application then all you
	 * need to do is watch for TOC messages on your pipeline's bus (or you can
	 * perform TOC query). This interface is only for setting TOC data, not for
	 * extracting it. To set TOC from the application, find proper tocsetter element
	 * and set TOC using {@link Gst.TocSetter.set_toc}.
	 * 
	 * Elements implementing the {@link TocSetter} interface can extend existing TOC
	 * by getting extend UID for that (you can use gst_toc_find_entry() to retrieve it)
	 * with any TOC entries received from downstream.
	 */
	interface TocSetter extends TocSetterMixin {}

	class TocSetter {
		public constructor(options?: Partial<TocSetterInitOptions>);
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link URIHandler} instead.
	 */
	interface IURIHandler {
		/**
		 * Gets the list of protocols supported by #handler. This list may not be
		 * modified.
		 * @returns the
		 *     supported protocols.  Returns %NULL if the #handler isn't
		 *     implemented properly, or the #handler doesn't support any
		 *     protocols.
		 */
		get_protocols(): string[] | null;
		/**
		 * Gets the currently handled URI.
		 * @returns the URI currently handled by
		 *   the #handler.  Returns %NULL if there are no URI currently
		 *   handled. The returned string must be freed with {@link G.free} when no
		 *   longer needed.
		 */
		get_uri(): string | null;
		/**
		 * Gets the type of the given URI handler
		 * @returns the {@link URIType} of the URI handler.
		 * Returns #GST_URI_UNKNOWN if the #handler isn't implemented correctly.
		 */
		get_uri_type(): URIType;
		/**
		 * Tries to set the URI of the given handler.
		 * @param uri URI to set
		 * @returns %TRUE if the URI was set successfully, else %FALSE.
		 */
		set_uri(uri: string): boolean;
	}

	type URIHandlerInitOptionsMixin  = {};
	export interface URIHandlerInitOptions extends URIHandlerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link URIHandler} instead.
	 */
	type URIHandlerMixin = IURIHandler;

	/**
	 * The {@link URIHandler} is an interface that is implemented by Source and Sink
	 * #GstElement to unify handling of URI.
	 * 
	 * An application can use the following functions to quickly get an element
	 * that handles the given URI for reading or writing
	 * {@link (gst.element_make_from_uri}).
	 * 
	 * Source and Sink plugins should implement this interface when possible.
	 */
	interface URIHandler extends URIHandlerMixin {}

	class URIHandler {
		public constructor(options?: Partial<URIHandlerInitOptions>);
	}



	/**
	 * The different types of buffering methods.
	 */
	enum BufferingMode {
		/**
		 * a small amount of data is buffered
		 */
		STREAM = 0,
		/**
		 * the stream is being downloaded
		 */
		DOWNLOAD = 1,
		/**
		 * the stream is being downloaded in a ringbuffer
		 */
		TIMESHIFT = 2,
		/**
		 * the stream is a live stream
		 */
		LIVE = 3
	}

	/**
	 * The result values for a GstBusSyncHandler.
	 */
	enum BusSyncReply {
		/**
		 * drop the message
		 */
		DROP = 0,
		/**
		 * pass the message to the async queue
		 */
		PASS = 1,
		/**
		 * pass message to async queue, continue if message is handled
		 */
		ASYNC = 2
	}

	/**
	 * Modes of caps intersection
	 * 
	 * #GST_CAPS_INTERSECT_ZIG_ZAG tries to preserve overall order of both caps
	 * by iterating on the caps' structures as the following matrix shows:
	 * |[
	 *          caps1
	 *       +-------------
	 *       | 1  2  4  7
	 * caps2 | 3  5  8 10
	 *       | 6  9 11 12
	 * ]|
	 * Used when there is no explicit precedence of one caps over the other. e.g.
	 * tee's sink pad getcaps function, it will probe its src pad peers' for their
	 * caps and intersect them with this mode.
	 * 
	 * #GST_CAPS_INTERSECT_FIRST is useful when an element wants to preserve
	 * another element's caps priority order when intersecting with its own caps.
	 * Example: If caps1 is [A, B, C] and caps2 is [E, B, D, A], the result
	 * would be [A, B], maintaining the first caps priority on the intersection.
	 */
	enum CapsIntersectMode {
		/**
		 * Zig-zags over both caps.
		 */
		ZIG_ZAG = 0,
		/**
		 * Keeps the first caps order.
		 */
		FIRST = 1
	}

	/**
	 * The type of the clock entry
	 */
	enum ClockEntryType {
		/**
		 * a single shot timeout
		 */
		SINGLE = 0,
		/**
		 * a periodic timeout request
		 */
		PERIODIC = 1
	}

	/**
	 * The return value of a clock operation.
	 */
	enum ClockReturn {
		/**
		 * The operation succeeded.
		 */
		OK = 0,
		/**
		 * The operation was scheduled too late.
		 */
		EARLY = 1,
		/**
		 * The clockID was unscheduled
		 */
		UNSCHEDULED = 2,
		/**
		 * The ClockID is busy
		 */
		BUSY = 3,
		/**
		 * A bad time was provided to a function.
		 */
		BADTIME = 4,
		/**
		 * An error occurred
		 */
		ERROR = 5,
		/**
		 * Operation is not supported
		 */
		UNSUPPORTED = 6,
		/**
		 * The ClockID is done waiting
		 */
		DONE = 7
	}

	/**
	 * The different kind of clocks.
	 */
	enum ClockType {
		/**
		 * time since Epoch
		 */
		REALTIME = 0,
		/**
		 * monotonic time since some unspecified starting
		 *                            point
		 */
		MONOTONIC = 1,
		/**
		 * some other time source is used (Since: 1.0.5)
		 */
		OTHER = 2,
		/**
		 * time since Epoch, but using International Atomic Time
		 *                      as reference (Since: 1.18)
		 */
		TAI = 3
	}

	/**
	 * Core errors are errors inside the core GStreamer library.
	 */
	enum CoreError {
		/**
		 * a general error which doesn't fit in any other
		 * category.  Make sure you add a custom message to the error call.
		 */
		FAILED = 1,
		/**
		 * do not use this except as a placeholder for
		 * deciding where to go while developing code.
		 */
		TOO_LAZY = 2,
		/**
		 * use this when you do not want to implement
		 * this functionality yet.
		 */
		NOT_IMPLEMENTED = 3,
		/**
		 * used for state change errors.
		 */
		STATE_CHANGE = 4,
		/**
		 * used for pad-related errors.
		 */
		PAD = 5,
		/**
		 * used for thread-related errors.
		 */
		THREAD = 6,
		/**
		 * used for negotiation-related errors.
		 */
		NEGOTIATION = 7,
		/**
		 * used for event-related errors.
		 */
		EVENT = 8,
		/**
		 * used for seek-related errors.
		 */
		SEEK = 9,
		/**
		 * used for caps-related errors.
		 */
		CAPS = 10,
		/**
		 * used for negotiation-related errors.
		 */
		TAG = 11,
		/**
		 * used if a plugin is missing.
		 */
		MISSING_PLUGIN = 12,
		/**
		 * used for clock related errors.
		 */
		CLOCK = 13,
		/**
		 * used if functionality has been disabled at
		 *                           compile time.
		 */
		DISABLED = 14,
		/**
		 * the number of core error types.
		 */
		NUM_ERRORS = 15
	}

	enum DebugColorMode {
		/**
		 * Do not use colors in logs.
		 */
		OFF = 0,
		/**
		 * Paint logs in a platform-specific way.
		 */
		ON = 1,
		/**
		 * Paint logs with UNIX terminal color codes
		 *                             no matter what platform GStreamer is running on.
		 */
		UNIX = 2
	}

	/**
	 * The level defines the importance of a debugging message. The more important a
	 * message is, the greater the probability that the debugging system outputs it.
	 */
	enum DebugLevel {
		/**
		 * No debugging level specified or desired. Used to deactivate
		 *  debugging output.
		 */
		NONE = 0,
		/**
		 * Error messages are to be used only when an error occurred
		 *  that stops the application from keeping working correctly.
		 *  An examples is gst_element_error, which outputs a message with this priority.
		 *  It does not mean that the application is terminating as with g_error.
		 */
		ERROR = 1,
		/**
		 * Warning messages are to inform about abnormal behaviour
		 *  that could lead to problems or weird behaviour later on. An example of this
		 *  would be clocking issues ("your computer is pretty slow") or broken input
		 *  data ("Can't synchronize to stream.")
		 */
		WARNING = 2,
		/**
		 * Fixme messages are messages that indicate that something
		 *  in the executed code path is not fully implemented or handled yet. Note
		 *  that this does not replace proper error handling in any way, the purpose
		 *  of this message is to make it easier to spot incomplete/unfinished pieces
		 *  of code when reading the debug log.
		 */
		FIXME = 3,
		/**
		 * Informational messages should be used to keep the developer
		 *  updated about what is happening.
		 *  Examples where this should be used are when a typefind function has
		 *  successfully determined the type of the stream or when an mp3 plugin detects
		 *  the format to be used. ("This file has mono sound.")
		 */
		INFO = 4,
		/**
		 * Debugging messages should be used when something common
		 *  happens that is not the expected default behavior, or something that's
		 *  useful to know but doesn't happen all the time (ie. per loop iteration or
		 *  buffer processed or event handled).
		 *  An example would be notifications about state changes or receiving/sending
		 *  of events.
		 */
		DEBUG = 5,
		/**
		 * Log messages are messages that are very common but might be
		 *  useful to know. As a rule of thumb a pipeline that is running as expected
		 *  should never output anything else but LOG messages whilst processing data.
		 *  Use this log level to log recurring information in chain functions and
		 *  loop functions, for example.
		 */
		LOG = 6,
		/**
		 * Tracing-related messages.
		 *  Examples for this are referencing/dereferencing of objects.
		 */
		TRACE = 7,
		/**
		 * memory dump messages are used to log (small) chunks of
		 *  data as memory dumps in the log. They will be displayed as hexdump with
		 *  ASCII characters.
		 */
		MEMDUMP = 9,
		/**
		 * The number of defined debugging levels.
		 */
		COUNT = 10
	}

	/**
	 * {@link EventType} lists the standard event types that can be sent in a pipeline.
	 * 
	 * The custom event types can be used for private messages between elements
	 * that can't be expressed using normal
	 * GStreamer buffer passing semantics. Custom events carry an arbitrary
	 * #GstStructure.
	 * Specific custom events are distinguished by the name of the structure.
	 */
	enum EventType {
		/**
		 * unknown event.
		 */
		UNKNOWN = 0,
		/**
		 * Start a flush operation. This event clears all data
		 *                 from the pipeline and unblock all streaming threads.
		 */
		FLUSH_START = 2563,
		/**
		 * Stop a flush operation. This event resets the
		 *                 running-time of the pipeline.
		 */
		FLUSH_STOP = 5127,
		/**
		 * Event to mark the start of a new stream. Sent before any
		 *                 other serialized event and only sent at the start of a new stream,
		 *                 not after flushing seeks.
		 */
		STREAM_START = 10254,
		/**
		 * {@link Caps} event. Notify the pad of a new media type.
		 */
		CAPS = 12814,
		/**
		 * A new media segment follows in the dataflow. The
		 *                 segment events contains information for clipping buffers and
		 *                 converting buffer timestamps to running-time and
		 *                 stream-time.
		 */
		SEGMENT = 17934,
		/**
		 * A new {@link StreamCollection} is available (Since: 1.10)
		 */
		STREAM_COLLECTION = 19230,
		/**
		 * A new set of metadata tags has been found in the stream.
		 */
		TAG = 20510,
		/**
		 * Notification of buffering requirements. Currently not
		 *                 used yet.
		 */
		BUFFERSIZE = 23054,
		/**
		 * An event that sinks turn into a message. Used to
		 *                          send messages that should be emitted in sync with
		 *                          rendering.
		 */
		SINK_MESSAGE = 25630,
		/**
		 * Indicates that there is no more data for
		 *                 the stream group ID in the message. Sent before EOS
		 *                 in some instances and should be handled mostly the same. (Since: 1.10)
		 */
		STREAM_GROUP_DONE = 26894,
		/**
		 * End-Of-Stream. No more data is to be expected to follow
		 *                 without either a STREAM_START event, or a FLUSH_STOP and a SEGMENT
		 *                 event.
		 */
		EOS = 28174,
		/**
		 * An event which indicates that a new table of contents (TOC)
		 *                 was found or updated.
		 */
		TOC = 30750,
		/**
		 * An event which indicates that new or updated
		 *                 encryption information has been found in the stream.
		 */
		PROTECTION = 33310,
		/**
		 * Marks the end of a segment playback.
		 */
		SEGMENT_DONE = 38406,
		/**
		 * Marks a gap in the datastream.
		 */
		GAP = 40966,
		/**
		 * Notify downstream that a playback rate override
		 *                                 should be applied as soon as possible. (Since: 1.18)
		 */
		INSTANT_RATE_CHANGE = 46090,
		/**
		 * A quality message. Used to indicate to upstream elements
		 *                 that the downstream elements should adjust their processing
		 *                 rate.
		 */
		QOS = 48641,
		/**
		 * A request for a new playback position and rate.
		 */
		SEEK = 51201,
		/**
		 * Navigation events are usually used for communicating
		 *                        user requests, such as mouse or keyboard movements,
		 *                        to upstream elements.
		 */
		NAVIGATION = 53761,
		/**
		 * Notification of new latency adjustment. Sinks will use
		 *                     the latency information to adjust their synchronisation.
		 */
		LATENCY = 56321,
		/**
		 * A request for stepping through the media. Sinks will usually
		 *                  execute the step operation.
		 */
		STEP = 58881,
		/**
		 * A request for upstream renegotiating caps and reconfiguring.
		 */
		RECONFIGURE = 61441,
		/**
		 * A request for a new playback position based on TOC
		 *                        entry's UID.
		 */
		TOC_SELECT = 64001,
		/**
		 * A request to select one or more streams (Since: 1.10)
		 */
		SELECT_STREAMS = 66561,
		/**
		 * Sent by the pipeline to notify elements that handle the
		 *                                    instant-rate-change event about the running-time when
		 *                                    the rate multiplier should be applied (or was applied). (Since: 1.18)
		 */
		INSTANT_RATE_SYNC_TIME = 66817,
		/**
		 * Upstream custom event
		 */
		CUSTOM_UPSTREAM = 69121,
		/**
		 * Downstream custom event that travels in the
		 *                        data flow.
		 */
		CUSTOM_DOWNSTREAM = 71686,
		/**
		 * Custom out-of-band downstream event.
		 */
		CUSTOM_DOWNSTREAM_OOB = 74242,
		/**
		 * Custom sticky downstream event.
		 */
		CUSTOM_DOWNSTREAM_STICKY = 76830,
		/**
		 * Custom upstream or downstream event.
		 *                         In-band when travelling downstream.
		 */
		CUSTOM_BOTH = 79367,
		/**
		 * Custom upstream or downstream out-of-band event.
		 */
		CUSTOM_BOTH_OOB = 81923
	}

	/**
	 * The result of passing data to a pad.
	 * 
	 * Note that the custom return values should not be exposed outside of the
	 * element scope.
	 */
	enum FlowReturn {
		/**
		 * Pre-defined custom success code.
		 */
		CUSTOM_SUCCESS_2 = 102,
		/**
		 * Pre-defined custom success code (define your
		 *                               custom success code to this to avoid compiler
		 *                               warnings).
		 */
		CUSTOM_SUCCESS_1 = 101,
		/**
		 * Elements can use values starting from
		 *                               this (and higher) to define custom success
		 *                               codes.
		 */
		CUSTOM_SUCCESS = 100,
		/**
		 * Data passing was ok.
		 */
		OK = 0,
		/**
		 * Pad is not linked.
		 */
		NOT_LINKED = -1,
		/**
		 * Pad is flushing.
		 */
		FLUSHING = -2,
		/**
		 * Pad is EOS.
		 */
		EOS = -3,
		/**
		 * Pad is not negotiated.
		 */
		NOT_NEGOTIATED = -4,
		/**
		 * Some (fatal) error occurred. Element generating
		 *                               this error should post an error message using
		 *                               {@link GST.ELEMENT_ERROR} with more details.
		 */
		ERROR = -5,
		/**
		 * This operation is not supported.
		 */
		NOT_SUPPORTED = -6,
		/**
		 * Elements can use values starting from
		 *                               this (and lower) to define custom error codes.
		 */
		CUSTOM_ERROR = -100,
		/**
		 * Pre-defined custom error code (define your
		 *                               custom error code to this to avoid compiler
		 *                               warnings).
		 */
		CUSTOM_ERROR_1 = -101,
		/**
		 * Pre-defined custom error code.
		 */
		CUSTOM_ERROR_2 = -102
	}

	/**
	 * Standard predefined formats
	 */
	enum Format {
		/**
		 * undefined format
		 */
		UNDEFINED = 0,
		/**
		 * the default format of the pad/element. This can be
		 *    samples for raw audio, frames/fields for raw video (some, but not all,
		 *    elements support this; use #GST_FORMAT_TIME if you don't have a good
		 *    reason to query for samples/frames)
		 */
		DEFAULT = 1,
		/**
		 * bytes
		 */
		BYTES = 2,
		/**
		 * time in nanoseconds
		 */
		TIME = 3,
		/**
		 * buffers (few, if any, elements implement this as of
		 *     May 2009)
		 */
		BUFFERS = 4,
		/**
		 * percentage of stream (few, if any, elements implement
		 *     this as of May 2009)
		 */
		PERCENT = 5
	}

	/**
	 * The result of a {@link IteratorItemFunction}.
	 */
	enum IteratorItem {
		/**
		 * Skip this item
		 */
		SKIP = 0,
		/**
		 * Return item
		 */
		PASS = 1,
		/**
		 * Stop after this item.
		 */
		END = 2
	}

	/**
	 * The result of {@link Gst.Iterator.next}.
	 */
	enum IteratorResult {
		/**
		 * No more items in the iterator
		 */
		DONE = 0,
		/**
		 * An item was retrieved
		 */
		OK = 1,
		/**
		 * Datastructure changed while iterating
		 */
		RESYNC = 2,
		/**
		 * An error happened
		 */
		ERROR = 3
	}

	/**
	 * Library errors are for errors from the library being used by elements
	 * (initializing, finalizing, settings, ...)
	 */
	enum LibraryError {
		/**
		 * a general error which doesn't fit in any other
		 * category.  Make sure you add a custom message to the error call.
		 */
		FAILED = 1,
		/**
		 * do not use this except as a placeholder for
		 * deciding where to go while developing code.
		 */
		TOO_LAZY = 2,
		/**
		 * used when the library could not be opened.
		 */
		INIT = 3,
		/**
		 * used when the library could not be closed.
		 */
		SHUTDOWN = 4,
		/**
		 * used when the library doesn't accept settings.
		 */
		SETTINGS = 5,
		/**
		 * used when the library generated an encoding error.
		 */
		ENCODE = 6,
		/**
		 * the number of library error types.
		 */
		NUM_ERRORS = 7
	}

	/**
	 * The direction of a pad.
	 */
	enum PadDirection {
		/**
		 * direction is unknown.
		 */
		UNKNOWN = 0,
		/**
		 * the pad is a source pad.
		 */
		SRC = 1,
		/**
		 * the pad is a sink pad.
		 */
		SINK = 2
	}

	/**
	 * Result values from gst_pad_link and friends.
	 */
	enum PadLinkReturn {
		/**
		 * link succeeded
		 */
		OK = 0,
		/**
		 * pads have no common grandparent
		 */
		WRONG_HIERARCHY = -1,
		/**
		 * pad was already linked
		 */
		WAS_LINKED = -2,
		/**
		 * pads have wrong direction
		 */
		WRONG_DIRECTION = -3,
		/**
		 * pads do not have common format
		 */
		NOFORMAT = -4,
		/**
		 * pads cannot cooperate in scheduling
		 */
		NOSCHED = -5,
		/**
		 * refused for some reason
		 */
		REFUSED = -6
	}

	/**
	 * The status of a GstPad. After activating a pad, which usually happens when the
	 * parent element goes from READY to PAUSED, the GstPadMode defines if the
	 * pad operates in push or pull mode.
	 */
	enum PadMode {
		/**
		 * Pad will not handle dataflow
		 */
		NONE = 0,
		/**
		 * Pad handles dataflow in downstream push mode
		 */
		PUSH = 1,
		/**
		 * Pad handles dataflow in upstream pull mode
		 */
		PULL = 2
	}

	/**
	 * Indicates when this pad will become available.
	 */
	enum PadPresence {
		/**
		 * the pad is always available
		 */
		ALWAYS = 0,
		/**
		 * the pad will become available depending on the media stream
		 */
		SOMETIMES = 1,
		/**
		 * the pad is only available on request with
		 *  {@link Gst.Element.request_pad}.
		 */
		REQUEST = 2
	}

	/**
	 * Different return values for the {@link PadProbeCallback}.
	 */
	enum PadProbeReturn {
		/**
		 * drop data in data probes. For push mode this means that
		 *        the data item is not sent downstream. For pull mode, it means that
		 *        the data item is not passed upstream. In both cases, no other probes
		 *        are called for this item and %GST_FLOW_OK or %TRUE is returned to the
		 *        caller.
		 */
		DROP = 0,
		/**
		 * normal probe return value. This leaves the probe in
		 *        place, and defers decisions about dropping or passing data to other
		 *        probes, if any. If there are no other probes, the default behaviour
		 *        for the probe type applies ('block' for blocking probes,
		 *        and 'pass' for non-blocking probes).
		 */
		OK = 1,
		/**
		 * remove this probe.
		 */
		REMOVE = 2,
		/**
		 * pass the data item in the block probe and block on the
		 *        next item.
		 */
		PASS = 3,
		/**
		 * Data has been handled in the probe and will not be
		 *        forwarded further. For events and buffers this is the same behaviour as
		 *        %GST_PAD_PROBE_DROP (except that in this case you need to unref the buffer
		 *        or event yourself). For queries it will also return %TRUE to the caller.
		 *        The probe can also modify the {@link FlowReturn} value by using the
		 *        {@link #GST.PAD_PROBE_INFO_FLOW_RETURN} accessor.
		 *        Note that the resulting query must contain valid entries.
		 *        Since: 1.6
		 */
		HANDLED = 4
	}

	/**
	 * The different parsing errors that can occur.
	 */
	enum ParseError {
		/**
		 * A syntax error occurred.
		 */
		SYNTAX = 0,
		/**
		 * The description contained an unknown element
		 */
		NO_SUCH_ELEMENT = 1,
		/**
		 * An element did not have a specified property
		 */
		NO_SUCH_PROPERTY = 2,
		/**
		 * There was an error linking two pads.
		 */
		LINK = 3,
		/**
		 * There was an error setting a property
		 */
		COULD_NOT_SET_PROPERTY = 4,
		/**
		 * An empty bin was specified.
		 */
		EMPTY_BIN = 5,
		/**
		 * An empty description was specified
		 */
		EMPTY = 6,
		/**
		 * A delayed link did not get resolved.
		 */
		DELAYED_LINK = 7
	}

	/**
	 * The plugin loading errors
	 */
	enum PluginError {
		/**
		 * The plugin could not be loaded
		 */
		MODULE = 0,
		/**
		 * The plugin has unresolved dependencies
		 */
		DEPENDENCIES = 1,
		/**
		 * The plugin has already be loaded from a different file
		 */
		NAME_MISMATCH = 2
	}

	/**
	 * The type of a %GST_MESSAGE_PROGRESS. The progress messages inform the
	 * application of the status of asynchronous tasks.
	 */
	enum ProgressType {
		/**
		 * A new task started.
		 */
		START = 0,
		/**
		 * A task completed and a new one continues.
		 */
		CONTINUE = 1,
		/**
		 * A task completed.
		 */
		COMPLETE = 2,
		/**
		 * A task was canceled.
		 */
		CANCELED = 3,
		/**
		 * A task caused an error. An error message is also
		 *          posted on the bus.
		 */
		ERROR = 4
	}

	/**
	 * The result of a {@link Promise}
	 */
	enum PromiseResult {
		/**
		 * Initial state. Waiting for transition to any
		 * 	other state.
		 */
		PENDING = 0,
		/**
		 * Interrupted by the consumer as it doesn't
		 * 	want the value anymore.
		 */
		INTERRUPTED = 1,
		/**
		 * A producer marked a reply
		 */
		REPLIED = 2,
		/**
		 * The promise expired (the carrying object
		 * 	lost all refs) and the promise will never be fulfilled.
		 */
		EXPIRED = 3
	}

	/**
	 * The different types of QoS events that can be given to the
	 * {@link Gst.Event.new_qos} method.
	 */
	enum QOSType {
		/**
		 * The QoS event type that is produced when upstream
		 *    elements are producing data too quickly and the element can't keep up
		 *    processing the data. Upstream should reduce their production rate. This
		 *    type is also used when buffers arrive early or in time.
		 */
		OVERFLOW = 0,
		/**
		 * The QoS event type that is produced when upstream
		 *    elements are producing data too slowly and need to speed up their
		 *    production rate.
		 */
		UNDERFLOW = 1,
		/**
		 * The QoS event type that is produced when the
		 *    application enabled throttling to limit the data rate.
		 */
		THROTTLE = 2
	}

	/**
	 * Standard predefined Query types
	 */
	enum QueryType {
		/**
		 * unknown query type
		 */
		UNKNOWN = 0,
		/**
		 * current position in stream
		 */
		POSITION = 2563,
		/**
		 * total duration of the stream
		 */
		DURATION = 5123,
		/**
		 * latency of stream
		 */
		LATENCY = 7683,
		/**
		 * current jitter of stream
		 */
		JITTER = 10243,
		/**
		 * current rate of the stream
		 */
		RATE = 12803,
		/**
		 * seeking capabilities
		 */
		SEEKING = 15363,
		/**
		 * segment start/stop positions
		 */
		SEGMENT = 17923,
		/**
		 * convert values between formats
		 */
		CONVERT = 20483,
		/**
		 * query supported formats for convert
		 */
		FORMATS = 23043,
		/**
		 * query available media for efficient seeking.
		 */
		BUFFERING = 28163,
		/**
		 * a custom application or element defined query.
		 */
		CUSTOM = 30723,
		/**
		 * query the URI of the source or sink.
		 */
		URI = 33283,
		/**
		 * the buffer allocation properties
		 */
		ALLOCATION = 35846,
		/**
		 * the scheduling properties
		 */
		SCHEDULING = 38401,
		/**
		 * the accept caps query
		 */
		ACCEPT_CAPS = 40963,
		/**
		 * the caps query
		 */
		CAPS = 43523,
		/**
		 * wait till all serialized data is consumed downstream
		 */
		DRAIN = 46086,
		/**
		 * query the pipeline-local context from
		 *     downstream or upstream (since 1.2)
		 */
		CONTEXT = 48643,
		/**
		 * the bitrate query (since 1.16)
		 */
		BITRATE = 51202
	}

	/**
	 * Element priority ranks. Defines the order in which the autoplugger (or
	 * similar rank-picking mechanisms, such as e.g. {@link Gst.Element.make_from_uri})
	 * will choose this element over an alternative one with the same function.
	 * 
	 * These constants serve as a rough guidance for defining the rank of a
	 * {@link PluginFeature}. Any value is valid, including values bigger than
	 * #GST_RANK_PRIMARY.
	 */
	enum Rank {
		/**
		 * will be chosen last or not at all
		 */
		NONE = 0,
		/**
		 * unlikely to be chosen
		 */
		MARGINAL = 64,
		/**
		 * likely to be chosen
		 */
		SECONDARY = 128,
		/**
		 * will be chosen first
		 */
		PRIMARY = 256
	}

	/**
	 * Resource errors are for any resource used by an element:
	 * memory, files, network connections, process space, ...
	 * They're typically used by source and sink elements.
	 */
	enum ResourceError {
		/**
		 * a general error which doesn't fit in any other
		 * category.  Make sure you add a custom message to the error call.
		 */
		FAILED = 1,
		/**
		 * do not use this except as a placeholder for
		 * deciding where to go while developing code.
		 */
		TOO_LAZY = 2,
		/**
		 * used when the resource could not be found.
		 */
		NOT_FOUND = 3,
		/**
		 * used when resource is busy.
		 */
		BUSY = 4,
		/**
		 * used when resource fails to open for reading.
		 */
		OPEN_READ = 5,
		/**
		 * used when resource fails to open for writing.
		 */
		OPEN_WRITE = 6,
		/**
		 * used when resource cannot be opened for
		 * both reading and writing, or either (but unspecified which).
		 */
		OPEN_READ_WRITE = 7,
		/**
		 * used when the resource can't be closed.
		 */
		CLOSE = 8,
		/**
		 * used when the resource can't be read from.
		 */
		READ = 9,
		/**
		 * used when the resource can't be written to.
		 */
		WRITE = 10,
		/**
		 * used when a seek on the resource fails.
		 */
		SEEK = 11,
		/**
		 * used when a synchronize on the resource fails.
		 */
		SYNC = 12,
		/**
		 * used when settings can't be manipulated on.
		 */
		SETTINGS = 13,
		/**
		 * used when the resource has no space left.
		 */
		NO_SPACE_LEFT = 14,
		/**
		 * used when the resource can't be opened
		 *                                     due to missing authorization.
		 *                                     (Since: 1.2.4)
		 */
		NOT_AUTHORIZED = 15,
		/**
		 * the number of resource error types.
		 */
		NUM_ERRORS = 16
	}

	/**
	 * The different search modes.
	 */
	enum SearchMode {
		/**
		 * Only search for exact matches.
		 */
		EXACT = 0,
		/**
		 * Search for an exact match or the element just before.
		 */
		BEFORE = 1,
		/**
		 * Search for an exact match or the element just after.
		 */
		AFTER = 2
	}

	/**
	 * The different types of seek events. When constructing a seek event with
	 * {@link Gst.Event.new_seek} or when doing gst_segment_do_seek ().
	 */
	enum SeekType {
		/**
		 * no change in position is required
		 */
		NONE = 0,
		/**
		 * absolute position is requested
		 */
		SET = 1,
		/**
		 * relative position to duration is requested
		 */
		END = 2
	}

	/**
	 * The possible states an element can be in. States can be changed using
	 * {@link Gst.Element.set_state} and checked using gst_element_get_state().
	 */
	enum State {
		/**
		 * no pending state.
		 */
		VOID_PENDING = 0,
		/**
		 * the NULL state or initial state of an element.
		 */
		NULL = 1,
		/**
		 * the element is ready to go to PAUSED.
		 */
		READY = 2,
		/**
		 * the element is PAUSED, it is ready to accept and
		 *                          process data. Sink elements however only accept one
		 *                          buffer and then block.
		 */
		PAUSED = 3,
		/**
		 * the element is PLAYING, the {@link Clock} is running and
		 *                          the data is flowing.
		 */
		PLAYING = 4
	}

	/**
	 * These are the different state changes an element goes through.
	 * %GST_STATE_NULL &rArr; %GST_STATE_PLAYING is called an upwards state change
	 * and %GST_STATE_PLAYING &rArr; %GST_STATE_NULL a downwards state change.
	 */
	enum StateChange {
		/**
		 * state change from NULL to READY.
		 *   * The element must check if the resources it needs are available. Device
		 *     sinks and -sources typically try to probe the device to constrain their
		 *     caps.
		 *   * The element opens the device (in case feature need to be probed).
		 */
		NULL_TO_READY = 10,
		/**
		 * state change from READY to PAUSED.
		 *   * The element pads are activated in order to receive data in PAUSED.
		 *     Streaming threads are started.
		 *   * Some elements might need to return %GST_STATE_CHANGE_ASYNC and complete
		 *     the state change when they have enough information. It is a requirement
		 *     for sinks to return %GST_STATE_CHANGE_ASYNC and complete the state change
		 *     when they receive the first buffer or %GST_EVENT_EOS (preroll).
		 *     Sinks also block the dataflow when in PAUSED.
		 *   * A pipeline resets the running_time to 0.
		 *   * Live sources return %GST_STATE_CHANGE_NO_PREROLL and don't generate data.
		 */
		READY_TO_PAUSED = 19,
		/**
		 * state change from PAUSED to PLAYING.
		 *   * Most elements ignore this state change.
		 *   * The pipeline selects a {@link Clock} and distributes this to all the children
		 *     before setting them to PLAYING. This means that it is only allowed to
		 *     synchronize on the #GstClock in the PLAYING state.
		 *   * The pipeline uses the #GstClock and the running_time to calculate the
		 *     base_time. The base_time is distributed to all children when performing
		 *     the state change.
		 *   * Sink elements stop blocking on the preroll buffer or event and start
		 *     rendering the data.
		 *   * Sinks can post %GST_MESSAGE_EOS in the PLAYING state. It is not allowed
		 *     to post %GST_MESSAGE_EOS when not in the PLAYING state.
		 *   * While streaming in PAUSED or PLAYING elements can create and remove
		 *     sometimes pads.
		 *   * Live sources start generating data and return %GST_STATE_CHANGE_SUCCESS.
		 */
		PAUSED_TO_PLAYING = 28,
		/**
		 * state change from PLAYING to PAUSED.
		 *   * Most elements ignore this state change.
		 *   * The pipeline calculates the running_time based on the last selected
		 *     {@link Clock} and the base_time. It stores this information to continue
		 *     playback when going back to the PLAYING state.
		 *   * Sinks unblock any #GstClock wait calls.
		 *   * When a sink does not have a pending buffer to play, it returns
		 *     #GST_STATE_CHANGE_ASYNC from this state change and completes the state
		 *     change when it receives a new buffer or an %GST_EVENT_EOS.
		 *   * Any queued %GST_MESSAGE_EOS items are removed since they will be reposted
		 *     when going back to the PLAYING state. The EOS messages are queued in
		 *     #GstBin containers.
		 *   * Live sources stop generating data and return %GST_STATE_CHANGE_NO_PREROLL.
		 */
		PLAYING_TO_PAUSED = 35,
		/**
		 * state change from PAUSED to READY.
		 *   * Sinks unblock any waits in the preroll.
		 *   * Elements unblock any waits on devices
		 *   * Chain or get_range functions return %GST_FLOW_FLUSHING.
		 *   * The element pads are deactivated so that streaming becomes impossible and
		 *     all streaming threads are stopped.
		 *   * The sink forgets all negotiated formats
		 *   * Elements remove all sometimes pads
		 */
		PAUSED_TO_READY = 26,
		/**
		 * state change from READY to NULL.
		 *   * Elements close devices
		 *   * Elements reset any internal state.
		 */
		READY_TO_NULL = 17,
		/**
		 * state change from NULL to NULL. (Since: 1.14)
		 */
		NULL_TO_NULL = 9,
		/**
		 * state change from READY to READY,
		 * This might happen when going to PAUSED asynchronously failed, in that case
		 * elements should make sure they are in a proper, coherent READY state. (Since: 1.14)
		 */
		READY_TO_READY = 18,
		/**
		 * state change from PAUSED to PAUSED.
		 * This might happen when elements were in PLAYING state and 'lost state',
		 * they should make sure to go back to real 'PAUSED' state (prerolling for example). (Since: 1.14)
		 */
		PAUSED_TO_PAUSED = 27,
		/**
		 * state change from PLAYING to PLAYING. (Since: 1.14)
		 */
		PLAYING_TO_PLAYING = 36
	}

	/**
	 * The possible return values from a state change function such as
	 * {@link Gst.Element.set_state}. Only #GST_STATE_CHANGE_FAILURE is a real failure.
	 */
	enum StateChangeReturn {
		/**
		 * the state change failed
		 */
		FAILURE = 0,
		/**
		 * the state change succeeded
		 */
		SUCCESS = 1,
		/**
		 * the state change will happen asynchronously
		 */
		ASYNC = 2,
		/**
		 * the state change succeeded but the element
		 *                               cannot produce data in %GST_STATE_PAUSED.
		 *                               This typically happens with live sources.
		 */
		NO_PREROLL = 3
	}

	/**
	 * Stream errors are for anything related to the stream being processed:
	 * format errors, media type errors, ...
	 * They're typically used by decoders, demuxers, converters, ...
	 */
	enum StreamError {
		/**
		 * a general error which doesn't fit in any other
		 * category.  Make sure you add a custom message to the error call.
		 */
		FAILED = 1,
		/**
		 * do not use this except as a placeholder for
		 * deciding where to go while developing code.
		 */
		TOO_LAZY = 2,
		/**
		 * use this when you do not want to implement
		 * this functionality yet.
		 */
		NOT_IMPLEMENTED = 3,
		/**
		 * used when the element doesn't know the
		 * stream's type.
		 */
		TYPE_NOT_FOUND = 4,
		/**
		 * used when the element doesn't handle this type
		 * of stream.
		 */
		WRONG_TYPE = 5,
		/**
		 * used when there's no codec to handle the
		 * stream's type.
		 */
		CODEC_NOT_FOUND = 6,
		/**
		 * used when decoding fails.
		 */
		DECODE = 7,
		/**
		 * used when encoding fails.
		 */
		ENCODE = 8,
		/**
		 * used when demuxing fails.
		 */
		DEMUX = 9,
		/**
		 * used when muxing fails.
		 */
		MUX = 10,
		/**
		 * used when the stream is of the wrong format
		 * (for example, wrong caps).
		 */
		FORMAT = 11,
		/**
		 * used when the stream is encrypted and can't be
		 * decrypted because this is not supported by the element.
		 */
		DECRYPT = 12,
		/**
		 * used when the stream is encrypted and
		 * can't be decrypted because no suitable key is available.
		 */
		DECRYPT_NOKEY = 13,
		/**
		 * the number of stream error types.
		 */
		NUM_ERRORS = 14
	}

	/**
	 * The type of a %GST_MESSAGE_STREAM_STATUS. The stream status messages inform the
	 * application of new streaming threads and their status.
	 */
	enum StreamStatusType {
		/**
		 * A new thread need to be created.
		 */
		CREATE = 0,
		/**
		 * a thread entered its loop function
		 */
		ENTER = 1,
		/**
		 * a thread left its loop function
		 */
		LEAVE = 2,
		/**
		 * a thread is destroyed
		 */
		DESTROY = 3,
		/**
		 * a thread is started
		 */
		START = 8,
		/**
		 * a thread is paused
		 */
		PAUSE = 9,
		/**
		 * a thread is stopped
		 */
		STOP = 10
	}

	/**
	 * The type of a %GST_MESSAGE_STRUCTURE_CHANGE.
	 */
	enum StructureChangeType {
		/**
		 * Pad linking is starting or done.
		 */
		LINK = 0,
		/**
		 * Pad unlinking is starting or done.
		 */
		UNLINK = 1
	}

	/**
	 * Extra tag flags used when registering tags.
	 */
	enum TagFlag {
		/**
		 * undefined flag
		 */
		UNDEFINED = 0,
		/**
		 * tag is meta data
		 */
		META = 1,
		/**
		 * tag is encoded
		 */
		ENCODED = 2,
		/**
		 * tag is decoded
		 */
		DECODED = 3,
		/**
		 * number of tag flags
		 */
		COUNT = 4
	}

	/**
	 * The different tag merging modes are basically replace, overwrite and append,
	 * but they can be seen from two directions. Given two taglists: (A) the tags
	 * already in the element and (B) the ones that are supplied to the element (
	 * e.g. via {@link Gst.TagSetter.merge_tags} / gst_tag_setter_add_tags() or a
	 * %GST_EVENT_TAG), how are these tags merged?
	 * In the table below this is shown for the cases that a tag exists in the list
	 * (A) or does not exists (!A) and combinations thereof.
	 * 
	 * | merge mode  | A + B | A + !B | !A + B | !A + !B |
	 * | ----------- | ----- | ------ | ------ | ------- |
	 * | REPLACE_ALL | B     | ø      | B      | ø       |
	 * | REPLACE     | B     | A      | B      | ø       |
	 * | APPEND      | A, B  | A      | B      | ø       |
	 * | PREPEND     | B, A  | A      | B      | ø       |
	 * | KEEP        | A     | A      | B      | ø       |
	 * | KEEP_ALL    | A     | A      | ø      | ø       |
	 */
	enum TagMergeMode {
		/**
		 * undefined merge mode
		 */
		UNDEFINED = 0,
		/**
		 * replace all tags (clear list and append)
		 */
		REPLACE_ALL = 1,
		/**
		 * replace tags
		 */
		REPLACE = 2,
		/**
		 * append tags
		 */
		APPEND = 3,
		/**
		 * prepend tags
		 */
		PREPEND = 4,
		/**
		 * keep existing tags
		 */
		KEEP = 5,
		/**
		 * keep all existing tags
		 */
		KEEP_ALL = 6,
		/**
		 * the number of merge modes
		 */
		COUNT = 7
	}

	/**
	 * GstTagScope specifies if a taglist applies to the complete
	 * medium or only to one single stream.
	 */
	enum TagScope {
		/**
		 * tags specific to this single stream
		 */
		STREAM = 0,
		/**
		 * global tags for the complete medium
		 */
		GLOBAL = 1
	}

	/**
	 * The different states a task can be in
	 */
	enum TaskState {
		/**
		 * the task is started and running
		 */
		STARTED = 0,
		/**
		 * the task is stopped
		 */
		STOPPED = 1,
		/**
		 * the task is paused
		 */
		PAUSED = 2
	}

	/**
	 * The different types of TOC entries (see {@link TocEntry}).
	 * 
	 * There are two types of TOC entries: alternatives or parts in a sequence.
	 */
	enum TocEntryType {
		/**
		 * entry is an angle (i.e. an alternative)
		 */
		ANGLE = -3,
		/**
		 * entry is a version (i.e. alternative)
		 */
		VERSION = -2,
		/**
		 * entry is an edition (i.e. alternative)
		 */
		EDITION = -1,
		/**
		 * invalid entry type value
		 */
		INVALID = 0,
		/**
		 * entry is a title (i.e. a part of a sequence)
		 */
		TITLE = 1,
		/**
		 * entry is a track (i.e. a part of a sequence)
		 */
		TRACK = 2,
		/**
		 * entry is a chapter (i.e. a part of a sequence)
		 */
		CHAPTER = 3
	}

	/**
	 * How a {@link TocEntry} should be repeated. By default, entries are played a
	 * single time.
	 */
	enum TocLoopType {
		/**
		 * single forward playback
		 */
		NONE = 0,
		/**
		 * repeat forward
		 */
		FORWARD = 1,
		/**
		 * repeat backward
		 */
		REVERSE = 2,
		/**
		 * repeat forward and backward
		 */
		PING_PONG = 3
	}

	/**
	 * The scope of a TOC.
	 */
	enum TocScope {
		/**
		 * global TOC representing all selectable options
		 *     (this is what applications are usually interested in)
		 */
		GLOBAL = 1,
		/**
		 * TOC for the currently active/selected stream
		 *     (this is a TOC representing the current stream from start to EOS,
		 *     and is what a TOC writer / muxer is usually interested in; it will
		 *     usually be a subset of the global TOC, e.g. just the chapters of
		 *     the current title, or the chapters selected for playback from the
		 *     current title)
		 */
		CURRENT = 2
	}

	/**
	 * Tracing record will contain fields that contain a measured value or extra
	 * meta-data. One such meta data are values that tell where a measurement was
	 * taken. This enumerating declares to which scope such a meta data field
	 * relates to. If it is e.g. %GST_TRACER_VALUE_SCOPE_PAD, then each of the log
	 * events may contain values for different {@link Pads}.
	 */
	enum TracerValueScope {
		/**
		 * the value is related to the process
		 */
		PROCESS = 0,
		/**
		 * the value is related to a thread
		 */
		THREAD = 1,
		/**
		 * the value is related to an {@link Element}
		 */
		ELEMENT = 2,
		/**
		 * the value is related to a {@link Pad}
		 */
		PAD = 3
	}

	/**
	 * The probability of the typefind function. Higher values have more certainty
	 * in doing a reliable typefind.
	 */
	enum TypeFindProbability {
		/**
		 * type undetected.
		 */
		NONE = 0,
		/**
		 * unlikely typefind.
		 */
		MINIMUM = 1,
		/**
		 * possible type detected.
		 */
		POSSIBLE = 50,
		/**
		 * likely a type was detected.
		 */
		LIKELY = 80,
		/**
		 * nearly certain that a type was detected.
		 */
		NEARLY_CERTAIN = 99,
		/**
		 * very certain a type was detected.
		 */
		MAXIMUM = 100
	}

	/**
	 * Different URI-related errors that can occur.
	 */
	enum URIError {
		/**
		 * The protocol is not supported
		 */
		UNSUPPORTED_PROTOCOL = 0,
		/**
		 * There was a problem with the URI
		 */
		BAD_URI = 1,
		/**
		 * Could not set or change the URI because the
		 *     URI handler was in a state where that is not possible or not permitted
		 */
		BAD_STATE = 2,
		/**
		 * There was a problem with the entity that
		 *     the URI references
		 */
		BAD_REFERENCE = 3
	}

	/**
	 * The different types of URI direction.
	 */
	enum URIType {
		/**
		 * The URI direction is unknown
		 */
		UNKNOWN = 0,
		/**
		 * The URI is a consumer.
		 */
		SINK = 1,
		/**
		 * The URI is a producer.
		 */
		SRC = 2
	}

	/**
	 * Flags for allocators.
	 */
	enum AllocatorFlags {
		/**
		 * The allocator has a custom alloc function.
		 */
		CUSTOM_ALLOC = 16,
		/**
		 * first flag that can be used for custom purposes
		 */
		LAST = 1048576
	}

	/**
	 * GstBinFlags are a set of flags specific to bins. Most are set/used
	 * internally. They can be checked using the GST_OBJECT_FLAG_IS_SET () macro,
	 * and (un)set using GST_OBJECT_FLAG_SET () and GST_OBJECT_FLAG_UNSET ().
	 */
	enum BinFlags {
		/**
		 * don't resync a state change when elements are
		 *             added or linked in the bin (Since: 1.0.5)
		 */
		NO_RESYNC = 16384,
		/**
		 * Indicates whether the bin can handle elements
		 *             that add/remove source pads at any point in time without
		 *             first posting a no-more-pads signal (Since: 1.10)
		 */
		STREAMS_AWARE = 32768,
		/**
		 * the last enum in the series of flags for bins.
		 * Derived classes can use this as first value in a list of flags.
		 */
		LAST = 524288
	}

	/**
	 * A set of flags that can be provided to the {@link Gst.Buffer.copy_into}
	 * function to specify which items should be copied.
	 */
	enum BufferCopyFlags {
		/**
		 * copy nothing
		 */
		NONE = 0,
		/**
		 * flag indicating that buffer flags should be copied
		 */
		FLAGS = 1,
		/**
		 * flag indicating that buffer pts, dts,
		 *   duration, offset and offset_end should be copied
		 */
		TIMESTAMPS = 2,
		/**
		 * flag indicating that buffer meta should be
		 *   copied
		 */
		META = 4,
		/**
		 * flag indicating that buffer memory should be reffed
		 *   and appended to already existing memory. Unless the memory is marked as
		 *   NO_SHARE, no actual copy of the memory is made but it is simply reffed.
		 *   Add #GST_BUFFER_COPY_DEEP to force a real copy.
		 */
		MEMORY = 8,
		/**
		 * flag indicating that buffer memory should be
		 *   merged
		 */
		MERGE = 16,
		/**
		 * flag indicating that memory should always be
		 *   copied instead of reffed (Since: 1.2)
		 */
		DEEP = 32
	}

	/**
	 * A set of buffer flags used to describe properties of a {@link Buffer}.
	 */
	enum BufferFlags {
		/**
		 * the buffer is live data and should be discarded in
		 *                                 the PAUSED state.
		 */
		LIVE = 16,
		/**
		 * the buffer contains data that should be dropped
		 *                                 because it will be clipped against the segment
		 *                                 boundaries or because it does not contain data
		 *                                 that should be shown to the user.
		 */
		DECODE_ONLY = 32,
		/**
		 * the buffer marks a data discontinuity in the stream.
		 *                                 This typically occurs after a seek or a dropped buffer
		 *                                 from a live or network source.
		 */
		DISCONT = 64,
		/**
		 * the buffer timestamps might have a discontinuity
		 *                                 and this buffer is a good point to resynchronize.
		 */
		RESYNC = 128,
		/**
		 * the buffer data is corrupted.
		 */
		CORRUPTED = 256,
		/**
		 * the buffer contains a media specific marker. for
		 *                                 video this is the end of a frame boundary, for audio
		 *                                 this is the start of a talkspurt.
		 */
		MARKER = 512,
		/**
		 * the buffer contains header information that is
		 *                                 needed to decode the following data.
		 */
		HEADER = 1024,
		/**
		 * the buffer has been created to fill a gap in the
		 *                                 stream and contains media neutral data (elements can
		 *                                 switch to optimized code path that ignores the buffer
		 *                                 content).
		 */
		GAP = 2048,
		/**
		 * the buffer can be dropped without breaking the
		 *                                 stream, for example to reduce bandwidth.
		 */
		DROPPABLE = 4096,
		/**
		 * this unit cannot be decoded independently.
		 */
		DELTA_UNIT = 8192,
		/**
		 * this flag is set when memory of the buffer
		 *                                 is added/removed
		 */
		TAG_MEMORY = 16384,
		/**
		 * Elements which write to disk or permanent
		 *                                 storage should ensure the data is synced after
		 *                                 writing the contents of this buffer. (Since: 1.6)
		 */
		SYNC_AFTER = 32768,
		/**
		 * This buffer is important and should not be dropped.
		 *                                 This can be used to mark important buffers, e.g. to flag
		 *                                 RTP packets carrying keyframes or codec setup data for RTP
		 *                                 Forward Error Correction purposes, or to prevent still video
		 *                                 frames from being dropped by elements due to QoS. (Since: 1.14)
		 */
		NON_DROPPABLE = 65536,
		/**
		 * additional media specific flags can be added starting from
		 *                                 this flag.
		 */
		LAST = 1048576
	}

	/**
	 * Additional flags to control the allocation of a buffer
	 */
	enum BufferPoolAcquireFlags {
		/**
		 * no flags
		 */
		NONE = 0,
		/**
		 * buffer is keyframe
		 */
		KEY_UNIT = 1,
		/**
		 * when the bufferpool is empty, acquire_buffer
		 * will by default block until a buffer is released into the pool again. Setting
		 * this flag makes acquire_buffer return #GST_FLOW_EOS instead of blocking.
		 */
		DONTWAIT = 2,
		/**
		 * buffer is discont
		 */
		DISCONT = 4,
		/**
		 * last flag, subclasses can use private flags
		 *    starting from this value.
		 */
		LAST = 65536
	}

	/**
	 * The standard flags that a bus may have.
	 */
	enum BusFlags {
		/**
		 * The bus is currently dropping all messages
		 */
		FLUSHING = 16,
		/**
		 * offset to define more flags
		 */
		FLAG_LAST = 32
	}

	/**
	 * Extra flags for a caps.
	 */
	enum CapsFlags {
		/**
		 * Caps has no specific content, but can contain
		 *    anything.
		 */
		ANY = 16
	}

	/**
	 * The capabilities of this clock
	 */
	enum ClockFlags {
		/**
		 * clock can do a single sync timeout request
		 */
		CAN_DO_SINGLE_SYNC = 16,
		/**
		 * clock can do a single async timeout request
		 */
		CAN_DO_SINGLE_ASYNC = 32,
		/**
		 * clock can do sync periodic timeout requests
		 */
		CAN_DO_PERIODIC_SYNC = 64,
		/**
		 * clock can do async periodic timeout callbacks
		 */
		CAN_DO_PERIODIC_ASYNC = 128,
		/**
		 * clock's resolution can be changed
		 */
		CAN_SET_RESOLUTION = 256,
		/**
		 * clock can be slaved to a master clock
		 */
		CAN_SET_MASTER = 512,
		/**
		 * clock needs to be synced before it can be used
		 *     (Since: 1.6)
		 */
		NEEDS_STARTUP_SYNC = 1024,
		/**
		 * subclasses can add additional flags starting from this flag
		 */
		LAST = 4096
	}

	/**
	 * These are some terminal style flags you can use when creating your
	 * debugging categories to make them stand out in debugging output.
	 */
	enum DebugColorFlags {
		/**
		 * Use black as foreground color.
		 */
		FG_BLACK = 0,
		/**
		 * Use red as foreground color.
		 */
		FG_RED = 1,
		/**
		 * Use green as foreground color.
		 */
		FG_GREEN = 2,
		/**
		 * Use yellow as foreground color.
		 */
		FG_YELLOW = 3,
		/**
		 * Use blue as foreground color.
		 */
		FG_BLUE = 4,
		/**
		 * Use magenta as foreground color.
		 */
		FG_MAGENTA = 5,
		/**
		 * Use cyan as foreground color.
		 */
		FG_CYAN = 6,
		/**
		 * Use white as foreground color.
		 */
		FG_WHITE = 7,
		/**
		 * Use black as background color.
		 */
		BG_BLACK = 0,
		/**
		 * Use red as background color.
		 */
		BG_RED = 16,
		/**
		 * Use green as background color.
		 */
		BG_GREEN = 32,
		/**
		 * Use yellow as background color.
		 */
		BG_YELLOW = 48,
		/**
		 * Use blue as background color.
		 */
		BG_BLUE = 64,
		/**
		 * Use magenta as background color.
		 */
		BG_MAGENTA = 80,
		/**
		 * Use cyan as background color.
		 */
		BG_CYAN = 96,
		/**
		 * Use white as background color.
		 */
		BG_WHITE = 112,
		/**
		 * Make the output bold.
		 */
		BOLD = 256,
		/**
		 * Underline the output.
		 */
		UNDERLINE = 512
	}

	/**
	 * Available details for pipeline graphs produced by {@link GST.DEBUG_BIN_TO_DOT_FILE}
	 * and GST_DEBUG_BIN_TO_DOT_FILE_WITH_TS().
	 */
	enum DebugGraphDetails {
		/**
		 * show caps-name on edges
		 */
		MEDIA_TYPE = 1,
		/**
		 * show caps-details on edges
		 */
		CAPS_DETAILS = 2,
		/**
		 * show modified parameters on
		 *                                           elements
		 */
		NON_DEFAULT_PARAMS = 4,
		/**
		 * show element states
		 */
		STATES = 8,
		/**
		 * show full element parameter values even
		 *                                    if they are very long
		 */
		FULL_PARAMS = 16,
		/**
		 * show all the typical details that one might want
		 */
		ALL = 15,
		/**
		 * show all details regardless of how large or
		 *                                verbose they make the resulting output
		 */
		VERBOSE = 4294967295
	}

	/**
	 * The standard flags that an element may have.
	 */
	enum ElementFlags {
		/**
		 * ignore state changes from parent
		 */
		LOCKED_STATE = 16,
		/**
		 * the element is a sink
		 */
		SINK = 32,
		/**
		 * the element is a source.
		 */
		SOURCE = 64,
		/**
		 * the element can provide a clock
		 */
		PROVIDE_CLOCK = 128,
		/**
		 * the element requires a clock
		 */
		REQUIRE_CLOCK = 256,
		/**
		 * the element can use an index
		 */
		INDEXABLE = 512,
		/**
		 * offset to define more flags
		 */
		LAST = 16384
	}

	/**
	 * {@link EventTypeFlags} indicate the aspects of the different #GstEventType
	 * values. You can get the type flags of a #GstEventType with the
	 * {@link Gst.event.type_get_flags} function.
	 */
	enum EventTypeFlags {
		/**
		 * Set if the event can travel upstream.
		 */
		UPSTREAM = 1,
		/**
		 * Set if the event can travel downstream.
		 */
		DOWNSTREAM = 2,
		/**
		 * Set if the event should be serialized with data
		 *                               flow.
		 */
		SERIALIZED = 4,
		/**
		 * Set if the event is sticky on the pads.
		 */
		STICKY = 8,
		/**
		 * Multiple sticky events can be on a pad, each
		 *                               identified by the event name.
		 */
		STICKY_MULTI = 16
	}

	/**
	 * Flags used when locking miniobjects
	 */
	enum LockFlags {
		/**
		 * lock for read access
		 */
		READ = 1,
		/**
		 * lock for write access
		 */
		WRITE = 2,
		/**
		 * lock for exclusive access
		 */
		EXCLUSIVE = 4,
		/**
		 * first flag that can be used for custom purposes
		 */
		LAST = 256
	}

	/**
	 * Flags used when mapping memory
	 */
	enum MapFlags {
		/**
		 * map for read access
		 */
		READ = 1,
		/**
		 * map for write access
		 */
		WRITE = 2,
		/**
		 * first flag that can be used for custom purposes
		 */
		FLAG_LAST = 65536
	}

	/**
	 * Flags for wrapped memory.
	 */
	enum MemoryFlags {
		/**
		 * memory is readonly. It is not allowed to map the
		 * memory with #GST_MAP_WRITE.
		 */
		READONLY = 2,
		/**
		 * memory must not be shared. Copies will have to be
		 * made when this memory needs to be shared between buffers.
		 */
		NO_SHARE = 16,
		/**
		 * the memory prefix is filled with 0 bytes
		 */
		ZERO_PREFIXED = 32,
		/**
		 * the memory padding is filled with 0 bytes
		 */
		ZERO_PADDED = 64,
		/**
		 * the memory is physically contiguous. (Since: 1.2)
		 */
		PHYSICALLY_CONTIGUOUS = 128,
		/**
		 * the memory can't be mapped via {@link Gst.Memory.map} without any preconditions. (Since: 1.2)
		 */
		NOT_MAPPABLE = 256,
		/**
		 * first flag that can be used for custom purposes
		 */
		LAST = 1048576
	}

	/**
	 * The different message types that are available.
	 */
	enum MessageType {
		/**
		 * an undefined message
		 */
		UNKNOWN = 0,
		/**
		 * end-of-stream reached in a pipeline. The application will
		 * only receive this message in the PLAYING state and every time it sets a
		 * pipeline to PLAYING that is in the EOS state. The application can perform a
		 * flushing seek in the pipeline, which will undo the EOS state again.
		 */
		EOS = 1,
		/**
		 * an error occurred. When the application receives an error
		 * message it should stop playback of the pipeline and not assume that more
		 * data will be played. It is possible to specify a redirection url to the error
		 * messages by setting a `redirect-location` field into the error message, application
		 * or high level bins might use the information as required.
		 */
		ERROR = 2,
		/**
		 * a warning occurred.
		 */
		WARNING = 4,
		/**
		 * an info message occurred
		 */
		INFO = 8,
		/**
		 * a tag was found.
		 */
		TAG = 16,
		/**
		 * the pipeline is buffering. When the application
		 * receives a buffering message in the PLAYING state for a non-live pipeline it
		 * must PAUSE the pipeline until the buffering completes, when the percentage
		 * field in the message is 100%. For live pipelines, no action must be
		 * performed and the buffering percentage can be used to inform the user about
		 * the progress.
		 */
		BUFFERING = 32,
		/**
		 * a state change happened
		 */
		STATE_CHANGED = 64,
		/**
		 * an element changed state in a streaming thread.
		 * This message is deprecated.
		 */
		STATE_DIRTY = 128,
		/**
		 * a stepping operation finished.
		 */
		STEP_DONE = 256,
		/**
		 * an element notifies its capability of providing
		 *                             a clock. This message is used internally and
		 *                             never forwarded to the application.
		 */
		CLOCK_PROVIDE = 512,
		/**
		 * The current clock as selected by the pipeline became
		 *                          unusable. The pipeline will select a new clock on
		 *                          the next PLAYING state change. The application
		 *                          should set the pipeline to PAUSED and back to
		 *                          PLAYING when this message is received.
		 */
		CLOCK_LOST = 1024,
		/**
		 * a new clock was selected in the pipeline.
		 */
		NEW_CLOCK = 2048,
		/**
		 * the structure of the pipeline changed. This
		 * message is used internally and never forwarded to the application.
		 */
		STRUCTURE_CHANGE = 4096,
		/**
		 * status about a stream, emitted when it starts,
		 *                             stops, errors, etc..
		 */
		STREAM_STATUS = 8192,
		/**
		 * message posted by the application, possibly
		 *                           via an application-specific element.
		 */
		APPLICATION = 16384,
		/**
		 * element-specific message, see the specific element's
		 *                       documentation
		 */
		ELEMENT = 32768,
		/**
		 * pipeline started playback of a segment. This
		 * message is used internally and never forwarded to the application.
		 */
		SEGMENT_START = 65536,
		/**
		 * pipeline completed playback of a segment. This
		 * message is forwarded to the application after all elements that posted
		 * #GST_MESSAGE_SEGMENT_START posted a GST_MESSAGE_SEGMENT_DONE message.
		 */
		SEGMENT_DONE = 131072,
		/**
		 * The duration of a pipeline changed. The
		 * application can get the new duration with a duration query.
		 */
		DURATION_CHANGED = 262144,
		/**
		 * Posted by elements when their latency changes. The
		 * application should recalculate and distribute a new latency.
		 */
		LATENCY = 524288,
		/**
		 * Posted by elements when they start an ASYNC
		 * {@link StateChange}. This message is not forwarded to the application but is used
		 * internally.
		 */
		ASYNC_START = 1048576,
		/**
		 * Posted by elements when they complete an ASYNC
		 * {@link StateChange}. The application will only receive this message from the toplevel
		 * pipeline.
		 */
		ASYNC_DONE = 2097152,
		/**
		 * Posted by elements when they want the pipeline to
		 * change state. This message is a suggestion to the application which can
		 * decide to perform the state change on (part of) the pipeline.
		 */
		REQUEST_STATE = 4194304,
		/**
		 * A stepping operation was started.
		 */
		STEP_START = 8388608,
		/**
		 * A buffer was dropped or an element changed its processing
		 * strategy for Quality of Service reasons.
		 */
		QOS = 16777216,
		/**
		 * A progress message.
		 */
		PROGRESS = 33554432,
		/**
		 * A new table of contents (TOC) was found or previously found TOC
		 * was updated.
		 */
		TOC = 67108864,
		/**
		 * Message to request resetting the pipeline's
		 *     running time from the pipeline. This is an internal message which
		 *     applications will likely never receive.
		 */
		RESET_TIME = 134217728,
		/**
		 * Message indicating start of a new stream. Useful
		 *     e.g. when using playbin in gapless playback mode, to get notified when
		 *     the next title actually starts playing (which will be some time after
		 *     the URI for the next title has been set).
		 */
		STREAM_START = 268435456,
		/**
		 * Message indicating that an element wants a specific context (Since: 1.2)
		 */
		NEED_CONTEXT = 536870912,
		/**
		 * Message indicating that an element created a context (Since: 1.2)
		 */
		HAVE_CONTEXT = 1073741824,
		/**
		 * Message is an extended message type (see below).
		 *     These extended message IDs can't be used directly with mask-based API
		 *     like {@link Gst.Bus.poll} or gst_bus_timed_pop_filtered(), but you can still
		 *     filter for GST_MESSAGE_EXTENDED and then check the result for the
		 *     specific type. (Since: 1.4)
		 */
		EXTENDED = 2147483648,
		/**
		 * Message indicating a {@link Device} was added to
		 *     a #GstDeviceProvider (Since: 1.4)
		 */
		DEVICE_ADDED = 2147483649,
		/**
		 * Message indicating a {@link Device} was removed
		 *     from a #GstDeviceProvider (Since: 1.4)
		 */
		DEVICE_REMOVED = 2147483650,
		/**
		 * Message indicating a #GObject property has
		 *     changed (Since: 1.10)
		 */
		PROPERTY_NOTIFY = 2147483651,
		/**
		 * Message indicating a new {@link StreamCollection}
		 *     is available (Since: 1.10)
		 */
		STREAM_COLLECTION = 2147483652,
		/**
		 * Message indicating the active selection of
		 *     {@link Streams} has changed (Since: 1.10)
		 */
		STREAMS_SELECTED = 2147483653,
		/**
		 * Message indicating to request the application to
		 *     try to play the given URL(s). Useful if for example a HTTP 302/303
		 *     response is received with a non-HTTP URL inside. (Since: 1.10)
		 */
		REDIRECT = 2147483654,
		/**
		 * Message indicating a {@link Device} was changed
		 *     a #GstDeviceProvider (Since: 1.16)
		 */
		DEVICE_CHANGED = 2147483655,
		/**
		 * Message sent by elements to request the
		 *     running time from the pipeline when an instant rate change should
		 *     be applied (which may be in the past when the answer arrives). (Since: 1.18)
		 */
		INSTANT_RATE_REQUEST = 2147483656,
		/**
		 * mask for all of the above messages.
		 */
		ANY = 4294967295
	}

	/**
	 * Extra metadata flags.
	 */
	enum MetaFlags {
		/**
		 * no flags
		 */
		NONE = 0,
		/**
		 * metadata should not be modified
		 */
		READONLY = 1,
		/**
		 * metadata is managed by a bufferpool
		 */
		POOLED = 2,
		/**
		 * metadata should not be removed
		 */
		LOCKED = 4,
		/**
		 * additional flags can be added starting from this flag.
		 */
		LAST = 65536
	}

	/**
	 * Flags for the mini object
	 */
	enum MiniObjectFlags {
		/**
		 * the object can be locked and unlocked with
		 * {@link Gst.MiniObject.lock} and gst_mini_object_unlock().
		 */
		LOCKABLE = 1,
		/**
		 * the object is permanently locked in
		 * READONLY mode. Only read locks can be performed on the object.
		 */
		LOCK_READONLY = 2,
		/**
		 * the object is expected to stay alive
		 * even after gst_deinit() has been called and so should be ignored by leak
		 * detection tools. (Since: 1.10)
		 */
		MAY_BE_LEAKED = 4,
		/**
		 * first flag that can be used by subclasses.
		 */
		LAST = 16
	}

	/**
	 * The standard flags that an gstobject may have.
	 */
	enum ObjectFlags {
		/**
		 * the object is expected to stay alive even
		 * after gst_deinit() has been called and so should be ignored by leak
		 * detection tools. (Since: 1.10)
		 */
		MAY_BE_LEAKED = 1,
		/**
		 * subclasses can add additional flags starting from this flag
		 */
		LAST = 16
	}

	/**
	 * Pad state flags
	 */
	enum PadFlags {
		/**
		 * is dataflow on a pad blocked
		 */
		BLOCKED = 16,
		/**
		 * is pad flushing
		 */
		FLUSHING = 32,
		/**
		 * is pad in EOS state
		 */
		EOS = 64,
		/**
		 * is pad currently blocking on a buffer or event
		 */
		BLOCKING = 128,
		/**
		 * ensure that there is a parent object before calling
		 *                       into the pad callbacks.
		 */
		NEED_PARENT = 256,
		/**
		 * the pad should be reconfigured/renegotiated.
		 *                            The flag has to be unset manually after
		 *                            reconfiguration happened.
		 */
		NEED_RECONFIGURE = 512,
		/**
		 * the pad has pending events
		 */
		PENDING_EVENTS = 1024,
		/**
		 * the pad is using fixed caps. This means that
		 *     once the caps are set on the pad, the default caps query function
		 *     will only return those caps.
		 */
		FIXED_CAPS = 2048,
		/**
		 * the default event and query handler will forward
		 *                      all events and queries to the internally linked pads
		 *                      instead of discarding them.
		 */
		PROXY_CAPS = 4096,
		/**
		 * the default query handler will forward
		 *                      allocation queries to the internally linked pads
		 *                      instead of discarding them.
		 */
		PROXY_ALLOCATION = 8192,
		/**
		 * the default query handler will forward
		 *                      scheduling queries to the internally linked pads
		 *                      instead of discarding them.
		 */
		PROXY_SCHEDULING = 16384,
		/**
		 * the default accept-caps handler will check
		 *                      it the caps intersect the query-caps result instead
		 *                      of checking for a subset. This is interesting for
		 *                      parsers that can accept incompletely specified caps.
		 */
		ACCEPT_INTERSECT = 32768,
		/**
		 * the default accept-caps handler will use
		 *                      the template pad caps instead of query caps to
		 *                      compare with the accept caps. Use this in combination
		 *                      with %GST_PAD_FLAG_ACCEPT_INTERSECT. (Since: 1.6)
		 */
		ACCEPT_TEMPLATE = 65536,
		/**
		 * offset to define more flags
		 */
		LAST = 1048576
	}

	/**
	 * The amount of checking to be done when linking pads. #GST_PAD_LINK_CHECK_CAPS
	 * and #GST_PAD_LINK_CHECK_TEMPLATE_CAPS are mutually exclusive. If both are
	 * specified, expensive but safe #GST_PAD_LINK_CHECK_CAPS are performed.
	 * 
	 * > Only disable some of the checks if you are 100% certain you know the link
	 * > will not fail because of hierarchy/caps compatibility failures. If uncertain,
	 * > use the default checks (%GST_PAD_LINK_CHECK_DEFAULT) or the regular methods
	 * > for linking the pads.
	 */
	enum PadLinkCheck {
		/**
		 * Don't check hierarchy or caps compatibility.
		 */
		NOTHING = 0,
		/**
		 * Check the pads have same parents/grandparents.
		 *   Could be omitted if it is already known that the two elements that own the
		 *   pads are in the same bin.
		 */
		HIERARCHY = 1,
		/**
		 * Check if the pads are compatible by using
		 *   their template caps. This is much faster than #GST_PAD_LINK_CHECK_CAPS, but
		 *   would be unsafe e.g. if one pad has %GST_CAPS_ANY.
		 */
		TEMPLATE_CAPS = 2,
		/**
		 * Check if the pads are compatible by comparing the
		 *   caps returned by {@link Gst.Pad.query_caps}.
		 */
		CAPS = 4,
		/**
		 * Disables pushing a reconfigure event when pads are
		 *   linked.
		 */
		NO_RECONFIGURE = 8,
		/**
		 * The default checks done when linking
		 *   pads (i.e. the ones used by {@link Gst.Pad.link}).
		 */
		DEFAULT = 5
	}

	/**
	 * The different probing types that can occur. When either one of
	 * #GST_PAD_PROBE_TYPE_IDLE or #GST_PAD_PROBE_TYPE_BLOCK is used, the probe will be a
	 * blocking probe.
	 */
	enum PadProbeType {
		/**
		 * invalid probe type
		 */
		INVALID = 0,
		/**
		 * probe idle pads and block while the callback is called
		 */
		IDLE = 1,
		/**
		 * probe and block pads
		 */
		BLOCK = 2,
		/**
		 * probe buffers
		 */
		BUFFER = 16,
		/**
		 * probe buffer lists
		 */
		BUFFER_LIST = 32,
		/**
		 * probe downstream events
		 */
		EVENT_DOWNSTREAM = 64,
		/**
		 * probe upstream events
		 */
		EVENT_UPSTREAM = 128,
		/**
		 * probe flush events. This probe has to be
		 *     explicitly enabled and is not included in the
		 *     ##GST_PAD_PROBE_TYPE_EVENT_DOWNSTREAM or
		 *     ##GST_PAD_PROBE_TYPE_EVENT_UPSTREAM probe types.
		 */
		EVENT_FLUSH = 256,
		/**
		 * probe downstream queries
		 */
		QUERY_DOWNSTREAM = 512,
		/**
		 * probe upstream queries
		 */
		QUERY_UPSTREAM = 1024,
		/**
		 * probe push
		 */
		PUSH = 4096,
		/**
		 * probe pull
		 */
		PULL = 8192,
		/**
		 * probe and block at the next opportunity, at data flow or when idle
		 */
		BLOCKING = 3,
		/**
		 * probe downstream data (buffers, buffer lists, and events)
		 */
		DATA_DOWNSTREAM = 112,
		/**
		 * probe upstream data (events)
		 */
		DATA_UPSTREAM = 128,
		/**
		 * probe upstream and downstream data (buffers, buffer lists, and events)
		 */
		DATA_BOTH = 240,
		/**
		 * probe and block downstream data (buffers, buffer lists, and events)
		 */
		BLOCK_DOWNSTREAM = 114,
		/**
		 * probe and block upstream data (events)
		 */
		BLOCK_UPSTREAM = 130,
		/**
		 * probe upstream and downstream events
		 */
		EVENT_BOTH = 192,
		/**
		 * probe upstream and downstream queries
		 */
		QUERY_BOTH = 1536,
		/**
		 * probe upstream events and queries and downstream buffers, buffer lists, events and queries
		 */
		ALL_BOTH = 1776,
		/**
		 * probe push and pull
		 */
		SCHEDULING = 12288
	}

	/**
	 * Flags for the padtemplate
	 */
	enum PadTemplateFlags {
		/**
		 * first flag that can be used by subclasses.
		 */
		LAST = 256
	}

	/**
	 * Parsing options.
	 */
	enum ParseFlags {
		/**
		 * Do not use any special parsing options.
		 */
		NONE = 0,
		/**
		 * Always return %NULL when an error occurs
		 *     (default behaviour is to return partially constructed bins or elements
		 *      in some cases)
		 */
		FATAL_ERRORS = 1,
		/**
		 * If a bin only has a single element,
		 *     just return the element.
		 */
		NO_SINGLE_ELEMENT_BINS = 2,
		/**
		 * If more than one toplevel element is described
		 *     by the pipeline description string, put them in a {@link Bin} instead of a
		 *     #GstPipeline. (Since: 1.10)
		 */
		PLACE_IN_BIN = 4
	}

	/**
	 * Pipeline flags
	 */
	enum PipelineFlags {
		/**
		 * this pipeline works with a fixed clock
		 */
		FIXED_CLOCK = 524288,
		/**
		 * offset to define more flags
		 */
		LAST = 8388608
	}

	enum PluginAPIFlags {
		/**
		 * Ignore enum members when generating
		 *   the plugins cache. This is useful if the members of the enum are generated
		 *   dynamically, in order not to expose incorrect documentation to the end user.
		 */
		MEMBERS = 1
	}

	/**
	 * Flags used in connection with {@link Gst.Plugin.add_dependency}.
	 */
	enum PluginDependencyFlags {
		/**
		 * no special flags
		 */
		NONE = 0,
		/**
		 * recurse into subdirectories
		 */
		RECURSE = 1,
		/**
		 * use paths
		 *         argument only if none of the environment variables is set
		 */
		PATHS_ARE_DEFAULT_ONLY = 2,
		/**
		 * interpret
		 *         filename argument as filter suffix and check all matching files in
		 *         the directory
		 */
		FILE_NAME_IS_SUFFIX = 4,
		/**
		 * interpret
		 *         filename argument as filter prefix and check all matching files in
		 *         the directory. Since: 1.8.
		 */
		FILE_NAME_IS_PREFIX = 8,
		/**
		 * interpret
		 *   non-absolute paths as relative to the main executable directory. Since
		 *   1.14.
		 */
		PATHS_ARE_RELATIVE_TO_EXE = 16
	}

	/**
	 * The plugin loading state
	 */
	enum PluginFlags {
		/**
		 * Temporarily loaded plugins
		 */
		CACHED = 16,
		/**
		 * The plugin won't be scanned (again)
		 */
		BLACKLISTED = 32
	}

	/**
	 * {@link QueryTypeFlags} indicate the aspects of the different #GstQueryType
	 * values. You can get the type flags of a #GstQueryType with the
	 * {@link Gst.query.type_get_flags} function.
	 */
	enum QueryTypeFlags {
		/**
		 * Set if the query can travel upstream.
		 */
		UPSTREAM = 1,
		/**
		 * Set if the query can travel downstream.
		 */
		DOWNSTREAM = 2,
		/**
		 * Set if the query should be serialized with data
		 *                               flow.
		 */
		SERIALIZED = 4
	}

	/**
	 * The different scheduling flags.
	 */
	enum SchedulingFlags {
		/**
		 * if seeking is possible
		 */
		SEEKABLE = 1,
		/**
		 * if sequential access is recommended
		 */
		SEQUENTIAL = 2,
		/**
		 * if bandwidth is limited and buffering possible (since 1.2)
		 */
		BANDWIDTH_LIMITED = 4
	}

	/**
	 * Flags to be used with {@link Gst.Element.seek} or gst_event_new_seek(). All flags
	 * can be used together.
	 * 
	 * A non flushing seek might take some time to perform as the currently
	 * playing data in the pipeline will not be cleared.
	 * 
	 * An accurate seek might be slower for formats that don't have any indexes
	 * or timestamp markers in the stream. Specifying this flag might require a
	 * complete scan of the file in those cases.
	 * 
	 * When performing a segment seek: after the playback of the segment completes,
	 * no EOS will be emitted by the element that performed the seek, but a
	 * %GST_MESSAGE_SEGMENT_DONE message will be posted on the bus by the element.
	 * When this message is posted, it is possible to send a new seek event to
	 * continue playback. With this seek method it is possible to perform seamless
	 * looping or simple linear editing.
	 * 
	 * When only changing the playback rate and not the direction, the
	 * %GST_SEEK_FLAG_INSTANT_RATE_CHANGE flag can be used for a non-flushing seek
	 * to signal that the rate change should be applied immediately. This requires
	 * special support in the seek handlers (e.g. demuxers) and any elements
	 * synchronizing to the clock, and in general can't work in all cases (for example
	 * UDP streaming where the delivery rate is controlled by a remote server). The
	 * instant-rate-change mode supports changing the trickmode-related GST_SEEK_ flags,
	 * but can't be used in conjunction with other seek flags that affect the new
	 * playback position - as the playback position will not be changing.
	 * 
	 * When doing fast forward (rate > 1.0) or fast reverse (rate < -1.0) trickmode
	 * playback, the %GST_SEEK_FLAG_TRICKMODE flag can be used to instruct decoders
	 * and demuxers to adjust the playback rate by skipping frames. This can improve
	 * performance and decrease CPU usage because not all frames need to be decoded.
	 * 
	 * Beyond that, the %GST_SEEK_FLAG_TRICKMODE_KEY_UNITS flag can be used to
	 * request that decoders skip all frames except key units, and
	 * %GST_SEEK_FLAG_TRICKMODE_NO_AUDIO flags can be used to request that audio
	 * decoders do no decoding at all, and simple output silence.
	 * 
	 * The %GST_SEEK_FLAG_SNAP_BEFORE flag can be used to snap to the previous
	 * relevant location, and the %GST_SEEK_FLAG_SNAP_AFTER flag can be used to
	 * select the next relevant location. If %GST_SEEK_FLAG_KEY_UNIT is specified,
	 * the relevant location is a keyframe. If both flags are specified, the nearest
	 * of these locations will be selected. If none are specified, the implementation is
	 * free to select whichever it wants.
	 * 
	 * The before and after here are in running time, so when playing backwards,
	 * the next location refers to the one that will played in next, and not the
	 * one that is located after in the actual source stream.
	 * 
	 * Also see part-seeking.txt in the GStreamer design documentation for more
	 * details on the meaning of these flags and the behaviour expected of
	 * elements that handle them.
	 */
	enum SeekFlags {
		/**
		 * no flag
		 */
		NONE = 0,
		/**
		 * flush pipeline
		 */
		FLUSH = 1,
		/**
		 * accurate position is requested, this might
		 *                     be considerably slower for some formats.
		 */
		ACCURATE = 2,
		/**
		 * seek to the nearest keyframe. This might be
		 *                     faster but less accurate.
		 */
		KEY_UNIT = 4,
		/**
		 * perform a segment seek.
		 */
		SEGMENT = 8,
		/**
		 * when doing fast forward or fast reverse playback, allow
		 *                     elements to skip frames instead of generating all
		 *                     frames. (Since: 1.6)
		 */
		TRICKMODE = 16,
		/**
		 * Deprecated backward compatibility flag, replaced
		 *                     by %GST_SEEK_FLAG_TRICKMODE
		 */
		SKIP = 16,
		/**
		 * go to a location before the requested position,
		 *                     if %GST_SEEK_FLAG_KEY_UNIT this means the keyframe at or before
		 *                     the requested position the one at or before the seek target.
		 */
		SNAP_BEFORE = 32,
		/**
		 * go to a location after the requested position,
		 *                     if %GST_SEEK_FLAG_KEY_UNIT this means the keyframe at of after the
		 *                     requested position.
		 */
		SNAP_AFTER = 64,
		/**
		 * go to a position near the requested position,
		 *                     if %GST_SEEK_FLAG_KEY_UNIT this means the keyframe closest
		 *                     to the requested position, if both keyframes are at an equal
		 *                     distance, behaves like %GST_SEEK_FLAG_SNAP_BEFORE.
		 */
		SNAP_NEAREST = 96,
		/**
		 * when doing fast forward or fast reverse
		 *                     playback, request that elements only decode keyframes
		 *                     and skip all other content, for formats that have
		 *                     keyframes. (Since: 1.6)
		 */
		TRICKMODE_KEY_UNITS = 128,
		/**
		 * when doing fast forward or fast reverse
		 *                     playback, request that audio decoder elements skip
		 *                     decoding and output only gap events or silence. (Since: 1.6)
		 */
		TRICKMODE_NO_AUDIO = 256,
		/**
		 * When doing fast forward or fast reverse
		 *                     playback, request that elements only decode keyframes and
		 *                     forward predicted frames and skip all other content (for example
		 *                     B-Frames), for formats that have keyframes and forward predicted
		 *                     frames. (Since: 1.18)
		 */
		TRICKMODE_FORWARD_PREDICTED = 512,
		/**
		 * Signals that a rate change should be
		 *                     applied immediately. Only valid if start/stop position
		 *                     are GST_CLOCK_TIME_NONE, the playback direction does not change
		 *                     and the seek is not flushing. (Since: 1.18)
		 */
		INSTANT_RATE_CHANGE = 1024
	}

	/**
	 * Flags for the GstSegment structure. Currently mapped to the corresponding
	 * values of the seek flags.
	 */
	enum SegmentFlags {
		/**
		 * no flags
		 */
		NONE = 0,
		/**
		 * reset the pipeline running_time to the segment
		 *                          running_time
		 */
		RESET = 1,
		/**
		 * perform skip playback (Since: 1.6)
		 */
		TRICKMODE = 16,
		/**
		 * Deprecated backward compatibility flag, replaced
		 *                         by #GST_SEGMENT_FLAG_TRICKMODE
		 */
		SKIP = 16,
		/**
		 * send SEGMENT_DONE instead of EOS
		 */
		SEGMENT = 8,
		/**
		 * Decode only keyframes, where
		 *                                        possible (Since: 1.6)
		 */
		TRICKMODE_KEY_UNITS = 128,
		/**
		 * Decode only keyframes or forward
		 *                                        predicted frames, where possible (Since: 1.18)
		 */
		TRICKMODE_FORWARD_PREDICTED = 512,
		/**
		 * Do not decode any audio, where
		 *                                        possible (Since: 1.6)
		 */
		TRICKMODE_NO_AUDIO = 256
	}

	enum StackTraceFlags {
		/**
		 * Try to retrieve the minimum information
		 *                             available, which may be none on some platforms
		 *                             (Since: 1.18)
		 */
		NONE = 0,
		/**
		 * Try to retrieve as much information as possible,
		 *                             including source information when getting the
		 *                             stack trace
		 */
		FULL = 1
	}

	enum StreamFlags {
		/**
		 * This stream has no special attributes
		 */
		NONE = 0,
		/**
		 * This stream is a sparse stream (e.g. a subtitle
		 *    stream), data may flow only in irregular intervals with large gaps in
		 *    between.
		 */
		SPARSE = 1,
		/**
		 * This stream should be selected by default. This
		 *    flag may be used by demuxers to signal that a stream should be selected
		 *    by default in a playback scenario.
		 */
		SELECT = 2,
		/**
		 * This stream should not be selected by default.
		 *    This flag may be used by demuxers to signal that a stream should not
		 *    be selected by default in a playback scenario, but only if explicitly
		 *    selected by the user (e.g. an audio track for the hard of hearing or
		 *    a director's commentary track).
		 */
		UNSELECT = 4
	}

	/**
	 * {@link StreamType} describes a high level classification set for
	 * flows of data in #GstStream objects.
	 * 
	 * Note that this is a flag, and therefore users should not assume it
	 * will be a single value. Do not use the equality operator for checking
	 * whether a stream is of a certain type.
	 */
	enum StreamType {
		/**
		 * The stream is of unknown (unclassified) type.
		 */
		UNKNOWN = 1,
		/**
		 * The stream is of audio data
		 */
		AUDIO = 2,
		/**
		 * The stream carries video data
		 */
		VIDEO = 4,
		/**
		 * The stream is a muxed container type
		 */
		CONTAINER = 8,
		/**
		 * The stream contains subtitle / subpicture data.
		 */
		TEXT = 16
	}

	/**
	 * Flag that describe the value. These flags help applications processing the
	 * logs to understand the values.
	 */
	enum TracerValueFlags {
		/**
		 * no flags
		 */
		NONE = 0,
		/**
		 * the value is optional. When using this flag
		 *   one need to have an additional boolean arg before this value in the
		 *   var-args list passed to  {@link Gst.TracerRecord.log}.
		 */
		OPTIONAL = 1,
		/**
		 * the value is a combined figure, since the
		 *   start of tracing. Examples are averages or timestamps.
		 */
		AGGREGATED = 2
	}

	/**
	 * A function that will be called from {@link Gst.Buffer.foreach_meta}. The #meta
	 * field will point to a the reference of the meta.
	 * 
	 * #buffer should not be modified from this callback.
	 * 
	 * When this function returns %TRUE, the next meta will be
	 * returned. When %FALSE is returned, gst_buffer_foreach_meta() will return.
	 * 
	 * When #meta is set to %NULL, the item will be removed from the buffer.
	 */
	interface BufferForeachMetaFunc {
		/**
		 * A function that will be called from {@link Gst.Buffer.foreach_meta}. The #meta
		 * field will point to a the reference of the meta.
		 * 
		 * #buffer should not be modified from this callback.
		 * 
		 * When this function returns %TRUE, the next meta will be
		 * returned. When %FALSE is returned, gst_buffer_foreach_meta() will return.
		 * 
		 * When #meta is set to %NULL, the item will be removed from the buffer.
		 * @param buffer a {@link Buffer}
		 * @returns %FALSE when {@link Gst.Buffer.foreach_meta} should stop
		 * 
		 * a pointer to a {@link Meta}
		 */
		(buffer: Buffer): [ boolean, Meta | null ];
	}

	/**
	 * A function that will be called from {@link Gst.BufferList.foreach}. The #buffer
	 * field will point to a the reference of the buffer at #idx.
	 * 
	 * When this function returns %TRUE, the next buffer will be
	 * returned. When %FALSE is returned, gst_buffer_list_foreach() will return.
	 * 
	 * When #buffer is set to %NULL, the item will be removed from the bufferlist.
	 * When #buffer has been made writable, the new buffer reference can be assigned
	 * to #buffer. This function is responsible for unreffing the old buffer when
	 * removing or modifying.
	 */
	interface BufferListFunc {
		/**
		 * A function that will be called from {@link Gst.BufferList.foreach}. The #buffer
		 * field will point to a the reference of the buffer at #idx.
		 * 
		 * When this function returns %TRUE, the next buffer will be
		 * returned. When %FALSE is returned, gst_buffer_list_foreach() will return.
		 * 
		 * When #buffer is set to %NULL, the item will be removed from the bufferlist.
		 * When #buffer has been made writable, the new buffer reference can be assigned
		 * to #buffer. This function is responsible for unreffing the old buffer when
		 * removing or modifying.
		 * @param idx the index of #buffer
		 * @returns %FALSE when {@link Gst.BufferList.foreach} should stop
		 * 
		 * pointer the buffer
		 */
		(idx: number): [ boolean, Buffer | null ];
	}

	/**
	 * Specifies the type of function passed to {@link Gst.Bus.add_watch} or
	 * gst_bus_add_watch_full(), which is called from the mainloop when a message
	 * is available on the bus.
	 * 
	 * The message passed to the function will be unreffed after execution of this
	 * function so it should not be freed in the function.
	 * 
	 * Note that this function is used as a GSourceFunc which means that returning
	 * %FALSE will remove the GSource from the mainloop.
	 */
	interface BusFunc {
		/**
		 * Specifies the type of function passed to {@link Gst.Bus.add_watch} or
		 * gst_bus_add_watch_full(), which is called from the mainloop when a message
		 * is available on the bus.
		 * 
		 * The message passed to the function will be unreffed after execution of this
		 * function so it should not be freed in the function.
		 * 
		 * Note that this function is used as a GSourceFunc which means that returning
		 * %FALSE will remove the GSource from the mainloop.
		 * @param bus the {@link Bus} that sent the message
		 * @param message the {@link Message}
		 * @returns %FALSE if the event source should be removed.
		 */
		(bus: Bus, message: Message): boolean;
	}

	/**
	 * Handler will be invoked synchronously, when a new message has been injected
	 * into the bus. This function is mostly used internally. Only one sync handler
	 * can be attached to a given bus.
	 * 
	 * If the handler returns GST_BUS_DROP, it should unref the message, else the
	 * message should not be unreffed by the sync handler.
	 */
	interface BusSyncHandler {
		/**
		 * Handler will be invoked synchronously, when a new message has been injected
		 * into the bus. This function is mostly used internally. Only one sync handler
		 * can be attached to a given bus.
		 * 
		 * If the handler returns GST_BUS_DROP, it should unref the message, else the
		 * message should not be unreffed by the sync handler.
		 * @param bus the {@link Bus} that sent the message
		 * @param message the {@link Message}
		 * @returns {@link BusSyncReply} stating what to do with the message
		 */
		(bus: Bus, message: Message): BusSyncReply;
	}

	/**
	 * A function that will be called in {@link Gst.Caps.filter_and_map_in_place}.
	 * The function may modify #features and #structure, and both will be
	 * removed from the caps if %FALSE is returned.
	 */
	interface CapsFilterMapFunc {
		/**
		 * A function that will be called in {@link Gst.Caps.filter_and_map_in_place}.
		 * The function may modify #features and #structure, and both will be
		 * removed from the caps if %FALSE is returned.
		 * @param features the {@link CapsFeatures}
		 * @param structure the {@link Structure}
		 * @returns %TRUE if the features and structure should be preserved,
		 * %FALSE if it should be removed.
		 */
		(features: CapsFeatures, structure: Structure): boolean;
	}

	/**
	 * A function that will be called in {@link Gst.Caps.foreach}. The function may
	 * not modify #features or #structure.
	 */
	interface CapsForeachFunc {
		/**
		 * A function that will be called in {@link Gst.Caps.foreach}. The function may
		 * not modify #features or #structure.
		 * @param features the {@link CapsFeatures}
		 * @param structure the {@link Structure}
		 * @returns %TRUE if the foreach operation should continue, %FALSE if
		 * the foreach operation should stop with %FALSE.
		 */
		(features: CapsFeatures, structure: Structure): boolean;
	}

	/**
	 * A function that will be called in {@link Gst.Caps.map_in_place}. The function
	 * may modify #features and #structure.
	 */
	interface CapsMapFunc {
		/**
		 * A function that will be called in {@link Gst.Caps.map_in_place}. The function
		 * may modify #features and #structure.
		 * @param features the {@link CapsFeatures}
		 * @param structure the {@link Structure}
		 * @returns %TRUE if the map operation should continue, %FALSE if
		 * the map operation should stop with %FALSE.
		 */
		(features: CapsFeatures, structure: Structure): boolean;
	}

	/**
	 * The function prototype of the callback.
	 */
	interface ClockCallback {
		/**
		 * The function prototype of the callback.
		 * @param clock The clock that triggered the callback
		 * @param time The time it was triggered
		 * @param id The {@link ClockID} that expired
		 * @returns %TRUE or %FALSE (currently unused)
		 */
		(clock: Clock, time: ClockTime, id: ClockID): boolean;
	}

	/**
	 * FIXME(2.0): remove, this is unused
	 */
	interface ControlBindingConvert {
		/**
		 * FIXME(2.0): remove, this is unused
		 * @param binding
		 * @param src_value
		 * @param dest_value
		 */
		(binding: ControlBinding, src_value: number, dest_value: GObject.Value): void;
	}

	/**
	 * Function for returning a value for a given timestamp.
	 */
	interface ControlSourceGetValue {
		/**
		 * Function for returning a value for a given timestamp.
		 * @param self the {@link ControlSource} instance
		 * @param timestamp timestamp for which a value should be calculated
		 * @param value a value which will be set to the result.
		 * @returns %TRUE if the value was successfully calculated.
		 */
		(self: ControlSource, timestamp: ClockTime, value: number): boolean;
	}

	/**
	 * Function for returning an array of values for starting at a given timestamp.
	 */
	interface ControlSourceGetValueArray {
		/**
		 * Function for returning an array of values for starting at a given timestamp.
		 * @param self the {@link ControlSource} instance
		 * @param timestamp timestamp for which a value should be calculated
		 * @param interval the time spacing between subsequent values
		 * @param n_values the number of values
		 * @param values array to put control-values in
		 * @returns %TRUE if the values were successfully calculated.
		 */
		(self: ControlSource, timestamp: ClockTime, interval: ClockTime, n_values: number, values: number): boolean;
	}

	/**
	 * we define this to avoid a compiler warning regarding a cast from a function
	 * pointer to a void pointer
	 * (see https://bugzilla.gnome.org/show_bug.cgi?id=309253)
	 */
	interface DebugFuncPtr {
		/**
		 * we define this to avoid a compiler warning regarding a cast from a function
		 * pointer to a void pointer
		 * (see https://bugzilla.gnome.org/show_bug.cgi?id=309253)
		 */
		(): void;
	}

	/**
	 * Callback prototype used in #gst_element_call_async
	 */
	interface ElementCallAsyncFunc {
		/**
		 * Callback prototype used in #gst_element_call_async
		 * @param element The {@link Element} this function has been called against
		 */
		(element: Element): void;
	}

	/**
	 * Function called for each pad when using {@link Gst.Element.foreach_sink_pad},
	 * gst_element_foreach_src_pad(), or gst_element_foreach_pad().
	 */
	interface ElementForeachPadFunc {
		/**
		 * Function called for each pad when using {@link Gst.Element.foreach_sink_pad},
		 * gst_element_foreach_src_pad(), or gst_element_foreach_pad().
		 * @param element the {@link Element}
		 * @param pad a {@link Pad}
		 * @returns %FALSE to stop iterating pads, %TRUE to continue
		 */
		(element: Element, pad: Pad): boolean;
	}

	/**
	 * This function will be called when creating a copy of #it and should
	 * create a copy of all custom iterator fields or increase their
	 * reference counts.
	 */
	interface IteratorCopyFunction {
		/**
		 * This function will be called when creating a copy of #it and should
		 * create a copy of all custom iterator fields or increase their
		 * reference counts.
		 * @param it The original iterator
		 * @param copy The copied iterator
		 */
		(it: Iterator, copy: Iterator): void;
	}

	/**
	 * A function to be passed to {@link Gst.Iterator.fold}.
	 */
	interface IteratorFoldFunction {
		/**
		 * A function to be passed to {@link Gst.Iterator.fold}.
		 * @param item the item to fold
		 * @param ret a #GValue collecting the result
		 * @returns %TRUE if the fold should continue, %FALSE if it should stop.
		 */
		(item: GObject.Value, ret: GObject.Value): boolean;
	}

	/**
	 * A function that is called by {@link Gst.Iterator.foreach} for every element.
	 */
	interface IteratorForeachFunction {
		/**
		 * A function that is called by {@link Gst.Iterator.foreach} for every element.
		 * @param item The item
		 */
		(item: GObject.Value): void;
	}

	/**
	 * This function will be called when the iterator is freed.
	 * 
	 * Implementors of a {@link Iterator} should implement this
	 * function and pass it to the constructor of the custom iterator.
	 * The function will be called with the iterator lock held.
	 */
	interface IteratorFreeFunction {
		/**
		 * This function will be called when the iterator is freed.
		 * 
		 * Implementors of a {@link Iterator} should implement this
		 * function and pass it to the constructor of the custom iterator.
		 * The function will be called with the iterator lock held.
		 * @param it the iterator
		 */
		(it: Iterator): void;
	}

	/**
	 * The function that will be called after the next item of the iterator
	 * has been retrieved. This function can be used to skip items or stop
	 * the iterator.
	 * 
	 * The function will be called with the iterator lock held.
	 */
	interface IteratorItemFunction {
		/**
		 * The function that will be called after the next item of the iterator
		 * has been retrieved. This function can be used to skip items or stop
		 * the iterator.
		 * 
		 * The function will be called with the iterator lock held.
		 * @param it the iterator
		 * @param item the item being retrieved.
		 * @returns the result of the operation.
		 */
		(it: Iterator, item: GObject.Value): IteratorItem;
	}

	/**
	 * The function that will be called when the next element of the iterator
	 * should be retrieved.
	 * 
	 * Implementors of a {@link Iterator} should implement this
	 * function and pass it to the constructor of the custom iterator.
	 * The function will be called with the iterator lock held.
	 */
	interface IteratorNextFunction {
		/**
		 * The function that will be called when the next element of the iterator
		 * should be retrieved.
		 * 
		 * Implementors of a {@link Iterator} should implement this
		 * function and pass it to the constructor of the custom iterator.
		 * The function will be called with the iterator lock held.
		 * @param it the iterator
		 * @param result a pointer to hold the next item
		 * @returns the result of the operation.
		 */
		(it: Iterator, result: GObject.Value): IteratorResult;
	}

	/**
	 * This function will be called whenever a concurrent update happened
	 * to the iterated datastructure. The implementor of the iterator should
	 * restart the iterator from the beginning and clean up any state it might
	 * have.
	 * 
	 * Implementors of a {@link Iterator} should implement this
	 * function and pass it to the constructor of the custom iterator.
	 * The function will be called with the iterator lock held.
	 */
	interface IteratorResyncFunction {
		/**
		 * This function will be called whenever a concurrent update happened
		 * to the iterated datastructure. The implementor of the iterator should
		 * restart the iterator from the beginning and clean up any state it might
		 * have.
		 * 
		 * Implementors of a {@link Iterator} should implement this
		 * function and pass it to the constructor of the custom iterator.
		 * The function will be called with the iterator lock held.
		 * @param it the iterator
		 */
		(it: Iterator): void;
	}

	/**
	 * Function prototype for a logging function that can be registered with
	 * {@link Gst.debug.add_log_function}.
	 * Use G_GNUC_NO_INSTRUMENT on that function.
	 */
	interface LogFunction {
		/**
		 * Function prototype for a logging function that can be registered with
		 * {@link Gst.debug.add_log_function}.
		 * Use G_GNUC_NO_INSTRUMENT on that function.
		 * @param category a {@link DebugCategory}
		 * @param level a {@link DebugLevel}
		 * @param file file name
		 * @param _function function name
		 * @param line line number
		 * @param object a #GObject
		 * @param message the message
		 */
		(category: DebugCategory, level: DebugLevel, file: string, _function: string, line: number, object: GObject.Object, message: DebugMessage): void;
	}

	/**
	 * Copy #size bytes from #mem starting at #offset and return them wrapped in a
	 * new GstMemory object.
	 * If #size is set to -1, all bytes starting at #offset are copied.
	 */
	interface MemoryCopyFunction {
		/**
		 * Copy #size bytes from #mem starting at #offset and return them wrapped in a
		 * new GstMemory object.
		 * If #size is set to -1, all bytes starting at #offset are copied.
		 * @param mem a {@link Memory}
		 * @param offset an offset
		 * @param size a size or -1
		 * @returns a new {@link Memory} object wrapping a copy of the requested region in
		 * #mem.
		 */
		(mem: Memory, offset: number, size: number): Memory;
	}

	/**
	 * Check if #mem1 and #mem2 occupy contiguous memory and return the offset of
	 * #mem1 in the parent buffer in #offset.
	 */
	interface MemoryIsSpanFunction {
		/**
		 * Check if #mem1 and #mem2 occupy contiguous memory and return the offset of
		 * #mem1 in the parent buffer in #offset.
		 * @param mem1 a {@link Memory}
		 * @param mem2 a {@link Memory}
		 * @param offset a result offset
		 * @returns %TRUE if #mem1 and #mem2 are in contiguous memory.
		 */
		(mem1: Memory, mem2: Memory, offset: number): boolean;
	}

	/**
	 * Get the memory of #mem that can be accessed according to the mode specified
	 * in #info's flags. The function should return a pointer that contains at least
	 * #maxsize bytes.
	 */
	interface MemoryMapFullFunction {
		/**
		 * Get the memory of #mem that can be accessed according to the mode specified
		 * in #info's flags. The function should return a pointer that contains at least
		 * #maxsize bytes.
		 * @param mem a {@link Memory}
		 * @param info the {@link MapInfo} to map with
		 * @param maxsize size to map
		 * @returns a pointer to memory of which at least #maxsize bytes can be
		 * accessed according to the access pattern in #info's flags.
		 */
		(mem: Memory, info: MapInfo, maxsize: number): any | null;
	}

	/**
	 * Get the memory of #mem that can be accessed according to the mode specified
	 * in #flags. The function should return a pointer that contains at least
	 * #maxsize bytes.
	 */
	interface MemoryMapFunction {
		/**
		 * Get the memory of #mem that can be accessed according to the mode specified
		 * in #flags. The function should return a pointer that contains at least
		 * #maxsize bytes.
		 * @param mem a {@link Memory}
		 * @param maxsize size to map
		 * @param flags access mode for the memory
		 * @returns a pointer to memory of which at least #maxsize bytes can be
		 * accessed according to the access pattern in #flags.
		 */
		(mem: Memory, maxsize: number, flags: MapFlags): any | null;
	}

	/**
	 * Share #size bytes from #mem starting at #offset and return them wrapped in a
	 * new GstMemory object. If #size is set to -1, all bytes starting at #offset are
	 * shared. This function does not make a copy of the bytes in #mem.
	 */
	interface MemoryShareFunction {
		/**
		 * Share #size bytes from #mem starting at #offset and return them wrapped in a
		 * new GstMemory object. If #size is set to -1, all bytes starting at #offset are
		 * shared. This function does not make a copy of the bytes in #mem.
		 * @param mem a {@link Memory}
		 * @param offset an offset
		 * @param size a size or -1
		 * @returns a new {@link Memory} object sharing the requested region in #mem.
		 */
		(mem: Memory, offset: number, size: number): Memory;
	}

	/**
	 * Release the pointer previously retrieved with {@link Gst.Memory.map} with #info.
	 */
	interface MemoryUnmapFullFunction {
		/**
		 * Release the pointer previously retrieved with {@link Gst.Memory.map} with #info.
		 * @param mem a {@link Memory}
		 * @param info a {@link MapInfo}
		 */
		(mem: Memory, info: MapInfo): void;
	}

	/**
	 * Release the pointer previously retrieved with {@link Gst.Memory.map}.
	 */
	interface MemoryUnmapFunction {
		/**
		 * Release the pointer previously retrieved with {@link Gst.Memory.map}.
		 * @param mem a {@link Memory}
		 */
		(mem: Memory): void;
	}

	/**
	 * Function called when #meta is freed in #buffer.
	 */
	interface MetaFreeFunction {
		/**
		 * Function called when #meta is freed in #buffer.
		 * @param meta a {@link Meta}
		 * @param buffer a {@link Buffer}
		 */
		(meta: Meta, buffer: Buffer): void;
	}

	/**
	 * Function called when #meta is initialized in #buffer.
	 */
	interface MetaInitFunction {
		/**
		 * Function called when #meta is initialized in #buffer.
		 * @param meta a {@link Meta}
		 * @param params parameters passed to the init function
		 * @param buffer a {@link Buffer}
		 * @returns 
		 */
		(meta: Meta, params: any | null, buffer: Buffer): boolean;
	}

	/**
	 * Function called for each #meta in #buffer as a result of performing a
	 * transformation on #transbuf. Additional #type specific transform data
	 * is passed to the function as #data.
	 * 
	 * Implementations should check the #type of the transform and parse
	 * additional type specific fields in #data that should be used to update
	 * the metadata on #transbuf.
	 */
	interface MetaTransformFunction {
		/**
		 * Function called for each #meta in #buffer as a result of performing a
		 * transformation on #transbuf. Additional #type specific transform data
		 * is passed to the function as #data.
		 * 
		 * Implementations should check the #type of the transform and parse
		 * additional type specific fields in #data that should be used to update
		 * the metadata on #transbuf.
		 * @param transbuf a {@link Buffer}
		 * @param meta a {@link Meta}
		 * @param buffer a {@link Buffer}
		 * @param type the transform type
		 * @param data transform specific data.
		 * @returns %TRUE if the transform could be performed
		 */
		(transbuf: Buffer, meta: Meta, buffer: Buffer, type: GLib.Quark, data?: any | null): boolean;
	}

	/**
	 * Function prototype for methods to create copies of instances.
	 */
	interface MiniObjectCopyFunction {
		/**
		 * Function prototype for methods to create copies of instances.
		 * @param obj MiniObject to copy
		 * @returns reference to cloned instance.
		 */
		(obj: MiniObject): MiniObject;
	}

	/**
	 * Function prototype for when a miniobject has lost its last refcount.
	 * Implementation of the mini object are allowed to revive the
	 * passed object by doing a {@link Gst.MiniObject.ref}. If the object is not
	 * revived after the dispose function, the function should return %TRUE
	 * and the memory associated with the object is freed.
	 */
	interface MiniObjectDisposeFunction {
		/**
		 * Function prototype for when a miniobject has lost its last refcount.
		 * Implementation of the mini object are allowed to revive the
		 * passed object by doing a {@link Gst.MiniObject.ref}. If the object is not
		 * revived after the dispose function, the function should return %TRUE
		 * and the memory associated with the object is freed.
		 * @param obj MiniObject to dispose
		 * @returns %TRUE if the object should be cleaned up.
		 */
		(obj: MiniObject): boolean;
	}

	/**
	 * Virtual function prototype for methods to free resources used by
	 * mini-objects.
	 */
	interface MiniObjectFreeFunction {
		/**
		 * Virtual function prototype for methods to free resources used by
		 * mini-objects.
		 * @param obj MiniObject to free
		 */
		(obj: MiniObject): void;
	}

	/**
	 * A {@link MiniObjectNotify} function can be added to a mini object as a
	 * callback that gets triggered when {@link Gst.MiniObject.unref} drops the
	 * last ref and #obj is about to be freed.
	 */
	interface MiniObjectNotify {
		/**
		 * A {@link MiniObjectNotify} function can be added to a mini object as a
		 * callback that gets triggered when {@link Gst.MiniObject.unref} drops the
		 * last ref and #obj is about to be freed.
		 * @param obj the mini object
		 */
		(obj: MiniObject): void;
	}

	/**
	 * This function is called when the pad is activated during the element
	 * READY to PAUSED state change. By default this function will call the
	 * activate function that puts the pad in push mode but elements can
	 * override this function to activate the pad in pull mode if they wish.
	 */
	interface PadActivateFunction {
		/**
		 * This function is called when the pad is activated during the element
		 * READY to PAUSED state change. By default this function will call the
		 * activate function that puts the pad in push mode but elements can
		 * override this function to activate the pad in pull mode if they wish.
		 * @param pad a {@link Pad}
		 * @param parent the parent of #pad
		 * @returns %TRUE if the pad could be activated.
		 */
		(pad: Pad, parent: Object): boolean;
	}

	/**
	 * The prototype of the push and pull activate functions.
	 */
	interface PadActivateModeFunction {
		/**
		 * The prototype of the push and pull activate functions.
		 * @param pad a {@link Pad}
		 * @param parent the parent of #pad
		 * @param mode the requested activation mode of #pad
		 * @param active activate or deactivate the pad.
		 * @returns %TRUE if the pad could be activated or deactivated.
		 */
		(pad: Pad, parent: Object, mode: PadMode, active: boolean): boolean;
	}

	/**
	 * A function that will be called on sinkpads when chaining buffers.
	 * The function typically processes the data contained in the buffer and
	 * either consumes the data or passes it on to the internally linked pad(s).
	 * 
	 * The implementer of this function receives a refcount to #buffer and should
	 * {@link Gst.Buffer.unref} when the buffer is no longer needed.
	 * 
	 * When a chain function detects an error in the data stream, it must post an
	 * error on the bus and return an appropriate {@link FlowReturn} value.
	 */
	interface PadChainFunction {
		/**
		 * A function that will be called on sinkpads when chaining buffers.
		 * The function typically processes the data contained in the buffer and
		 * either consumes the data or passes it on to the internally linked pad(s).
		 * 
		 * The implementer of this function receives a refcount to #buffer and should
		 * {@link Gst.Buffer.unref} when the buffer is no longer needed.
		 * 
		 * When a chain function detects an error in the data stream, it must post an
		 * error on the bus and return an appropriate {@link FlowReturn} value.
		 * @param pad the sink {@link Pad} that performed the chain.
		 * @param parent the parent of #pad. If the #GST_PAD_FLAG_NEED_PARENT
		 *          flag is set, #parent is guaranteed to be not-%NULL and remain valid
		 *          during the execution of this function.
		 * @param buffer the {@link Buffer} that is chained, not %NULL.
		 * @returns #GST_FLOW_OK for success
		 */
		(pad: Pad, parent: Object | null, buffer: Buffer): FlowReturn;
	}

	/**
	 * A function that will be called on sinkpads when chaining buffer lists.
	 * The function typically processes the data contained in the buffer list and
	 * either consumes the data or passes it on to the internally linked pad(s).
	 * 
	 * The implementer of this function receives a refcount to #list and
	 * should {@link Gst.BufferList.unref} when the list is no longer needed.
	 * 
	 * When a chainlist function detects an error in the data stream, it must
	 * post an error on the bus and return an appropriate {@link FlowReturn} value.
	 */
	interface PadChainListFunction {
		/**
		 * A function that will be called on sinkpads when chaining buffer lists.
		 * The function typically processes the data contained in the buffer list and
		 * either consumes the data or passes it on to the internally linked pad(s).
		 * 
		 * The implementer of this function receives a refcount to #list and
		 * should {@link Gst.BufferList.unref} when the list is no longer needed.
		 * 
		 * When a chainlist function detects an error in the data stream, it must
		 * post an error on the bus and return an appropriate {@link FlowReturn} value.
		 * @param pad the sink {@link Pad} that performed the chain.
		 * @param parent the parent of #pad. If the #GST_PAD_FLAG_NEED_PARENT
		 *          flag is set, #parent is guaranteed to be not-%NULL and remain valid
		 *          during the execution of this function.
		 * @param list the {@link BufferList} that is chained, not %NULL.
		 * @returns #GST_FLOW_OK for success
		 */
		(pad: Pad, parent: Object | null, list: BufferList): FlowReturn;
	}

	/**
	 * Function signature to handle an event for the pad.
	 * 
	 * This variant is for specific elements that will take into account the
	 * last downstream flow return (from a pad push), in which case they can
	 * return it.
	 */
	interface PadEventFullFunction {
		/**
		 * Function signature to handle an event for the pad.
		 * 
		 * This variant is for specific elements that will take into account the
		 * last downstream flow return (from a pad push), in which case they can
		 * return it.
		 * @param pad the {@link Pad} to handle the event.
		 * @param parent the parent of #pad. If the #GST_PAD_FLAG_NEED_PARENT
		 *          flag is set, #parent is guaranteed to be not-%NULL and remain valid
		 *          during the execution of this function.
		 * @param event the {@link Event} to handle.
		 * @returns %GST_FLOW_OK if the event was handled properly, or any other
		 * {@link FlowReturn} dependent on downstream state.
		 */
		(pad: Pad, parent: Object | null, event: Event): FlowReturn;
	}

	/**
	 * Function signature to handle an event for the pad.
	 */
	interface PadEventFunction {
		/**
		 * Function signature to handle an event for the pad.
		 * @param pad the {@link Pad} to handle the event.
		 * @param parent the parent of #pad. If the #GST_PAD_FLAG_NEED_PARENT
		 *          flag is set, #parent is guaranteed to be not-%NULL and remain valid
		 *          during the execution of this function.
		 * @param event the {@link Event} to handle.
		 * @returns %TRUE if the pad could handle the event.
		 */
		(pad: Pad, parent: Object | null, event: Event): boolean;
	}

	/**
	 * A forward function is called for all internally linked pads, see
	 * {@link Gst.Pad.forward}.
	 */
	interface PadForwardFunction {
		/**
		 * A forward function is called for all internally linked pads, see
		 * {@link Gst.Pad.forward}.
		 * @param pad the {@link Pad} that is forwarded.
		 * @returns %TRUE if the dispatching procedure has to be stopped.
		 */
		(pad: Pad): boolean;
	}

	/**
	 * This function will be called on source pads when a peer element
	 * request a buffer at the specified #offset and #length. If this function
	 * returns #GST_FLOW_OK, the result buffer will be stored in #buffer. The
	 * contents of #buffer is invalid for any other return value.
	 * 
	 * This function is installed on a source pad with
	 * {@link Gst.Pad.set_getrange_function} and can only be called on source pads after
	 * they are successfully activated with gst_pad_activate_mode() with the
	 * #GST_PAD_MODE_PULL.
	 * 
	 * #offset and #length are always given in byte units. #offset must normally be a value
	 * between 0 and the length in bytes of the data available on #pad. The
	 * length (duration in bytes) can be retrieved with a #GST_QUERY_DURATION or with a
	 * #GST_QUERY_SEEKING.
	 * 
	 * Any #offset larger or equal than the length will make the function return
	 * #GST_FLOW_EOS, which corresponds to EOS. In this case #buffer does not
	 * contain a valid buffer.
	 * 
	 * The buffer size of #buffer will only be smaller than #length when #offset is
	 * near the end of the stream. In all other cases, the size of #buffer must be
	 * exactly the requested size.
	 * 
	 * It is allowed to call this function with a 0 #length and valid #offset, in
	 * which case #buffer will contain a 0-sized buffer and the function returns
	 * #GST_FLOW_OK.
	 * 
	 * When this function is called with a -1 #offset, the sequentially next buffer
	 * of length #length in the stream is returned.
	 * 
	 * When this function is called with a -1 #length, a buffer with a default
	 * optimal length is returned in #buffer. The length might depend on the value
	 * of #offset.
	 */
	interface PadGetRangeFunction {
		/**
		 * This function will be called on source pads when a peer element
		 * request a buffer at the specified #offset and #length. If this function
		 * returns #GST_FLOW_OK, the result buffer will be stored in #buffer. The
		 * contents of #buffer is invalid for any other return value.
		 * 
		 * This function is installed on a source pad with
		 * {@link Gst.Pad.set_getrange_function} and can only be called on source pads after
		 * they are successfully activated with gst_pad_activate_mode() with the
		 * #GST_PAD_MODE_PULL.
		 * 
		 * #offset and #length are always given in byte units. #offset must normally be a value
		 * between 0 and the length in bytes of the data available on #pad. The
		 * length (duration in bytes) can be retrieved with a #GST_QUERY_DURATION or with a
		 * #GST_QUERY_SEEKING.
		 * 
		 * Any #offset larger or equal than the length will make the function return
		 * #GST_FLOW_EOS, which corresponds to EOS. In this case #buffer does not
		 * contain a valid buffer.
		 * 
		 * The buffer size of #buffer will only be smaller than #length when #offset is
		 * near the end of the stream. In all other cases, the size of #buffer must be
		 * exactly the requested size.
		 * 
		 * It is allowed to call this function with a 0 #length and valid #offset, in
		 * which case #buffer will contain a 0-sized buffer and the function returns
		 * #GST_FLOW_OK.
		 * 
		 * When this function is called with a -1 #offset, the sequentially next buffer
		 * of length #length in the stream is returned.
		 * 
		 * When this function is called with a -1 #length, a buffer with a default
		 * optimal length is returned in #buffer. The length might depend on the value
		 * of #offset.
		 * @param pad the src {@link Pad} to perform the getrange on.
		 * @param parent the parent of #pad. If the #GST_PAD_FLAG_NEED_PARENT
		 *          flag is set, #parent is guaranteed to be not-%NULL and remain valid
		 *          during the execution of this function.
		 * @param offset the offset of the range
		 * @param length the length of the range
		 * @param buffer a memory location to hold the result buffer, cannot be %NULL.
		 * @returns #GST_FLOW_OK for success and a valid buffer in #buffer. Any other
		 * return value leaves #buffer undefined.
		 */
		(pad: Pad, parent: Object | null, offset: number, length: number, buffer: Buffer): FlowReturn;
	}

	/**
	 * The signature of the internal pad link iterator function.
	 */
	interface PadIterIntLinkFunction {
		/**
		 * The signature of the internal pad link iterator function.
		 * @param pad The {@link Pad} to query.
		 * @param parent the parent of #pad. If the #GST_PAD_FLAG_NEED_PARENT
		 *          flag is set, #parent is guaranteed to be not-%NULL and remain valid
		 *          during the execution of this function.
		 * @returns a new {@link Iterator} that will iterate over all pads that are
		 * linked to the given pad on the inside of the parent element.
		 * 
		 * the caller must call {@link Gst.Iterator.free} after usage.
		 */
		(pad: Pad, parent?: Object | null): Iterator;
	}

	/**
	 * Function signature to handle a new link on the pad.
	 */
	interface PadLinkFunction {
		/**
		 * Function signature to handle a new link on the pad.
		 * @param pad the {@link Pad} that is linked.
		 * @param parent the parent of #pad. If the #GST_PAD_FLAG_NEED_PARENT
		 *          flag is set, #parent is guaranteed to be not-%NULL and remain valid
		 *          during the execution of this function.
		 * @param peer the peer {@link Pad} of the link
		 * @returns the result of the link with the specified peer.
		 */
		(pad: Pad, parent: Object | null, peer: Pad): PadLinkReturn;
	}

	/**
	 * Callback used by {@link Gst.Pad.add_probe}. Gets called to notify about the current
	 * blocking type.
	 * 
	 * The callback is allowed to modify the data pointer in #info.
	 */
	interface PadProbeCallback {
		/**
		 * Callback used by {@link Gst.Pad.add_probe}. Gets called to notify about the current
		 * blocking type.
		 * 
		 * The callback is allowed to modify the data pointer in #info.
		 * @param pad the {@link Pad} that is blocked
		 * @param info {@link PadProbeInfo}
		 * @returns a {@link PadProbeReturn}
		 */
		(pad: Pad, info: PadProbeInfo): PadProbeReturn;
	}

	/**
	 * The signature of the query function.
	 */
	interface PadQueryFunction {
		/**
		 * The signature of the query function.
		 * @param pad the {@link Pad} to query.
		 * @param parent the parent of #pad. If the #GST_PAD_FLAG_NEED_PARENT
		 *          flag is set, #parent is guaranteed to be not-%NULL and remain valid
		 *          during the execution of this function.
		 * @param query the {@link Query} object to execute
		 * @returns %TRUE if the query could be performed.
		 */
		(pad: Pad, parent: Object | null, query: Query): boolean;
	}

	/**
	 * Callback used by {@link Gst.Pad.sticky_events_foreach}.
	 * 
	 * When this function returns %TRUE, the next event will be
	 * returned. When %FALSE is returned, gst_pad_sticky_events_foreach() will return.
	 * 
	 * When #event is set to %NULL, the item will be removed from the list of sticky events.
	 * #event can be replaced by assigning a new reference to it.
	 * This function is responsible for unreffing the old event when
	 * removing or modifying.
	 */
	interface PadStickyEventsForeachFunction {
		/**
		 * Callback used by {@link Gst.Pad.sticky_events_foreach}.
		 * 
		 * When this function returns %TRUE, the next event will be
		 * returned. When %FALSE is returned, gst_pad_sticky_events_foreach() will return.
		 * 
		 * When #event is set to %NULL, the item will be removed from the list of sticky events.
		 * #event can be replaced by assigning a new reference to it.
		 * This function is responsible for unreffing the old event when
		 * removing or modifying.
		 * @param pad the {@link Pad}.
		 * @param event a sticky {@link Event}.
		 * @returns %TRUE if the iteration should continue
		 */
		(pad: Pad, event?: Event | null): boolean;
	}

	/**
	 * Function signature to handle a unlinking the pad prom its peer.
	 * 
	 * The pad's lock is already held when the unlink function is called, so most
	 * pad functions cannot be called from within the callback.
	 */
	interface PadUnlinkFunction {
		/**
		 * Function signature to handle a unlinking the pad prom its peer.
		 * 
		 * The pad's lock is already held when the unlink function is called, so most
		 * pad functions cannot be called from within the callback.
		 * @param pad the {@link Pad} that is linked.
		 * @param parent the parent of #pad. If the #GST_PAD_FLAG_NEED_PARENT
		 *          flag is set, #parent is guaranteed to be not-%NULL and remain valid
		 *          during the execution of this function.
		 */
		(pad: Pad, parent?: Object | null): void;
	}

	/**
	 * A function that can be used with e.g. {@link Gst.Registry.feature_filter}
	 * to get a list of pluginfeature that match certain criteria.
	 */
	interface PluginFeatureFilter {
		/**
		 * A function that can be used with e.g. {@link Gst.Registry.feature_filter}
		 * to get a list of pluginfeature that match certain criteria.
		 * @param feature the pluginfeature to check
		 * @returns %TRUE for a positive match, %FALSE otherwise
		 */
		(feature: PluginFeature): boolean;
	}

	/**
	 * A function that can be used with e.g. {@link Gst.Registry.plugin_filter}
	 * to get a list of plugins that match certain criteria.
	 */
	interface PluginFilter {
		/**
		 * A function that can be used with e.g. {@link Gst.Registry.plugin_filter}
		 * to get a list of plugins that match certain criteria.
		 * @param plugin the plugin to check
		 * @returns %TRUE for a positive match, %FALSE otherwise
		 */
		(plugin: Plugin): boolean;
	}

	/**
	 * A plugin should provide a pointer to a function of either {@link PluginInitFunc}
	 * or this type in the plugin_desc struct.
	 * The function will be called by the loader at startup. One would then
	 * register each #GstPluginFeature. This version allows
	 * user data to be passed to init function (useful for bindings).
	 */
	interface PluginInitFullFunc {
		/**
		 * A plugin should provide a pointer to a function of either {@link PluginInitFunc}
		 * or this type in the plugin_desc struct.
		 * The function will be called by the loader at startup. One would then
		 * register each #GstPluginFeature. This version allows
		 * user data to be passed to init function (useful for bindings).
		 * @param plugin The plugin object
		 * @returns %TRUE if plugin initialised successfully
		 */
		(plugin: Plugin): boolean;
	}

	/**
	 * A plugin should provide a pointer to a function of this type in the
	 * plugin_desc struct.
	 * This function will be called by the loader at startup. One would then
	 * register each {@link PluginFeature}.
	 */
	interface PluginInitFunc {
		/**
		 * A plugin should provide a pointer to a function of this type in the
		 * plugin_desc struct.
		 * This function will be called by the loader at startup. One would then
		 * register each {@link PluginFeature}.
		 * @param plugin The plugin object
		 * @returns %TRUE if plugin initialised successfully
		 */
		(plugin: Plugin): boolean;
	}

	interface PromiseChangeFunc {
		(promise: Promise): void;
	}

	/**
	 * A function that will be called in {@link Gst.Structure.filter_and_map_in_place}.
	 * The function may modify #value, and the value will be removed from
	 * the structure if %FALSE is returned.
	 */
	interface StructureFilterMapFunc {
		/**
		 * A function that will be called in {@link Gst.Structure.filter_and_map_in_place}.
		 * The function may modify #value, and the value will be removed from
		 * the structure if %FALSE is returned.
		 * @param field_id the #GQuark of the field name
		 * @param value the #GValue of the field
		 * @returns %TRUE if the field should be preserved, %FALSE if it
		 * should be removed.
		 */
		(field_id: GLib.Quark, value: GObject.Value): boolean;
	}

	/**
	 * A function that will be called in {@link Gst.Structure.foreach}. The function may
	 * not modify #value.
	 */
	interface StructureForeachFunc {
		/**
		 * A function that will be called in {@link Gst.Structure.foreach}. The function may
		 * not modify #value.
		 * @param field_id the #GQuark of the field name
		 * @param value the #GValue of the field
		 * @returns %TRUE if the foreach operation should continue, %FALSE if
		 * the foreach operation should stop with %FALSE.
		 */
		(field_id: GLib.Quark, value: GObject.Value): boolean;
	}

	/**
	 * A function that will be called in {@link Gst.Structure.map_in_place}. The function
	 * may modify #value.
	 */
	interface StructureMapFunc {
		/**
		 * A function that will be called in {@link Gst.Structure.map_in_place}. The function
		 * may modify #value.
		 * @param field_id the #GQuark of the field name
		 * @param value the #GValue of the field
		 * @returns %TRUE if the map operation should continue, %FALSE if
		 * the map operation should stop with %FALSE.
		 */
		(field_id: GLib.Quark, value: GObject.Value): boolean;
	}

	/**
	 * A function that will be called in {@link Gst.TagList.foreach}. The function may
	 * not modify the tag list.
	 */
	interface TagForeachFunc {
		/**
		 * A function that will be called in {@link Gst.TagList.foreach}. The function may
		 * not modify the tag list.
		 * @param list the {@link TagList}
		 * @param tag a name of a tag in #list
		 */
		(list: TagList, tag: string): void;
	}

	/**
	 * A function for merging multiple values of a tag used when registering
	 * tags.
	 */
	interface TagMergeFunc {
		/**
		 * A function for merging multiple values of a tag used when registering
		 * tags.
		 * @param dest the destination #GValue
		 * @param src the source #GValue
		 */
		(dest: GObject.Value, src: GObject.Value): void;
	}

	/**
	 * A function that will repeatedly be called in the thread created by
	 * a {@link Task}.
	 */
	interface TaskFunction {
		/**
		 * A function that will repeatedly be called in the thread created by
		 * a {@link Task}.
		 */
		(): void;
	}

	/**
	 * Task function, see {@link Gst.TaskPool.push}.
	 */
	interface TaskPoolFunction {
		/**
		 * Task function, see {@link Gst.TaskPool.push}.
		 */
		(): void;
	}

	/**
	 * Custom GstTask thread callback functions that can be installed.
	 */
	interface TaskThreadFunc {
		/**
		 * Custom GstTask thread callback functions that can be installed.
		 * @param task The {@link Task}
		 * @param thread The #GThread
		 */
		(task: Task, thread: GLib.Thread): void;
	}

	/**
	 * A function that will be called by typefinding.
	 */
	interface TypeFindFunction {
		/**
		 * A function that will be called by typefinding.
		 * @param find A {@link TypeFind} structure
		 */
		(find: TypeFind): void;
	}

	/**
	 * Used together with {@link Gst.value.compare} to compare #GValue items.
	 */
	interface ValueCompareFunc {
		/**
		 * Used together with {@link Gst.value.compare} to compare #GValue items.
		 * @param value1 first value for comparison
		 * @param value2 second value for comparison
		 * @returns one of GST_VALUE_LESS_THAN, GST_VALUE_EQUAL, GST_VALUE_GREATER_THAN
		 * or GST_VALUE_UNORDERED
		 */
		(value1: GObject.Value, value2: GObject.Value): number;
	}

	/**
	 * Used by {@link Gst.value.deserialize} to parse a non-binary form into the #GValue.
	 */
	interface ValueDeserializeFunc {
		/**
		 * Used by {@link Gst.value.deserialize} to parse a non-binary form into the #GValue.
		 * @param dest a #GValue
		 * @param s a string
		 * @returns %TRUE for success
		 */
		(dest: GObject.Value, s: string): boolean;
	}

	/**
	 * Used by {@link Gst.value.serialize} to obtain a non-binary form of the #GValue.
	 * 
	 * Free-function: g_free
	 */
	interface ValueSerializeFunc {
		/**
		 * Used by {@link Gst.value.serialize} to obtain a non-binary form of the #GValue.
		 * 
		 * Free-function: g_free
		 * @param value1 a #GValue
		 * @returns the string representation of the value
		 */
		(value1: GObject.Value): string;
	}

	/**
	 * A datatype to hold the handle to an outstanding sync or async clock callback.
	 */
	type ClockID = any;

	/**
	 * A datatype to hold a time, measured in nanoseconds.
	 */
	type ClockTime = number;

	/**
	 * A datatype to hold a time difference, measured in nanoseconds.
	 */
	type ClockTimeDiff = number;

	/**
	 * A type defining the type of an element factory.
	 */
	type ElementFactoryListType = number;

	/**
	 * Get the maximum amount of memory blocks that a buffer can hold. This is a
	 * compile time constant that can be queried with the function.
	 * 
	 * When more memory blocks are added, existing memory blocks will be merged
	 * together to make room for the new block.
	 * @returns the maximum amount of memory blocks that a buffer can hold.
	 */
	function buffer_get_max_memory(): number;
	/**
	 * Calculates the linear regression of the values #xy and places the
	 * result in #m_num, #m_denom, #b and #xbase, representing the function
	 *   y(x) = m_num/m_denom * (x - xbase) + b
	 * that has the least-square distance from all points #x and #y.
	 * 
	 * #r_squared will contain the remaining error.
	 * 
	 * If #temp is not %NULL, it will be used as temporary space for the function,
	 * in which case the function works without any allocation at all. If #temp is
	 * %NULL, an allocation will take place. #temp should have at least the same
	 * amount of memory allocated as #xy, i.e. 2*n*sizeof(GstClockTime).
	 * 
	 * > This function assumes (x,y) values with reasonable large differences
	 * > between them. It will not calculate the exact results if the differences
	 * > between neighbouring values are too small due to not being able to
	 * > represent sub-integer values during the calculations.
	 * @param xy Pairs of (x,y) values
	 * @param temp Temporary scratch space used by the function
	 * @param n number of (x,y) pairs
	 * @returns %TRUE if the linear regression was successfully calculated
	 * 
	 * numerator of calculated slope
	 * 
	 * denominator of calculated slope
	 * 
	 * Offset at Y-axis
	 * 
	 * Offset at X-axis
	 * 
	 * R-squared
	 */
	function calculate_linear_regression(xy: ClockTime, temp: ClockTime, n: number): [ boolean, ClockTime, ClockTime, ClockTime, ClockTime, number ];
	/**
	 * Creates a {@link CapsFeatures} from a string representation.
	 * 
	 * Free-function: gst_caps_features_free
	 * @param features a string representation of a {@link CapsFeatures}.
	 * @returns a new {@link CapsFeatures} or
	 *     %NULL when the string could not be parsed. Free with
	 *     {@link Gst.CapsFeatures.free} after use.
	 */
	function caps_features_from_string(features: string): CapsFeatures | null;
	/**
	 * Converts #caps from a string representation.
	 * 
	 * The current implementation of serialization will lead to unexpected results
	 * when there are nested {@link Caps} / #GstStructure deeper than one level.
	 * @param string a string to convert to {@link Caps}
	 * @returns a newly allocated {@link Caps}
	 */
	function caps_from_string(string: string): Caps | null;
	/**
	 * Clears a reference to a {@link MiniObject}.
	 * 
	 * #object_ptr must not be %NULL.
	 * 
	 * If the reference is %NULL then this function does nothing.
	 * Otherwise, the reference count of the object is decreased using
	 * {@link Gst.MiniObject.unref} and the pointer is set to %NULL.
	 * 
	 * A macro is also included that allows this function to be used without
	 * pointer casts.
	 * @param object_ptr a pointer to a {@link MiniObject} reference
	 */
	function clear_mini_object(object_ptr: MiniObject): void;
	/**
	 * Clears a reference to a {@link Object}.
	 * 
	 * #object_ptr must not be %NULL.
	 * 
	 * If the reference is %NULL then this function does nothing.
	 * Otherwise, the reference count of the object is decreased using
	 * {@link Gst.Object.unref} and the pointer is set to %NULL.
	 * 
	 * A macro is also included that allows this function to be used without
	 * pointer casts.
	 * @param object_ptr a pointer to a {@link Object} reference
	 */
	function clear_object(object_ptr: Object): void;
	/**
	 * Clears a reference to a {@link Structure}.
	 * 
	 * #structure_ptr must not be %NULL.
	 * 
	 * If the reference is %NULL then this function does nothing.
	 * Otherwise, the structure is free'd using {@link Gst.Structure.free} and the
	 * pointer is set to %NULL.
	 * 
	 * A macro is also included that allows this function to be used without
	 * pointer casts.
	 * @param structure_ptr a pointer to a {@link Structure} reference
	 */
	function clear_structure(structure_ptr: Structure): void;
	function core_error_quark(): GLib.Quark;
	/**
	 * Adds the logging function to the list of logging functions.
	 * Be sure to use #G_GNUC_NO_INSTRUMENT on that function, it is needed.
	 * @param func the function to use
	 */
	function debug_add_log_function(func: LogFunction): void;
	/**
	 * Adds a memory ringbuffer based debug logger that stores up to
	 * #max_size_per_thread bytes of logs per thread and times out threads after
	 * #thread_timeout seconds of inactivity.
	 * 
	 * Logs can be fetched with {@link Gst.debug.ring_buffer_logger_get_logs} and the
	 * logger can be removed again with gst_debug_remove_ring_buffer_logger().
	 * Only one logger at a time is possible.
	 * @param max_size_per_thread Maximum size of log per thread in bytes
	 * @param thread_timeout Timeout for threads in seconds
	 */
	function debug_add_ring_buffer_logger(max_size_per_thread: number, thread_timeout: number): void;
	/**
	 * To aid debugging applications one can use this method to obtain the whole
	 * network of gstreamer elements that form the pipeline into an dot file.
	 * This data can be processed with graphviz to get an image.
	 * @param bin the top-level pipeline that should be analyzed
	 * @param details type of {@link DebugGraphDetails} to use
	 * @returns a string containing the pipeline in graphviz
	 * dot format.
	 */
	function debug_bin_to_dot_data(bin: Bin, details: DebugGraphDetails): string;
	/**
	 * To aid debugging applications one can use this method to write out the whole
	 * network of gstreamer elements that form the pipeline into an dot file.
	 * This file can be processed with graphviz to get an image.
	 * 
	 * ``` shell
	 *  dot -Tpng -oimage.png graph_lowlevel.dot
	 * ```
	 * @param bin the top-level pipeline that should be analyzed
	 * @param details type of {@link DebugGraphDetails} to use
	 * @param file_name output base filename (e.g. "myplayer")
	 */
	function debug_bin_to_dot_file(bin: Bin, details: DebugGraphDetails, file_name: string): void;
	/**
	 * This works like {@link Gst.debug.bin_to_dot_file}, but adds the current timestamp
	 * to the filename, so that it can be used to take multiple snapshots.
	 * @param bin the top-level pipeline that should be analyzed
	 * @param details type of {@link DebugGraphDetails} to use
	 * @param file_name output base filename (e.g. "myplayer")
	 */
	function debug_bin_to_dot_file_with_ts(bin: Bin, details: DebugGraphDetails, file_name: string): void;
	/**
	 * Constructs a string that can be used for getting the desired color in color
	 * terminals.
	 * You need to free the string after use.
	 * @param colorinfo the color info
	 * @returns a string containing the color
	 *     definition
	 */
	function debug_construct_term_color(colorinfo: number): string;
	/**
	 * Constructs an integer that can be used for getting the desired color in
	 * windows' terminals (cmd.exe). As there is no mean to underline, we simply
	 * ignore this attribute.
	 * 
	 * This function returns 0 on non-windows machines.
	 * @param colorinfo the color info
	 * @returns an integer containing the color definition
	 */
	function debug_construct_win_color(colorinfo: number): number;
	/**
	 * Returns a snapshot of a all categories that are currently in use . This list
	 * may change anytime.
	 * The caller has to free the list after use.
	 * @returns the list of
	 *     debug categories
	 */
	function debug_get_all_categories(): DebugCategory[];
	/**
	 * Changes the coloring mode for debug output.
	 * @returns see {@link DebugColorMode} for possible values.
	 */
	function debug_get_color_mode(): DebugColorMode;
	/**
	 * Returns the default threshold that is used for new categories.
	 * @returns the default threshold level
	 */
	function debug_get_default_threshold(): DebugLevel;
	function debug_get_stack_trace(flags: StackTraceFlags): string | null;
	/**
	 * Checks if debugging output is activated.
	 * @returns %TRUE, if debugging is activated
	 */
	function debug_is_active(): boolean;
	/**
	 * Checks if the debugging output should be colored.
	 * @returns %TRUE, if the debug output should be colored.
	 */
	function debug_is_colored(): boolean;
	/**
	 * Get the string representation of a debugging level
	 * @param level the level to get the name for
	 * @returns the name
	 */
	function debug_level_get_name(level: DebugLevel): string;
	/**
	 * Logs the given message using the currently registered debugging handlers.
	 * @param category category to log
	 * @param level level of the message is in
	 * @param file the file that emitted the message, usually the __FILE__ identifier
	 * @param _function the function that emitted the message
	 * @param line the line from that the message was emitted, usually __LINE__
	 * @param object the object this message relates to,
	 *     or %NULL if none
	 * @param format a printf style format string
	 */
	function debug_log(category: DebugCategory, level: DebugLevel, file: string, _function: string, line: number, object: GObject.Object | null, format: string): void;
	/**
	 * The default logging handler used by GStreamer. Logging functions get called
	 * whenever a macro like GST_DEBUG or similar is used. By default this function
	 * is setup to output the message and additional info to stderr (or the log file
	 * specified via the GST_DEBUG_FILE environment variable) as received via
	 * #user_data.
	 * 
	 * You can add other handlers by using {@link Gst.debug.add_log_function}.
	 * And you can remove this handler by calling
	 * gst_debug_remove_log_function(gst_debug_log_default);
	 * @param category category to log
	 * @param level level of the message
	 * @param file the file that emitted the message, usually the __FILE__ identifier
	 * @param _function the function that emitted the message
	 * @param line the line from that the message was emitted, usually __LINE__
	 * @param object the object this message relates to,
	 *     or %NULL if none
	 * @param message the actual message
	 * @param user_data the FILE* to log to
	 */
	function debug_log_default(category: DebugCategory, level: DebugLevel, file: string, _function: string, line: number, object: GObject.Object | null, message: DebugMessage, user_data: any | null): void;
	/**
	 * Returns the string representation for the specified debug log message
	 * formatted in the same way as {@link Gst.debug.log_default} (the default handler),
	 * without color. The purpose is to make it easy for custom log output
	 * handlers to get a log output that is identical to what the default handler
	 * would write out.
	 * @param category category to log
	 * @param level level of the message
	 * @param file the file that emitted the message, usually the __FILE__ identifier
	 * @param _function the function that emitted the message
	 * @param line the line from that the message was emitted, usually __LINE__
	 * @param object the object this message relates to,
	 *     or %NULL if none
	 * @param message the actual message
	 * @returns 
	 */
	function debug_log_get_line(category: DebugCategory, level: DebugLevel, file: string, _function: string, line: number, object: GObject.Object | null, message: DebugMessage): string;
	/**
	 * Logs the given message using the currently registered debugging handlers.
	 * @param category category to log
	 * @param level level of the message is in
	 * @param file the file that emitted the message, usually the __FILE__ identifier
	 * @param _function the function that emitted the message
	 * @param line the line from that the message was emitted, usually __LINE__
	 * @param object the object this message relates to,
	 *     or %NULL if none
	 * @param format a printf style format string
	 * @param args optional arguments for the format
	 */
	function debug_log_valist(category: DebugCategory, level: DebugLevel, file: string, _function: string, line: number, object: GObject.Object | null, format: string, args: any[]): void;
	/**
	 * If libunwind, glibc backtrace or DbgHelp are present
	 * a stack trace is printed.
	 */
	function debug_print_stack_trace(): void;
	/**
	 * Removes all registered instances of the given logging functions.
	 * @param func the log function to remove, or %NULL to
	 *     remove the default log function
	 * @returns How many instances of the function were removed
	 */
	function debug_remove_log_function(func: LogFunction | null): number;
	/**
	 * Removes all registered instances of log functions with the given user data.
	 * @param data user data of the log function to remove
	 * @returns How many instances of the function were removed
	 */
	function debug_remove_log_function_by_data(data: any | null): number;
	/**
	 * Removes any previously added ring buffer logger with
	 * {@link Gst.debug.add_ring_buffer_logger}.
	 */
	function debug_remove_ring_buffer_logger(): void;
	/**
	 * Fetches the current logs per thread from the ring buffer logger. See
	 * {@link Gst.debug.add_ring_buffer_logger} for details.
	 * @returns NULL-terminated array of
	 * strings with the debug output per thread
	 */
	function debug_ring_buffer_logger_get_logs(): string[];
	/**
	 * If activated, debugging messages are sent to the debugging
	 * handlers.
	 * It makes sense to deactivate it for speed issues.
	 * > This function is not threadsafe. It makes sense to only call it
	 * during initialization.
	 * @param active Whether to use debugging output or not
	 */
	function debug_set_active(active: boolean): void;
	/**
	 * Changes the coloring mode for debug output.
	 * 
	 * This function may be called before gst_init().
	 * @param mode The coloring mode for debug output. See {@link DebugColorMode}.
	 */
	function debug_set_color_mode(mode: DebugColorMode): void;
	/**
	 * Changes the coloring mode for debug output.
	 * 
	 * This function may be called before gst_init().
	 * @param mode The coloring mode for debug output. One of the following:
	 * "on", "auto", "off", "disable", "unix".
	 */
	function debug_set_color_mode_from_string(mode: string): void;
	/**
	 * Sets or unsets the use of coloured debugging output.
	 * Same as gst_debug_set_color_mode () with the argument being
	 * being GST_DEBUG_COLOR_MODE_ON or GST_DEBUG_COLOR_MODE_OFF.
	 * 
	 * This function may be called before gst_init().
	 * @param colored Whether to use colored output or not
	 */
	function debug_set_colored(colored: boolean): void;
	/**
	 * Sets the default threshold to the given level and updates all categories to
	 * use this threshold.
	 * 
	 * This function may be called before gst_init().
	 * @param level level to set
	 */
	function debug_set_default_threshold(level: DebugLevel): void;
	/**
	 * Sets all categories which match the given glob style pattern to the given
	 * level.
	 * @param name name of the categories to set
	 * @param level level to set them to
	 */
	function debug_set_threshold_for_name(name: string, level: DebugLevel): void;
	/**
	 * Sets the debug logging wanted in the same form as with the GST_DEBUG
	 * environment variable. You can use wildcards such as '*', but note that
	 * the order matters when you use wild cards, e.g. "foosrc:6,*src:3,*:2" sets
	 * everything to log level 2.
	 * @param list comma-separated list of "category:level" pairs to be used
	 *     as debug logging levels
	 * @param reset %TRUE to clear all previously-set debug levels before setting
	 *     new thresholds
	 * %FALSE if adding the threshold described by #list to the one already set.
	 */
	function debug_set_threshold_from_string(list: string, reset: boolean): void;
	/**
	 * Resets all categories with the given name back to the default level.
	 * @param name name of the categories to set
	 */
	function debug_unset_threshold_for_name(name: string): void;
	/**
	 * Clean up any resources created by GStreamer in gst_init().
	 * 
	 * It is normally not needed to call this function in a normal application
	 * as the resources will automatically be freed when the program terminates.
	 * This function is therefore mostly used by testsuites and other memory
	 * profiling tools.
	 * 
	 * After this call GStreamer (including this method) should not be used anymore.
	 */
	function deinit(): void;
	/**
	 * Registers a new {@link DynamicTypeFactory} in the registry
	 * @param plugin The {@link Plugin} to register #dyn_type for
	 * @param type The #GType to register dynamically
	 * @returns 
	 */
	function dynamic_type_register(plugin: Plugin, type: GObject.Type): boolean;
	/**
	 * Get a string describing the error message in the current locale.
	 * @param domain the GStreamer error domain this error belongs to.
	 * @param code the error code belonging to the domain.
	 * @returns a newly allocated string describing
	 *     the error message (in UTF-8 encoding)
	 */
	function error_get_message(domain: GLib.Quark, code: number): string;
	/**
	 * Gets the {@link EventTypeFlags} associated with #type.
	 * @param type a {@link EventType}
	 * @returns a {@link EventTypeFlags}.
	 */
	function event_type_get_flags(type: EventType): EventTypeFlags;
	/**
	 * Get a printable name for the given event type. Do not modify or free.
	 * @param type the event type
	 * @returns a reference to the static name of the event.
	 */
	function event_type_get_name(type: EventType): string;
	/**
	 * Get the unique quark for the given event type.
	 * @param type the event type
	 * @returns the quark associated with the event type
	 */
	function event_type_to_quark(type: EventType): GLib.Quark;
	/**
	 * Similar to {@link G.filename_to_uri}, but attempts to handle relative file paths
	 * as well. Before converting #filename into an URI, it will be prefixed by
	 * the current working directory if it is a relative path, and then the path
	 * will be canonicalised so that it doesn't contain any './' or '../' segments.
	 * 
	 * On Windows #filename should be in UTF-8 encoding.
	 * @param filename absolute or relative file name path
	 * @returns newly-allocated URI string, or NULL on error. The caller must
	 *   free the URI string with {@link G.free} when no longer needed.
	 */
	function filename_to_uri(filename: string): string;
	/**
	 * Gets a string representing the given flow return.
	 * @param ret a {@link FlowReturn} to get the name of.
	 * @returns a static string with the name of the flow return.
	 */
	function flow_get_name(ret: FlowReturn): string;
	/**
	 * Get the unique quark for the given GstFlowReturn.
	 * @param ret a {@link FlowReturn} to get the quark of.
	 * @returns the quark associated with the flow return or 0 if an
	 * invalid return was specified.
	 */
	function flow_to_quark(ret: FlowReturn): GLib.Quark;
	/**
	 * Return the format registered with the given nick.
	 * @param nick The nick of the format
	 * @returns The format with #nick or GST_FORMAT_UNDEFINED
	 * if the format was not registered.
	 */
	function format_get_by_nick(nick: string): Format;
	/**
	 * Get details about the given format.
	 * @param format The format to get details of
	 * @returns The {@link FormatDefinition} for #format or %NULL
	 * on failure.
	 * 
	 * MT safe.
	 */
	function format_get_details(format: Format): FormatDefinition | null;
	/**
	 * Get a printable name for the given format. Do not modify or free.
	 * @param format a {@link Format}
	 * @returns a reference to the static name of the format
	 * or %NULL if the format is unknown.
	 */
	function format_get_name(format: Format): string | null;
	/**
	 * Iterate all the registered formats. The format definition is read
	 * only.
	 * @returns a GstIterator of {@link FormatDefinition}.
	 */
	function format_iterate_definitions(): Iterator;
	/**
	 * Create a new GstFormat based on the nick or return an
	 * already registered format with that nick.
	 * @param nick The nick of the new format
	 * @param description The description of the new format
	 * @returns A new GstFormat or an already registered format
	 * with the same nick.
	 * 
	 * MT safe.
	 */
	function format_register(nick: string, description: string): Format;
	/**
	 * Get the unique quark for the given format.
	 * @param format a {@link Format}
	 * @returns the quark associated with the format or 0 if the format
	 * is unknown.
	 */
	function format_to_quark(format: Format): GLib.Quark;
	/**
	 * See if the given format is inside the format array.
	 * @param formats The format array to search
	 * @param format the format to find
	 * @returns %TRUE if the format is found inside the array
	 */
	function formats_contains(formats: Format[], format: Format): boolean;
	/**
	 * This helper is mostly helpful for plugins that need to
	 * inspect the folder of the main executable to determine
	 * their set of features.
	 * 
	 * When a plugin is initialized from the gst-plugin-scanner
	 * external process, the returned path will be the same as from the
	 * parent process.
	 * @returns The path of the executable that
	 *   initialized GStreamer, or %NULL if it could not be determined.
	 */
	function get_main_executable_path(): string | null;
	/**
	 * Allocates, fills and returns a 0-terminated string from the printf style
	 * #format string and corresponding arguments.
	 * 
	 * See {@link Gst.info.vasprintf} for when this function is required.
	 * 
	 * Free with g_free().
	 * @param format a printf style format string
	 * @returns a newly allocated null terminated string or %NULL on any error
	 */
	function info_strdup_printf(format: string): string | null;
	/**
	 * Allocates, fills and returns a null terminated string from the printf style
	 * #format string and #args.
	 * 
	 * See {@link Gst.info.vasprintf} for when this function is required.
	 * 
	 * Free with g_free().
	 * @param format a printf style format string
	 * @param args the va_list of printf arguments for #format
	 * @returns a newly allocated null terminated string or %NULL on any error
	 */
	function info_strdup_vprintf(format: string, args: any[]): string | null;
	/**
	 * Allocates and fills a string large enough (including the terminating null
	 * byte) to hold the specified printf style #format and #args.
	 * 
	 * This function deals with the GStreamer specific printf specifiers
	 * #GST_PTR_FORMAT and #GST_SEGMENT_FORMAT.  If you do not have these specifiers
	 * in your #format string, you do not need to use this function and can use
	 * alternatives such as {@link G.vasprintf}.
	 * 
	 * Free #result with g_free().
	 * @param format a printf style format string
	 * @param args the va_list of printf arguments for #format
	 * @returns the length of the string allocated into #result or -1 on any error
	 * 
	 * the resulting string
	 */
	function info_vasprintf(format: string, args: any[]): [ number, string ];
	/**
	 * Initializes the GStreamer library, setting up internal path lists,
	 * registering built-in elements, and loading standard plugins.
	 * 
	 * Unless the plugin registry is disabled at compile time, the registry will be
	 * loaded. By default this will also check if the registry cache needs to be
	 * updated and rescan all plugins if needed. See {@link Gst.update.registry} for
	 * details and section
	 * <link linkend="gst-running">Running GStreamer Applications</link>
	 * for how to disable automatic registry updates.
	 * 
	 * > This function will terminate your program if it was unable to initialize
	 * > GStreamer for some reason.  If you want your program to fall back,
	 * > use gst_init_check() instead.
	 * 
	 * WARNING: This function does not work in the same way as corresponding
	 * functions in other glib-style libraries, such as gtk_init\(\). In
	 * particular, unknown command line options cause this function to
	 * abort program execution.
	 */
	function init(): void;
	/**
	 * Initializes the GStreamer library, setting up internal path lists,
	 * registering built-in elements, and loading standard plugins.
	 * 
	 * This function will return %FALSE if GStreamer could not be initialized
	 * for some reason.  If you want your program to fail fatally,
	 * use gst_init() instead.
	 * @returns %TRUE if GStreamer could be initialized.
	 */
	function init_check(): boolean;
	/**
	 * Returns a #GOptionGroup with GStreamer's argument specifications. The
	 * group is set up to use standard GOption callbacks, so when using this
	 * group in combination with GOption parsing methods, all argument parsing
	 * and initialization is automated.
	 * 
	 * This function is useful if you want to integrate GStreamer with other
	 * libraries that use GOption (see {@link G.option_context_add_group} ).
	 * 
	 * If you use this function, you should make sure you initialise the GLib
	 * threading system as one of the very first things in your program
	 * (see the example at the beginning of this section).
	 * @returns a pointer to GStreamer's option group.
	 */
	function init_get_option_group(): GLib.OptionGroup | null;
	/**
	 * Checks if #obj is a {@link CapsFeatures}
	 * @param obj
	 * @returns %TRUE if #obj is a {@link CapsFeatures} %FALSE otherwise
	 */
	function is_caps_features(obj: any | null): boolean;
	/**
	 * Use this function to check if GStreamer has been initialized with gst_init()
	 * or gst_init_check().
	 * @returns %TRUE if initialization has been done, %FALSE otherwise.
	 */
	function is_initialized(): boolean;
	function library_error_quark(): GLib.Quark;
	/**
	 * Create a {@link Structure} to be used with #gst_element_message_full_with_details
	 * @param name Name of the first field to set
	 * @returns 
	 */
	function make_element_message_details(name: string): Structure;
	/**
	 * Modifies a pointer to a {@link Message} to point to a different #GstMessage. The
	 * modification is done atomically (so this is useful for ensuring thread safety
	 * in some cases), and the reference counts are updated appropriately (the old
	 * message is unreffed, the new one is reffed).
	 * 
	 * Either #new_message or the #GstMessage pointed to by #old_message may be %NULL.
	 * @param new_message pointer to a {@link Message} that will
	 *     replace the message pointed to by #old_message.
	 * @returns %TRUE if #new_message was different from #old_message
	 */
	function message_replace(new_message: Message | null): boolean;
	/**
	 * Get a printable name for the given message type. Do not modify or free.
	 * @param type the message type
	 * @returns a reference to the static name of the message.
	 */
	function message_type_get_name(type: MessageType): string;
	/**
	 * Get the unique quark for the given message type.
	 * @param type the message type
	 * @returns the quark associated with the message type
	 */
	function message_type_to_quark(type: MessageType): GLib.Quark;
	function meta_api_type_get_tags(api: GObject.Type): string[];
	/**
	 * Check if #api was registered with #tag.
	 * @param api an API
	 * @param tag the tag to check
	 * @returns %TRUE if #api was registered with #tag.
	 */
	function meta_api_type_has_tag(api: GObject.Type, tag: GLib.Quark): boolean;
	/**
	 * Register and return a GType for the #api and associate it with
	 * #tags.
	 * @param api an API to register
	 * @param tags tags for #api
	 * @returns a unique GType for #api.
	 */
	function meta_api_type_register(api: string, tags: string[]): GObject.Type;
	/**
	 * Lookup a previously registered meta info structure by its implementation name
	 * #impl.
	 * @param impl the name
	 * @returns a {@link MetaInfo} with #impl, or
	 * %NULL when no such metainfo exists.
	 */
	function meta_get_info(impl: string): MetaInfo | null;
	/**
	 * Register a new {@link Meta} implementation.
	 * 
	 * The same #info can be retrieved later with {@link Gst.meta.get_info} by using
	 * #impl as the key.
	 * @param api the type of the {@link Meta} API
	 * @param impl the name of the {@link Meta} implementation
	 * @param size the size of the {@link Meta} structure
	 * @param init_func a {@link MetaInitFunction}
	 * @param free_func a {@link MetaFreeFunction}
	 * @param transform_func a {@link MetaTransformFunction}
	 * @returns a {@link MetaInfo} that can be used to
	 * access metadata.
	 */
	function meta_register(api: GObject.Type, impl: string, size: number, init_func: MetaInitFunction, free_func: MetaFreeFunction, transform_func: MetaTransformFunction): MetaInfo | null;
	/**
	 * Atomically modifies a pointer to point to a new mini-object.
	 * The reference count of #olddata is decreased and the reference count of
	 * #newdata is increased.
	 * 
	 * Either #newdata and the value pointed to by #olddata may be %NULL.
	 * @param newdata pointer to new mini-object
	 * @returns %TRUE if #newdata was different from #olddata
	 */
	function mini_object_replace(newdata: MiniObject | null): boolean;
	/**
	 * Replace the current {@link MiniObject} pointer to by #olddata with %NULL and
	 * return the old value.
	 * @returns the {@link MiniObject} at #oldata
	 */
	function mini_object_steal(): MiniObject | null;
	/**
	 * Modifies a pointer to point to a new mini-object. The modification
	 * is done atomically. This version is similar to {@link Gst.mini.object_replace}
	 * except that it does not increase the refcount of #newdata and thus
	 * takes ownership of #newdata.
	 * 
	 * Either #newdata and the value pointed to by #olddata may be %NULL.
	 * @param newdata pointer to new mini-object
	 * @returns %TRUE if #newdata was different from #olddata
	 */
	function mini_object_take(newdata: MiniObject): boolean;
	/**
	 * Return the name of a pad mode, for use in debug messages mostly.
	 * @param mode the pad mode
	 * @returns short mnemonic for pad mode #mode
	 */
	function pad_mode_get_name(mode: PadMode): string;
	/**
	 * This function creates a GstArray GParamSpec for use by objects/elements
	 * that want to expose properties of GstArray type. This function is
	 * typically * used in connection with {@link GObject.class_install_property} in a
	 * GObjects's instance_init function.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param element_spec GParamSpec of the array
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_array(name: string, nick: string, blurb: string, element_spec: GObject.ParamSpec, flags: GObject.ParamFlags): GObject.ParamSpec;
	/**
	 * This function creates a fraction GParamSpec for use by objects/elements
	 * that want to expose properties of fraction type. This function is typically
	 * used in connection with {@link GObject.class_install_property} in a GObjects's
	 * instance_init function.
	 * @param name canonical name of the property specified
	 * @param nick nick name for the property specified
	 * @param blurb description of the property specified
	 * @param min_num minimum value (fraction numerator)
	 * @param min_denom minimum value (fraction denominator)
	 * @param max_num maximum value (fraction numerator)
	 * @param max_denom maximum value (fraction denominator)
	 * @param default_num default value (fraction numerator)
	 * @param default_denom default value (fraction denominator)
	 * @param flags flags for the property specified
	 * @returns a newly created parameter specification
	 */
	function param_spec_fraction(name: string, nick: string, blurb: string, min_num: number, min_denom: number, max_num: number, max_denom: number, default_num: number, default_denom: number, flags: GObject.ParamFlags): GObject.ParamSpec | null;
	function parent_buffer_meta_api_get_type(): GObject.Type;
	/**
	 * Get the global {@link MetaInfo} describing  the #GstParentBufferMeta meta.
	 * @returns The {@link MetaInfo}
	 */
	function parent_buffer_meta_get_info(): MetaInfo;
	/**
	 * This is a convenience wrapper around {@link Gst.parse.launch} to create a
	 * {@link Bin} from a gst-launch-style pipeline description. See
	 * gst_parse_launch() and the gst-launch man page for details about the
	 * syntax. Ghost pads on the bin for unlinked source or sink pads
	 * within the bin can automatically be created (but only a maximum of
	 * one ghost pad for each direction will be created; if you expect
	 * multiple unlinked source pads or multiple unlinked sink pads
	 * and want them all ghosted, you will have to create the ghost pads
	 * yourself).
	 * @param bin_description command line describing the bin
	 * @param ghost_unlinked_pads whether to automatically create ghost pads
	 *     for unlinked source or sink pads within the bin
	 * @returns a
	 *   newly-created bin, or %NULL if an error occurred.
	 */
	function parse_bin_from_description(bin_description: string, ghost_unlinked_pads: boolean): Bin;
	/**
	 * This is a convenience wrapper around {@link Gst.parse.launch} to create a
	 * {@link Bin} from a gst-launch-style pipeline description. See
	 * gst_parse_launch() and the gst-launch man page for details about the
	 * syntax. Ghost pads on the bin for unlinked source or sink pads
	 * within the bin can automatically be created (but only a maximum of
	 * one ghost pad for each direction will be created; if you expect
	 * multiple unlinked source pads or multiple unlinked sink pads
	 * and want them all ghosted, you will have to create the ghost pads
	 * yourself).
	 * @param bin_description command line describing the bin
	 * @param ghost_unlinked_pads whether to automatically create ghost pads
	 *     for unlinked source or sink pads within the bin
	 * @param context a parse context allocated with
	 *     {@link Gst.ParseContext.new}, or %NULL
	 * @param flags parsing options, or #GST_PARSE_FLAG_NONE
	 * @returns a newly-created
	 *   element, which is guaranteed to be a bin unless
	 *   #GST_PARSE_FLAG_NO_SINGLE_ELEMENT_BINS was passed, or %NULL if an error
	 *   occurred.
	 */
	function parse_bin_from_description_full(bin_description: string, ghost_unlinked_pads: boolean, context: ParseContext | null, flags: ParseFlags): Element;
	/**
	 * Get the error quark used by the parsing subsystem.
	 * @returns the quark of the parse errors.
	 */
	function parse_error_quark(): GLib.Quark;
	/**
	 * Create a new pipeline based on command line syntax.
	 * Please note that you might get a return value that is not %NULL even though
	 * the #error is set. In this case there was a recoverable parsing error and you
	 * can try to play the pipeline.
	 * 
	 * To create a sub-pipeline (bin) for embedding into an existing pipeline
	 * use {@link Gst.parse.bin_from_description}.
	 * @param pipeline_description the command line describing the pipeline
	 * @returns a new element on success, %NULL on
	 *   failure. If more than one toplevel element is specified by the
	 *   #pipeline_description, all elements are put into a {@link Pipeline}, which
	 *   than is returned.
	 */
	function parse_launch(pipeline_description: string): Element;
	/**
	 * Create a new pipeline based on command line syntax.
	 * Please note that you might get a return value that is not %NULL even though
	 * the #error is set. In this case there was a recoverable parsing error and you
	 * can try to play the pipeline.
	 * 
	 * To create a sub-pipeline (bin) for embedding into an existing pipeline
	 * use {@link Gst.parse.bin_from_description_full}.
	 * @param pipeline_description the command line describing the pipeline
	 * @param context a parse context allocated with
	 *      {@link Gst.ParseContext.new}, or %NULL
	 * @param flags parsing options, or #GST_PARSE_FLAG_NONE
	 * @returns a new element on success, %NULL on
	 *    failure. If more than one toplevel element is specified by the
	 *    #pipeline_description, all elements are put into a {@link Pipeline}, which
	 *    then is returned (unless the GST_PARSE_FLAG_PLACE_IN_BIN flag is set, in
	 *    which case they are put in a #GstBin instead).
	 */
	function parse_launch_full(pipeline_description: string, context: ParseContext | null, flags: ParseFlags): Element;
	/**
	 * Create a new element based on command line syntax.
	 * #error will contain an error message if an erroneous pipeline is specified.
	 * An error does not mean that the pipeline could not be constructed.
	 * @param argv null-terminated array of arguments
	 * @returns a new element on success and %NULL
	 * on failure.
	 */
	function parse_launchv(argv: string[]): Element;
	/**
	 * Create a new element based on command line syntax.
	 * #error will contain an error message if an erroneous pipeline is specified.
	 * An error does not mean that the pipeline could not be constructed.
	 * @param argv null-terminated array of arguments
	 * @param context a parse context allocated with
	 *     {@link Gst.ParseContext.new}, or %NULL
	 * @param flags parsing options, or #GST_PARSE_FLAG_NONE
	 * @returns a new element on success; on
	 *   failure, either %NULL or a partially-constructed bin or element will be
	 *   returned and #error will be set (unless you passed
	 *   #GST_PARSE_FLAG_FATAL_ERRORS in #flags, then %NULL will always be returned
	 *   on failure)
	 */
	function parse_launchv_full(argv: string[], context: ParseContext | null, flags: ParseFlags): Element;
	/**
	 * Get the error quark.
	 * @returns The error quark used in GError messages
	 */
	function plugin_error_quark(): GLib.Quark;
	/**
	 * Create a new file descriptor set. If #controllable, it
	 * is possible to restart or flush a call to {@link Gst.Poll.wait} with
	 * gst_poll_restart() and gst_poll_set_flushing() respectively.
	 * 
	 * Free-function: gst_poll_free
	 * @param controllable whether it should be possible to control a wait.
	 * @returns a new {@link Poll}, or %NULL in
	 *     case of an error.  Free with {@link Gst.Poll.free}.
	 */
	function poll_new(controllable: boolean): Poll | null;
	/**
	 * Create a new poll object that can be used for scheduling cancellable
	 * timeouts.
	 * 
	 * A timeout is performed with {@link Gst.Poll.wait}. Multiple timeouts can be
	 * performed from different threads.
	 * 
	 * Free-function: gst_poll_free
	 * @returns a new {@link Poll}, or %NULL in
	 *     case of an error.  Free with {@link Gst.Poll.free}.
	 */
	function poll_new_timer(): Poll | null;
	/**
	 * Gets the directory for application specific presets if set by the
	 * application.
	 * @returns the directory or %NULL, don't free or modify
	 * the string
	 */
	function preset_get_app_dir(): string | null;
	/**
	 * Sets an extra directory as an absolute path that should be considered when
	 * looking for presets. Any presets in the application dir will shadow the
	 * system presets.
	 * @param app_dir the application specific preset dir
	 * @returns %TRUE for success, %FALSE if the dir already has been set
	 */
	function preset_set_app_dir(app_dir: string): boolean;
	/**
	 * Outputs a formatted message via the GLib print handler. The default print
	 * handler simply outputs the message to stdout.
	 * 
	 * This function will not append a new-line character at the end, unlike
	 * gst_println() which will.
	 * 
	 * All strings must be in ASCII or UTF-8 encoding.
	 * 
	 * This function differs from g_print() in that it supports all the additional
	 * printf specifiers that are supported by GStreamer's debug logging system,
	 * such as #GST_PTR_FORMAT and #GST_SEGMENT_FORMAT.
	 * 
	 * This function is primarily for printing debug output.
	 * @param format a printf style format string
	 */
	function print(format: string): void;
	/**
	 * Outputs a formatted message via the GLib error message handler. The default
	 * handler simply outputs the message to stderr.
	 * 
	 * This function will not append a new-line character at the end, unlike
	 * gst_printerrln() which will.
	 * 
	 * All strings must be in ASCII or UTF-8 encoding.
	 * 
	 * This function differs from g_printerr() in that it supports the additional
	 * printf specifiers that are supported by GStreamer's debug logging system,
	 * such as #GST_PTR_FORMAT and #GST_SEGMENT_FORMAT.
	 * 
	 * This function is primarily for printing debug output.
	 * @param format a printf style format string
	 */
	function printerr(format: string): void;
	/**
	 * Outputs a formatted message via the GLib error message handler. The default
	 * handler simply outputs the message to stderr.
	 * 
	 * This function will append a new-line character at the end, unlike
	 * gst_printerr() which will not.
	 * 
	 * All strings must be in ASCII or UTF-8 encoding.
	 * 
	 * This function differs from g_printerr() in that it supports the additional
	 * printf specifiers that are supported by GStreamer's debug logging system,
	 * such as #GST_PTR_FORMAT and #GST_SEGMENT_FORMAT.
	 * 
	 * This function is primarily for printing debug output.
	 * @param format a printf style format string
	 */
	function printerrln(format: string): void;
	/**
	 * Outputs a formatted message via the GLib print handler. The default print
	 * handler simply outputs the message to stdout.
	 * 
	 * This function will append a new-line character at the end, unlike
	 * gst_print() which will not.
	 * 
	 * All strings must be in ASCII or UTF-8 encoding.
	 * 
	 * This function differs from g_print() in that it supports all the additional
	 * printf specifiers that are supported by GStreamer's debug logging system,
	 * such as #GST_PTR_FORMAT and #GST_SEGMENT_FORMAT.
	 * 
	 * This function is primarily for printing debug output.
	 * @param format a printf style format string
	 */
	function println(format: string): void;
	/**
	 * Iterates the supplied list of UUIDs and checks the GstRegistry for
	 * all the decryptors supporting one of the supplied UUIDs.
	 * @param system_identifiers 
	 * A null terminated array of strings that contains the UUID values of each
	 * protection system that is to be checked.
	 * @returns 
	 * A null terminated array containing all
	 * the #system_identifiers supported by the set of available decryptors, or
	 * %NULL if no matches were found.
	 */
	function protection_filter_systems_by_available_decryptors(system_identifiers: string[]): string[] | null;
	function protection_meta_api_get_type(): GObject.Type;
	function protection_meta_get_info(): MetaInfo;
	/**
	 * Iterates the supplied list of UUIDs and checks the GstRegistry for
	 * an element that supports one of the supplied UUIDs. If more than one
	 * element matches, the system ID of the highest ranked element is selected.
	 * @param system_identifiers A null terminated array of strings
	 * that contains the UUID values of each protection system that is to be
	 * checked.
	 * @returns One of the strings from
	 * #system_identifiers that indicates the highest ranked element that
	 * implements the protection system indicated by that system ID, or %NULL if no
	 * element has been found.
	 */
	function protection_select_system(system_identifiers: string[]): string | null;
	/**
	 * Gets the {@link QueryTypeFlags} associated with #type.
	 * @param type a {@link QueryType}
	 * @returns a {@link QueryTypeFlags}.
	 */
	function query_type_get_flags(type: QueryType): QueryTypeFlags;
	/**
	 * Get a printable name for the given query type. Do not modify or free.
	 * @param type the query type
	 * @returns a reference to the static name of the query.
	 */
	function query_type_get_name(type: QueryType): string;
	/**
	 * Get the unique quark for the given query type.
	 * @param type the query type
	 * @returns the quark associated with the query type
	 */
	function query_type_to_quark(type: QueryType): GLib.Quark;
	function reference_timestamp_meta_api_get_type(): GObject.Type;
	/**
	 * Get the global {@link MetaInfo} describing  the #GstReferenceTimestampMeta meta.
	 * @returns The {@link MetaInfo}
	 */
	function reference_timestamp_meta_get_info(): MetaInfo;
	function resource_error_quark(): GLib.Quark;
	/**
	 * Some functions in the GStreamer core might install a custom SIGSEGV handler
	 * to better catch and report errors to the application. Currently this feature
	 * is enabled by default when loading plugins.
	 * 
	 * Applications might want to disable this behaviour with the
	 * {@link Gst.segtrap.set_enabled} function. This is typically done if the application
	 * wants to install its own handler without GStreamer interfering.
	 * @returns %TRUE if GStreamer is allowed to install a custom SIGSEGV handler.
	 */
	function segtrap_is_enabled(): boolean;
	/**
	 * Applications might want to disable/enable the SIGSEGV handling of
	 * the GStreamer core. See {@link Gst.segtrap.is_enabled} for more information.
	 * @param enabled whether a custom SIGSEGV handler should be installed.
	 */
	function segtrap_set_enabled(enabled: boolean): void;
	/**
	 * Gets a string representing the given state transition.
	 * @param transition a {@link StateChange} to get the name of.
	 * @returns a string with the name of the state
	 *    result.
	 */
	function state_change_get_name(transition: StateChange): string;
	function static_caps_get_type(): GObject.Type;
	function static_pad_template_get_type(): GObject.Type;
	function stream_error_quark(): GLib.Quark;
	/**
	 * Get a descriptive string for a given {@link StreamType}
	 * @param stype a {@link StreamType}
	 * @returns A string describing the stream type
	 */
	function stream_type_get_name(stype: StreamType): string;
	/**
	 * Atomically modifies a pointer to point to a new structure.
	 * The {@link Structure} #oldstr_ptr is pointing to is freed and
	 * #newstr is taken ownership over.
	 * 
	 * Either #newstr and the value pointed to by #oldstr_ptr may be %NULL.
	 * 
	 * It is a programming error if both #newstr and the value pointed to by
	 * #oldstr_ptr refer to the same, non-%NULL structure.
	 * @param newstr a new {@link Structure}
	 * @returns %TRUE if #newstr was different from #oldstr_ptr
	 */
	function structure_take(newstr: Structure | null): boolean;
	/**
	 * Checks if the given type is already registered.
	 * @param tag name of the tag
	 * @returns %TRUE if the type is already registered
	 */
	function tag_exists(tag: string): boolean;
	/**
	 * Returns the human-readable description of this tag, You must not change or
	 * free this string.
	 * @param tag the tag
	 * @returns the human-readable description of this tag
	 */
	function tag_get_description(tag: string): string | null;
	/**
	 * Gets the flag of #tag.
	 * @param tag the tag
	 * @returns the flag of this tag.
	 */
	function tag_get_flag(tag: string): TagFlag;
	/**
	 * Returns the human-readable name of this tag, You must not change or free
	 * this string.
	 * @param tag the tag
	 * @returns the human-readable name of this tag
	 */
	function tag_get_nick(tag: string): string | null;
	/**
	 * Gets the #GType used for this tag.
	 * @param tag the tag
	 * @returns the #GType of this tag
	 */
	function tag_get_type(tag: string): GObject.Type;
	/**
	 * Checks if the given tag is fixed. A fixed tag can only contain one value.
	 * Unfixed tags can contain lists of values.
	 * @param tag tag to check
	 * @returns %TRUE, if the given tag is fixed.
	 */
	function tag_is_fixed(tag: string): boolean;
	/**
	 * Copies the contents for the given tag into the value,
	 * merging multiple values into one if multiple values are associated
	 * with the tag.
	 * You must {@link G.value_unset} the value after use.
	 * @param list list to get the tag from
	 * @param tag tag to read out
	 * @returns %TRUE, if a value was copied, %FALSE if the tag didn't exist in the
	 *          given list.
	 * 
	 * uninitialized #GValue to copy into
	 */
	function tag_list_copy_value(list: TagList, tag: string): [ boolean, GObject.Value ];
	/**
	 * This is a convenience function for the func argument of {@link Gst.tag.register}.
	 * It concatenates all given strings using a comma. The tag must be registered
	 * as a G_TYPE_STRING or this function will fail.
	 * @param src GValue to copy from
	 * @returns uninitialized GValue to store result in
	 */
	function tag_merge_strings_with_comma(src: GObject.Value): GObject.Value;
	/**
	 * This is a convenience function for the func argument of {@link Gst.tag.register}.
	 * It creates a copy of the first value from the list.
	 * @param src GValue to copy from
	 * @returns uninitialized GValue to store result in
	 */
	function tag_merge_use_first(src: GObject.Value): GObject.Value;
	/**
	 * Registers a new tag type for the use with GStreamer's type system. If a type
	 * with that name is already registered, that one is used.
	 * The old registration may have used a different type however. So don't rely
	 * on your supplied values.
	 * 
	 * Important: if you do not supply a merge function the implication will be
	 * that there can only be one single value for this tag in a tag list and
	 * any additional values will silently be discarded when being added (unless
	 * #GST_TAG_MERGE_REPLACE, #GST_TAG_MERGE_REPLACE_ALL, or
	 * #GST_TAG_MERGE_PREPEND is used as merge mode, in which case the new
	 * value will replace the old one in the list).
	 * 
	 * The merge function will be called from {@link Gst.tag.list_copy_value} when
	 * it is required that one or more values for a tag be condensed into
	 * one single value. This may happen from gst_tag_list_get_string(),
	 * gst_tag_list_get_int(), gst_tag_list_get_double() etc. What will happen
	 * exactly in that case depends on how the tag was registered and if a
	 * merge function was supplied and if so which one.
	 * 
	 * Two default merge functions are provided: gst_tag_merge_use_first() and
	 * gst_tag_merge_strings_with_comma().
	 * @param name the name or identifier string
	 * @param flag a flag describing the type of tag info
	 * @param type the type this data is in
	 * @param nick human-readable name
	 * @param blurb a human-readable description about this tag
	 * @param func function for merging multiple values of this tag, or %NULL
	 */
	function tag_register(name: string, flag: TagFlag, type: GObject.Type, nick: string, blurb: string, func: TagMergeFunc | null): void;
	/**
	 * Registers a new tag type for the use with GStreamer's type system.
	 * 
	 * Same as {@link Gst.tag.register}, but #name, #nick, and #blurb must be
	 * static strings or inlined strings, as they will not be copied. (GStreamer
	 * plugins will be made resident once loaded, so this function can be used
	 * even from dynamically loaded plugins.)
	 * @param name the name or identifier string (string constant)
	 * @param flag a flag describing the type of tag info
	 * @param type the type this data is in
	 * @param nick human-readable name or short description (string constant)
	 * @param blurb a human-readable description for this tag (string constant)
	 * @param func function for merging multiple values of this tag, or %NULL
	 */
	function tag_register_static(name: string, flag: TagFlag, type: GObject.Type, nick: string, blurb: string, func: TagMergeFunc | null): void;
	/**
	 * Converts #type to a string representation.
	 * @param type a {@link TocEntryType}.
	 * @returns Returns a human-readable string for #type. This string is
	 *    only for debugging purpose and should not be displayed in a user
	 *    interface.
	 */
	function toc_entry_type_get_nick(type: TocEntryType): string;
	/**
	 * Get a list of all active tracer objects owned by the tracing framework for
	 * the entirety of the run-time of the process or till gst_deinit() is called.
	 * @returns A #GList of
	 * {@link Tracer} objects
	 */
	function tracing_get_active_tracers(): Tracer[];
	/**
	 * Register #func to be called when the trace hook #detail is getting invoked.
	 * Use %NULL for #detail to register to all hooks.
	 * @param tracer the tracer
	 * @param detail the detailed hook
	 * @param func the callback
	 */
	function tracing_register_hook(tracer: Tracer, detail: string, func: GObject.Callback): void;
	function type_find_get_type(): GObject.Type;
	/**
	 * Registers a new typefind function to be used for typefinding. After
	 * registering this function will be available for typefinding.
	 * This function is typically called during an element's plugin initialization.
	 * @param plugin A {@link Plugin}, or %NULL for a static typefind function
	 * @param name The name for registering
	 * @param rank The rank (or importance) of this typefind function
	 * @param func The {@link TypeFindFunction} to use
	 * @param extensions Optional comma-separated list of extensions
	 *     that could belong to this type
	 * @param possible_caps Optionally the caps that could be returned when typefinding
	 *                 succeeds
	 * @returns %TRUE on success, %FALSE otherwise
	 */
	function type_find_register(plugin: Plugin | null, name: string, rank: number, func: TypeFindFunction, extensions: string | null, possible_caps: Caps | null): boolean;
	/**
	 * Checks if #type is plugin API. See {@link Gst.type.mark_as_plugin_api} for
	 * details.
	 * @param type a GType
	 * @returns %TRUE if #type is plugin API or %FALSE otherwise.
	 * 
	 * What {@link PluginAPIFlags} the plugin was marked with
	 */
	function type_is_plugin_api(type: GObject.Type): [ boolean, PluginAPIFlags | null ];
	/**
	 * Marks #type as plugin API. This should be called in `class_init` of
	 * elements that expose new types (i.e. enums, flags or internal GObjects) via
	 * properties, signals or pad templates.
	 * 
	 * Types exposed by plugins are not automatically added to the documentation
	 * as they might originate from another library and should in that case be
	 * documented via that library instead.
	 * 
	 * By marking a type as plugin API it will be included in the documentation of
	 * the plugin that defines it.
	 * @param type a GType
	 * @param flags a set of {@link PluginAPIFlags} to further inform cache generation.
	 */
	function type_mark_as_plugin_api(type: GObject.Type, flags: PluginAPIFlags): void;
	/**
	 * Forces GStreamer to re-scan its plugin paths and update the default
	 * plugin registry.
	 * 
	 * Applications will almost never need to call this function, it is only
	 * useful if the application knows new plugins have been installed (or old
	 * ones removed) since the start of the application (or, to be precise, the
	 * first call to gst_init()) and the application wants to make use of any
	 * newly-installed plugins without restarting the application.
	 * 
	 * Applications should assume that the registry update is neither atomic nor
	 * thread-safe and should therefore not have any dynamic pipelines running
	 * (including the playbin and decodebin elements) and should also not create
	 * any elements or access the GStreamer registry while the update is in
	 * progress.
	 * 
	 * Note that this function may block for a significant amount of time.
	 * @returns %TRUE if the registry has been updated successfully (does not
	 *          imply that there were changes), otherwise %FALSE.
	 */
	function update_registry(): boolean;
	/**
	 * Constructs a URI for a given valid protocol and location.
	 * 
	 * Free-function: g_free
	 * @param protocol Protocol for URI
	 * @param location Location for URI
	 * @returns a new string for this URI. Returns %NULL if the
	 *     given URI protocol is not valid, or the given location is %NULL.
	 */
	function uri_construct(protocol: string, location: string): string;
	function uri_error_quark(): GLib.Quark;
	/**
	 * Parses a URI string into a new {@link Uri} object. Will return NULL if the URI
	 * cannot be parsed.
	 * @param uri The URI string to parse.
	 * @returns A new {@link Uri} object, or NULL.
	 */
	function uri_from_string(uri: string): Uri | null;
	/**
	 * Parses a URI string into a new {@link Uri} object. Will return NULL if the URI
	 * cannot be parsed. This is identical to {@link Gst.uri.from_string} except that
	 * the userinfo and fragment components of the URI will not be unescaped while
	 * parsing.
	 * 
	 * Use this when you need to extract a username and password from the userinfo
	 * such as https://user:password#example.com since either may contain
	 * a URI-escaped ':' character. gst_uri_from_string() will unescape the entire
	 * userinfo component, which will make it impossible to know which ':'
	 * delineates the username and password.
	 * 
	 * The same applies to the fragment component of the URI, such as
	 * https://example.com/path#fragment which may contain a URI-escaped '#'.
	 * @param uri The URI string to parse.
	 * @returns A new {@link Uri} object, or NULL.
	 */
	function uri_from_string_escaped(uri: string): Uri | null;
	/**
	 * Extracts the location out of a given valid URI, ie. the protocol and "://"
	 * are stripped from the URI, which means that the location returned includes
	 * the hostname if one is specified. The returned string must be freed using
	 * {@link G.free}.
	 * 
	 * Free-function: g_free
	 * @param uri A URI string
	 * @returns the location for this URI. Returns
	 *     %NULL if the URI isn't valid. If the URI does not contain a location, an
	 *     empty string is returned.
	 */
	function uri_get_location(uri: string): string | null;
	/**
	 * Extracts the protocol out of a given valid URI. The returned string must be
	 * freed using {@link G.free}.
	 * @param uri A URI string
	 * @returns The protocol for this URI.
	 */
	function uri_get_protocol(uri: string): string | null;
	/**
	 * Checks if the protocol of a given valid URI matches #protocol.
	 * @param uri a URI string
	 * @param protocol a protocol string (e.g. "http")
	 * @returns %TRUE if the protocol matches.
	 */
	function uri_has_protocol(uri: string, protocol: string): boolean;
	/**
	 * Tests if the given string is a valid URI identifier. URIs start with a valid
	 * scheme followed by ":" and maybe a string identifying the location.
	 * @param uri A URI string
	 * @returns %TRUE if the string is a valid URI
	 */
	function uri_is_valid(uri: string): boolean;
	/**
	 * This is a convenience function to join two URI strings and return the result.
	 * The returned string should be {@link G.free}'d after use.
	 * @param base_uri The percent-encoded base URI.
	 * @param ref_uri The percent-encoded reference URI to join to the #base_uri.
	 * @returns A string representing the percent-encoded join of
	 *          the two URIs.
	 */
	function uri_join_strings(base_uri: string, ref_uri: string): string;
	/**
	 * Checks if an element exists that supports the given URI protocol. Note
	 * that a positive return value does not imply that a subsequent call to
	 * {@link Gst.Element.make_from_uri} is guaranteed to work.
	 * @param type Whether to check for a source or a sink
	 * @param protocol Protocol that should be checked for (e.g. "http" or "smb")
	 * @returns %TRUE
	 */
	function uri_protocol_is_supported(type: URIType, protocol: string): boolean;
	/**
	 * Tests if the given string is a valid protocol identifier. Protocols
	 * must consist of alphanumeric characters, '+', '-' and '.' and must
	 * start with a alphabetic character. See RFC 3986 Section 3.1.
	 * @param protocol A string
	 * @returns %TRUE if the string is a valid protocol identifier, %FALSE otherwise.
	 */
	function uri_protocol_is_valid(protocol: string): boolean;
	/**
	 * Searches inside #array for #search_data by using the comparison function
	 * #search_func. #array must be sorted ascending.
	 * 
	 * As #search_data is always passed as second argument to #search_func it's
	 * not required that #search_data has the same type as the array elements.
	 * 
	 * The complexity of this search function is O(log (num_elements)).
	 * @param array the sorted input array
	 * @param num_elements number of elements in the array
	 * @param element_size size of every element in bytes
	 * @param search_func function to compare two elements, #search_data will always be passed as second argument
	 * @param mode search mode that should be used
	 * @param search_data element that should be found
	 * @returns The address of the found
	 * element or %NULL if nothing was found
	 */
	function util_array_binary_search(array: any | null, num_elements: number, element_size: number, search_func: GLib.CompareDataFunc, mode: SearchMode, search_data: any | null): any | null;
	/**
	 * Transforms a #gdouble to a fraction and simplifies
	 * the result.
	 * @param src #gdouble to transform
	 * @returns pointer to a #gint to hold the result numerator
	 * 
	 * pointer to a #gint to hold the result denominator
	 */
	function util_double_to_fraction(src: number): [ dest_n: number, dest_d: number ];
	/**
	 * Dumps the buffer memory into a hex representation. Useful for debugging.
	 * @param buf a {@link Buffer} whose memory to dump
	 */
	function util_dump_buffer(buf: Buffer): void;
	/**
	 * Dumps the memory block into a hex representation. Useful for debugging.
	 * @param mem a pointer to the memory to dump
	 */
	function util_dump_mem(mem: number[]): void;
	/**
	 * Adds the fractions #a_n/#a_d and #b_n/#b_d and stores
	 * the result in #res_n and #res_d.
	 * @param a_n Numerator of first value
	 * @param a_d Denominator of first value
	 * @param b_n Numerator of second value
	 * @param b_d Denominator of second value
	 * @returns %FALSE on overflow, %TRUE otherwise.
	 * 
	 * Pointer to #gint to hold the result numerator
	 * 
	 * Pointer to #gint to hold the result denominator
	 */
	function util_fraction_add(a_n: number, a_d: number, b_n: number, b_d: number): [ boolean, number, number ];
	/**
	 * Compares the fractions #a_n/#a_d and #b_n/#b_d and returns
	 * -1 if a < b, 0 if a = b and 1 if a > b.
	 * @param a_n Numerator of first value
	 * @param a_d Denominator of first value
	 * @param b_n Numerator of second value
	 * @param b_d Denominator of second value
	 * @returns -1 if a < b; 0 if a = b; 1 if a > b.
	 */
	function util_fraction_compare(a_n: number, a_d: number, b_n: number, b_d: number): number;
	/**
	 * Multiplies the fractions #a_n/#a_d and #b_n/#b_d and stores
	 * the result in #res_n and #res_d.
	 * @param a_n Numerator of first value
	 * @param a_d Denominator of first value
	 * @param b_n Numerator of second value
	 * @param b_d Denominator of second value
	 * @returns %FALSE on overflow, %TRUE otherwise.
	 * 
	 * Pointer to #gint to hold the result numerator
	 * 
	 * Pointer to #gint to hold the result denominator
	 */
	function util_fraction_multiply(a_n: number, a_d: number, b_n: number, b_d: number): [ boolean, number, number ];
	/**
	 * Transforms a fraction to a #gdouble.
	 * @param src_n Fraction numerator as #gint
	 * @param src_d Fraction denominator #gint
	 * @returns pointer to a #gdouble for the result
	 */
	function util_fraction_to_double(src_n: number, src_d: number): number;
	function util_gdouble_to_guint64(value: number): number;
	/**
	 * Get a property of type %GST_TYPE_ARRAY and transform it into a
	 * #GValueArray. This allow language bindings to get GST_TYPE_ARRAY
	 * properties which are otherwise not an accessible type.
	 * @param object the object to set the array to
	 * @param name the name of the property to set
	 * @returns 
	 * 
	 * a return #GValueArray
	 */
	function util_get_object_array(object: GObject.Object, name: string): [ boolean, GObject.ValueArray ];
	/**
	 * Get a timestamp as GstClockTime to be used for interval measurements.
	 * The timestamp should not be interpreted in any other way.
	 * @returns the timestamp
	 */
	function util_get_timestamp(): ClockTime;
	/**
	 * Calculates the greatest common divisor of #a
	 * and #b.
	 * @param a First value as #gint
	 * @param b Second value as #gint
	 * @returns Greatest common divisor of #a and #b
	 */
	function util_greatest_common_divisor(a: number, b: number): number;
	/**
	 * Calculates the greatest common divisor of #a
	 * and #b.
	 * @param a First value as #gint64
	 * @param b Second value as #gint64
	 * @returns Greatest common divisor of #a and #b
	 */
	function util_greatest_common_divisor_int64(a: number, b: number): number;
	/**
	 * Return a constantly incrementing group id.
	 * 
	 * This function is used to generate a new group-id for the
	 * stream-start event.
	 * 
	 * This function never returns %GST_GROUP_ID_INVALID (which is 0)
	 * @returns A constantly incrementing unsigned integer, which might
	 * overflow back to 0 at some point.
	 */
	function util_group_id_next(): number;
	function util_guint64_to_gdouble(value: number): number;
	/**
	 * Compare two sequence numbers, handling wraparound.
	 * 
	 * The current implementation just returns (gint32)(#s1 - #s2).
	 * @param s1 A sequence number.
	 * @param s2 Another sequence number.
	 * @returns A negative number if #s1 is before #s2, 0 if they are equal, or a
	 * positive number if #s1 is after #s2.
	 */
	function util_seqnum_compare(s1: number, s2: number): number;
	/**
	 * Return a constantly incrementing sequence number.
	 * 
	 * This function is used internally to GStreamer to be able to determine which
	 * events and messages are "the same". For example, elements may set the seqnum
	 * on a segment-done message to be the same as that of the last seek event, to
	 * indicate that event and the message correspond to the same segment.
	 * 
	 * This function never returns %GST_SEQNUM_INVALID (which is 0).
	 * @returns A constantly incrementing 32-bit unsigned integer, which might
	 * overflow at some point. Use {@link Gst.util.seqnum_compare} to make sure
	 * you handle wraparound correctly.
	 */
	function util_seqnum_next(): number;
	/**
	 * Converts the string value to the type of the objects argument and
	 * sets the argument with it.
	 * 
	 * Note that this function silently returns if #object has no property named
	 * #name or when #value cannot be converted to the type of the property.
	 * @param object the object to set the argument of
	 * @param name the name of the argument to set
	 * @param value the string value to set
	 */
	function util_set_object_arg(object: GObject.Object, name: string, value: string): void;
	/**
	 * Transfer a #GValueArray to %GST_TYPE_ARRAY and set this value on the
	 * specified property name. This allow language bindings to set GST_TYPE_ARRAY
	 * properties which are otherwise not an accessible type.
	 * @param object the object to set the array to
	 * @param name the name of the property to set
	 * @param array a #GValueArray containing the values
	 * @returns 
	 */
	function util_set_object_array(object: GObject.Object, name: string, array: GObject.ValueArray): boolean;
	/**
	 * Converts the string to the type of the value and
	 * sets the value with it.
	 * 
	 * Note that this function is dangerous as it does not return any indication
	 * if the conversion worked or not.
	 * @param value_str the string to get the value from
	 * @returns the value to set
	 */
	function util_set_value_from_string(value_str: string): GObject.Value;
	/**
	 * Scale #val by the rational number #num / #denom, avoiding overflows and
	 * underflows and without loss of precision.
	 * 
	 * This function can potentially be very slow if val and num are both
	 * greater than G_MAXUINT32.
	 * @param val the number to scale
	 * @param num the numerator of the scale ratio
	 * @param denom the denominator of the scale ratio
	 * @returns #val * #num / #denom.  In the case of an overflow, this
	 * function returns G_MAXUINT64.  If the result is not exactly
	 * representable as an integer it is truncated.  See also
	 * {@link Gst.util.uint64_scale_round}, gst_util_uint64_scale_ceil(),
	 * gst_util_uint64_scale_int(), gst_util_uint64_scale_int_round(),
	 * gst_util_uint64_scale_int_ceil().
	 */
	function util_uint64_scale(val: number, num: number, denom: number): number;
	/**
	 * Scale #val by the rational number #num / #denom, avoiding overflows and
	 * underflows and without loss of precision.
	 * 
	 * This function can potentially be very slow if val and num are both
	 * greater than G_MAXUINT32.
	 * @param val the number to scale
	 * @param num the numerator of the scale ratio
	 * @param denom the denominator of the scale ratio
	 * @returns #val * #num / #denom.  In the case of an overflow, this
	 * function returns G_MAXUINT64.  If the result is not exactly
	 * representable as an integer, it is rounded up.  See also
	 * {@link Gst.util.uint64_scale}, gst_util_uint64_scale_round(),
	 * gst_util_uint64_scale_int(), gst_util_uint64_scale_int_round(),
	 * gst_util_uint64_scale_int_ceil().
	 */
	function util_uint64_scale_ceil(val: number, num: number, denom: number): number;
	/**
	 * Scale #val by the rational number #num / #denom, avoiding overflows and
	 * underflows and without loss of precision.  #num must be non-negative and
	 * #denom must be positive.
	 * @param val guint64 (such as a {@link ClockTime}) to scale.
	 * @param num numerator of the scale factor.
	 * @param denom denominator of the scale factor.
	 * @returns #val * #num / #denom.  In the case of an overflow, this
	 * function returns G_MAXUINT64.  If the result is not exactly
	 * representable as an integer, it is truncated.  See also
	 * {@link Gst.util.uint64_scale_int_round}, gst_util_uint64_scale_int_ceil(),
	 * gst_util_uint64_scale(), gst_util_uint64_scale_round(),
	 * gst_util_uint64_scale_ceil().
	 */
	function util_uint64_scale_int(val: number, num: number, denom: number): number;
	/**
	 * Scale #val by the rational number #num / #denom, avoiding overflows and
	 * underflows and without loss of precision.  #num must be non-negative and
	 * #denom must be positive.
	 * @param val guint64 (such as a {@link ClockTime}) to scale.
	 * @param num numerator of the scale factor.
	 * @param denom denominator of the scale factor.
	 * @returns #val * #num / #denom.  In the case of an overflow, this
	 * function returns G_MAXUINT64.  If the result is not exactly
	 * representable as an integer, it is rounded up.  See also
	 * {@link Gst.util.uint64_scale_int}, gst_util_uint64_scale_int_round(),
	 * gst_util_uint64_scale(), gst_util_uint64_scale_round(),
	 * gst_util_uint64_scale_ceil().
	 */
	function util_uint64_scale_int_ceil(val: number, num: number, denom: number): number;
	/**
	 * Scale #val by the rational number #num / #denom, avoiding overflows and
	 * underflows and without loss of precision.  #num must be non-negative and
	 * #denom must be positive.
	 * @param val guint64 (such as a {@link ClockTime}) to scale.
	 * @param num numerator of the scale factor.
	 * @param denom denominator of the scale factor.
	 * @returns #val * #num / #denom.  In the case of an overflow, this
	 * function returns G_MAXUINT64.  If the result is not exactly
	 * representable as an integer, it is rounded to the nearest integer
	 * (half-way cases are rounded up).  See also {@link Gst.util.uint64_scale_int},
	 * gst_util_uint64_scale_int_ceil(), gst_util_uint64_scale(),
	 * gst_util_uint64_scale_round(), gst_util_uint64_scale_ceil().
	 */
	function util_uint64_scale_int_round(val: number, num: number, denom: number): number;
	/**
	 * Scale #val by the rational number #num / #denom, avoiding overflows and
	 * underflows and without loss of precision.
	 * 
	 * This function can potentially be very slow if val and num are both
	 * greater than G_MAXUINT32.
	 * @param val the number to scale
	 * @param num the numerator of the scale ratio
	 * @param denom the denominator of the scale ratio
	 * @returns #val * #num / #denom.  In the case of an overflow, this
	 * function returns G_MAXUINT64.  If the result is not exactly
	 * representable as an integer, it is rounded to the nearest integer
	 * (half-way cases are rounded up).  See also {@link Gst.util.uint64_scale},
	 * gst_util_uint64_scale_ceil(), gst_util_uint64_scale_int(),
	 * gst_util_uint64_scale_int_round(), gst_util_uint64_scale_int_ceil().
	 */
	function util_uint64_scale_round(val: number, num: number, denom: number): number;
	/**
	 * Determines if #value1 and #value2 can be compared.
	 * @param value1 a value to compare
	 * @param value2 another value to compare
	 * @returns %TRUE if the values can be compared
	 */
	function value_can_compare(value1: GObject.Value, value2: GObject.Value): boolean;
	/**
	 * Determines if intersecting two values will produce a valid result.
	 * Two values will produce a valid intersection if they have the same
	 * type.
	 * @param value1 a value to intersect
	 * @param value2 another value to intersect
	 * @returns %TRUE if the values can intersect
	 */
	function value_can_intersect(value1: GObject.Value, value2: GObject.Value): boolean;
	/**
	 * Checks if it's possible to subtract #subtrahend from #minuend.
	 * @param minuend the value to subtract from
	 * @param subtrahend the value to subtract
	 * @returns %TRUE if a subtraction is possible
	 */
	function value_can_subtract(minuend: GObject.Value, subtrahend: GObject.Value): boolean;
	/**
	 * Determines if #value1 and #value2 can be non-trivially unioned.
	 * Any two values can be trivially unioned by adding both of them
	 * to a GstValueList.  However, certain types have the possibility
	 * to be unioned in a simpler way.  For example, an integer range
	 * and an integer can be unioned if the integer is a subset of the
	 * integer range.  If there is the possibility that two values can
	 * be unioned, this function returns %TRUE.
	 * @param value1 a value to union
	 * @param value2 another value to union
	 * @returns %TRUE if there is a function allowing the two values to
	 * be unioned.
	 */
	function value_can_union(value1: GObject.Value, value2: GObject.Value): boolean;
	/**
	 * Compares #value1 and #value2.  If #value1 and #value2 cannot be
	 * compared, the function returns GST_VALUE_UNORDERED.  Otherwise,
	 * if #value1 is greater than #value2, GST_VALUE_GREATER_THAN is returned.
	 * If #value1 is less than #value2, GST_VALUE_LESS_THAN is returned.
	 * If the values are equal, GST_VALUE_EQUAL is returned.
	 * @param value1 a value to compare
	 * @param value2 another value to compare
	 * @returns comparison result
	 */
	function value_compare(value1: GObject.Value, value2: GObject.Value): number;
	/**
	 * Tries to deserialize a string into the type specified by the given GValue.
	 * If the operation succeeds, %TRUE is returned, %FALSE otherwise.
	 * @param src string to deserialize
	 * @returns %TRUE on success
	 * 
	 * #GValue to fill with contents of
	 *     deserialization
	 */
	function value_deserialize(src: string): [ boolean, GObject.Value ];
	/**
	 * Fixate #src into a new value #dest.
	 * For ranges, the first element is taken. For lists and arrays, the
	 * first item is fixated and returned.
	 * If #src is already fixed, this function returns %FALSE.
	 * @param dest the #GValue destination
	 * @param src the #GValue to fixate
	 * @returns %TRUE if #dest contains a fixated version of #src.
	 */
	function value_fixate(dest: GObject.Value, src: GObject.Value): boolean;
	/**
	 * Multiplies the two #GValue items containing a #GST_TYPE_FRACTION and sets
	 * #product to the product of the two fractions.
	 * @param product a GValue initialized to #GST_TYPE_FRACTION
	 * @param factor1 a GValue initialized to #GST_TYPE_FRACTION
	 * @param factor2 a GValue initialized to #GST_TYPE_FRACTION
	 * @returns %FALSE in case of an error (like integer overflow), %TRUE otherwise.
	 */
	function value_fraction_multiply(product: GObject.Value, factor1: GObject.Value, factor2: GObject.Value): boolean;
	/**
	 * Subtracts the #subtrahend from the #minuend and sets #dest to the result.
	 * @param dest a GValue initialized to #GST_TYPE_FRACTION
	 * @param minuend a GValue initialized to #GST_TYPE_FRACTION
	 * @param subtrahend a GValue initialized to #GST_TYPE_FRACTION
	 * @returns %FALSE in case of an error (like integer overflow), %TRUE otherwise.
	 */
	function value_fraction_subtract(dest: GObject.Value, minuend: GObject.Value, subtrahend: GObject.Value): boolean;
	/**
	 * Gets the bitmask specified by #value.
	 * @param value a GValue initialized to #GST_TYPE_BITMASK
	 * @returns the bitmask.
	 */
	function value_get_bitmask(value: GObject.Value): number;
	/**
	 * Gets the contents of #value. The reference count of the returned
	 * {@link Caps} will not be modified, therefore the caller must take one
	 * before getting rid of the #value.
	 * @param value a GValue initialized to GST_TYPE_CAPS
	 * @returns the contents of #value
	 */
	function value_get_caps(value: GObject.Value): Caps;
	/**
	 * Gets the contents of #value.
	 * @param value a GValue initialized to GST_TYPE_CAPS_FEATURES
	 * @returns the contents of #value
	 */
	function value_get_caps_features(value: GObject.Value): CapsFeatures;
	/**
	 * Gets the maximum of the range specified by #value.
	 * @param value a GValue initialized to GST_TYPE_DOUBLE_RANGE
	 * @returns the maximum of the range
	 */
	function value_get_double_range_max(value: GObject.Value): number;
	/**
	 * Gets the minimum of the range specified by #value.
	 * @param value a GValue initialized to GST_TYPE_DOUBLE_RANGE
	 * @returns the minimum of the range
	 */
	function value_get_double_range_min(value: GObject.Value): number;
	/**
	 * Retrieve the flags field of a GstFlagSet #value.
	 * @param value a GValue initialized to #GST_TYPE_FLAG_SET
	 * @returns the flags field of the flagset instance.
	 */
	function value_get_flagset_flags(value: GObject.Value): number;
	/**
	 * Retrieve the mask field of a GstFlagSet #value.
	 * @param value a GValue initialized to #GST_TYPE_FLAG_SET
	 * @returns the mask field of the flagset instance.
	 */
	function value_get_flagset_mask(value: GObject.Value): number;
	/**
	 * Gets the denominator of the fraction specified by #value.
	 * @param value a GValue initialized to #GST_TYPE_FRACTION
	 * @returns the denominator of the fraction.
	 */
	function value_get_fraction_denominator(value: GObject.Value): number;
	/**
	 * Gets the numerator of the fraction specified by #value.
	 * @param value a GValue initialized to #GST_TYPE_FRACTION
	 * @returns the numerator of the fraction.
	 */
	function value_get_fraction_numerator(value: GObject.Value): number;
	/**
	 * Gets the maximum of the range specified by #value.
	 * @param value a GValue initialized to GST_TYPE_FRACTION_RANGE
	 * @returns the maximum of the range
	 */
	function value_get_fraction_range_max(value: GObject.Value): GObject.Value | null;
	/**
	 * Gets the minimum of the range specified by #value.
	 * @param value a GValue initialized to GST_TYPE_FRACTION_RANGE
	 * @returns the minimum of the range
	 */
	function value_get_fraction_range_min(value: GObject.Value): GObject.Value | null;
	/**
	 * Gets the maximum of the range specified by #value.
	 * @param value a GValue initialized to GST_TYPE_INT64_RANGE
	 * @returns the maximum of the range
	 */
	function value_get_int64_range_max(value: GObject.Value): number;
	/**
	 * Gets the minimum of the range specified by #value.
	 * @param value a GValue initialized to GST_TYPE_INT64_RANGE
	 * @returns the minimum of the range
	 */
	function value_get_int64_range_min(value: GObject.Value): number;
	/**
	 * Gets the step of the range specified by #value.
	 * @param value a GValue initialized to GST_TYPE_INT64_RANGE
	 * @returns the step of the range
	 */
	function value_get_int64_range_step(value: GObject.Value): number;
	/**
	 * Gets the maximum of the range specified by #value.
	 * @param value a GValue initialized to GST_TYPE_INT_RANGE
	 * @returns the maximum of the range
	 */
	function value_get_int_range_max(value: GObject.Value): number;
	/**
	 * Gets the minimum of the range specified by #value.
	 * @param value a GValue initialized to GST_TYPE_INT_RANGE
	 * @returns the minimum of the range
	 */
	function value_get_int_range_min(value: GObject.Value): number;
	/**
	 * Gets the step of the range specified by #value.
	 * @param value a GValue initialized to GST_TYPE_INT_RANGE
	 * @returns the step of the range
	 */
	function value_get_int_range_step(value: GObject.Value): number;
	/**
	 * Gets the contents of #value.
	 * @param value a GValue initialized to GST_TYPE_STRUCTURE
	 * @returns the contents of #value
	 */
	function value_get_structure(value: GObject.Value): Structure;
	/**
	 * Initialises the target value to be of the same type as source and then copies
	 * the contents from source to target.
	 * @param src the source value
	 * @returns the target value
	 */
	function value_init_and_copy(src: GObject.Value): GObject.Value;
	/**
	 * Calculates the intersection of two values.  If the values have
	 * a non-empty intersection, the value representing the intersection
	 * is placed in #dest, unless %NULL.  If the intersection is non-empty,
	 * #dest is not modified.
	 * @param value1 a value to intersect
	 * @param value2 another value to intersect
	 * @returns %TRUE if the intersection is non-empty
	 * 
	 * 
	 *   a uninitialized #GValue that will hold the calculated
	 *   intersection value. May be %NULL if the resulting set if not
	 *   needed.
	 */
	function value_intersect(value1: GObject.Value, value2: GObject.Value): [ boolean, GObject.Value | null ];
	/**
	 * Tests if the given GValue, if available in a GstStructure (or any other
	 * container) contains a "fixed" (which means: one value) or an "unfixed"
	 * (which means: multiple possible values, such as data lists or data
	 * ranges) value.
	 * @param value the #GValue to check
	 * @returns true if the value is "fixed".
	 */
	function value_is_fixed(value: GObject.Value): boolean;
	/**
	 * Check that #value1 is a subset of #value2.
	 * @param value1 a #GValue
	 * @param value2 a #GValue
	 * @returns %TRUE is #value1 is a subset of #value2
	 */
	function value_is_subset(value1: GObject.Value, value2: GObject.Value): boolean;
	/**
	 * Registers functions to perform calculations on #GValue items of a given
	 * type. Each type can only be added once.
	 * @param table structure containing functions to register
	 */
	function value_register(table: ValueTable): void;
	/**
	 * tries to transform the given #value into a string representation that allows
	 * getting back this string later on using {@link Gst.value.deserialize}.
	 * 
	 * Free-function: g_free
	 * @param value a #GValue to serialize
	 * @returns the serialization for #value
	 * or %NULL if none exists
	 */
	function value_serialize(value: GObject.Value): string | null;
	/**
	 * Sets #value to the bitmask specified by #bitmask.
	 * @param value a GValue initialized to #GST_TYPE_BITMASK
	 * @param bitmask the bitmask
	 */
	function value_set_bitmask(value: GObject.Value, bitmask: number): void;
	/**
	 * Sets the contents of #value to #caps. A reference to the
	 * provided #caps will be taken by the #value.
	 * @param value a GValue initialized to GST_TYPE_CAPS
	 * @param caps the caps to set the value to
	 */
	function value_set_caps(value: GObject.Value, caps: Caps): void;
	/**
	 * Sets the contents of #value to #features.
	 * @param value a GValue initialized to GST_TYPE_CAPS_FEATURES
	 * @param features the features to set the value to
	 */
	function value_set_caps_features(value: GObject.Value, features: CapsFeatures): void;
	/**
	 * Sets #value to the range specified by #start and #end.
	 * @param value a GValue initialized to GST_TYPE_DOUBLE_RANGE
	 * @param start the start of the range
	 * @param end the end of the range
	 */
	function value_set_double_range(value: GObject.Value, start: number, end: number): void;
	/**
	 * Sets #value to the flags and mask values provided in #flags and #mask.
	 * The #flags value indicates the values of flags, the #mask represents
	 * which bits in the flag value have been set, and which are "don't care"
	 * @param value a GValue initialized to %GST_TYPE_FLAG_SET
	 * @param flags The value of the flags set or unset
	 * @param mask The mask indicate which flags bits must match for comparisons
	 */
	function value_set_flagset(value: GObject.Value, flags: number, mask: number): void;
	/**
	 * Sets #value to the fraction specified by #numerator over #denominator.
	 * The fraction gets reduced to the smallest numerator and denominator,
	 * and if necessary the sign is moved to the numerator.
	 * @param value a GValue initialized to #GST_TYPE_FRACTION
	 * @param numerator the numerator of the fraction
	 * @param denominator the denominator of the fraction
	 */
	function value_set_fraction(value: GObject.Value, numerator: number, denominator: number): void;
	/**
	 * Sets #value to the range specified by #start and #end.
	 * @param value a GValue initialized to GST_TYPE_FRACTION_RANGE
	 * @param start the start of the range (a GST_TYPE_FRACTION GValue)
	 * @param end the end of the range (a GST_TYPE_FRACTION GValue)
	 */
	function value_set_fraction_range(value: GObject.Value, start: GObject.Value, end: GObject.Value): void;
	/**
	 * Sets #value to the range specified by #numerator_start/#denominator_start
	 * and #numerator_end/#denominator_end.
	 * @param value a GValue initialized to GST_TYPE_FRACTION_RANGE
	 * @param numerator_start the numerator start of the range
	 * @param denominator_start the denominator start of the range
	 * @param numerator_end the numerator end of the range
	 * @param denominator_end the denominator end of the range
	 */
	function value_set_fraction_range_full(value: GObject.Value, numerator_start: number, denominator_start: number, numerator_end: number, denominator_end: number): void;
	/**
	 * Sets #value to the range specified by #start and #end.
	 * @param value a GValue initialized to GST_TYPE_INT64_RANGE
	 * @param start the start of the range
	 * @param end the end of the range
	 */
	function value_set_int64_range(value: GObject.Value, start: number, end: number): void;
	/**
	 * Sets #value to the range specified by #start, #end and #step.
	 * @param value a GValue initialized to GST_TYPE_INT64_RANGE
	 * @param start the start of the range
	 * @param end the end of the range
	 * @param step the step of the range
	 */
	function value_set_int64_range_step(value: GObject.Value, start: number, end: number, step: number): void;
	/**
	 * Sets #value to the range specified by #start and #end.
	 * @param value a GValue initialized to GST_TYPE_INT_RANGE
	 * @param start the start of the range
	 * @param end the end of the range
	 */
	function value_set_int_range(value: GObject.Value, start: number, end: number): void;
	/**
	 * Sets #value to the range specified by #start, #end and #step.
	 * @param value a GValue initialized to GST_TYPE_INT_RANGE
	 * @param start the start of the range
	 * @param end the end of the range
	 * @param step the step of the range
	 */
	function value_set_int_range_step(value: GObject.Value, start: number, end: number, step: number): void;
	/**
	 * Sets the contents of #value to #structure.
	 * @param value a GValue initialized to GST_TYPE_STRUCTURE
	 * @param structure the structure to set the value to
	 */
	function value_set_structure(value: GObject.Value, structure: Structure): void;
	/**
	 * Subtracts #subtrahend from #minuend and stores the result in #dest.
	 * Note that this means subtraction as in sets, not as in mathematics.
	 * @param minuend the value to subtract from
	 * @param subtrahend the value to subtract
	 * @returns %TRUE if the subtraction is not empty
	 * 
	 * the destination value
	 *     for the result if the subtraction is not empty. May be %NULL,
	 *     in which case the resulting set will not be computed, which can
	 *     give a fair speedup.
	 */
	function value_subtract(minuend: GObject.Value, subtrahend: GObject.Value): [ boolean, GObject.Value | null ];
	/**
	 * Creates a GValue corresponding to the union of #value1 and #value2.
	 * @param value1 a value to union
	 * @param value2 another value to union
	 * @returns %TRUE if the union succeeded.
	 * 
	 * the destination value
	 */
	function value_union(value1: GObject.Value, value2: GObject.Value): [ boolean, GObject.Value ];
	/**
	 * Gets the version number of the GStreamer library.
	 * @returns pointer to a guint to store the major version number
	 * 
	 * pointer to a guint to store the minor version number
	 * 
	 * pointer to a guint to store the micro version number
	 * 
	 * pointer to a guint to store the nano version number
	 */
	function version(): [ major: number, minor: number, micro: number, nano: number ];
	/**
	 * This function returns a string that is useful for describing this version
	 * of GStreamer to the outside world: user agent strings, logging, ...
	 * @returns a newly allocated string describing this version
	 *     of GStreamer.
	 */
	function version_string(): string;
	/**
	 * The allocator name for the default system memory allocator
	 * @returns The allocator name for the default system memory allocator
	 */
	const ALLOCATOR_SYSMEM: string;

	/**
	 * Combination of all possible fields that can be copied with
	 * {@link Gst.Buffer.copy_into}.
	 * @returns Combination of all possible fields that can be copied with
	 * {@link Gst.Buffer.copy_into}.
	 */
	const BUFFER_COPY_ALL: BufferCopyFlags;

	/**
	 * Combination of all possible metadata fields that can be copied with
	 * {@link Gst.Buffer.copy_into}.
	 * @returns Combination of all possible metadata fields that can be copied with
	 * {@link Gst.Buffer.copy_into}.
	 */
	const BUFFER_COPY_METADATA: BufferCopyFlags;

	/**
	 * Constant for no-offset return results.
	 * @returns Constant for no-offset return results.
	 */
	const BUFFER_OFFSET_NONE: number;

	const CAN_INLINE: number;

	const CAPS_FEATURE_MEMORY_SYSTEM_MEMORY: string;

	/**
	 * Constant to define an undefined clock time.
	 * @returns Constant to define an undefined clock time.
	 */
	const CLOCK_TIME_NONE: ClockTime;

	const DEBUG_BG_MASK: number;

	const DEBUG_FG_MASK: number;

	const DEBUG_FORMAT_MASK: number;

	const ELEMENT_FACTORY_KLASS_DECODER: string;

	const ELEMENT_FACTORY_KLASS_DECRYPTOR: string;

	const ELEMENT_FACTORY_KLASS_DEMUXER: string;

	const ELEMENT_FACTORY_KLASS_DEPAYLOADER: string;

	const ELEMENT_FACTORY_KLASS_ENCODER: string;

	const ELEMENT_FACTORY_KLASS_ENCRYPTOR: string;

	const ELEMENT_FACTORY_KLASS_FORMATTER: string;

	/**
	 * Elements interacting with hardware devices should specify this classifier in
	 * their metadata. You may need to put the element in "READY" state to test if
	 * the hardware is present in the system.
	 * @returns Elements interacting with hardware devices should specify this classifier in
	 * their metadata. You may need to put the element in "READY" state to test if
	 * the hardware is present in the system.
	 */
	const ELEMENT_FACTORY_KLASS_HARDWARE: string;

	const ELEMENT_FACTORY_KLASS_MEDIA_AUDIO: string;

	const ELEMENT_FACTORY_KLASS_MEDIA_IMAGE: string;

	const ELEMENT_FACTORY_KLASS_MEDIA_METADATA: string;

	const ELEMENT_FACTORY_KLASS_MEDIA_SUBTITLE: string;

	const ELEMENT_FACTORY_KLASS_MEDIA_VIDEO: string;

	const ELEMENT_FACTORY_KLASS_MUXER: string;

	const ELEMENT_FACTORY_KLASS_PARSER: string;

	const ELEMENT_FACTORY_KLASS_PAYLOADER: string;

	const ELEMENT_FACTORY_KLASS_SINK: string;

	const ELEMENT_FACTORY_KLASS_SRC: string;

	/**
	 * Elements of any of the defined GST_ELEMENT_FACTORY_LIST types
	 * @returns Elements of any of the defined GST_ELEMENT_FACTORY_LIST types
	 */
	const ELEMENT_FACTORY_TYPE_ANY: ElementFactoryListType;

	/**
	 * All sinks handling audio, video or image media types
	 * @returns All sinks handling audio, video or image media types
	 */
	const ELEMENT_FACTORY_TYPE_AUDIOVIDEO_SINKS: ElementFactoryListType;

	/**
	 * All encoders handling audio media types
	 * @returns All encoders handling audio media types
	 */
	const ELEMENT_FACTORY_TYPE_AUDIO_ENCODER: ElementFactoryListType;

	/**
	 * All elements used to 'decode' streams (decoders, demuxers, parsers, depayloaders)
	 * @returns All elements used to 'decode' streams (decoders, demuxers, parsers, depayloaders)
	 */
	const ELEMENT_FACTORY_TYPE_DECODABLE: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_DECODER: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_DECRYPTOR: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_DEMUXER: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_DEPAYLOADER: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_ENCODER: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_ENCRYPTOR: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_FORMATTER: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_HARDWARE: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_MAX_ELEMENTS: ElementFactoryListType;

	/**
	 * Elements matching any of the defined GST_ELEMENT_FACTORY_TYPE_MEDIA types
	 * 
	 * Note: Do not use this if you wish to not filter against any of the defined
	 * media types. If you wish to do this, simply don't specify any
	 * GST_ELEMENT_FACTORY_TYPE_MEDIA flag.
	 * @returns Elements matching any of the defined GST_ELEMENT_FACTORY_TYPE_MEDIA types
	 * 
	 * Note: Do not use this if you wish to not filter against any of the defined
	 * media types. If you wish to do this, simply don't specify any
	 * GST_ELEMENT_FACTORY_TYPE_MEDIA flag.
	 */
	const ELEMENT_FACTORY_TYPE_MEDIA_ANY: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_MEDIA_AUDIO: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_MEDIA_IMAGE: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_MEDIA_METADATA: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_MEDIA_SUBTITLE: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_MEDIA_VIDEO: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_MUXER: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_PARSER: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_PAYLOADER: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_SINK: ElementFactoryListType;

	const ELEMENT_FACTORY_TYPE_SRC: ElementFactoryListType;

	/**
	 * All encoders handling video or image media types
	 * @returns All encoders handling video or image media types
	 */
	const ELEMENT_FACTORY_TYPE_VIDEO_ENCODER: ElementFactoryListType;

	/**
	 * Name and contact details of the author(s). Use \n to separate
	 * multiple author details.
	 * E.g: "Joe Bloggs &lt;joe.blogs at foo.com&gt;"
	 * @returns Name and contact details of the author(s). Use \n to separate
	 * multiple author details.
	 * E.g: "Joe Bloggs &lt;joe.blogs at foo.com&gt;"
	 */
	const ELEMENT_METADATA_AUTHOR: string;

	/**
	 * Sentence describing the purpose of the element.
	 * E.g: "Write stream to a file"
	 * @returns Sentence describing the purpose of the element.
	 * E.g: "Write stream to a file"
	 */
	const ELEMENT_METADATA_DESCRIPTION: string;

	/**
	 * Set uri pointing to user documentation. Applications can use this to show
	 * help for e.g. effects to users.
	 * @returns Set uri pointing to user documentation. Applications can use this to show
	 * help for e.g. effects to users.
	 */
	const ELEMENT_METADATA_DOC_URI: string;

	/**
	 * Elements that bridge to certain other products can include an icon of that
	 * used product. Application can show the icon in menus/selectors to help
	 * identifying specific elements.
	 * @returns Elements that bridge to certain other products can include an icon of that
	 * used product. Application can show the icon in menus/selectors to help
	 * identifying specific elements.
	 */
	const ELEMENT_METADATA_ICON_NAME: string;

	/**
	 * String describing the type of element, as an unordered list
	 * separated with slashes ('/'). See draft-klass.txt of the design docs
	 * for more details and common types. E.g: "Sink/File"
	 * @returns String describing the type of element, as an unordered list
	 * separated with slashes ('/'). See draft-klass.txt of the design docs
	 * for more details and common types. E.g: "Sink/File"
	 */
	const ELEMENT_METADATA_KLASS: string;

	/**
	 * The long English name of the element. E.g. "File Sink"
	 * @returns The long English name of the element. E.g. "File Sink"
	 */
	const ELEMENT_METADATA_LONGNAME: string;

	/**
	 * Builds a string using errno describing the previously failed system
	 * call.  To be used as the debug argument in #GST_ELEMENT_ERROR.
	 * @returns Builds a string using errno describing the previously failed system
	 * call.  To be used as the debug argument in #GST_ELEMENT_ERROR.
	 */
	const ERROR_SYSTEM: string;

	const EVENT_NUM_SHIFT: number;

	/**
	 * The same thing as #GST_EVENT_TYPE_UPSTREAM | #GST_EVENT_TYPE_DOWNSTREAM.
	 * @returns The same thing as #GST_EVENT_TYPE_UPSTREAM | #GST_EVENT_TYPE_DOWNSTREAM.
	 */
	const EVENT_TYPE_BOTH: EventTypeFlags;

	/**
	 * A mask value with all bits set, for use as a
	 * GstFlagSet mask where all flag bits must match
	 * exactly
	 * @returns A mask value with all bits set, for use as a
	 * GstFlagSet mask where all flag bits must match
	 * exactly
	 */
	const FLAG_SET_MASK_EXACT: number;

	/**
	 * The PERCENT format is between 0 and this value
	 * @returns The PERCENT format is between 0 and this value
	 */
	const FORMAT_PERCENT_MAX: number;

	/**
	 * The value used to scale down the reported PERCENT format value to
	 * its real value.
	 * @returns The value used to scale down the reported PERCENT format value to
	 * its real value.
	 */
	const FORMAT_PERCENT_SCALE: number;

	/**
	 * Can be used together with #GST_FOURCC_ARGS to properly output a
	 * #guint32 fourcc value in a printf\()-style text message.
	 * 
	 * |[
	 * printf ("fourcc: %" GST_FOURCC_FORMAT "\n", GST_FOURCC_ARGS (fcc));
	 * ]|
	 * @returns Can be used together with #GST_FOURCC_ARGS to properly output a
	 * #guint32 fourcc value in a printf\()-style text message.
	 * 
	 * |[
	 * printf ("fourcc: %" GST_FOURCC_FORMAT "\n", GST_FOURCC_ARGS (fcc));
	 * ]|
	 */
	const FOURCC_FORMAT: string;

	/**
	 * A value which is guaranteed to never be returned by
	 * {@link Gst.util.group_id_next}.
	 * 
	 * Can be used as a default value in variables used to store group_id.
	 * @returns A value which is guaranteed to never be returned by
	 * {@link Gst.util.group_id_next}.
	 * 
	 * Can be used as a default value in variables used to store group_id.
	 */
	const GROUP_ID_INVALID: number;

	/**
	 * To be used in GST_PLUGIN_DEFINE if unsure about the licence.
	 * @returns To be used in GST_PLUGIN_DEFINE if unsure about the licence.
	 */
	const LICENSE_UNKNOWN: string;

	/**
	 * GstLockFlags value alias for GST_LOCK_FLAG_READ | GST_LOCK_FLAG_WRITE
	 * @returns GstLockFlags value alias for GST_LOCK_FLAG_READ | GST_LOCK_FLAG_WRITE
	 */
	const LOCK_FLAG_READWRITE: LockFlags;

	/**
	 * GstMapFlags value alias for GST_MAP_READ | GST_MAP_WRITE
	 * @returns GstMapFlags value alias for GST_MAP_READ | GST_MAP_WRITE
	 */
	const MAP_READWRITE: MapFlags;

	/**
	 * This metadata stays relevant as long as memory layout is unchanged.
	 * @returns This metadata stays relevant as long as memory layout is unchanged.
	 */
	const META_TAG_MEMORY_STR: string;

	/**
	 * Constant that defines one GStreamer millisecond.
	 * @returns Constant that defines one GStreamer millisecond.
	 */
	const MSECOND: ClockTimeDiff;

	/**
	 * Constant that defines one GStreamer nanosecond
	 * @returns Constant that defines one GStreamer nanosecond
	 */
	const NSECOND: ClockTimeDiff;

	/**
	 * Use this flag on GObject properties of GstObject to indicate that
	 * they might not be available depending on environment such as OS, device, etc,
	 * so such properties will be installed conditionally only if the GstObject is
	 * able to support it.
	 * @returns Use this flag on GObject properties of GstObject to indicate that
	 * they might not be available depending on environment such as OS, device, etc,
	 * so such properties will be installed conditionally only if the GstObject is
	 * able to support it.
	 */
	const PARAM_CONDITIONALLY_AVAILABLE: number;

	/**
	 * Use this flag on GObject properties to signal they can make sense to be.
	 * controlled over time. This hint is used by the GstController.
	 * @returns Use this flag on GObject properties to signal they can make sense to be.
	 * controlled over time. This hint is used by the GstController.
	 */
	const PARAM_CONTROLLABLE: number;

	/**
	 * Use this flag on GObject properties of GstObject to indicate that
	 * during `gst-inspect` and friends, the default value should be used
	 * as default instead of the current value.
	 * @returns Use this flag on GObject properties of GstObject to indicate that
	 * during `gst-inspect` and friends, the default value should be used
	 * as default instead of the current value.
	 */
	const PARAM_DOC_SHOW_DEFAULT: number;

	/**
	 * Use this flag on GObject properties of GstElements to indicate that
	 * they can be changed when the element is in the PAUSED or lower state.
	 * This flag implies GST_PARAM_MUTABLE_READY.
	 * @returns Use this flag on GObject properties of GstElements to indicate that
	 * they can be changed when the element is in the PAUSED or lower state.
	 * This flag implies GST_PARAM_MUTABLE_READY.
	 */
	const PARAM_MUTABLE_PAUSED: number;

	/**
	 * Use this flag on GObject properties of GstElements to indicate that
	 * they can be changed when the element is in the PLAYING or lower state.
	 * This flag implies GST_PARAM_MUTABLE_PAUSED.
	 * @returns Use this flag on GObject properties of GstElements to indicate that
	 * they can be changed when the element is in the PLAYING or lower state.
	 * This flag implies GST_PARAM_MUTABLE_PAUSED.
	 */
	const PARAM_MUTABLE_PLAYING: number;

	/**
	 * Use this flag on GObject properties of GstElements to indicate that
	 * they can be changed when the element is in the READY or lower state.
	 * @returns Use this flag on GObject properties of GstElements to indicate that
	 * they can be changed when the element is in the READY or lower state.
	 */
	const PARAM_MUTABLE_READY: number;

	/**
	 * Bits based on GST_PARAM_USER_SHIFT can be used by 3rd party applications.
	 * @returns Bits based on GST_PARAM_USER_SHIFT can be used by 3rd party applications.
	 */
	const PARAM_USER_SHIFT: number;

	/**
	 * The field name in a GstCaps that is used to signal the UUID of the protection
	 * system.
	 * @returns The field name in a GstCaps that is used to signal the UUID of the protection
	 * system.
	 */
	const PROTECTION_SYSTEM_ID_CAPS_FIELD: string;

	/**
	 * The protection system value of the unspecified UUID.
	 * In some cases the system protection ID is not present in the contents or in their
	 * metadata, as encrypted WebM.
	 * This define is used to set the value of the "system_id" field in GstProtectionEvent,
	 * with this value, the application will use an external information to choose which
	 * protection system to use.
	 * 
	 * Example: The matroskademux uses this value in the case of encrypted WebM,
	 * the application will choose the appropriate protection system based on the information
	 * received through EME API.
	 * @returns The protection system value of the unspecified UUID.
	 * In some cases the system protection ID is not present in the contents or in their
	 * metadata, as encrypted WebM.
	 * This define is used to set the value of the "system_id" field in GstProtectionEvent,
	 * with this value, the application will use an external information to choose which
	 * protection system to use.
	 * 
	 * Example: The matroskademux uses this value in the case of encrypted WebM,
	 * the application will choose the appropriate protection system based on the information
	 * received through EME API.
	 */
	const PROTECTION_UNSPECIFIED_SYSTEM_ID: string;

	/**
	 * printf format type used to debug GStreamer types. You can use this in
	 * combination with GStreamer's debug logging system as well as the functions
	 * {@link Gst.info.vasprintf}, gst_info_strdup_vprintf() and gst_info_strdup_printf()
	 * to pretty-print the following types: {@link Caps}, #GstStructure,
	 * #GstCapsFeatures, #GstTagList, #GstDateTime, #GstBuffer, #GstBufferList,
	 * #GstMessage, #GstEvent, #GstQuery, #GstContext, #GstPad, #GstObject. All
	 * #GObject types will be printed as typename plus pointer, and everything
	 * else will simply be printed as pointer address.
	 * 
	 * This can only be used on types whose size is >= sizeof(gpointer).
	 * @returns printf format type used to debug GStreamer types. You can use this in
	 * combination with GStreamer's debug logging system as well as the functions
	 * {@link Gst.info.vasprintf}, gst_info_strdup_vprintf() and gst_info_strdup_printf()
	 * to pretty-print the following types: {@link Caps}, #GstStructure,
	 * #GstCapsFeatures, #GstTagList, #GstDateTime, #GstBuffer, #GstBufferList,
	 * #GstMessage, #GstEvent, #GstQuery, #GstContext, #GstPad, #GstObject. All
	 * #GObject types will be printed as typename plus pointer, and everything
	 * else will simply be printed as pointer address.
	 * 
	 * This can only be used on types whose size is >= sizeof(gpointer).
	 */
	const PTR_FORMAT: string;

	const QUERY_NUM_SHIFT: number;

	/**
	 * The same thing as #GST_QUERY_TYPE_UPSTREAM | #GST_QUERY_TYPE_DOWNSTREAM.
	 * @returns The same thing as #GST_QUERY_TYPE_UPSTREAM | #GST_QUERY_TYPE_DOWNSTREAM.
	 */
	const QUERY_TYPE_BOTH: QueryTypeFlags;

	/**
	 * Constant that defines one GStreamer second.
	 * @returns Constant that defines one GStreamer second.
	 */
	const SECOND: ClockTimeDiff;

	/**
	 * printf format type used to debug GStreamer segments. You can use this in
	 * combination with GStreamer's debug logging system as well as the functions
	 * {@link Gst.info.vasprintf}, gst_info_strdup_vprintf() and gst_info_strdup_printf()
	 * to pretty-print {@link Segment} structures.
	 * This can only be used on pointers to GstSegment structures.
	 * @returns printf format type used to debug GStreamer segments. You can use this in
	 * combination with GStreamer's debug logging system as well as the functions
	 * {@link Gst.info.vasprintf}, gst_info_strdup_vprintf() and gst_info_strdup_printf()
	 * to pretty-print {@link Segment} structures.
	 * This can only be used on pointers to GstSegment structures.
	 */
	const SEGMENT_FORMAT: string;

	const SEGMENT_INSTANT_FLAGS: number;

	/**
	 * A value which is guaranteed to never be returned by
	 * {@link Gst.util.seqnum_next}.
	 * 
	 * Can be used as a default value in variables used to store seqnum.
	 * @returns A value which is guaranteed to never be returned by
	 * {@link Gst.util.seqnum_next}.
	 * 
	 * Can be used as a default value in variables used to store seqnum.
	 */
	const SEQNUM_INVALID: number;

	/**
	 * printf format type used to debug GStreamer signed time value pointers. You
	 * can use this in combination with GStreamer's debug logging system as well as
	 * the functions {@link Gst.info.vasprintf}, gst_info_strdup_vprintf() and
	 * gst_info_strdup_printf() to pretty-print signed time (pointers to
	 * {@link ClockTimeDiff} or #gint64).
	 * @returns printf format type used to debug GStreamer signed time value pointers. You
	 * can use this in combination with GStreamer's debug logging system as well as
	 * the functions {@link Gst.info.vasprintf}, gst_info_strdup_vprintf() and
	 * gst_info_strdup_printf() to pretty-print signed time (pointers to
	 * {@link ClockTimeDiff} or #gint64).
	 */
	const STIMEP_FORMAT: string;

	/**
	 * A string that can be used in printf-like format strings to display a signed
	 * {@link ClockTimeDiff} or #gint64 value in h:m:s format.  Use {@link GST.TIME_ARGS} to
	 * construct the matching arguments.
	 * 
	 * Example:
	 * |[
	 * printf("%" GST_STIME_FORMAT "\n", GST_STIME_ARGS(ts));
	 * ]|
	 * @returns A string that can be used in printf-like format strings to display a signed
	 * {@link ClockTimeDiff} or #gint64 value in h:m:s format.  Use {@link GST.TIME_ARGS} to
	 * construct the matching arguments.
	 * 
	 * Example:
	 * |[
	 * printf("%" GST_STIME_FORMAT "\n", GST_STIME_ARGS(ts));
	 * ]|
	 */
	const STIME_FORMAT: string;

	/**
	 * album containing this data (string)
	 * 
	 * The album name as it should be displayed, e.g. 'The Jazz Guitar'
	 * @returns album containing this data (string)
	 * 
	 * The album name as it should be displayed, e.g. 'The Jazz Guitar'
	 */
	const TAG_ALBUM: string;

	/**
	 * The artist of the entire album, as it should be displayed.
	 * @returns The artist of the entire album, as it should be displayed.
	 */
	const TAG_ALBUM_ARTIST: string;

	/**
	 * The artist of the entire album, as it should be sorted.
	 * @returns The artist of the entire album, as it should be sorted.
	 */
	const TAG_ALBUM_ARTIST_SORTNAME: string;

	/**
	 * album gain in db (double)
	 * @returns album gain in db (double)
	 */
	const TAG_ALBUM_GAIN: string;

	/**
	 * peak of the album (double)
	 * @returns peak of the album (double)
	 */
	const TAG_ALBUM_PEAK: string;

	/**
	 * album containing this data, as used for sorting (string)
	 * 
	 * The album name as it should be sorted, e.g. 'Jazz Guitar, The'
	 * @returns album containing this data, as used for sorting (string)
	 * 
	 * The album name as it should be sorted, e.g. 'Jazz Guitar, The'
	 */
	const TAG_ALBUM_SORTNAME: string;

	/**
	 * count of discs inside collection this disc belongs to (unsigned integer)
	 * @returns count of discs inside collection this disc belongs to (unsigned integer)
	 */
	const TAG_ALBUM_VOLUME_COUNT: string;

	/**
	 * disc number inside a collection (unsigned integer)
	 * @returns disc number inside a collection (unsigned integer)
	 */
	const TAG_ALBUM_VOLUME_NUMBER: string;

	/**
	 * Arbitrary application data (sample)
	 * 
	 * Some formats allow applications to add their own arbitrary data
	 * into files. This data is application dependent.
	 * @returns Arbitrary application data (sample)
	 * 
	 * Some formats allow applications to add their own arbitrary data
	 * into files. This data is application dependent.
	 */
	const TAG_APPLICATION_DATA: string;

	/**
	 * Name of the application used to create the media (string)
	 * @returns Name of the application used to create the media (string)
	 */
	const TAG_APPLICATION_NAME: string;

	/**
	 * person(s) responsible for the recording (string)
	 * 
	 * The artist name as it should be displayed, e.g. 'Jimi Hendrix' or
	 * 'The Guitar Heroes'
	 * @returns person(s) responsible for the recording (string)
	 * 
	 * The artist name as it should be displayed, e.g. 'Jimi Hendrix' or
	 * 'The Guitar Heroes'
	 */
	const TAG_ARTIST: string;

	/**
	 * person(s) responsible for the recording, as used for sorting (string)
	 * 
	 * The artist name as it should be sorted, e.g. 'Hendrix, Jimi' or
	 * 'Guitar Heroes, The'
	 * @returns person(s) responsible for the recording, as used for sorting (string)
	 * 
	 * The artist name as it should be sorted, e.g. 'Hendrix, Jimi' or
	 * 'Guitar Heroes, The'
	 */
	const TAG_ARTIST_SORTNAME: string;

	/**
	 * generic file attachment (sample) (sample taglist should specify the content
	 * type and if possible set "filename" to the file name of the
	 * attachment)
	 * @returns generic file attachment (sample) (sample taglist should specify the content
	 * type and if possible set "filename" to the file name of the
	 * attachment)
	 */
	const TAG_ATTACHMENT: string;

	/**
	 * codec the audio data is stored in (string)
	 * @returns codec the audio data is stored in (string)
	 */
	const TAG_AUDIO_CODEC: string;

	/**
	 * number of beats per minute in audio (double)
	 * @returns number of beats per minute in audio (double)
	 */
	const TAG_BEATS_PER_MINUTE: string;

	/**
	 * exact or average bitrate in bits/s (unsigned integer)
	 * @returns exact or average bitrate in bits/s (unsigned integer)
	 */
	const TAG_BITRATE: string;

	/**
	 * codec the data is stored in (string)
	 * @returns codec the data is stored in (string)
	 */
	const TAG_CODEC: string;

	/**
	 * free text commenting the data (string)
	 * @returns free text commenting the data (string)
	 */
	const TAG_COMMENT: string;

	/**
	 * person(s) who composed the recording (string)
	 * @returns person(s) who composed the recording (string)
	 */
	const TAG_COMPOSER: string;

	/**
	 * The composer's name, used for sorting (string)
	 * @returns The composer's name, used for sorting (string)
	 */
	const TAG_COMPOSER_SORTNAME: string;

	/**
	 * conductor/performer refinement (string)
	 * @returns conductor/performer refinement (string)
	 */
	const TAG_CONDUCTOR: string;

	/**
	 * contact information (string)
	 * @returns contact information (string)
	 */
	const TAG_CONTACT: string;

	/**
	 * container format the data is stored in (string)
	 * @returns container format the data is stored in (string)
	 */
	const TAG_CONTAINER_FORMAT: string;

	/**
	 * copyright notice of the data (string)
	 * @returns copyright notice of the data (string)
	 */
	const TAG_COPYRIGHT: string;

	/**
	 * URI to location where copyright details can be found (string)
	 * @returns URI to location where copyright details can be found (string)
	 */
	const TAG_COPYRIGHT_URI: string;

	/**
	 * date the data was created (#GDate structure)
	 * @returns date the data was created (#GDate structure)
	 */
	const TAG_DATE: string;

	/**
	 * date and time the data was created ({@link DateTime} structure)
	 * @returns date and time the data was created ({@link DateTime} structure)
	 */
	const TAG_DATE_TIME: string;

	/**
	 * short text describing the content of the data (string)
	 * @returns short text describing the content of the data (string)
	 */
	const TAG_DESCRIPTION: string;

	/**
	 * Manufacturer of the device used to create the media (string)
	 * @returns Manufacturer of the device used to create the media (string)
	 */
	const TAG_DEVICE_MANUFACTURER: string;

	/**
	 * Model of the device used to create the media (string)
	 * @returns Model of the device used to create the media (string)
	 */
	const TAG_DEVICE_MODEL: string;

	/**
	 * length in GStreamer time units (nanoseconds) (unsigned 64-bit integer)
	 * @returns length in GStreamer time units (nanoseconds) (unsigned 64-bit integer)
	 */
	const TAG_DURATION: string;

	/**
	 * name of the person or organisation that encoded the file. May contain a
	 * copyright message if the person or organisation also holds the copyright
	 * (string)
	 * 
	 * Note: do not use this field to describe the encoding application. Use
	 * #GST_TAG_APPLICATION_NAME or #GST_TAG_COMMENT for that.
	 * @returns name of the person or organisation that encoded the file. May contain a
	 * copyright message if the person or organisation also holds the copyright
	 * (string)
	 * 
	 * Note: do not use this field to describe the encoding application. Use
	 * #GST_TAG_APPLICATION_NAME or #GST_TAG_COMMENT for that.
	 */
	const TAG_ENCODED_BY: string;

	/**
	 * encoder used to encode this stream (string)
	 * @returns encoder used to encode this stream (string)
	 */
	const TAG_ENCODER: string;

	/**
	 * version of the encoder used to encode this stream (unsigned integer)
	 * @returns version of the encoder used to encode this stream (unsigned integer)
	 */
	const TAG_ENCODER_VERSION: string;

	/**
	 * key/value text commenting the data (string)
	 * 
	 * Must be in the form of 'key=comment' or
	 * 'key[lc]=comment' where 'lc' is an ISO-639
	 * language code.
	 * 
	 * This tag is used for unknown Vorbis comment tags,
	 * unknown APE tags and certain ID3v2 comment fields.
	 * @returns key/value text commenting the data (string)
	 * 
	 * Must be in the form of 'key=comment' or
	 * 'key[lc]=comment' where 'lc' is an ISO-639
	 * language code.
	 * 
	 * This tag is used for unknown Vorbis comment tags,
	 * unknown APE tags and certain ID3v2 comment fields.
	 */
	const TAG_EXTENDED_COMMENT: string;

	/**
	 * genre this data belongs to (string)
	 * @returns genre this data belongs to (string)
	 */
	const TAG_GENRE: string;

	/**
	 * Indicates the direction the device is pointing to when capturing
	 * a media. It is represented as degrees in floating point representation,
	 * 0 means the geographic north, and increases clockwise (double from 0 to 360)
	 * 
	 * See also #GST_TAG_GEO_LOCATION_MOVEMENT_DIRECTION
	 * @returns Indicates the direction the device is pointing to when capturing
	 * a media. It is represented as degrees in floating point representation,
	 * 0 means the geographic north, and increases clockwise (double from 0 to 360)
	 * 
	 * See also #GST_TAG_GEO_LOCATION_MOVEMENT_DIRECTION
	 */
	const TAG_GEO_LOCATION_CAPTURE_DIRECTION: string;

	/**
	 * The city (english name) where the media has been produced (string).
	 * @returns The city (english name) where the media has been produced (string).
	 */
	const TAG_GEO_LOCATION_CITY: string;

	/**
	 * The country (english name) where the media has been produced (string).
	 * @returns The country (english name) where the media has been produced (string).
	 */
	const TAG_GEO_LOCATION_COUNTRY: string;

	/**
	 * geo elevation of where the media has been recorded or produced in meters
	 * according to WGS84 (zero is average sea level) (double).
	 * @returns geo elevation of where the media has been recorded or produced in meters
	 * according to WGS84 (zero is average sea level) (double).
	 */
	const TAG_GEO_LOCATION_ELEVATION: string;

	/**
	 * Represents the expected error on the horizontal positioning in
	 * meters (double).
	 * @returns Represents the expected error on the horizontal positioning in
	 * meters (double).
	 */
	const TAG_GEO_LOCATION_HORIZONTAL_ERROR: string;

	/**
	 * geo latitude location of where the media has been recorded or produced in
	 * degrees according to WGS84 (zero at the equator, negative values for southern
	 * latitudes) (double).
	 * @returns geo latitude location of where the media has been recorded or produced in
	 * degrees according to WGS84 (zero at the equator, negative values for southern
	 * latitudes) (double).
	 */
	const TAG_GEO_LOCATION_LATITUDE: string;

	/**
	 * geo longitude location of where the media has been recorded or produced in
	 * degrees according to WGS84 (zero at the prime meridian in Greenwich/UK,
	 * negative values for western longitudes). (double).
	 * @returns geo longitude location of where the media has been recorded or produced in
	 * degrees according to WGS84 (zero at the prime meridian in Greenwich/UK,
	 * negative values for western longitudes). (double).
	 */
	const TAG_GEO_LOCATION_LONGITUDE: string;

	/**
	 * Indicates the movement direction of the device performing the capture
	 * of a media. It is represented as degrees in floating point representation,
	 * 0 means the geographic north, and increases clockwise (double from 0 to 360)
	 * 
	 * See also #GST_TAG_GEO_LOCATION_CAPTURE_DIRECTION
	 * @returns Indicates the movement direction of the device performing the capture
	 * of a media. It is represented as degrees in floating point representation,
	 * 0 means the geographic north, and increases clockwise (double from 0 to 360)
	 * 
	 * See also #GST_TAG_GEO_LOCATION_CAPTURE_DIRECTION
	 */
	const TAG_GEO_LOCATION_MOVEMENT_DIRECTION: string;

	/**
	 * Speed of the capturing device when performing the capture.
	 * Represented in m/s. (double)
	 * 
	 * See also #GST_TAG_GEO_LOCATION_MOVEMENT_DIRECTION
	 * @returns Speed of the capturing device when performing the capture.
	 * Represented in m/s. (double)
	 * 
	 * See also #GST_TAG_GEO_LOCATION_MOVEMENT_DIRECTION
	 */
	const TAG_GEO_LOCATION_MOVEMENT_SPEED: string;

	/**
	 * human readable descriptive location of where the media has been recorded or
	 * produced. (string).
	 * @returns human readable descriptive location of where the media has been recorded or
	 * produced. (string).
	 */
	const TAG_GEO_LOCATION_NAME: string;

	/**
	 * A location 'smaller' than GST_TAG_GEO_LOCATION_CITY that specifies better
	 * where the media has been produced. (e.g. the neighborhood) (string).
	 * 
	 * This tag has been added as this is how it is handled/named in XMP's
	 * Iptc4xmpcore schema.
	 * @returns A location 'smaller' than GST_TAG_GEO_LOCATION_CITY that specifies better
	 * where the media has been produced. (e.g. the neighborhood) (string).
	 * 
	 * This tag has been added as this is how it is handled/named in XMP's
	 * Iptc4xmpcore schema.
	 */
	const TAG_GEO_LOCATION_SUBLOCATION: string;

	/**
	 * Groups together media that are related and spans multiple tracks. An
	 * example are multiple pieces of a concerto. (string)
	 * @returns Groups together media that are related and spans multiple tracks. An
	 * example are multiple pieces of a concerto. (string)
	 */
	const TAG_GROUPING: string;

	/**
	 * Homepage for this media (i.e. artist or movie homepage) (string)
	 * @returns Homepage for this media (i.e. artist or movie homepage) (string)
	 */
	const TAG_HOMEPAGE: string;

	/**
	 * image (sample) (sample taglist should specify the content type and preferably
	 * also set "image-type" field as `GstTagImageType`)
	 * @returns image (sample) (sample taglist should specify the content type and preferably
	 * also set "image-type" field as `GstTagImageType`)
	 */
	const TAG_IMAGE: string;

	/**
	 * Represents the 'Orientation' tag from EXIF. Defines how the image
	 * should be rotated and mirrored for display. (string)
	 * 
	 * This tag has a predefined set of allowed values:
	 *   "rotate-0"
	 *   "rotate-90"
	 *   "rotate-180"
	 *   "rotate-270"
	 *   "flip-rotate-0"
	 *   "flip-rotate-90"
	 *   "flip-rotate-180"
	 *   "flip-rotate-270"
	 * 
	 * The naming is adopted according to a possible transformation to perform
	 * on the image to fix its orientation, obviously equivalent operations will
	 * yield the same result.
	 * 
	 * Rotations indicated by the values are in clockwise direction and
	 * 'flip' means an horizontal mirroring.
	 * @returns Represents the 'Orientation' tag from EXIF. Defines how the image
	 * should be rotated and mirrored for display. (string)
	 * 
	 * This tag has a predefined set of allowed values:
	 *   "rotate-0"
	 *   "rotate-90"
	 *   "rotate-180"
	 *   "rotate-270"
	 *   "flip-rotate-0"
	 *   "flip-rotate-90"
	 *   "flip-rotate-180"
	 *   "flip-rotate-270"
	 * 
	 * The naming is adopted according to a possible transformation to perform
	 * on the image to fix its orientation, obviously equivalent operations will
	 * yield the same result.
	 * 
	 * Rotations indicated by the values are in clockwise direction and
	 * 'flip' means an horizontal mirroring.
	 */
	const TAG_IMAGE_ORIENTATION: string;

	/**
	 * Information about the people behind a remix and similar
	 * interpretations of another existing piece (string)
	 * @returns Information about the people behind a remix and similar
	 * interpretations of another existing piece (string)
	 */
	const TAG_INTERPRETED_BY: string;

	/**
	 * International Standard Recording Code - see http://www.ifpi.org/isrc/ (string)
	 * @returns International Standard Recording Code - see http://www.ifpi.org/isrc/ (string)
	 */
	const TAG_ISRC: string;

	/**
	 * comma separated keywords describing the content (string).
	 * @returns comma separated keywords describing the content (string).
	 */
	const TAG_KEYWORDS: string;

	/**
	 * ISO-639-2 or ISO-639-1 code for the language the content is in (string)
	 * 
	 * There is utility API in libgsttag in gst-plugins-base to obtain a translated
	 * language name from the language code: {@link `gst.tag_get_language_name}`
	 * @returns ISO-639-2 or ISO-639-1 code for the language the content is in (string)
	 * 
	 * There is utility API in libgsttag in gst-plugins-base to obtain a translated
	 * language name from the language code: {@link `gst.tag_get_language_name}`
	 */
	const TAG_LANGUAGE_CODE: string;

	/**
	 * Name of the language the content is in (string)
	 * 
	 * Free-form name of the language the content is in, if a language code
	 * is not available. This tag should not be set in addition to a language
	 * code. It is undefined what language or locale the language name is in.
	 * @returns Name of the language the content is in (string)
	 * 
	 * Free-form name of the language the content is in, if a language code
	 * is not available. This tag should not be set in addition to a language
	 * code. It is undefined what language or locale the language name is in.
	 */
	const TAG_LANGUAGE_NAME: string;

	/**
	 * license of data (string)
	 * @returns license of data (string)
	 */
	const TAG_LICENSE: string;

	/**
	 * URI to location where license details can be found (string)
	 * @returns URI to location where license details can be found (string)
	 */
	const TAG_LICENSE_URI: string;

	/**
	 * Origin of media as a URI (location, where the original of the file or stream
	 * is hosted) (string)
	 * @returns Origin of media as a URI (location, where the original of the file or stream
	 * is hosted) (string)
	 */
	const TAG_LOCATION: string;

	/**
	 * The lyrics of the media (string)
	 * @returns The lyrics of the media (string)
	 */
	const TAG_LYRICS: string;

	/**
	 * maximum bitrate in bits/s (unsigned integer)
	 * @returns maximum bitrate in bits/s (unsigned integer)
	 */
	const TAG_MAXIMUM_BITRATE: string;

	/**
	 * [Midi note number](http://en.wikipedia.org/wiki/Note#Note_designation_in_accordance_with_octave_name)
	 * of the audio track. This is useful for sample instruments and in particular
	 * for multi-samples.
	 * @returns [Midi note number](http://en.wikipedia.org/wiki/Note#Note_designation_in_accordance_with_octave_name)
	 * of the audio track. This is useful for sample instruments and in particular
	 * for multi-samples.
	 */
	const TAG_MIDI_BASE_NOTE: string;

	/**
	 * minimum bitrate in bits/s (unsigned integer)
	 * @returns minimum bitrate in bits/s (unsigned integer)
	 */
	const TAG_MINIMUM_BITRATE: string;

	/**
	 * nominal bitrate in bits/s (unsigned integer). The actual bitrate might be
	 * different from this target bitrate.
	 * @returns nominal bitrate in bits/s (unsigned integer). The actual bitrate might be
	 * different from this target bitrate.
	 */
	const TAG_NOMINAL_BITRATE: string;

	/**
	 * organization (string)
	 * @returns organization (string)
	 */
	const TAG_ORGANIZATION: string;

	/**
	 * person(s) performing (string)
	 * @returns person(s) performing (string)
	 */
	const TAG_PERFORMER: string;

	/**
	 * image that is meant for preview purposes, e.g. small icon-sized version
	 * (sample) (sample taglist should specify the content type)
	 * @returns image that is meant for preview purposes, e.g. small icon-sized version
	 * (sample) (sample taglist should specify the content type)
	 */
	const TAG_PREVIEW_IMAGE: string;

	/**
	 * Any private data that may be contained in tags (sample).
	 * 
	 * It is represented by {@link Sample} in which #GstBuffer contains the
	 * binary data and the sample's info #GstStructure may contain any
	 * extra information that identifies the origin or meaning of the data.
	 * 
	 * Private frames in ID3v2 tags ('PRIV' frames) will be represented
	 * using this tag, in which case the GstStructure will be named
	 * "ID3PrivateFrame" and contain a field named "owner" of type string
	 * which contains the owner-identification string from the tag.
	 * @returns Any private data that may be contained in tags (sample).
	 * 
	 * It is represented by {@link Sample} in which #GstBuffer contains the
	 * binary data and the sample's info #GstStructure may contain any
	 * extra information that identifies the origin or meaning of the data.
	 * 
	 * Private frames in ID3v2 tags ('PRIV' frames) will be represented
	 * using this tag, in which case the GstStructure will be named
	 * "ID3PrivateFrame" and contain a field named "owner" of type string
	 * which contains the owner-identification string from the tag.
	 */
	const TAG_PRIVATE_DATA: string;

	/**
	 * Name of the label or publisher (string)
	 * @returns Name of the label or publisher (string)
	 */
	const TAG_PUBLISHER: string;

	/**
	 * reference level of track and album gain values (double)
	 * @returns reference level of track and album gain values (double)
	 */
	const TAG_REFERENCE_LEVEL: string;

	/**
	 * serial number of track (unsigned integer)
	 * @returns serial number of track (unsigned integer)
	 */
	const TAG_SERIAL: string;

	/**
	 * Number of the episode within a season/show (unsigned integer)
	 * @returns Number of the episode within a season/show (unsigned integer)
	 */
	const TAG_SHOW_EPISODE_NUMBER: string;

	/**
	 * Name of the show, used for displaying (string)
	 * @returns Name of the show, used for displaying (string)
	 */
	const TAG_SHOW_NAME: string;

	/**
	 * Number of the season of a show/series (unsigned integer)
	 * @returns Number of the season of a show/series (unsigned integer)
	 */
	const TAG_SHOW_SEASON_NUMBER: string;

	/**
	 * Name of the show, used for sorting (string)
	 * @returns Name of the show, used for sorting (string)
	 */
	const TAG_SHOW_SORTNAME: string;

	/**
	 * codec/format the subtitle data is stored in (string)
	 * @returns codec/format the subtitle data is stored in (string)
	 */
	const TAG_SUBTITLE_CODEC: string;

	/**
	 * commonly used title (string)
	 * 
	 * The title as it should be displayed, e.g. 'The Doll House'
	 * @returns commonly used title (string)
	 * 
	 * The title as it should be displayed, e.g. 'The Doll House'
	 */
	const TAG_TITLE: string;

	/**
	 * commonly used title, as used for sorting (string)
	 * 
	 * The title as it should be sorted, e.g. 'Doll House, The'
	 * @returns commonly used title, as used for sorting (string)
	 * 
	 * The title as it should be sorted, e.g. 'Doll House, The'
	 */
	const TAG_TITLE_SORTNAME: string;

	/**
	 * count of tracks inside collection this track belongs to (unsigned integer)
	 * @returns count of tracks inside collection this track belongs to (unsigned integer)
	 */
	const TAG_TRACK_COUNT: string;

	/**
	 * track gain in db (double)
	 * @returns track gain in db (double)
	 */
	const TAG_TRACK_GAIN: string;

	/**
	 * track number inside a collection (unsigned integer)
	 * @returns track number inside a collection (unsigned integer)
	 */
	const TAG_TRACK_NUMBER: string;

	/**
	 * peak of the track (double)
	 * @returns peak of the track (double)
	 */
	const TAG_TRACK_PEAK: string;

	/**
	 * Rating attributed by a person (likely the application user).
	 * The higher the value, the more the user likes this media
	 * (unsigned int from 0 to 100)
	 * @returns Rating attributed by a person (likely the application user).
	 * The higher the value, the more the user likes this media
	 * (unsigned int from 0 to 100)
	 */
	const TAG_USER_RATING: string;

	/**
	 * version of this data (string)
	 * @returns version of this data (string)
	 */
	const TAG_VERSION: string;

	/**
	 * codec the video data is stored in (string)
	 * @returns codec the video data is stored in (string)
	 */
	const TAG_VIDEO_CODEC: string;

	/**
	 * printf format type used to debug GStreamer ClockTime pointers. You can use
	 * this in combination with GStreamer's debug logging system as well as the
	 * functions {@link Gst.info.vasprintf}, gst_info_strdup_vprintf() and
	 * gst_info_strdup_printf() to pretty-print {@link ClockTime} pointers. This can
	 * only be used on pointers to GstClockTime values.
	 * @returns printf format type used to debug GStreamer ClockTime pointers. You can use
	 * this in combination with GStreamer's debug logging system as well as the
	 * functions {@link Gst.info.vasprintf}, gst_info_strdup_vprintf() and
	 * gst_info_strdup_printf() to pretty-print {@link ClockTime} pointers. This can
	 * only be used on pointers to GstClockTime values.
	 */
	const TIMEP_FORMAT: string;

	/**
	 * A string that can be used in printf-like format strings to display a
	 * {@link ClockTime} value in h:m:s format.  Use {@link GST.TIME_ARGS} to construct
	 * the matching arguments.
	 * 
	 * Example:
	 * |[<!-- language="C" -->
	 * printf("%" GST_TIME_FORMAT "\n", GST_TIME_ARGS(ts));
	 * ]|
	 * @returns A string that can be used in printf-like format strings to display a
	 * {@link ClockTime} value in h:m:s format.  Use {@link GST.TIME_ARGS} to construct
	 * the matching arguments.
	 * 
	 * Example:
	 * |[<!-- language="C" -->
	 * printf("%" GST_TIME_FORMAT "\n", GST_TIME_ARGS(ts));
	 * ]|
	 */
	const TIME_FORMAT: string;

	/**
	 * Special value for the repeat_count set in {@link Gst.TocEntry.set_loop} or
	 * returned by gst_toc_entry_set_loop() to indicate infinite looping.
	 * @returns Special value for the repeat_count set in {@link Gst.TocEntry.set_loop} or
	 * returned by gst_toc_entry_set_loop() to indicate infinite looping.
	 */
	const TOC_REPEAT_COUNT_INFINITE: number;

	/**
	 * Value for {@link Uri}<!-- -->.port to indicate no port number.
	 * @returns Value for {@link Uri}<!-- -->.port to indicate no port number.
	 */
	const URI_NO_PORT: number;

	/**
	 * Constant that defines one GStreamer microsecond.
	 * @returns Constant that defines one GStreamer microsecond.
	 */
	const USECOND: ClockTimeDiff;

	/**
	 * Indicates that the first value provided to a comparison function
	 * {@link (gst.value_compare}) is equal to the second one.
	 * @returns Indicates that the first value provided to a comparison function
	 * {@link (gst.value_compare}) is equal to the second one.
	 */
	const VALUE_EQUAL: number;

	/**
	 * Indicates that the first value provided to a comparison function
	 * {@link (gst.value_compare}) is greater than the second one.
	 * @returns Indicates that the first value provided to a comparison function
	 * {@link (gst.value_compare}) is greater than the second one.
	 */
	const VALUE_GREATER_THAN: number;

	/**
	 * Indicates that the first value provided to a comparison function
	 * {@link (gst.value_compare}) is lesser than the second one.
	 * @returns Indicates that the first value provided to a comparison function
	 * {@link (gst.value_compare}) is lesser than the second one.
	 */
	const VALUE_LESS_THAN: number;

	/**
	 * Indicates that the comparison function {@link (gst.value_compare}) can not
	 * determine a order for the two provided values.
	 * @returns Indicates that the comparison function {@link (gst.value_compare}) can not
	 * determine a order for the two provided values.
	 */
	const VALUE_UNORDERED: number;

	/**
	 * The major version of GStreamer at compile time:
	 * @returns The major version of GStreamer at compile time:
	 */
	const VERSION_MAJOR: number;

	/**
	 * The micro version of GStreamer at compile time:
	 * @returns The micro version of GStreamer at compile time:
	 */
	const VERSION_MICRO: number;

	/**
	 * The minor version of GStreamer at compile time:
	 * @returns The minor version of GStreamer at compile time:
	 */
	const VERSION_MINOR: number;

	/**
	 * The nano version of GStreamer at compile time:
	 * Actual releases have 0, GIT versions have 1, prerelease versions have 2-...
	 * @returns The nano version of GStreamer at compile time:
	 * Actual releases have 0, GIT versions have 1, prerelease versions have 2-...
	 */
	const VERSION_NANO: number;

}