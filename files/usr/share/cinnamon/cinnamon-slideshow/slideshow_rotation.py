import os
import random
import mimetypes
import sys


def parse_source(source):
    """Split a "type://path" source into (type, expanded_path). "" -> (None, "")."""
    if source and "://" in source:
        stype, path = source.split("://", 1)
        return stype, os.path.expanduser(path)
    return None, ""


def usable_image(mime, mime_types):
    return mime in mime_types


def list_directory_images(path, mime_types):
    # Sorted absolute paths of the valid image files directly in `path`.
    out = []
    try:
        if os.path.isdir(path):
            for name in sorted(os.listdir(path)):
                full = os.path.join(path, name)
                if not os.path.isfile(full):
                    continue
                if usable_image(mimetypes.guess_type(full)[0], mime_types):
                    out.append(full)
    except OSError as e:
        print("slideshow: cannot read image folder '%s': %s" % (path, e),
              file=sys.stderr, flush=True)
        return []
    return out


class PerMonitorRotation:
    """per-monitor slideshow state

    monitors: ordered (left-to-right) list of dicts:
        {"id": <connector>, "folder": <source key>, "images": [uri,...], "current": <uri or None>}

    A monitor's `current` is its resume marker (its currently-displayed image).
    """

    def __init__(self, monitors, random_order):
        self._random_order = random_order
        self._order = [m["id"] for m in monitors]
        self._by_id = {m["id"]: m for m in monitors}
        self._rr = 0
        self._groups = {}   # folder -> {"images": [...], "cursor": int, "members": [id,...]}
        for m in monitors:
            g = self._groups.setdefault(
                m["folder"], {"images": m["images"], "cursor": 0, "members": []})
            g["members"].append(m["id"])

    @property
    def random_order(self):
        return self._random_order

    @random_order.setter
    def random_order(self, value):
        value = bool(value)
        if value == self._random_order:
            return
        self._random_order = value
        if not value:
            # Only the sequential path maintains a group's cursor, so it is
            # stale after any time spent in random mode. Resume from what is on
            # screen rather than from wherever sequential order left off.
            for g in self._groups.values():
                if g["images"]:
                    g["cursor"] = self._aligned_cursor(g)

    def set_folder_images(self, folder, images):
        g = self._groups.get(folder)
        if g is None:
            return
        g["images"] = images
        g["cursor"] = self._aligned_cursor(g) if images else 0

    def folders(self):
        """The distinct folders being rotated."""
        return list(self._groups)

    def _aligned_cursor(self, g):
        """Where sequential order resumes: one past the furthest-along member of
        the group, so several monitors sharing a folder don't collide."""
        images = g["images"]
        idxs = [images.index(self._by_id[i]["current"]) for i in g["members"]
                if self._by_id[i]["current"] in images]
        return (max(idxs) + 1) % len(images) if idxs else 0

    def initial(self, force_ids=()):
        """Assignments to apply now. Keeps a valid `current`, so a re-setup (a
        hotplug, a config edit, a restart, another monitor's slideshow being
        switched on) does not jump the wallpaper.

        Ids in @force_ids move on one step instead. The caller forces only a
        stream that was already rotating and has been pointed at a new folder:
        that change belongs at the start of the first interval, not the end of
        it. Random picks avoid whatever is already on screen, so with two or
        more images the picture always changes.

        Returns [(id, uri), ...] for monitors that need a write."""
        out = []
        for g in self._groups.values():
            images = g["images"]
            if not images:
                continue
            if self._random_order:
                displayed = {self._by_id[i]["current"] for i in g["members"]
                             if self._by_id[i]["current"] in images}
                for mid in g["members"]:
                    if mid not in force_ids and self._by_id[mid]["current"] in images:
                        continue
                    uri = self._pick(images, displayed)
                    self._by_id[mid]["current"] = uri
                    displayed.add(uri)
                    out.append((mid, uri))
            else:
                nxt = self._aligned_cursor(g)
                for mid in g["members"]:
                    current = self._by_id[mid]["current"]
                    if mid not in force_ids and current in images:
                        continue
                    uri = images[nxt]
                    nxt = (nxt + 1) % len(images)
                    # nxt starts after the highest index any member is showing,
                    # so with several monitors on one folder it can wrap back
                    # onto this monitor's own picture, leaving a stream that
                    # was just switched on looking like nothing happened. Step
                    # past it.
                    if uri == current and len(images) > 1:
                        uri = images[nxt]
                        nxt = (nxt + 1) % len(images)
                    self._by_id[mid]["current"] = uri
                    out.append((mid, uri))
                g["cursor"] = nxt
        return out

    def advance_all(self):
        """Advance every monitor one step (round-robin order). Returns
        [(id, uri), ...] for each monitor that changed."""
        out = []
        for _ in range(len(self._order)):
            result = self.tick()
            if result is not None:
                out.append(result)
        return out

    def tick(self):
        """Advance the next monitor (round-robin). Returns (id, uri) or None."""
        if not self._order:
            return None
        mid = self._order[self._rr]
        self._rr = (self._rr + 1) % len(self._order)
        m = self._by_id[mid]
        g = self._groups[m["folder"]]
        images = g["images"]
        if not images:
            return None
        if self._random_order:
            displayed = {self._by_id[i]["current"] for i in g["members"]}
            uri = self._pick(images, displayed)
        else:
            uri = images[g["cursor"]]
            g["cursor"] = (g["cursor"] + 1) % len(images)
        m["current"] = uri
        return (mid, uri)

    def _pick(self, images, displayed):
        candidates = [i for i in images if i not in displayed]
        if not candidates:
            candidates = images   # best-effort: too few images to avoid a collision
        return random.choice(candidates)
