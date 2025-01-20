import React from 'react';

interface DownloadContextMenuProps {
  downloadId: string;
  position: { x: number; y: number };
  downloadLocation?: string;
  controllerId?: string;
  onClose: () => void;
  onPause: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void;
  onStop: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void;
  onForceStart: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void;
  onRemove: (
    downloadLocation?: string,
    id?: string,
    controllerId?: string,
  ) => void;
}

const DownloadContextMenu: React.FC<DownloadContextMenuProps> = ({
  downloadId,
  position,
  downloadLocation,
  controllerId,
  onClose,
  onPause,
  onStop,
  onForceStart,
  onRemove,
}) => {
  return (
    <div
      className="fixed bg-white border rounded-md shadow-lg py-1 z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button
        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
        onClick={() => {
          onPause(downloadId, downloadLocation, controllerId);
          onClose();
        }}
      >
        <span>⏸️ Pause</span>
      </button>
      <button
        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
        onClick={() => {
          onStop(downloadId, downloadLocation, controllerId);
          onClose();
        }}
      >
        <span>⏹️ Stop</span>
      </button>
      <button
        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
        onClick={() => {
          onForceStart(downloadId, downloadLocation, controllerId);
          onClose();
        }}
      >
        <span>⏩ Force Start</span>
      </button>
      <button
        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
        onClick={() => {
          onRemove(downloadLocation, downloadId, controllerId);
          onClose();
        }}
      >
        <span>🗑️ Remove</span>
      </button>
      <button className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
        <span>📁 Category</span>
        <span className="ml-auto">▶</span>
      </button>
      <button className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
        <span>🏷️ Tags</span>
        <span className="ml-auto">▶</span>
      </button>
      <button className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
        <span>⚙️ Download Options</span>
      </button>
    </div>
  );
};

export default DownloadContextMenu;
