import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FiSquare, FiPaperclip, FiX, FiArrowUp } from 'react-icons/fi';
import { FaMicrophone } from 'react-icons/fa';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

interface TaskAreaProps {
  onSendMessage: (text: string, displayText?: string) => void;
  onStopTask: () => void;
  onMicClick?: () => void;
  isRecording?: boolean;
  isProcessingSpeech?: boolean;
  disabled: boolean;
  showStopButton: boolean;
  setContent?: (setter: (text: string) => void) => void;
  isDarkMode?: boolean;
  historicalSessionId?: string | null;
  onReplay?: (sessionId: string) => void;
}

interface AttachedFile {
  name: string;
  content: string;
  type: string;
}

export function TaskArea({
  onSendMessage,
  onStopTask,
  onMicClick,
  isRecording = false,
  isProcessingSpeech = false,
  disabled,
  showStopButton,
  setContent,
}: TaskAreaProps) {
  const [text, setText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSendButtonDisabled = useMemo(
    () => disabled || (text.trim() === '' && attachedFiles.length === 0),
    [disabled, text, attachedFiles],
  );

  // Handle textarea auto-resize
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
    }
  };

  useEffect(() => {
    if (setContent) {
      setContent(setText);
    }
  }, [setContent]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
    }
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmedText = text.trim();

      if (trimmedText || attachedFiles.length > 0) {
        let messageContent = trimmedText;
        let displayContent = trimmedText;

        if (attachedFiles.length > 0) {
          const fileContents = attachedFiles
            .map(
              (file) =>
                `\n\n<nano_file_content type="file" name="${file.name}">\n${file.content}\n</nano_file_content>`,
            )
            .join('\n');

          messageContent = trimmedText
            ? `${trimmedText}\n\n<nano_attached_files>${fileContents}</nano_attached_files>`
            : `<nano_attached_files>${fileContents}</nano_attached_files>`;

          const fileList = attachedFiles.map((file) => `📎 ${file.name}`).join('\n');
          displayContent = trimmedText ? `${trimmedText}\n\n${fileList}` : fileList;
        }

        onSendMessage(messageContent, displayContent);
        setText('');
        setAttachedFiles([]);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    },
    [text, attachedFiles, onSendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachedFile[] = [];
    const allowedTypes = ['.txt', '.md', '.markdown', '.json', '.csv', '.log', '.xml', '.yaml', '.yml'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!allowedTypes.includes(fileExt) || file.size > 1024 * 1024) {
        continue;
      }

      try {
        const content = await file.text();
        newFiles.push({
          name: file.name,
          content,
          type: file.type || 'text/plain',
        });
      } catch (error) {
        console.error('File reading error:', error);
      }
    }

    if (newFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Main Task Input — terminal prompt in dark, paper note in light */}
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-subtle bg-surface focus-within:border-strong"
        aria-label="Aegis Task Input">
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-subtle bg-subtle p-2 text-xs">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 rounded-md border border-subtle bg-surface px-2 py-0.5 font-mono text-[11px] text-secondary">
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="cursor-pointer p-0.5 text-tertiary hover:text-danger">
                  <FiX size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input Area with prompt glyph */}
        <div className="flex items-start gap-2 p-2.5">
          <span className="select-none pt-0.5 font-mono text-sm text-tertiary">$</span>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="describe a task for this page…"
            rows={2}
            className="w-full resize-none bg-transparent font-mono text-[13px] leading-relaxed text-primary placeholder:text-tertiary focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Task Prompt Input"
          />
        </div>

        {/* Bottom Toolbar & Action Buttons */}
        <div className="flex items-center justify-between border-t border-subtle px-2.5 py-1.5">
          <div className="flex items-center gap-0.5">
            {/* File attachment */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".txt,.md,.markdown,.json,.csv,.log,.xml,.yaml,.yml"
              className="hidden"
            />
            <button
              type="button"
              onClick={handleFileSelect}
              disabled={disabled}
              title="Attach text or data file"
              className="cursor-pointer rounded-md p-1.5 text-tertiary hover:bg-elevated hover:text-secondary disabled:opacity-40"
              aria-label="Attach File">
              <FiPaperclip size={15} />
            </button>

            {/* Speech-to-text Microphone */}
            {onMicClick && (
              <button
                type="button"
                onClick={onMicClick}
                disabled={disabled && !isRecording}
                title={isRecording ? 'Stop Recording' : 'Voice Input'}
                className={`cursor-pointer rounded-md p-1.5 transition-colors ${
                  isRecording
                    ? 'bg-danger-soft text-danger'
                    : 'text-tertiary hover:bg-elevated hover:text-secondary'
                }`}
                aria-label="Voice Input">
                {isProcessingSpeech ? (
                  <AiOutlineLoading3Quarters size={15} className="animate-spin text-accent" />
                ) : (
                  <FaMicrophone size={14} />
                )}
              </button>
            )}
          </div>

          {/* Right Action: Send or Stop */}
          <div className="flex items-center gap-1.5">
            {showStopButton ? (
              <button
                type="button"
                onClick={onStopTask}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-danger px-2.5 py-1 font-mono text-[11px] font-semibold text-danger hover:bg-danger-soft"
                aria-label="Stop Task">
                <FiSquare size={10} className="fill-current" />
                <span>stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSendButtonDisabled}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1 font-mono text-[11px] font-semibold text-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Start Task">
                <span>run</span>
                <FiArrowUp size={12} className="stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

export default TaskArea;
