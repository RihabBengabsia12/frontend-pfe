import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProjectDTO {
    id?: string;
    title: string;
    description: string;
    budget: number;
    status: string;
    tdrContent?: string; // Content of TDR mapping JSON
}

@Injectable({
    providedIn: 'root'
})
export class ProjectService {
    private API_URL = '/api/projects';

    constructor(private http: HttpClient) { }

    getProjects(): Observable<ProjectDTO[]> {
        return this.http.get<ProjectDTO[]>(this.API_URL);
    }

    getTdrJson(projectId: string): Observable<any> {
        return this.http.get<any>(`${this.API_URL}/${projectId}/tdr`);
    }

    assignExpert(projectId: string, expertId: string): Observable<any> {
        // Envoie de l'affectation à l'endpoint de mise à jour de relation
        return this.http.post(`${this.API_URL}/assign`, { projectId, expertId });
    }
}
