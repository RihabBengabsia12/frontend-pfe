import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { NotfoundComponent } from './demo/components/notfound/notfound.component';
import { AppLayoutComponent } from "./layout/app.layout.component";
import { authGuard } from './demo/service/auth.guard';
import { ResetPasswordComponent } from './demo/components/auth/reset-password/reset-password.component';

@NgModule({
    imports: [
        RouterModule.forRoot([
            { path: 'reset-password', component: ResetPasswordComponent },
            { path: 'auth', loadChildren: () => import('./demo/components/auth/auth.module').then(m => m.AuthModule) },
            { path: '', redirectTo: '/landing', pathMatch: 'full' },
            {
                path: '', component: AppLayoutComponent,
                canActivate: [authGuard],
                children: [
                    { path: 'dashboard', loadChildren: () => import('./demo/components/dashboard/dashboard.module').then(m => m.DashboardModule) },
                    { path: 'uikit', loadChildren: () => import('./demo/components/uikit/uikit.module').then(m => m.UIkitModule) },
                    { path: 'utilities', loadChildren: () => import('./demo/components/utilities/utilities.module').then(m => m.UtilitiesModule) },
                    { path: 'documentation', loadChildren: () => import('./demo/components/documentation/documentation.module').then(m => m.DocumentationModule) },
                    { path: 'blocks', loadChildren: () => import('./demo/components/primeblocks/primeblocks.module').then(m => m.PrimeBlocksModule) },
                    { path: 'pages', loadChildren: () => import('./demo/components/pages/pages.module').then(m => m.PagesModule) },
                    { path: 'admin', loadChildren: () => import('./demo/components/admin/admin.module').then(m => m.AdminModule) },
                    { path: 'analyst', loadChildren: () => import('./demo/components/analyst/analyst.module').then(m => m.AnalystModule) },
                    { path: 'dossiers', loadChildren: () => import('./demo/components/analyst/analyst.module').then(m => m.AnalystModule) },
                    { path: 'manager', loadChildren: () => import('./demo/components/manager/manager.module').then(m => m.ManagerModule) }
                ]
            },
            { path: 'landing', loadChildren: () => import('./demo/components/landing/landing.module').then(m => m.LandingModule) },
            { path: 'notfound', component: NotfoundComponent },
            { path: '**', redirectTo: '/notfound' },
        ], { scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled', onSameUrlNavigation: 'reload' })
    ],
    exports: [RouterModule]
})
export class AppRoutingModule {
}
