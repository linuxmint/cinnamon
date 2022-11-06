# types-cjs

Typescript declarations for CJS - Cinnamon JavaScript 

## Usage

This only works on a system where Cinnamon DM is installed and running code off of Cinnamon's JS (cjs) engine.

To use the the declarations add types in tsconfig.json

```json
{
    "compileOptions": {
        "types": ["@ci-types/cjs"]
    }
}
```

**Note declarations in the `cinnamon` folder are still incomplete, contributions are welcome!**

## Actual file locations on a typical system

### .d.ts non-Cinnamon declarations (files in root folder)

There files are generated from `.gir` files via [GitHub - Gr3q/GIR2TS: TypeScript declaration generator for GObject Introspection.](https://github.com/Gr3q/GIR2TS) , The files themselves are located in `/usr/lib/muffin/` and `/usr/share/gir-1.0/GIRepository-2.0.gir` in some systems, but you are better off building Cinnamon yourself.

### .d.ts files in cinnamon folder

These files are pure JavaScript on a system, it's always under `/usr/share/cinnamon`. The `cinnamon` folder in this repo matches the structure on a running system.

## Contributions

Contributing to this repo is more than welcome because it is still incomplete (especially in the `cinnamon` folder).

### Non-Cinnamon declarations

If you find issues, errors or missing stuff in these files you are more than welcome to submit an issue to this repo or [here](https://github.com/Gr3q/GIR2TS), where they are generated from.

### Cinnamon declarations (in cinnamon folder)

If you want to contribute you can look up any of these files in the folder and if you find issues or missing declarations you can write them based on the JS implementation stored on your system under `/usr/share/cinnamon` .