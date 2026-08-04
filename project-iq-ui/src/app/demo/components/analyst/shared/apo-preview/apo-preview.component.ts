import { Component, Input, OnChanges } from '@angular/core';

export interface ApoSection {
    title: string;
    icon: string;
    fields: ApoFieldDef[];
}

export interface ApoFieldDef {
    key: string;
    label: string;
    value?: string;
    confidence?: number;
    validated?: boolean;
}

@Component({
    selector: 'app-apo-preview',
    templateUrl: './apo-preview.component.html',
    styleUrls: ['./apo-preview.component.scss']
})
export class ApoPreviewComponent implements OnChanges {

    /** Valeurs extraites { PAYS: 'Maroc', CLIENT: 'ONEE', ... } */
    @Input() apoData: Record<string, string> = {};

    /** Confiance IA 0→1 par champ */
    @Input() confidences: Record<string, number> = {};

    /** Liste des champs validés par l'humain */
    @Input() validatedFields: string[] = [];

    /** Étape courante → conditionne le style */
    @Input() mode: 'extraction' | 'validation' | 'indexation' = 'extraction';

    sections: ApoSection[] = [];

    private readonly SECTION_DEFS: { title: string; icon: string; keys: { key: string; label: string }[] }[] = [
        {
            title: 'IDENTIFICATION',
            icon: 'pi-id-card',
            keys: [
                { key: 'INTITULE_OFFRE', label: 'Intitulé de l\'offre' },
                { key: 'CLIENT', label: 'Client / Maître d\'ouvrage' },
                { key: 'PAYS', label: 'Pays' },
                { key: 'BAILLEURS', label: 'Bailleurs de fonds' },
                { key: 'LANGUE', label: 'Langue de soumission' },
            ]
        },
        {
            title: 'CALENDRIER & VISITES',
            icon: 'pi-calendar',
            keys: [
                { key: 'DT_LIM_SOUM', label: 'Date limite de soumission' },
                { key: 'VISITE_OBL', label: 'Visite obligatoire' },
                { key: 'VISITE_DATE', label: 'Date de visite' },
                { key: 'CONF_OBL', label: 'Conférence préparatoire' },
                { key: 'CONF_DATE', label: 'Date de conférence' },
            ]
        },
        {
            title: 'SECTION C — CADRAGE FINANCIER (P1)',
            icon: 'pi-chart-bar',
            keys: [
                { key: 'BUDGET_GLOBAL', label: 'Budget global' },
                { key: 'HOMMES_MOIS', label: 'Hommes-mois (P1)' },
                { key: 'TJM_IMPLICITE', label: 'TJM implicite calculé' },
            ]
        },
        {
            title: 'SECTION D — NOTATION & SÉLECTION (P2)',
            icon: 'pi-star',
            keys: [
                { key: 'MODE_NOTATION', label: 'Mode de notation' },
                { key: 'PON_TECH', label: 'Pondération Technique' },
                { key: 'PON_FIN', label: 'Pondération Financière' },
                { key: 'NOTE_MINIMALE', label: 'Note minimale requise' },
            ]
        },
        {
            title: 'SECTION E — CAUTION (P2)',
            icon: 'pi-shield',
            keys: [
                { key: 'CAUTION_MONTANT', label: 'Montant de la caution' },
                { key: 'CAUTION_MONNAIE', label: 'Monnaie' },
                { key: 'CAUTION_DUREE', label: 'Durée de validité' },
                { key: 'BANQUE_LOCALE_EXIGEE', label: 'Banque locale exigée ?' },
            ]
        },
        {
            title: 'SECTION F — 10 RISQUES (P2)',
            icon: 'pi-exclamation-triangle',
            keys: [
                { key: 'RISQUE_PAYS_SECURITE', label: 'Risque Pays / Sécurité' },
                { key: 'RISQUES_FINANCIERS', label: 'Risques Financiers' },
                { key: 'PENALITES', label: 'Pénalités' },
                { key: 'EXIGENCES_TDR_INACCEPTABLES', label: 'Exigences TdR inacceptables' },
                { key: 'GARANTIES_ASSURANCES_ELEVEES', label: 'Garanties / Assurances élevées' },
                { key: 'TAILLE_DISPERSION', label: 'Taille & Dispersion' },
                { key: 'FRAIS_DIVERS_ELEVES', label: 'Frais divers élevés' },
                { key: 'BUDGET_FAIBLE_HM_LIMITES', label: 'Budget faible / HM limités' },
                { key: 'PARTICIPATION_LOCALE_EXCESSIVE', label: 'Participation locale excessive' },
                { key: 'FISCALITE_NON_MAITRISEE', label: 'Fiscalité non maîtrisée' },
            ]
        },
        {
            title: 'SECTION G — SCORING & DÉCISION (P2)',
            icon: 'pi-chart-line',
            keys: [
                { key: 'PWIN_SCORE', label: 'Score P-Win (%)' },
                { key: 'DELAI_GLOBAL_MOIS', label: 'Délai global (Mois)' },
                { key: 'BUDGET_INTERNE', label: 'Budget Interne Estimé' },
            ]
        }
    ];

    ngOnChanges(): void {
        this.buildSections();
    }

    private buildSections(): void {
        this.sections = this.SECTION_DEFS.map(sdef => ({
            title: sdef.title,
            icon: sdef.icon,
            fields: sdef.keys.map(k => ({
                key: k.key,
                label: k.label,
                value: this.apoData[k.key] || '',
                confidence: this.confidences[k.key] != null
                    ? Math.round((this.confidences[k.key] ?? 0) * 100)
                    : undefined,
                validated: this.validatedFields.includes(k.key),
            }))
        }));
    }

    fieldClass(field: ApoFieldDef): string {
        if (!field.value) return 'field-empty';
        if (this.mode === 'indexation') return 'field-indexed';
        if (field.validated) return 'field-validated';
        return 'field-extracted';
    }

    fieldIcon(field: ApoFieldDef): string {
        if (!field.value) return 'pi-minus-circle';
        if (this.mode === 'indexation') return 'pi-verified';
        if (field.validated) return 'pi-check-circle';
        return 'pi-sparkles';
    }

    get filledCount(): number {
        return Object.values(this.apoData).filter(v => v && v !== '...' && v !== '').length;
    }

    get totalFields(): number {
        return this.SECTION_DEFS.reduce((acc, s) => acc + s.keys.length, 0);
    }

    get fillPercent(): number {
        return this.totalFields === 0 ? 0 : Math.round((this.filledCount / this.totalFields) * 100);
    }
}
