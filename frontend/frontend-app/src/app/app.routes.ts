import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Dashboard } from './pages/dashboard/dashboard';
import { Login } from './pages/login/login';
import { CreateTask } from './pages/create-task/create-task';
import { Profile } from './pages/profile/profile';
import { DetailedTask } from './pages/detailed-task/detailed-task';
import { authGuard } from './auth.guard'; 
import { Signup } from './pages/signup/signup';
import { Project } from './pages/project/project';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] }, // Geschützt
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'task', component: DetailedTask, canActivate: [authGuard] }, // Detailseite für Tasks
  { path: 'task/create', component: CreateTask, canActivate: [authGuard] }, // Geschützt
  { path: 'project', component: Project, canActivate: [authGuard] },
  {path: 'project/create', component: CreateTask, canActivate: [authGuard]}, 
  { path: 'profile', component: Profile, canActivate: [authGuard] }, // Geschützt
  { path: '**', component: Home },
];