import { FiSearch, FiFileText } from 'react-icons/fi';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

interface ChatHeaderProps {
  title: string;
  isPdfMode: boolean;
  isSearchEnabled: boolean;
  toggleSearch: () => void;
}

export default function ChatHeader({
  title,
  isPdfMode,
  isSearchEnabled,
  toggleSearch,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        {isPdfMode && (
          <div className="ml-2 flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <FiFileText className="mr-1" size={12} />
            PDF Mode
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="search-mode"
            checked={isSearchEnabled}
            onChange={toggleSearch}
          />
          <Label htmlFor="search-mode" className="flex items-center gap-1 text-sm">
            <FiSearch size={14} />
            Web Search
          </Label>
        </div>
      </div>
    </div>
  );
}
