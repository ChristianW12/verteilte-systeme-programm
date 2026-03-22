import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-edit-profile',
  imports: [FormsModule],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.css',
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

  ngOnInit() {

    if (!this.userId()) {
      alert('Benutzer nicht gefunden. Bitte erneut anmelden.');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 1000);
      return;
    }

    if(this.neuesPassword != this.passwortBestaetigen){
      alert('Passwörter stimmen nicht überein.');
      return;
    }

    this.http.post('/api/auth/profile', { userId: this.userId() })
      .subscribe({
        next: (response: any) => {
          this.username.set(response.user.username);
          this.email.set(response.user.email);
          this.aktuellesPassword.set(response.user.password);
        },
        error: (err) => {
          console.error('Fehler beim Laden des Profils:', err);
          alert('Fehler beim Laden des Profils. Bitte erneut versuchen.');
        }
      })


  }

}
