// src/config/PlanConfig.ts

export interface PlanConfig {
  title:       string;
  priceLabel:  string;
  description: string;
  features:    string[];
}

export const PlanDefinitions: Record<'Free'|'Pro'|'Ultimate', PlanConfig> = {
  Free: {
    title:       'Free',
    priceLabel:  'Free',
    description: 'Perfect for learning and small projects',
    features: [
      'Up to 3 database tables',
      'SQL Server export only',
      'Community support',
      'Visual table designer',
      'Single user',
    ],
  },

  Pro: {
    title:       'Pro',
    priceLabel:  '$19',
    description: 'For professionals and serious projects',
    features: [
      'Unlimited database tables',
      'All export formats (MySQL, PostgreSQL, MongoDB, Oracle)', 
      // SQL Server da var, MySQL/Postgre/Postgres/Oracle/Mongo
      'Priority email support',
      'Advanced relationship mapping',
      'Database versioning',
      // biz “API generation” i silirik Pro-dan
    ],
  },

  Ultimate: {
    title:       'Ultimate',
    priceLabel:  '$49',
    description: 'For teams working on multiple projects',
    features: [
      'Everything in Pro plan',
      'Up to 5 team members',
      'Team collaboration',
      'Advanced access controls',
      'Custom templates',
      'Dedicated support',
      // “Database backups” i silirik Ultimate-dən
    ],
  },
};
