import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AdminService } from './admin.service';

/**
 * Service central pour les Feature Flags de l'utilisateur connecté.
 * Chargé au login, persiste en sessionStorage, lu par le menu.
 */
@Injectable({ providedIn: 'root' })
export class FeatureFlagService {

    private readonly STORAGE_KEY = 'userFeatureFlags';

    // Valeurs par défaut (tous activés si rien n'est chargé)
    private defaultFlags: { [key: string]: boolean } = {
        'ESPACE_ANALYSTE':    true,
        'LIVRABLES':          true,
        'LOGS_IA':            true,
        'ESPACE_DECISION':    true,
        'ESPACE_SUPERVISION': true
    };

    private flagsSubj = new BehaviorSubject<{ [key: string]: boolean }>(this.defaultFlags);
    flags$ = this.flagsSubj.asObservable();

    constructor(private adminService: AdminService) {}

    /** Charge les flags depuis le backend pour l'utilisateur connecté et les met en cache */
    loadFlagsForCurrentUser(email: string): Observable<{ [key: string]: boolean }> {
        if (!email) return of(this.defaultFlags);

        return this.adminService.getUserFeatures(email).pipe(
            tap(flags => {
                const merged = { ...this.defaultFlags, ...flags };
                this.flagsSubj.next(merged);
                sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
            }),
            catchError(err => {
                console.warn('[FeatureFlag] Impossible de charger les flags, utilisation des valeurs par défaut', err);
                // Essayer depuis le cache
                const cached = this.loadFromCache();
                if (cached) this.flagsSubj.next(cached);
                return of(cached || this.defaultFlags);
            })
        );
    }

    /** Charge depuis le sessionStorage (après refresh de page) */
    loadFromCache(): { [key: string]: boolean } | null {
        const stored = sessionStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch { return null; }
        }
        return null;
    }

    /** Initialise depuis le cache si disponible (appelé au démarrage) */
    initFromCache(): void {
        const cached = this.loadFromCache();
        if (cached) {
            this.flagsSubj.next(cached);
        }
    }

    /** Retourne la valeur actuelle d'un flag spécifique */
    isEnabled(moduleCode: string): boolean {
        return this.flagsSubj.getValue()[moduleCode] ?? true;
    }

    /** Remet à zéro au logout */
    clearFlags(): void {
        sessionStorage.removeItem(this.STORAGE_KEY);
        this.flagsSubj.next(this.defaultFlags);
    }

    /** Snapshot des flags actuels */
    get currentFlags(): { [key: string]: boolean } {
        return this.flagsSubj.getValue();
    }
}
