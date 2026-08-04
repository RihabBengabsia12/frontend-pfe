import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface Delegation {
    id: string;
    roleName: string;
    displayName: string;
    email: string;
    threshold?: number;
}

@Injectable({
    providedIn: 'root'
})
export class DelegationService {

    private apiUrl = `${environment.apiUrl || 'http://localhost:8089'}/api/delegations`;

    constructor(private http: HttpClient) { }

    getAllDelegations(): Observable<Delegation[]> {
        return this.http.get<Delegation[]>(this.apiUrl);
    }

    updateDelegation(id: string, delegation: Partial<Delegation>): Observable<Delegation> {
        return this.http.put<Delegation>(`${this.apiUrl}/${id}`, delegation);
    }
}
