import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
    private API_URL = '/api/config/scoring';

    constructor(private http: HttpClient) {}

    getConfig(): Observable<ScoringConfig> {
        return this.http.get<any>(this.API_URL).pipe(
            map(raw => this.fromApiConfig(raw)),
            catchError(() => of(this.getMockConfig()))
        );
    }

    getConfigForDossier(dossierId: string): Observable<ScoringConfig> {
        if (!dossierId) return this.getConfig();
        return this.http.get<any>(`${this.API_URL}/dossier/${dossierId}`).pipe(
            map(raw => this.fromApiConfig(raw)),
            catchError(() => of(this.getMockConfig()))
        );
    }

    saveConfig(config: ScoringConfig): Observable<any> {
        return this.http.put<any>(this.API_URL, this.toApiConfig(config));
    }

    saveConfigForDossier(dossierId: string, config: ScoringConfig): Observable<any> {
        if (!dossierId) return this.saveConfig(config);
        return this.http.put<any>(`${this.API_URL}/dossier/${dossierId}`, this.toApiConfig(config));
    }

    /** Adapte le contrat Java aux pourcentages affichés dans l'interface Admin. */
    private fromApiConfig(raw: any): ScoringConfig {
        const numberOr = (value: unknown, fallback: number) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        return {
            seuilNogo: numberOr(raw?.seuilNoGo ?? raw?.seuilNogo, 20),
            seuilGo: numberOr(raw?.seuilGoFort ?? raw?.seuilGo, 70),
            weightA: numberOr(raw?.poidsA_faisabilite, 0.25) * 100,
            weightB: numberOr(raw?.poidsB_rentabilite, 0.25) * 100,
            weightC: numberOr(raw?.poidsC_risques, 0.25) * 100,
            weightD: numberOr(raw?.poidsD_concurrence, 0.15) * 100,
            weightE: numberOr(raw?.poidsE_conformite, 0.10) * 100,
            minTjm: numberOr(raw?.tjmMinEgis ?? raw?.minTjm, 350),
            seuilCompatCompetences: numberOr(raw?.seuilCompatCompetences, 0.50),
            seuilCompatExperts: numberOr(raw?.seuilCompatExperts, 0.40),
            seuilAlignementOui: numberOr(raw?.seuilAlignementOui, 0.80),
            seuilAlignementPartiel: numberOr(raw?.seuilAlignementPartiel, 0.50)
        };
    }

    private toApiConfig(config: ScoringConfig): any {
        return {
            seuilNoGo: config.seuilNogo,
            seuilGoConditionnel: (Number(config.seuilNogo) + Number(config.seuilGo)) / 2,
            seuilGoFort: config.seuilGo,
            poidsA_faisabilite: Number(config.weightA) / 100,
            poidsB_rentabilite: Number(config.weightB) / 100,
            poidsC_risques: Number(config.weightC) / 100,
            poidsD_concurrence: Number(config.weightD) / 100,
            poidsE_conformite: Number(config.weightE) / 100,
            tjmMinEgis: config.minTjm,
            tjmMaxEgis: 3000,
            seuilCompatCompetences: config.seuilCompatCompetences,
            seuilCompatExperts: config.seuilCompatExperts
        };
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
