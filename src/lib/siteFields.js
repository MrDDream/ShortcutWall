// Upper bounds for the text a site is made of; the forms set the same values
// as maxlength (views/partials/site-modal.ejs).
const FIELD_LIMITS = Object.freeze({ name: 100, description: 300, url: 2048 });

// A user-facing validation failure: `key` is the translation of the message.
class FieldError extends Error {
  constructor(key) {
    super(key);
    this.key = key;
  }
}

// Returns the trimmed value, '' when the field is absent, or throws a
// FieldError when it isn't a string (a repeated field arrives as an array) or
// exceeds `maxLength`.
function readTextField(value, maxLength) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new FieldError('errors.invalidField');
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new FieldError('errors.fieldTooLong');
  }
  return trimmed;
}

// Reads the submitted site fields. Absent fields stay `undefined`, so an
// update can tell "left unchanged" from "cleared".
function readSiteFields(body) {
  const read = (key, maxLength) => (body[key] === undefined ? undefined : readTextField(body[key], maxLength));
  return {
    name: read('name', FIELD_LIMITS.name),
    description: read('description', FIELD_LIMITS.description),
    targetUrl: read('targetUrl', FIELD_LIMITS.url),
    imageUrl: read('imageUrl', FIELD_LIMITS.url),
  };
}

module.exports = { FIELD_LIMITS, FieldError, readTextField, readSiteFields };
