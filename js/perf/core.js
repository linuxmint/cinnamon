// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Main = imports.ui.main;
const Scripting = imports.ui.scripting;

// This performance script measure the most important (core) performance
// metrics for the shell. By looking at the output metrics of this script
// someone should be able to get an idea of how well the shell is performing
// on a particular system.

let METRICS = {
    overviewLatencyFirst:
    { description: "Time to first frame after triggering overview, first time",
      units: "us" },
    overviewFpsFirst:
    { description: "Frame rate when going to the overview, first time",
      units: "frames / s" },
    overviewLatencySubsequent:
    { description: "Time to first frame after triggering overview, second time",
      units: "us"},
    overviewFpsSubsequent:
    { description: "Frames rate when going to the overview, second time",
      units: "frames / s" },
    overviewFps5Windows:
    { description: "Frames rate when going to the overview, 5 windows open",
      units: "frames / s" },
    overviewFps10Windows:
    { description: "Frames rate when going to the overview, 10 windows open",
      units: "frames / s" },
    overviewFps5Maximized:
    { description: "Frames rate when going to the overview, 5 maximized windows open",
      units: "frames / s" },
    overviewFps10Maximized:
    { description: "Frames rate when going to the overview, 10 maximized windows open",
      units: "frames / s" },
    overviewFps5Alpha:
    { description: "Frames rate when going to the overview, 5 alpha-transparent windows open",
      units: "frames / s" },
    overviewFps10Alpha:
    { description: "Frames rate when going to the overview, 10 alpha-transparent windows open",
      units: "frames / s" },
    usedAfterOverview:
    { description: "Malloc'ed bytes after the overview is shown once",
      units: "B" },
    leakedAfterOverview:
    { description: "Additional malloc'ed bytes the second time the overview is shown",
      units: "B" },
    applicationsShowTimeFirst:
    { description: "Time to switch to applications view, first time",
      units: "us" },
    applicationsShowTimeSubsequent:
    { description: "Time to switch to applications view, second time",
      units: "us"}
};

let WINDOW_CONFIGS = [
    { width: 640, height: 480, alpha: false, maximized: false, count: 1,  metric: 'overviewFpsSubsequent' },
    { width: 640, height: 480, alpha: false, maximized: false, count: 5,  metric: 'overviewFps5Windows'  },
    { width: 640, height: 480, alpha: false, maximized: false, count: 10, metric: 'overviewFps10Windows'  },
    { width: 640, height: 480, alpha: false, maximized: true,  count: 5,  metric: 'overviewFps5Maximized' },
    { width: 640, height: 480, alpha: false, maximized: true,  count: 10, metric: 'overviewFps10Maximized' },
    { width: 640, height: 480, alpha: true,  maximized: false, count: 5,  metric: 'overviewFps5Alpha' },
    { width: 640, height: 480, alpha: true,  maximized: false, count: 10, metric: 'overviewFps10Alpha' }
];

function run() {
    Scripting.defineScriptEvent("overviewShowStart", "Starting to show the overview");
    Scripting.defineScriptEvent("overviewShowDone", "Overview finished showing");
    Scripting.defineScriptEvent("afterShowHide", "After a show/hide cycle for the overview");
    Scripting.defineScriptEvent("applicationsShowStart", "Starting to switch to applications view");
    Scripting.defineScriptEvent("applicationsShowDone", "Done switching to applications view");

    Main.overview.connect('shown', function() {
                              Scripting.scriptEvent('overviewShowDone');
                          });

    yield Scripting.sleep(1000);

    for (let i = 0; i < 2 * WINDOW_CONFIGS.length; i++) {
        // We go to the overview twice for each configuration; the first time
        // to calculate the mipmaps for the windows, the second time to get
        // a clean set of numbers.
        if ((i % 2) == 0) {
            let config = WINDOW_CONFIGS[i / 2];
            yield Scripting.destroyTestWindows();

            for (let k = 0; k < config.count; k++)
                yield Scripting.createTestWindow(config.width, config.height, config.alpha, config.maximized);

            yield Scripting.waitTestWindows();
            yield Scripting.sleep(1000);
            yield Scripting.waitLeisure();
        }

        Scripting.scriptEvent('overviewShowStart');
        Main.overview.show();

        yield Scripting.waitLeisure();
        Main.overview.hide();
        yield Scripting.waitLeisure();

        global.gc();
        yield Scripting.sleep(1000);
        Scripting.collectStatistics();
        Scripting.scriptEvent('afterShowHide');
    }

    yield Scripting.destroyTestWindows();
    yield Scripting.sleep(1000);

    Main.overview.show();
    yield Scripting.waitLeisure();

    for (let i = 0; i < 2; i++) {
        Scripting.scriptEvent('applicationsShowStart');
        Main.overview._viewSelector.switchTab('applications');
        yield Scripting.waitLeisure();
        Scripting.scriptEvent('applicationsShowDone');
        Main.overview._viewSelector.switchTab('windows');
        yield Scripting.waitLeisure();
    }
}

let showingOverview = false;
let finishedShowingOverview = false;
let overviewShowStart;
let overviewFrames;
let overviewLatency;
let mallocUsedSize = 0;
let overviewShowCount = 0;
let firstOverviewUsedSize;
let haveSwapComplete = false;
let applicationsShowStart;
let applicationsShowCount = 0;

function script_overviewShowStart(time) {
    showingOverview = true;
    finishedShowingOverview = false;
    overviewShowStart = time;
    overviewFrames = 0;
}

function script_overviewShowDone(time) {
    // We've set up the state at the end of the zoom out, but we
    // need to wait for one more frame to paint before we count
    // ourselves as done.
    finishedShowingOverview = true;
}

function script_applicationsShowStart(time) {
    applicationsShowStart = time;
}

function script_applicationsShowDone(time) {
    applicationsShowCount++;
    if (applicationsShowCount == 1)
        METRICS.applicationsShowTimeFirst.value = time - applicationsShowStart;
    else
        METRICS.applicationsShowTimeSubsequent.value = time - applicationsShowStart;
}

function script_afterShowHide(time) {
    if (overviewShowCount == 1) {
        METRICS.usedAfterOverview.value = mallocUsedSize;
    } else {
        METRICS.leakedAfterOverview.value = mallocUsedSize - METRICS.usedAfterOverview.value;
    }
}

function malloc_usedSize(time, bytes) {
    mallocUsedSize = bytes;
}

function _frameDone(time) {
    if (showingOverview) {
        if (overviewFrames == 0)
            overviewLatency = time - overviewShowStart;

        overviewFrames++;
    }

    if (finishedShowingOverview) {
        showingOverview = false;
        finishedShowingOverview = false;
        overviewShowCount++;

        let dt = (time - (overviewShowStart + overviewLatency)) / 1000000;

        // If we see a start frame and an end frame, that would
        // be 1 frame for a FPS computation, hence the '- 1'
        let fps = (overviewFrames - 1) / dt;

        if (overviewShowCount == 1) {
            METRICS.overviewLatencyFirst.value = overviewLatency;
            METRICS.overviewFpsFirst.value = fps;
        } else if (overviewShowCount == 2) {
            METRICS.overviewLatencySubsequent.value = overviewLatency;
        }

        // Other than overviewFpsFirst, we collect FPS metrics the second
        // we show each window configuration. overviewShowCount is 1,2,3...
        if (overviewShowCount % 2 == 0) {
            let config = WINDOW_CONFIGS[(overviewShowCount / 2) - 1];
            METRICS[config.metric].value = fps;
        }
    }
}

function glx_swapComplete(time, swapTime) {
    haveSwapComplete = true;

    _frameDone(swapTime);
}

function clutter_stagePaintDone(time) {
    // If we aren't receiving GLXBufferSwapComplete events, then we approximate
    // the time the user sees a frame with the time we finished doing drawing
    // commands for the frame. This doesn't take into account the time for
    // the GPU to finish painting, and the time for waiting for the buffer
    // swap, but if this are uniform - every frame takes the same time to draw -
    // then it won't upset our FPS calculation, though the latency value
    // will be slightly too low.

    if (!haveSwapComplete)
        _frameDone(time);
}
