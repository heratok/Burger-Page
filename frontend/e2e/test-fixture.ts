/**
 * Centralized test restaurant fixture for E2E suites.
 * Represents the permanent fixture seeded in database/02_seed.sql.
 */
export const TEST_RESTAURANT = {
  id: 'rest_e2e_fixture',
  slug: 'tienda-pruebas',
  name: 'Tienda de Pruebas',
  username: 'admin_pruebas',
  password: 'admin_pruebas',
  products: {
    clasica: 'prod_test_clasica',
    doble: 'prod_test_doble',
    bbq: 'prod_test_bbq',
    yuca: 'prod_test_yuca',
    gaseosa: 'prod_test_gaseosa',
  },
  categories: {
    general: 'cat_test_general',
    hamburguesas: 'cat_test_hamburguesas',
    bebidas: 'cat_test_bebidas',
  },
  additions: {
    queso: 'add_test_queso',
    bacon: 'add_test_bacon',
    papas: 'add_test_papas',
  },
} as const;
