import { useState } from 'react';
import { FiPlus, FiTrash2, FiLogOut, FiMoon, FiSun, FiX } from 'react-icons/fi';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { type Chat } from '../pages/Chat';

interface ChatSidebarProps {
  chats: Chat[];
  currentChat: Chat | null;
  setCurrentChat: (chat: Chat) => void;
  createNewChat: () => void;
  deleteChat: (chatId: number) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onLogout: () => void;
  username: string;
}

export default function ChatSidebar({
  chats,
  currentChat,
  setCurrentChat,
  createNewChat,
  deleteChat,
  isOpen,
  setIsOpen,
  onLogout,
  username,
}: ChatSidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [hoveredChatId, setHoveredChatId] = useState<number | null>(null);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const getChatTitle = (chat: Chat) => {
    if (chat.title && chat.title !== 'New Chat') {
      return chat.title;
    }
    
    // If no title or default title, use the first message content
    if (chat.messages && chat.messages.length > 0) {
      const firstUserMessage = chat.messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        return firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
      }
    }
    
    return 'New Chat';
  };

  return (
    <div 
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gray-50 transition-transform duration-300 ease-in-out dark:bg-gray-800 md:relative md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Close button for mobile */}
      <button
        className="absolute right-2 top-2 rounded-full p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 md:hidden"
        onClick={() => setIsOpen(false)}
      >
        <FiX size={20} />
      </button>
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <h2 className="text-lg font-semibold">AI Chatbot</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
        </Button>
      </div>
      
      {/* New Chat Button */}
      <div className="p-4">
        <Button 
          className="w-full justify-start gap-2" 
          onClick={createNewChat}
        >
          <FiPlus size={18} />
          New Chat
        </Button>
      </div>
      
      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group relative flex cursor-pointer items-center rounded-lg px-3 py-2 ${
                currentChat?.id === chat.id
                  ? 'bg-gray-200 dark:bg-gray-700'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => setCurrentChat(chat)}
              onMouseEnter={() => setHoveredChatId(chat.id)}
              onMouseLeave={() => setHoveredChatId(null)}
            >
              <div className="flex-1 truncate">
                <div className="text-sm font-medium">{getChatTitle(chat)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(chat.created_at)}
                </div>
              </div>
              
              {(hoveredChatId === chat.id || currentChat?.id === chat.id) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2 h-6 w-6 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  aria-label="Delete chat"
                >
                  <FiTrash2 size={14} />
                </Button>
              )}
            </div>
          ))}
          
          {chats.length === 0 && (
            <div className="px-3 py-2 text-center text-sm text-gray-500 dark:text-gray-400">
              No chats yet. Start a new conversation!
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* User Info & Logout */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-2 flex items-center">
          <div className="flex-1">
            <div className="text-sm font-medium">{username}</div>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2" 
          onClick={onLogout}
        >
          <FiLogOut size={18} />
          Logout
        </Button>
      </div>
    </div>
  );
}
