package tn.rihab.projectservice.dto;

import lombok.*;
import java.util.UUID;

/** DTO envoyé à ia-service pour déclencher une extraction Claude. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ExtractionRequestDto {
    private UUID   dossierId;
    private String documentText;
    /** "P1" | "P2" | "RISKS" | "REFIELD_PAYS" etc. */
    @Builder.Default
    private String phase = "P1";
}