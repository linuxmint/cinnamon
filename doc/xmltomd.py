#!/usr/bin/env python
#-*- indent-tabs-mode: nil-*-

import sys
import io
import os
import xml.etree.ElementTree as ET

def loadVarRow(item, elementName, link):
    md = "`%s` | " % item[2]
    if link:
        md += "["

    md += "**%s**" % item[0]

    if link:
        md += "](#%s)" % item[1]

    return md

def loadFunctionRow(item, elementName, link):
    md = "`%s` | " % item[4].get("type")
    if link:
        md += "["

    md += "**%s**" % item[0]

    if link:
        md += "](#%s)" % item[1]

    md += " | "

    for prop in item[3]:
        md += "`%s` %s, " % (prop.get("type"), prop.get("name"))
    if len(item[3]) > 0:
        md = md.strip(", ") # Delete the comma
    else:
        md += "_None_"

    return md

names = {}

def loadElement(element, elementName):
    md = []

    # Load short description
    for child in element:
        if child.tag == "short-description":
            if child.text:
                md.append(child.text.replace("\n", "<br />"))

    # Load function and variable lists
    var_list = []
    for child in element:
        if child.tag == "prop":
            name = child.get("name")
            link_name = name.lower()
            if name in names:
                link_name += "-%d" % names[name]
                names[name] += 1
            else:
                names[name] = 1
            var_list.append([name, link_name, child.get("type"), child.text])

    functions_list = []
    for child in element:
        if child.tag == "function":
            name = child.findtext("name")
            link_name = name
            if name in names:
                link_name += "-%d" % names[name]
                names[name] += 1
            else:
                names[name] = 1
            functions_list.append([name, link_name, child.findtext("description").replace("\n", "<br />"), child.findall("prop"), child.find("return")])


    # Load synopsis
    if len(functions_list) > 0 or len(var_list) > 0:
        md.append("### Synopsis");
        if len(functions_list) > 0:
            md.extend(["Returntype | Name | Arguments", "----: | ---- | ----"])
            for item in functions_list:
                md.append(loadFunctionRow(item, elementName, True))

        if len(var_list) > 0:
            md.extend(["", "Type | Name", "----: | ----"])
            for item in var_list:
                md.append(loadVarRow(item, elementName, True))

    # Load long description
    for child in element:
        if child.tag == "description":
            if child.text:
                md.extend(["### Description"]);
                md.extend([child.text])
                break

    # Load individual functions
    if len(functions_list) > 0:
        md.extend(["### Details"])
        for item in functions_list:
            md.append("#### %s()" % item[0])
            md.append(item[2])

            # List arguments and relevant descriptions
            if len(item[3]) > 0:
                md.extend(["", "Type | Name | Description", "----: | ---- | ----"])
                for prop in item[3]:
                    md.append("`%s` | %s | %s" % (prop.get("type"), prop.get("name"), prop.text))
            if item[4].text:
                md.append(item[4].text)

        for item in var_list:
            md.append("#### %s" % item[0])
            md.append(item[3])

    return md

def convertXMLtoMD(xml):
    tree = ET.parse(xml)
    root = tree.getroot()

    md = []
    _name = root.find("name").text
    name = _name[0].upper() + _name[1:-3]

    # heading
    md.append("# %s" % name)

    md.extend(loadElement(root, name))

    objects_list = []
    for child in root:
        if child.tag == "object":
            objects_list.append(child)

    for item in objects_list:
        # Add separator
        #html.extend(["<hr class=\"obj-obj-separator\" />"])
        # Show header
        md.extend(["## %s.%s" % (name, item.findtext("name"))])
        md.extend(loadElement(item, name + "." + item.findtext("name")))

    return "\n".join(md)
