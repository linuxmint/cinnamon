/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.Soup {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Address} instead.
	 */
	interface IAddress {
		family: AddressFamily;
		name: string;
		readonly physical: string;
		port: number;
		protocol: string;
		sockaddr: any;
		/**
		 * Tests if #addr1 and #addr2 have the same IP address. This method
		 * can be used with {@link Soup.Address.hash_by_ip} to create a
		 * #GHashTable that hashes on IP address.
		 * 
		 * This would be used to distinguish hosts in situations where
		 * different virtual hosts on the same IP address should be considered
		 * the same. Eg, if "www.example.com" and "www.example.net" have the
		 * same IP address, then a single connection can be used to talk
		 * to either of them.
		 * 
		 * See also soup_address_equal_by_name(), which compares by name
		 * rather than by IP address.
		 * @param addr2 another {@link Address} with a resolved
		 *   IP address
		 * @returns whether or not #addr1 and #addr2 have the same IP
		 * address.
		 */
		equal_by_ip(addr2: Address): boolean;
		/**
		 * Tests if #addr1 and #addr2 have the same "name". This method can be
		 * used with {@link Soup.Address.hash_by_name} to create a #GHashTable that
		 * hashes on address "names".
		 * 
		 * Comparing by name normally means comparing the addresses by their
		 * hostnames. But if the address was originally created using an IP
		 * address literal, then it will be compared by that instead.
		 * 
		 * In particular, if "www.example.com" has the IP address 10.0.0.1,
		 * and #addr1 was created with the name "www.example.com" and #addr2
		 * was created with the name "10.0.0.1", then they will compare as
		 * unequal for purposes of soup_address_equal_by_name().
		 * 
		 * This would be used to distinguish hosts in situations where
		 * different virtual hosts on the same IP address should be considered
		 * different. Eg, for purposes of HTTP authentication or cookies, two
		 * hosts with the same IP address but different names are considered
		 * to be different hosts.
		 * 
		 * See also soup_address_equal_by_ip(), which compares by IP address
		 * rather than by name.
		 * @param addr2 another {@link Address} with a resolved
		 *   name
		 * @returns whether or not #addr1 and #addr2 have the same name
		 */
		equal_by_name(addr2: Address): boolean;
		/**
		 * Creates a new #GSocketAddress corresponding to #addr (which is assumed
		 * to only have one socket address associated with it).
		 * @returns a new #GSocketAddress
		 */
		get_gsockaddr(): Gio.SocketAddress;
		/**
		 * Returns the hostname associated with #addr.
		 * 
		 * This method is not thread-safe; if you call it while #addr is being
		 * resolved in another thread, it may return garbage. You can use
		 * {@link Soup.Address.is_resolved} to safely test whether or not an address
		 * is resolved before fetching its name or address.
		 * @returns the hostname, or %NULL if it is not known.
		 */
		get_name(): string | null;
		/**
		 * Returns the physical address associated with #addr as a string.
		 * (Eg, "127.0.0.1"). If the address is not yet known, returns %NULL.
		 * 
		 * This method is not thread-safe; if you call it while #addr is being
		 * resolved in another thread, it may return garbage. You can use
		 * {@link Soup.Address.is_resolved} to safely test whether or not an address
		 * is resolved before fetching its name or address.
		 * @returns the physical address, or %NULL
		 */
		get_physical(): string | null;
		/**
		 * Returns the port associated with #addr.
		 * @returns the port
		 */
		get_port(): number;
		/**
		 * Returns the sockaddr associated with #addr, with its length in
		 * *#len. If the sockaddr is not yet known, returns %NULL.
		 * 
		 * This method is not thread-safe; if you call it while #addr is being
		 * resolved in another thread, it may return garbage. You can use
		 * {@link Soup.Address.is_resolved} to safely test whether or not an address
		 * is resolved before fetching its name or address.
		 * @param len return location for sockaddr length
		 * @returns the sockaddr, or %NULL
		 */
		get_sockaddr(len: number): any | null;
		/**
		 * A hash function (for #GHashTable) that corresponds to
		 * {@link Soup.Address.equal_by_ip}, qv
		 * @returns the IP-based hash value for #addr.
		 */
		hash_by_ip(): number;
		/**
		 * A hash function (for #GHashTable) that corresponds to
		 * {@link Soup.Address.equal_by_name}, qv
		 * @returns the named-based hash value for #addr.
		 */
		hash_by_name(): number;
		/**
		 * Tests if #addr has already been resolved. Unlike the other
		 * {@link Address} "get" methods, this is safe to call when #addr might
		 * be being resolved in another thread.
		 * @returns %TRUE if #addr has been resolved.
		 */
		is_resolved(): boolean;
		/**
		 * Asynchronously resolves the missing half of #addr (its IP address
		 * if it was created with {@link Soup.Address.new}, or its hostname if it
		 * was created with soup_address_new_from_sockaddr() or
		 * soup_address_new_any().)
		 * 
		 * If #cancellable is non-%NULL, it can be used to cancel the
		 * resolution. #callback will still be invoked in this case, with a
		 * status of %SOUP_STATUS_CANCELLED.
		 * 
		 * It is safe to call this more than once on a given address, from the
		 * same thread, with the same #async_context (and doing so will not
		 * result in redundant DNS queries being made). But it is not safe to
		 * call from multiple threads, or with different #async_contexts, or
		 * mixed with calls to soup_address_resolve_sync().
		 * @param async_context the #GMainContext to call #callback from
		 * @param cancellable a #GCancellable object, or %NULL
		 * @param callback callback to call with the result
		 */
		resolve_async(async_context: GLib.MainContext | null, cancellable: Gio.Cancellable | null, callback: AddressCallback): void;
		/**
		 * Synchronously resolves the missing half of #addr, as with
		 * {@link Soup.Address.resolve_async}.
		 * 
		 * If #cancellable is non-%NULL, it can be used to cancel the
		 * resolution. soup_address_resolve_sync() will then return a status
		 * of %SOUP_STATUS_CANCELLED.
		 * 
		 * It is safe to call this more than once, even from different
		 * threads, but it is not safe to mix calls to
		 * soup_address_resolve_sync() with calls to
		 * soup_address_resolve_async() on the same address.
		 * @param cancellable a #GCancellable object, or %NULL
		 * @returns %SOUP_STATUS_OK, %SOUP_STATUS_CANT_RESOLVE, or
		 * %SOUP_STATUS_CANCELLED.
		 */
		resolve_sync(cancellable: Gio.Cancellable | null): number;
		connect(signal: "notify::family", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::physical", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::port", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::protocol", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::sockaddr", callback: (owner: this, ...args: any) => void): number;

	}

	type AddressInitOptionsMixin = GObject.ObjectInitOptions & Gio.SocketConnectableInitOptions & 
	Pick<IAddress,
		"family" |
		"name" |
		"port" |
		"protocol" |
		"sockaddr">;

	export interface AddressInitOptions extends AddressInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Address} instead.
	 */
	type AddressMixin = IAddress & GObject.Object & Gio.SocketConnectable;

	interface Address extends AddressMixin {}

	class Address {
		public constructor(options?: Partial<AddressInitOptions>);
		/**
		 * Creates a {@link Address} from #name and #port. The #SoupAddress's IP
		 * address may not be available right away; the caller can call
		 * {@link Soup.Address.resolve_async} or soup_address_resolve_sync() to
		 * force a DNS resolution.
		 * @param name a hostname or physical address
		 * @param port a port number
		 * @returns a {@link Address}
		 */
		public static new(name: string, port: number): Address;
		/**
		 * Returns a {@link Address} corresponding to the "any" address
		 * for #family (or %NULL if #family isn't supported), suitable for
		 * using as a listening #SoupSocket.
		 * @param family the address family
		 * @param port the port number (usually %SOUP_ADDRESS_ANY_PORT)
		 * @returns the new {@link Address}
		 */
		public static new_any(family: AddressFamily, port: number): Address | null;
		/**
		 * Returns a {@link Address} equivalent to #sa (or %NULL if #sa's
		 * address family isn't supported)
		 * @param sa a pointer to a sockaddr
		 * @param len size of #sa
		 * @returns the new {@link Address}
		 */
		public static new_from_sockaddr(sa: any | null, len: number): Address | null;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Auth} instead.
	 */
	interface IAuth {
		host: string;
		// readonly is_authenticated: boolean;
		// is_for_proxy: boolean;
		realm: string;
		readonly scheme_name: string;
		// readonly realm: string;
		/**
		 * Call this on an auth to authenticate it; normally this will cause
		 * the auth's message to be requeued with the new authentication info.
		 * @param username the username provided by the user or client
		 * @param password the password provided by the user or client
		 */
		authenticate(username: string, password: string): void;
		/**
		 * Tests if #auth is able to authenticate by providing credentials to the
		 * {@link Soup.Auth.authenticate}.
		 * @returns %TRUE if #auth is able to accept credentials.
		 */
		can_authenticate(): boolean;
		/**
		 * Frees #space.
		 * @param space the return value from {@link Soup.Auth.get_protection_space}
		 */
		free_protection_space(space: any[]): void;
		/**
		 * Generates an appropriate "Authorization" header for #msg. (The
		 * session will only call this if {@link Soup.Auth.is_authenticated}
		 * returned %TRUE.)
		 * @param msg the {@link Message} to be authorized
		 * @returns the "Authorization" header, which must be freed.
		 */
		get_authorization(msg: Message): string;
		/**
		 * Returns the host that #auth is associated with.
		 * @returns the hostname
		 */
		get_host(): string;
		/**
		 * Gets an opaque identifier for #auth, for use as a hash key or the
		 * like. {@link Auth} objects from the same server with the same
		 * identifier refer to the same authentication domain (eg, the URLs
		 * associated with them take the same usernames and passwords).
		 * @returns the identifier
		 */
		get_info(): string;
		/**
		 * Returns a list of paths on the server which #auth extends over.
		 * (All subdirectories of these paths are also assumed to be part
		 * of #auth's protection space, unless otherwise discovered not to
		 * be.)
		 * @param source_uri the URI of the request that #auth was generated in
		 * response to.
		 * @returns the list of
		 * paths, which can be freed with {@link Soup.Auth.free_protection_space}.
		 */
		get_protection_space(source_uri: URI): string[];
		/**
		 * Returns #auth's realm. This is an identifier that distinguishes
		 * separate authentication spaces on a given server, and may be some
		 * string that is meaningful to the user. (Although it is probably not
		 * localized.)
		 * @returns the realm name
		 */
		get_realm(): string;
		get_saved_password(user: string): string;
		get_saved_users(): string[];
		/**
		 * Returns #auth's scheme name. (Eg, "Basic", "Digest", or "NTLM")
		 * @returns the scheme name
		 */
		get_scheme_name(): string;
		has_saved_password(username: string, password: string): void;
		/**
		 * Tests if #auth has been given a username and password
		 * @returns %TRUE if #auth has been given a username and password
		 */
		is_authenticated(): boolean;
		/**
		 * Tests whether or not #auth is associated with a proxy server rather
		 * than an "origin" server.
		 * @returns %TRUE or %FALSE
		 */
		is_for_proxy(): boolean;
		/**
		 * Tests if #auth is ready to make a request for #msg with. For most
		 * auths, this is equivalent to {@link Soup.Auth.is_authenticated}, but for
		 * some auth types (eg, NTLM), the auth may be sendable (eg, as an
		 * authentication request) even before it is authenticated.
		 * @param msg a {@link Message}
		 * @returns %TRUE if #auth is ready to make a request with.
		 */
		is_ready(msg: Message): boolean;
		save_password(username: string, password: string): void;
		/**
		 * Updates #auth with the information from #msg and #auth_header,
		 * possibly un-authenticating it. As with {@link Soup.Auth.new}, this is
		 * normally only used by {@link Session}.
		 * @param msg the {@link Message} #auth is being updated for
		 * @param auth_header the WWW-Authenticate/Proxy-Authenticate header
		 * @returns %TRUE if #auth is still a valid (but potentially
		 * unauthenticated) {@link Auth}. %FALSE if something about #auth_params
		 * could not be parsed or incorporated into #auth at all.
		 */
		update(msg: Message, auth_header: string): boolean;
		connect(signal: "notify::host", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::is-authenticated", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::is-for-proxy", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::realm", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::scheme-name", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::realm", callback: (owner: this, ...args: any) => void): number;

	}

	type AuthInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IAuth,
		"host" |
		"is_for_proxy" |
		"realm">;

	export interface AuthInitOptions extends AuthInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Auth} instead.
	 */
	type AuthMixin = IAuth & GObject.Object;

	/**
	 * The abstract base class for handling authentication. Specific HTTP
	 * Authentication mechanisms are implemented by its subclasses, but
	 * applications never need to be aware of the specific subclasses
	 * being used.
	 */
	interface Auth extends AuthMixin {}

	class Auth {
		public constructor(options?: Partial<AuthInitOptions>);
		/**
		 * Creates a new {@link Auth} of type #type with the information from
		 * #msg and #auth_header.
		 * 
		 * This is called by #SoupSession; you will normally not create auths
		 * yourself.
		 * @param type the type of auth to create (a subtype of {@link Auth})
		 * @param msg the {@link Message} the auth is being created for
		 * @param auth_header the WWW-Authenticate/Proxy-Authenticate header
		 * @returns the new {@link Auth}, or %NULL if it could
		 * not be created
		 */
		public static new(type: GObject.Type, msg: Message, auth_header: string): Auth | null;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthBasic} instead.
	 */
	interface IAuthBasic {

	}

	type AuthBasicInitOptionsMixin = AuthInitOptions
	export interface AuthBasicInitOptions extends AuthBasicInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthBasic} instead.
	 */
	type AuthBasicMixin = IAuthBasic & Auth;

	interface AuthBasic extends AuthBasicMixin {}

	class AuthBasic {
		public constructor(options?: Partial<AuthBasicInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthDigest} instead.
	 */
	interface IAuthDigest {

	}

	type AuthDigestInitOptionsMixin = AuthInitOptions
	export interface AuthDigestInitOptions extends AuthDigestInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthDigest} instead.
	 */
	type AuthDigestMixin = IAuthDigest & Auth;

	interface AuthDigest extends AuthDigestMixin {}

	class AuthDigest {
		public constructor(options?: Partial<AuthDigestInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthDomain} instead.
	 */
	interface IAuthDomain {
		/**
		 * The {@link AuthDomainFilter} for the domain
		 */
		filter: AuthDomainFilter;
		filter_data: any;
		/**
		 * The {@link AuthDomainGenericAuthCallback} for the domain
		 */
		generic_auth_callback: AuthDomainGenericAuthCallback;
		generic_auth_data: any;
		proxy: boolean;
		realm: string;
		/**
		 * Checks if #msg contains appropriate authorization for #domain to
		 * accept it. Mirroring {@link Soup.AuthDomain.covers}, this does not check
		 * whether or not #domain <emphasis>cares</emphasis> if #msg is
		 * authorized.
		 * 
		 * This is used by {@link Server} internally and is probably of no use to
		 * anyone else.
		 * @param msg a {@link Message}
		 * @returns the username that #msg has authenticated
		 * as, if in fact it has authenticated. %NULL otherwise.
		 */
		accepts(msg: Message): string | null;
		/**
		 * Adds #path to #domain, such that requests under #path on #domain's
		 * server will require authentication (unless overridden by
		 * {@link Soup.AuthDomain.remove_path} or soup_auth_domain_set_filter()).
		 * 
		 * You can also add paths by setting the %SOUP_AUTH_DOMAIN_ADD_PATH
		 * property, which can also be used to add one or more paths at
		 * construct time.
		 * @param path the path to add to #domain
		 */
		add_path(path: string): void;
		/**
		 * Adds a "WWW-Authenticate" or "Proxy-Authenticate" header to #msg,
		 * requesting that the client authenticate, and sets #msg's status
		 * accordingly.
		 * 
		 * This is used by {@link Server} internally and is probably of no use to
		 * anyone else.
		 * @param msg a {@link Message}
		 */
		challenge(msg: Message): void;
		/**
		 * Checks if #msg authenticates to #domain via #username and
		 * #password. This would normally be called from a
		 * {@link AuthDomainGenericAuthCallback}.
		 * @param msg a {@link Message}
		 * @param username a username
		 * @param password a password
		 * @returns whether or not the message is authenticated
		 */
		check_password(msg: Message, username: string, password: string): boolean;
		/**
		 * Checks if #domain requires #msg to be authenticated (according to
		 * its paths and filter function). This does not actually look at
		 * whether #msg <emphasis>is</emphasis> authenticated, merely whether
		 * or not it needs to be.
		 * 
		 * This is used by {@link Server} internally and is probably of no use to
		 * anyone else.
		 * @param msg a {@link Message}
		 * @returns %TRUE if #domain requires #msg to be authenticated
		 */
		covers(msg: Message): boolean;
		/**
		 * Gets the realm name associated with #domain
		 * @returns #domain's realm
		 */
		get_realm(): string;
		/**
		 * Removes #path from #domain, such that requests under #path on
		 * #domain's server will NOT require authentication.
		 * 
		 * This is not simply an undo-er for {@link Soup.AuthDomain.add_path}; it
		 * can be used to "carve out" a subtree that does not require
		 * authentication inside a hierarchy that does. Note also that unlike
		 * with soup_auth_domain_add_path(), this cannot be overridden by
		 * adding a filter, as filters can only bypass authentication that
		 * would otherwise be required, not require it where it would
		 * otherwise be unnecessary.
		 * 
		 * You can also remove paths by setting the
		 * %SOUP_AUTH_DOMAIN_REMOVE_PATH property, which can also be used to
		 * remove one or more paths at construct time.
		 * @param path the path to remove from #domain
		 */
		remove_path(path: string): void;
		/**
		 * Adds #filter as an authentication filter to #domain. The filter
		 * gets a chance to bypass authentication for certain requests that
		 * would otherwise require it. Eg, it might check the message's path
		 * in some way that is too complicated to do via the other methods, or
		 * it might check the message's method, and allow GETs but not PUTs.
		 * 
		 * The filter function returns %TRUE if the request should still
		 * require authentication, or %FALSE if authentication is unnecessary
		 * for this request.
		 * 
		 * To help prevent security holes, your filter should return %TRUE by
		 * default, and only return %FALSE under specifically-tested
		 * circumstances, rather than the other way around. Eg, in the example
		 * above, where you want to authenticate PUTs but not GETs, you should
		 * check if the method is GET and return %FALSE in that case, and then
		 * return %TRUE for all other methods (rather than returning %TRUE for
		 * PUT and %FALSE for all other methods). This way if it turned out
		 * (now or later) that some paths supported additional methods besides
		 * GET and PUT, those methods would default to being NOT allowed for
		 * unauthenticated users.
		 * 
		 * You can also set the filter by setting the %SOUP_AUTH_DOMAIN_FILTER
		 * and %SOUP_AUTH_DOMAIN_FILTER_DATA properties, which can also be
		 * used to set the filter at construct time.
		 * @param filter the auth filter for #domain
		 * @param filter_data data to pass to #filter
		 * @param dnotify destroy notifier to free #filter_data when #domain
		 * is destroyed
		 */
		set_filter(filter: AuthDomainFilter, filter_data: any | null, dnotify: GLib.DestroyNotify): void;
		/**
		 * Sets #auth_callback as an authentication-handling callback for
		 * #domain. Whenever a request comes in to #domain which cannot be
		 * authenticated via a domain-specific auth callback (eg,
		 * {@link AuthDomainDigestAuthCallback}), the generic auth callback
		 * will be invoked. See #SoupAuthDomainGenericAuthCallback for information
		 * on what the callback should do.
		 * @param auth_callback the auth callback
		 * @param auth_data data to pass to #auth_callback
		 * @param dnotify destroy notifier to free #auth_data when #domain
		 * is destroyed
		 */
		set_generic_auth_callback(auth_callback: AuthDomainGenericAuthCallback, auth_data: any | null, dnotify: GLib.DestroyNotify): void;
		try_generic_auth_callback(msg: Message, username: string): boolean;
		connect(signal: "notify::filter", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::filter-data", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::generic-auth-callback", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::generic-auth-data", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::proxy", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::realm", callback: (owner: this, ...args: any) => void): number;

	}

	type AuthDomainInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IAuthDomain,
		"filter" |
		"filter_data" |
		"generic_auth_callback" |
		"generic_auth_data" |
		"proxy" |
		"realm">;

	export interface AuthDomainInitOptions extends AuthDomainInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthDomain} instead.
	 */
	type AuthDomainMixin = IAuthDomain & GObject.Object;

	interface AuthDomain extends AuthDomainMixin {}

	class AuthDomain {
		public constructor(options?: Partial<AuthDomainInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthDomainBasic} instead.
	 */
	interface IAuthDomainBasic {
		/**
		 * The {@link AuthDomainBasicAuthCallback}
		 */
		auth_callback: AuthDomainBasicAuthCallback;
		/**
		 * The data to pass to the {@link AuthDomainBasicAuthCallback}
		 */
		auth_data: any;
		/**
		 * Sets the callback that #domain will use to authenticate incoming
		 * requests. For each request containing authorization, #domain will
		 * invoke the callback, and then either accept or reject the request
		 * based on #callback's return value.
		 * 
		 * You can also set the auth callback by setting the
		 * %SOUP_AUTH_DOMAIN_BASIC_AUTH_CALLBACK and
		 * %SOUP_AUTH_DOMAIN_BASIC_AUTH_DATA properties, which can also be
		 * used to set the callback at construct time.
		 * @param callback the callback
		 * @param dnotify destroy notifier to free #user_data when #domain
		 * is destroyed
		 */
		set_auth_callback(callback: AuthDomainBasicAuthCallback, dnotify: GLib.DestroyNotify): void;
		connect(signal: "notify::auth-callback", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::auth-data", callback: (owner: this, ...args: any) => void): number;

	}

	type AuthDomainBasicInitOptionsMixin = AuthDomainInitOptions & 
	Pick<IAuthDomainBasic,
		"auth_callback" |
		"auth_data">;

	export interface AuthDomainBasicInitOptions extends AuthDomainBasicInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthDomainBasic} instead.
	 */
	type AuthDomainBasicMixin = IAuthDomainBasic & AuthDomain;

	interface AuthDomainBasic extends AuthDomainBasicMixin {}

	class AuthDomainBasic {
		public constructor(options?: Partial<AuthDomainBasicInitOptions>);
		/**
		 * Creates a {@link AuthDomainBasic}. You must set the
		 * %SOUP_AUTH_DOMAIN_REALM parameter, to indicate the realm name to be
		 * returned with the authentication challenge to the client. Other
		 * parameters are optional.
		 * @param optname1 name of first option, or %NULL
		 * @returns the new {@link AuthDomain}
		 */
		public static new(optname1: string): AuthDomain;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthDomainDigest} instead.
	 */
	interface IAuthDomainDigest {
		/**
		 * The {@link AuthDomainDigestAuthCallback}
		 */
		auth_callback: AuthDomainDigestAuthCallback;
		/**
		 * The data to pass to the {@link AuthDomainDigestAuthCallback}
		 */
		auth_data: any;
		/**
		 * Sets the callback that #domain will use to authenticate incoming
		 * requests. For each request containing authorization, #domain will
		 * invoke the callback, and then either accept or reject the request
		 * based on #callback's return value.
		 * 
		 * You can also set the auth callback by setting the
		 * %SOUP_AUTH_DOMAIN_DIGEST_AUTH_CALLBACK and
		 * %SOUP_AUTH_DOMAIN_DIGEST_AUTH_DATA properties, which can also be
		 * used to set the callback at construct time.
		 * @param callback the callback
		 * @param dnotify destroy notifier to free #user_data when #domain
		 * is destroyed
		 */
		set_auth_callback(callback: AuthDomainDigestAuthCallback, dnotify: GLib.DestroyNotify): void;
		connect(signal: "notify::auth-callback", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::auth-data", callback: (owner: this, ...args: any) => void): number;

	}

	type AuthDomainDigestInitOptionsMixin = AuthDomainInitOptions & 
	Pick<IAuthDomainDigest,
		"auth_callback" |
		"auth_data">;

	export interface AuthDomainDigestInitOptions extends AuthDomainDigestInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthDomainDigest} instead.
	 */
	type AuthDomainDigestMixin = IAuthDomainDigest & AuthDomain;

	interface AuthDomainDigest extends AuthDomainDigestMixin {}

	class AuthDomainDigest {
		public constructor(options?: Partial<AuthDomainDigestInitOptions>);
		/**
		 * Creates a {@link AuthDomainDigest}. You must set the
		 * %SOUP_AUTH_DOMAIN_REALM parameter, to indicate the realm name to be
		 * returned with the authentication challenge to the client. Other
		 * parameters are optional.
		 * @param optname1 name of first option, or %NULL
		 * @returns the new {@link AuthDomain}
		 */
		public static new(optname1: string): AuthDomain;
		/**
		 * Encodes the username/realm/password triplet for Digest
		 * authentication. (That is, it returns a stringified MD5 hash of
		 * #username, #realm, and #password concatenated together). This is
		 * the form that is needed as the return value of
		 * {@link AuthDomainDigest}'s auth handler.
		 * 
		 * For security reasons, you should store the encoded hash, rather
		 * than storing the cleartext password itself and calling this method
		 * only when you need to verify it. This way, if your server is
		 * compromised, the attackers will not gain access to cleartext
		 * passwords which might also be usable at other sites. (Note also
		 * that the encoded password returned by this method is identical to
		 * the encoded password stored in an Apache .htdigest file.)
		 * @param username a username
		 * @param realm an auth realm name
		 * @param password the password for #username in #realm
		 * @returns the encoded password
		 */
		public static encode_password(username: string, realm: string, password: string): string;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthManager} instead.
	 */
	interface IAuthManager {
		/**
		 * Clear all credentials cached by #manager
		 */
		clear_cached_credentials(): void;
		/**
		 * Records that #auth is to be used under #uri, as though a
		 * WWW-Authenticate header had been received at that URI. This can be
		 * used to "preload" #manager's auth cache, to avoid an extra HTTP
		 * round trip in the case where you know ahead of time that a 401
		 * response will be returned.
		 * 
		 * This is only useful for authentication types where the initial
		 * Authorization header does not depend on any additional information
		 * from the server. (Eg, Basic or NTLM, but not Digest.)
		 * @param uri the {@link URI} under which #auth is to be used
		 * @param auth the {@link Auth} to use
		 */
		use_auth(uri: URI, auth: Auth): void;
		/**
		 * Emitted when the manager requires the application to
		 * provide authentication credentials.
		 * 
		 * {@link Session} connects to this signal and emits its own
		 * #SoupSession::authenticate signal when it is emitted, so
		 * you shouldn't need to use this signal directly.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - msg: the {@link Message} being sent 
		 *  - auth: the #SoupAuth to authenticate 
		 *  - retrying: %TRUE if this is the second (or later) attempt 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "authenticate", callback: (owner: this, msg: Message, auth: Auth, retrying: boolean) => void): number;

	}

	type AuthManagerInitOptionsMixin = GObject.ObjectInitOptions & SessionFeatureInitOptions
	export interface AuthManagerInitOptions extends AuthManagerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthManager} instead.
	 */
	type AuthManagerMixin = IAuthManager & GObject.Object & SessionFeature;

	interface AuthManager extends AuthManagerMixin {}

	class AuthManager {
		public constructor(options?: Partial<AuthManagerInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthNTLM} instead.
	 */
	interface IAuthNTLM {

	}

	type AuthNTLMInitOptionsMixin = AuthInitOptions
	export interface AuthNTLMInitOptions extends AuthNTLMInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthNTLM} instead.
	 */
	type AuthNTLMMixin = IAuthNTLM & Auth;

	interface AuthNTLM extends AuthNTLMMixin {}

	class AuthNTLM {
		public constructor(options?: Partial<AuthNTLMInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthNegotiate} instead.
	 */
	interface IAuthNegotiate {

	}

	type AuthNegotiateInitOptionsMixin = AuthInitOptions
	export interface AuthNegotiateInitOptions extends AuthNegotiateInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link AuthNegotiate} instead.
	 */
	type AuthNegotiateMixin = IAuthNegotiate & Auth;

	interface AuthNegotiate extends AuthNegotiateMixin {}

	class AuthNegotiate {
		public constructor(options?: Partial<AuthNegotiateInitOptions>);
		/**
		 * Indicates whether libsoup was built with GSSAPI support. If this is
		 * %FALSE, %SOUP_TYPE_AUTH_NEGOTIATE will still be defined and can
		 * still be added to a {@link Session}, but libsoup will never attempt to
		 * actually use this auth type.
		 * @returns 
		 */
		public static supported(): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Cache} instead.
	 */
	interface ICache {
		cache_dir: string;
		cache_type: CacheType;
		/**
		 * Will remove all entries in the #cache plus all the cache files.
		 */
		clear(): void;
		/**
		 * Synchronously writes the cache index out to disk. Contrast with
		 * {@link Soup.Cache.flush}, which writes pending cache
		 * <emphasis>entries</emphasis> to disk.
		 * 
		 * You must call this before exiting if you want your cache data to
		 * persist between sessions.
		 */
		dump(): void;
		/**
		 * This function will force all pending writes in the #cache to be
		 * committed to disk. For doing so it will iterate the #GMainContext
		 * associated with #cache's session as long as needed.
		 * 
		 * Contrast with {@link Soup.Cache.dump}, which writes out the cache index
		 * file.
		 */
		flush(): void;
		/**
		 * Gets the maximum size of the cache.
		 * @returns the maximum size of the cache, in bytes.
		 */
		get_max_size(): number;
		/**
		 * Loads the contents of #cache's index into memory.
		 */
		load(): void;
		/**
		 * Sets the maximum size of the cache.
		 * @param max_size the maximum size of the cache, in bytes
		 */
		set_max_size(max_size: number): void;
		connect(signal: "notify::cache-dir", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::cache-type", callback: (owner: this, ...args: any) => void): number;

	}

	type CacheInitOptionsMixin = GObject.ObjectInitOptions & SessionFeatureInitOptions & 
	Pick<ICache,
		"cache_dir" |
		"cache_type">;

	export interface CacheInitOptions extends CacheInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Cache} instead.
	 */
	type CacheMixin = ICache & GObject.Object & SessionFeature;

	interface Cache extends CacheMixin {}

	class Cache {
		public constructor(options?: Partial<CacheInitOptions>);
		/**
		 * Creates a new {@link Cache}.
		 * @param cache_dir the directory to store the cached data, or %NULL
		 *   to use the default one. Note that since the cache isn't safe to access for
		 *   multiple processes at once, and the default directory isn't namespaced by
		 *   process, clients are strongly discouraged from passing %NULL.
		 * @param cache_type the {@link CacheType} of the cache
		 * @returns a new {@link Cache}
		 */
		public static new(cache_dir: string | null, cache_type: CacheType): Cache;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ContentDecoder} instead.
	 */
	interface IContentDecoder {

	}

	type ContentDecoderInitOptionsMixin = GObject.ObjectInitOptions & SessionFeatureInitOptions
	export interface ContentDecoderInitOptions extends ContentDecoderInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ContentDecoder} instead.
	 */
	type ContentDecoderMixin = IContentDecoder & GObject.Object & SessionFeature;

	interface ContentDecoder extends ContentDecoderMixin {}

	class ContentDecoder {
		public constructor(options?: Partial<ContentDecoderInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ContentSniffer} instead.
	 */
	interface IContentSniffer {
		/**
		 * Gets the number of bytes #sniffer needs in order to properly sniff
		 * a buffer.
		 * @returns the number of bytes to sniff
		 */
		get_buffer_size(): number;
		/**
		 * Sniffs #buffer to determine its Content-Type. The result may also
		 * be influenced by the Content-Type declared in #msg's response
		 * headers.
		 * @param msg the message to sniff
		 * @param buffer a buffer containing the start of #msg's response body
		 * @returns the sniffed Content-Type of #buffer; this will never be %NULL,
		 *   but may be "application/octet-stream".
		 * 
		 * return
		 *   location for Content-Type parameters (eg, "charset"), or %NULL
		 */
		sniff(msg: Message, buffer: Buffer): [ string, string[] | null ];
	}

	type ContentSnifferInitOptionsMixin = GObject.ObjectInitOptions & SessionFeatureInitOptions
	export interface ContentSnifferInitOptions extends ContentSnifferInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ContentSniffer} instead.
	 */
	type ContentSnifferMixin = IContentSniffer & GObject.Object & SessionFeature;

	interface ContentSniffer extends ContentSnifferMixin {}

	class ContentSniffer {
		public constructor(options?: Partial<ContentSnifferInitOptions>);
		/**
		 * Creates a new {@link ContentSniffer}.
		 * @returns a new {@link ContentSniffer}
		 */
		public static new(): ContentSniffer;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CookieJar} instead.
	 */
	interface ICookieJar {
		/**
		 * The policy the jar should follow to accept or reject cookies
		 */
		accept_policy: CookieJarAcceptPolicy;
		read_only: boolean;
		/**
		 * Adds #cookie to #jar, emitting the 'changed' signal if we are modifying
		 * an existing cookie or adding a valid new cookie ('valid' means
		 * that the cookie's expire date is not in the past).
		 * 
		 * #cookie will be 'stolen' by the jar, so don't free it afterwards.
		 * @param cookie a {@link Cookie}
		 */
		add_cookie(cookie: Cookie): void;
		/**
		 * Adds #cookie to #jar, emitting the 'changed' signal if we are modifying
		 * an existing cookie or adding a valid new cookie ('valid' means
		 * that the cookie's expire date is not in the past).
		 * 
		 * #first_party will be used to reject cookies coming from third party
		 * resources in case such a security policy is set in the #jar.
		 * 
		 * #uri will be used to reject setting or overwriting secure cookies
		 * from insecure origins. %NULL is treated as secure.
		 * 
		 * #cookie will be 'stolen' by the jar, so don't free it afterwards.
		 * @param cookie a {@link Cookie}
		 * @param uri the URI setting the cookie
		 * @param first_party the URI for the main document
		 */
		add_cookie_full(cookie: Cookie, uri: URI | null, first_party: URI | null): void;
		/**
		 * Adds #cookie to #jar, emitting the 'changed' signal if we are modifying
		 * an existing cookie or adding a valid new cookie ('valid' means
		 * that the cookie's expire date is not in the past).
		 * 
		 * #first_party will be used to reject cookies coming from third party
		 * resources in case such a security policy is set in the #jar.
		 * 
		 * #cookie will be 'stolen' by the jar, so don't free it afterwards.
		 * 
		 * For secure cookies to work properly you may want to use
		 * {@link Soup.CookieJar.add_cookie_full}.
		 * @param first_party the URI for the main document
		 * @param cookie a {@link Cookie}
		 */
		add_cookie_with_first_party(first_party: URI, cookie: Cookie): void;
		/**
		 * Constructs a #GSList with every cookie inside the #jar.
		 * The cookies in the list are a copy of the original, so
		 * you have to free them when you are done with them.
		 * @returns a #GSList
		 * with all the cookies in the #jar.
		 */
		all_cookies(): Cookie[];
		/**
		 * Deletes #cookie from #jar, emitting the 'changed' signal.
		 * @param cookie a {@link Cookie}
		 */
		delete_cookie(cookie: Cookie): void;
		/**
		 * Gets #jar's {@link CookieJarAcceptPolicy}
		 * @returns the {@link CookieJarAcceptPolicy} set in the #jar
		 */
		get_accept_policy(): CookieJarAcceptPolicy;
		/**
		 * Retrieves the list of cookies that would be sent with a request to #uri
		 * as a #GSList of {@link Cookie} objects.
		 * 
		 * If #for_http is %TRUE, the return value will include cookies marked
		 * "HttpOnly" (that is, cookies that the server wishes to keep hidden
		 * from client-side scripting operations such as the JavaScript
		 * document.cookies property). Since #SoupCookieJar sets the Cookie
		 * header itself when making the actual HTTP request, you should
		 * almost certainly be setting #for_http to %FALSE if you are calling
		 * this.
		 * @param uri a {@link URI}
		 * @param for_http whether or not the return value is being passed directly
		 * to an HTTP operation
		 * @returns a #GSList
		 * with the cookies in the #jar that would be sent with a request to #uri.
		 */
		get_cookie_list(uri: URI, for_http: boolean): Cookie[];
		/**
		 * This is an extended version of {@link Soup.CookieJar.get_cookie_list} that
		 * provides more information required to use SameSite cookies. See the
		 * [SameSite cookies spec](https://tools.ietf.org/html/draft-ietf-httpbis-cookie-same-site-00)
		 * for more detailed information.
		 * @param uri a {@link URI}
		 * @param top_level a {@link URI} for the top level document
		 * @param site_for_cookies a {@link URI} indicating the origin to get cookies for
		 * @param for_http whether or not the return value is being passed directly
		 * to an HTTP operation
		 * @param is_safe_method if the HTTP method is safe, as defined by RFC 7231, ignored when #for_http is %FALSE
		 * @param is_top_level_navigation whether or not the HTTP request is part of
		 * top level navigation
		 * @returns a #GSList
		 * with the cookies in the #jar that would be sent with a request to #uri.
		 */
		get_cookie_list_with_same_site_info(uri: URI, top_level: URI | null, site_for_cookies: URI | null, for_http: boolean, is_safe_method: boolean, is_top_level_navigation: boolean): Cookie[];
		/**
		 * Retrieves (in Cookie-header form) the list of cookies that would
		 * be sent with a request to #uri.
		 * 
		 * If #for_http is %TRUE, the return value will include cookies marked
		 * "HttpOnly" (that is, cookies that the server wishes to keep hidden
		 * from client-side scripting operations such as the JavaScript
		 * document.cookies property). Since {@link CookieJar} sets the Cookie
		 * header itself when making the actual HTTP request, you should
		 * almost certainly be setting #for_http to %FALSE if you are calling
		 * this.
		 * @param uri a {@link URI}
		 * @param for_http whether or not the return value is being passed directly
		 * to an HTTP operation
		 * @returns the cookies, in string form, or %NULL if
		 * there are no cookies for #uri.
		 */
		get_cookies(uri: URI, for_http: boolean): string | null;
		/**
		 * Gets whether #jar stores cookies persistenly.
		 * @returns %TRUE if #jar storage is persistent or %FALSE otherwise.
		 */
		is_persistent(): boolean;
		/**
		 * @deprecated
		 * This is a no-op.
		 * 
		 * This function exists for backward compatibility, but does not do
		 * anything any more; cookie jars are saved automatically when they
		 * are changed.
		 */
		save(): void;
		/**
		 * Sets #policy as the cookie acceptance policy for #jar.
		 * @param policy a {@link CookieJarAcceptPolicy}
		 */
		set_accept_policy(policy: CookieJarAcceptPolicy): void;
		/**
		 * Adds #cookie to #jar, exactly as though it had appeared in a
		 * Set-Cookie header returned from a request to #uri.
		 * 
		 * Keep in mind that if the {@link CookieJarAcceptPolicy} set is either
		 * %SOUP_COOKIE_JAR_ACCEPT_NO_THIRD_PARTY or
		 * %SOUP_COOKIE_JAR_ACCEPT_GRANDFATHERED_THIRD_PARTY you'll need to use
		 * {@link Soup.CookieJar.set_cookie_with_first_party}, otherwise the jar
		 * will have no way of knowing if the cookie is being set by a third
		 * party or not.
		 * @param uri the URI setting the cookie
		 * @param cookie the stringified cookie to set
		 */
		set_cookie(uri: URI, cookie: string): void;
		/**
		 * Adds #cookie to #jar, exactly as though it had appeared in a
		 * Set-Cookie header returned from a request to #uri. #first_party
		 * will be used to reject cookies coming from third party resources in
		 * case such a security policy is set in the #jar.
		 * @param uri the URI setting the cookie
		 * @param first_party the URI for the main document
		 * @param cookie the stringified cookie to set
		 */
		set_cookie_with_first_party(uri: URI, first_party: URI, cookie: string): void;
		/**
		 * Emitted when #jar changes. If a cookie has been added,
		 * #new_cookie will contain the newly-added cookie and
		 * #old_cookie will be %NULL. If a cookie has been deleted,
		 * #old_cookie will contain the to-be-deleted cookie and
		 * #new_cookie will be %NULL. If a cookie has been changed,
		 * #old_cookie will contain its old value, and #new_cookie its
		 * new value.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - old_cookie: the old {@link Cookie} value 
		 *  - new_cookie: the new #SoupCookie value 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "changed", callback: (owner: this, old_cookie: Cookie, new_cookie: Cookie) => void): number;

		connect(signal: "notify::accept-policy", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::read-only", callback: (owner: this, ...args: any) => void): number;

	}

	type CookieJarInitOptionsMixin = GObject.ObjectInitOptions & SessionFeatureInitOptions & 
	Pick<ICookieJar,
		"accept_policy" |
		"read_only">;

	export interface CookieJarInitOptions extends CookieJarInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CookieJar} instead.
	 */
	type CookieJarMixin = ICookieJar & GObject.Object & SessionFeature;

	interface CookieJar extends CookieJarMixin {}

	class CookieJar {
		public constructor(options?: Partial<CookieJarInitOptions>);
		/**
		 * Creates a new {@link CookieJar}. The base #SoupCookieJar class does
		 * not support persistent storage of cookies; use a subclass for that.
		 * @returns a new {@link CookieJar}
		 */
		public static new(): CookieJar;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CookieJarDB} instead.
	 */
	interface ICookieJarDB {
		filename: string;

		connect(signal: "notify::filename", callback: (owner: this, ...args: any) => void): number;

	}

	type CookieJarDBInitOptionsMixin = CookieJarInitOptions & SessionFeatureInitOptions & 
	Pick<ICookieJarDB,
		"filename">;

	export interface CookieJarDBInitOptions extends CookieJarDBInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CookieJarDB} instead.
	 */
	type CookieJarDBMixin = ICookieJarDB & CookieJar & SessionFeature;

	interface CookieJarDB extends CookieJarDBMixin {}

	class CookieJarDB {
		public constructor(options?: Partial<CookieJarDBInitOptions>);
		/**
		 * Creates a {@link CookieJarDB}.
		 * 
		 * #filename will be read in at startup to create an initial set of
		 * cookies. If #read_only is %FALSE, then the non-session cookies will
		 * be written to #filename when the 'changed' signal is emitted from
		 * the jar. (If #read_only is %TRUE, then the cookie jar will only be
		 * used for this session, and changes made to it will be lost when the
		 * jar is destroyed.)
		 * @param filename the filename to read to/write from, or %NULL
		 * @param read_only %TRUE if #filename is read-only
		 * @returns the new {@link CookieJar}
		 */
		public static new(filename: string, read_only: boolean): CookieJar;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CookieJarText} instead.
	 */
	interface ICookieJarText {
		filename: string;

		connect(signal: "notify::filename", callback: (owner: this, ...args: any) => void): number;

	}

	type CookieJarTextInitOptionsMixin = CookieJarInitOptions & SessionFeatureInitOptions & 
	Pick<ICookieJarText,
		"filename">;

	export interface CookieJarTextInitOptions extends CookieJarTextInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link CookieJarText} instead.
	 */
	type CookieJarTextMixin = ICookieJarText & CookieJar & SessionFeature;

	interface CookieJarText extends CookieJarTextMixin {}

	class CookieJarText {
		public constructor(options?: Partial<CookieJarTextInitOptions>);
		/**
		 * Creates a {@link CookieJarText}.
		 * 
		 * #filename will be read in at startup to create an initial set of
		 * cookies. If #read_only is %FALSE, then the non-session cookies will
		 * be written to #filename when the 'changed' signal is emitted from
		 * the jar. (If #read_only is %TRUE, then the cookie jar will only be
		 * used for this session, and changes made to it will be lost when the
		 * jar is destroyed.)
		 * @param filename the filename to read to/write from
		 * @param read_only %TRUE if #filename is read-only
		 * @returns the new {@link CookieJar}
		 */
		public static new(filename: string, read_only: boolean): CookieJar;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link HSTSEnforcer} instead.
	 */
	interface IHSTSEnforcer {
		/**
		 * Gets a list of domains for which there are policies in #enforcer.
		 * @param session_policies whether to include session policies
		 * @returns a newly allocated
		 * list of domains. Use {@link G.list_free_full} and g_free() to free the
		 * list.
		 */
		get_domains(session_policies: boolean): string[];
		/**
		 * Gets a list with the policies in #enforcer.
		 * @param session_policies whether to include session policies
		 * @returns a newly
		 * allocated list of policies. Use {@link G.list_free_full} and
		 * soup_hsts_policy_free() to free the list.
		 */
		get_policies(session_policies: boolean): HSTSPolicy[];
		/**
		 * Gets whether #hsts_enforcer has a currently valid policy for #domain.
		 * @param domain a domain.
		 * @returns %TRUE if access to #domain should happen over HTTPS, false
		 * otherwise.
		 */
		has_valid_policy(domain: string): boolean;
		/**
		 * Gets whether #hsts_enforcer stores policies persistenly.
		 * @returns %TRUE if #hsts_enforcer storage is persistent or %FALSE otherwise.
		 */
		is_persistent(): boolean;
		/**
		 * Sets #policy to #hsts_enforcer. If #policy is expired, any
		 * existing HSTS policy for its host will be removed instead. If a
		 * policy existed for this host, it will be replaced. Otherwise, the
		 * new policy will be inserted. If the policy is a session policy, that
		 * is, one created with {@link Soup.hsts_policy_new_session_policy}, the policy
		 * will not expire and will be enforced during the lifetime of
		 * #hsts_enforcer's {@link Session}.
		 * @param policy the policy of the HSTS host
		 */
		set_policy(policy: HSTSPolicy): void;
		/**
		 * Sets a session policy for #domain. A session policy is a policy
		 * that is permanent to the lifetime of #hsts_enforcer's {@link Session}
		 * and doesn't expire.
		 * @param domain policy domain or hostname
		 * @param include_subdomains %TRUE if the policy applies on sub domains
		 */
		set_session_policy(domain: string, include_subdomains: boolean): void;
		/**
		 * Emitted when #hsts_enforcer changes. If a policy has been added,
		 * #new_policy will contain the newly-added policy and
		 * #old_policy will be %NULL. If a policy has been deleted,
		 * #old_policy will contain the to-be-deleted policy and
		 * #new_policy will be %NULL. If a policy has been changed,
		 * #old_policy will contain its old value, and #new_policy its
		 * new value.
		 * 
		 * Note that you shouldn't modify the policies from a callback to
		 * this signal.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - old_policy: the old {@link HSTSPolicy} value 
		 *  - new_policy: the new #SoupHSTSPolicy value 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "changed", callback: (owner: this, old_policy: HSTSPolicy, new_policy: HSTSPolicy) => void): number;
		/**
		 * Emitted when #hsts_enforcer has upgraded the protocol
		 * for #message to HTTPS as a result of matching its domain with
		 * a HSTS policy.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - message: the message for which HSTS is being enforced 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "hsts-enforced", callback: (owner: this, message: Message) => void): number;

	}

	type HSTSEnforcerInitOptionsMixin = GObject.ObjectInitOptions & SessionFeatureInitOptions
	export interface HSTSEnforcerInitOptions extends HSTSEnforcerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link HSTSEnforcer} instead.
	 */
	type HSTSEnforcerMixin = IHSTSEnforcer & GObject.Object & SessionFeature;

	interface HSTSEnforcer extends HSTSEnforcerMixin {}

	class HSTSEnforcer {
		public constructor(options?: Partial<HSTSEnforcerInitOptions>);
		/**
		 * Creates a new {@link HSTSEnforcer}. The base #SoupHSTSEnforcer class
		 * does not support persistent storage of HSTS policies, see
		 * #SoupHSTSEnforcerDB for that.
		 * @returns a new {@link HSTSEnforcer}
		 */
		public static new(): HSTSEnforcer;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link HSTSEnforcerDB} instead.
	 */
	interface IHSTSEnforcerDB {
		/**
		 * The filename of the SQLite database where HSTS policies are stored.
		 */
		filename: string;

		connect(signal: "notify::filename", callback: (owner: this, ...args: any) => void): number;

	}

	type HSTSEnforcerDBInitOptionsMixin = HSTSEnforcerInitOptions & SessionFeatureInitOptions & 
	Pick<IHSTSEnforcerDB,
		"filename">;

	export interface HSTSEnforcerDBInitOptions extends HSTSEnforcerDBInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link HSTSEnforcerDB} instead.
	 */
	type HSTSEnforcerDBMixin = IHSTSEnforcerDB & HSTSEnforcer & SessionFeature;

	interface HSTSEnforcerDB extends HSTSEnforcerDBMixin {}

	class HSTSEnforcerDB {
		public constructor(options?: Partial<HSTSEnforcerDBInitOptions>);
		/**
		 * Creates a {@link HSTSEnforcerDB}.
		 * 
		 * #filename will be read in during the initialization of a
		 * #SoupHSTSEnforcerDB, in order to create an initial set of HSTS
		 * policies. If the file doesn't exist, a new database will be created
		 * and initialized. Changes to the policies during the lifetime of a
		 * #SoupHSTSEnforcerDB will be written to #filename when
		 * #SoupHSTSEnforcer::changed is emitted.
		 * @param filename the filename of the database to read/write from.
		 * @returns the new {@link HSTSEnforcer}
		 */
		public static new(filename: string): HSTSEnforcer;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Logger} instead.
	 */
	interface ILogger {
		/**
		 * The level of logging output
		 */
		level: LoggerLogLevel;
		/**
		 * If {@link Logger.level} is %SOUP_LOGGER_LOG_BODY, this gives
		 * the maximum number of bytes of the body that will be logged.
		 * (-1 means "no limit".)
		 */
		max_body_size: number;
		/**
		 * @deprecated
		 * Use {@link Soup.Session.add_feature} instead.
		 * 
		 * Sets #logger to watch #session and print debug information for
		 * its messages.
		 * 
		 * (The session will take a reference on #logger, which will be
		 * removed when you call {@link Soup.Logger.detach}, or when the session is
		 * destroyed.)
		 * @param session a {@link Session}
		 */
		attach(session: Session): void;
		/**
		 * @deprecated
		 * Use {@link Soup.Session.remove_feature} instead.
		 * 
		 * Stops #logger from watching #session.
		 * @param session a {@link Session}
		 */
		detach(session: Session): void;
		/**
		 * Sets up an alternate log printing routine, if you don't want
		 * the log to go to <literal>stdout</literal>.
		 * @param printer the callback for printing logging output
		 * @param printer_data data to pass to the callback
		 * @param destroy a #GDestroyNotify to free #printer_data
		 */
		set_printer(printer: LoggerPrinter, printer_data: any | null, destroy: GLib.DestroyNotify): void;
		/**
		 * Sets up a filter to determine the log level for a given request.
		 * For each HTTP request #logger will invoke #request_filter to
		 * determine how much (if any) of that request to log. (If you do not
		 * set a request filter, #logger will just always log requests at the
		 * level passed to {@link Soup.Logger.new}.)
		 * @param request_filter the callback for request debugging
		 * @param filter_data data to pass to the callback
		 * @param destroy a #GDestroyNotify to free #filter_data
		 */
		set_request_filter(request_filter: LoggerFilter, filter_data: any | null, destroy: GLib.DestroyNotify): void;
		/**
		 * Sets up a filter to determine the log level for a given response.
		 * For each HTTP response #logger will invoke #response_filter to
		 * determine how much (if any) of that response to log. (If you do not
		 * set a response filter, #logger will just always log responses at
		 * the level passed to {@link Soup.Logger.new}.)
		 * @param response_filter the callback for response debugging
		 * @param filter_data data to pass to the callback
		 * @param destroy a #GDestroyNotify to free #filter_data
		 */
		set_response_filter(response_filter: LoggerFilter, filter_data: any | null, destroy: GLib.DestroyNotify): void;
		connect(signal: "notify::level", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::max-body-size", callback: (owner: this, ...args: any) => void): number;

	}

	type LoggerInitOptionsMixin = GObject.ObjectInitOptions & SessionFeatureInitOptions & 
	Pick<ILogger,
		"level" |
		"max_body_size">;

	export interface LoggerInitOptions extends LoggerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Logger} instead.
	 */
	type LoggerMixin = ILogger & GObject.Object & SessionFeature;

	interface Logger extends LoggerMixin {}

	class Logger {
		public constructor(options?: Partial<LoggerInitOptions>);
		/**
		 * Creates a new {@link Logger} with the given debug level. If #level is
		 * %SOUP_LOGGER_LOG_BODY, #max_body_size gives the maximum number of
		 * bytes of the body that will be logged. (-1 means "no limit".)
		 * 
		 * If you need finer control over what message parts are and aren't
		 * logged, use {@link Soup.Logger.set_request_filter} and
		 * soup_logger_set_response_filter().
		 * @param level the debug level
		 * @param max_body_size the maximum body size to output, or -1
		 * @returns a new {@link Logger}
		 */
		public static new(level: LoggerLogLevel, max_body_size: number): Logger;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Message} instead.
	 */
	interface IMessage {
		/**
		 * The {@link URI} loaded in the application when the message was
		 * queued.
		 */
		first_party: URI;
		flags: MessageFlags;
		http_version: HTTPVersion;
		/**
		 * Set when the message is navigating between top level domains.
		 */
		is_top_level_navigation: boolean;
		method: string;
		priority: MessagePriority;
		reason_phrase: string;
		readonly request_body: MessageBody;
		/**
		 * The message's HTTP request body, as a #GBytes.
		 */
		readonly request_body_data: GLib.Bytes;
		readonly request_headers: MessageHeaders;
		readonly response_body: MessageBody;
		/**
		 * The message's HTTP response body, as a #GBytes.
		 */
		readonly response_body_data: GLib.Bytes;
		readonly response_headers: MessageHeaders;
		server_side: boolean;
		site_for_cookies: URI;
		status_code: number;
		/**
		 * The #GTlsCertificate associated with the message
		 */
		tls_certificate: Gio.TlsCertificate;
		/**
		 * The verification errors on {@link Message.tls_certificate}
		 */
		tls_errors: Gio.TlsCertificateFlags;
		uri: URI;
		/**
		 * the HTTP method
		 */
		// readonly method: string;
		/**
		 * the HTTP status code
		 */
		// readonly status_code: number;
		/**
		 * the status phrase associated with #status_code
		 */
		// readonly reason_phrase: string;
		/**
		 * the request body
		 */
		// readonly request_body: MessageBody;
		/**
		 * the request headers
		 */
		// readonly request_headers: MessageHeaders;
		/**
		 * the response body
		 */
		// readonly response_body: MessageBody;
		/**
		 * the response headers
		 */
		// readonly response_headers: MessageHeaders;
		/**
		 * Adds a signal handler to #msg for #signal, as with
		 * {@link G.signal_connect}, but the #callback will only be run if #msg's
		 * incoming messages headers (that is, the
		 * <literal>request_headers</literal> for a client {@link Message}, or
		 * the <literal>response_headers</literal> for a server #SoupMessage)
		 * contain a header named #header.
		 * @param signal signal to connect the handler to.
		 * @param header HTTP response header to match against
		 * @param callback the header handler
		 * @returns the handler ID from {@link G.signal_connect}
		 */
		add_header_handler(signal: string, header: string, callback: GObject.Callback): number;
		/**
		 * Adds a signal handler to #msg for #signal, as with
		 * {@link G.signal_connect}, but the #callback will only be run if #msg has
		 * the status #status_code.
		 * 
		 * #signal must be a signal that will be emitted after #msg's status
		 * is set. For a client {@link Message}, this means it can't be a "wrote"
		 * signal. For a server #SoupMessage, this means it can't be a "got"
		 * signal.
		 * @param signal signal to connect the handler to.
		 * @param status_code status code to match against
		 * @param callback the header handler
		 * @returns the handler ID from {@link G.signal_connect}
		 */
		add_status_code_handler(signal: string, status_code: number, callback: GObject.Callback): number;
		content_sniffed(content_type: string, params: any[]): void;
		/**
		 * This disables the actions of {@link SessionFeature}<!-- -->s with the
		 * given #feature_type (or a subclass of that type) on #msg, so that
		 * #msg is processed as though the feature(s) hadn't been added to the
		 * session. Eg, passing #SOUP_TYPE_CONTENT_SNIFFER for #feature_type
		 * will disable Content-Type sniffing on the message.
		 * 
		 * You must call this before queueing #msg on a session; calling it on
		 * a message that has already been queued is undefined. In particular,
		 * you cannot call this on a message that is being requeued after a
		 * redirect or authentication.
		 * @param feature_type the #GType of a {@link SessionFeature}
		 */
		disable_feature(feature_type: GObject.Type): void;
		finished(): void;
		/**
		 * Gets the address #msg's URI points to. After first setting the
		 * URI on a message, this will be unresolved, although the message's
		 * session will resolve it before sending the message.
		 * @returns the address #msg's URI points to
		 */
		get_address(): Address;
		/**
		 * Gets #msg's first-party {@link URI}
		 * @returns the #msg's first party {@link URI}
		 */
		get_first_party(): URI;
		/**
		 * Gets the flags on #msg
		 * @returns the flags
		 */
		get_flags(): MessageFlags;
		/**
		 * Gets the HTTP version of #msg. This is the minimum of the
		 * version from the request and the version from the response.
		 * @returns the HTTP version
		 */
		get_http_version(): HTTPVersion;
		/**
		 * If #msg is using https (or attempted to use https but got
		 * %SOUP_STATUS_SSL_FAILED), this retrieves the #GTlsCertificate
		 * associated with its connection, and the #GTlsCertificateFlags
		 * showing what problems, if any, have been found with that
		 * certificate.
		 * 
		 * <note><para>This is only meaningful with messages processed by a {@link Session} and is
		 * not useful for messages received by a #SoupServer</para></note>
		 * @returns %TRUE if #msg used/attempted https, %FALSE if not
		 * 
		 * #msg's TLS certificate
		 * 
		 * the verification status of #certificate
		 */
		get_https_status(): [ boolean, Gio.TlsCertificate, Gio.TlsCertificateFlags ];
		get_is_top_level_navigation(): boolean;
		/**
		 * Retrieves the {@link MessagePriority}. If not set this value defaults
		 * to #SOUP_MESSAGE_PRIORITY_NORMAL.
		 * @returns the priority of the message.
		 */
		get_priority(): MessagePriority;
		/**
		 * Gets #msg's site for cookies {@link URI}
		 * @returns the #msg's site for cookies {@link URI}
		 */
		get_site_for_cookies(): URI;
		/**
		 * If #msg is associated with a {@link Request}, this returns that
		 * request. Otherwise it returns %NULL.
		 * @returns #msg's associated {@link Request}
		 */
		get_soup_request(): Request;
		/**
		 * Gets #msg's URI
		 * @returns the URI #msg is targeted for.
		 */
		get_uri(): URI;
		got_body(): void;
		got_chunk(chunk: Buffer): void;
		got_headers(): void;
		got_informational(): void;
		/**
		 * Get whether {@link SessionFeature}<!-- -->s of the given #feature_type
		 * (or a subclass of that type) are disabled on #msg.
		 * See {@link Soup.Message.disable_feature}.
		 * @param feature_type the #GType of a {@link SessionFeature}
		 * @returns %TRUE if feature is disabled, or %FALSE otherwise.
		 */
		is_feature_disabled(feature_type: GObject.Type): boolean;
		/**
		 * Determines whether or not #msg's connection can be kept alive for
		 * further requests after processing #msg, based on the HTTP version,
		 * Connection header, etc.
		 * @returns %TRUE or %FALSE.
		 */
		is_keepalive(): boolean;
		restarted(): void;
		/**
		 * @deprecated
		 * {@link Request} provides a much simpler API that lets you
		 * read the response directly into your own buffers without needing to
		 * mess with callbacks, pausing/unpausing, etc.
		 * 
		 * Sets an alternate chunk-allocation function to use when reading
		 * #msg's body when using the traditional (ie,
		 * non-{@link Request}<!-- -->-based) API. Every time data is available
		 * to read, libsoup will call #allocator, which should return a
		 * #SoupBuffer. (See #SoupChunkAllocator for additional details.)
		 * Libsoup will then read data from the network into that buffer, and
		 * update the buffer's <literal>length</literal> to indicate how much
		 * data it read.
		 * 
		 * Generally, a custom chunk allocator would be used in conjunction
		 * with {@link Soup.MessageBody.set_accumulate} %FALSE and
		 * #SoupMessage::got_chunk, as part of a strategy to avoid unnecessary
		 * copying of data. However, you cannot assume that every call to the
		 * allocator will be followed by a call to your
		 * #SoupMessage::got_chunk handler; if an I/O error occurs, then the
		 * buffer will be unreffed without ever having been used. If your
		 * buffer-allocation strategy requires special cleanup, use
		 * soup_buffer_new_with_owner() rather than doing the cleanup from the
		 * #SoupMessage::got_chunk handler.
		 * 
		 * The other thing to remember when using non-accumulating message
		 * bodies is that the buffer passed to the #SoupMessage::got_chunk
		 * handler will be unreffed after the handler returns, just as it
		 * would be in the non-custom-allocated case. If you want to hand the
		 * chunk data off to some other part of your program to use later,
		 * you'll need to ref the #SoupBuffer (or its owner, in the
		 * soup_buffer_new_with_owner() case) to ensure that the data remains
		 * valid.
		 * @param allocator the chunk allocator callback
		 * @param destroy_notify destroy notifier to free #user_data when #msg is
		 * destroyed
		 */
		set_chunk_allocator(allocator: ChunkAllocator, destroy_notify: GLib.DestroyNotify): void;
		/**
		 * Sets #first_party as the main document {@link URI} for #msg. For
		 * details of when and how this is used refer to the documentation for
		 * #SoupCookieJarAcceptPolicy.
		 * @param first_party the {@link URI} for the #msg's first party
		 */
		set_first_party(first_party: URI): void;
		/**
		 * Sets the specified flags on #msg.
		 * @param flags a set of {@link MessageFlags} values
		 */
		set_flags(flags: MessageFlags): void;
		/**
		 * Sets the HTTP version on #msg. The default version is
		 * %SOUP_HTTP_1_1. Setting it to %SOUP_HTTP_1_0 will prevent certain
		 * functionality from being used.
		 * @param version the HTTP version
		 */
		set_http_version(version: HTTPVersion): void;
		/**
		 * See the [same-site spec](https://tools.ietf.org/html/draft-ietf-httpbis-cookie-same-site-00)
		 * for more information.
		 * @param is_top_level_navigation if %TRUE indicate the current request is a top-level navigation
		 */
		set_is_top_level_navigation(is_top_level_navigation: boolean): void;
		/**
		 * Sets the priority of a message. Note that this won't have any
		 * effect unless used before the message is added to the session's
		 * message processing queue.
		 * 
		 * The message will be placed just before any other previously added
		 * message with lower priority (messages with the same priority are
		 * processed on a FIFO basis).
		 * 
		 * Setting priorities does not currently work with {@link SessionSync}
		 * (or with synchronous messages on a plain #SoupSession) because in
		 * the synchronous/blocking case, priority ends up being determined
		 * semi-randomly by thread scheduling.
		 * @param priority the {@link MessagePriority}
		 */
		set_priority(priority: MessagePriority): void;
		/**
		 * Sets #msg's status_code to #status_code and adds a Location header
		 * pointing to #redirect_uri. Use this from a {@link Server} when you
		 * want to redirect the client to another URI.
		 * 
		 * #redirect_uri can be a relative URI, in which case it is
		 * interpreted relative to #msg's current URI. In particular, if
		 * #redirect_uri is just a path, it will replace the path
		 * <emphasis>and query</emphasis> of #msg's URI.
		 * @param status_code a 3xx status code
		 * @param redirect_uri the URI to redirect #msg to
		 */
		set_redirect(status_code: number, redirect_uri: string): void;
		/**
		 * Convenience function to set the request body of a {@link Message}. If
		 * #content_type is %NULL, the request body must be empty as well.
		 * @param content_type MIME Content-Type of the body
		 * @param req_use a {@link MemoryUse} describing how to handle #req_body
		 * @param req_body 
		 *   a data buffer containing the body of the message request.
		 * @param req_length the byte length of #req_body.
		 */
		set_request(content_type: string | null, req_use: MemoryUse, req_body: number[] | null, req_length: number): void;
		/**
		 * Convenience function to set the response body of a {@link Message}. If
		 * #content_type is %NULL, the response body must be empty as well.
		 * @param content_type MIME Content-Type of the body
		 * @param resp_use a {@link MemoryUse} describing how to handle #resp_body
		 * @param resp_body 
		 *   a data buffer containing the body of the message response.
		 */
		set_response(content_type: string | null, resp_use: MemoryUse, resp_body: string | ByteArray): void;
		/**
		 * Sets #site_for_cookies as the policy URL for same-site cookies for #msg.
		 * 
		 * It is either the URL of the top-level document or %NULL depending on whether the registrable
		 * domain of this document's URL matches the registrable domain of its parent's/opener's
		 * URL. For the top-level document it is set to the document's URL.
		 * 
		 * See the [same-site spec](https://tools.ietf.org/html/draft-ietf-httpbis-cookie-same-site-00)
		 * for more information.
		 * @param site_for_cookies the {@link URI} for the #msg's site for cookies
		 */
		set_site_for_cookies(site_for_cookies: URI | null): void;
		/**
		 * Sets #msg's status code to #status_code. If #status_code is a
		 * known value, it will also set #msg's reason_phrase.
		 * @param status_code an HTTP status code
		 */
		set_status(status_code: number): void;
		/**
		 * Sets #msg's status code and reason phrase.
		 * @param status_code an HTTP status code
		 * @param reason_phrase a description of the status
		 */
		set_status_full(status_code: number, reason_phrase: string): void;
		/**
		 * Sets #msg's URI to #uri. If #msg has already been sent and you want
		 * to re-send it with the new URI, you need to call
		 * {@link Soup.Session.requeue_message}.
		 * @param uri the new {@link URI}
		 */
		set_uri(uri: URI): void;
		starting(): void;
		wrote_body(): void;
		wrote_body_data(chunk: Buffer): void;
		wrote_chunk(): void;
		wrote_headers(): void;
		wrote_informational(): void;
		/**
		 * This signal is emitted after {@link Message.got_headers}, and
		 * before the first #SoupMessage::got-chunk. If content
		 * sniffing is disabled, or no content sniffing will be
		 * performed, due to the sniffer deciding to trust the
		 * Content-Type sent by the server, this signal is emitted
		 * immediately after #SoupMessage::got-headers, and #type is
		 * %NULL.
		 * 
		 * If the #SoupContentSniffer feature is enabled, and the
		 * sniffer decided to perform sniffing, the first
		 * #SoupMessage::got-chunk emission may be delayed, so that the
		 * sniffer has enough data to correctly sniff the content. It
		 * notified the library user that the content has been
		 * sniffed, and allows it to change the header contents in the
		 * message, if desired.
		 * 
		 * After this signal is emitted, the data that was spooled so
		 * that sniffing could be done is delivered on the first
		 * emission of #SoupMessage::got-chunk.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - type: the content type that we got from sniffing 
		 *  - params: a #GHashTable with the parameters 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "content-sniffed", callback: (owner: this, type: string, params: string[]) => void): number;
		/**
		 * Emitted when all HTTP processing is finished for a message.
		 * (After {@link Message.got_body} for client-side messages, or
		 * after #SoupMessage::wrote_body for server-side messages.)
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "finished", callback: (owner: this) => void): number;
		/**
		 * Emitted after receiving the complete message body. (For a
		 * server-side message, this means it has received the request
		 * body. For a client-side message, this means it has received
		 * the response body and is nearly done with the message.)
		 * 
		 * See also {@link Soup.Message.add_header_handler} and
		 * soup_message_add_status_code_handler(), which can be used
		 * to connect to a subset of emissions of this signal.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "got-body", callback: (owner: this) => void): number;
		/**
		 * Emitted after receiving a chunk of a message body. Note
		 * that "chunk" in this context means any subpiece of the
		 * body, not necessarily the specific HTTP 1.1 chunks sent by
		 * the other side.
		 * 
		 * If you cancel or requeue #msg while processing this signal,
		 * then the current HTTP I/O will be stopped after this signal
		 * emission finished, and #msg's connection will be closed.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - chunk: the just-read chunk 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "got-chunk", callback: (owner: this, chunk: Buffer) => void): number;
		/**
		 * Emitted after receiving all message headers for a message.
		 * (For a client-side message, this is after receiving the
		 * Status-Line and response headers; for a server-side
		 * message, it is after receiving the Request-Line and request
		 * headers.)
		 * 
		 * See also {@link Soup.Message.add_header_handler} and
		 * soup_message_add_status_code_handler(), which can be used
		 * to connect to a subset of emissions of this signal.
		 * 
		 * If you cancel or requeue #msg while processing this signal,
		 * then the current HTTP I/O will be stopped after this signal
		 * emission finished, and #msg's connection will be closed.
		 * (If you need to requeue a message--eg, after handling
		 * authentication or redirection--it is usually better to
		 * requeue it from a {@link Message.got_body} handler rather
		 * than a #SoupMessage::got_headers handler, so that the
		 * existing HTTP connection can be reused.)
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "got-headers", callback: (owner: this) => void): number;
		/**
		 * Emitted after receiving a 1xx (Informational) response for
		 * a (client-side) message. The response_headers will be
		 * filled in with the headers associated with the
		 * informational response; however, those header values will
		 * be erased after this signal is done.
		 * 
		 * If you cancel or requeue #msg while processing this signal,
		 * then the current HTTP I/O will be stopped after this signal
		 * emission finished, and #msg's connection will be closed.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "got-informational", callback: (owner: this) => void): number;
		/**
		 * Emitted to indicate that some network-related event
		 * related to #msg has occurred. This essentially proxies the
		 * #GSocketClient::event signal, but only for events that
		 * occur while #msg "owns" the connection; if #msg is sent on
		 * an existing persistent connection, then this signal will
		 * not be emitted. (If you want to force the message to be
		 * sent on a new connection, set the
		 * %SOUP_MESSAGE_NEW_CONNECTION flag on it.)
		 * 
		 * See #GSocketClient::event for more information on what
		 * the different values of #event correspond to, and what
		 * #connection will be in each case.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - event: the network event 
		 *  - connection: the current state of the network connection 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "network-event", callback: (owner: this, event: Gio.SocketClientEvent, connection: Gio.IOStream) => void): number;
		/**
		 * Emitted when a request that was already sent once is now
		 * being sent again (eg, because the first attempt received a
		 * redirection response, or because we needed to use
		 * authentication).
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "restarted", callback: (owner: this) => void): number;
		/**
		 * Emitted just before a message is sent.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "starting", callback: (owner: this) => void): number;
		/**
		 * Emitted immediately after writing the complete body for a
		 * message. (For a client-side message, this means that
		 * libsoup is done writing and is now waiting for the response
		 * from the server. For a server-side message, this means that
		 * libsoup has finished writing the response and is nearly
		 * done with the message.)
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "wrote-body", callback: (owner: this) => void): number;
		/**
		 * Emitted immediately after writing a portion of the message
		 * body to the network.
		 * 
		 * Unlike {@link Message.wrote_chunk}, this is emitted after
		 * every successful write() call, not only after finishing a
		 * complete "chunk".
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - chunk: the data written 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "wrote-body-data", callback: (owner: this, chunk: Buffer) => void): number;
		/**
		 * Emitted immediately after writing a body chunk for a message.
		 * 
		 * Note that this signal is not parallel to
		 * {@link Message.got_chunk}; it is emitted only when a complete
		 * chunk (added with {@link Soup.MessageBody.append} or
		 * soup_message_body_append_buffer()) has been written. To get
		 * more useful continuous progress information, use
		 * #SoupMessage::wrote_body_data.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "wrote-chunk", callback: (owner: this) => void): number;
		/**
		 * Emitted immediately after writing the headers for a
		 * message. (For a client-side message, this is after writing
		 * the request headers; for a server-side message, it is after
		 * writing the response headers.)
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "wrote-headers", callback: (owner: this) => void): number;
		/**
		 * Emitted immediately after writing a 1xx (Informational)
		 * response for a (server-side) message.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "wrote-informational", callback: (owner: this) => void): number;

		connect(signal: "notify::first-party", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::flags", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::http-version", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::is-top-level-navigation", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::method", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::priority", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::reason-phrase", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::request-body", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::request-body-data", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::request-headers", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::response-body", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::response-body-data", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::response-headers", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::server-side", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::site-for-cookies", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::status-code", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::tls-certificate", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::tls-errors", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::uri", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::method", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::status_code", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::reason_phrase", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::request_body", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::request_headers", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::response_body", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::response_headers", callback: (owner: this, ...args: any) => void): number;

	}

	type MessageInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IMessage,
		"first_party" |
		"flags" |
		"http_version" |
		"is_top_level_navigation" |
		"method" |
		"priority" |
		"reason_phrase" |
		"server_side" |
		"site_for_cookies" |
		"status_code" |
		"tls_certificate" |
		"tls_errors" |
		"uri">;

	export interface MessageInitOptions extends MessageInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Message} instead.
	 */
	type MessageMixin = IMessage & GObject.Object;

	/**
	 * Represents an HTTP message being sent or received.
	 * 
	 * #status_code will normally be a {@link Status} value, eg,
	 * %SOUP_STATUS_OK, though of course it might actually be an unknown
	 * status code. #reason_phrase is the actual text returned from the
	 * server, which may or may not correspond to the "standard"
	 * description of #status_code. At any rate, it is almost certainly
	 * not localized, and not very descriptive even if it is in the user's
	 * language; you should not use #reason_phrase in user-visible
	 * messages. Rather, you should look at #status_code, and determine an
	 * end-user-appropriate message based on that and on what you were
	 * trying to do.
	 * 
	 * As described in the #SoupMessageBody documentation, the
	 * #request_body and #response_body <literal>data</literal> fields
	 * will not necessarily be filled in at all times. When the body
	 * fields are filled in, they will be terminated with a '\0' byte
	 * (which is not included in the <literal>length</literal>), so you
	 * can use them as ordinary C strings (assuming that you know that the
	 * body doesn't have any other '\0' bytes).
	 * 
	 * For a client-side #SoupMessage, #request_body's
	 * <literal>data</literal> is usually filled in right before libsoup
	 * writes the request to the network, but you should not count on
	 * this; use {@link Soup.MessageBody.flatten} if you want to ensure that
	 * <literal>data</literal> is filled in. If you are not using
	 * #SoupRequest to read the response, then #response_body's
	 * <literal>data</literal> will be filled in before
	 * #SoupMessage::finished is emitted. (If you are using #SoupRequest,
	 * then the message body is not accumulated by default, so
	 * #response_body's <literal>data</literal> will always be %NULL.)
	 * 
	 * For a server-side #SoupMessage, #request_body's %data will be
	 * filled in before #SoupMessage::got_body is emitted.
	 * 
	 * To prevent the %data field from being filled in at all (eg, if you
	 * are handling the data from a #SoupMessage::got_chunk, and so don't
	 * need to see it all at the end), call
	 * soup_message_body_set_accumulate() on #response_body or
	 * #request_body as appropriate, passing %FALSE.
	 */
	interface Message extends MessageMixin {}

	class Message {
		public constructor(options?: Partial<MessageInitOptions>);
		/**
		 * Creates a new empty {@link Message}, which will connect to #uri
		 * @param method the HTTP method for the created request
		 * @param uri_string the destination endpoint (as a string)
		 * @returns the new {@link Message} (or %NULL if #uri
		 * could not be parsed).
		 */
		public static new(method: string, uri_string: string): Message | null;
		/**
		 * Creates a new empty {@link Message}, which will connect to #uri
		 * @param method the HTTP method for the created request
		 * @param uri the destination endpoint (as a {@link URI})
		 * @returns the new {@link Message}
		 */
		public static new_from_uri(method: string, uri: URI): Message;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MultipartInputStream} instead.
	 */
	interface IMultipartInputStream {
		message: Message;
		/**
		 * Obtains the headers for the part currently being processed. Note
		 * that the {@link MessageHeaders} that are returned are owned by the
		 * #SoupMultipartInputStream and will be replaced when a call is made
		 * to {@link Soup.MultipartInputStream.next_part} or its async
		 * counterpart, so if keeping the headers is required, a copy must be
		 * made.
		 * 
		 * Note that if a part had no headers at all an empty #SoupMessageHeaders
		 * will be returned.
		 * @returns a {@link MessageHeaders}
		 * containing the headers for the part currently being processed or
		 * %NULL if the headers failed to parse.
		 */
		get_headers(): MessageHeaders | null;
		/**
		 * Obtains an input stream for the next part. When dealing with a
		 * multipart response the input stream needs to be wrapped in a
		 * {@link MultipartInputStream} and this function or its async
		 * counterpart need to be called to obtain the first part for
		 * reading.
		 * 
		 * After calling this function,
		 * {@link Soup.MultipartInputStream.get_headers} can be used to obtain the
		 * headers for the first part. A read of 0 bytes indicates the end of
		 * the part; a new call to this function should be done at that point,
		 * to obtain the next part.
		 * @param cancellable a #GCancellable
		 * @returns a new #GInputStream, or
		 * %NULL if there are no more parts
		 */
		next_part(cancellable: Gio.Cancellable | null): Gio.InputStream | null;
		/**
		 * Obtains a #GInputStream for the next request. See
		 * {@link Soup.MultipartInputStream.next_part} for details on the
		 * workflow.
		 * @param io_priority the I/O priority for the request.
		 * @param cancellable a #GCancellable.
		 * @param callback callback to call when request is satisfied.
		 * @param data data for #callback
		 */
		next_part_async(io_priority: number, cancellable: Gio.Cancellable | null, callback: Gio.AsyncReadyCallback | null, data: any | null): void;
		/**
		 * Finishes an asynchronous request for the next part.
		 * @param result a #GAsyncResult.
		 * @returns a newly created
		 * #GInputStream for reading the next part or %NULL if there are no
		 * more parts.
		 */
		next_part_finish(result: Gio.AsyncResult): Gio.InputStream | null;
		connect(signal: "notify::message", callback: (owner: this, ...args: any) => void): number;

	}

	type MultipartInputStreamInitOptionsMixin = Gio.FilterInputStreamInitOptions & Gio.PollableInputStreamInitOptions & 
	Pick<IMultipartInputStream,
		"message">;

	export interface MultipartInputStreamInitOptions extends MultipartInputStreamInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MultipartInputStream} instead.
	 */
	type MultipartInputStreamMixin = IMultipartInputStream & Gio.FilterInputStream & Gio.PollableInputStream;

	interface MultipartInputStream extends MultipartInputStreamMixin {}

	class MultipartInputStream {
		public constructor(options?: Partial<MultipartInputStreamInitOptions>);
		/**
		 * Creates a new {@link MultipartInputStream} that wraps the
		 * #GInputStream obtained by sending the #SoupRequest. Reads should
		 * not be done directly through this object, use the input streams
		 * returned by {@link Soup.MultipartInputStream.next_part} or its async
		 * counterpart instead.
		 * @param msg the {@link Message} the response is related to.
		 * @param base_stream the #GInputStream returned by sending the request.
		 * @returns a new {@link MultipartInputStream}
		 */
		public static new(msg: Message, base_stream: Gio.InputStream): MultipartInputStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ProxyResolverDefault} instead.
	 */
	interface IProxyResolverDefault {

	}

	type ProxyResolverDefaultInitOptionsMixin = GObject.ObjectInitOptions & ProxyURIResolverInitOptions & SessionFeatureInitOptions
	export interface ProxyResolverDefaultInitOptions extends ProxyResolverDefaultInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ProxyResolverDefault} instead.
	 */
	type ProxyResolverDefaultMixin = IProxyResolverDefault & GObject.Object & ProxyURIResolver & SessionFeature;

	interface ProxyResolverDefault extends ProxyResolverDefaultMixin {}

	class ProxyResolverDefault {
		public constructor(options?: Partial<ProxyResolverDefaultInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Request} instead.
	 */
	interface IRequest {
		/**
		 * The request's {@link Session}.
		 */
		session: Session;
		/**
		 * The request URI.
		 */
		uri: URI;
		/**
		 * Gets the length of the data represented by #request. For most
		 * request types, this will not be known until after you call
		 * {@link Soup.Request.send} or soup_request_send_finish().
		 * @returns the length of the data represented by #request,
		 *   or -1 if not known.
		 */
		get_content_length(): number;
		/**
		 * Gets the type of the data represented by #request. For most request
		 * types, this will not be known until after you call
		 * {@link Soup.Request.send} or soup_request_send_finish().
		 * 
		 * As in the HTTP Content-Type header, this may include parameters
		 * after the MIME type.
		 * @returns the type of the data represented by
		 *   #request, or %NULL if not known.
		 */
		get_content_type(): string | null;
		/**
		 * Gets #request's {@link Session}
		 * @returns #request's {@link Session}
		 */
		get_session(): Session;
		/**
		 * Gets #request's URI
		 * @returns #request's URI
		 */
		get_uri(): URI;
		/**
		 * Synchronously requests the URI pointed to by #request, and returns
		 * a #GInputStream that can be used to read its contents.
		 * 
		 * Note that you cannot use this method with {@link Requests} attached to
		 * a #SoupSessionAsync.
		 * @param cancellable a #GCancellable or %NULL
		 * @returns a #GInputStream that can be used to
		 *   read from the URI pointed to by #request.
		 */
		send(cancellable: Gio.Cancellable | null): Gio.InputStream;
		/**
		 * Begins an asynchronously request for the URI pointed to by
		 * #request.
		 * 
		 * Note that you cannot use this method with {@link Requests} attached to
		 * a #SoupSessionSync.
		 * @param cancellable a #GCancellable or %NULL
		 * @param callback a #GAsyncReadyCallback
		 */
		send_async(cancellable: Gio.Cancellable | null, callback: Gio.AsyncReadyCallback | null): void;
		/**
		 * Gets the result of a {@link Soup.Request.send_async}.
		 * @param result the #GAsyncResult
		 * @returns a #GInputStream that can be used to
		 *   read from the URI pointed to by #request.
		 */
		send_finish(result: Gio.AsyncResult): Gio.InputStream;
		connect(signal: "notify::session", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::uri", callback: (owner: this, ...args: any) => void): number;

	}

	type RequestInitOptionsMixin = GObject.ObjectInitOptions & Gio.InitableInitOptions & 
	Pick<IRequest,
		"session" |
		"uri">;

	export interface RequestInitOptions extends RequestInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Request} instead.
	 */
	type RequestMixin = IRequest & GObject.Object & Gio.Initable;

	/**
	 * A request to retrieve a particular URI.
	 */
	interface Request extends RequestMixin {}

	class Request {
		public constructor(options?: Partial<RequestInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RequestData} instead.
	 */
	interface IRequestData {

	}

	type RequestDataInitOptionsMixin = RequestInitOptions & Gio.InitableInitOptions
	export interface RequestDataInitOptions extends RequestDataInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RequestData} instead.
	 */
	type RequestDataMixin = IRequestData & Request & Gio.Initable;

	interface RequestData extends RequestDataMixin {}

	class RequestData {
		public constructor(options?: Partial<RequestDataInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RequestFile} instead.
	 */
	interface IRequestFile {
		/**
		 * Gets a #GFile corresponding to #file's URI
		 * @returns a #GFile corresponding to #file
		 */
		get_file(): Gio.File;
	}

	type RequestFileInitOptionsMixin = RequestInitOptions & Gio.InitableInitOptions
	export interface RequestFileInitOptions extends RequestFileInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RequestFile} instead.
	 */
	type RequestFileMixin = IRequestFile & Request & Gio.Initable;

	interface RequestFile extends RequestFileMixin {}

	class RequestFile {
		public constructor(options?: Partial<RequestFileInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RequestHTTP} instead.
	 */
	interface IRequestHTTP {
		/**
		 * Gets a new reference to the {@link Message} associated to this SoupRequest
		 * @returns a new reference to the {@link Message}
		 */
		get_message(): Message;
	}

	type RequestHTTPInitOptionsMixin = RequestInitOptions & Gio.InitableInitOptions
	export interface RequestHTTPInitOptions extends RequestHTTPInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link RequestHTTP} instead.
	 */
	type RequestHTTPMixin = IRequestHTTP & Request & Gio.Initable;

	interface RequestHTTP extends RequestHTTPMixin {}

	class RequestHTTP {
		public constructor(options?: Partial<RequestHTTPInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Requester} instead.
	 */
	interface IRequester {
		request(uri_string: string): Request;
		request_uri(uri: URI): Request;
	}

	type RequesterInitOptionsMixin = GObject.ObjectInitOptions & SessionFeatureInitOptions
	export interface RequesterInitOptions extends RequesterInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Requester} instead.
	 */
	type RequesterMixin = IRequester & GObject.Object & SessionFeature;

	interface Requester extends RequesterMixin {}

	class Requester {
		public constructor(options?: Partial<RequesterInitOptions>);
		public static new(): Requester;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Server} instead.
	 */
	interface IServer {
		/**
		 * @deprecated
		 * The new API uses the thread-default #GMainContext
		 * rather than having an explicitly-specified one.
		 * 
		 * The server's #GMainContext, if you are using the old API.
		 * Servers created using {@link Soup.Server.listen} will listen on
		 * the #GMainContext that was the thread-default context at
		 * the time soup_server_listen() was called.
		 */
		async_context: any;
		/**
		 * A %NULL-terminated array of URI schemes that should be
		 * considered to be aliases for "http". Eg, if this included
		 * <literal>"dav"</literal>, than a URI of
		 * <literal>dav://example.com/path</literal> would be treated
		 * identically to <literal>http://example.com/path</literal>.
		 * In particular, this is needed in cases where a client
		 * sends requests with absolute URIs, where those URIs do
		 * not use "http:".
		 * 
		 * The default value is an array containing the single element
		 * <literal>"*"</literal>, a special value which means that
		 * any scheme except "https" is considered to be an alias for
		 * "http".
		 * 
		 * See also {@link Server.https_aliases}.
		 */
		http_aliases: string[];
		/**
		 * A comma-delimited list of URI schemes that should be
		 * considered to be aliases for "https". See
		 * {@link Server.http_aliases} for more information.
		 * 
		 * The default value is %NULL, meaning that no URI schemes
		 * are considered aliases for "https".
		 */
		https_aliases: string[];
		/**
		 * @deprecated
		 * {@link Servers} can listen on multiple interfaces
		 * at once now. Use {@link Soup.Server.listen}, etc, to listen on an
		 * interface, and soup_server_get_uris() to see what addresses
		 * are being listened on.
		 * 
		 * The address of the network interface the server is
		 * listening on, if you are using the old {@link Server} API.
		 * (This will not be set if you use {@link Soup.Server.listen},
		 * etc.)
		 */
		interface: Address;
		/**
		 * @deprecated
		 * {@link Servers} can listen on multiple interfaces
		 * at once now. Use {@link Soup.Server.listen}, etc, to listen on a
		 * port, and soup_server_get_uris() to see what ports are
		 * being listened on.
		 * 
		 * The port the server is listening on, if you are using the
		 * old {@link Server} API. (This will not be set if you use
		 * {@link Soup.Server.listen}, etc.)
		 */
		port: number;
		raw_paths: boolean;
		/**
		 * If non-%NULL, the value to use for the "Server" header on
		 * {@link Message}<!-- -->s processed by this server.
		 * 
		 * The Server header is the server equivalent of the
		 * User-Agent header, and provides information about the
		 * server and its components. It contains a list of one or
		 * more product tokens, separated by whitespace, with the most
		 * significant product token coming first. The tokens must be
		 * brief, ASCII, and mostly alphanumeric (although "-", "_",
		 * and "." are also allowed), and may optionally include a "/"
		 * followed by a version string. You may also put comments,
		 * enclosed in parentheses, between or after the tokens.
		 * 
		 * Some HTTP server implementations intentionally do not use
		 * version numbers in their Server header, so that
		 * installations running older versions of the server don't
		 * end up advertising their vulnerability to specific security
		 * holes.
		 * 
		 * As with #SoupSession:user_agent, if you set a
		 * #SoupServer:server_header property that has trailing whitespace,
		 * #SoupServer will append its own product token (eg,
		 * "<literal>libsoup/2.3.2</literal>") to the end of the
		 * header for you.
		 */
		server_header: string;
		/**
		 * @deprecated
		 * use {@link Server.tls_certificate} or
		 * {@link Soup.Server.set_ssl_certificate}.
		 * 
		 * Path to a file containing a PEM-encoded certificate.
		 * 
		 * If you set this property and {@link Server.ssl_key_file} at
		 * construct time, then {@link Soup.Server.new} will try to read the
		 * files; if it cannot, it will return %NULL, with no explicit
		 * indication of what went wrong (and logging a warning with
		 * newer versions of glib, since returning %NULL from a
		 * constructor is illegal).
		 */
		ssl_cert_file: string;
		/**
		 * @deprecated
		 * use {@link Server.tls_certificate} or
		 * {@link Soup.Server.set_ssl_certificate}.
		 * 
		 * Path to a file containing a PEM-encoded private key. See
		 * {@link Server.ssl_cert_file} for more information about how this
		 * is used.
		 */
		ssl_key_file: string;
		/**
		 * A #GTlsCertificate that has a #GTlsCertificate:private-key
		 * set. If this is set, then the server will be able to speak
		 * https in addition to (or instead of) plain http.
		 * 
		 * Alternatively, you can call {@link Soup.Server.set_ssl_cert_file}
		 * to have {@link Server} read in a a certificate from a file.
		 */
		tls_certificate: Gio.TlsCertificate;
		/**
		 * Add a new client stream to the #server.
		 * @param stream a #GIOStream
		 * @param local_addr the local #GSocketAddress associated with the #stream
		 * @param remote_addr the remote #GSocketAddress associated with the #stream
		 * @returns %TRUE on success, %FALSE if the stream could not be
		 * accepted or any other error occurred (in which case #error will be
		 * set).
		 */
		accept_iostream(stream: Gio.IOStream, local_addr: Gio.SocketAddress | null, remote_addr: Gio.SocketAddress | null): boolean;
		/**
		 * Adds an authentication domain to #server. Each auth domain will
		 * have the chance to require authentication for each request that
		 * comes in; normally auth domains will require authentication for
		 * requests on certain paths that they have been set up to watch, or
		 * that meet other criteria set by the caller. If an auth domain
		 * determines that a request requires authentication (and the request
		 * doesn't contain authentication), #server will automatically reject
		 * the request with an appropriate status (401 Unauthorized or 407
		 * Proxy Authentication Required). If the request used the
		 * "100-continue" Expectation, #server will reject it before the
		 * request body is sent.
		 * @param auth_domain a {@link AuthDomain}
		 */
		add_auth_domain(auth_domain: AuthDomain): void;
		/**
		 * Adds an "early" handler to #server for requests under #path. Note
		 * that "normal" and "early" handlers are matched up together, so if
		 * you add a normal handler for "/foo" and an early handler for
		 * "/foo/bar", then a request to "/foo/bar" (or any path below it)
		 * will run only the early handler. (But if you add both handlers at
		 * the same path, then both will get run.)
		 * 
		 * For requests under #path (that have not already been assigned a
		 * status code by a {@link AuthDomain} or a signal handler), #callback
		 * will be invoked after receiving the request headers, but before
		 * receiving the request body; the message's #SoupMessage:method and
		 * #SoupMessage:request-headers fields will be filled in.
		 * 
		 * Early handlers are generally used for processing requests with
		 * request bodies in a streaming fashion. If you determine that the
		 * request will contain a message body, normally you would call
		 * {@link Soup.MessageBody.set_accumulate} on the message's
		 * #SoupMessage:request-body to turn off request-body accumulation,
		 * and connect to the message's #SoupMessage::got-chunk signal to
		 * process each chunk as it comes in.
		 * 
		 * To complete the message processing after the full message body has
		 * been read, you can either also connect to #SoupMessage::got-body,
		 * or else you can register a non-early handler for #path as well. As
		 * long as you have not set the #SoupMessage:status-code by the time
		 * #SoupMessage::got-body is emitted, the non-early handler will be
		 * run as well.
		 * @param path the toplevel path for the handler
		 * @param callback callback to invoke for requests under #path
		 * @param destroy destroy notifier to free #user_data
		 */
		add_early_handler(path: string | null, callback: ServerCallback, destroy: GLib.DestroyNotify): void;
		/**
		 * Adds a handler to #server for requests under #path. If #path is
		 * %NULL or "/", then this will be the default handler for all
		 * requests that don't have a more specific handler. (Note though that
		 * if you want to handle requests to the special "*" URI, you must
		 * explicitly register a handler for "*"; the default handler will not
		 * be used for that case.)
		 * 
		 * For requests under #path (that have not already been assigned a
		 * status code by a {@link AuthDomain}, an early #SoupServerHandler, or a
		 * signal handler), #callback will be invoked after receiving the
		 * request body; the message's #SoupMessage:method,
		 * #SoupMessage:request-headers, and #SoupMessage:request-body fields
		 * will be filled in.
		 * 
		 * After determining what to do with the request, the callback must at
		 * a minimum call {@link Soup.Message.set_status} (or
		 * soup_message_set_status_full()) on the message to set the response
		 * status code. Additionally, it may set response headers and/or fill
		 * in the response body.
		 * 
		 * If the callback cannot fully fill in the response before returning
		 * (eg, if it needs to wait for information from a database, or
		 * another network server), it should call soup_server_pause_message()
		 * to tell #server to not send the response right away. When the
		 * response is ready, call soup_server_unpause_message() to cause it
		 * to be sent.
		 * 
		 * To send the response body a bit at a time using "chunked" encoding,
		 * first call soup_message_headers_set_encoding() to set
		 * %SOUP_ENCODING_CHUNKED on the #SoupMessage:response-headers. Then call
		 * soup_message_body_append() (or soup_message_body_append_buffer())
		 * to append each chunk as it becomes ready, and
		 * soup_server_unpause_message() to make sure it's running. (The
		 * server will automatically pause the message if it is using chunked
		 * encoding but no more chunks are available.) When you are done, call
		 * soup_message_body_complete() to indicate that no more chunks are
		 * coming.
		 * @param path the toplevel path for the handler
		 * @param callback callback to invoke for requests under #path
		 */
		add_handler(path: string | null, callback: ServerCallback): void;
		/**
		 * Add support for a WebSocket extension of the given #extension_type.
		 * When a WebSocket client requests an extension of #extension_type,
		 * a new {@link WebsocketExtension} of type #extension_type will be created
		 * to handle the request.
		 * 
		 * You can also add support for a WebSocket extension to the server at
		 * construct time by using the %SOUP_SERVER_ADD_WEBSOCKET_EXTENSION property.
		 * Note that #SoupWebsocketExtensionDeflate is supported by default, use
		 * {@link Soup.Server.remove_websocket_extension} if you want to disable it.
		 * @param extension_type a #GType
		 */
		add_websocket_extension(extension_type: GObject.Type): void;
		/**
		 * Adds a WebSocket handler to #server for requests under #path. (If
		 * #path is %NULL or "/", then this will be the default handler for
		 * all requests that don't have a more specific handler.)
		 * 
		 * When a path has a WebSocket handler registered, #server will check
		 * incoming requests for WebSocket handshakes after all other handlers
		 * have run (unless some earlier handler has already set a status code
		 * on the message), and update the request's status, response headers,
		 * and response body accordingly.
		 * 
		 * If #origin is non-%NULL, then only requests containing a matching
		 * "Origin" header will be accepted. If #protocols is non-%NULL, then
		 * only requests containing a compatible "Sec-WebSocket-Protocols"
		 * header will be accepted. More complicated requirements can be
		 * handled by adding a normal handler to #path, and having it perform
		 * whatever checks are needed (possibly calling
		 * {@link Soup.Server.check_websocket_handshake} one or more times), and
		 * setting a failure status code if the handshake should be rejected.
		 * @param path the toplevel path for the handler
		 * @param origin the origin of the connection
		 * @param protocols the protocols
		 *   supported by this handler
		 * @param callback callback to invoke for successful WebSocket requests under #path
		 * @param destroy destroy notifier to free #user_data
		 */
		add_websocket_handler(path: string | null, origin: string | null, protocols: string[] | null, callback: ServerWebsocketCallback, destroy: GLib.DestroyNotify): void;
		/**
		 * Closes and frees #server's listening sockets. If you are using the
		 * old {@link Server} APIs, this also includes the effect of
		 * {@link Soup.Server.quit}.
		 * 
		 * Note that if there are currently requests in progress on #server,
		 * that they will continue to be processed if #server's #GMainContext
		 * is still running.
		 * 
		 * You can call soup_server_listen(), etc, after calling this function
		 * if you want to start listening again.
		 */
		disconnect(): void;
		/**
		 * @deprecated
		 * If you are using {@link Soup.Server.listen}, etc, then
		 * the server listens on the thread-default #GMainContext, and this
		 * property is ignored.
		 * 
		 * Gets #server's async_context, if you are using the old API. (With
		 * the new API, the server runs in the thread's thread-default
		 * #GMainContext, regardless of what this method returns.)
		 * 
		 * This does not add a ref to the context, so you will need to ref it
		 * yourself if you want it to outlive its server.
		 * @returns #server's #GMainContext,
		 * which may be %NULL
		 */
		get_async_context(): GLib.MainContext | null;
		/**
		 * @deprecated
		 * If you are using {@link Soup.Server.listen}, etc, then use
		 * soup_server_get_listeners() to get a list of all listening sockets,
		 * but note that that function returns #GSockets, not {@link Sockets}.
		 * 
		 * Gets #server's listening socket, if you are using the old API.
		 * 
		 * You should treat this socket as read-only; writing to it or
		 * modifiying it may cause #server to malfunction.
		 * @returns the listening socket.
		 */
		get_listener(): Socket;
		/**
		 * Gets #server's list of listening sockets.
		 * 
		 * You should treat these sockets as read-only; writing to or
		 * modifiying any of these sockets may cause #server to malfunction.
		 * 
		 * (Beware that in contrast to the old {@link Soup.Server.get_listener}, this
		 * function returns #GSockets, not {@link Sockets}.)
		 * @returns a
		 * list of listening sockets.
		 */
		get_listeners(): Gio.Socket[];
		/**
		 * @deprecated
		 * If you are using {@link Soup.Server.listen}, etc, then use
		 * soup_server_get_uris() to get a list of all listening addresses.
		 * 
		 * Gets the TCP port that #server is listening on, if you are using
		 * the old API.
		 * @returns the port #server is listening on.
		 */
		get_port(): number;
		/**
		 * Gets a list of URIs corresponding to the interfaces #server is
		 * listening on. These will contain IP addresses, not hostnames, and
		 * will also indicate whether the given listener is http or https.
		 * 
		 * Note that if you used {@link Soup.Server.listen_all}, the returned URIs
		 * will use the addresses <literal>0.0.0.0</literal> and
		 * <literal>::</literal>, rather than actually returning separate URIs
		 * for each interface on the system.
		 * @returns a list of
		 * {@link URIs}, which you must free when you are done with it.
		 */
		get_uris(): URI[];
		/**
		 * Checks whether #server is capable of https.
		 * 
		 * In order for a server to run https, you must call
		 * {@link Soup.Server.set_ssl_cert_file}, or set the
		 * {@link Server.tls_certificate} property, to provide it with a
		 * certificate to use.
		 * 
		 * If you are using the deprecated single-listener APIs, then a return
		 * value of %TRUE indicates that the #SoupServer serves https
		 * exclusively. If you are using soup_server_listen(), etc, then a
		 * %TRUE return value merely indicates that the server is
		 * <emphasis>able</emphasis> to do https, regardless of whether it
		 * actually currently is or not. Use soup_server_get_uris() to see if
		 * it currently has any https listeners.
		 * @returns %TRUE if #server is configured to serve https.
		 */
		is_https(): boolean;
		/**
		 * This attempts to set up #server to listen for connections on
		 * #address.
		 * 
		 * If #options includes %SOUP_SERVER_LISTEN_HTTPS, and #server has
		 * been configured for TLS, then #server will listen for https
		 * connections on this port. Otherwise it will listen for plain http.
		 * 
		 * You may call this method (along with the other "listen" methods)
		 * any number of times on a server, if you want to listen on multiple
		 * ports, or set up both http and https service.
		 * 
		 * After calling this method, #server will begin accepting and
		 * processing connections as soon as the appropriate #GMainContext is
		 * run.
		 * 
		 * Note that {@link Server} never makes use of dual IPv4/IPv6 sockets; if
		 * #address is an IPv6 address, it will only accept IPv6 connections.
		 * You must configure IPv4 listening separately.
		 * @param address the address of the interface to listen on
		 * @param options listening options for this server
		 * @returns %TRUE on success, %FALSE if #address could not be
		 * bound or any other error occurred (in which case #error will be
		 * set).
		 */
		listen(address: Gio.SocketAddress, options: ServerListenOptions): boolean;
		/**
		 * This attempts to set up #server to listen for connections on all
		 * interfaces on the system. (That is, it listens on the addresses
		 * <literal>0.0.0.0</literal> and/or <literal>::</literal>, depending
		 * on whether #options includes %SOUP_SERVER_LISTEN_IPV4_ONLY,
		 * %SOUP_SERVER_LISTEN_IPV6_ONLY, or neither.) If #port is specified,
		 * #server will listen on that port. If it is 0, #server will find an
		 * unused port to listen on. (In that case, you can use
		 * {@link Soup.Server.get_uris} to find out what port it ended up choosing.)
		 * 
		 * See soup_server_listen() for more details.
		 * @param port the port to listen on, or 0
		 * @param options listening options for this server
		 * @returns %TRUE on success, %FALSE if #port could not be bound
		 * or any other error occurred (in which case #error will be set).
		 */
		listen_all(port: number, options: ServerListenOptions): boolean;
		/**
		 * This attempts to set up #server to listen for connections on
		 * #fd.
		 * 
		 * See {@link Soup.Server.listen} for more details.
		 * 
		 * Note that #server will close #fd when you free it or call
		 * soup_server_disconnect().
		 * @param fd the file descriptor of a listening socket
		 * @param options listening options for this server
		 * @returns %TRUE on success, %FALSE if an error occurred (in
		 * which case #error will be set).
		 */
		listen_fd(fd: number, options: ServerListenOptions): boolean;
		/**
		 * This attempts to set up #server to listen for connections on
		 * "localhost" (that is, <literal>127.0.0.1</literal> and/or
		 * <literal>::1</literal>, depending on whether #options includes
		 * %SOUP_SERVER_LISTEN_IPV4_ONLY, %SOUP_SERVER_LISTEN_IPV6_ONLY, or
		 * neither). If #port is specified, #server will listen on that port.
		 * If it is 0, #server will find an unused port to listen on. (In that
		 * case, you can use {@link Soup.Server.get_uris} to find out what port it
		 * ended up choosing.)
		 * 
		 * See soup_server_listen() for more details.
		 * @param port the port to listen on, or 0
		 * @param options listening options for this server
		 * @returns %TRUE on success, %FALSE if #port could not be bound
		 * or any other error occurred (in which case #error will be set).
		 */
		listen_local(port: number, options: ServerListenOptions): boolean;
		/**
		 * This attempts to set up #server to listen for connections on
		 * #socket.
		 * 
		 * See {@link Soup.Server.listen} for more details.
		 * @param socket a listening #GSocket
		 * @param options listening options for this server
		 * @returns %TRUE on success, %FALSE if an error occurred (in
		 * which case #error will be set).
		 */
		listen_socket(socket: Gio.Socket, options: ServerListenOptions): boolean;
		/**
		 * Pauses I/O on #msg. This can be used when you need to return from
		 * the server handler without having the full response ready yet. Use
		 * {@link Soup.Server.unpause_message} to resume I/O.
		 * 
		 * This must only be called on {@link Messages} which were created by the
		 * #SoupServer and are currently doing I/O, such as those passed into a
		 * #SoupServerCallback or emitted in a #SoupServer::request-read signal.
		 * @param msg a {@link Message} associated with #server.
		 */
		pause_message(msg: Message): void;
		/**
		 * @deprecated
		 * When using {@link Soup.Server.listen}, etc, the server will
		 * always listen for connections, and will process them whenever the
		 * thread-default #GMainContext is running.
		 * 
		 * Stops processing for #server, if you are using the old API. Call
		 * this to clean up after {@link Soup.Server.run_async}, or to terminate a
		 * call to soup_server_run().
		 * 
		 * Note that messages currently in progress will continue to be
		 * handled, if the main loop associated with the server is resumed or
		 * kept running.
		 * 
		 * #server is still in a working state after this call; you can start
		 * and stop a server as many times as you want.
		 */
		quit(): void;
		/**
		 * Removes #auth_domain from #server.
		 * @param auth_domain a {@link AuthDomain}
		 */
		remove_auth_domain(auth_domain: AuthDomain): void;
		/**
		 * Removes all handlers (early and normal) registered at #path.
		 * @param path the toplevel path for the handler
		 */
		remove_handler(path: string): void;
		/**
		 * Removes support for WebSocket extension of type #extension_type (or any subclass of
		 * #extension_type) from #server. You can also remove extensions enabled by default
		 * from the server at construct time by using the %SOUP_SERVER_REMOVE_WEBSOCKET_EXTENSION
		 * property.
		 * @param extension_type a #GType
		 */
		remove_websocket_extension(extension_type: GObject.Type): void;
		/**
		 * @deprecated
		 * When using {@link Soup.Server.listen}, etc, the server will
		 * always listen for connections, and will process them whenever the
		 * thread-default #GMainContext is running.
		 * 
		 * Starts #server, if you are using the old API, causing it to listen
		 * for and process incoming connections. Unlike
		 * {@link Soup.Server.run_async}, this creates a #GMainLoop and runs it, and
		 * it will not return until someone calls soup_server_quit() to stop
		 * the server.
		 */
		run(): void;
		/**
		 * @deprecated
		 * When using {@link Soup.Server.listen}, etc, the server will
		 * always listen for connections, and will process them whenever the
		 * thread-default #GMainContext is running.
		 * 
		 * Starts #server, if you are using the old API, causing it to listen
		 * for and process incoming connections.
		 * 
		 * The server runs in #server's #GMainContext. It will not actually
		 * perform any processing unless the appropriate main loop is running.
		 * In the simple case where you did not set the server's
		 * %SOUP_SERVER_ASYNC_CONTEXT property, this means the server will run
		 * whenever the glib main loop is running.
		 */
		run_async(): void;
		/**
		 * Sets #server up to do https, using the SSL/TLS certificate
		 * specified by #ssl_cert_file and #ssl_key_file (which may point to
		 * the same file).
		 * 
		 * Alternatively, you can set the {@link Server.tls_certificate} property
		 * at construction time, if you already have a #GTlsCertificate.
		 * @param ssl_cert_file path to a file containing a PEM-encoded SSL/TLS
		 *   certificate.
		 * @param ssl_key_file path to a file containing a PEM-encoded private key.
		 * @returns success or failure.
		 */
		set_ssl_cert_file(ssl_cert_file: string, ssl_key_file: string): boolean;
		/**
		 * Resumes I/O on #msg. Use this to resume after calling
		 * {@link Soup.Server.pause_message}, or after adding a new chunk to a
		 * chunked response.
		 * 
		 * I/O won't actually resume until you return to the main loop.
		 * 
		 * This must only be called on {@link Messages} which were created by the
		 * #SoupServer and are currently doing I/O, such as those passed into a
		 * #SoupServerCallback or emitted in a #SoupServer::request-read signal.
		 * @param msg a {@link Message} associated with #server.
		 */
		unpause_message(msg: Message): void;
		/**
		 * Emitted when processing has failed for a message; this
		 * could mean either that it could not be read (if
		 * {@link Server.request_read} has not been emitted for it yet),
		 * or that the response could not be written back (if
		 * #SoupServer::request_read has been emitted but
		 * #SoupServer::request_finished has not been).
		 * 
		 * #message is in an undefined state when this signal is
		 * emitted; the signal exists primarily to allow the server to
		 * free any state that it may have allocated in
		 * #SoupServer::request_started.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - message: the message 
		 *  - client: the client context 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "request-aborted", callback: (owner: this, message: Message, client: ClientContext) => void): number;
		/**
		 * Emitted when the server has finished writing a response to
		 * a request.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - message: the message 
		 *  - client: the client context 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "request-finished", callback: (owner: this, message: Message, client: ClientContext) => void): number;
		/**
		 * Emitted when the server has successfully read a request.
		 * #message will have all of its request-side information
		 * filled in, and if the message was authenticated, #client
		 * will have information about that. This signal is emitted
		 * before any (non-early) handlers are called for the message,
		 * and if it sets the message's #status_code, then normal
		 * handler processing will be skipped.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - message: the message 
		 *  - client: the client context 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "request-read", callback: (owner: this, message: Message, client: ClientContext) => void): number;
		/**
		 * Emitted when the server has started reading a new request.
		 * #message will be completely blank; not even the
		 * Request-Line will have been read yet. About the only thing
		 * you can usefully do with it is connect to its signals.
		 * 
		 * If the request is read successfully, this will eventually
		 * be followed by a {@link Server.request_read} signal. If a
		 * response is then sent, the request processing will end with
		 * a #SoupServer::request_finished signal. If a network error
		 * occurs, the processing will instead end with
		 * #SoupServer::request_aborted.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - message: the new message 
		 *  - client: the client context 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "request-started", callback: (owner: this, message: Message, client: ClientContext) => void): number;

		connect(signal: "notify::async-context", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::http-aliases", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::https-aliases", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::interface", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::port", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::raw-paths", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::server-header", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ssl-cert-file", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ssl-key-file", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::tls-certificate", callback: (owner: this, ...args: any) => void): number;

	}

	type ServerInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IServer,
		"async_context" |
		"http_aliases" |
		"https_aliases" |
		"interface" |
		"port" |
		"raw_paths" |
		"server_header" |
		"ssl_cert_file" |
		"ssl_key_file" |
		"tls_certificate">;

	export interface ServerInitOptions extends ServerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Server} instead.
	 */
	type ServerMixin = IServer & GObject.Object;

	interface Server extends ServerMixin {}

	class Server {
		public constructor(options?: Partial<ServerInitOptions>);
		/**
		 * Creates a new {@link Server}. This is exactly equivalent to calling
		 * {@link GObject.new} and specifying %SOUP_TYPE_SERVER as the type.
		 * @param optname1 name of first property to set
		 * @returns a new {@link Server}. If you are using
		 * certain legacy properties, this may also return %NULL if an error
		 * occurs.
		 */
		public static new(optname1: string): Server | null;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Session} instead.
	 */
	interface ISession {
		/**
		 * If non-%NULL, the value to use for the "Accept-Language" header
		 * on {@link Message}<!-- -->s sent from this session.
		 * 
		 * Setting this will disable
		 * #SoupSession:accept-language-auto.
		 */
		accept_language: string;
		/**
		 * If %TRUE, {@link Session} will automatically set the string
		 * for the "Accept-Language" header on every #SoupMessage
		 * sent, based on the return value of {@link G.get_language_names}.
		 * 
		 * Setting this will override any previous value of
		 * #SoupSession:accept-language.
		 */
		accept_language_auto: boolean;
		/**
		 * Add a feature object to the session. (Shortcut for calling
		 * {@link Soup.Session.add_feature}.)
		 */
		// add_feature: SessionFeature;
		/**
		 * Add a feature object of the given type to the session.
		 * (Shortcut for calling {@link Soup.Session.add_feature_by_type}.)
		 */
		// add_feature_by_type: GObject.Type;
		/**
		 * The #GMainContext that miscellaneous session-related
		 * asynchronous callbacks are invoked on. (Eg, setting
		 * {@link Session.idle_timeout} will add a timeout source on this
		 * context.)
		 * 
		 * For a plain #SoupSession, this property is always set to
		 * the #GMainContext that is the thread-default at the time
		 * the session was created, and cannot be overridden. For the
		 * deprecated #SoupSession subclasses, the default value is
		 * %NULL, meaning to use the global default #GMainContext.
		 * 
		 * If #SoupSession:use-thread-context is %FALSE, this context
		 * will also be used for asynchronous HTTP I/O.
		 */
		async_context: any;
		/**
		 * A %NULL-terminated array of URI schemes that should be
		 * considered to be aliases for "http". Eg, if this included
		 * <literal>"dav"</literal>, than a URI of
		 * <literal>dav://example.com/path</literal> would be treated
		 * identically to <literal>http://example.com/path</literal>.
		 * 
		 * In a plain {@link Session}, the default value is %NULL,
		 * meaning that only "http" is recognized as meaning "http".
		 * In #SoupSessionAsync and #SoupSessionSync, for backward
		 * compatibility, the default value is an array containing the
		 * single element <literal>"*"</literal>, a special value
		 * which means that any scheme except "https" is considered to
		 * be an alias for "http".
		 * 
		 * See also #SoupSession:https-aliases.
		 */
		http_aliases: string[];
		/**
		 * A comma-delimited list of URI schemes that should be
		 * considered to be aliases for "https". See
		 * {@link Session.http_aliases} for more information.
		 * 
		 * The default value is %NULL, meaning that no URI schemes
		 * are considered aliases for "https".
		 */
		https_aliases: string[];
		/**
		 * Connection lifetime (in seconds) when idle. Any connection
		 * left idle longer than this will be closed.
		 * 
		 * Although you can change this property at any time, it will
		 * only affect newly-created connections, not currently-open
		 * ones. You can call {@link Soup.Session.abort} after setting this
		 * if you want to ensure that all future connections will have
		 * this timeout value.
		 * 
		 * Note that the default value of 60 seconds only applies to
		 * plain {@link Sessions}. If you are using #SoupSessionAsync or
		 * #SoupSessionSync, the default value is 0 (meaning idle
		 * connections will never time out).
		 */
		idle_timeout: number;
		/**
		 * Sets the {@link Address} to use for the client side of
		 * the connection.
		 * 
		 * Use this property if you want for instance to bind the
		 * local socket to a specific IP address.
		 */
		local_address: Address;
		max_conns: number;
		max_conns_per_host: number;
		/**
		 * A #GProxyResolver to use with this session. Setting this
		 * will clear the {@link Session.proxy_uri} property, and remove
		 * any <type>SoupProxyURIResolver</type> features that have
		 * been added to the session.
		 * 
		 * By default, in a plain #SoupSession, this is set to the
		 * default #GProxyResolver, but you can set it to %NULL if you
		 * don't want to use proxies, or set it to your own
		 * #GProxyResolver if you want to control what proxies get
		 * used.
		 */
		proxy_resolver: Gio.ProxyResolver;
		/**
		 * @deprecated
		 * Use SoupSession:proxy-resolver along with #GSimpleProxyResolver.
		 * 
		 * A proxy to use for all http and https requests in this
		 * session. Setting this will clear the
		 * {@link Session.proxy_resolver} property, and remove any
		 * <type>SoupProxyURIResolver</type> features that have been
		 * added to the session. Setting this property will also
		 * cancel all currently pending messages.
		 * 
		 * Note that #SoupSession will normally handle looking up the
		 * user's proxy settings for you; you should only use
		 * #SoupSession:proxy-uri if you need to override the user's
		 * normal proxy settings.
		 * 
		 * Also note that this proxy will be used for
		 * <emphasis>all</emphasis> requests; even requests to
		 * <literal>localhost</literal>. If you need more control over
		 * proxies, you can create a #GSimpleProxyResolver and set the
		 * #SoupSession:proxy-resolver property.
		 */
		proxy_uri: URI;
		/**
		 * Remove feature objects from the session. (Shortcut for
		 * calling {@link Soup.Session.remove_feature_by_type}.)
		 */
		// remove_feature_by_type: GObject.Type;
		/**
		 * @deprecated
		 * use {@link Session.ssl_use_system_ca_file}, or
		 * else #SoupSession:tls-database with a #GTlsFileDatabase
		 * (which allows you to do explicit error handling).
		 * 
		 * File containing SSL CA certificates.
		 * 
		 * If the specified file does not exist or cannot be read,
		 * then libsoup will print a warning, and then behave as
		 * though it had read in a empty CA file, meaning that all SSL
		 * certificates will be considered invalid.
		 */
		ssl_ca_file: string;
		/**
		 * Normally, if {@link Session.tls_database} is set (including if
		 * it was set via #SoupSession:ssl-use-system-ca-file or
		 * #SoupSession:ssl-ca-file), then libsoup will reject any
		 * certificate that is invalid (ie, expired) or that is not
		 * signed by one of the given CA certificates, and the
		 * #SoupMessage will fail with the status
		 * %SOUP_STATUS_SSL_FAILED.
		 * 
		 * If you set #SoupSession:ssl-strict to %FALSE, then all
		 * certificates will be accepted, and you will need to call
		 * {@link Soup.Message.get_https_status} to distinguish valid from
		 * invalid certificates. (This can be used, eg, if you want to
		 * accept invalid certificates after giving some sort of
		 * warning.)
		 * 
		 * For a plain #SoupSession, if the session has no CA file or
		 * TLS database, and this property is %TRUE, then all
		 * certificates will be rejected. However, beware that the
		 * deprecated #SoupSession subclasses (#SoupSessionAsync and
		 * #SoupSessionSync) have the opposite behavior: if there is
		 * no CA file or TLS database, then all certificates are always
		 * accepted, and this property has no effect.
		 */
		ssl_strict: boolean;
		/**
		 * Setting this to %TRUE is equivalent to setting
		 * {@link Session.tls_database} to the default system CA database.
		 * (and likewise, setting #SoupSession:tls-database to the
		 * default database by hand will cause this property to
		 * become %TRUE).
		 * 
		 * Setting this to %FALSE (when it was previously %TRUE) will
		 * clear the #SoupSession:tls-database field.
		 * 
		 * See #SoupSession:ssl-strict for more information on how
		 * https certificate validation is handled.
		 * 
		 * If you are using #SoupSessionAsync or
		 * #SoupSessionSync, on libsoup older than 2.72.1, the default value
		 * is %FALSE, for backward compatibility.
		 */
		ssl_use_system_ca_file: boolean;
		/**
		 * The timeout (in seconds) for socket I/O operations
		 * (including connecting to a server, and waiting for a reply
		 * to an HTTP request).
		 * 
		 * Although you can change this property at any time, it will
		 * only affect newly-created connections, not currently-open
		 * ones. You can call {@link Soup.Session.abort} after setting this
		 * if you want to ensure that all future connections will have
		 * this timeout value.
		 * 
		 * Note that the default value of 60 seconds only applies to
		 * plain {@link Sessions}. If you are using #SoupSessionAsync or
		 * #SoupSessionSync, the default value is 0 (meaning socket I/O
		 * will not time out).
		 * 
		 * Not to be confused with #SoupSession:idle-timeout (which is
		 * the length of time that idle persistent connections will be
		 * kept open).
		 */
		timeout: number;
		/**
		 * Sets the #GTlsDatabase to use for validating SSL/TLS
		 * certificates.
		 * 
		 * Note that setting the {@link Session.ssl_ca_file} or
		 * #SoupSession:ssl-use-system-ca-file property will cause
		 * this property to be set to a #GTlsDatabase corresponding to
		 * the indicated file or system default.
		 * 
		 * See #SoupSession:ssl-strict for more information on how
		 * https certificate validation is handled.
		 * 
		 * If you are using a plain #SoupSession then
		 * #SoupSession:ssl-use-system-ca-file will be %TRUE by
		 * default, and so this property will be a copy of the system
		 * CA database. If you are using #SoupSessionAsync or
		 * #SoupSessionSync, on libsoup older than 2.72.1, this property
		 * will be %NULL by default.
		 */
		tls_database: Gio.TlsDatabase;
		/**
		 * A #GTlsInteraction object that will be passed on to any
		 * #GTlsConnections created by the session. (This can be used to
		 * provide client-side certificates, for example.)
		 */
		tls_interaction: Gio.TlsInteraction;
		/**
		 * @deprecated
		 * use {@link Soup.Session.add_feature_by_type} with
		 * #SOUP_TYPE_AUTH_NTLM.
		 * 
		 * Whether or not to use NTLM authentication.
		 */
		use_ntlm: boolean;
		/**
		 * If %TRUE (which it always is on a plain {@link Session}),
		 * asynchronous HTTP requests in this session will run in
		 * whatever the thread-default #GMainContext is at the time
		 * they are started, rather than always occurring in
		 * #SoupSession:async-context.
		 */
		use_thread_context: boolean;
		/**
		 * If non-%NULL, the value to use for the "User-Agent" header
		 * on {@link Message}<!-- -->s sent from this session.
		 * 
		 * RFC 2616 says: "The User-Agent request-header field
		 * contains information about the user agent originating the
		 * request. This is for statistical purposes, the tracing of
		 * protocol violations, and automated recognition of user
		 * agents for the sake of tailoring responses to avoid
		 * particular user agent limitations. User agents SHOULD
		 * include this field with requests."
		 * 
		 * The User-Agent header contains a list of one or more
		 * product tokens, separated by whitespace, with the most
		 * significant product token coming first. The tokens must be
		 * brief, ASCII, and mostly alphanumeric (although "-", "_",
		 * and "." are also allowed), and may optionally include a "/"
		 * followed by a version string. You may also put comments,
		 * enclosed in parentheses, between or after the tokens.
		 * 
		 * If you set a #SoupSession:user_agent property that has trailing
		 * whitespace, #SoupSession will append its own product token
		 * (eg, "<literal>libsoup/2.3.2</literal>") to the end of the
		 * header for you.
		 */
		user_agent: string;
		/**
		 * Cancels all pending requests in #session and closes all idle
		 * persistent connections.
		 * 
		 * The message cancellation has the same semantics as with
		 * {@link Soup.Session.cancel_message}; asynchronous requests on a
		 * {@link SessionAsync} will have their callback called before
		 * soup_session_abort() returns. Requests on a plain #SoupSession will
		 * not.
		 */
		abort(): void;
		/**
		 * Adds #feature's functionality to #session. You can also add a
		 * feature to the session at construct time by using the
		 * %SOUP_SESSION_ADD_FEATURE property.
		 * 
		 * See the main {@link Session} documentation for information on what
		 * features are present in sessions by default.
		 * @param feature an object that implements {@link SessionFeature}
		 */
		add_feature(feature: SessionFeature): void;
		/**
		 * If #feature_type is the type of a class that implements
		 * {@link SessionFeature}, this creates a new feature of that type and
		 * adds it to #session as with {@link Soup.Session.add_feature}. You can use
		 * this when you don't need to customize the new feature in any way.
		 * 
		 * If #feature_type is not a #SoupSessionFeature type, this gives each
		 * existing feature on #session the chance to accept #feature_type as
		 * a "subfeature". This can be used to add new #SoupAuth or
		 * #SoupRequest types, for instance.
		 * 
		 * You can also add a feature to the session at construct time by
		 * using the %SOUP_SESSION_ADD_FEATURE_BY_TYPE property.
		 * 
		 * See the main #SoupSession documentation for information on what
		 * features are present in sessions by default.
		 * @param feature_type a #GType
		 */
		add_feature_by_type(feature_type: GObject.Type): void;
		/**
		 * Causes #session to immediately finish processing #msg (regardless
		 * of its current state) with a final status_code of #status_code. You
		 * may call this at any time after handing #msg off to #session; if
		 * #session has started sending the request but has not yet received
		 * the complete response, then it will close the request's connection.
		 * Note that with requests that have side effects (eg,
		 * <literal>POST</literal>, <literal>PUT</literal>,
		 * <literal>DELETE</literal>) it is possible that you might cancel the
		 * request after the server acts on it, but before it returns a
		 * response, leaving the remote resource in an unknown state.
		 * 
		 * If the message is cancelled while its response body is being read,
		 * then the response body in #msg will be left partially-filled-in.
		 * The response headers, on the other hand, will always be either
		 * empty or complete.
		 * 
		 * Beware that with the deprecated {@link SessionAsync}, messages queued
		 * with {@link Soup.Session.queue_message} will have their callbacks invoked
		 * before soup_session_cancel_message() returns. The plain
		 * #SoupSession does not have this behavior; cancelling an
		 * asynchronous message will merely queue its callback to be run after
		 * returning to the main loop.
		 * @param msg the message to cancel
		 * @param status_code status code to set on #msg (generally
		 * %SOUP_STATUS_CANCELLED)
		 */
		cancel_message(msg: Message, status_code: number): void;
		/**
		 * Start a connection to #uri. The operation can be monitored by providing a #progress_callback
		 * and finishes when the connection is done or an error ocurred.
		 * 
		 * Call {@link Soup.Session.connect_finish} to get the #GIOStream to communicate with the server.
		 * @param uri a {@link URI} to connect to
		 * @param cancellable a #GCancellable
		 * @param progress_callback a {@link SessionConnectProgressCallback} which
		 * will be called for every network event that occurs during the connection.
		 * @param callback the callback to invoke when the operation finishes
		 */
		connect_async(uri: URI, cancellable: Gio.Cancellable | null, progress_callback: SessionConnectProgressCallback | null, callback: Gio.AsyncReadyCallback | null): void;
		/**
		 * Gets the #GIOStream created for the connection to communicate with the server.
		 * @param result the #GAsyncResult passed to your callback
		 * @returns a new #GIOStream, or %NULL on error.
		 */
		connect_finish(result: Gio.AsyncResult): Gio.IOStream;
		/**
		 * Gets #session's {@link Session.async_context}. This does not add a ref
		 * to the context, so you will need to ref it yourself if you want it
		 * to outlive its session.
		 * 
		 * For a modern #SoupSession, this will always just return the
		 * thread-default #GMainContext, and so is not especially useful.
		 * @returns #session's #GMainContext,
		 * which may be %NULL
		 */
		get_async_context(): GLib.MainContext | null;
		/**
		 * Gets the first feature in #session of type #feature_type. For
		 * features where there may be more than one feature of a given type,
		 * use {@link Soup.Session.get_features}.
		 * @param feature_type the #GType of the feature to get
		 * @returns a {@link SessionFeature}, or
		 * %NULL. The feature is owned by #session.
		 */
		get_feature(feature_type: GObject.Type): SessionFeature | null;
		/**
		 * Gets the first feature in #session of type #feature_type, provided
		 * that it is not disabled for #msg. As with
		 * {@link Soup.Session.get_feature}, this should only be used for features
		 * where #feature_type is only expected to match a single feature. In
		 * particular, if there are two matching features, and the first is
		 * disabled on #msg, and the second is not, then this will return
		 * %NULL, not the second feature.
		 * @param feature_type the #GType of the feature to get
		 * @param msg a {@link Message}
		 * @returns a {@link SessionFeature}, or %NULL. The
		 * feature is owned by #session.
		 */
		get_feature_for_message(feature_type: GObject.Type, msg: Message): SessionFeature | null;
		/**
		 * Generates a list of #session's features of type #feature_type. (If
		 * you want to see all features, you can pass %SOUP_TYPE_SESSION_FEATURE
		 * for #feature_type.)
		 * @param feature_type the #GType of the class of features to get
		 * @returns 
		 * a list of features. You must free the list, but not its contents
		 */
		get_features(feature_type: GObject.Type): SessionFeature[];
		/**
		 * Tests if #session has at a feature of type #feature_type (which can
		 * be the type of either a {@link SessionFeature}, or else a subtype of
		 * some class managed by another feature, such as #SoupAuth or
		 * #SoupRequest).
		 * @param feature_type the #GType of the class of features to check for
		 * @returns %TRUE or %FALSE
		 */
		has_feature(feature_type: GObject.Type): boolean;
		/**
		 * Pauses HTTP I/O on #msg. Call {@link Soup.Session.unpause_message} to
		 * resume I/O.
		 * 
		 * This may only be called for asynchronous messages (those sent on a
		 * {@link SessionAsync} or using soup_session_queue_message()).
		 * @param msg a {@link Message} currently running on #session
		 */
		pause_message(msg: Message): void;
		/**
		 * Tells #session that an URI from the given #hostname may be requested
		 * shortly, and so the session can try to prepare by resolving the
		 * domain name in advance, in order to work more quickly once the URI
		 * is actually requested.
		 * 
		 * If #cancellable is non-%NULL, it can be used to cancel the
		 * resolution. #callback will still be invoked in this case, with a
		 * status of %SOUP_STATUS_CANCELLED.
		 * @param hostname a hostname to be resolved
		 * @param cancellable a #GCancellable object, or %NULL
		 * @param callback callback to call with the
		 *     result, or %NULL
		 */
		prefetch_dns(hostname: string, cancellable: Gio.Cancellable | null, callback: AddressCallback | null): void;
		/**
		 * @deprecated
		 * use {@link Soup.Session.prefetch_dns} instead
		 * 
		 * Tells #session that #uri may be requested shortly, and so the
		 * session can try to prepare (resolving the domain name, obtaining
		 * proxy address, etc.) in order to work more quickly once the URI is
		 * actually requested.
		 * @param uri a {@link URI} which may be required
		 */
		prepare_for_uri(uri: URI): void;
		/**
		 * Queues the message #msg for asynchronously sending the request and
		 * receiving a response in the current thread-default #GMainContext.
		 * If #msg has been processed before, any resources related to the
		 * time it was last sent are freed.
		 * 
		 * Upon message completion, the callback specified in #callback will
		 * be invoked. If after returning from this callback the message has not
		 * been requeued, #msg will be unreffed.
		 * 
		 * (The behavior above applies to a plain {@link Session}; if you are
		 * using #SoupSessionAsync or #SoupSessionSync, then the #GMainContext
		 * that is used depends on the settings of #SoupSession:async-context
		 * and #SoupSession:use-thread-context, and for #SoupSessionSync, the
		 * message will actually be sent and processed in another thread, with
		 * only the final callback occurring in the indicated #GMainContext.)
		 * 
		 * Contrast this method with {@link Soup.Session.send_async}, which also
		 * asynchronously sends a message, but returns before reading the
		 * response body, and allows you to read the response via a
		 * #GInputStream.
		 * @param msg the message to queue
		 * @param callback a {@link SessionCallback} which will
		 * be called after the message completes or when an unrecoverable error occurs.
		 */
		queue_message(msg: Message, callback: SessionCallback | null): void;
		/**
		 * Updates #msg's URI according to its status code and "Location"
		 * header, and requeues it on #session. Use this when you have set
		 * %SOUP_MESSAGE_NO_REDIRECT on a message, but have decided to allow a
		 * particular redirection to occur, or if you want to allow a
		 * redirection that {@link Session} will not perform automatically (eg,
		 * redirecting a non-safe method such as DELETE).
		 * 
		 * If #msg's status code indicates that it should be retried as a GET
		 * request, then #msg will be modified accordingly.
		 * 
		 * If #msg has already been redirected too many times, this will
		 * cause it to fail with %SOUP_STATUS_TOO_MANY_REDIRECTS.
		 * @param msg a {@link Message} that has received a 3xx response
		 * @returns %TRUE if a redirection was applied, %FALSE if not
		 * (eg, because there was no Location header, or it could not be
		 * parsed).
		 */
		redirect_message(msg: Message): boolean;
		/**
		 * Removes #feature's functionality from #session.
		 * @param feature a feature that has previously been added to #session
		 */
		remove_feature(feature: SessionFeature): void;
		/**
		 * Removes all features of type #feature_type (or any subclass of
		 * #feature_type) from #session. You can also remove standard features
		 * from the session at construct time by using the
		 * %SOUP_SESSION_REMOVE_FEATURE_BY_TYPE property.
		 * @param feature_type a #GType
		 */
		remove_feature_by_type(feature_type: GObject.Type): void;
		/**
		 * Creates a {@link Request} for retrieving #uri_string.
		 * @param uri_string a URI, in string form
		 * @returns a new {@link Request}, or
		 *   %NULL on error.
		 */
		request(uri_string: string): Request;
		/**
		 * Creates a {@link Request} for retrieving #uri_string, which must be an
		 * "http" or "https" URI (or another protocol listed in #session's
		 * #SoupSession:http-aliases or #SoupSession:https-aliases).
		 * @param method an HTTP method
		 * @param uri_string a URI, in string form
		 * @returns a new {@link RequestHTTP}, or
		 *   %NULL on error.
		 */
		request_http(method: string, uri_string: string): RequestHTTP;
		/**
		 * Creates a {@link Request} for retrieving #uri, which must be an
		 * "http" or "https" URI (or another protocol listed in #session's
		 * #SoupSession:http-aliases or #SoupSession:https-aliases).
		 * @param method an HTTP method
		 * @param uri a {@link URI} representing the URI to retrieve
		 * @returns a new {@link RequestHTTP}, or
		 *   %NULL on error.
		 */
		request_http_uri(method: string, uri: URI): RequestHTTP;
		/**
		 * Creates a {@link Request} for retrieving #uri.
		 * @param uri a {@link URI} representing the URI to retrieve
		 * @returns a new {@link Request}, or
		 *   %NULL on error.
		 */
		request_uri(uri: URI): Request;
		/**
		 * This causes #msg to be placed back on the queue to be attempted
		 * again.
		 * @param msg the message to requeue
		 */
		requeue_message(msg: Message): void;
		/**
		 * Synchronously sends #msg and waits for the beginning of a response.
		 * On success, a #GInputStream will be returned which you can use to
		 * read the response body. ("Success" here means only that an HTTP
		 * response was received and understood; it does not necessarily mean
		 * that a 2xx class status code was received.)
		 * 
		 * If non-%NULL, #cancellable can be used to cancel the request;
		 * {@link Soup.Session.send} will return a %G_IO_ERROR_CANCELLED error. Note
		 * that with requests that have side effects (eg,
		 * <literal>POST</literal>, <literal>PUT</literal>,
		 * <literal>DELETE</literal>) it is possible that you might cancel the
		 * request after the server acts on it, but before it returns a
		 * response, leaving the remote resource in an unknown state.
		 * 
		 * If #msg is requeued due to a redirect or authentication, the
		 * initial (3xx/401/407) response body will be suppressed, and
		 * soup_session_send() will only return once a final response has been
		 * received.
		 * 
		 * Contrast this method with soup_session_send_message(), which also
		 * synchronously sends a {@link Message}, but doesn't return until the
		 * response has been completely read.
		 * 
		 * (Note that this method cannot be called on the deprecated
		 * #SoupSessionAsync subclass.)
		 * @param msg a {@link Message}
		 * @param cancellable a #GCancellable
		 * @returns a #GInputStream for reading the
		 *   response body, or %NULL on error.
		 */
		send(msg: Message, cancellable: Gio.Cancellable | null): Gio.InputStream;
		/**
		 * Asynchronously sends #msg and waits for the beginning of a
		 * response. When #callback is called, then either #msg has been sent,
		 * and its response headers received, or else an error has occurred.
		 * Call {@link Soup.Session.send_finish} to get a #GInputStream for reading
		 * the response body.
		 * 
		 * See soup_session_send() for more details on the general semantics.
		 * 
		 * Contrast this method with soup_session_queue_message(), which also
		 * asynchronously sends a {@link Message}, but doesn't invoke its
		 * callback until the response has been completely read.
		 * 
		 * (Note that this method cannot be called on the deprecated
		 * #SoupSessionSync subclass, and can only be called on
		 * #SoupSessionAsync if you have set the
		 * #SoupSession:use-thread-context property.)
		 * @param msg a {@link Message}
		 * @param cancellable a #GCancellable
		 * @param callback the callback to invoke
		 */
		send_async(msg: Message, cancellable: Gio.Cancellable | null, callback: Gio.AsyncReadyCallback | null): void;
		/**
		 * Gets the response to a {@link Soup.Session.send_async} call and (if
		 * successful), returns a #GInputStream that can be used to read the
		 * response body.
		 * @param result the #GAsyncResult passed to your callback
		 * @returns a #GInputStream for reading the
		 *   response body, or %NULL on error.
		 */
		send_finish(result: Gio.AsyncResult): Gio.InputStream;
		/**
		 * Synchronously send #msg. This call will not return until the
		 * transfer is finished successfully or there is an unrecoverable
		 * error.
		 * 
		 * Unlike with {@link Soup.Session.queue_message}, #msg is not freed upon
		 * return.
		 * 
		 * (Note that if you call this method on a {@link SessionAsync}, it will
		 * still use asynchronous I/O internally, running the glib main loop
		 * to process the message, which may also cause other events to be
		 * processed.)
		 * 
		 * Contrast this method with soup_session_send(), which also
		 * synchronously sends a message, but returns before reading the
		 * response body, and allows you to read the response via a
		 * #GInputStream.
		 * @param msg the message to send
		 * @returns the HTTP status code of the response
		 */
		send_message(msg: Message): number;
		/**
		 * "Steals" the HTTP connection associated with #msg from #session.
		 * This happens immediately, regardless of the current state of the
		 * connection, and #msg's callback will not be called. You can steal
		 * the connection from a {@link Message} signal handler if you need to
		 * wait for part or all of the response to be received first.
		 * 
		 * Calling this function may cause #msg to be freed if you are not
		 * holding any other reference to it.
		 * @param msg the message whose connection is to be stolen
		 * @returns the #GIOStream formerly associated
		 *   with #msg (or %NULL if #msg was no longer associated with a
		 *   connection). No guarantees are made about what kind of #GIOStream
		 *   is returned.
		 */
		steal_connection(msg: Message): Gio.IOStream;
		/**
		 * Resumes HTTP I/O on #msg. Use this to resume after calling
		 * {@link Soup.Session.pause_message}.
		 * 
		 * If #msg is being sent via blocking I/O, this will resume reading or
		 * writing immediately. If #msg is using non-blocking I/O, then
		 * reading or writing won't resume until you return to the main loop.
		 * 
		 * This may only be called for asynchronous messages (those sent on a
		 * {@link SessionAsync} or using soup_session_queue_message()).
		 * @param msg a {@link Message} currently running on #session
		 */
		unpause_message(msg: Message): void;
		/**
		 * Asynchronously creates a {@link WebsocketConnection} to communicate
		 * with a remote server.
		 * 
		 * All necessary WebSocket-related headers will be added to #msg, and
		 * it will then be sent and asynchronously processed normally
		 * (including handling of redirection and HTTP authentication).
		 * 
		 * If the server returns "101 Switching Protocols", then #msg's status
		 * code and response headers will be updated, and then the WebSocket
		 * handshake will be completed. On success,
		 * {@link Soup.Session.websocket_connect_finish} will return a new
		 * #SoupWebsocketConnection. On failure it will return a #GError.
		 * 
		 * If the server returns a status other than "101 Switching
		 * Protocols", then #msg will contain the complete response headers
		 * and body from the server's response, and
		 * soup_session_websocket_connect_finish() will return
		 * %SOUP_WEBSOCKET_ERROR_NOT_WEBSOCKET.
		 * @param msg {@link Message} indicating the WebSocket server to connect to
		 * @param origin origin of the connection
		 * @param protocols a
		 *   %NULL-terminated array of protocols supported
		 * @param cancellable a #GCancellable
		 * @param callback the callback to invoke
		 */
		websocket_connect_async(msg: Message, origin: string | null, protocols: string[] | null, cancellable: Gio.Cancellable | null, callback: Gio.AsyncReadyCallback | null): void;
		/**
		 * Gets the {@link WebsocketConnection} response to a
		 * {@link Soup.Session.websocket_connect_async} call and (if successful),
		 * returns a #SoupWebsocketConnection that can be used to communicate
		 * with the server.
		 * @param result the #GAsyncResult passed to your callback
		 * @returns a new {@link WebsocketConnection}, or
		 *   %NULL on error.
		 */
		websocket_connect_finish(result: Gio.AsyncResult): WebsocketConnection;
		/**
		 * Checks if #msg contains a response that would cause #session to
		 * redirect it to a new URL (ignoring #msg's %SOUP_MESSAGE_NO_REDIRECT
		 * flag, and the number of times it has already been redirected).
		 * @param msg a {@link Message} that has response headers
		 * @returns whether #msg would be redirected
		 */
		would_redirect(msg: Message): boolean;
		/**
		 * Emitted when the session requires authentication. If
		 * credentials are available call {@link Soup.Auth.authenticate} on
		 * #auth. If these credentials fail, the signal will be
		 * emitted again, with #retrying set to %TRUE, which will
		 * continue until you return without calling
		 * soup_auth_authenticate() on #auth.
		 * 
		 * Note that this may be emitted before #msg's body has been
		 * fully read.
		 * 
		 * If you call soup_session_pause_message() on #msg before
		 * returning, then you can authenticate #auth asynchronously
		 * (as long as you g_object_ref() it to make sure it doesn't
		 * get destroyed), and then unpause #msg when you are ready
		 * for it to continue.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - msg: the {@link Message} being sent 
		 *  - auth: the #SoupAuth to authenticate 
		 *  - retrying: %TRUE if this is the second (or later) attempt 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "authenticate", callback: (owner: this, msg: Message, auth: Auth, retrying: boolean) => void): number;
		/**
		 * Emitted when a new connection is created. This is an
		 * internal signal intended only to be used for debugging
		 * purposes, and may go away in the future.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - connection: the connection 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "connection-created", callback: (owner: this, connection: GObject.Object) => void): number;
		/**
		 * Emitted when a request is queued on #session. (Note that
		 * "queued" doesn't just mean {@link Soup.Session.queue_message};
		 * soup_session_send_message() implicitly queues the message
		 * as well.)
		 * 
		 * When sending a request, first {@link Session.request_queued}
		 * is emitted, indicating that the session has become aware of
		 * the request.
		 * 
		 * Once a connection is available to send the request on, the
		 * session emits #SoupSession::request_started. Then, various
		 * #SoupMessage signals are emitted as the message is
		 * processed. If the message is requeued, it will emit
		 * #SoupMessage::restarted, which will then be followed by
		 * another #SoupSession::request_started and another set of
		 * #SoupMessage signals when the message is re-sent.
		 * 
		 * Eventually, the message will emit #SoupMessage::finished.
		 * Normally, this signals the completion of message
		 * processing. However, it is possible that the application
		 * will requeue the message from the "finished" handler (or
		 * equivalently, from the soup_session_queue_message()
		 * callback). In that case, the process will loop back to
		 * #SoupSession::request_started.
		 * 
		 * Eventually, a message will reach "finished" and not be
		 * requeued. At that point, the session will emit
		 * #SoupSession::request_unqueued to indicate that it is done
		 * with the message.
		 * 
		 * To sum up: #SoupSession::request_queued and
		 * #SoupSession::request_unqueued are guaranteed to be emitted
		 * exactly once, but #SoupSession::request_started and
		 * #SoupMessage::finished (and all of the other #SoupMessage
		 * signals) may be invoked multiple times for a given message.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - msg: the request that was queued 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "request-queued", callback: (owner: this, msg: Message) => void): number;
		/**
		 * Emitted just before a request is sent. See
		 * {@link Session.request_queued} for a detailed description of
		 * the message lifecycle within a session.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - msg: the request being sent 
		 *  - socket: the socket the request is being sent on 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "request-started", callback: (owner: this, msg: Message, socket: Socket) => void): number;
		/**
		 * Emitted when a request is removed from #session's queue,
		 * indicating that #session is done with it. See
		 * {@link Session.request_queued} for a detailed description of the
		 * message lifecycle within a session.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - msg: the request that was unqueued 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "request-unqueued", callback: (owner: this, msg: Message) => void): number;
		/**
		 * Emitted when an SSL tunnel is being created on a proxy
		 * connection. This is an internal signal intended only to be
		 * used for debugging purposes, and may go away in the future.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - connection: the connection 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "tunneling", callback: (owner: this, connection: GObject.Object) => void): number;

		connect(signal: "notify::accept-language", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::accept-language-auto", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::add-feature", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::add-feature-by-type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::async-context", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::http-aliases", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::https-aliases", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::idle-timeout", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::local-address", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::max-conns", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::max-conns-per-host", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::proxy-resolver", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::proxy-uri", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::remove-feature-by-type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ssl-ca-file", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ssl-strict", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ssl-use-system-ca-file", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::timeout", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::tls-database", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::tls-interaction", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::use-ntlm", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::use-thread-context", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::user-agent", callback: (owner: this, ...args: any) => void): number;

	}

	type SessionInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<ISession,
		"accept_language" |
		"accept_language_auto" |
		"add_feature" |
		"add_feature_by_type" |
		"async_context" |
		"http_aliases" |
		"https_aliases" |
		"idle_timeout" |
		"local_address" |
		"max_conns" |
		"max_conns_per_host" |
		"proxy_resolver" |
		"proxy_uri" |
		"remove_feature_by_type" |
		"ssl_ca_file" |
		"ssl_strict" |
		"ssl_use_system_ca_file" |
		"timeout" |
		"tls_database" |
		"tls_interaction" |
		"use_ntlm" |
		"use_thread_context" |
		"user_agent">;

	export interface SessionInitOptions extends SessionInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Session} instead.
	 */
	type SessionMixin = ISession & GObject.Object;

	interface Session extends SessionMixin {}

	class Session {
		public constructor(options?: Partial<SessionInitOptions>);
		/**
		 * Creates a {@link Session} with the default options.
		 * @returns the new session.
		 */
		public static new(): Session;
		/**
		 * Creates a {@link Session} with the specified options.
		 * @param optname1 name of first property to set
		 * @returns the new session.
		 */
		public static new_with_options(optname1: string): Session;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link SessionAsync} instead.
	 */
	interface ISessionAsync {

	}

	type SessionAsyncInitOptionsMixin = SessionInitOptions
	export interface SessionAsyncInitOptions extends SessionAsyncInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link SessionAsync} instead.
	 */
	type SessionAsyncMixin = ISessionAsync & Session;

	interface SessionAsync extends SessionAsyncMixin {}

	class SessionAsync {
		public constructor(options?: Partial<SessionAsyncInitOptions>);
		/**
		 * @deprecated
		 * {@link SessionAsync} is deprecated; use a plain
		 * #SoupSession, created with {@link Soup.Session.new}. See the <link
		 * linkend="libsoup-session-porting">porting guide</link>.
		 * 
		 * Creates an asynchronous {@link Session} with the default options.
		 * @returns the new session.
		 */
		public static new(): Session;
		/**
		 * @deprecated
		 * {@link SessionAsync} is deprecated; use a plain
		 * #SoupSession, created with {@link Soup.Session.new_with_options}. See the
		 * <link linkend="libsoup-session-porting">porting guide</link>.
		 * 
		 * Creates an asynchronous {@link Session} with the specified options.
		 * @param optname1 name of first property to set
		 * @returns the new session.
		 */
		public static new_with_options(optname1: string): Session;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link SessionSync} instead.
	 */
	interface ISessionSync {

	}

	type SessionSyncInitOptionsMixin = SessionInitOptions
	export interface SessionSyncInitOptions extends SessionSyncInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link SessionSync} instead.
	 */
	type SessionSyncMixin = ISessionSync & Session;

	interface SessionSync extends SessionSyncMixin {}

	class SessionSync {
		public constructor(options?: Partial<SessionSyncInitOptions>);
		/**
		 * @deprecated
		 * {@link SessionSync} is deprecated; use a plain
		 * #SoupSession, created with {@link Soup.Session.new}. See the <link
		 * linkend="libsoup-session-porting">porting guide</link>.
		 * 
		 * Creates an synchronous {@link Session} with the default options.
		 * @returns the new session.
		 */
		public static new(): Session;
		/**
		 * @deprecated
		 * {@link SessionSync} is deprecated; use a plain
		 * #SoupSession, created with {@link Soup.Session.new_with_options}. See the
		 * <link linkend="libsoup-session-porting">porting guide</link>.
		 * 
		 * Creates an synchronous {@link Session} with the specified options.
		 * @param optname1 name of first property to set
		 * @returns the new session.
		 */
		public static new_with_options(optname1: string): Session;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Socket} instead.
	 */
	interface ISocket {
		async_context: any;
		fd: number;
		ipv6_only: boolean;
		/**
		 * Whether or not the socket is a server socket.
		 * 
		 * Note that for "ordinary" {@link Sockets} this will be set for
		 * both listening sockets and the sockets emitted by
		 * #SoupSocket::new-connection, but for sockets created by
		 * setting #SoupSocket:fd, it will only be set for listening
		 * sockets.
		 */
		readonly is_server: boolean;
		local_address: Address;
		/**
		 * Whether or not the socket uses non-blocking I/O.
		 * 
		 * {@link Socket}'s I/O methods are designed around the idea of
		 * using a single codepath for both synchronous and
		 * asynchronous I/O. If you want to read off a #SoupSocket,
		 * the "correct" way to do it is to call {@link Soup.Socket.read} or
		 * soup_socket_read_until() repeatedly until you have read
		 * everything you want. If it returns %SOUP_SOCKET_WOULD_BLOCK
		 * at any point, stop reading and wait for it to emit the
		 * #SoupSocket::readable signal. Then go back to the
		 * reading-as-much-as-you-can loop. Likewise, for writing to a
		 * #SoupSocket, you should call soup_socket_write() either
		 * until you have written everything, or it returns
		 * %SOUP_SOCKET_WOULD_BLOCK (in which case you wait for
		 * #SoupSocket::writable and then go back into the loop).
		 * 
		 * Code written this way will work correctly with both
		 * blocking and non-blocking sockets; blocking sockets will
		 * simply never return %SOUP_SOCKET_WOULD_BLOCK, and so the
		 * code that handles that case just won't get used for them.
		 */
		non_blocking: boolean;
		remote_address: Address;
		ssl_creds: any;
		ssl_fallback: boolean;
		ssl_strict: boolean;
		timeout: number;
		readonly tls_certificate: Gio.TlsCertificate;
		readonly tls_errors: Gio.TlsCertificateFlags;
		readonly trusted_certificate: boolean;
		/**
		 * Use {@link G.main_context_get_thread_default}.
		 */
		use_thread_context: boolean;
		/**
		 * Begins asynchronously connecting to #sock's remote address. The
		 * socket will call #callback when it succeeds or fails (but not
		 * before returning from this function).
		 * 
		 * If #cancellable is non-%NULL, it can be used to cancel the
		 * connection. #callback will still be invoked in this case, with a
		 * status of %SOUP_STATUS_CANCELLED.
		 * @param cancellable a #GCancellable, or %NULL
		 * @param callback callback to call after connecting
		 */
		connect_async(cancellable: Gio.Cancellable | null, callback: SocketCallback): void;
		/**
		 * Attempt to synchronously connect #sock to its remote address.
		 * 
		 * If #cancellable is non-%NULL, it can be used to cancel the
		 * connection, in which case {@link Soup.Socket.connect_sync} will return
		 * %SOUP_STATUS_CANCELLED.
		 * @param cancellable a #GCancellable, or %NULL
		 * @returns a success or failure code.
		 */
		connect_sync(cancellable: Gio.Cancellable | null): number;
		/**
		 * Disconnects #sock. Any further read or write attempts on it will
		 * fail.
		 */
		disconnect(): void;
		/**
		 * Gets #sock's underlying file descriptor.
		 * 
		 * Note that fiddling with the file descriptor may break the
		 * {@link Socket}.
		 * @returns #sock's file descriptor.
		 */
		get_fd(): number;
		/**
		 * Returns the {@link Address} corresponding to the local end of #sock.
		 * 
		 * Calling this method on an unconnected socket is considered to be
		 * an error, and produces undefined results.
		 * @returns the {@link Address}
		 */
		get_local_address(): Address;
		/**
		 * Returns the {@link Address} corresponding to the remote end of #sock.
		 * 
		 * Calling this method on an unconnected socket is considered to be
		 * an error, and produces undefined results.
		 * @returns the {@link Address}
		 */
		get_remote_address(): Address;
		/**
		 * Tests if #sock is connected to another host
		 * @returns %TRUE or %FALSE.
		 */
		is_connected(): boolean;
		/**
		 * Tests if #sock is doing (or has attempted to do) SSL.
		 * @returns %TRUE if #sock has SSL credentials set
		 */
		is_ssl(): boolean;
		/**
		 * Makes #sock start listening on its local address. When connections
		 * come in, #sock will emit {@link Socket.new_connection}.
		 * @returns whether or not #sock is now listening.
		 */
		listen(): boolean;
		/**
		 * Attempts to read up to #len bytes from #sock into #buffer. If some
		 * data is successfully read, {@link Soup.Socket.read} will return
		 * %SOUP_SOCKET_OK, and *#nread will contain the number of bytes
		 * actually read (which may be less than #len).
		 * 
		 * If #sock is non-blocking, and no data is available, the return
		 * value will be %SOUP_SOCKET_WOULD_BLOCK. In this case, the caller
		 * can connect to the {@link Socket.readable} signal to know when there
		 * is more data to read. (NB: You MUST read all available data off the
		 * socket first. #SoupSocket::readable is only emitted after
		 * soup_socket_read() returns %SOUP_SOCKET_WOULD_BLOCK, and it is only
		 * emitted once. See the documentation for #SoupSocket:non-blocking.)
		 * @param buffer buffer to read
		 *   into
		 * @param len size of #buffer in bytes
		 * @param cancellable a #GCancellable, or %NULL
		 * @returns a {@link SocketIOStatus}, as described above (or
		 * %SOUP_SOCKET_EOF if the socket is no longer connected, or
		 * %SOUP_SOCKET_ERROR on any other error, in which case #error will
		 * also be set).
		 * 
		 * on return, the number of bytes read into #buffer
		 */
		read(buffer: number[], len: number, cancellable: Gio.Cancellable | null): [ SocketIOStatus, number ];
		/**
		 * Like {@link Soup.Socket.read}, but reads no further than the first
		 * occurrence of #boundary. (If the boundary is found, it will be
		 * included in the returned data, and *#got_boundary will be set to
		 * %TRUE.) Any data after the boundary will returned in future reads.
		 * 
		 * soup_socket_read_until() will almost always return fewer than #len
		 * bytes: if the boundary is found, then it will only return the bytes
		 * up until the end of the boundary, and if the boundary is not found,
		 * then it will leave the last <literal>(boundary_len - 1)</literal>
		 * bytes in its internal buffer, in case they form the start of the
		 * boundary string. Thus, #len normally needs to be at least 1 byte
		 * longer than #boundary_len if you want to make any progress at all.
		 * @param buffer buffer to read
		 *   into
		 * @param len size of #buffer in bytes
		 * @param boundary boundary to read until
		 * @param boundary_len length of #boundary in bytes
		 * @param got_boundary on return, whether or not the data in #buffer
		 * ends with the boundary string
		 * @param cancellable a #GCancellable, or %NULL
		 * @returns as for {@link Soup.Socket.read}
		 * 
		 * on return, the number of bytes read into #buffer
		 */
		read_until(buffer: number[], len: number, boundary: any | null, boundary_len: number, got_boundary: boolean, cancellable: Gio.Cancellable | null): [ SocketIOStatus, number ];
		/**
		 * Starts using SSL on #socket, expecting to find a host named
		 * #ssl_host.
		 * @param ssl_host hostname of the SSL server
		 * @param cancellable a #GCancellable
		 * @returns success or failure
		 */
		start_proxy_ssl(ssl_host: string, cancellable: Gio.Cancellable | null): boolean;
		/**
		 * Starts using SSL on #socket.
		 * @param cancellable a #GCancellable
		 * @returns success or failure
		 */
		start_ssl(cancellable: Gio.Cancellable | null): boolean;
		/**
		 * Attempts to write #len bytes from #buffer to #sock. If some data is
		 * successfully written, the return status will be %SOUP_SOCKET_OK,
		 * and *#nwrote will contain the number of bytes actually written
		 * (which may be less than #len).
		 * 
		 * If #sock is non-blocking, and no data could be written right away,
		 * the return value will be %SOUP_SOCKET_WOULD_BLOCK. In this case,
		 * the caller can connect to the {@link Socket.writable} signal to know
		 * when more data can be written. (NB: #SoupSocket::writable is only
		 * emitted after {@link Soup.Socket.write} returns %SOUP_SOCKET_WOULD_BLOCK,
		 * and it is only emitted once. See the documentation for
		 * #SoupSocket:non-blocking.)
		 * @param buffer data to write
		 * @param len size of #buffer, in bytes
		 * @param cancellable a #GCancellable, or %NULL
		 * @returns a {@link SocketIOStatus}, as described above (or
		 * %SOUP_SOCKET_EOF or %SOUP_SOCKET_ERROR. #error will be set if the
		 * return value is %SOUP_SOCKET_ERROR.)
		 * 
		 * on return, number of bytes written
		 */
		write(buffer: number[], len: number, cancellable: Gio.Cancellable | null): [ SocketIOStatus, number ];
		/**
		 * Emitted when the socket is disconnected, for whatever
		 * reason.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "disconnected", callback: (owner: this) => void): number;
		/**
		 * Emitted when a network-related event occurs. See
		 * #GSocketClient::event for more details.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - event: the event that occurred 
		 *  - connection: the current connection state 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "event", callback: (owner: this, event: Gio.SocketClientEvent, connection: Gio.IOStream) => void): number;
		/**
		 * Emitted when a listening socket (set up with
		 * {@link Soup.Socket.listen}) receives a new connection.
		 * 
		 * You must ref the #new if you want to keep it; otherwise it
		 * will be destroyed after the signal is emitted.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - _new: the new socket 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "new-connection", callback: (owner: this, _new: Socket) => void): number;
		/**
		 * Emitted when an async socket is readable. See
		 * {@link Soup.Socket.read}, soup_socket_read_until() and
		 * {@link Socket.non_blocking}.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "readable", callback: (owner: this) => void): number;
		/**
		 * Emitted when an async socket is writable. See
		 * {@link Soup.Socket.write} and {@link Socket.non_blocking}.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "writable", callback: (owner: this) => void): number;

		connect(signal: "notify::async-context", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::fd", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ipv6-only", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::is-server", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::local-address", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::non-blocking", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::remote-address", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ssl-creds", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ssl-fallback", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::ssl-strict", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::timeout", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::tls-certificate", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::tls-errors", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::trusted-certificate", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::use-thread-context", callback: (owner: this, ...args: any) => void): number;

	}

	type SocketInitOptionsMixin = GObject.ObjectInitOptions & Gio.InitableInitOptions & 
	Pick<ISocket,
		"async_context" |
		"fd" |
		"ipv6_only" |
		"local_address" |
		"non_blocking" |
		"remote_address" |
		"ssl_creds" |
		"ssl_fallback" |
		"ssl_strict" |
		"timeout" |
		"use_thread_context">;

	export interface SocketInitOptions extends SocketInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Socket} instead.
	 */
	type SocketMixin = ISocket & GObject.Object & Gio.Initable;

	interface Socket extends SocketMixin {}

	class Socket {
		public constructor(options?: Partial<SocketInitOptions>);
		/**
		 * Creates a new (disconnected) socket
		 * @param optname1 name of first property to set (or %NULL)
		 * @returns the new socket
		 */
		public static new(optname1: string): Socket;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WebsocketConnection} instead.
	 */
	interface IWebsocketConnection {
		/**
		 * The type of connection (client/server).
		 */
		connection_type: WebsocketConnectionType;
		/**
		 * List of {@link WebsocketExtension} objects that are active in the connection.
		 */
		extensions: any;
		/**
		 * The underlying IO stream the WebSocket is communicating
		 * over.
		 * 
		 * The input and output streams must be pollable streams.
		 */
		io_stream: Gio.IOStream;
		/**
		 * Interval in seconds on when to send a ping message which will
		 * serve as a keepalive message. If set to 0 the keepalive message is
		 * disabled.
		 */
		keepalive_interval: number;
		/**
		 * The maximum payload size for incoming packets the protocol expects
		 * or 0 to not limit it.
		 */
		max_incoming_payload_size: number;
		/**
		 * The client's Origin.
		 */
		origin: string;
		/**
		 * The chosen protocol, or %NULL if a protocol was not agreed
		 * upon.
		 */
		protocol: string;
		/**
		 * The current state of the WebSocket.
		 */
		readonly state: WebsocketState;
		/**
		 * The URI of the WebSocket.
		 * 
		 * For servers this represents the address of the WebSocket,
		 * and for clients it is the address connected to.
		 */
		uri: URI;
		/**
		 * Close the connection in an orderly fashion.
		 * 
		 * Note that until the {@link WebsocketConnection.closed} signal fires, the connection
		 * is not yet completely closed. The close message is not even sent until the
		 * main loop runs.
		 * 
		 * The #code and #data are sent to the peer along with the close request.
		 * If #code is %SOUP_WEBSOCKET_CLOSE_NO_STATUS a close message with no body
		 * (without code and data) is sent.
		 * Note that the #data must be UTF-8 valid.
		 * @param code close code
		 * @param data close data
		 */
		close(code: number, data: string | null): void;
		/**
		 * Get the close code received from the WebSocket peer.
		 * 
		 * This only becomes valid once the WebSocket is in the
		 * %SOUP_WEBSOCKET_STATE_CLOSED state. The value will often be in the
		 * {@link WebsocketCloseCode} enumeration, but may also be an application
		 * defined close code.
		 * @returns the close code or zero.
		 */
		get_close_code(): number;
		/**
		 * Get the close data received from the WebSocket peer.
		 * 
		 * This only becomes valid once the WebSocket is in the
		 * %SOUP_WEBSOCKET_STATE_CLOSED state. The data may be freed once
		 * the main loop is run, so copy it if you need to keep it around.
		 * @returns the close data or %NULL
		 */
		get_close_data(): string;
		/**
		 * Get the connection type (client/server) of the connection.
		 * @returns the connection type
		 */
		get_connection_type(): WebsocketConnectionType;
		/**
		 * Get the extensions chosen via negotiation with the peer.
		 * @returns a #GList of {@link WebsocketExtension} objects
		 */
		get_extensions(): WebsocketExtension[];
		/**
		 * Get the I/O stream the WebSocket is communicating over.
		 * @returns the WebSocket's I/O stream.
		 */
		get_io_stream(): Gio.IOStream;
		/**
		 * Gets the keepalive interval in seconds or 0 if disabled.
		 * @returns the keepalive interval.
		 */
		get_keepalive_interval(): number;
		/**
		 * Gets the maximum payload size allowed for incoming packets.
		 * @returns the maximum payload size.
		 */
		get_max_incoming_payload_size(): number;
		/**
		 * Get the origin of the WebSocket.
		 * @returns the origin, or %NULL
		 */
		get_origin(): string | null;
		/**
		 * Get the protocol chosen via negotiation with the peer.
		 * @returns the chosen protocol, or %NULL
		 */
		get_protocol(): string | null;
		/**
		 * Get the current state of the WebSocket.
		 * @returns the state
		 */
		get_state(): WebsocketState;
		/**
		 * Get the URI of the WebSocket.
		 * 
		 * For servers this represents the address of the WebSocket, and
		 * for clients it is the address connected to.
		 * @returns the URI
		 */
		get_uri(): URI;
		/**
		 * Send a binary message to the peer. If #length is 0, #data may be %NULL.
		 * 
		 * The message is queued to be sent and will be sent when the main loop
		 * is run.
		 * @param data the message contents
		 * @param length the length of #data
		 */
		send_binary(data: number[] | null, length: number): void;
		/**
		 * Send a message of the given #type to the peer. Note that this method,
		 * allows to send text messages containing %NULL characters.
		 * 
		 * The message is queued to be sent and will be sent when the main loop
		 * is run.
		 * @param type the type of message contents
		 * @param message the message data as #GBytes
		 */
		send_message(type: WebsocketDataType, message: GLib.Bytes): void;
		/**
		 * Send a %NULL-terminated text (UTF-8) message to the peer. If you need
		 * to send text messages containing %NULL characters use
		 * {@link Soup.WebsocketConnection.send_message} instead.
		 * 
		 * The message is queued to be sent and will be sent when the main loop
		 * is run.
		 * @param text the message contents
		 */
		send_text(text: string): void;
		/**
		 * Sets the interval in seconds on when to send a ping message which will serve
		 * as a keepalive message. If set to 0 the keepalive message is disabled.
		 * @param interval the interval to send a ping message or 0 to disable it
		 */
		set_keepalive_interval(interval: number): void;
		/**
		 * Sets the maximum payload size allowed for incoming packets. It
		 * does not limit the outgoing packet size.
		 * @param max_incoming_payload_size the maximum payload size
		 */
		set_max_incoming_payload_size(max_incoming_payload_size: number): void;
		/**
		 * Emitted when the connection has completely closed, either
		 * due to an orderly close from the peer, one initiated via
		 * {@link Soup.WebsocketConnection.close} or a fatal error
		 * condition that caused a close.
		 * 
		 * This signal will be emitted once.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "closed", callback: (owner: this) => void): number;
		/**
		 * This signal will be emitted during an orderly close.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "closing", callback: (owner: this) => void): number;
		/**
		 * Emitted when an error occurred on the WebSocket. This may
		 * be fired multiple times. Fatal errors will be followed by
		 * the {@link WebsocketConnection.closed} signal being emitted.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - error: the error that occured 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "error", callback: (owner: this, error: GLib.Error) => void): number;
		/**
		 * Emitted when we receive a message from the peer.
		 * 
		 * As a convenience, the #message data will always be
		 * NUL-terminated, but the NUL byte will not be included in
		 * the length count.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - type: the type of message contents 
		 *  - message: the message data 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "message", callback: (owner: this, type: number, message: GLib.Bytes) => void): number;
		/**
		 * Emitted when we receive a Pong frame (solicited or
		 * unsolicited) from the peer.
		 * 
		 * As a convenience, the #message data will always be
		 * NUL-terminated, but the NUL byte will not be included in
		 * the length count.
		 * @param signal 
		 * @param callback Callback function
		 *  - owner: owner of the emitted event 
		 *  - message: the application data (if any) 
		 * 
		 * @returns Callback ID
		 */
		connect(signal: "pong", callback: (owner: this, message: GLib.Bytes) => void): number;

		connect(signal: "notify::connection-type", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::extensions", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::io-stream", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::keepalive-interval", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::max-incoming-payload-size", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::origin", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::protocol", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::state", callback: (owner: this, ...args: any) => void): number;
		connect(signal: "notify::uri", callback: (owner: this, ...args: any) => void): number;

	}

	type WebsocketConnectionInitOptionsMixin = GObject.ObjectInitOptions & 
	Pick<IWebsocketConnection,
		"connection_type" |
		"extensions" |
		"io_stream" |
		"keepalive_interval" |
		"max_incoming_payload_size" |
		"origin" |
		"protocol" |
		"uri">;

	export interface WebsocketConnectionInitOptions extends WebsocketConnectionInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WebsocketConnection} instead.
	 */
	type WebsocketConnectionMixin = IWebsocketConnection & GObject.Object;

	/**
	 * A class representing a WebSocket connection.
	 */
	interface WebsocketConnection extends WebsocketConnectionMixin {}

	class WebsocketConnection {
		public constructor(options?: Partial<WebsocketConnectionInitOptions>);
		/**
		 * Creates a {@link WebsocketConnection} on #stream. This should be
		 * called after completing the handshake to begin using the WebSocket
		 * protocol.
		 * @param stream a #GIOStream connected to the WebSocket server
		 * @param uri the URI of the connection
		 * @param type the type of connection (client/side)
		 * @param origin the Origin of the client
		 * @param protocol the subprotocol in use
		 * @returns a new {@link WebsocketConnection}
		 */
		public static new(stream: Gio.IOStream, uri: URI, type: WebsocketConnectionType, origin: string | null, protocol: string | null): WebsocketConnection;
		/**
		 * Creates a {@link WebsocketConnection} on #stream with the given active #extensions.
		 * This should be called after completing the handshake to begin using the WebSocket
		 * protocol.
		 * @param stream a #GIOStream connected to the WebSocket server
		 * @param uri the URI of the connection
		 * @param type the type of connection (client/side)
		 * @param origin the Origin of the client
		 * @param protocol the subprotocol in use
		 * @param extensions a #GList of {@link WebsocketExtension} objects
		 * @returns a new {@link WebsocketConnection}
		 */
		public static new_with_extensions(stream: Gio.IOStream, uri: URI, type: WebsocketConnectionType, origin: string | null, protocol: string | null, extensions: WebsocketExtension[]): WebsocketConnection;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WebsocketExtension} instead.
	 */
	interface IWebsocketExtension {
		/**
		 * Configures #extension with the given #params
		 * @param connection_type either %SOUP_WEBSOCKET_CONNECTION_CLIENT or %SOUP_WEBSOCKET_CONNECTION_SERVER
		 * @param params the parameters, or %NULL
		 * @returns %TRUE if extension could be configured with the given parameters, or %FALSE otherwise
		 */
		configure(connection_type: WebsocketConnectionType, params: any[] | null): boolean;
		/**
		 * Get the parameters strings to be included in the request header. If the extension
		 * doesn't include any parameter in the request, this function returns %NULL.
		 * @returns a new allocated string with the parameters
		 */
		get_request_params(): string | null;
		/**
		 * Get the parameters strings to be included in the response header. If the extension
		 * doesn't include any parameter in the response, this function returns %NULL.
		 * @returns a new allocated string with the parameters
		 */
		get_response_params(): string | null;
		/**
		 * Process a message after it's received. If the payload isn't changed the given
		 * #payload is just returned, otherwise {@link G.bytes_unref} is called on the given
		 * #payload and a new #GBytes is returned with the new data.
		 * 
		 * Extensions using reserved bits of the header will reset them in #header.
		 * @param payload the payload data
		 * @returns the message payload data, or %NULL in case of error
		 */
		process_incoming_message(payload: GLib.Bytes): GLib.Bytes;
		/**
		 * Process a message before it's sent. If the payload isn't changed the given
		 * #payload is just returned, otherwise {@link G.bytes_unref} is called on the given
		 * #payload and a new #GBytes is returned with the new data.
		 * 
		 * Extensions using reserved bits of the header will change them in #header.
		 * @param payload the payload data
		 * @returns the message payload data, or %NULL in case of error
		 */
		process_outgoing_message(payload: GLib.Bytes): GLib.Bytes;
	}

	type WebsocketExtensionInitOptionsMixin = GObject.ObjectInitOptions
	export interface WebsocketExtensionInitOptions extends WebsocketExtensionInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WebsocketExtension} instead.
	 */
	type WebsocketExtensionMixin = IWebsocketExtension & GObject.Object;

	interface WebsocketExtension extends WebsocketExtensionMixin {}

	class WebsocketExtension {
		public constructor(options?: Partial<WebsocketExtensionInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WebsocketExtensionDeflate} instead.
	 */
	interface IWebsocketExtensionDeflate {

	}

	type WebsocketExtensionDeflateInitOptionsMixin = WebsocketExtensionInitOptions
	export interface WebsocketExtensionDeflateInitOptions extends WebsocketExtensionDeflateInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WebsocketExtensionDeflate} instead.
	 */
	type WebsocketExtensionDeflateMixin = IWebsocketExtensionDeflate & WebsocketExtension;

	interface WebsocketExtensionDeflate extends WebsocketExtensionDeflateMixin {}

	class WebsocketExtensionDeflate {
		public constructor(options?: Partial<WebsocketExtensionDeflateInitOptions>);
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WebsocketExtensionManager} instead.
	 */
	interface IWebsocketExtensionManager {

	}

	type WebsocketExtensionManagerInitOptionsMixin = GObject.ObjectInitOptions & SessionFeatureInitOptions
	export interface WebsocketExtensionManagerInitOptions extends WebsocketExtensionManagerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link WebsocketExtensionManager} instead.
	 */
	type WebsocketExtensionManagerMixin = IWebsocketExtensionManager & GObject.Object & SessionFeature;

	interface WebsocketExtensionManager extends WebsocketExtensionManagerMixin {}

	class WebsocketExtensionManager {
		public constructor(options?: Partial<WebsocketExtensionManagerInitOptions>);
	}

	export interface BufferInitOptions {}
	/**
	 * A data buffer, generally used to represent a chunk of a
	 * {@link MessageBody}.
	 * 
	 * #data is a #char because that's generally convenient; in some
	 * situations you may need to cast it to #guchar or another type.
	 */
	interface Buffer {}
	class Buffer {
		public constructor(options?: Partial<BufferInitOptions>);
		/**
		 * Creates a new {@link Buffer} containing #length bytes from #data.
		 * @param use how #data is to be used by the buffer
		 * @param data data
		 * @param length length of #data
		 * @returns the new {@link Buffer}.
		 */
		public static new(use: MemoryUse, data: number[], length: number): Buffer;
		/**
		 * Creates a new {@link Buffer} containing #length bytes from #data.
		 * 
		 * This function is exactly equivalent to {@link Soup.Buffer.new} with
		 * %SOUP_MEMORY_TAKE as first argument; it exists mainly for
		 * convenience and simplifying language bindings.
		 * @param data data
		 * @param length length of #data
		 * @returns the new {@link Buffer}.
		 */
		public static new_take(data: number[], length: number): Buffer;
		/**
		 * Creates a new {@link Buffer} containing #length bytes from #data. When
		 * the #SoupBuffer is freed, it will call #owner_dnotify, passing
		 * #owner to it. You must ensure that #data will remain valid until
		 * #owner_dnotify is called.
		 * 
		 * For example, you could use this to create a buffer containing data
		 * returned from libxml without needing to do an extra copy:
		 * 
		 * <informalexample><programlisting>
		 * xmlDocDumpMemory (doc, &xmlbody, &len);
		 * return soup_buffer_new_with_owner (xmlbody, len, xmlbody,
		 *                                    (GDestroyNotify)xmlFree);
		 * </programlisting></informalexample>
		 * 
		 * In this example, #data and #owner are the same, but in other cases
		 * they would be different (eg, #owner would be a object, and #data
		 * would be a pointer to one of the object's fields).
		 * @param data data
		 * @param length length of #data
		 * @param owner pointer to an object that owns #data
		 * @param owner_dnotify a function to free/unref #owner when
		 * the buffer is freed
		 * @returns the new {@link Buffer}.
		 */
		public static new_with_owner(data: number[], length: number, owner: any | null, owner_dnotify: GLib.DestroyNotify | null): Buffer;
		/**
		 * the data
		 */
		public data: any;
		/**
		 * length of #data
		 */
		public length: number;
		/**
		 * Makes a copy of #buffer. In reality, {@link Buffer} is a refcounted
		 * type, and calling {@link Soup.Buffer.copy} will normally just increment
		 * the refcount on #buffer and return it. However, if #buffer was
		 * created with #SOUP_MEMORY_TEMPORARY memory, then soup_buffer_copy()
		 * will actually return a copy of it, so that the data in the copy
		 * will remain valid after the temporary buffer is freed.
		 * @returns the new (or newly-reffed) buffer
		 */
		public copy(): Buffer;
		/**
		 * Frees #buffer. (In reality, as described in the documentation for
		 * {@link Soup.Buffer.copy}, this is actually an "unref" operation, and may
		 * or may not actually free #buffer.)
		 */
		public free(): void;
		/**
		 * Creates a #GBytes pointing to the same memory as #buffer. The
		 * #GBytes will hold a reference on #buffer to ensure that it is not
		 * freed while the #GBytes is still valid.
		 * @returns a new #GBytes which has the same content
		 * as the {@link Buffer}.
		 */
		public get_as_bytes(): GLib.Bytes;
		/**
		 * This function exists for use by language bindings, because it's not
		 * currently possible to get the right effect by annotating the fields
		 * of {@link Buffer}.
		 * @returns the pointer
		 * to the buffer data is stored here
		 * 
		 * the length of the buffer data is stored here
		 */
		public get_data(): [ number[], number ];
		/**
		 * Gets the "owner" object for a buffer created with
		 * {@link Soup.Buffer.new_with_owner}.
		 * @returns the owner pointer
		 */
		public get_owner(): any | null;
		/**
		 * Creates a new {@link Buffer} containing #length bytes "copied" from
		 * #parent starting at #offset. (Normally this will not actually copy
		 * any data, but will instead simply reference the same data as
		 * #parent does.)
		 * @param offset offset within #parent to start at
		 * @param length number of bytes to copy from #parent
		 * @returns the new {@link Buffer}.
		 */
		public new_subbuffer(offset: number, length: number): Buffer;
	}

	export interface ClientContextInitOptions {}
	/**
	 * A {@link ClientContext} provides additional information about the
	 * client making a particular request. In particular, you can use
	 * {@link Soup.ClientContext.get_auth_domain} and
	 * soup_client_context_get_auth_user() to determine if HTTP
	 * authentication was used successfully.
	 * 
	 * soup_client_context_get_remote_address() and/or
	 * soup_client_context_get_host() can be used to get information for
	 * logging or debugging purposes. soup_client_context_get_gsocket() may
	 * also be of use in some situations (eg, tracking when multiple
	 * requests are made on the same connection).
	 */
	interface ClientContext {}
	class ClientContext {
		public constructor(options?: Partial<ClientContextInitOptions>);
		/**
		 * @deprecated
		 * Use {@link Soup.ClientContext.get_remote_address}, which returns
		 * a #GSocketAddress.
		 * 
		 * Retrieves the {@link Address} associated with the remote end
		 * of a connection.
		 * @returns the {@link Address}
		 * associated with the remote end of a connection, it may be
		 * %NULL if you used {@link Soup.Server.accept_iostream}.
		 */
		public get_address(): Address | null;
		/**
		 * Checks whether the request associated with #client has been
		 * authenticated, and if so returns the {@link AuthDomain} that
		 * authenticated it.
		 * @returns a {@link AuthDomain}, or
		 * %NULL if the request was not authenticated.
		 */
		public get_auth_domain(): AuthDomain | null;
		/**
		 * Checks whether the request associated with #client has been
		 * authenticated, and if so returns the username that the client
		 * authenticated as.
		 * @returns the authenticated-as user, or %NULL if
		 * the request was not authenticated.
		 */
		public get_auth_user(): string | null;
		/**
		 * Retrieves the #GSocket that #client is associated with.
		 * 
		 * If you are using this method to observe when multiple requests are
		 * made on the same persistent HTTP connection (eg, as the ntlm-test
		 * test program does), you will need to pay attention to socket
		 * destruction as well (eg, by using weak references), so that you do
		 * not get fooled when the allocator reuses the memory address of a
		 * previously-destroyed socket to represent a new socket.
		 * @returns the #GSocket that #client is
		 * associated with, %NULL if you used {@link Soup.Server.accept_iostream}.
		 */
		public get_gsocket(): Gio.Socket | null;
		/**
		 * Retrieves the IP address associated with the remote end of a
		 * connection.
		 * @returns the IP address associated with the remote
		 * end of a connection, it may be %NULL if you used
		 * {@link Soup.Server.accept_iostream}.
		 */
		public get_host(): string | null;
		/**
		 * Retrieves the #GSocketAddress associated with the local end
		 * of a connection.
		 * @returns the #GSocketAddress
		 * associated with the local end of a connection, it may be
		 * %NULL if you used {@link Soup.Server.accept_iostream}.
		 */
		public get_local_address(): Gio.SocketAddress | null;
		/**
		 * Retrieves the #GSocketAddress associated with the remote end
		 * of a connection.
		 * @returns the #GSocketAddress
		 * associated with the remote end of a connection, it may be
		 * %NULL if you used {@link Soup.Server.accept_iostream}.
		 */
		public get_remote_address(): Gio.SocketAddress | null;
		/**
		 * @deprecated
		 * use {@link Soup.ClientContext.get_gsocket}, which returns
		 * a #GSocket.
		 * 
		 * Retrieves the {@link Socket} that #client is associated with.
		 * 
		 * If you are using this method to observe when multiple requests are
		 * made on the same persistent HTTP connection (eg, as the ntlm-test
		 * test program does), you will need to pay attention to socket
		 * destruction as well (either by using weak references, or by
		 * connecting to the #SoupSocket::disconnected signal), so that you do
		 * not get fooled when the allocator reuses the memory address of a
		 * previously-destroyed socket to represent a new socket.
		 * @returns the {@link Socket} that #client is
		 * associated with.
		 */
		public get_socket(): Socket;
		/**
		 * "Steals" the HTTP connection associated with #client from its
		 * {@link Server}. This happens immediately, regardless of the current
		 * state of the connection; if the response to the current
		 * #SoupMessage has not yet finished being sent, then it will be
		 * discarded; you can steal the connection from a
		 * #SoupMessage:wrote-informational or #SoupMessage:wrote-body signal
		 * handler if you need to wait for part or all of the response to be
		 * sent.
		 * 
		 * Note that when calling this function from C, #client will most
		 * likely be freed as a side effect.
		 * @returns the #GIOStream formerly associated
		 *   with #client (or %NULL if #client was no longer associated with a
		 *   connection). No guarantees are made about what kind of #GIOStream
		 *   is returned.
		 */
		public steal_connection(): Gio.IOStream;
	}

	export interface ConnectionInitOptions {}
	interface Connection {}
	class Connection {
		public constructor(options?: Partial<ConnectionInitOptions>);
	}

	export interface CookieInitOptions {}
	/**
	 * An HTTP cookie.
	 * 
	 * #name and #value will be set for all cookies. If the cookie is
	 * generated from a string that appears to have no name, then #name
	 * will be the empty string.
	 * 
	 * #domain and #path give the host or domain, and path within that
	 * host/domain, to restrict this cookie to. If #domain starts with
	 * ".", that indicates a domain (which matches the string after the
	 * ".", or any hostname that has #domain as a suffix). Otherwise, it
	 * is a hostname and must match exactly.
	 * 
	 * #expires will be non-%NULL if the cookie uses either the original
	 * "expires" attribute, or the newer "max-age" attribute. If #expires
	 * is %NULL, it indicates that neither "expires" nor "max-age" was
	 * specified, and the cookie expires at the end of the session.
	 * 
	 * If #http_only is set, the cookie should not be exposed to untrusted
	 * code (eg, javascript), so as to minimize the danger posed by
	 * cross-site scripting attacks.
	 */
	interface Cookie {}
	class Cookie {
		public constructor(options?: Partial<CookieInitOptions>);
		/**
		 * Creates a new {@link Cookie} with the given attributes. (Use
		 * {@link Soup.Cookie.set_secure} and soup_cookie_set_http_only() if you
		 * need to set those attributes on the returned cookie.)
		 * 
		 * If #domain starts with ".", that indicates a domain (which matches
		 * the string after the ".", or any hostname that has #domain as a
		 * suffix). Otherwise, it is a hostname and must match exactly.
		 * 
		 * #max_age is used to set the "expires" attribute on the cookie; pass
		 * -1 to not include the attribute (indicating that the cookie expires
		 * with the current session), 0 for an already-expired cookie, or a
		 * lifetime in seconds. You can use the constants
		 * %SOUP_COOKIE_MAX_AGE_ONE_HOUR, %SOUP_COOKIE_MAX_AGE_ONE_DAY,
		 * %SOUP_COOKIE_MAX_AGE_ONE_WEEK and %SOUP_COOKIE_MAX_AGE_ONE_YEAR (or
		 * multiples thereof) to calculate this value. (If you really care
		 * about setting the exact time that the cookie will expire, use
		 * soup_cookie_set_expires().)
		 * @param name cookie name
		 * @param value cookie value
		 * @param domain cookie domain or hostname
		 * @param path cookie path, or %NULL
		 * @param max_age max age of the cookie, or -1 for a session cookie
		 * @returns a new {@link Cookie}.
		 */
		public static new(name: string, value: string, domain: string, path: string, max_age: number): Cookie;
		/**
		 * Parses #header and returns a {@link Cookie}. (If #header contains
		 * multiple cookies, only the first one will be parsed.)
		 * 
		 * If #header does not have "path" or "domain" attributes, they will
		 * be defaulted from #origin. If #origin is %NULL, path will default
		 * to "/", but domain will be left as %NULL. Note that this is not a
		 * valid state for a #SoupCookie, and you will need to fill in some
		 * appropriate string for the domain if you want to actually make use
		 * of the cookie.
		 * @param header a cookie string (eg, the value of a Set-Cookie header)
		 * @param origin origin of the cookie, or %NULL
		 * @returns a new {@link Cookie}, or %NULL if it could
		 * not be parsed, or contained an illegal "domain" attribute for a
		 * cookie originating from #origin.
		 */
		public static parse(header: string, origin: URI): Cookie | null;
		/**
		 * the cookie name
		 */
		public name: string;
		/**
		 * the cookie value
		 */
		public value: string;
		/**
		 * the "domain" attribute, or else the hostname that the
		 * cookie came from.
		 */
		public domain: string;
		/**
		 * the "path" attribute, or %NULL
		 */
		public path: string;
		/**
		 * the cookie expiration time, or %NULL for a session cookie
		 */
		public expires: Date;
		/**
		 * %TRUE if the cookie should only be tranferred over SSL
		 */
		public secure: boolean;
		/**
		 * %TRUE if the cookie should not be exposed to scripts
		 */
		public http_only: boolean;
		/**
		 * Tests if #cookie should be sent to #uri.
		 * 
		 * (At the moment, this does not check that #cookie's domain matches
		 * #uri, because it assumes that the caller has already done that.
		 * But don't rely on that; it may change in the future.)
		 * @param uri a {@link URI}
		 * @returns %TRUE if #cookie should be sent to #uri, %FALSE if
		 * not
		 */
		public applies_to_uri(uri: URI): boolean;
		/**
		 * Copies #cookie.
		 * @returns a copy of #cookie
		 */
		public copy(): Cookie;
		/**
		 * Checks if the #cookie's domain and #host match in the sense that
		 * #cookie should be sent when making a request to #host, or that
		 * #cookie should be accepted when receiving a response from #host.
		 * @param host a URI
		 * @returns %TRUE if the domains match, %FALSE otherwise
		 */
		public domain_matches(host: string): boolean;
		/**
		 * Tests if #cookie1 and #cookie2 are equal.
		 * 
		 * Note that currently, this does not check that the cookie domains
		 * match. This may change in the future.
		 * @param cookie2 a {@link Cookie}
		 * @returns whether the cookies are equal.
		 */
		public equal(cookie2: Cookie): boolean;
		/**
		 * Frees #cookie
		 */
		public free(): void;
		/**
		 * Gets #cookie's domain
		 * @returns #cookie's domain
		 */
		public get_domain(): string;
		/**
		 * Gets #cookie's expiration time.
		 * @returns #cookie's expiration
		 * time, which is owned by #cookie and should not be modified or
		 * freed.
		 */
		public get_expires(): Date | null;
		/**
		 * Gets #cookie's HttpOnly attribute
		 * @returns #cookie's HttpOnly attribute
		 */
		public get_http_only(): boolean;
		/**
		 * Gets #cookie's name
		 * @returns #cookie's name
		 */
		public get_name(): string;
		/**
		 * Gets #cookie's path
		 * @returns #cookie's path
		 */
		public get_path(): string;
		public get_same_site_policy(): SameSitePolicy;
		/**
		 * Gets #cookie's secure attribute
		 * @returns #cookie's secure attribute
		 */
		public get_secure(): boolean;
		/**
		 * Gets #cookie's value
		 * @returns #cookie's value
		 */
		public get_value(): string;
		/**
		 * Sets #cookie's domain to #domain
		 * @param domain the new domain
		 */
		public set_domain(domain: string): void;
		/**
		 * Sets #cookie's expiration time to #expires. If #expires is %NULL,
		 * #cookie will be a session cookie and will expire at the end of the
		 * client's session.
		 * 
		 * (This sets the same property as {@link Soup.Cookie.set_max_age}.)
		 * @param expires the new expiration time, or %NULL
		 */
		public set_expires(expires: Date): void;
		/**
		 * Sets #cookie's HttpOnly attribute to #http_only. If %TRUE, #cookie
		 * will be marked as "http only", meaning it should not be exposed to
		 * web page scripts or other untrusted code.
		 * @param http_only the new value for the HttpOnly attribute
		 */
		public set_http_only(http_only: boolean): void;
		/**
		 * Sets #cookie's max age to #max_age. If #max_age is -1, the cookie
		 * is a session cookie, and will expire at the end of the client's
		 * session. Otherwise, it is the number of seconds until the cookie
		 * expires. You can use the constants %SOUP_COOKIE_MAX_AGE_ONE_HOUR,
		 * %SOUP_COOKIE_MAX_AGE_ONE_DAY, %SOUP_COOKIE_MAX_AGE_ONE_WEEK and
		 * %SOUP_COOKIE_MAX_AGE_ONE_YEAR (or multiples thereof) to calculate
		 * this value. (A value of 0 indicates that the cookie should be
		 * considered already-expired.)
		 * 
		 * (This sets the same property as {@link Soup.Cookie.set_expires}.)
		 * @param max_age the new max age
		 */
		public set_max_age(max_age: number): void;
		/**
		 * Sets #cookie's name to #name
		 * @param name the new name
		 */
		public set_name(name: string): void;
		/**
		 * Sets #cookie's path to #path
		 * @param path the new path
		 */
		public set_path(path: string): void;
		/**
		 * When used in conjunction with {@link Soup.CookieJar.get_cookie_list_with_same_site_info} this
		 * sets the policy of when this cookie should be exposed.
		 * @param policy a {@link SameSitePolicy}
		 */
		public set_same_site_policy(policy: SameSitePolicy): void;
		/**
		 * Sets #cookie's secure attribute to #secure. If %TRUE, #cookie will
		 * only be transmitted from the client to the server over secure
		 * (https) connections.
		 * @param secure the new value for the secure attribute
		 */
		public set_secure(secure: boolean): void;
		/**
		 * Sets #cookie's value to #value
		 * @param value the new value
		 */
		public set_value(value: string): void;
		/**
		 * Serializes #cookie in the format used by the Cookie header (ie, for
		 * returning a cookie from a {@link Session} to a server).
		 * @returns the header
		 */
		public to_cookie_header(): string;
		/**
		 * Serializes #cookie in the format used by the Set-Cookie header
		 * (ie, for sending a cookie from a {@link Server} to a client).
		 * @returns the header
		 */
		public to_set_cookie_header(): string;
	}

	export interface DateInitOptions {}
	/**
	 * A date and time. The date is assumed to be in the (proleptic)
	 * Gregorian calendar. The time is in UTC if #utc is %TRUE. Otherwise,
	 * the time is a local time, and #offset gives the offset from UTC in
	 * minutes (such that adding #offset to the time would give the
	 * correct UTC time). If #utc is %FALSE and #offset is 0, then the
	 * %SoupDate represents a "floating" time with no associated timezone
	 * information.
	 */
	interface Date {}
	class Date {
		public constructor(options?: Partial<DateInitOptions>);
		/**
		 * Creates a {@link Date} representing the indicated time, UTC.
		 * @param year the year (1-9999)
		 * @param month the month (1-12)
		 * @param day the day of the month (1-31, as appropriate for #month)
		 * @param hour the hour (0-23)
		 * @param minute the minute (0-59)
		 * @param second the second (0-59, or up to 61 for leap seconds)
		 * @returns a new {@link Date}
		 */
		public static new(year: number, month: number, day: number, hour: number, minute: number, second: number): Date;
		/**
		 * Creates a {@link Date} representing a time #offset_seconds after the
		 * current time (or before it, if #offset_seconds is negative). If
		 * offset_seconds is 0, returns the current time.
		 * 
		 * If #offset_seconds would indicate a time not expressible as a
		 * <type>time_t</type>, the return value will be clamped into range.
		 * @param offset_seconds offset from current time
		 * @returns a new {@link Date}
		 */
		public static new_from_now(offset_seconds: number): Date;
		/**
		 * Parses #date_string and tries to extract a date from it. This
		 * recognizes all of the "HTTP-date" formats from RFC 2616, all ISO
		 * 8601 formats containing both a time and a date, RFC 2822 dates,
		 * and reasonable approximations thereof. (Eg, it is lenient about
		 * whitespace, leading "0"s, etc.)
		 * @param date_string the date in some plausible format
		 * @returns a new {@link Date}, or %NULL if #date_string
		 * could not be parsed.
		 */
		public static new_from_string(date_string: string): Date | null;
		/**
		 * Creates a {@link Date} corresponding to #when
		 * @param when a <type>time_t</type>
		 * @returns a new {@link Date}
		 */
		public static new_from_time_t(when: number): Date;
		/**
		 * the year, 1 to 9999
		 */
		public year: number;
		/**
		 * the month, 1 to 12
		 */
		public month: number;
		/**
		 * day of the month, 1 to 31
		 */
		public day: number;
		/**
		 * hour of the day, 0 to 23
		 */
		public hour: number;
		/**
		 * minute, 0 to 59
		 */
		public minute: number;
		/**
		 * second, 0 to 59 (or up to 61 in the case of leap seconds)
		 */
		public second: number;
		/**
		 * %TRUE if the date is in UTC
		 */
		public utc: boolean;
		/**
		 * offset from UTC
		 */
		public offset: number;
		/**
		 * Copies #date.
		 * @returns 
		 */
		public copy(): Date;
		/**
		 * Frees #date.
		 */
		public free(): void;
		/**
		 * Gets #date's day.
		 * @returns #date's day
		 */
		public get_day(): number;
		/**
		 * Gets #date's hour.
		 * @returns #date's hour
		 */
		public get_hour(): number;
		/**
		 * Gets #date's minute.
		 * @returns #date's minute
		 */
		public get_minute(): number;
		/**
		 * Gets #date's month.
		 * @returns #date's month
		 */
		public get_month(): number;
		/**
		 * Gets #date's offset from UTC.
		 * @returns #date's offset from UTC. If {@link Soup.Date.get_utc}
		 * returns %FALSE but soup_date_get_offset() returns 0, that means the
		 * date is a "floating" time with no associated offset information.
		 */
		public get_offset(): number;
		/**
		 * Gets #date's second.
		 * @returns #date's second
		 */
		public get_second(): number;
		/**
		 * Gets #date's UTC flag
		 * @returns %TRUE if #date is UTC.
		 */
		public get_utc(): number;
		/**
		 * Gets #date's year.
		 * @returns #date's year
		 */
		public get_year(): number;
		/**
		 * Determines if #date is in the past.
		 * @returns %TRUE if #date is in the past
		 */
		public is_past(): boolean;
		/**
		 * Converts #date to a string in the format described by #format.
		 * @param format the format to generate the date in
		 * @returns #date as a string
		 */
		public to_string(format: DateFormat): string;
		/**
		 * Converts #date to a <type>time_t</type>, assumming it to be in
		 * UTC.
		 * 
		 * If #date is not representable as a <type>time_t</type>, it will be
		 * clamped into range. (In particular, some HTTP cookies have
		 * expiration dates after "Y2.038k" (2038-01-19T03:14:07Z).)
		 * @returns #date as a <type>time_t</type>
		 */
		public to_time_t(): number;
		/**
		 * @deprecated
		 * Do not use #GTimeVal, as it's not Y2038-safe.
		 * 
		 * Converts #date to a #GTimeVal.
		 * @returns a #GTimeVal structure in which to store the converted time.
		 */
		public to_timeval(): GLib.TimeVal;
	}

	export interface HSTSPolicyInitOptions {}
	/**
	 * An HTTP Strict Transport Security policy.
	 * 
	 * #domain represents the host that this policy applies to. The domain
	 * must be IDNA-canonicalized. {@link Soup.hsts_policy_new} and related methods
	 * will do this for you.
	 * 
	 * #max_age contains the 'max-age' value from the Strict Transport
	 * Security header and indicates the time to live of this policy,
	 * in seconds.
	 * 
	 * #expires will be non-%NULL if the policy has been set by the host and
	 * hence has an expiry time. If #expires is %NULL, it indicates that the
	 * policy is a permanent session policy set by the user agent.
	 * 
	 * If #include_subdomains is %TRUE, the Strict Transport Security policy
	 * must also be enforced on subdomains of #domain.
	 */
	interface HSTSPolicy {}
	class HSTSPolicy {
		public constructor(options?: Partial<HSTSPolicyInitOptions>);
		/**
		 * Creates a new {@link HSTSPolicy} with the given attributes.
		 * 
		 * #domain is a domain on which the strict transport security policy
		 * represented by this object must be enforced.
		 * 
		 * #max_age is used to set the "expires" attribute on the policy; pass
		 * SOUP_HSTS_POLICY_MAX_AGE_PAST for an already-expired policy, or a
		 * lifetime in seconds.
		 * 
		 * If #include_subdomains is %TRUE, the strict transport security policy
		 * must also be enforced on all subdomains of #domain.
		 * @param domain policy domain or hostname
		 * @param max_age max age of the policy
		 * @param include_subdomains %TRUE if the policy applies on subdomains
		 * @returns a new {@link HSTSPolicy}.
		 */
		public static new(domain: string, max_age: number, include_subdomains: boolean): HSTSPolicy;
		/**
		 * Parses #msg's first "Strict-Transport-Security" response header and
		 * returns a {@link HSTSPolicy}.
		 * @param msg a {@link Message}
		 * @returns a new {@link HSTSPolicy}, or %NULL if no valid
		 * "Strict-Transport-Security" response header was found.
		 */
		public static new_from_response(msg: Message): HSTSPolicy | null;
		/**
		 * Full version of {@link #soup.hsts_policy_new}, to use with an existing
		 * expiration date. See #soup_hsts_policy_new() for details.
		 * @param domain policy domain or hostname
		 * @param max_age max age of the policy
		 * @param expires the date of expiration of the policy or %NULL for a permanent policy
		 * @param include_subdomains %TRUE if the policy applies on subdomains
		 * @returns a new {@link HSTSPolicy}.
		 */
		public static new_full(domain: string, max_age: number, expires: Date, include_subdomains: boolean): HSTSPolicy;
		/**
		 * Creates a new session {@link HSTSPolicy} with the given attributes.
		 * A session policy is a policy that is valid during the lifetime of
		 * the #SoupHSTSEnforcer it is added to. Contrary to regular policies,
		 * it has no expiration date and is not stored in persistent
		 * enforcers. These policies are useful for user-agent to load their
		 * own or user-defined rules.
		 * 
		 * #domain is a domain on which the strict transport security policy
		 * represented by this object must be enforced.
		 * 
		 * If #include_subdomains is %TRUE, the strict transport security policy
		 * must also be enforced on all subdomains of #domain.
		 * @param domain policy domain or hostname
		 * @param include_subdomains %TRUE if the policy applies on sub domains
		 * @returns a new {@link HSTSPolicy}.
		 */
		public static new_session_policy(domain: string, include_subdomains: boolean): HSTSPolicy;
		/**
		 * The domain or hostname that the policy applies to
		 */
		public domain: string;
		/**
		 * The maximum age, in seconds, that the policy is valid
		 */
		public max_age: number;
		/**
		 * the policy expiration time, or %NULL for a permanent session policy
		 */
		public expires: Date;
		/**
		 * %TRUE if the policy applies on subdomains
		 */
		public include_subdomains: boolean;
		/**
		 * Copies #policy.
		 * @returns a copy of #policy
		 */
		public copy(): HSTSPolicy;
		/**
		 * Tests if #policy1 and #policy2 are equal.
		 * @param policy2 a {@link HSTSPolicy}
		 * @returns whether the policies are equal.
		 */
		public equal(policy2: HSTSPolicy): boolean;
		/**
		 * Frees #policy.
		 */
		public free(): void;
		/**
		 * Gets #policy's domain.
		 * @returns #policy's domain.
		 */
		public get_domain(): string;
		/**
		 * Gets whether #policy include its subdomains.
		 * @returns %TRUE if #policy includes subdomains, %FALSE otherwise.
		 */
		public includes_subdomains(): boolean;
		/**
		 * Gets whether #policy is expired. Permanent policies never
		 * expire.
		 * @returns %TRUE if #policy is expired, %FALSE otherwise.
		 */
		public is_expired(): boolean;
		/**
		 * Gets whether #policy is a non-permanent, non-expirable session policy.
		 * see {@link Soup.hsts_policy_new_session_policy} for details.
		 * @returns %TRUE if #policy is permanent, %FALSE otherwise
		 */
		public is_session_policy(): boolean;
	}

	export interface MessageBodyInitOptions {}
	/**
	 * A {@link Message} request or response body.
	 * 
	 * Note that while #length always reflects the full length of the
	 * message body, #data is normally %NULL, and will only be filled in
	 * after {@link Soup.MessageBody.flatten} is called. For client-side
	 * messages, this automatically happens for the response body after it
	 * has been fully read, unless you set the
	 * %SOUP_MESSAGE_OVERWRITE_CHUNKS flags. Likewise, for server-side
	 * messages, the request body is automatically filled in after being
	 * read.
	 * 
	 * As an added bonus, when #data is filled in, it is always terminated
	 * with a '\0' byte (which is not reflected in #length).
	 */
	interface MessageBody {}
	class MessageBody {
		public constructor(options?: Partial<MessageBodyInitOptions>);
		/**
		 * Creates a new {@link MessageBody}. #SoupMessage uses this internally; you
		 * will not normally need to call it yourself.
		 * @returns a new {@link MessageBody}.
		 */
		public static new(): MessageBody;
		/**
		 * the data
		 */
		public data: string;
		/**
		 * length of #data
		 */
		public length: number;
		/**
		 * Appends #length bytes from #data to #body according to #use.
		 * @param use how to use #data
		 * @param data data to append
		 * @param length length of #data
		 */
		public append(use: MemoryUse, data: number[], length: number): void;
		/**
		 * Appends the data from #buffer to #body. ({@link MessageBody} uses
		 * #SoupBuffers internally, so this is normally a constant-time
		 * operation that doesn't actually require copying the data in
		 * #buffer.)
		 * @param buffer a {@link Buffer}
		 */
		public append_buffer(buffer: Buffer): void;
		/**
		 * Appends #length bytes from #data to #body.
		 * 
		 * This function is exactly equivalent to {@link Soup.MessageBody.append}
		 * with %SOUP_MEMORY_TAKE as second argument; it exists mainly for
		 * convenience and simplifying language bindings.
		 * @param data data to append
		 * @param length length of #data
		 */
		public append_take(data: number[], length: number): void;
		/**
		 * Tags #body as being complete; Call this when using chunked encoding
		 * after you have appended the last chunk.
		 */
		public complete(): void;
		/**
		 * Fills in #body's data field with a buffer containing all of the
		 * data in #body (plus an additional '\0' byte not counted by #body's
		 * length field).
		 * @returns a {@link Buffer} containing the same data as #body.
		 * (You must free this buffer if you do not want it.)
		 */
		public flatten(): Buffer;
		/**
		 * Frees #body. You will not normally need to use this, as
		 * {@link Message} frees its associated message bodies automatically.
		 */
		public free(): void;
		/**
		 * Gets the accumulate flag on #body; see
		 * {@link Soup.MessageBody.set_accumulate} for details.
		 * @returns the accumulate flag for #body.
		 */
		public get_accumulate(): boolean;
		/**
		 * Gets a {@link Buffer} containing data from #body starting at #offset.
		 * The size of the returned chunk is unspecified. You can iterate
		 * through the entire body by first calling
		 * {@link Soup.MessageBody.get_chunk} with an offset of 0, and then on each
		 * successive call, increment the offset by the length of the
		 * previously-returned chunk.
		 * 
		 * If #offset is greater than or equal to the total length of #body,
		 * then the return value depends on whether or not
		 * soup_message_body_complete() has been called or not; if it has,
		 * then soup_message_body_get_chunk() will return a 0-length chunk
		 * (indicating the end of #body). If it has not, then
		 * soup_message_body_get_chunk() will return %NULL (indicating that
		 * #body may still potentially have more data, but that data is not
		 * currently available).
		 * @param offset an offset
		 * @returns a {@link Buffer}, or %NULL.
		 */
		public get_chunk(offset: number): Buffer | null;
		/**
		 * Handles the {@link MessageBody} part of receiving a chunk of data from
		 * the network. Normally this means appending #chunk to #body, exactly
		 * as with {@link Soup.MessageBody.append_buffer}, but if you have set
		 * #body's accumulate flag to %FALSE, then that will not happen.
		 * 
		 * This is a low-level method which you should not normally need to
		 * use.
		 * @param chunk a {@link Buffer} received from the network
		 */
		public got_chunk(chunk: Buffer): void;
		/**
		 * Sets or clears the accumulate flag on #body. (The default value is
		 * %TRUE.) If set to %FALSE, #body's %data field will not be filled in
		 * after the body is fully sent/received, and the chunks that make up
		 * #body may be discarded when they are no longer needed.
		 * 
		 * In particular, if you set this flag to %FALSE on an "incoming"
		 * message body (that is, the {@link Message.response_body} of a
		 * client-side message, or #SoupMessage:request_body of a server-side
		 * message), this will cause each chunk of the body to be discarded
		 * after its corresponding #SoupMessage::got_chunk signal is emitted.
		 * (This is equivalent to setting the deprecated
		 * %SOUP_MESSAGE_OVERWRITE_CHUNKS flag on the message.)
		 * 
		 * If you set this flag to %FALSE on the #SoupMessage:response_body of
		 * a server-side message, it will cause each chunk of the body to be
		 * discarded after its corresponding #SoupMessage::wrote_chunk signal
		 * is emitted.
		 * 
		 * If you set the flag to %FALSE on the #SoupMessage:request_body of a
		 * client-side message, it will block the accumulation of chunks into
		 * #body's %data field, but it will not normally cause the chunks to
		 * be discarded after being written like in the server-side
		 * #SoupMessage:response_body case, because the request body needs to
		 * be kept around in case the request needs to be sent a second time
		 * due to redirection or authentication. However, if you set the
		 * %SOUP_MESSAGE_CAN_REBUILD flag on the message, then the chunks will
		 * be discarded, and you will be responsible for recreating the
		 * request body after the #SoupMessage::restarted signal is emitted.
		 * @param accumulate whether or not to accumulate body chunks in #body
		 */
		public set_accumulate(accumulate: boolean): void;
		/**
		 * Deletes all of the data in #body.
		 */
		public truncate(): void;
		/**
		 * Handles the {@link MessageBody} part of writing a chunk of data to the
		 * network. Normally this is a no-op, but if you have set #body's
		 * accumulate flag to %FALSE, then this will cause #chunk to be
		 * discarded to free up memory.
		 * 
		 * This is a low-level method which you should not need to use, and
		 * there are further restrictions on its proper use which are not
		 * documented here.
		 * @param chunk a {@link Buffer} returned from {@link Soup.MessageBody.get_chunk}
		 */
		public wrote_chunk(chunk: Buffer): void;
	}

	export interface MessageHeadersInitOptions {}
	/**
	 * The HTTP message headers associated with a request or response.
	 */
	interface MessageHeaders {}
	class MessageHeaders {
		public constructor(options?: Partial<MessageHeadersInitOptions>);
		/**
		 * Creates a {@link MessageHeaders}. (#SoupMessage does this
		 * automatically for its own headers. You would only need to use this
		 * method if you are manually parsing or generating message headers.)
		 * @param type the type of headers
		 * @returns a new {@link MessageHeaders}
		 */
		public static new(type: MessageHeadersType): MessageHeaders;
		/**
		 * Appends a new header with name #name and value #value to #hdrs. (If
		 * there is an existing header with name #name, then this creates a
		 * second one, which is only allowed for list-valued headers; see also
		 * {@link Soup.MessageHeaders.replace}.)
		 * 
		 * The caller is expected to make sure that #name and #value are
		 * syntactically correct.
		 * @param name the header name to add
		 * @param value the new value of #name
		 */
		public append(name: string, value: string): void;
		/**
		 * Removes all the headers listed in the Connection header.
		 */
		public clean_connection_headers(): void;
		/**
		 * Clears #hdrs.
		 */
		public clear(): void;
		/**
		 * Calls #func once for each header value in #hdrs.
		 * 
		 * Beware that unlike {@link Soup.MessageHeaders.get}, this processes the
		 * headers in exactly the way they were added, rather than
		 * concatenating multiple same-named headers into a single value.
		 * (This is intentional; it ensures that if you call
		 * soup_message_headers_append() multiple times with the same name,
		 * then the I/O code will output multiple copies of the header when
		 * sending the message to the remote implementation, which may be
		 * required for interoperability in some cases.)
		 * 
		 * You may not modify the headers from #func.
		 * @param func callback function to run for each header
		 */
		public foreach(func: MessageHeadersForeachFunc): void;
		/**
		 * Frees #hdrs.
		 */
		public free(): void;
		/**
		 * Frees the array of ranges returned from {@link Soup.MessageHeaders.get_ranges}.
		 * @param ranges an array of {@link Range}
		 */
		public free_ranges(ranges: Range): void;
		/**
		 * @deprecated
		 * Use {@link Soup.MessageHeaders.get_one} or
		 * soup_message_headers_get_list() instead.
		 * 
		 * Gets the value of header #name in #hdrs.
		 * 
		 * This method was supposed to work correctly for both single-valued
		 * and list-valued headers, but because some HTTP clients/servers
		 * mistakenly send multiple copies of headers that are supposed to be
		 * single-valued, it sometimes returns incorrect results. To fix this,
		 * the methods {@link Soup.MessageHeaders.get_one} and
		 * soup_message_headers_get_list() were introduced, so callers can
		 * explicitly state which behavior they are expecting.
		 * @param name header name
		 * @returns as with {@link Soup.MessageHeaders.get_list}.
		 */
		public get(name: string): string | null;
		/**
		 * Looks up the "Content-Disposition" header in #hdrs, parses it, and
		 * returns its value in *#disposition and *#params. #params can be
		 * %NULL if you are only interested in the disposition-type.
		 * 
		 * In HTTP, the most common use of this header is to set a
		 * disposition-type of "attachment", to suggest to the browser that a
		 * response should be saved to disk rather than displayed in the
		 * browser. If #params contains a "filename" parameter, this is a
		 * suggestion of a filename to use. (If the parameter value in the
		 * header contains an absolute or relative path, libsoup will truncate
		 * it down to just the final path component, so you do not need to
		 * test this yourself.)
		 * 
		 * Content-Disposition is also used in "multipart/form-data", however
		 * this is handled automatically by {@link Multipart} and the associated
		 * form methods.
		 * @returns %TRUE if #hdrs contains a "Content-Disposition"
		 * header, %FALSE if not (in which case *#disposition and *#params
		 * will be unchanged).
		 * 
		 * return location for the
		 * disposition-type, or %NULL
		 * 
		 * return
		 * location for the Content-Disposition parameters, or %NULL
		 */
		public get_content_disposition(): [ boolean, string, string[] ];
		/**
		 * Gets the message body length that #hdrs declare. This will only
		 * be non-0 if {@link Soup.MessageHeaders.get_encoding} returns
		 * %SOUP_ENCODING_CONTENT_LENGTH.
		 * @returns the message body length declared by #hdrs.
		 */
		public get_content_length(): number;
		/**
		 * Parses #hdrs's Content-Range header and returns it in #start,
		 * #end, and #total_length. If the total length field in the header
		 * was specified as "*", then #total_length will be set to -1.
		 * @returns %TRUE if #hdrs contained a "Content-Range" header
		 * containing a byte range which could be parsed, %FALSE otherwise.
		 * 
		 * return value for the start of the range
		 * 
		 * return value for the end of the range
		 * 
		 * return value for the total length of the
		 * resource, or %NULL if you don't care.
		 */
		public get_content_range(): [ boolean, number, number, number | null ];
		/**
		 * Looks up the "Content-Type" header in #hdrs, parses it, and returns
		 * its value in *#content_type and *#params. #params can be %NULL if you
		 * are only interested in the content type itself.
		 * @returns a string with the value of the
		 * "Content-Type" header or %NULL if #hdrs does not contain that
		 * header or it cannot be parsed (in which case *#params will be
		 * unchanged).
		 * 
		 * 
		 *   return location for the Content-Type parameters (eg, "charset"), or
		 *   %NULL
		 */
		public get_content_type(): [ string | null, string[] | null ];
		/**
		 * Gets the message body encoding that #hdrs declare. This may not
		 * always correspond to the encoding used on the wire; eg, a HEAD
		 * response may declare a Content-Length or Transfer-Encoding, but
		 * it will never actually include a body.
		 * @returns the encoding declared by #hdrs.
		 */
		public get_encoding(): Encoding;
		/**
		 * Gets the expectations declared by #hdrs's "Expect" header.
		 * Currently this will either be %SOUP_EXPECTATION_CONTINUE or
		 * %SOUP_EXPECTATION_UNRECOGNIZED.
		 * @returns the contents of #hdrs's "Expect" header
		 */
		public get_expectations(): Expectation;
		/**
		 * Gets the type of headers.
		 * @returns the header's type.
		 */
		public get_headers_type(): MessageHeadersType;
		/**
		 * Gets the value of header #name in #hdrs. Use this for headers whose
		 * values are comma-delimited lists, and which are therefore allowed
		 * to appear multiple times in the headers. For non-list-valued
		 * headers, use {@link Soup.MessageHeaders.get_one}.
		 * 
		 * If #name appears multiple times in #hdrs,
		 * soup_message_headers_get_list() will concatenate all of the values
		 * together, separated by commas. This is sometimes awkward to parse
		 * (eg, WWW-Authenticate, Set-Cookie), but you have to be able to deal
		 * with it anyway, because the HTTP spec explicitly states that this
		 * transformation is allowed, and so an upstream proxy could do the
		 * same thing.
		 * @param name header name
		 * @returns the header's value or %NULL if not found.
		 */
		public get_list(name: string): string | null;
		/**
		 * Gets the value of header #name in #hdrs. Use this for headers whose
		 * values are <emphasis>not</emphasis> comma-delimited lists, and
		 * which therefore can only appear at most once in the headers. For
		 * list-valued headers, use {@link Soup.MessageHeaders.get_list}.
		 * 
		 * If #hdrs does erroneously contain multiple copies of the header, it
		 * is not defined which one will be returned. (Ideally, it will return
		 * whichever one makes libsoup most compatible with other HTTP
		 * implementations.)
		 * @param name header name
		 * @returns the header's value or %NULL if not found.
		 */
		public get_one(name: string): string | null;
		/**
		 * Parses #hdrs's Range header and returns an array of the requested
		 * byte ranges. The returned array must be freed with
		 * {@link Soup.MessageHeaders.free_ranges}.
		 * 
		 * If #total_length is non-0, its value will be used to adjust the
		 * returned ranges to have explicit start and end values, and the
		 * returned ranges will be sorted and non-overlapping. If
		 * #total_length is 0, then some ranges may have an end value of -1,
		 * as described under {@link Range}, and some of the ranges may be
		 * redundant.
		 * 
		 * Beware that even if given a #total_length, this function does not
		 * check that the ranges are satisfiable.
		 * 
		 * <note><para>
		 * #SoupServer has built-in handling for range requests. If your
		 * server handler returns a %SOUP_STATUS_OK response containing the
		 * complete response body (rather than pausing the message and
		 * returning some of the response body later), and there is a Range
		 * header in the request, then libsoup will automatically convert the
		 * response to a %SOUP_STATUS_PARTIAL_CONTENT response containing only
		 * the range(s) requested by the client.
		 * 
		 * The only time you need to process the Range header yourself is if
		 * either you need to stream the response body rather than returning
		 * it all at once, or you do not already have the complete response
		 * body available, and only want to generate the parts that were
		 * actually requested by the client.
		 * </para></note>
		 * @param total_length the total_length of the response body
		 * @returns %TRUE if #hdrs contained a syntactically-valid
		 * "Range" header, %FALSE otherwise (in which case #range and #length
		 * will not be set).
		 * 
		 * return location for an array
		 * of {@link Range}
		 * 
		 * the length of the returned array
		 */
		public get_ranges(total_length: number): [ boolean, Range[], number ];
		/**
		 * Checks whether the list-valued header #name is present in #hdrs,
		 * and contains a case-insensitive match for #token.
		 * 
		 * (If #name is present in #hdrs, then this is equivalent to calling
		 * {@link Soup.header.contains} on its value.)
		 * @param name header name
		 * @param token token to look for
		 * @returns %TRUE if the header is present and contains #token,
		 *   %FALSE otherwise.
		 */
		public header_contains(name: string, token: string): boolean;
		/**
		 * Checks whether the header #name is present in #hdrs and is
		 * (case-insensitively) equal to #value.
		 * @param name header name
		 * @param value expected value
		 * @returns %TRUE if the header is present and its value is
		 *   #value, %FALSE otherwise.
		 */
		public header_equals(name: string, value: string): boolean;
		/**
		 * Removes #name from #hdrs. If there are multiple values for #name,
		 * they are all removed.
		 * @param name the header name to remove
		 */
		public remove(name: string): void;
		/**
		 * Replaces the value of the header #name in #hdrs with #value. (See
		 * also {@link Soup.MessageHeaders.append}.)
		 * 
		 * The caller is expected to make sure that #name and #value are
		 * syntactically correct.
		 * @param name the header name to replace
		 * @param value the new value of #name
		 */
		public replace(name: string, value: string): void;
		/**
		 * Sets the "Content-Disposition" header in #hdrs to #disposition,
		 * optionally with additional parameters specified in #params.
		 * 
		 * See {@link Soup.MessageHeaders.get_content_disposition} for a discussion
		 * of how Content-Disposition is used in HTTP.
		 * @param disposition the disposition-type
		 * @param params additional
		 * parameters, or %NULL
		 */
		public set_content_disposition(disposition: string, params: string[] | null): void;
		/**
		 * Sets the message body length that #hdrs will declare, and sets
		 * #hdrs's encoding to %SOUP_ENCODING_CONTENT_LENGTH.
		 * 
		 * You do not normally need to call this; if #hdrs is set to use
		 * Content-Length encoding, libsoup will automatically set its
		 * Content-Length header for you immediately before sending the
		 * headers. One situation in which this method is useful is when
		 * generating the response to a HEAD request; Calling
		 * {@link Soup.MessageHeaders.set_content_length} allows you to put the
		 * correct content length into the response without needing to waste
		 * memory by filling in a response body which won't actually be sent.
		 * @param content_length the message body length
		 */
		public set_content_length(content_length: number): void;
		/**
		 * Sets #hdrs's Content-Range header according to the given values.
		 * (Note that #total_length is the total length of the entire resource
		 * that this is a range of, not simply #end - #start + 1.)
		 * 
		 * <note><para>
		 * {@link Server} has built-in handling for range requests, and you do
		 * not normally need to call this function youself. See
		 * {@link Soup.MessageHeaders.get_ranges} for more details.
		 * </para></note>
		 * @param start the start of the range
		 * @param end the end of the range
		 * @param total_length the total length of the resource, or -1 if unknown
		 */
		public set_content_range(start: number, end: number, total_length: number): void;
		/**
		 * Sets the "Content-Type" header in #hdrs to #content_type,
		 * optionally with additional parameters specified in #params.
		 * @param content_type the MIME type
		 * @param params additional
		 * parameters, or %NULL
		 */
		public set_content_type(content_type: string, params: string[] | null): void;
		/**
		 * Sets the message body encoding that #hdrs will declare. In particular,
		 * you should use this if you are going to send a request or response in
		 * chunked encoding.
		 * @param encoding a {@link Encoding}
		 */
		public set_encoding(encoding: Encoding): void;
		/**
		 * Sets #hdrs's "Expect" header according to #expectations.
		 * 
		 * Currently %SOUP_EXPECTATION_CONTINUE is the only known expectation
		 * value. You should set this value on a request if you are sending a
		 * large message body (eg, via POST or PUT), and want to give the
		 * server a chance to reject the request after seeing just the headers
		 * (eg, because it will require authentication before allowing you to
		 * post, or because you're POSTing to a URL that doesn't exist). This
		 * saves you from having to transmit the large request body when the
		 * server is just going to ignore it anyway.
		 * @param expectations the expectations to set
		 */
		public set_expectations(expectations: Expectation): void;
		/**
		 * Sets #hdrs's Range header to request the indicated range.
		 * #start and #end are interpreted as in a {@link Range}.
		 * 
		 * If you need to request multiple ranges, use
		 * {@link Soup.MessageHeaders.set_ranges}.
		 * @param start the start of the range to request
		 * @param end the end of the range to request
		 */
		public set_range(start: number, end: number): void;
		/**
		 * Sets #hdrs's Range header to request the indicated ranges. (If you
		 * only want to request a single range, you can use
		 * {@link Soup.MessageHeaders.set_range}.)
		 * @param ranges an array of {@link Range}
		 * @param length the length of #range
		 */
		public set_ranges(ranges: Range, length: number): void;
	}

	export interface MessageHeadersIterInitOptions {}
	/**
	 * An opaque type used to iterate over a %SoupMessageHeaders
	 * structure.
	 * 
	 * After intializing the iterator with
	 * {@link Soup.message.headers_iter_init}, call
	 * soup_message_headers_iter_next() to fetch data from it.
	 * 
	 * You may not modify the headers while iterating over them.
	 */
	interface MessageHeadersIter {}
	class MessageHeadersIter {
		public constructor(options?: Partial<MessageHeadersIterInitOptions>);
		/**
		 * Initializes #iter for iterating #hdrs.
		 * @param hdrs a %SoupMessageHeaders
		 * @returns a pointer to a %SoupMessageHeadersIter
		 * structure
		 */
		public static init(hdrs: MessageHeaders): MessageHeadersIter;
		public readonly dummy: any[];
		/**
		 * Yields the next name/value pair in the %SoupMessageHeaders being
		 * iterated by #iter. If #iter has already yielded the last header,
		 * then {@link Soup.MessageHeadersIter.next} will return %FALSE and #name
		 * and #value will be unchanged.
		 * @returns %TRUE if another name and value were returned, %FALSE
		 * if the end of the headers has been reached.
		 * 
		 * pointer to a variable to return
		 * the header name in
		 * 
		 * pointer to a variable to return
		 * the header value in
		 */
		public next(): [ boolean, string, string ];
	}

	export interface MessageQueueInitOptions {}
	interface MessageQueue {}
	class MessageQueue {
		public constructor(options?: Partial<MessageQueueInitOptions>);
	}

	export interface MessageQueueItemInitOptions {}
	interface MessageQueueItem {}
	class MessageQueueItem {
		public constructor(options?: Partial<MessageQueueItemInitOptions>);
	}

	export interface MultipartInitOptions {}
	/**
	 * Represents a multipart HTTP message body, parsed according to the
	 * syntax of RFC 2046. Of particular interest to HTTP are
	 * <literal>multipart/byte-ranges</literal> and
	 * <literal>multipart/form-data</literal>.
	 * 
	 * Although the headers of a {@link Multipart} body part will contain the
	 * full headers from that body part, libsoup does not interpret them
	 * according to MIME rules. For example, each body part is assumed to
	 * have "binary" Content-Transfer-Encoding, even if its headers
	 * explicitly state otherwise. In other words, don't try to use
	 * #SoupMultipart for handling real MIME multiparts.
	 */
	interface Multipart {}
	class Multipart {
		public constructor(options?: Partial<MultipartInitOptions>);
		/**
		 * Creates a new empty {@link Multipart} with a randomly-generated
		 * boundary string. Note that #mime_type must be the full MIME type,
		 * including "multipart/".
		 * @param mime_type the MIME type of the multipart to create.
		 * @returns a new empty {@link Multipart} of the given #mime_type
		 */
		public static new(mime_type: string): Multipart;
		/**
		 * Parses #headers and #body to form a new {@link Multipart}
		 * @param headers the headers of the HTTP message to parse
		 * @param body the body of the HTTP message to parse
		 * @returns a new {@link Multipart} (or %NULL if the
		 * message couldn't be parsed or wasn't multipart).
		 */
		public static new_from_message(headers: MessageHeaders, body: MessageBody): Multipart | null;
		/**
		 * Adds a new MIME part containing #body to #multipart, using
		 * "Content-Disposition: form-data", as per the HTML forms
		 * specification. See {@link Soup.form.request_new_from_multipart} for more
		 * details.
		 * @param control_name the name of the control associated with this file
		 * @param filename the name of the file, or %NULL if not known
		 * @param content_type the MIME type of the file, or %NULL if not known
		 * @param body the file data
		 */
		public append_form_file(control_name: string, filename: string, content_type: string, body: Buffer): void;
		/**
		 * Adds a new MIME part containing #data to #multipart, using
		 * "Content-Disposition: form-data", as per the HTML forms
		 * specification. See {@link Soup.form.request_new_from_multipart} for more
		 * details.
		 * @param control_name the name of the control associated with #data
		 * @param data the body data
		 */
		public append_form_string(control_name: string, data: string): void;
		/**
		 * Adds a new MIME part to #multipart with the given headers and body.
		 * (The multipart will make its own copies of #headers and #body, so
		 * you should free your copies if you are not using them for anything
		 * else.)
		 * @param headers the MIME part headers
		 * @param body the MIME part body
		 */
		public append_part(headers: MessageHeaders, body: Buffer): void;
		/**
		 * Frees #multipart
		 */
		public free(): void;
		/**
		 * Gets the number of body parts in #multipart
		 * @returns the number of body parts in #multipart
		 */
		public get_length(): number;
		/**
		 * Gets the indicated body part from #multipart.
		 * @param part the part number to get (counting from 0)
		 * @returns %TRUE on success, %FALSE if #part is out of range (in
		 * which case #headers and #body won't be set)
		 * 
		 * return location for the MIME part
		 * headers
		 * 
		 * return location for the MIME part
		 * body
		 */
		public get_part(part: number): [ boolean, MessageHeaders, Buffer ];
		/**
		 * Serializes #multipart to #dest_headers and #dest_body.
		 * @param dest_headers the headers of the HTTP message to serialize #multipart to
		 * @param dest_body the body of the HTTP message to serialize #multipart to
		 */
		public to_message(dest_headers: MessageHeaders, dest_body: MessageBody): void;
	}

	export interface PasswordManagerInterfaceInitOptions {}
	interface PasswordManagerInterface {}
	class PasswordManagerInterface {
		public constructor(options?: Partial<PasswordManagerInterfaceInitOptions>);
		public readonly base: GObject.TypeInterface;
		public get_passwords_async: {(password_manager: PasswordManager, msg: Message, auth: Auth, retrying: boolean, async_context: GLib.MainContext, cancellable: Gio.Cancellable | null, callback: PasswordManagerCallback): void;};
		public get_passwords_sync: {(password_manager: PasswordManager, msg: Message, auth: Auth, cancellable: Gio.Cancellable | null): void;};
	}

	export interface ProxyResolverInterfaceInitOptions {}
	interface ProxyResolverInterface {}
	class ProxyResolverInterface {
		public constructor(options?: Partial<ProxyResolverInterfaceInitOptions>);
		public readonly base: GObject.TypeInterface;
		public get_proxy_async: {(proxy_resolver: ProxyResolver, msg: Message, async_context: GLib.MainContext, cancellable: Gio.Cancellable | null, callback: ProxyResolverCallback): void;};
		public get_proxy_sync: {(proxy_resolver: ProxyResolver, msg: Message, cancellable: Gio.Cancellable | null): [ number, Address ];};
	}

	export interface ProxyURIResolverInterfaceInitOptions {}
	interface ProxyURIResolverInterface {}
	class ProxyURIResolverInterface {
		public constructor(options?: Partial<ProxyURIResolverInterfaceInitOptions>);
		public readonly base: GObject.TypeInterface;
		public get_proxy_uri_async: {(proxy_uri_resolver: ProxyURIResolver, uri: URI, async_context: GLib.MainContext | null, cancellable: Gio.Cancellable | null, callback: ProxyURIResolverCallback): void;};
		public get_proxy_uri_sync: {(proxy_uri_resolver: ProxyURIResolver, uri: URI, cancellable: Gio.Cancellable | null): [ number, URI ];};
		public _libsoup_reserved1: {(): void;};
		public _libsoup_reserved2: {(): void;};
		public _libsoup_reserved3: {(): void;};
		public _libsoup_reserved4: {(): void;};
	}

	export interface RangeInitOptions {}
	/**
	 * Represents a byte range as used in the Range header.
	 * 
	 * If #end is non-negative, then #start and #end represent the bounds
	 * of of the range, counting from 0. (Eg, the first 500 bytes would be
	 * represented as #start = 0 and #end = 499.)
	 * 
	 * If #end is -1 and #start is non-negative, then this represents a
	 * range starting at #start and ending with the last byte of the
	 * requested resource body. (Eg, all but the first 500 bytes would be
	 * #start = 500, and #end = -1.)
	 * 
	 * If #end is -1 and #start is negative, then it represents a "suffix
	 * range", referring to the last -#start bytes of the resource body.
	 * (Eg, the last 500 bytes would be #start = -500 and #end = -1.)
	 */
	interface Range {}
	class Range {
		public constructor(options?: Partial<RangeInitOptions>);
		/**
		 * the start of the range
		 */
		public start: number;
		/**
		 * the end of the range
		 */
		public end: number;
	}

	export interface SessionFeatureInterfaceInitOptions {}
	/**
	 * The interface implemented by {@link SessionFeature}<!-- -->s.
	 */
	interface SessionFeatureInterface {}
	class SessionFeatureInterface {
		public constructor(options?: Partial<SessionFeatureInterfaceInitOptions>);
		public attach: {(feature: SessionFeature, session: Session): void;};
		public detach: {(feature: SessionFeature, session: Session): void;};
		public request_queued: {(feature: SessionFeature, session: Session, msg: Message): void;};
		public request_started: {(feature: SessionFeature, session: Session, msg: Message, socket: Socket): void;};
		public request_unqueued: {(feature: SessionFeature, session: Session, msg: Message): void;};
		public add_feature: {(feature: SessionFeature, type: GObject.Type): boolean;};
		public remove_feature: {(feature: SessionFeature, type: GObject.Type): boolean;};
		public has_feature: {(feature: SessionFeature, type: GObject.Type): boolean;};
	}

	export interface URIInitOptions {}
	/**
	 * A {@link URI} represents a (parsed) URI. #SoupURI supports RFC 3986
	 * (URI Generic Syntax), and can parse any valid URI. However, libsoup
	 * only uses "http" and "https" URIs internally; You can use
	 * {@link SOUP.URI_VALID_FOR_HTTP} to test if a #SoupURI is a valid HTTP
	 * URI.
	 * 
	 * #scheme will always be set in any URI. It is an interned string and
	 * is always all lowercase. (If you parse a URI with a non-lowercase
	 * scheme, it will be converted to lowercase.) The macros
	 * %SOUP_URI_SCHEME_HTTP and %SOUP_URI_SCHEME_HTTPS provide the
	 * interned values for "http" and "https" and can be compared against
	 * URI #scheme values.
	 * 
	 * #user and #password are parsed as defined in the older URI specs
	 * (ie, separated by a colon; RFC 3986 only talks about a single
	 * "userinfo" field). Note that #password is not included in the
	 * output of soup_uri_to_string(). libsoup does not normally use these
	 * fields; authentication is handled via #SoupSession signals.
	 * 
	 * #host contains the hostname, and #port the port specified in the
	 * URI. If the URI doesn't contain a hostname, #host will be %NULL,
	 * and if it doesn't specify a port, #port may be 0. However, for
	 * "http" and "https" URIs, #host is guaranteed to be non-%NULL
	 * (trying to parse an http URI with no #host will return %NULL), and
	 * #port will always be non-0 (because libsoup knows the default value
	 * to use when it is not specified in the URI).
	 * 
	 * #path is always non-%NULL. For http/https URIs, #path will never be
	 * an empty string either; if the input URI has no path, the parsed
	 * #SoupURI will have a #path of "/".
	 * 
	 * #query and #fragment are optional for all URI types.
	 * soup_form_decode() may be useful for parsing #query.
	 * 
	 * Note that #path, #query, and #fragment may contain
	 * %<!-- -->-encoded characters. soup_uri_new() calls
	 * soup_uri_normalize() on them, but not soup_uri_decode(). This is
	 * necessary to ensure that soup_uri_to_string() will generate a URI
	 * that has exactly the same meaning as the original. (In theory,
	 * #SoupURI should leave #user, #password, and #host partially-encoded
	 * as well, but this would be more annoying than useful.)
	 */
	interface URI {}
	class URI {
		public constructor(options?: Partial<URIInitOptions>);
		/**
		 * Parses an absolute URI.
		 * 
		 * You can also pass %NULL for #uri_string if you want to get back an
		 * "empty" {@link URI} that you can fill in by hand. (You will need to
		 * call at least {@link Soup.URI.set_scheme} and soup_uri_set_path(), since
		 * those fields are required.)
		 * @param uri_string a URI
		 * @returns a {@link URI}, or %NULL if the given string
		 *  was found to be invalid.
		 */
		public static new(uri_string: string | null): URI | null;
		/**
		 * Parses #uri_string relative to #base.
		 * @param base a base URI
		 * @param uri_string the URI
		 * @returns a parsed {@link URI}.
		 */
		public static new_with_base(base: URI, uri_string: string): URI;
		/**
		 * Fully %<!-- -->-decodes #part.
		 * 
		 * In the past, this would return %NULL if #part contained invalid
		 * percent-encoding, but now it just ignores the problem (as
		 * {@link Soup.URI.new} already did).
		 * @param part a URI part
		 * @returns the decoded URI part.
		 */
		public static decode(part: string): string;
		/**
		 * This %<!-- -->-encodes the given URI part and returns the escaped
		 * version in allocated memory, which the caller must free when it is
		 * done.
		 * @param part a URI part
		 * @param escape_extra additional reserved characters to
		 * escape (or %NULL)
		 * @returns the encoded URI part
		 */
		public static encode(part: string, escape_extra: string | null): string;
		/**
		 * %<!-- -->-decodes any "unreserved" characters (or characters in
		 * #unescape_extra) in #part, and %<!-- -->-encodes any non-ASCII
		 * characters, spaces, and non-printing characters in #part.
		 * 
		 * "Unreserved" characters are those that are not allowed to be used
		 * for punctuation according to the URI spec. For example, letters are
		 * unreserved, so {@link Soup.uri.normalize} will turn
		 * <literal>http://example.com/foo/b%<!-- -->61r</literal> into
		 * <literal>http://example.com/foo/bar</literal>, which is guaranteed
		 * to mean the same thing. However, "/" is "reserved", so
		 * <literal>http://example.com/foo%<!-- -->2Fbar</literal> would not
		 * be changed, because it might mean something different to the
		 * server.
		 * 
		 * In the past, this would return %NULL if #part contained invalid
		 * percent-encoding, but now it just ignores the problem (as
		 * soup_uri_new() already did).
		 * @param part a URI part
		 * @param unescape_extra reserved characters to unescape (or %NULL)
		 * @returns the normalized URI part
		 */
		public static normalize(part: string, unescape_extra: string | null): string;
		/**
		 * the URI scheme (eg, "http")
		 */
		public scheme: string;
		/**
		 * a username, or %NULL
		 */
		public user: string;
		/**
		 * a password, or %NULL
		 */
		public password: string;
		/**
		 * the hostname or IP address, or %NULL
		 */
		public host: string;
		/**
		 * the port number on #host
		 */
		public port: number;
		/**
		 * the path on #host
		 */
		public path: string;
		/**
		 * a query for #path, or %NULL
		 */
		public query: string;
		/**
		 * a fragment identifier within #path, or %NULL
		 */
		public fragment: string;
		/**
		 * Copies #uri
		 * @returns a copy of #uri, which must be freed with {@link Soup.URI.free}
		 */
		public copy(): URI;
		/**
		 * Makes a copy of #uri, considering only the protocol, host, and port
		 * @returns the new {@link URI}
		 */
		public copy_host(): URI;
		/**
		 * Tests whether or not #uri1 and #uri2 are equal in all parts
		 * @param uri2 another {@link URI}
		 * @returns %TRUE or %FALSE
		 */
		public equal(uri2: URI): boolean;
		/**
		 * Frees #uri.
		 */
		public free(): void;
		/**
		 * Gets #uri's fragment.
		 * @returns #uri's fragment.
		 */
		public get_fragment(): string;
		/**
		 * Gets #uri's host.
		 * @returns #uri's host.
		 */
		public get_host(): string;
		/**
		 * Gets #uri's password.
		 * @returns #uri's password.
		 */
		public get_password(): string;
		/**
		 * Gets #uri's path.
		 * @returns #uri's path.
		 */
		public get_path(): string;
		/**
		 * Gets #uri's port.
		 * @returns #uri's port.
		 */
		public get_port(): number;
		/**
		 * Gets #uri's query.
		 * @returns #uri's query.
		 */
		public get_query(): string;
		/**
		 * Gets #uri's scheme.
		 * @returns #uri's scheme.
		 */
		public get_scheme(): string;
		/**
		 * Gets #uri's user.
		 * @returns #uri's user.
		 */
		public get_user(): string;
		/**
		 * Compares #v1 and #v2, considering only the scheme, host, and port.
		 * @param v2 a {@link URI} with a non-%NULL #host member
		 * @returns whether or not the URIs are equal in scheme, host,
		 * and port.
		 */
		public host_equal(v2: URI): boolean;
		/**
		 * Hashes #key, considering only the scheme, host, and port.
		 * @returns a hash
		 */
		public host_hash(): number;
		/**
		 * Sets #uri's fragment to #fragment.
		 * @param fragment the fragment
		 */
		public set_fragment(fragment: string | null): void;
		/**
		 * Sets #uri's host to #host.
		 * 
		 * If #host is an IPv6 IP address, it should not include the brackets
		 * required by the URI syntax; they will be added automatically when
		 * converting #uri to a string.
		 * 
		 * http and https URIs should not have a %NULL #host.
		 * @param host the hostname or IP address, or %NULL
		 */
		public set_host(host: string | null): void;
		/**
		 * Sets #uri's password to #password.
		 * @param password the password, or %NULL
		 */
		public set_password(password: string | null): void;
		/**
		 * Sets #uri's path to #path.
		 * @param path the non-%NULL path
		 */
		public set_path(path: string): void;
		/**
		 * Sets #uri's port to #port. If #port is 0, #uri will not have an
		 * explicitly-specified port.
		 * @param port the port, or 0
		 */
		public set_port(port: number): void;
		/**
		 * Sets #uri's query to #query.
		 * @param query the query
		 */
		public set_query(query: string | null): void;
		/**
		 * Sets #uri's query to the result of encoding the given form fields
		 * and values according to the * HTML form rules. See
		 * {@link Soup.form.encode} for more information.
		 * @param first_field name of the first form field to encode into query
		 */
		public set_query_from_fields(first_field: string): void;
		/**
		 * Sets #uri's query to the result of encoding #form according to the
		 * HTML form rules. See {@link Soup.form.encode_hash} for more information.
		 * @param form a #GHashTable containing HTML form
		 * information
		 */
		public set_query_from_form(form: string[]): void;
		/**
		 * Sets #uri's scheme to #scheme. This will also set #uri's port to
		 * the default port for #scheme, if known.
		 * @param scheme the URI scheme
		 */
		public set_scheme(scheme: string): void;
		/**
		 * Sets #uri's user to #user.
		 * @param user the username, or %NULL
		 */
		public set_user(user: string | null): void;
		/**
		 * Returns a string representing #uri.
		 * 
		 * If #just_path_and_query is %TRUE, this concatenates the path and query
		 * together. That is, it constructs the string that would be needed in
		 * the Request-Line of an HTTP request for #uri.
		 * 
		 * Note that the output will never contain a password, even if #uri
		 * does.
		 * @param just_path_and_query if %TRUE, output just the path and query portions
		 * @returns a string representing #uri, which the caller must free.
		 */
		public to_string(just_path_and_query: boolean): string;
		/**
		 * Tests if #uri uses the default port for its scheme. (Eg, 80 for
		 * http.) (This only works for http, https and ftp; libsoup does not know
		 * the default ports of other protocols.)
		 * @returns %TRUE or %FALSE
		 */
		public uses_default_port(): boolean;
	}

	export interface XMLRPCParamsInitOptions {}
	/**
	 * Opaque structure containing XML-RPC methodCall parameter values.
	 * Can be parsed using {@link Soup.xmlrpc_params_parse} and freed with
	 * soup_xmlrpc_params_free().
	 */
	interface XMLRPCParams {}
	class XMLRPCParams {
		public constructor(options?: Partial<XMLRPCParamsInitOptions>);
		/**
		 * Free a {@link XMLRPCParams} returned by {@link Soup.xmlrpc.parse_request}.
		 */
		public free(): void;
		/**
		 * Parse method parameters returned by {@link Soup.xmlrpc.parse_request}.
		 * 
		 * Deserialization details:
		 *  - If #signature is provided, &lt;int&gt; and &lt;i4&gt; can be deserialized
		 *    to byte, int16, uint16, int32, uint32, int64 or uint64. Otherwise
		 *    it will be deserialized to int32. If the value is out of range
		 *    for the target type it will return an error.
		 *  - &lt;struct&gt; will be deserialized to "a{sv}". #signature could define
		 *    another value type (e.g. "a{ss}").
		 *  - &lt;array&gt; will be deserialized to "av". #signature could define
		 *    another element type (e.g. "as") or could be a tuple (e.g. "(ss)").
		 *  - &lt;base64&gt; will be deserialized to "ay".
		 *  - &lt;string&gt; will be deserialized to "s".
		 *  - &lt;dateTime.iso8601&gt; will be deserialized to an unspecified variant
		 *    type. If #signature is provided it must have the generic "v" type, which
		 *    means there is no guarantee that it's actually a datetime that has been
		 *    received. soup_xmlrpc_variant_get_datetime() must be used to parse and
		 *    type check this special variant.
		 *  - #signature must not have maybes, otherwise an error is returned.
		 *  - Dictionaries must have string keys, otherwise an error is returned.
		 * @param signature A valid #GVariant type string, or %NULL
		 * @returns a new (non-floating) #GVariant, or %NULL
		 */
		public parse(signature: string | null): GLib.Variant;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PasswordManager} instead.
	 */
	interface IPasswordManager {
		get_passwords_async(msg: Message, auth: Auth, retrying: boolean, async_context: GLib.MainContext, cancellable: Gio.Cancellable | null, callback: PasswordManagerCallback): void;
		get_passwords_sync(msg: Message, auth: Auth, cancellable: Gio.Cancellable | null): void;
	}

	type PasswordManagerInitOptionsMixin  = {};
	export interface PasswordManagerInitOptions extends PasswordManagerInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link PasswordManager} instead.
	 */
	type PasswordManagerMixin = IPasswordManager;

	interface PasswordManager extends PasswordManagerMixin {}

	class PasswordManager {
		public constructor(options?: Partial<PasswordManagerInitOptions>);
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ProxyResolver} instead.
	 */
	interface IProxyResolver {
		get_proxy_async(msg: Message, async_context: GLib.MainContext, cancellable: Gio.Cancellable | null, callback: ProxyResolverCallback): void;
		get_proxy_sync(msg: Message, cancellable: Gio.Cancellable | null): [ number, Address ];
	}

	type ProxyResolverInitOptionsMixin  = {};
	export interface ProxyResolverInitOptions extends ProxyResolverInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ProxyResolver} instead.
	 */
	type ProxyResolverMixin = IProxyResolver;

	interface ProxyResolver extends ProxyResolverMixin {}

	class ProxyResolver {
		public constructor(options?: Partial<ProxyResolverInitOptions>);
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ProxyURIResolver} instead.
	 */
	interface IProxyURIResolver {
		/**
		 * @deprecated
		 * {@link ProxyURIResolver} is deprecated in favor of
		 * #GProxyResolver
		 * 
		 * Asynchronously determines a proxy URI to use for #msg and calls
		 * #callback.
		 * @param uri the {@link URI} you want a proxy for
		 * @param async_context the #GMainContext to invoke #callback in
		 * @param cancellable a #GCancellable, or %NULL
		 * @param callback callback to invoke with the proxy address
		 */
		get_proxy_uri_async(uri: URI, async_context: GLib.MainContext | null, cancellable: Gio.Cancellable | null, callback: ProxyURIResolverCallback): void;
		/**
		 * @deprecated
		 * {@link ProxyURIResolver} is deprecated in favor of
		 * #GProxyResolver
		 * 
		 * Synchronously determines a proxy URI to use for #uri. If #uri
		 * should be sent via proxy, *#proxy_uri will be set to the URI of the
		 * proxy, else it will be set to %NULL.
		 * @param uri the {@link URI} you want a proxy for
		 * @param cancellable a #GCancellable, or %NULL
		 * @returns %SOUP_STATUS_OK if successful, or a transport-level
		 * error.
		 * 
		 * on return, will contain the proxy URI
		 */
		get_proxy_uri_sync(uri: URI, cancellable: Gio.Cancellable | null): [ number, URI ];
	}

	type ProxyURIResolverInitOptionsMixin  = {};
	export interface ProxyURIResolverInitOptions extends ProxyURIResolverInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ProxyURIResolver} instead.
	 */
	type ProxyURIResolverMixin = IProxyURIResolver;

	interface ProxyURIResolver extends ProxyURIResolverMixin {}

	class ProxyURIResolver {
		public constructor(options?: Partial<ProxyURIResolverInitOptions>);
	}



	/** This construct is only for enabling class multi-inheritance,
	 * use {@link SessionFeature} instead.
	 */
	interface ISessionFeature {
		/**
		 * Adds a "sub-feature" of type #type to the base feature #feature.
		 * This is used for features that can be extended with multiple
		 * different types. Eg, the authentication manager can be extended
		 * with subtypes of {@link Auth}.
		 * @param type the #GType of a "sub-feature"
		 * @returns %TRUE if #feature accepted #type as a subfeature.
		 */
		add_feature(type: GObject.Type): boolean;
		attach(session: Session): void;
		detach(session: Session): void;
		/**
		 * Tests if #feature has a "sub-feature" of type #type. See
		 * {@link Soup.SessionFeature.add_feature}.
		 * @param type the #GType of a "sub-feature"
		 * @returns %TRUE if #feature has a subfeature of type #type
		 */
		has_feature(type: GObject.Type): boolean;
		/**
		 * Removes the "sub-feature" of type #type from the base feature
		 * #feature. See {@link Soup.SessionFeature.add_feature}.
		 * @param type the #GType of a "sub-feature"
		 * @returns %TRUE if #type was removed from #feature
		 */
		remove_feature(type: GObject.Type): boolean;
	}

	type SessionFeatureInitOptionsMixin  = {};
	export interface SessionFeatureInitOptions extends SessionFeatureInitOptionsMixin {}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link SessionFeature} instead.
	 */
	type SessionFeatureMixin = ISessionFeature;

	/**
	 * An object that implement some sort of optional feature for
	 * {@link Session}.
	 */
	interface SessionFeature extends SessionFeatureMixin {}

	class SessionFeature {
		public constructor(options?: Partial<SessionFeatureInitOptions>);
	}



	/**
	 * The supported address families.
	 */
	enum AddressFamily {
		/**
		 * an invalid %SoupAddress
		 */
		INVALID = -1,
		/**
		 * an IPv4 address
		 */
		IPV4 = 2,
		/**
		 * an IPv6 address
		 */
		IPV6 = 10
	}

	enum CacheResponse {
		FRESH = 0,
		NEEDS_VALIDATION = 1,
		STALE = 2
	}

	/**
	 * The type of cache; this affects what kinds of responses will be
	 * saved.
	 */
	enum CacheType {
		/**
		 * a single-user cache
		 */
		SINGLE_USER = 0,
		/**
		 * a shared cache
		 */
		SHARED = 1
	}

	enum ConnectionState {
		NEW = 0,
		CONNECTING = 1,
		IDLE = 2,
		IN_USE = 3,
		REMOTE_DISCONNECTED = 4,
		DISCONNECTED = 5
	}

	/**
	 * The policy for accepting or rejecting cookies returned in
	 * responses.
	 */
	enum CookieJarAcceptPolicy {
		/**
		 * accept all cookies unconditionally.
		 */
		ALWAYS = 0,
		/**
		 * reject all cookies unconditionally.
		 */
		NEVER = 1,
		/**
		 * accept all cookies set by
		 * the main document loaded in the application using libsoup. An
		 * example of the most common case, web browsers, would be: If
		 * http://www.example.com is the page loaded, accept all cookies set
		 * by example.com, but if a resource from http://www.third-party.com
		 * is loaded from that page reject any cookie that it could try to
		 * set. For libsoup to be able to tell apart first party cookies from
		 * the rest, the application must call {@link Soup.Message.set_first_party}
		 * on each outgoing {@link Message}, setting the #SoupURI of the main
		 * document. If no first party is set in a message when this policy is
		 * in effect, cookies will be assumed to be third party by default.
		 */
		NO_THIRD_PARTY = 2,
		/**
		 * accept all cookies
		 * set by the main document loaded in the application using libsoup, and
		 * from domains that have previously set at least one cookie when loaded
		 * as the main document. An example of the most common case, web browsers,
		 * would be: if http://www.example.com is the page loaded, accept all
		 * cookies set by example.com, but if a resource from http://www.third-party.com
		 * is loaded from that page, reject any cookie that it could try to
		 * set unless it already has a cookie in the cookie jar. For libsoup to
		 * be able to tell apart first party cookies from the rest, the
		 * application must call {@link Soup.Message.set_first_party} on each outgoing
		 * {@link Message}, setting the #SoupURI of the main document. If no first
		 * party is set in a message when this policy is in effect, cookies will
		 * be assumed to be third party by default. Since 2.72.
		 */
		GRANDFATHERED_THIRD_PARTY = 3
	}

	/**
	 * Date formats that {@link Soup.Date.to_string} can use.
	 * 
	 * #SOUP_DATE_HTTP and #SOUP_DATE_COOKIE always coerce the time to
	 * UTC. #SOUP_DATE_ISO8601_XMLRPC uses the time as given, ignoring the
	 * offset completely. #SOUP_DATE_RFC2822 and the other ISO 8601
	 * variants use the local time, appending the offset information if
	 * available.
	 * 
	 * This enum may be extended with more values in future releases.
	 */
	enum DateFormat {
		/**
		 * RFC 1123 format, used by the HTTP "Date" header. Eg
		 * "Sun, 06 Nov 1994 08:49:37 GMT"
		 */
		HTTP = 1,
		/**
		 * The format for the "Expires" timestamp in the
		 * Netscape cookie specification. Eg, "Sun, 06-Nov-1994 08:49:37 GMT".
		 */
		COOKIE = 2,
		/**
		 * RFC 2822 format, eg "Sun, 6 Nov 1994 09:49:37 -0100"
		 */
		RFC2822 = 3,
		/**
		 * ISO 8601 date/time with no optional
		 * punctuation. Eg, "19941106T094937-0100".
		 */
		ISO8601_COMPACT = 4,
		/**
		 * ISO 8601 date/time with all optional
		 * punctuation. Eg, "1994-11-06T09:49:37-01:00".
		 */
		ISO8601_FULL = 5,
		/**
		 * An alias for #SOUP_DATE_ISO8601_FULL.
		 */
		ISO8601 = 5,
		/**
		 * ISO 8601 date/time as used by XML-RPC.
		 * Eg, "19941106T09:49:37".
		 */
		ISO8601_XMLRPC = 6
	}

	/**
	 * How a message body is encoded for transport
	 */
	enum Encoding {
		/**
		 * unknown / error
		 */
		UNRECOGNIZED = 0,
		/**
		 * no body is present (which is not the same as a
		 * 0-length body, and only occurs in certain places)
		 */
		NONE = 1,
		/**
		 * Content-Length encoding
		 */
		CONTENT_LENGTH = 2,
		/**
		 * Response body ends when the connection is closed
		 */
		EOF = 3,
		/**
		 * chunked encoding (currently only supported
		 * for response)
		 */
		CHUNKED = 4,
		/**
		 * multipart/byteranges (Reserved for future
		 * use: NOT CURRENTLY IMPLEMENTED)
		 */
		BYTERANGES = 5
	}

	/**
	 * Indicates the HTTP protocol version being used.
	 */
	enum HTTPVersion {
		/**
		 * HTTP 1.0 (RFC 1945)
		 */
		HTTP_1_0 = 0,
		/**
		 * HTTP 1.1 (RFC 2616)
		 */
		HTTP_1_1 = 1
	}

	enum KnownStatusCode {
		NONE = 0,
		CANCELLED = 1,
		CANT_RESOLVE = 2,
		CANT_RESOLVE_PROXY = 3,
		CANT_CONNECT = 4,
		CANT_CONNECT_PROXY = 5,
		SSL_FAILED = 6,
		IO_ERROR = 7,
		MALFORMED = 8,
		TRY_AGAIN = 9,
		TOO_MANY_REDIRECTS = 10,
		TLS_FAILED = 11,
		CONTINUE = 100,
		SWITCHING_PROTOCOLS = 101,
		PROCESSING = 102,
		OK = 200,
		CREATED = 201,
		ACCEPTED = 202,
		NON_AUTHORITATIVE = 203,
		NO_CONTENT = 204,
		RESET_CONTENT = 205,
		PARTIAL_CONTENT = 206,
		MULTI_STATUS = 207,
		MULTIPLE_CHOICES = 300,
		MOVED_PERMANENTLY = 301,
		FOUND = 302,
		MOVED_TEMPORARILY = 302,
		SEE_OTHER = 303,
		NOT_MODIFIED = 304,
		USE_PROXY = 305,
		NOT_APPEARING_IN_THIS_PROTOCOL = 306,
		TEMPORARY_REDIRECT = 307,
		BAD_REQUEST = 400,
		UNAUTHORIZED = 401,
		PAYMENT_REQUIRED = 402,
		FORBIDDEN = 403,
		NOT_FOUND = 404,
		METHOD_NOT_ALLOWED = 405,
		NOT_ACCEPTABLE = 406,
		PROXY_AUTHENTICATION_REQUIRED = 407,
		PROXY_UNAUTHORIZED = 407,
		REQUEST_TIMEOUT = 408,
		CONFLICT = 409,
		GONE = 410,
		LENGTH_REQUIRED = 411,
		PRECONDITION_FAILED = 412,
		REQUEST_ENTITY_TOO_LARGE = 413,
		REQUEST_URI_TOO_LONG = 414,
		UNSUPPORTED_MEDIA_TYPE = 415,
		REQUESTED_RANGE_NOT_SATISFIABLE = 416,
		INVALID_RANGE = 416,
		EXPECTATION_FAILED = 417,
		UNPROCESSABLE_ENTITY = 422,
		LOCKED = 423,
		FAILED_DEPENDENCY = 424,
		INTERNAL_SERVER_ERROR = 500,
		NOT_IMPLEMENTED = 501,
		BAD_GATEWAY = 502,
		SERVICE_UNAVAILABLE = 503,
		GATEWAY_TIMEOUT = 504,
		HTTP_VERSION_NOT_SUPPORTED = 505,
		INSUFFICIENT_STORAGE = 507,
		NOT_EXTENDED = 510
	}

	/**
	 * Describes the level of logging output to provide.
	 */
	enum LoggerLogLevel {
		/**
		 * No logging
		 */
		NONE = 0,
		/**
		 * Log the Request-Line or Status-Line and
		 * the Soup-Debug pseudo-headers
		 */
		MINIMAL = 1,
		/**
		 * Log the full request/response headers
		 */
		HEADERS = 2,
		/**
		 * Log the full headers and request/response
		 * bodies.
		 */
		BODY = 3
	}

	/**
	 * Describes how {@link Buffer} should use the data passed in by the
	 * caller.
	 * 
	 * See also {@link Soup.Buffer.new_with_owner}, which allows to you create a
	 * buffer containing data which is owned by another object.
	 */
	enum MemoryUse {
		/**
		 * The memory is statically allocated and
		 * constant; libsoup can use the passed-in buffer directly and not
		 * need to worry about it being modified or freed.
		 */
		STATIC = 0,
		/**
		 * The caller has allocated the memory for the
		 * {@link Buffer}'s use; libsoup will assume ownership of it and free it
		 * (with {@link G.free}) when it is done with it.
		 */
		TAKE = 1,
		/**
		 * The passed-in data belongs to the caller; the
		 * {@link Buffer} will copy it into new memory, leaving the caller free
		 * to reuse the original memory.
		 */
		COPY = 2,
		/**
		 * The passed-in data belongs to the caller,
		 * but will remain valid for the lifetime of the {@link Buffer}. The
		 * difference between this and #SOUP_MEMORY_STATIC is that if you copy
		 * a #SOUP_MEMORY_TEMPORARY buffer, it will make a copy of the memory
		 * as well, rather than reusing the original memory.
		 */
		TEMPORARY = 3
	}

	/**
	 * Value passed to {@link Soup.MessageHeaders.new} to set certain default
	 * behaviors.
	 */
	enum MessageHeadersType {
		/**
		 * request headers
		 */
		REQUEST = 0,
		/**
		 * response headers
		 */
		RESPONSE = 1,
		/**
		 * multipart body part headers
		 */
		MULTIPART = 2
	}

	/**
	 * Priorities that can be set on a {@link Message} to instruct the
	 * message queue to process it before any other message with lower
	 * priority.
	 */
	enum MessagePriority {
		/**
		 * The lowest priority, the messages
		 *   with this priority will be the last ones to be attended.
		 */
		VERY_LOW = 0,
		/**
		 * Use this for low priority messages, a
		 *   {@link Message} with the default priority will be processed first.
		 */
		LOW = 1,
		/**
		 * The default priotity, this is the
		 *   priority assigned to the {@link Message} by default.
		 */
		NORMAL = 2,
		/**
		 * High priority, a {@link Message} with
		 *   this priority will be processed before the ones with the default
		 *   priority.
		 */
		HIGH = 3,
		/**
		 * The highest priority, use this
		 *   for very urgent {@link Message} as they will be the first ones to be
		 *   attended.
		 */
		VERY_HIGH = 4
	}

	/**
	 * A {@link Request} error.
	 */
	enum RequestError {
		/**
		 * the URI could not be parsed
		 */
		BAD_URI = 0,
		/**
		 * the URI scheme is not
		 *   supported by this {@link Session}
		 */
		UNSUPPORTED_URI_SCHEME = 1,
		/**
		 * the server's response could not
		 *   be parsed
		 */
		PARSING = 2,
		/**
		 * the server's response was in an
		 *   unsupported format
		 */
		ENCODING = 3
	}

	enum RequesterError {
		BAD_URI = 0,
		UNSUPPORTED_URI_SCHEME = 1
	}

	enum SameSitePolicy {
		/**
		 * The cookie is exposed with both cross-site and same-site requests
		 */
		NONE = 0,
		/**
		 * The cookie is withheld on cross-site requests but exposed on cross-site navigations
		 */
		LAX = 1,
		/**
		 * The cookie is only exposed for same-site requests
		 */
		STRICT = 2
	}

	/**
	 * Return value from the {@link Socket} IO methods.
	 */
	enum SocketIOStatus {
		/**
		 * Success
		 */
		OK = 0,
		/**
		 * Cannot read/write any more at this time
		 */
		WOULD_BLOCK = 1,
		/**
		 * End of file
		 */
		EOF = 2,
		/**
		 * Other error
		 */
		ERROR = 3
	}

	/**
	 * These represent the known HTTP status code values, plus various
	 * network and internal errors.
	 * 
	 * Note that no libsoup functions take or return this type directly;
	 * any function that works with status codes will accept unrecognized
	 * status codes as well.
	 * 
	 * Prior to 2.44 this type was called
	 * <literal>SoupKnownStatusCode</literal>, but the individual values
	 * have always had the names they have now.
	 */
	enum Status {
		/**
		 * No status available. (Eg, the message has not
		 * been sent yet)
		 */
		NONE = 0,
		/**
		 * Message was cancelled locally
		 */
		CANCELLED = 1,
		/**
		 * Unable to resolve destination host name
		 */
		CANT_RESOLVE = 2,
		/**
		 * Unable to resolve proxy host name
		 */
		CANT_RESOLVE_PROXY = 3,
		/**
		 * Unable to connect to remote host
		 */
		CANT_CONNECT = 4,
		/**
		 * Unable to connect to proxy
		 */
		CANT_CONNECT_PROXY = 5,
		/**
		 * SSL/TLS negotiation failed
		 */
		SSL_FAILED = 6,
		/**
		 * A network error occurred, or the other end
		 * closed the connection unexpectedly
		 */
		IO_ERROR = 7,
		/**
		 * Malformed data (usually a programmer error)
		 */
		MALFORMED = 8,
		/**
		 * Used internally
		 */
		TRY_AGAIN = 9,
		/**
		 * There were too many redirections
		 */
		TOO_MANY_REDIRECTS = 10,
		/**
		 * Used internally
		 */
		TLS_FAILED = 11,
		/**
		 * 100 Continue (HTTP)
		 */
		CONTINUE = 100,
		/**
		 * 101 Switching Protocols (HTTP)
		 */
		SWITCHING_PROTOCOLS = 101,
		/**
		 * 102 Processing (WebDAV)
		 */
		PROCESSING = 102,
		/**
		 * 200 Success (HTTP). Also used by many lower-level
		 * soup routines to indicate success.
		 */
		OK = 200,
		/**
		 * 201 Created (HTTP)
		 */
		CREATED = 201,
		/**
		 * 202 Accepted (HTTP)
		 */
		ACCEPTED = 202,
		/**
		 * 203 Non-Authoritative Information
		 * (HTTP)
		 */
		NON_AUTHORITATIVE = 203,
		/**
		 * 204 No Content (HTTP)
		 */
		NO_CONTENT = 204,
		/**
		 * 205 Reset Content (HTTP)
		 */
		RESET_CONTENT = 205,
		/**
		 * 206 Partial Content (HTTP)
		 */
		PARTIAL_CONTENT = 206,
		/**
		 * 207 Multi-Status (WebDAV)
		 */
		MULTI_STATUS = 207,
		/**
		 * 300 Multiple Choices (HTTP)
		 */
		MULTIPLE_CHOICES = 300,
		/**
		 * 301 Moved Permanently (HTTP)
		 */
		MOVED_PERMANENTLY = 301,
		/**
		 * 302 Found (HTTP)
		 */
		FOUND = 302,
		/**
		 * 302 Moved Temporarily (old name,
		 * RFC 2068)
		 */
		MOVED_TEMPORARILY = 302,
		/**
		 * 303 See Other (HTTP)
		 */
		SEE_OTHER = 303,
		/**
		 * 304 Not Modified (HTTP)
		 */
		NOT_MODIFIED = 304,
		/**
		 * 305 Use Proxy (HTTP)
		 */
		USE_PROXY = 305,
		/**
		 * 306 [Unused] (HTTP)
		 */
		NOT_APPEARING_IN_THIS_PROTOCOL = 306,
		/**
		 * 307 Temporary Redirect (HTTP)
		 */
		TEMPORARY_REDIRECT = 307,
		PERMANENT_REDIRECT = 308,
		/**
		 * 400 Bad Request (HTTP)
		 */
		BAD_REQUEST = 400,
		/**
		 * 401 Unauthorized (HTTP)
		 */
		UNAUTHORIZED = 401,
		/**
		 * 402 Payment Required (HTTP)
		 */
		PAYMENT_REQUIRED = 402,
		/**
		 * 403 Forbidden (HTTP)
		 */
		FORBIDDEN = 403,
		/**
		 * 404 Not Found (HTTP)
		 */
		NOT_FOUND = 404,
		/**
		 * 405 Method Not Allowed (HTTP)
		 */
		METHOD_NOT_ALLOWED = 405,
		/**
		 * 406 Not Acceptable (HTTP)
		 */
		NOT_ACCEPTABLE = 406,
		/**
		 * 407 Proxy Authentication
		 * Required (HTTP)
		 */
		PROXY_AUTHENTICATION_REQUIRED = 407,
		/**
		 * shorter alias for
		 * %SOUP_STATUS_PROXY_AUTHENTICATION_REQUIRED
		 */
		PROXY_UNAUTHORIZED = 407,
		/**
		 * 408 Request Timeout (HTTP)
		 */
		REQUEST_TIMEOUT = 408,
		/**
		 * 409 Conflict (HTTP)
		 */
		CONFLICT = 409,
		/**
		 * 410 Gone (HTTP)
		 */
		GONE = 410,
		/**
		 * 411 Length Required (HTTP)
		 */
		LENGTH_REQUIRED = 411,
		/**
		 * 412 Precondition Failed (HTTP)
		 */
		PRECONDITION_FAILED = 412,
		/**
		 * 413 Request Entity Too Large
		 * (HTTP)
		 */
		REQUEST_ENTITY_TOO_LARGE = 413,
		/**
		 * 414 Request-URI Too Long (HTTP)
		 */
		REQUEST_URI_TOO_LONG = 414,
		/**
		 * 415 Unsupported Media Type
		 * (HTTP)
		 */
		UNSUPPORTED_MEDIA_TYPE = 415,
		/**
		 * 416 Requested Range
		 * Not Satisfiable (HTTP)
		 */
		REQUESTED_RANGE_NOT_SATISFIABLE = 416,
		/**
		 * shorter alias for
		 * %SOUP_STATUS_REQUESTED_RANGE_NOT_SATISFIABLE
		 */
		INVALID_RANGE = 416,
		/**
		 * 417 Expectation Failed (HTTP)
		 */
		EXPECTATION_FAILED = 417,
		/**
		 * 422 Unprocessable Entity
		 * (WebDAV)
		 */
		UNPROCESSABLE_ENTITY = 422,
		/**
		 * 423 Locked (WebDAV)
		 */
		LOCKED = 423,
		/**
		 * 424 Failed Dependency (WebDAV)
		 */
		FAILED_DEPENDENCY = 424,
		/**
		 * 500 Internal Server Error
		 * (HTTP)
		 */
		INTERNAL_SERVER_ERROR = 500,
		/**
		 * 501 Not Implemented (HTTP)
		 */
		NOT_IMPLEMENTED = 501,
		/**
		 * 502 Bad Gateway (HTTP)
		 */
		BAD_GATEWAY = 502,
		/**
		 * 503 Service Unavailable (HTTP)
		 */
		SERVICE_UNAVAILABLE = 503,
		/**
		 * 504 Gateway Timeout (HTTP)
		 */
		GATEWAY_TIMEOUT = 504,
		/**
		 * 505 HTTP Version Not
		 * Supported (HTTP)
		 */
		HTTP_VERSION_NOT_SUPPORTED = 505,
		/**
		 * 507 Insufficient Storage
		 * (WebDAV)
		 */
		INSUFFICIENT_STORAGE = 507,
		/**
		 * 510 Not Extended (RFC 2774)
		 */
		NOT_EXTENDED = 510
	}

	/**
	 * Error codes for %SOUP_TLD_ERROR.
	 */
	enum TLDError {
		/**
		 * A hostname was syntactically
		 *   invalid.
		 */
		INVALID_HOSTNAME = 0,
		/**
		 * The passed-in "hostname" was
		 *   actually an IP address (and thus has no base domain or
		 *   public suffix).
		 */
		IS_IP_ADDRESS = 1,
		/**
		 * The passed-in hostname
		 *   did not have enough components. Eg, calling
		 *   {@link Soup.tld.get_base_domain} on <literal>"co.uk"</literal>.
		 */
		NOT_ENOUGH_DOMAINS = 2,
		/**
		 * The passed-in hostname has
		 *   no recognized public suffix.
		 */
		NO_BASE_DOMAIN = 3,
		NO_PSL_DATA = 4
	}

	/**
	 * Pre-defined close codes that can be passed to
	 * {@link Soup.WebsocketConnection.close} or received from
	 * soup_websocket_connection_get_close_code(). (However, other codes
	 * are also allowed.)
	 */
	enum WebsocketCloseCode {
		/**
		 * a normal, non-error close
		 */
		NORMAL = 1000,
		/**
		 * the client/server is going away
		 */
		GOING_AWAY = 1001,
		/**
		 * a protocol error occurred
		 */
		PROTOCOL_ERROR = 1002,
		/**
		 * the endpoint received data
		 *   of a type that it does not support.
		 */
		UNSUPPORTED_DATA = 1003,
		/**
		 * reserved value indicating that
		 *   no close code was present; must not be sent.
		 */
		NO_STATUS = 1005,
		/**
		 * reserved value indicating that
		 *   the connection was closed abnormally; must not be sent.
		 */
		ABNORMAL = 1006,
		/**
		 * the endpoint received data that
		 *   was invalid (eg, non-UTF-8 data in a text message).
		 */
		BAD_DATA = 1007,
		/**
		 * generic error code
		 *   indicating some sort of policy violation.
		 */
		POLICY_VIOLATION = 1008,
		/**
		 * the endpoint received a message
		 *   that is too big to process.
		 */
		TOO_BIG = 1009,
		/**
		 * the client is closing the
		 *   connection because the server failed to negotiate a required
		 *   extension.
		 */
		NO_EXTENSION = 1010,
		/**
		 * the server is closing the
		 *   connection because it was unable to fulfill the request.
		 */
		SERVER_ERROR = 1011,
		/**
		 * reserved value indicating that
		 *   the TLS handshake failed; must not be sent.
		 */
		TLS_HANDSHAKE = 1015
	}

	/**
	 * The type of a {@link WebsocketConnection}.
	 */
	enum WebsocketConnectionType {
		/**
		 * unknown/invalid connection
		 */
		UNKNOWN = 0,
		/**
		 * a client-side connection
		 */
		CLIENT = 1,
		/**
		 * a server-side connection
		 */
		SERVER = 2
	}

	/**
	 * The type of data contained in a {@link WebsocketConnection.message}
	 * signal.
	 */
	enum WebsocketDataType {
		/**
		 * UTF-8 text
		 */
		TEXT = 1,
		/**
		 * binary data
		 */
		BINARY = 2
	}

	/**
	 * WebSocket-related errors.
	 */
	enum WebsocketError {
		/**
		 * a generic error
		 */
		FAILED = 0,
		/**
		 * attempted to handshake with a
		 *   server that does not appear to understand WebSockets.
		 */
		NOT_WEBSOCKET = 1,
		/**
		 * the WebSocket handshake failed
		 *   because some detail was invalid (eg, incorrect accept key).
		 */
		BAD_HANDSHAKE = 2,
		/**
		 * the WebSocket handshake failed
		 *   because the "Origin" header was not an allowed value.
		 */
		BAD_ORIGIN = 3
	}

	/**
	 * The state of the WebSocket connection.
	 */
	enum WebsocketState {
		/**
		 * the connection is ready to send messages
		 */
		OPEN = 1,
		/**
		 * the connection is in the process of
		 *   closing down; messages may be received, but not sent
		 */
		CLOSING = 2,
		/**
		 * the connection is completely closed down
		 */
		CLOSED = 3
	}

	enum XMLRPCError {
		ARGUMENTS = 0,
		RETVAL = 1
	}

	/**
	 * Pre-defined XML-RPC fault codes from <ulink
	 * url="http://xmlrpc-epi.sourceforge.net/specs/rfc.fault_codes.php">http://xmlrpc-epi.sourceforge.net/specs/rfc.fault_codes.php</ulink>.
	 * These are an extension, not part of the XML-RPC spec; you can't
	 * assume servers will use them.
	 */
	enum XMLRPCFault {
		/**
		 * request was not
		 *   well-formed
		 */
		PARSE_ERROR_NOT_WELL_FORMED = -32700,
		/**
		 * request was in
		 *   an unsupported encoding
		 */
		PARSE_ERROR_UNSUPPORTED_ENCODING = -32701,
		/**
		 * request contained an invalid character
		 */
		PARSE_ERROR_INVALID_CHARACTER_FOR_ENCODING = -32702,
		/**
		 * request was not
		 *   valid XML-RPC
		 */
		SERVER_ERROR_INVALID_XML_RPC = -32600,
		/**
		 * method
		 *   not found
		 */
		SERVER_ERROR_REQUESTED_METHOD_NOT_FOUND = -32601,
		/**
		 * invalid
		 *   parameters
		 */
		SERVER_ERROR_INVALID_METHOD_PARAMETERS = -32602,
		/**
		 * internal
		 *   error
		 */
		SERVER_ERROR_INTERNAL_XML_RPC_ERROR = -32603,
		/**
		 * start of reserved range for
		 *   application error codes
		 */
		APPLICATION_ERROR = -32500,
		/**
		 * start of reserved range for
		 *   system error codes
		 */
		SYSTEM_ERROR = -32400,
		/**
		 * start of reserved range for
		 *   transport error codes
		 */
		TRANSPORT_ERROR = -32300
	}

	enum Cacheability {
		CACHEABLE = 1,
		UNCACHEABLE = 2,
		INVALIDATES = 4,
		VALIDATES = 8
	}

	/**
	 * Represents the parsed value of the "Expect" header.
	 */
	enum Expectation {
		/**
		 * any unrecognized expectation
		 */
		UNRECOGNIZED = 1,
		/**
		 * "100-continue"
		 */
		CONTINUE = 2
	}

	/**
	 * Various flags that can be set on a {@link Message} to alter its
	 * behavior.
	 */
	enum MessageFlags {
		/**
		 * The session should not follow redirect
		 *   (3xx) responses received by this message.
		 */
		NO_REDIRECT = 2,
		/**
		 * The caller will rebuild the request
		 *   body if the message is restarted; see
		 *   {@link Soup.MessageBody.set_accumulate} for more details.
		 */
		CAN_REBUILD = 4,
		/**
		 * Deprecated: equivalent to calling
		 *   {@link Soup.MessageBody.set_accumulate} on the incoming message body
		 *   (ie, {@link Message.response_body} for a client-side request),
		 *   passing %FALSE.
		 */
		OVERWRITE_CHUNKS = 8,
		/**
		 * Set by {@link ContentDecoder} to
		 *   indicate that it has removed the Content-Encoding on a message (and
		 *   so headers such as Content-Length may no longer accurately describe
		 *   the body).
		 */
		CONTENT_DECODED = 16,
		/**
		 * if set after an https response
		 *   has been received, indicates that the server's SSL certificate is
		 *   trusted according to the session's CA.
		 */
		CERTIFICATE_TRUSTED = 32,
		/**
		 * Requests that the message should be
		 *   sent on a newly-created connection, not reusing an existing
		 *   persistent connection. Note that messages with non-idempotent
		 *   {@link Message.method}<!-- -->s behave this way by default, unless
		 *   #SOUP_MESSAGE_IDEMPOTENT is set.
		 */
		NEW_CONNECTION = 64,
		/**
		 * The message is considered idempotent,
		 *   regardless its {@link Message.method}, and allows reuse of existing
		 *   idle connections, instead of always requiring a new one, unless
		 *   #SOUP_MESSAGE_NEW_CONNECTION is set.
		 */
		IDEMPOTENT = 128,
		/**
		 * Request that a new connection is
		 *   created for the message if there aren't idle connections available
		 *   and it's not possible to create new connections due to any of the
		 *   connection limits has been reached. If a dedicated connection is
		 *   eventually created for this message, it will be dropped when the
		 *   message finishes. Since 2.50
		 */
		IGNORE_CONNECTION_LIMITS = 256,
		/**
		 * The {@link AuthManager} should not use
		 *   the credentials cache for this message, neither to use cached credentials
		 *   to automatically authenticate this message nor to cache the credentials
		 *   after the message is successfully authenticated. This applies to both server
		 *   and proxy authentication. Note that #SoupSession::authenticate signal will
		 *   be emitted, if you want to disable authentication for a message use
		 *   {@link Soup.Message.disable_feature} passing #SOUP_TYPE_AUTH_MANAGER instead. Since 2.58
		 */
		DO_NOT_USE_AUTH_CACHE = 512
	}

	/**
	 * Options to pass to {@link Soup.Server.listen}, etc.
	 * 
	 * %SOUP_SERVER_LISTEN_IPV4_ONLY and %SOUP_SERVER_LISTEN_IPV6_ONLY
	 * only make sense with soup_server_listen_all() and
	 * soup_server_listen_local(), not plain soup_server_listen() (which
	 * simply listens on whatever kind of socket you give it). And you
	 * cannot specify both of them in a single call.
	 */
	enum ServerListenOptions {
		/**
		 * Listen for https connections rather
		 *   than plain http.
		 */
		HTTPS = 1,
		/**
		 * Only listen on IPv4 interfaces.
		 */
		IPV4_ONLY = 2,
		/**
		 * Only listen on IPv6 interfaces.
		 */
		IPV6_ONLY = 4
	}

	/**
	 * The callback function passed to {@link Soup.Address.resolve_async}.
	 */
	interface AddressCallback {
		/**
		 * The callback function passed to {@link Soup.Address.resolve_async}.
		 * @param addr the {@link Address} that was resolved
		 * @param status %SOUP_STATUS_OK, %SOUP_STATUS_CANT_RESOLVE, or
		 * %SOUP_STATUS_CANCELLED
		 */
		(addr: Address, status: number): void;
	}

	/**
	 * Callback used by {@link AuthDomainBasic} for authentication purposes.
	 * The application should verify that #username and #password and valid
	 * and return %TRUE or %FALSE.
	 * 
	 * If you are maintaining your own password database (rather than
	 * using the password to authenticate against some other system like
	 * PAM or a remote server), you should make sure you know what you are
	 * doing. In particular, don't store cleartext passwords, or
	 * easily-computed hashes of cleartext passwords, even if you don't
	 * care that much about the security of your server, because users
	 * will frequently use the same password for multiple sites, and so
	 * compromising any site with a cleartext (or easily-cracked) password
	 * database may give attackers access to other more-interesting sites
	 * as well.
	 */
	interface AuthDomainBasicAuthCallback {
		/**
		 * Callback used by {@link AuthDomainBasic} for authentication purposes.
		 * The application should verify that #username and #password and valid
		 * and return %TRUE or %FALSE.
		 * 
		 * If you are maintaining your own password database (rather than
		 * using the password to authenticate against some other system like
		 * PAM or a remote server), you should make sure you know what you are
		 * doing. In particular, don't store cleartext passwords, or
		 * easily-computed hashes of cleartext passwords, even if you don't
		 * care that much about the security of your server, because users
		 * will frequently use the same password for multiple sites, and so
		 * compromising any site with a cleartext (or easily-cracked) password
		 * database may give attackers access to other more-interesting sites
		 * as well.
		 * @param domain the domain
		 * @param msg the message being authenticated
		 * @param username the username provided by the client
		 * @param password the password provided by the client
		 * @returns %TRUE if #username and #password are valid
		 */
		(domain: AuthDomainBasic, msg: Message, username: string, password: string): boolean;
	}

	/**
	 * Callback used by {@link AuthDomainDigest} for authentication purposes.
	 * The application should look up #username in its password database,
	 * and return the corresponding encoded password (see
	 * {@link Soup.AuthDomainDigest.encode_password}).
	 */
	interface AuthDomainDigestAuthCallback {
		/**
		 * Callback used by {@link AuthDomainDigest} for authentication purposes.
		 * The application should look up #username in its password database,
		 * and return the corresponding encoded password (see
		 * {@link Soup.AuthDomainDigest.encode_password}).
		 * @param domain the domain
		 * @param msg the message being authenticated
		 * @param username the username provided by the client
		 * @returns the encoded password, or %NULL if
		 * #username is not a valid user. #domain will free the password when
		 * it is done with it.
		 */
		(domain: AuthDomainDigest, msg: Message, username: string): string | null;
	}

	/**
	 * The prototype for a {@link AuthDomain} filter; see
	 * {@link Soup.AuthDomain.set_filter} for details.
	 */
	interface AuthDomainFilter {
		/**
		 * The prototype for a {@link AuthDomain} filter; see
		 * {@link Soup.AuthDomain.set_filter} for details.
		 * @param domain a {@link AuthDomain}
		 * @param msg a {@link Message}
		 * @returns %TRUE if #msg requires authentication, %FALSE if not.
		 */
		(domain: AuthDomain, msg: Message): boolean;
	}

	/**
	 * The prototype for a {@link AuthDomain} generic authentication callback.
	 * 
	 * The callback should look up the user's password, call
	 * {@link Soup.AuthDomain.check_password}, and use the return value from
	 * that method as its own return value.
	 * 
	 * In general, for security reasons, it is preferable to use the
	 * auth-domain-specific auth callbacks (eg,
	 * #SoupAuthDomainBasicAuthCallback and
	 * #SoupAuthDomainDigestAuthCallback), because they don't require
	 * keeping a cleartext password database. Most users will use the same
	 * password for many different sites, meaning if any site with a
	 * cleartext password database is compromised, accounts on other
	 * servers might be compromised as well. For many of the cases where
	 * #SoupServer is used, this is not really relevant, but it may still
	 * be worth considering.
	 */
	interface AuthDomainGenericAuthCallback {
		/**
		 * The prototype for a {@link AuthDomain} generic authentication callback.
		 * 
		 * The callback should look up the user's password, call
		 * {@link Soup.AuthDomain.check_password}, and use the return value from
		 * that method as its own return value.
		 * 
		 * In general, for security reasons, it is preferable to use the
		 * auth-domain-specific auth callbacks (eg,
		 * #SoupAuthDomainBasicAuthCallback and
		 * #SoupAuthDomainDigestAuthCallback), because they don't require
		 * keeping a cleartext password database. Most users will use the same
		 * password for many different sites, meaning if any site with a
		 * cleartext password database is compromised, accounts on other
		 * servers might be compromised as well. For many of the cases where
		 * #SoupServer is used, this is not really relevant, but it may still
		 * be worth considering.
		 * @param domain a {@link AuthDomain}
		 * @param msg the {@link Message} being authenticated
		 * @param username the username from #msg
		 * @returns %TRUE if #msg is authenticated, %FALSE if not.
		 */
		(domain: AuthDomain, msg: Message, username: string): boolean;
	}

	/**
	 * The prototype for a chunk allocation callback. This should allocate
	 * a new {@link Buffer} and return it for the I/O layer to read message
	 * body data off the network into.
	 * 
	 * If #max_len is non-0, it indicates the maximum number of bytes that
	 * could be read, based on what is known about the message size. Note
	 * that this might be a very large number, and you should not simply
	 * try to allocate that many bytes blindly. If #max_len is 0, that
	 * means that libsoup does not know how many bytes remain to be read,
	 * and the allocator should return a buffer of a size that it finds
	 * convenient.
	 * 
	 * If the allocator returns %NULL, the message will be paused. It is
	 * up to the application to make sure that it gets unpaused when it
	 * becomes possible to allocate a new buffer.
	 */
	interface ChunkAllocator {
		/**
		 * @deprecated
		 * Use {@link Request} if you want to read into your
		 * own buffers.
		 * 
		 * The prototype for a chunk allocation callback. This should allocate
		 * a new {@link Buffer} and return it for the I/O layer to read message
		 * body data off the network into.
		 * 
		 * If #max_len is non-0, it indicates the maximum number of bytes that
		 * could be read, based on what is known about the message size. Note
		 * that this might be a very large number, and you should not simply
		 * try to allocate that many bytes blindly. If #max_len is 0, that
		 * means that libsoup does not know how many bytes remain to be read,
		 * and the allocator should return a buffer of a size that it finds
		 * convenient.
		 * 
		 * If the allocator returns %NULL, the message will be paused. It is
		 * up to the application to make sure that it gets unpaused when it
		 * becomes possible to allocate a new buffer.
		 * @param msg the {@link Message} the chunk is being allocated for
		 * @param max_len the maximum length that will be read, or 0.
		 * @returns the new buffer (or %NULL)
		 */
		(msg: Message, max_len: number): Buffer | null;
	}

	/**
	 * The prototype for a logging filter. The filter callback will be
	 * invoked for each request or response, and should analyze it and
	 * return a {@link LoggerLogLevel} value indicating how much of the
	 * message to log. Eg, it might choose between %SOUP_LOGGER_LOG_BODY
	 * and %SOUP_LOGGER_LOG_HEADERS depending on the Content-Type.
	 */
	interface LoggerFilter {
		/**
		 * The prototype for a logging filter. The filter callback will be
		 * invoked for each request or response, and should analyze it and
		 * return a {@link LoggerLogLevel} value indicating how much of the
		 * message to log. Eg, it might choose between %SOUP_LOGGER_LOG_BODY
		 * and %SOUP_LOGGER_LOG_HEADERS depending on the Content-Type.
		 * @param logger the {@link Logger}
		 * @param msg the message being logged
		 * @returns a {@link LoggerLogLevel} value indicating how much of
		 * the message to log
		 */
		(logger: Logger, msg: Message): LoggerLogLevel;
	}

	/**
	 * The prototype for a custom printing callback.
	 * 
	 * #level indicates what kind of information is being printed. Eg, it
	 * will be %SOUP_LOGGER_LOG_HEADERS if #data is header data.
	 * 
	 * #direction is either '<', '>', or ' ', and #data is the single line
	 * to print; the printer is expected to add a terminating newline.
	 * 
	 * To get the effect of the default printer, you would do:
	 * 
	 * <informalexample><programlisting>
	 * printf ("%c %s\n", direction, data);
	 * </programlisting></informalexample>
	 */
	interface LoggerPrinter {
		/**
		 * The prototype for a custom printing callback.
		 * 
		 * #level indicates what kind of information is being printed. Eg, it
		 * will be %SOUP_LOGGER_LOG_HEADERS if #data is header data.
		 * 
		 * #direction is either '<', '>', or ' ', and #data is the single line
		 * to print; the printer is expected to add a terminating newline.
		 * 
		 * To get the effect of the default printer, you would do:
		 * 
		 * <informalexample><programlisting>
		 * printf ("%c %s\n", direction, data);
		 * </programlisting></informalexample>
		 * @param logger the {@link Logger}
		 * @param level the level of the information being printed.
		 * @param direction a single-character prefix to #data
		 * @param data data to print
		 */
		(logger: Logger, level: LoggerLogLevel, direction: string, data: string): void;
	}

	/**
	 * The callback passed to {@link Soup.MessageHeaders.foreach}.
	 */
	interface MessageHeadersForeachFunc {
		/**
		 * The callback passed to {@link Soup.MessageHeaders.foreach}.
		 * @param name the header name
		 * @param value the header value
		 */
		(name: string, value: string): void;
	}

	interface PasswordManagerCallback {
		(password_manager: PasswordManager, msg: Message, auth: Auth, retrying: boolean): void;
	}

	interface ProxyResolverCallback {
		(proxy_resolver: ProxyResolver, msg: Message, arg: number, addr: Address): void;
	}

	/**
	 * Callback for {@link Soup.proxy_uri_resolver_get_proxy_uri_async}
	 */
	interface ProxyURIResolverCallback {
		/**
		 * Callback for {@link Soup.proxy_uri_resolver_get_proxy_uri_async}
		 * @param resolver the {@link ProxyURIResolver}
		 * @param status a {@link Status}
		 * @param proxy_uri the resolved proxy URI, or %NULL
		 */
		(resolver: ProxyURIResolver, status: number, proxy_uri: URI): void;
	}

	/**
	 * A callback used to handle requests to a {@link Server}.
	 * 
	 * #path and #query contain the likewise-named components of the
	 * Request-URI, subject to certain assumptions. By default,
	 * #SoupServer decodes all percent-encoding in the URI path, such that
	 * "/foo%<!-- -->2Fbar" is treated the same as "/foo/bar". If your
	 * server is serving resources in some non-POSIX-filesystem namespace,
	 * you may want to distinguish those as two distinct paths. In that
	 * case, you can set the %SOUP_SERVER_RAW_PATHS property when creating
	 * the #SoupServer, and it will leave those characters undecoded. (You
	 * may want to call {@link Soup.uri.normalize} to decode any percent-encoded
	 * characters that you aren't handling specially.)
	 * 
	 * #query contains the query component of the Request-URI parsed
	 * according to the rules for HTML form handling. Although this is the
	 * only commonly-used query string format in HTTP, there is nothing
	 * that actually requires that HTTP URIs use that format; if your
	 * server needs to use some other format, you can just ignore #query,
	 * and call soup_message_get_uri() and parse the URI's query field
	 * yourself.
	 * 
	 * See soup_server_add_handler() and soup_server_add_early_handler()
	 * for details of what handlers can/should do.
	 */
	interface ServerCallback {
		/**
		 * A callback used to handle requests to a {@link Server}.
		 * 
		 * #path and #query contain the likewise-named components of the
		 * Request-URI, subject to certain assumptions. By default,
		 * #SoupServer decodes all percent-encoding in the URI path, such that
		 * "/foo%<!-- -->2Fbar" is treated the same as "/foo/bar". If your
		 * server is serving resources in some non-POSIX-filesystem namespace,
		 * you may want to distinguish those as two distinct paths. In that
		 * case, you can set the %SOUP_SERVER_RAW_PATHS property when creating
		 * the #SoupServer, and it will leave those characters undecoded. (You
		 * may want to call {@link Soup.uri.normalize} to decode any percent-encoded
		 * characters that you aren't handling specially.)
		 * 
		 * #query contains the query component of the Request-URI parsed
		 * according to the rules for HTML form handling. Although this is the
		 * only commonly-used query string format in HTTP, there is nothing
		 * that actually requires that HTTP URIs use that format; if your
		 * server needs to use some other format, you can just ignore #query,
		 * and call soup_message_get_uri() and parse the URI's query field
		 * yourself.
		 * 
		 * See soup_server_add_handler() and soup_server_add_early_handler()
		 * for details of what handlers can/should do.
		 * @param server the {@link Server}
		 * @param msg the message being processed
		 * @param path the path component of #msg's Request-URI
		 * @param query the parsed query
		 *   component of #msg's Request-URI
		 * @param client additional contextual information about the client
		 */
		(server: Server, msg: Message, path: string, query: string[] | null, client: ClientContext): void;
	}

	/**
	 * A callback used to handle WebSocket requests to a {@link Server}. The
	 * callback will be invoked after sending the handshake response back
	 * to the client (and is only invoked if the handshake was
	 * successful).
	 * 
	 * #path contains the path of the Request-URI, subject to the same
	 * rules as #SoupServerCallback (qv).
	 */
	interface ServerWebsocketCallback {
		/**
		 * A callback used to handle WebSocket requests to a {@link Server}. The
		 * callback will be invoked after sending the handshake response back
		 * to the client (and is only invoked if the handshake was
		 * successful).
		 * 
		 * #path contains the path of the Request-URI, subject to the same
		 * rules as #SoupServerCallback (qv).
		 * @param server the {@link Server}
		 * @param connection the newly created WebSocket connection
		 * @param path the path component of #msg's Request-URI
		 * @param client additional contextual information about the client
		 */
		(server: Server, connection: WebsocketConnection, path: string, client: ClientContext): void;
	}

	/**
	 * Prototype for the callback passed to {@link Soup.Session.queue_message},
	 * qv.
	 */
	interface SessionCallback {
		/**
		 * Prototype for the callback passed to {@link Soup.Session.queue_message},
		 * qv.
		 * @param session the session
		 * @param msg the message that has finished
		 */
		(session: Session, msg: Message): void;
	}

	/**
	 * Prototype for the progress callback passed to {@link Soup.Session.connect_async}.
	 */
	interface SessionConnectProgressCallback {
		/**
		 * Prototype for the progress callback passed to {@link Soup.Session.connect_async}.
		 * @param session the {@link Session}
		 * @param event a #GSocketClientEvent
		 * @param connection the current state of the network connection
		 */
		(session: Session, event: Gio.SocketClientEvent, connection: Gio.IOStream): void;
	}

	/**
	 * The callback function passed to {@link Soup.Socket.connect_async}.
	 */
	interface SocketCallback {
		/**
		 * The callback function passed to {@link Soup.Socket.connect_async}.
		 * @param sock the {@link Socket}
		 * @param status an HTTP status code indicating success or failure
		 */
		(sock: Socket, status: number): void;
	}

	/**
	 * Adds #function to be executed from inside #async_context with the
	 * default priority. Use this when you want to complete an action in
	 * #async_context's main loop, as soon as possible.
	 * @param async_context the #GMainContext to dispatch the I/O
	 * watch in, or %NULL for the default context
	 * @param _function the callback to invoke
	 * @param data user data to pass to #function
	 * @returns a #GSource, which can be removed from #async_context
	 * with {@link G.source_destroy}.
	 */
	function add_completion(async_context: GLib.MainContext | null, _function: GLib.SourceFunc, data: any | null): GLib.Source;

	/**
	 * Adds an idle event as with {@link G.idle_add}, but using the given
	 * #async_context.
	 * 
	 * If you want #function to run "right away", use
	 * soup_add_completion(), since that sets a higher priority on the
	 * #GSource than soup_add_idle() does.
	 * @param async_context the #GMainContext to dispatch the I/O
	 * watch in, or %NULL for the default context
	 * @param _function the callback to invoke at idle time
	 * @param data user data to pass to #function
	 * @returns a #GSource, which can be removed from #async_context
	 * with {@link G.source_destroy}.
	 */
	function add_idle(async_context: GLib.MainContext | null, _function: GLib.SourceFunc, data: any | null): GLib.Source;

	/**
	 * Adds an I/O watch as with {@link G.io_add_watch}, but using the given
	 * #async_context.
	 * @param async_context the #GMainContext to dispatch the I/O
	 * watch in, or %NULL for the default context
	 * @param chan the #GIOChannel to watch
	 * @param condition the condition to watch for
	 * @param _function the callback to invoke when #condition occurs
	 * @param data user data to pass to #function
	 * @returns a #GSource, which can be removed from #async_context
	 * with {@link G.source_destroy}.
	 */
	function add_io_watch(async_context: GLib.MainContext | null, chan: GLib.IOChannel, condition: GLib.IOCondition, _function: GLib.IOFunc, data: any | null): GLib.Source;

	/**
	 * Adds a timeout as with {@link G.timeout_add}, but using the given
	 * #async_context.
	 * @param async_context the #GMainContext to dispatch the I/O
	 * watch in, or %NULL for the default context
	 * @param interval the timeout interval, in milliseconds
	 * @param _function the callback to invoke at timeout time
	 * @param data user data to pass to #function
	 * @returns a #GSource, which can be removed from #async_context
	 * with {@link G.source_destroy}.
	 */
	function add_timeout(async_context: GLib.MainContext | null, interval: number, _function: GLib.SourceFunc, data: any | null): GLib.Source;

	/**
	 * Like SOUP_CHECK_VERSION, but the check for soup_check_version is
	 * at runtime instead of compile time. This is useful for compiling
	 * against older versions of libsoup, but using features from newer
	 * versions.
	 * @param major the major version to check
	 * @param minor the minor version to check
	 * @param micro the micro version to check
	 * @returns %TRUE if the version of the libsoup currently loaded
	 * is the same as or newer than the passed-in version.
	 */
	function check_version(major: number, minor: number, micro: number): boolean;

	/**
	 * Parses #header and returns a {@link Cookie}. (If #header contains
	 * multiple cookies, only the first one will be parsed.)
	 * 
	 * If #header does not have "path" or "domain" attributes, they will
	 * be defaulted from #origin. If #origin is %NULL, path will default
	 * to "/", but domain will be left as %NULL. Note that this is not a
	 * valid state for a #SoupCookie, and you will need to fill in some
	 * appropriate string for the domain if you want to actually make use
	 * of the cookie.
	 * @param header a cookie string (eg, the value of a Set-Cookie header)
	 * @param origin origin of the cookie, or %NULL
	 * @returns a new {@link Cookie}, or %NULL if it could
	 * not be parsed, or contained an illegal "domain" attribute for a
	 * cookie originating from #origin.
	 */
	function cookie_parse(header: string, origin: URI): Cookie | null;

	/**
	 * Frees #cookies.
	 * @param cookies a #GSList of {@link Cookie}
	 */
	function cookies_free(cookies: Cookie[]): void;

	/**
	 * Parses #msg's Cookie request header and returns a #GSList of
	 * {@link Cookie}<!-- -->s. As the "Cookie" header, unlike "Set-Cookie",
	 * only contains cookie names and values, none of the other
	 * #SoupCookie fields will be filled in. (Thus, you can't generally
	 * pass a cookie returned from this method directly to
	 * {@link Soup.cookies.to_response}.)
	 * @param msg a {@link Message} containing a "Cookie" request header
	 * @returns a #GSList
	 * of {@link Cookie}<!-- -->s, which can be freed with
	 * {@link Soup.cookies.free}.
	 */
	function cookies_from_request(msg: Message): Cookie[];

	/**
	 * Parses #msg's Set-Cookie response headers and returns a #GSList of
	 * {@link Cookie}<!-- -->s. Cookies that do not specify "path" or
	 * "domain" attributes will have their values defaulted from #msg.
	 * @param msg a {@link Message} containing a "Set-Cookie" response header
	 * @returns a #GSList
	 * of {@link Cookie}<!-- -->s, which can be freed with
	 * {@link Soup.cookies.free}.
	 */
	function cookies_from_response(msg: Message): Cookie[];

	/**
	 * Serializes a #GSList of {@link Cookie} into a string suitable for
	 * setting as the value of the "Cookie" header.
	 * @param cookies a #GSList of {@link Cookie}
	 * @returns the serialization of #cookies
	 */
	function cookies_to_cookie_header(cookies: Cookie[]): string;

	/**
	 * Adds the name and value of each cookie in #cookies to #msg's
	 * "Cookie" request. (If #msg already has a "Cookie" request header,
	 * these cookies will be appended to the cookies already present. Be
	 * careful that you do not append the same cookies twice, eg, when
	 * requeuing a message.)
	 * @param cookies a #GSList of {@link Cookie}
	 * @param msg a {@link Message}
	 */
	function cookies_to_request(cookies: Cookie[], msg: Message): void;

	/**
	 * Appends a "Set-Cookie" response header to #msg for each cookie in
	 * #cookies. (This is in addition to any other "Set-Cookie" headers
	 * #msg may already have.)
	 * @param cookies a #GSList of {@link Cookie}
	 * @param msg a {@link Message}
	 */
	function cookies_to_response(cookies: Cookie[], msg: Message): void;

	/**
	 * Decodes #form, which is an urlencoded dataset as defined in the
	 * HTML 4.01 spec.
	 * @param encoded_form data of type "application/x-www-form-urlencoded"
	 * @returns a hash
	 * table containing the name/value pairs from #encoded_form, which you
	 * can free with {@link G.hash_table_destroy}.
	 */
	function form_decode(encoded_form: string): string[];

	/**
	 * Decodes the "multipart/form-data" request in #msg; this is a
	 * convenience method for the case when you have a single file upload
	 * control in a form. (Or when you don't have any file upload
	 * controls, but are still using "multipart/form-data" anyway.) Pass
	 * the name of the file upload control in #file_control_name, and
	 * {@link Soup.form.decode_multipart} will extract the uploaded file data
	 * into #filename, #content_type, and #file. All of the other form
	 * control data will be returned (as strings, as with
	 * soup_form_decode()) in the returned #GHashTable.
	 * 
	 * You may pass %NULL for #filename, #content_type and/or #file if you do not
	 * care about those fields. soup_form_decode_multipart() may also
	 * return %NULL in those fields if the client did not provide that
	 * information. You must free the returned filename and content-type
	 * with g_free(), and the returned file data with soup_buffer_free().
	 * 
	 * If you have a form with more than one file upload control, you will
	 * need to decode it manually, using soup_multipart_new_from_message()
	 * and soup_multipart_get_part().
	 * @param msg a {@link Message} containing a "multipart/form-data" request body
	 * @param file_control_name the name of the HTML file upload control, or %NULL
	 * @returns 
	 * a hash table containing the name/value pairs (other than
	 * #file_control_name) from #msg, which you can free with
	 * {@link G.hash_table_destroy}. On error, it will return %NULL.
	 * 
	 * return location for the name of the uploaded file, or %NULL
	 * 
	 * return location for the MIME type of the uploaded file, or %NULL
	 * 
	 * return location for the uploaded file data, or %NULL
	 */
	function form_decode_multipart(msg: Message, file_control_name: string | null): [ string[] | null, string | null, string | null, Buffer | null ];

	/**
	 * Encodes the given field names and values into a value of type
	 * "application/x-www-form-urlencoded", as defined in the HTML 4.01
	 * spec.
	 * 
	 * This method requires you to know the names of the form fields (or
	 * at the very least, the total number of fields) at compile time; for
	 * working with dynamic forms, use {@link Soup.form.encode_hash} or
	 * soup_form_encode_datalist().
	 * @param first_field name of the first form field
	 * @returns the encoded form
	 */
	function form_encode(first_field: string): string;

	/**
	 * Encodes #form_data_set into a value of type
	 * "application/x-www-form-urlencoded", as defined in the HTML 4.01
	 * spec. Unlike {@link Soup.form.encode_hash}, this preserves the ordering
	 * of the form elements, which may be required in some situations.
	 * @param form_data_set a datalist containing name/value pairs
	 * @returns the encoded form
	 */
	function form_encode_datalist(form_data_set: GLib.Data): string;

	/**
	 * Encodes #form_data_set into a value of type
	 * "application/x-www-form-urlencoded", as defined in the HTML 4.01
	 * spec.
	 * 
	 * Note that the HTML spec states that "The control names/values are
	 * listed in the order they appear in the document." Since this method
	 * takes a hash table, it cannot enforce that; if you care about the
	 * ordering of the form fields, use {@link Soup.form.encode_datalist}.
	 * @param form_data_set a hash table containing
	 * name/value pairs (as strings)
	 * @returns the encoded form
	 */
	function form_encode_hash(form_data_set: string[]): string;

	/**
	 * See {@link Soup.form.encode}. This is mostly an internal method, used by
	 * various other methods such as soup_uri_set_query_from_fields() and
	 * soup_form_request_new().
	 * @param first_field name of the first form field
	 * @param args pointer to additional values, as in {@link Soup.form.encode}
	 * @returns the encoded form
	 */
	function form_encode_valist(first_field: string, args: any[]): string;

	/**
	 * Creates a new %SoupMessage and sets it up to send the given data
	 * to #uri via #method. (That is, if #method is "GET", it will encode
	 * the form data into #uri's query field, and if #method is "POST", it
	 * will encode it into the %SoupMessage's request_body.)
	 * @param method the HTTP method, either "GET" or "POST"
	 * @param uri the URI to send the form data to
	 * @param first_field name of the first form field
	 * @returns the new %SoupMessage
	 */
	function form_request_new(method: string, uri: string, first_field: string): Message;

	/**
	 * Creates a new %SoupMessage and sets it up to send #form_data_set to
	 * #uri via #method, as with {@link Soup.form.request_new}.
	 * @param method the HTTP method, either "GET" or "POST"
	 * @param uri the URI to send the form data to
	 * @param form_data_set the data to send to #uri
	 * @returns the new %SoupMessage
	 */
	function form_request_new_from_datalist(method: string, uri: string, form_data_set: GLib.Data): Message;

	/**
	 * Creates a new %SoupMessage and sets it up to send #form_data_set to
	 * #uri via #method, as with {@link Soup.form.request_new}.
	 * @param method the HTTP method, either "GET" or "POST"
	 * @param uri the URI to send the form data to
	 * @param form_data_set the data to send to #uri
	 * @returns the new %SoupMessage
	 */
	function form_request_new_from_hash(method: string, uri: string, form_data_set: string[]): Message;

	/**
	 * Creates a new %SoupMessage and sets it up to send #multipart to
	 * #uri via POST.
	 * 
	 * To send a <literal>"multipart/form-data"</literal> POST, first
	 * create a {@link Multipart}, using %SOUP_FORM_MIME_TYPE_MULTIPART as
	 * the MIME type. Then use {@link Soup.Multipart.append_form_string} and
	 * soup_multipart_append_form_file() to add the value of each form
	 * control to the multipart. (These are just convenience methods, and
	 * you can use soup_multipart_append_part() if you need greater
	 * control over the part headers.) Finally, call
	 * soup_form_request_new_from_multipart() to serialize the multipart
	 * structure and create a #SoupMessage.
	 * @param uri the URI to send the form data to
	 * @param multipart a "multipart/form-data" {@link Multipart}
	 * @returns the new %SoupMessage
	 */
	function form_request_new_from_multipart(uri: string, multipart: Multipart): Message;

	/**
	 * Returns the major version number of the libsoup library.
	 * (e.g. in libsoup version 2.42.0 this is 2.)
	 * 
	 * This function is in the library, so it represents the libsoup library
	 * your code is running against. Contrast with the #SOUP_MAJOR_VERSION
	 * macro, which represents the major version of the libsoup headers you
	 * have included when compiling your code.
	 * @returns the major version number of the libsoup library
	 */
	function get_major_version(): number;

	/**
	 * Returns the micro version number of the libsoup library.
	 * (e.g. in libsoup version 2.42.0 this is 0.)
	 * 
	 * This function is in the library, so it represents the libsoup library
	 * your code is running against. Contrast with the #SOUP_MICRO_VERSION
	 * macro, which represents the micro version of the libsoup headers you
	 * have included when compiling your code.
	 * @returns the micro version number of the libsoup library
	 */
	function get_micro_version(): number;

	/**
	 * Returns the minor version number of the libsoup library.
	 * (e.g. in libsoup version 2.42.0 this is 42.)
	 * 
	 * This function is in the library, so it represents the libsoup library
	 * your code is running against. Contrast with the #SOUP_MINOR_VERSION
	 * macro, which represents the minor version of the libsoup headers you
	 * have included when compiling your code.
	 * @returns the minor version number of the libsoup library
	 */
	function get_minor_version(): number;

	function get_resource(): Gio.Resource;

	/**
	 * Parses #header to see if it contains the token #token (matched
	 * case-insensitively). Note that this can't be used with lists
	 * that have qvalues.
	 * @param header An HTTP header suitable for parsing with
	 * {@link Soup.header.parse_list}
	 * @param token a token
	 * @returns whether or not #header contains #token
	 */
	function header_contains(header: string, token: string): boolean;

	/**
	 * Frees #list.
	 * @param list a #GSList returned from {@link Soup.header.parse_list} or
	 * soup_header_parse_quality_list()
	 */
	function header_free_list(list: any[]): void;

	/**
	 * Frees #param_list.
	 * @param param_list a #GHashTable returned from {@link Soup.header.parse_param_list}
	 * or soup_header_parse_semi_param_list()
	 */
	function header_free_param_list(param_list: string[]): void;

	/**
	 * Appends something like <literal>#name=#value</literal> to #string,
	 * taking care to quote #value if needed, and if so, to escape any
	 * quotes or backslashes in #value.
	 * 
	 * Alternatively, if #value is a non-ASCII UTF-8 string, it will be
	 * appended using RFC5987 syntax. Although in theory this is supposed
	 * to work anywhere in HTTP that uses this style of parameter, in
	 * reality, it can only be used portably with the Content-Disposition
	 * "filename" parameter.
	 * 
	 * If #value is %NULL, this will just append #name to #string.
	 * @param string a #GString being used to construct an HTTP header value
	 * @param name a parameter name
	 * @param value a parameter value, or %NULL
	 */
	function header_g_string_append_param(string: GLib.String, name: string, value: string): void;

	/**
	 * Appends something like <literal>#name="#value"</literal> to
	 * #string, taking care to escape any quotes or backslashes in #value.
	 * 
	 * If #value is (non-ASCII) UTF-8, this will instead use RFC 5987
	 * encoding, just like {@link Soup.header.g_string_append_param}.
	 * @param string a #GString being used to construct an HTTP header value
	 * @param name a parameter name
	 * @param value a parameter value
	 */
	function header_g_string_append_param_quoted(string: GLib.String, name: string, value: string): void;

	/**
	 * Parses a header whose content is described by RFC2616 as
	 * "#something", where "something" does not itself contain commas,
	 * except as part of quoted-strings.
	 * @param header a header value
	 * @returns a #GSList of
	 * list elements, as allocated strings
	 */
	function header_parse_list(header: string): string[];

	/**
	 * Parses a header which is a comma-delimited list of something like:
	 * <literal>token [ "=" ( token | quoted-string ) ]</literal>.
	 * 
	 * Tokens that don't have an associated value will still be added to
	 * the resulting hash table, but with a %NULL value.
	 * 
	 * This also handles RFC5987 encoding (which in HTTP is mostly used
	 * for giving UTF8-encoded filenames in the Content-Disposition
	 * header).
	 * @param header a header value
	 * @returns a
	 * #GHashTable of list elements, which can be freed with
	 * {@link Soup.header.free_param_list}.
	 */
	function header_parse_param_list(header: string): string[];

	/**
	 * A strict version of {@link Soup.header.parse_param_list}
	 * that bails out if there are duplicate parameters.
	 * Note that this function will treat RFC5987-encoded
	 * parameters as duplicated if an ASCII version is also
	 * present. For header fields that might contain
	 * RFC5987-encoded parameters, use
	 * soup_header_parse_param_list() instead.
	 * @param header a header value
	 * @returns 
	 * a #GHashTable of list elements, which can be freed with
	 * {@link Soup.header.free_param_list} or %NULL if there are duplicate
	 * elements.
	 */
	function header_parse_param_list_strict(header: string): string[] | null;

	/**
	 * Parses a header whose content is a list of items with optional
	 * "qvalue"s (eg, Accept, Accept-Charset, Accept-Encoding,
	 * Accept-Language, TE).
	 * 
	 * If #unacceptable is not %NULL, then on return, it will contain the
	 * items with qvalue 0. Either way, those items will be removed from
	 * the main list.
	 * @param header a header value
	 * @returns a #GSList of
	 * acceptable values (as allocated strings), highest-qvalue first.
	 * 
	 * on
	 * return, will contain a list of unacceptable values
	 */
	function header_parse_quality_list(header: string): [ string[], string[] | null ];

	/**
	 * Parses a header which is a semicolon-delimited list of something
	 * like: <literal>token [ "=" ( token | quoted-string ) ]</literal>.
	 * 
	 * Tokens that don't have an associated value will still be added to
	 * the resulting hash table, but with a %NULL value.
	 * 
	 * This also handles RFC5987 encoding (which in HTTP is mostly used
	 * for giving UTF8-encoded filenames in the Content-Disposition
	 * header).
	 * @param header a header value
	 * @returns a
	 * #GHashTable of list elements, which can be freed with
	 * {@link Soup.header.free_param_list}.
	 */
	function header_parse_semi_param_list(header: string): string[];

	/**
	 * A strict version of {@link Soup.header.parse_semi_param_list}
	 * that bails out if there are duplicate parameters.
	 * Note that this function will treat RFC5987-encoded
	 * parameters as duplicated if an ASCII version is also
	 * present. For header fields that might contain
	 * RFC5987-encoded parameters, use
	 * soup_header_parse_semi_param_list() instead.
	 * @param header a header value
	 * @returns 
	 * a #GHashTable of list elements, which can be freed with
	 * {@link Soup.header.free_param_list} or %NULL if there are duplicate
	 * elements.
	 */
	function header_parse_semi_param_list_strict(header: string): string[] | null;

	/**
	 * Parses the headers of an HTTP request or response in #str and
	 * stores the results in #dest. Beware that #dest may be modified even
	 * on failure.
	 * 
	 * This is a low-level method; normally you would use
	 * {@link Soup.headers.parse_request} or soup_headers_parse_response().
	 * @param str the header string (including the Request-Line or Status-Line,
	 *   but not the trailing blank line)
	 * @param len length of #str
	 * @param dest {@link MessageHeaders} to store the header values in
	 * @returns success or failure
	 */
	function headers_parse(str: string, len: number, dest: MessageHeaders): boolean;

	/**
	 * Parses the headers of an HTTP request in #str and stores the
	 * results in #req_method, #req_path, #ver, and #req_headers.
	 * 
	 * Beware that #req_headers may be modified even on failure.
	 * @param str the headers (up to, but not including, the trailing blank line)
	 * @param len length of #str
	 * @param req_headers {@link MessageHeaders} to store the header values in
	 * @returns %SOUP_STATUS_OK if the headers could be parsed, or an
	 * HTTP error to be returned to the client if they could not be.
	 * 
	 * if non-%NULL, will be filled in with the
	 * request method
	 * 
	 * if non-%NULL, will be filled in with the
	 * request path
	 * 
	 * if non-%NULL, will be filled in with the HTTP
	 * version
	 */
	function headers_parse_request(str: string, len: number, req_headers: MessageHeaders): [ number, string | null, string | null, HTTPVersion | null ];

	/**
	 * Parses the headers of an HTTP response in #str and stores the
	 * results in #ver, #status_code, #reason_phrase, and #headers.
	 * 
	 * Beware that #headers may be modified even on failure.
	 * @param str the headers (up to, but not including, the trailing blank line)
	 * @param len length of #str
	 * @param headers {@link MessageHeaders} to store the header values in
	 * @returns success or failure.
	 * 
	 * if non-%NULL, will be filled in with the HTTP
	 * version
	 * 
	 * if non-%NULL, will be filled in with
	 * the status code
	 * 
	 * if non-%NULL, will be filled in with
	 * the reason phrase
	 */
	function headers_parse_response(str: string, len: number, headers: MessageHeaders): [ boolean, HTTPVersion | null, number | null, string | null ];

	/**
	 * Parses the HTTP Status-Line string in #status_line into #ver,
	 * #status_code, and #reason_phrase. #status_line must be terminated by
	 * either "\0" or "\r\n".
	 * @param status_line an HTTP Status-Line
	 * @returns %TRUE if #status_line was parsed successfully.
	 * 
	 * if non-%NULL, will be filled in with the HTTP
	 * version
	 * 
	 * if non-%NULL, will be filled in with
	 * the status code
	 * 
	 * if non-%NULL, will be filled in with
	 * the reason phrase
	 */
	function headers_parse_status_line(status_line: string): [ boolean, HTTPVersion | null, number | null, string | null ];

	function http_error_quark(): GLib.Quark;

	/**
	 * Initializes #iter for iterating #hdrs.
	 * @param hdrs a %SoupMessageHeaders
	 * @returns a pointer to a %SoupMessageHeadersIter
	 * structure
	 */
	function message_headers_iter_init(hdrs: MessageHeaders): MessageHeadersIter;

	function request_error_quark(): GLib.Quark;

	function requester_error_quark(): GLib.Quark;

	/**
	 * Looks up the stock HTTP description of #status_code. This is used
	 * by {@link Soup.Message.set_status} to get the correct text to go with a
	 * given status code.
	 * 
	 * <emphasis>There is no reason for you to ever use this
	 * function.</emphasis> If you wanted the textual description for the
	 * {@link Message.status_code} of a given #SoupMessage, you should just
	 * look at the message's #SoupMessage:reason_phrase. However, you
	 * should only do that for use in debugging messages; HTTP reason
	 * phrases are not localized, and are not generally very descriptive
	 * anyway, and so they should never be presented to the user directly.
	 * Instead, you should create you own error messages based on the
	 * status code, and on what you were trying to do.
	 * @param status_code an HTTP status code
	 * @returns the (terse, English) description of #status_code
	 */
	function status_get_phrase(status_code: number): string;

	/**
	 * Turns %SOUP_STATUS_CANT_RESOLVE into
	 * %SOUP_STATUS_CANT_RESOLVE_PROXY and %SOUP_STATUS_CANT_CONNECT into
	 * %SOUP_STATUS_CANT_CONNECT_PROXY. Other status codes are passed
	 * through unchanged.
	 * @param status_code a status code
	 * @returns the "proxified" equivalent of #status_code.
	 */
	function status_proxify(status_code: number): number;

	/**
	 * Compares #v1 and #v2 in a case-insensitive manner
	 * @param v1 an ASCII string
	 * @param v2 another ASCII string
	 * @returns %TRUE if they are equal (modulo case)
	 */
	function str_case_equal(v1: any | null, v2: any | null): boolean;

	/**
	 * Hashes #key in a case-insensitive manner.
	 * @param key ASCII string to hash
	 * @returns the hash code.
	 */
	function str_case_hash(key: any | null): number;

	/**
	 * Looks whether the #domain passed as argument is a public domain
	 * suffix (.org, .com, .co.uk, etc) or not.
	 * 
	 * Prior to libsoup 2.46, this function required that #domain be in
	 * UTF-8 if it was an IDN. From 2.46 on, the name can be in either
	 * UTF-8 or ASCII format.
	 * @param domain a domain name
	 * @returns %TRUE if it is a public domain, %FALSE otherwise.
	 */
	function tld_domain_is_public_suffix(domain: string): boolean;

	function tld_error_quark(): GLib.Quark;

	/**
	 * Finds the base domain for a given #hostname. The base domain is
	 * composed by the top level domain (such as .org, .com, .co.uk, etc)
	 * plus the second level domain, for example for myhost.mydomain.com
	 * it will return mydomain.com.
	 * 
	 * Note that %NULL will be returned for private URLs (those not ending
	 * with any well known TLD) because choosing a base domain for them
	 * would be totally arbitrary.
	 * 
	 * Prior to libsoup 2.46, this function required that #hostname be in
	 * UTF-8 if it was an IDN. From 2.46 on, the name can be in either
	 * UTF-8 or ASCII format (and the return value will be in the same
	 * format).
	 * @param hostname a hostname
	 * @returns a pointer to the start of the base domain in #hostname. If
	 * an error occurs, %NULL will be returned and #error set.
	 */
	function tld_get_base_domain(hostname: string): string;

	/**
	 * Fully %<!-- -->-decodes #part.
	 * 
	 * In the past, this would return %NULL if #part contained invalid
	 * percent-encoding, but now it just ignores the problem (as
	 * {@link Soup.URI.new} already did).
	 * @param part a URI part
	 * @returns the decoded URI part.
	 */
	function uri_decode(part: string): string;

	/**
	 * This %<!-- -->-encodes the given URI part and returns the escaped
	 * version in allocated memory, which the caller must free when it is
	 * done.
	 * @param part a URI part
	 * @param escape_extra additional reserved characters to
	 * escape (or %NULL)
	 * @returns the encoded URI part
	 */
	function uri_encode(part: string, escape_extra: string | null): string;

	/**
	 * %<!-- -->-decodes any "unreserved" characters (or characters in
	 * #unescape_extra) in #part, and %<!-- -->-encodes any non-ASCII
	 * characters, spaces, and non-printing characters in #part.
	 * 
	 * "Unreserved" characters are those that are not allowed to be used
	 * for punctuation according to the URI spec. For example, letters are
	 * unreserved, so {@link Soup.uri.normalize} will turn
	 * <literal>http://example.com/foo/b%<!-- -->61r</literal> into
	 * <literal>http://example.com/foo/bar</literal>, which is guaranteed
	 * to mean the same thing. However, "/" is "reserved", so
	 * <literal>http://example.com/foo%<!-- -->2Fbar</literal> would not
	 * be changed, because it might mean something different to the
	 * server.
	 * 
	 * In the past, this would return %NULL if #part contained invalid
	 * percent-encoding, but now it just ignores the problem (as
	 * soup_uri_new() already did).
	 * @param part a URI part
	 * @param unescape_extra reserved characters to unescape (or %NULL)
	 * @returns the normalized URI part
	 */
	function uri_normalize(part: string, unescape_extra: string | null): string;

	/**
	 * Appends the provided value of type #type to #array as with
	 * {@link G.value_array_append}. (The provided data is copied rather than
	 * being inserted directly.)
	 * @param array a #GValueArray
	 * @param type a #GType
	 */
	function value_array_append(array: GObject.ValueArray, type: GObject.Type): void;

	/**
	 * Appends the provided values into #array as with
	 * {@link G.value_array_append}. (The provided data is copied rather than
	 * being inserted directly.)
	 * @param array a #GValueArray
	 * @param first_type the type of the first value to add
	 */
	function value_array_append_vals(array: GObject.ValueArray, first_type: GObject.Type): void;

	/**
	 * Creates a #GValueArray from the provided arguments, which must
	 * consist of pairs of a #GType and a value of that type, terminated
	 * by %G_TYPE_INVALID. (The array will contain copies of the provided
	 * data rather than pointing to the passed-in data directly.)
	 * @param args arguments to create a #GValueArray from
	 * @returns a new #GValueArray, or %NULL if an error
	 * occurred.
	 */
	function value_array_from_args(args: any[]): GObject.ValueArray | null;

	/**
	 * Gets the #index_ element of #array and stores its value into the
	 * provided location.
	 * @param array a #GValueArray
	 * @param index_ the index to look up
	 * @param type a #GType
	 * @returns %TRUE if #array contained a value with index #index_
	 * and type #type, %FALSE if not.
	 */
	function value_array_get_nth(array: GObject.ValueArray, index_: number, type: GObject.Type): boolean;

	/**
	 * Inserts the provided value of type #type into #array as with
	 * {@link G.value_array_insert}. (The provided data is copied rather than
	 * being inserted directly.)
	 * @param array a #GValueArray
	 * @param index_ the index to insert at
	 * @param type a #GType
	 */
	function value_array_insert(array: GObject.ValueArray, index_: number, type: GObject.Type): void;

	/**
	 * Creates a new %GValueArray. (This is just a wrapper around
	 * {@link G.value_array_new}, for naming consistency purposes.)
	 * @returns a new %GValueArray
	 */
	function value_array_new(): GObject.ValueArray;

	/**
	 * Creates a new %GValueArray and copies the provided values
	 * into it.
	 * @param first_type the type of the first value to add
	 * @returns a new %GValueArray
	 */
	function value_array_new_with_vals(first_type: GObject.Type): GObject.ValueArray;

	/**
	 * Extracts a #GValueArray into the provided arguments, which must
	 * consist of pairs of a #GType and a value of pointer-to-that-type,
	 * terminated by %G_TYPE_INVALID. The returned values will point to the
	 * same memory as the values in the array.
	 * @param array a #GValueArray
	 * @param args arguments to extract #array into
	 * @returns success or failure
	 */
	function value_array_to_args(array: GObject.ValueArray, args: any[]): boolean;

	/**
	 * Inserts the provided value of type #type into #hash. (Unlike with
	 * {@link G.hash_table_insert}, both the key and the value are copied).
	 * @param hash a value hash
	 * @param key the key
	 * @param type a #GType
	 */
	function value_hash_insert(hash: string[], key: string, type: GObject.Type): void;

	/**
	 * Inserts the given data into #hash. As with
	 * {@link Soup.value.hash_insert}, the keys and values are copied rather
	 * than being inserted directly.
	 * @param hash a value hash
	 * @param first_key the key for the first value
	 */
	function value_hash_insert_vals(hash: string[], first_key: string): void;

	/**
	 * Inserts #value into #hash. (Unlike with {@link G.hash_table_insert}, both
	 * the key and the value are copied).
	 * @param hash a value hash
	 * @param key the key
	 * @param value a value
	 */
	function value_hash_insert_value(hash: string[], key: string, value: GObject.Value): void;

	/**
	 * Looks up #key in #hash and stores its value into the provided
	 * location.
	 * @param hash a value hash
	 * @param key the key to look up
	 * @param type a #GType
	 * @returns %TRUE if #hash contained a value with key #key and
	 * type #type, %FALSE if not.
	 */
	function value_hash_lookup(hash: string[], key: string, type: GObject.Type): boolean;

	/**
	 * Looks up a number of keys in #hash and returns their values.
	 * @param hash a value hash
	 * @param first_key the first key to look up
	 * @returns %TRUE if all of the keys were found, %FALSE
	 * if any were missing; note that you will generally need to
	 * initialize each destination variable to a reasonable default
	 * value, since there is no way to tell which keys were found
	 * and which were not.
	 */
	function value_hash_lookup_vals(hash: string[], first_key: string): boolean;

	/**
	 * Creates a #GHashTable whose keys are strings and whose values
	 * are #GValue.
	 * @returns a new
	 * empty #GHashTable
	 */
	function value_hash_new(): string[];

	/**
	 * Creates a #GHashTable whose keys are strings and whose values
	 * are #GValue, and initializes it with the provided data. As
	 * with {@link Soup.value.hash_insert}, the keys and values are copied
	 * rather than being inserted directly.
	 * @param first_key the key for the first value
	 * @returns a new
	 * #GHashTable, initialized with the given values
	 */
	function value_hash_new_with_vals(first_key: string): string[];

	/**
	 * Adds the necessary headers to #msg to request a WebSocket
	 * handshake. The message body and non-WebSocket-related headers are
	 * not modified.
	 * 
	 * Use {@link Soup.websocket.client_prepare_handshake_with_extensions} if you
	 * want to include "Sec-WebSocket-Extensions" header in the request.
	 * 
	 * This is a low-level function; if you use
	 * soup_session_websocket_connect_async() to create a WebSocket
	 * connection, it will call this for you.
	 * @param msg a {@link Message}
	 * @param origin the "Origin" header to set
	 * @param protocols list of
	 *   protocols to offer
	 */
	function websocket_client_prepare_handshake(msg: Message, origin: string | null, protocols: string[] | null): void;

	/**
	 * Adds the necessary headers to #msg to request a WebSocket
	 * handshake including supported WebSocket extensions.
	 * The message body and non-WebSocket-related headers are
	 * not modified.
	 * 
	 * This is a low-level function; if you use
	 * {@link Soup.Session.websocket_connect_async} to create a WebSocket
	 * connection, it will call this for you.
	 * @param msg a {@link Message}
	 * @param origin the "Origin" header to set
	 * @param protocols list of
	 *   protocols to offer
	 * @param supported_extensions list
	 *   of supported extension types
	 */
	function websocket_client_prepare_handshake_with_extensions(msg: Message, origin: string | null, protocols: string[] | null, supported_extensions: GObject.TypeClass[] | null): void;

	/**
	 * Looks at the response status code and headers in #msg and
	 * determines if they contain a valid WebSocket handshake response
	 * (given the handshake request in #msg's request headers).
	 * 
	 * If the response contains the "Sec-WebSocket-Extensions" header,
	 * the handshake will be considered invalid. You need to use
	 * {@link Soup.websocket.client_verify_handshake_with_extensions} to handle
	 * responses with extensions.
	 * 
	 * This is a low-level function; if you use
	 * soup_session_websocket_connect_async() to create a WebSocket
	 * connection, it will call this for you.
	 * @param msg {@link Message} containing both client and server sides of a
	 *   WebSocket handshake
	 * @returns %TRUE if #msg contains a completed valid WebSocket
	 *   handshake, %FALSE and an error if not.
	 */
	function websocket_client_verify_handshake(msg: Message): boolean;

	/**
	 * Looks at the response status code and headers in #msg and
	 * determines if they contain a valid WebSocket handshake response
	 * (given the handshake request in #msg's request headers).
	 * 
	 * If #supported_extensions is non-%NULL, extensions included in the
	 * response "Sec-WebSocket-Extensions" are verified too. Accepted
	 * extensions are returned in #accepted_extensions parameter if non-%NULL.
	 * 
	 * This is a low-level function; if you use
	 * {@link Soup.Session.websocket_connect_async} to create a WebSocket
	 * connection, it will call this for you.
	 * @param msg {@link Message} containing both client and server sides of a
	 *   WebSocket handshake
	 * @param supported_extensions list
	 *   of supported extension types
	 * @returns %TRUE if #msg contains a completed valid WebSocket
	 *   handshake, %FALSE and an error if not.
	 * 
	 * a
	 *   #GList of {@link WebsocketExtension} objects
	 */
	function websocket_client_verify_handshake_with_extensions(msg: Message, supported_extensions: GObject.TypeClass[] | null): [ boolean, WebsocketExtension[] | null ];

	function websocket_error_get_quark(): GLib.Quark;

	/**
	 * Examines the method and request headers in #msg and determines
	 * whether #msg contains a valid handshake request.
	 * 
	 * If #origin is non-%NULL, then only requests containing a matching
	 * "Origin" header will be accepted. If #protocols is non-%NULL, then
	 * only requests containing a compatible "Sec-WebSocket-Protocols"
	 * header will be accepted.
	 * 
	 * Requests containing "Sec-WebSocket-Extensions" header will be
	 * accepted even if the header is not valid. To check a request
	 * with extensions you need to use
	 * {@link Soup.websocket.server_check_handshake_with_extensions} and provide
	 * the list of supported extension types.
	 * 
	 * Normally soup_websocket_server_process_handshake() will take care
	 * of this for you, and if you use soup_server_add_websocket_handler()
	 * to handle accepting WebSocket connections, it will call that for
	 * you. However, this function may be useful if you need to perform
	 * more complicated validation; eg, accepting multiple different Origins,
	 * or handling different protocols depending on the path.
	 * @param msg {@link Message} containing the client side of a WebSocket handshake
	 * @param origin expected Origin header
	 * @param protocols allowed WebSocket
	 *   protocols.
	 * @returns %TRUE if #msg contained a valid WebSocket handshake,
	 *   %FALSE and an error if not.
	 */
	function websocket_server_check_handshake(msg: Message, origin: string | null, protocols: string[] | null): boolean;

	/**
	 * Examines the method and request headers in #msg and determines
	 * whether #msg contains a valid handshake request.
	 * 
	 * If #origin is non-%NULL, then only requests containing a matching
	 * "Origin" header will be accepted. If #protocols is non-%NULL, then
	 * only requests containing a compatible "Sec-WebSocket-Protocols"
	 * header will be accepted. If #supported_extensions is non-%NULL, then
	 * only requests containing valid supported extensions in
	 * "Sec-WebSocket-Extensions" header will be accepted.
	 * 
	 * Normally {@link Soup.websocket.server_process_handshake_with_extensioins}
	 * will take care of this for you, and if you use
	 * soup_server_add_websocket_handler() to handle accepting WebSocket
	 * connections, it will call that for you. However, this function may
	 * be useful if you need to perform more complicated validation; eg,
	 * accepting multiple different Origins, or handling different protocols
	 * depending on the path.
	 * @param msg {@link Message} containing the client side of a WebSocket handshake
	 * @param origin expected Origin header
	 * @param protocols allowed WebSocket
	 *   protocols.
	 * @param supported_extensions list
	 *   of supported extension types
	 * @returns %TRUE if #msg contained a valid WebSocket handshake,
	 *   %FALSE and an error if not.
	 */
	function websocket_server_check_handshake_with_extensions(msg: Message, origin: string | null, protocols: string[] | null, supported_extensions: GObject.TypeClass[] | null): boolean;

	/**
	 * Examines the method and request headers in #msg and (assuming #msg
	 * contains a valid handshake request), fills in the handshake
	 * response.
	 * 
	 * If #expected_origin is non-%NULL, then only requests containing a matching
	 * "Origin" header will be accepted. If #protocols is non-%NULL, then
	 * only requests containing a compatible "Sec-WebSocket-Protocols"
	 * header will be accepted.
	 * 
	 * Requests containing "Sec-WebSocket-Extensions" header will be
	 * accepted even if the header is not valid. To process a request
	 * with extensions you need to use
	 * {@link Soup.websocket.server_process_handshake_with_extensions} and provide
	 * the list of supported extension types.
	 * 
	 * This is a low-level function; if you use
	 * soup_server_add_websocket_handler() to handle accepting WebSocket
	 * connections, it will call this for you.
	 * @param msg {@link Message} containing the client side of a WebSocket handshake
	 * @param expected_origin expected Origin header
	 * @param protocols allowed WebSocket
	 *   protocols.
	 * @returns %TRUE if #msg contained a valid WebSocket handshake
	 *   request and was updated to contain a handshake response. %FALSE if not.
	 */
	function websocket_server_process_handshake(msg: Message, expected_origin: string | null, protocols: string[] | null): boolean;

	/**
	 * Examines the method and request headers in #msg and (assuming #msg
	 * contains a valid handshake request), fills in the handshake
	 * response.
	 * 
	 * If #expected_origin is non-%NULL, then only requests containing a matching
	 * "Origin" header will be accepted. If #protocols is non-%NULL, then
	 * only requests containing a compatible "Sec-WebSocket-Protocols"
	 * header will be accepted. If #supported_extensions is non-%NULL, then
	 * only requests containing valid supported extensions in
	 * "Sec-WebSocket-Extensions" header will be accepted. The accepted extensions
	 * will be returned in #accepted_extensions parameter if non-%NULL.
	 * 
	 * This is a low-level function; if you use
	 * {@link Soup.Server.add_websocket_handler} to handle accepting WebSocket
	 * connections, it will call this for you.
	 * @param msg {@link Message} containing the client side of a WebSocket handshake
	 * @param expected_origin expected Origin header
	 * @param protocols allowed WebSocket
	 *   protocols.
	 * @param supported_extensions list
	 *   of supported extension types
	 * @returns %TRUE if #msg contained a valid WebSocket handshake
	 *   request and was updated to contain a handshake response. %FALSE if not.
	 * 
	 * a
	 *   #GList of {@link WebsocketExtension} objects
	 */
	function websocket_server_process_handshake_with_extensions(msg: Message, expected_origin: string | null, protocols: string[] | null, supported_extensions: GObject.TypeClass[] | null): [ boolean, WebsocketExtension[] | null ];

	/**
	 * This creates an XML-RPC fault response and returns it as a string.
	 * (To create a successful response, use
	 * {@link Soup.xmlrpc.build_method_response}.)
	 * @param fault_code the fault code
	 * @param fault_format a printf()-style format string
	 * @returns the text of the fault
	 */
	function xmlrpc_build_fault(fault_code: number, fault_format: string): string;

	/**
	 * This creates an XML-RPC methodCall and returns it as a string.
	 * This is the low-level method that {@link Soup.xmlrpc.request_new} is
	 * built on.
	 * 
	 * #params is an array of #GValue representing the parameters to
	 * #method. (It is *not* a #GValueArray, although if you have a
	 * #GValueArray, you can just pass its <literal>values</literal>f and
	 * <literal>n_values</literal> fields.)
	 * 
	 * The correspondence between glib types and XML-RPC types is:
	 * 
	 *   int: #int (%G_TYPE_INT)
	 *   boolean: #gboolean (%G_TYPE_BOOLEAN)
	 *   string: #char* (%G_TYPE_STRING)
	 *   double: #double (%G_TYPE_DOUBLE)
	 *   datetime.iso8601: {@link Date} (%SOUP_TYPE_DATE)
	 *   base64: #GByteArray (%SOUP_TYPE_BYTE_ARRAY)
	 *   struct: #GHashTable (%G_TYPE_HASH_TABLE)
	 *   array: #GValueArray (%G_TYPE_VALUE_ARRAY)
	 * 
	 * For structs, use a #GHashTable that maps strings to #GValue;
	 * soup_value_hash_new() and related methods can help with this.
	 * @param method_name the name of the XML-RPC method
	 * @param params arguments to #method
	 * @param n_params length of #params
	 * @returns the text of the methodCall, or %NULL on
	 * error
	 */
	function xmlrpc_build_method_call(method_name: string, params: GObject.Value[], n_params: number): string | null;

	/**
	 * This creates a (successful) XML-RPC methodResponse and returns it
	 * as a string. To create a fault response, use
	 * {@link Soup.xmlrpc.build_fault}.
	 * 
	 * The glib type to XML-RPC type mapping is as with
	 * soup_xmlrpc_build_method_call(), qv.
	 * @param value the return value
	 * @returns the text of the methodResponse, or %NULL
	 * on error
	 */
	function xmlrpc_build_method_response(value: GObject.Value): string | null;

	/**
	 * This creates an XML-RPC methodCall and returns it as a string.
	 * This is the low-level method that {@link Soup.xmlrpc.message_new} is
	 * built on.
	 * 
	 * #params is a #GVariant tuple representing the method parameters.
	 * 
	 * Serialization details:
	 *  - "a{s*}" and "{s*}" are serialized as &lt;struct&gt;
	 *  - "ay" is serialized as &lt;base64&gt;
	 *  - Other arrays and tuples are serialized as &lt;array&gt;
	 *  - booleans are serialized as &lt;boolean&gt;
	 *  - byte, int16, uint16 and int32 are serialized as &lt;int&gt;
	 *  - uint32 and int64 are serialized as the nonstandard &lt;i8&gt; type
	 *  - doubles are serialized as &lt;double&gt;
	 *  - Strings are serialized as &lt;string&gt;
	 *  - Variants (i.e. "v" type) are unwrapped and their child is serialized.
	 *  - #GVariants created by soup_xmlrpc_variant_new_datetime() are serialized as
	 *    &lt;dateTime.iso8601&gt;
	 *  - Other types are not supported and will return %NULL and set #error.
	 *    This notably includes: object-paths, signatures, uint64, handles, maybes
	 *    and dictionaries with non-string keys.
	 * 
	 * If #params is floating, it is consumed.
	 * @param method_name the name of the XML-RPC method
	 * @param params a #GVariant tuple
	 * @returns the text of the methodCall, or %NULL on error.
	 */
	function xmlrpc_build_request(method_name: string, params: GLib.Variant): string;

	/**
	 * This creates a (successful) XML-RPC methodResponse and returns it
	 * as a string. To create a fault response, use {@link Soup.xmlrpc.build_fault}. This
	 * is the low-level method that soup_xmlrpc_message_set_response() is built on.
	 * 
	 * See soup_xmlrpc_build_request() for serialization details, but note
	 * that since a method can only have a single return value, #value
	 * should not be a tuple here (unless the return value is an array).
	 * 
	 * If #value is floating, it is consumed.
	 * @param value the return value
	 * @returns the text of the methodResponse, or %NULL on error.
	 */
	function xmlrpc_build_response(value: GLib.Variant): string;

	function xmlrpc_error_quark(): GLib.Quark;

	/**
	 * Parses #method_call to get the name and parameters, and puts
	 * the parameters into variables of the appropriate types.
	 * 
	 * The parameters are handled similarly to
	 * #soup_xmlrpc_build_method_call, with pairs of types and values,
	 * terminated by %G_TYPE_INVALID, except that values are pointers to
	 * variables of the indicated type, rather than values of the type.
	 * 
	 * See also {@link Soup.xmlrpc.parse_method_call}, which can be used if
	 * you don't know the types of the parameters.
	 * @param method_call the XML-RPC methodCall string
	 * @param length the length of #method_call, or -1 if it is NUL-terminated
	 * @returns success or failure.
	 * 
	 * on return, the methodName from #method_call
	 */
	function xmlrpc_extract_method_call(method_call: string, length: number): [ boolean, string ];

	/**
	 * Parses #method_response and extracts the return value into
	 * a variable of the correct type.
	 * 
	 * If #method_response is a fault, the return value will be unset,
	 * and #error will be set to an error of type %SOUP_XMLRPC_FAULT, with
	 * the error #code containing the fault code, and the error #message
	 * containing the fault string. (If #method_response cannot be parsed
	 * at all, {@link Soup.xmlrpc.extract_method_response} will return %FALSE,
	 * but #error will be unset.)
	 * @param method_response the XML-RPC methodResponse string
	 * @param length the length of #method_response, or -1 if it is NUL-terminated
	 * @param error error return value
	 * @param type the expected type of the return value
	 * @returns %TRUE if a return value was parsed, %FALSE if the
	 * response was of the wrong type, or contained a fault.
	 */
	function xmlrpc_extract_method_response(method_response: string, length: number, error: GLib.Error, type: GObject.Type): boolean;

	function xmlrpc_fault_quark(): GLib.Quark;

	/**
	 * Creates an XML-RPC methodCall and returns a {@link Message}, ready
	 * to send, for that method call.
	 * 
	 * See {@link Soup.xmlrpc.build_request} for serialization details.
	 * 
	 * If #params is floating, it is consumed.
	 * @param uri URI of the XML-RPC service
	 * @param method_name the name of the XML-RPC method to invoke at #uri
	 * @param params a #GVariant tuple
	 * @returns a {@link Message} encoding the
	 *   indicated XML-RPC request, or %NULL on error.
	 */
	function xmlrpc_message_new(uri: string, method_name: string, params: GLib.Variant): Message;

	/**
	 * Sets the status code and response body of #msg to indicate an
	 * unsuccessful XML-RPC call, with the error described by #fault_code
	 * and #fault_format.
	 * @param msg an XML-RPC request
	 * @param fault_code the fault code
	 * @param fault_format a printf()-style format string
	 */
	function xmlrpc_message_set_fault(msg: Message, fault_code: number, fault_format: string): void;

	/**
	 * Sets the status code and response body of #msg to indicate a
	 * successful XML-RPC call, with a return value given by #value. To set a
	 * fault response, use {@link Soup.xmlrpc.message_set_fault}.
	 * 
	 * See soup_xmlrpc_build_request() for serialization details.
	 * 
	 * If #value is floating, it is consumed.
	 * @param msg an XML-RPC request
	 * @param value a #GVariant
	 * @returns %TRUE on success, %FALSE otherwise.
	 */
	function xmlrpc_message_set_response(msg: Message, value: GLib.Variant): boolean;

	/**
	 * Parses #method_call to get the name and parameters, and returns the
	 * parameter values in a #GValueArray; see also
	 * {@link Soup.xmlrpc.extract_method_call}, which is more convenient if you
	 * know in advance what the types of the parameters will be.
	 * @param method_call the XML-RPC methodCall string
	 * @param length the length of #method_call, or -1 if it is NUL-terminated
	 * @returns success or failure.
	 * 
	 * on return, the methodName from #method_call
	 * 
	 * on return, the parameters from #method_call
	 */
	function xmlrpc_parse_method_call(method_call: string, length: number): [ boolean, string, GObject.ValueArray ];

	/**
	 * Parses #method_response and returns the return value in #value. If
	 * #method_response is a fault, #value will be unchanged, and #error
	 * will be set to an error of type %SOUP_XMLRPC_FAULT, with the error
	 * #code containing the fault code, and the error #message containing
	 * the fault string. (If #method_response cannot be parsed at all,
	 * {@link Soup.xmlrpc.parse_method_response} will return %FALSE, but #error
	 * will be unset.)
	 * @param method_response the XML-RPC methodResponse string
	 * @param length the length of #method_response, or -1 if it is NUL-terminated
	 * @returns %TRUE if a return value was parsed, %FALSE if the
	 * response could not be parsed, or contained a fault.
	 * 
	 * on return, the return value from #method_call
	 */
	function xmlrpc_parse_method_response(method_response: string, length: number): [ boolean, GObject.Value ];

	/**
	 * Parses #method_call and return the method name. Method parameters can be
	 * parsed later using {@link Soup.xmlrpc_params_parse}.
	 * @param method_call the XML-RPC methodCall string
	 * @param length the length of #method_call, or -1 if it is NUL-terminated
	 * @returns method's name, or %NULL on error.
	 * 
	 * on success, a new {@link XMLRPCParams}
	 */
	function xmlrpc_parse_request(method_call: string, length: number): [ string, XMLRPCParams ];

	/**
	 * Parses #method_response and returns the return value. If
	 * #method_response is a fault, %NULL is returned, and #error
	 * will be set to an error in the %SOUP_XMLRPC_FAULT domain, with the error
	 * code containing the fault code, and the error message containing
	 * the fault string. If #method_response cannot be parsed, %NULL is returned,
	 * and #error will be set to an error in the %SOUP_XMLRPC_ERROR domain.
	 * 
	 * See {@link Soup.xmlrpc_params_parse} for deserialization details.
	 * @param method_response the XML-RPC methodResponse string
	 * @param length the length of #method_response, or -1 if it is NUL-terminated
	 * @param signature A valid #GVariant type string, or %NULL
	 * @returns a new (non-floating) #GVariant, or %NULL
	 */
	function xmlrpc_parse_response(method_response: string, length: number, signature: string | null): GLib.Variant;

	/**
	 * Creates an XML-RPC methodCall and returns a {@link Message}, ready
	 * to send, for that method call.
	 * 
	 * The parameters are passed as type/value pairs; ie, first a #GType,
	 * and then a value of the appropriate type, finally terminated by
	 * %G_TYPE_INVALID.
	 * @param uri URI of the XML-RPC service
	 * @param method_name the name of the XML-RPC method to invoke at #uri
	 * @returns a {@link Message} encoding the
	 * indicated XML-RPC request.
	 */
	function xmlrpc_request_new(uri: string, method_name: string): Message;

	/**
	 * Sets the status code and response body of #msg to indicate an
	 * unsuccessful XML-RPC call, with the error described by #fault_code
	 * and #fault_format.
	 * @param msg an XML-RPC request
	 * @param fault_code the fault code
	 * @param fault_format a printf()-style format string
	 */
	function xmlrpc_set_fault(msg: Message, fault_code: number, fault_format: string): void;

	/**
	 * Sets the status code and response body of #msg to indicate a
	 * successful XML-RPC call, with a return value given by #type and the
	 * following varargs argument, of the type indicated by #type.
	 * @param msg an XML-RPC request
	 * @param type the type of the response value
	 */
	function xmlrpc_set_response(msg: Message, type: GObject.Type): void;

	/**
	 * Get the {@link Date} from special #GVariant created by
	 * {@link Soup.xmlrpc.variant_new_datetime} or by parsing a &lt;dateTime.iso8601&gt;
	 * node. See soup_xmlrpc_params_parse().
	 * 
	 * If #variant does not contain a datetime it will return an error but it is not
	 * considered a programmer error because it generally means parameters received
	 * are not in the expected type.
	 * @param variant a #GVariant
	 * @returns a new {@link Date}, or %NULL on error.
	 */
	function xmlrpc_variant_get_datetime(variant: GLib.Variant): Date;

	/**
	 * Construct a special #GVariant used to serialize a &lt;dateTime.iso8601&gt;
	 * node. See {@link Soup.xmlrpc.build_request}.
	 * 
	 * The actual type of the returned #GVariant is unspecified and "v" or "*"
	 * should be used in variant format strings. For example:
	 * <informalexample><programlisting>
	 * args = g_variant_new ("(v)", soup_xmlrpc_variant_new_datetime (date));
	 * </programlisting></informalexample>
	 * @param date a {@link Date}
	 * @returns a floating #GVariant.
	 */
	function xmlrpc_variant_new_datetime(date: Date): GLib.Variant;

	/**
	 * This can be passed to any {@link Address} method that expects a port,
	 * to indicate that you don't care what port is used.
	 * @returns This can be passed to any {@link Address} method that expects a port,
	 * to indicate that you don't care what port is used.
	 */
	const ADDRESS_ANY_PORT: number;

	/**
	 * Alias for the {@link Address.family} property. (The
	 * #SoupAddressFamily for this address.)
	 * @returns Alias for the {@link Address.family} property. (The
	 * #SoupAddressFamily for this address.)
	 */
	const ADDRESS_FAMILY: string;

	/**
	 * Alias for the {@link Address.name} property. (The hostname for
	 * this address.)
	 * @returns Alias for the {@link Address.name} property. (The hostname for
	 * this address.)
	 */
	const ADDRESS_NAME: string;

	/**
	 * An alias for the {@link Address.physical} property. (The
	 * stringified IP address for this address.)
	 * @returns An alias for the {@link Address.physical} property. (The
	 * stringified IP address for this address.)
	 */
	const ADDRESS_PHYSICAL: string;

	/**
	 * An alias for the {@link Address.port} property. (The port for
	 * this address.)
	 * @returns An alias for the {@link Address.port} property. (The port for
	 * this address.)
	 */
	const ADDRESS_PORT: string;

	/**
	 * Alias for the {@link Address.protocol} property. (The URI scheme
	 * used with this address.)
	 * @returns Alias for the {@link Address.protocol} property. (The URI scheme
	 * used with this address.)
	 */
	const ADDRESS_PROTOCOL: string;

	/**
	 * An alias for the {@link Address.sockaddr} property. (A pointer
	 * to the struct sockaddr for this address.)
	 * @returns An alias for the {@link Address.sockaddr} property. (A pointer
	 * to the struct sockaddr for this address.)
	 */
	const ADDRESS_SOCKADDR: string;

	/**
	 * Alias for the {@link AuthDomain.add_path} property. (Shortcut
	 * for calling {@link Soup.AuthDomain.add_path}.)
	 * @returns Alias for the {@link AuthDomain.add_path} property. (Shortcut
	 * for calling {@link Soup.AuthDomain.add_path}.)
	 */
	const AUTH_DOMAIN_ADD_PATH: string;

	/**
	 * Alias for the {@link AuthDomainBasic.auth_callback} property.
	 * (The #SoupAuthDomainBasicAuthCallback.)
	 * @returns Alias for the {@link AuthDomainBasic.auth_callback} property.
	 * (The #SoupAuthDomainBasicAuthCallback.)
	 */
	const AUTH_DOMAIN_BASIC_AUTH_CALLBACK: string;

	/**
	 * Alias for the {@link AuthDomainBasic.auth_data} property.
	 * (The data to pass to the #SoupAuthDomainBasicAuthCallback.)
	 * @returns Alias for the {@link AuthDomainBasic.auth_data} property.
	 * (The data to pass to the #SoupAuthDomainBasicAuthCallback.)
	 */
	const AUTH_DOMAIN_BASIC_AUTH_DATA: string;

	/**
	 * Alias for the {@link AuthDomainDigest.auth_callback} property.
	 * (The #SoupAuthDomainDigestAuthCallback.)
	 * @returns Alias for the {@link AuthDomainDigest.auth_callback} property.
	 * (The #SoupAuthDomainDigestAuthCallback.)
	 */
	const AUTH_DOMAIN_DIGEST_AUTH_CALLBACK: string;

	/**
	 * Alias for the {@link AuthDomainDigest.auth_callback} property.
	 * (The #SoupAuthDomainDigestAuthCallback.)
	 * @returns Alias for the {@link AuthDomainDigest.auth_callback} property.
	 * (The #SoupAuthDomainDigestAuthCallback.)
	 */
	const AUTH_DOMAIN_DIGEST_AUTH_DATA: string;

	/**
	 * Alias for the {@link AuthDomain.filter} property. (The
	 * #SoupAuthDomainFilter for the domain.)
	 * @returns Alias for the {@link AuthDomain.filter} property. (The
	 * #SoupAuthDomainFilter for the domain.)
	 */
	const AUTH_DOMAIN_FILTER: string;

	/**
	 * Alias for the {@link AuthDomain.filter_data} property. (Data
	 * to pass to the #SoupAuthDomainFilter.)
	 * @returns Alias for the {@link AuthDomain.filter_data} property. (Data
	 * to pass to the #SoupAuthDomainFilter.)
	 */
	const AUTH_DOMAIN_FILTER_DATA: string;

	/**
	 * Alias for the {@link AuthDomain.generic_auth_callback} property.
	 * (The #SoupAuthDomainGenericAuthCallback.)
	 * @returns Alias for the {@link AuthDomain.generic_auth_callback} property.
	 * (The #SoupAuthDomainGenericAuthCallback.)
	 */
	const AUTH_DOMAIN_GENERIC_AUTH_CALLBACK: string;

	/**
	 * Alias for the {@link AuthDomain.generic_auth_data} property.
	 * (The data to pass to the #SoupAuthDomainGenericAuthCallback.)
	 * @returns Alias for the {@link AuthDomain.generic_auth_data} property.
	 * (The data to pass to the #SoupAuthDomainGenericAuthCallback.)
	 */
	const AUTH_DOMAIN_GENERIC_AUTH_DATA: string;

	/**
	 * Alias for the {@link AuthDomain.proxy} property. (Whether or
	 * not this is a proxy auth domain.)
	 * @returns Alias for the {@link AuthDomain.proxy} property. (Whether or
	 * not this is a proxy auth domain.)
	 */
	const AUTH_DOMAIN_PROXY: string;

	/**
	 * Alias for the {@link AuthDomain.realm} property. (The realm of
	 * this auth domain.)
	 * @returns Alias for the {@link AuthDomain.realm} property. (The realm of
	 * this auth domain.)
	 */
	const AUTH_DOMAIN_REALM: string;

	/**
	 * Alias for the {@link AuthDomain.remove_path} property.
	 * (Shortcut for calling {@link Soup.AuthDomain.remove_path}.)
	 * @returns Alias for the {@link AuthDomain.remove_path} property.
	 * (Shortcut for calling {@link Soup.AuthDomain.remove_path}.)
	 */
	const AUTH_DOMAIN_REMOVE_PATH: string;

	/**
	 * An alias for the {@link Auth.host} property. (The
	 * host being authenticated to.)
	 * @returns An alias for the {@link Auth.host} property. (The
	 * host being authenticated to.)
	 */
	const AUTH_HOST: string;

	/**
	 * An alias for the {@link Auth.is_authenticated} property.
	 * (Whether or not the auth has been authenticated.)
	 * @returns An alias for the {@link Auth.is_authenticated} property.
	 * (Whether or not the auth has been authenticated.)
	 */
	const AUTH_IS_AUTHENTICATED: string;

	/**
	 * An alias for the {@link Auth.is_for_proxy} property. (Whether
	 * or not the auth is for a proxy server.)
	 * @returns An alias for the {@link Auth.is_for_proxy} property. (Whether
	 * or not the auth is for a proxy server.)
	 */
	const AUTH_IS_FOR_PROXY: string;

	/**
	 * An alias for the {@link Auth.realm} property. (The
	 * authentication realm.)
	 * @returns An alias for the {@link Auth.realm} property. (The
	 * authentication realm.)
	 */
	const AUTH_REALM: string;

	/**
	 * An alias for the {@link Auth.scheme_name} property. (The
	 * authentication scheme name.)
	 * @returns An alias for the {@link Auth.scheme_name} property. (The
	 * authentication scheme name.)
	 */
	const AUTH_SCHEME_NAME: string;

	const CHAR_HTTP_CTL: number;

	const CHAR_HTTP_SEPARATOR: number;

	const CHAR_URI_GEN_DELIMS: number;

	const CHAR_URI_PERCENT_ENCODED: number;

	const CHAR_URI_SUB_DELIMS: number;

	/**
	 * Alias for the {@link CookieJar.accept_policy} property.
	 * @returns Alias for the {@link CookieJar.accept_policy} property.
	 */
	const COOKIE_JAR_ACCEPT_POLICY: string;

	/**
	 * Alias for the {@link CookieJarDB.filename} property. (The
	 * cookie-storage filename.)
	 * @returns Alias for the {@link CookieJarDB.filename} property. (The
	 * cookie-storage filename.)
	 */
	const COOKIE_JAR_DB_FILENAME: string;

	/**
	 * Alias for the {@link CookieJar.read_only} property. (Whether
	 * or not the cookie jar is read-only.)
	 * @returns Alias for the {@link CookieJar.read_only} property. (Whether
	 * or not the cookie jar is read-only.)
	 */
	const COOKIE_JAR_READ_ONLY: string;

	/**
	 * Alias for the {@link CookieJarText.filename} property. (The
	 * cookie-storage filename.)
	 * @returns Alias for the {@link CookieJarText.filename} property. (The
	 * cookie-storage filename.)
	 */
	const COOKIE_JAR_TEXT_FILENAME: string;

	/**
	 * A constant corresponding to 1 day, for use with {@link Soup.Cookie.new}
	 * and soup_cookie_set_max_age().
	 * @returns A constant corresponding to 1 day, for use with {@link Soup.Cookie.new}
	 * and soup_cookie_set_max_age().
	 */
	const COOKIE_MAX_AGE_ONE_DAY: number;

	/**
	 * A constant corresponding to 1 hour, for use with {@link Soup.Cookie.new}
	 * and soup_cookie_set_max_age().
	 * @returns A constant corresponding to 1 hour, for use with {@link Soup.Cookie.new}
	 * and soup_cookie_set_max_age().
	 */
	const COOKIE_MAX_AGE_ONE_HOUR: number;

	/**
	 * A constant corresponding to 1 week, for use with {@link Soup.Cookie.new}
	 * and soup_cookie_set_max_age().
	 * @returns A constant corresponding to 1 week, for use with {@link Soup.Cookie.new}
	 * and soup_cookie_set_max_age().
	 */
	const COOKIE_MAX_AGE_ONE_WEEK: number;

	/**
	 * A constant corresponding to 1 year, for use with {@link Soup.Cookie.new}
	 * and soup_cookie_set_max_age().
	 * @returns A constant corresponding to 1 year, for use with {@link Soup.Cookie.new}
	 * and soup_cookie_set_max_age().
	 */
	const COOKIE_MAX_AGE_ONE_YEAR: number;

	/**
	 * A macro containing the value
	 * <literal>"multipart/form-data"</literal>; the MIME type used for
	 * posting form data that contains files to be uploaded.
	 * @returns A macro containing the value
	 * <literal>"multipart/form-data"</literal>; the MIME type used for
	 * posting form data that contains files to be uploaded.
	 */
	const FORM_MIME_TYPE_MULTIPART: string;

	/**
	 * A macro containing the value
	 * <literal>"application/x-www-form-urlencoded"</literal>; the default
	 * MIME type for POSTing HTML form data.
	 * @returns A macro containing the value
	 * <literal>"application/x-www-form-urlencoded"</literal>; the default
	 * MIME type for POSTing HTML form data.
	 */
	const FORM_MIME_TYPE_URLENCODED: string;

	const HSTS_ENFORCER_DB_FILENAME: string;

	const HSTS_POLICY_MAX_AGE_PAST: number;

	/**
	 * Alias for the {@link Logger.level} property, qv.
	 * @returns Alias for the {@link Logger.level} property, qv.
	 */
	const LOGGER_LEVEL: string;

	/**
	 * Alias for the {@link Logger.max_body_size} property, qv.
	 * @returns Alias for the {@link Logger.max_body_size} property, qv.
	 */
	const LOGGER_MAX_BODY_SIZE: string;

	/**
	 * Like {@link Soup.get.major_version}, but from the headers used at
	 * application compile time, rather than from the library linked
	 * against at application run time.
	 * @returns Like {@link Soup.get.major_version}, but from the headers used at
	 * application compile time, rather than from the library linked
	 * against at application run time.
	 */
	const MAJOR_VERSION: number;

	/**
	 * Alias for the {@link Message.first_party} property. (The
	 * #SoupURI loaded in the application when the message was
	 * queued.)
	 * @returns Alias for the {@link Message.first_party} property. (The
	 * #SoupURI loaded in the application when the message was
	 * queued.)
	 */
	const MESSAGE_FIRST_PARTY: string;

	/**
	 * Alias for the {@link Message.flags} property. (The message's
	 * #SoupMessageFlags.)
	 * @returns Alias for the {@link Message.flags} property. (The message's
	 * #SoupMessageFlags.)
	 */
	const MESSAGE_FLAGS: string;

	/**
	 * Alias for the {@link Message.http_version} property. (The
	 * message's #SoupHTTPVersion.)
	 * @returns Alias for the {@link Message.http_version} property. (The
	 * message's #SoupHTTPVersion.)
	 */
	const MESSAGE_HTTP_VERSION: string;

	const MESSAGE_IS_TOP_LEVEL_NAVIGATION: string;

	/**
	 * Alias for the {@link Message.method} property. (The message's
	 * HTTP method.)
	 * @returns Alias for the {@link Message.method} property. (The message's
	 * HTTP method.)
	 */
	const MESSAGE_METHOD: string;

	/**
	 * Sets the priority of the {@link Message}. See
	 * {@link Soup.Message.set_priority} for further details.
	 * @returns Sets the priority of the {@link Message}. See
	 * {@link Soup.Message.set_priority} for further details.
	 */
	const MESSAGE_PRIORITY: string;

	/**
	 * Alias for the {@link Message.reason_phrase} property. (The
	 * message's HTTP response reason phrase.)
	 * @returns Alias for the {@link Message.reason_phrase} property. (The
	 * message's HTTP response reason phrase.)
	 */
	const MESSAGE_REASON_PHRASE: string;

	/**
	 * Alias for the {@link Message.request_body} property. (The
	 * message's HTTP request body.)
	 * @returns Alias for the {@link Message.request_body} property. (The
	 * message's HTTP request body.)
	 */
	const MESSAGE_REQUEST_BODY: string;

	/**
	 * Alias for the {@link Message.request_body_data} property. (The
	 * message's HTTP request body, as a #GBytes.)
	 * @returns Alias for the {@link Message.request_body_data} property. (The
	 * message's HTTP request body, as a #GBytes.)
	 */
	const MESSAGE_REQUEST_BODY_DATA: string;

	/**
	 * Alias for the {@link Message.request_headers} property. (The
	 * message's HTTP request headers.)
	 * @returns Alias for the {@link Message.request_headers} property. (The
	 * message's HTTP request headers.)
	 */
	const MESSAGE_REQUEST_HEADERS: string;

	/**
	 * Alias for the {@link Message.response_body} property. (The
	 * message's HTTP response body.)
	 * @returns Alias for the {@link Message.response_body} property. (The
	 * message's HTTP response body.)
	 */
	const MESSAGE_RESPONSE_BODY: string;

	/**
	 * Alias for the {@link Message.response_body_data} property. (The
	 * message's HTTP response body, as a #GBytes.)
	 * @returns Alias for the {@link Message.response_body_data} property. (The
	 * message's HTTP response body, as a #GBytes.)
	 */
	const MESSAGE_RESPONSE_BODY_DATA: string;

	/**
	 * Alias for the {@link Message.response_headers} property. (The
	 * message's HTTP response headers.)
	 * @returns Alias for the {@link Message.response_headers} property. (The
	 * message's HTTP response headers.)
	 */
	const MESSAGE_RESPONSE_HEADERS: string;

	/**
	 * Alias for the {@link Message.server_side} property. (%TRUE if
	 * the message was created by #SoupServer.)
	 * @returns Alias for the {@link Message.server_side} property. (%TRUE if
	 * the message was created by #SoupServer.)
	 */
	const MESSAGE_SERVER_SIDE: string;

	const MESSAGE_SITE_FOR_COOKIES: string;

	/**
	 * Alias for the {@link Message.status_code} property. (The
	 * message's HTTP response status code.)
	 * @returns Alias for the {@link Message.status_code} property. (The
	 * message's HTTP response status code.)
	 */
	const MESSAGE_STATUS_CODE: string;

	/**
	 * Alias for the {@link Message.tls_certificate} property. (The
	 * TLS certificate associated with the message, if any.)
	 * @returns Alias for the {@link Message.tls_certificate} property. (The
	 * TLS certificate associated with the message, if any.)
	 */
	const MESSAGE_TLS_CERTIFICATE: string;

	/**
	 * Alias for the {@link Message.tls_errors} property. (The
	 * verification errors on #SoupMessage:tls-certificate.)
	 * @returns Alias for the {@link Message.tls_errors} property. (The
	 * verification errors on #SoupMessage:tls-certificate.)
	 */
	const MESSAGE_TLS_ERRORS: string;

	/**
	 * Alias for the {@link Message.uri} property. (The message's
	 * #SoupURI.)
	 * @returns Alias for the {@link Message.uri} property. (The message's
	 * #SoupURI.)
	 */
	const MESSAGE_URI: string;

	/**
	 * Like {@link Soup.get.micro_version}, but from the headers used at
	 * application compile time, rather than from the library linked
	 * against at application run time.
	 * @returns Like {@link Soup.get.micro_version}, but from the headers used at
	 * application compile time, rather than from the library linked
	 * against at application run time.
	 */
	const MICRO_VERSION: number;

	/**
	 * Like {@link Soup.get.minor_version}, but from the headers used at
	 * application compile time, rather than from the library linked
	 * against at application run time.
	 * @returns Like {@link Soup.get.minor_version}, but from the headers used at
	 * application compile time, rather than from the library linked
	 * against at application run time.
	 */
	const MINOR_VERSION: number;

	/**
	 * Alias for the {@link Request.session} property, qv.
	 * @returns Alias for the {@link Request.session} property, qv.
	 */
	const REQUEST_SESSION: string;

	/**
	 * Alias for the {@link Request.uri} property, qv.
	 * @returns Alias for the {@link Request.uri} property, qv.
	 */
	const REQUEST_URI: string;

	/**
	 * Alias for the {@link Server.add_websocket_extension} property, qv.
	 * @returns Alias for the {@link Server.add_websocket_extension} property, qv.
	 */
	const SERVER_ADD_WEBSOCKET_EXTENSION: string;

	/**
	 * Alias for the deprecated {@link Server.async_context}
	 * property, qv.
	 * @returns Alias for the deprecated {@link Server.async_context}
	 * property, qv.
	 */
	const SERVER_ASYNC_CONTEXT: string;

	/**
	 * Alias for the {@link Server.https_aliases} property, qv.
	 * @returns Alias for the {@link Server.https_aliases} property, qv.
	 */
	const SERVER_HTTPS_ALIASES: string;

	/**
	 * Alias for the {@link Server.http_aliases} property, qv.
	 * @returns Alias for the {@link Server.http_aliases} property, qv.
	 */
	const SERVER_HTTP_ALIASES: string;

	/**
	 * Alias for the {@link Server.interface} property, qv.
	 * @returns Alias for the {@link Server.interface} property, qv.
	 */
	const SERVER_INTERFACE: string;

	/**
	 * Alias for the deprecated {@link Server.port} property, qv.
	 * @returns Alias for the deprecated {@link Server.port} property, qv.
	 */
	const SERVER_PORT: string;

	/**
	 * Alias for the {@link Server.raw_paths} property. (If %TRUE,
	 * percent-encoding in the Request-URI path will not be
	 * automatically decoded.)
	 * @returns Alias for the {@link Server.raw_paths} property. (If %TRUE,
	 * percent-encoding in the Request-URI path will not be
	 * automatically decoded.)
	 */
	const SERVER_RAW_PATHS: string;

	/**
	 * Alias for the {@link Server.remove_websocket_extension} property, qv.
	 * @returns Alias for the {@link Server.remove_websocket_extension} property, qv.
	 */
	const SERVER_REMOVE_WEBSOCKET_EXTENSION: string;

	/**
	 * Alias for the {@link Server.server_header} property, qv.
	 * @returns Alias for the {@link Server.server_header} property, qv.
	 */
	const SERVER_SERVER_HEADER: string;

	/**
	 * Alias for the {@link Server.ssl_cert_file} property, qv.
	 * @returns Alias for the {@link Server.ssl_cert_file} property, qv.
	 */
	const SERVER_SSL_CERT_FILE: string;

	/**
	 * Alias for the {@link Server.ssl_key_file} property, qv.
	 * @returns Alias for the {@link Server.ssl_key_file} property, qv.
	 */
	const SERVER_SSL_KEY_FILE: string;

	/**
	 * Alias for the {@link Server.tls_certificate} property, qv.
	 * @returns Alias for the {@link Server.tls_certificate} property, qv.
	 */
	const SERVER_TLS_CERTIFICATE: string;

	/**
	 * Alias for the {@link Session.accept_language} property, qv.
	 * @returns Alias for the {@link Session.accept_language} property, qv.
	 */
	const SESSION_ACCEPT_LANGUAGE: string;

	/**
	 * Alias for the {@link Session.accept_language_auto} property, qv.
	 * @returns Alias for the {@link Session.accept_language_auto} property, qv.
	 */
	const SESSION_ACCEPT_LANGUAGE_AUTO: string;

	/**
	 * Alias for the {@link Session.add_feature} property, qv.
	 * @returns Alias for the {@link Session.add_feature} property, qv.
	 */
	const SESSION_ADD_FEATURE: string;

	/**
	 * Alias for the {@link Session.add_feature_by_type} property, qv.
	 * @returns Alias for the {@link Session.add_feature_by_type} property, qv.
	 */
	const SESSION_ADD_FEATURE_BY_TYPE: string;

	/**
	 * Alias for the {@link Session.async_context} property, qv.
	 * @returns Alias for the {@link Session.async_context} property, qv.
	 */
	const SESSION_ASYNC_CONTEXT: string;

	/**
	 * Alias for the {@link Session.https_aliases} property, qv.
	 * @returns Alias for the {@link Session.https_aliases} property, qv.
	 */
	const SESSION_HTTPS_ALIASES: string;

	/**
	 * Alias for the {@link Session.http_aliases} property, qv.
	 * @returns Alias for the {@link Session.http_aliases} property, qv.
	 */
	const SESSION_HTTP_ALIASES: string;

	/**
	 * Alias for the {@link Session.idle_timeout} property, qv.
	 * @returns Alias for the {@link Session.idle_timeout} property, qv.
	 */
	const SESSION_IDLE_TIMEOUT: string;

	/**
	 * Alias for the {@link Session.local_address} property, qv.
	 * @returns Alias for the {@link Session.local_address} property, qv.
	 */
	const SESSION_LOCAL_ADDRESS: string;

	/**
	 * Alias for the {@link Session.max_conns} property, qv.
	 * @returns Alias for the {@link Session.max_conns} property, qv.
	 */
	const SESSION_MAX_CONNS: string;

	/**
	 * Alias for the {@link Session.max_conns_per_host} property, qv.
	 * @returns Alias for the {@link Session.max_conns_per_host} property, qv.
	 */
	const SESSION_MAX_CONNS_PER_HOST: string;

	/**
	 * Alias for the {@link Session.proxy_resolver} property, qv.
	 * @returns Alias for the {@link Session.proxy_resolver} property, qv.
	 */
	const SESSION_PROXY_RESOLVER: string;

	/**
	 * Alias for the {@link Session.proxy_uri} property, qv.
	 * @returns Alias for the {@link Session.proxy_uri} property, qv.
	 */
	const SESSION_PROXY_URI: string;

	/**
	 * Alias for the {@link Session.remove_feature_by_type} property,
	 * qv.
	 * @returns Alias for the {@link Session.remove_feature_by_type} property,
	 * qv.
	 */
	const SESSION_REMOVE_FEATURE_BY_TYPE: string;

	/**
	 * Alias for the {@link Session.ssl_ca_file} property, qv.
	 * @returns Alias for the {@link Session.ssl_ca_file} property, qv.
	 */
	const SESSION_SSL_CA_FILE: string;

	/**
	 * Alias for the {@link Session.ssl_strict} property, qv.
	 * @returns Alias for the {@link Session.ssl_strict} property, qv.
	 */
	const SESSION_SSL_STRICT: string;

	/**
	 * Alias for the {@link Session.ssl_use_system_ca_file} property,
	 * qv.
	 * @returns Alias for the {@link Session.ssl_use_system_ca_file} property,
	 * qv.
	 */
	const SESSION_SSL_USE_SYSTEM_CA_FILE: string;

	/**
	 * Alias for the {@link Session.timeout} property, qv.
	 * @returns Alias for the {@link Session.timeout} property, qv.
	 */
	const SESSION_TIMEOUT: string;

	/**
	 * Alias for the {@link Session.tls_database} property, qv.
	 * @returns Alias for the {@link Session.tls_database} property, qv.
	 */
	const SESSION_TLS_DATABASE: string;

	/**
	 * Alias for the {@link Session.tls_interaction} property, qv.
	 * @returns Alias for the {@link Session.tls_interaction} property, qv.
	 */
	const SESSION_TLS_INTERACTION: string;

	/**
	 * Alias for the {@link Session.user_agent} property, qv.
	 * @returns Alias for the {@link Session.user_agent} property, qv.
	 */
	const SESSION_USER_AGENT: string;

	/**
	 * Alias for the {@link Session.use_ntlm} property, qv.
	 * @returns Alias for the {@link Session.use_ntlm} property, qv.
	 */
	const SESSION_USE_NTLM: string;

	/**
	 * Alias for the {@link Session.use_thread_context} property, qv.
	 * @returns Alias for the {@link Session.use_thread_context} property, qv.
	 */
	const SESSION_USE_THREAD_CONTEXT: string;

	/**
	 * Alias for the {@link Socket.async_context} property. (The
	 * socket's #GMainContext.)
	 * @returns Alias for the {@link Socket.async_context} property. (The
	 * socket's #GMainContext.)
	 */
	const SOCKET_ASYNC_CONTEXT: string;

	/**
	 * Alias for the {@link Socket.non_blocking} property. (Whether
	 * or not the socket uses non-blocking I/O.)
	 * @returns Alias for the {@link Socket.non_blocking} property. (Whether
	 * or not the socket uses non-blocking I/O.)
	 */
	const SOCKET_FLAG_NONBLOCKING: string;

	/**
	 * Alias for the {@link Socket.is_server} property, qv.
	 * @returns Alias for the {@link Socket.is_server} property, qv.
	 */
	const SOCKET_IS_SERVER: string;

	/**
	 * Alias for the {@link Socket.local_address} property. (Address
	 * of local end of socket.)
	 * @returns Alias for the {@link Socket.local_address} property. (Address
	 * of local end of socket.)
	 */
	const SOCKET_LOCAL_ADDRESS: string;

	/**
	 * Alias for the {@link Socket.remote_address} property. (Address
	 * of remote end of socket.)
	 * @returns Alias for the {@link Socket.remote_address} property. (Address
	 * of remote end of socket.)
	 */
	const SOCKET_REMOTE_ADDRESS: string;

	/**
	 * Alias for the {@link Socket.ssl_creds} property.
	 * (SSL credential information.)
	 * @returns Alias for the {@link Socket.ssl_creds} property.
	 * (SSL credential information.)
	 */
	const SOCKET_SSL_CREDENTIALS: string;

	/**
	 * Alias for the {@link Socket.ssl_fallback} property.
	 * @returns Alias for the {@link Socket.ssl_fallback} property.
	 */
	const SOCKET_SSL_FALLBACK: string;

	/**
	 * Alias for the {@link Socket.ssl_strict} property.
	 * @returns Alias for the {@link Socket.ssl_strict} property.
	 */
	const SOCKET_SSL_STRICT: string;

	/**
	 * Alias for the {@link Socket.timeout} property. (The timeout
	 * in seconds for blocking socket I/O operations.)
	 * @returns Alias for the {@link Socket.timeout} property. (The timeout
	 * in seconds for blocking socket I/O operations.)
	 */
	const SOCKET_TIMEOUT: string;

	/**
	 * Alias for the {@link Socket.tls_certificate}
	 * property. Note that this property's value is only useful
	 * if the socket is for a TLS connection, and only reliable
	 * after some data has been transferred to or from it.
	 * @returns Alias for the {@link Socket.tls_certificate}
	 * property. Note that this property's value is only useful
	 * if the socket is for a TLS connection, and only reliable
	 * after some data has been transferred to or from it.
	 */
	const SOCKET_TLS_CERTIFICATE: string;

	/**
	 * Alias for the {@link Socket.tls_errors}
	 * property. Note that this property's value is only useful
	 * if the socket is for a TLS connection, and only reliable
	 * after some data has been transferred to or from it.
	 * @returns Alias for the {@link Socket.tls_errors}
	 * property. Note that this property's value is only useful
	 * if the socket is for a TLS connection, and only reliable
	 * after some data has been transferred to or from it.
	 */
	const SOCKET_TLS_ERRORS: string;

	/**
	 * Alias for the {@link Socket.trusted_certificate}
	 * property.
	 * @returns Alias for the {@link Socket.trusted_certificate}
	 * property.
	 */
	const SOCKET_TRUSTED_CERTIFICATE: string;

	/**
	 * Alias for the {@link Socket.use_thread_context} property. (Use
	 * {@link G.main_context_get_thread_default})
	 * @returns Alias for the {@link Socket.use_thread_context} property. (Use
	 * {@link G.main_context_get_thread_default})
	 */
	const SOCKET_USE_THREAD_CONTEXT: string;

	/**
	 * A macro that should be defined by the user prior to including
	 * libsoup.h. The definition should be one of the predefined libsoup
	 * version macros: %SOUP_VERSION_2_24, %SOUP_VERSION_2_26, ...
	 * 
	 * This macro defines the earliest version of libsoup that the package
	 * is required to be able to compile against.
	 * 
	 * If the compiler is configured to warn about the use of deprecated
	 * functions, then using functions that were deprecated in version
	 * %SOUP_VERSION_MIN_REQUIRED or earlier will cause warnings (but
	 * using functions deprecated in later releases will not).
	 * @returns A macro that should be defined by the user prior to including
	 * libsoup.h. The definition should be one of the predefined libsoup
	 * version macros: %SOUP_VERSION_2_24, %SOUP_VERSION_2_26, ...
	 * 
	 * This macro defines the earliest version of libsoup that the package
	 * is required to be able to compile against.
	 * 
	 * If the compiler is configured to warn about the use of deprecated
	 * functions, then using functions that were deprecated in version
	 * %SOUP_VERSION_MIN_REQUIRED or earlier will cause warnings (but
	 * using functions deprecated in later releases will not).
	 */
	const VERSION_MIN_REQUIRED: number;

}