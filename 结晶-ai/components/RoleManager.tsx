
import React, { useState } from 'react';
import { Role } from '../types';
import { Trash2, Plus, Edit2, Bot, AlertCircle } from 'lucide-react';
import { Avatar } from './Avatar';

interface RoleManagerProps {
  roles: Role[];
  onAddRole: (role: Role) => void;
  onDeleteRole: (roleId: string) => void;
  onUpdateRole: (role: Role) => void;
}

export const RoleManager: React.FC<RoleManagerProps> = ({ roles, onAddRole, onDeleteRole, onUpdateRole }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentRole, setCurrentRole] = useState<Partial<Role>>({});

  const isFormValid = !!(currentRole.name?.trim() && currentRole.systemInstruction?.trim());

  const handleSave = () => {
    if (!isFormValid) return;

    const roleToSave: Role = {
      id: currentRole.id || Date.now().toString(),
      name: currentRole.name!.trim(),
      description: currentRole.description?.trim() || '自定义角色',
      systemInstruction: currentRole.systemInstruction!.trim(),
      avatar: currentRole.avatar || `https://picsum.photos/seed/${Date.now()}/200/200`,
      isBuiltIn: currentRole.isBuiltIn || false,
    };

    if (currentRole.id) {
      onUpdateRole(roleToSave);
    } else {
      onAddRole(roleToSave);
    }
    setIsEditing(false);
    setCurrentRole({});
  };

  const startEdit = (role: Role) => {
    setCurrentRole(role);
    setIsEditing(true);
  };

  const startNew = () => {
    setCurrentRole({});
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
          <Bot className="w-6 h-6 text-indigo-600" />
          {currentRole.id ? '编辑角色' : '创建新角色'}
        </h2>
        
        <div className="space-y-4 flex-1 overflow-y-auto pr-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名称 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={currentRole.name || ''}
              onChange={e => setCurrentRole({...currentRole, name: e.target.value})}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${!currentRole.name?.trim() && currentRole.name !== undefined ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
              placeholder="例如：Python 专家"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <input
              type="text"
              value={currentRole.description || ''}
              onChange={e => setCurrentRole({...currentRole, description: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="简单的角色介绍"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">系统指令 (Prompt) <span className="text-red-500">*</span></label>
            <textarea
              value={currentRole.systemInstruction || ''}
              onChange={e => setCurrentRole({...currentRole, systemInstruction: e.target.value})}
              className={`w-full px-4 py-2 border rounded-lg h-64 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none font-mono text-sm ${!currentRole.systemInstruction?.trim() && currentRole.systemInstruction !== undefined ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
              placeholder="定义 AI 的行为逻辑，例如：'你是一位严谨的科学家，说话风格简洁且充满逻辑...'"
            />
          </div>

          {!isFormValid && (currentRole.name !== undefined || currentRole.systemInstruction !== undefined) && (
            <div className="flex items-center gap-2 text-red-500 text-xs mt-2 bg-red-50 p-2 rounded-lg">
              <AlertCircle size={14} />
              <span>请填写必填项（名称和系统指令）以保存。</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button 
            onClick={() => setIsEditing(false)}
            className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={!isFormValid}
            className={`flex-1 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
              isFormValid 
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {currentRole.id ? '更新角色' : '保存角色'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 pl-2 pr-16">
        <h2 className="text-2xl font-bold text-gray-800">AI 角色库</h2>
        <button 
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-bold"
        >
          <Plus className="w-4 h-4" />
          创建角色
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4 px-2">
        {roles.map(role => (
          <div key={role.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative flex flex-col">
            <div className="flex items-start gap-4 mb-3">
              <Avatar src={role.avatar} alt={role.name} size="lg" />
              <div>
                <h3 className="font-bold text-gray-800">{role.name}</h3>
                <p className="text-xs text-indigo-600 font-medium px-2 py-0.5 bg-indigo-50 rounded-full inline-block mt-1">
                  {role.isBuiltIn ? '预设' : '自定义'}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5em]">{role.description}</p>
            
            <div className="flex justify-end gap-2 mt-auto">
              <button 
                onClick={() => startEdit(role)}
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="编辑"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteRole(role.id); }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
