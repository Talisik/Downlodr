import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import FormatConverterMenu from './FormatConverterMenu';
import { useMainStore } from '@/Store/mainStore';

// Mock dependencies
jest.mock('@/Store/mainStore');
jest.mock('@/Components/SubComponents/shadcn/hooks/use-toast');

const mockUseMainStore = useMainStore as jest.MockedFunction<
  typeof useMainStore
>;

describe('FormatConverterMenu', () => {
  const mockOnConvert = jest.fn();
  const mockClearAllSelections = jest.fn();

  const defaultProps = {
    menuPositionClass: 'test-position',
    onConvert: mockOnConvert,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock store state
    mockUseMainStore.mockImplementation((selector) => {
      const mockState = {
        selectedDownloads: [
          {
            id: 'test-download-1',
            name: 'Test Video.mp4',
            location: '/path/to/Test Video.mp4',
          },
        ],
        clearAllSelections: mockClearAllSelections,
      };

      if (typeof selector === 'function') {
        return selector(mockState);
      }
      return mockState;
    });
  });

  describe('Format Options', () => {
    it('should include text formats in the format list', () => {
      render(<FormatConverterMenu {...defaultProps} />);

      // Check that text formats are available
      const formatSelect = screen.getByRole('combobox');
      fireEvent.click(formatSelect);

      expect(screen.getByText('TXT')).toBeInTheDocument();
      expect(screen.getByText('DOCX')).toBeInTheDocument();
      expect(screen.getByText('MD')).toBeInTheDocument();
    });

    it('should include traditional video formats', () => {
      render(<FormatConverterMenu {...defaultProps} />);

      const formatSelect = screen.getByRole('combobox');
      fireEvent.click(formatSelect);

      expect(screen.getByText('MP4')).toBeInTheDocument();
      expect(screen.getByText('MP3')).toBeInTheDocument();
      expect(screen.getByText('MOV')).toBeInTheDocument();
      expect(screen.getByText('AVI')).toBeInTheDocument();
      expect(screen.getByText('MKV')).toBeInTheDocument();
    });
  });

  describe('CC to Markdown Conversion', () => {
    it('should handle TXT format conversion', async () => {
      render(<FormatConverterMenu {...defaultProps} />);

      // Select TXT format
      const formatSelect = screen.getByRole('combobox');
      fireEvent.click(formatSelect);
      fireEvent.click(screen.getByText('TXT'));

      // Click convert button
      const convertButton = screen.getByText('Convert');
      fireEvent.click(convertButton);

      await waitFor(() => {
        expect(mockOnConvert).toHaveBeenCalledWith(
          'test-download-1',
          'TXT',
          false,
        );
      });
    });

    it('should handle DOCX format conversion', async () => {
      render(<FormatConverterMenu {...defaultProps} />);

      // Select DOCX format
      const formatSelect = screen.getByRole('combobox');
      fireEvent.click(formatSelect);
      fireEvent.click(screen.getByText('DOCX'));

      // Click convert button
      const convertButton = screen.getByText('Convert');
      fireEvent.click(convertButton);

      await waitFor(() => {
        expect(mockOnConvert).toHaveBeenCalledWith(
          'test-download-1',
          'DOCX',
          false,
        );
      });
    });

    it('should handle Markdown format conversion', async () => {
      render(<FormatConverterMenu {...defaultProps} />);

      // Select MD format
      const formatSelect = screen.getByRole('combobox');
      fireEvent.click(formatSelect);
      fireEvent.click(screen.getByText('MD'));

      // Click convert button
      const convertButton = screen.getByText('Convert');
      fireEvent.click(convertButton);

      await waitFor(() => {
        expect(mockOnConvert).toHaveBeenCalledWith(
          'test-download-1',
          'MD',
          false,
        );
      });
    });
  });

  describe('Keep Original File Option', () => {
    it('should respect keep original setting for text formats', async () => {
      render(<FormatConverterMenu {...defaultProps} />);

      // Enable keep original
      const keepOriginalCheckbox = screen.getByRole('checkbox');
      fireEvent.click(keepOriginalCheckbox);

      // Select TXT format
      const formatSelect = screen.getByRole('combobox');
      fireEvent.click(formatSelect);
      fireEvent.click(screen.getByText('TXT'));

      // Click convert button
      const convertButton = screen.getByText('Convert');
      fireEvent.click(convertButton);

      await waitFor(() => {
        expect(mockOnConvert).toHaveBeenCalledWith(
          'test-download-1',
          'TXT',
          true, // keepOriginal should be true
        );
      });
    });
  });

  describe('Multiple Downloads', () => {
    beforeEach(() => {
      // Mock store with multiple downloads
      mockUseMainStore.mockImplementation((selector) => {
        const mockState = {
          selectedDownloads: [
            {
              id: 'test-download-1',
              name: 'Test Video 1.mp4',
              location: '/path/to/Test Video 1.mp4',
            },
            {
              id: 'test-download-2',
              name: 'Test Video 2.mp4',
              location: '/path/to/Test Video 2.mp4',
            },
          ],
          clearAllSelections: mockClearAllSelections,
        };

        if (typeof selector === 'function') {
          return selector(mockState);
        }
        return mockState;
      });
    });

    it('should convert multiple files to text format', async () => {
      render(<FormatConverterMenu {...defaultProps} />);

      // Select TXT format
      const formatSelect = screen.getByRole('combobox');
      fireEvent.click(formatSelect);
      fireEvent.click(screen.getByText('TXT'));

      // Click convert button
      const convertButton = screen.getByText('Convert');
      fireEvent.click(convertButton);

      await waitFor(() => {
        expect(mockOnConvert).toHaveBeenCalledTimes(2);
        expect(mockOnConvert).toHaveBeenNthCalledWith(
          1,
          'test-download-1',
          'TXT',
          false,
        );
        expect(mockOnConvert).toHaveBeenNthCalledWith(
          2,
          'test-download-2',
          'TXT',
          false,
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error when no format is selected', async () => {
      const {
        toast,
      } = require('@/Components/SubComponents/shadcn/hooks/use-toast');

      render(<FormatConverterMenu {...defaultProps} />);

      // Click convert without selecting format
      const convertButton = screen.getByText('Convert');
      fireEvent.click(convertButton);

      expect(toast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Format Required',
        description: 'Please select a format to convert to.',
        duration: 3000,
      });
    });

    it('should show error when no downloads are selected', async () => {
      const {
        toast,
      } = require('@/Components/SubComponents/shadcn/hooks/use-toast');

      // Mock empty selection
      mockUseMainStore.mockImplementation((selector) => {
        const mockState = {
          selectedDownloads: [],
          clearAllSelections: mockClearAllSelections,
        };

        if (typeof selector === 'function') {
          return selector(mockState);
        }
        return mockState;
      });

      render(<FormatConverterMenu {...defaultProps} />);

      // Select format
      const formatSelect = screen.getByRole('combobox');
      fireEvent.click(formatSelect);
      fireEvent.click(screen.getByText('TXT'));

      // Click convert
      const convertButton = screen.getByText('Convert');
      fireEvent.click(convertButton);

      expect(toast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'No Downloads Selected',
        description: 'Please select at least one download to convert.',
        duration: 3000,
      });
    });
  });

  describe('UI Behavior', () => {
    it('should clear selections after successful conversion', async () => {
      render(<FormatConverterMenu {...defaultProps} />);

      // Select format
      const formatSelect = screen.getByRole('combobox');
      fireEvent.click(formatSelect);
      fireEvent.click(screen.getByText('TXT'));

      // Convert
      const convertButton = screen.getByText('Convert');
      fireEvent.click(convertButton);

      await waitFor(() => {
        expect(mockClearAllSelections).toHaveBeenCalled();
      });
    });
  });
});
