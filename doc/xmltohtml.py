#!/usr/bin/env python2
#-*- indent-tabs-mode: nil-*-

import sys
import io
import os
import xml.etree.ElementTree as ET

def loadVarRow(item, elementName, link):
    html = []
    html.extend(["<tr>",
                 "<td><code class=\"prop-table-type\">%s</code></td>" % item[1],
                 "<td>"])
    if link:
        html.extend(["<a href=\"#%s.%s\">" % (elementName, item[0])])
        
    html.extend(["<code class=\"prop-table-name\">%s</code>" % item[0]])

    if link:
        html.extend(["</a>"])
    html.extend(["</td>",
                 "</tr>"])
    return html

def loadFunctionRow(item, elementName, link):
    html = []
    html.extend(["<tr>",
                 "<td><code class=\"prop-table-return\">%s</code></td>" % item[3].get("type"),
                 "<td>"])
    if link:
        html.extend(["<a href=\"#%s.%s\">" % (elementName, item[0])])

    html.extend(["<code class=\"prop-table-name\">%s</code>" % item[0]])

    if link:
        html.extend(["</a>"])

    html.extend(["</td>",
                 "<td class=\"prop-table-arg\">("])

    for prop in item[2]:
        html.extend(["<code class=\"prop-table-arg-type\">%s</code>" % prop.get("type"),
                     "<code class=\"prop-table-arg-name\">%s,</code>"% prop.get("name"),
                     "</td></tr><tr><td /><td /><td class=\"prop-table-arg\">&nbsp"])
    if len(item[2]) > 0:
        del html[-1] # Delete the previous end line
        html[-1] = html[-1].replace(",", "") # Delete the comma
    html.extend([")</td>",
                 "</tr>"])

    return html

def loadElement(element, elementName):
    html = []

    # Load short description
    for child in element:
        if child.tag == "short-description":
            if child.text:
                html.extend(["<p class=\"short-description\">",
                             child.text.replace("\n", "<br />"),
                             "</p>"])

    # Load function and variable lists
    var_list = []
    for child in element:
        if child.tag == "prop":
            var_list.append([child.get("name"), child.get("type"), child.text])

    functions_list = []
    for child in element:
        if child.tag == "function":
            functions_list.append([child.findtext("name"), child.findtext("description").replace("\n", "<br />"), child.findall("prop"), child.find("return")])


    # Load synopsis
    if len(functions_list) > 0 or  len(var_list) > 0:
        html.extend(["<h2>Synopsis</h2>"]);
        html.extend(["<table class=\"prop-table\">"])
        for item in functions_list:
            html.extend(loadFunctionRow(item, elementName, True))
            html.extend(["<tr class=\"prop-table-line-break\" />"])
        for item in var_list:
            html.extend(loadVarRow(item, elementName, True))
            html.extend(["<tr class=\"prop-table-line-break\" />"])
        html.extend(["</table>"])

    # Load long description
    for child in element:
        if child.tag == "description":
            if child.text:
                html.extend(["<h2>Description</h2>"]);
                html.extend(["<p class=\"description\">",
                             child.text.replace("\n", "<br />"),
                             "</p>"])
                break

    # Load individual functions
    if len(functions_list) > 0:
        html.extend(["<h2>Details</h2>"])
        for item in functions_list:
            # Header
            html.extend(["<br /><a id=\"%s.%s\" class=\"individual-prop-header\">%s ()</a>" % (elementName, item[0], item[0])])

            # Table showing format of function (similar to that in function list)
            html.extend(["<table class=\"prop-table\">"])
            html.extend(loadFunctionRow(item, elementName, False))
            html.extend(["</table>"])

            # Description of the function
            html.extend(["<p class=\"prop-description\">%s</p>" % item[1]])

            # List arguments and relevant descriptions
            html.extend(["<table class=\"prop-arg-table\">"])
            if len(item[2]) > 0:
                for prop in item[2]:
                    html.extend(["<tr>",
                                 "<td class=\"prop-arg-name\">",
                                 prop.get("name"),
                                 "</td><td class=\"prop-arg-description\">",
                                 prop.text,
                                 "</td></tr>"])
            if item[3].text:
                html.extend(["<tr>",
                             "<td class=\"prop-return-name\">",
                             "Return",
                             "</td><td class=\"prop-return-description\">",
                             item[3].text,
                             "</td></tr>"])
            html.extend(["</table>"])

            # Add separator
            html.extend(["<hr class=\"prop-prop-separator\" />"])

        for item in var_list:
            html.extend(["<br /><a id=\"%s.%s\" class=\"individual-prop-header\">%s</a>" % (elementName, item[0], item[0])])

            # Table showing the variable (similar to that in function list)
            html.extend(["<table class=\"prop-table\">"])
            html.extend(loadVarRow(item, elementName, False))
            html.extend(["</table>"])

            # Description of the variable
            html.extend(["<p class=\"prop-description\">%s</p>" % item[2]])

            # Add separator
            html.extend(["<hr class=\"prop-prop-separator\" />"])

        # Remove last separator
        del html[-1]

    return html

def convertXMLtoHTML(xml):
    tree = ET.parse(xml)
    root = tree.getroot()

    html = []
    _name = root.find("name").text
    name = _name[0].upper() + _name[1:-3]

    # Standard HTML heading
    html.extend(["<!DOCTYPE html>",
                 "<html>",
                 "<head>",
                 "<title>%s</title>" % name,
                 "<link rel=\"stylesheet\" type=\"text/css\" href=\"style.css\" />\n</head>",
                 "<body>",
                 "<p class=\"page-header\">%s</p>" % name])

    html.extend(loadElement(root, name))

    objects_list = []
    for child in root:
        if child.tag == "object":
            objects_list.append(child)

    for item in objects_list:
        # Add separator
        html.extend(["<hr class=\"obj-obj-separator\" />"])
        # Show header
        html.extend(["<h2>%s.%s</h2>" % (name, item.findtext("name"))])
        html.extend(loadElement(item, name + "." + item.findtext("name")))

    # Standard HTML ending
    html.extend(["</body>",
                 "</html>"])

    return "\n".join(html)
