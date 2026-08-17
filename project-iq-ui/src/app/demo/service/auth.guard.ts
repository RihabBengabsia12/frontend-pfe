import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isLoggedIn()) {
        return router.createUrlTree(['/landing']);
    }

    // Double sécurité : un GUEST ne peut pas accéder au dashboard
    const role = sessionStorage.getItem('userRole');
    const roleUpper = role ? role.toUpperCase() : 'GUEST';
    
    if (roleUpper === 'GUEST' || roleUpper === 'PENDING' || !['ADMIN', 'MANAGER', 'USER', 'ANALYST'].includes(roleUpper)) {
        return router.createUrlTree(['/auth/pending']);
    }

    return true;
};
