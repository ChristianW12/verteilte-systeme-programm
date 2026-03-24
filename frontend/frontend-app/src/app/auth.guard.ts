import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  const canUseSessionStorage = typeof sessionStorage !== 'undefined';
  const isLoggedIn = canUseSessionStorage && sessionStorage.getItem('isLoggedIn') === 'true';

  if (isLoggedIn) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

