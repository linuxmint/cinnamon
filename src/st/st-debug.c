/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include <cjs/gjs.h>


/**
 * st_debug_dump_js_stack:
 *
 * Prints out the gjs stack
 */
void
st_dump_js_stack (void)
{
    gjs_dumpstack ();
}
