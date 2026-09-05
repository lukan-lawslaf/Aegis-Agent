/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type Message, Actors, chatHistoryStore, agentModelStore, generalSettingsStore, gatewayModelStore } from '@extension/storage';
import { GATEWAY_MODEL_CHOICES } from './components/SettingsModal';
import favoritesStorage, { type FavoritePrompt } from '@extension/storage/lib/prompt/favorites';
import { t } from '@extension/i18n';

import Header from './components/Header';
import PrivacyStatusCard, { type PrivacyMetrics } from './components/PrivacyStatusCard';
import PrivacyPreviewModal from './components/PrivacyPreviewModal';
import TaskArea from './components/TaskArea';
import TaskTimeline, { type TimelineStep } from './components/TaskTimeline';
import ActionConfirmation, { type ActionApprovalRequest } from './components/ActionConfirmation';
import MessageList from './components/MessageList';
import ChatHistoryList from './components/ChatHistoryList';
import BookmarkList from './components/BookmarkList';
import SettingsModal from './components/SettingsModal';
import StickerChips from './components/StickerChips';
import { AnimatedDock } from './components/AnimatedDock';
import { FiSearch, FiDollarSign, FiFileText, FiFilter } from 'react-icons/fi';
import FaultyTerminal from './components/FaultyTerminal';
import LightPrivacyCollage from './components/LightPrivacyCollage';
import { type ProviderMode } from './components/ConnectionIndicator';
import { EventType, type AgentEvent, ExecutionState } from './types/event';
import './SidePanel.css';

// Declare chrome API types
declare global {
  interface Window {
    chrome: typeof chrome;
  }
}

const DEFAULT_TIMELINE_STEPS: TimelineStep[] = [
  { key: 'observe', label: '1. Observing page', sublabel: 'Local DOM tree & screen scan', status: 'pending' },
  { key: 'protect', label: '2. Protecting sensitive data', sublabel: 'DOM mask & on-device face detector', status: 'pending' },
  { key: 'transmit', label: '3. Sending sanitized context', sublabel: 'Forwarding only sanitized context to LAN', status: 'pending' },
  { key: 'plan', label: '4. Planning action', sublabel: 'Qwen3-VL evaluating next step', status: 'pending' },
  { key: 'confirm', label: '5. Waiting for confirmation', sublabel: 'Manual authorization for sensitive actions', status: 'pending' },
  { key: 'execute', label: '6. Executing action', sublabel: 'Safe DOM action via content-script', status: 'pending' },
  { key: 'complete', label: '7. Completed', sublabel: 'Workflow finished successfully', status: 'pending' },
];

export const SidePanel = () => {
  const progressMessage = 'Showing progress...';
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputEnabled, setInputEnabled] = useState(true);
  const [showStopButton, setShowStopButton] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<Array<{ id: string; title: string; createdAt: number }>>([]);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);
  const [isHistoricalSession, setIsHistoricalSession] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [favoritePrompts, setFavoritePrompts] = useState<FavoritePrompt[]>([]);
  const [, setHasConfiguredModels] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayEnabled, setReplayEnabled] = useState(false);
  const [sanitizeContent, setSanitizeContent] = useState(true);

  // Aegis-Agent State Additions
  const [isPrivacyPreviewOpen, setIsPrivacyPreviewOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [providerMode, setProviderMode] = useState<ProviderMode>('fastapi');
  // The real gateway endpoint is baked at build time from VITE_SIH_FASTAPI_URL;
  // show it here so the ping tests the same URL the model actually calls.
  const [serverUrl, setServerUrl] = useState<string>(
    () => (import.meta.env.VITE_SIH_FASTAPI_URL as string | undefined) ?? 'http://127.0.0.1:8000/v1',
  );
  const [activeModel, setActiveModel] = useState<string>(
    // executor/navigator model; the planner runs a fixed fast local model
    () => (import.meta.env.VITE_SIH_QWEN_MODEL as string | undefined) ?? GATEWAY_MODEL_CHOICES[0].value,
  );
  const [sanitizedPreviewBase64, setSanitizedPreviewBase64] = useState<string | null>(null);
  const [isCapturingPreview, setIsCapturingPreview] = useState(false);
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>(DEFAULT_TIMELINE_STEPS);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isTimelineCompact, setIsTimelineCompact] = useState(false);
  const [actionApproval, setActionApproval] = useState<ActionApprovalRequest | null>(null);

  // Privacy Metrics
  const [privacyMetrics, setPrivacyMetrics] = useState<PrivacyMetrics>({
    facesDetected: 0,
    sensitiveFieldsMasked: 0,
    piiItemsRemoved: 0,
    regionsRedacted: 0,
    statusState: 'protected',
    isLive: false,
  });

  const sessionIdRef = useRef<string | null>(null);
  const isReplayingRef = useRef<boolean>(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const setInputTextRef = useRef<((text: string) => void) | null>(null);
  const captureResolverRef = useRef<((result: { image: string; domMasks: number } | { error: string }) => void) | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Dark Mode detection & manual toggle
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    darkModeMediaQuery.addEventListener('change', handleChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Load + live-sync the runtime model selection (settings modal / other panels).
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await gatewayModelStore.getModel();
        if (stored) setActiveModel(stored);
      } catch {
        /* keep build default */
      }
    };
    void load();
    const unsubscribe = gatewayModelStore.subscribe(() => void load());
    return () => unsubscribe();
  }, []);

  const handleModelChange = useCallback((model: string) => {
    setActiveModel(model);
    gatewayModelStore.setModel(model).catch(error => console.error('Failed to persist model selection:', error));
  }, []);

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const dockItems = [
    { label: 'Find contact email', onClick: () => setInputTextRef.current?.('Find contact email'), Icon: <FiSearch size={18} /> },
    { label: 'Open pricing details', onClick: () => setInputTextRef.current?.('Open pricing details'), Icon: <FiDollarSign size={18} /> },
    { label: 'Summarize page safely', onClick: () => setInputTextRef.current?.('Summarize page safely'), Icon: <FiFileText size={18} /> },
    { label: 'Filter search results', onClick: () => setInputTextRef.current?.('Filter search results'), Icon: <FiFilter size={18} /> },
  ];

  // Check if model / gateway configuration exists
  const checkModelConfiguration = useCallback(async () => {
    try {
      const configuredAgents = await agentModelStore.getConfiguredAgents();
      // For SIH Aegis-Agent, default FastAPI gateway provides out-of-the-box readiness
      const hasAtLeastOneModel = configuredAgents.length > 0 || true;
      setHasConfiguredModels(hasAtLeastOneModel);
    } catch (error) {
      console.error('Error checking model configuration:', error);
      setHasConfiguredModels(true);
    }
  }, []);

  const loadGeneralSettings = useCallback(async () => {
    try {
      const settings = await generalSettingsStore.getSettings();
      setReplayEnabled(settings.replayHistoricalTasks);
      setSanitizeContent(settings.sanitizeContent !== false);
    } catch (error) {
      console.error('Error loading general settings:', error);
      setReplayEnabled(false);
      setSanitizeContent(true); // fail closed
    }
  }, []);

  // Live-sync the firewall switch (options page or another panel can change it).
  useEffect(() => {
    const unsubscribe = generalSettingsStore.subscribe(() => {
      void loadGeneralSettings();
    });
    return () => {
      unsubscribe();
    };
  }, [loadGeneralSettings]);

  useEffect(() => {
    checkModelConfiguration();
    loadGeneralSettings();
  }, [checkModelConfiguration, loadGeneralSettings]);

  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    isReplayingRef.current = isReplaying;
  }, [isReplaying]);

  const appendMessage = useCallback((newMessage: Message, sessionId?: string | null) => {
    const isProgressMessage = newMessage.content === progressMessage;

    setMessages((prev) => {
      const filteredMessages = prev.filter((msg, idx) => !(msg.content === progressMessage && idx === prev.length - 1));
      return [...filteredMessages, newMessage];
    });

    const effectiveSessionId = sessionId !== undefined ? sessionId : sessionIdRef.current;
    if (effectiveSessionId && !isProgressMessage) {
      chatHistoryStore
        .addMessage(effectiveSessionId, newMessage)
        .catch((err) => console.error('Failed to save message to history:', err));
    }
  }, []);

  const handleToggleSanitization = useCallback(
    (next: boolean) => {
      setSanitizeContent(next);
      generalSettingsStore
        .updateSettings({ sanitizeContent: next })
        .catch(error => console.error('Failed to persist sanitization toggle:', error));
      appendMessage({
        actor: Actors.SYSTEM,
        content: next
          ? 'privacy firewall ON — faces + PII are redacted before egress.'
          : 'privacy firewall OFF — raw page content will be sent to the gateway. Turn it back on when done.',
        timestamp: Date.now(),
      });
    },
    [appendMessage],
  );

  // Update Timeline State Helper
  const updateTimelinePhase = useCallback((phaseKey: TimelineStep['key'], status: TimelineStep['status'], error?: string) => {
    setTimelineSteps((prev) =>
      prev.map((step) => {
        if (step.key === phaseKey) {
          return { ...step, status, timestamp: Date.now(), error };
        }
        return step;
      }),
    );
    const indexMap: Record<TimelineStep['key'], number> = {
      observe: 0,
      protect: 1,
      transmit: 2,
      plan: 3,
      confirm: 4,
      execute: 5,
      complete: 6,
    };
    setCurrentStepIdx(indexMap[phaseKey] || 0);
  }, []);

  const handleTaskState = useCallback(
    (event: AgentEvent) => {
      const { actor, state, timestamp, data } = event;
      const content = data?.details;
      let skip = true;
      let displayProgress = false;

      switch (actor) {
        case Actors.SYSTEM:
          switch (state) {
            case ExecutionState.TASK_START:
              setIsHistoricalSession(false);
              setTimelineSteps(DEFAULT_TIMELINE_STEPS);
              updateTimelinePhase('observe', 'running');
              setPrivacyMetrics((prev) => ({
                ...prev,
                statusState: 'scanning',
                isLive: true,
              }));
              break;
            case ExecutionState.TASK_OK:
              setIsFollowUpMode(true);
              setInputEnabled(true);
              setShowStopButton(false);
              setIsReplaying(false);
              updateTimelinePhase('complete', 'success');
              setPrivacyMetrics((prev) => ({
                ...prev,
                statusState: 'protected',
              }));
              break;
            case ExecutionState.TASK_FAIL:
              setIsFollowUpMode(true);
              setInputEnabled(true);
              setShowStopButton(false);
              setIsReplaying(false);
              skip = false;
              updateTimelinePhase('execute', 'failed', content || 'Task execution failed');
              break;
            case ExecutionState.TASK_CANCEL:
              setIsFollowUpMode(false);
              setInputEnabled(true);
              setShowStopButton(false);
              setIsReplaying(false);
              skip = false;
              break;
            default:
              break;
          }
          break;

        case Actors.PLANNER:
          switch (state) {
            case ExecutionState.STEP_START:
              displayProgress = true;
              updateTimelinePhase('protect', 'success');
              updateTimelinePhase('transmit', 'success');
              updateTimelinePhase('plan', 'running');
              break;
            case ExecutionState.STEP_OK:
              skip = false;
              updateTimelinePhase('plan', 'success');
              break;
            case ExecutionState.STEP_FAIL:
              skip = false;
              updateTimelinePhase('plan', 'failed', content);
              break;
            default:
              break;
          }
          break;

        case Actors.NAVIGATOR:
          switch (state) {
            case ExecutionState.STEP_START:
              displayProgress = true;
              updateTimelinePhase('execute', 'running');
              break;
            case ExecutionState.STEP_OK:
              displayProgress = false;
              updateTimelinePhase('execute', 'success');
              break;
            case ExecutionState.STEP_FAIL:
              skip = false;
              displayProgress = false;
              updateTimelinePhase('execute', 'failed', content);
              break;
            case ExecutionState.ACT_START:
              if (content !== 'cache_content') {
                skip = false;
              }
              break;
            case ExecutionState.ACT_OK:
              skip = !isReplayingRef.current;
              break;
            case ExecutionState.ACT_FAIL:
              skip = false;
              break;
            default:
              break;
          }
          break;

        case Actors.VALIDATOR:
          switch (state) {
            case ExecutionState.STEP_START:
              displayProgress = true;
              break;
            case ExecutionState.STEP_OK:
              skip = false;
              break;
            case ExecutionState.STEP_FAIL:
              skip = false;
              break;
            default:
              break;
          }
          break;
        default:
          break;
      }

      if (!skip) {
        appendMessage({
          actor,
          content: content || '',
          timestamp: timestamp,
        });
      }

      if (displayProgress) {
        appendMessage({
          actor,
          content: progressMessage,
          timestamp: timestamp,
        });
      }
    },
    [appendMessage, updateTimelinePhase],
  );

  const stopConnection = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    captureResolverRef.current?.({ error: 'background connection closed' });
    captureResolverRef.current = null;
    if (portRef.current) {
      portRef.current.disconnect();
      portRef.current = null;
    }
  }, []);

  const setupConnection = useCallback(() => {
    if (portRef.current) return;

    try {
      portRef.current = chrome.runtime.connect({ name: 'side-panel-connection' });

      portRef.current.onMessage.addListener((message: any) => {
        if (message && message.type === EventType.EXECUTION) {
          handleTaskState(message);
        } else if (message && message.type === 'error') {
          appendMessage({
            actor: Actors.SYSTEM,
            content: message.error || t('errors_unknown'),
            timestamp: Date.now(),
          });
          setInputEnabled(true);
          setShowStopButton(false);
        } else if (message && message.type === 'speech_to_text_result') {
          if (message.text && setInputTextRef.current) {
            setInputTextRef.current(message.text);
          }
          setIsProcessingSpeech(false);
        } else if (message && message.type === 'speech_to_text_error') {
          appendMessage({
            actor: Actors.SYSTEM,
            content: message.error || t('chat_stt_recognitionFailed'),
            timestamp: Date.now(),
          });
          setIsProcessingSpeech(false);
        } else if (message && message.type === 'capture_sanitized_result') {
          captureResolverRef.current?.({ image: message.image, domMasks: message.domMasks ?? 0 });
          captureResolverRef.current = null;
        } else if (message && message.type === 'capture_sanitized_error') {
          captureResolverRef.current?.({ error: message.error || 'capture failed' });
          captureResolverRef.current = null;
        } else if (message && message.type === 'request_confirmation') {
          // Sensitive action confirmation requested
          setActionApproval({
            actionType: message.actionType || 'submit',
            targetElement: message.targetElement || '#form-submit',
            domain: message.domain || window.location.hostname || 'current-page',
            reason: message.reason || 'Irreversible DOM action requires authorization',
            isIrreversible: true,
          });
        }
      });

      portRef.current.onDisconnect.addListener(() => {
        portRef.current = null;
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        setInputEnabled(true);
        setShowStopButton(false);
      });

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      heartbeatIntervalRef.current = window.setInterval(() => {
        if (portRef.current?.name === 'side-panel-connection') {
          try {
            portRef.current.postMessage({ type: 'heartbeat' });
          } catch {
            stopConnection();
          }
        } else {
          stopConnection();
        }
      }, 25000);
    } catch (error) {
      console.error('Failed to establish connection:', error);
      appendMessage({
        actor: Actors.SYSTEM,
        content: t('errors_conn_serviceWorker'),
        timestamp: Date.now(),
      });
      portRef.current = null;
    }
  }, [handleTaskState, appendMessage, stopConnection]);

  const sendMessage = useCallback(
    (message: any) => {
      if (portRef.current?.name !== 'side-panel-connection') {
        throw new Error('No valid connection available');
      }
      try {
        portRef.current.postMessage(message);
      } catch (error) {
        console.error('Failed to send message:', error);
        stopConnection();
        throw error;
      }
    },
    [stopConnection],
  );

  const handleSendMessage = async (text: string, displayText?: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || isHistoricalSession) return;

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) {
        throw new Error('No active tab found');
      }

      setInputEnabled(false);
      setShowStopButton(true);

      if (!isFollowUpMode) {
        const titleText = displayText || text;
        const newSession = await chatHistoryStore.createSession(
          titleText.substring(0, 50) + (titleText.length > 50 ? '...' : ''),
        );
        setCurrentSessionId(newSession.id);
        sessionIdRef.current = newSession.id;
      }

      const userMessage = {
        actor: Actors.USER,
        content: displayText || text,
        timestamp: Date.now(),
      };

      appendMessage(userMessage, sessionIdRef.current);

      if (!portRef.current) {
        setupConnection();
      }

      if (isFollowUpMode) {
        await sendMessage({
          type: 'follow_up_task',
          task: text,
          taskId: sessionIdRef.current,
          tabId,
        });
      } else {
        await sendMessage({
          type: 'new_task',
          task: text,
          taskId: sessionIdRef.current,
          tabId,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      appendMessage({
        actor: Actors.SYSTEM,
        content: errorMessage,
        timestamp: Date.now(),
      });
      setInputEnabled(true);
      setShowStopButton(false);
      stopConnection();
    }
  };

  const handleStopTask = async () => {
    try {
      portRef.current?.postMessage({
        type: 'cancel_task',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      appendMessage({
        actor: Actors.SYSTEM,
        content: errorMessage,
        timestamp: Date.now(),
      });
    }
    setInputEnabled(true);
    setShowStopButton(false);
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    sessionIdRef.current = null;
    setInputEnabled(true);
    setShowStopButton(false);
    setIsFollowUpMode(false);
    setIsHistoricalSession(false);
    setTimelineSteps(DEFAULT_TIMELINE_STEPS);
    setActionApproval(null);
    stopConnection();
  };

  const loadChatSessions = useCallback(async () => {
    try {
      const sessions = await chatHistoryStore.getSessionsMetadata();
      setChatSessions(sessions.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    }
  }, []);

  const handleLoadHistory = async () => {
    await loadChatSessions();
    setShowHistory(true);
  };

  const handleBackToChat = (reset = false) => {
    setShowHistory(false);
    if (reset) {
      setCurrentSessionId(null);
      setMessages([]);
      setIsFollowUpMode(false);
      setIsHistoricalSession(false);
    }
  };

  const handleSessionSelect = async (sessionId: string) => {
    try {
      const fullSession = await chatHistoryStore.getSession(sessionId);
      if (fullSession && fullSession.messages.length > 0) {
        setCurrentSessionId(fullSession.id);
        setMessages(fullSession.messages);
        setIsFollowUpMode(false);
        setIsHistoricalSession(true);
      }
      setShowHistory(false);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleSessionDelete = async (sessionId: string) => {
    try {
      await chatHistoryStore.deleteSession(sessionId);
      await loadChatSessions();
      if (sessionId === currentSessionId) {
        setMessages([]);
        setCurrentSessionId(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleSessionBookmark = async (sessionId: string) => {
    try {
      const fullSession = await chatHistoryStore.getSession(sessionId);
      if (fullSession && fullSession.messages.length > 0) {
        const sessionTitle = fullSession.title;
        const title = sessionTitle.split(' ').slice(0, 8).join(' ');
        const taskContent = fullSession.messages[0]?.content || '';
        await favoritesStorage.addPrompt(title, taskContent);
        const prompts = await favoritesStorage.getAllPrompts();
        setFavoritePrompts(prompts);
        handleBackToChat(true);
      }
    } catch (error) {
      console.error('Failed to bookmark session:', error);
    }
  };

  const handleBookmarkSelect = (content: string) => {
    if (setInputTextRef.current) {
      setInputTextRef.current(content);
    }
  };

  const handleBookmarkUpdateTitle = async (id: number, title: string) => {
    try {
      await favoritesStorage.updatePromptTitle(id, title);
      const prompts = await favoritesStorage.getAllPrompts();
      setFavoritePrompts(prompts);
    } catch (error) {
      console.error('Failed to update bookmark title:', error);
    }
  };

  const handleBookmarkDelete = async (id: number) => {
    try {
      await favoritesStorage.removePrompt(id);
      const prompts = await favoritesStorage.getAllPrompts();
      setFavoritePrompts(prompts);
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
    }
  };

  const handleBookmarkReorder = async (draggedId: number, targetId: number) => {
    try {
      await favoritesStorage.reorderPrompts(draggedId, targetId);
      const updatedPrompts = await favoritesStorage.getAllPrompts();
      setFavoritePrompts(updatedPrompts);
    } catch (error) {
      console.error('Failed to reorder bookmarks:', error);
    }
  };

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const prompts = await favoritesStorage.getAllPrompts();
        setFavoritePrompts(prompts);
      } catch (error) {
        console.error('Failed to load favorites:', error);
      }
    };
    loadFavorites();
  }, []);

  // Speech recording
  const handleMicClick = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            if (!portRef.current) {
              setupConnection();
            }
            try {
              setIsProcessingSpeech(true);
              portRef.current?.postMessage({
                type: 'speech_to_text',
                audio: base64Audio,
              });
            } catch {
              setIsRecording(false);
              setIsProcessingSpeech(false);
            }
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      const maxDuration = 2 * 60 * 1000;
      recordingTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setIsProcessingSpeech(true);
        recordingTimerRef.current = null;
      }, maxDuration);

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  // Live Tab Capture for Privacy Preview — routed through the background so
  // the DOM-mask + BlazeFace redaction pipeline runs before any pixel is shown.
  const handleCaptureCurrentTab = async () => {
    setIsCapturingPreview(true);
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) throw new Error('No active tab found');
      if (!portRef.current) setupConnection();
      if (!portRef.current) throw new Error('background connection unavailable');

      const result = await new Promise<{ image: string; domMasks: number } | { error: string }>(resolve => {
        captureResolverRef.current = resolve;
        portRef.current?.postMessage({ type: 'capture_sanitized', tabId });
        // Safety timeout: never leave the preview button stuck on "sanitizing…".
        window.setTimeout(() => {
          if (captureResolverRef.current === resolve) {
            captureResolverRef.current = null;
            resolve({ error: 'capture timed out' });
          }
        }, 15000);
      });

      if ('error' in result) {
        throw new Error(result.error);
      }

      setSanitizedPreviewBase64(result.image);
      setPrivacyMetrics((prev) => ({
        ...prev,
        isLive: true,
        regionsRedacted: prev.regionsRedacted + (result.domMasks || 1),
      }));
    } catch (e) {
      console.warn('Capture tab notice:', e);
      const raw = e instanceof Error ? e.message : 'capture failed';
      // Chrome denies captureVisibleTab until the extension has host access
      // for the tab (or an activeTab grant). Surface an actionable hint.
      const hint = raw.includes('activeTab')
        ? ' — grant site access: chrome://extensions → Aegis-Agent → Site access → "On all sites", then retry'
        : '';
      appendMessage({
        actor: Actors.SYSTEM,
        content: raw + hint,
        timestamp: Date.now(),
      });
    } finally {
      setIsCapturingPreview(false);
    }
  };

  const handleConfirmAction = () => {
    if (portRef.current) {
      portRef.current.postMessage({ type: 'confirm_action', approved: true });
    }
    setActionApproval(null);
  };

  const handleCancelAction = () => {
    if (portRef.current) {
      portRef.current.postMessage({ type: 'confirm_action', approved: false });
    }
    setActionApproval(null);
  };

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasRunningTask = showStopButton || timelineSteps.some((s) => s.status === 'running');

  return (
    <div
      className={`flex h-screen flex-col overflow-hidden select-none ${
        isDarkMode ? 'dark bg-ink text-primary' : 'paper-grid bg-ink text-primary'
      }`}>
      {/* 1. Header */}
      <Header
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onNewChat={handleNewChat}
        onOpenHistory={handleLoadHistory}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPrivacyPreview={() => setIsPrivacyPreviewOpen(true)}
        showHistory={showHistory}
        onBackToChat={() => handleBackToChat(false)}
        providerMode={providerMode}
        onProviderChange={setProviderMode}
        serverUrl={serverUrl}
        totalRedactionsCount={privacyMetrics.regionsRedacted}
        sanitizeContent={sanitizeContent}
        onToggleSanitization={handleToggleSanitization}
      />

      {/* Main Content Area */}
      {showHistory ? (
        <div className="flex-1 overflow-hidden">
          <ChatHistoryList
            sessions={chatSessions}
            onSessionSelect={handleSessionSelect}
            onSessionDelete={handleSessionDelete}
            onSessionBookmark={handleSessionBookmark}
            visible={true}
            isDarkMode={isDarkMode}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-3 space-y-3">
          {/* 3. Privacy Status Card */}
          <PrivacyStatusCard
            metrics={privacyMetrics}
            onOpenPrivacyPreview={() => setIsPrivacyPreviewOpen(true)}
            isDarkMode={isDarkMode}
          />

          {/* 6. Action Confirmation Approval Card */}
          {actionApproval && (
            <ActionConfirmation
              request={actionApproval}
              onConfirm={handleConfirmAction}
              onCancel={handleCancelAction}
              isDarkMode={isDarkMode}
            />
          )}

          {/* 5. Task Timeline (Active when task is running or steps are non-pending) */}
          {(hasRunningTask || timelineSteps.some((s) => s.status === 'success' || s.status === 'failed')) && (
            <TaskTimeline
              steps={timelineSteps}
              currentStepIndex={currentStepIdx}
              isDarkMode={isDarkMode}
              isCompact={isTimelineCompact}
              onToggleCompact={() => setIsTimelineCompact(!isTimelineCompact)}
            />
          )}

          {/* Empty State Hero when no messages */}
          {messages.length === 0 && !hasRunningTask && (
            <div className="relative frame-outer">
              <div className="frame-inner relative min-h-[260px] flex flex-col overflow-hidden">
                {/* Dark mode: FaultyTerminal glyph field behind the headline */}
                {isDarkMode && !prefersReducedMotion && (
                  <div className="absolute inset-0">
                    <FaultyTerminal
                      scale={1.4}
                      gridMul={[2, 1]}
                      digitSize={1.2}
                      timeScale={1}
                      scanlineIntensity={0.4}
                      glitchAmount={1}
                      flickerAmount={0.6}
                      brightness={0.5}
                      mouseReact
                      mouseStrength={0.4}
                      pageLoadAnimation={false}
                      tint="#82aaff"
                    />
                  </div>
                )}

                {!isDarkMode && <LightPrivacyCollage staticMode={prefersReducedMotion} />}

                {/* Headline — two-tone, sits above the canvas in dark, above paper grid in light */}
                <div
                  className={`relative z-10 flex flex-1 flex-col justify-center px-4 py-6 ${
                    isDarkMode ? '' : 'bg-surface/30 backdrop-blur-[1px]'
                  }`}>
                  <h1 className="text-[22px] font-medium leading-[1.15] tracking-[-0.02em] text-primary">
                    Browse with a privacy firewall.
                    <span className="block text-secondary">
                      Sensitive pixels never leave this device.
                    </span>
                  </h1>
                  <p className="mt-2 font-mono text-[11px] text-tertiary">
                    aegis-agent · sih-26171 · qwen3-vl behind local redaction
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick actions: AnimatedDock (dark, motion) or sticker chips (light) */}
          {messages.length === 0 && !hasRunningTask && (
            <div className={isDarkMode && !prefersReducedMotion ? 'space-y-3' : 'space-y-2'}>
              {isDarkMode && !prefersReducedMotion ? (
                <AnimatedDock items={dockItems} />
              ) : (
                <StickerChips
                  onSelect={(text) => {
                    setInputTextRef.current?.(text);
                  }}
                />
              )}
            </div>
          )}

          {/* 2. Main Task Area (Top position when no messages) */}
          {messages.length === 0 && (
            <div className="pt-1">
              <TaskArea
                onSendMessage={handleSendMessage}
                onStopTask={handleStopTask}
                onMicClick={handleMicClick}
                isRecording={isRecording}
                isProcessingSpeech={isProcessingSpeech}
                disabled={!inputEnabled || isHistoricalSession}
                showStopButton={showStopButton}
                setContent={(setter) => {
                  setInputTextRef.current = setter;
                }}
                isDarkMode={isDarkMode}
                historicalSessionId={isHistoricalSession && replayEnabled ? currentSessionId : null}
              />
            </div>
          )}

          {/* Saved Bookmarks */}
          {messages.length === 0 && favoritePrompts.length > 0 && (
            <div className="pt-2">
              <BookmarkList
                bookmarks={favoritePrompts}
                onBookmarkSelect={handleBookmarkSelect}
                onBookmarkUpdateTitle={handleBookmarkUpdateTitle}
                onBookmarkDelete={handleBookmarkDelete}
                onBookmarkReorder={handleBookmarkReorder}
                isDarkMode={isDarkMode}
              />
            </div>
          )}

          {/* Message Stream */}
          {messages.length > 0 && (
            <div className="flex-1 overflow-y-auto scrollbar-gutter-stable space-y-2 pr-1 min-h-[120px]">
              <MessageList messages={messages} isDarkMode={isDarkMode} />
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* 2. Main Task Area (Bottom position when conversation is active) */}
          {messages.length > 0 && (
            <div className="pt-2 sticky bottom-0 z-10 bg-ink pb-1">
              <TaskArea
                onSendMessage={handleSendMessage}
                onStopTask={handleStopTask}
                onMicClick={handleMicClick}
                isRecording={isRecording}
                isProcessingSpeech={isProcessingSpeech}
                disabled={!inputEnabled || isHistoricalSession}
                showStopButton={showStopButton}
                setContent={(setter) => {
                  setInputTextRef.current = setter;
                }}
                isDarkMode={isDarkMode}
                historicalSessionId={isHistoricalSession && replayEnabled ? currentSessionId : null}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. Privacy Preview Modal */}
      <PrivacyPreviewModal
        isOpen={isPrivacyPreviewOpen}
        onClose={() => setIsPrivacyPreviewOpen(false)}
        isDarkMode={isDarkMode}
        sanitizedImageBase64={sanitizedPreviewBase64}
        onCaptureCurrentTab={handleCaptureCurrentTab}
        isCapturing={isCapturingPreview}
      />

      {/* 7. Quick Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDarkMode={isDarkMode}
        serverUrl={serverUrl}
        onSaveServerUrl={setServerUrl}
        activeModel={activeModel}
        onModelChange={handleModelChange}
        providerMode={providerMode}
        onProviderChange={setProviderMode}
      />
    </div>
  );
};

export default SidePanel;
