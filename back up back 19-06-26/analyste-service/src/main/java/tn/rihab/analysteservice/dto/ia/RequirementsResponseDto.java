package tn.rihab.analysteservice.dto.ia;

import lombok.*;
import java.util.List;

/** Réponse de POST /matching/extract-requirements — exigences structurées extraites de la DP. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RequirementsResponseDto {

    /** Exigences de références (secteur, zone, taille, ancienneté) */
    private List<String> refsExigees;

    /** Qualifications / certifications requises */
    private List<String> qualifsExigees;

    /** Profils experts : rôle, qualif, durée H.M */
    private List<ExpertRequisDto> expertsRequis;

    /** Secteur technique détecté (ex: "Eau & Assainissement") */
    private String secteurDetecte;

    /** Type de contrat détecté (Forfait/Régie/Mixte) */
    private String typeContrat;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ExpertRequisDto {
        private String role;
        private String qualifications;
        private Double dureeMois;
    }
}