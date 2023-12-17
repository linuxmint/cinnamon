import * as docInfoImport from "./misc/docInfo";
import * as utilImport from "./misc/util";

declare global {
   const _: (text: string) => string;
   const logError: (...args: any[]) => void;

   module imports.misc {
      const docInfo: typeof docInfoImport;
      const util: typeof utilImport;
   }
}