declare namespace imports.gi.St {

    interface IBoxLayout {
        add(first_child: Clutter.Actor, options?: Partial<BoxLayoutChildInitOptions>): void;
    }

    interface ITable {
        add(first_child: Clutter.Actor, options?: Partial<TableChildInitOptions>): void;
    }
}