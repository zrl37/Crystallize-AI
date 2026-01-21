
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Note, Folder, QuickPhrase } from '../types';
import { Plus, Trash2, ChevronLeft, ChevronRight, Wand2, Code2, FileText, Zap, X, MoreHorizontal, Check, Edit2, Share2, Copy, FileOutput, Printer, CheckSquare, Square, Search, ListFilter, Minus } from 'lucide-react';
import { organizeNote } from '../services/gemini';

interface NotebookFullViewProps {
    notes: Note[];
    folders: Folder[];
    activeNoteId: string | null;
    onSetActiveNote: (id: string | null) => void;
    onCreateNote: (folderId?: string) => void;
    onUpdateNote: (id: string, updates: Partial<Note>) => void;
    onDeleteNote: (id: string) => void;
    onBatchDeleteNotes?: (ids: string[]) => void;
    onMoveToFolder: (noteId: string, folderId?: string) => void;
    onCreateFolder: (name: string, parentId?: string) => void;
    onDeleteFolder: (id: string) => void;
    onUpdateFolder: (id: string, name: string) => void;
    onMoveFolder: (folderId: string, targetParentId?: string) => void;
    onCursorChange?: (pos: number) => void;
    notebookCommands?: QuickPhrase[];
    onSaveCommand?: (cmd: QuickPhrase) => void;
    onDeleteCommand?: (id: string) => void;
    onTogglePinCommand?: (id: string) => void;
}

const LINE_HEIGHT = 32;
const FONT_SIZE = 18;
const FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const NotebookFullView: React.FC<NotebookFullViewProps> = ({
    notes,
    folders,
    activeNoteId,
    onSetActiveNote,
    onCreateNote,
    onUpdateNote,
    onDeleteNote,
    onBatchDeleteNotes,
    onCursorChange,
    notebookCommands = [],
    onSaveCommand,
    onDeleteCommand,
    onTogglePinCommand
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Multi-select state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
    const [showBatchExportMenu, setShowBatchExportMenu] = useState(false);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, noteId: string } | null>(null);
    const [isHoveringExportSub, setIsHoveringExportSub] = useState(false);

    // Command Manager State
    const [showCommandManager, setShowCommandManager] = useState(false);
    const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
    const [newCommandLabel, setNewCommandLabel] = useState('');
    const [newCommandText, setNewCommandText] = useState('');

    // Quick Add State (Inline)
    const [isCreatingCommand, setIsCreatingCommand] = useState(false);
    const [tempCommandText, setTempCommandText] = useState('');
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const activeNote = notes.find(n => n.id === activeNoteId);

    const { displayedNotes } = useMemo(() => {
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            return {
                displayedNotes: notes.filter(n => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query))
            };
        }
        return {
            displayedNotes: notes.filter(n => n.folderId === currentFolderId)
        };
    }, [notes, currentFolderId, searchQuery]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
                setIsHoveringExportSub(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const breadcrumbs = useMemo(() => {
        const path: { id?: string, name: string }[] = [{ id: undefined, name: '根目录' }];
        let currentId = currentFolderId;
        while (currentId) {
            const folder = folders.find(f => f.id === currentId);
            if (folder) {
                path.splice(1, 0, { id: folder.id, name: folder.name });
                currentId = folder.parentId;
            } else break;
        }
        return path;
    }, [currentFolderId, folders]);

    const handleContentChange = (content: string) => {
        if (activeNote) onUpdateNote(activeNote.id, { content });
    };

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (highlightRef.current) highlightRef.current.scrollTop = e.currentTarget.scrollTop;
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

    const exportSingleNote = (type: 'copy' | 'docx' | 'pdf', note: Note) => {
        if (type === 'copy') {
            navigator.clipboard.writeText(note.title + '\n\n' + note.content);
        } else if (type === 'docx') {
            const header = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>${note.title}</title>
                <style>body { font-family: sans-serif; padding: 50px; line-height: 1.6; } h1 { color: #4F46E5; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px; } div { white-space: pre-wrap; }</style>
                </head><body>
                <h1>${note.title}</h1>
                <div>${note.content}</div>
                </body></html>`;
            const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${note.title || '笔记导出'}.doc`;
            link.click();
            URL.revokeObjectURL(url);
        } else if (type === 'pdf') {
            window.print();
        }
    };

    const handleExport = (type: 'copy' | 'docx' | 'pdf', noteToExport?: Note) => {
        const targetNotes = noteToExport ? [noteToExport] : notes.filter(n => selectedNoteIds.has(n.id));
        if (targetNotes.length === 0) return;
        
        setShowExportMenu(false);
        setShowBatchExportMenu(false);

        if (noteToExport) {
            exportSingleNote(type, noteToExport);
            if (type === 'copy') alert('内容已复制到剪贴板');
        } else {
            if (type === 'copy') {
                alert('批量导出不支持复制到剪贴板，请选择导出为 Word 或 PDF。');
                return;
            }

            targetNotes.forEach((note, index) => {
                setTimeout(() => {
                    if (type === 'pdf') {
                        onSetActiveNote(note.id);
                        setTimeout(() => window.print(), 300);
                    } else {
                        exportSingleNote(type, note);
                    }
                }, index * 600);
            });
        }
    };

    const toggleNoteSelection = (id: string) => {
        const next = new Set(selectedNoteIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedNoteIds(next);
    };

    const handleBatchDelete = () => {
        if (onBatchDeleteNotes) {
            // Reset selection mode after requesting delete, or let the modal execution handle it if you prefer UI feedback first.
            // Here we just open the modal.
            onBatchDeleteNotes(Array.from(selectedNoteIds));
            setIsSelectionMode(false);
            setSelectedNoteIds(new Set());
        }
    };

    const handleNoteContextMenu = (e: React.MouseEvent, noteId: string) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            noteId
        });
        setIsHoveringExportSub(false);
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
                return (
                    <span key={i} className="text-green-600 font-bold bg-green-50/50">
                        {part}
                    </span>
                );
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

    const editorStyles: React.CSSProperties = {
        fontFamily: FONT_FAMILY,
        fontSize: `${FONT_SIZE}px`,
        lineHeight: `${LINE_HEIGHT}px`,
        padding: '0',
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

    if (activeNoteId && activeNote) {
        return (
            <div className="flex flex-col h-full bg-white animate-in fade-in duration-200">
                 {/* Command Manager Modal */}
                 {showCommandManager && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
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

                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shadow-sm">
                    <button onClick={() => onSetActiveNote(null)} className="flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 transition-colors font-bold px-3 py-2 hover:bg-gray-50 rounded-xl text-sm"><ChevronLeft size={18} /> 返回列表</button>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 mr-4 bg-gray-50 px-1 py-1 rounded-xl border border-gray-100 h-9 max-w-[320px] lg:max-w-[480px]">
                             <button 
                                onClick={() => setIsCreatingCommand(true)}
                                className="flex-shrink-0 w-7 h-7 rounded-lg bg-white text-indigo-600 flex items-center justify-center hover:bg-indigo-50 transition-colors border border-gray-200 shadow-sm"
                                title="添加指令"
                             >
                                <Plus size={14} />
                             </button>
                             <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>
                            <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-right">
                                {isCreatingCommand && (
                                    <div className="flex-shrink-0 flex items-center gap-1 bg-white border border-indigo-200 rounded-lg pl-2 pr-1 py-0.5 shadow-sm animate-in slide-in-from-left-2 h-7">
                                        <input
                                            autoFocus
                                            type="text"
                                            className="text-xs bg-transparent outline-none w-20"
                                            placeholder="指令..."
                                            value={tempCommandText}
                                            onChange={e => setTempCommandText(e.target.value)}
                                            onKeyDown={e => { if(e.key === 'Enter') handleQuickAddCommand(); if(e.key === 'Escape') setIsCreatingCommand(false); }}
                                        />
                                        <button onClick={handleQuickAddCommand} className="p-0.5 text-indigo-600 hover:bg-indigo-50 rounded"><Check size={12} /></button>
                                        <button onClick={() => setIsCreatingCommand(false)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded"><X size={12} /></button>
                                    </div>
                                )}
                                {pinnedCommands.map((cmd) => (
                                    <button 
                                        key={cmd.id} 
                                        onClick={() => insertInstruction(cmd.text)} 
                                        className="flex-shrink-0 text-xs font-medium text-gray-600 hover:text-indigo-600 px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all whitespace-nowrap shadow-sm"
                                        title={cmd.text}
                                    >
                                        {cmd.label || cmd.text.substring(0, 4)}
                                    </button>
                                ))}
                            </div>
                            <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0"></div>
                            <button 
                                onClick={() => setShowCommandManager(true)} 
                                className="flex-shrink-0 flex items-center justify-center w-7 h-7 text-gray-400 hover:text-indigo-600 bg-transparent hover:bg-white rounded-lg transition-all"
                                title="管理指令"
                            >
                                <MoreHorizontal size={14} />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                             <button onClick={insertDivider} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-sm">
                                <Minus size={16} /> 插入分割线
                            </button>
                            <button onClick={() => { setIsOrganizing(true); organizeNote(activeNote.content).then(res => { handleContentChange(res); setIsOrganizing(false); }); }} disabled={isOrganizing || !activeNote.content.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md">{isOrganizing ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Wand2 size={16} />} 一键整理</button>
                        </div>

                        <div className="w-px h-5 bg-gray-200 mx-1" />
                        
                        <div className="relative">
                            <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2 text-gray-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors flex items-center gap-1.5">
                                <Share2 size={20} />
                                <span className="text-sm font-bold">导出</span>
                            </button>
                            {showExportMenu && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                                    <button onClick={() => handleExport('copy', activeNote)} className="w-full text-left px-4 py-3 text-sm text-gray-600 hover:bg-indigo-50 flex items-center gap-3 transition-colors"><Copy size={16} className="text-indigo-500" /> 复制到剪贴板</button>
                                    <button onClick={() => handleExport('docx', activeNote)} className="w-full text-left px-4 py-3 text-sm text-gray-600 hover:bg-indigo-50 flex items-center gap-3 transition-colors"><FileOutput size={16} className="text-blue-500" /> 导出为 Word (.doc)</button>
                                    <button onClick={() => handleExport('pdf', activeNote)} className="w-full text-left px-4 py-3 text-sm text-gray-600 hover:bg-indigo-50 flex items-center gap-3 transition-colors"><Printer size={16} className="text-red-500" /> 导出为 PDF</button>
                                </div>
                            )}
                        </div>

                        <button onClick={() => onDeleteNote(activeNote.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"><Trash2 size={20} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden px-6 md:px-12 lg:px-32 py-10 flex flex-col printable-note">
                    <input type="text" value={activeNote.title} onChange={(e) => onUpdateNote(activeNote.id, { title: e.target.value })} className="text-4xl font-black text-gray-900 placeholder-gray-100 outline-none bg-transparent mb-8 w-full border-none focus:ring-0 leading-tight tracking-tight" placeholder="笔记标题..." />
                    <div className="flex-1 relative">
                        <div ref={highlightRef} style={{ ...editorStyles, color: '#374151', pointerEvents: 'none' }} className="z-0">
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
                            style={editorStyles}
                            placeholder="在此输入内容..." 
                            spellCheck={false} 
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full bg-white flex flex-col overflow-hidden animate-in fade-in duration-300 relative">
            {/* Custom Right Click Context Menu */}
            {contextMenu && (
                <div 
                    ref={contextMenuRef}
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    className="fixed z-[100] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 min-w-[180px] py-2 animate-in zoom-in-95 duration-100"
                >
                    {(() => {
                        const targetNote = notes.find(n => n.id === contextMenu.noteId);
                        if (!targetNote) return null;
                        return (
                            <>
                                <div 
                                    className="relative"
                                    onMouseEnter={() => setIsHoveringExportSub(true)}
                                    onMouseLeave={() => setIsHoveringExportSub(false)}
                                >
                                    <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 text-gray-700 flex items-center justify-between transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Share2 size={16} className="text-indigo-600" />
                                            <span>导出</span>
                                        </div>
                                        <ChevronRight size={14} className="text-gray-400" />
                                    </button>
                                    
                                    {isHoveringExportSub && (
                                        <div className="absolute left-full top-0 ml-1 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 min-w-[180px] py-2 animate-in slide-in-from-left-2 duration-100">
                                            <button onClick={() => { handleExport('copy', targetNote); setContextMenu(null); setIsHoveringExportSub(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 text-gray-700 flex items-center gap-3 transition-colors">
                                                <Copy size={16} className="text-indigo-600" />
                                                <span>复制到剪贴板</span>
                                            </button>
                                            <button onClick={() => { handleExport('docx', targetNote); setContextMenu(null); setIsHoveringExportSub(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 text-gray-700 flex items-center gap-3 transition-colors">
                                                <FileOutput size={16} className="text-indigo-600" />
                                                <span>导出为 Word</span>
                                            </button>
                                            <button onClick={() => { handleExport('pdf', targetNote); setContextMenu(null); setIsHoveringExportSub(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 text-gray-700 flex items-center gap-3 transition-colors">
                                                <Printer size={16} className="text-indigo-600" />
                                                <span>导出为 PDF</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="h-px bg-gray-100 my-1 mx-2" />
                                <button onClick={() => { onDeleteNote(targetNote.id); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 flex items-center gap-3 transition-colors">
                                    <Trash2 size={16} />
                                    <span>删除笔记</span>
                                </button>
                            </>
                        );
                    })()}
                </div>
            )}

            <div className="px-8 pt-8 pb-4 flex flex-col gap-4 bg-white z-20">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1.5">
                        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                            {breadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={idx}>
                                    {idx > 0 && <ChevronRight size={10} className="text-gray-300 flex-shrink-0" />}
                                    <button onClick={() => setCurrentFolderId(crumb.id)} className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${idx === breadcrumbs.length - 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50'}`}>{crumb.name}</button>
                                </React.Fragment>
                            ))}
                        </nav>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tighter">笔记本</h1>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <input 
                                type="text" 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                                placeholder="搜索笔记..." 
                                className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-200 transition-all w-48 md:w-64" 
                            />
                        </div>
                        
                        <div className="w-px h-6 bg-gray-200 mx-1" />

                        <button 
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode);
                                if (isSelectionMode) setSelectedNoteIds(new Set());
                            }}
                            className={`p-2.5 rounded-2xl transition-all flex items-center gap-2 border ${isSelectionMode ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-transparent'}`}
                            title="批量管理"
                        >
                            <ListFilter size={20} />
                            <span className="text-xs font-bold">{isSelectionMode ? '完成管理' : '管理'}</span>
                        </button>

                        <button onClick={() => onCreateNote(currentFolderId)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center gap-2 font-black text-sm active:scale-95"><Plus size={20} /> 新建笔记</button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 content-start pb-48">
                {displayedNotes.map(note => {
                    const isSelected = selectedNoteIds.has(note.id);
                    return (
                        <div 
                            key={note.id} 
                            onClick={() => isSelectionMode ? toggleNoteSelection(note.id) : onSetActiveNote(note.id)} 
                            onContextMenu={(e) => !isSelectionMode && handleNoteContextMenu(e, note.id)}
                            className={`group rounded-[32px] p-6 shadow-sm border transition-all cursor-pointer flex flex-col h-72 relative 
                                ${isSelectionMode ? (isSelected ? 'bg-indigo-600 border-indigo-700 scale-[1.05] shadow-2xl z-10 text-white' : 'bg-white border-gray-100 hover:border-gray-200 opacity-90') : 'bg-white border-gray-100 hover:border-indigo-100 hover:shadow-2xl hover:-translate-y-1.5'}`}
                        >
                            {(isSelectionMode && isSelected) && (
                                <div className="absolute top-4 right-4 z-10">
                                    <div className="w-6 h-6 rounded-full bg-white border-2 border-white text-indigo-600 flex items-center justify-center">
                                        <Check size={14} strokeWidth={4} />
                                    </div>
                                </div>
                            )}
                            <div className={`p-3 rounded-2xl mb-4 transition-colors ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-50 text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                                <FileText size={22} />
                            </div>
                            <h3 className={`font-black text-lg mb-2 truncate transition-colors ${isSelected ? 'text-white' : 'text-gray-900 group-hover:text-indigo-600'}`}>{note.title || '未命名笔记'}</h3>
                            <p className={`text-xs line-clamp-4 flex-1 overflow-hidden leading-relaxed italic transition-colors ${isSelected ? 'text-indigo-100' : 'text-gray-400 opacity-60'}`}>{note.content.substring(0, 100)}</p>
                            
                            {isSelected && (
                                <div className="absolute bottom-6 right-6 opacity-20 text-white">
                                    <CheckSquare size={48} strokeWidth={1} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Batch Action Toolbar */}
            {isSelectionMode && selectedNoteIds.size > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 duration-300 px-4 w-full max-w-2xl">
                    <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 p-3 flex items-center justify-between gap-4 backdrop-blur-xl bg-white/90">
                        <div className="flex items-center gap-4 pl-4">
                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black shadow-lg shadow-indigo-200">
                                {selectedNoteIds.size}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-gray-800">已选择笔记</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Selected Assets</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <button 
                                    onClick={() => setShowBatchExportMenu(!showBatchExportMenu)}
                                    className="px-6 py-3 bg-indigo-50 text-indigo-700 rounded-2xl font-black text-xs hover:bg-indigo-100 transition-all flex items-center gap-2"
                                >
                                    <Share2 size={16} /> 导出
                                </button>
                                {showBatchExportMenu && (
                                    <div className="absolute bottom-full right-0 mb-3 w-56 bg-white rounded-[24px] shadow-2xl border border-gray-100 py-2 animate-in fade-in slide-in-from-bottom-2">
                                        <button onClick={() => handleExport('docx')} className="w-full text-left px-4 py-3 text-xs text-gray-600 hover:bg-indigo-50 flex items-center gap-3 font-bold"><FileOutput size={16} className="text-blue-500" /> 导出为 Word (.doc)</button>
                                        <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-3 text-xs text-gray-600 hover:bg-indigo-50 flex items-center gap-3 font-bold"><Printer size={16} className="text-red-500" /> 导出为 PDF</button>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleBatchDelete}
                                className="px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-xs hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                            >
                                <Trash2 size={16} /> 批量删除
                            </button>
                            
                            <div className="w-px h-8 bg-gray-100 mx-2" />

                            <button 
                                onClick={() => { setIsSelectionMode(false); setSelectedNoteIds(new Set()); }}
                                className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
