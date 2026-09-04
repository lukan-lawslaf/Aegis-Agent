import React, { memo, useState } from 'react';
import type { Message } from '@extension/storage';
import { FiUser, FiCpu, FiShield, FiCheck, FiCopy, FiTerminal } from 'react-icons/fi';
import { TbShieldLock } from 'react-icons/tb';
import { ThinkingIndicator } from './ThinkingIndicator';

interface MessageListProps {
  messages: Message[];
  isDarkMode?: boolean;
}

export default memo(function MessageList({ messages }: MessageListProps) {
  return (
    <div className="max-w-full space-y-3 pb-2">
      {messages.map((message, index) => (
        <MessageBlock
          key={`${message.actor}-${message.timestamp}-${index}`}
          message={message}
          isSameActor={index > 0 ? messages[index - 1].actor === message.actor : false}
        />
      ))}
    </div>
  );
});

interface MessageBlockProps {
  message: Message;
  isSameActor: boolean;
  isDarkMode?: boolean;
}

const actorMeta: Record<string, { name: string; badge: string; color: string }> = {
  user: { name: 'you', badge: 'user', color: 'text-accent' },
  system: { name: 'aegis', badge: 'system', color: 'text-secondary' },
  planner: { name: 'planner', badge: 'qwen3-vl', color: 'text-kw' },
  navigator: { name: 'action', badge: 'executor', color: 'text-fn' },
  validator: { name: 'validator', badge: 'guard', color: 'text-const' },
  manager: { name: 'manager', badge: 'loop', color: 'text-secondary' },
  evaluator: { name: 'audit', badge: 'eval', color: 'text-secondary' },
};

const actorIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  user: FiUser,
  system: FiShield,
  planner: FiCpu,
  navigator: FiTerminal,
  validator: TbShieldLock,
  manager: FiCpu,
  evaluator: FiShield,
};

function MessageBlock({ message, isSameActor }: MessageBlockProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.actor === 'user';
  const isProgress = message.content === 'Showing progress...';

  const currentActor = actorMeta[message.actor || 'system'] || actorMeta.system;
  const Icon = actorIcons[message.actor || 'system'] || FiShield;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group max-w-full">
      {/* Actor line — mono label row, like a log header */}
      {!isSameActor && (
        <div className="mb-1 flex items-center gap-1.5">
          <Icon size={11} className={currentActor.color} />
          <span className="font-mono text-[11px] text-secondary">{currentActor.name}</span>
          <span className={`font-mono text-[10px] ${currentActor.color}`}>{currentActor.badge}</span>
          <span className="ml-auto font-mono text-[10px] text-tertiary">{formatTimestamp(message.timestamp)}</span>
        </div>
      )}

      {/* Body — user gets an accent-tinted block; machine output is flat text */}
      <div className={`pl-1 ${isUser ? '' : 'border-l border-subtle pl-3'}`}>
        {isProgress ? (
          <div className="py-1">
            <ThinkingIndicator compact />
          </div>
        ) : isUser ? (
          <div className="rounded-lg bg-accent-soft px-3 py-2 text-[13px] leading-relaxed text-primary">
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          </div>
        ) : (
          <div className="text-[13px] leading-relaxed text-secondary">
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          </div>
        )}

        {/* Copy */}
        {!isProgress && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copy text"
            className="mt-0.5 cursor-pointer p-0.5 text-tertiary opacity-0 transition-opacity hover:text-primary group-hover:opacity-100">
            {copied ? <FiCheck size={11} className="text-ok" /> : <FiCopy size={11} />}
          </button>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return timeStr;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}
