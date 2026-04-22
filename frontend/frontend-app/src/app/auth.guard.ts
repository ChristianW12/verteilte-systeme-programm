import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { getSessionStorage } from './utils/storage';

function clearUiSessionCache(storage: Storage | null): void {
  storage?.removeItem('userId');
  storage?.removeItem('userEmail');
  storage?.removeItem('isLoggedIn');
  storage?.removeItem('passwordHash');
}

export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const storage = getSessionStorage();
  const loginRedirectTree = router.createUrlTree(
    ['/login'],
    { queryParams: { returnUrl: state.url } },
  );

  if (!storage) {
    return true;
  }

  const me$ = http.get<{ user?: { id?: string; email?: string } }>('/api/auth/session/me').pipe(
    map((response) => {
      if (!response?.user?.id || !response?.user?.email) {
        clearUiSessionCache(storage);
        return loginRedirectTree;
      }
      storage?.setItem('userId', String(response.user.id));
      storage?.setItem('userEmail', String(response.user.email));
      return true;
    }),
  );

  return me$.pipe(
    catchError(() =>
      http.post('/api/auth/refresh', {}).pipe(
        switchMap(() => me$),
        catchError(() => {
          clearUiSessionCache(storage);
          return of(loginRedirectTree);
        }),
      ),
    ),
  );
};
