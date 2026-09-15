export const VIDEO_IDS_DRAG_MIME = 'application/x-downlodr-video-ids';

export type DraggedVideoPayload = {
  videoIds: string[];
  sourceCategory?: string | null;
};

let currentDraggedPayload: DraggedVideoPayload = { videoIds: [] };

const dedupePreserveOrder = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    result.push(trimmed);
  });

  return result;
};

const isStringArray = (value: unknown): value is string[] => {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
};

export const serializeDraggedVideoIds = (videoIds: string[]): string => {
  return JSON.stringify({ videoIds });
};

export const serializeDraggedVideoPayload = (
  payload: DraggedVideoPayload,
): string => {
  return JSON.stringify(payload);
};

export const parseDraggedVideoIds = (payload: string): string[] => {
  if (!payload) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed === 'object' && parsed !== null && 'videoIds' in parsed) {
      const maybeIds = (parsed as { videoIds?: unknown }).videoIds;
      if (isStringArray(maybeIds)) {
        return dedupePreserveOrder(maybeIds);
      }
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return dedupePreserveOrder(payload.split(','));
};

export const parseDraggedVideoPayload = (
  payload: string,
): DraggedVideoPayload => {
  if (!payload) {
    return { videoIds: [] };
  }

  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed === 'object' && parsed !== null && 'videoIds' in parsed) {
      const maybeIds = (parsed as { videoIds?: unknown }).videoIds;
      const maybeSource = (parsed as { sourceCategory?: unknown })
        .sourceCategory;
      if (isStringArray(maybeIds)) {
        return {
          videoIds: dedupePreserveOrder(maybeIds),
          sourceCategory:
            typeof maybeSource === 'string' ? maybeSource : undefined,
        };
      }
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return { videoIds: dedupePreserveOrder(payload.split(',')) };
};

export const setDraggedVideoIds = (videoIds: string[]): void => {
  currentDraggedPayload = {
    ...currentDraggedPayload,
    videoIds: dedupePreserveOrder(videoIds),
  };
};

export const setDraggedVideoPayload = (payload: DraggedVideoPayload): void => {
  currentDraggedPayload = {
    videoIds: dedupePreserveOrder(payload.videoIds),
    sourceCategory: payload.sourceCategory ?? undefined,
  };
};

export const getDraggedVideoIdsFromMemory = (): string[] => {
  return [...currentDraggedPayload.videoIds];
};

export const getDraggedVideoPayloadFromMemory = (): DraggedVideoPayload => {
  return {
    videoIds: [...currentDraggedPayload.videoIds],
    sourceCategory: currentDraggedPayload.sourceCategory,
  };
};

export const clearDraggedVideoIds = (): void => {
  currentDraggedPayload = { videoIds: [] };
};
