# -*- mode: makefile; coding: utf-8 -*-
# Copyright © 2002 Colin Walters <walters@debian.org>
# Description: A class for GNOME packages; sets up gconf variables, etc
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License as
# published by the Free Software Foundation; either version 2, or (at
# your option) any later version.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

# TODO: rewrite to use $(cdbs_make_curbuilddir)

_cdbs_scripts_path ?= /usr/lib/cdbs
_cdbs_rules_path ?= /usr/share/cdbs/1/rules
_cdbs_class_path ?= /usr/share/cdbs/1/class

ifndef _cdbs_class_gnome
_cdbs_class_gnome = 1

include $(_cdbs_class_path)/autotools.mk$(_cdbs_makefile_suffix)

DEB_MAKE_ENVVARS += GCONF_DISABLE_MAKEFILE_SCHEMA_INSTALL=1

# for dh_desktop
CDBS_BUILD_DEPENDS_class_gnome ?= debhelper
CDBS_BUILD_DEPENDS += , $(CDBS_BUILD_DEPENDS_class_gnome)

# Most GNOME upstreams don't bother to fix this.
clean::
	cd $(DEB_BUILDDIR) && \
	  rm -f intltool-extract intltool-merge intltool-update po/.intltool-merge-cache; \
	  if test -d doc; then find doc -name '*.omf.out' -exec rm -f \{\} \; ; fi; \
	  if test -d help; then find help -name '*.omf.out' -exec rm -f \{\} \; ; fi

# debhelper.mk targets, so silently ignored if debhelper.mk not included
$(patsubst %,binary-install/%,$(DEB_PACKAGES)) :: binary-install/%:
	$(if $(wildcard /usr/bin/dh_gconf),dh_gconf -p$(cdbs_curpkg) $(DEB_DH_GCONF_ARGS))
	$(if $(wildcard /usr/bin/dh_icons),dh_icons -p$(cdbs_curpkg) $(DEB_DH_ICONS_ARGS))

endif
