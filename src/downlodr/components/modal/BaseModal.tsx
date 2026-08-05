import { useModalAnimation } from '@/core-app/hooks/animation/usePopModal';
import { useEffect } from 'react';
import { IoMdClose } from 'react-icons/io';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;

  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;

  width?: string; // tailwind width class
  maxHeight?: string; // optional tailwind max-height class (e.g. max-h-[90vh])
  contentClassName?: string; // optional class for content area (e.g. max-h overflow-y-auto)
  containerClassName?: string; // optional class to override the modal container (e.g. bg-white)
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
}

const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
  maxHeight,
  contentClassName,
  containerClassName,
  closeOnOverlay = true,
  showCloseButton = true,
}) => {
  const { overlayRef, modalRef, mounted } = useModalAnimation(isOpen);

  // ESC key support
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden'; // lock scroll

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={`${
          containerClassName ?? 'bg-FooterBg dark:bg-darkMode'
        } rounded-lg w-full ${width} mx-2 shadow-xl flex flex-col overflow-hidden${
          maxHeight ? ` ${maxHeight}` : ''
        }`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 py-6">
            <div className="text-[14.5px] font-extrabold text-gray-900 dark:text-gray-100">
              {title}
            </div>

            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <IoMdClose size={16} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div
          className={
            maxHeight
              ? `${
                  contentClassName ?? 'px-6'
                } flex-1 min-h-0 overflow-y-auto mr-1`
              : contentClassName ?? 'px-6'
          }
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="bg-FooterBg dark:bg-darkMode px-4 py-3 rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseModal;
