# Structural Improvements Summary

## Quick Reference

### Key Issues Identified

1. **Service Layer**: Scattered services, inconsistent naming
2. **Store Size**: `downloadStore.tsx` is 2652 lines (too large)
3. **Type Organization**: Types scattered across files
4. **Utility Organization**: Mixed concerns in Utils folder
5. **Error Handling**: 879-line error helper file
6. **Testing**: No test infrastructure
7. **Configuration**: Minimal config management

### Priority Recommendations

#### 🔴 Immediate Actions (High Impact, Low Effort)

1. **Fix Naming Convention**
   - Rename `useSendErrorLog` → `sendTelemetry` or `telemetryService.send()`
   - Remove `use*` prefix from non-hook functions
   - **Effort**: 1-2 hours
   - **Impact**: Better code clarity

2. **Consolidate Types**
   - Move all types to `src/types/` folder
   - Create index file for easy imports
   - **Effort**: 2-4 hours
   - **Impact**: Better IDE support, reduced duplication

3. **Create Service Layer Skeleton**
   - Set up folder structure
   - Create base HTTP client
   - **Effort**: 4-6 hours
   - **Impact**: Foundation for future improvements

#### 🟡 Short-term (High Impact, Medium Effort)

4. **Refactor Download Store**
   - Split into multiple files (store, actions, selectors)
   - Extract business logic to services
   - **Effort**: 1-2 days
   - **Impact**: Much easier to maintain and test

5. **Reorganize Utilities**
   - Categorize utilities by purpose
   - Move React components out of utils
   - **Effort**: 1 day
   - **Impact**: Easier to find and use utilities

6. **Improve Error Handling**
   - Split error helper into modules
   - Create centralized error handler
   - **Effort**: 1 day
   - **Impact**: Better error handling, easier to extend

#### 🟢 Long-term (Medium Impact, High Effort)

7. **Add Testing Infrastructure**
   - Set up Jest/Vitest
   - Add unit tests for critical paths
   - **Effort**: 1-2 weeks
   - **Impact**: Confidence in refactoring, regression prevention

8. **Component Reorganization**
   - Group by feature
   - Extract shared components
   - **Effort**: 1 week
   - **Impact**: Better code splitting, clearer structure

## Implementation Order

### Week 1: Foundation
1. Consolidate types
2. Fix naming conventions
3. Create service layer skeleton

### Week 2-3: Core Refactoring
4. Refactor download store
5. Reorganize utilities
6. Improve error handling

### Week 4+: Enhancement
7. Add testing infrastructure
8. Component reorganization
9. Documentation updates

## Quick Wins

These can be done immediately with minimal risk:

1. **Create `src/types/index.ts`**
   ```typescript
   export * from './download';
   export * from './plugin';
   export * from './telemetry';
   ```

2. **Rename `useSendErrorLog`**
   ```typescript
   // Before
   import useSendErrorLog from '@/DataServices/sendErrorLog';
   
   // After
   import { sendTelemetry } from '@/services/telemetry/telemetryService';
   ```

3. **Extract constants**
   ```typescript
   // src/constants/errorCodes.ts
   export const ERROR_CODES = {
     SUCCESS: 0,
     PERMISSION_DENIED: 1,
     // ...
   };
   ```

## Metrics to Track

- **File Size**: Target < 500 lines per file
- **Cyclomatic Complexity**: Target < 10 per function
- **Test Coverage**: Target > 70% for critical paths
- **Import Depth**: Target < 3 levels deep

## Tools to Help

1. **ESLint Rules**
   - `max-lines`: Enforce file size limits
   - `complexity`: Limit function complexity
   - `import/no-relative-parent-imports`: Enforce import structure

2. **TypeScript**
   - Strict mode for better type safety
   - Path mapping for cleaner imports

3. **Prettier**
   - Consistent code formatting
   - Automatic formatting on save

## Next Steps

1. Review this document with the team
2. Prioritize improvements based on current pain points
3. Create GitHub issues for each improvement
4. Start with quick wins to build momentum
5. Gradually migrate existing code

## Questions to Consider

- Which areas cause the most friction during development?
- What's the biggest risk when making changes?
- Where do new developers struggle the most?
- What would make testing easier?

Answering these will help prioritize the improvements.

