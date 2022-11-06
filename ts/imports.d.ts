import * as docInfoImport from "./misc/docInfo";

declare global {
   const _: (text: string) => string;
   const logError: (...args: any[]) => void;

   interface String {
      format: (text: string) => string;
   }

   module imports.misc {
      const docInfo: typeof docInfoImport;
   }
}