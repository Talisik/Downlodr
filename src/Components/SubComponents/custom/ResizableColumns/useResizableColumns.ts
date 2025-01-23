import { useState, useEffect } from 'react';

interface Column {
  id: string;
  width: number;
  minWidth?: number;
}

export const useResizableColumns = (initialColumns: Column[]) => {
  const [columns, setColumns] = useState(initialColumns);
  const [resizing, setResizing] = useState<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;

      const { columnId, startX, startWidth } = resizing;
      const diff = e.clientX - startX;
      const currentColumn = columns.find((col) => col.id === columnId);
      if (!currentColumn) return;

      const newWidth = Math.max(
        currentColumn.minWidth || 50,
        startWidth + diff,
      );

      setColumns((prevColumns) =>
        prevColumns.map((col) =>
          col.id === columnId ? { ...col, width: newWidth } : col,
        ),
      );
    };

    const handleMouseUp = () => {
      setResizing(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, columns]);

  const startResizing = (columnId: string, startX: number) => {
    const column = columns.find((col) => col.id === columnId);
    if (!column) return;

    setResizing({
      columnId,
      startX,
      startWidth: column.width,
    });
  };

  return { columns, startResizing };
};
