import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ManagerValidationService {

  private apiUrl = `${environment.apiUrl || 'http://localhost:8089'}/api/validation`;

  constructor(private http: HttpClient) { }

  getPendingValidations(email: string): Observable<any[]> {
    let params = new HttpParams().set('email', email);
    return this.http.get<any[]>(`${this.apiUrl}/pending`, { params });
  }

  processAction(token: string, action: string, commentaire: string): Observable<any> {
    let params = new HttpParams()
      .set('action', action)
      .set('commentaire', commentaire);
    
    return this.http.put<any>(`${this.apiUrl}/token/${token}`, null, { params });
  }

  // --- NOUVELLES METHODES POUR LES DOSSIERS (NO-GO) ---
  private dossiersUrl = `${environment.apiUrl || 'http://localhost:8089'}/api/dossiers`;

  getPendingNoGoDossiers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.dossiersUrl}/manager/pending-nogo`);
  }

  updateDossierStatus(dossierId: string, status: string): Observable<any> {
    let params = new HttpParams().set('status', status);
    return this.http.put<any>(`${this.dossiersUrl}/${dossierId}/status`, null, { params });
  }

  // --- POUR LES RAPPORTS D'AUDIT (ARCHIVED) ---
  getArchivedDossiers(): Observable<any[]> {
    return this.http.get<any[]>(this.dossiersUrl).pipe(
      // On filtre côté client car getAll() ramène tout
      // Dans un cas réel avec beaucoup de dossiers, on ferait une route backend spécifique
      map(dossiers => dossiers.filter(d => d.status === 'ARCHIVED'))
    );
  }

  // --- POUR L'HISTORIQUE DES PACKS (SUPERVISION) ---
  getDossiersWithPacks(): Observable<any[]> {
    return this.http.get<any[]>(this.dossiersUrl).pipe(
      map(dossiers => dossiers.filter(d => 
        ['PACK_READY', 'PENDING_VALIDATION', 'SUBMITTED', 'AUDIT', 'ARCHIVED'].includes(d.status) || 
        d.packGlobalPath != null
      ))
    );
  }

  // --- POUR L'HISTORIQUE DES NO-GO (SUPERVISION) ---
  getDossiersWithNoGo(): Observable<any[]> {
    return this.http.get<any[]>(this.dossiersUrl).pipe(
      map(dossiers => dossiers.filter(d => d.nogoReportPath != null))
    );
  }

  // --- POUR L'HISTORIQUE DES DECISIONS (SUPERVISION) ---
  getDossiersWithDecisions(): Observable<any[]> {
    return this.http.get<any[]>(this.dossiersUrl).pipe(
      map(dossiers => dossiers.filter(d => 
        ['PENDING_VALIDATION', 'SUBMITTED', 'AUDIT', 'ARCHIVED'].includes(d.status)
      ))
    );
  }

  getValidationStatus(dossierId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${dossierId}/status`);
  }

  // --- POUR LE SUIVI GLOBAL DES PACKS KANBAN (SUPERVISION) ---
  getDossiersForSuivi(): Observable<any[]> {
    return this.http.get<any[]>(this.dossiersUrl).pipe(
      map(dossiers => dossiers.filter(d => 
        ['MATCHING', 'DRAFTING', 'PACK_READY'].includes(d.status)
      ))
    );
  }
}
