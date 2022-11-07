/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.GIRepository {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Repository} instead.
	 */
	interface IRepository {
		/**
		 * Obtain an unordered list of versions (either currently loaded or
		 * available) for #namespace_ in this #repository.
		 * @param namespace_ GI namespace, e.g. "Gtk"
		 * @returns the array of versions.
		 */
		enumerate_versions(namespace_: string): string[];
		/**
		 * Searches for the enum type corresponding to the given #GError
		 * domain. Before calling this function for a particular namespace,
		 * you must call {@link G.irepository_require} once to load the namespace, or
		 * otherwise ensure the namespace has already been loaded.
		 * @param domain a #GError domain
		 * @returns #GIEnumInfo representing metadata about #domain's
		 * enum type, or %NULL
		 */
		find_by_error_domain(domain: GLib.Quark): EnumInfo;
		/**
		 * Searches all loaded namespaces for a particular #GType.  Note that
		 * in order to locate the metadata, the namespace corresponding to
		 * the type must first have been loaded.  There is currently no
		 * mechanism for determining the namespace which corresponds to an
		 * arbitrary GType - thus, this function will operate most reliably
		 * when you know the GType to originate from be from a loaded namespace.
		 * @param gtype GType to search for
		 * @returns #GIBaseInfo representing metadata about #type, or %NULL
		 */
		find_by_gtype(gtype: GObject.Type): BaseInfo;
		/**
		 * Searches for a particular entry in a namespace.  Before calling
		 * this function for a particular namespace, you must call
		 * {@link G.irepository_require} once to load the namespace, or otherwise
		 * ensure the namespace has already been loaded.
		 * @param namespace_ Namespace which will be searched
		 * @param name Entry name to find
		 * @returns #GIBaseInfo representing metadata about #name, or %NULL
		 */
		find_by_name(namespace_: string, name: string): BaseInfo;
		/**
		 * This function returns the "C prefix", or the C level namespace
		 * associated with the given introspection namespace.  Each C symbol
		 * starts with this prefix, as well each #GType in the library.
		 * 
		 * Note: The namespace must have already been loaded using a function
		 * such as {@link G.irepository_require} before calling this function.
		 * @param namespace_ Namespace to inspect
		 * @returns C namespace prefix, or %NULL if none associated
		 */
		get_c_prefix(namespace_: string): string;
		/**
		 * Retrieves all (transitive) versioned dependencies for
		 * #namespace_.
		 * 
		 * The strings are of the form `namespace-version`.
		 * 
		 * Note: #namespace_ must have already been loaded using a function
		 * such as {@link G.irepository_require} before calling this function.
		 * 
		 * To get only the immediate dependencies for #namespace_, use
		 * g_irepository_get_immediate_dependencies().
		 * @param namespace_ Namespace of interest
		 * @returns all versioned
		 *   dependencies
		 */
		get_dependencies(namespace_: string): string[];
		/**
		 * Return an array of the immediate versioned dependencies for #namespace_.
		 * Returned strings are of the form `namespace-version`.
		 * 
		 * Note: #namespace_ must have already been loaded using a function
		 * such as {@link G.irepository_require} before calling this function.
		 * 
		 * To get the transitive closure of dependencies for #namespace_, use
		 * g_irepository_get_dependencies().
		 * @param namespace_ Namespace of interest
		 * @returns Zero-terminated string array of immediate versioned
		 *   dependencies
		 */
		get_immediate_dependencies(namespace_: string): string[];
		/**
		 * This function returns a particular metadata entry in the
		 * given namespace #namespace_.  The namespace must have
		 * already been loaded before calling this function.
		 * See {@link G.irepository_get_n_infos} to find the maximum number of
		 * entries.
		 * @param namespace_ Namespace to inspect
		 * @param index 0-based offset into namespace metadata for entry
		 * @returns #GIBaseInfo containing metadata
		 */
		get_info(namespace_: string, index: number): BaseInfo;
		/**
		 * Return the list of currently loaded namespaces.
		 * @returns List of namespaces
		 */
		get_loaded_namespaces(): string[];
		/**
		 * This function returns the number of metadata entries in
		 * given namespace #namespace_.  The namespace must have
		 * already been loaded before calling this function.
		 * @param namespace_ Namespace to inspect
		 * @returns number of metadata entries
		 */
		get_n_infos(namespace_: string): number;
		/**
		 * Look up the implemented interfaces for #gtype.  This function
		 * cannot fail per se; but for a totally "unknown" #GType, it may
		 * return 0 implemented interfaces.
		 * 
		 * The semantics of this function are designed for a dynamic binding,
		 * where in certain cases (such as a function which returns an
		 * interface which may have "hidden" implementation classes), not all
		 * data may be statically known, and will have to be determined from
		 * the #GType of the object.  An example is {@link G.file_new_for_path}
		 * returning a concrete class of #GLocalFile, which is a #GType we
		 * see at runtime, but not statically.
		 * @param gtype a #GType whose fundamental type is G_TYPE_OBJECT
		 * @returns Interfaces for #gtype
		 */
		get_object_gtype_interfaces(gtype: GObject.Type): InterfaceInfo[];
		/**
		 * This function returns a comma-separated list of paths to the
		 * shared C libraries associated with the given namespace #namespace_.
		 * There may be no shared library path associated, in which case this
		 * function will return %NULL.
		 * 
		 * Note: The namespace must have already been loaded using a function
		 * such as {@link G.irepository_require} before calling this function.
		 * @param namespace_ Namespace to inspect
		 * @returns Comma-separated list of paths to shared libraries,
		 *   or %NULL if none are associated
		 */
		get_shared_library(namespace_: string): string | null;
		/**
		 * If namespace #namespace_ is loaded, return the full path to the
		 * .typelib file it was loaded from.  If the typelib for
		 * namespace #namespace_ was included in a shared library, return
		 * the special string "&lt;builtin&gt;".
		 * @param namespace_ GI namespace to use, e.g. "Gtk"
		 * @returns Filesystem path (or $lt;builtin$gt;) if successful, %NULL if namespace is not loaded
		 */
		get_typelib_path(namespace_: string): string;
		/**
		 * This function returns the loaded version associated with the given
		 * namespace #namespace_.
		 * 
		 * Note: The namespace must have already been loaded using a function
		 * such as {@link G.irepository_require} before calling this function.
		 * @param namespace_ Namespace to inspect
		 * @returns Loaded version
		 */
		get_version(namespace_: string): string;
		/**
		 * Check whether a particular namespace (and optionally, a specific
		 * version thereof) is currently loaded.  This function is likely to
		 * only be useful in unusual circumstances; in order to act upon
		 * metadata in the namespace, you should call {@link G.irepository_require}
		 * instead which will ensure the namespace is loaded, and return as
		 * quickly as this function will if it has already been loaded.
		 * @param namespace_ Namespace of interest
		 * @param version Required version, may be %NULL for latest
		 * @returns %TRUE if namespace-version is loaded, %FALSE otherwise
		 */
		is_registered(namespace_: string, version?: string | null): boolean;
		/**
		 * TODO
		 * @param typelib TODO
		 * @param flags TODO
		 * @returns 
		 */
		load_typelib(typelib: Typelib, flags: RepositoryLoadFlags): string;
		/**
		 * Force the namespace #namespace_ to be loaded if it isn't already.
		 * If #namespace_ is not loaded, this function will search for a
		 * ".typelib" file using the repository search path.  In addition, a
		 * version #version of namespace may be specified.  If #version is
		 * not specified, the latest will be used.
		 * @param namespace_ GI namespace to use, e.g. "Gtk"
		 * @param version Version of namespace, may be %NULL for latest
		 * @param flags Set of %GIRepositoryLoadFlags, may be 0
		 * @returns a pointer to the #GITypelib if successful, %NULL otherwise
		 */
		require(namespace_: string, version: string | null, flags: RepositoryLoadFlags): Typelib;
		/**
		 * Force the namespace #namespace_ to be loaded if it isn't already.
		 * If #namespace_ is not loaded, this function will search for a
		 * ".typelib" file within the private directory only. In addition, a
		 * version #version of namespace should be specified.  If #version is
		 * not specified, the latest will be used.
		 * @param typelib_dir Private directory where to find the requested typelib
		 * @param namespace_ GI namespace to use, e.g. "Gtk"
		 * @param version Version of namespace, may be %NULL for latest
		 * @param flags Set of %GIRepositoryLoadFlags, may be 0
		 * @returns a pointer to the #GITypelib if successful, %NULL otherwise
		 */
		require_private(typelib_dir: string, namespace_: string, version: string | null, flags: RepositoryLoadFlags): Typelib;
	}

	type RepositoryInitOptionsMixin = GObject.ObjectInitOptions
	export interface RepositoryInitOptions extends RepositoryInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Repository} instead.
	 */
	type RepositoryMixin = IRepository & GObject.Object;

	/**
	 * #GIRepository is used to manage repositories of namespaces. Namespaces
	 * are represented on disk by type libraries (.typelib files).
	 * 
	 * ### Discovery of type libraries
	 * 
	 * #GIRepository will typically look for a `girepository-1.0` directory
	 * under the library directory used when compiling gobject-introspection.
	 * 
	 * It is possible to control the search paths programmatically, using
	 * {@link G.irepository_prepend_search_path}. It is also possible to modify
	 * the search paths by using the `GI_TYPELIB_PATH` environment variable.
	 * The environment variable takes precedence over the default search path
	 * and the g_irepository_prepend_search_path() calls.
	 */
	interface Repository extends RepositoryMixin {}

	class Repository {
		public constructor(options?: Partial<RepositoryInitOptions>);
		public static dump(arg: string): boolean;
		public static error_quark(): GLib.Quark;
		/**
		 * Returns the singleton process-global default #GIRepository. It is
		 * not currently supported to have multiple repositories in a
		 * particular process, but this function is provided in the unlikely
		 * eventuality that it would become possible, and as a convenience for
		 * higher level language bindings to conform to the GObject method
		 * call conventions.
		 * 
		 * All methods on #GIRepository also accept %NULL as an instance
		 * parameter to mean this default repository, which is usually more
		 * convenient for C.
		 * @returns The global singleton #GIRepository
		 */
		public static get_default(): Repository;
		/**
		 * Obtain the option group for girepository, it's used
		 * by the dumper and for programs that wants to provide
		 * introspection information
		 * @returns the option group
		 */
		public static get_option_group(): GLib.OptionGroup;
		/**
		 * Returns the current search path #GIRepository will use when loading
		 * typelib files. The list is internal to #GIRepository and should not
		 * be freed, nor should its string elements.
		 * @returns #GSList of strings
		 */
		public static get_search_path(): string[];
		public static prepend_library_path(directory: string): void;
		/**
		 * Prepends #directory to the typelib search path.
		 * 
		 * See also: {@link G.irepository_get_search_path}.
		 * @param directory directory name to prepend to the typelib
		 *   search path
		 */
		public static prepend_search_path(directory: string): void;
	}

	export interface AttributeIterInitOptions {}
	/**
	 * An opaque structure used to iterate over attributes
	 * in a #GIBaseInfo struct.
	 */
	interface AttributeIter {}
	class AttributeIter {
		public constructor(options?: Partial<AttributeIterInitOptions>);
		public readonly data: any;
		public readonly data2: any;
		public readonly data3: any;
		public readonly data4: any;
	}

	export interface BaseInfoInitOptions {}
	/**
	 * GIBaseInfo is the common base struct of all other Info structs
	 * accessible through the #GIRepository API.
	 * 
	 * All info structures can be cast to a #GIBaseInfo, for instance:
	 * 
	 * |[<!-- language="C" -->
	 *    GIFunctionInfo *function_info = ...;
	 *    GIBaseInfo *info = (GIBaseInfo *) function_info;
	 * ]|
	 * 
	 * Most #GIRepository APIs returning a #GIBaseInfo is actually
	 * creating a new struct; in other words, {@link G.base_info_unref} has to
	 * be called when done accessing the data.
	 * 
	 * #GIBaseInfo structuress are normally accessed by calling either
	 * g_irepository_find_by_name(), g_irepository_find_by_gtype() or
	 * g_irepository_get_info().
	 * 
	 * |[<!-- language="C" -->
	 * GIBaseInfo *button_info =
	 *   g_irepository_find_by_name (NULL, "Gtk", "Button");
	 * 
	 * // ... use button_info ...
	 * 
	 * g_base_info_unref (button_info);
	 * ]|
	 * 
	 * ## Hierarchy
	 * 
	 * |[<!-- language="plain" -->
	 *   GIBaseInfo
	 *    +---- GIArgInfo
	 *    +---- GICallableInfo
	 *    +---- GIConstantInfo
	 *    +---- GIFieldInfo
	 *    +---- GIPropertyInfo
	 *    +---- GIRegisteredTypeInfo
	 *    +---- GITypeInfo
	 * ]|
	 */
	interface BaseInfo {}
	class BaseInfo {
		public constructor(options?: Partial<BaseInfoInitOptions>);
		public readonly dummy1: number;
		public readonly dummy2: number;
		public readonly dummy3: any;
		public readonly dummy4: any;
		public readonly dummy5: any;
		public readonly dummy6: number;
		public readonly dummy7: number;
		public readonly padding: any[];
		/**
		 * Compare two #GIBaseInfo.
		 * 
		 * Using pointer comparison is not practical since many functions return
		 * different instances of #GIBaseInfo that refers to the same part of the
		 * TypeLib; use this function instead to do #GIBaseInfo comparisons.
		 * @param info2 a #GIBaseInfo
		 * @returns %TRUE if and only if #info1 equals #info2.
		 */
		public equal(info2: BaseInfo): boolean;
		/**
		 * Retrieve an arbitrary attribute associated with this node.
		 * @param name a freeform string naming an attribute
		 * @returns The value of the attribute, or %NULL if no such attribute exists
		 */
		public get_attribute(name: string): string;
		/**
		 * Obtain the container of the #info. The container is the parent
		 * GIBaseInfo. For instance, the parent of a #GIFunctionInfo is an
		 * #GIObjectInfo or #GIInterfaceInfo.
		 * @returns the container
		 */
		public get_container(): BaseInfo;
		/**
		 * Obtain the name of the #info. What the name represents depends on
		 * the #GIInfoType of the #info. For instance for #GIFunctionInfo it is
		 * the name of the function.
		 * @returns the name of #info or %NULL if it lacks a name.
		 */
		public get_name(): string;
		/**
		 * Obtain the namespace of #info.
		 * @returns the namespace
		 */
		public get_namespace(): string;
		/**
		 * Obtain the info type of the GIBaseInfo.
		 * @returns the info type of #info
		 */
		public get_type(): InfoType;
		/**
		 * Obtain the typelib this #info belongs to
		 * @returns the typelib.
		 */
		public get_typelib(): Typelib;
		/**
		 * Obtain whether the #info is represents a metadata which is
		 * deprecated or not.
		 * @returns %TRUE if deprecated
		 */
		public is_deprecated(): boolean;
		/**
		 * Iterate over all attributes associated with this node.  The iterator
		 * structure is typically stack allocated, and must have its first
		 * member initialized to %NULL.  Attributes are arbitrary namespaced key–value
		 * pairs which can be attached to almost any item.  They are intended for use
		 * by software higher in the toolchain than bindings, and are distinct from
		 * normal GIR annotations.
		 * 
		 * Both the #name and #value should be treated as constants
		 * and must not be freed.
		 * 
		 * |[<!-- language="C" -->
		 * void
		 * print_attributes (GIBaseInfo *info)
		 * {
		 *   GIAttributeIter iter = { 0, };
		 *   char *name;
		 *   char *value;
		 *   while (g_base_info_iterate_attributes (info, &iter, &name, &value))
		 *     {
		 *       g_print ("attribute name: %s value: %s", name, value);
		 *     }
		 * }
		 * ]|
		 * @returns %TRUE if there are more attributes
		 * 
		 * Returned name, must not be freed
		 * 
		 * Returned name, must not be freed
		 */
		public iterate_attributes(): [ boolean, string, string ];
		/**
		 * Increases the reference count of #info.
		 * @returns the same #info.
		 */
		public ref(): BaseInfo;
		/**
		 * Decreases the reference count of #info. When its reference count
		 * drops to 0, the info is freed.
		 */
		public unref(): void;
	}

	export interface TypelibInitOptions {}
	/**
	 * TODO
	 */
	interface Typelib {}
	class Typelib {
		public constructor(options?: Partial<TypelibInitOptions>);
		public static new_from_const_memory(memory: number, len: number): Typelib;
		public static new_from_mapped_file(mfile: GLib.MappedFile): Typelib;
		public static new_from_memory(memory: number, len: number): Typelib;
		public free(): void;
		public get_namespace(): string;
		public symbol(symbol_name: string, symbol?: any | null): boolean;
	}

	export interface UnresolvedInfoInitOptions {}
	/**
	 * Represents a unresolved type in a typelib.
	 */
	interface UnresolvedInfo {}
	class UnresolvedInfo {
		public constructor(options?: Partial<UnresolvedInfoInitOptions>);
	}

	/**
	 * The type of array in a #GITypeInfo.
	 */
	enum ArrayType {
		/**
		 * a C array, char[] for instance
		 */
		C = 0,
		/**
		 * a #GArray array
		 */
		ARRAY = 1,
		/**
		 * a #GPtrArray array
		 */
		PTR_ARRAY = 2,
		/**
		 * a #GByteArray array
		 */
		BYTE_ARRAY = 3
	}

	/**
	 * The direction of a #GIArgInfo.
	 */
	enum Direction {
		/**
		 * in argument.
		 */
		IN = 0,
		/**
		 * out argument.
		 */
		OUT = 1,
		/**
		 * in and out argument.
		 */
		INOUT = 2
	}

	/**
	 * The type of a GIBaseInfo struct.
	 */
	enum InfoType {
		/**
		 * invalid type
		 */
		INVALID = 0,
		/**
		 * function, see #GIFunctionInfo
		 */
		FUNCTION = 1,
		/**
		 * callback, see #GIFunctionInfo
		 */
		CALLBACK = 2,
		/**
		 * struct, see #GIStructInfo
		 */
		STRUCT = 3,
		/**
		 * boxed, see #GIStructInfo or #GIUnionInfo
		 */
		BOXED = 4,
		/**
		 * enum, see #GIEnumInfo
		 */
		ENUM = 5,
		/**
		 * flags, see #GIEnumInfo
		 */
		FLAGS = 6,
		/**
		 * object, see #GIObjectInfo
		 */
		OBJECT = 7,
		/**
		 * interface, see #GIInterfaceInfo
		 */
		INTERFACE = 8,
		/**
		 * contant, see #GIConstantInfo
		 */
		CONSTANT = 9,
		/**
		 * deleted, used to be GI_INFO_TYPE_ERROR_DOMAIN.
		 */
		INVALID_0 = 10,
		/**
		 * union, see #GIUnionInfo
		 */
		UNION = 11,
		/**
		 * enum value, see #GIValueInfo
		 */
		VALUE = 12,
		/**
		 * signal, see #GISignalInfo
		 */
		SIGNAL = 13,
		/**
		 * virtual function, see #GIVFuncInfo
		 */
		VFUNC = 14,
		/**
		 * GObject property, see #GIPropertyInfo
		 */
		PROPERTY = 15,
		/**
		 * struct or union field, see #GIFieldInfo
		 */
		FIELD = 16,
		/**
		 * argument of a function or callback, see #GIArgInfo
		 */
		ARG = 17,
		/**
		 * type information, see #GITypeInfo
		 */
		TYPE = 18,
		/**
		 * unresolved type, a type which is not present in
		 *   the typelib, or any of its dependencies.
		 */
		UNRESOLVED = 19
	}

	/**
	 * An error code used with #G_IREPOSITORY_ERROR in a #GError returned
	 * from a #GIRepository routine.
	 */
	enum RepositoryError {
		/**
		 * the typelib could not be found.
		 */
		TYPELIB_NOT_FOUND = 0,
		/**
		 * the namespace does not match the
		 *   requested namespace.
		 */
		NAMESPACE_MISMATCH = 1,
		/**
		 * the version of the
		 *   typelib does not match the requested version.
		 */
		NAMESPACE_VERSION_CONFLICT = 2,
		/**
		 * the library used by the typelib
		 *   could not be found.
		 */
		LIBRARY_NOT_FOUND = 3
	}

	/**
	 * Scope type of a #GIArgInfo representing callback, determines how the
	 * callback is invoked and is used to decided when the invoke structs
	 * can be freed.
	 */
	enum ScopeType {
		/**
		 * The argument is not of callback type.
		 */
		INVALID = 0,
		/**
		 * The callback and associated user_data is only
		 *   used during the call to this function.
		 */
		CALL = 1,
		/**
		 * The callback and associated user_data is
		 *   only used until the callback is invoked, and the callback.
		 *   is invoked always exactly once.
		 */
		ASYNC = 2,
		/**
		 * The callback and associated
		 *   user_data is used until the caller is notfied via the destroy_notify.
		 */
		NOTIFIED = 3,
		/**
		 * The callback and associated user_data is
		 *   used until the process terminates
		 */
		FOREVER = 4
	}

	/**
	 * The transfer is the exchange of data between two parts, from the callee to
	 * the caller. The callee is either a function/method/signal or an
	 * object/interface where a property is defined. The caller is the side
	 * accessing a property or calling a function.
	 * #GITransfer specifies who's responsible for freeing the resources after the
	 * ownership transfer is complete. In case of a containing type such as a list,
	 * an array or a hash table the container itself is specified differently from
	 * the items within the container itself. Each container is freed differently,
	 * check the documentation for the types themselves for information on how to
	 * free them.
	 */
	enum Transfer {
		/**
		 * transfer nothing from the callee (function or the type
		 * instance the property belongs to) to the caller. The callee retains the
		 * ownership of the transfer and the caller doesn't need to do anything to free
		 * up the resources of this transfer.
		 */
		NOTHING = 0,
		/**
		 * transfer the container (list, array, hash table) from
		 * the callee to the caller. The callee retains the ownership of the individual
		 * items in the container and the caller has to free up the container resources
		 * {@link (g.list_free/g_hash_table_destroy()} etc) of this transfer.
		 */
		CONTAINER = 1,
		/**
		 * transfer everything, eg the container and its
		 * contents from the callee to the caller. This is the case when the callee
		 * creates a copy of all the data it returns. The caller is responsible for
		 * cleaning up the container and item resources of this transfer.
		 */
		EVERYTHING = 2
	}

	/**
	 * The type tag of a #GITypeInfo.
	 */
	enum TypeTag {
		/**
		 * void
		 */
		VOID = 0,
		/**
		 * boolean
		 */
		BOOLEAN = 1,
		/**
		 * 8-bit signed integer
		 */
		INT8 = 2,
		/**
		 * 8-bit unsigned integer
		 */
		UINT8 = 3,
		/**
		 * 16-bit signed integer
		 */
		INT16 = 4,
		/**
		 * 16-bit unsigned integer
		 */
		UINT16 = 5,
		/**
		 * 32-bit signed integer
		 */
		INT32 = 6,
		/**
		 * 32-bit unsigned integer
		 */
		UINT32 = 7,
		/**
		 * 64-bit signed integer
		 */
		INT64 = 8,
		/**
		 * 64-bit unsigned integer
		 */
		UINT64 = 9,
		/**
		 * float
		 */
		FLOAT = 10,
		/**
		 * double floating point
		 */
		DOUBLE = 11,
		/**
		 * a #GType
		 */
		GTYPE = 12,
		/**
		 * a UTF-8 encoded string
		 */
		UTF8 = 13,
		/**
		 * a filename, encoded in the same encoding
		 *   as the native filesystem is using.
		 */
		FILENAME = 14,
		/**
		 * an array
		 */
		ARRAY = 15,
		/**
		 * an extended interface object
		 */
		INTERFACE = 16,
		/**
		 * a #GList
		 */
		GLIST = 17,
		/**
		 * a #GSList
		 */
		GSLIST = 18,
		/**
		 * a #GHashTable
		 */
		GHASH = 19,
		/**
		 * a #GError
		 */
		ERROR = 20,
		/**
		 * Unicode character
		 */
		UNICHAR = 21
	}

	/**
	 * An error occuring while invoking a function via
	 * {@link G.function_info_invoke}.
	 */
	enum nvokeError {
		/**
		 * invokation failed, unknown error.
		 */
		FAILED = 0,
		/**
		 * symbol couldn't be found in any of the
		 * libraries associated with the typelib of the function.
		 */
		SYMBOL_NOT_FOUND = 1,
		/**
		 * the arguments provided didn't match
		 * the expected arguments for the functions type signature.
		 */
		ARGUMENT_MISMATCH = 2
	}

	/**
	 * Flags for a #GIFieldInfo.
	 */
	enum FieldInfoFlags {
		/**
		 * field is readable.
		 */
		READABLE = 1,
		/**
		 * field is writable.
		 */
		WRITABLE = 2
	}

	/**
	 * Flags for a #GIFunctionInfo struct.
	 */
	enum FunctionInfoFlags {
		/**
		 * is a method.
		 */
		IS_METHOD = 1,
		/**
		 * is a constructor.
		 */
		IS_CONSTRUCTOR = 2,
		/**
		 * is a getter of a #GIPropertyInfo.
		 */
		IS_GETTER = 4,
		/**
		 * is a setter of a #GIPropertyInfo.
		 */
		IS_SETTER = 8,
		/**
		 * represents a virtual function.
		 */
		WRAPS_VFUNC = 16,
		/**
		 * the function may throw an error.
		 */
		THROWS = 32
	}

	/**
	 * Flags that control how a typelib is loaded.
	 */
	enum RepositoryLoadFlags {
		/**
		 * Lazily load the typelib.
		 */
		IREPOSITORY_LOAD_FLAG_LAZY = 1
	}

	/**
	 * Flags of a #GIVFuncInfo struct.
	 */
	enum VFuncInfoFlags {
		/**
		 * chains up to the parent type
		 */
		MUST_CHAIN_UP = 1,
		/**
		 * overrides
		 */
		MUST_OVERRIDE = 2,
		/**
		 * does not override
		 */
		MUST_NOT_OVERRIDE = 4,
		/**
		 * Includes a #GError
		 */
		THROWS = 8
	}

	/**
	 * Extract an object instance out of #value
	 */
	interface ObjectInfoGetValueFunction {
		/**
		 * Extract an object instance out of #value
		 * @param value a #GValue
		 * @returns the object instance
		 */
		(value: GObject.Value): any | null;
	}

	/**
	 * Increases the reference count of an object instance.
	 */
	interface ObjectInfoRefFunction {
		/**
		 * Increases the reference count of an object instance.
		 * @param object object instance pointer
		 * @returns the object instance
		 */
		(object?: any | null): any | null;
	}

	/**
	 * Update #value and attach the object instance pointer #object to it.
	 */
	interface ObjectInfoSetValueFunction {
		/**
		 * Update #value and attach the object instance pointer #object to it.
		 * @param value a #GValue
		 * @param object object instance pointer
		 */
		(value: GObject.Value, object?: any | null): void;
	}

	/**
	 * Decreases the reference count of an object instance.
	 */
	interface ObjectInfoUnrefFunction {
		/**
		 * Decreases the reference count of an object instance.
		 * @param object object instance pointer
		 */
		(object?: any | null): void;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Argument} instead.
	 */
	interface IArgument {
		/**
		 * TODO
		 */
		v_boolean: boolean;
		/**
		 * TODO
		 */
		v_int8: number;
		/**
		 * TODO
		 */
		v_uint8: number;
		/**
		 * TODO
		 */
		v_int16: number;
		/**
		 * TODO
		 */
		v_uint16: number;
		/**
		 * TODO
		 */
		v_int32: number;
		/**
		 * TODO
		 */
		v_uint32: number;
		/**
		 * TODO
		 */
		v_int64: number;
		/**
		 * TODO
		 */
		v_uint64: number;
		/**
		 * TODO
		 */
		v_float: number;
		/**
		 * TODO
		 */
		v_double: number;
		/**
		 * TODO
		 */
		v_short: number;
		/**
		 * TODO
		 */
		v_ushort: number;
		/**
		 * TODO
		 */
		v_int: number;
		/**
		 * TODO
		 */
		v_uint: number;
		/**
		 * TODO
		 */
		v_long: number;
		/**
		 * TODO
		 */
		v_ulong: number;
		/**
		 * TODO
		 */
		v_ssize: number;
		/**
		 * TODO
		 */
		v_size: number;
		/**
		 * TODO
		 */
		v_string: string;
		/**
		 * TODO
		 */
		v_pointer: any;

		connect(signal: "notify::v_boolean", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_int8", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_uint8", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_int16", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_uint16", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_int32", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_uint32", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_int64", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_uint64", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_float", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_double", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_short", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_ushort", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_int", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_uint", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_long", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_ulong", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_ssize", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_size", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_string", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::v_pointer", callback: (owner: this, ...args: any) => void): number;

	}

	type ArgumentInitOptionsMixin = Pick<IArgument,
		"v_boolean" |
		"v_int8" |
		"v_uint8" |
		"v_int16" |
		"v_uint16" |
		"v_int32" |
		"v_uint32" |
		"v_int64" |
		"v_uint64" |
		"v_float" |
		"v_double" |
		"v_short" |
		"v_ushort" |
		"v_int" |
		"v_uint" |
		"v_long" |
		"v_ulong" |
		"v_ssize" |
		"v_size" |
		"v_string" |
		"v_pointer">;

	export interface ArgumentInitOptions extends ArgumentInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Argument} instead.
	 */
	type ArgumentMixin = IArgument;

	/**
	 * Stores an argument of varying type
	 */
	interface Argument extends ArgumentMixin {}

	class Argument {
		public constructor(options?: Partial<ArgumentInitOptions>);
	}


	/**
	 * Represents an argument.
	 */
	type ArgInfo = BaseInfo;

	/**
	 * Represents a callable, either #GIFunctionInfo, #GICallbackInfo or
	 * #GIVFuncInfo.
	 */
	type CallableInfo = BaseInfo;

	/**
	 * Represents a callback, eg arguments and return value.
	 */
	type CallbackInfo = BaseInfo;

	/**
	 * Represents a constant.
	 */
	type ConstantInfo = BaseInfo;

	/**
	 * Represents an enum or a flag.
	 */
	type EnumInfo = BaseInfo;

	/**
	 * Represents a field of a #GIStructInfo or a #GIUnionInfo.
	 */
	type FieldInfo = BaseInfo;

	/**
	 * Represents a function, eg arguments and return value.
	 */
	type FunctionInfo = BaseInfo;

	/**
	 * Represents an interface.
	 */
	type InterfaceInfo = BaseInfo;

	/**
	 * Represents an object.
	 */
	type ObjectInfo = BaseInfo;

	/**
	 * Represents a property of a #GIObjectInfo or a #GIInterfaceInfo.
	 */
	type PropertyInfo = BaseInfo;

	/**
	 * Represent a registered type.
	 */
	type RegisteredTypeInfo = BaseInfo;

	/**
	 * Represents a signal.
	 */
	type SignalInfo = BaseInfo;

	/**
	 * Represents a struct.
	 */
	type StructInfo = BaseInfo;

	/**
	 * Represents type information, direction, transfer etc.
	 */
	type TypeInfo = BaseInfo;

	/**
	 * Represents a union.
	 */
	type UnionInfo = BaseInfo;

	/**
	 * Represents a virtual function.
	 */
	type VFuncInfo = BaseInfo;

	/**
	 * Represents a enum value of a #GIEnumInfo.
	 */
	type ValueInfo = BaseInfo;

	/**
	 * Obtain the index of the user data argument. This is only valid
	 * for arguments which are callbacks.
	 * @param info a #GIArgInfo
	 * @returns index of the user data argument or -1 if there is none
	 */
	function arg_info_get_closure(info: ArgInfo): number;
	/**
	 * Obtains the index of the #GDestroyNotify argument. This is only valid
	 * for arguments which are callbacks.
	 * @param info a #GIArgInfo
	 * @returns index of the #GDestroyNotify argument or -1 if there is none
	 */
	function arg_info_get_destroy(info: ArgInfo): number;
	/**
	 * Obtain the direction of the argument. Check #GIDirection for possible
	 * direction values.
	 * @param info a #GIArgInfo
	 * @returns the direction
	 */
	function arg_info_get_direction(info: ArgInfo): Direction;
	/**
	 * Obtain the ownership transfer for this argument.
	 * #GITransfer contains a list of possible values.
	 * @param info a #GIArgInfo
	 * @returns the transfer
	 */
	function arg_info_get_ownership_transfer(info: ArgInfo): Transfer;
	/**
	 * Obtain the scope type for this argument. The scope type explains
	 * how a callback is going to be invoked, most importantly when
	 * the resources required to invoke it can be freed.
	 * #GIScopeType contains a list of possible values.
	 * @param info a #GIArgInfo
	 * @returns the scope type
	 */
	function arg_info_get_scope(info: ArgInfo): ScopeType;
	/**
	 * Obtain the type information for #info.
	 * @param info a #GIArgInfo
	 * @returns the #GITypeInfo holding the type
	 *   information for #info, free it with {@link G.base_info_unref}
	 *   when done.
	 */
	function arg_info_get_type(info: ArgInfo): TypeInfo;
	/**
	 * Obtain if the argument is a pointer to a struct or object that will
	 * receive an output of a function.  The default assumption for
	 * %GI_DIRECTION_OUT arguments which have allocation is that the
	 * callee allocates; if this is %TRUE, then the caller must allocate.
	 * @param info a #GIArgInfo
	 * @returns %TRUE if caller is required to have allocated the argument
	 */
	function arg_info_is_caller_allocates(info: ArgInfo): boolean;
	/**
	 * Obtain if the argument is optional.  For 'out' arguments this means
	 * that you can pass %NULL in order to ignore the result.
	 * @param info a #GIArgInfo
	 * @returns %TRUE if it is an optional argument
	 */
	function arg_info_is_optional(info: ArgInfo): boolean;
	/**
	 * Obtain if the argument is a return value. It can either be a
	 * parameter or a return value.
	 * @param info a #GIArgInfo
	 * @returns %TRUE if it is a return value
	 */
	function arg_info_is_return_value(info: ArgInfo): boolean;
	/**
	 * Obtain if an argument is only useful in C.
	 * @param info a #GIArgInfo
	 * @returns %TRUE if argument is only useful in C.
	 */
	function arg_info_is_skip(info: ArgInfo): boolean;
	/**
	 * Obtain information about a the type of given argument #info; this
	 * function is a variant of {@link G.arg_info_get_type} designed for stack
	 * allocation.
	 * 
	 * The initialized #type must not be referenced after #info is deallocated.
	 * @param info a #GIArgInfo
	 * @returns Initialized with information about type of #info
	 */
	function arg_info_load_type(info: ArgInfo): TypeInfo;
	/**
	 * Obtain if the type of the argument includes the possibility of %NULL.
	 * For 'in' values this means that %NULL is a valid value.  For 'out'
	 * values, this means that %NULL may be returned.
	 * 
	 * See also {@link G.arg_info_is_optional}.
	 * @param info a #GIArgInfo
	 * @returns %TRUE if the value may be %NULL
	 */
	function arg_info_may_be_null(info: ArgInfo): boolean;
	/**
	 * TODO
	 * @param info a #GICallableInfo
	 * @returns %TRUE if this #GICallableInfo can throw a #GError
	 */
	function callable_info_can_throw_gerror(info: CallableInfo): boolean;
	/**
	 * Obtain information about a particular argument of this callable.
	 * @param info a #GICallableInfo
	 * @param n the argument index to fetch
	 * @returns the #GIArgInfo. Free it with
	 * {@link G.base_info_unref} when done.
	 */
	function callable_info_get_arg(info: CallableInfo, n: number): ArgInfo;
	/**
	 * See whether the caller owns the return value of this callable.
	 * #GITransfer contains a list of possible transfer values.
	 * @param info a #GICallableInfo
	 * @returns the transfer mode for the return value of the callable
	 */
	function callable_info_get_caller_owns(info: CallableInfo): Transfer;
	/**
	 * Obtains the ownership transfer for the instance argument.
	 * #GITransfer contains a list of possible transfer values.
	 * @param info a #GICallableInfo
	 * @returns the transfer mode of the instance argument
	 */
	function callable_info_get_instance_ownership_transfer(info: CallableInfo): Transfer;
	/**
	 * Obtain the number of arguments (both IN and OUT) for this callable.
	 * @param info a #GICallableInfo
	 * @returns The number of arguments this callable expects.
	 */
	function callable_info_get_n_args(info: CallableInfo): number;
	/**
	 * Retrieve an arbitrary attribute associated with the return value.
	 * @param info a #GICallableInfo
	 * @param name a freeform string naming an attribute
	 * @returns The value of the attribute, or %NULL if no such attribute exists
	 */
	function callable_info_get_return_attribute(info: CallableInfo, name: string): string;
	/**
	 * Obtain the return type of a callable item as a #GITypeInfo.
	 * @param info a #GICallableInfo
	 * @returns the #GITypeInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function callable_info_get_return_type(info: CallableInfo): TypeInfo;
	/**
	 * TODO
	 * @param info TODO
	 * @param _function TODO
	 * @param in_args TODO
	 * @param out_args TODO
	 * @param return_value TODO
	 * @param is_method TODO
	 * @param _throws TODO
	 * @returns 
	 */
	function callable_info_invoke(info: CallableInfo, _function: any | null, in_args: Argument[], out_args: Argument[], return_value: Argument, is_method: boolean, _throws: boolean): boolean;
	/**
	 * Determines if the callable info is a method. For #GIVFuncInfo<!-- -->s,
	 * #GICallbackInfo<!-- -->s, and #GISignalInfo<!-- -->s,
	 * this is always true. Otherwise, this looks at the %GI_FUNCTION_IS_METHOD
	 * flag on the #GIFunctionInfo.
	 * 
	 * Concretely, this function returns whether {@link G.callable_info_get_n_args}
	 * matches the number of arguments in the raw C method. For methods, there
	 * is one more C argument than is exposed by introspection: the "self"
	 * or "this" object.
	 * @param info a #GICallableInfo
	 * @returns %TRUE if #info is a method, %FALSE otherwise
	 */
	function callable_info_is_method(info: CallableInfo): boolean;
	/**
	 * Iterate over all attributes associated with the return value.  The
	 * iterator structure is typically stack allocated, and must have its
	 * first member initialized to %NULL.
	 * 
	 * Both the #name and #value should be treated as constants
	 * and must not be freed.
	 * 
	 * See {@link G.base_info_iterate_attributes} for an example of how to use a
	 * similar API.
	 * @param info a #GICallableInfo
	 * @returns %TRUE if there are more attributes
	 * 
	 * Returned name, must not be freed
	 * 
	 * Returned name, must not be freed
	 */
	function callable_info_iterate_return_attributes(info: CallableInfo): [ boolean, string, string ];
	/**
	 * Obtain information about a particular argument of this callable; this
	 * function is a variant of {@link G.callable_info_get_arg} designed for stack
	 * allocation.
	 * 
	 * The initialized #arg must not be referenced after #info is deallocated.
	 * @param info a #GICallableInfo
	 * @param n the argument index to fetch
	 * @returns Initialize with argument number #n
	 */
	function callable_info_load_arg(info: CallableInfo, n: number): ArgInfo;
	/**
	 * Obtain information about a return value of callable; this
	 * function is a variant of {@link G.callable_info_get_return_type} designed for stack
	 * allocation.
	 * 
	 * The initialized #type must not be referenced after #info is deallocated.
	 * @param info a #GICallableInfo
	 * @returns Initialized with return type of #info
	 */
	function callable_info_load_return_type(info: CallableInfo): TypeInfo;
	/**
	 * See if a callable could return %NULL.
	 * @param info a #GICallableInfo
	 * @returns %TRUE if callable could return %NULL
	 */
	function callable_info_may_return_null(info: CallableInfo): boolean;
	/**
	 * See if a callable's return value is only useful in C.
	 * @param info a #GICallableInfo
	 * @returns %TRUE if return value is only useful in C.
	 */
	function callable_info_skip_return(info: CallableInfo): boolean;
	function cclosure_marshal_generic(closure: GObject.Closure, return_gvalue: GObject.Value, n_param_values: number, param_values: GObject.Value, invocation_hint: any | null, marshal_data: any | null): void;
	/**
	 * Free the value returned from {@link G.constant_info_get_value}.
	 * @param info a #GIConstantInfo
	 * @param value the argument
	 */
	function constant_info_free_value(info: ConstantInfo, value: Argument): void;
	/**
	 * Obtain the type of the constant as a #GITypeInfo.
	 * @param info a #GIConstantInfo
	 * @returns the #GITypeInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function constant_info_get_type(info: ConstantInfo): TypeInfo;
	/**
	 * Obtain the value associated with the #GIConstantInfo and store it in the
	 * #value parameter. #argument needs to be allocated before passing it in.
	 * The size of the constant value stored in #argument will be returned.
	 * Free the value with {@link G.constant_info_free_value}.
	 * @param info a #GIConstantInfo
	 * @returns size of the constant
	 * 
	 * an argument
	 */
	function constant_info_get_value(info: ConstantInfo): [ number, Argument ];
	/**
	 * Obtain the string form of the quark for the error domain associated with
	 * this enum, if any.
	 * @param info a #GIEnumInfo
	 * @returns the string form of the error domain associated
	 * with this enum, or %NULL.
	 */
	function enum_info_get_error_domain(info: EnumInfo): string;
	/**
	 * Obtain an enum type method at index #n.
	 * @param info a #GIEnumInfo
	 * @param n index of method to get
	 * @returns the #GIFunctionInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function enum_info_get_method(info: EnumInfo, n: number): FunctionInfo;
	/**
	 * Obtain the number of methods that this enum type has.
	 * @param info a #GIEnumInfo
	 * @returns number of methods
	 */
	function enum_info_get_n_methods(info: EnumInfo): number;
	/**
	 * Obtain the number of values this enumeration contains.
	 * @param info a #GIEnumInfo
	 * @returns the number of enumeration values
	 */
	function enum_info_get_n_values(info: EnumInfo): number;
	/**
	 * Obtain the tag of the type used for the enum in the C ABI. This will
	 * will be a signed or unsigned integral type.
	 * 
	 * Note that in the current implementation the width of the type is
	 * computed correctly, but the signed or unsigned nature of the type
	 * may not match the sign of the type used by the C compiler.
	 * @param info a #GIEnumInfo
	 * @returns the storage type for the enumeration
	 */
	function enum_info_get_storage_type(info: EnumInfo): TypeTag;
	/**
	 * Obtain a value for this enumeration.
	 * @param info a #GIEnumInfo
	 * @param n index of value to fetch
	 * @returns the enumeration value or %NULL if type tag is wrong,
	 * free the struct with {@link G.base_info_unref} when done.
	 */
	function enum_info_get_value(info: EnumInfo, n: number): ValueInfo;
	/**
	 * Reads a field identified by a #GIFieldInfo from a C structure or
	 * union.  This only handles fields of simple C types. It will fail
	 * for a field of a composite type like a nested structure or union
	 * even if that is actually readable.
	 * @param field_info a #GIFieldInfo
	 * @param mem pointer to a block of memory representing a C structure or union
	 * @param value a #GIArgument into which to store the value retrieved
	 * @returns %TRUE if reading the field succeeded, otherwise %FALSE
	 */
	function field_info_get_field(field_info: FieldInfo, mem: any | null, value: Argument): boolean;
	/**
	 * Obtain the flags for this #GIFieldInfo. See #GIFieldInfoFlags for possible
	 * flag values.
	 * @param info a #GIFieldInfo
	 * @returns the flags
	 */
	function field_info_get_flags(info: FieldInfo): FieldInfoFlags;
	/**
	 * Obtain the offset in bytes of the field member, this is relative
	 * to the beginning of the struct or union.
	 * @param info a #GIFieldInfo
	 * @returns the field offset
	 */
	function field_info_get_offset(info: FieldInfo): number;
	/**
	 * Obtain the size in bits of the field member, this is how
	 * much space you need to allocate to store the field.
	 * @param info a #GIFieldInfo
	 * @returns the field size
	 */
	function field_info_get_size(info: FieldInfo): number;
	/**
	 * Obtain the type of a field as a #GITypeInfo.
	 * @param info a #GIFieldInfo
	 * @returns the #GITypeInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function field_info_get_type(info: FieldInfo): TypeInfo;
	/**
	 * Writes a field identified by a #GIFieldInfo to a C structure or
	 * union.  This only handles fields of simple C types. It will fail
	 * for a field of a composite type like a nested structure or union
	 * even if that is actually writable. Note also that that it will refuse
	 * to write fields where memory management would by required. A field
	 * with a type such as 'char *' must be set with a setter function.
	 * @param field_info a #GIFieldInfo
	 * @param mem pointer to a block of memory representing a C structure or union
	 * @param value a #GIArgument holding the value to store
	 * @returns %TRUE if writing the field succeeded, otherwise %FALSE
	 */
	function field_info_set_field(field_info: FieldInfo, mem: any | null, value: Argument): boolean;
	/**
	 * Obtain the #GIFunctionInfoFlags for the #info.
	 * @param info a #GIFunctionInfo
	 * @returns the flags
	 */
	function function_info_get_flags(info: FunctionInfo): FunctionInfoFlags;
	/**
	 * Obtain the property associated with this #GIFunctionInfo.
	 * Only #GIFunctionInfo with the flag %GI_FUNCTION_IS_GETTER or
	 * %GI_FUNCTION_IS_SETTER have a property set. For other cases,
	 * %NULL will be returned.
	 * @param info a #GIFunctionInfo
	 * @returns the property or %NULL if not set. Free it with
	 * {@link G.base_info_unref} when done.
	 */
	function function_info_get_property(info: FunctionInfo): PropertyInfo;
	/**
	 * Obtain the symbol of the function. The symbol is the name of the
	 * exported function, suitable to be used as an argument to
	 * {@link GModule.symbol}.
	 * @param info a #GIFunctionInfo
	 * @returns the symbol
	 */
	function function_info_get_symbol(info: FunctionInfo): string;
	/**
	 * Obtain the virtual function associated with this #GIFunctionInfo.
	 * Only #GIFunctionInfo with the flag %GI_FUNCTION_WRAPS_VFUNC has
	 * a virtual function set. For other cases, %NULL will be returned.
	 * @param info a #GIFunctionInfo
	 * @returns the virtual function or %NULL if not set.
	 * Free it by calling {@link G.base_info_unref} when done.
	 */
	function function_info_get_vfunc(info: FunctionInfo): VFuncInfo;
	/**
	 * Invokes the function described in #info with the given
	 * arguments. Note that inout parameters must appear in both
	 * argument lists. This function uses dlsym() to obtain a pointer
	 * to the function, so the library or shared object containing the
	 * described function must either be linked to the caller, or must
	 * have been g_module_symbol()<!-- -->ed before calling this function.
	 * @param info a #GIFunctionInfo describing the function to invoke
	 * @param in_args an array of #GIArgument<!-- -->s, one for each in
	 *    parameter of #info. If there are no in parameter, #in_args
	 *    can be %NULL
	 * @param out_args an array of #GIArgument<!-- -->s, one for each out
	 *    parameter of #info. If there are no out parameters, #out_args
	 *    may be %NULL
	 * @param return_value return location for the return value of the
	 *    function.
	 * @returns %TRUE if the function has been invoked, %FALSE if an
	 *   error occurred.
	 */
	function function_info_invoke(info: FunctionInfo, in_args: Argument[], out_args: Argument[], return_value: Argument): boolean;
	/**
	 * Returns the major version number of the girepository library.
	 * (e.g. in version 1.58.2 this is 1.)
	 * @returns the major version number of the girepository library
	 */
	function get_major_version(): number;
	/**
	 * Returns the micro version number of the girepository library.
	 * (e.g. in version 1.58.2 this is 2.)
	 * @returns the micro version number of the girepository library
	 */
	function get_micro_version(): number;
	/**
	 * Returns the minor version number of the girepository library.
	 * (e.g. in version 1.58.2 this is 58.)
	 * @returns the minor version number of the girepository library
	 */
	function get_minor_version(): number;
	/**
	 * TODO
	 * @param type TODO
	 * @param container TODO
	 * @param typelib TODO
	 * @param offset TODO
	 * @returns TODO
	 */
	function info_new(type: InfoType, container: BaseInfo, typelib: Typelib, offset: number): BaseInfo;
	/**
	 * Obtain a string representation of #type
	 * @param type the info type
	 * @returns the string
	 */
	function info_type_to_string(type: InfoType): string;
	/**
	 * Obtain a method of the interface type given a #name. %NULL will be
	 * returned if there's no method available with that name.
	 * @param info a #GIInterfaceInfo
	 * @param name name of method to obtain
	 * @returns the #GIFunctionInfo or %NULL if none found.
	 * Free the struct by calling {@link G.base_info_unref} when done.
	 */
	function interface_info_find_method(info: InterfaceInfo, name: string): FunctionInfo;
	/**
	 * TODO
	 * @param info a #GIInterfaceInfo
	 * @param name Name of signal
	 * @returns Info for the signal with name #name in #info, or
	 * %NULL on failure.
	 */
	function interface_info_find_signal(info: InterfaceInfo, name: string): SignalInfo;
	/**
	 * Locate a virtual function slot with name #name. See the documentation
	 * for {@link GObject.info_find_vfunc} for more information on virtuals.
	 * @param info a #GIInterfaceInfo
	 * @param name The name of a virtual function to find.
	 * @returns the #GIVFuncInfo, or %NULL. Free it with
	 * {@link G.base_info_unref} when done.
	 */
	function interface_info_find_vfunc(info: InterfaceInfo, name: string): VFuncInfo;
	/**
	 * Obtain an interface type constant at index #n.
	 * @param info a #GIInterfaceInfo
	 * @param n index of constant to get
	 * @returns the #GIConstantInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function interface_info_get_constant(info: InterfaceInfo, n: number): ConstantInfo;
	/**
	 * Returns the layout C structure associated with this #GInterface.
	 * @param info a #GIInterfaceInfo
	 * @returns the #GIStructInfo or %NULL. Free it with
	 * {@link G.base_info_unref} when done.
	 */
	function interface_info_get_iface_struct(info: InterfaceInfo): StructInfo;
	/**
	 * Obtain an interface type method at index #n.
	 * @param info a #GIInterfaceInfo
	 * @param n index of method to get
	 * @returns the #GIFunctionInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function interface_info_get_method(info: InterfaceInfo, n: number): FunctionInfo;
	/**
	 * Obtain the number of constants that this interface type has.
	 * @param info a #GIInterfaceInfo
	 * @returns number of constants
	 */
	function interface_info_get_n_constants(info: InterfaceInfo): number;
	/**
	 * Obtain the number of methods that this interface type has.
	 * @param info a #GIInterfaceInfo
	 * @returns number of methods
	 */
	function interface_info_get_n_methods(info: InterfaceInfo): number;
	/**
	 * Obtain the number of prerequisites for this interface type.
	 * A prerequisites is another interface that needs to be implemented for
	 * interface, similar to an base class for GObjects.
	 * @param info a #GIInterfaceInfo
	 * @returns number of prerequisites
	 */
	function interface_info_get_n_prerequisites(info: InterfaceInfo): number;
	/**
	 * Obtain the number of properties that this interface type has.
	 * @param info a #GIInterfaceInfo
	 * @returns number of properties
	 */
	function interface_info_get_n_properties(info: InterfaceInfo): number;
	/**
	 * Obtain the number of signals that this interface type has.
	 * @param info a #GIInterfaceInfo
	 * @returns number of signals
	 */
	function interface_info_get_n_signals(info: InterfaceInfo): number;
	/**
	 * Obtain the number of virtual functions that this interface type has.
	 * @param info a #GIInterfaceInfo
	 * @returns number of virtual functions
	 */
	function interface_info_get_n_vfuncs(info: InterfaceInfo): number;
	/**
	 * Obtain an interface type prerequisites index #n.
	 * @param info a #GIInterfaceInfo
	 * @param n index of prerequisites to get
	 * @returns the prerequisites as a #GIBaseInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function interface_info_get_prerequisite(info: InterfaceInfo, n: number): BaseInfo;
	/**
	 * Obtain an interface type property at index #n.
	 * @param info a #GIInterfaceInfo
	 * @param n index of property to get
	 * @returns the #GIPropertyInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function interface_info_get_property(info: InterfaceInfo, n: number): PropertyInfo;
	/**
	 * Obtain an interface type signal at index #n.
	 * @param info a #GIInterfaceInfo
	 * @param n index of signal to get
	 * @returns the #GISignalInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function interface_info_get_signal(info: InterfaceInfo, n: number): SignalInfo;
	/**
	 * Obtain an interface type virtual function at index #n.
	 * @param info a #GIInterfaceInfo
	 * @param n index of virtual function to get
	 * @returns the #GIVFuncInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function interface_info_get_vfunc(info: InterfaceInfo, n: number): VFuncInfo;
	/**
	 * TODO
	 * @returns TODO
	 */
	function invoke_error_quark(): GLib.Quark;
	/**
	 * Obtain a method of the object type given a #name. %NULL will be
	 * returned if there's no method available with that name.
	 * @param info a #GIObjectInfo
	 * @param name name of method to obtain
	 * @returns the #GIFunctionInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_find_method(info: ObjectInfo, name: string): FunctionInfo | null;
	/**
	 * Obtain a method of the object given a #name, searching both the
	 * object #info and any interfaces it implements.  %NULL will be
	 * returned if there's no method available with that name.
	 * 
	 * Note that this function does *not* search parent classes; you will have
	 * to chain up if that's desired.
	 * @param info a #GIObjectInfo
	 * @param name name of method to obtain
	 * @returns the #GIFunctionInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 * 
	 * The implementor of the interface
	 */
	function object_info_find_method_using_interfaces(info: ObjectInfo, name: string): [ FunctionInfo | null, ObjectInfo ];
	/**
	 * TODO
	 * @param info a #GIObjectInfo
	 * @param name Name of signal
	 * @returns Info for the signal with name #name in #info, or %NULL on failure.
	 */
	function object_info_find_signal(info: ObjectInfo, name: string): SignalInfo | null;
	/**
	 * Locate a virtual function slot with name #name. Note that the namespace
	 * for virtuals is distinct from that of methods; there may or may not be
	 * a concrete method associated for a virtual. If there is one, it may
	 * be retrieved using {@link G.vfunc_info_get_invoker}, otherwise %NULL will be
	 * returned.
	 * See the documentation for g_vfunc_info_get_invoker() for more
	 * information on invoking virtuals.
	 * @param info a #GIObjectInfo
	 * @param name The name of a virtual function to find.
	 * @returns the #GIVFuncInfo, or %NULL. Free it with
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_find_vfunc(info: ObjectInfo, name: string): VFuncInfo | null;
	/**
	 * Locate a virtual function slot with name #name, searching both the object
	 * #info and any interfaces it implements.  Note that the namespace for
	 * virtuals is distinct from that of methods; there may or may not be a
	 * concrete method associated for a virtual. If there is one, it may be
	 * retrieved using {@link G.vfunc_info_get_invoker}, otherwise %NULL will be
	 * returned.
	 * 
	 * Note that this function does *not* search parent classes; you will have
	 * to chain up if that's desired.
	 * @param info a #GIObjectInfo
	 * @param name name of vfunc to obtain
	 * @returns the #GIVFuncInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 * 
	 * The implementor of the interface
	 */
	function object_info_find_vfunc_using_interfaces(info: ObjectInfo, name: string): [ VFuncInfo | null, ObjectInfo ];
	/**
	 * Obtain if the object type is an abstract type, eg if it cannot be
	 * instantiated
	 * @param info a #GIObjectInfo
	 * @returns %TRUE if the object type is abstract
	 */
	function object_info_get_abstract(info: ObjectInfo): boolean;
	/**
	 * Every #GObject has two structures; an instance structure and a class
	 * structure.  This function returns the metadata for the class structure.
	 * @param info a #GIObjectInfo
	 * @returns the #GIStructInfo or %NULL. Free with
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_get_class_struct(info: ObjectInfo): StructInfo | null;
	/**
	 * Obtain an object type constant at index #n.
	 * @param info a #GIObjectInfo
	 * @param n index of constant to get
	 * @returns the #GIConstantInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_get_constant(info: ObjectInfo, n: number): ConstantInfo;
	/**
	 * Obtain an object type field at index #n.
	 * @param info a #GIObjectInfo
	 * @param n index of field to get
	 * @returns the #GIFieldInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_get_field(info: ObjectInfo, n: number): FieldInfo;
	/**
	 * Checks whether the object type is a final type, i.e. if it cannot
	 * be derived
	 * @param info a #GIObjectInfo
	 * @returns %TRUE if the object type is final
	 */
	function object_info_get_final(info: ObjectInfo): boolean;
	/**
	 * Obtain if the object type is of a fundamental type which is not
	 * G_TYPE_OBJECT. This is mostly for supporting GstMiniObject.
	 * @param info a #GIObjectInfo
	 * @returns %TRUE if the object type is a fundamental type
	 */
	function object_info_get_fundamental(info: ObjectInfo): boolean;
	/**
	 * Obtain the symbol name of the function that should be called to convert
	 * an object instance pointer of this object type to a GValue.
	 * I's mainly used fundamental types. The type signature for the symbol
	 * is %GIObjectInfoGetValueFunction, to fetch the function pointer
	 * see {@link GObject.info_get_get_value_function}.
	 * @param info a #GIObjectInfo
	 * @returns the symbol or %NULL
	 */
	function object_info_get_get_value_function(info: ObjectInfo): string | null;
	/**
	 * Obtain a pointer to a function which can be used to
	 * extract an instance of this object type out of a GValue.
	 * This takes derivation into account and will reversely traverse
	 * the base classes of this type, starting at the top type.
	 * @param info a #GIObjectInfo
	 * @returns the function pointer or %NULL
	 */
	function object_info_get_get_value_function_pointer(info: ObjectInfo): ObjectInfoGetValueFunction | null;
	/**
	 * Obtain an object type interface at index #n.
	 * @param info a #GIObjectInfo
	 * @param n index of interface to get
	 * @returns the #GIInterfaceInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_get_interface(info: ObjectInfo, n: number): InterfaceInfo;
	/**
	 * Obtain an object type method at index #n.
	 * @param info a #GIObjectInfo
	 * @param n index of method to get
	 * @returns the #GIFunctionInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_get_method(info: ObjectInfo, n: number): FunctionInfo;
	/**
	 * Obtain the number of constants that this object type has.
	 * @param info a #GIObjectInfo
	 * @returns number of constants
	 */
	function object_info_get_n_constants(info: ObjectInfo): number;
	/**
	 * Obtain the number of fields that this object type has.
	 * @param info a #GIObjectInfo
	 * @returns number of fields
	 */
	function object_info_get_n_fields(info: ObjectInfo): number;
	/**
	 * Obtain the number of interfaces that this object type has.
	 * @param info a #GIObjectInfo
	 * @returns number of interfaces
	 */
	function object_info_get_n_interfaces(info: ObjectInfo): number;
	/**
	 * Obtain the number of methods that this object type has.
	 * @param info a #GIObjectInfo
	 * @returns number of methods
	 */
	function object_info_get_n_methods(info: ObjectInfo): number;
	/**
	 * Obtain the number of properties that this object type has.
	 * @param info a #GIObjectInfo
	 * @returns number of properties
	 */
	function object_info_get_n_properties(info: ObjectInfo): number;
	/**
	 * Obtain the number of signals that this object type has.
	 * @param info a #GIObjectInfo
	 * @returns number of signals
	 */
	function object_info_get_n_signals(info: ObjectInfo): number;
	/**
	 * Obtain the number of virtual functions that this object type has.
	 * @param info a #GIObjectInfo
	 * @returns number of virtual functions
	 */
	function object_info_get_n_vfuncs(info: ObjectInfo): number;
	/**
	 * Obtain the parent of the object type.
	 * @param info a #GIObjectInfo
	 * @returns the #GIObjectInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_get_parent(info: ObjectInfo): ObjectInfo | null;
	/**
	 * Obtain an object type property at index #n.
	 * @param info a #GIObjectInfo
	 * @param n index of property to get
	 * @returns the #GIPropertyInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_get_property(info: ObjectInfo, n: number): PropertyInfo;
	/**
	 * Obtain the symbol name of the function that should be called to ref this
	 * object type. It's mainly used fundamental types. The type signature for
	 * the symbol is %GIObjectInfoRefFunction, to fetch the function pointer
	 * see {@link GObject.info_get_ref_function}.
	 * @param info a #GIObjectInfo
	 * @returns the symbol or %NULL
	 */
	function object_info_get_ref_function(info: ObjectInfo): string | null;
	/**
	 * Obtain a pointer to a function which can be used to
	 * increase the reference count an instance of this object type.
	 * This takes derivation into account and will reversely traverse
	 * the base classes of this type, starting at the top type.
	 * @param info a #GIObjectInfo
	 * @returns the function pointer or %NULL
	 */
	function object_info_get_ref_function_pointer(info: ObjectInfo): ObjectInfoRefFunction | null;
	/**
	 * Obtain the symbol name of the function that should be called to convert
	 * set a GValue giving an object instance pointer of this object type.
	 * I's mainly used fundamental types. The type signature for the symbol
	 * is %GIObjectInfoSetValueFunction, to fetch the function pointer
	 * see {@link GObject.info_get_set_value_function}.
	 * @param info a #GIObjectInfo
	 * @returns the symbol or %NULL
	 */
	function object_info_get_set_value_function(info: ObjectInfo): string | null;
	/**
	 * Obtain a pointer to a function which can be used to
	 * set a GValue given an instance of this object type.
	 * This takes derivation into account and will reversely traverse
	 * the base classes of this type, starting at the top type.
	 * @param info a #GIObjectInfo
	 * @returns the function pointer or %NULL
	 */
	function object_info_get_set_value_function_pointer(info: ObjectInfo): ObjectInfoSetValueFunction | null;
	/**
	 * Obtain an object type signal at index #n.
	 * @param info a #GIObjectInfo
	 * @param n index of signal to get
	 * @returns the #GISignalInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_get_signal(info: ObjectInfo, n: number): SignalInfo;
	/**
	 * Obtain the function which when called will return the GType
	 * function for which this object type is registered.
	 * @param info a #GIObjectInfo
	 * @returns the type init function
	 */
	function object_info_get_type_init(info: ObjectInfo): string;
	/**
	 * Obtain the name of the objects class/type.
	 * @param info a #GIObjectInfo
	 * @returns name of the objects type
	 */
	function object_info_get_type_name(info: ObjectInfo): string;
	/**
	 * Obtain the symbol name of the function that should be called to unref this
	 * object type. It's mainly used fundamental types. The type signature for
	 * the symbol is %GIObjectInfoUnrefFunction, to fetch the function pointer
	 * see {@link GObject.info_get_unref_function}.
	 * @param info a #GIObjectInfo
	 * @returns the symbol or %NULL
	 */
	function object_info_get_unref_function(info: ObjectInfo): string | null;
	/**
	 * Obtain a pointer to a function which can be used to
	 * decrease the reference count an instance of this object type.
	 * This takes derivation into account and will reversely traverse
	 * the base classes of this type, starting at the top type.
	 * @param info a #GIObjectInfo
	 * @returns the function pointer or %NULL
	 */
	function object_info_get_unref_function_pointer(info: ObjectInfo): ObjectInfoUnrefFunction | null;
	/**
	 * Obtain an object type virtual function at index #n.
	 * @param info a #GIObjectInfo
	 * @param n index of virtual function to get
	 * @returns the #GIVFuncInfo. Free the struct by calling
	 * {@link G.base_info_unref} when done.
	 */
	function object_info_get_vfunc(info: ObjectInfo, n: number): VFuncInfo;
	/**
	 * Obtain the flags for this property info. See #GParamFlags for
	 * more information about possible flag values.
	 * @param info a #GIPropertyInfo
	 * @returns the flags
	 */
	function property_info_get_flags(info: PropertyInfo): GObject.ParamFlags;
	/**
	 * Obtains the getter function associated with this #GIPropertyInfo.
	 * 
	 * The setter is only available for %G_PARAM_READABLE properties.
	 * @param info a #GIPropertyInfo
	 * @returns the function info or %NULL if not set.
	 *   Free it with {@link G.base_info_unref} when done.
	 */
	function property_info_get_getter(info: PropertyInfo): FunctionInfo | null;
	/**
	 * Obtain the ownership transfer for this property. See #GITransfer for more
	 * information about transfer values.
	 * @param info a #GIPropertyInfo
	 * @returns the transfer
	 */
	function property_info_get_ownership_transfer(info: PropertyInfo): Transfer;
	/**
	 * Obtains the setter function associated with this #GIPropertyInfo.
	 * 
	 * The setter is only available for %G_PARAM_WRITABLE properties that
	 * are also not %G_PARAM_CONSTRUCT_ONLY.
	 * @param info a #GIPropertyInfo
	 * @returns the function info or %NULL if not set.
	 *   Free it with {@link G.base_info_unref} when done.
	 */
	function property_info_get_setter(info: PropertyInfo): FunctionInfo | null;
	/**
	 * Obtain the type information for the property #info.
	 * @param info a #GIPropertyInfo
	 * @returns the #GITypeInfo, free it with
	 * {@link G.base_info_unref} when done.
	 */
	function property_info_get_type(info: PropertyInfo): TypeInfo;
	/**
	 * Obtain the #GType for this registered type or G_TYPE_NONE which a special meaning.
	 * It means that either there is no type information associated with this #info or
	 * that the shared library which provides the type_init function for this
	 * #info cannot be called.
	 * @param info a #GIRegisteredTypeInfo
	 * @returns the #GType.
	 */
	function registered_type_info_get_g_type(info: RegisteredTypeInfo): GObject.Type;
	/**
	 * Obtain the type init function for #info. The type init function is the
	 * function which will register the GType within the GObject type system.
	 * Usually this is not called by langauge bindings or applications, use
	 * {@link G.registered_type_info_get_g_type} directly instead.
	 * @param info a #GIRegisteredTypeInfo
	 * @returns the symbol name of the type init function, suitable for
	 * passing into {@link GModule.symbol}.
	 */
	function registered_type_info_get_type_init(info: RegisteredTypeInfo): string;
	/**
	 * Obtain the type name of the struct within the GObject type system.
	 * This type can be passed to {@link G.type_name} to get a #GType.
	 * @param info a #GIRegisteredTypeInfo
	 * @returns the type name
	 */
	function registered_type_info_get_type_name(info: RegisteredTypeInfo): string;
	/**
	 * Obtain the class closure for this signal if one is set. The class
	 * closure is a virtual function on the type that the signal belongs to.
	 * If the signal lacks a closure %NULL will be returned.
	 * @param info a #GISignalInfo
	 * @returns the class closure or %NULL
	 */
	function signal_info_get_class_closure(info: SignalInfo): VFuncInfo;
	/**
	 * Obtain the flags for this signal info. See #GSignalFlags for
	 * more information about possible flag values.
	 * @param info a #GISignalInfo
	 * @returns the flags
	 */
	function signal_info_get_flags(info: SignalInfo): GObject.SignalFlags;
	/**
	 * Obtain if the returning true in the signal handler will
	 * stop the emission of the signal.
	 * @param info a #GISignalInfo
	 * @returns %TRUE if returning true stops the signal emission
	 */
	function signal_info_true_stops_emit(info: SignalInfo): boolean;
	/**
	 * Obtain the type information for field named #name.
	 * @param info a #GIStructInfo
	 * @param name a field name
	 * @returns the #GIFieldInfo or %NULL if not found,
	 * free it with {@link G.base_info_unref} when done.
	 */
	function struct_info_find_field(info: StructInfo, name: string): FieldInfo;
	/**
	 * Obtain the type information for method named #name.
	 * @param info a #GIStructInfo
	 * @param name a method name
	 * @returns the #GIFunctionInfo, free it with {@link G.base_info_unref}
	 * when done.
	 */
	function struct_info_find_method(info: StructInfo, name: string): FunctionInfo;
	/**
	 * Obtain the required alignment of the structure.
	 * @param info a #GIStructInfo
	 * @returns required alignment in bytes
	 */
	function struct_info_get_alignment(info: StructInfo): number;
	/**
	 * Obtain the type information for field with specified index.
	 * @param info a #GIStructInfo
	 * @param n a field index
	 * @returns the #GIFieldInfo, free it with {@link G.base_info_unref}
	 * when done.
	 */
	function struct_info_get_field(info: StructInfo, n: number): FieldInfo;
	/**
	 * Obtain the type information for method with specified index.
	 * @param info a #GIStructInfo
	 * @param n a method index
	 * @returns the #GIFunctionInfo, free it with {@link G.base_info_unref}
	 * when done.
	 */
	function struct_info_get_method(info: StructInfo, n: number): FunctionInfo;
	/**
	 * Obtain the number of fields this structure has.
	 * @param info a #GIStructInfo
	 * @returns number of fields
	 */
	function struct_info_get_n_fields(info: StructInfo): number;
	/**
	 * Obtain the number of methods this structure has.
	 * @param info a #GIStructInfo
	 * @returns number of methods
	 */
	function struct_info_get_n_methods(info: StructInfo): number;
	/**
	 * Obtain the total size of the structure.
	 * @param info a #GIStructInfo
	 * @returns size of the structure in bytes
	 */
	function struct_info_get_size(info: StructInfo): number;
	/**
	 * TODO
	 * @param info TODO
	 * @returns TODO
	 */
	function struct_info_is_foreign(info: StructInfo): boolean;
	/**
	 * Return true if this structure represents the "class structure" for some
	 * #GObject or #GInterface.  This function is mainly useful to hide this kind of structure
	 * from generated public APIs.
	 * @param info a #GIStructInfo
	 * @returns %TRUE if this is a class struct, %FALSE otherwise
	 */
	function struct_info_is_gtype_struct(info: StructInfo): boolean;
	/**
	 * GLib data structures, such as #GList, #GSList, and #GHashTable, all store
	 * data pointers.
	 * In the case where the list or hash table is storing single types rather than
	 * structs, these data pointers may have values stuffed into them via macros
	 * such as %GPOINTER_TO_INT.
	 * 
	 * Use this function to ensure that all values are correctly extracted from
	 * stuffed pointers, regardless of the machine's architecture or endianness.
	 * 
	 * This function fills in the appropriate field of #arg with the value extracted
	 * from #hash_pointer, depending on the storage type of #info.
	 * @param info a #GITypeInfo
	 * @param hash_pointer A pointer, such as a #GHashTable data pointer
	 * @param arg A #GIArgument to fill in
	 */
	function type_info_argument_from_hash_pointer(info: TypeInfo, hash_pointer: any | null, arg: Argument): void;
	/**
	 * Obtain the fixed array size of the type. The type tag must be a
	 * #GI_TYPE_TAG_ARRAY or -1 will be returned.
	 * @param info a #GITypeInfo
	 * @returns the size or -1 if it's not an array
	 */
	function type_info_get_array_fixed_size(info: TypeInfo): number;
	/**
	 * Obtain the position of the argument which gives the array length of the type.
	 * The type tag must be a #GI_TYPE_TAG_ARRAY or -1 will be returned.
	 * @param info a #GITypeInfo
	 * @returns the array length, or -1 if the type is not an array
	 */
	function type_info_get_array_length(info: TypeInfo): number;
	/**
	 * Obtain the array type for this type. See #GIArrayType for a list of
	 * possible values. If the type tag of this type is not array, -1 will be
	 * returned.
	 * @param info a #GITypeInfo
	 * @returns the array type or -1
	 */
	function type_info_get_array_type(info: TypeInfo): ArrayType;
	/**
	 * For types which have #GI_TYPE_TAG_INTERFACE such as GObjects and boxed values,
	 * this function returns full information about the referenced type.  You can then
	 * inspect the type of the returned #GIBaseInfo to further query whether it is
	 * a concrete GObject, a GInterface, a structure, etc. using {@link G.base_info_get_type}.
	 * @param info a #GITypeInfo
	 * @returns the #GIBaseInfo, or %NULL. Free it with
	 * {@link G.base_info_unref} when done.
	 */
	function type_info_get_interface(info: TypeInfo): BaseInfo;
	/**
	 * Obtain the parameter type #n.
	 * @param info a #GITypeInfo
	 * @param n index of the parameter
	 * @returns the param type info
	 */
	function type_info_get_param_type(info: TypeInfo, n: number): TypeInfo;
	/**
	 * Obtain the type tag corresponding to the underlying storage type in C for
	 * the type.
	 * See #GITypeTag for a list of type tags.
	 * @param info a #GITypeInfo
	 * @returns the type tag
	 */
	function type_info_get_storage_type(info: TypeInfo): TypeTag;
	/**
	 * Obtain the type tag for the type. See #GITypeTag for a list
	 * of type tags.
	 * @param info a #GITypeInfo
	 * @returns the type tag
	 */
	function type_info_get_tag(info: TypeInfo): TypeTag;
	/**
	 * GLib data structures, such as #GList, #GSList, and #GHashTable, all store
	 * data pointers.
	 * In the case where the list or hash table is storing single types rather than
	 * structs, these data pointers may have values stuffed into them via macros
	 * such as %GPOINTER_TO_INT.
	 * 
	 * Use this function to ensure that all values are correctly stuffed into
	 * pointers, regardless of the machine's architecture or endianness.
	 * 
	 * This function returns a pointer stuffed with the appropriate field of #arg,
	 * depending on the storage type of #info.
	 * @param info a #GITypeInfo
	 * @param arg A #GIArgument with the value to stuff into a pointer
	 * @returns A stuffed pointer, that can be stored in a #GHashTable, for example
	 */
	function type_info_hash_pointer_from_argument(info: TypeInfo, arg: Argument): any | null;
	/**
	 * Obtain if the type is passed as a reference.
	 * 
	 * Note that the types of %GI_DIRECTION_OUT and %GI_DIRECTION_INOUT parameters
	 * will only be pointers if the underlying type being transferred is a pointer
	 * (i.e. only if the type of the C function’s formal parameter is a pointer to a
	 * pointer).
	 * @param info a #GITypeInfo
	 * @returns %TRUE if it is a pointer
	 */
	function type_info_is_pointer(info: TypeInfo): boolean;
	/**
	 * Obtain if the last element of the array is %NULL. The type tag must be a
	 * #GI_TYPE_TAG_ARRAY or %FALSE will be returned.
	 * @param info a #GITypeInfo
	 * @returns %TRUE if zero terminated
	 */
	function type_info_is_zero_terminated(info: TypeInfo): boolean;
	/**
	 * GLib data structures, such as #GList, #GSList, and #GHashTable, all store
	 * data pointers.
	 * In the case where the list or hash table is storing single types rather than
	 * structs, these data pointers may have values stuffed into them via macros
	 * such as %GPOINTER_TO_INT.
	 * 
	 * Use this function to ensure that all values are correctly extracted from
	 * stuffed pointers, regardless of the machine's architecture or endianness.
	 * 
	 * This function fills in the appropriate field of #arg with the value extracted
	 * from #hash_pointer, depending on #storage_type.
	 * @param storage_type a #GITypeTag obtained from {@link G.type_info_get_storage_type}
	 * @param hash_pointer A pointer, such as a #GHashTable data pointer
	 * @param arg A #GIArgument to fill in
	 */
	function type_tag_argument_from_hash_pointer(storage_type: TypeTag, hash_pointer: any | null, arg: Argument): void;
	/**
	 * GLib data structures, such as #GList, #GSList, and #GHashTable, all store
	 * data pointers.
	 * In the case where the list or hash table is storing single types rather than
	 * structs, these data pointers may have values stuffed into them via macros
	 * such as %GPOINTER_TO_INT.
	 * 
	 * Use this function to ensure that all values are correctly stuffed into
	 * pointers, regardless of the machine's architecture or endianness.
	 * 
	 * This function returns a pointer stuffed with the appropriate field of #arg,
	 * depending on #storage_type.
	 * @param storage_type a #GITypeTag obtained from {@link G.type_info_get_storage_type}
	 * @param arg A #GIArgument with the value to stuff into a pointer
	 * @returns A stuffed pointer, that can be stored in a #GHashTable, for example
	 */
	function type_tag_hash_pointer_from_argument(storage_type: TypeTag, arg: Argument): any | null;
	/**
	 * Obtain a string representation of #type
	 * @param type the type_tag
	 * @returns the string
	 */
	function type_tag_to_string(type: TypeTag): string;
	/**
	 * Obtain the type information for method named #name.
	 * @param info a #GIUnionInfo
	 * @param name a method name
	 * @returns the #GIFunctionInfo, free it with {@link G.base_info_unref}
	 * when done.
	 */
	function union_info_find_method(info: UnionInfo, name: string): FunctionInfo;
	/**
	 * Obtain the required alignment of the union.
	 * @param info a #GIUnionInfo
	 * @returns required alignment in bytes
	 */
	function union_info_get_alignment(info: UnionInfo): number;
	/**
	 * Obtain discriminator value assigned for n-th union field, i.e. n-th
	 * union field is the active one if discriminator contains this
	 * constant.
	 * @param info a #GIUnionInfo
	 * @param n a union field index
	 * @returns the #GIConstantInfo, free it with {@link G.base_info_unref}
	 * when done.
	 */
	function union_info_get_discriminator(info: UnionInfo, n: number): ConstantInfo;
	/**
	 * Returns offset of the discriminator field in the structure.
	 * @param info a #GIUnionInfo
	 * @returns offset in bytes of the discriminator
	 */
	function union_info_get_discriminator_offset(info: UnionInfo): number;
	/**
	 * Obtain the type information of the union discriminator.
	 * @param info a #GIUnionInfo
	 * @returns the #GITypeInfo, free it with {@link G.base_info_unref}
	 * when done.
	 */
	function union_info_get_discriminator_type(info: UnionInfo): TypeInfo;
	/**
	 * Obtain the type information for field with specified index.
	 * @param info a #GIUnionInfo
	 * @param n a field index
	 * @returns the #GIFieldInfo, free it with {@link G.base_info_unref}
	 * when done.
	 */
	function union_info_get_field(info: UnionInfo, n: number): FieldInfo;
	/**
	 * Obtain the type information for method with specified index.
	 * @param info a #GIUnionInfo
	 * @param n a method index
	 * @returns the #GIFunctionInfo, free it with {@link G.base_info_unref}
	 * when done.
	 */
	function union_info_get_method(info: UnionInfo, n: number): FunctionInfo;
	/**
	 * Obtain the number of fields this union has.
	 * @param info a #GIUnionInfo
	 * @returns number of fields
	 */
	function union_info_get_n_fields(info: UnionInfo): number;
	/**
	 * Obtain the number of methods this union has.
	 * @param info a #GIUnionInfo
	 * @returns number of methods
	 */
	function union_info_get_n_methods(info: UnionInfo): number;
	/**
	 * Obtain the total size of the union.
	 * @param info a #GIUnionInfo
	 * @returns size of the union in bytes
	 */
	function union_info_get_size(info: UnionInfo): number;
	/**
	 * Return true if this union contains discriminator field.
	 * @param info a #GIUnionInfo
	 * @returns %TRUE if this is a discriminated union, %FALSE otherwise
	 */
	function union_info_is_discriminated(info: UnionInfo): boolean;
	/**
	 * Obtain the enumeration value of the #GIValueInfo.
	 * @param info a #GIValueInfo
	 * @returns the enumeration value. This will always be representable
	 *   as a 32-bit signed or unsigned value. The use of gint64 as the
	 *   return type is to allow both.
	 */
	function value_info_get_value(info: ValueInfo): number;
	/**
	 * This method will look up where inside the type struct of #implementor_gtype
	 * is the implementation for #info.
	 * @param info a #GIVFuncInfo
	 * @param implementor_gtype #GType implementing this virtual function
	 * @returns address to a function or %NULL if an error happened
	 */
	function vfunc_info_get_address(info: VFuncInfo, implementor_gtype: GObject.Type): any | null;
	/**
	 * Obtain the flags for this virtual function info. See #GIVFuncInfoFlags for
	 * more information about possible flag values.
	 * @param info a #GIVFuncInfo
	 * @returns the flags
	 */
	function vfunc_info_get_flags(info: VFuncInfo): VFuncInfoFlags;
	/**
	 * If this virtual function has an associated invoker method, this
	 * method will return it.  An invoker method is a C entry point.
	 * 
	 * Not all virtuals will have invokers.
	 * @param info a #GIVFuncInfo
	 * @returns the #GIVFuncInfo or %NULL. Free it with
	 * {@link G.base_info_unref} when done.
	 */
	function vfunc_info_get_invoker(info: VFuncInfo): FunctionInfo;
	/**
	 * Obtain the offset of the function pointer in the class struct. The value
	 * 0xFFFF indicates that the struct offset is unknown.
	 * @param info a #GIVFuncInfo
	 * @returns the struct offset or 0xFFFF if it's unknown
	 */
	function vfunc_info_get_offset(info: VFuncInfo): number;
	/**
	 * Obtain the signal for the virtual function if one is set.
	 * The signal comes from the object or interface to which
	 * this virtual function belongs.
	 * @param info a #GIVFuncInfo
	 * @returns the signal or %NULL if none set
	 */
	function vfunc_info_get_signal(info: VFuncInfo): SignalInfo;
	/**
	 * Invokes the function described in #info with the given
	 * arguments. Note that inout parameters must appear in both
	 * argument lists.
	 * @param info a #GIVFuncInfo describing the virtual function to invoke
	 * @param implementor #GType of the type that implements this virtual function
	 * @param in_args an array of #GIArgument<!-- -->s, one for each in
	 *    parameter of #info. If there are no in parameter, #in_args
	 *    can be %NULL
	 * @param out_args an array of #GIArgument<!-- -->s, one for each out
	 *    parameter of #info. If there are no out parameters, #out_args
	 *    may be %NULL
	 * @param return_value return location for the return value of the
	 *    function. If the function returns void, #return_value may be
	 *    %NULL
	 * @returns %TRUE if the function has been invoked, %FALSE if an
	 *   error occurred.
	 */
	function vfunc_info_invoke(info: VFuncInfo, implementor: GObject.Type, in_args: Argument[], out_args: Argument[], return_value: Argument): boolean;
	/**
	 * The major version number of the girepository library.
	 * @returns The major version number of the girepository library.
	 */
	const MAJOR_VERSION: number;

	/**
	 * The micro version number of the girepository library.
	 * @returns The micro version number of the girepository library.
	 */
	const MICRO_VERSION: number;

	/**
	 * The minor version number of the girepository library.
	 * @returns The minor version number of the girepository library.
	 */
	const MINOR_VERSION: number;

	/**
	 * TODO
	 * @returns TODO
	 */
	const TYPE_TAG_N_TYPES: number;

}