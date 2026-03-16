import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  isSubmitting = false;

  private http = inject(HttpClient);
  private router = inject(Router);

  onSignup() {
    if (!this.username || !this.email || !this.password || !this.confirmPassword) {
      alert('Bitte alle Felder ausfüllen');
      return;
    }

    if (this.password !== this.confirmPassword) {
      alert('Passwörter stimmen nicht überein');
      return;
    }

    this.isSubmitting = true;

    const payload = {
      username: this.username,
      email: this.email,
      password: this.password
    };

    this.http.post<SignupResponse>('http://localhost:3000/api/auth/signup', payload)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          alert('Registrierung erfolgreich');
          this.router.navigate(['/login']);
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            alert(err.error?.message || 'E-Mail bereits vergeben');
          }
          if (err.status === 400) {
            alert(err.error?.message || 'Ungültige Eingabedaten');
          }
          this.isSubmitting = false;
          
        }
      });
  }
}