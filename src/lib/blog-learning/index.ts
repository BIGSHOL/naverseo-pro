/**
 * Blog Content Learning Pipeline - Barrel Export
 */

export { scheduleCollection, collectFromSearchResults, collectFromScrapedPosts } from './collector'
export { getPatternPromptSection, getImagePatternPrompt } from './prompt-injector'
export { updateAggregatePatterns } from './aggregator'
export { extractPatternFromSearchItem, extractPatternFromScrapedData, detectWritingTone } from './extractor'
export type { AnalyzedPostPattern, AggregatedPattern, PromptPatternData, CollectionSource, WritingTone, ImagePosition } from './types'
