/**
 * ConversionHandler component
 *
 * This component demonstrates how to properly integrate format conversion
 * with consistent status reporting between toast notifications and status columns.
 */

import useDownloadStore from '@/Store/downloadStore';
import FormatConverterMenu from './FormatConverterMenu';

interface ConversionHandlerProps {
  menuPositionClass: string;
}

const ConversionHandler: React.FC<ConversionHandlerProps> = ({
  menuPositionClass,
}) => {
  const { convertDownload } = useDownloadStore();

  const handleConversion = async (
    downloadId: string,
    format: string,
    keepOriginal: boolean,
    saveToCustomLocation = false,
  ): Promise<void> => {
    try {
      // Use the store's convertDownload function which properly handles status updates
      await convertDownload(
        downloadId,
        format,
        keepOriginal,
        saveToCustomLocation,
      );

      // The store will handle showing the success toast and updating the status column
      // Both will now be consistent based on the actual conversion result
    } catch (error) {
      // Error handling is already done in the store
      // The store will show the error toast and update the status column to 'failed'
      console.error('Conversion failed:', error);
    }
  };

  return (
    <FormatConverterMenu
      menuPositionClass={menuPositionClass}
      onConvert={handleConversion}
    />
  );
};

export default ConversionHandler;
