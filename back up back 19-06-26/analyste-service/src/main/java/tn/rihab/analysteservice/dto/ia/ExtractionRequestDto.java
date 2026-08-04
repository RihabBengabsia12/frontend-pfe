package tn.rihab.analysteservice.dto.ia;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Requête générique d'extraction envoyée à ia-service. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ExtractionRequestDto {
    @JsonProperty("dossier_id")
    private UUID dossierId;
    @JsonProperty("document_text")
    private String documentText;
    /** "P2" | "RISKS" | "REQUIREMENTS" */
    private String phase;
}