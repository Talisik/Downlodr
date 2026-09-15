/** Deep imports from `natural` (avoids the package root barrel). */

import PorterStemmer from 'natural/lib/natural/stemmers/porter_stemmer';
import TfIdf from 'natural/lib/natural/tfidf/tfidf';
import { words as stopwords } from 'natural/lib/natural/util/stopwords';

export { PorterStemmer, stopwords, TfIdf };
