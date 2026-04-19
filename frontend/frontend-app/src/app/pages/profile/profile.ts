import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { getSessionStorage } from '../../utils/storage';

// Response-Typ vom Profile-Endpoint
type ProfileResponse = {
  user: {
    id: number;
    username: string;
    email: string;
    createdAt: string;
    password: string;
  };
};

@Component({
  selector: 'app-profile',
  imports: [DatePipe, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})

export class Profile implements OnInit {

  private http = inject(HttpClient);
  private router = inject(Router);

  // Anzeigedaten in Signals (reaktiv)
  email = signal('');
  username = signal('');
  memberSince = signal('');

  ngOnInit() {
    this.loadProfile();
  }

  // Ruft Benutzerprofildaten vom Backend ab und speichert sie in Signals
  loadProfile() {

    // userId aus Session Storage auslesen
    const userId = getSessionStorage()?.getItem('userId');

    // POST-Request an Backend: gibt Profildaten des Benutzers zurück
    this.http.post<ProfileResponse>('/api/auth/profile', { userId })
      .subscribe({
        // Erfolg: Profildaten in Signals speichern (aktualisiert automatisch die View)
        next: (response) => {
          this.email.set(response.user.email);
          this.username.set(response.user.username);
          this.memberSince.set(response.user.createdAt);
          console.log('Profile response:', response);
        },
        // Fehler: Fehlermeldung anzeigen
        error: (err) => {
          console.error('Fehler beim Laden des Profils:', err);
          alert('Fehler beim Laden des Profils. Bitte erneut versuchen.');
        }
      });
  }

  // Löscht alle Session-Daten und navigiert zum Home
  logout() {
    const storage = getSessionStorage();

    // Alle Session-Daten entfernen
    storage?.removeItem('isLoggedIn');
    storage?.removeItem('userId');
    storage?.removeItem('userEmail');

    alert('Erfolgreich ausgeloggt');
    this.router.navigate(['/home']);
  }

}


