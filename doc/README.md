Running ./create-do.py will parse JS code in js/ui/ into html documentation.

The html files will be created in Cinnamon/doc/output-html/

Format of Documentation
=======================
Functions
---------
/**
 * function_name:
 * @agrument_one (ArgumentType): argument description
 * @agrument_two (ArgumentType): argument description
 *
 * How the function works. Long description (capitalize first letter)
 *
 * Returns (ReturnType): what the function returns
 */

Objects
-------
/**
 * #ObjectName:
 * @variable1_of_object (VarType): variable description
 * @variable2_of_object (VarType): variable description
 *
 * Description of object
 */

File
----
/**
 * FILE:filename.js
 *
 * Description of file
 */

 