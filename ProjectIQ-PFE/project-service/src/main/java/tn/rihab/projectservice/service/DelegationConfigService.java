package tn.rihab.projectservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.rihab.projectservice.model.entity.DelegationConfig;
import tn.rihab.projectservice.repository.DelegationConfigRepository;

@Service
@RequiredArgsConstructor
public class DelegationConfigService {

    private final DelegationConfigRepository repository;

    /**
     * Récupère la configuration actuelle. Si elle n'existe pas,
     * elle est créée avec les valeurs par défaut définies dans l'entité.
     */
    @Transactional
    public DelegationConfig getCurrentConfig() {
        return repository.findAll().stream().findFirst().orElseGet(() -> {
            DelegationConfig config = new DelegationConfig();
            return repository.save(config);
        });
    }

    /**
     * Met à jour la configuration. Il ne doit y avoir qu'une seule ligne.
     */
    @Transactional
    public DelegationConfig updateConfig(DelegationConfig updatedConfig) {
        DelegationConfig current = getCurrentConfig();
        
        current.setSeuilDDA(updatedConfig.getSeuilDDA());
        current.setSeuilDGA(updatedConfig.getSeuilDGA());
        current.setSeuilPDG(updatedConfig.getSeuilPDG());
        
        current.setEmailDO(updatedConfig.getEmailDO());
        current.setEmailDDA(updatedConfig.getEmailDDA());
        current.setEmailDGA(updatedConfig.getEmailDGA());
        current.setEmailPDG(updatedConfig.getEmailPDG());
        
        current.setNomDO(updatedConfig.getNomDO());
        current.setNomDDA(updatedConfig.getNomDDA());
        current.setNomDGA(updatedConfig.getNomDGA());
        current.setNomPDG(updatedConfig.getNomPDG());
        
        return repository.save(current);
    }
}
