/**
 * Test suite for CollapsibleSection component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CollapsibleSection from './CollapsibleSection';

describe('CollapsibleSection', () => {
  const defaultProps = {
    title: 'Test Section',
    children: <div>Test Content</div>,
  };

  it('should render with title and be collapsed by default', () => {
    render(<CollapsibleSection {...defaultProps} />);
    
    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle test section/i })).toBeInTheDocument();
    
    const content = screen.getByText('Test Content');
    expect(content.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('should be expanded when defaultExpanded is true', () => {
    render(<CollapsibleSection {...defaultProps} defaultExpanded={true} />);
    
    const button = screen.getByRole('button', { name: /toggle test section/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    
    const content = screen.getByText('Test Content');
    expect(content.parentElement).toHaveAttribute('aria-hidden', 'false');
  });

  it('should toggle expansion when button is clicked', async () => {
    render(<CollapsibleSection {...defaultProps} />);
    
    const button = screen.getByRole('button', { name: /toggle test section/i });
    
    // Initially collapsed
    expect(button).toHaveAttribute('aria-expanded', 'false');
    
    // Click to expand
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
    
    // Click to collapse
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('should call onToggle callback when expanded/collapsed', () => {
    const onToggle = jest.fn();
    render(<CollapsibleSection {...defaultProps} onToggle={onToggle} />);
    
    const button = screen.getByRole('button', { name: /toggle test section/i });
    
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith(true);
    
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('should use custom aria-label when provided', () => {
    render(
      <CollapsibleSection 
        {...defaultProps} 
        ariaLabel="Custom section toggle"
      />
    );
    
    expect(screen.getByRole('button', { name: 'Custom section toggle' })).toBeInTheDocument();
  });

  it('should apply custom CSS classes', () => {
    render(
      <CollapsibleSection 
        {...defaultProps}
        className="custom-section"
        titleClassName="custom-title"
        contentClassName="custom-content"
      />
    );
    
    const section = screen.getByText('Test Section').closest('.pt-3');
    expect(section).toHaveClass('custom-section');
    
    expect(screen.getByText('Test Section')).toHaveClass('custom-title');
    
    const content = screen.getByRole('region', { name: /test section content/i });
    expect(content).toHaveClass('custom-content');
  });

  it('should have proper accessibility attributes', () => {
    render(<CollapsibleSection {...defaultProps} />);
    
    const button = screen.getByRole('button', { name: /toggle test section/i });
    const content = screen.getByRole('region', { name: /test section content/i });
    
    expect(button).toHaveAttribute('aria-expanded');
    expect(button).toHaveAttribute('aria-controls', content.id);
    expect(content).toHaveAttribute('aria-label', 'Test Section content');
  });

  it('should show correct chevron icons based on expansion state', () => {
    render(<CollapsibleSection {...defaultProps} />);
    
    const button = screen.getByRole('button', { name: /toggle test section/i });
    
    // Should show down chevron when collapsed
    expect(button.querySelector('svg')).toBeInTheDocument();
    
    fireEvent.click(button);
    
    // Should show up chevron when expanded
    expect(button.querySelector('svg')).toBeInTheDocument();
  });
});
