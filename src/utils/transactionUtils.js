const ENTITY_GROUPS = {
  PERSONAL: ['PERSONAL'],
  BUSINESS: ['BUSINESS', 'MYMOBIZ'],
  TRUST: ['TRUST'],
  CREDIT: ['CREDIT']
};

const FALLBACK_KEYWORDS = {
  PERSONAL: ['personal'],
  BUSINESS: ['business', 'mymobiz'],
  TRUST: ['trust'],
  CREDIT: ['credit']
};

export const normalizeEntity = (value) => {
  if (value === undefined || value === null) return '';
  const normalized = String(value).trim();
  return normalized ? normalized.toUpperCase() : '';
};

const normalizeAccount = (acc) => {
  if (!acc) return '';
  return String(acc).toLowerCase().trim().replace(/\s+/g, ' ');
};

const accountMatchesEntityGroup = (txAcc, entityAccounts, entityName) => {
  if (!txAcc) return false;
  const normalizedTxAcc = normalizeAccount(txAcc);

  if (entityName && normalizedTxAcc.includes(entityName.toLowerCase())) {
    return true;
  }

  return entityAccounts.some(entityAcc => {
    if (!entityAcc) return false;
    const normalizedEntityAcc = normalizeAccount(entityAcc);

    if (normalizedTxAcc === normalizedEntityAcc) return true;
    if (normalizedTxAcc.includes(normalizedEntityAcc) || normalizedEntityAcc.includes(normalizedTxAcc)) {
      return true;
    }

    const txNumbers = normalizedTxAcc.match(/\d+/g) || [];
    const entityNumbers = normalizedEntityAcc.match(/\d+/g) || [];
    if (txNumbers.length > 0 && entityNumbers.length > 0) {
      return txNumbers.some(txNum => entityNumbers.includes(txNum));
    }

    const txWords = normalizedTxAcc.split(/\s+/);
    const entityWords = normalizedEntityAcc.split(/\s+/);
    const commonWords = txWords.filter(word => entityWords.includes(word) && word.length > 2);
    if (commonWords.length > 0) return true;

    return false;
  });
};

const fallbackKeywordMatch = (tx, entity) => {
  const keywords = FALLBACK_KEYWORDS[entity] || [];
  if (keywords.length === 0) return false;
  const acc = String(tx?.acc || '').toLowerCase();
  return keywords.some(keyword => acc.includes(keyword));
};

const matchesAccountHeuristics = (tx, entity, accounts) => {
  if (!tx) return false;

  if (!accounts || typeof accounts !== 'object') {
    const entityLower = entity.toLowerCase();
    const acc = String(tx?.acc || '').toLowerCase();
    return acc.includes(entityLower);
  }

  const pickAccounts = () => {
    switch (entity) {
      case 'PERSONAL':
        return [accounts.PERSONAL, accounts.TRUST].filter(Boolean);
      case 'BUSINESS':
        return [accounts.BUSINESS, accounts.MYMOBIZ].filter(Boolean);
      case 'TRUST':
        return [accounts.TRUST].filter(Boolean);
      case 'CREDIT':
        return [accounts.CREDIT].filter(Boolean);
      default:
        return [];
    }
  };

  const entityAccounts = pickAccounts();
  if (entityAccounts.length === 0) {
    return fallbackKeywordMatch(tx, entity);
  }

  return accountMatchesEntityGroup(tx.acc, entityAccounts, entity);
};

export const ensureTransactionEntities = (transactions = [], files = []) => {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const fileEntityMap = new Map();
  if (Array.isArray(files)) {
    files.forEach(file => {
      if (!file || !file.id) return;
      const normalized = normalizeEntity(file.entity);
      if (normalized) {
        fileEntityMap.set(file.id, normalized);
      }
    });
  }

  return transactions.map(tx => {
    if (!tx || typeof tx !== 'object') return tx;
    const normalizedTxEntity = normalizeEntity(tx.entity);
    if (normalizedTxEntity) {
      return { ...tx, entity: normalizedTxEntity };
    }
    if (tx.fileId && fileEntityMap.has(tx.fileId)) {
      return { ...tx, entity: fileEntityMap.get(tx.fileId) };
    }
    return tx;
  });
};

export const transactionMatchesEntity = (tx, entity, accounts) => {
  if (!tx) return false;
  const normalizedEntity = normalizeEntity(entity);
  if (!normalizedEntity || normalizedEntity === 'ALL') return true;

  const txEntity = normalizeEntity(tx.entity);
  if (txEntity) {
    const allowed = ENTITY_GROUPS[normalizedEntity] || [normalizedEntity];
    return allowed.includes(txEntity);
  }

  return matchesAccountHeuristics(tx, normalizedEntity, accounts);
};

