
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Note, QuickPhrase } from '../types';
import { Plus, Trash2, Wand2, ChevronLeft, Book, Code2, Undo2, Redo2, Search, FileText, PanelRight, Zap, MoreHorizontal, Check, X, Edit2, Share2, Copy, FileOutput, Printer, Minus } from 'lucide-react';
import { organizeNote } from '../services/gemini';

interface NotebookPanelProps {
    isOpen: boolean;
    onClose: () => void;
    notes: Note[];
    activeNoteId: string | null;
    onSetActiveNote: (id: string | null) => void;
    onCreateNote: () => void;
    onUpdateNote: (id: string, updates: Partial<Note>) => void;
    onDeleteNote: (id: string) => void;
    onCursorChange?: (pos: number) => void;
    notebookCommands?: QuickPhrase[];
    onSaveCommand?: (cmd: QuickPhrase) => void;
    onDeleteCommand?: (id: string) => void;
    onTogglePinCommand?: (id: string) => void;
}

const LINE_HEIGHT = 24;
const FONT_SIZE = 14;
const FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const NotebookPanel: React.FC<NotebookPanelProps> = ({
    isOpen,
    onClose,
    notes,
    activeNoteId,
    onSetActiveNote,
    onCreateNote,
    onUpdateNote,
    onDeleteNote,
    onCursorChange,
    notebookCommands = [],
    onSaveCommand,
    onDeleteCommand,
    onTogglePinCommand
}) => {
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [width, setWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showExportMenu, setShowExportMenu] = useState(false);
    
    // Command Manager State
    const [showCommandManager, setShowCommandManager] = useState(false);
    const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
    const [newCommandLabel, setNewCommandLabel] = useState('');
    const [newCommandText, setNewCommandText] = useState('');
    
    // Quick Add State (Inline)
    const [isCreatingCommand, setIsCreatingCommand] = useState(false);
    const [tempCommandText, setTempCommandText] = useState('');
    
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoRedoAction = useRef(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);
    const activeNote = notes.find(n => n.id === activeNoteId);

    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
        const query = searchQuery.toLowerCase();
        return notes.filter(n => 
            n.title.toLowerCase().includes(query) || 
            n.content.toLowerCase().includes(query)
        ).sort((a, b) => b.updatedAt - a.updatedAt);
    }, [notes, searchQuery]);

    useEffect(() => {
        if (activeNote && historyIndex === -1) {
            setHistory([activeNote.content]);
            setHistoryIndex(0);
        }
    }, [activeNoteId, activeNote, historyIndex]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 300 && newWidth < 800) setWidth(newWidth);
        };
        const handleMouseUp = () => { setIsResizing(false); document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; };
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (highlightRef.current) {
            highlightRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    const handleContentChange = (content: string) => {
        if (!activeNote) return;
        onUpdateNote(activeNote.id, { content });
        
        if (!isUndoRedoAction.current) {
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(content);
            if (newHistory.length > 50) newHistory.shift();
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
        isUndoRedoAction.current = false;
    };

    const handleUndo = () => {
        if (historyIndex > 0 && activeNote) {
            isUndoRedoAction.current = true;
            const prevContent = history[historyIndex - 1];
            setHistoryIndex(historyIndex - 1);
            onUpdateNote(activeNote.id, { content: prevContent });
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1 && activeNote) {
            isUndoRedoAction.current = true;
            const nextContent = history[historyIndex + 1];
            setHistoryIndex(historyIndex + 1);
            onUpdateNote(activeNote.id, { content: nextContent });
        }
    };

    const insertDivider = () => {
        if (!activeNote || !textareaRef.current) return;
        const textArea = textareaRef.current;
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        const divider = `\n---\n`;
        const content = activeNote.content;
        
        const newText = content.substring(0, start) + divider + content.substring(end);
        handleContentChange(newText);
        
        setTimeout(() => {
            if(textareaRef.current) {
                const newPos = start + divider.length;
                textareaRef.current.setSelectionRange(newPos, newPos);
                textareaRef.current.focus();
            }
        }, 0);
    };

    const insertInstruction = (text: string = "") => {
        if (!activeNote || !textareaRef.current) return;
        const textArea = textareaRef.current;
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        const tag = `[AI指令: ${text}]`;
        const content = activeNote.content;
        
        const prefix = (start > 0 && content[start - 1] !== '\n' && content[start - 1] !== ' ') ? " " : "";
        const suffix = (end < content.length && content[end] !== '\n' && content[end] !== ' ') ? " " : "";
        
        const newText = content.substring(0, start) + prefix + tag + suffix + content.substring(end);
        handleContentChange(newText);
        
        setTimeout(() => {
            if(textareaRef.current) {
                const newPos = text ? start + prefix.length + tag.length + suffix.length : start + prefix.length + tag.length - 1;
                textareaRef.current.setSelectionRange(newPos, newPos);
                textareaRef.current.focus();
            }
        }, 0);
    };

    const handleSaveCommand = () => {
        if (!newCommandLabel.trim() || !newCommandText.trim()) return;
        if (onSaveCommand) {
            onSaveCommand({
                id: editingCommandId || Date.now().toString(),
                label: newCommandLabel.trim(),
                text: newCommandText.trim(),
                isPinned: true
            });
        }
        setNewCommandLabel('');
        setNewCommandText('');
        setEditingCommandId(null);
    };

    const startEditingCommand = (cmd: QuickPhrase) => {
        setEditingCommandId(cmd.id);
        setNewCommandLabel(cmd.label || '');
        setNewCommandText(cmd.text);
    };

    const handleQuickAddCommand = () => {
        if (!tempCommandText.trim()) return;
        if (onSaveCommand) {
            onSaveCommand({
                id: Date.now().toString(),
                text: tempCommandText.trim(),
                label: tempCommandText.trim().length <= 5 ? tempCommandText.trim() : undefined,
                isPinned: true
            });
        }
        setTempCommandText('');
        setIsCreatingCommand(false);
    };

    // 导出逻辑
    const handleExport = (type: 'copy' | 'docx' | 'pdf') => {
        if (!activeNote) return;
        setShowExportMenu(false);

        if (type === 'copy') {
            navigator.clipboard.writeText(activeNote.title + '\n\n' + activeNote.content);
            alert('内容已复制到剪贴板');
        } else if (type === 'docx') {
            const header = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>${activeNote.title}</title>
                <style>body { font-family: sans-serif; line-height: 1.6; } h1 { color: #4F46E5; } pre { background: #f4f4f4; padding: 10px; }</style>
                </head><body>
                <h1>${activeNote.title}</h1>
                <div style="white-space: pre-wrap;">${activeNote.content}</div>
                </body></html>`;
            const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${activeNote.title || '笔记'}.doc`;
            link.click();
            URL.revokeObjectURL(url);
        } else if (type === 'pdf') {
            window.print();
        }
    };

    const pinnedCommands = notebookCommands.filter(c => c.isPinned);

    const renderHighlights = (text: string) => {
        const parts = text.split(/(\[AI指令:.*?\]|\/\/ AI:.*?(?:\n|$)|(?:^|\n)#{1,6}\s.*?(?:\n|$)|(?:^|\n)\s*[-*]\s|\*\*.+?\*\*|---\n)/g);
        
        return parts.map((part, i) => {
            if (!part) return null;

            if (part === '---\n') {
                return <span key={i} className="text-gray-300 font-bold">{part}</span>;
            }

            if (part.startsWith('[AI指令:') || part.startsWith('// AI:')) {
                return <span key={i} className="text-green-600 font-bold bg-green-50/50">{part}</span>;
            }

            if (/(?:^|\n)#{1,6}\s/.test(part)) {
                const hasNewline = part.startsWith('\n');
                const cleanPart = hasNewline ? part.substring(1) : part;
                const hashMatch = cleanPart.match(/^(#{1,6})\s/);
                const hashes = hashMatch ? hashMatch[1] : '';
                const content = cleanPart.substring(hashes.length + 1);
                return (
                    <span key={i} className="font-bold text-gray-900">
                        {hasNewline && '\n'}
                        <span className="text-gray-300 font-normal">{hashes} </span>
                        {content}
                    </span>
                );
            }

            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                return (
                    <span key={i} className="font-bold text-gray-900">
                        <span className="text-gray-300 font-normal">**</span>
                        {part.substring(2, part.length - 2)}
                        <span className="text-gray-300 font-normal">**</span>
                    </span>
                );
            }

            if (/(?:^|\n)\s*[-*]\s/.test(part)) {
                 return <span key={i} className="text-indigo-500 font-bold">{part}</span>;
            }

            return <span key={i}>{part}</span>;
        });
    };

    if (!isOpen) return null;

    const editorBaseStyles: React.CSSProperties = {
        fontFamily: FONT_FAMILY,
        fontSize: `${FONT_SIZE}px`,
        lineHeight: `${LINE_HEIGHT}px`,
        padding: '24px',
        margin: 0,
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowY: 'auto',
        scrollbarGutter: 'stable',
        border: 'none',
        outline: 'none',
        letterSpacing: 'normal',
        fontVariantLigatures: 'none'
    };

    return (
        <div 
            style={{ width: `${width}px` }}
            className="h-full bg-white border-l border-gray-200 shadow-xl flex flex-col fixed right-0 top-0 bottom-0 z-40 animate-in slide-in-from-right duration-300"
        >
             {/* Command Manager Modal */}
             {showCommandManager && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300 m-4">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30">
                            <div className="flex items-center gap-2">
                                <Zap size={20} className="text-indigo-600" />
                                <h3 className="text-lg font-black text-gray-800 tracking-tight">管理快捷指令</h3>
                            </div>
                            <button onClick={() => { setShowCommandManager(false); setEditingCommandId(null); setNewCommandLabel(''); setNewCommandText(''); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase block">{editingCommandId ? '编辑指令' : '新增指令'}</label>
                                <input 
                                    type="text" 
                                    value={newCommandLabel}
                                    onChange={e => setNewCommandLabel(e.target.value)}
                                    placeholder="显示名称 (如: 统合笔记)"
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                                <textarea 
                                    value={newCommandText}
                                    onChange={e => setNewCommandText(e.target.value)}
                                    placeholder="指令内容..."
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none h-24"
                                />
                                <div className="flex gap-2">
                                    <button onClick={handleSaveCommand} disabled={!newCommandLabel || !newCommandText} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">{editingCommandId ? '保存修改' : '添加'}</button>
                                    {editingCommandId && (
                                        <button onClick={() => { setEditingCommandId(null); setNewCommandLabel(''); setNewCommandText(''); }} className="px-4 py-2 bg-gray-200 text-gray-600 rounded-xl font-bold text-sm">取消</button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">所有指令 ({notebookCommands.length})</label>
                                {notebookCommands.map(cmd => (
                                    <div key={cmd.id} className={`flex items-start gap-2 p-3 bg-white border rounded-2xl transition-all group ${editingCommandId === cmd.id ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-100 hover:border-indigo-100 hover:shadow-sm'}`}>
                                        <div className="flex-1 min-w-0" onClick={() => startEditingCommand(cmd)}>
                                            <div className="font-bold text-sm text-gray-700 truncate">{cmd.label}</div>
                                            <div className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed mt-0.5">{cmd.text}</div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <button 
                                                onClick={() => onTogglePinCommand?.(cmd.id)}
                                                className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${cmd.isPinned ? 'bg-indigo-50 text-indigo-600' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                            >
                                                <Zap size={14} fill={cmd.isPinned ? "currentColor" : "none"} />
                                            </button>
                                            <button 
                                                onClick={() => startEditingCommand(cmd)}
                                                className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => onDeleteCommand?.(cmd.id)}
                                                className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
             )}

            <div className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-indigo-400 transition-colors z-50 flex items-center justify-center group" onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}>
                <div className="h-8 w-1 bg-gray-300 rounded-full group-hover:bg-indigo-500 transition-colors" />
            </div>

            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    {activeNoteId ? (
                        <button onClick={() => onSetActiveNote(null)} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors flex items-center gap-1">
                            <ChevronLeft size={18} />
                            <span className="text-sm font-bold">返回列表</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 text-indigo-700 font-bold">
                            <Book size={18} />
                            <span>笔记本</span>
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50 transition-colors">
                    <PanelRight size={20} />
                </button>
            </div>

            {activeNoteId && activeNote ? (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <div className="flex-shrink-0 border-b border-gray-100 bg-white">
                        <input type="text" value={activeNote.title} onChange={(e) => onUpdateNote(activeNote.id, { title: e.target.value })} className="w-full px-6 py-4 text-lg font-bold outline-none placeholder-gray-300" placeholder="笔记标题" />
                    </div>
                    
                    {/* Quick Instructions Toolbar (Dynamic) */}
                    <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
                         <button 
                            onClick={() => setIsCreatingCommand(true)}
                            className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors border border-indigo-100"
                            title="添加指令"
                         >
                            <Plus size={14} />
                         </button>

                         {isCreatingCommand && (
                            <div className="flex-shrink-0 flex items-center gap-1 bg-white border border-indigo-200 rounded-full pl-3 pr-1 py-1 shadow-sm animate-in slide-in-from-left-2">
                                <input
                                    autoFocus
                                    type="text"
                                    className="text-xs bg-transparent outline-none w-24 sm:w-32"
                                    placeholder="内容..."
                                    value={tempCommandText}
                                    onChange={e => setTempCommandText(e.target.value)}
                                    onKeyDown={e => { if(e.key === 'Enter') handleQuickAddCommand(); if(e.key === 'Escape') setIsCreatingCommand(false); }}
                                />
                                <button onClick={handleQuickAddCommand} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-full"><Check size={12} /></button>
                                <button onClick={() => setIsCreatingCommand(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full"><X size={12} /></button>
                            </div>
                         )}

                         <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>
                         {pinnedCommands.map((cmd) => (
                             <button 
                                key={cmd.id}
                                onClick={() => insertInstruction(cmd.text)}
                                className="px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors whitespace-nowrap flex-shrink-0 active:scale-95"
                                title={cmd.text}
                             >
                                {cmd.label || cmd.text.substring(0, 4)}
                             </button>
                         ))}
                         <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>
                         <button 
                            onClick={() => setShowCommandManager(true)}
                            className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-bold"
                        >
                            <MoreHorizontal size={14} />
                        </button>
                    </div>

                    {/* Toolbar Actions */}
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0 shadow-inner">
                        <div className="flex items-center gap-1.5">
                            <div className="flex bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
                                <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30"><Undo2 size={14} /></button>
                                <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30"><Redo2 size={14} /></button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={insertDivider} className="text-[10px] flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded hover:bg-gray-50 hover:text-indigo-600 transition-colors font-bold shadow-sm">
                                <Minus size={12} />插入分割线
                            </button>
                             <button onClick={() => insertInstruction()} className="text-[10px] flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors font-bold shadow-sm">
                                <Code2 size={12} />添加指令
                            </button>
                            <button onClick={() => { setIsOrganizing(true); organizeNote(activeNote.content).then(res => { handleContentChange(res); setIsOrganizing(false); }); }} disabled={isOrganizing || !activeNote.content.trim()} className="text-[10px] flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors font-bold shadow-sm">
                                    {isOrganizing ? <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> : <Wand2 size={12} />}一键整理
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 relative bg-white overflow-hidden printable-note">
                        <div 
                            ref={highlightRef}
                            style={{ ...editorBaseStyles, color: '#374151', pointerEvents: 'none' }}
                            className="z-0"
                        >
                            {renderHighlights(activeNote.content)}
                            {activeNote.content.endsWith('\n') && <br />}
                        </div>
                        <textarea 
                            ref={textareaRef}
                            value={activeNote.content}
                            onChange={(e) => handleContentChange(e.target.value)}
                            onScroll={handleScroll}
                            onSelect={(e) => onCursorChange?.(e.currentTarget.selectionStart)}
                            className="z-10 bg-transparent text-transparent caret-indigo-600 resize-none selection:bg-indigo-500/20 selection:text-transparent"
                            style={editorBaseStyles}
                            placeholder="在此输入内容..."
                            spellCheck={false}
                        />
                    </div>
                    
                    <div className="p-2 bg-gray-50 border-t border-gray-200 flex items-center px-4 relative">
                        <div className="relative">
                            <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1"><Share2 size={16} /><span className="text-[10px] font-bold">导出</span></button>
                            {showExportMenu && (
                                <div className="absolute bottom-full left-0 mb-2 w-40 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                                    <button onClick={() => handleExport('copy')} className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-indigo-50 flex items-center gap-2"><Copy size={14} /> 复制到剪贴板</button>
                                    <button onClick={() => handleExport('docx')} className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-indigo-50 flex items-center gap-2"><FileOutput size={14} /> 导出为 Word</button>
                                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-indigo-50 flex items-center gap-2"><Printer size={14} /> 导出为 PDF</button>
                                </div>
                            )}
                        </div>
                        <button onClick={() => onDeleteNote(activeNote.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors ml-auto"><Trash2 size={16} /></button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/30">
                    <div className="p-3 bg-white border-b border-gray-100 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索笔记内容..." className="w-full pl-9 pr-4 py-2 bg-gray-100 border-transparent rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                        </div>
                        <button onClick={onCreateNote} className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm font-bold text-sm">
                            <Plus size={18} />
                            <span>新建笔记</span>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredNotes.map(note => (
                            <button key={note.id} onClick={() => onSetActiveNote(note.id)} className="w-full text-left p-4 rounded-2xl bg-white border border-transparent hover:border-indigo-100 hover:shadow-md transition-all group">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors"><FileText size={16} /></div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-800 text-sm truncate mb-0.5">{note.title || '无标题'}</h4>
                                        <p className="text-xs text-gray-400 line-clamp-1">{note.content || '暂无内容...'}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
