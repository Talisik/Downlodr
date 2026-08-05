/* Handler for developer tools of base app such as opening dev tools, etc. */
/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { BrowserWindow, ipcMain } from 'electron';
import { logError, logInfo } from '../../telemetry/otel-logs';
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */
export const pluginFunctionsHandler = (mainWindow: BrowserWindow) => {
  // function to handle the dev tools or console open
  ipcMain.handle(
    'convert-to-docx',
    async (event, content: string, title = 'Video Captions') => {
      try {
        // Dynamic import of docx module to avoid bundling issues
        const docx = await import('docx');
        const { Document, Paragraph, TextRun, Packer } = docx;

        // Validate constructors
        if (
          typeof Document !== 'function' ||
          typeof Paragraph !== 'function' ||
          typeof TextRun !== 'function'
        ) {
          throw new Error('DOCX constructors not available');
        }

        // Split content into paragraphs (handle both \n\n and \n splitting)
        let paragraphs = content.split('\n\n').filter((p) => p.trim());

        // If we don't get enough paragraphs with \n\n, try splitting on single \n
        if (paragraphs.length < 3) {
          paragraphs = content.split('\n').filter((p) => p.trim());
        }

        logInfo('Creating DOCX', { paragraphCount: paragraphs.length, title });

        // Create document children
        const children = [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 32, // 16pt (size in half-points)
              }),
            ],
            spacing: {
              after: 400, // Space after title
            },
          }),
        ];

        // Add content paragraphs
        paragraphs.forEach((paragraph) => {
          if (paragraph.trim()) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: paragraph.trim(),
                    size: 24, // 12pt (size in half-points)
                  }),
                ],
                spacing: {
                  after: 200, // Space after paragraph
                },
              }),
            );
          }
        });

        // Create the document
        const doc = new Document({
          sections: [
            {
              properties: {},
              children: children,
            },
          ],
        });

        logInfo('Generating DOCX buffer');

        // Generate buffer for Node.js environment
        const buffer = await Packer.toBuffer(doc);

        logInfo('DOCX buffer generated', { size: buffer.length });

        return {
          success: true,
          buffer: Array.from(buffer), // Convert Buffer to array for IPC transfer
          size: buffer.length,
        };
      } catch (error) {
        logError('Error creating DOCX', { error: error.message, title });
        return {
          success: false,
          error: `Failed to create DOCX document: ${error.message}`,
        };
      }
    },
  );
};
