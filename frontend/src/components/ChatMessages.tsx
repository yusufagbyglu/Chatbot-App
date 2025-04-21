import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FiUser, FiCpu } from 'react-icons/fi';
import { ScrollArea } from './ui/scroll-area';
import { type Message } from '../pages/Chat';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function ChatMessages({
  messages,
  isLoading,
  messagesEndRef,
}: ChatMessagesProps) {
  const [typingIndex, setTypingIndex] = useState(-1);

  // Reset typing animation when messages change
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      setTypingIndex(messages.length - 1);
    }
  }, [messages]);

  const renderMessageContent = (content: string, isTyping: boolean) => {
    if (!content) return null;
    
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  };

  return (
    <ScrollArea className="h-full pb-4">
      <div className="space-y-4 px-1">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-100'
                }`}
              >
                <div className="mr-2 mt-1 flex-shrink-0">
                  {message.role === 'user' ? (
                    <FiUser size={16} />
                  ) : (
                    <FiCpu size={16} />
                  )}
                </div>
                <div className="flex-1">
                  {renderMessageContent(
                    message.content,
                    index === typingIndex
                  )}
                  {index === typingIndex && message.content === '' && isLoading && (
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-300"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-300" style={{ animationDelay: '0.2s' }}></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-300" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && messages.length === 0 && (
          <div className="flex justify-start">
            <div className="flex max-w-[80%] rounded-lg bg-gray-200 px-4 py-2 dark:bg-gray-700 dark:text-gray-100">
              <div className="mr-2 mt-1">
                <FiCpu size={16} />
              </div>
              <div className="flex space-x-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-300"></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-300" style={{ animationDelay: '0.2s' }}></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-300" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
