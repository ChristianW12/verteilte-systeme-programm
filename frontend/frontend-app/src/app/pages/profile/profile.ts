import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { getSessionStorage } from '../../utils/storage';

// Response-Typ vom Profile-Endpoint
type ProfileResponse = {
  user: {
    id: string;
    username: string;
    email: string;
    createdAt: string;
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
    if (!getSessionStorage()) {
      return;
    }
    this.loadProfile();
  }

  // Ruft Benutzerprofildaten vom Backend ab und speichert sie in Signals
  loadProfile() {

    // POST-Request an Backend: gibt Profildaten des Benutzers zurück
    this.http.post<ProfileResponse>('/api/auth/profile', {})
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

    this.http.post('/api/auth/logout', {}).subscribe({
      next: () => {
        storage?.removeItem('userId');
        storage?.removeItem('userEmail');
        storage?.removeItem('isLoggedIn');
        storage?.removeItem('passwordHash');
        alert('Erfolgreich ausgeloggt');
        this.router.navigate(['/home']);
      },
      error: () => {
        storage?.removeItem('userId');
        storage?.removeItem('userEmail');
        storage?.removeItem('isLoggedIn');
        storage?.removeItem('passwordHash');
        this.router.navigate(['/home']);
      }
    });
  }

}

