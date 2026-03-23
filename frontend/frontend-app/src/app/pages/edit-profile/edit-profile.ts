import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-edit-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-profile.html',
  styleUrls: ['./edit-profile.css'],
})
export class EditProfile implements OnInit {

  private http = inject(HttpClient);
  private router = inject(Router);

  username = signal('');
  email = signal('');
  neuesPassword = signal('');
  passwortBestaetigen = signal('');
  aktuellesPassword = signal('');

  private userId = signal(localStorage.getItem('userId') || '');
  private emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  ngOnInit() {

    if (!this.userId()) {
      alert('Benutzer nicht gefunden. Bitte erneut anmelden.');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 1000);
      return;
    }

    this.http.post('/api/auth/profile', { userId: this.userId() })
      .subscribe({
        next: (response: any) => {
          this.username.set(response.user.username || '');
          this.email.set(response.user.email || '');
        },
        error: (err) => {
          console.error('Fehler beim Laden des Profils:', err);
          alert('Fehler beim Laden des Profils. Bitte erneut versuchen.');
        }
      })

  }

  saveProfile() {
    if (!this.validateInput()) {
      return;
    }

    const payload: any = {
      userId: this.userId(),
      username: this.username(),
      email: this.email(),
    };

    if (this.neuesPassword()) {
      payload.neuesPassword = this.neuesPassword();
    }

    this.http.post('/api/auth/profile/update', payload)
      .subscribe({
        next: () => {
          this.neuesPassword.set('');
          this.passwortBestaetigen.set('');
          setTimeout(() => {
            alert('Profil erfolgreich aktualisiert.');
            this.router.navigate(['/profile']);
          }, 100);
        },
        error: (err) => {
          console.error('Fehler beim Aktualisieren des Profils:', err);
          alert('Fehler beim Speichern des Profils. Bitte erneut versuchen.');
        }
      });
  }

  validateInput(): boolean {
    let fehlermeldung = '';

    if (!this.username() || !this.email()) {
      fehlermeldung += 'Bitte Benutzername und E-Mail ausfüllen.\n';
    }

    if (this.username().trim().length < 3) {
      fehlermeldung += 'Benutzername muss mindestens 3 Zeichen haben.\n';
    }

    if (this.username().trim().length > 30) {
      fehlermeldung += 'Benutzername darf maximal 30 Zeichen haben.\n';
    }

    if (!this.emailRegex.test(this.email().trim())) {
      fehlermeldung += 'Bitte eine gültige E-Mail eingeben (z. B. name@domain.de)\n';
    }

    if (this.email().trim().length > 50) {
      fehlermeldung += 'E-Mail darf maximal 50 Zeichen haben.\n';
    }

    if (this.neuesPassword() && this.neuesPassword().length < 8) {
      fehlermeldung += 'Passwort muss mindestens 8 Zeichen haben.\n';
    }

    if (this.neuesPassword() && this.neuesPassword().length > 100) {
      fehlermeldung += 'Passwort darf maximal 100 Zeichen haben.\n';
    }

    if (this.neuesPassword() && this.neuesPassword() !== this.passwortBestaetigen()) {
      fehlermeldung += 'Passwörter stimmen nicht überein.\n';
    }

    if (fehlermeldung) {
      alert(fehlermeldung);
      return false;
    }

    return true;
  }

  cancel() {
    try {
      this.router.navigate(['/profile']);
    } catch (e) {
      this.router.navigate(['/']);
    }
  }

  deleteProfile() {
    const confirmed = confirm(
      'Bist du sicher, dass du dein Profil löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.'
    );

    if (!confirmed) {
      return;
    }

    this.http.post('/api/auth/profile/delete', { userId: this.userId() })
      .subscribe({
        next: (res: any) => {
          alert('Profil erfolgreich gelöscht. Du wirst abgemeldet.');
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('userId');
          localStorage.removeItem('userEmail');
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 1000);
        },
        error: (err) => {
          console.error('Fehler beim Löschen des Profils:', err);
          alert('Fehler beim Löschen des Profils. Bitte später erneut versuchen.');
        }
      });
  }

}
