/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#define GST_USE_UNSTABLE_API
#include <gst/base/gstpushsrc.h>

#include "cinnamon-recorder-src.h"

struct _CinnamonRecorderSrc
{
  GstPushSrc parent;

  GMutex mutex;

  GstCaps *caps;
  GMutex queue_lock;
  GCond queue_cond;
  GQueue *queue;

  gboolean eos;
  gboolean flushing;
  guint memory_used;
  guint memory_used_update_idle;
};

struct _CinnamonRecorderSrcClass
{
  GstPushSrcClass parent_class;
};

enum {
  PROP_0,
  PROP_CAPS,
  PROP_MEMORY_USED
};

#define cinnamon_recorder_src_parent_class parent_class
G_DEFINE_TYPE(CinnamonRecorderSrc, cinnamon_recorder_src, GST_TYPE_PUSH_SRC);

static void
cinnamon_recorder_src_init (CinnamonRecorderSrc      *src)
{
  gst_base_src_set_format (GST_BASE_SRC (src), GST_FORMAT_TIME);
  gst_base_src_set_live (GST_BASE_SRC (src), TRUE);

  src->queue = g_queue_new ();
  g_mutex_init (&src->mutex);
  g_mutex_init (&src->queue_lock);
  g_cond_init (&src->queue_cond);
}

static gboolean
cinnamon_recorder_src_memory_used_update_idle (gpointer data)
{
  CinnamonRecorderSrc *src = data;

  g_mutex_lock (&src->mutex);
  src->memory_used_update_idle = 0;
  g_mutex_unlock (&src->mutex);

  g_object_notify (G_OBJECT (src), "memory-used");

  return FALSE;
}

/* The memory_used property is used to monitor buffer usage,
 * so we marshal notification back to the main loop thread.
 */
static void
cinnamon_recorder_src_update_memory_used (CinnamonRecorderSrc *src,
				       int               delta)
{
  g_mutex_lock (&src->mutex);
  src->memory_used += delta;
  if (src->memory_used_update_idle == 0)
    src->memory_used_update_idle = g_idle_add (cinnamon_recorder_src_memory_used_update_idle, src);
  g_mutex_unlock (&src->mutex);
}

/* _negotiate() is called when we have to decide on a format. We
 * use the configured format */
static gboolean
cinnamon_recorder_src_negotiate (GstBaseSrc * base_src)
{
  CinnamonRecorderSrc *src = CINNAMON_RECORDER_SRC (base_src);
  gboolean result;

  result = gst_base_src_set_caps (base_src, src->caps);

  return result;
}

static gboolean
cinnamon_recorder_src_unlock (GstBaseSrc * base_src)
{
  CinnamonRecorderSrc *src = CINNAMON_RECORDER_SRC (base_src);

  g_mutex_lock (&src->queue_lock);
  src->flushing = TRUE;
  g_cond_signal (&src->queue_cond);
  g_mutex_unlock (&src->queue_lock);

  return TRUE;
}

static gboolean
cinnamon_recorder_src_unlock_stop (GstBaseSrc * base_src)
{
  CinnamonRecorderSrc *src = CINNAMON_RECORDER_SRC (base_src);

  g_mutex_lock (&src->queue_lock);
  src->flushing = FALSE;
  g_cond_signal (&src->queue_cond);
  g_mutex_unlock (&src->queue_lock);

  return TRUE;
}

static gboolean
cinnamon_recorder_src_start (GstBaseSrc * base_src)
{
  CinnamonRecorderSrc *src = CINNAMON_RECORDER_SRC (base_src);

  g_mutex_lock (&src->queue_lock);
  src->flushing = FALSE;
  src->eos = FALSE;
  g_cond_signal (&src->queue_cond);
  g_mutex_unlock (&src->queue_lock);

  return TRUE;
}

static gboolean
cinnamon_recorder_src_stop (GstBaseSrc * base_src)
{
  CinnamonRecorderSrc *src = CINNAMON_RECORDER_SRC (base_src);

  g_mutex_lock (&src->queue_lock);
  src->flushing = TRUE;
  src->eos = FALSE;
  g_queue_foreach (src->queue, (GFunc) gst_buffer_unref, NULL);
  g_queue_clear (src->queue);
  g_cond_signal (&src->queue_cond);
  g_mutex_unlock (&src->queue_lock);

  return TRUE;
}

static gboolean
cinnamon_recorder_src_send_event (GstElement * element, GstEvent * event)
{
  CinnamonRecorderSrc *src = CINNAMON_RECORDER_SRC (element);
  gboolean res;

  if (GST_EVENT_TYPE (event) == GST_EVENT_EOS)
    {
      cinnamon_recorder_src_close (src);
      gst_event_unref (event);
      res = TRUE;
    }
  else
    {
      res = GST_CALL_PARENT_WITH_DEFAULT (GST_ELEMENT_CLASS, send_event, (element,
              event), FALSE);
    }
  return res;
}

/* The create() virtual function is responsible for returning the next buffer.
 * We just pop buffers off of the queue and block if necessary.
 */
static GstFlowReturn
cinnamon_recorder_src_create (GstPushSrc  *push_src,
			   GstBuffer  **buffer_out)
{
  CinnamonRecorderSrc *src = CINNAMON_RECORDER_SRC (push_src);
  GstBuffer *buffer;

  g_mutex_lock (&src->queue_lock);
  while (TRUE) {
    /* int the flushing state we just return FLUSHING */
    if (src->flushing) {
      g_mutex_unlock (&src->queue_lock);
      return GST_FLOW_FLUSHING;
    }

    buffer = g_queue_pop_head (src->queue);

    /* we have a buffer, exit the loop to handle it */
    if (buffer != NULL)
      break;

    /* no buffer, check EOS */
    if (src->eos) {
      g_mutex_unlock (&src->queue_lock);
      return GST_FLOW_EOS;
    }
    /* wait for something to happen and try again */
    g_cond_wait (&src->queue_cond, &src->queue_lock);
  }
  g_mutex_unlock (&src->queue_lock);

  cinnamon_recorder_src_update_memory_used (src,
					 - (int)(gst_buffer_get_size(buffer) / 1024));

  *buffer_out = buffer;

  return GST_FLOW_OK;
}

static void
cinnamon_recorder_src_set_caps (CinnamonRecorderSrc *src,
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
      /* The capabilities will be negotiated with the downstream element
       * and set on the pad when the first buffer is pushed.
       */
      src->caps = gst_caps_copy (caps);
    }
  else
    src->caps = NULL;
}

static void
cinnamon_recorder_src_finalize (GObject *object)
{
  CinnamonRecorderSrc *src = CINNAMON_RECORDER_SRC (object);

  if (src->memory_used_update_idle) {
    g_source_remove (src->memory_used_update_idle);
    src->memory_used_update_idle = 0;
  }

  cinnamon_recorder_src_set_caps (src, NULL);
  g_queue_free_full (src->queue, (GDestroyNotify) gst_buffer_unref);

  g_mutex_clear (&src->mutex);
  g_mutex_clear (&src->queue_lock);
  g_cond_clear (&src->queue_cond);

  G_OBJECT_CLASS (cinnamon_recorder_src_parent_class)->finalize (object);
}

static void
cinnamon_recorder_src_set_property (GObject      *object,
				 guint         prop_id,
				 const GValue *value,
				 GParamSpec   *pspec)
{
  CinnamonRecorderSrc *src = CINNAMON_RECORDER_SRC (object);

  switch (prop_id)
    {
    case PROP_CAPS:
      cinnamon_recorder_src_set_caps (src, gst_value_get_caps (value));
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_recorder_src_get_property (GObject         *object,
				 guint            prop_id,
				 GValue          *value,
				 GParamSpec      *pspec)
{
  CinnamonRecorderSrc *src = CINNAMON_RECORDER_SRC (object);

  switch (prop_id)
    {
    case PROP_CAPS:
      gst_value_set_caps (value, src->caps);
      break;
    case PROP_MEMORY_USED:
      g_mutex_lock (&src->mutex);
      g_value_set_uint (value, src->memory_used);
      g_mutex_unlock (&src->mutex);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
    }
}

static void
cinnamon_recorder_src_class_init (CinnamonRecorderSrcClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);
  GstElementClass *element_class = GST_ELEMENT_CLASS (klass);
  GstBaseSrcClass *base_src_class = GST_BASE_SRC_CLASS (klass);
  GstPushSrcClass *push_src_class = GST_PUSH_SRC_CLASS (klass);

  static GstStaticPadTemplate src_template =
    GST_STATIC_PAD_TEMPLATE ("src",
			     GST_PAD_SRC,
			     GST_PAD_ALWAYS,
			     GST_STATIC_CAPS_ANY);

  object_class->finalize = cinnamon_recorder_src_finalize;
  object_class->set_property = cinnamon_recorder_src_set_property;
  object_class->get_property = cinnamon_recorder_src_get_property;

  g_object_class_install_property (object_class,
                                   PROP_CAPS,
                                   g_param_spec_boxed ("caps",
						       "Caps",
						       "Fixed GstCaps for the source",
						       GST_TYPE_CAPS,
						       G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (object_class,
                                   PROP_MEMORY_USED,
                                   g_param_spec_uint ("memory-used",
						     "Memory Used",
						     "Memory currently used by the queue (in kB)",
						      0, G_MAXUINT, 0,
						      G_PARAM_READABLE | G_PARAM_STATIC_STRINGS));
  gst_element_class_add_pad_template (element_class,
				      gst_static_pad_template_get (&src_template));

  gst_element_class_set_details_simple (element_class,
					"CinnamonRecorderSrc",
					"Generic/Src",
					"Feed screen capture data to a pipeline",
					"Owen Taylor <otaylor@redhat.com>");

  element_class->send_event = cinnamon_recorder_src_send_event;

  base_src_class->negotiate = cinnamon_recorder_src_negotiate;
  base_src_class->unlock = cinnamon_recorder_src_unlock;
  base_src_class->unlock_stop = cinnamon_recorder_src_unlock_stop;
  base_src_class->start = cinnamon_recorder_src_start;
  base_src_class->stop = cinnamon_recorder_src_stop;

  push_src_class->create = cinnamon_recorder_src_create;
}

/**
 * cinnamon_recorder_src_add_buffer:
 *
 * Adds a buffer to the internal queue to be pushed out at the next opportunity.
 * There is no flow control, so arbitrary amounts of memory may be used by
 * the buffers on the queue. The buffer contents must match the #GstCaps
 * set in the :caps property.
 */
void
cinnamon_recorder_src_add_buffer (CinnamonRecorderSrc *src,
			       GstBuffer        *buffer)
{
  g_return_if_fail (CINNAMON_IS_RECORDER_SRC (src));
  g_return_if_fail (src->caps != NULL);

  cinnamon_recorder_src_update_memory_used (src,
					 (int)(gst_buffer_get_size(buffer) / 1024));

  g_mutex_lock (&src->queue_lock);
  g_queue_push_tail (src->queue, gst_buffer_ref (buffer));
  g_cond_signal (&src->queue_cond);
  g_mutex_unlock (&src->queue_lock);
}

/**
 * cinnamon_recorder_src_close:
 *
 * Indicates the end of the input stream. Once all previously added buffers have
 * been pushed out an end-of-stream message will be sent.
 */
void
cinnamon_recorder_src_close (CinnamonRecorderSrc *src)
{
  /* We can't send a message to the source immediately or buffers that haven't
   * been pushed yet will be discarded. Instead mark ourselves EOS, which will
   * make us send an event once everything has been pushed.
   */
  g_mutex_lock (&src->queue_lock);
  src->eos = TRUE;
  g_cond_signal (&src->queue_cond);
  g_mutex_unlock (&src->queue_lock);
}

static gboolean
plugin_init (GstPlugin *plugin)
{
  gst_element_register(plugin, "cinnamonrecordersrc", GST_RANK_NONE,
		       CINNAMON_TYPE_RECORDER_SRC);

  return TRUE;
}

/**
 * cinnamon_recorder_src_register:
 * Registers a plugin holding our single element to use privately in
 * this application. Can safely be called multiple times.
 */
void
cinnamon_recorder_src_register (void)
{
  static gboolean registered = FALSE;
  if (registered)
    return;

  gst_plugin_register_static (GST_VERSION_MAJOR, GST_VERSION_MINOR,
			      "cinnamonrecorder",
			      "Plugin for CinnamonRecorder",
			      plugin_init,
			      "0.1",
			      "LGPL",
			      "cinnamon", "cinnamon", "https://projects.linuxmint.com/cinnamon/");

  registered = TRUE;
}
