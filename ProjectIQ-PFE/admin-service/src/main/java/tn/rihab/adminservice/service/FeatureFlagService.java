package tn.rihab.adminservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.rihab.adminservice.DTO.FeatureFlagDTO;
import tn.rihab.adminservice.entity.FeatureFlag;
import tn.rihab.adminservice.repository.FeatureFlagRepository;

import java.util.*;

@Service
@RequiredArgsConstructor
public class FeatureFlagService {

    private static final List<String> DEFAULT_MODULES = List.of(
        "ESPACE_ANALYSTE", "ESPACE_SUPERVISION", "ESPACE_DECISION", "LIVRABLES", "LOGS_IA"
    );

    private final FeatureFlagRepository featureFlagRepository;

    public Map<String, Boolean> getUserFeatures(String userEmail) {
        List<FeatureFlag> flags = featureFlagRepository.findByUserEmail(userEmail);

        // Ensure all default modules exist
        Set<String> existingCodes = new HashSet<>();
        for (FeatureFlag f : flags) existingCodes.add(f.getModuleCode());

        for (String module : DEFAULT_MODULES) {
            if (!existingCodes.contains(module)) {
                FeatureFlag newFlag = FeatureFlag.builder()
                    .userEmail(userEmail)
                    .moduleCode(module)
                    .isEnabled(false)
                    .build();
                featureFlagRepository.save(newFlag);
                flags.add(newFlag);
            }
        }

        Map<String, Boolean> result = new LinkedHashMap<>();
        for (FeatureFlag f : flags) {
            result.put(f.getModuleCode(), f.isEnabled());
        }
        return result;
    }

    @Transactional
    public void updateUserFeatures(String userEmail, List<FeatureFlagDTO> features) {
        for (FeatureFlagDTO dto : features) {
            Optional<FeatureFlag> existing = featureFlagRepository
                .findByUserEmailAndModuleCode(userEmail, dto.getModuleCode());

            if (existing.isPresent()) {
                existing.get().setEnabled(dto.isEnabled());
                featureFlagRepository.save(existing.get());
            } else {
                FeatureFlag newFlag = FeatureFlag.builder()
                    .userEmail(userEmail)
                    .moduleCode(dto.getModuleCode())
                    .isEnabled(dto.isEnabled())
                    .build();
                featureFlagRepository.save(newFlag);
            }
        }

        System.out.println("[FeatureFlagService] Features mis à jour pour: " + userEmail);
    }
}
