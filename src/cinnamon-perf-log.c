/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */

#include "config.h"

#include <string.h>

#include "cinnamon-perf-log.h"

typedef struct _CinnamonPerfEvent CinnamonPerfEvent;
typedef struct _CinnamonPerfStatistic CinnamonPerfStatistic;
typedef struct _CinnamonPerfStatisticsClosure CinnamonPerfStatisticsClosure;
typedef union  _CinnamonPerfStatisticValue CinnamonPerfStatisticValue;
typedef struct _CinnamonPerfBlock CinnamonPerfBlock;

/**
 * SECTION:cinnamon-perf-log
 * @short_description: Event recorder for performance measurement
 *
 * CinnamonPerfLog provides a way for different parts of the code to
 * record information for subsequent analysis and interactive
 * exploration. Events exist of a timestamp, an event ID, and
 * arguments to the event.
 *
 * Emphasis is placed on storing recorded events in a compact
 * fashion so log recording disturbs the execution of the program
 * as little as possible, however events should not be recorded
 * at too fine a granularity - an event that is recorded once
 * per frame or once per user action is appropriate, an event that
 * occurs many times per frame is not.
 *
 * Arguments are identified by a D-Bus style signature; at the moment
 * only a limited number of event signatures are supported to
 * simplify the code.
 */
struct _CinnamonPerfLog
{
  GObject parent;

  GPtrArray *events;
  GHashTable *events_by_name;
  GPtrArray *statistics;
  GHashTable *statistics_by_name;

  GPtrArray *statistics_closures;

  GQueue *blocks;

  gint64 start_time;
  gint64 last_time;

  guint statistics_timeout_id;

  guint enabled : 1;
};

struct _CinnamonPerfLogClass
{
  GObjectClass parent_class;
};

struct _CinnamonPerfEvent
{
  guint16 id;
  char *name;
  char *description;
  char *signature;
};

union _CinnamonPerfStatisticValue
{
  int i;
  gint64 x;
};

struct _CinnamonPerfStatistic
{
  CinnamonPerfEvent *event;

  CinnamonPerfStatisticValue current_value;
  CinnamonPerfStatisticValue last_value;

  guint initialized : 1;
  guint recorded : 1;
};

struct _CinnamonPerfStatisticsClosure
{
  CinnamonPerfStatisticsCallback callback;
  gpointer user_data;
  GDestroyNotify notify;
};

/* The events in the log are stored in a linked list of fixed size
 * blocks.
 *
 * Note that the power-of-two nature of BLOCK_SIZE here is superficial
 * since the allocated block has the 'bytes' field and malloc
 * overhead. The current value is well below the size that will
 * typically be independently mmapped by the malloc implementation so
 * it doesn't matter. If we switched to mmapping blocks manually
 * (perhaps to avoid polluting malloc statistics), we'd want to use a
 * different value of BLOCK_SIZE.
 */
#define BLOCK_SIZE 8192

struct _CinnamonPerfBlock
{
  guint32 bytes;
  guchar buffer[BLOCK_SIZE];
};

/* Number of milliseconds between periodic statistics collection when
 * events are enabled. Statistics collection can also be explicitly
 * triggered.
 */
#define STATISTIC_COLLECTION_INTERVAL_MS 5000

/* Builtin events */
enum {
  EVENT_SET_TIME,
  EVENT_STATISTICS_COLLECTED
};

G_DEFINE_TYPE(CinnamonPerfLog, cinnamon_perf_log, G_TYPE_OBJECT);

static gint64
get_time (void)
{
  return g_get_monotonic_time ();
}

static void
cinnamon_perf_log_init (CinnamonPerfLog *perf_log)
{
  perf_log->events = g_ptr_array_new ();
  perf_log->events_by_name = g_hash_table_new (g_str_hash, g_str_equal);
  perf_log->statistics = g_ptr_array_new ();
  perf_log->statistics_by_name = g_hash_table_new (g_str_hash, g_str_equal);
  perf_log->statistics_closures = g_ptr_array_new ();
  perf_log->blocks = g_queue_new ();

  /* This event is used when timestamp deltas are greater than
   * fits in a gint32. 0xffffffff microseconds is about 70 minutes, so this
   * is not going to happen in normal usage. It might happen if performance
   * logging is enabled some time after starting Cinnamon */
  cinnamon_perf_log_define_event (perf_log, "perf.setTime", "", "x");
  g_assert (perf_log->events->len == EVENT_SET_TIME + 1);

  /* The purpose of this event is to allow us to optimize out storing
   * statistics that haven't changed. We want to mark every time we
   * collect statistics even if we don't record any individual
   * statistics so that we can distinguish sudden changes from gradual changes.
   *
   * The argument is the number of microseconds that statistics collection
   * took; we record that since statistics collection could start taking
   * significant time if we do things like grub around in /proc/
   */
  cinnamon_perf_log_define_event (perf_log, "perf.statisticsCollected",
                               "Finished collecting statistics",
                               "x");
  g_assert (perf_log->events->len == EVENT_STATISTICS_COLLECTED + 1);

  perf_log->start_time = perf_log->last_time = get_time();
}

static void
cinnamon_perf_log_class_init (CinnamonPerfLogClass *class)
{
}

/**
 * cinnamon_perf_log_get_default:
 *
 * Gets the global singleton performance log. This is initially disabled
 * and must be explicitly enabled with cinnamon_perf_log_set_enabled().
 *
 * Return value: (transfer none): the global singleton performance log
 */
CinnamonPerfLog *
cinnamon_perf_log_get_default (void)
{
  static CinnamonPerfLog *perf_log;

  if (perf_log == NULL)
    perf_log = g_object_new (CINNAMON_TYPE_PERF_LOG, NULL);

  return perf_log;
}

static gboolean
statistics_timeout (gpointer data)
{
  CinnamonPerfLog *perf_log = data;

  cinnamon_perf_log_collect_statistics (perf_log);

  return TRUE;
}

/**
 * cinnamon_perf_log_set_enabled:
 * @perf_log: a #CinnamonPerfLog
 * @enabled: whether to record events
 *
 * Sets whether events are currently being recorded.
 */
void
cinnamon_perf_log_set_enabled (CinnamonPerfLog *perf_log,
                            gboolean      enabled)
{
  enabled = enabled != FALSE;

  if (enabled != perf_log->enabled)
    {
      perf_log->enabled = enabled;

      if (enabled)
        {
          perf_log->statistics_timeout_id = g_timeout_add (STATISTIC_COLLECTION_INTERVAL_MS,
                                                           statistics_timeout,
                                                           perf_log);
        }
      else
        {
          if (perf_log->statistics_timeout_id){
            g_source_remove (perf_log->statistics_timeout_id);
            perf_log->statistics_timeout_id = 0;
          }
        }
    }
}

static CinnamonPerfEvent *
define_event (CinnamonPerfLog *perf_log,
              const char   *name,
              const char   *description,
              const char   *signature)
{
  CinnamonPerfEvent *event;

  if (strcmp (signature, "") != 0 &&
      strcmp (signature, "s") != 0 &&
      strcmp (signature, "i") != 0 &&
      strcmp (signature, "x") != 0)
    {
      g_warning ("Only supported event signatures are '', 's', 'i', and 'x'\n");
      return NULL;
    }

  if (perf_log->events->len == 65536)
    {
      g_warning ("Maximum number of events defined\n");
      return NULL;
    }

  /* We could do stricter validation, but this will break our JSON dumps */
  if (strchr (name, '"') != NULL)
    {
      g_warning ("Event names can't include '\"'");
      return NULL;
    }

  if (g_hash_table_lookup (perf_log->events_by_name, name) != NULL)
    {
      g_warning ("Duplicate event for '%s'\n", name);
      return NULL;
    }

  event = g_slice_new (CinnamonPerfEvent);

  event->id = perf_log->events->len;
  event->name = g_strdup (name);
  event->signature = g_strdup (signature);
  event->description = g_strdup (description);

  g_ptr_array_add (perf_log->events, event);
  g_hash_table_insert (perf_log->events_by_name, event->name, event);

  return event;
}

/**
 * cinnamon_perf_log_define_event:
 * @perf_log: a #CinnamonPerfLog
 * @name: name of the event. This should of the form
 *   '<namespace>.<specific event>', for example
 *   'clutter.stagePaintDone'.
 * @description: human readable description of the event.
 * @signature: signature defining the arguments that event takes.
 *   This is a string of type characters, using the same characters
 *   as D-Bus or GVariant. Only a very limited number of signatures
 *   are supported: , '', 's', 'i', and 'x'. This mean respectively:
 *   no arguments, one string, one 32-bit integer, and one 64-bit
 *   integer.
 *
 * Defines a performance event for later recording.
 */
void
cinnamon_perf_log_define_event (CinnamonPerfLog *perf_log,
                             const char   *name,
                             const char   *description,
                             const char   *signature)
{
  define_event (perf_log, name, description, signature);
}

static CinnamonPerfEvent *
lookup_event (CinnamonPerfLog *perf_log,
              const char   *name,
              const char   *signature)
{
  CinnamonPerfEvent *event = g_hash_table_lookup (perf_log->events_by_name, name);

  if (G_UNLIKELY (event == NULL))
    {
      g_warning ("Discarding unknown event '%s'\n", name);
      return NULL;
    }

  if (G_UNLIKELY (strcmp (event->signature, signature) != 0))
    {
      g_warning ("Event '%s'; defined with signature '%s', used with '%s'\n",
                 name, event->signature, signature);
      return NULL;
    }

  return event;
}

static void
record_event (CinnamonPerfLog   *perf_log,
              gint64          event_time,
              CinnamonPerfEvent *event,
              const guchar   *bytes,
              size_t          bytes_len)
{
  CinnamonPerfBlock *block;
  size_t total_bytes;
  guint32 time_delta;
  guint32 pos;

  if (!perf_log->enabled)
    return;

  total_bytes = sizeof (gint32) + sizeof (gint16) + bytes_len;
  if (G_UNLIKELY (bytes_len > BLOCK_SIZE || total_bytes > BLOCK_SIZE))
    {
      g_warning ("Discarding oversized event '%s'\n", event->name);
      return;
    }

  if (event_time > perf_log->last_time + G_GINT64_CONSTANT(0xffffffff))
    {
      perf_log->last_time = event_time;
      record_event (perf_log, event_time,
                    lookup_event (perf_log, "perf.setTime", "x"),
                    (const guchar *)&event_time, sizeof(gint64));
      time_delta = 0;
    }
  else if (event_time < perf_log->last_time)
    time_delta = 0;
  else
    time_delta = (guint32)(event_time - perf_log->last_time);

  perf_log->last_time = event_time;

  if (perf_log->blocks->tail == NULL ||
      total_bytes + ((CinnamonPerfBlock *)perf_log->blocks->tail->data)->bytes > BLOCK_SIZE)
    {
      block = g_new (CinnamonPerfBlock, 1);
      block->bytes = 0;
      g_queue_push_tail (perf_log->blocks, block);
    }
  else
    {
      block = (CinnamonPerfBlock *)perf_log->blocks->tail->data;
    }

  pos = block->bytes;

  memcpy (block->buffer + pos, &time_delta, sizeof (guint32));
  pos += sizeof (guint32);
  memcpy (block->buffer + pos, &event->id, sizeof (guint16));
  pos += sizeof (guint16);
  memcpy (block->buffer + pos, bytes, bytes_len);
  pos += bytes_len;

  block->bytes = pos;
}

/**
 * cinnamon_perf_log_event:
 * @perf_log: a #CinnamonPerfLog
 * @name: name of the event
 *
 * Records a performance event with no arguments.
 */
void
cinnamon_perf_log_event (CinnamonPerfLog *perf_log,
                      const char   *name)
{
  CinnamonPerfEvent *event = lookup_event (perf_log, name, "");
  if (G_UNLIKELY (event == NULL))
    return;

  record_event (perf_log, get_time(), event, NULL, 0);
}

/**
 * cinnamon_perf_log_event_i:
 * @perf_log: a #CinnamonPerfLog
 * @name: name of the event
 * @arg: the argument
 *
 * Records a performance event with one 32-bit integer argument.
 */
void
cinnamon_perf_log_event_i (CinnamonPerfLog *perf_log,
                        const char   *name,
                        gint32        arg)
{
  CinnamonPerfEvent *event = lookup_event (perf_log, name, "i");
  if (G_UNLIKELY (event == NULL))
    return;

  record_event (perf_log, get_time(), event,
                (const guchar *)&arg, sizeof (arg));
}

/**
 * cinnamon_perf_log_event_x:
 * @perf_log: a #CinnamonPerfLog
 * @name: name of the event
 * @arg: the argument
 *
 * Records a performance event with one 64-bit integer argument.
 */
void
cinnamon_perf_log_event_x (CinnamonPerfLog *perf_log,
                        const char   *name,
                        gint64        arg)
{
  CinnamonPerfEvent *event = lookup_event (perf_log, name, "x");
  if (G_UNLIKELY (event == NULL))
    return;

  record_event (perf_log, get_time(), event,
                (const guchar *)&arg, sizeof (arg));
}

/**
 * cinnamon_perf_log_event_s:
 * @perf_log: a #CinnamonPerfLog
 * @name: name of the event
 * @arg: the argument
 *
 * Records a performance event with one string argument.
 */
void
cinnamon_perf_log_event_s (CinnamonPerfLog *perf_log,
                         const char   *name,
                         const char   *arg)
{
  CinnamonPerfEvent *event = lookup_event (perf_log, name, "s");
  if (G_UNLIKELY (event == NULL))
    return;

  record_event (perf_log, get_time(), event,
                (const guchar *)arg, strlen (arg) + 1);
}

/**
 * cinnamon_perf_log_define_statistic:
 * @perf_log: a #CinnamonPerfLog
 * @name: name of the statistic and of the corresponding event.
 *  This should follow the same guidelines as for cinnamon_perf_log_define_event()
 * @description: human readable description of the statistic.
 * @signature: The type of the data stored for statistic. Must
 *  currently be 'i' or 'x'.
 *
 * Defines a statistic. A statistic is a numeric value that is stored
 * by the performance log and recorded periodically or when
 * cinnamon_perf_log_collect_statistics() is called explicitly.
 *
 * Code that defines a statistic should update it by calling
 * the update function for the particular data type of the statistic,
 * such as cinnamon_perf_log_update_statistic_i(). This can be done
 * at any time, but would normally done inside a function registered
 * with cinnamon_perf_log_add_statistics_callback(). These functions
 * are called immediately before statistics are recorded.
 */
void
cinnamon_perf_log_define_statistic (CinnamonPerfLog *perf_log,
                                 const char   *name,
                                 const char   *description,
                                 const char   *signature)
{
  CinnamonPerfEvent *event;
  CinnamonPerfStatistic *statistic;

  if (strcmp (signature, "i") != 0 &&
      strcmp (signature, "x") != 0)
    {
      g_warning ("Only supported statistic signatures are 'i' and 'x'\n");
      return;
    }

  event = define_event (perf_log, name, description, signature);
  if (event == NULL)
    return;

  statistic = g_slice_new (CinnamonPerfStatistic);
  statistic->event = event;

  statistic->initialized = FALSE;
  statistic->recorded = FALSE;

  g_ptr_array_add (perf_log->statistics, statistic);
  g_hash_table_insert (perf_log->statistics_by_name, event->name, statistic);
}

static CinnamonPerfStatistic *
lookup_statistic (CinnamonPerfLog *perf_log,
                  const char   *name,
                  const char   *signature)
{
  CinnamonPerfStatistic *statistic = g_hash_table_lookup (perf_log->statistics_by_name, name);

  if (G_UNLIKELY (statistic == NULL))
    {
      g_warning ("Unknown statistic '%s'\n", name);
      return NULL;
    }

  if (G_UNLIKELY (strcmp (statistic->event->signature, signature) != 0))
    {
      g_warning ("Statistic '%s'; defined with signature '%s', used with '%s'\n",
                 name, statistic->event->signature, signature);
      return NULL;
    }

  return statistic;
}

/**
 * cinnamon_perf_log_update_statistic_i:
 * @perf_log: a #CinnamonPerfLog
 * @name: name of the statistic
 * @value: new value for the statistic
 *
 * Updates the current value of an 32-bit integer statistic.
 */
void
cinnamon_perf_log_update_statistic_i (CinnamonPerfLog *perf_log,
                                   const char   *name,
                                   gint32        value)
{
  CinnamonPerfStatistic *statistic;

  statistic = lookup_statistic (perf_log, name, "i");
  if (G_UNLIKELY (statistic == NULL))
      return;

  statistic->current_value.i = value;
  statistic->initialized = TRUE;
}

/**
 * cinnamon_perf_log_update_statistic_x:
 * @perf_log: a #CinnamonPerfLog
 * @name: name of the statistic
 * @value: new value for the statistic
 *
 * Updates the current value of an 64-bit integer statistic.
 */
void
cinnamon_perf_log_update_statistic_x (CinnamonPerfLog *perf_log,
                                   const char   *name,
                                   gint64        value)
{
  CinnamonPerfStatistic *statistic;

  statistic = lookup_statistic (perf_log, name, "x");
  if (G_UNLIKELY (statistic == NULL))
      return;

  statistic->current_value.x = value;
  statistic->initialized = TRUE;
}

/**
 * cinnamon_perf_log_add_statistics_callback:
 * @perf_log: a #CinnamonPerfLog
 * @callback: function to call before recording statistics
 * @user_data: data to pass to @callback
 * @notify: function to call when @user_data is no longer needed
 *
 * Adds a function that will be called before statistics are recorded.
 * The function would typically compute one or more statistics values
 * and call a function such as cinnamon_perf_log_update_statistic_i()
 * to update the value that will be recorded.
 */
void
cinnamon_perf_log_add_statistics_callback (CinnamonPerfLog               *perf_log,
                                        CinnamonPerfStatisticsCallback callback,
                                        gpointer                    user_data,
                                        GDestroyNotify              notify)
{
  CinnamonPerfStatisticsClosure *closure = g_slice_new (CinnamonPerfStatisticsClosure);

  closure->callback = callback;
  closure->user_data = user_data;
  closure->notify = notify;

  g_ptr_array_add (perf_log->statistics_closures, closure);
}

/**
 * cinnamon_perf_log_collect_statistics:
 * @perf_log: a #CinnamonPerfLog
 *
 * Calls all the update functions added with
 * cinnamon_perf_log_add_statistics_callback() and then records events
 * for all statistics, followed by a perf.statisticsCollected event.
 */
void
cinnamon_perf_log_collect_statistics (CinnamonPerfLog *perf_log)
{
  gint64 event_time = get_time ();
  gint64 collection_time;
  guint i;

  if (!perf_log->enabled)
    return;

  for (i = 0; i < perf_log->statistics_closures->len; i++)
    {
      CinnamonPerfStatisticsClosure *closure;

      closure = g_ptr_array_index (perf_log->statistics_closures, i);
      closure->callback (perf_log, closure->user_data);
    }

  collection_time = get_time() - event_time;

  for (i = 0; i < perf_log->statistics->len; i++)
    {
      CinnamonPerfStatistic *statistic = g_ptr_array_index (perf_log->statistics, i);

      if (!statistic->initialized)
        continue;

      switch (statistic->event->signature[0])
        {
        case 'i':
          if (!statistic->recorded ||
              statistic->current_value.i != statistic->last_value.i)
            {
              record_event (perf_log, event_time, statistic->event,
                            (const guchar *)&statistic->current_value.i,
                            sizeof (gint32));
              statistic->last_value.i = statistic->current_value.i;
              statistic->recorded = TRUE;
            }
          break;
        case 'x':
          if (!statistic->recorded ||
              statistic->current_value.x != statistic->last_value.x)
            {
              record_event (perf_log, event_time, statistic->event,
                            (const guchar *)&statistic->current_value.x,
                            sizeof (gint64));
              statistic->last_value.x = statistic->current_value.x;
              statistic->recorded = TRUE;
            }
          break;
        default:
          g_warning("cinnamon_perf_log_collect_statistics: default case");
          break;
        }
    }

  record_event (perf_log, event_time,
                g_ptr_array_index (perf_log->events, EVENT_STATISTICS_COLLECTED),
                (const guchar *)&collection_time, sizeof (gint64));
}

/**
 * cinnamon_perf_log_replay:
 * @perf_log: a #CinnamonPerfLog
 * @replay_function: (scope call): function to call for each event in the log
 * @user_data: data to pass to @replay_function
 *
 * Replays the log by calling the given function for each event
 * in the log.
 */
void
cinnamon_perf_log_replay (CinnamonPerfLog            *perf_log,
                       CinnamonPerfReplayFunction  replay_function,
                       gpointer                 user_data)
{
  gint64 event_time = perf_log->start_time;
  GList *iter;

  for (iter = perf_log->blocks->head; iter; iter = iter->next)
    {
      CinnamonPerfBlock *block = iter->data;
      guint32 pos = 0;

      while (pos < block->bytes)
        {
          CinnamonPerfEvent *event;
          guint16 id;
          guint32 time_delta;
          GValue arg = { 0, };

          memcpy (&time_delta, block->buffer + pos, sizeof (guint32));
          pos += sizeof (guint32);
          memcpy (&id, block->buffer + pos, sizeof (guint16));
          pos += sizeof (guint16);

          if (id == EVENT_SET_TIME)
            {
              /* Internal, we don't include in the replay */
              memcpy (&event_time, block->buffer + pos, sizeof (gint64));
              pos += sizeof (gint64);
              continue;
            }
          else
            {
              event_time += time_delta;
            }

          event = g_ptr_array_index (perf_log->events, id);

          if (strcmp (event->signature, "") == 0)
            {
              /* We need to pass something, so pass an empty string */
              g_value_init (&arg, G_TYPE_STRING);
            }
          else if (strcmp (event->signature, "i") == 0)
            {
              gint32 l;

              memcpy (&l, block->buffer + pos, sizeof (gint32));
              pos += sizeof (gint32);

              g_value_init (&arg, G_TYPE_INT);
              g_value_set_int (&arg, l);
            }
          else if (strcmp (event->signature, "x") == 0)
            {
              gint64 l;

              memcpy (&l, block->buffer + pos, sizeof (gint64));
              pos += sizeof (gint64);

              g_value_init (&arg, G_TYPE_INT64);
              g_value_set_int64 (&arg, l);
            }
          else if (strcmp (event->signature, "s") == 0)
            {
              g_value_init (&arg, G_TYPE_STRING);
              g_value_set_string (&arg, (char *)block->buffer + pos);
              pos += strlen ((char *)(block->buffer + pos)) + 1;
            }

          replay_function (event_time, event->name, event->signature, &arg, user_data);
          g_value_unset (&arg);
        }
    }
}

static char *
escape_quotes (const char *input)
{
  GString *result;
  const char *p;

  if (strchr (input, '"') == NULL)
    return (char *)input;

  result = g_string_new (NULL);
  for (p = input; *p; p++)
    {
      if (*p == '"')
        g_string_append (result, "\\\"");
      else
        g_string_append_c (result, *p);
    }

  return g_string_free (result, FALSE);
}

static gboolean
write_string (GOutputStream *out,
              const char    *str,
              GError       **error)
{
  return g_output_stream_write_all (out, str, strlen (str),
                                    NULL, NULL,
                                    error);
}

/**
 * cinnamon_perf_log_dump_events:
 * @perf_log: a #CinnamonPerfLog
 * @out: output stream into which to write the event definitions
 * @error: location to store #GError, or %NULL
 *
 * Dump the definition of currently defined events and statistics, formatted
 * as JSON, to the specified output stream. The JSON output is an array,
 * with each element being a dictionary of the form:
 *
 * { name: <name of event>,
 *   description: <descrition of string,
 *   statistic: true } (only for statistics)
 *
 * Return value: %TRUE if the dump succeeded. %FALSE if an IO error occurred
 */
gboolean
cinnamon_perf_log_dump_events (CinnamonPerfLog   *perf_log,
                            GOutputStream  *out,
                            GError        **error)
{
  GString *output;
  guint i;

  output = g_string_new (NULL);
  g_string_append (output, "[ ");

  for (i = 0; i < perf_log->events->len; i++)
    {
      CinnamonPerfEvent *event = g_ptr_array_index (perf_log->events, i);
      char *escaped_description = escape_quotes (event->description);
      gboolean is_statistic = g_hash_table_lookup (perf_log->statistics_by_name, event->name) != NULL;

      if (i != 0)
        g_string_append (output, ",\n  ");

      g_string_append_printf (output,
                                "{ \"name\": \"%s\",\n"
                              "    \"description\": \"%s\"",
                              event->name, escaped_description);
      if (is_statistic)
        g_string_append (output, ",\n    \"statistic\": true");

      g_string_append (output, " }");

      if (escaped_description != event->description)
        g_free (escaped_description);
    }

  g_string_append (output, " ]");

  return write_string (out, g_string_free (output, FALSE), error);
}

typedef struct {
  GOutputStream *out;
  GError *error;
  gboolean first;
} ReplayToJsonClosure;

static void
replay_to_json (gint64      time,
                const char *name,
                const char *signature,
                GValue     *arg,
                gpointer    user_data)
{
  ReplayToJsonClosure *closure = user_data;
  char *event_str = NULL;
  gboolean rc;

  if (closure->error != NULL)
    return;

  if (!closure->first)
    {
      if (!write_string (closure->out, ",\n  ", &closure->error))
        return;
    }

  closure->first = FALSE;

  if (strcmp (signature, "") == 0)
    {
      event_str = g_strdup_printf ("[%" G_GINT64_FORMAT ", \"%s\"]", time, name);
    }
  else if (strcmp (signature, "i") == 0)
    {
      event_str = g_strdup_printf ("[%" G_GINT64_FORMAT ", \"%s\", %i]",
                                   time,
                                   name,
                                   g_value_get_int (arg));
    }
  else if (strcmp (signature, "x") == 0)
    {
      event_str = g_strdup_printf ("[%" G_GINT64_FORMAT ", \"%s\", %"G_GINT64_FORMAT "]",
                                   time,
                                   name,
                                   g_value_get_int64 (arg));
    }
  else if (strcmp (signature, "s") == 0)
    {
      const char *arg_str = g_value_get_string (arg);
      char *escaped = escape_quotes (arg_str);

      event_str = g_strdup_printf ("[%" G_GINT64_FORMAT ", \"%s\", \"%s\"]",
                                   time,
                                   name,
                                   g_value_get_string (arg));

      if (escaped != arg_str)
        g_free (escaped);
    }
  else
    {
      g_assert_not_reached ();
    }

  rc = write_string (closure->out, event_str, &closure->error);
  g_free (event_str);
  if (!rc)
      return;
}

/**
 * cinnamon_perf_log_dump_log:
 * @perf_log: a #CinnamonPerfLog
 * @out: output stream into which to write the event log
 * @error: location to store #GError, or %NULL
 *
 * Writes the performance event log, formatted as JSON, to the specified
 * output stream. For performance reasons, the output stream passed
 * in should generally be a buffered (or memory) output stream, since
 * it will be written to in small pieces. The JSON output is an array
 * with the elements of the array also being arrays, of the form
 * '[' <time>, <event name> [, <event_arg>... ] ']'.
 *
 * Return value: %TRUE if the dump succeeded. %FALSE if an IO error occurred
 */
gboolean
cinnamon_perf_log_dump_log (CinnamonPerfLog   *perf_log,
                         GOutputStream  *out,
                         GError        **error)
{
  ReplayToJsonClosure closure;

  closure.out = out;
  closure.error = NULL;
  closure.first = TRUE;

  if (!write_string (out, "[ ", &closure.error))
    return FALSE;

  cinnamon_perf_log_replay (perf_log, replay_to_json, &closure);

  if (closure.error != NULL)
    {
      g_propagate_error (error, closure.error);
      return FALSE;
    }

  if (!write_string (out, " ]", &closure.error))
    return FALSE;

  return TRUE;
}
