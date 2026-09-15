export interface VideoItem {
  video_id: string;
  video_title: string;
  thumbnails?: string;
  channelName?: string;
  tags?: string[];
}

export interface VideoWithGroup extends VideoItem {
  groupName: string;
}
