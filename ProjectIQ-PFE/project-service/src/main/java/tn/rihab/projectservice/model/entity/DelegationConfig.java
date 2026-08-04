package tn.rihab.projectservice.model.entity;

import jakarta.persistence.*;
import lombok.Data;

/**
 * Entité stockant la configuration de la matrice de délégation.
 * Gérée dynamiquement depuis le panel Admin.
 */
@Entity
@Table(name = "delegation_config")
@Data
public class DelegationConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Seuils Budgétaires
    private Double seuilDDA = 500000.0;
    private Double seuilDGA = 2000000.0;
    private Double seuilPDG = 10000000.0;

    // Emails des Décideurs
    private String emailDO = "do@st2i.tn";
    private String emailDDA = "dda@st2i.tn";
    private String emailDGA = "dga@st2i.tn";
    private String emailPDG = "pdg@st2i.tn";

    // Noms des Décideurs / Titres
    private String nomDO = "Direction de l'Offre";
    private String nomDDA = "Direction du Développement des Affaires";
    private String nomDGA = "Direction Générale Adjointe";
    private String nomPDG = "Président Directeur Général";
}
