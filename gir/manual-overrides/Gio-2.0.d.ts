declare namespace imports.gi.Gio {
	interface IDBusProxy {
		disconnectSignal(id: number): void;
	}

	type ChangedVariable = `changed::${string}`;
	interface ISettings {
		/**
		 * The "changed" signal is emitted when a key has  	potentially changed.
		 * You should call one of the g_settings_get() calls to check the new
		 * value.
		 * 
		 * This signal supports detailed connections.  You can connect to the
		 * detailed signal "changed::x" in order to only receive callbacks
		 * when key "x" changes.
		 * 
		 * Note that #settings only emits this signal if you have read #key at
		 * least once while a signal handler was already connected for #key.
		 */
		connect(event: ChangedVariable, callback: (...args: any[]) => void): number;
	}

	interface IDBus {
		readonly session: ReturnType<typeof bus_get_sync>
		readonly system: ReturnType<typeof bus_get_sync>

		get: typeof bus_get
		get_finish: typeof bus_get_finish
		get_sync: typeof bus_get_sync

		own_name: typeof bus_own_name
		own_name_on_connection: typeof bus_own_name_on_connection
		unown_name: typeof bus_unown_name

		watch_name: typeof bus_unwatch_name
		watch_name_on_connection: typeof bus_watch_name_on_connection
		unwatch_name: typeof bus_unwatch_name
	}

	const DBus: IDBus

	function makeProxyWrapper<T>(interfaceXml: string):
		(bus: DBusConnection, name: string, object_path: string, callback?: imports.gi.Gio.AsyncReadyCallback | null | undefined, flags?: DBusProxyFlags) => DBusProxy & T

}
