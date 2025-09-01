import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock window.electronAPI
const mockConvertFile = jest.fn();
Object.defineProperty(window, 'electronAPI', {
  value: {
    convertFile: mockConvertFile,
  },
  writable: true,
});

describe('Format Conversion File Paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CC to Markdown conversion', () => {
    it('should save TXT files in the same directory as the source video', async () => {
      // Arrange
      const downloadId = 'test-download-123';
      const inputPath = '/Users/test/Downloads/RAG Just Got Updated.mp4';
      const targetFormat = 'TXT';
      const keepOriginal = true;
      const downloadName = 'RAG Just Got Updated.mp4';

      const expectedOutputDir = '/Users/test/Downloads'; // Same directory as source

      mockConvertFile.mockResolvedValue({
        success: true,
        outputPath: `${expectedOutputDir}/RAG Just Got Updated_txt_${Date.now()}.txt`,
      });

      // Act
      const result = await window.electronAPI.convertFile({
        downloadId,
        inputPath,
        targetFormat,
        keepOriginal,
        downloadName,
      });

      // Assert
      expect(mockConvertFile).toHaveBeenCalledWith({
        downloadId,
        inputPath,
        targetFormat,
        keepOriginal,
        downloadName,
      });

      expect(result.success).toBe(true);
      expect(result.outputPath).toContain(expectedOutputDir);
      expect(result.outputPath).toMatch(/\.txt$/);
    });

    it('should save DOCX files in the same directory as the source video', async () => {
      // Arrange
      const downloadId = 'test-download-456';
      const inputPath = '/Users/test/Downloads/Video Title.mp4';
      const targetFormat = 'DOCX';
      const keepOriginal = true;
      const downloadName = 'Video Title.mp4';

      const expectedOutputDir = '/Users/test/Downloads';

      mockConvertFile.mockResolvedValue({
        success: true,
        outputPath: `${expectedOutputDir}/Video Title_docx_${Date.now()}.docx`,
      });

      // Act
      const result = await window.electronAPI.convertFile({
        downloadId,
        inputPath,
        targetFormat,
        keepOriginal,
        downloadName,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.outputPath).toContain(expectedOutputDir);
      expect(result.outputPath).toMatch(/\.docx$/);
    });

    it('should handle video files in subdirectories correctly', async () => {
      // Arrange
      const downloadId = 'test-download-789';
      const inputPath = '/Users/test/Downloads/Series/Episode 1.mp4';
      const targetFormat = 'TXT';
      const keepOriginal = true;
      const downloadName = 'Episode 1.mp4';

      const expectedOutputDir = '/Users/test/Downloads/Series'; // Same subdirectory

      mockConvertFile.mockResolvedValue({
        success: true,
        outputPath: `${expectedOutputDir}/Episode 1_txt_${Date.now()}.txt`,
      });

      // Act
      const result = await window.electronAPI.convertFile({
        downloadId,
        inputPath,
        targetFormat,
        keepOriginal,
        downloadName,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.outputPath).toContain(expectedOutputDir);
      expect(result.outputPath).not.toContain('/FormatConverter/'); // Should not create subdirectory for text files
    });
  });

  describe('Video format conversion', () => {
    it('should continue to save video files in FormatConverter subdirectory', async () => {
      // Arrange
      const downloadId = 'test-download-999';
      const inputPath = '/Users/test/Downloads/Video.mp4';
      const targetFormat = 'MP3';
      const keepOriginal = true;
      const downloadName = 'Video.mp4';

      const expectedOutputPath =
        '/Users/test/Downloads/FormatConverter/Video_mp3_123456.mp3';

      mockConvertFile.mockResolvedValue({
        success: true,
        outputPath: expectedOutputPath,
      });

      // Act
      const result = await window.electronAPI.convertFile({
        downloadId,
        inputPath,
        targetFormat,
        keepOriginal,
        downloadName,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.outputPath).toContain('/FormatConverter/');
      expect(result.outputPath).toMatch(/\.mp3$/);
    });
  });
});
