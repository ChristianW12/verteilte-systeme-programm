import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpInterceptorFn, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

const includeCredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  // Hängt Credentials an jeden Request, damit Browser Auth-Cookies automatisch mitschickt.
  return next(req.clone({ withCredentials: true }));
};

// Angular App Konfiguration mit Router, HTTP Client und Hydration
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([includeCredentialsInterceptor])),
    provideClientHydration(withEventReplay())
  ]
};

