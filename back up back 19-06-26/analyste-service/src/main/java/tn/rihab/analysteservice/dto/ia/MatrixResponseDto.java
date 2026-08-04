package tn.rihab.analysteservice.dto.ia;


import lombok.*;
import java.util.List;

/** Matrice de différenciation générée par Claude (Phase 3). */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MatrixResponseDto {

    /** Lignes de la matrice : critère | position Egis | argument/gap */
    private List<MatriceRow> lignes;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MatriceRow {
        private String critere;
        /** COUVERT | PARTIELLEMENT | NON_COUVERT | VIA_PARTENAIRE */
        private String positionEgis;
        private String argumentGap;
    }
}