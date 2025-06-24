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

// Utility function to reset cursor styles
const resetCursor = () => {
  document.body.style.cursor = '';
  document.documentElement.style.cursor = '';
  // Also try to reset any potential cursor styles on the html element
  if (document.documentElement.style.cursor) {
    document.documentElement.style.cursor = '';
  }
};

// Utility function to reset drag states
const resetDragStates = (
  setDragging: React.Dispatch<
    React.SetStateAction<{ columnId: string; index: number } | null>
  >,
  setDragOverIndex: React.Dispatch<React.SetStateAction<number | null>>,
) => {
  setDragging(null);
  setDragOverIndex(null);
};

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

  // Add window focus handler to reset cursor and drag states when window regains focus
  useEffect(() => {
    const handleWindowFocus = () => {
      // Reset cursor when window regains focus to prevent stuck cursor
      if (!resizing) {
        resetCursor();
      }
      // Reset drag states when window regains focus to prevent stuck drag UI
      if (dragging || dragOverIndex !== null) {
        resetDragStates(setDragging, setDragOverIndex);
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [resizing, dragging, dragOverIndex]);

  // Add drag cleanup handlers
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel any active drag operation
        if (dragging || dragOverIndex !== null) {
          resetDragStates(setDragging, setDragOverIndex);
        }
      }
    };

    const handleMouseLeave = () => {
      // Reset drag states when mouse leaves the window to prevent stuck states
      if (dragging || dragOverIndex !== null) {
        resetDragStates(setDragging, setDragOverIndex);
      }
    };

    const handleDragEnd = () => {
      // Ensure drag states are reset when drag operation ends
      resetDragStates(setDragging, setDragOverIndex);
    };

    // Add global event listeners for drag cleanup
    document.addEventListener('keydown', handleEscapeKey);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('dragend', handleDragEnd);

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, [dragging, dragOverIndex]);

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
      document.body.style.userSelect = ''; // Restore text selection
      resetCursor(); // Use utility function to reset cursor

      // Additional cursor cleanup - force reset after a short delay
      setTimeout(() => {
        resetCursor();
      }, 50);
    };

    // Function to handle escape key during resizing
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && resizing) {
        // Cancel resize operation and reset cursor
        setResizing(null);
        document.body.style.userSelect = '';
        resetCursor();
      }
    };

    // Add event listeners for mouse movement and mouse release if resizing
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.userSelect = 'none'; // Prevent text selection during resizing
      document.body.style.cursor = 'col-resize'; // Change cursor to indicate resizing
    }

    // Cleanup event listeners on component unmount or when resizing changes
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);

      // Ensure cursor is always reset on cleanup
      if (!resizing) {
        resetCursor();
      }
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

    // Add a safety timeout to reset drag state if it gets stuck
    setTimeout(() => {
      // Only reset if we're still in the same drag operation
      setDragging((current) => {
        if (
          current &&
          current.columnId === columnId &&
          current.index === index
        ) {
          return null; // Reset if still stuck in the same drag operation
        }
        return current; // Keep current state if it has changed
      });
      setDragOverIndex(null);
    }, 10000); // 10-second safety timeout
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

    // Always reset drag states after drop, regardless of success
    resetDragStates(setDragging, setDragOverIndex);

    // Additional cleanup with a small delay to ensure UI updates
    setTimeout(() => {
      resetDragStates(setDragging, setDragOverIndex);
    }, 100);
  };

  // Add a new function to cancel drag operations
  const cancelDrag = () => {
    resetDragStates(setDragging, setDragOverIndex);
  };

  // Return the current columns and functions
  return {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    cancelDrag,
    dragging,
    dragOverIndex,
  };
};
