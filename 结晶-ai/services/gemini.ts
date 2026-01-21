
import { GoogleGenAI } from "@google/genai";
import { Message, Role, Attachment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Filter messages that a specific AI is allowed to see based on the "Context Pollution" rules
export const generateAIResponse = async (
  role: Role,
  history: Message[],
  userPrompt: string,
  currentAttachments: Attachment[] = []
): Promise<string> => {
  
  try {
    const formattedHistory = history.map((msg) => {
      // Map 'system' messages to 'user' role so the model sees them as context/instructions
      const role = msg.senderId === 'user' || msg.type === 'system' ? 'user' : 'model';
      
      let parts: any[] = [];
      
      // Add text part (add sender name for multi-role context if not user)
      const textContent = msg.senderId !== 'user' && msg.type !== 'system' 
        ? `[${msg.senderName}]: ${msg.text}` 
        : msg.text;
        
      if (textContent) {
        parts.push({ text: textContent });
      }

      // Add attachment parts (Images)
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach(att => {
            if (att.type === 'image') {
                parts.push({
                    inlineData: {
                        mimeType: att.mimeType,
                        data: att.data
                    }
                });
            }
        });
      }

      return {
        role: role,
        parts: parts,
      };
    });

    // Construct the current user turn parts
    const currentParts: any[] = [{ text: userPrompt }];
    
    if (currentAttachments && currentAttachments.length > 0) {
        currentAttachments.forEach(att => {
             if (att.type === 'image') {
                currentParts.push({
                    inlineData: {
                        mimeType: att.mimeType,
                        data: att.data
                    }
                });
            }
        });
    }

    // Add the new user prompt
    const finalContents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: currentParts,
      },
    ];

    // Use 'gemini-3-flash-preview' for basic text response tasks with Search enabled
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: finalContents,
      config: {
        systemInstruction: role.systemInstruction,
        temperature: 0.7,
        tools: [{ googleSearch: {} }], // Enable Google Search for external link reading
      },
    });

    let finalText = response.text || "我无法生成回复。";

    // DO extract the URLs from groundingChunks and list them as required by guidelines
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks && groundingChunks.length > 0) {
      const sourceLinks = groundingChunks
        .map((chunk: any) => chunk.web)
        .filter((web: any) => web && web.uri && web.title);
      
      if (sourceLinks.length > 0) {
        // Remove duplicates based on URI
        const uniqueLinks = Array.from(new Map(sourceLinks.map((l: any) => [l.uri, l])).values());
        const citationText = uniqueLinks
          .map((link: any) => `* [${link.title}](${link.uri})`)
          .join('\n');
        finalText += `\n\n**资料来源:**\n${citationText}`;
      }
    }

    return finalText;
  } catch (error) {
    console.error(`Error generating response for ${role.name}:`, error);
    return `[系统错误]: ${role.name} 暂时不可用，或者无法访问该链接内容。`;
  }
};

export const organizeNote = async (content: string): Promise<string> => {
    try {
        const prompt = `你是一位专业的编辑和组织者。
        
        用户提供了一些笔记，其中包含标记为 "[AI指令: ...]" 或 "// AI:" 的行内指令。
        这些指令是关于如何处理其周围文本（通常是紧随其后的文本）的特殊 tasks。
        
        你的任务：
        1. 解析以下内容。
        2. 识别以 "[AI指令: " 或 "// AI:" 开头的指令行。
        3. 执行这些指令（例如：“总结”、“合并”、“格式化为表格”、“翻译”）。
        4. 如果某些部分没有指令，请逻辑化地组织它们以提高可读性。
        5. 重要提示：在输出中删除所有指令标记（包括方括号和前缀）。请使用中文输出。
        
        待整理的内容：
        ${content}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        return response.text || content;
    } catch (error) {
        console.error("Error organizing note:", error);
        return content;
    }
}
