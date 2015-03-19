#!/usr/bin/env python2
#-*- indent-tabs-mode: nil-*-


import sys
import io
import os
import xml.etree.ElementTree as ET

# Constant objects
ITEM_TYPE_OBJECT = 0
ITEM_TYPE_FUNCTION = 1
ITEM_TYPE_FILE = 2

# Reads a file and return the lines (as an array)
def readFile(filename):
    _file = open(filename, "r")
    content = _file.readlines()
    _file.close()
    return content

# Gets a "function block", i.e. those starting and ending with "{" and "}",
# e.g. a function/prototype declaration
#
# Returns [start, end], where "start" and "end" are the line numbers of the start and end of the block 
def getFunctionBlock(lines, init_line = 0):
    brackets = 0 # Number of "{" - Number of "}"
    start = 0 # Starting line number of the block
    end = 0 # Ending line number of the block

    i = init_line
    try:
        while "{" not in lines[i]:
            i = i + 1
        # Now we are at the first line of the block
        start = i
        brackets = brackets + lines[i].count("{") - lines[i].count("}")
    except:
        start = i-1

    try:
        while brackets > 0:
            i = i + 1
            brackets = brackets + lines[i].count("{") - lines[i].count("}")
        end = i
    except:
        end = i - 1

    return [start,end]

def getCommentBlock(lines, init_line = 0):
    i = init_line
    try:
        while "/**" not in lines[i]:
            i = i + 1
    except:
        i = i - 1
    
    start = i
    try:
        while "*/" not in lines[i]:
            i = i + 1
    except:
        i = i - 1

    end = i
    return [start,end]

def parseCommentBlock(lines):
    try:
        del lines[0], lines[-1] # Strip first and last line

        itemType = None
        itemName = ""
        itemProps = []
        itemDescription = ""

        # Parse the file
        # Strip the "       * " part
        for i in range(len(lines)):
            lines[i] = lines[i].lstrip()
            lines[i] = lines[i][1:]
            lines[i] = lines[i].lstrip()
            lines[i] = lines[i].replace("\n", "")

        nameLine = lines[0].strip()
        if nameLine.find("#") == 0:
            itemType = ITEM_TYPE_OBJECT
            itemName = nameLine[1:]
        elif nameLine.find("FILE:") == 0:
            itemType = ITEM_TYPE_FILE
            itemName = nameLine[5:].lstrip()
        else:
            itemType = ITEM_TYPE_FUNCTION
            itemName = nameLine

        itemName = itemName.replace(":","") # Remove the : at the end of definition

        del lines[0]

        # Item properties
        propName = ""
        i = 0
        while len(lines) > 0 and len(lines[0].strip()) != 0:
            line = lines[0]
            if ("@" in line):
                line = line[1:] # Strip "@" sign
                propName = line[:line.find(":")].encode()
                line = line[line.find(":")+1:]
                itemProps.append([propName, ""])
            itemProps[-1][1] = itemProps[-1][1] + line + " "
            del lines[0]

        # Item description
        if len(lines) > 0:
            del lines[0] # Remove separating linebreak

            while len(lines) > 0 and lines[0].find("Returns") == -1:
                itemDescription = itemDescription + " " + lines[0].strip()
                del lines[0]

            itemDescription = itemDescription.replace("  ", "\n\n")

        # Return data
        returnData = " ".join(lines)
        if len(returnData.strip()) > 0:
            returnData = returnData.strip()[7:] # Strip "Returns"
            returnData = returnData.split(":") # Split into return type and 
            returnData[0] = returnData[0].strip() # Strip whitespaces again
            returnData[0] = returnData[0][1:-1] # Remove brackets
            
            returnData[1] = returnData[1].strip() # Strip whitespaces
        else:
            returnData = ["void", None]


        return [itemType, itemName, itemProps, itemDescription, returnData]
    except Exception:
        return [None, None, None, None, None]

def addVariables(element, variables):
    for i in variables:
        _name = i[0]
        _desc = i[1]
        hasType = "(" in _name
        if hasType:
            propName = _name[:_name.find("(")].strip()
            propType = _name[_name.find("(") + 1: _name.rfind(")")]
        else:
            propName = _name
            propType = ""
        prop = ET.SubElement(element, 'prop', {'name': propName, 'type': propType})
        prop.text = _desc

def createFunctionElement(element, itemName, itemProps, itemDescription, itemReturn):
    name = ET.SubElement(element, 'name')
    name.text = itemName

    desc = ET.SubElement(element, 'description')
    desc.text = itemDescription

    addVariables(element, itemProps)

    # Set the return
    ret = ET.SubElement(element, 'return', {'type': itemReturn[0]})
    if itemReturn[1]:
        ret.text = itemReturn[1]

    return element

def convertJStoXML(filename):
    lines = readFile(filename)
    shortFileName = filename[filename.rfind("/")+1:]
    root = ET.Element('file')
    name = ET.SubElement(root, 'name')
    name.text = shortFileName

    xmlTree = ET.ElementTree(root)
    
    while (len(lines)> 0):
        [start, end] = getCommentBlock(lines)
        if start == end:
            break
        newlines = lines[start:end+1]

        [itemType, itemName, itemProps, itemDescription, itemReturn] = parseCommentBlock(newlines)
        if itemType == ITEM_TYPE_FILE:
            # Check that this refers to the current file
            if itemName != shortFileName:
                del lines[:end]
                continue;

            desc = ET.SubElement(root, 'description')
            desc.text = itemDescription

            addVariables(root, itemProps)
        if itemType == ITEM_TYPE_FUNCTION:
            # Check that this refers to the correct function
            _start = end
            [_start, _end] = getFunctionBlock(lines, _start)
            if "function" + itemName + "(" not in lines[_start].replace(" ",""):
                del lines[:_end]
                continue

            element = ET.SubElement(root, 'function')
            createFunctionElement(element, itemName, itemProps, itemDescription, itemReturn)
            

        if itemType == ITEM_TYPE_OBJECT:
            element = ET.SubElement(root, 'object')

            name = ET.SubElement(element, 'name')
            name.text = itemName

            desc = ET.SubElement(element, 'description')
            desc.text = itemDescription

            addVariables(element, itemProps)

            # Find range of object declaration
            _start = end
            [_start, _end] = getFunctionBlock(lines, _start)

            while lines[_start].strip().find(itemName + ".prototype") != 0:
                _start = _end
                [_start, _end] = getFunctionBlock(lines, _start)

            inlines = lines[_start:_end+1]
            end = _end

            # Parse the functions inside
            while len(inlines) > 0:
                [inStart, inEnd] = getCommentBlock(inlines)
                if inStart == inEnd:
                    break
                newLines = inlines[inStart:inEnd+1]
                [itemType, itemName, itemProps, itemDescription, itemReturn] = parseCommentBlock(newLines)
                if itemType == ITEM_TYPE_FUNCTION:
                    __start = inStart
                    [__start, __end] = getFunctionBlock(inlines, __start)
                    if itemName + ":function(" not in inlines[__start].replace(" ", ""):
                        del inlines[:__end]
                        continue
                    subelement = ET.SubElement(element, 'function')
                    createFunctionElement(subelement, itemName, itemProps, itemDescription, itemReturn)

                del inlines[:inEnd]
        del lines[:end]

    return xmlTree
