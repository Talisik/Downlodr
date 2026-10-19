/**
 * tier1 — metadata tagger (public API)
 *
 * Generates descriptive tags from title + description + channel only.
 * No transcript, no model. See ../docs/PLAN.md.
 */

export { tagMetadata, tagMetadataBatch } from './tagMetadata';
export { gatherMetadataText } from './gatherText';
