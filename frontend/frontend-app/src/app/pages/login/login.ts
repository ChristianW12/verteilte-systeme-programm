import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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

    this.http.post<LoginResponse>('/api/auth/login', loginData)
      .subscribe({
        next: (response) => {
          console.log('Login erfolgreich:', response);

          const userId = response.user?.id;
          const userEmail = response.user?.email;

          if (userId == null || !userEmail) {
            console.error('Ungueltige Login-Response: user.id oder user.email fehlt', response);
            sessionStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('userId');
            sessionStorage.removeItem('userEmail');
            alert('Login-Antwort vom Server ist unvollstaendig. Bitte erneut versuchen.');
            return;
          }

          sessionStorage.setItem('isLoggedIn', 'true');
          sessionStorage.setItem('userId', String(userId));
          sessionStorage.setItem('userEmail', userEmail);

          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          console.error('Login-Fehler:', err);
          alert('Anmeldung fehlgeschlagen. Bitte prüfe deine E-Mail und dein Passwort.');
        }
      });
  }
}


