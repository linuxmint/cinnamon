#!/usr/bin/python3

import json
import tempfile
import unittest
import xml.etree.ElementTree

import cldr2json


class TestParseSingleKey(unittest.TestCase):
    def test_ascii(self):
        self.assertEqual(cldr2json.parse_single_key("a"), "a")

    def test_nonascii(self):
        self.assertEqual(cldr2json.parse_single_key("Æ"), "Æ")

    def test_twochars(self):
        self.assertEqual(cldr2json.parse_single_key("ԵՒ"), "ԵՒ")

    def test_decode(self):
        self.assertEqual(cldr2json.parse_single_key("\\u{200D}"), "\u200d")

    def test_decode_threechars(self):
        self.assertEqual(cldr2json.parse_single_key("ज\\u{94D}ञ"), "ज\u094Dञ")


class TestParseRow(unittest.TestCase):
    def test_parse_row(self):
        xml_string = """
        <keyMap>
            <map iso="D01" to="a" longPress="à â % æ á ä ã å ā ª"/> <!-- Q -->
            <map iso="D02" to="z"/> <!-- W -->
            <map iso="D03" to="e" longPress="é è ê ë % ę ė ē"/>
            <map iso="D04" to="r"/>
            <map iso="D05" to="t"/>
            <map iso="D06" to="y" longPress="% ÿ"/>
            <map iso="D07" to="u" longPress="ù û % ü ú ū"/>
            <map iso="D08" to="i" longPress="î % ï ì í į ī"/>
            <map iso="D09" to="o" longPress="ô œ % ö ò ó õ ø ō º"/>
            <map iso="D10" to="p"/>
            <map iso="C01" to="q"/> <!-- A -->
            <map iso="C02" to="s"/>
            <map iso="C03" to="d"/>
            <map iso="C04" to="f"/>
            <map iso="C05" to="g"/>
            <map iso="C06" to="h"/>
            <map iso="C07" to="j"/>
            <map iso="C08" to="k"/>
            <map iso="C09" to="l"/>
            <map iso="C10" to="m"/> <!-- ; -->
            <map iso="B01" to="w"/> <!-- Z -->
            <map iso="B02" to="x"/>
            <map iso="B03" to="c" longPress="ç ć č"/>
            <map iso="B04" to="v"/>
            <map iso="B05" to="b"/>
            <map iso="B06" to="n"/>
            <map iso="B07" to="&apos;" longPress="‘ ’ ‹ ›"/> <!-- M -->
            <map iso="A02" to=","/> <!-- (key to left of space) -->
            <map iso="A03" to=" "/> <!-- space -->
            <map iso="A04" to="." longPress="# ! , ? - : ' @"/> <!-- (key to right of space) -->
        </keyMap>
        """
        xml_tree = xml.etree.ElementTree.XML(xml_string)
        json = [[
                 ['a', 'à', 'â', '%', 'æ', 'á', 'ä', 'ã', 'å', 'ā', 'ª'],
                 ['z'],
                 ['e', 'é', 'è', 'ê', 'ë', '%', 'ę', 'ė', 'ē'],
                 ['r'],
                 ['t'],
                 ['y', '%', 'ÿ'],
                 ['u', 'ù', 'û', '%', 'ü', 'ú', 'ū'],
                 ['i', 'î', '%', 'ï', 'ì', 'í', 'į', 'ī'],
                 ['o', 'ô', 'œ', '%', 'ö', 'ò', 'ó', 'õ', 'ø', 'ō', 'º'],
                 ['p']
                ], [
                 ['q'],
                 ['s'],
                 ['d'],
                 ['f'],
                 ['g'],
                 ['h'],
                 ['j'],
                 ['k'],
                 ['l'],
                 ['m']
                ], [
                 ['w'],
                 ['x'],
                 ['c', 'ç', 'ć', 'č'],
                 ['v'],
                 ['b'],
                 ['n'],
                 ["'", '‘', '’', '‹', '›']
                ], [
                 [','],
                 [' '],
                 ['.', '#', '!', ',', '?', '-', ':', "'", '@']
                ]]
        self.assertEqual(cldr2json.parse_rows(xml_tree), json)


class TestConvertXml(unittest.TestCase):
    def test_convert_xml(self):
        xml_string = """<?xml version="1.0" encoding="UTF-8" ?>
        <!DOCTYPE keyboard SYSTEM "../dtd/ldmlKeyboard.dtd">
        <keyboard locale="fr-t-k0-android">
            <version platform="4.4" number="$Revision: 11914 $"/>
            <names>
                <name value="French"/>
            </names>
            <keyMap>
                <map iso="D01" to="a" longPress="à â % æ á ä ã å ā ª"/> <!-- Q -->
            </keyMap>
            <keyMap modifiers="shift caps">
                <map iso="D01" to="A" longPress="À Â % Æ Á Ä Ã Å Ā ª"/> <!-- Q -->
            </keyMap>
            <keyMap modifiers="opt">
                <map iso="D01" to="1" longPress="¹ ½ ⅓ ¼ ⅛"/> <!-- Q  base=a -->
            </keyMap>
            <keyMap modifiers="opt+shift">
                <map iso="D01" to="~"/> <!-- Q  base=a -->
            </keyMap>
        </keyboard>
        """
        xml_tree = xml.etree.ElementTree.XML(xml_string)
        json = {
          "locale": "fr",
          "name": "French",
          "levels": [
            {
              "level": "",
              "mode": "default",
              "rows": [
                [
                  ['a', 'à', 'â', '%', 'æ', 'á', 'ä', 'ã', 'å', 'ā', 'ª'],
                ]
              ]
            },
            {
              "level": "shift",
              "mode": "latched",
              "rows": [
                [
                  ['A', 'À', 'Â', '%', 'Æ', 'Á', 'Ä', 'Ã', 'Å', 'Ā', 'ª'],
                ]
              ]
            },
            {
              "level": "opt",
              "mode": "locked",
              "rows": [
                [
                  ["1", "¹", "½", "⅓", "¼", "⅛"],
                ]
              ]
            },
            {
              "level": "opt+shift",
              "mode": "locked",
              "rows": [
                [
                  ["~"],
                ]
              ]
            }
          ]
        }
        self.assertEqual(cldr2json.convert_xml(xml_tree), json)


class TestConvertFile(unittest.TestCase):
    def test_fr(self):
        outdir = tempfile.mkdtemp()
        cldr2json.convert_file("test/data/fr-t-k0-android.xml", outdir)
        with open("test/data/fr.json", encoding="utf-8") as expected_json_fd:
            expected_json = json.load(expected_json_fd)
        with open(outdir + "/fr.json", encoding="utf-8") as actual_json_fd:
            actual_json = json.load(actual_json_fd)
        self.assertEqual(expected_json, actual_json)


class TestLocaleToXKB(unittest.TestCase):
    def test_simple(self):
        self.assertEqual(cldr2json.locale_to_xkb("fr", "French"),
                         "fr")

    def test_fallback(self):
        self.assertEqual(cldr2json.locale_to_xkb("nb", "Norwegian Bokmål"),
                         "no")

    def test_fallback2(self):
        self.assertEqual(cldr2json.locale_to_xkb("km", "Khmer"),
                         "kh")

    def test_override(self):
        self.assertEqual(cldr2json.locale_to_xkb("en-GB",
                                                 "English Great Britain"),
                         "uk")


class LoadXKBMapplings(unittest.TestCase):
    def test_dictionnary(self):
        self.assertIsInstance(cldr2json.load_xkb_mappings(), dict)

    def test_mapping(self):
        mapping = cldr2json.load_xkb_mappings()
        self.assertEqual(mapping["French"], "fr")


if __name__ == '__main__':
    unittest.main()
