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
import { CreateProject } from './pages/create-project/create-project';
import { EditProject } from './pages/edit-project/edit-project';
import { EditProfile } from './pages/edit-profile/edit-profile';
import { Statistics } from './pages/statistics/statistics';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'task/create', component: CreateTask, canActivate: [authGuard] },
  { path: 'task/:id', component: DetailedTask, canActivate: [authGuard] },
  { path: 'project', component: Project, canActivate: [authGuard] },
  {path: 'project/create', component: CreateProject, canActivate: [authGuard]},
  {path: 'project/edit/:projectId', component: EditProject, canActivate: [authGuard]},
  { path: 'statistics', component: Statistics, canActivate: [authGuard] },
  { path: 'profile', component: Profile, canActivate: [authGuard] },
  {path: 'profile/edit', component: EditProfile, canActivate: [authGuard]},
  { path: '**', component: Home },
];

