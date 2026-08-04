import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AnalystProjectsService } from './analyst-projects.service';
import { DossierStatusService } from './dossier-status.service';

/** Guard validation-p1 : autorise uniquement CORRECTION_LOOP */
export const validationP1Guard: CanActivateFn = (route) => {
    const projectsService = inject(AnalystProjectsService);
    const statusService = inject(DossierStatusService);
    const router = inject(Router);
    const id = route.paramMap.get('id');

    if (!id) {
        return router.createUrlTree(['/dossiers/nouveau']);
    }

    return projectsService.getDossier(id).pipe(
        map(dossier => {
            if (dossier.status === 'CORRECTION_LOOP') {
                return true;
            }
            return router.createUrlTree(statusService.resolveRoute(dossier));
        }),
        catchError(() => of(router.createUrlTree(['/dossiers'])))
    );
};

/** Guard générique : redirige si le statut ne correspond pas à la route attendue */
export const dossierStatusGuard = (allowedStatuses: string[]): CanActivateFn => (route) => {
    const projectsService = inject(AnalystProjectsService);
    const statusService = inject(DossierStatusService);
    const router = inject(Router);
    const id = route.paramMap.get('id');

    if (!id) {
        return router.createUrlTree(['/dossiers']);
    }

    return projectsService.getDossier(id).pipe(
        map(dossier => {
            if (allowedStatuses.includes(dossier.status)) {
                return true;
            }
            return router.createUrlTree(statusService.resolveRoute(dossier));
        }),
        catchError(() => of(router.createUrlTree(['/dossiers'])))
    );
};
