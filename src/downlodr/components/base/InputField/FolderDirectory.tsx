import Input from '@/core-app/components/shadcn/components/ui/input';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FolderDirectory = () => {
  const { t } = useTranslation('folderDirectory');
  const {
    isSelectingDirectory,
    setIsSelectingDirectory,
    downloadFolder,
    setDownloadFolder,
  } = useTaskbarDownloadStore();

  // Get main store to keep settings in sync
  const { updateDefaultLocation } = useSettingStore();

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
        title: t('toast.errorTitle'),
        description: t('toast.errorDesc'),
        duration: 3000,
      });
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  return (
    <div
      id="folder-directory-modal"
      className="absolute top-full mt-1 right-10 w-full max-w-[426px] min-w-0 h-fit z-[100] bg-white dark:bg-darkModeDropdown border border-divider dark:border-darkModeCompliment rounded-lg shadow-lg p-4"
    >
      <div className="flex flex-col gap-2 w-full">
        <p className="dark:text-darkModeLight font-semibold text-[14px] text-nowrap">
          {t('title')}
        </p>

        <p className="text-[13px] text-darkModeDarkGray dark:text-darkModeLight">
          {t('subtitle')}
        </p>

        <div className="flex gap-2 mt-1 w-full">
          <Input
            type="text"
            value={downloadFolder}
            placeholder={t('placeholder')}
            parentInputClassName="w-full"
            className=" dark:text-darkModeLight flex-1 border rounded-md px-3 py-2 outline-none dark:border-[#27272ACC] dark:bg-[#09090B] text-xs"
            rightIcons={[
              {
                icon: <Folder className="text-componentBorder size-4" />,
                onClick: () => {
                  handleDirectory();
                },
                tooltip: t('folderTooltip'),
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
