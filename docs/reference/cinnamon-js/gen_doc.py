#!/usr/bin/python3
# coding: utf-8

# This parser starts by parsing all the javascript code, and representing each
# file/object/function as a python class. Afterwards, each object is gone
# through individually to produce the gtk-doc-friendly xml files
#
# The parsers uses the concept of state. At each line, the parser takes a
# particular state, and behaves accordingly. Conversely, the contents of the
# lines can cause the parser to change state.

# In normal text, the parser is in STATE_NORMAL, in which all it does is keep
# track of scopes and the number of '{' and '}' brackets. In a comment block
# that is not documentation, the parser takes STATE_COMMENT and ignores
# everything until we leave the comment.
#
# When the parser sees /**, it enters STATE_INIT, which tells us that the next
# line is important. The next line is usually in the form
#
# * function_name:
#
# or
#
# * #ObjectName:
#
# At this point, we create a JSFunction or JSObject object, and enter the next
# STATE_PROPERTY. Here the parser parses the properties of the form
#
# * @prop (type): description
#
# until it reaches something that is not a property (signified by two line
# breaks not followed by another property). Then the parser drops to
# STATE_DESCRIPTION, and reads every line and puts it into the object's
# description.
#
# STATE_DESCRIPTION continues until the comment block ends, or if it encounters
#
# * Returns (type): description
#
# Then it morphs into STATE_RETURN, and puts the remaining lines into the
# description of the return value. Alternatively, in the case of objects,
#
# * Inherits: Object.Class
#
# specifies the ancestor of an object. If the parser reads this line, it drops
# to STATE_COMMENT because there shouldn't be anything interesting afterwards.

import sys
import os
import re
from gen_lib import *

files = []
objects = {}

ROOT_DIR = os.path.abspath(os.path.dirname(sys.argv[0])) + '/../../../'
if len(sys.argv) > 1:
    ROOT_DIR = sys.argv[1]

if len(sys.argv) > 2:
    DEST_DIR = sys.argv[2]
    os.chdir(DEST_DIR)

JS_UI_DIR = os.path.join(ROOT_DIR, 'js/ui/')
JS_MISC_DIR = os.path.join(ROOT_DIR, 'js/misc/')

# Allow types like "object/string"
TYPE_REGEX = r'\w*\.?\w+/?\w*\.?\w*'
COMMENT_REGEX = re.compile(r'/\*([^*]|(\*[^/]))*\*+/')
RETURNS_REGEX = re.compile(r'^Returns\s*\(?(' + TYPE_REGEX + ')?\)?:(.*)')
INHERITS_REGEX = re.compile(r'^Inherits:\s*(' + TYPE_REGEX + ')\s*$')
PROPERTY_REGEX = re.compile(r'^@(\w+)\s*\(?(' + TYPE_REGEX + ')?\)?:(.*)')
FILE_NAME_REGEX = re.compile(r'FILE:\s*(\w+\.js):?')
SIGNAL_NAME_REGEX = re.compile(r'SIGNAL:\s*([\w-]+):?')
ENUM_NAME_REGEX = re.compile(r'ENUM:\s*(\w+):?')
FUNCTION_NAME_REGEX = re.compile(r'^(\w+):?\s*$')

OBJECT_NAME_REGEX = re.compile(r'^#(\w+):?\s*$')
FILE_REGEX = re.compile(r'\w*\.js')
COMMENT_START_REGEX = re.compile(r'^\s*\* ?')
BLOCK_START_REGEX = re.compile(r'^\s*/\*\*\s*$')
STRING_REGEX = re.compile(r'\'[^\']*\'|"[^"]*"')

STATE_NORMAL = 0
STATE_PROPERTY = 1
STATE_DESCRIPTION = 2
STATE_RETURN = 3
STATE_NAME = 4
STATE_INIT = 5
STATE_COMMENT = 6

################################################################################
################################################################################
##                        The legendary parse function                        ##
################################################################################
################################################################################
ui_files = [os.path.join(JS_UI_DIR, x) for x in os.listdir(JS_UI_DIR)]
ui_files.sort()

misc_files = [os.path.join(JS_MISC_DIR, x) for x in os.listdir(JS_MISC_DIR)]
misc_files.sort()

_files = ui_files + misc_files

for _file in _files:
    parts = _file.split("/")
    if not FILE_REGEX.match(parts[-1]):
        continue

    file_obj = open(_file, 'r', encoding="utf-8")

    curr_file = JSFile(parts[-2], parts[-1][:-3])

    files.append(curr_file)

    bracket_count = 0 # no. of '{' - no. of '}'

    # The current object - it is either the top-level file or the JSObject we
    # are parsing.
    curr_obj = curr_file

    # The current item being processed, either the top-level file, description
    # of the object or a function
    curr_item = curr_file

    # The current property, if any
    curr_prop = None

    state = STATE_NORMAL

    scope = ''

    for line in file_obj:
        ################################################################################
        #                       Process all unimportant comments                       #
        ################################################################################

        # Strip ' * ' at the beginning of each long comment block
        if state == STATE_PROPERTY    or \
           state == STATE_DESCRIPTION or \
           state == STATE_RETURN      or \
           state == STATE_INIT:

            line = COMMENT_START_REGEX.sub('', line)
            if len(line) > 0 and line[0] == '/':
                state = STATE_NORMAL
                curr_item = None
                continue

        # If we are in a (useless) comment, skip unless comment ends in this row
        elif state == STATE_COMMENT:
            if line.find('*/') == -1:
                continue
            else:
                line = line[line.find('*/') + 2:]
                state = STATE_NORMAL

        # In normal cases, strip comments if necessary, unless it is the
        # beginning of a doc block, in which case we set the STATE_INIT state
        else:
            if '//' in line:
                line = line[:line.find(r'//')]

            if '/*' in line:
                # Strip all in-line comments, eg. 'asdf /* asdf */ asdf'
                line = COMMENT_REGEX.sub('', line)
                if BLOCK_START_REGEX.match(line):
                    state = STATE_INIT
                    continue
                if '/*' in line:
                    line = line[:line.find(r'/*')]
                    state = STATE_COMMENT

################################################################################
#                         Process actual useful content                        #
################################################################################

        if state == STATE_INIT:
            if FILE_NAME_REGEX.match(line) and bracket_count == 0:
                curr_item = curr_file
                curr_obj = curr_file
                objects[curr_file.name] = curr_file
                state = STATE_PROPERTY

            elif OBJECT_NAME_REGEX.match(line) and bracket_count == 0:
                curr_item = JSObject(OBJECT_NAME_REGEX.match(line).group(1))
                curr_obj = curr_item
                objects[curr_file.name + '.' + curr_obj.name] = curr_item
                curr_file.add_object(curr_item)
                state = STATE_PROPERTY

            elif FUNCTION_NAME_REGEX.match(line) and \
                ((bracket_count == 1 and curr_obj != curr_file) or \
                 (bracket_count == 0 and curr_obj == curr_file)):
                curr_item = JSFunction(FUNCTION_NAME_REGEX.match(line).group(1))
                curr_obj.add_function(curr_item)
                state = STATE_PROPERTY

            elif SIGNAL_NAME_REGEX.match(line) and \
                    (bracket_count > 0 and curr_obj != curr_file):
                curr_item = JSSignal(SIGNAL_NAME_REGEX.match(line).group(1))
                curr_obj.add_signal(curr_item)
                state = STATE_PROPERTY

            elif ENUM_NAME_REGEX.match(line) and bracket_count == 0:
                curr_item = JSEnum(ENUM_NAME_REGEX.match(line).group(1))
                objects[curr_file.name + '.' + curr_item.name] = curr_item
                curr_file.add_enum(curr_item)
                state = STATE_PROPERTY
            else:
                state = STATE_COMMENT

            continue

        if state == STATE_PROPERTY:
            if len(line.strip()) == 0:
                if curr_prop is not None:
                    curr_prop = None
                    continue
                else:
                    # Ignore blank lines if nothing has happened yet
                    continue

            prop = PROPERTY_REGEX.match(line)

            if prop:
                curr_prop = JSProperty(*prop.groups())
                curr_item.add_property(curr_prop)
            else:
                if curr_prop:
                    curr_prop.append_description(line)
                else:
                    # The next block will parse this description properly
                    state = STATE_DESCRIPTION

        if state == STATE_DESCRIPTION:
            if RETURNS_REGEX.match(line):
                state = STATE_RETURN
                curr_prop = JSProperty('Returns', *RETURNS_REGEX.match(line).groups())
                curr_item.set_return(curr_prop)
            elif INHERITS_REGEX.match(line):
                # Anything after the inherit line shouldn't be there
                state = STATE_COMMENT
                curr_item.set_inherit(INHERITS_REGEX.match(line).group(1))
            else:
                curr_item.append_description(line)
            continue

        if state == STATE_RETURN:
            curr_prop.append_description(line)

        # Here state should be STATE_NORMAL. It might be, in fact,
        # STATE_COMMENT, since the line ends with /*, and the state is set to
        # STATE_COMMENT for preparation of the next line. However, the
        # remaining of the line should be treated as a normal line. If we are
        # genuinely inside a comment, we would have `continue`ed at the
        # beginning.
        if state == STATE_NORMAL or state == STATE_COMMENT:
            # the "scope" variable will be last updated before we enter the
            # scope, so will be the "function thing() {}" or "thing.prototype =
            # {" line. We use this to check if we are parsing the right thing.
            if bracket_count == 0:
                scope = line

            # Don't count the brackets inside strings. STRING_REGEX recognizes
            # ' and " but doesn't know if they are esacped. So replace away all
            # escaped quotes
            line = STRING_REGEX.sub('', line.replace("\\'", "").replace('\\"', ''))

            bracket_count += line.count('{') - line.count('}')

            if bracket_count == 0:
                # Cinnamon-style objects and Lang.Class objects
                if curr_obj.orig_name + '.prototype' in scope or \
                   re.match(curr_obj.orig_name + r'\s*=\s*Lang\.Class', scope):
                    curr_obj = curr_file
                    curr_item = curr_file

################################################################################
################################################################################
##                               Generate the XML                             ##
################################################################################
################################################################################

write_chapters_file(files)

try:
    os.mkdir('ui')
except OSError:
    pass

try:
    os.mkdir('misc')
except OSError:
    pass


for _file in files:
    for obj in _file.objects:
        create_file(obj)
