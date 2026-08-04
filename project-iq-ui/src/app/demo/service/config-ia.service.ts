import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ConfigIaService {
    private apiUrl = '/api/ia-config/prompts';
    private overrideUrl = '/api/dossiers/config-ia/overrides';

    constructor(private http: HttpClient) {}

    getAllPrompts(): Observable<{ [key: string]: string }> {
        return this.http.get<{ [key: string]: string }>(this.apiUrl);
    }

    updatePrompt(filename: string, content: string): Observable<any> {
        return this.http.put(`${this.apiUrl}/${filename}`, { content });
    }

    getDossierOverrides(dossierId: string): Observable<{ [key: string]: string }> {
        return this.http.get<{ [key: string]: string }>(`${this.overrideUrl}/${dossierId}`);
    }

    updateDossierOverride(dossierId: string, filename: string, content: string): Observable<any> {
        return this.http.put(`${this.overrideUrl}/${dossierId}/${filename}`, { content });
    }
}
