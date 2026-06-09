function requireFields(payload, fields) {
  return fields.filter((field) => {
    const value = payload?.[field];

    if (typeof value === 'string') {
      return !value.trim();
    }

    return value === undefined || value === null;
  });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = {
  isNonEmptyString,
  requireFields,
};