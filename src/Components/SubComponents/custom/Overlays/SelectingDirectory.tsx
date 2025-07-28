import { useTaskbarDownloadStore } from '@/Store/taskbarDownloadStore';

// Directory selection overlay - blocks all app interaction
const SelectingDirectory = () => {
  const { isSelectingDirectory } = useTaskbarDownloadStore();

  if (!isSelectingDirectory) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] cursor-not-allowed flex items-center justify-center">
      <div className="bg-white dark:bg-darkMode p-4 rounded-md shadow-lg max-w-md text-center">
        <h3 className="text-lg font-medium mb-2 dark:text-gray-200">
          Directory Selection In Progress
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Please complete the directory selection dialog before continuing.
        </p>
      </div>
    </div>
  );
};

export default SelectingDirectory;
