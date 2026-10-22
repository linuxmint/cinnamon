// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

// Panel initialization must expose the complete panel state to applet constructors.
const JsUnit = imports.jsUnit;
const Environment = imports.ui.environment;
Environment.init();

const St = imports.gi.St;
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;

const assertEquals = JsUnit.assertEquals;
let scenarios = 0;

// These fixtures replace actor creation and applet loading, not the methods
// under test. Settings, module overrides and Main references are restored even
// when an assertion fails. No Cinnamon session or applet extension is started.
function withPanels(options, check) {
    const {entries, definitions = [], existing = [], monitorCount = 3,
        profile = profiles[1]} = options;
    const saved = {
        panelManager: Main.panelManager,
        panel: Main.panel,
        getPanelsEnabledList: Panel.getPanelsEnabledList,
        getAppletDefinition: AppletManager.getAppletDefinition,
        loadAppletsOnPanel: AppletManager.loadAppletsOnPanel,
        updateAppletsOnPanel: AppletManager.updateAppletsOnPanel,
        logWarning: global.logWarning,
    };
    const events = [];
    const warnings = [];
    const constructed = [];
    const manager = {
        panels: [], panelsMeta: [], monitorCount,
        handlingPanelsChanged: false, handling_panels_changed: false,
        _onPanelsEnabledChanged: Panel.PanelManager.prototype._onPanelsEnabledChanged,
        _setMainPanel: Panel.PanelManager.prototype._setMainPanel,
        _loadPanel(id, monitor, position, ...args) {
            // The final two arguments are the target arrays in both implementations.
            const [panels, meta] = args.slice(-2);
            meta[id] = [monitor, position];
            if (monitor >= monitorCount)
                return null;
            const panel = makePanel(id, monitor, position);
            panels[id] = panel;
            return panel;
        },
        _adjustVerticalPanelHeights() { events.push('adjust'); },
        _checkCanAddPanel() {}, _checkCanAdd() {}, _updateAllPointerBarriers() {},
        _fullCornerLoad() {},
    };

    function makePanel(id, monitor, position) {
        // The runner evaluates tests separately from imported modules. Give
        // fixture objects an own maybeGet method instead of relying on the
        // import context's Object.prototype extensions.
        const fullcolor = Object.assign({maybeGet(key) { return this[key]; }}, profile.fullcolor);
        const symbolic = Object.assign({maybeGet(key) { return this[key]; }}, profile.symbolic);
        const panel = {
            panelId: id, monitorIndex: monitor, panelPosition: position,
            monitor: {x: monitor * 1920}, _destroyed: false,
            height: profile.height * global.ui_scale,
            heightForZones: profile.height * global.ui_scale,
            _panelZoneSizes: {fullcolor: {}, symbolic: {}},
            getPanelZoneIconSize: Panel.Panel.prototype.getPanelZoneIconSize,
            updatePosition(newMonitor, newPosition) {
                this.monitorIndex = newMonitor;
                this.panelPosition = newPosition;
                events.push('move:' + id);
            },
            _moveResizePanel() {}, _destroycorners() {},
            destroy() {
                events.push('destroy:' + id);
                this._destroyed = true;
                this.monitor = null;
            },
        };
        for (const zone of ['left', 'center', 'right']) {
            panel._panelZoneSizes.fullcolor[zone] =
                Panel.Panel.prototype._clampPanelZoneColorIconSize.call(
                    panel, fullcolor, 'fullcolor', zone,
                    {left: 0, center: 0, right: 0});
            panel._panelZoneSizes.symbolic[zone] =
                Panel.Panel.prototype._clampPanelZoneSymbolicIconSize.call(
                    panel, symbolic, 'symbolic', zone,
                    {left: 28, center: 28, right: 28});
        }
        return panel;
    }

    try {
        Main.panelManager = manager;
        Panel.getPanelsEnabledList = () => entries.slice();
        global.logWarning = message => warnings.push(message);
        AppletManager.getAppletDefinition = ({applet_id}) =>
            definitions.find(definition => definition.applet_id === applet_id);
        AppletManager.updateAppletsOnPanel = panel => events.push('update:' + panel.panelId);
        AppletManager.loadAppletsOnPanel = panel => {
            events.push('load:' + panel.panelId);
            for (const definition of definitions.filter(def => def.panelId === panel.panelId)) {
                if (definition.readLegacyMain)
                    events.push('legacy-monitor-x:' + Main.panel.monitor.x);
                const applet = {
                    instance_id: definition.applet_id, locationLabel: 'right', panel: null,
                    _getPanelInfo: Applet.Applet.prototype._getPanelInfo,
                    getPanelIconSize: Applet.Applet.prototype.getPanelIconSize,
                };
                applet._getPanelInfo(definition.applet_id);
                const size = applet.getPanelIconSize(definition.type);
                constructed.push({definition, applet, size,
                    registeredPanel: manager.panels[panel.panelId],
                    mainPanel: Main.panel,
                    visiblePanelIds: manager.panels.filter(Boolean).map(p => p.panelId).join(',')});
                // AppletManager assigns the panel after the constructor returns.
                applet.panel = panel;
            }
        };
        for (const [id, monitor, position] of existing) {
            manager.panels[id] = makePanel(id, monitor, position);
            manager.panelsMeta[id] = [monitor, position];
        }
        Main.panel = manager.panels.find(Boolean);
        const initialPanels = manager.panels.slice();
        manager._onPanelsEnabledChanged();
        check({manager, initialPanels, events, warnings, constructed});
        scenarios++;
    } finally {
        Main.panelManager = saved.panelManager;
        Main.panel = saved.panel;
        Panel.getPanelsEnabledList = saved.getPanelsEnabledList;
        AppletManager.getAppletDefinition = saved.getAppletDefinition;
        AppletManager.loadAppletsOnPanel = saved.loadAppletsOnPanel;
        AppletManager.updateAppletsOnPanel = saved.updateAppletsOnPanel;
        global.logWarning = saved.logWarning;
    }
}

// Explicit expected values exercise existing Cinnamon size computation, including
// small panels, oversized requests, automatic sizes, legacy sizes and defaults.
const profiles = [
    {height: 22,
        fullcolor: {left: 16, center: 22, right: 48},
        symbolic: {left: 8, center: 18, right: 28},
        expectedColor: {left: 16, center: 22, right: 22},
        expectedSymbolic: {left: 10, center: 18, right: 22}},
    {height: 40,
        fullcolor: {left: 24, center: 32, right: 48},
        symbolic: {left: 12, center: 28, right: 44},
        expectedColor: {left: 24, center: 32, right: 32},
        expectedSymbolic: {left: 12, center: 28, right: 40}},
    {height: 64,
        fullcolor: {left: 16, center: 32, right: 48},
        symbolic: {left: 12, center: 28, right: 64},
        expectedColor: {left: 16, center: 32, right: 48},
        expectedSymbolic: {left: 12, center: 28, right: 50}},
    {height: 40,
        fullcolor: {left: 0, center: -1, right: 0},
        symbolic: {left: 12, center: 28, right: 44},
        expectedColor: {left: 32, center: 40, right: 32},
        expectedSymbolic: {left: 12, center: 28, right: 40}},
    {height: 32, fullcolor: {}, symbolic: {},
        expectedColor: {left: 32, center: 32, right: 32},
        expectedSymbolic: {left: 28, center: 28, right: 28}},
];

for (const position of ['top', 'bottom', 'left', 'right']) {
    for (const monitor of [0, 2]) {
        for (const profile of profiles) {
            const definitions = [];
            for (const zone of ['left', 'center', 'right']) {
                for (const type of [St.IconType.FULLCOLOR, St.IconType.SYMBOLIC]) {
                    definitions.push({panelId: 1, applet_id: String(definitions.length + 1),
                        location_label: zone, uuid: 'test', type});
                }
            }
            withPanels({entries: ['1:' + monitor + ':' + position], definitions, profile}, result => {
                assertEquals('All applets constructed', 6, result.constructed.length);
                assertEquals('No missing-panel warnings', 0, result.warnings.length);
                for (const item of result.constructed) {
                    const expected = item.definition.type === St.IconType.SYMBOLIC
                        ? profile.expectedSymbolic : profile.expectedColor;
                    assertEquals('Constructor size', expected[item.definition.location_label], item.size);
                    assertEquals('Constructor zone', item.definition.location_label, item.applet.locationLabel);
                    assertEquals('Panel registered at construction', result.manager.panels[1], item.registeredPanel);
                    assertEquals('Main panel registered at construction', result.manager.panels[1], item.mainPanel);
                }
                assertEquals('Panel monitor', monitor, result.manager.panels[1].monitorIndex);
                assertEquals('Panel position', Panel.getPanelLocFromName(position), result.manager.panels[1].panelPosition);
            });
        }
    }
}

// Complete state must be visible even to the first constructor on another monitor.
withPanels({entries: ['1:0:bottom', '4:2:left'], definitions: [
    {panelId: 1, applet_id: '1', location_label: 'left', uuid: 'test', type: St.IconType.FULLCOLOR},
    {panelId: 4, applet_id: '2', location_label: 'center', uuid: 'test', type: St.IconType.SYMBOLIC},
]}, result => {
    assertEquals(2, result.constructed.length);
    for (const item of result.constructed)
        assertEquals('1,4', item.visiblePanelIds);
});

// Adding a panel must retain existing panel identity and avoid reloading its applets.
withPanels({entries: ['1:0:bottom', '4:2:right'], existing: [[1, 0, Panel.PanelLoc.bottom]],
    definitions: [{panelId: 4, applet_id: '2', location_label: 'center', uuid: 'test', type: St.IconType.SYMBOLIC}]}, result => {
    assertEquals(result.initialPanels[1], result.manager.panels[1]);
    assertEquals('load:4', result.events.filter(event => event.startsWith('load:')).join(','));
    assertEquals('1,4', result.constructed[0].visiblePanelIds);
});

withPanels({entries: ['1:1:left'], existing: [[1, 0, Panel.PanelLoc.bottom]]}, result => {
    assertEquals(result.initialPanels[1], result.manager.panels[1]);
    assertEquals(1, result.manager.panels[1].monitorIndex);
    assertEquals(Panel.PanelLoc.left, result.manager.panels[1].panelPosition);
    assertEquals(1, result.events.filter(event => event === 'update:1').length);
    assertEquals(0, result.events.filter(event => event.startsWith('load:')).length);
});

withPanels({entries: ['1:0:bottom'], existing: [[1, 0, Panel.PanelLoc.bottom]]}, result => {
    assertEquals(result.initialPanels[1], result.manager.panels[1]);
    assertEquals(false, result.events.some(event => /^(load|update|destroy):/.test(event)));
});

withPanels({entries: ['4:3:right']}, result => {
    assertEquals(3, result.manager.panelsMeta[4][0]);
    assertEquals(undefined, result.manager.panels[4]);
    assertEquals(0, result.events.filter(event => event.startsWith('load:')).length);
});

withPanels({entries: ['2:0:right'], existing: [[1, 0, Panel.PanelLoc.bottom]],
    definitions: [{panelId: 2, applet_id: '2', location_label: 'center', uuid: 'test', type: St.IconType.SYMBOLIC}]}, result => {
    assertEquals(1, result.events.filter(event => event === 'destroy:1').length);
    assertEquals(undefined, result.manager.panels[1]);
    assertEquals(result.manager.panels[2], result.constructed[0].registeredPanel);
});

// Compatibility applets may access Main.panel directly during construction.
withPanels({entries: ['2:0:bottom'], existing: [[1, 0, Panel.PanelLoc.bottom]],
    definitions: [{panelId: 2, applet_id: '2', location_label: 'left', uuid: 'test',
        type: St.IconType.FULLCOLOR, readLegacyMain: true}]}, result => {
    assertEquals(true, result.events.includes('legacy-monitor-x:0'));
    assertEquals(result.manager.panels[2], result.constructed[0].mainPanel);
});

print('Panel initialization: ' + scenarios + ' scenarios passed');
