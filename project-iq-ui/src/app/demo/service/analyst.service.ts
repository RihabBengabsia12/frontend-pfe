import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ExtractedProfile {
    id?: string;
    fullName: string;
    skills: string[];
    experience: string;
    rawJson?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AnalystService {
    private API_URL = '/api/analyses';

    constructor(private http: HttpClient) { }

    extractCv(file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<any>(`${this.API_URL}/extract`, formData);
    }

    updateExtractedProfile(profile: any): Observable<any> {
        return this.http.put<any>(`${this.API_URL}/profile`, profile);
    }

    getMatchingScore(projectId: string, expertId: string): Observable<{ score: number }> {
        return this.http.get<{ score: number }>(`${this.API_URL}/match`, {
            params: { projectId, expertId }
        });
    }

    getExperts(): Observable<any[]> {
        return this.http.get<any[]>(`${this.API_URL}/experts`);
    }
}
