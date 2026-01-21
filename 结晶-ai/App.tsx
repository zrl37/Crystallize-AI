
import React, { useState, useEffect, useRef } from 'react';
import { Role, Chat, Message, Folder, Note, QuickPhrase } from './types';
import { BUILT_IN_ROLES } from './constants';
import { RoleManager } from './components/RoleManager';
import { ChatInterface } from './components/ChatInterface';
import { NotebookPanel } from './components/NotebookPanel';
import { NotebookFullView } from './components/NotebookFullView';
import { MessageSquare, Users, Plus, LayoutGrid, PanelLeft, Folder as FolderIcon, ChevronRight, ChevronDown, MoreVertical, Trash2, Check, X as XIcon, Book, FileText, ArrowUpRight, Share2 } from 'lucide-react';

const DEFAULT_NOTEBOOK_COMMANDS: QuickPhrase[] = [
    { 
        id: '1', 
        label: '统合笔记', 
        text: '这段内容包含多处来自不同语境的剪藏，请将其统合成一篇逻辑严密的笔记，并为每个逻辑部分添加适合的小标题，确保整体表达连贯、结构清晰。', 
        isPinned: true 
    },
    { 
        id: '2', 
        label: '去 AI 味', 
        text: '请改写这段内容。要求：不要过多使用比喻，不要用破折号，严禁滥用连接词如“首先、其次、再次、最后、此外、而且、并且、进一步、更进一步、更重要的是、值得注意的是、从某种程度上说、从某种意义上说”。严禁使用总结连接词如“因此、所以、因而、于是、由此可见、综上所述、总而言之、总的来说、简而言之、归根结底、总之、综上所述”。严禁使用转折或解释连接词如“然而、但是、可是、不过、尽管如此、虽然、尽管、相反地、相比之下、与此相反、另一方面、例如、比如、譬如、举例来说、具体来说、也就是说、换句话说、换言之、即、也就是说”。请保持表达直白、极简，像真人手书。', 
        isPinned: true 
    },
    {
        id: '3',
        label: '整理思绪',
        text: '这是我零散的发问、思考或困惑。请将其梳理得逻辑通顺、表达得体，确保清晰地记录下我此刻的思维出发点和核心关切，以便未来回顾时能迅速找回状态。',
        isPinned: true
    }
];

const App: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>(BUILT_IN_ROLES);
  const [chats, setChats] = useState<Chat[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'roles' | 'notebook'>('chat'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notes, setNotes] = useState<Note[]>([{
      id: 'default-note',
      title: '我的第一个笔记',
      content: '',
      updatedAt: Date.now()
  }]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<string | 'root' | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [createMenuTarget, setCreateMenuTarget] = useState<string | 'root' | null>(null);
  const [notebookCommands, setNotebookCommands] = useState<QuickPhrase[]>(DEFAULT_NOTEBOOK_COMMANDS);
  
  // 拖拽状态
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // 删除确认弹窗状态 - 增加了 ids 用于批量删除，type 增加了 note 和 notes-batch
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id?: string, ids?: string[], type: 'chat' | 'role' | 'folder' | 'note' | 'notes-batch', title: string } | null>(null);

  // 笔记光标位置追踪 (用于插入内容)
  const [noteCursorPosition, setNoteCursorPosition] = useState<number | null>(null);

  // 延迟关闭控制
  const menuTimerRef = useRef<number | null>(null);
  const createMenuTimerRef = useRef<number | null>(null);

  const clearMenuTimer = () => { if(menuTimerRef.current) window.clearTimeout(menuTimerRef.current); };
  const clearCreateTimer = () => { if(createMenuTimerRef.current) window.clearTimeout(createMenuTimerRef.current); };

  const handleMenuLeave = () => {
    menuTimerRef.current = window.setTimeout(() => setOpenMenuId(null), 300);
  };
  const handleCreateLeave = () => {
    createMenuTimerRef.current = window.setTimeout(() => setCreateMenuTarget(null), 300);
  };

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.menu-trigger') && !target.closest('.popup-menu')) {
        setOpenMenuId(null);
        setCreateMenuTarget(null);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      clearMenuTimer();
      clearCreateTimer();
    };
  }, []);

  // 切换笔记时重置光标位置
  useEffect(() => {
    setNoteCursorPosition(null);
  }, [activeNoteId]);

  const addRole = (role: Role) => setRoles(prev => [...prev, role]);
  const updateRole = (role: Role) => setRoles(prev => prev.map(r => r.id === role.id ? role : r));
  
  // 请求删除角色（打开确认框）
  const deleteRole = (roleId: string) => {
      const role = roles.find(r => r.id === roleId);
      setDeleteConfirmation({ id: roleId, type: 'role', title: role?.name || '角色' });
  };

  const startNewChat = (folderId?: string) => {
    const newChatId = Date.now().toString();
    const newChat: Chat = {
        id: newChatId,
        name: '新会话',
        roleIds: [roles[0].id],
        messages: [],
        createdAt: Date.now(),
        folderId
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChatId);
    setActiveView('chat');
    setCreateMenuTarget(null);
    if (folderId) expandFolder(folderId);
    return newChatId;
  };

  // 简单的切换会话函数，用于传给子组件
  const navigateToChat = (chatId: string) => {
      setActiveChatId(chatId);
      setActiveView('chat');
  };

  const handleSyncMessages = (sourceChatId: string, targetChatId: string | 'new', messageIds: string[]) => {
    const sourceChat = chats.find(c => c.id === sourceChatId);
    if (!sourceChat) return;

    const sourceMessages = sourceChat.messages.filter(m => messageIds.includes(m.id));
    if (sourceMessages.length === 0) return;

    // 1. 获取/创建目标会话
    let finalTargetId = targetChatId;
    if (targetChatId === 'new') {
      finalTargetId = startNewChat();
    }
    const targetChat = chats.find(c => c.id === finalTargetId);
    const targetName = targetChat?.name || '新会话';

    // 2. 生成预览文本（用于存根）
    const previewText = sourceMessages.map(m => `**${m.senderName}**: ${m.text.substring(0, 50)}${m.text.length > 50 ? '...' : ''}`).join('\n\n');

    // 3. 在源会话插入发送存根
    const sentStub: Message = {
      id: `stub-sent-${Date.now()}`,
      chatId: sourceChatId,
      senderId: 'system',
      senderName: '系统',
      text: previewText,
      timestamp: Date.now(),
      type: 'sync',
      syncMetadata: {
        sourceChatId: sourceChatId,
        sourceChatName: sourceChat.name,
        targetChatId: finalTargetId,
        targetChatName: targetName,
        messageIds,
        type: 'sent'
      }
    };

    // 4. 在目标会话插入接收存根和消息副本
    const receivedStub: Message = {
      id: `stub-received-${Date.now()}`,
      chatId: finalTargetId,
      senderId: 'system',
      senderName: '系统',
      text: previewText,
      timestamp: Date.now(),
      type: 'sync',
      syncMetadata: {
        sourceChatId: sourceChatId,
        sourceChatName: sourceChat.name,
        targetChatId: finalTargetId,
        targetChatName: targetName,
        messageIds,
        type: 'received'
      }
    };

    const copiedMessages: Message[] = sourceMessages.map(m => ({
      ...m,
      id: `sync-copy-${m.id}-${Date.now()}`,
      chatId: finalTargetId,
      timestamp: Date.now()
    }));

    // 更新状态
    setChats(prev => prev.map(c => {
      if (c.id === sourceChatId) {
        return { ...c, messages: [...c.messages, sentStub] };
      }
      if (c.id === finalTargetId) {
        return { ...c, messages: [...c.messages, receivedStub, ...copiedMessages] };
      }
      return c;
    }));
    
    // 移除自动跳转逻辑，保持在当前页面
  };

  const expandFolder = (folderId: string) => {
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, isExpanded: true } : f));
  };

  // 请求删除会话（打开确认框）
  const requestDeleteChat = (id: string) => {
    const chat = chats.find(c => c.id === id);
    setDeleteConfirmation({ id: id, type: 'chat', title: chat?.name || '会话' });
    setOpenMenuId(null);
  };

  const updateChatName = (chatId: string, newName: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, name: newName } : c));
  };

  const addMessageToChat = (chatId: string, message: Message) => {
    setChats(prev => prev.map(c => chatId === c.id ? { ...c, messages: [...c.messages, message] } : c));
  };

  const deleteMessage = (chatId: string, messageId: string) => {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.filter(m => m.id !== messageId) } : c));
  };

  const toggleRoleInChat = (chatId: string, roleId: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, roleIds: c.roleIds.includes(roleId) ? c.roleIds.filter(id => id !== roleId) : [...c.roleIds, roleId] } : c));
  };

  const createNote = (folderId?: string, switchFullView: boolean = true) => {
      const newNoteId = Date.now().toString();
      const newNote: Note = { 
          id: newNoteId, 
          title: '新建笔记', 
          content: '', 
          updatedAt: Date.now(), 
          folderId: folderId || undefined 
      };
      setNotes(prev => [newNote, ...prev]);
      setActiveNoteId(newNoteId);
      setCreateMenuTarget(null);
      if (folderId) expandFolder(folderId);
      
      if (switchFullView) {
          setActiveView('notebook');
          setIsNotebookOpen(false);
      }
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
      setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n));
  };

  // 请求删除单个笔记（打开确认框）
  const requestDeleteNote = (id: string) => {
      const note = notes.find(n => n.id === id);
      setDeleteConfirmation({ id: id, type: 'note', title: note?.title || '未命名笔记' });
      setOpenMenuId(null);
  };

  // 请求批量删除笔记（打开确认框）
  const requestBatchDeleteNotes = (ids: string[]) => {
      setDeleteConfirmation({ ids: ids, type: 'notes-batch', title: `${ids.length} 篇笔记` });
  };

  const addToNotebook = (text: string, mode: 'append' | 'new' = 'append', noteId?: string) => {
      if (!text) return;

      if (mode === 'new') {
          const newNoteId = Date.now().toString();
          const firstLine = text.split('\n')[0].substring(0, 20);
          const newNote: Note = { 
              id: newNoteId, 
              title: `剪藏: ${firstLine}...`, 
              content: text, 
              updatedAt: Date.now() 
          };
          setNotes(prev => [newNote, ...prev]);
          setActiveNoteId(newNoteId);
          setIsNotebookOpen(true);
          return;
      }

      // Append mode
      let targetId = noteId || activeNoteId;
      if (!targetId && notes.length > 0) targetId = notes[0].id;
      
      if (!targetId) {
          const newNoteId = Date.now().toString();
          const newNote: Note = { id: newNoteId, title: '剪藏笔记', content: text, updatedAt: Date.now() };
          setNotes(prev => [newNote, ...prev]);
          setActiveNoteId(newNoteId);
          setIsNotebookOpen(true);
          return;
      }

      setNotes(prev => prev.map(n => {
        if (n.id === targetId) {
            let newContent = '';
            // 如果目标是当前激活的笔记，且有记录光标位置，则插入到光标处
            if (targetId === activeNoteId && noteCursorPosition !== null) {
                const cursor = noteCursorPosition;
                // 确保光标不超过当前内容长度
                const validCursor = Math.min(cursor, n.content.length);
                
                const before = n.content.substring(0, validCursor);
                const after = n.content.substring(validCursor);
                
                // 智能换行：如果前文不以换行结尾，补一个换行；如果后文不以换行开头，补一个换行
                const prefix = (validCursor > 0 && n.content[validCursor - 1] !== '\n') ? '\n' : '';
                const suffix = (validCursor < n.content.length && n.content[validCursor] !== '\n') ? '\n' : '';
                
                newContent = before + prefix + text + suffix + after;
            } else {
                // 否则追加到末尾
                newContent = n.content ? `${n.content}\n\n${text}` : text;
            }
            return { ...n, content: newContent, updatedAt: Date.now() };
        }
        return n;
      }));
      setActiveNoteId(targetId);
      setIsNotebookOpen(true);
  };

  const moveNoteToFolder = (noteId: string, folderId?: string) => {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, folderId: folderId || undefined } : n));
      setOpenMenuId(null);
  };

  const moveFolderToFolder = (folderId: string, targetParentId?: string) => {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, parentId: targetParentId || undefined } : f));
      setOpenMenuId(null);
  };

  const confirmCreateFolder = (name?: string, parentId?: string, type: 'chat' | 'note' = 'chat') => {
      const folderName = name || newFolderName;
      if (!folderName.trim()) { setIsCreatingFolder(null); return; }
      const pId = parentId !== undefined ? parentId : (isCreatingFolder === 'root' ? undefined : (isCreatingFolder || undefined));
      const newFolder: Folder = { id: Date.now().toString(), name: folderName, type: type, isExpanded: true, parentId: pId };
      setFolders(prev => [...prev, newFolder]);
      setNewFolderName('');
      setIsCreatingFolder(null);
      setCreateMenuTarget(null);
      if (pId) expandFolder(pId);
  };

  // 请求删除文件夹（打开确认框）
  const requestDeleteFolder = (folderId: string) => {
      const folder = folders.find(f => f.id === folderId);
      setDeleteConfirmation({ id: folderId, type: 'folder', title: folder?.name || '文件夹' });
  };

  const toggleFolder = (folderId: string) => {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f));
  };

  const moveChatToFolder = (chatId: string, folderId?: string) => {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, folderId: folderId || undefined } : c));
      setOpenMenuId(null);
      setDragOverFolderId(null);
  };

  // Notebook Command Management: Changed to handle update if ID exists
  const saveNotebookCommand = (command: QuickPhrase) => {
      setNotebookCommands(prev => {
          const exists = prev.find(c => c.id === command.id);
          if (exists) {
              return prev.map(c => c.id === command.id ? command : c);
          }
          return [...prev, command];
      });
  };

  const deleteNotebookCommand = (id: string) => {
      setNotebookCommands(prev => prev.filter(c => c.id !== id));
  };
  const togglePinNotebookCommand = (id: string) => {
      setNotebookCommands(prev => prev.map(c => c.id === id ? { ...c, isPinned: !c.isPinned } : c));
  };

  // 执行删除逻辑 (由 Modal 调用)
  const executeDelete = () => {
      if (!deleteConfirmation) return;
      const { id, type, ids } = deleteConfirmation;

      if (type === 'chat' && id) {
          setChats(prev => prev.filter(c => c.id !== id));
          if (activeChatId === id) setActiveChatId(null);
      } else if (type === 'role' && id) {
          setRoles(prev => prev.filter(r => r.id !== id));
      } else if (type === 'folder' && id) {
          setChats(prev => prev.map(c => c.folderId === id ? { ...c, folderId: undefined } : c));
          setNotes(prev => prev.map(n => n.folderId === id ? { ...n, folderId: undefined } : n));
          setFolders(prev => prev.filter(f => f.id !== id && f.parentId !== id));
      } else if (type === 'note' && id) {
          setNotes(prev => prev.filter(n => n.id !== id));
          if (activeNoteId === id) setActiveNoteId(null);
      } else if (type === 'notes-batch' && ids && ids.length > 0) {
          const idsSet = new Set(ids);
          setNotes(prev => prev.filter(n => !idsSet.has(n.id)));
          if (activeNoteId && idsSet.has(activeNoteId)) setActiveNoteId(null);
      }

      setDeleteConfirmation(null);
  };

  const currentChat = chats.find(c => c.id === activeChatId);
  const chatsWithoutFolder = chats.filter(c => !c.folderId);
  const chatRootFolders = folders.filter(f => !f.parentId && f.type === 'chat');
  const noteFolders = folders.filter(f => f.type === 'note');

  // 拖拽处理函数
  const handleDragStart = (e: React.DragEvent, chatId: string) => {
    e.dataTransfer.setData('chatId', chatId);
    e.dataTransfer.effectAllowed = 'move';
    const dragEl = e.currentTarget as HTMLElement;
    dragEl.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const dragEl = e.currentTarget as HTMLElement;
    dragEl.style.opacity = '1';
    setDragOverFolderId(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const handleDrop = (e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    const chatId = e.dataTransfer.getData('chatId');
    if (chatId) {
      moveChatToFolder(chatId, folderId);
    }
  };

  const DeleteConfirmModal = () => {
    if (!deleteConfirmation) return null;
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDeleteConfirmation(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                        <Trash2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-900">确认删除？</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            确定要删除 {deleteConfirmation.type === 'chat' ? '会话' : deleteConfirmation.type === 'folder' ? '文件夹' : deleteConfirmation.type === 'role' ? '角色' : '内容'} "{deleteConfirmation.title}" 吗？
                        </p>
                        {deleteConfirmation.type === 'folder' && (
                            <p className="text-xs text-red-400 mt-2 bg-red-50 py-1 px-2 rounded">
                                文件夹内的内容将移至未归类
                            </p>
                        )}
                         {deleteConfirmation.type === 'chat' && (
                            <p className="text-xs text-red-400 mt-2 bg-red-50 py-1 px-2 rounded">
                                删除后无法恢复
                            </p>
                        )}
                        {deleteConfirmation.type === 'notes-batch' && (
                            <p className="text-xs text-red-400 mt-2 bg-red-50 py-1 px-2 rounded">
                                选中的 {deleteConfirmation.ids?.length} 篇笔记将被永久删除
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3 w-full mt-2">
                        <button 
                            onClick={() => setDeleteConfirmation(null)} 
                            className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            取消
                        </button>
                        <button 
                            onClick={executeDelete}
                            className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                        >
                            确认删除
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const CreateMenu = ({ onChat, onFolder }: { onChat: () => void, onFolder: () => void }) => (
    <div 
        className="popup-menu absolute right-0 top-full w-48 z-50 pt-2" 
        onMouseEnter={clearCreateTimer}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 animate-in zoom-in-95 duration-100 overflow-hidden">
        <div className="px-3 py-1 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 border-b border-gray-50 pb-1.5">新建内容</div>
        <button onClick={(e) => { e.stopPropagation(); onChat(); }} className="w-full text-left px-3 py-2.5 text-xs hover:bg-indigo-50 text-gray-600 flex items-center gap-2 font-black transition-colors"><MessageSquare size={14} className="text-indigo-500" /> 新建会话</button>
        <button onClick={(e) => { e.stopPropagation(); onFolder(); }} className="w-full text-left px-3 py-2.5 text-xs hover:bg-indigo-50 text-gray-600 flex items-center gap-2 font-black transition-colors"><FolderIcon size={14} className="text-blue-500" /> 新建文件夹</button>
      </div>
    </div>
  );

  const renderFolder = (folder: Folder) => (
    <div key={folder.id} className="mb-2">
        <div 
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => handleDrop(e, folder.id)}
          className={`flex items-center group px-2 py-1.5 rounded-lg cursor-pointer select-none transition-all ${dragOverFolderId === folder.id ? 'bg-indigo-600 text-white scale-105 shadow-lg' : 'hover:bg-white hover:shadow-sm'}`}
        >
            <button onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id); }} className={`mr-1 p-1 transition-colors ${dragOverFolderId === folder.id ? 'text-white' : 'text-gray-400 hover:text-indigo-600'}`}>{folder.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
            <div onClick={() => toggleFolder(folder.id)} className={`flex-1 flex items-center gap-2 text-sm font-medium ${dragOverFolderId === folder.id ? 'text-white' : 'text-gray-700'}`}>
                <FolderIcon size={14} className={`transition-colors ${dragOverFolderId === folder.id ? 'text-white fill-indigo-400' : (folder.isExpanded ? 'text-indigo-600 fill-indigo-100' : 'text-gray-400')}`} />
                <span className="truncate">{folder.name}</span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative" onMouseLeave={handleCreateLeave}>
                    <button 
                        onMouseEnter={(e) => { e.stopPropagation(); clearCreateTimer(); setCreateMenuTarget(folder.id); }} 
                        onClick={(e) => { e.stopPropagation(); setCreateMenuTarget(createMenuTarget === folder.id ? null : folder.id); }} 
                        className={`menu-trigger p-1.5 rounded transition-colors ${dragOverFolderId === folder.id ? 'hover:bg-indigo-500 text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-indigo-600'} ${createMenuTarget === folder.id ? 'text-indigo-600 bg-gray-100' : ''}`}
                    ><Plus size={14} /></button>
                    {createMenuTarget === folder.id && (
                        <CreateMenu onChat={() => startNewChat(folder.id)} onFolder={() => { setIsCreatingFolder(folder.id); setCreateMenuTarget(null); }} />
                    )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); requestDeleteFolder(folder.id); }} className={`p-1.5 rounded transition-colors ${dragOverFolderId === folder.id ? 'hover:bg-red-400 text-white' : 'hover:bg-red-50 text-gray-300 hover:text-red-500'}`} title="删除文件夹"><Trash2 size={14} /></button>
            </div>
        </div>
        {folder.isExpanded && (
            <div className="ml-3 pl-3 border-l-2 border-gray-200/50 space-y-1 mt-1">
                {isCreatingFolder === folder.id && (
                    <div className="px-2 mb-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-indigo-200 shadow-sm">
                            <FolderIcon size={14} className="text-indigo-400" />
                            <input autoFocus type="text" className="flex-1 bg-transparent text-sm outline-none min-w-0" placeholder="名称..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') confirmCreateFolder(undefined, undefined, 'chat'); if(e.key === 'Escape') setIsCreatingFolder(null); }} />
                            <button onClick={(e) => { e.stopPropagation(); confirmCreateFolder(undefined, undefined, 'chat'); }} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                        </div>
                    </div>
                )}
                {chats.filter(c => c.folderId === folder.id).map(chat => (
                    <div 
                      key={chat.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, chat.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => { setActiveChatId(chat.id); setActiveView('chat'); }} 
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${activeChatId === chat.id && activeView === 'chat' ? 'bg-white shadow-sm text-indigo-700 font-bold' : 'text-gray-500 hover:bg-white hover:shadow-sm'}`}
                    >
                        <div className="flex items-center gap-2 overflow-hidden"><MessageSquare size={12} className={activeChatId === chat.id ? 'text-indigo-500' : 'text-gray-300 flex-shrink-0'} /><span className="truncate">{chat.name}</span></div>
                        <div className="relative" onMouseLeave={handleMenuLeave}>
                          <button 
                            onMouseEnter={(e) => { e.stopPropagation(); clearMenuTimer(); setOpenMenuId(chat.id); }}
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === chat.id ? null : chat.id); }} 
                            className={`menu-trigger p-1.5 rounded transition-opacity ${openMenuId === chat.id ? 'opacity-100 bg-gray-100 text-gray-800' : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600'}`}
                          ><MoreVertical size={12} /></button>
                          {openMenuId === chat.id && (
                              <div className="popup-menu absolute right-0 top-6 w-40 z-[60] pt-2" onMouseEnter={clearMenuTimer}>
                                <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden py-1 animate-in zoom-in-95 duration-100">
                                  <button onClick={(e) => { e.stopPropagation(); moveChatToFolder(chat.id, undefined); }} className="w-full text-left px-3 py-2.5 text-xs hover:bg-indigo-50 text-gray-600 flex items-center gap-2 font-black"><LayoutGrid size={12} /> 移出文件夹</button>
                                  <div className="h-px bg-gray-100 my-1"></div>
                                  <button onClick={(e) => { e.stopPropagation(); requestDeleteChat(chat.id); }} className="w-full text-left px-3 py-3 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2 font-black"><Trash2 size={12} /> 删除会话</button>
                                </div>
                              </div>
                          )}
                        </div>
                    </div>
                ))}
                {folders.filter(f => f.parentId === folder.id && f.type === 'chat').map(f => renderFolder(f))}
            </div>
        )}
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden relative">
      <DeleteConfirmModal />

      <button onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(!isSidebarOpen); }} className={`absolute top-4 z-50 p-2 rounded-lg transition-all duration-300 shadow-sm border ${isSidebarOpen ? 'left-4 bg-transparent border-transparent text-gray-500 hover:bg-200' : 'left-4 bg-white border-gray-200 text-indigo-600 hover:bg-indigo-50'}`} title={isSidebarOpen ? "关闭侧边栏" : "打开侧边栏"}><PanelLeft size={20} /></button>
      
      <div className={`bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0'}`}>
        {/* Logo Clickable Area - Returns to Chat View */}
        <div 
            onClick={() => setActiveView('chat')}
            className="p-6 pl-14 cursor-pointer hover:bg-gray-100/50 transition-colors group"
        >
            <div className="whitespace-nowrap">
                <h1 className="text-2xl font-black text-indigo-700 tracking-tight flex items-center gap-2 group-hover:scale-105 transition-transform"><LayoutGrid className="w-6 h-6" />结晶 AI</h1>
                <p className="text-xs text-gray-500 mt-1 ml-8">思有所成</p>
            </div>
        </div>
        
        <div className="px-4 space-y-1">
          <button onClick={() => setActiveView('roles')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${activeView === 'roles' ? 'text-indigo-700 font-bold bg-white shadow-sm' : 'text-gray-600 hover:bg-gray-100/50'}`}><Users size={18} className={activeView === 'roles' ? 'text-indigo-600' : 'text-gray-400'} /><span>角色库</span></button>
          <button onClick={() => { setActiveView('notebook'); setActiveNoteId(null); setIsNotebookOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${activeView === 'notebook' ? 'text-indigo-700 font-bold bg-white shadow-sm' : 'text-gray-600 hover:bg-gray-100/50'}`}><Book size={18} className={activeView === 'notebook' ? 'text-indigo-600' : 'text-gray-400'} /><span>笔记本</span></button>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto px-3 pb-4" onDragOver={(e) => e.preventDefault()}>
          <div className="flex items-center justify-between px-2 mb-2 text-sm font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
            <span>工作空间</span>
            <div className="relative" onMouseLeave={handleCreateLeave}>
              <button 
                onMouseEnter={() => { clearCreateTimer(); setCreateMenuTarget('root'); }}
                onClick={(e) => { e.stopPropagation(); setCreateMenuTarget(createMenuTarget === 'root' ? null : 'root'); }} 
                className={`menu-trigger p-1.5 rounded transition-all ${createMenuTarget === 'root' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-gray-200 text-gray-500 hover:text-indigo-600'}`}
              ><Plus size={18} /></button>
              {createMenuTarget === 'root' && (
                <CreateMenu onChat={() => startNewChat()} onFolder={() => { setIsCreatingFolder('root'); setCreateMenuTarget(null); }} />
              )}
            </div>
          </div>
          
          {isCreatingFolder === 'root' && (
            <div className="px-2 mb-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-indigo-200 shadow-sm">
                    <FolderIcon size={16} className="text-indigo-400" />
                    <input autoFocus type="text" className="flex-1 bg-transparent text-sm outline-none min-w-0" placeholder="目录名称..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') confirmCreateFolder(undefined, undefined, 'chat'); if(e.key === 'Escape') setIsCreatingFolder(null); }} />
                    <button onClick={(e) => { e.stopPropagation(); confirmCreateFolder(undefined, undefined, 'chat'); }} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                </div>
            </div>
          )}
          
          {chatRootFolders.map(folder => renderFolder(folder))}

          <div 
            className="space-y-1 mt-3 pt-2 border-t border-dashed border-gray-200"
            onDragOver={(e) => handleDragOver(e, 'uncategorized')}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => handleDrop(e, undefined)}
          >
            <div className={`px-2 mb-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${dragOverFolderId === 'uncategorized' ? 'text-indigo-600 bg-indigo-50 py-1 rounded' : 'text-gray-400'}`}>
              未归类会话 {dragOverFolderId === 'uncategorized' && ' (释放移出)'}
            </div>
            {chatsWithoutFolder.map(chat => (
              <div 
                key={chat.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, chat.id)}
                onDragEnd={handleDragEnd}
                onClick={() => { setActiveChatId(chat.id); setActiveView('chat'); }} 
                className={`group relative flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all whitespace-nowrap ${activeChatId === chat.id && activeView === 'chat' ? 'bg-white shadow-md border border-gray-100 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-white hover:shadow-sm'}`}
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1"><MessageSquare size={18} className={`flex-shrink-0 ${activeChatId === chat.id ? 'text-indigo-600' : 'text-gray-300'}`} /><span className="truncate text-sm font-medium">{chat.name}</span></div>
                <div className="relative" onMouseLeave={handleMenuLeave}>
                  <button 
                    onMouseEnter={(e) => { e.stopPropagation(); clearMenuTimer(); setOpenMenuId(chat.id); }}
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === chat.id ? null : chat.id); }} 
                    className={`menu-trigger p-1.5 rounded transition-opacity ${openMenuId === chat.id ? 'opacity-100 bg-gray-100 text-gray-800' : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600'}`}
                  ><MoreVertical size={14} /></button>
                  {openMenuId === chat.id && (
                    <div className="popup-menu absolute right-4 top-8 w-44 z-[60] pt-2" onMouseEnter={clearMenuTimer}>
                      <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden py-1 animate-in zoom-in-95 duration-100">
                        <div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider font-black bg-gray-50/50">移动到...</div>
                        <div className="max-h-32 overflow-y-auto">
                            {folders.filter(f => f.type === 'chat').map(f => (<button key={f.id} onClick={(e) => { e.stopPropagation(); moveChatToFolder(chat.id, f.id); }} className="w-full text-left px-3 py-2.5 text-xs hover:bg-indigo-50 text-gray-600 truncate flex items-center gap-2 font-black"><FolderIcon size={12} /> {f.name}</button>))}
                        </div>
                        <div className="h-px bg-gray-100 my-1"></div>
                        <button onClick={(e) => { e.stopPropagation(); requestDeleteChat(chat.id); }} className="w-full text-left px-3 py-3 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2 font-black"><Trash2 size={12} /> 删除会话</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`flex-1 flex flex-col h-full bg-white relative overflow-hidden transition-all duration-300 ${isNotebookOpen ? 'mr-96' : ''}`}>
        {activeView === 'roles' && (<main className="flex-1 p-8 h-full overflow-hidden pt-16"><RoleManager roles={roles} onAddRole={addRole} onDeleteRole={(id) => deleteRole(id)} onUpdateRole={updateRole} /></main>)}
        {activeView === 'notebook' && (
            <main className="flex-1 h-full relative">
                <NotebookFullView notes={notes} folders={noteFolders} activeNoteId={activeNoteId} onSetActiveNote={setActiveNoteId} onCreateNote={(fid) => createNote(fid, false)} onUpdateNote={updateNote} onDeleteNote={requestDeleteNote} onBatchDeleteNotes={requestBatchDeleteNotes} onMoveToFolder={moveNoteToFolder} onMoveFolder={moveFolderToFolder} onCreateFolder={(name, pid) => confirmCreateFolder(name, pid, 'note')} onDeleteFolder={requestDeleteFolder} onUpdateFolder={(id, name) => setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f))} onCursorChange={setNoteCursorPosition} 
                notebookCommands={notebookCommands} onSaveCommand={saveNotebookCommand} onDeleteCommand={deleteNotebookCommand} onTogglePinCommand={togglePinNotebookCommand}
                />
            </main>
        )}
        {activeView === 'chat' && currentChat && (<main className="flex-1 h-full relative"><ChatInterface chat={currentChat} allRoles={roles} allChats={chats} notes={notes} activeNoteId={activeNoteId} onAddMessage={addMessageToChat} onDeleteMessage={deleteMessage} onToggleRole={toggleRoleInChat} onUpdateChatName={updateChatName} onAddToNotebook={addToNotebook} onSyncMessages={handleSyncMessages} currentUserId="user" isNotebookOpen={isNotebookOpen} onToggleNotebook={() => setIsNotebookOpen(!isNotebookOpen)} onNavigateToChat={navigateToChat} /></main>)}
        {activeView === 'chat' && !currentChat && (<div className="flex-1 flex flex-col items-center justify-center text-gray-300"><MessageSquare size={64} className="mb-4 text-gray-200" /><p className="text-lg font-medium text-gray-400">选择或创建一个项目会话</p><button onClick={(e) => { e.stopPropagation(); startNewChat(); }} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium">创建新会话</button></div>)}
      </div>

      <NotebookPanel isOpen={isNotebookOpen} onClose={() => setIsNotebookOpen(false)} notes={notes} activeNoteId={activeNoteId} onSetActiveNote={setActiveNoteId} onCreateNote={() => createNote(undefined, false)} onUpdateNote={updateNote} onDeleteNote={requestDeleteNote} onCursorChange={setNoteCursorPosition} 
      notebookCommands={notebookCommands} onSaveCommand={saveNotebookCommand} onDeleteCommand={deleteNotebookCommand} onTogglePinCommand={togglePinNotebookCommand}
      />
    </div>
  );
};

export default App;
