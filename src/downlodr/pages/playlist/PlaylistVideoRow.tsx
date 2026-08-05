/**
 * Single row for the playlist selection page: checkbox + thumbnail + title/channel.
 */
import { Video } from '@/downlodr/store/taskbarDownloadStore';
import { FiPlayCircle } from 'react-icons/fi';

const THUMB_PLACEHOLDER_CLASS =
  'h-9 w-16 rounded overflow-hidden flex justify-center items-center flex-shrink-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]';

interface PlaylistVideoRowProps {
  video: Video;
  checked: boolean;
  onToggle: () => void;
}

const PlaylistVideoRow = ({
  video,
  checked,
  onToggle,
}: PlaylistVideoRowProps) => {
  return (
    <tr
      className={`border-b hover:bg-gray-50 dark:border-darkModeTableBorder dark:hover:bg-darkModeHover cursor-pointer ${
        checked ? 'bg-blue-50 dark:bg-darkMode' : 'dark:bg-darkModeTable'
      }`}
      onClick={onToggle}
    >
      <td className="w-10 p-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="cursor-pointer rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
        />
      </td>
      <td className="p-2 dark:text-gray-200">
        <div className="flex items-center gap-3 w-full">
          <div className="flex-shrink-0">
            {video.thumbnail ? (
              <div className="h-9 w-16 bg-black flex rounded overflow-hidden justify-center items-center flex-shrink-0">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className={THUMB_PLACEHOLDER_CLASS}>
                <FiPlayCircle size={20} color="#F45513" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate dark:text-darkModeLight">
              {video.title}
            </p>
            <p className="text-xxs text-gray-500 dark:text-gray-400 truncate">
              {video.channel}
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
};

export default PlaylistVideoRow;
