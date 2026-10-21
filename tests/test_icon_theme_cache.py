import sys
import tempfile
import unittest
from pathlib import Path

MODULES = (
    Path(__file__).resolve().parents[1]
    / "files/usr/share/cinnamon/cinnamon-settings/modules"
)
sys.path.insert(0, str(MODULES))

from icon_theme_cache import read_icon_cache


class ReadIconCacheTest(unittest.TestCase):
    def test_skips_corrupt_lines_and_preserves_colons_in_paths(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cache = Path(temp_dir) / "icons"
            cache.write_bytes(
                b"valid:icons/valid.png\n"
                b"missing-separator\n"
                b"\xffinvalid:icons/invalid.png\n"
                b"binary\x00theme:icons/binary.png\n"
                b"colon:path:with:colons.png\n"
                b":missing-name\n"
                b"empty-path:\n"
            )

            icon_paths, damaged = read_icon_cache(cache)

        self.assertTrue(damaged)
        self.assertEqual(
            icon_paths,
            {
                "valid": "icons/valid.png",
                "colon": "path:with:colons.png",
            },
        )

    def test_valid_cache_is_not_marked_damaged(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cache = Path(temp_dir) / "icons"
            cache.write_text("theme:icons/folder.svg\n", encoding="utf-8")

            icon_paths, damaged = read_icon_cache(cache)

        self.assertFalse(damaged)
        self.assertEqual(icon_paths, {"theme": "icons/folder.svg"})


if __name__ == "__main__":
    unittest.main()
