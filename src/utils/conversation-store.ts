import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

export interface StoredMessage {
  id: number;
  query: string;
  answer: string;
  summary: string;
  timestamp: string;
  model: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
  messages: StoredMessage[];
}

export interface SessionSummary {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
  messageCount: number;
}

interface CurrentSessionPointer {
  sessionId: string;
}

export class ConversationStore {
  private storeDir: string;
  private sessionsDir: string;
  private currentFile: string;

  constructor(storeDir: string = '.dexter/conversations') {
    this.storeDir = storeDir;
    this.sessionsDir = join(storeDir, 'sessions');
    this.currentFile = join(storeDir, 'current.json');

    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private generateSessionId(): string {
    const date = new Date().toISOString().split('T')[0];
    const random = Math.random().toString(36).slice(2, 8);
    return `${date}_${random}`;
  }

  private generateSessionName(): string {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'short' });
    const day = now.getDate();
    const hour = now.getHours();
    const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    return `${month} ${day} ${period}`;
  }

  private getSessionPath(sessionId: string): string {
    return join(this.sessionsDir, `${sessionId}.json`);
  }

  createSession(): Session {
    const session: Session = {
      id: this.generateSessionId(),
      name: this.generateSessionName(),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      messages: [],
    };

    this.saveSession(session);
    this.setCurrentSessionId(session.id);
    return session;
  }

  loadSession(sessionId: string): Session | null {
    const path = this.getSessionPath(sessionId);
    if (!existsSync(path)) {
      return null;
    }

    try {
      const content = readFileSync(path, 'utf-8');
      return JSON.parse(content) as Session;
    } catch {
      return null;
    }
  }

  saveSession(session: Session): void {
    const path = this.getSessionPath(session.id);
    writeFileSync(path, JSON.stringify(session, null, 2));
  }

  listSessions(): SessionSummary[] {
    if (!existsSync(this.sessionsDir)) {
      return [];
    }

    const files = readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));
    const sessions: SessionSummary[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(this.sessionsDir, file), 'utf-8');
        const session = JSON.parse(content) as Session;
        sessions.push({
          id: session.id,
          name: session.name,
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt,
          messageCount: session.messages.length,
        });
      } catch {
        // Skip invalid files
      }
    }

    return sessions.sort((a, b) => 
      new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  }

  deleteSession(sessionId: string): boolean {
    const path = this.getSessionPath(sessionId);
    if (!existsSync(path)) {
      return false;
    }

    try {
      unlinkSync(path);
      if (this.getCurrentSessionId() === sessionId) {
        this.clearCurrentSession();
      }
      return true;
    } catch {
      return false;
    }
  }

  getCurrentSessionId(): string | null {
    if (!existsSync(this.currentFile)) {
      return null;
    }

    try {
      const content = readFileSync(this.currentFile, 'utf-8');
      const pointer = JSON.parse(content) as CurrentSessionPointer;
      return pointer.sessionId;
    } catch {
      return null;
    }
  }

  setCurrentSessionId(sessionId: string): void {
    const pointer: CurrentSessionPointer = { sessionId };
    writeFileSync(this.currentFile, JSON.stringify(pointer, null, 2));
  }

  private clearCurrentSession(): void {
    if (existsSync(this.currentFile)) {
      unlinkSync(this.currentFile);
    }
  }
}
