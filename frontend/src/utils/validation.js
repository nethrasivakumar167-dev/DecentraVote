const encoder = new TextEncoder()

export function utf8Bytes(value) {
  return encoder.encode(value).length
}

export function validatePoll({ question, options, duration }) {
  const errors = {}
  const cleanedOptions = options.map((option) => option.trim())
  if (!question.trim()) errors.question = 'A poll question is required.'
  else if (utf8Bytes(question.trim()) > 200) errors.question = 'Question must be 200 UTF-8 bytes or fewer.'
  if (cleanedOptions.length < 2) errors.options = 'Add at least 2 options.'
  else if (cleanedOptions.length > 10) errors.options = 'A poll can have no more than 10 options.'
  else if (cleanedOptions.some((option) => !option)) errors.options = 'Every option must contain text.'
  else if (cleanedOptions.some((option) => utf8Bytes(option) > 80)) errors.options = 'Each option must be 80 UTF-8 bytes or fewer.'
  else if (new Set(cleanedOptions.map((option) => option.toLocaleLowerCase())).size !== cleanedOptions.length) {
    errors.options = 'Options must be unique.'
  }
  const seconds = Number(duration)
  if (!Number.isInteger(seconds) || seconds < 60) errors.duration = 'Duration must be at least 60 seconds.'
  else if (seconds > 30 * 24 * 60 * 60) errors.duration = 'Duration cannot exceed 30 days.'
  return errors
}
