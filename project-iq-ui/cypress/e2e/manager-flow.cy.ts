describe('Manager Flow', () => {
  it('doit permettre au manager de se connecter et voir son dashboard', () => {
    // Visite la page de login
    cy.visit('/auth/login');
    
    // Entre les identifiants
    cy.get('input[type="text"]').type('manager@egis.fr');
    cy.get('input[type="password"]').type('password123');
    
    // Soumet le formulaire
    cy.get('button').contains('Se connecter').click();
    
    // Vérifie la redirection vers le dashboard manager
    cy.url().should('include', '/manager');
    
    // Vérifie qu'un élément du tableau de bord est visible
    cy.get('h1').should('contain', 'Tableau de bord');
  });
});
