import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  // Prüfen, ob der Nutzer eingeloggt ist (sessionStorage)
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';

  if (isLoggedIn) {
    return true; // Zugriff erlaubt
  } else {
    // Nicht eingeloggt -> Zur Login-Seite umleiten
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
};


