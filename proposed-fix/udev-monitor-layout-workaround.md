# Cinnamon monitor layout bug (#9801) — workaround proposal

## Problem

Cinnamon does not remember the monitor layout (e.g. left-of) after a monitor is deactivated and re-enabled. It always defaults to placing the secondary monitor to the right, regardless of previous settings.

## Workaround (functional example using udev and xrandr)

This script and rule automatically re-position the second monitor when it's reconnected or re-enabled:

### 1. Create the shell script

sudo nano /usr/local/bin/cinnamon-monitor-fix.sh

#!/bin/sh

# Re-set the layout if DP-1 (Dell) was just (re)connected

sleep 1        # give Cinnamon a moment to finish its own xrandr call
export DISPLAY=:0
export XAUTHORITY=/var/lib/lightdm/.Xauthority   # adjust if you use GDM/SDDM
USER=$(who | grep '(:0)' | awk '{print $1}')
XAUTHORITY=/home/$USER/.Xauthority DISPLAY=:0 \
xrandr --output DisplayPort-1 --left-of DisplayPort-0 --auto

### Make it executable:

sudo chmod +x /usr/local/bin/cinnamon-monitor-fix.sh

### 2. Add a udev rule that fires when the monitor re-appears

sudo nano /etc/udev/rules.d/99-cinnamon-monitor-fix.rules

ACTION=="change", SUBSYSTEM=="drm", ENV{HOTPLUG}=="1", RUN+="/usr/local/bin/cinnamon-monitor-fix.sh"

### Reload rules:

sudo udevadm control --reload-rules

##########################################################################################################

Proposal

This workaround shows that the monitor layout can be reliably restored with simple logic.

Suggested features for Cinnamon:

    Store and restore previous x/y position of known monitors

    Restore layout automatically on re-enable

    Optional: toggle in Display Settings → “Remember monitor layout”

Thank you!
