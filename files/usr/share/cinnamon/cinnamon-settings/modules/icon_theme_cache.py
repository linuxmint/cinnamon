def read_icon_cache(path):
    """Read valid theme icon entries and report whether the cache was damaged."""
    icon_paths = {}
    damaged = False

    with open(path, "r", encoding="utf-8", errors="replace") as cache_file:
        for line in cache_file:
            entry = line.strip()
            if "\ufffd" in entry or any(ord(char) < 32 or ord(char) == 127 for char in entry):
                damaged = True
                continue

            if ":" not in entry:
                damaged = True
                continue

            theme_name, icon_path = entry.split(":", 1)
            if not theme_name or not icon_path:
                damaged = True
                continue

            icon_paths[theme_name] = icon_path

    return icon_paths, damaged
