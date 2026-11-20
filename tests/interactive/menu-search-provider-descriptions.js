// Run in an isolated Cinnamon session with the menu applet enabled:
// gdbus call --session --dest org.Cinnamon --object-path /org/Cinnamon \
//     --method org.Cinnamon.Eval "$(cat tests/interactive/menu-search-provider-descriptions.js)"
(() => {
    const AppletManager = imports.ui.appletManager;
    const SearchProviderManager = imports.ui.searchProviderManager;
    const St = imports.gi.St;
    const Atk = imports.gi.Atk;
    const definition = AppletManager.definitions.find(item => item.uuid === 'menu@cinnamon.org');
    const menu = definition && definition.applet;
    if (!menu)
        throw new Error('The menu applet must be loaded');

    const launchAll = SearchProviderManager.launch_all;
    const previousSearch = menu.searchEntry.get_text();
    const results = [];

    function check(condition, message) {
        if (!condition)
            throw new Error(message);
    }

    try {
        // Obtain the result button through the menu's normal search callback.
        SearchProviderManager.launch_all = (pattern, callback) => {
            callback({}, [{ id: 'test-project', label: 'Project' }]);
        };
        menu.searchEntry.set_text('cinnamon-description-regression-test');
        check(menu._searchProviderButtons.length === 1, 'Search result was not added');
        const ResultButton = menu._searchProviderButtons[0].constructor;

        for (const [name, showDescription, description, expected] of [
            ['description enabled', true,
                '/home/example/projects/example-project', '/home/example/projects/example-project'],
            ['description disabled', false, '/home/example/projects/example-project', null],
            ['empty description', true, '', null],
            ['missing description', true, undefined, null],
            ['null description', true, null, null],
            ['plain text description', true, '/home/example/A & <B>', '/home/example/A & <B>'],
        ]) {
            const applet = { applicationIconSize: 22, showDescription };
            const result = { id: 'test-project', label: 'Project', description };
            const button = new ResultButton(applet, {}, result);
            try {
                check(button.label.get_text() === 'Project', 'Result label changed');
                check(button.labelContainer.get_children().length === (expected === null ? 1 : 2),
                    'Unexpected number of label rows');
                if (expected === null) {
                    check(button.descriptionLabel === null, 'Unexpected description row');
                } else {
                    check(button.descriptionLabel.get_text() === expected, 'Description text differs');
                    check(button.descriptionLabel.has_style_class_name('appmenu-application-button-description'),
                        'Description style differs from application entries');
                }
                const accessibleName = expected === null ? 'Project' : `Project. ${expected}`;
                const accessible = button.actor.get_accessible();
                let actualName = accessible.accessible_name;
                if (actualName === null) {
                    const relation = accessible.ref_relation_set().get_relation_by_type(Atk.RelationType.LABELLED_BY);
                    if (relation)
                        actualName = relation.get_target().map(label => label.accessible_name).join(' ');
                }
                check(actualName === accessibleName, 'Accessible name differs');
                results.push({ name, passed: true });
            } catch (error) {
                results.push({ name, passed: false, error: error.message });
            } finally {
                button.destroy();
            }
        }

        let selected = null;
        let closed = false;
        const icon = new St.Icon({ icon_name: 'folder', icon_size: 22 });
        const result = { id: 'test-project', label: 'Project', description: '/home/example/project', icon };
        const button = new ResultButton({
            applicationIconSize: 22,
            showDescription: true,
            menu: { close() { closed = true; } },
        }, { on_result_selected(result) { selected = result; } }, result);
        try {
            check(button.icon === icon && icon.get_parent() === button.actor, 'Result icon was lost');
            button.activate();
            check(selected === result && closed, 'Result activation changed');
            results.push({ name: 'icon and activation', passed: true });
        } finally {
            button.destroy();
        }
    } finally {
        SearchProviderManager.launch_all = launchAll;
        menu.searchEntry.set_text(previousSearch);
    }

    return results;
})();
