import Input from '@/Components/SubComponents/shadcn/components/ui/input';
import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { useMainStore } from '@/Store/mainStore';
import { useTaskbarDownloadStore } from '@/Store/taskbarDownloadStore';
import { Folder } from 'lucide-react';

const FolderDirectory = () => {
  const {
    isSelectingDirectory,
    setIsSelectingDirectory,
    downloadFolder,
    setDownloadFolder,
  } = useTaskbarDownloadStore();

  // Get main store to keep settings in sync
  const { updateDefaultLocation } = useMainStore();

  // set download folder location
  const handleDirectory = async () => {
    // Prevent multiple dialogs from being opened
    if (isSelectingDirectory) return;

    try {
      setIsSelectingDirectory(true);
      const path = await window.ytdlp.selectDownloadDirectory();
      if (path) {
        setDownloadFolder(path);
        // Also update the main store to keep them in sync
        updateDefaultLocation(path);
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to select directory',
        duration: 3000,
      });
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  return (
    <div
      id="folder-directory-modal"
      className="absolute top-full right-10 w-full max-w-[426px] min-w-0 h-fit z-50 bg-white dark:bg-darkModeDropdown border border-divider dark:border-darkModeCompliment rounded-lg shadow-lg p-4"
    >
      <div className="flex flex-col gap-2 w-full">
        <p className="dark:text-darkModeLight font-semibold text-[14px] text-nowrap">
          Save File to
        </p>

        <p className="text-[13px] text-darkModeDarkGray dark:text-darkModeLight">
          Pick a location to save your file.
        </p>

        <div className="flex gap-2 mt-1 w-full">
          <Input
            type="text"
            value={downloadFolder}
            placeholder="Download Destination Folder"
            parentInputClassName="w-full"
            className=" dark:text-darkModeLight flex-1 border rounded-md px-3 py-2 outline-none dark:border-[#27272ACC] dark:bg-[#09090B] text-xs"
            rightIcons={[
              {
                icon: <Folder className="text-componentBorder size-4" />,
                onClick: () => {
                  handleDirectory();
                },
                tooltip: 'Folder',
              },
            ]}
            readOnly
          />
        </div>
      </div>
    </div>
  );
};

export default FolderDirectory;
