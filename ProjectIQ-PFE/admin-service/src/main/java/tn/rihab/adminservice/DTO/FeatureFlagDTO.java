package tn.rihab.adminservice.DTO;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FeatureFlagDTO {
    private String moduleCode;
    private boolean isEnabled;
}
