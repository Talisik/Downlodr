/* eslint-disable prettier/prettier */
export interface WriteFileOptions {
  fileName: string;
  content: string;
  fileType?: string;
  directory?: string;
  overwrite?: boolean;
  customPath?: string;
  pluginId: string;
}

export interface WriteFileResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface SaveDialogOptions {
  defaultPath?: string;
  content: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  title?: string;
  pluginId: string;
}

export interface SaveDialogResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

export { };

