import React, { useState, useRef } from 'react';
import { Upload, Video, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export function FileUpload({ onFileSelect }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const type = file.type.toLowerCase();
      const name = file.name.toLowerCase();
      const isValid = type.startsWith('video/') || type.startsWith('image/') || 
                      name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov') ||
                      name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp');
      
      if (isValid) {
        onFileSelect(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative group cursor-pointer
        w-full max-w-2xl aspect-video rounded-2xl border-2 border-dashed
        flex flex-col items-center justify-center gap-4 transition-all duration-300
        ${isDragging 
          ? 'border-purple-500 bg-purple-500/10 scale-[1.02]' 
          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
        }
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="video/*,image/*"
        className="absolute inset-0 opacity-0 cursor-pointer z-10"
      />
      
      <div className={`
        p-4 rounded-full transition-colors duration-300 z-0
        ${isDragging ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}
      `}>
        <Upload size={32} />
      </div>
      
      <div className="text-center">
        <p className="text-lg font-medium text-zinc-200">
          {isDragging ? 'Drop file here' : 'Click or drag video or spritesheet to upload'}
        </p>
        <p className="text-sm text-zinc-500 mt-1">
          MP4, WebM or Spritesheet Image (PNG/JPG)
        </p>
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-6 text-xs text-zinc-600">
        <div className="flex items-center gap-1.5">
          <Video size={14} />
          <span>Local processing - No cloud uploads</span>
        </div>
      </div>
    </div>
  );
}
