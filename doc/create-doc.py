#!/usr/bin/env python
#-*- indent-tabs-mode: nil-*-

import sys
import os
import shutil
import jstoxml
import xmltohtml

CURRDIR = os.path.abspath(os.path.dirname(sys.argv[0])) + "/"
JS_DIR = CURRDIR + "../js/ui/"
XML_DIR = CURRDIR + "output-xml/"
HTML_DIR = CURRDIR + "output-html/"

if __name__ == "__main__":
    files = os.listdir(JS_DIR)
    files.sort()
    try:
        os.mkdir(XML_DIR)
    except Exception:
        pass

    try:
        os.mkdir(HTML_DIR)
    except Exception:
        pass

    for _file in files:
        print "Parsing " + _file
        _file = _file[:-3]

        xml = jstoxml.convertJStoXML(JS_DIR + _file + ".js")
        xml.write(XML_DIR + _file + ".xml")

        html = xmltohtml.convertXMLtoHTML(XML_DIR + _file + ".xml")
        open(HTML_DIR + _file + ".html", "w").write(html)

    shutil.copy2('style.css', HTML_DIR)

    html = []
    html.extend(["<!DOCTYPE html>",
                 "<html>",
                 "<head>",
                 "<title>Cinnamon Documentation Index</title>",
                 "<link rel=\"stylesheet\" type=\"text/css\" href=\"style.css\" />\n</head>",
                 "<body>",
                 "<p class=\"page-header\">Cinnamon JS Documentation</p>",
                 "<ul class=\"index-page-list\">"])

    for _file in files:
        html.extend(["<li><a href=\"%s.html\">%s</a></li>" % (_file[:-3], _file)])

    html.extend(["</ul>",
                 "</body>",
                 "</html>"])
    open(HTML_DIR + "index.html", "w").write("\n".join(html))

