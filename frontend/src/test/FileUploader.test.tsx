import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileUploader from '../components/ui/FileUploader';

describe('FileUploader', () => {
  const mockOnFilesChange = vi.fn();

  beforeEach(() => {
    mockOnFilesChange.mockClear();
  });

  it('renders dropzone with correct text', () => {
    render(<FileUploader onFilesChange={mockOnFilesChange} />);

    expect(screen.getByText(/Drag & drop documents or click to select/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF, JPG, PNG/i)).toBeInTheDocument();
  });

  it('shows upload icon', () => {
    render(<FileUploader onFilesChange={mockOnFilesChange} />);

    const uploadIcon = document.querySelector('svg');
    expect(uploadIcon).toBeInTheDocument();
  });

  it('calls onFilesChange when files are dropped', () => {
    render(<FileUploader onFilesChange={mockOnFilesChange} />);

    const dropzone = screen.getByText(/Drag & drop documents/i).closest('div');
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    if (dropzone) {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });
    }

    expect(mockOnFilesChange).toHaveBeenCalled();
  });

  it('displays uploaded files list', () => {
    const { container } = render(<FileUploader onFilesChange={mockOnFilesChange} />);

    // Simulate file upload by calling the dropzone programmatically
    const input = container.querySelector('input[type="file"]');
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    if (input) {
      fireEvent.change(input, {
        target: {
          files: [mockFile],
        },
      });
    }

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText(/KB/i)).toBeInTheDocument();
  });

  it('allows removing uploaded files', () => {
    const { container } = render(<FileUploader onFilesChange={mockOnFilesChange} />);

    const input = container.querySelector('input[type="file"]');
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    if (input) {
      fireEvent.change(input, {
        target: {
          files: [mockFile],
        },
      });
    }

    const removeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(removeButton);

    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
  });

  it('is disabled when isDisabled prop is true', () => {
    render(<FileUploader onFilesChange={mockOnFilesChange} isDisabled />);

    const dropzone = screen.getByText(/Drag & drop documents/i).closest('div');
    expect(dropzone).toHaveClass('cursor-not-allowed');
  });
});
