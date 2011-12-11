// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/*
 * Copyright 2011 Red Hat, Inc
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
 * 02111-1307, USA.
 */

const Lang = imports.lang;
const UPowerGlib = imports.gi.UPowerGlib;

const ConsoleKit = imports.gdm.consoleKit;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

function PowerMenuButton() {
    this._init();
}

PowerMenuButton.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'system-shutdown', null);
        this._consoleKitManager = new ConsoleKit.ConsoleKitManager();
        this._upClient = new UPowerGlib.Client();

        this._createSubMenu();

        this._upClient.connect('notify::can-suspend',
                               Lang.bind(this, this._updateHaveSuspend));
        this._updateHaveSuspend();

        // ConsoleKit doesn't send notifications when shutdown/reboot
        // are disabled, so we update the menu item each time the menu opens
        this.menu.connect('open-state-changed', Lang.bind(this,
            function(menu, open) {
                if (open) {
                    this._updateHaveShutdown();
                    this._updateHaveRestart();
                }
            }));
        this._updateHaveShutdown();
        this._updateHaveRestart();
    },

    _updateVisibility: function() {
        if (!this._haveSuspend && !this._haveShutdown && !this._haveRestart)
            this.actor.hide();
        else
            this.actor.show();
    },

    _updateHaveShutdown: function() {
        this._consoleKitManager.CanStopRemote(Lang.bind(this,
            function(result, error) {
                if (!error)
                    this._haveShutdown = result;
                else
                    this._haveShutdown = false;

                if (this._haveShutdown) {
                    this._powerOffItem.actor.show();
                } else {
                    this._powerOffItem.actor.hide();
                }

                this._updateVisibility();
            }));
    },

    _updateHaveRestart: function() {
        this._consoleKitManager.CanRestartRemote(Lang.bind(this,
            function(result, error) {
                if (!error)
                    this._haveRestart = result;
                else
                    this._haveRestart = false;

                if (this._haveRestart) {
                    this._restartItem.actor.show();
                } else {
                    this._restartItem.actor.hide();
                }

                this._updateVisibility();
            }));
    },

    _updateHaveSuspend: function() {
        this._haveSuspend = this._upClient.get_can_suspend();

        if (this._haveSuspend)
            this._suspendItem.actor.show();
        else
            this._suspendItem.actor.hide();

        this._updateVisibility();
    },

    _createSubMenu: function() {
        let item;

        item = new PopupMenu.PopupMenuItem(_("Suspend"));
        item.connect('activate', Lang.bind(this, this._onActivateSuspend));
        this.menu.addMenuItem(item);
        this._suspendItem = item;

        item = new PopupMenu.PopupMenuItem(_("Restart"));
        item.connect('activate', Lang.bind(this, this._onActivateRestart));
        this.menu.addMenuItem(item);
        this._restartItem = item;

        item = new PopupMenu.PopupMenuItem(_("Power Off"));
        item.connect('activate', Lang.bind(this, this._onActivatePowerOff));
        this.menu.addMenuItem(item);
        this._powerOffItem = item;
    },

    _onActivateSuspend: function() {
        if (this._haveSuspend)
            this._upClient.suspend_sync(null);
    },

    _onActivateRestart: function() {
        if (this._haveRestart)
            this._consoleKitManager.RestartRemote();
    },

    _onActivatePowerOff: function() {
        if (this._haveShutdown)
            this._consoleKitManager.StopRemote();
    }
};
