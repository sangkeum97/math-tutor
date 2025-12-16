import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Peer } from "peerjs"; 
import Toolbar from './components/Toolbar';
import PDFSidebar from './components/PDFSidebar';
import Whiteboard, { WhiteboardHandle } from './components/Whiteboard';
import { ToolType, AppDocument, PageData, DrawingPath, SyncMessage } from './types';
import { AVAILABLE_COLORS } from './constants';
import { LayoutDashboard, PanelLeftOpen, PanelLeftClose, Minimize2, MonitorPlay, Users, Copy } from 'lucide-react';

// Initialize PDF.js worker with a CDN that matches the installed version (4.2.67)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs`;

const App: React.FC = () => {
  // --- State ---
  const [tool, setTool] = useState<ToolType>(ToolType.PEN);
  const [color, setColor] = useState<string>(AVAILABLE_COLORS[0]);
  const [lineWidth, setLineWidth] = useState<number>(2);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  
  // Document State
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [showPdfSidebar, setShowPdfSidebar] = useState(true);

  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Presentation Mode State
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  
  // Collaboration State
  const [peerId, setPeerId] = useState<string | null>(null);
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const [conn, setConn] = useState<any>(null);
  const [showCollabModal, setShowCollabModal] = useState(false);
  
  // Refs
  const whiteboardRef = useRef<WhiteboardHandle>(null);
  const initializedRef = useRef(false);
  const peerRef = useRef<any>(null);
  const lastRenderedRef = useRef<string | null>(null);

  // --- PeerJS Collaboration Setup ---
  useEffect(() => {
    const newPeer = new Peer();
    peerRef.current = newPeer;
    newPeer.on('open', (id) => setPeerId(id));
    newPeer.on('connection', (connection) => {
      setConn(connection);
      setupConnection(connection);
      setTimeout(() => sendSyncState(), 500);
    });
    return () => newPeer.destroy();
  }, []);

  const setupConnection = (connection: any) => {
      connection.on('data', (data: SyncMessage) => handleIncomingData(data));
      connection.on('open', () => {
          console.log("Connected to peer");
          setShowCollabModal(false);
      });
  };

  const connectToPeer = () => {
      if (!peerRef.current || !remotePeerId) return;
      const connection = peerRef.current.connect(remotePeerId);
      setConn(connection);
      setupConnection(connection);
  };

  const handleIncomingData = (msg: SyncMessage) => {
      switch (msg.type) {
          case 'DRAW_STROKE':
              if (whiteboardRef.current && msg.payload) whiteboardRef.current.addPath(msg.payload);
              break;
          case 'CLEAR_BOARD':
               if (whiteboardRef.current) whiteboardRef.current.setPaths([]);
               break;
          case 'SET_BACKGROUND':
               if (msg.payload) {
                   const img = new Image();
                   img.src = msg.payload;
                   img.onload = () => setBgImage(img);
               } else {
                   setBgImage(null);
               }
               break;
          case 'SYNC_STATE':
              if (whiteboardRef.current && msg.payload.paths) whiteboardRef.current.setPaths(msg.payload.paths);
              if (msg.payload.bgImage) {
                   const img = new Image();
                   img.src = msg.payload.bgImage;
                   img.onload = () => setBgImage(img);
              }
              break;
      }
  };

  const sendData = (msg: SyncMessage) => {
      if (conn && conn.open) conn.send(msg);
  };

  const sendSyncState = () => {
      if (!whiteboardRef.current) return;
      sendData({
          type: 'SYNC_STATE',
          payload: { paths: whiteboardRef.current.getPaths(), bgImage: bgImage ? bgImage.src : null }
      });
  };

  const handlePathComplete = (path: DrawingPath) => {
      sendData({ type: 'DRAW_STROKE', payload: path });
  };

  // --- Document Logic ---
  const uuid = () => Math.random().toString(36).substring(2, 9);
  const getActiveDoc = () => documents.find(d => d.id === activeDocId);
  const getActivePage = () => getActiveDoc()?.pages.find(p => p.id === activePageId);

  const saveCurrentPagePaths = () => {
      if (!activeDocId || !activePageId || !whiteboardRef.current) return;
      const currentPaths = whiteboardRef.current.getPaths();
      setDocuments(prev => prev.map(doc => {
          if (doc.id === activeDocId) {
              return {
                  ...doc,
                  pages: doc.pages.map(page => {
                      if (page.id === activePageId) return { ...page, paths: currentPaths };
                      return page;
                  })
              };
          }
          return doc;
      }));
  };

  useEffect(() => {
    if (!initializedRef.current && documents.length === 0) {
        initializedRef.current = true;
        handleAddBlankPage();
    }
  }, []);

  const handlePageSelect = (docId: string, pageId: string) => {
      saveCurrentPagePaths();
      setActiveDocId(docId);
      setActivePageId(pageId);
  };

  const renderActivePage = async () => {
      const doc = getActiveDoc();
      const page = getActivePage();
      
      if (whiteboardRef.current) whiteboardRef.current.setPaths(page?.paths || []);

      if (!doc || !page) {
          if (documents.length === 0) {
              setBgImage(null);
              sendData({ type: 'SET_BACKGROUND', payload: null });
          }
          return;
      }

      let newBgSrc: string | null = null;
      if (doc.type === 'pdf' && doc.pdfProxy && page.originalPageNum <= doc.pdfProxy.numPages) {
          try {
              const pdfPage = await doc.pdfProxy.getPage(page.originalPageNum);
              const viewport = pdfPage.getViewport({ scale: 2.0 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              if (context) {
                  await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;
                  newBgSrc = canvas.toDataURL('image/png');
              }
          } catch (e) {
              console.error("Error rendering PDF page", e);
          }
      } else if (page.thumbnail) {
          newBgSrc = page.thumbnail;
      }

      if (newBgSrc) {
          const img = new Image();
          img.src = newBgSrc;
          img.onload = () => {
              setBgImage(img);
              sendData({ type: 'SET_BACKGROUND', payload: newBgSrc });
              if(whiteboardRef.current) {
                  sendData({ type: 'SYNC_STATE', payload: { paths: page.paths || [], bgImage: newBgSrc }});
              }
          };
      }
  };

  useEffect(() => {
      const key = `${activeDocId}-${activePageId}`;
      const doc = documents.find(d => d.id === activeDocId);
      if (key === lastRenderedRef.current && bgImage && doc) return;
      renderActivePage();
      if (activeDocId && activePageId) lastRenderedRef.current = key;
  }, [activeDocId, activePageId, documents]);

  const addDocument = async (name: string, type: 'pdf' | 'image', data: ArrayBuffer | string, rawFile?: File) => {
      saveCurrentPagePaths();
      const newDocId = uuid();
      let pages: PageData[] = [];
      let pdfProxy: any = undefined;

      if (type === 'pdf' && data instanceof ArrayBuffer) {
          try {
              const loadingTask = pdfjsLib.getDocument(data);
              pdfProxy = await loadingTask.promise;
              for (let i = 1; i <= pdfProxy.numPages; i++) {
                  const page = await pdfProxy.getPage(i);
                  const viewport = page.getViewport({ scale: 0.3 });
                  const canvas = document.createElement('canvas');
                  const context = canvas.getContext('2d');
                  canvas.height = viewport.height;
                  canvas.width = viewport.width;
                  if (context) {
                      await page.render({ canvasContext: context, viewport: viewport }).promise;
                      pages.push({
                          id: uuid(),
                          originalPageNum: i,
                          thumbnail: canvas.toDataURL('image/jpeg', 0.8),
                          recognizedPageNum: null
                      });
                  }
              }
          } catch (e) {
              console.error("PDF Load Error", e);
              return;
          }
      } else if (type === 'image' && typeof data === 'string') {
          pages.push({
              id: uuid(),
              originalPageNum: 1,
              thumbnail: data,
              recognizedPageNum: null
          });
      }

      const newDoc: AppDocument = {
          id: newDocId,
          name,
          type,
          pages,
          isExpanded: true,
          pdfProxy,
          rawFile
      };

      setDocuments(prev => [...prev, newDoc]);
      setActiveDocId(newDocId);
      if (pages.length > 0) setActivePageId(pages[0].id);
      setShowPdfSidebar(true);
  };

  const handleAddBlankPage = () => {
      saveCurrentPagePaths();
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1060; 
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          const gridSize = 40;
          for(let x=0; x<canvas.width; x+=gridSize) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
          for(let y=0; y<canvas.height; y+=gridSize) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

          const blankPageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const NOTEBOOK_NAME = "Notebook";
          
          setDocuments(prev => {
              const notebookIndex = prev.findIndex(d => d.name === NOTEBOOK_NAME && d.type === 'image');
              if (notebookIndex >= 0) {
                  const doc = prev[notebookIndex];
                  const newPageId = uuid();
                  const newPage: PageData = { id: newPageId, originalPageNum: doc.pages.length + 1, thumbnail: blankPageDataUrl, recognizedPageNum: null };
                  setTimeout(() => handlePageSelect(doc.id, newPageId), 0);
                  const newDocs = [...prev];
                  newDocs[notebookIndex] = { ...doc, pages: [...doc.pages, newPage], isExpanded: true };
                  return newDocs;
              } else {
                  const newDocId = uuid();
                  const newPageId = uuid();
                  const newDoc: AppDocument = { id: newDocId, name: NOTEBOOK_NAME, type: 'image', pages: [{ id: newPageId, originalPageNum: 1, thumbnail: blankPageDataUrl, recognizedPageNum: null }], isExpanded: true };
                  setTimeout(() => handlePageSelect(newDocId, newPageId), 0);
                  return [...prev, newDoc];
              }
          });
      }
  };

  const handleRenameDocument = (docId: string, newName: string) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, name: newName } : d));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) Array.from(e.target.files).forEach((file: File) => processFile(file));
  };

  const processFile = (file: File) => {
      if (file.type === 'application/pdf') {
          const reader = new FileReader();
          reader.onload = (e) => {
              if (e.target?.result) addDocument(file.name, 'pdf', e.target.result as ArrayBuffer, file);
          };
          reader.readAsArrayBuffer(file);
      } else if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
              if (e.target?.result) addDocument(file.name, 'image', e.target.result as string, file);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDownload = () => {
    const dataURL = whiteboardRef.current?.getCanvasDataURL();
    if (dataURL) {
      const link = document.createElement('a');
      link.href = dataURL;
      const pageNum = activePage?.recognizedPageNum || activePage?.originalPageNum || 'page';
      link.download = `math-tutor-page-${pageNum}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleRemoveDocument = (docId: string) => {
      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (activeDocId === docId) {
          setActiveDocId(null);
          setActivePageId(null);
          setBgImage(null);
          lastRenderedRef.current = null;
          if (whiteboardRef.current) whiteboardRef.current.setPaths([]);
          sendData({ type: 'CLEAR_BOARD' });
      }
  };

  const handleDeletePage = (docId: string, pageId: string) => {
      setDocuments(prev => prev.map(doc => {
          if (doc.id !== docId) return doc;
          const newPages = doc.pages.filter(p => p.id !== pageId);
          return { ...doc, pages: newPages };
      }));
      if (activeDocId === docId && activePageId === pageId) {
          const doc = documents.find(d => d.id === docId);
          if (doc) {
              const idx = doc.pages.findIndex(p => p.id === pageId);
              const nextDetails = doc.pages[idx + 1] || doc.pages[idx - 1];
              setActivePageId(nextDetails ? nextDetails.id : null);
              lastRenderedRef.current = null;
              if (!nextDetails) {
                 setBgImage(null);
                 if (whiteboardRef.current) whiteboardRef.current.setPaths([]);
                 sendData({ type: 'CLEAR_BOARD' });
              }
          }
      }
  };

  const handleToggleExpand = (docId: string) => {
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, isExpanded: !d.isExpanded } : d));
  };

  const navigatePage = (direction: 'prev' | 'next') => {
      saveCurrentPagePaths();
      const doc = getActiveDoc();
      if (!doc || !activePageId) return;
      const currentIndex = doc.pages.findIndex(p => p.id === activePageId);
      if (currentIndex === -1) return;
      let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < doc.pages.length) setActivePageId(doc.pages[newIndex].id);
  };

  const handleClear = () => {
     if(whiteboardRef.current) whiteboardRef.current.setPaths([]);
     sendData({ type: 'CLEAR_BOARD' });
  };
  const handleUndo = () => whiteboardRef.current?.undo();
  const [whiteboardKey, setWhiteboardKey] = useState(0);

  const togglePresentationMode = () => {
      const newState = !isPresentationMode;
      setIsPresentationMode(newState);
      setShowPdfSidebar(!newState);
      if (newState) {
          document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen blocked", e));
      } else {
          if (document.fullscreenElement) document.exitFullscreen().catch(e => console.log("Exit fullscreen blocked", e));
      }
  };

  // Drag & Drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file: File) => processFile(file));
      e.dataTransfer.clearData();
    }
  };

  const activePage = getActivePage();
  const activeDoc = getActiveDoc();
  const activePageIndex = activeDoc && activePage ? activeDoc.pages.findIndex(p => p.id === activePage.id) : -1;
  const canPrevPage = activePageIndex > 0;
  const canNextPage = activeDoc ? activePageIndex < activeDoc.pages.length - 1 : false;

  return (
    <div 
        className="flex h-screen w-screen bg-slate-50 relative overflow-hidden font-sans"
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      <div className={`flex-shrink-0 h-full relative transition-all duration-300 ${showPdfSidebar ? 'w-auto' : 'w-0'}`}>
          <PDFSidebar 
             documents={documents}
             activeDocId={activeDocId}
             activePageId={activePageId}
             onPageSelect={handlePageSelect}
             onRemoveDocument={handleRemoveDocument}
             onDeletePage={handleDeletePage}
             onToggleExpand={handleToggleExpand}
             onAddBlankPage={handleAddBlankPage}
             onRenameDocument={handleRenameDocument}
             isOpen={showPdfSidebar}
             setIsOpen={setShowPdfSidebar}
          />
          {documents.length > 0 && !showPdfSidebar && !isPresentationMode && (
              <button 
                onClick={() => setShowPdfSidebar(true)}
                className="absolute left-4 top-4 z-50 p-2 bg-white rounded-lg shadow-md border border-slate-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Show Library"
              >
                  <PanelLeftOpen size={24} />
              </button>
          )}
      </div>

      <main className="flex-1 relative h-full bg-slate-100 flex items-center justify-center p-8 overflow-hidden">
        <div className={`w-full h-full bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-200 relative transition-all duration-500 ${isPresentationMode ? 'rounded-none border-0 shadow-none' : ''}`}>
             
             {/* Title */}
             <div className="absolute bottom-4 left-6 z-10 select-none flex items-center gap-4 pointer-events-none opacity-50">
                <div className="flex items-center gap-2 text-slate-900">
                    <LayoutDashboard size={20} />
                    <span className="font-bold text-lg tracking-tight">MathTutor Studio</span>
                </div>
             </div>
             
             {/* Navigation */}
             {activeDoc && activePage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-lg p-1">
                    <div className="flex items-center px-2 min-w-[4rem] justify-center flex-col">
                         <span className="text-xs font-bold text-slate-800">
                             Page {activePage.originalPageNum}
                         </span>
                         {activeDoc.pages.length > 1 && <span className="text-[10px] text-slate-400">{activePageIndex + 1} / {activeDoc.pages.length}</span>}
                    </div>

                    {!isPresentationMode && (
                        <>
                            <div className="w-px h-4 bg-slate-200 mx-1"></div>
                            <button 
                                onClick={() => setShowPdfSidebar(!showPdfSidebar)} 
                                className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                                title="Toggle Sidebar"
                            >
                                {showPdfSidebar ? <PanelLeftClose size={16}/> : <PanelLeftOpen size={16}/>}
                            </button>
                        </>
                    )}
                </div>
             )}
             
             {/* Actions */}
             <div className="absolute top-4 right-20 z-10 flex items-center gap-2">
                 <button
                    onClick={() => setShowCollabModal(true)}
                    className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-2 transition-all font-medium shadow-sm ${
                        conn ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                 >
                    <Users size={14} />
                    {conn ? 'Student Connected' : 'Connect Student'}
                 </button>

                 <button 
                    onClick={togglePresentationMode}
                    className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-2 transition-all font-medium shadow-sm ${
                        isPresentationMode ? 'bg-red-50 text-red-600 border-red-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
                    }`}
                    title="Class Mode"
                 >
                    {isPresentationMode ? <Minimize2 size={14}/> : <MonitorPlay size={14}/>}
                    {isPresentationMode ? "Exit Class Mode" : "Class Mode"}
                 </button>
             </div>

             <div className={`absolute inset-0 z-50 bg-indigo-50/50 border-4 border-indigo-300 border-dashed m-4 rounded-2xl flex items-center justify-center pointer-events-none transition-opacity duration-300 ${isDragging ? 'opacity-100' : 'opacity-0'}`}>
                <span className="bg-white px-4 py-2 rounded-full shadow-sm text-indigo-600 font-bold">Drop PDF or Images here</span>
             </div>

             <Toolbar 
                currentTool={tool} setTool={setTool}
                currentColor={color} setColor={setColor}
                currentWidth={lineWidth} setWidth={setLineWidth}
                onClear={handleClear} onUndo={handleUndo}
                onUpload={handleFileUpload} onDownload={handleDownload}
                onPrevPage={() => navigatePage('prev')}
                onNextPage={() => navigatePage('next')}
                canPrevPage={canPrevPage} canNextPage={canNextPage}
            />

             <Whiteboard 
                key={whiteboardKey}
                ref={whiteboardRef}
                tool={tool}
                color={color}
                width={lineWidth}
                bgImage={bgImage}
                onPathComplete={handlePathComplete}
             />
        </div>
      </main>

      {showCollabModal && (
          <div className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
                  <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Users className="text-indigo-600"/>Connect with Student</h2>
                  {conn ? (
                      <div className="space-y-4">
                           <div className="p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-2"><Users size={20}/>Connected successfully!</div>
                           <button onClick={() => { conn.close(); setConn(null); }} className="w-full py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 font-medium transition-colors">Disconnect</button>
                      </div>
                  ) : (
                      <div className="space-y-6">
                          <div>
                              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Teacher (Host)</h3>
                              <p className="text-sm text-slate-600 mb-2">Share this ID with your student:</p>
                              <div className="flex gap-2">
                                  <code className="flex-1 bg-slate-100 p-3 rounded-lg text-slate-800 font-mono text-center select-all border border-slate-200">{peerId || 'Generating ID...'}</code>
                                  <button onClick={() => peerId && navigator.clipboard.writeText(peerId)} className="p-3 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors" title="Copy ID"><Copy size={20}/></button>
                              </div>
                          </div>
                          <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Or</span></div></div>
                          <div>
                              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Student (Join)</h3>
                              <p className="text-sm text-slate-600 mb-2">Enter the ID from your teacher:</p>
                              <div className="flex gap-2">
                                  <input type="text" placeholder="Enter Session ID..." value={remotePeerId} onChange={(e) => setRemotePeerId(e.target.value)} className="flex-1 p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                  <button onClick={connectToPeer} disabled={!remotePeerId} className="px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors">Join</button>
                              </div>
                          </div>
                      </div>
                  )}
                  <div className="mt-6 flex justify-end"><button onClick={() => setShowCollabModal(false)} className="text-slate-500 hover:text-slate-700 font-medium text-sm">Close</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;