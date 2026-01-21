
import React from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = React.memo(({ content, className = '' }) => {
  const processText = (input: string) => {
    const lines = input.split('\n');
    return lines.map((line, idx) => {
      // Handle Instructions Styling (Green Comments)
      if (line.trim().startsWith('// AI:')) {
        return (
          <div key={idx} className="text-green-600 font-mono italic text-sm my-1 bg-green-50/50 px-2 rounded border-l-2 border-green-300">
            {line}
          </div>
        );
      }

      // Headers
      if (line.startsWith('# ')) return <h1 key={idx} className="text-2xl font-black mt-4 mb-2">{line.substring(2)}</h1>;
      if (line.startsWith('## ')) return <h2 key={idx} className="text-xl font-bold mt-4 mb-2">{line.substring(3)}</h2>;
      if (line.startsWith('### ')) return <h3 key={idx} className="text-lg font-bold mt-3 mb-1">{line.substring(4)}</h3>;

      // Lists
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemContent = line.trim().substring(2);
        return (
          <li key={idx} className="ml-4 list-disc pl-1 mb-1 text-sm leading-relaxed">
            <span dangerouslySetInnerHTML={{ __html: formatInline(itemContent) }} />
          </li>
        );
      }

      if (/^\d+\.\s/.test(line.trim())) {
        const itemContent = line.trim().replace(/^\d+\.\s/, '');
        return (
          <li key={idx} className="ml-4 list-decimal pl-1 mb-1 text-sm leading-relaxed">
            <span dangerouslySetInnerHTML={{ __html: formatInline(itemContent) }} />
          </li>
        );
      }

      // Empty Lines
      if (!line.trim()) return <div key={idx} className="h-3" />;

      // Normal Text
      return (
        <p key={idx} className="mb-2 last:mb-0 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
    });
  };

  const formatInline = (str: string) => {
    let formatted = str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-red-500 font-mono text-xs border border-gray-200">$1</code>'); // Inline Code
    return formatted;
  };

  return <div className={`markdown-body ${className}`}>{processText(content)}</div>;
});