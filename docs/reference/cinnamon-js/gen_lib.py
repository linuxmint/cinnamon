#!/usr/bin/python3
# coding: utf-8
# Dear future self,
#
# You're looking at this file because
# the parse function finally broke.
#
# It's not fixable. You have to rewrite it.
# Sincerely, past self
#
# Also, it's probably at least
# 2013. Did you ever take
# that trip to Iceland?

import re

def get_type_link(typ, file):
    from gen_doc import objects

    if typ == '':
        return "void"
    else:
        if typ in objects:
            return "cinnamon-js-" + objects[typ].prefix
        elif file.name + "." + typ in objects:
            return "cinnamon-js-" + objects[file.name + "." + typ].prefix
        elif typ.endswith("s") and typ[:-1] in objects:
            return "cinnamon-js-" + objects[typ[:-1]].prefix
        elif typ.endswith("s") and file.name + "." + typ[:-1] in objects:
            return "cinnamon-js-" + objects[file.name + "." + typ[:-1]].prefix
        elif typ.startswith("Gio"):
            return typ.replace("Gio.", "G")
        elif typ.startswith("GLib"):
            return typ.replace("GLib.", "G")
        else:
            return typ.replace('.', '')

def markup(line, obj):
    line = re.sub('@(\w*)', '<code>\g<1></code>', line)
    line = re.sub('`([^`]*)`', '<code>\g<1></code>', line)
    line = re.sub('\*\*([^*]*)\*\*', '<emphasis role="strong">\g<1></emphasis>', line)
    line = re.sub('\*([^*]*)\*', '<emphasis>\g<1></emphasis>', line)

    def format_type_link(match):
        res = match.group(1)
        return '<link linkend="{link}"><code>{name}</code></link>'.format(
            link = get_type_link(res, obj.file),
            name = res)

    line = re.sub('#(([\w]*\.)?[\w]+)', format_type_link, line)

    def format_ext_link(match):
        if match.group(1):
            full = match.group(1) + match.group(3)
        else:
            full = match.group(3)

        if match.group(4):
            full += match.group(4)

        owner = match.group(1)
        if owner:
            owner = owner[:-1] # remove trailing .
        else:
            owner = "this"

        thing = match.group(3)

        from gen_doc import objects

        object = None
        if owner == "this":
            object = obj.object
        if owner in objects:
            object = objects[owner]
        elif obj.file.name + "." + owner in objects:
            object = objects[obj.file.name + "." +  owner]

        if object is None:
            return '<code>{name}</code>'.format(name = full)

        func_names = [x.name for x in object.functions]
        enum_names = [x.name for x in object.enums]
        prop_names = [x.name for x in object.properties]

        if thing in prop_names and not full.endswith("()"):
            return '<link linkend="cinnamon-js-{prefix}--{thing}"><code>{full}</code></link>'.format(
                prefix = object.prefix,
                thing = thing,
                full = full)
        elif thing in func_names or (thing in enum_names and not full.endswith("()")):
            return '<link linkend="cinnamon-js-{prefix}-{thing}"><code>{full}</code></link>'.format(
                prefix = object.prefix,
                thing = thing,
                full = full)
        else:
            return '<code>{name}</code>'.format(name = full)

    line = re.sub('%(([\w]+\.)?[\w]+\.)?([\w]+)(\(\))?', format_ext_link, line)

    return line

class JSThing():
    def append_description(self, desc):
        self.description += desc.replace('<', '&lt;').replace('>', '&gt;')

    def get_xml_description(self, description = None):
        if description is None:
            description = self.description

        stuff = description.split('\n')
        joined = ['']

        in_code = False
        in_list = False

        for line in stuff:
            if line.strip() == '```':
                if in_code:
                    joined[-1] += '```'
                    joined.append('')
                else:
                    if in_list:
                        joined[-1] += '\n```'
                    else:
                        joined.append('```\n')
                in_code = not in_code
                continue

            if in_code:
                joined[-1] += '\n' + line
                continue

            line = line.strip()
            if line == '\\' and in_list:
                joined[-1] += '\n\n'
            elif len(line) == 0 or line == '\\':
                # New line if empty
                joined.append('')
                in_list = False
            else:
                if joined[-1] == '' and line.startswith('- '):
                    in_list = True
                if line.startswith('- '):
                    joined.append('')

                joined[-1] += ' ' + line

        description = ''
        in_list = False

        list_buffer = []
        for line in joined:
            if line.split('\n')[0].strip() == '```':
                description += '<informalexample><programlisting>{0}</programlisting></informalexample>'\
                    .format(line.replace('```', ''))
                continue

            if line == '':
                continue

            line = line.strip()
            if line.startswith('-'):
                in_list = True
                list_buffer.append(self.get_xml_description(line[1:]))
                continue

            if in_list:
                description += '<itemizedlist>' + \
                    '\n'.join('<listitem>{0}</listitem>'.format(item) for item in list_buffer) + \
                    '</itemizedlist>'
                list_buffer = []
                in_list = False

            line = markup(line, self)
            description += '<para>{0}</para>'.format(line)

        if in_list:
            description += '<itemizedlist>' + \
                '\n'.join('<listitem>{0}</listitem>'.format(item) for item in list_buffer) + \
                '</itemizedlist>'
            list_buffer = []

        return description

    def add_property(self, prop):
        if prop.name == "short_description":
            self.short_description = prop
        else:
            self.properties.append(prop)
        prop.file = self.file
        prop.object = self.object

class JSSignal(JSThing):
    def __init__ (self, name):
        self.name = name
        self.description = ''
        self.short_description = JSProperty(None, '', '')
        self.properties = []

class JSFunction(JSThing):
    def __init__ (self, name):
        self.name = name
        self.description = ''
        self.short_description = JSProperty(None, '', '')
        self.properties = []
        self.return_value = JSProperty(None, '', '')

    def set_return(self, retval):
        self.return_value = retval
        retval.file = self.file
        retval.obj = self.object

class JSProperty(JSThing):
    def __init__ (self, name, arg_type, desc):
        self.name = name
        self.arg_type = arg_type if arg_type else ''
        self.description = ''
        self.append_description(desc + "\n")

class JSFile(JSThing):
    def __init__ (self, directory, name):
        self.directory = directory
        self.name = name[0].capitalize() + name[1:]
        self.orig_name = self.name
        self.imports = "imports.{0}.{1}".format(directory, name)
        self.prefix = directory + "-" + name
        self.description = ''
        self.short_description = JSProperty(None, '', '')
        self.properties = []
        self.objects = []
        self.signals = []
        self.enums = []
        self.functions = []
        self.file = self
        self.object = self

    def is_interesting(self):
        return len(self.functions) + len(self.properties) + len(self.description) > 0

    def add_function(self, func):
        self.functions.append(func)
        func.file = self
        func.object = self

    def add_object(self, obj):
        self.objects.append(obj)
        obj.parent = self
        obj.directory = self.directory
        obj.prefix = self.prefix + "-" + obj.name
        obj.name = self.name + "-" + obj.name
        obj.file = self

    def add_enum(self, obj):
        self.enums.append(obj)
        obj.parent = self
        obj.directory = self.directory
        obj.prefix = self.prefix + "-" + obj.name
        obj.file = self

class JSObject(JSThing):
    def __init__ (self, name):
        self.name = name
        self.orig_name = name
        self.inherit = ''
        self.description = ''
        self.short_description = JSProperty(None, '', '')
        self.parent = None
        self.directory = None
        self.prefix = None
        self.functions = []
        self.properties = []
        self.signals = []
        self.enums = []
        self.object = self

    def add_function(self, func):
        self.functions.append(func)
        func.file = self.file
        func.object = self

    def add_signal(self, signal):
        self.signals.append(signal)
        signal.file = self
        signal.object = self

    def set_inherit(self, inherit):
        self.inherit = inherit

class JSEnum(JSThing):
    def __init__ (self, name):
        self.name = name
        self.description = ''
        self.short_description = JSProperty(None, '', '')
        self.properties = []
        self.object = self

PART_FORMAT = '''\
<?xml version='1.0'?>
<!DOCTYPE book PUBLIC '-//OASIS//DTD DocBook XML V4.3//EN'
               'http://www.oasis-open.org/docbook/xml/4.3/docbookx.dtd'
[
  <!ENTITY % local.common.attrib "xmlns:xi  CDATA  #FIXED 'http://www.w3.org/2003/XInclude'">
]>
<part label="imports.{title}">
  {chapters}
</part>'''

SGML_CHAPTER_FORMAT = '''
<chapter id="cinnamon-js-{prefix}-section">
  <title>{title}</title>
  {entries}
</chapter>'''

SGML_ENTRY_FORMAT = '<xi:include href="{directory}/{name}.xml"/>'

FILE_FORMAT = '''\
<!DOCTYPE refentry PUBLIC '-//OASIS//DTD DocBook XML V4.3//EN'
'http://www.oasis-open.org/docbook/xml/4.3/docbookx.dtd'
[
<!ENTITY % local.common.attrib "xmlns:xi  CDATA  #FIXED 'http://www.w3.org/2003/XInclude'">
]>
<refentry id="cinnamon-js-{prefix}">
  <refmeta>
    <refentrytitle role="top_of_page" id="cinnamon-js-{prefix}.top_of_page">{name}</refentrytitle>
    <manvolnum>3</manvolnum>
    <refmiscinfo>
      {name}
    </refmiscinfo>
  </refmeta>
  <refnamediv>
    <refname>{name}</refname>
    <refpurpose>{short_description}</refpurpose>
  </refnamediv>
  {func_header}
  {prop_header}
  {signal_header}
  {enum_header}
  {hierarchy}
  {description}
  {functions}
  {properties}
  {signals}
  {enums}
</refentry>
'''

FUNCTION_HEADER_FORMAT = '''
<refsect1 id="cinnamon-js-{prefix}.functions" role="functions_proto">
  <title role="functions_proto.title">Functions</title>
  <informaltable pgwide="1" frame="none">
    <tgroup cols="2">
      <colspec colname="functions_return" colwidth="150px"/>
      <colspec colname="functions_name"/>
      <tbody>
        {function_headers}
      </tbody>
    </tgroup>
  </informaltable>
</refsect1>
'''

FUNCTION_HEADER_ITEM_FORMAT = '''
<row>
  <entry role="function_type">
    <link linkend="{return_link}">
      <returnvalue>{return_name}</returnvalue>
    </link>
  </entry>
  <entry role="function_name">
    <link linkend="cinnamon-js-{prefix}-{name}">{name}</link>&#160;<phrase role="c_punctuation">()</phrase>
  </entry>
</row>
'''

PROPERTY_HEADER_FORMAT = '''
<refsect1 id="cinnamon-js-{prefix}.properties" role="properties">
  <title role="properties.title">Properties</title>
  <informaltable frame="none">
    <tgroup cols="3">
      <colspec colname="properties_type" colwidth="150px"/>
      <colspec colname="properties_name" colwidth="300px"/>
      <tbody>
        {property_headers}
      </tbody>
    </tgroup>
  </informaltable>
</refsect1>
'''

SIGNAL_HEADER_FORMAT = '''
<refsect1 id="cinnamon-js-{prefix}.signals" role="signal_proto">
  <title role="signal_proto.title">Signals</title>
  <informaltable frame="none">
    <tgroup cols="3">
      <colspec colname="signals_return" colwidth="150px" />
      <colspec colname="signals_name" colwidth="300px" />
      <tbody>
        {signal_headers}
      </tbody>
    </tgroup>
  </informaltable>
</refsect1>
'''

SIGNAL_HEADER_ITEM_FORMAT = '''
<row>
  <entry role="signal_type">
  </entry>
  <entry role="signal_name">
    <link linkend="cinnamon-js-{prefix}-{name}-signal">{name}</link>
  </entry>
</row>
'''

ENUM_HEADER_FORMAT = '''
<refsect1 id="cinnamon-js-{prefix}.other" role="other_proto">
  <title role="other_proto.title">Types and Values</title>
  <informaltable role="enum_members_table" pgwide="1" frame="none">
    <tgroup cols="2">
      <colspec colname="name" colwidth="150px"/>
      <colspec colname="description"/>
      <tbody>
        {enum_headers}
      </tbody>
    </tgroup>
  </informaltable>
</refsect1>
'''

ENUM_HEADER_ITEM_FORMAT = '''
<row>
  <entry role="datatype_keyword">enum</entry>
  <entry role="function_name">
    <link linkend="cinnamon-js-{prefix}-{name}">{name}</link>
  </entry>
</row>
'''

PROPERTY_HEADER_ITEM_FORMAT = '''
<row>
  <entry role="property_type">
    <link linkend="{type_link}"><type>{type_name}</type></link>
  </entry>
  <entry role="property_name">
    <link linkend="cinnamon-js-{prefix}--{name}">{name}</link>
  </entry>
</row>
'''

HIERARCHY_FORMAT = '''
<refsect1 id="cinnamon-js-{prefix}.object-hierarchy" role="object_hierarchy">
  <title role="object_hierarchy.title">Object Hierarchy</title>
  <screen>
    <link linkend="Object">Object</link>
{hierarchy}
  </screen>
</refsect1>
'''

HIERARCHY_ITEM_FORMAT = '{spacing}<phrase role="lineart">&#9584;&#9472;&#9472;</phrase> <link linkend="cinnamon-js-{prefix}">{name}</link>'

DESCRIPTION_FORMAT = '''
<refsect1 id="cinnamon-js-{prefix}.description" role="desc">
  <title role="desc.title">Description</title>
  {description}
</refsect1>
'''

FUNCTIONS_FORMAT = '''
<refsect1 id="cinnamon-js-{prefix}.functions_details" role="details">
  <title role="details.title">Functions</title>
  {functions}
</refsect1>
'''

FUNCTION_ITEM_FORMAT = '''
<refsect2 id="cinnamon-js-{prefix}-{name}" role="function">
  <title>{name}&#160;()</title>
  <indexterm zone="cinnamon-js-{prefix}-{name}"><primary>{name}</primary></indexterm>
  <programlisting language="javascript">
<link linkend="{return_link}"><returnvalue>{return_type}</returnvalue></link>
{name} ({inline_params});</programlisting>
  {description}
  {params}
  {return_desc}
</refsect2>
'''

SIGNALS_FORMAT = '''
<refsect1 id="cinnamon-js-{prefix}.signal-details" role="details">
  <title role="details.title">Signal details</title>
  {signals}
</refsect1>
'''

SIGNAL_ITEM_FORMAT = '''
<refsect2 id="cinnamon-js-{prefix}-{name}-signal" role="signal">
  <title>The <literal>“{name}”</literal> signal</title>
  <indexterm zone="cinnamon-js-{prefix}-{name}-signal"><primary>{prefix}::{name}</primary></indexterm>
  <programlisting language="javascript">
user_function ({inline_params});</programlisting>
  {description}
  {params}
</refsect2>
'''

FUNC_PARAMETERS_FORMAT = '''
<refsect3 role="parameters">
  <title>Parameters</title>
  <informaltable role="parameters_table" pgwide="1" frame="none">
    <tgroup cols="3">
      <colspec colname="parameters_name" colwidth="150px"/>
      <colspec colname="parameters_description"/>
      <colspec colname="parameters_annotations" colwidth="200px"/>
      <tbody>
        {param_items}
      </tbody>
    </tgroup>
  </informaltable>
</refsect3>
'''

INLINE_PARAMETER_FORMAT = '<parameter><link linkend="{type_link}"><type>{type_name}</type></link>{name}</parameter>'

FUNC_PARAMETERS_ITEM_FORMAT = '''
<row>
  <entry role="parameter_name"><para>{name}</para></entry>
  <entry role="parameter_description">{description}</entry>
  <entry role="parameter_annotations"></entry>
</row>
'''

FUNC_RETURN_FORMAT = '''
<refsect3 role="returns">
  <title>Returns</title>
  {desc}
</refsect3>
'''

PROPERTIES_FORMAT = '''
<refsect1 id="cinnamon-js-{prefix}.property-details" role="property_details">
  <title role="property_details.title">Property Details</title>
  {properties}
</refsect1>
'''

PROPERTIES_ITEM_FORMAT = '''
<refsect2 id="cinnamon-js-{prefix}--{name}" role="property">
  <title>The <literal>“{name}”</literal> property</title>
  <indexterm zone="cinnamon-js-{prefix}--{name}">
    <primary>cinnamon-js-{prefix}:{name}</primary>
  </indexterm>
  <programlisting>  {disp_name}  <link linkend="{type_link}"><type>{type_name}</type></link></programlisting>
  {description}
</refsect2>
'''

ENUMS_FORMAT = '''
<refsect1 id="CinnamonGlobal.other_details" role="details">
  <title role="details.title">Types and Values</title>
  {enums}
</refsect1>
'''

ENUMS_ITEM_FORMAT = '''
<refsect2 id="cinnamon-js-{prefix}" role="enum">
  <title>enum {name}</title>
  <indexterm zone="{name}"><primary>{name}</primary></indexterm>
  {description}
  <refsect3 role="enum_members">
    <title>Members</title>
    <informaltable role="enum_members_table" pgwide="1" frame="none">
      <tgroup cols="2">
        <colspec colname="enum_members_name" colwidth="300px"/>
        <colspec colname="enum_members_description"/>
        <tbody>
          {enum_items}
        </tbody>
      </tgroup>
    </informaltable>
  </refsect3>
</refsect2>
'''

ENUMS_ITEM_ROW_FORMAT = '''
<row role="constant">
  <entry role="enum_member_name"><para id="{name}:CAPS">{name}</para></entry>
  <entry role="enum_member_description">{description}</entry>
</row>
'''

def write_chapters_file(files):
    chapters = {'ui': [], 'misc': []}

    for _file in files:
        if not _file.is_interesting() and len(_file.objects) == 0:
            continue

        entries = []
        if _file.is_interesting():
            _file.objects.insert(0, _file)

        entries = [SGML_ENTRY_FORMAT.format(
            directory = _file.directory,
            name = obj.name) for obj in _file.objects]

        chapters[_file.directory].append(SGML_CHAPTER_FORMAT.format(
            prefix = _file.prefix,
            title = _file.imports,
            entries = "\n".join(entries)))

    for directory, formatted_chapters in chapters.items():
        with open(directory + '.xml', 'w') as part_file:
            part_file.write(PART_FORMAT.format(title=directory, chapters="\n".join(formatted_chapters)))

def create_file(obj):
    file_obj = open('{0}/{1}.xml'.format(obj.directory, obj.name), 'w', encoding="utf-8")
    short_description = obj.short_description.description.replace("\n", " ").strip()
    file_obj.write(FILE_FORMAT.format(
        prefix = obj.prefix,
        name = obj.name.replace("-", "."),
        short_description = markup(short_description, obj),
        func_header = get_function_header(obj),
        signal_header = get_signal_header(obj),
        prop_header = get_properties_header(obj),
        enum_header = get_enum_header(obj),
        hierarchy = get_hierarchy(obj),
        description = get_description(obj),
        functions = get_functions(obj),
        signals = get_signals(obj),
        properties = get_properties(obj),
        enums = get_enums(obj)))

    file_obj.close()

def get_function_header(obj):
    if len(obj.functions) == 0:
        return ""

    functions = [FUNCTION_HEADER_ITEM_FORMAT.format(
        return_link = get_type_link(func.return_value.arg_type, obj.file),
        return_name = func.return_value.arg_type,
        prefix = obj.prefix,
        name = func.name) for func in obj.functions]

    return FUNCTION_HEADER_FORMAT.format(
        prefix = obj.prefix,
        function_headers = "\n".join(functions))

def get_signal_header(obj):
    if len(obj.signals) == 0:
        return ""

    signals = [SIGNAL_HEADER_ITEM_FORMAT.format(
               prefix = obj.prefix,
               name = sig.name) for sig in obj.signals]

    return SIGNAL_HEADER_FORMAT.format(
        prefix = obj.prefix,
        signal_headers = "\n".join(signals))

def get_properties_header(obj):
    if len(obj.properties) == 0:
        return ""

    properties = [PROPERTY_HEADER_ITEM_FORMAT.format(
        type_link = get_type_link(prop.arg_type, obj.file),
        type_name = prop.arg_type,
        prefix = obj.prefix,
        name = prop.name) for prop in obj.properties]

    return PROPERTY_HEADER_FORMAT.format(
        prefix = obj.prefix,
        property_headers = "\n".join(properties))

def get_enum_header(obj):
    if len(obj.enums) == 0:
        return ""

    enums = [ENUM_HEADER_ITEM_FORMAT.format(
        prefix = obj.prefix,
        name = enum.name) for enum in obj.enums]

    return ENUM_HEADER_FORMAT.format(
        prefix = obj.prefix,
        enum_headers = "\n".join(enums))


def get_hierarchy(obj):
    from gen_doc import objects

    if isinstance(obj, JSFile):
        return ""


    name = obj.name.replace('-', '.')
    hierarchy = []
    try:
        while True:
            name = objects[name].inherit
            if name in hierarchy:
                break
            if name:
                hierarchy.insert(0, name)
    except KeyError:
        pass

    count = 1
    hierarchy_strs = []
    for item in hierarchy:
        try:
            hierarchy_strs.append(HIERARCHY_ITEM_FORMAT.format(
                spacing = ' ' * count * 4,
                prefix = objects[item].prefix,
                name = item))
        except KeyError:
            hierarchy_strs.append(HIERARCHY_ITEM_FORMAT.format(
                spacing = ' ' * count * 4,
                prefix = "void",
                name = item))
        count += 1

    hierarchy_strs.append(HIERARCHY_ITEM_FORMAT.format(
        spacing = ' ' * count * 4,
        prefix = "void",
        name = obj.name.replace('-', '.')))

    return HIERARCHY_FORMAT.format(
        prefix = obj.prefix,
        hierarchy = "\n".join(hierarchy_strs))

def get_description(obj):
    if len(obj.description) == 0:
        return ""

    return DESCRIPTION_FORMAT.format(
        prefix=obj.prefix,
        description = obj.get_xml_description())

def get_functions(obj):
    if len(obj.functions) == 0:
        return ""

    functions = []

    for func in obj.functions:
        inline_params = ""
        params = ""
        if len(func.properties) > 0:
            # Calculate how long the argument types are and make the arguments
            # align
            max_length = max(len(x.arg_type) for x in func.properties) + 3
            # If no parameter has argument types, don't show that silly
            # whitespace
            if max_length == 3:
                max_length = 0

            inline_params = [INLINE_PARAMETER_FORMAT.format(
                type_link = get_type_link(param.arg_type, obj.file),
                type_name = param.arg_type,
                name = " " * (max_length - len(param.arg_type)) + param.name) for param in func.properties]

            inline_params = (',\n' + ' ' * (len(func.name) + 2)).join(inline_params)

            params = [FUNC_PARAMETERS_ITEM_FORMAT.format(
                name = param.name,
                description = param.get_xml_description()) for param in func.properties]

            params = FUNC_PARAMETERS_FORMAT.format(param_items = '\n'.join(params))

        return_desc = ""
        if func.return_value.name is not None:
            return_desc = FUNC_RETURN_FORMAT.format(desc=func.return_value.get_xml_description())

        functions.append(FUNCTION_ITEM_FORMAT.format(
            prefix = obj.prefix,
            name = func.name,
            return_link = get_type_link(func.return_value.arg_type, obj.file),
            return_type = func.return_value.arg_type,
            description = func.get_xml_description(),
            inline_params = inline_params,
            params = params,
            return_desc = return_desc))

    return FUNCTIONS_FORMAT.format(
        prefix = obj.prefix,
        functions = "\n".join(functions))

def get_signals(obj):
    if len(obj.signals) == 0:
        return ""

    signals = []

    for sig in obj.signals:
        inline_params = ""
        params = ""
        if len(sig.properties) > 0:
            # Calculate how long the argument types are and make the arguments
            # align
            max_length = max(len(x.arg_type) for x in sig.properties) + 3
            # If no parameter has argument types, don't show that silly
            # whitespace
            if max_length == 3:
                max_length = 0

            inline_params = [INLINE_PARAMETER_FORMAT.format(
                type_link = get_type_link(param.arg_type, obj.file),
                type_name = param.arg_type,
                name = " " * (max_length - len(param.arg_type)) + param.name) for param in sig.properties]

            inline_params = (',\n' + ' ' * (len(sig.name) + 2)).join(inline_params)

            params = [FUNC_PARAMETERS_ITEM_FORMAT.format(
                name = param.name,
                description = param.get_xml_description()) for param in sig.properties]

            params = FUNC_PARAMETERS_FORMAT.format(param_items = '\n'.join(params))

        signals.append(SIGNAL_ITEM_FORMAT.format(
            prefix = obj.prefix,
            name = sig.name,
            description = sig.get_xml_description(),
            inline_params = inline_params,
            params = params))

    return SIGNALS_FORMAT.format(
        prefix = obj.prefix,
        signals = "\n".join(signals))


def get_properties(obj):
    if len(obj.properties) == 0:
        return ""

    properties = [PROPERTIES_ITEM_FORMAT.format(
        prefix = obj.prefix,
        name = prop.name,
        disp_name = ('“' + prop.name + '”').ljust(25),
        type_link = get_type_link(prop.arg_type, obj.file),
        type_name = prop.arg_type,
        description = prop.get_xml_description()) for prop in obj.properties]

    return PROPERTIES_FORMAT.format(
        prefix = obj.prefix,
        properties = "\n".join(properties))

def get_enums(obj):
    if len(obj.enums) == 0:
        return ""

    enums = []

    for enum in obj.enums:
        items = [ENUMS_ITEM_ROW_FORMAT.format(
            name = item.name,
            description = item.get_xml_description()) for item in enum.properties]

        enums.append(ENUMS_ITEM_FORMAT.format(
            prefix = enum.prefix,
            name = enum.name,
            description = enum.get_xml_description(),
            enum_items = "\n".join(items)))

    return ENUMS_FORMAT.format(
        prefix = obj.prefix,
        enums = "\n".join(enums))
