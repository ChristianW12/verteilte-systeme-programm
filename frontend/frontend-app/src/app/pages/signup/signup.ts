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
  private emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private http = inject(HttpClient);
  private router = inject(Router);

  // Registriert neuen Benutzer
  onSignup() {
    if (!this.correctInput()) {
      return;
    }

    this.isSubmitting = true;

    const payload = {
      username: this.username,
      email: this.email,
      password: this.password,
    };

    this.http.post<SignupResponse>('/api/auth/signup', payload).subscribe({
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
      },
    });
  }

  // Validiert Username, Email, Passwort-Anforderungen
  correctInput(): boolean {

    let fehlermeldung = '';

    if (!this.username || !this.email || !this.password || !this.confirmPassword) {
      fehlermeldung += 'Bitte alle Felder ausfüllen\n';
    }

    // Username-Validierung
    if (this.username.trim().length < 3) {
      fehlermeldung += 'Nickname muss mindestens 3 Zeichen haben\n';
    }

    if (this.username.trim().length > 30) {
      fehlermeldung += 'Nickname darf maximal 30 Zeichen haben\n';
    }

    // Email-Validierung
    if (!this.emailRegex.test(this.email.trim())) {
      fehlermeldung += 'Bitte eine gültige E-Mail eingeben (z. B. name@domain.de)\n';
    }

    if (this.email.trim().length > 50) {
      fehlermeldung += 'E-Mail darf maximal 50 Zeichen haben\n';
    }

    // Passwort-Validierung
    if (this.password.length < 8) {
      fehlermeldung += 'Passwort muss mindestens 8 Zeichen haben\n';
    }

    if (this.password.length > 100) {
      fehlermeldung += 'Passwort darf maximal 100 Zeichen haben\n';
    }

    if (this.password !== this.confirmPassword) {
      fehlermeldung += 'Passwörter stimmen nicht überein\n';
    }

    if (fehlermeldung) {
      alert(fehlermeldung);
      return false;
    }
    return true;
  }
}

