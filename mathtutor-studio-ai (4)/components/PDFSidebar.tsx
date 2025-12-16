import React, { useState } from 'react';
import { X, FileText, Trash2, PanelLeftClose, ChevronDown, ChevronRight, FolderOpen, Image as ImageIcon, PlusSquare, Check, ScanLine } from 'lucide-react';
import { AppDocument, PageData } from '../types';

interface PDFSidebarProps {
  documents: AppDocument[];
  activeDocId: string | null;
  activePageId: string | null;
  onPageSelect: (docId: string, pageId: string) => void;
  onRemoveDocument: (docId: string) => void;
  onDeletePage: (docId: string, pageId: string) => void;
  onToggleExpand: (docId: string) => void;
  onAddBlankPage: () => void;
  onRenameDocument: (docId: string, newName: string) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

const PDFSidebar: React.FC<PDFSidebarProps> = ({
  documents,
  activeDocId,
  activePageId,
  onPageSelect,
  onRemoveDocument,
  onDeletePage,
  onToggleExpand,
  onAddBlankPage,
  onRenameDocument,
  isOpen,
  setIsOpen,
}) => {
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEditing = (doc: AppDocument) => {
    setEditingDocId(doc.id);
    setEditName(doc.name);
  };

  const saveName = () => {
    if (editingDocId && editName.trim()) {
      onRenameDocument(editingDocId, editName.trim());
    }
    setEditingDocId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveName();
    } else if (e.key === 'Escape') {
      setEditingDocId(null);
    }
  };

  // If no documents, we don't render content
  if (documents.length === 0) return null;

  return (
    <div 
      className={`relative h-full bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col ${
        isOpen ? 'w-64' : 'w-0'
      }`}
    >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-100 min-w-[16rem] bg-slate-50">
            <span className="font-bold text-slate-700 text-sm flex items-center gap-2">
                <FolderOpen size={16}/>
                Library ({documents.length})
            </span>
            <div className="flex items-center gap-1">
                 <button 
                    onClick={() => onAddBlankPage()}
                    className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors flex items-center gap-1"
                    title="Add Page to Notebook"
                >
                    <PlusSquare size={16} />
                </button>
                <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                    title="Hide Sidebar"
                >
                    <PanelLeftClose size={16} />
                </button>
            </div>
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-w-[16rem]">
            {documents.map((doc) => (
                <div key={doc.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    {/* Document Header (Folder) */}
                    <div 
                        className={`flex items-center justify-between p-2 cursor-pointer transition-colors ${
                            activeDocId === doc.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => onToggleExpand(doc.id)}
                    >
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <button className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                                {doc.isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                            </button>
                            <div className={`p-1 rounded flex-shrink-0 ${doc.type === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                {doc.type === 'pdf' ? <FileText size={14}/> : <ImageIcon size={14}/>}
                            </div>
                            
                            {editingDocId === doc.id ? (
                                <input 
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={saveName}
                                    onKeyDown={handleKeyDown}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                    className="text-sm font-medium text-slate-900 border border-indigo-300 rounded px-1 py-0.5 w-full outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                            ) : (
                                <span 
                                    className="text-sm font-medium text-slate-700 truncate select-none w-full" 
                                    title={doc.name}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        startEditing(doc);
                                    }}
                                >
                                    {doc.name}
                                </span>
                            )}
                        </div>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveDocument(doc.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                            title="Remove File"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Pages Grid */}
                    {doc.isExpanded && (
                        <div className="bg-slate-50/50 p-2 grid grid-cols-2 gap-2 border-t border-slate-100">
                            {doc.pages.map((page, index) => (
                                <div key={page.id} className="relative group">
                                    <button
                                        onClick={() => onPageSelect(doc.id, page.id)}
                                        className={`w-full aspect-[3/4] relative rounded-lg overflow-hidden border-2 transition-all bg-white ${
                                            activeDocId === doc.id && activePageId === page.id
                                                ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100' 
                                                : 'border-slate-200 hover:border-indigo-300'
                                        }`}
                                    >
                                        <img src={page.thumbnail} alt={`Page ${page.originalPageNum}`} className="w-full h-full object-contain bg-white" />
                                        
                                        {/* Page Number Label */}
                                        <div className={`absolute bottom-0 inset-x-0 px-2 py-1 text-[10px] font-medium backdrop-blur-md border-t flex items-center justify-between ${
                                            activeDocId === doc.id && activePageId === page.id
                                            ? 'bg-indigo-600/90 text-white border-indigo-500' 
                                            : 'bg-white/90 text-slate-600 border-slate-100'
                                        }`}>
                                            <div className="flex flex-col leading-tight">
                                                {page.recognizedPageNum === undefined ? (
                                                    <span className="flex items-center gap-1 text-slate-500"><ScanLine size={8} className="animate-pulse"/> Scan...</span>
                                                ) : page.recognizedPageNum ? (
                                                    <>
                                                        <span className="font-bold">p.{page.recognizedPageNum}</span>
                                                        <span className="opacity-70 text-[9px]">PDF: {page.originalPageNum}</span>
                                                    </>
                                                ) : (
                                                    <span className="font-bold">Page {page.originalPageNum}</span>
                                                )}
                                            </div>
                                        </div>
                                    </button>

                                    {/* Delete Page Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeletePage(doc.id, page.id);
                                        }}
                                        className="absolute -top-1.5 -right-1.5 bg-white text-red-500 border border-red-100 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-red-50 z-10 scale-90 hover:scale-100"
                                        title="Remove page"
                                    >
                                        <X size={10} strokeWidth={3} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
};

export default PDFSidebar;