import Input from '@/core-app/components/shadcn/components/ui/input';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { useTranslation } from 'react-i18next';
import { MdOutlineInfo } from 'react-icons/md';

const AdditionalOptions = () => {
  const { t } = useTranslation('additionalOptions');
  const { getTranscript, setGetTranscript, getThumbnail, setGetThumbnail } =
    useTaskbarDownloadStore();

  return (
    <div
      id="additional-options-modal"
      className={cn(
        'absolute top-full mt-1 right-10 max-w-[450px] min-w-0 h-fit w-full z-[100] bg-white dark:bg-darkModeDropdown border border-divider dark:border-darkModeCompliment rounded-lg shadow-lg p-4',
      )}
    >
      <div className="flex flex-col gap-2 w-fit">
        <p className="dark:text-darkModeLight font-semibold text-sm text-nowrap">
          {t('title')}
        </p>

        <p className="text-xxs text-darkModeDarkGray dark:text-darkModeLight">
          {t('subtitle')}
        </p>

        <div className="flex items-center gap-4 mt-1">
          <div className="flex items-center gap-1">
            <Input
              type="checkbox"
              id="get-transcript"
              className="size-4"
              checked={getTranscript}
              onChange={(e) => setGetTranscript(e.target.checked)}
              style={{
                ...(document.documentElement.classList.contains('dark') && {
                  backgroundColor: getTranscript ? '#F45513' : '#09090B',
                  borderColor: getTranscript ? '#F45513' : '#27272ACC',
                  accentColor: '#ffffff',
                }),
              }}
            />
            <label
              htmlFor="get-transcript"
              className="font-medium text-xs dark:text-darkModeLight cursor-pointer"
            >
              {t('getClosedCaptions')}
            </label>
          </div>
          <div className="flex items-center gap-1">
            <Input
              type="checkbox"
              id="get-thumbnail"
              className="size-4"
              checked={getThumbnail}
              onChange={(e) => setGetThumbnail(e.target.checked)}
              style={{
                ...(document.documentElement.classList.contains('dark') && {
                  backgroundColor: getThumbnail ? '#F45513' : '#09090B',
                  borderColor: getThumbnail ? '#F45513' : '#27272ACC',
                  accentColor: '#ffffff',
                }),
              }}
            />
            <label
              htmlFor="get-thumbnail"
              className="font-medium text-xs dark:text-darkModeLight cursor-pointer"
            >
              {t('getThumbnail')}
            </label>
          </div>
        </div>

        <hr className="border-t-1 border-divider dark:border-gray-700 my-2 flex-grow" />

        <div className="flex items-center gap-1.5">
          <MdOutlineInfo className="size-4 text-darkModeDarkGray dark:text-darkModeLight" />
          <div>
            <p className="text-[10px] text-[#10182A] dark:text-darkModeLight italic">
              {t('disclaimer')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdditionalOptions;
