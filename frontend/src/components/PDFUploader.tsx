import { useState, useRef } from 'react';
import { FiUpload, FiFile } from 'react-icons/fi';
import { Button } from './ui/button';

interface PDFUploaderProps {
  onUpload: (file: File) => void;
}

export default function PDFUploader({ onUpload }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
    }
  };

  return (
    <div className="fixed bottom-24 right-4 z-10">
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1 rounded-full bg-white shadow-md dark:bg-gray-800"
          onClick={() => fileInputRef.current?.click()}
        >
          <FiUpload size={14} />
          Upload PDF
        </Button>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="application/pdf"
          className="hidden"
        />
      </div>
      
      {selectedFile && (
        <div className="absolute bottom-12 right-0 w-64 rounded-lg bg-white p-4 shadow-lg dark:bg-gray-800">
          <div className="mb-2 flex items-center">
            <FiFile className="mr-2 text-blue-500" size={18} />
            <span className="truncate text-sm font-medium">
              {selectedFile.name}
            </span>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFile(null)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleUpload}>
              Upload
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
