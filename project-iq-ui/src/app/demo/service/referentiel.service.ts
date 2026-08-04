import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

export interface Competence {
    id?: string;
    domaine: string;
    sousDomaine?: string;
    niveau?: string;
    motsCles?: string[];
    actif?: boolean;
}

export interface ReferenceProjet {
    id?: string;
    titre: string;
    client?: string;
    pays?: string;
    secteur?: string;
    bailleur?: string;
    annee?: number;
    dureeMois?: number;
    budgetEuros?: number;
    hommesMois?: number;
    descriptionCourte?: string;
    actif?: boolean;
}

export interface ExpertProfil {
    id?: string;
    nom: string;
    specialites?: string[];
    langues?: string[];
    anneesExperience?: number;
    disponibleDu?: string; // YYYY-MM-DD
    disponibleAu?: string; // YYYY-MM-DD
    tauxJournalier?: number;
    actif?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class ReferentielService {
    
    // We point directly to /api/analyses/referentiel to match Gateway config
    private baseUrl = '/api/analyses/referentiel';

    constructor(private http: HttpClient) {}

    // --- COMPÉTENCES ---
    getCompetences(): Observable<Competence[]> {
        return this.http.get<Competence[]>(`${this.baseUrl}/competences`).pipe(catchError(this.handleError));
    }

    createCompetence(comp: Competence): Observable<Competence> {
        return this.http.post<Competence>(`${this.baseUrl}/competences`, comp).pipe(catchError(this.handleError));
    }

    updateCompetence(id: string, comp: Competence): Observable<Competence> {
        return this.http.put<Competence>(`${this.baseUrl}/competences/${id}`, comp).pipe(catchError(this.handleError));
    }

    deleteCompetence(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/competences/${id}`).pipe(catchError(this.handleError));
    }

    // --- RÉFÉRENCES ---
    getReferences(): Observable<ReferenceProjet[]> {
        return this.http.get<ReferenceProjet[]>(`${this.baseUrl}/references`).pipe(catchError(this.handleError));
    }

    createReference(ref: ReferenceProjet): Observable<ReferenceProjet> {
        return this.http.post<ReferenceProjet>(`${this.baseUrl}/references`, ref).pipe(catchError(this.handleError));
    }

    updateReference(id: string, ref: ReferenceProjet): Observable<ReferenceProjet> {
        return this.http.put<ReferenceProjet>(`${this.baseUrl}/references/${id}`, ref).pipe(catchError(this.handleError));
    }

    deleteReference(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/references/${id}`).pipe(catchError(this.handleError));
    }

    // --- EXPERTS ---
    getExperts(): Observable<ExpertProfil[]> {
        return this.http.get<ExpertProfil[]>(`${this.baseUrl}/experts`).pipe(catchError(this.handleError));
    }

    createExpert(exp: ExpertProfil): Observable<ExpertProfil> {
        return this.http.post<ExpertProfil>(`${this.baseUrl}/experts`, exp).pipe(catchError(this.handleError));
    }

    updateExpert(id: string, exp: ExpertProfil): Observable<ExpertProfil> {
        return this.http.put<ExpertProfil>(`${this.baseUrl}/experts/${id}`, exp).pipe(catchError(this.handleError));
    }

    deleteExpert(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/experts/${id}`).pipe(catchError(this.handleError));
    }

    // --- QUALIFICATIONS ---
    getQualifications(): Observable<string[]> {
        return this.http.get<string[]>(`${this.baseUrl}/qualifications`).pipe(catchError(this.handleError));
    }

    private handleError(error: any) {
        console.error('API Error:', error);
        return throwError(() => error);
    }
}
