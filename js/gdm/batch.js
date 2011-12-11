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
const Signals = imports.signals;

function Task() {
    this._init.apply(this, arguments);
}

Task.prototype = {
    _init: function(scope, handler) {
        if (scope)
            this.scope = scope;
        else
            this.scope = this;

        this.handler = handler;
    },

    run: function() {
        if (this.handler)
            return this.handler.call(this.scope);

        return null;
    },
};
Signals.addSignalMethods(Task.prototype);

function Hold() {
    this._init.apply(this, arguments);
}

Hold.prototype = {
    __proto__: Task.prototype,

    _init: function() {
        Task.prototype._init.call(this,
                                  this,
                                  function () {
                                      return this;
                                  });

        this._acquisitions = 1;
    },

    acquire: function() {
        if (this._acquisitions <= 0)
            throw new Error("Cannot acquire hold after it's been released");
        this._acquisitions++;
    },

    acquireUntilAfter: function(hold) {
        if (!hold.isAcquired())
            return;

        this.acquire();
        let signalId = hold.connect('release', Lang.bind(this, function() {
                                        hold.disconnect(signalId);
                                        this.release();
                                    }));
    },

    release: function() {
        this._acquisitions--;

        if (this._acquisitions == 0)
            this.emit('release');
    },

    isAcquired: function() {
        return this._acquisitions > 0;
    }
}
Signals.addSignalMethods(Hold.prototype);

function Batch() {
    this._init.apply(this, arguments);
}

Batch.prototype = {
    __proto__: Task.prototype,

    _init: function(scope, tasks) {
        Task.prototype._init.call(this);

        this.tasks = [];

        for (let i = 0; i < tasks.length; i++) {
            let task;

            if (tasks[i] instanceof Task) {
                task = tasks[i];
            } else if (typeof tasks[i] == 'function') {
                task = new Task(scope, tasks[i]);
            } else {
                throw new Error('Batch tasks must be functions or Task, Hold or Batch objects');
            }

            this.tasks.push(task);
        }
    },

    process: function() {
        throw new Error('Not implemented');
    },

    runTask: function() {
        if (!(this._currentTaskIndex in this.tasks)) {
            return null;
        }

        return this.tasks[this._currentTaskIndex].run();
    },

    _finish: function() {
        this.hold.release();
    },

    nextTask: function() {
        this._currentTaskIndex++;

        // if the entire batch of tasks is finished, release
        // the hold and notify anyone waiting on the batch
        if (this._currentTaskIndex >= this.tasks.length) {
            this._finish();
            return;
        }

        this.process();
    },

    _start: function() {
        // acquire a hold to get released when the entire
        // batch of tasks is finished
        this.hold = new Hold();
        this._currentTaskIndex = 0;
        this.process();
    },

    run: function() {
        this._start();

        // hold may be destroyed at this point
        // if we're already done running
        return this.hold;
    },

    cancel: function() {
        this.tasks = this.tasks.splice(0, this._currentTaskIndex + 1);
    }

};
Signals.addSignalMethods(Batch.prototype);

function ConcurrentBatch() {
    this._init.apply(this, arguments);
}

ConcurrentBatch.prototype = {
    __proto__: Batch.prototype,

    _init: function(scope, tasks) {
        Batch.prototype._init.call(this, scope, tasks);
    },

    process: function() {
       let hold = this.runTask();

       if (hold) {
           this.hold.acquireUntilAfter(hold);
       }

       // Regardless of the state of the just run task,
       // fire off the next one, so all the tasks can run
       // concurrently.
       this.nextTask();
    }
};
Signals.addSignalMethods(ConcurrentBatch.prototype);

function ConsecutiveBatch() {
    this._init.apply(this, arguments);
}

ConsecutiveBatch.prototype = {
    __proto__: Batch.prototype,

    _init: function(scope, tasks) {
        Batch.prototype._init.call(this, scope, tasks);
    },

    process: function() {
       let hold = this.runTask();

       if (hold && hold.isAcquired()) {
           // This task is inhibiting the batch. Wait on it
           // before processing the next one.
           let signalId = hold.connect('release',
                                       Lang.bind(this, function() {
                                           hold.disconnect(signalId);
                                           this.nextTask();
                                       }));
           return;
       } else {
           // This task finished, process the next one
           this.nextTask();
       }
    }
};
Signals.addSignalMethods(ConsecutiveBatch.prototype);
