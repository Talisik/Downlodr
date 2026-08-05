/**
 * All modals used by the Status page: FileNotExist, Rename, Remove, Stop.
 */
import FileNotExistModal from '@/downlodr/components/modal/custom/FileNotExistModal';
import RemoveModal from '@/downlodr/components/modal/custom/RemoveModal';
import RenameModal from '@/downlodr/components/modal/custom/RenameModal';
import StopModal from '@/downlodr/components/modal/custom/StopModal';
import type { DownloadItem } from '@/downlodr/schema/componentSchema';
import React from 'react';

export interface StatusPageModalsProps {
  showFileNotExistModal: boolean;
  onCloseFileNotExistModal: () => void;
  missingFiles: DownloadItem[];
  showRenameModal: boolean;
  onCloseRenameModal: () => void;
  renameCurrentName: string;
  onRename: (newName: string) => void;
  showRemoveModal: boolean;
  onCloseRemoveModal: () => void;
  onConfirmRemove: (deleteFolder?: boolean) => void;
  showStopModal: boolean;
  onCloseStopModal: () => void;
  onConfirmStop: () => void;
}

export const StatusPageModals: React.FC<StatusPageModalsProps> = ({
  showFileNotExistModal,
  onCloseFileNotExistModal,
  missingFiles,
  showRenameModal,
  onCloseRenameModal,
  renameCurrentName,
  onRename,
  showRemoveModal,
  onCloseRemoveModal,
  onConfirmRemove,
  showStopModal,
  onCloseStopModal,
  onConfirmStop,
}) => (
  <>
    <FileNotExistModal
      isOpen={showFileNotExistModal}
      onClose={onCloseFileNotExistModal}
      selectedDownloads={missingFiles}
      download={missingFiles.length === 1 ? missingFiles[0] : null}
    />
    <RenameModal
      isOpen={showRenameModal}
      onClose={onCloseRenameModal}
      onRename={onRename}
      currentName={renameCurrentName}
    />
    <RemoveModal
      isOpen={showRemoveModal}
      onClose={onCloseRemoveModal}
      onConfirm={onConfirmRemove}
      allowFolderDeletion={true}
    />
    <StopModal
      isOpen={showStopModal}
      onClose={onCloseStopModal}
      onConfirm={onConfirmStop}
    />
  </>
);
