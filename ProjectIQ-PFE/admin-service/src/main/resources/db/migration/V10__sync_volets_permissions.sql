-- 1. Nettoyage complet des anciennes permissions factices
DELETE FROM role_permission;
DELETE FROM permission;

-- 2. Insertion des Volets Administrateur
INSERT INTO permission (id, code, label, category) VALUES (gen_random_uuid(), 'SUPERVISION_GLOBALE', 'Supervision Globale', 'Administration Système');
INSERT INTO permission (id, code, label, category) VALUES (gen_random_uuid(), 'PARAMETRES_SYSTEME', 'Paramètres Système', 'Administration Système');
INSERT INTO permission (id, code, label, category) VALUES (gen_random_uuid(), 'GOUVERNANCE', 'Gouvernance', 'Administration Système');
INSERT INTO permission (id, code, label, category) VALUES (gen_random_uuid(), 'MON_COMPTE', 'Mon Compte', 'Administration Système');
INSERT INTO permission (id, code, label, category) VALUES (gen_random_uuid(), 'REFERENTIEL_METIER', 'Référentiel Métier', 'Administration Système');

-- 3. Insertion des Volets Analyste
INSERT INTO permission (id, code, label, category) VALUES (gen_random_uuid(), 'ESPACE_ANALYSTE', 'Espace Analyste', 'Droits Analyste');
INSERT INTO permission (id, code, label, category) VALUES (gen_random_uuid(), 'LIVRABLES', 'Livrables & Historique', 'Droits Analyste');
INSERT INTO permission (id, code, label, category) VALUES (gen_random_uuid(), 'LOGS_IA', 'Logs & IA', 'Droits Analyste');

-- 4. Insertion des Volets Manager
INSERT INTO permission (id, code, label, category) VALUES (gen_random_uuid(), 'ESPACE_DECISION', 'Espace Décision (VIP)', 'Manager Décisionnel');
INSERT INTO permission (id, code, label, category) VALUES (gen_random_uuid(), 'ESPACE_SUPERVISION', 'Espace Supervision', 'Manager Supervision');

-- 5. Assigner TOUT au rôle ADMIN par défaut
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r CROSS JOIN permission p WHERE r.code = 'ADMIN';

-- 6. Assigner les droits Analyste au rôle ANALYST par défaut
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r CROSS JOIN permission p WHERE r.code = 'ANALYST' AND p.category = 'Droits Analyste';

-- 7. Assigner les droits Manager au rôle MANAGER par défaut
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r CROSS JOIN permission p WHERE r.code = 'MANAGER' AND p.category LIKE 'Manager%';
