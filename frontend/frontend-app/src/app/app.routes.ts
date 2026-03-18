import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Dashboard } from './pages/dashboard/dashboard';
import { Login } from './pages/login/login';
import { CreateTask } from './pages/create-task/create-task';
import { Profile } from './pages/profile/profile';
import { DetailedTask } from './pages/detailed-task/detailed-task';
import { authGuard } from './auth.guard'; // Importiere den AuthGuard
import { Signup } from './pages/signup/signup';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] }, // Geschützt
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'create-task', component: CreateTask, canActivate: [authGuard] }, // Geschützt
  { path: 'profile', component: Profile, canActivate: [authGuard] }, // Geschützt
  { path: 'task', component: DetailedTask, canActivate: [authGuard] }, // Detailseite für Tasks
  { path: '**', component: Home },
];
