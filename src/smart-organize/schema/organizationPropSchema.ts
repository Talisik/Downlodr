// Enhanced TypeScript interfaces for better type safety
import { VideoGroup } from './organizationTableSchema';

interface OrganizationTableProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVideos: Set<string>;
  onSave: (videoGroups: VideoGroup[]) => void;
  initialGroups?: Record<
    string,
    {
      video_id: string;
      video_title: string;
      thumbnails?: string;
      channelName?: string;
      tags?: string[];
    }[]
  >;
  categoryContexts?: Record<string, string>;
}

export default OrganizationTableProps;
