declare namespace imports {

    export const byteArray: ByteArray;
    class ByteArray {
        /**
         * Converts the Uint8Array into a literal string. The bytes are interpreted according to the given encoding (or UTF-8 if not given).
        The resulting string is guaranteed to round-trip back into an identical ByteArray by passing the result to ByteArray.fromString(), i.e., `b === ByteArray.fromString(ByteArray.toString(b, encoding), encoding)`.
         * @param array 
         * @param encoding 
         */
        toString(array: Uint8Array, encoding?: string): string;
        /**
         * Convert a GLib.Bytes instance into a newly constructed Uint8Array. The contents are copied.
         * @param text 
         */
        fromGBytes(text: gi.GLib.Bytes): Uint8Array;
        /**
         * Convert a String into a newly constructed Uint8Array; this creates a new Uint8Array of the same length as the String, then assigns each Uint8Array entry the corresponding byte value of the String encoded according to the given encoding (or UTF-8 if not given).
         * @param text 
         * @param encoding 
         */
        fromString(text: string, encoding?: string): Uint8Array;
        /** Converts the Uint8Array into a GLib.Bytes instance. The contents are copied. */
        toGBytes(array: Uint8Array): gi.GLib.Bytes;
        fromArray(array: Uint8Array): any;
    }
}