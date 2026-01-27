// Quick test of our extraction logic
const body = {"instagram": "debug_test_2026"};

// Helper function to normalize and trim values
const normalizeValue = (value) => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const firstNonEmpty = value.find(v => v && String(v).trim());
    return firstNonEmpty ? String(firstNonEmpty).trim() : undefined;
  }
  const trimmed = String(value).trim();
  return trimmed || undefined;
};

// Helper function to extract from flat JSON properties
const extractFromFlat = (keys) => {
  for (const key of keys) {
    console.log(`Checking key: ${key}, body[key]: ${body[key]}`);
    if (body[key]) {
      const normalized = normalizeValue(body[key]);
      console.log(`Normalized value: ${normalized}`);
      if (normalized) return normalized;
    }
  }
  return undefined;
};

const igUsername = extractFromFlat(['ig_username', 'instagram_username', 'instagram', 'ig']);
console.log('Final igUsername:', igUsername);