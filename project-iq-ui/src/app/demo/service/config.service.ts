import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ScoringConfig {
    seuilNogo: number;
    seuilGo: number;
    weightA: number; // Rentabilité
    weightB: number; // Risques
    weightC: number; // Concurrence
    weightD: number; // Complexité
    weightE: number; // Stratégique
    minTjm: number;
    seuilCompatCompetences: number;
    seuilCompatExperts: number;
    seuilAlignementOui: number;
    seuilAlignementPartiel: number;
}

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    private API_URL = 'http://localhost:8089/api/admin/scoring-config';

    constructor(private http: HttpClient) {}

    getConfig(): Observable<ScoringConfig> {
        return this.http.get<ScoringConfig>(this.API_URL).pipe(
            catchError(() => of(this.getMockConfig()))
        );
    }

    getConfigForDossier(dossierId: string): Observable<ScoringConfig> {
        if (!dossierId) return this.getConfig();
        return this.http.get<ScoringConfig>(`${this.API_URL}/dossier/${dossierId}`).pipe(
            catchError(() => this.getConfig())
        );
    }

    saveConfig(config: ScoringConfig): Observable<any> {
        return this.http.put<any>(this.API_URL, config).pipe(
            catchError(() => {
                sessionStorage.setItem('scoringConfig', JSON.stringify(config));
                return of({ status: 'SUCCESS', message: 'Configuration globale enregistrée (Offline)' });
            })
        );
    }

    saveConfigForDossier(dossierId: string, config: ScoringConfig): Observable<any> {
        if (!dossierId) return this.saveConfig(config);
        return this.http.put<any>(`${this.API_URL}/dossier/${dossierId}`, config).pipe(
            catchError(() => {
                sessionStorage.setItem(`scoringConfig_${dossierId}`, JSON.stringify(config));
                return of({ status: 'SUCCESS', message: 'Configuration spécifique enregistrée (Offline)' });
            })
        );
    }

    private getMockConfig(): ScoringConfig {
        const stored = sessionStorage.getItem('scoringConfig');
        if (stored) {
            try { return JSON.parse(stored); } catch { }
        }
        return {
            seuilNogo: 20,
            seuilGo: 70,
            weightA: 25,
            weightB: 25,
            weightC: 25,
            weightD: 15,
            weightE: 10,
            minTjm: 500,
            seuilCompatCompetences: 0.50,
            seuilCompatExperts: 0.40,
            seuilAlignementOui: 0.80,
            seuilAlignementPartiel: 0.50
        };
    }
}
