/**
 * Typings for the `natural` leaf modules auto-tag deep-imports. These files ship
 * no .d.ts of their own — only the sub-barrels (`stemmers/index`, `tfidf/index`)
 * do, and we avoid those on purpose. See ./natural.ts.
 *
 * The types are re-used from the sub-barrels' declarations, which is type-only
 * and erased at compile time — no runtime import of the barrels occurs.
 */

declare module 'natural/lib/natural/stemmers/porter_stemmer' {
  import type { Stemmer } from 'natural/lib/natural/stemmers';
  const PorterStemmer: Stemmer;
  export = PorterStemmer;
}

declare module 'natural/lib/natural/tfidf/tfidf' {
  import { TfIdf } from 'natural/lib/natural/tfidf';
  export = TfIdf;
}

declare module 'natural/lib/natural/util/stopwords' {
  export const words: string[];
}
