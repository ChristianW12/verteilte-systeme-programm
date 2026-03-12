import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email = '';
  password = '';

  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  onLogin() {
    const loginData = {
      email: this.email,
      password: this.password
    };

    // Die URL muss später mit der tatsächlichen Backend-URL übereinstimmen
    this.http.post('http://localhost:3000/api/auth/login', loginData)
      .subscribe({
        next: (response: any) => {
          console.log('Login erfolgreich:', response);

          // 1. Status und Nutzerdaten lokal speichern
          // Später speichern wir hier den JWT-Token
          localStorage.setItem('isLoggedIn', 'true');
          // Wir gehen davon aus, dass das Backend userId und email zurückschickt
          if (response.user) {
            localStorage.setItem('userId', response.user.id);
            localStorage.setItem('userEmail', response.user.email);
          }

          // 2. Wohin wollen wir den Nutzer schicken?
          // Entweder zur ursprünglich angefragten URL oder zum Dashboard
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
          this.router.navigate([returnUrl]);
        },
        error: (err) => {
          console.error('Login-Fehler:', err);
          alert('Anmeldung fehlgeschlagen. Bitte prüfe deine E-Mail und dein Passwort.');
        }
      });
  }
}
