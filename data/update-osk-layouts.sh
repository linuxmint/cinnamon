#!/bin/env bash

CLDR_LAYOUTS_TARBALL="http://www.unicode.org/Public/cldr/latest/keyboards.zip"

WORKDIR=".osk-layout-workbench"
CLDR2JSON="cldr2json/cldr2json.py"
SRCDIR="$WORKDIR/keyboards/android"
DESTDIR="osk-layouts"
GRESOURCE_FILE="cinnamon-osk-layouts.gresource.xml"
TMP_GRESOURCE_FILE=".$GRESOURCE_FILE.tmp"

cd `dirname $0`

# Ensure work/dest dirs
rm -rf $WORKDIR
mkdir -p $WORKDIR
mkdir -p "osk-layouts"

# Download stuff on the work dir
pushd $WORKDIR
gio copy $CLDR_LAYOUTS_TARBALL .
unzip keyboards.zip
popd

# Transform to JSON files
$CLDR2JSON $SRCDIR $DESTDIR

# Generate new gresources xml file
cat >$TMP_GRESOURCE_FILE <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<gresources>
  <gresource prefix="/org/cinnamon/osk-layouts">
EOF

for f in $DESTDIR/*.json
do
    echo "    <file>$(basename $f)</file>" >>$TMP_GRESOURCE_FILE
done

cat >>$TMP_GRESOURCE_FILE <<EOF
    <file>emoji.json</file>
    <file>keyboard-caps-lock-filled-symbolic.svg</file>
    <file>keyboard-enter-symbolic.svg</file>
    <file>keyboard-hide-symbolic.svg</file>
    <file>keyboard-layout-filled-symbolic.svg</file>
    <file>keyboard-shift-filled-symbolic.svg</file>
  </gresource>
</gresources>
EOF

# Rewrite old gresources xml
mv $TMP_GRESOURCE_FILE $GRESOURCE_FILE
