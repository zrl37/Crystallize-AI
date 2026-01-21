
import React, { useState, useRef, useEffect } from 'react';
import { Chat, Message, Role, QuickPhrase, Note, Attachment } from '../types';
import { generateAIResponse } from '../services/gemini';
import { Send, CheckCircle2, X, Plus, Users, Edit2, AtSign, Copy, Trash2, MessageSquare, StickyNote, Zap, Settings, MoreHorizontal, Check, X as XIcon, ChevronDown, ChevronUp, Book, FileEdit, Search, ChevronRight, Share2, MousePointer2, ExternalLink, Paperclip, ImageIcon, ListTodo, CheckSquare, ArrowDownToLine, Bookmark, ArrowUpRight } from 'lucide-react';
import { Avatar } from './Avatar';
import { MarkdownView } from './MarkdownView';

interface ChatInterfaceProps {
  chat: Chat;
  allRoles: Role[];
  allChats: Chat[];
  notes: Note[];
  activeNoteId: string | null;
  onAddMessage: (chatId: string, msg: Message) => void;
  onDeleteMessage: (chatId: string, messageId: string) => void; 
  onToggleRole: (chatId: string, roleId: string) => void;
  onUpdateChatName: (chatId: string, newName: string) => void;
  onAddToNotebook: (text: string, mode: 'append' | 'new', noteId?: string) => void;
  onSyncMessages: (sourceChatId: string, targetChatId: string | 'new', messageIds: string[]) => void;
  onNavigateToChat: (chatId: string) => void;
  currentUserId: string;
  isNotebookOpen: boolean;
  onToggleNotebook: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
    chat, 
    allRoles, 
    allChats,
    notes,
    activeNoteId,
    onAddMessage,
    onDeleteMessage, 
    onToggleRole, 
    onUpdateChatName, 
    onAddToNotebook,
    onSyncMessages,
    onNavigateToChat,
    currentUserId,
    isNotebookOpen,
    onToggleNotebook
}) => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState<string[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(chat.name);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const [selectionRect, setSelectionRect] = useState<{top: number, left: number} | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionIsUserBubble, setSelectionIsUserBubble] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, messageId: string, text: string } | null>(null);

  // Attachments State
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync / Selection States
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [showSyncTargetPicker, setShowSyncTargetPicker] = useState(false);
  const [expandedSyncIds, setExpandedSyncIds] = useState<Set<string>>(new Set());

  // Destination Picker State
  const [destMenu, setDestMenu] = useState<{top: number, left: number, text: string} | null>(null);
  const [showAppendSelector, setShowAppendSelector] = useState(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');

  // Quick Phrases State
  const [quickPhrases, setQuickPhrases] = useState<QuickPhrase[]>([
    { id: '1', text: '请帮我总结一下这段话。', isPinned: true },
    { id: '2', text: '你能从批判的角度看看我的观点吗？', isPinned: true },
    { id: '3', text: '把这些内容整理成适合公众号发布的格式。', isPinned: false },
    { id: '4', text: '请检查这段代码是否有安全隐患。', isPinned: true },
  ]);
  const [showPhraseManager, setShowPhraseManager] = useState(false);
  const [newPhraseText, setNewPhraseText] = useState('');
  const [isCreatingPhrase, setIsCreatingPhrase] = useState(false);
  const [isPhrasesCollapsed, setIsPhrasesCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const memberDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const destMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const activeRoles = allRoles.filter(r => chat.roleIds.includes(r.id));
  const filteredMentionRoles = mentionQuery !== null ? activeRoles.filter(r => r.name.toLowerCase().includes(mentionQuery.toLowerCase())) : [];

  const quickTargetNote = notes.find(n => n.id === activeNoteId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages, isTyping, pendingAttachments]);

  useEffect(() => {
    setEditedName(chat.name);
  }, [chat.name]);

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputText]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(event.target as Node)) {
        setShowMemberDropdown(false);
      }
      if (destMenuRef.current && !destMenuRef.current.contains(event.target as Node)) {
        setDestMenu(null);
        setShowAppendSelector(false);
        setNoteSearchQuery('');
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            setSelectionRect(null);
            setSelectedText('');
        }
    };

    const handleMouseUp = () => {
         const selection = window.getSelection();
         if (!selection || selection.isCollapsed) return;
         
         if (chatContainerRef.current && !chatContainerRef.current.contains(selection.anchorNode)) {
            return;
         }

         const text = selection.toString().trim();
         if (text.length > 0) {
             let isUserBubble = false;
             let node = selection.anchorNode;
             while (node && node !== chatContainerRef.current) {
                 if (node instanceof HTMLElement && node.classList.contains('bg-indigo-600')) {
                     isUserBubble = true;
                     break;
                 }
                 node = node.parentNode;
             }
             setSelectionIsUserBubble(isUserBubble);

             const range = selection.getRangeAt(0);
             const rect = range.getBoundingClientRect();
             if (rect.width > 0 && rect.height > 0) {
                // 计算聊天区域的中心位置，确保按钮出现在“窗口偏中间”
                const containerRect = chatContainerRef.current?.getBoundingClientRect();
                const horizontalCenter = containerRect 
                    ? containerRect.left + (containerRect.width / 2)
                    : window.innerWidth / 2;

                setSelectionRect({ 
                    top: Math.max(80, rect.top - 55), // 避免被顶部导航栏遮挡
                    left: horizontalCenter
                });
                setSelectedText(text);
             }
         }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleMouseUp);
    
    return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keyup', handleMouseUp);
    };
  }, []);

  const handleNameSave = () => {
    if (editedName.trim() && editedName.trim() !== chat.name) {
        onUpdateChatName(chat.id, editedName.trim());
    } else {
        setEditedName(chat.name);
    }
    setIsEditingName(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputText(newValue);
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPosition);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    if (lastAtPos !== -1) {
        const textAfterAt = textBeforeCursor.slice(lastAtPos + 1);
        if (!textAfterAt.includes('\n')) {
             setMentionQuery(textAfterAt);
             setMentionHighlightIndex(0);
             return;
        }
    }
    setMentionQuery(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const files: File[] = Array.from(e.target.files);
          const newAttachments: Attachment[] = [];

          for (const file of files) {
              if (!file.type.startsWith('image/')) continue;

              const base64Data = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(file);
              });
              
              const rawBase64 = base64Data.split(',')[1];

              newAttachments.push({
                  id: Date.now().toString() + Math.random(),
                  type: 'image',
                  mimeType: file.type,
                  data: rawBase64,
                  url: base64Data, 
                  name: file.name
              });
          }

          setPendingAttachments(prev => [...prev, ...newAttachments]);
          if (fileInputRef.current) fileInputRef.current.value = '';
          textareaRef.current?.focus();
      }
  };

  const removeAttachment = (id: string) => {
      setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  const confirmMention = (role: Role) => {
      if (mentionQuery === null) return;
      const cursorPosition = textareaRef.current?.selectionStart || 0;
      const textBeforeCursor = inputText.slice(0, cursorPosition);
      const lastAtPos = textBeforeCursor.lastIndexOf('@');
      const prefix = inputText.slice(0, lastAtPos);
      const suffix = inputText.slice(cursorPosition);
      const newText = `${prefix}@${role.name} ${suffix}`;
      setInputText(newText);
      setMentionQuery(null);
      setTimeout(() => {
          if (textareaRef.current) {
              textareaRef.current.focus();
              const newCursorPos = lastAtPos + role.name.length + 2;
              textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
      }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredMentionRoles.length > 0) {
        if (e.key === 'ArrowUp') { e.preventDefault(); setMentionHighlightIndex(prev => (prev > 0 ? prev - 1 : filteredMentionRoles.length - 1)); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionHighlightIndex(prev => (prev < filteredMentionRoles.length - 1 ? prev + 1 : 0)); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); confirmMention(filteredMentionRoles[mentionHighlightIndex]); return; }
        if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (mentionQuery === null) handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && pendingAttachments.length === 0) return;
    
    const messageText = inputText.trim();
    const currentAttachments = [...pendingAttachments];
    
    setInputText('');
    setPendingAttachments([]);
    setMentionQuery(null);

    let mentionedRoleIds: string[] = [];
    activeRoles.forEach(role => { if (messageText.includes(`@${role.name}`)) mentionedRoleIds.push(role.id); });

    const newMessage: Message = {
      id: Date.now().toString(),
      chatId: chat.id,
      senderId: currentUserId,
      senderName: '我',
      text: messageText,
      timestamp: Date.now(),
      type: 'user',
      mentions: mentionedRoleIds,
      attachments: currentAttachments
    };
    
    if (chat.messages.length === 0 && chat.name === '新会话') {
        const nameSource = messageText || '新图片会话';
        const autoName = nameSource.slice(0, 20) + (nameSource.length > 20 ? '...' : '');
        onUpdateChatName(chat.id, autoName);
    }

    onAddMessage(chat.id, newMessage);

    if (mentionedRoleIds.length > 0) {
       mentionedRoleIds.forEach(roleId => triggerAIResponse(chat.id, roleId, messageText, currentAttachments));
    } else {
       activeRoles.forEach(role => triggerAIResponse(chat.id, role.id, messageText, currentAttachments));
    }
  };

  const triggerAIResponse = async (targetChatId: string, roleId: string, userPrompt: string, attachments: Attachment[]) => {
    const role = allRoles.find(r => r.id === roleId);
    if (!role) return;
    setIsTyping(prev => [...prev, roleId]);
    
    const contextMessages = chat.messages;
    const responseText = await generateAIResponse(role, contextMessages, userPrompt, attachments);
    
    setIsTyping(prev => prev.filter(id => id !== roleId));
    const aiMessage: Message = {
      id: Date.now().toString() + Math.random().toString(),
      chatId: targetChatId,
      senderId: role.id,
      senderName: role.name,
      text: responseText,
      timestamp: Date.now(),
      type: 'ai'
    };
    onAddMessage(targetChatId, aiMessage);
  };

  const handleCopyMessage = (text: string) => { 
      navigator.clipboard.writeText(text); 
      setContextMenu(null);
  };
  
  const handleDeleteMessage = (msgId: string) => { 
    if (window.confirm('确定要删除这条消息吗？')) onDeleteMessage(chat.id, msgId); 
    setContextMenu(null);
  };
  
  const handleBatchDelete = () => {
    if (window.confirm(`确定要删除选中的 ${selectedMessageIds.size} 条消息吗？`)) {
        selectedMessageIds.forEach(id => onDeleteMessage(chat.id, id));
        setIsSelectionMode(false);
        setSelectedMessageIds(new Set());
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const handleOpenDestMenu = (text: string, event: React.MouseEvent | { clientX: number, clientY: number, currentTarget: HTMLElement }) => {
      let textToUse = text;
      if (isSelectionMode && selectedMessageIds.size > 0) {
          const selectedMsgs = chat.messages.filter(m => selectedMessageIds.has(m.id));
          textToUse = selectedMsgs.map(m => `[${m.senderName}]: ${m.text}`).join('\n\n');
      }

      let targetRect: DOMRect;
      if ('currentTarget' in event) {
          targetRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      } else {
          targetRect = new DOMRect(event.clientX, event.clientY, 0, 0);
      }

      setDestMenu({
          top: targetRect.bottom + 5,
          left: targetRect.left,
          text: textToUse
      });
      setShowAppendSelector(false);
      setNoteSearchQuery('');
      setContextMenu(null);
    };

  const confirmAddToNote = (mode: 'append' | 'new', noteId?: string) => {
      if (destMenu) {
          onAddToNotebook(destMenu.text, mode, noteId);
          setDestMenu(null);
          setShowAppendSelector(false);
          setNoteSearchQuery('');
          setSelectionRect(null);
          window.getSelection()?.removeAllRanges();
          
          if (isSelectionMode) {
              setIsSelectionMode(false);
              setSelectedMessageIds(new Set());
          }
      }
  };

  const handleToggleMessageSelection = (msgId: string) => {
    const next = new Set(selectedMessageIds);
    if (next.has(msgId)) next.delete(msgId);
    else next.add(msgId);
    setSelectedMessageIds(next);
  };
  
  const enterSelectionMode = (initialMsgId: string) => {
      setIsSelectionMode(true);
      const next = new Set<string>();
      next.add(initialMsgId);
      setSelectedMessageIds(next);
      setContextMenu(null);
  };

  const toggleSelectAll = () => {
      if (selectedMessageIds.size === chat.messages.length) {
          setSelectedMessageIds(new Set());
      } else {
          const allIds = new Set(chat.messages.map(m => m.id));
          setSelectedMessageIds(allIds);
      }
  };

  const handleConfirmSync = (targetId: string | 'new') => {
    const ids = Array.from(selectedMessageIds);
    onSyncMessages(chat.id, targetId, ids);
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
    setShowSyncTargetPicker(false);
    setContextMenu(null);
  };

  const toggleSyncExpand = (msgId: string) => {
    const next = new Set(expandedSyncIds);
    if (next.has(msgId)) next.delete(msgId);
    else next.add(msgId);
    setExpandedSyncIds(next);
  };

  const usePhrase = (text: string) => {
    setInputText(prev => prev ? prev + '\n' + text : text);
    textareaRef.current?.focus();
  };

  const addPhrase = () => {
    if (!newPhraseText.trim()) return;
    const newPhrase: QuickPhrase = {
      id: Date.now().toString(),
      text: newPhraseText.trim(),
      isPinned: true
    };
    setQuickPhrases(prev => [...prev, newPhrase]);
    setNewPhraseText('');
    setIsCreatingPhrase(false);
  };

  const deletePhrase = (id: string) => {
    setQuickPhrases(prev => prev.filter(p => p.id !== id));
  };

  const togglePinPhrase = (id: string) => {
    setQuickPhrases(prev => prev.map(p => p.id === id ? { ...p, isPinned: !p.isPinned } : p));
  };

  const handleContextMenu = (e: React.MouseEvent, msgId: string, text: string) => {
      e.preventDefault();
      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          messageId: msgId,
          text: text
      });
  };

  const pinnedPhrases = quickPhrases.filter(p => p.isPinned);

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(noteSearchQuery.toLowerCase())
  ).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden" ref={chatContainerRef}>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept="image/*" 
        multiple 
        className="hidden" 
      />

      {/* Right Click Context Menu */}
      {contextMenu && (
        <div 
            ref={contextMenuRef}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-[200] bg-white rounded-xl shadow-2xl border border-gray-100 min-w-[160px] overflow-hidden animate-in zoom-in-95 duration-100 py-1"
        >
            <button onClick={() => handleCopyMessage(contextMenu.text)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                <Copy size={16} /> 复制
            </button>
            <button onClick={(e) => { 
                setSelectedMessageIds(new Set([contextMenu.messageId])); 
                setShowSyncTargetPicker(true);
                setContextMenu(null);
                setIsSelectionMode(false);
            }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                <Share2 size={16} /> 同步
            </button>
            
            <button onMouseDown={(e) => { 
                 e.stopPropagation();
                 e.preventDefault();
                 const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                 setDestMenu({
                     top: rect.bottom + 5,
                     left: rect.left,
                     text: contextMenu.text
                 });
                 setShowAppendSelector(false);
                 setNoteSearchQuery('');
                 setContextMenu(null);
                 setIsSelectionMode(false);
                 setSelectedMessageIds(new Set());
            }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors">
                <Bookmark size={16} /> 添加到笔记
            </button>

            <div className="h-px bg-gray-100 my-1" />
            <button onClick={() => enterSelectionMode(contextMenu.messageId)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                <CheckSquare size={16} /> 多选
            </button>
             <button onClick={() => handleDeleteMessage(contextMenu.messageId)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center gap-3 text-red-600">
                <Trash2 size={16} /> 删除
            </button>
        </div>
      )}

      {/* Sync Target Picker Modal */}
      {showSyncTargetPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Share2 size={20} className="text-indigo-600" />
                    <h3 className="text-lg font-black text-gray-800 tracking-tight">选择同步目标</h3>
                  </div>
                  <button onClick={() => setShowSyncTargetPicker(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  <button 
                    onClick={() => handleConfirmSync('new')}
                    className="w-full flex items-center gap-4 p-4 hover:bg-indigo-50 rounded-2xl transition-all group border-2 border-dashed border-gray-100 hover:border-indigo-200 mb-2"
                  >
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Plus size={20} />
                    </div>
                    <div className="text-left">
                      <div className="font-black text-sm text-gray-800">同步并开启新会话</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">New Project Workspace</div>
                    </div>
                  </button>
                  <div className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">已有会话</div>
                  {allChats.filter(c => c.id !== chat.id).map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => handleConfirmSync(c.id)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-all text-left"
                    >
                      <div className="p-3 bg-gray-100 text-gray-400 rounded-xl">
                        <MessageSquare size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-gray-800 truncate">{c.name}</div>
                        <div className="text-[10px] text-gray-400">{c.messages.length} 条消息内容</div>
                      </div>
                      <ChevronRight size={16} className="text-gray-200" />
                    </button>
                  ))}
                  {allChats.length <= 1 && (
                    <div className="p-8 text-center text-xs text-gray-400 italic">没有其它既有会话</div>
                  )}
              </div>
           </div>
        </div>
      )}

      {/* 优化后的动态配色划线悬浮工具栏 - 修改了定位逻辑，让其处于“窗口偏中间” */}
      {selectionRect && !destMenu && !isSelectionMode && (
          <div 
            style={{ top: selectionRect.top, left: selectionRect.left }} 
            className="fixed z-50 animate-in zoom-in-95 duration-100 transform -translate-x-1/2"
          >
              <button 
                onMouseDown={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    handleOpenDestMenu(selectedText, e); 
                }} 
                className={`px-5 py-2.5 rounded-full shadow-[0_15px_35px_rgba(0,0,0,0.15)] flex items-center gap-2 transition-all text-sm font-black active:scale-95 border border-white/20 backdrop-blur-md ${
                    selectionIsUserBubble 
                    ? 'bg-white/95 text-indigo-600 hover:bg-white' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700' 
                }`}
              >
                  <StickyNote size={16} />
                  添加到笔记
              </button>
          </div>
      )}

      {/* Destination Picker Menu / Note Selector */}
      {destMenu && (
          <div 
            ref={destMenuRef}
            style={{ 
                top: showAppendSelector ? Math.max(20, destMenu.top - 200) : destMenu.top, 
                left: destMenu.left 
            }} 
            className={`fixed z-[100] bg-white rounded-xl shadow-2xl border border-indigo-100 p-1.5 min-w-[200px] transition-all duration-200 animate-in slide-in-from-bottom-2 ${showAppendSelector ? 'w-64 max-h-[300px] flex flex-col' : ''}`}
          >
              {!showAppendSelector ? (
                <>
                  {quickTargetNote && (
                      <button 
                        onClick={() => confirmAddToNote('append', quickTargetNote.id)} 
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors whitespace-nowrap mb-1 border-b border-dashed border-gray-100"
                      >
                          <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md">
                             <ArrowDownToLine size={14} />
                          </div>
                          <div className="text-left">
                             <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">追加到最近</div>
                             <div className="font-bold truncate max-w-[120px]">{quickTargetNote.title}</div>
                          </div>
                      </button>
                  )}
                  <button 
                    onClick={() => setShowAppendSelector(true)} 
                    className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors whitespace-nowrap group"
                  >
                      <div className="flex items-center gap-2.5"><FileEdit size={14} /> 选择其他笔记...</div>
                      <ChevronRight size={12} className="text-gray-300 group-hover:text-indigo-400" />
                  </button>
                  <button 
                    onClick={() => confirmAddToNote('new')} 
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                      <Plus size={14} /> 作为新笔记保存
                  </button>
                </>
              ) : (
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="px-2 py-1 flex items-center gap-2 border-b border-gray-100 mb-1">
                        <Search size={12} className="text-gray-400" />
                        <input 
                            autoFocus
                            type="text" 
                            placeholder="搜索笔记标题..." 
                            className="flex-1 bg-transparent text-xs py-1 outline-none font-medium" 
                            value={noteSearchQuery}
                            onChange={(e) => setNoteSearchQuery(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                        <button onClick={() => setShowAppendSelector(false)} className="p-1 hover:bg-gray-100 rounded text-gray-400"><X size={12} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar">
                        {filteredNotes.length === 0 ? (
                            <div className="p-4 text-center text-[10px] text-gray-400 italic">未找到相关笔记</div>
                        ) : (
                            filteredNotes.map(note => (
                                <button 
                                    key={note.id}
                                    onClick={() => confirmAddToNote('append', note.id)}
                                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 rounded-lg transition-colors group flex flex-col gap-0.5"
                                >
                                    <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-700 truncate">{note.title || '无标题'}</span>
                                    <span className="text-[9px] text-gray-400 font-mono">{new Date(note.updatedAt).toLocaleDateString()}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
              )}
          </div>
      )}

      {/* Quick Phrase Manager Modal */}
      {showPhraseManager && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30">
                    <div className="flex items-center gap-2">
                        <Zap size={20} className="text-indigo-600" />
                        <h3 className="text-lg font-black text-gray-800 tracking-tight">管理快捷短语</h3>
                    </div>
                    <button onClick={() => setShowPhraseManager(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">新增短语</label>
                        <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={newPhraseText}
                              onChange={e => setNewPhraseText(e.target.value)}
                              placeholder="输入短语内容..."
                              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              onKeyDown={e => e.key === 'Enter' && addPhrase()}
                            />
                            <button onClick={addPhrase} className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 font-bold text-sm transition-all active:scale-95"><Plus size={18} /></button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">所有短语 ({quickPhrases.length})</label>
                        {quickPhrases.map(phrase => (
                            <div key={phrase.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl hover:border-indigo-100 hover:shadow-sm transition-all group">
                                <div className="flex-1 text-sm text-gray-700 truncate">{phrase.text}</div>
                                <button 
                                    onClick={() => togglePinPhrase(phrase.id)}
                                    className={`p-2 rounded-lg transition-colors ${phrase.isPinned ? 'bg-indigo-50 text-indigo-600' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                    title={phrase.isPinned ? "取消主页显示" : "显示在主页"}
                                >
                                    <Zap size={16} fill={phrase.isPinned ? "currentColor" : "none"} />
                                </button>
                                <button 
                                    onClick={() => deletePhrase(phrase.id)}
                                    className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="删除"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 bg-gray-50 text-center text-[10px] text-gray-400 border-t border-gray-100">
                    勾选闪电图标，将短语固定在聊天界面上方。
                </div>
            </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full w-full transition-all duration-300">
        <div className="bg-white border-b border-gray-200 pl-6 pr-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm h-16 transition-colors duration-300 relative">
                <div className="flex-1 pl-12 flex items-center overflow-hidden">
                {isEditingName ? (
                    <input type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} onBlur={handleNameSave} onKeyDown={(e) => e.key === 'Enter' && handleNameSave()} autoFocus className="text-xl font-bold text-gray-800 bg-white border-b-2 border-indigo-500 px-1 outline-none w-full max-w-sm" />
                ) : (
                    <div className="flex items-center gap-2 group cursor-pointer overflow-hidden" onClick={() => setIsEditingName(true)} title="点击重命名">
                        <h2 className={`text-xl font-bold truncate ${chat.name === '新会话' ? 'text-gray-400 italic' : 'text-gray-800'}`}>{chat.name}</h2>
                        <Edit2 size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 relative" ref={memberDropdownRef}>
                        <div className="flex -space-x-2">
                            {activeRoles.map(role => (
                                <div key={role.id} title={role.name} className="hover:z-10 transition-transform hover:scale-110">
                                    <Avatar src={role.avatar} alt={role.name} size="sm" className="border-2 border-white ring-1 ring-gray-200" />
                                </div>
                            ))}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setShowMemberDropdown(!showMemberDropdown); }} className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors" title="管理团队成员">{showMemberDropdown ? <X size={14} /> : <Plus size={16} />}</button>
                        {showMemberDropdown && (
                            <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                                <div className="p-3 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase">管理活跃成员</div>
                                <div className="max-h-64 overflow-y-auto p-2">
                                    {allRoles.map(role => {
                                        const isActive = chat.roleIds.includes(role.id);
                                        return (
                                            <button key={role.id} onClick={() => onToggleRole(chat.id, role.id)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-indigo-50 transition-colors text-left group">
                                                <div className="relative"><Avatar src={role.avatar} alt={role.name} size="sm" />{isActive && <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5 border-2 border-white"></div>}</div>
                                                <div className="flex-1"><div className={`text-sm font-medium ${isActive ? 'text-indigo-700' : 'text-gray-600'}`}>{role.name}</div><div className="text-[10px] text-gray-400 truncate w-40">{role.description}</div></div>
                                                {isActive && <CheckCircle2 size={14} className="text-green-500" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="w-px h-6 bg-gray-100"></div>

                    <button 
                    onClick={onToggleNotebook}
                    className={`p-2 rounded-xl transition-all flex items-center gap-2 border ${isNotebookOpen ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200'}`}
                    title={isNotebookOpen ? "收起笔记本" : "打开笔记本"}
                    >
                    <Book size={18} />
                    <span className="text-xs font-bold hidden sm:inline">笔记本</span>
                    </button>
                </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {chat.messages.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-60 pointer-events-none select-none"><MessageSquare size={48} className="mb-3" /><p>输入消息开始新会话</p></div>}
            {chat.messages.map((msg) => {
                const isUser = msg.senderId === 'user';
                const isSystem = msg.type === 'system';
                const isSync = msg.type === 'sync';
                const senderRole = allRoles.find(r => r.id === msg.senderId);
                const isSelected = selectedMessageIds.has(msg.id);

                if (isSync && msg.syncMetadata) {
                  const meta = msg.syncMetadata;
                  const isExpanded = expandedSyncIds.has(msg.id);
                  return (
                    <div key={msg.id} className="flex justify-center my-4 animate-in fade-in slide-in-from-bottom-2">
                       <div className="bg-slate-100/50 border border-slate-200 border-dashed rounded-2xl p-3 max-w-[80%] w-full">
                          <div className="flex items-center justify-between mb-1">
                             <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <Share2 size={14} className="text-indigo-500" />
                                <span>穿梭活动</span>
                                <span className="text-slate-300 font-normal">|</span>
                                <span>{meta.type === 'sent' ? `同步至“${meta.targetChatName}”` : `来自“${meta.sourceChatName}”的同步`}</span>
                                {meta.type === 'sent' && (
                                    <button 
                                        onClick={() => onNavigateToChat(meta.targetChatId)}
                                        className="flex items-center gap-0.5 text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors ml-1"
                                        title="前往目标会话"
                                    >
                                        <span>前往</span>
                                        <ArrowUpRight size={10} />
                                    </button>
                                )}
                             </div>
                             <button 
                              onClick={() => toggleSyncExpand(msg.id)}
                              className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest"
                             >
                               {isExpanded ? '收起详情' : '展开预览'}
                             </button>
                          </div>
                          <div className="text-[10px] text-slate-400 mb-1">{formatTime(msg.timestamp)} • {meta.messageIds.length} 条内容已穿梭</div>
                          {isExpanded && (
                            <div className="mt-3 bg-white/50 rounded-xl p-3 text-xs text-slate-600 italic border border-slate-100 animate-in zoom-in-95 duration-200">
                               <MarkdownView content={msg.text} />
                            </div>
                          )}
                       </div>
                    </div>
                  );
                }

                return (
                    <div 
                      key={msg.id} 
                      onContextMenu={(e) => !isSystem && handleContextMenu(e, msg.id, msg.text)}
                      onClick={() => isSelectionMode && !isSystem && handleToggleMessageSelection(msg.id)}
                      className={`flex gap-4 group relative ${isUser ? 'flex-row-reverse' : ''} ${isSelectionMode && !isSystem ? 'cursor-pointer hover:bg-indigo-50/30 p-2 -mx-2 rounded-2xl transition-all' : ''}`}
                    >
                    {isSelectionMode && !isSystem && (
                      <div className="flex-shrink-0 self-center">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                          {isSelected && <Check size={14} strokeWidth={4} />}
                        </div>
                      </div>
                    )}
                    {!isUser && !isSystem && <Avatar src={senderRole?.avatar} alt={msg.senderName} />}
                    <div className={`max-w-[70%] relative transition-all duration-200 ${isSelected ? 'scale-[0.98]' : ''}`}>
                        <div className={`flex items-baseline gap-2 mb-1 ${isUser ? 'justify-end' : ''}`}><span className="text-sm font-bold text-gray-700 flex items-center gap-2">{msg.senderName}</span><span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span></div>
                        <div className={`px-5 py-3 rounded-2xl text-sm shadow-sm relative ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : isSystem ? 'bg-gray-100 text-gray-600 border border-gray-200 italic text-center text-xs py-2 px-4' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'} ${msg.mentions && msg.mentions.length > 0 && isUser ? 'ring-2 ring-yellow-400' : ''}`}>
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-2">
                                    {msg.attachments.map(att => (
                                        <div key={att.id} className="relative rounded-lg overflow-hidden border border-gray-200/50">
                                            <img src={att.url} alt="attachment" className="max-w-full max-h-64 object-cover" />
                                        </div>
                                    ))}
                                </div>
                            )}
                            <MarkdownView content={msg.text} />
                        </div>
                        
                        {!isSelectionMode && !isSystem && (
                          <div className={`absolute -bottom-5 ${isUser ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pt-1`}>
                              <div className="flex items-center gap-1 bg-white border border-gray-200 shadow-md rounded-full px-2 py-1">
                                  <button onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg.text); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="复制"><Copy size={14} /></button>
                                  <button onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleOpenDestMenu(msg.text, e); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="添加到笔记"><StickyNote size={14} /></button>
                              </div>
                          </div>
                        )}
                    </div>
                    </div>
                );
            })}
             {isTyping.filter(id => activeRoles.find(r => r.id === id)).length > 0 && <div className="flex gap-2 items-center text-xs text-gray-400 ml-14"><span className="animate-pulse">思考中...</span></div>}
            <div ref={messagesEndRef} />
        </div>
        
        {isSelectionMode ? (
            <div className="bg-white p-4 border-t border-gray-200 relative animate-in slide-in-from-bottom-2">
               <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                       <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                           <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedMessageIds.size > 0 && selectedMessageIds.size === chat.messages.length ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                                {selectedMessageIds.size > 0 && selectedMessageIds.size === chat.messages.length && <Check size={12} strokeWidth={4} />}
                           </div>
                           全选
                       </button>
                       <span className="text-xs text-gray-400 font-bold">已选 {selectedMessageIds.size} 项</span>
                  </div>
                  <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setShowSyncTargetPicker(true)}
                            disabled={selectedMessageIds.size === 0}
                            className="flex-col gap-1 w-12 h-12 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                            title="同步/分享"
                        >
                            <Share2 size={20} />
                        </button>
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); handleOpenDestMenu('', e); }}
                            disabled={selectedMessageIds.size === 0}
                            className="flex-col gap-1 w-12 h-12 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                             title="添加到笔记"
                        >
                            <Bookmark size={20} />
                        </button>
                        <button 
                            onClick={handleBatchDelete}
                            disabled={selectedMessageIds.size === 0}
                            className="flex-col gap-1 w-12 h-12 flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                             title="删除"
                        >
                            <Trash2 size={20} />
                        </button>
                        <div className="w-px h-8 bg-gray-200 mx-2"></div>
                        <button 
                            onClick={() => { setIsSelectionMode(false); setSelectedMessageIds(new Set()); }}
                            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                  </div>
               </div>
            </div>
        ) : (
            <div className="bg-white p-4 border-t border-gray-200 relative">
                {pendingAttachments.length > 0 && (
                    <div className="flex gap-3 mb-3 overflow-x-auto p-1">
                        {pendingAttachments.map(att => (
                            <div key={att.id} className="relative group flex-shrink-0">
                                <div className="w-20 h-20 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                                    <img src={att.url} alt="preview" className="w-full h-full object-cover" />
                                </div>
                                <button 
                                    onClick={() => removeAttachment(att.id)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className={`max-w-4xl mx-auto flex items-center gap-2 overflow-hidden transition-all duration-300 ease-in-out ${isPhrasesCollapsed ? 'max-h-0 mb-0 opacity-0' : 'max-h-12 mb-3 opacity-100'}`}>
                    <button 
                    onClick={() => setIsCreatingPhrase(true)}
                    className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors border border-indigo-100"
                    title="快速添加短语"
                    >
                    <Plus size={16} />
                    </button>
                    
                    <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        {isCreatingPhrase && (
                            <div className="flex-shrink-0 flex items-center gap-1 bg-white border border-indigo-200 rounded-full pl-3 pr-1 py-1 shadow-sm animate-in slide-in-from-left-2">
                            <input 
                                autoFocus 
                                type="text" 
                                className="text-xs bg-transparent outline-none w-24 sm:w-32" 
                                placeholder="内容..." 
                                value={newPhraseText}
                                onChange={e => setNewPhraseText(e.target.value)}
                                // FIXED: Use proper if syntax to fix truthiness check of void and empty statement body errors
                                onKeyDown={e => { if(e.key === 'Enter') addPhrase(); if(e.key === 'Escape') setIsCreatingPhrase(false); }}
                                />
                            <button onClick={addPhrase} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-full"><Check size={12} /></button>
                            <button onClick={() => setIsCreatingPhrase(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full"><X size={12} /></button>
                            </div>
                        )}
                        {pinnedPhrases.map(phrase => (
                            <button 
                                key={phrase.id}
                                onClick={() => usePhrase(phrase.text)}
                                className="flex-shrink-0 px-3 py-1.5 bg-indigo-50/50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-all whitespace-nowrap active:scale-95"
                            >
                                {phrase.text}
                            </button>
                        ))}
                        {pinnedPhrases.length === 0 && !isCreatingPhrase && (
                            <span className="text-[10px] text-gray-400 font-medium ml-2">尚未固定短语到此处</span>
                        )}
                    </div>

                    <button 
                        onClick={() => setShowPhraseManager(true)}
                        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors text-xs font-bold"
                    >
                        <MoreHorizontal size={14} />
                        <span>管理</span>
                    </button>
                </div>

                {mentionQuery !== null && filteredMentionRoles.length > 0 && (
                    <div className="absolute bottom-full left-4 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in zoom-in-95 duration-150">
                        <div className="p-2 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><AtSign size={12} />提到成员</div>
                        <div className="max-h-48 overflow-y-auto p-1">{filteredMentionRoles.map((role, idx) => (<button key={role.id} onClick={() => confirmMention(role)} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${idx === mentionHighlightIndex ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-100 text-gray-700'}`}><Avatar src={role.avatar} alt={role.name} size="sm" /><span className="text-sm font-medium">{role.name}</span></button>))}</div>
                    </div>
                )}
                <div className="max-w-4xl mx-auto relative flex flex-col gap-1">
                    {!inputText && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 ml-12 mb-0.5 opacity-60 animate-in fade-in duration-300">
                            <AtSign size={10} /> 提示：输入 @ 可指定特定成员回答
                        </div>
                    )}
                    <div className="flex gap-2 items-end">
                        <button 
                            onClick={() => setIsPhrasesCollapsed(!isPhrasesCollapsed)}
                            className={`flex-shrink-0 mb-1 p-2 rounded-lg transition-all ${isPhrasesCollapsed ? 'bg-indigo-50 text-indigo-600' : 'text-gray-300 hover:text-indigo-500'}`}
                            title={isPhrasesCollapsed ? "展开快捷短语" : "收起快捷短语"}
                        >
                            {isPhrasesCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex-shrink-0 mb-1 p-2 rounded-lg transition-all ${pendingAttachments.length > 0 ? 'bg-indigo-50 text-indigo-600' : 'text-gray-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                            title="上传图片"
                        >
                            <Paperclip size={18} />
                        </button>

                        <textarea 
                            ref={textareaRef} 
                            value={inputText} 
                            onChange={handleInputChange} 
                            onKeyDown={handleKeyDown} 
                            placeholder={activeRoles.length > 0 ? "发送消息..." : "添加成员开始对话..."} 
                            rows={1} 
                            className="flex-1 pl-4 pr-4 py-3 bg-gray-100 border border-transparent rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none max-h-48 overflow-y-auto" 
                            disabled={activeRoles.length === 0} 
                            style={{ minHeight: '50px' }} 
                        />
                        <button 
                            onClick={() => handleSendMessage()} 
                            disabled={(!inputText.trim() && pendingAttachments.length === 0) || activeRoles.length === 0} 
                            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex-shrink-0 h-[50px] flex items-center justify-center"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
