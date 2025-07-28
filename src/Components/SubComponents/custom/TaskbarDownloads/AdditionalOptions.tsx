import PlaylistSkeleton from '@/Components/SubComponents/custom/Skeletons/PlaylistSkeleton';
import Input from '@/Components/SubComponents/shadcn/components/ui/input';
import { cn } from '@/Components/SubComponents/shadcn/lib/utils';
import { isValidUrl } from '@/DataFunctions/urlValidation';
import { useTaskbarDownloadStore, Video } from '@/Store/taskbarDownloadStore';
import { MdOutlineInfo } from 'react-icons/md';

interface AdditionalOptionsProps {
  isPlaylist: boolean;
  isLoading: boolean;
  selectAll: boolean;
  handleSelectAll: () => void;
  videoTitle: string | null;
  playlistVideos: Video[];
  selectedVideos: Set<string>;
  handleVideoSelect: (id: string) => void;
}

const AdditionalOptions = ({
  isPlaylist,
  isLoading,
  selectAll,
  handleSelectAll,
  videoTitle,
  playlistVideos,
  selectedVideos,
  handleVideoSelect,
}: AdditionalOptionsProps) => {
  const { getTranscript, setGetTranscript, getThumbnail, setGetThumbnail } =
    useTaskbarDownloadStore();

  return (
    <div
      id="additional-options-modal"
      className={cn(
        'absolute top-full right-10 max-w-[450px] min-w-0 h-fit z-50 bg-white dark:bg-darkModeDropdown border border-divider dark:border-darkModeCompliment rounded-lg shadow-lg p-4',
        isPlaylist && 'max-w-[800px] flex gap-4',
        !isPlaylist && 'w-full',
      )}
    >
      <div className="flex flex-col gap-2 w-fit">
        <p className="dark:text-darkModeLight font-semibold text-sm text-nowrap">
          Additional Options
        </p>

        <p className="text-sm text-darkModeDarkGray dark:text-darkModeLight">
          Get the transcript and Thumbnail along with your download.
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
                  backgroundColor: getTranscript ? '#D4D4D8' : '#09090B',
                  borderColor: getTranscript ? '#D4D4D8' : '#27272ACC',
                  accentColor: '#ffffff',
                }),
              }}
            />
            <label
              htmlFor="get-transcript"
              className="font-medium text-xs dark:text-darkModeLight cursor-pointer"
            >
              Get Closed Captions
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
                  backgroundColor: getThumbnail ? '#D4D4D8' : '#09090B',
                  borderColor: getThumbnail ? '#D4D4D8' : '#27272ACC',
                  accentColor: '#ffffff',
                }),
              }}
            />
            <label
              htmlFor="get-thumbnail"
              className="font-medium text-xs dark:text-darkModeLight cursor-pointer"
            >
              Get Thumbnail
            </label>
          </div>
        </div>

        <hr
          className={cn(
            'border-t-1 border-divider dark:border-gray-700 my-2',
            !isPlaylist && 'flex-grow',
          )}
        />

        <div className="flex items-center gap-1.5">
          <MdOutlineInfo className="size-4 text-darkModeDarkGray dark:text-darkModeLight" />
          <div>
            <p className="text-[10px] text-[#10182A] dark:text-darkModeLight italic">
              Please note that Closed Captions and Thumbnails may not be
              available for all websites.
            </p>
          </div>
        </div>
      </div>

      {isPlaylist && isValidUrl && (
        <div className="w-2/4 border-l border-divider dark:border-gray-700 pl-4">
          {isLoading ? (
            <PlaylistSkeleton />
          ) : (
            <div className="video-section">
              <div className="sticky top-0 bg-white dark:bg-darkModeDropdown pb-4 z-10">
                <div className="select-all flex items-center">
                  <Input
                    type="checkbox"
                    id={`select-all`}
                    checked={selectAll}
                    onChange={handleSelectAll}
                    style={{
                      width: 15,
                      height: 15,
                      marginBottom: 0.5,
                      ...(document.documentElement.classList.contains(
                        'dark',
                      ) && {
                        backgroundColor: selectAll ? '#D4D4D8' : '#09090B',
                        borderColor: selectAll ? '#D4D4D8' : '#27272ACC',
                      }),
                    }}
                    className="mr-2"
                  />
                  <label htmlFor={`select-all`}>
                    <p className="w-6/7 dark:text-darkModeLight font-medium">
                      {videoTitle}
                    </p>
                  </label>
                </div>
              </div>
              <div className="space-y-3 max-h-[180px] overflow-y-auto">
                {playlistVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center gap-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                  >
                    <input
                      type="checkbox"
                      id={`select-all-${video.id}`}
                      checked={selectedVideos.has(video.id)}
                      onChange={() => handleVideoSelect(video.id)}
                      style={{
                        ...(document.documentElement.classList.contains(
                          'dark',
                        ) && {
                          backgroundColor: selectedVideos.has(video.id)
                            ? '#D4D4D8'
                            : '#09090B',
                          borderColor: selectedVideos.has(video.id)
                            ? '#D4D4D8'
                            : '#27272ACC',
                          accentColor: '#ffffff',
                        }),
                      }}
                      className="flex-none"
                    />
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-24 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <label htmlFor={`select-all-${video.id}`}>
                        <h1 className="font-medium dark:text-darkModeLight truncate break-all">
                          {video.title}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {video.channel}
                        </p>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdditionalOptions;
