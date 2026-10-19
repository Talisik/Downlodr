/**
 * tier2 — transcript tagger (public API)
 *
 * Enriches a video's tags using its transcript on top of metadata.
 * Same engine as tier 1, transcript added to the corpus. See ../docs/PLAN.md.
 */

export { tagTranscript, tagTranscriptBatch } from './tagTranscript';
