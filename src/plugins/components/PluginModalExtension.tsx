import React from 'react';
import { Button } from '../../Components/SubComponents/shadcn/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../Components/SubComponents/shadcn/components/ui/dialog';
import { PluginModalOptions, PluginModalResult } from '../types';

// Import UI components

interface PluginModalExtensionProps {
  isOpen: boolean;
  onClose: () => void;
  onOk: () => void;
  onCancel: () => void;
  options: PluginModalOptions;
  onAction: (result: PluginModalResult) => void;
}

const PluginModalExtension: React.FC<PluginModalExtensionProps> = ({
  isOpen,
  onClose,
  onOk,
  onCancel,
  options,
  // onAction,
}) => {
  // Handle the close event
  const handleClose = () => {
    if (options.callbacks?.onClose) {
      options.callbacks.onClose();
    }
    onClose();
  };

  // Extract properties from options
  const {
    title = 'Plugin Modal',
    content,
    width = 500,
    height,
    closable = true,
    centered = true,
    footer = (
      <>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onOk}>OK</Button>
      </>
    ),
  } = options;

  // Prepare style for the dialog content
  const contentStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
  };

  if (height) {
    contentStyle.height = typeof height === 'number' ? `${height}px` : height;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={closable ? () => handleClose() : undefined}
    >
      <DialogContent style={contentStyle} className={centered ? 'mx-auto' : ''}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div>
          {typeof content === 'string' ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            content
          )}
        </div>

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
};

export default PluginModalExtension;
