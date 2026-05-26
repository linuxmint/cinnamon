class Backend:
    """Backends deliver results via on_done(result) rather than returning
    them, so DBus-backed implementations can run without blocking the UI."""

    def screenshot(self, include_pointer, on_done):
        on_done(None)

    def screenshot_window(self, include_pointer, include_shadow, on_done):
        on_done(None)

    def screenshot_window_by_id(self, window_id, include_pointer, include_shadow, on_done):
        on_done(None)

    def screenshot_area(self, x, y, w, h, include_pointer, on_done):
        on_done(None)

    def flash_area(self, x, y, w, h):
        pass

    def select_area(self, on_done):
        on_done(None)

    def select_window(self, on_done):
        on_done(None)
