import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getSessionStorage } from '../../utils/storage';

// Response-Typ vom Login-Endpoint
type LoginResponse = {
  message: string;
  user?: {
    id?: number;
    email?: string;
  };
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  // Eingabefelder für E-Mail und Passwort
  email = '';
  password = '';

  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Login-Anfrage senden, Session speichern, zur vorherigen Seite navigieren
  onLogin() {
    // Daten für Backend vorbereiten
    const loginData = {
      email: this.email,
      password: this.password
    };

    // POST-Request an Backend
    this.http.post<LoginResponse>('/api/auth/login', loginData)
      .subscribe({
        // Erfolg: Response verarbeiten und Session speichern
        next: (response) => {
          console.log('Login erfolgreich:', response);
          const storage = getSessionStorage();

          // Daten aus Response auslesen
          const userId = response.user?.id;
          const userEmail = response.user?.email;

          // Validierung: user.id und user.email müssen vorhanden sein
          if (userId == null || !userEmail) {
            console.error('Ungueltige Login-Response: user.id oder user.email fehlt', response);
            // Session-Daten bereinigen bei ungültiger Response
            storage?.removeItem('isLoggedIn');
            storage?.removeItem('userId');
            storage?.removeItem('userEmail');
            alert('Login-Antwort vom Server ist unvollstaendig. Bitte erneut versuchen.');
            return;
          }

          // Session-Daten speichern im Session Storage
          storage?.setItem('isLoggedIn', 'true');
          storage?.setItem('userId', String(userId));
          storage?.setItem('userEmail', userEmail);

          // Zur returnUrl navigieren (oder Dashboard als Fallback)
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        // Fehler: Fehlermeldung anzeigen
        error: (err) => {
          console.error('Login-Fehler:', err);
          alert('Anmeldung fehlgeschlagen. Bitte prüfe deine E-Mail und dein Passwort.');
        }
      });
  }
}


