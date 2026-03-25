import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  refreshRequired = signal(false);
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    try {
      this.socket = new WebSocket('ws://localhost:8080/ws');

      this.socket.onopen = () => {
        console.log('✅ WebSocket verbunden');
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('[realtime]', message.type, message.payload);

        // Tasks oder Projekte geändert → Dashboard aktualisieren
        if (message.type.includes('task.') || message.type.includes('project.')) {
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

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Versuche Reconnect in ${delay}ms...`);
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