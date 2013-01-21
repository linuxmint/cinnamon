#!/usr/bin/env python
#-*- indent-tabs-mode: nil-*-

import sys
import io
import os
import xml.etree.ElementTree as ET

def loadVarRow(item, elementName, prefix, link):
    html = []
    html.extend(["<tr>",
                 "<td><code class=\"%s-var-table-type\">%s</code></td>" % (prefix, item[1]),
                 "<td>"])
    if link:
        html.extend(["<a href=\"#%s.%s\">" % (elementName, item[0])])
        
    html.extend(["<code class=\"%s-var-table-name\">%s</code>" % (prefix, item[0])])

    if link:
        html.extend(["</a>"])
    html.extend(["</td>",
                 "</tr>"])
    return html

def loadFunctionRow(item, elementName, prefix, link):
    html = []
    html.extend(["<tr>",
                 "<td><code class=\"%s-func-table-return\">%s</code></td>" % (prefix, item[3].get("type")),
                 "<td>"])
    if link:
        html.extend(["<a href=\"#%s.%s\">" % (elementName, item[0])])

    html.extend(["<code class=\"%s-func-table-name\">%s</code>" % (prefix, item[0])])

    if link:
        html.extend(["</a>"])

    html.extend(["</td>",
                 "<td class=\"%s-func-table-arg\">(" % prefix])

    for prop in item[2]:
        html.extend(["<code class=\"%s-func-table-arg-type\">%s</code>" % (prefix, prop.get("type")),
                     "<code class=\"%s-func-table-arg-name\">%s,</code>"% (prefix, prop.get("name")),
                     "</td></tr><tr><td /><td /><td class=\"%s-func-table-arg\">&nbsp" % prefix])
    if len(item[2]) > 0:
        del html[-1] # Delete the previous end line
        html[-1] = html[-1].replace(",", "") # Delete the comma
    html.extend([")</td>",
                 "</tr>"])

    return html

def loadElement(element, elementName, prefix):
    html = []

    for child in element:
        if child.tag == "description":
            if child.text:
                html.extend(["<p class=\"%s-description\">" % prefix,
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

    # Load variables table
    if len(var_list) > 0:
        html.extend(["<p class=\"%s-var-header\">Variables</p>" % prefix,
                     "<table class=\"%s-var-table\">" % prefix])
        for item in var_list:
            html.extend(loadVarRow(item, elementName, prefix, True))
            html.extend(["<tr class=\"%s-var-table-line-break\" />" % prefix])
        html.extend(["</table>"])

    # Load function table
    if len(functions_list) > 0:
        html.extend(["<p class=\"%s-func-header\">Functions </p>" % prefix,
                     "<table class=\"%s-func-table\">"% prefix])
        for item in functions_list:
            html.extend(loadFunctionRow(item, elementName, prefix, True))
            html.extend(["<tr class=\"%s-func-table-line-break\" />" % prefix])
        html.extend(["</table>"])

    # Load individual variables
    if len(var_list) > 0:
        html.extend(["<p class=\"%s-var-header\">Variables</p>" % prefix])
        for item in var_list:
            html.extend(["<br /><a id=\"%s.%s\" class=\"%s-individual-var-header\">%s</a>" % (elementName, item[0], prefix, item[0])])

            # Table showing the variable (similar to that in function list)
            html.extend(["<table class=\"%s-var-table\">" % prefix])
            html.extend(loadVarRow(item, elementName, prefix, False))
            html.extend(["</table>"])

            # Description of the variable
            html.extend(["<p class=\"%s-var-description\">%s</p>" % (prefix, item[2])])

    # Insert separator
    if len(var_list) > 0 and len(functions_list) > 0:
        html.extend(["<hr class=\"var-func-separator\" />"])

    # Load individual functions
    if len(functions_list) > 0:
        html.extend(["<p class=\"%s-func-header\">Functions </p>" % prefix])

        for item in functions_list:
            # Header
            html.extend(["<br /><a id=\"%s.%s\" class=\"%s-individual-func-header\">%s</a>" % (elementName, item[0], prefix, item[0])])

            # Table showing format of function (similar to that in function list)
            html.extend(["<table class=\"%s-func-table\">" % prefix])
            html.extend(loadFunctionRow(item, elementName, prefix, False))
            html.extend(["</table>"])

            # Description of the function
            html.extend(["<p class=\"%s-func-description\">%s</p>" % (prefix, item[1])])

            # List arguments and relevant descriptions
            html.extend(["<table class=\"%s-func-arg-table\">" % prefix])
            if len(item[2]) > 0:
                for prop in item[2]:
                    html.extend(["<tr>",
                                 "<td class=\"%s-func-arg-name\">" % prefix,
                                 prop.get("name"),
                                 "</td><td class=\"%s-func-arg-description\">" % prefix,
                                 prop.text,
                                 "</td></tr>"])
            if item[3].text:
                html.extend(["<tr>",
                             "<td class=\"%s-func-return-name\">" % prefix,
                             "Return",
                             "</td><td class=\"%s-func-return-description\">" % prefix,
                             item[3].text,
                             "</td></tr>"])
            html.extend(["</table>"])


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

    html.extend(loadElement(root, name, "root"))

    objects_list = []
    for child in root:
        if child.tag == "object":
            objects_list.append(child)

    for item in objects_list:
        # Show header
        html.extend(["<h2>%s.%s</h2>" % (name, item.findtext("name"))])
        html.extend(loadElement(item, name + "." + item.findtext("name"), "obj"))

    # Standard HTML ending
    html.extend(["</body>",
                 "</html>"])

    return "\n".join(html)
