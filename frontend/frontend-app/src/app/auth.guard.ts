import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  // Prüfen, ob der Nutzer eingeloggt ist (LocalStorage)
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  if (isLoggedIn) {
    return true; // Zugriff erlaubt
  } else {
    // Nicht eingeloggt -> Zur Login-Seite umleiten
    // Wir speichern die Ziel-URL, um den Nutzer nach dem Login dorthin zurückzuschicken (optional)
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
};
