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

    this.http.post('http://localhost:3000/api/auth/login', loginData)
      .subscribe({
        next: (response: any) => {
          console.log('Login erfolgreich:', response);

          localStorage.setItem('isLoggedIn', 'true');
          if (response.user) {
            localStorage.setItem('userId', response.id);
            localStorage.setItem('userEmail', response.email);
          }

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
