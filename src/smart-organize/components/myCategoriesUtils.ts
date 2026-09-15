export type VideoWithId = {
  video_id: string;
};

export function mergeVideosById<T extends VideoWithId>(
  existingVideos: T[],
  pendingVideos: T[],
): T[] {
  const merged = new Map<string, T>();

  existingVideos.forEach((video) => {
    merged.set(video.video_id, video);
  });

  pendingVideos.forEach((video) => {
    if (!merged.has(video.video_id)) {
      merged.set(video.video_id, video);
    }
  });

  return Array.from(merged.values());
}
