import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject , signal} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { getSessionStorage } from '../../utils/storage';

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
export class Profile {

  private http = inject(HttpClient);
  private router = inject(Router);

  email = signal('');
  username = signal('');
  memberSince = signal('');

  ngOnInit() {

    this.loadProfile();
  }

  // Ruft Benutzerprofildaten ab
  loadProfile() {

    const userId = getSessionStorage()?.getItem('userId');

    this.http.post<ProfileResponse>('/api/auth/profile', { userId })
      .subscribe({
        next: (response) => {
          this.email.set(response.user.email);
          this.username.set(response.user.username);
          this.memberSince.set(response.user.createdAt);
          console.log('Profile response:', response);
        },
        error: (err) => {
          console.error('Fehler beim Laden des Profils:', err);
          alert('Fehler beim Laden des Profils. Bitte erneut versuchen.');
        }
      });
  }

  // Löscht Session-Daten und leitet zum Login um
  logout() {
    const storage = getSessionStorage();
    storage?.removeItem('isLoggedIn');
    storage?.removeItem('userId');
    storage?.removeItem('userEmail');
    alert('Erfolgreich ausgeloggt');
    this.router.navigate(['/home']);
  }

}


