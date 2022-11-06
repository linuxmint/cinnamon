import * as docInfoImport from "./misc/docInfo";

declare global {
   module imports.misc {
      const docInfo: typeof docInfoImport;
   }
}