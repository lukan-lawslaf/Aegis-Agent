import React from 'react';
import { FiSearch, FiDollarSign, FiFileText, FiFilter } from 'react-icons/fi';

interface StickerChipsProps {
  onSelect: (text: string) => void;
}

const suggestions = [
  { label: 'Find contact email', icon: FiSearch, rotate: 'sticker-rotate-1', accent: '#5ec6a8' },
  { label: 'Open pricing details', icon: FiDollarSign, rotate: 'sticker-rotate-2', accent: '#e8c547' },
  { label: 'Summarize page safely', icon: FiFileText, rotate: 'sticker-rotate-3', accent: '#9b8ccf' },
  { label: 'Filter search results', icon: FiFilter, rotate: 'sticker-rotate-4', accent: '#e07856' },
];

/**
 * StickerChips — light-mode quick suggestions as scattered workspace stickers:
 * rotated pastel paper chips, each with its own accent edge. Dark mode uses a
 * flat mono variant (see DockFallback in SidePanel).
 */
export function StickerChips({ onSelect }: StickerChipsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {suggestions.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect(item.label)}
            className={`sticker ${item.rotate} cursor-pointer bg-surface p-2 text-left text-xs text-primary hover:border-strong`}
            style={{ borderTopColor: item.accent, borderTopWidth: 2 }}
            title={item.label}>
            <span className="flex items-center gap-1.5">
              <Icon size={13} style={{ color: item.accent }} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default StickerChips;
