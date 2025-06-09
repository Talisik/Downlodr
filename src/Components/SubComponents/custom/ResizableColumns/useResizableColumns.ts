/**
 * A custom React hook
 * Provides functionality for resizable columns in a table.
 * It manages the state of the columns, handles mouse events for resizing, and updates
 * the column widths dynamically based on user interactions.
 *
 * @param initialColumns - An array of Column objects that define the initial state of the columns.
 * @param visibleColumnIds - An optional array of column IDs to filter the visible columns.
 * @returns An object containing the current columns and a function to start resizing.
 *   - columns: The current state of the columns with updated widths.
 *   - startResizing: A function to initiate the resizing process for a specific column.
 */

import { useEffect, useState } from 'react';

// Interface representing a column in the table
interface Column {
  id: string;
  width: number;
  minWidth?: number;
}

export const useResizableColumns = (
  initialColumns: Column[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visibleColumnIds?: string[],
) => {
  // State to hold the current columns
  const [columns, setColumns] = useState(initialColumns);
  // State to track the resizing state
  const [resizing, setResizing] = useState<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  // State to track dragging
  const [dragging, setDragging] = useState<{
    columnId: string;
    index: number;
  } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // UseEffect to handle mouse movement during resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;

      const { columnId, startX, startWidth } = resizing;
      // Calculate the difference in mouse position
      const diff = e.clientX - startX;
      const currentColumn = columns.find((col) => col.id === columnId);
      // Exit if the column is not found
      if (!currentColumn) return;

      // Calculate the new width, ensuring it respects the minimum width
      const newWidth = Math.max(currentColumn.minWidth || 5, startWidth + diff);

      // Update the columns state with the new width
      setColumns((prevColumns) =>
        prevColumns.map((col) =>
          col.id === columnId ? { ...col, width: newWidth } : col,
        ),
      );
    };

    // Function to handle mouse release after resizing
    const handleMouseUp = () => {
      setResizing(null); // Reset resizing state
      document.body.style.userSelect = ''; // Restore cursor style
      document.body.style.cursor = ''; // Restore cursor style
    };

    // Add event listeners for mouse movement and mouse release if resizing
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Prevent text selection during resizing
      document.body.style.cursor = 'col-resize'; // Change cursor to indicate resizing
    }
    // Cleanup event listeners on component unmount or when resizing changes
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, columns]);

  // Function to initiate the resizing process for a specific column.
  // columnId - The ID of the column to resize.
  // startX - The initial mouse X position when resizing starts.
  const startResizing = (columnId: string, startX: number) => {
    const column = columns.find((col) => col.id === columnId);
    if (!column) return;

    // Set the resizing state with the column ID and initial values
    setResizing({
      columnId,
      startX,
      startWidth: column.width,
    });
  };

  // Start dragging a column
  const startDragging = (columnId: string, index: number) => {
    setDragging({ columnId, index });
  };

  // Modified drag handlers
  const handleDragOver = (index: number) => {
    if (dragging && index !== dragging.index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = () => {
    if (
      dragging &&
      dragOverIndex !== null &&
      dragOverIndex !== dragging.index
    ) {
      setColumns((prevColumns) => {
        const newColumns = [...prevColumns];
        const [draggedColumn] = newColumns.splice(dragging.index, 1);
        newColumns.splice(dragOverIndex, 0, draggedColumn);
        return newColumns;
      });
    }
    setDragging(null);
    setDragOverIndex(null);
  };

  // Return the current columns and functions
  return {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    dragging,
    dragOverIndex,
  };
};
