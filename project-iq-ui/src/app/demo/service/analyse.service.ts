import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AnalystProjectsService } from './analyst-projects.service';
import { HttpClient } from '@angular/common/http';

// ── UI display types (kept for sub-component compatibility) ───────────────────


export interface ExtractedField {
    id: string;
    label: string;
    value: any;
    confidence: number;
    status: 'ia' | 'human' | 'auto' | 'manual';
    validated: boolean;
    // Used by deep-analysis-page to disable editing of AI-locked fields
    readOnly?: boolean;
    sourceText: string;

    options?: string[];
    type: 'input' | 'select' | 'date' | 'number' | 'textarea';
    required?: boolean;

}

export type ContractField = ExtractedField;
export type EligibilityField = ExtractedField & { gap?: string };
/** @deprecated use contractFields + eligibilityFields */
export type MajorField = ExtractedField;

export interface ContractRisk {
    key: string;
    title: string;
    level: 'FAIBLE' | 'MODERÉ' | 'ÉLEVÉ' | 'RÉDHIBITOIRE';
    justification: string;
}

export interface PwinPreview {
    pwinScore: number;
    tjmImplicite: string;
    budgetGlobal: string;
    hommesMois: string;
    delaiGlobalMois: string;
}

export interface DeepAnalysisData {
    projectId: string;
    projectTitle: string;
    country?: string;
    client?: string;
    contractFields: ContractField[];   // Clauses & Finance (9 auto fields)
    eligibilityFields: EligibilityField[]; // Délais & Capacité (7 fields incl. 2 manual)
    risks: ContractRisk[];             // 10 risques
    pwinPreview?: PwinPreview;
}

// ── Risk metadata ─────────────────────────────────────────────────────────────

const RISK_META: { key: string; title: string }[] = [
    { key: 'RISQUE_PAYS_SECURITE',           title: 'Risque Pays & Sécurité' },
    { key: 'RISQUES_FINANCIERS',             title: 'Risques Financiers' },
    { key: 'PENALITES',                      title: 'Pénalités de retard' },
    { key: 'EXIGENCES_TDR_INACCEPTABLES',    title: 'Exigences TDR Inacceptables' },
    { key: 'GARANTIES_ASSURANCES_ELEVEES',   title: 'Garanties & Assurances Élevées' },
    { key: 'TAILLE_DISPERSION',              title: 'Taille & Dispersion géographique' },
    { key: 'FRAIS_DIVERS_ELEVES',            title: 'Frais Divers & Logistique' },
    { key: 'BUDGET_FAIBLE_HM_LIMITES',       title: 'Budget faible / HM Limités' },
    { key: 'PARTICIPATION_LOCALE_EXCESSIVE', title: 'Participation Locale Excessive' },
    { key: 'FISCALITE_NON_MAITRISEE',        title: 'Fiscalité non maîtrisée' }
];

@Injectable({ providedIn: 'root' })
export class AnalyseService {

    constructor(private projectsService: AnalystProjectsService) {}

    // ── Load Phase 2 data (fields + risks) ────────────────────────────────────

    getAnalysis(projectId: string): Observable<DeepAnalysisData> {
        return forkJoin({
            p2:    this.projectsService.getExtractionP2(projectId),
            risks: this.projectsService.getRisks(projectId),
            dossier: this.projectsService.getDossier(projectId).pipe(catchError(() => of(null)))
        }).pipe(
            map(({ p2, risks, dossier }) => ({
                projectId,
                projectTitle: dossier?.intituleOffre || '',
                country: dossier?.pays || '',
                client: dossier?.client || '',
                contractFields: this.buildContractFields(p2),
                eligibilityFields: this.buildDelaisFields(p2),
                risks: this.buildRisks(risks),
                pwinPreview: this.buildPwinPreview(dossier, p2)
            }))
        );
    }

    // ── Save Phase 2 (fields + risks) ─────────────────────────────────────────

    saveAnalysis(projectId: string, data: DeepAnalysisData): Observable<any> {
        const p2Payload    = this.buildP2Payload(data);
        const risksPayload = this.buildRisksPayload(data.risks);
        return forkJoin({
            p2:    this.projectsService.validateP2(projectId, p2Payload),
            risks: this.projectsService.validateRisks(projectId, risksPayload)
        });
    }

    // ── Payload builders ──────────────────────────────────────────────────────

    private buildP2Payload(data: DeepAnalysisData): any {
        const payload: any = {};
        [...data.contractFields, ...data.eligibilityFields].forEach(f => {
            if (f.id && !f.readOnly && f.value !== undefined && f.value !== '') {
                payload[f.id] = f.value;
            }
        });
        return payload;
    }

    buildRisksPayload(risks: ContractRisk[]): { [key: string]: { niveau: string; justification: string } } {
        const payload: any = {};
        risks.forEach(r => {
            payload[r.key] = { niveau: r.level, justification: r.justification };
        });
        return payload;
    }

    // ── Data transformers ─────────────────────────────────────────────────────

    private buildContractFields(raw: any): ContractField[] {
        // 29 champs APO Clauses & Finance (16-44)
        if (!raw) return [];
        const defs: Array<{ id: string; label: string; type: string; opts?: string[], manual?: boolean }> = [
            { id: 'DATE_LIMITE_SOUMISSION', label: 'DATE_LIMITE_SOUMISSION', type: 'input' },
            { id: 'DATE_LIMITE_QUESTIONS', label: 'DATE_LIMITE_QUESTIONS', type: 'input' },
            { id: 'DELAI_GLOBAL_MOIS', label: 'DELAI_GLOBAL_MOIS', type: 'input' },
            { id: 'DELAI_PREP_SUF', label: 'DELAI_PREP_SUF', type: 'select', opts: ['Oui', 'Non', 'Oui (juste)'] },
            { id: 'JUSTIF_DELAI_PREP', label: 'JUSTIF_DELAI_PREP', type: 'input' },
            { id: 'CAPACITE_DELAI', label: 'CAPACITE_DELAI (Saisie manuelle)', type: 'select', opts: ['Oui', 'Non'], manual: true },
            { id: 'JUSTIF_CAPACITE_DELAI', label: 'JUSTIF_CAPACITE_DELAI (Saisie manuelle)', type: 'input', manual: true },
            { id: 'FIN_LOCAL_OUI_NON', label: 'FIN_LOCAL_OUI_NON', type: 'select', opts: ['Oui', 'Non'] },
            { id: 'FINA_LOCAL_DETAILS', label: 'FINA_LOCAL_DETAILS', type: 'input' },
            { id: 'BUDGET_INTERNE', label: 'BUDGET_INTERNE (Saisie manuelle)', type: 'input', manual: true },
            { id: 'SOURCE_BUDGET_INTERNE', label: 'SOURCE_BUDGET_INTERNE', type: 'input' },
            { id: 'MODE_NOTATION', label: 'MODE_NOTATION', type: 'select', opts: ['Qualité seule', 'Qualité + Prix', 'Prix seul', 'Meilleure valeur'] },
            { id: 'NOTE_MINIMALE', label: 'NOTE_MINIMALE', type: 'input' },
            { id: 'PON_TECH', label: 'PON_TECH', type: 'input' },
            { id: 'PON_FIN', label: 'PON_FIN', type: 'input' },
            { id: 'CAUTION_MONTANT', label: 'CAUTION_MONTANT', type: 'input' },
            { id: 'CAUTION_MONNAIE', label: 'CAUTION_MONNAIE', type: 'select', opts: ['EUR', 'USD', 'GBP', 'XOF', 'MAD', 'DZD', 'TND', 'Autre'] },
            { id: 'CAUTION_DUREE', label: 'CAUTION_DUREE', type: 'input' },
            { id: 'BANQUE_LOCALE_EXIGEE', label: 'BANQUE_LOCALE_EXIGEE', type: 'select', opts: ['Oui', 'Non'] },
            { id: 'RISQUE_PAYS_SECURITE', label: 'RISQUE_PAYS_SECURITE', type: 'select', opts: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
            { id: 'RISQUES_FINANCIERS', label: 'RISQUES_FINANCIERS', type: 'select', opts: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
            { id: 'PENALITES', label: 'PENALITES', type: 'select', opts: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
            { id: 'EXIGENCES_TDR_INACCEPTABLES', label: 'EXIGENCES_TDR_INACCEPTABLES', type: 'select', opts: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
            { id: 'GARANTIES_ASSURANCES_ELEVEES', label: 'GARANTIES_ASSURANCES_ELEVEES', type: 'select', opts: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
            { id: 'TAILLE_DISPERSION', label: 'TAILLE_DISPERSION', type: 'select', opts: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
            { id: 'FRAIS_DIVERS_ELEVES', label: 'FRAIS_DIVERS_ELEVES', type: 'select', opts: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
            { id: 'BUDGET_FAIBLE_HM_LIMITES', label: 'BUDGET_FAIBLE_HM_LIMITES', type: 'select', opts: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
            { id: 'PARTICIPATION_LOCALE_EXCESSIVE', label: 'PARTICIPATION_LOCALE_EXCESSIVE', type: 'select', opts: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
            { id: 'FISCALITE_NON_MAITRISEE', label: 'FISCALITE_NON_MAITRISEE', type: 'select', opts: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
        ];
        return defs.map(d => this.makeField(d.id, d.label, raw[d.id], d.type as any, d.opts, false, d.manual));
    }

    private buildDelaisFields(raw: any): EligibilityField[] {
        // 7 champs Délais & Capacité (APO 16-22)
        if (!raw) return [];
        return [
            this.makeField('DELAI_GLOBAL_MOIS', 'DELAI_GLOBAL_MOIS', raw.DELAI_GLOBAL_MOIS || raw.delaiGlobalMois, 'input'),
            this.makeField('DATE_LIMITE_SOUMISSION', 'DATE_LIMITE_SOUMISSION', raw.DATE_LIMITE_SOUMISSION || raw.dateLimiteSoumission, 'date'),
            this.makeField('DATE_LIMITE_QUESTIONS', 'DATE_LIMITE_QUESTIONS', raw.DATE_LIMITE_QUESTIONS || raw.dateLimiteQuestions, 'date'),
            this.makeField('DELAI_PREP_SUF', 'DELAI_PREP_SUF', raw.DELAI_PREP_SUF || raw.delaiPrepSuf, 'select', ['Oui', 'Non']),
            this.makeField('JUSTIF_DELAI_PREP', 'JUSTIF_DELAI_PREP', raw.JUSTIF_DELAI_PREP || raw.justifDelaiPrep, 'input'),
            this.makeField('CAPACITE_DELAI', 'CAPACITE_DELAI (Saisie manuelle)', raw.CAPACITE_DELAI || raw.capaciteDelai, 'select', ['Oui', 'Non']),
            this.makeField('JUSTIF_CAPACITE_DELAI', 'JUSTIF_CAPACITE_DELAI (Saisie manuelle)', raw.JUSTIF_CAPACITE_DELAI || raw.justifCapaciteDelai, 'input'),
        ] as EligibilityField[];
    }

    private buildRisks(rawRisks: any): ContractRisk[] {
        if (!rawRisks) return RISK_META.map(m => ({ key: m.key, title: m.title, level: 'FAIBLE', justification: '' }));
        return RISK_META.map(meta => {
            const data = rawRisks[meta.key] || { niveau: 'FAIBLE', justification: '' };
            return {
                key:           meta.key,
                title:         meta.title,
                level:         this.normalizeLevel(data.niveau),
                justification: data.justification || ''
            };
        });
    }

    private buildPwinPreview(dossier: any, p2: any): PwinPreview {
        return {
            pwinScore:       dossier?.pwinScore || 0,
            tjmImplicite:    dossier?.tjmImplicite ? `${dossier.tjmImplicite} EUR/j` : '—',
            budgetGlobal:    dossier?.budgetGlobal || '—',
            hommesMois:      dossier?.hommesMois ? `${dossier.hommesMois} HM` : '—',
            delaiGlobalMois: p2?.delaiGlobalMois || '—'
        };
    }

    private makeField(id: string, label: string, value: any, type: any,
                      options?: string[], required = false, readOnly = false): ExtractedField {
        return {
            id, label,
            value:      value ?? '',
            confidence: 85,
            status:     readOnly ? 'auto' : 'ia',
            validated:  false,
            sourceText: '',
            type, options, required, readOnly
        };
    }

    private normalizeLevel(niveau: string): 'FAIBLE' | 'MODERÉ' | 'ÉLEVÉ' | 'RÉDHIBITOIRE' {
        const n = (niveau || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (n.includes('REDHIBITOIRE')) return 'RÉDHIBITOIRE';
        if (n.includes('ELEVE') || n.includes('ELEV')) return 'ÉLEVÉ';
        if (n.includes('MODERE') || n.includes('MODER')) return 'MODERÉ';
        return 'FAIBLE';
    }
}
