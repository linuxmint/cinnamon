#!/usr/bin/python3

import errno
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.uuid = "test-spice"
        self.source = self.root / "source" / self.uuid
        self.source.mkdir(parents=True)
        self.install = self.root / "installed"
        self.install.mkdir()
        self.destination = self.install / self.uuid

        # These tests exercise file installation without desktop settings.
        self.harvester = harvester.Harvester.__new__(harvester.Harvester)
        self.harvester.install_folder = str(self.install)
        self.harvester.install_folders = (str(self.install),)
        self.harvester.spices_directories = self.harvester.install_folders
        self.harvester.index_cache = {self.uuid: {"last_edited": 1234567890}}
        self.harvester.themes = False
        self.harvester.actions = False
        self.harvester.spice_type = "applet"
        self.addCleanup(patch.stopall)
        patch.object(harvester, "locale_inst", str(self.root / "locale")).start()

    def write_package(self, version):
        (self.source / "metadata.json").write_text(json.dumps({"name": version}))
        (self.source / "payload").write_text(version)
        if self.harvester.actions:
            (self.source.parent / f"{self.uuid}.nemo_action").write_text(version + " launcher")

    def install_package(self):
        self.harvester._install_from_folder(str(self.source), str(self.source.parent),
                                            self.uuid, from_spices=True)

    def snapshot(self, directory):
        return {str(p.relative_to(directory)): p.read_bytes()
                for p in directory.rglob("*") if p.is_file()}

    def fail_payload_copy(self, source, destination, *args, **kwargs):
        if Path(source).name == "payload":
            raise OSError(errno.ENOSPC, "No space left on device", str(destination))
        return self.copyfile(source, destination, *args, **kwargs)

    def test_copy_failure_preserves_installed_package(self):
        self.write_package("old")
        self.install_package()
        before = self.snapshot(self.install)
        self.write_package("new")
        self.copyfile = shutil.copyfile
        with patch.object(shutil, "copyfile", self.fail_payload_copy):
            with self.assertRaises(OSError):
                self.install_package()
        self.assertEqual(self.snapshot(self.install), before)

    def test_failed_first_install_leaves_no_partial_package(self):
        self.write_package("new")
        self.copyfile = shutil.copyfile
        with patch.object(shutil, "copyfile", self.fail_payload_copy):
            with self.assertRaises(OSError):
                self.install_package()
        self.assertEqual(list(self.install.iterdir()), [])

    def test_invalid_metadata_preserves_installed_package(self):
        self.write_package("old")
        self.install_package()
        before = self.snapshot(self.install)
        self.write_package("new")
        (self.source / "metadata.json").write_text("{")
        with self.assertRaises(ValueError):
            self.install_package()
        self.assertEqual(self.snapshot(self.install), before)

    def test_upgrade_replaces_package_and_keeps_unrelated_files(self):
        self.write_package("old")
        self.install_package()
        (self.destination / "obsolete").write_text("old file")
        (self.install / "unrelated").write_text("keep me")
        self.write_package("new")
        self.install_package()
        self.assertEqual((self.destination / "payload").read_text(), "new")
        self.assertFalse((self.destination / "obsolete").exists())
        self.assertEqual((self.install / "unrelated").read_text(), "keep me")
        self.assertEqual(json.loads((self.destination / "metadata.json").read_text()),
                         {"name": "new", "last-edited": 1234567890})
        self.assertEqual(sorted(p.name for p in self.install.iterdir()),
                         [self.uuid, "unrelated"])

    def test_theme_update_keeps_legacy_copy_until_success(self):
        self.harvester.themes = True
        legacy = self.root / "legacy-themes"
        old_theme = legacy / self.uuid
        old_theme.mkdir(parents=True)
        (old_theme / "payload").write_text("old")
        self.harvester.install_folders += (str(legacy),)
        self.write_package("new")
        (self.source / "metadata.json").unlink()
        self.copyfile = shutil.copyfile
        with patch.object(shutil, "copyfile", self.fail_payload_copy):
            with self.assertRaises(OSError):
                self.install_package()
        self.assertTrue((old_theme / "payload").exists())
        self.assertEqual((old_theme / "payload").read_text(), "old")
        self.assertFalse(self.destination.exists())
        self.install_package()
        self.assertFalse(old_theme.exists())
        self.assertEqual((self.destination / "payload").read_text(), "new")
        self.assertEqual(json.loads((self.destination / "metadata.json").read_text()),
                         {"last-edited": 1234567890})

    def test_action_copy_failure_preserves_launcher_and_support_files(self):
        self.harvester.actions = True
        self.write_package("old")
        self.install_package()
        before = self.snapshot(self.install)
        self.write_package("new")
        self.copyfile = shutil.copyfile
        with patch.object(shutil, "copyfile", self.fail_payload_copy):
            with self.assertRaises(OSError):
                self.install_package()
        self.assertEqual(self.snapshot(self.install), before)

    def test_theme_update_keeps_installation_reachable_through_legacy_path(self):
        self.harvester.themes = True
        legacy = self.root / "legacy-themes"
        legacy.symlink_to(self.install, target_is_directory=True)
        self.harvester.install_folders += (str(legacy),)
        self.write_package("old")
        self.install_package()
        self.write_package("new")
        self.install_package()
        self.assertTrue((self.destination / "payload").exists())
        self.assertEqual((self.destination / "payload").read_text(), "new")
        self.assertEqual((legacy / self.uuid / "payload").read_text(), "new")

    def test_action_upgrade_preserves_other_files_in_shared_directories(self):
        self.harvester.actions = True
        self.write_package("old")
        self.install_package()
        (self.destination / "obsolete").write_text("old")
        shared = self.install / "shared"
        shared.mkdir()
        (shared / "keep").write_text("keep")
        incoming = self.source.parent / "shared"
        incoming.mkdir()
        (incoming / "new").write_text("new")
        self.write_package("new")
        self.install_package()
        self.assertEqual((self.install / f"{self.uuid}.nemo_action").read_text(), "new launcher")
        self.assertEqual((self.destination / "payload").read_text(), "new")
        self.assertFalse((self.destination / "obsolete").exists())
        self.assertEqual(self.snapshot(shared), {"keep": b"keep", "new": b"new"})

    def test_replacement_failure_restores_action_and_support_files(self):
        self.harvester.actions = True
        self.write_package("old")
        self.install_package()
        before = self.snapshot(self.install)
        self.write_package("new")
        rename = os.rename

        def fail_new_launcher(source, destination):
            if (Path(destination) == self.install / f"{self.uuid}.nemo_action"
                    and Path(source).read_text() == "new launcher"):
                raise OSError(errno.EIO, "Input/output error", str(destination))
            return rename(source, destination)

        with patch.object(os, "rename", fail_new_launcher):
            with self.assertRaises(OSError):
                self.install_package()
        self.assertEqual(self.snapshot(self.install), before)

    def test_rollback_failure_keeps_recoverable_original_files(self):
        self.harvester.actions = True
        self.write_package("old")
        self.install_package()
        self.write_package("new")
        rename = os.rename

        def fail_publication_and_restore(source, destination):
            source = Path(source)
            destination = Path(destination)
            if destination == self.install / f"{self.uuid}.nemo_action":
                raise OSError(errno.EIO, "Input/output error", str(destination))
            if destination == self.destination and (source / "payload").read_text() == "old":
                raise OSError(errno.EIO, "Input/output error", str(destination))
            return rename(source, destination)

        with patch.object(os, "rename", fail_publication_and_restore):
            with self.assertRaisesRegex(RuntimeError, "Backup files are in ") as error:
                self.install_package()
        recovered = [p for p in self.install.rglob("payload") if p.read_text() == "old"]
        launchers = [p for p in self.install.rglob("*.nemo_action")
                     if p.read_text() == "old launcher"]
        self.assertEqual(len(recovered), 1)
        self.assertEqual(len(launchers), 1)
        self.assertIn(str(recovered[0].parent.parent), str(error.exception))


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python3"))
    with tempfile.TemporaryDirectory() as directory:
        with patch.dict(os.environ, {"XDG_STATE_HOME": directory}):
            from cinnamon import harvester
            unittest.main()
