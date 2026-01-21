
export interface Role {
  id: string;
  name: string;
  systemInstruction: string;
  avatar: string; // URL
  description: string;
  isBuiltIn?: boolean;
}

export interface SyncMetadata {
  sourceChatId: string;
  sourceChatName: string;
  targetChatId: string;
  targetChatName: string;
  messageIds: string[];
  type: 'sent' | 'received';
}

export interface Attachment {
  id: string;
  type: 'image';
  mimeType: string;
  data: string; // Base64 string (raw)
  url: string; // Data URL for display (data:image/...)
  name: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string; // 'user' or roleId
  senderName: string;
  text: string;
  timestamp: number;
  type: 'user' | 'ai' | 'system' | 'sync'; 
  mentions?: string[]; // Array of roleIds mentioned
  syncMetadata?: SyncMetadata; // 同步元数据
  attachments?: Attachment[]; // 图片等附件
}

export interface Chat {
  id: string;
  name: string;
  roleIds: string[]; // Active members (Auto-reply in broadcast)
  messages: Message[];
  createdAt: number;
  folderId?: string; // Optional: ID of the folder this chat belongs to
}

export interface Folder {
  id: string;
  name: string;
  type: 'chat' | 'note'; // 区分文件夹用途
  isExpanded: boolean;
  parentId?: string; // Optional: ID of the parent folder
}

export interface Note {
    id: string;
    title: string;
    content: string;
    updatedAt: number;
    folderId?: string; // Optional: ID of the folder this note belongs to
}

export interface QuickPhrase {
  id: string;
  text: string;
  label?: string; // 用于笔记本指令的简短显示名称
  isPinned: boolean;
}
