import { useState, useRef, useEffect } from 'react';
import { FiSend } from 'react-icons/fi';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
  isPdfMode: boolean;
}

export default function ChatInput({
  onSendMessage,
  disabled,
  isPdfMode,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || disabled) return;
    
    onSendMessage(message);
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? 'Please wait...'
                : isPdfMode
                ? 'Ask a question about the PDF...'
                : 'Type a message...'
            }
            className="min-h-[60px] max-h-[200px] resize-none pr-10"
            disabled={disabled}
          />
        </div>
        
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || disabled}
          className="h-10 w-10 shrink-0"
        >
          <FiSend size={18} />
        </Button>
      </form>
      
      {isPdfMode && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          You're in PDF mode. Your questions will be answered based on the uploaded document.
        </p>
      )}
    </div>
  );
}
