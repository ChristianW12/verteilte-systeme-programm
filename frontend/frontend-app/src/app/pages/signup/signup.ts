import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

// Response-Typ vom Signup-Endpoint
type SignupResponse = {
  message: string;
  userId?: number;
};

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  // Eingabefelder
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  isSubmitting = false;

  // Regex für E-Mail Formatvalidierung
  private emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private http = inject(HttpClient);
  private router = inject(Router);

  // Validiert Eingaben, sendet Signup-Anfrage, navigiert bei Erfolg zum Login
  onSignup() {
    if (!this.correctInput()) {
      return;
    }

    // Loading-Flag setzen: Button wird disabled während Request läuft
    this.isSubmitting = true;

    // Daten für Backend vorbereiten
    const payload = {
      username: this.username,
      email: this.email,
      password: this.password,
    };

    // POST-Request an Backend
    this.http.post<SignupResponse>('/api/auth/signup', payload).subscribe({
      // Erfolg: Benachrichtigung anzeigen und zum Login navigieren
      next: () => {
        this.isSubmitting = false;
        alert('Registrierung erfolgreich');
        this.router.navigate(['/login']);
      },
      // Fehler: je nach HTTP-Status unterschiedliche Fehlermeldung anzeigen
      error: (err: HttpErrorResponse) => {
        // 409: E-Mail existiert bereits
        if (err.status === 409) {
          alert(err.error?.message || 'E-Mail bereits vergeben');
        }
        // 400: Validierungsfehler (zu kurz/lang etc.)
        if (err.status === 400) {
          alert(err.error?.message || 'Ungültige Eingabedaten');
        }
        this.isSubmitting = false;
      },
    });
  }

  // Validiert: alle Felder gefüllt, Längen, E-Mail Format, Passwörter gleich
  correctInput(): boolean {

    let fehlermeldung = '';

    // Prüfe: Alle erforderlichen Felder ausfüllen
    if (!this.username || !this.email || !this.password || !this.confirmPassword) {
      fehlermeldung += 'Bitte alle Felder ausfüllen\n';
    }

    // Username-Validierung: 3-30 Zeichen
    if (this.username.trim().length < 3) {
      fehlermeldung += 'Nickname muss mindestens 3 Zeichen haben\n';
    }

    if (this.username.trim().length > 30) {
      fehlermeldung += 'Nickname darf maximal 30 Zeichen haben\n';
    }

    // Email-Validierung: Format + max 50 Zeichen
    if (!this.emailRegex.test(this.email.trim())) {
      fehlermeldung += 'Bitte eine gültige E-Mail eingeben (z. B. name@domain.de)\n';
    }

    if (this.email.trim().length > 50) {
      fehlermeldung += 'E-Mail darf maximal 50 Zeichen haben\n';
    }

    // Passwort-Validierung: 8-100 Zeichen + beide Felder identisch
    if (this.password.length < 8) {
      fehlermeldung += 'Passwort muss mindestens 8 Zeichen haben\n';
    }

    if (this.password.length > 100) {
      fehlermeldung += 'Passwort darf maximal 100 Zeichen haben\n';
    }

    if (this.password !== this.confirmPassword) {
      fehlermeldung += 'Passwörter stimmen nicht überein\n';
    }

    // Wenn Fehler gefunden: Fehler anzeigen und false zurückgeben
    if (fehlermeldung) {
      alert(fehlermeldung);
      return false;
    }
    return true;
  }
}

