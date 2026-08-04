import { Injectable } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';


// ─── DTOs correspondant exactement aux réponses Java ───────────────────────

export interface UserResponse {
    id: string;
    email: string;
    fullName: string;
    role: string;        // GUEST | ANALYST | MANAGER | ADMIN
    status: string;      // ACTIVE | INACTIVE | PENDING (accountStatus)
    accountStatus?: string;
    createdAt: string;
}

export interface SpringPage<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;      // page courante (0-based)
    size: number;
}


export interface DataEvent {
    id: string;
    actorUserId: string;
    entityName: string;
    entityId: string;
    action: string;
    oldData?: string;
    newData?: string;
    ressource: string;
    occurredAt: string;
    createdAt: string;
}


export interface Permission {
    id: string;
    code: string;
    label: string;
    category: string; // "Analyse", "Expertise", "Gestion"
}

export interface RoleWithPermissions {
    id: string; // UUID
    code: string;
    label: string;
    permissions: Permission[];
}

export interface RoleRequest {
    roleCode: string;
}

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable({
    providedIn: 'root'
})
export class AdminService {

    private ADMIN_URL = '/api/admin';

    constructor(private http: HttpClient) {}

    // ── UserController : GET /api/admin/users ──────────────────

    getUsers(page = 0, size = 20): Observable<SpringPage<UserResponse>> {
        const params = new HttpParams()
            .set('page', page)
            .set('size', size);

        return this.http.get<SpringPage<UserResponse>>(`${this.ADMIN_URL}/users`, { params });
    }





    // ── UserController : GET /api/admin/users/{id} ─────────────
    getUserById(id: string): Observable<UserResponse> {
        return this.http.get<UserResponse>(`${this.ADMIN_URL}/users/${id}`);
    }

    // ── UserController : PATCH /api/admin/users/{id}/role ──────
    assignRole(id: string, roleCode: string): Observable<UserResponse> {
        const body = { 
            role: roleCode,
            roleCode: roleCode 
        };
        return this.http.patch<UserResponse>(`${this.ADMIN_URL}/users/${id}/role`, body);
    }

    // ── UserController : PATCH /api/admin/users/{id}/toggle ────
    toggleStatus(id: string): Observable<UserResponse> {
        return this.http.patch<UserResponse>(`${this.ADMIN_URL}/users/${id}/toggle`, {});
    }

    // ── UserController : DELETE /api/admin/users/{id} ──────────
    deleteUser(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.ADMIN_URL}/users/${id}`);
    }

    // ── UserController : GET /api/admin/users/health ───────────
    getHealth(): Observable<{ status: string; service: string }> {
        return this.http.get<{ status: string; service: string }>(`${this.ADMIN_URL}/users/health`);
    }

    // ── AuditController : GET /api/admin/audit/data ────────────
    getAuditEvents(filters: {
        userId?: string;
        entity?: string;
        action?: string;
        page?: number;
        size?: number;
    }): Observable<SpringPage<DataEvent>> {
        let params = new HttpParams()
            .set('page', filters.page ?? 0)
            .set('size', filters.size ?? 20);
        if (filters.userId) params = params.set('userId', filters.userId);
        if (filters.entity) params = params.set('entity', filters.entity);
        if (filters.action) params = params.set('action', filters.action);
        return this.http.get<SpringPage<DataEvent>>(`${this.ADMIN_URL}/audit/data`, { params });
    }

    // ── RoleController : GET /api/admin/roles ──────────────────
    getRoles(): Observable<RoleWithPermissions[]> {
        return this.http.get<RoleWithPermissions[]>(`${this.ADMIN_URL}/roles`);
    }

    // ── RoleController : GET /api/admin/roles/{id}/permissions ─
    getRolePermissions(roleId: string): Observable<string[]> {
        return this.http.get<string[]>(`${this.ADMIN_URL}/roles/${roleId}/permissions`);
    }

    // ── RoleController : PUT /api/admin/roles/{id}/permissions ─
    updateRolePermissions(roleId: string, permissionIds: string[]): Observable<any> {
        return this.http.put(`${this.ADMIN_URL}/roles/${roleId}/permissions`, { permissionIds });
    }

    // ── RoleController : POST /api/admin/roles/{id}/duplicate ─
    duplicateRole(roleId: string, newName: string): Observable<any> {
        const params = new HttpParams().set('newName', newName);
        return this.http.post(`${this.ADMIN_URL}/roles/${roleId}/duplicate`, null, { params });
    }

    // ── RoleController : GET /api/admin/roles/export ─
    exportRolesConfig(): Observable<Blob> {
        return this.http.get(`${this.ADMIN_URL}/roles/export`, { responseType: 'blob' });
    }

    // ── RoleController : GET /api/admin/permissions ───────────
    getAllPermissions(): Observable<Permission[]> {
        return this.http.get<Permission[]>(`${this.ADMIN_URL}/permissions`);
    }

    // ── DashboardController : GET /api/admin/dashboard/stats ────
    getStats(): Observable<any> {
        return this.http.get<any>(`${this.ADMIN_URL}/dashboard/stats`);
    }

    // ── ProfileController : GET /api/admin/profile ──────────────
    getProfile(): Observable<UserResponse> {
        return this.http.get<UserResponse>(`${this.ADMIN_URL}/profile`);
    }

    // ── ProfileController : PUT /api/admin/profile ──────────────
    updateProfile(data: { fullName: string }): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${this.ADMIN_URL}/profile`, data);
    }

    // ── FeatureFlagController : GET /api/admin/features/{email} ──
    getUserFeatures(email: string): Observable<{ [key: string]: boolean }> {
        return this.http.get<{ [key: string]: boolean }>(`${this.ADMIN_URL}/features/${email}`);
    }

    // ── FeatureFlagController : POST /api/admin/features/{email} ─
    updateUserFeatures(email: string, features: { moduleCode: string, isEnabled: boolean }[]): Observable<void> {
        return this.http.post<void>(`${this.ADMIN_URL}/features/${email}`, features);
    }
}
