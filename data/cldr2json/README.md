cldr2json
=========

This script converts Unicode CLDR android keyboard layouts to JSON usable by
GNOME Shell.

CLDR keyboard layouts can be found at
<http://www.unicode.org/Public/cldr/latest/keyboards.zip>


Usage
=====

    ./cldr2json <input file or directory> <output directory>

example:

    ./cldr2json cldr/keyboards/android/ json_layouts/


Keyboard layout mapping
=======================

Unicode CLDR layout identifiers are language codes, while XKB layout
identifiers are... something else. The mapping between the two currently uses
heuristic based on the layout descriptions, in this order:

- if the CLDR layout description matches an XKB layout description, chose its
  XKB identifier
- if one word of the CLDR layout description matches an XKB layout
  description, chose its XKB identifier
- if the CLDR layout description matches one word of an XKB layout description,
  chose its XKB identifier

That doesn't always work. For instance it fails for "en" language, that should
match "us" XKB identifier. For such cases, there is a mapping in
LOCALE_TO_XKB_OVERRIDES at the top of the script. If you discover a weird
mapping of if you get a "failed to find XKB mapping for <locale>" warning then
please consider adding an override there.

