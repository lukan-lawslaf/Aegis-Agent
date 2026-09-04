import React from 'react';
import { FiTrash2, FiBookmark, FiClock } from 'react-icons/fi';
import { t } from '@extension/i18n';

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

interface ChatHistoryListProps {
  sessions: ChatSession[];
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionBookmark: (sessionId: string) => void;
  visible: boolean;
  isDarkMode?: boolean;
}

const ChatHistoryList: React.FC<ChatHistoryListProps> = ({
  sessions,
  onSessionSelect,
  onSessionDelete,
  onSessionBookmark,
  visible,
}) => {
  if (!visible) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <FiClock className="text-tertiary" size={13} />
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-tertiary">
          {t('chat_history_title')}
        </h2>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-subtle p-8 text-center font-mono text-[11px] text-tertiary">
          {t('chat_history_empty')}
        </div>
      ) : (
        <div className="frame-outer">
          <div className="frame-inner">
            {sessions.map((session, idx) => (
              <div
                key={session.id}
                className={`group relative flex items-center gap-2 px-3 py-2 hover:bg-subtle ${
                  idx < sessions.length - 1 ? 'border-b border-subtle' : ''
                }`}>
                <button
                  onClick={() => onSessionSelect(session.id)}
                  className="w-full cursor-pointer text-left pr-14 focus:outline-hidden"
                  type="button">
                  <span className="block truncate text-xs text-primary">{session.title}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-tertiary">
                    {formatDate(session.createdAt)}
                  </span>
                </button>

                {/* Bookmark button */}
                {onSessionBookmark && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSessionBookmark(session.id);
                    }}
                    className="absolute right-8 top-2.5 cursor-pointer rounded-md p-1 text-tertiary opacity-0 transition-opacity hover:bg-elevated hover:text-accent group-hover:opacity-100"
                    aria-label={t('chat_history_bookmark')}
                    title="Bookmark session"
                    type="button">
                    <FiBookmark size={13} />
                  </button>
                )}

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSessionDelete(session.id);
                  }}
                  className="absolute right-2.5 top-2.5 cursor-pointer rounded-md p-1 text-tertiary opacity-0 transition-opacity hover:bg-elevated hover:text-danger group-hover:opacity-100"
                  aria-label={t('chat_history_delete')}
                  title="Delete session"
                  type="button">
                  <FiTrash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHistoryList;
