package tn.rihab.projectservice.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.rihab.projectservice.model.entity.AnonymizationDict;
import tn.rihab.projectservice.repository.AnonymizationDictRepository;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnonymizationService {

    private final AnonymizationDictRepository dictRepository;

    // Cache local pour la rapidité lors du traitement de longs textes
    // Mots-clés triés par longueur (décroissant) pour éviter le remplacement partiel
    private List<AnonymizationDict> cachedDict = new ArrayList<>();

    @PostConstruct
    public void init() {
        refreshCache();
    }

    private void refreshCache() {
        cachedDict = dictRepository.findAll().stream()
                .sorted(Comparator.comparingInt((AnonymizationDict d) -> d.getKeyword().length()).reversed())
                .collect(Collectors.toList());
        log.info("[Anonymization] Cache rechargé avec {} mots-clés", cachedDict.size());
    }

    /**
     * Tâche planifiée : S'exécute tous les jours à minuit pour regénérer les codes.
     */
    @Scheduled(cron = "0 0 0 * * ?")
    @Transactional
    public void regenerateAllCodes() {
        log.info("[Anonymization] Démarrage de la regénération de tous les codes (Job de 24h)");
        List<AnonymizationDict> all = dictRepository.findAll();
        for (AnonymizationDict dict : all) {
            dict.setCurrentCode(generateCode());
        }
        dictRepository.saveAll(all);
        refreshCache();
        log.info("[Anonymization] Regénération terminée");
    }

    /**
     * Regénération forcée depuis l'UI Administrateur.
     */
    @Transactional
    public void forceRegenerateCodes() {
        regenerateAllCodes();
    }

    @Transactional
    public AnonymizationDict addKeyword(String keyword) {
        if (dictRepository.existsByKeyword(keyword)) {
            throw new IllegalArgumentException("Le mot-clé existe déjà.");
        }
        AnonymizationDict dict = AnonymizationDict.builder()
                .keyword(keyword)
                .currentCode(generateCode())
                .build();
        AnonymizationDict saved = dictRepository.save(dict);
        refreshCache();
        return saved;
    }

    @Transactional
    public void removeKeyword(UUID id) {
        dictRepository.deleteById(id);
        refreshCache();
    }

    public List<AnonymizationDict> getAll() {
        return dictRepository.findAll();
    }

    /**
     * Remplace chaque occurrence de mot-clé par son code généré.
     * Utilise des "word boundaries" (\b) pour ne pas remplacer des morceaux de mots.
     */
    public String mask(String text) {
        if (text == null || text.isBlank() || cachedDict.isEmpty()) {
            return text;
        }

        String maskedText = text;
        for (AnonymizationDict dict : cachedDict) {
            // Expression régulière : frontière de mot + mot clé (insensible à la casse) + frontière de mot
            String regex = "(?i)\\b" + Pattern.quote(dict.getKeyword()) + "\\b";
            maskedText = maskedText.replaceAll(regex, dict.getCurrentCode());
        }
        return maskedText;
    }

    /**
     * Remplace chaque code par son vrai mot-clé.
     */
    public String unmask(String text) {
        if (text == null || text.isBlank() || cachedDict.isEmpty()) {
            return text;
        }

        String unmaskedText = text;
        for (AnonymizationDict dict : cachedDict) {
            // Remplace les codes (insensible à la casse par sécurité)
            String regex = "(?i)\\b" + Pattern.quote(dict.getCurrentCode()) + "\\b";
            unmaskedText = unmaskedText.replaceAll(regex, dict.getKeyword());
        }
        return unmaskedText;
    }

    /**
     * Démasque une collection de valeurs (Map). Utile pour traiter les résultats JSON de l'IA.
     */
    public Map<String, String> unmaskMap(Map<String, String> values) {
        if (values == null || values.isEmpty()) return values;
        
        Map<String, String> unmasked = new HashMap<>();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            unmasked.put(entry.getKey(), unmask(entry.getValue()));
        }
        return unmasked;
    }

    private String generateCode() {
        // Génère un code du type "CODE_7A3F9"
        String uuid = UUID.randomUUID().toString().toUpperCase().replace("-", "");
        return "CODE_" + uuid.substring(0, 6);
    }
}
