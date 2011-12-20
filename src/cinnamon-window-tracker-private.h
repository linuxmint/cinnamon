/* -*- mode: C; c-file-style: "gnu"; indent-tabs-mode: nil; -*- */
#ifndef __CINNAMON_WINDOW_TRACKER_PRIVATE_H__
#define __CINNAMON_WINDOW_TRACKER_PRIVATE_H__

#include "cinnamon-window-tracker.h"

void _cinnamon_window_tracker_add_child_process_app (CinnamonWindowTracker *tracker,
                                                  GPid                pid,
                                                  CinnamonApp           *app);

#endif
