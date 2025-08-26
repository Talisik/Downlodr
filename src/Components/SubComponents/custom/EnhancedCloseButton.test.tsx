/**
 * Test suite for EnhancedCloseButton component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EnhancedCloseButton from './EnhancedCloseButton';

describe('EnhancedCloseButton', () => {
  it('should render close button with proper accessibility attributes', () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} />);
    
    const button = screen.getByRole('button', { name: /close/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Close dialog');
  });

  it('should call onClose when clicked', () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} />);
    
    const button = screen.getByRole('button', { name: /close/i });
    fireEvent.click(button);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should show hover effects on mouse enter and leave', async () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} />);
    
    const button = screen.getByRole('button', { name: /close/i });
    
    // Test hover classes are applied correctly
    expect(button).toHaveClass('hover:bg-gray-100');
    expect(button).toHaveClass('dark:hover:bg-gray-800');
    
    // Simulate hover
    fireEvent.mouseEnter(button);
    await waitFor(() => {
      // The hover effects should be visible
      expect(button).toHaveClass('transition-all');
    });
    
    fireEvent.mouseLeave(button);
  });

  it('should handle keyboard navigation properly', () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} />);
    
    const button = screen.getByRole('button', { name: /close/i });
    
    // Test Enter key
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
    
    // Test Space key
    fireEvent.keyDown(button, { key: ' ', code: 'Space' });
    expect(onClose).toHaveBeenCalledTimes(2);
    
    // Test Escape key
    fireEvent.keyDown(button, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('should be disabled when disabled prop is true', () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} disabled={true} />);
    
    const button = screen.getByRole('button', { name: /close/i });
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should use inspector variant as default', () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} />);
    
    const button = screen.getByRole('button', { name: /close/i });
    
    // Should have inspector variant styles by default
    expect(button).toHaveClass('bg-gray-100');
  });

  it('should support custom className', () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} className="custom-class" />);
    
    const button = screen.getByRole('button', { name: /close/i });
    expect(button).toHaveClass('custom-class');
  });

  it('should support inspector variant with proper styling', () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} variant="inspector" />);
    
    const button = screen.getByRole('button', { name: /close/i });
    
    // Check inspector variant styles are applied
    expect(button).toHaveClass('bg-gray-100');
    expect(button).toHaveClass('hover:bg-gray-200');
    expect(button).toHaveClass('border-gray-300');
    expect(button).toHaveClass('shadow-sm');
  });

  it('should support custom aria-label', () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} ariaLabel="Close modal window" />);
    
    const button = screen.getByRole('button', { name: 'Close modal window' });
    expect(button).toBeInTheDocument();
  });

  it('should have proper focus styling', () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} />);
    
    const button = screen.getByRole('button', { name: /close/i });
    
    // Check focus styles are present
    expect(button).toHaveClass('focus:outline-none');
    expect(button).toHaveClass('focus:ring-2');
    expect(button).toHaveClass('focus:ring-primary');
    expect(button).toHaveClass('focus:ring-offset-2');
  });

  it('should have larger clickable area for better UX', () => {
    const onClose = jest.fn();
    render(<EnhancedCloseButton onClose={onClose} />);
    
    const button = screen.getByRole('button', { name: /close/i });
    
    // Check size classes
    expect(button).toHaveClass('h-8'); // 32px height
    expect(button).toHaveClass('w-8'); // 32px width
    expect(button).toHaveClass('p-1'); // Padding for better click area
  });
});
