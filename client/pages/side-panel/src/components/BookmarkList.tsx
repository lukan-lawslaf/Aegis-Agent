import React, { useState, useRef, useEffect } from 'react';
import { FiTrash2, FiEdit2, FiCheck, FiX, FiBookmark } from 'react-icons/fi';

interface Bookmark {
  id: number;
  title: string;
  content: string;
}

interface BookmarkListProps {
  bookmarks: Bookmark[];
  onBookmarkSelect: (content: string) => void;
  onBookmarkUpdateTitle?: (id: number, title: string) => void;
  onBookmarkDelete?: (id: number) => void;
  onBookmarkReorder?: (draggedId: number, targetId: number) => void;
  isDarkMode?: boolean;
}

export const BookmarkList: React.FC<BookmarkListProps> = ({
  bookmarks,
  onBookmarkSelect,
  onBookmarkUpdateTitle,
  onBookmarkDelete,
  onBookmarkReorder,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEditClick = (bookmark: Bookmark) => {
    setEditingId(bookmark.id);
    setEditTitle(bookmark.title);
  };

  const handleSaveEdit = (id: number) => {
    if (onBookmarkUpdateTitle && editTitle.trim()) {
      onBookmarkUpdateTitle(id, editTitle);
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id.toString());
    e.currentTarget.classList.add('opacity-40');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-40');
    setDraggedId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedId === null || draggedId === targetId) return;

    if (onBookmarkReorder) {
      onBookmarkReorder(draggedId, targetId);
    }
  };

  useEffect(() => {
    if (editingId !== null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  if (bookmarks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center gap-1.5 px-1">
        <FiBookmark className="text-tertiary" size={12} />
        <span className="font-mono text-[11px] uppercase tracking-wider text-tertiary">
          saved templates
        </span>
      </div>
      <div className="frame-outer">
        <div className="frame-inner">
          {bookmarks.map((bookmark, idx) => (
            <div
              key={bookmark.id}
              draggable={editingId !== bookmark.id}
              onDragStart={(e) => handleDragStart(e, bookmark.id)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, bookmark.id)}
              className={`group relative px-3 py-2 hover:bg-subtle ${
                idx < bookmarks.length - 1 ? 'border-b border-subtle' : ''
              }`}>
              {editingId === bookmark.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="grow rounded-md border border-strong bg-surface px-2 py-1 text-xs text-primary focus:border-accent focus:outline-hidden"
                  />
                  <button
                    onClick={() => handleSaveEdit(bookmark.id)}
                    className="cursor-pointer rounded-md p-1.5 text-ok hover:bg-ok-soft"
                    aria-label="Save Title"
                    type="button">
                    <FiCheck size={13} />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="cursor-pointer rounded-md p-1.5 text-danger hover:bg-danger-soft"
                    aria-label="Cancel Edit"
                    type="button">
                    <FiX size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onBookmarkSelect(bookmark.content)}
                  className="w-full cursor-pointer text-left pr-14 focus:outline-hidden">
                  <div className="truncate text-xs text-primary">{bookmark.title}</div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-tertiary">{bookmark.content}</div>
                </button>
              )}

              {editingId !== bookmark.id && (
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(bookmark);
                    }}
                    className="cursor-pointer rounded-md p-1.5 text-tertiary hover:bg-elevated hover:text-accent"
                    aria-label="Edit Title"
                    title="Edit title"
                    type="button">
                    <FiEdit2 size={12} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onBookmarkDelete) {
                        onBookmarkDelete(bookmark.id);
                      }
                    }}
                    className="cursor-pointer rounded-md p-1.5 text-tertiary hover:bg-elevated hover:text-danger"
                    aria-label="Delete Template"
                    title="Delete template"
                    type="button">
                    <FiTrash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BookmarkList;
