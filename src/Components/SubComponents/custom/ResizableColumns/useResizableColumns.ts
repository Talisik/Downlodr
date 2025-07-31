/**
 * A custom React hook
 * Provides functionality for resizable columns in a table.
 * It manages the state of the columns, handles mouse events for resizing, and updates
 * the column widths dynamically based on user interactions.
 *
 * Features:
 * - Auto-resizes ALL columns proportionally when window is resized (maintains relative proportions)
 * - Manual column resizing with flexible minWidth enforcement:
 *   - Window width ≤ 1400px: Enforces minWidth constraints
 *   - Window width > 1400px: Allows resizing below minWidth (table becomes narrower)
 * - Drag and drop column reordering
 * - Cursor and state management for smooth user experience
 * - Proportional scaling preserves user's manual adjustments while adapting to window size
 *
 * @param initialColumns - An array of Column objects that define the initial state of the columns.
 * @param visibleColumnIds - An optional array of column IDs to filter the visible columns.
 * @returns An object containing the current columns and functions for resizing and reordering.
 *   - columns: The current state of the columns with updated widths.
 *   - startResizing: A function to initiate the resizing process for a specific column.
 *   - startDragging: A function to initiate column drag operation.
 *   - handleDragOver: A function to handle drag over events.
 *   - handleDrop: A function to handle drop events for reordering.
 *   - cancelDrag: A function to cancel drag operations.
 *   - dragging: Current dragging state.
 *   - dragOverIndex: Current drag over index.
 */

import { useCallback, useEffect, useState } from 'react';

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
  // State to track the window width
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

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

  // Function to calculate if minWidth should be enforced during manual resize
  const shouldEnforceMinWidth = useCallback(() => {
    // Only enforce minWidth when window width <= 1400px
    // Above 1400px, allow users to resize smaller and make table narrower
    // Auto-resizing scales all columns proportionally and always respects minWidth
    return windowWidth <= 1400;
  }, [windowWidth]);

  // Window resize handler - always allow auto-resizing
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const oldWidth = windowWidth;
      setWindowWidth(newWidth);

      // Calculate the scale factor for proportional resizing
      const scaleFactor = newWidth / oldWidth;

      // Only apply scaling if the change is significant (avoid tiny adjustments)
      if (Math.abs(scaleFactor - 1) > 0.05) {
        // Scale all columns proportionally based on window width change
        setColumns((prevColumns) => {
          return prevColumns.map((col) => {
            const newColumnWidth = Math.round(col.width * scaleFactor);
            // Ensure the new width respects the minimum width
            const finalWidth = Math.max(col.minWidth || 5, newColumnWidth);
            return { ...col, width: finalWidth };
          });
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [windowWidth]);

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

      // Calculate the new width
      let newWidth = startWidth + diff;

      // Only enforce minWidth if conditions require it
      if (shouldEnforceMinWidth()) {
        newWidth = Math.max(currentColumn.minWidth || 5, newWidth);
      } else {
        // Allow smaller than minWidth but keep a reasonable minimum
        newWidth = Math.max(5, newWidth);
      }

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
  }, [resizing, columns, shouldEnforceMinWidth]);

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

    // full safety timeout to reset drag state if it gets stuck
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

  // full new function to cancel drag operations
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
