import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { getSessionStorage } from './utils/storage';

// Authentifizierung mit sessionStorage Check, leitet zu Login falls nicht eingeloggt
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const storage = getSessionStorage();

  // Prüfen, ob der Nutzer eingeloggt ist (sessionStorage)
  const isLoggedIn = storage?.getItem('isLoggedIn') === 'true';

  if (isLoggedIn) {
    return true; // Zugriff erlaubt
  } else {
    // Nicht eingeloggt -> Zur Login-Seite umleiten
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
};


