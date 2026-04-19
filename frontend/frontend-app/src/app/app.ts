import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/components/header/header';
import { RealtimeService } from './shared/services/realtime';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('frontend-app');
  private realtime = inject(RealtimeService);

  ngOnInit() {
    // WebSocket Verbindung beim App-Start aufbauen
    this.realtime.connect();
    console.log('📡 Realtime Service initialisiert');
  }
}

