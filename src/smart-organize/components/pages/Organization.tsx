import OrganizationTable from '../OrganizationTable';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import { useOrganizationStore } from '@/smart-organize/store/organizationStore';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface VideoGroup {
  id: string;
  name: string;
  description?: string;
  videos: { video_id: string; video_title: string }[];
  color?: string;
}

const Organization = () => {
  const navigate = useNavigate();
  const { organizationData, clearOrganizationData } = useOrganizationStore();
  const selectedDownloads = useSelectedDownloadStore((state) => state.selectedDownloads);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());

  // Set selected videos based on the organization data or current selection
  useEffect(() => {
    if (organizationData?.groups) {
      // Get all video IDs from the organization data
      const allVideoIds = Object.values(organizationData.groups)
        .flat()
        .map((video) => video.video_id);
      setSelectedVideos(new Set(allVideoIds));
    } else if (selectedDownloads.length > 0) {
      // Fallback to current selected downloads
      setSelectedVideos(new Set(selectedDownloads.map((d) => d.id)));
    }
  }, [organizationData, selectedDownloads]);

  const handleSave = (videoGroups: VideoGroup[]) => {
    console.log('Saving video groups:', videoGroups);
    // Add your save logic here

    // Clear the organization data after saving
    clearOrganizationData();

    // Navigate back to main view
    navigate('/status/all');
  };

  const handleClose = () => {
    // Clear the organization data when closing
    clearOrganizationData();

    // Navigate back to main view
    navigate('/status/all');
  };

  // If no organization data is available, redirect to main view
  useEffect(() => {
    if (!organizationData?.groups && selectedDownloads.length === 0) {
      navigate('/status/all');
    }
  }, [organizationData, selectedDownloads, navigate]);

  if (!organizationData?.groups && selectedDownloads.length === 0) {
    return null;
  }

  return (
    <div className="h-full">
      <OrganizationTable
        isOpen={true}
        onClose={handleClose}
        selectedVideos={selectedVideos}
        onSave={handleSave}
        initialGroups={organizationData?.groups}
        categoryContexts={organizationData?.category_contexts}
      />
    </div>
  );
};

export default Organization;
