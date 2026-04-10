import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type RealtimeEvent = {
  type: string;
  payload: any;
  timestamp: string;
};

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private platformId = inject(PLATFORM_ID);
  
  refreshRequired = signal(false);
  lastEvent = signal<RealtimeEvent | null>(null);
  
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Nur im Browser initialisieren, nutzt wss: für HTTPS
  connect() {
    // WICHTIG: WebSocket nur im Browser initialisieren!
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      this.socket = new WebSocket(`${protocol}//${host}/ws`);

      this.socket.onopen = () => {
        console.log('✅ WebSocket verbunden');
        this.reconnectAttempts = 0;
      };

      // Triggert refreshRequired Signal bei task/project-Events
      this.socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('[realtime]', message.type, message.payload);

        this.lastEvent.set(message);

        const refreshTypes = ['task.created', 'task.deleted', 'task.updated', 'task.statusUpdated', 'project.created', 'project.updated'];
        if (refreshTypes.includes(message.type)) {
          this.refreshRequired.set(true);
        }
      };

      this.socket.onerror = (error) => {
        console.error('❌ WebSocket Fehler:', error);
      };

      this.socket.onclose = () => {
        console.log('❌ WebSocket geschlossen');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Fehler beim WebSocket connect:', error);
    }
  }

  // Exponentielle Backoff-Strategie: max 30s, 5 Versuche
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => this.connect(), delay);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
