'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, Command, Copy, Menu, MessageSquarePlus, PanelLeftClose, Plus, Search, Settings2, Sparkles, SquarePen, X, Zap } from 'lucide-react';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type Thread = { id: string; title: string; updatedAt: number; messages: Message[] };
const STORAGE_KEY = 'zeta-ai-threads-v1';
const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function renderText(text: string) {
  // Lightweight Markdown rendering for paragraphs, lists, inline code, and fenced code.
  const blocks = text.split(/```([\w-]*)\n([\s\S]*?)```/g);
  const output: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (i % 3 === 1) {
      const code = blocks[i + 1] ?? '';
      output.push(<pre className="code-block" key={`code-${i}`}><div className="code-top"><span>{blocks[i] || 'code'}</span><button className="icon-button tiny" aria-label="Copy code" onClick={() => navigator.clipboard?.writeText(code)}><Copy size={13}/></button></div><code>{code.replace(/\n$/, '')}</code></pre>);
      i++;
      continue;
    }
    const part = blocks[i];
    const lines = part.split('\n');
    let list: string[] = [];
    const flush = (key: string) => { if (list.length) { output.push(<ul key={key}>{list.map((item, j) => <li key={j}>{inline(item)}</li>)}</ul>); list = []; } };
    lines.forEach((line, j) => {
      if (/^\s*[-*]\s+/.test(line)) { list.push(line.replace(/^\s*[-*]\s+/, '')); return; }
      flush(`list-${i}-${j}`);
      if (!line.trim()) return;
      if (/^###\s+/.test(line)) output.push(<h3 key={`${i}-${j}`}>{inline(line.replace(/^###\s+/, ''))}</h3>);
      else if (/^##\s+/.test(line)) output.push(<h2 key={`${i}-${j}`}>{inline(line.replace(/^##\s+/, ''))}</h2>);
      else if (/^>\s?/.test(line)) output.push(<blockquote key={`${i}-${j}`}>{inline(line.replace(/^>\s?/, ''))}</blockquote>);
      else output.push(<p key={`${i}-${j}`}>{inline(line)}</p>);
    });
    flush(`list-${i}-end`);
  }
  return output;
}
function inline(text: string) {
  const pieces = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return pieces.map((piece, i) => piece.startsWith('`') && piece.endsWith('`') ? <code className="inline-code" key={i}>{piece.slice(1, -1)}</code> : piece.startsWith('**') && piece.endsWith('**') ? <strong key={i}>{piece.slice(2, -2)}</strong> : piece);
}

export default function Home() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeThread = threads.find(t => t.id === activeId);
  const messages = activeThread?.messages ?? [];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: Thread[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) { setThreads(parsed); setActiveId(parsed[0].id); }
      }
    } catch { /* Ignore corrupt local history and start fresh. */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(threads)); }, [threads, ready]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);
  useEffect(() => { if (!busy) inputRef.current?.focus(); }, [activeId, busy]);

  function newChat() {
    const thread: Thread = { id: makeId(), title: 'New conversation', updatedAt: Date.now(), messages: [] };
    setThreads(prev => [thread, ...prev]); setActiveId(thread.id); setInput(''); setError('');
    if (window.innerWidth < 760) setSidebarOpen(false);
  }
  function patchMessages(threadId: string, updater: (old: Message[]) => Message[]) {
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, messages: updater(t.messages), updatedAt: Date.now() } : t).sort((a,b) => b.updatedAt - a.updatedAt));
  }
  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    let thread = activeThread;
    if (!thread) {
      thread = { id: makeId(), title: 'New conversation', updatedAt: Date.now(), messages: [] };
      setThreads(prev => [thread!, ...prev]); setActiveId(thread.id);
    }
    const threadId = thread.id;
    const userMessage: Message = { id: makeId(), role: 'user', content: text };
    const assistantMessage: Message = { id: makeId(), role: 'assistant', content: '' };
    const prior = thread.messages;
    const next = [...prior, userMessage];
    setInput(''); setBusy(true); setError('');
    setThreads(prev => {
      const exists = prev.some(t => t.id === threadId);
      const updated: Thread = { ...thread!, title: prior.length ? thread!.title : text.slice(0, 44) + (text.length > 44 ? '…' : ''), messages: [...next, assistantMessage], updatedAt: Date.now() };
      return exists ? prev.map(t => t.id === threadId ? updated : t).sort((a,b) => b.updatedAt - a.updatedAt) : [updated, ...prev];
    });
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }) });
      if (!response.ok || !response.body) {
        let message = 'Something went wrong. Please try again.';
        try { const data = await response.json(); message = data.error || message; } catch { /* no json */ }
        throw new Error(message);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n'); buffer = chunks.pop() || '';
        for (const line of chunks) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const data = JSON.parse(payload);
            const delta = data.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) patchMessages(threadId, old => old.map(m => m.id === assistantMessage.id ? { ...m, content: m.content + delta } : m));
            if (data.error?.message) throw new Error(data.error.message);
          } catch (e) { if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e; }
        }
      }
      const latest = threads.find(t => t.id === threadId);
      void latest;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Connection failed. Please try again.';
      setError(message);
      patchMessages(threadId, old => old.map(m => m.id === assistantMessage.id ? { ...m, content: m.content || 'I could not complete that request.' } : m));
    } finally { setBusy(false); }
  }
  function onSubmit(e: FormEvent) { e.preventDefault(); void send(); }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }
  function deleteThread(id: string) {
    const remaining = threads.filter(t => t.id !== id); setThreads(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id || '');
  }
  async function copyMessage(message: Message) {
    try { await navigator.clipboard.writeText(message.content); setCopiedId(message.id); window.setTimeout(() => setCopiedId(''), 1400); } catch { /* clipboard may be unavailable */ }
  }

  return <main className="app-shell">
    {sidebarOpen && <>
      <button className="mobile-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />
      <aside className="sidebar">
        <div className="brand-row"><div className="brand-mark"><Sparkles size={19}/></div><span className="brand-name">zeta<span className="brand-dot">.</span></span><button className="icon-button sidebar-collapse" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={17}/></button></div>
        <button className="new-chat" onClick={newChat}><SquarePen size={16}/><span>New chat</span><span className="shortcut">⌘ K</span></button>
        <div className="side-label">WORKSPACE</div>
        <div className="side-nav active"><MessageSquarePlus size={16}/><span>Conversations</span></div>
        <div className="side-nav muted"><Search size={16}/><span>Search chats</span><span className="soon">SOON</span></div>
        <div className="history-head"><span>RECENT</span><span>{threads.length || ''}</span></div>
        <div className="thread-list">
          {threads.map(t => <div className={`thread-item ${t.id === activeId ? 'selected' : ''}`} key={t.id}><button className="thread-select" onClick={() => { setActiveId(t.id); setError(''); if (window.innerWidth < 760) setSidebarOpen(false); }}><span className="thread-indicator"/><span>{t.title}</span></button><button className="thread-delete" aria-label={`Delete ${t.title}`} onClick={() => deleteThread(t.id)}><X size={13}/></button></div>)}
          {!threads.length && <div className="empty-history">Your conversations will appear here.</div>}
        </div>
        <div className="sidebar-bottom"><div className="user-avatar">N</div><div className="user-meta"><strong>Zeta workspace</strong><span>Free edition</span></div><button className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings2 size={17}/></button></div>
      </aside>
    </>}
    <section className="main-panel">
      <header className="topbar">
        <div className="top-left">{!sidebarOpen && <button className="icon-button" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)}><Menu size={19}/></button>}<div className="model-picker"><span className="model-gem"><Sparkles size={14}/></span><span>Zeta</span><span className="model-tag">PREVIEW</span><ChevronDown size={14} className="chevron"/></div></div>
        <div className="top-right"><div className="status-dot"/><span>Personal workspace</span><button className="icon-button top-settings" aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings2 size={17}/></button></div>
      </header>
      <div className={`chat-scroll ${messages.length ? 'has-messages' : ''}`}>
        {messages.length === 0 ? <div className="welcome">
          <div className="welcome-orb"><div className="orb-core"><Sparkles size={28}/></div><span className="orb-ring ring-one"/><span className="orb-ring ring-two"/><span className="orb-dot dot-one"/><span className="orb-dot dot-two"/></div>
          <div className="eyebrow"><span/> YOUR THINKING SPACE</div>
          <h1>Big ideas start<br/>with a <em>better question.</em></h1>
          <p className="welcome-sub">A space to think clearly, explore deeply, and turn<br className="desktop-break"/> what you imagine into something real.</p>
          <div className="prompt-grid">
            <button className="prompt-card" onClick={() => void send('Help me understand a difficult idea from first principles, with examples.') }><span className="prompt-icon purple"><Zap size={16}/></span><span className="prompt-title">Explain something complex</span><span className="prompt-desc">Make hard ideas feel simple</span><ArrowUp size={15} className="prompt-arrow"/></button>
            <button className="prompt-card" onClick={() => void send('Help me plan and build a useful project from scratch. Ask only essential questions.') }><span className="prompt-icon green"><Command size={16}/></span><span className="prompt-title">Build something new</span><span className="prompt-desc">Turn an idea into a real plan</span><ArrowUp size={15} className="prompt-arrow"/></button>
            <button className="prompt-card" onClick={() => void send('Help me solve a challenging problem step by step and check the result.') }><span className="prompt-icon amber"><Sparkles size={16}/></span><span className="prompt-title">Solve a tough problem</span><span className="prompt-desc">Reason carefully, step by step</span><ArrowUp size={15} className="prompt-arrow"/></button>
            <button className="prompt-card" onClick={() => void send('Help me research a topic. Tell me what is known, what is uncertain, and what evidence I should look for.') }><span className="prompt-icon blue"><Search size={16}/></span><span className="prompt-title">Explore a new topic</span><span className="prompt-desc">Find the questions worth asking</span><ArrowUp size={15} className="prompt-arrow"/></button>
          </div>
        </div> : <div className="messages-wrap">{messages.map((m, i) => <article className={`message ${m.role}`} key={m.id}><div className="message-avatar">{m.role === 'assistant' ? <div className="mini-mark"><Sparkles size={13}/></div> : <span>Y</span>}</div><div className="message-content"><div className="message-author">{m.role === 'assistant' ? 'Zeta' : 'You'}{m.role === 'assistant' && i === messages.length - 1 && busy && <span className="typing-label">THINKING</span>}</div><div className="prose">{m.content ? renderText(m.content) : busy && m.role === 'assistant' ? <div className="thinking"><span/><span/><span/></div> : null}</div>{m.role === 'assistant' && m.content && <div className="message-tools"><button className="tool-button" onClick={() => void copyMessage(m)}>{copiedId === m.id ? <Check size={13}/> : <Copy size={13}/>} {copiedId === m.id ? 'Copied' : 'Copy'}</button></div>}</div></article>)}<div ref={bottomRef}/></div>}
      </div>
      <div className="composer-area">
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={14}/></button></div>}
        <form className="composer" onSubmit={onSubmit}><textarea ref={inputRef} rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder="Ask anything. Think out loud…" aria-label="Message Zeta" disabled={busy} onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; }}/><div className="composer-bottom"><div className="composer-hints"><span className="hint-chip"><Plus size={13}/> Add context</span><span className="hint-separator"/><span className="keyboard-hint">↵ to send · shift + ↵ for new line</span></div><button className="send-button" type="submit" disabled={!input.trim() || busy} aria-label="Send message">{busy ? <span className="spinner"/> : <ArrowUp size={18}/>}</button></div></form>
        <div className="disclaimer"><span>✳</span> Zeta can make mistakes. Verify important information.</div>
      </div>
    </section>
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><div className="modal-kicker">PREFERENCES</div><h2>Workspace settings</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18}/></button></div><div className="settings-section"><h3>About Zeta</h3><p>Zeta AI is an independent AI workspace in active development. This preview uses a free-tier model provider when configured.</p></div><div className="settings-section"><h3>Your conversation history</h3><p>Chats are stored in this browser on this device. They are not synced between devices in this starter version.</p><button className="danger-button" onClick={() => { if (confirm('Delete all conversations saved in this browser?')) { setThreads([]); setActiveId(''); localStorage.removeItem(STORAGE_KEY); setSettingsOpen(false); } }}>Clear all conversations</button></div><div className="settings-section"><h3>Privacy note</h3><p>Messages sent to the configured AI provider leave this device. Do not submit passwords, API keys, or sensitive personal information.</p></div><div className="modal-foot"><span className="status-dot"/> Version 0.1 · Free preview</div></section></div>}
  </main>;
}
