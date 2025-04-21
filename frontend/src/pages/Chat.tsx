import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// import { useTheme } from '../contexts/ThemeContext';
import { api } from '../lib/api';
import { useToast } from '../hooks/use-toast';
import ChatSidebar from '../components/ChatSidebar';
import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import ChatMessages from '../components/ChatMessages';
import PDFUploader from '../components/PDFUploader';
import { FiMenu } from 'react-icons/fi';
import { Button } from '../components/ui/button';

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
};

export type Chat = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
};

export default function Chat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isPdfMode, setIsPdfMode] = useState(false);
  const [currentPdfId, setCurrentPdfId] = useState<string | null>(null);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  // const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // Check if screen is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Fetch chats on component mount
  useEffect(() => {
    fetchChats();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update messages when current chat changes
  useEffect(() => {
    if (currentChat) {
      setMessages(currentChat.messages || []);
    } else {
      setMessages([]);
    }
  }, [currentChat]);

  const fetchChats = async () => {
    try {
      const response = await api.get('/chats');
      setChats(response.data);
      
      // Set current chat to the most recent one if none is selected
      if (response.data.length > 0 && !currentChat) {
        setCurrentChat(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chats. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const createNewChat = async () => {
    try {
      const response = await api.post('/chats', {
        title: 'New Chat',
      });
      
      const newChat = response.data;
      setChats([newChat, ...chats]);
      setCurrentChat(newChat);
      setMessages([]);
      setIsPdfMode(false);
      setCurrentPdfId(null);
      setIsSearchEnabled(false);
    } catch (error) {
      console.error('Error creating new chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to create a new chat. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const deleteChat = async (chatId: number) => {
    try {
      // FIXED: Added backticks to properly form the template string
      await api.delete(`/chats/${chatId}`);
      
      const updatedChats = chats.filter(chat => chat.id !== chatId);
      setChats(updatedChats);
      
      if (currentChat?.id === chatId) {
        setCurrentChat(updatedChats.length > 0 ? updatedChats[0] : null);
      }
      
      toast({
        title: 'Success',
        description: 'Chat deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete chat. Please try again.',
        variant: 'destructive',
      });
    }
  };




  const sendMessage = async (content: string) => {
    if (!content.trim() || !currentChat) return;
    
    // Create a temporary message ID
    const tempId = Date.now().toString();
    
    // Add user message to the UI immediately
    const userMessage: Message = {
      id: tempId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Create a placeholder for the assistant's response
    const assistantPlaceholder: Message = {
      // FIXED: Added backticks around the template literal
      id: `${tempId}-assistant`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, assistantPlaceholder]);
    setIsLoading(true);
    
    try {
      // FIXED: Added backticks to properly form the template string
      let endpoint = `/chats/${currentChat.id}/messages`;
      const params: Record<string, any> = { message: content };
      
      if (isPdfMode && currentPdfId) {
        params.pdf_id = currentPdfId;
      }
      
      if (isSearchEnabled) {
        params.search = true;
      }
      
      // Get token from localStorage and ensure it's a string (never null)
      const token = localStorage.getItem('token') || '';
      // Set up SSE for streaming response, passing token as a query parameter
      const sseParams: Record<string, string> = { ...params, token };
      // FIXED: Added backticks to properly form the template string
      const sseUrl = `${api.defaults.baseURL}${endpoint}?${new URLSearchParams(sseParams).toString()}`;
      const eventSource = new EventSource(sseUrl, { withCredentials: true });
      
      let fullResponse = '';
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'content') {
            fullResponse += data.content;
            
            // Update the assistant message with the accumulated response
            setMessages(prev => 
              prev.map(msg => 
                // FIXED: Added backticks to properly form the template string
                msg.id === `${tempId}-assistant` 
                  ? { ...msg, content: fullResponse } 
                  : msg
              )
            );
          } else if (data.type === 'search_results') {
            // Handle search results if needed
            console.log('Search results:', data.results);
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
        setIsLoading(false);
        
        toast({
          title: 'Error',
          description: 'Failed to get response. Please try again.',
          variant: 'destructive',
        });
      };
      
      eventSource.addEventListener('end', () => {
        eventSource.close();
        setIsLoading(false);
        
        // Refresh the chat to get the updated messages from the server
        fetchChat(currentChat.id);
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const fetchChat = async (chatId: number) => {
    try {
      // FIXED: Added backticks to properly form the template string
      const response = await api.get(`/chats/${chatId}`);
      
      // Update the chat in the chats list
      setChats(prev => 
        prev.map(chat => 
          chat.id === chatId ? response.data : chat
        )
      );
      
      // Update current chat if it's the one being viewed
      if (currentChat?.id === chatId) {
        setCurrentChat(response.data);
        setMessages(response.data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  };

  const handlePdfUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await api.post('/pdfs/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setCurrentPdfId(response.data.id);
      setIsPdfMode(true);
      
      toast({
        title: 'PDF Uploaded',
        description: 'You can now ask questions about this document.',
      });
      
      // Create a new chat for this PDF if we don't have a current chat
      if (!currentChat) {
        createNewChat();
      }
    } catch (error) {
      console.error('Error uploading PDF:', error);
      
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload PDF. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const toggleSearch = () => {
    setIsSearchEnabled(!isSearchEnabled);
    
    toast({
      title: isSearchEnabled ? 'Web Search Disabled' : 'Web Search Enabled',
      description: isSearchEnabled 
        ? 'The AI will no longer search the web for answers.' 
        : 'The AI will now search the web to provide more accurate answers.',
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mobile sidebar toggle */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-4 z-50 md:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <FiMenu size={24} />
        </Button>
      )}
      
      {/* Sidebar */}
      <ChatSidebar
        chats={chats}
        currentChat={currentChat}
        setCurrentChat={setCurrentChat}
        createNewChat={createNewChat}
        deleteChat={deleteChat}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        onLogout={handleLogout}
        username={user?.username || ''}
      />
      
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatHeader 
          title={currentChat?.title || 'New Chat'} 
          isPdfMode={isPdfMode}
          isSearchEnabled={isSearchEnabled}
          toggleSearch={toggleSearch}
        />
        
        <div className="flex-1 overflow-hidden bg-white p-4 dark:bg-gray-800">
          {currentChat ? (
            <ChatMessages 
              messages={messages} 
              isLoading={isLoading} 
              messagesEndRef={messagesEndRef}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center">
              <h2 className="mb-4 text-xl font-semibold">Welcome to AI Chatbot</h2>
              <p className="mb-8 text-center text-gray-600 dark:text-gray-400">
                Start a new chat or select an existing one from the sidebar.
              </p>
              <Button onClick={createNewChat}>Start New Chat</Button>
            </div>
          )}
          
          {/* PDF Uploader */}
          {!isPdfMode && (
            <PDFUploader onUpload={handlePdfUpload} />
          )}
        </div>
        
        <ChatInput 
          onSendMessage={sendMessage} 
          disabled={isLoading || !currentChat}
          isPdfMode={isPdfMode}
        />
      </div>
    </div>
  );
}