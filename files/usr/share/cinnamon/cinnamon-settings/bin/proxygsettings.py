#!/usr/bin/python3

# -*- coding: utf-8 -*-
#
# Copyright 2011-2012 Canonical Ltd.
# Copyright 2014 Erik Devriendt
#
# This program is free software: you can redistribute it and/or modify it
# under the terms of the GNU General Public License version 3, as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranties of
# MERCHANTABILITY, SATISFACTORY QUALITY, or FITNESS FOR A PARTICULAR
# PURPOSE.  See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along
# with this program.  If not, see <http://www.gnu.org/licenses/>.
#
# In addition, as a special exception, the copyright holders give
# permission to link the code of portions of this program with the
# OpenSSL library under certain conditions as described in each
# individual source file, and distribute linked combinations
# including the two.
# You must obey the GNU General Public License in all respects
# for all of the code used other than OpenSSL.  If you modify
# file(s) with this exception, you may extend this exception to your
# version of the file(s), but you are not obligated to do so.  If you
# do not wish to do so, delete this exception statement from your
# version.  If you delete this exception statement from all source
# files in the program, then also delete it here.
"""Retrieve the proxy configuration from Gnome."""

import subprocess


GSETTINGS_CMDLINE = "gsettings list-recursively org.gnome.system.proxy"
CANNOT_PARSE_WARNING = "Cannot parse gsettings value: %r"


def parse_proxy_hostspec(hostspec):
    """Parse the hostspec to get protocol, hostname, username and password."""
    protocol = None
    username = None
    password = None
    hostname = hostspec

    if "://" in hostname:
        protocol, hostname = hostname.split("://", 1)
    if "@" in hostname:
        username, hostname = hostname.rsplit("@", 1)
        if ":" in username:
            username, password = username.split(":", 1)
    return protocol, hostname, username, password


def proxy_url_from_settings(scheme, gsettings):
    """Build and return the proxy URL for the given scheme, based on the gsettings."""
    protocol, host, username, pwd = parse_proxy_hostspec(gsettings[scheme + ".host"])
    # if the user did not set a proxy for a type (http/https/ftp) we should
    # return None to ensure that it is not used
    if host == '':
        return None

    port = gsettings[scheme + ".port"]

    if scheme == "http" and gsettings["http.use-authentication"]:
        username = gsettings["http.authentication-user"]
        pwd = gsettings["http.authentication-password"]

    proxy_url = ""
    if username is not None:
        if pwd is not None:
            proxy_url = "%s:%s@%s:%d" % (username,pwd,host,port)
        else:
            proxy_url = "%s@%s:%d" % (username,host,port)
    else:
        proxy_url =  "%s:%d" % (host,port)

    if protocol is not None:
        proxy_url = "%s://%s" % (protocol, proxy_url)

    return proxy_url

def get_proxy_settings():
    """Parse the proxy settings as returned by the gsettings executable
       and return a dictionary with a proxy URL for each scheme ."""
    output = subprocess.check_output(GSETTINGS_CMDLINE.split()).decode("utf-8")
    gsettings = {}
    base_len = len("org.gnome.system.proxy.")
    # pylint: disable=E1103
    for line in output.split("\n"):
        try:
            path, key, value = line.split(" ", 2)
        except ValueError:
            continue
        if value.startswith("'"):
            parsed_value = value[1:-1]
        elif value.startswith(('[', '@')):
            parsed_value = value
        elif value in ('true', 'false'):
            parsed_value = (value == 'true')
        elif value.isdigit():
            parsed_value = int(value)
        else:
            print(CANNOT_PARSE_WARNING % value)
            parsed_value = value
        relative_key = (path + "." + key)[base_len:]
        gsettings[relative_key] = parsed_value
    mode = gsettings["mode"]
    if mode == "none":
        settings = {}
    elif mode == "manual":
        settings = {}
        for scheme in ["http", "https"]:
            scheme_settings = proxy_url_from_settings(scheme, gsettings)
            if scheme_settings is not None:
                settings[scheme] = scheme_settings
    else:
        # If mode is automatic the PAC javascript should be interpreted
        # on each request. That is out of scope so it's ignored for now
        settings = {}

    return settings
