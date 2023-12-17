declare namespace imports.gi.GLib {
    interface Variant<UnpackType = any, DeepUnpackType = UnpackType, RecursiveUnpackType = UnpackType> {
        unpack(): UnpackType;
        deep_unpack(): DeepUnpackType;
        deepUnpack(): DeepUnpackType;
        recursiveUnpack(): RecursiveUnpackType
    }
}