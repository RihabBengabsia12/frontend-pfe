import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface AiLog {
    id: string;
    dossierId: string;
    dossierTitle: string;
    actionType: string;
    modelUsed: string;
    tokensConsumed: number;
    estimatedCost: number;
    responseTimeMs: number;
    status: string;
    createdAt: string;
    rawJson?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AiLogsService {
    // Assuming project-service is running on 8083 (from previous context)
    private apiUrl = 'http://localhost:8083/api/ai-logs';

    constructor(private http: HttpClient) {}

    getLogs(): Observable<AiLog[]> {
        return this.http.get<AiLog[]>(this.apiUrl);
    }

    getLogsByDossierId(dossierId: string): Observable<AiLog[]> {
        return this.http.get<AiLog[]>(`${this.apiUrl}/dossier/${dossierId}`);
    }
}
