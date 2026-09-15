/** Typings for `natural` leaf modules. */

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
