/**
 * natural.ts
 *
 * The only place auto-tag touches the `natural` package.
 *
 * We deep-import the three pieces we use instead of `import natural from
 * 'natural'`. Two reasons, both load-bearing:
 *
 *  1. The package root is a barrel that eagerly requires
 *     `sentiment/SentimentAnalyzer` -> `afinn-165`, which is ESM-only. Electron's
 *     main process is CommonJS, so importing the root throws ERR_REQUIRE_ESM at
 *     startup.
 *
 *  2. `natural` is listed in vite.main.config.ts as an afda-backend external, and
 *     its `rewrite-external-modules` plugin rewrites any literal
 *     `require('natural')` to resolve from afda-backend's vendored node_modules.
 *     Deep specifiers don't match that rewrite, so auto-tag stays independent of
 *     whether afda-backend is provisioned.
 *
 * Leaf modules, not sub-barrels: `stemmers/index` pulls in every stemmer
 * (~644 KB, mostly an Indonesian dictionary) and `util/index` pulls in dotenv.
 */

import PorterStemmer from 'natural/lib/natural/stemmers/porter_stemmer';
import TfIdf from 'natural/lib/natural/tfidf/tfidf';
import { words as stopwords } from 'natural/lib/natural/util/stopwords';

export { PorterStemmer, stopwords, TfIdf };
