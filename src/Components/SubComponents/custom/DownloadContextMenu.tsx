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
  onViewDownload: (downloadLocation?: string) => void;
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
  onViewDownload,
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let { x, y } = position;

      // Adjust vertical position if menu overflows bottom
      if (y + menuRect.height > viewportHeight) {
        y = Math.max(0, viewportHeight - menuRect.height);
      }

      // Adjust horizontal position if menu overflows right
      if (x + menuRect.width > viewportWidth) {
        x = Math.max(0, viewportWidth - menuRect.width);
      }

      menuRef.current.style.left = `${x}px`;
      menuRef.current.style.top = `${y}px`;
    }
  }, [position]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border rounded-md shadow-lg py-1 z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button
        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
        onClick={() => {
          onViewDownload(downloadLocation);
          onClose();
        }}
      >
        <span>👁️ View Download</span>
      </button>
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
