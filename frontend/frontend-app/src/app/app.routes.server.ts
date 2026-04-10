// SSR Render-Modi: task/:id + project/:projectId dynamisch, andere prerendern
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'task/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'project/edit/:projectId',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];

