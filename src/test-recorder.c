/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#define GST_USE_UNSTABLE_API
#include "cinnamon-recorder.h"
#include <clutter/clutter.h>
#include <gst/gst.h>

/* Very simple test of the CinnamonRecorder class; shows some text strings
 * moving around and records it.
 */
static CinnamonRecorder *recorder;

static gboolean
stop_recording_timeout (gpointer data)
{
  cinnamon_recorder_close (recorder);
  return FALSE;
}

static void
on_animation_completed (ClutterAnimation *animation)
{
  g_timeout_add (1000, stop_recording_timeout, NULL);
}

int main (int argc, char **argv)
{
  ClutterActor *stage;
  ClutterActor *text;
  ClutterAnimation *animation;
  ClutterColor red, green, blue;

  gst_init (&argc, &argv);
  if (clutter_init (&argc, &argv) != CLUTTER_INIT_SUCCESS)
    return 1;

  clutter_color_from_string (&red, "red");
  clutter_color_from_string (&green, "green");
  clutter_color_from_string (&blue, "blue");
  stage = clutter_stage_new ();
  g_signal_connect (stage, "destroy", G_CALLBACK (clutter_main_quit), NULL);

  text = g_object_new (CLUTTER_TYPE_TEXT,
		       "text", "Red",
		       "font-name", "Sans 40px",
		       "color", &red,
		       NULL);
  clutter_container_add_actor (CLUTTER_CONTAINER (stage), text);
  animation = clutter_actor_animate (text,
				     CLUTTER_EASE_IN_OUT_QUAD,
				     3000,
				     "x", 320,
				     "y", 240,
				     NULL);
  g_signal_connect (animation, "completed",
		    G_CALLBACK (on_animation_completed), NULL);

  text = g_object_new (CLUTTER_TYPE_TEXT,
		       "text", "Blue",
		       "font-name", "Sans 40px",
		       "color", &blue,
		       "x", 640,
		       "y", 0,
		       NULL);
  clutter_actor_set_anchor_point_from_gravity (text, CLUTTER_GRAVITY_NORTH_EAST);
  clutter_container_add_actor (CLUTTER_CONTAINER (stage), text);
  animation = clutter_actor_animate (text,
				     CLUTTER_EASE_IN_OUT_QUAD,
				     3000,
				     "x", 320,
				     "y", 240,
				     NULL);

  text = g_object_new (CLUTTER_TYPE_TEXT,
		       "text", "Green",
		       "font-name", "Sans 40px",
		       "color", &green,
		       "x", 0,
		       "y", 480,
		       NULL);
  clutter_actor_set_anchor_point_from_gravity (text, CLUTTER_GRAVITY_SOUTH_WEST);
  clutter_container_add_actor (CLUTTER_CONTAINER (stage), text);
  animation = clutter_actor_animate (text,
				     CLUTTER_EASE_IN_OUT_QUAD,
				     3000,
				     "x", 320,
				     "y", 240,
				     NULL);

  recorder = cinnamon_recorder_new (CLUTTER_STAGE (stage));
  cinnamon_recorder_set_filename (recorder, "test-recorder.ogg");

  clutter_actor_show (stage);

  cinnamon_recorder_record (recorder);
  clutter_main ();

  return 0;
}
