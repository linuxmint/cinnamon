#!/usr/bin/env perl

# Copyright © 2011 Red Hat, Inc
#
# This library is free software; you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public
# License as published by the Free Software Foundation; either
# version 2 of the licence, or (at your option) any later version.
#
# This library is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public
# License along with this library; if not, see <http://www.gnu.org/licenses/>.
#
# Author: Kalev Lember <kalevlember@gmail.com>


if (@ARGV != 2) {
    die "Usage: data-to-c.pl <filename> <variable>\n";
}

$file = $ARGV[0];

open (FILE, $file) || die "Cannot open $file: $!\n";

printf ("const char %s[] = \"", $ARGV[1]);
while (my $line = <FILE>) {
    foreach my $c (split //, $line) {
        printf ("\\x%02x", ord ($c));
    }
}
print "\";\n";

close (FILE);
