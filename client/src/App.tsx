import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Settings, User, Bot, AlertTriangle, Key } from 'lucide-react';
import './App.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isThinking?: boolean;
}

interface ApiKeys {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [model, setModel] = useState('gemini-3-flash-preview');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Load keys from local storage
  useEffect(() => {
    const saved = localStorage.getItem('dexter_api_keys');
    if (saved) setApiKeys(JSON.parse(saved));
  }, []);

  const saveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('dexter_api_keys', JSON.stringify(apiKeys));
    setShowSettings(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input;
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          model,
          provider: model.startsWith('openrouter/') ? 'openrouter' : model.startsWith('claude') ? 'anthropic' : model.startsWith('gpt') ? 'openai' : 'google',
          apiKeys
        }),
      });

      if (!response.ok) throw new Error(response.statusText);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader');

      // Add placeholder bot message
      const botMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: botMsgId, role: 'assistant', content: '', isThinking: true }]);

      let botContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'answer_chunk') {
                botContent += event.text;
                setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: botContent, isThinking: false } : m));
              } else if (event.type === 'thinking') {
                if (!botContent) {
                  setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: `_${event.message}_`, isThinking: true } : m));
                }
              }
            } catch (e) {
              console.error('Parse error', e);
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${error}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Dexter <span>Web</span></h1>
        <button onClick={() => setShowSettings(true)} className="icon-btn" title="Settings">
          <Settings size={20} />
        </button>
      </header>

      <div className="chat-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <Bot size={48} />
            <h2>Welcome to Dexter</h2>
            <p>Your AI Financial Assistant. Ask me about Indian Stocks!</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="avatar">
              {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
            </div>
            <div className="content">
              {msg.role === 'assistant' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
              {msg.isThinking && <span className="cursor">|</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="input-area">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask something... (e.g. 'Analyze Reliance')"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          <Send size={20} />
        </button>
      </form>

      {showSettings && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2><Settings size={20} /> Settings</h2>
              <button onClick={() => setShowSettings(false)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={saveKeys}>
              <div className="form-group">
                <label>Select Model</label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="model-select"
                  style={{ width: '100%', padding: '8px', marginBottom: '16px', borderRadius: '4px', border: '1px solid #333', background: '#0f1014', color: '#fff' }}
                >
                  <optgroup label="Google">
                    <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                    <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Strong)</option>
                  </optgroup>
                  <optgroup label="OpenAI">
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                  </optgroup>
                  <optgroup label="Anthropic">
                    <option value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                  </optgroup>
                  <optgroup label="OpenRouter">
                    <option value="openrouter/deepseek/deepseek-chat">DeepSeek V3</option>
                    <option value="openrouter/deepseek/deepseek-reasoner">DeepSeek R1</option>
                    <option value="openrouter/google/gemini-2.0-flash-001">Gemini 2.0 Flash (OR)</option>
                    <option value="openrouter/meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
                  </optgroup>
                </select>
              </div>

              <div className="form-group">
                <label><Key size={14} /> OpenAI API Key</label>
                <input
                  type="password"
                  value={apiKeys.OPENAI_API_KEY || ''}
                  onChange={e => setApiKeys(prev => ({ ...prev, OPENAI_API_KEY: e.target.value }))}
                  placeholder="sk-..."
                />
              </div>
              <div className="form-group">
                <label><Key size={14} /> Google Gemini API Key</label>
                <input
                  type="password"
                  value={apiKeys.GOOGLE_API_KEY || ''}
                  onChange={e => setApiKeys(prev => ({ ...prev, GOOGLE_API_KEY: e.target.value }))}
                  placeholder="AIza..."
                />
              </div>
              <div className="form-group">
                <label><Key size={14} /> Anthropic API Key</label>
                <input
                  type="password"
                  value={apiKeys.ANTHROPIC_API_KEY || ''}
                  onChange={e => setApiKeys(prev => ({ ...prev, ANTHROPIC_API_KEY: e.target.value }))}
                  placeholder="sk-ant-..."
                />
              </div>
              <div className="form-group">
                <label><Key size={14} /> OpenRouter API Key</label>
                <input
                  type="password"
                  value={apiKeys.OPENROUTER_API_KEY || ''}
                  onChange={e => setApiKeys(prev => ({ ...prev, OPENROUTER_API_KEY: e.target.value }))}
                  placeholder="sk-or-..."
                />
              </div>
              <p className="hint"><AlertTriangle size={14} /> Keys are stored locally in your browser.</p>
              <button type="submit" className="save-btn">Save & Close</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
