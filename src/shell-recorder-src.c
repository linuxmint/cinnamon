/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <gst/base/gstpushsrc.h>

#include "shell-recorder-src.h"

struct _ShellRecorderSrc
{
  GstPushSrc parent;

  GMutex *mutex;

  GstCaps *caps;
  GAsyncQueue *queue;
  gboolean closed;
  guint memory_used;
  guint memory_used_update_idle;
};

struct _ShellRecorderSrcClass
{
  GstPushSrcClass parent_class;
};

enum {
  PROP_0,
  PROP_CAPS,
  PROP_MEMORY_USED
};

/* Special marker value once the source is closed */
#define RECORDER_QUEUE_END ((GstBuffer *)1)

GST_BOILERPLATE(ShellRecorderSrc, shell_recorder_src, GstPushSrc, GST_TYPE_PUSH_SRC);

static void
shell_recorder_src_init (ShellRecorderSrc      *src,
			 ShellRecorderSrcClass *klass)
{
  src->queue = g_async_queue_new ();
  src->mutex = g_mutex_new ();
}

static void
shell_recorder_src_base_init (gpointer klass)
{
}

static gboolean
shell_recorder_src_memory_used_update_idle (gpointer data)
{
  ShellRecorderSrc *src = data;

  g_mutex_lock (src->mutex);
  src->memory_used_update_idle = 0;
  g_mutex_unlock (src->mutex);

  g_object_notify (G_OBJECT (src), "memory-used");

  return FALSE;
}

/* The memory_used property is used to monitor buffer usage,
 * so we marshal notification back to the main loop thread.
 */
static void
shell_recorder_src_update_memory_used (ShellRecorderSrc *src,
				       int               delta)
{
  g_mutex_lock (src->mutex);
  src->memory_used += delta;
  if (src->memory_used_update_idle == 0)
    src->memory_used_update_idle = g_idle_add (shell_recorder_src_memory_used_update_idle, src);
  g_mutex_unlock (src->mutex);
}

/* The create() virtual function is responsible for returning the next buffer.
 * We just pop buffers off of the queue and block if necessary.
 */
static GstFlowReturn
shell_recorder_src_create (GstPushSrc  *push_src,
			   GstBuffer  **buffer_out)
{
  ShellRecorderSrc *src = SHELL_RECORDER_SRC (push_src);
  GstBuffer *buffer;

  if (src->closed)
    return GST_FLOW_UNEXPECTED;

  buffer = g_async_queue_pop (src->queue);
  if (buffer == RECORDER_QUEUE_END)
    {
      /* Returning UNEXPECTED here will cause a EOS message to be sent */
      src->closed = TRUE;
      return GST_FLOW_UNEXPECTED;
    }

  shell_recorder_src_update_memory_used (src,
					 - (int)(GST_BUFFER_SIZE(buffer) / 1024));

  *buffer_out = buffer;

  return GST_FLOW_OK;
}

static void
shell_recorder_src_set_caps (ShellRecorderSrc *src,
			     const GstCaps    *caps)
{
  if (caps == src->caps)
    return;

  if (src->caps != NULL)
    {
      gst_caps_unref (src->caps);
      src->caps = NULL;
    }

  if (caps)
    {
      /* The capabilities will be negotated with the downstream element
       * and set on the pad when the first buffer is pushed.
       */
      src->caps = gst_caps_copy (caps);
    }
  else
    src->caps = NULL;
}

static void
shell_recorder_src_finalize (GObject *object)
{
  ShellRecorderSrc *src = SHELL_RECORDER_SRC (object);

  if (src->memory_used_update_idle)
    g_source_remove (src->memory_used_update_idle);

  shell_recorder_src_set_caps (src, NULL);
  g_async_queue_unref (src->queue);

  g_mutex_free (src->mutex);

  G_OBJECT_CLASS (parent_class)->finalize (object);
}

static void
shell_recorder_src_set_property (GObject      *object,
				 guint         prop_id,
				 const GValue *value,
				 GParamSpec   *pspec)
{
  ShellRecorderSrc *src = SHELL_RECORDER_SRC (object);

  switch (prop_id)
    {
    case PROP_CAPS:
      shell_recorder_src_set_caps (src, gst_value_get_caps (value));
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
shell_recorder_src_get_property (GObject         *object,
				 guint            prop_id,
				 GValue          *value,
				 GParamSpec      *pspec)
{
  ShellRecorderSrc *src = SHELL_RECORDER_SRC (object);

  switch (prop_id)
    {
    case PROP_CAPS:
      gst_value_set_caps (value, src->caps);
      break;
    case PROP_MEMORY_USED:
      g_mutex_lock (src->mutex);
      g_value_set_uint (value, src->memory_used);
      g_mutex_unlock (src->mutex);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
shell_recorder_src_class_init (ShellRecorderSrcClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  GstElementClass *element_class = GST_ELEMENT_CLASS (klass);
  GstPushSrcClass *push_src_class = GST_PUSH_SRC_CLASS (klass);

  static GstStaticPadTemplate src_template =
    GST_STATIC_PAD_TEMPLATE ("src",
			     GST_PAD_SRC,
			     GST_PAD_ALWAYS,
			     GST_STATIC_CAPS_ANY);

  object_class->finalize = shell_recorder_src_finalize;
  object_class->set_property = shell_recorder_src_set_property;
  object_class->get_property = shell_recorder_src_get_property;

  push_src_class->create = shell_recorder_src_create;

  g_object_class_install_property (object_class,
                                   PROP_CAPS,
                                   g_param_spec_boxed ("caps",
						       "Caps",
						       "Fixed GstCaps for the source",
						       GST_TYPE_CAPS,
						       G_PARAM_READWRITE));
  g_object_class_install_property (object_class,
                                   PROP_MEMORY_USED,
                                   g_param_spec_uint ("memory-used",
						     "Memory Used",
						     "Memory currently used by the queue (in kB)",
						      0, G_MAXUINT, 0,
						      G_PARAM_READABLE));
  gst_element_class_add_pad_template (element_class,
				      gst_static_pad_template_get (&src_template));

  gst_element_class_set_details_simple (element_class,
					"ShellRecorderSrc",
					"Generic/Src",
					"Feed screen capture data to a pipeline",
					"Owen Taylor <otaylor@redhat.com>");
}

/**
 * shell_recorder_src_add_buffer:
 *
 * Adds a buffer to the internal queue to be pushed out at the next opportunity.
 * There is no flow control, so arbitrary amounts of memory may be used by
 * the buffers on the queue. The buffer contents must match the #GstCaps
 * set in the :caps property.
 */
void
shell_recorder_src_add_buffer (ShellRecorderSrc *src,
			       GstBuffer        *buffer)
{
  g_return_if_fail (SHELL_IS_RECORDER_SRC (src));
  g_return_if_fail (src->caps != NULL);

  gst_buffer_set_caps (buffer, src->caps);
  shell_recorder_src_update_memory_used (src,
					 (int) (GST_BUFFER_SIZE(buffer) / 1024));

  g_async_queue_push (src->queue, gst_buffer_ref (buffer));
}

/**
 * shell_recorder_src_close:
 *
 * Indicates the end of the input stream. Once all previously added buffers have
 * been pushed out an end-of-stream message will be sent.
 */
void
shell_recorder_src_close (ShellRecorderSrc *src)
{
  /* We can't send a message to the source immediately or buffers that haven't
   * been pushed yet will be discarded. Instead stick a marker onto our own
   * queue to send an event once everything has been pushed.
   */
  g_async_queue_push (src->queue, RECORDER_QUEUE_END);
}

static gboolean
plugin_init (GstPlugin *plugin)
{
  gst_element_register(plugin, "shellrecordersrc", GST_RANK_NONE,
		       SHELL_TYPE_RECORDER_SRC);

  return TRUE;
}

/**
 * shell_recorder_src_register:
 * Registers a plugin holding our single element to use privately in
 * this application. Can safely be called multiple times.
 */
void
shell_recorder_src_register (void)
{
  static gboolean registered = FALSE;
  if (registered)
    return;

  gst_plugin_register_static (GST_VERSION_MAJOR, GST_VERSION_MINOR,
			      "shellrecorder",
			      "Plugin for ShellRecorder",
			      plugin_init,
			      "0.1",
			      "LGPL",
			      "gnome-shell", "gnome-shell", "http://live.gnome.org/GnomeShell");

  registered = TRUE;
}
