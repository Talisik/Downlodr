/**
 * A custom React component
 * A React component that displays a list of downloads in a table format.
 * It allows users to view download details and manage downloads through a context menu.
 *
 * @param DownloadListProps
 *   @param downloads - An array of download objects to display in the list.
 *
 * @returns JSX.Element - The rendered download list component.
 */

import React, { useEffect, useRef, useState } from 'react';
import { LuDownload } from 'react-icons/lu';
import useDownloadStore, { BaseDownload } from '../../../Store/downloadStore';
import DownloadContextMenu from './DownloadContextMenu';
import { toast } from '../shadcn/hooks/use-toast';

// Interface representing the props for the DownloadList component
interface DownloadListProps {
  downloads: BaseDownload[];
}

const DownloadList: React.FC<DownloadListProps> = ({ downloads }) => {
  const [contextMenu, setContextMenu] = useState<{
    downloadId: string; // Unique identifier for the download
    x: number; // X coordinate for context menu position
    y: number; // Y coordinate for context menu position
    downloadLocation?: string; // Location of the download file
    controllerId?: string; // ID of the controller managing the download
  } | null>(null);
  const [selectedDownloadId, setSelectedDownloadId] = useState<string | null>(
    null,
  );
  const listRef = useRef<HTMLDivElement>(null);
  // Access download store functions
  const addTag = useDownloadStore((state) => state.addTag);
  const removeTag = useDownloadStore((state) => state.removeTag);
  const addCategory = useDownloadStore((state) => state.addCategory);
  const removeCategory = useDownloadStore((state) => state.removeCategory);
  const deleteDownload = useDownloadStore((state) => state.deleteDownload);
  const availableTags = useDownloadStore((state) => state.availableTags);
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );
  // Remove duplicate downloads based on ID
  const uniqueDownloads = [
    ...new Map(downloads.map((item) => [item.id, item])).values(),
  ];
  // Effect to handle clicks outside the list to close the context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node)) {
        setContextMenu(null);
        setSelectedDownloadId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  /**
   * Handles the context menu event for a download.
   *
   * @param event - The mouse event triggered by right-clicking on a download.
   * @param download - The download object associated with the context menu.
   */
  const handleContextMenu = (
    event: React.MouseEvent,
    download: BaseDownload,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      downloadId: download.id,
      x: event.clientX,
      y: event.clientY,
      downloadLocation: `${download.location}${download.name}`,
      controllerId: download.controllerId,
    });
    setSelectedDownloadId(download.id);
  };

  // Handles the removal of a download.
  //downloadLocation - The location of the download file.
  //downloadId - The ID of the download to remove.
  const handleRemove = async (
    downloadLocation?: string,
    downloadId?: string,
  ) => {
    if (!downloadLocation || !downloadId) return;
    try {
      const success = await window.downlodrFunctions.deleteFile(
        downloadLocation,
      );
      if (success) {
        deleteDownload(downloadId);
        setContextMenu(null);
        toast({
          variant: 'success',
          title: 'File Deleted',
          description: 'File has been deleted successfully',
        });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: 'Failed to delete file',
      });
    }
  };
  // Handles viewing a download.
  // downloadLocation - The location of the download file.
  const handleViewDownload = (downloadLocation?: string) => {
    if (downloadLocation) {
      window.downlodrFunctions.openVideo(downloadLocation);
    }
    setContextMenu(null);
  };
  // Handles viewing the folder containing the download.
  // downloadLocation - The location of the download file.
  const handleViewFolder = (downloadLocation?: string) => {
    if (downloadLocation) {
      window.downlodrFunctions.openFolder(downloadLocation);
    }
    setContextMenu(null);
  };

  return (
    <div ref={listRef} className="overflow-x-auto">
      <table className="min-w-full table-auto">
        <thead>
          <tr className="bg-gray-100 dark:bg-darkModeCompliment">
            <th className="p-2 text-left dark:text-gray-200">Name</th>
            <th className="p-2 text-left dark:text-gray-200">Size</th>
            <th className="p-2 text-left dark:text-gray-200">Status</th>
            <th className="p-2 text-left dark:text-gray-200">Tags</th>
            <th className="p-2 text-left dark:text-gray-200">Categories</th>
          </tr>
        </thead>
        <tbody>
          {uniqueDownloads.map((download) => (
            <tr
              key={download.id}
              className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                selectedDownloadId === download.id
                  ? 'bg-blue-50 dark:bg-gray-600'
                  : 'dark:bg-darkMode'
              }`}
              onContextMenu={(e) => handleContextMenu(e, download)}
              onClick={() =>
                handleViewDownload(`${download.location}${download.name}`)
              }
            >
              <td className="p-2 flex items-center gap-2 dark:text-gray-200">
                <LuDownload className="text-blue-500" />
                {download.name}
              </td>
              <td className="p-2 dark:text-gray-200">
                {(download.size / 1048576).toFixed(2)} mb
              </td>
              <td className="p-2 dark:text-gray-200">{download.status}</td>
              <td className="p-2">
                <div className="flex flex-wrap gap-1">
                  {download.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
              <td className="p-2">
                <div className="flex flex-wrap gap-1">
                  {download.category?.map((category) => (
                    <span
                      key={category}
                      className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 rounded-full"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {contextMenu && (
        <DownloadContextMenu
          downloadId={contextMenu.downloadId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onPause={() => void 0}
          onStop={() => void 0}
          onForceStart={() => void 0}
          onRemove={() =>
            handleRemove(contextMenu.downloadLocation, contextMenu.downloadId)
          }
          onViewDownload={() =>
            handleViewDownload(contextMenu.downloadLocation)
          }
          onViewFolder={() => handleViewFolder(contextMenu.downloadLocation)}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          currentTags={
            downloads.find((d) => d.id === contextMenu.downloadId)?.tags || []
          }
          availableTags={availableTags}
          onAddCategory={addCategory}
          onRemoveCategory={removeCategory}
          currentCategories={
            downloads.find((d) => d.id === contextMenu.downloadId)?.category ||
            []
          }
          availableCategories={availableCategories}
        />
      )}
    </div>
  );
};

export default DownloadList;
