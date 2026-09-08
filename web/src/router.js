import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/Home.vue') },
    { path: '/import/roster', component: () => import('./views/ImportRoster.vue') },
    { path: '/import/schedule', component: () => import('./views/ImportSchedule.vue') },
    { path: '/teams', component: () => import('./views/Teams.vue') },
    { path: '/teams/:id', component: () => import('./views/TeamDetail.vue') },
    { path: '/schedule', component: () => import('./views/Schedule.vue') },
    { path: '/matches/:id/checkin', component: () => import('./views/MatchCheckin.vue') },
    { path: '/results', component: () => import('./views/StageResults.vue') },
    { path: '/display', component: () => import('./views/Display.vue'), meta: { bare: true } },
  ],
});
