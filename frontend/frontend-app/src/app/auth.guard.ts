import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { getSessionStorage } from './utils/storage';

function clearAuthSession(storage: Storage | null): void {
  storage?.removeItem('isLoggedIn');
  storage?.removeItem('userId');
  storage?.removeItem('userEmail');
  storage?.removeItem('passwordHash');
}

// Authentifizierung mit Session-Validierung gegen Backend
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const storage = getSessionStorage();

  // Grundlegende Session-Werte prüfen
  const isLoggedIn = storage?.getItem('isLoggedIn') === 'true';
  const userId = String(storage?.getItem('userId') || '').trim();
  const passwordHash = String(storage?.getItem('passwordHash') || '').trim();
  const loginRedirectTree = router.createUrlTree(
    ['/login'],
    { queryParams: { returnUrl: state.url } },
  );

  if (!isLoggedIn || !userId || !passwordHash) {
    clearAuthSession(storage);
    return loginRedirectTree;
  }

  // Serverseitige Validierung: userId + passwordHash muessen zur DB passen
  return http.post<{ valid?: boolean }>('/api/auth/session/validate', { userId, passwordHash }).pipe(
    map((response) => {
      if (response?.valid === true) {
        return true;
      }
      clearAuthSession(storage);
      return loginRedirectTree;
    }),
    catchError(() => {
      clearAuthSession(storage);
      return of(loginRedirectTree);
    }),
  );
};

