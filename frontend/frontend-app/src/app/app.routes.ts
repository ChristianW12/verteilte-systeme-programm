import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Dashboard } from './pages/dashboard/dashboard';
import { Login } from './pages/login/login';
import { CreateTask } from './pages/create-task/create-task';
import { Profile } from './pages/profile/profile';


export const routes: Routes = [
  { path: '', component: Home },
  {path: 'dashboard', component: Dashboard},
  {path: 'login', component: Login},
  {path: 'create-task', component: CreateTask},
  {path: 'profile', component: Profile},
  {path: '**', component: Home },  
];
