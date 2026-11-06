const MESSAGES: Record<string, string> = {
  invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
  user_already_exists: '이미 가입된 이메일입니다. 로그인해 주세요.',
  email_exists: '이미 가입된 이메일입니다. 로그인해 주세요.',
  weak_password: '비밀번호가 너무 약합니다. 6자 이상, 추측하기 어려운 값을 써 주세요.',
  email_not_confirmed: '이메일 확인이 필요합니다. 메일함의 확인 링크를 눌러 주세요.',
  signup_disabled: '지금은 새로 가입할 수 없습니다.',
  over_request_rate_limit: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  over_email_send_rate_limit: '메일을 너무 자주 보냈습니다. 잠시 후 다시 시도해 주세요.',
  validation_failed: '이메일 형식을 확인해 주세요.',
}

/** Korean message for a Supabase Auth error code; the raw text is never shown to the learner. */
export function authErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
