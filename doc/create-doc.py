#!/usr/bin/env python
#-*- indent-tabs-mode: nil-*-

import sys
import os
import shutil
import jstoxml
import xmltohtml
import xmltomd

CURRDIR = os.path.abspath(os.path.dirname(sys.argv[0])) + "/"
JS_DIR = CURRDIR + "../js/ui/"
XML_DIR = CURRDIR + "output-xml/"
HTML_DIR = CURRDIR + "output-html/"
MD_DIR = CURRDIR + "../../Cinnamon.wiki/"
MD_NAMES = "API reference [%s]"
MD_INDEX = "API-reference"

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

    errors = [] # Store the files that failed to parse
                # Removing them in loop will break the loop
    for _file in files:
        print "Parsing " + _file
        __file = _file[:-3]

        try: 
            xml = jstoxml.convertJStoXML(JS_DIR + __file + ".js")
            xml.write(XML_DIR + __file + ".xml")

            html = xmltohtml.convertXMLtoHTML(XML_DIR + __file + ".xml")
            open(HTML_DIR + __file + ".html", "w").write(html)

            md = xmltomd.convertXMLtoMD(XML_DIR + __file + ".xml")
            open(MD_DIR + MD_NAMES % _file + ".md", "w").write(md)
        except:
            print "Error parsing " + _file + ". Skipping"
            errors.append(_file)

    shutil.copy2('style.css', HTML_DIR)

    html = []
    md = []
    html.extend(["<!DOCTYPE html>",
                 "<html>",
                 "<head>",
                 "<title>Cinnamon Documentation Index</title>",
                 "<link rel=\"stylesheet\" type=\"text/css\" href=\"style.css\" />\n</head>",
                 "<body>",
                 "<p class=\"page-header\">Cinnamon JS Documentation</p>",
                 "<ul class=\"index-page-list\">"])
    md.extend(["# Files"])

    for _file in files:
        if _file not in errors:
            html.extend(["<li><a href=\"%s.html\">%s</a></li>" % (_file[:-3], _file)])
            md.append("- [%s](../%s)" % (_file, MD_NAMES.replace(" ", "-") % _file))

    html.extend(["</ul>",
                 "</body>",
                 "</html>"])
    open(HTML_DIR + "index.html", "w").write("\n".join(html))
    open(MD_DIR + MD_INDEX + ".md", "w").write("\n".join(md))

